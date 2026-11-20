import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bicepsColor, smoothTo } from '../color';
import { elbowRotationX } from './elbow';

// Mặc định nạp public/models/body.glb (cánh tay phải của nhóm, xương ForeArm, vật liệu MAT_Biceps).
// Người dựng bằng khối hình học bên dưới chỉ là phương án dự phòng khi không nạp được file.

const COLOR_TAU_MS = 100;
const ANGLE_TAU_MS = 60; // dữ liệu 10 Hz → làm mượt nhẹ để tay không giật
const BICEPS = { x: 0.044, y: 0.1, z: 0.042 }; // bán trục khi thả lỏng (người dựng bằng khối)
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** xương có trọng số lớn nhất ở đỉnh i */
function dominantBone(m: THREE.SkinnedMesh, i: number): THREE.Bone | undefined {
  const idx = m.geometry.attributes.skinIndex!, w = m.geometry.attributes.skinWeight!;
  let best = 0;
  for (let k = 1; k < 4; k++) if (w.getComponent(i, k) > w.getComponent(i, best)) best = k;
  return m.skeleton.bones[idx.getComponent(i, best)];
}

/** tâm (toạ độ thế giới, đã áp xương) của các đỉnh thoả keep; lấy mẫu 1/5 đỉnh cho nhanh */
function centroid(meshes: THREE.SkinnedMesh[], keep: (m: THREE.SkinnedMesh, i: number) => boolean): THREE.Vector3 {
  const sum = new THREE.Vector3(), v = new THREE.Vector3();
  let n = 0;
  for (const m of meshes)
    for (let i = 0; i < m.geometry.attributes.position!.count; i += 5) {
      if (!keep(m, i)) continue;
      sum.add(m.localToWorld(m.getVertexPosition(i, v)));
      n++;
    }
  return n ? sum.divideScalar(n) : sum;
}

export class Arm3D {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  private readonly controls: OrbitControls;
  private readonly elbow = new THREE.Group();
  private readonly bicepsMat: THREE.MeshStandardMaterial;
  private readonly biceps: THREE.Mesh;
  /** xương cẳng tay của body.glb và trục gập (hệ cục bộ của xương) tính lúc nạp */
  private foreArm: { bone: THREE.Object3D; rest: THREE.Quaternion; axis: THREE.Vector3 } | null = null;
  private readonly bend = new THREE.Quaternion();
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  private targetAngle = 0;
  private angle = 0;
  private targetIntensity = 0;
  private intensity = 0;
  private lastT = performance.now();

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.prepend(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d3e1, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(-2, 3, 2);
    const rim = new THREE.DirectionalLight(0xdbe8ff, 1.4); // viền sáng phía sau để tách người khỏi nền
    rim.position.set(1.5, 2, -2.5);
    this.scene.add(key, rim);

    const skin = new THREE.MeshStandardMaterial({ color: 0xe8b899, roughness: 0.6 }); // cùng màu da gốc của bắp tay
    const shirt = new THREE.MeshStandardMaterial({ color: 0x5e6f88, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b1e3a, roughness: 0.8 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x2b3645, metalness: 0.7, roughness: 0.3 });
    this.bicepsMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });

    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      return o;
    };
    const ball = (r: number, m: THREE.Material, x = 0, y = 0, z = 0) => mesh(new THREE.SphereGeometry(r, 24, 16), m, x, y, z);
    /** đoạn chi thuôn: đỉnh tại gốc toạ độ, chạy xuống −Y */
    const limb = (rTop: number, rBot: number, len: number, m: THREE.Material) =>
      mesh(new THREE.CylinderGeometry(rTop, rBot, len, 24), m, 0, -len / 2, 0);
    /** khối tròn xoay từ hồ sơ [bán kính, độ cao], dẹt theo chiều trước–sau */
    const lathe = (profile: [number, number][], m: THREE.Material, depth: number) => {
      const o = mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 32), m);
      o.scale.z = depth;
      return o;
    };

    const person = new THREE.Group();
    // thân: hông → eo → ngực → vai (áo ba lỗ)
    person.add(lathe([[0, 0.9], [0.15, 0.9], [0.14, 1.02], [0.15, 1.16], [0.185, 1.3], [0.175, 1.4], [0.11, 1.46], [0, 1.47]], shirt, 0.62));
    person.add(lathe([[0, 0.74], [0.16, 0.74], [0.165, 0.84], [0.152, 0.94], [0, 0.94]], dark, 0.7)); // quần
    // cổ + đầu
    const neck = limb(0.048, 0.055, 0.12, skin);
    neck.position.y += 1.56;
    person.add(neck);
    const head = ball(0.1, skin, 0, 1.65, 0.01);
    head.scale.set(0.86, 1.08, 0.95);
    person.add(head);
    // chân
    for (const x of [-0.085, 0.085]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.86, 0);
      leg.add(limb(0.078, 0.056, 0.38, skin), mesh(new THREE.CylinderGeometry(0.088, 0.084, 0.14, 24), dark, 0, -0.07, 0));
      const shin = limb(0.054, 0.036, 0.4, skin);
      shin.position.y -= 0.38;
      leg.add(ball(0.056, skin, 0, -0.38, 0), shin);
      leg.add(mesh(new THREE.BoxGeometry(0.09, 0.06, 0.22, 2, 1, 2), dark, 0, -0.8, 0.05)); // giày
      person.add(leg);
    }

    /** vai → cánh tay trên → khuỷu (nhóm con) → cẳng tay → bàn tay */
    const arm = (x: number, elbow: THREE.Group) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(x, 1.4, 0);
      shoulder.add(ball(0.068, skin, 0, -0.01, 0)); // cơ delta
      shoulder.add(limb(0.048, 0.036, 0.29, skin));
      elbow.position.set(0, -0.29, 0);
      elbow.add(ball(0.037, skin), limb(0.04, 0.027, 0.25, skin), ball(0.036, skin, 0, -0.28, 0));
      shoulder.add(elbow);
      person.add(shoulder);
      return shoulder;
    };
    // tay trái thõng, khuỷu hơi gập cho tự nhiên
    const leftElbow = new THREE.Group();
    leftElbow.rotation.x = -0.15;
    arm(0.22, leftElbow).rotation.z = 0.06;

    // tay phải (người nhìn +Z ⇒ tay phải ở −X): bắp tay trước nằm phía trước cánh tay trên
    const right = arm(-0.22, this.elbow);
    right.rotation.z = -0.06;
    this.biceps = mesh(new THREE.SphereGeometry(1, 32, 20), this.bicepsMat, 0, -0.15, 0.022);
    this.biceps.scale.set(BICEPS.x, BICEPS.y, BICEPS.z);
    right.add(this.biceps);

    const dumbbell = new THREE.Group();
    dumbbell.position.set(0, -0.28, 0);
    const bar = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 12), steel);
    bar.rotation.z = Math.PI / 2;
    dumbbell.add(bar);
    for (const dx of [-0.1, 0.1]) {
      const plate = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 32), steel, dx);
      plate.rotation.z = Math.PI / 2;
      dumbbell.add(plate);
    }
    this.elbow.add(dumbbell);
    this.scene.add(person);

    // bóng mềm dưới chân: đĩa gradient tròn, rẻ hơn bật shadow map
    const g = document.createElement('canvas');
    g.width = g.height = 128;
    const c2d = g.getContext('2d')!;
    const grad = c2d.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(11,30,58,0.28)');
    grad.addColorStop(1, 'rgba(11,30,58,0)');
    c2d.fillStyle = grad;
    c2d.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(g), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.scene.add(shadow);

    // nhìn nghiêng từ phía tay phải, hơi chếch trước, thấy cả người
    this.camera.position.set(-2.5, 1.3, 2.0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(-0.08, 0.88, 0.05);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 5;
    this.controls.minPolarAngle = Math.PI * 0.2;
    this.controls.maxPolarAngle = Math.PI * 0.6;
    this.controls.update();

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.applyColor();
    this.renderer.setAnimationLoop(() => this.frame());
    void this.loadModel([person, shadow], skin, steel);
  }

  setElbowAngle(deg: number): void {
    this.targetAngle = deg;
  }

  setBicepsIntensity(k: number): void {
    this.targetIntensity = k;
  }

  private async loadModel(fallback: THREE.Object3D[], skin: THREE.Material, steel: THREE.Material) {
    const base = import.meta.env.BASE_URL;
    const draco = new DRACOLoader(); // bộ giải nén đi kèm three, Vite tự đóng gói
    let model: THREE.Group;
    try {
      model = (await new GLTFLoader().setDRACOLoader(draco).loadAsync(`${base}models/body.glb`)).scene;
    } catch (err) {
      console.warn('Không nạp được body.glb, dùng người dựng bằng khối.', err);
      return;
    } finally {
      draco.dispose();
    }
    const upper = model.getObjectByName('UpperArm');
    const fore = model.getObjectByName('ForeArm');
    const hand = model.getObjectByName('Hand');
    if (!upper || !fore || !hand) return console.warn('body.glb thiếu xương UpperArm/ForeArm/Hand, dùng người dựng bằng khối.');

    const skinned: THREE.SkinnedMesh[] = [];
    let bicepsMesh: THREE.SkinnedMesh | undefined;
    model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      skinned.push(m);
      const isBiceps = (m.material as THREE.Material).name === 'MAT_Biceps';
      if (isBiceps) bicepsMesh = m;
      m.material = isBiceps ? this.bicepsMat : skin;
      m.frustumCulled = false; // khung bao của lưới có xương không theo tư thế gập
    });
    if (!bicepsMesh) return console.warn('body.glb thiếu vật liệu MAT_Biceps, dùng người dựng bằng khối.');

    // Chuẩn hoá: cánh tay thõng cao 1 đơn vị, tâm ở gốc toạ độ.
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    model.position.sub(box.getCenter(new THREE.Vector3()));
    const root = new THREE.Group();
    root.scale.setScalar(1 / box.getSize(new THREE.Vector3()).y);
    root.add(model);
    this.scene.add(root);
    root.updateMatrixWorld(true);

    // Tự suy ra trục gập từ hình học, không phụ thuộc hệ trục xương sau khi xuất glTF:
    //   d = hướng bắp tay (vuông góc cánh tay trên), v = cẳng tay; gập = quay v về phía d ⇒ trục = v × d.
    const S = upper.getWorldPosition(new THREE.Vector3());
    const E = fore.getWorldPosition(new THREE.Vector3());
    const B = centroid([bicepsMesh], () => true);
    const H = centroid(skinned, (m, i) => dominantBone(m, i) === hand);
    const up = E.clone().sub(S);
    const d = B.clone().sub(S);
    d.sub(up.clone().multiplyScalar(d.dot(up) / up.lengthSq())).normalize();
    const axisW = H.clone().sub(E).cross(d).normalize();
    const toLocal = (o: THREE.Object3D, w: THREE.Vector3) => w.clone().applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()).invert());

    // tạ: tâm ở giữa nắm tay, thanh tạ song song trục gập (cầm ngửa lòng bàn tay như khi curl)
    const dumbbell = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 12), steel);
    bar.rotation.x = Math.PI / 2;
    dumbbell.add(bar);
    for (const dz of [-0.1, 0.1]) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 32), steel);
      plate.rotation.x = Math.PI / 2;
      plate.position.z = dz;
      dumbbell.add(plate);
    }
    hand.add(dumbbell);
    dumbbell.position.copy(hand.worldToLocal(H.clone()));
    dumbbell.quaternion.setFromUnitVectors(Z_AXIS, toLocal(hand, axisW));
    dumbbell.scale.setScalar(1 / hand.getWorldScale(new THREE.Vector3()).x); // về đơn vị cảnh

    fallback.forEach((o) => this.scene.remove(o));
    this.foreArm = { bone: fore, rest: fore.quaternion.clone(), axis: toLocal(fore, axisW) };

    // nhìn chủ yếu dọc trục gập (thấy rõ mặt phẳng gập), chếch về phía bắp tay và hơi từ trên
    this.controls.target.copy(E).add(new THREE.Vector3(0, 0.05, 0));
    const dir = axisW.clone().add(d.clone().multiplyScalar(0.7)).add(new THREE.Vector3(0, 0.25, 0)).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(dir, 2.1);
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 4;
    this.controls.update();
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private applyColor() {
    const [r, g, b] = bicepsColor(this.intensity);
    this.bicepsMat.color.setRGB(r, g, b, THREE.SRGBColorSpace);
    // gồng → bắp tay phồng ra phía trước một chút
    const k = this.intensity;
    this.biceps.scale.set(BICEPS.x * (1 + 0.15 * k), BICEPS.y, BICEPS.z * (1 + 0.35 * k));
  }

  private frame() {
    const now = performance.now();
    const dt = now - this.lastT;
    this.lastT = now;
    const instant = this.reducedMotion.matches;
    this.angle = smoothTo(this.angle, this.targetAngle, dt, instant ? 0 : ANGLE_TAU_MS);
    this.intensity = smoothTo(this.intensity, this.targetIntensity, dt, instant ? 0 : COLOR_TAU_MS);
    this.elbow.rotation.x = elbowRotationX(this.angle);
    if (this.foreArm) {
      this.bend.setFromAxisAngle(this.foreArm.axis, -elbowRotationX(this.angle));
      this.foreArm.bone.quaternion.copy(this.foreArm.rest).multiply(this.bend);
    }
    this.applyColor();
    this.controls.update(); // cần cho enableDamping
    this.renderer.render(this.scene, this.camera);
  }
}
