import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bicepsColor, smoothTo } from '../color';
import { elbowRotationX } from './elbow';

// ponytail: khung người dựng từ khối cơ bản, CHỈ để phát triển (SPEC: không dùng khi demo).
// T7 thay bằng body.glb nhưng giữ nguyên hai hàm setElbowAngle / setBicepsIntensity.

const COLOR_TAU_MS = 100;
const ANGLE_TAU_MS = 60; // dữ liệu 10 Hz → làm mượt nhẹ để tay không giật

export class Arm3D {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  private readonly controls: OrbitControls;
  private readonly elbow = new THREE.Group();
  private readonly bicepsMat: THREE.MeshStandardMaterial;
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

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-2, 3, 2);
    this.scene.add(sun);

    const body = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
    this.bicepsMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6, roughness: 0.35 });

    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      return o;
    };
    const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 16);

    const person = new THREE.Group();
    person.add(mesh(capsule(0.17, 0.42), body, 0, 1.2, 0));          // thân
    person.add(mesh(new THREE.SphereGeometry(0.11, 24, 16), body, 0, 1.62, 0)); // đầu
    for (const x of [-0.09, 0.09]) person.add(mesh(capsule(0.07, 0.72), body, x, 0.5, 0)); // chân

    // tay trái thõng
    person.add(mesh(capsule(0.045, 0.5), body, 0.25, 1.15, 0));

    // tay phải (người nhìn +Z ⇒ tay phải ở −X): vai → cánh tay trên → khuỷu → cẳng tay → tạ
    const shoulder = new THREE.Group();
    shoulder.position.set(-0.25, 1.42, 0);
    shoulder.add(mesh(capsule(0.05, 0.22), body, 0, -0.14, 0));
    const biceps = mesh(new THREE.SphereGeometry(1, 24, 16), this.bicepsMat, 0, -0.14, 0.03);
    biceps.scale.set(0.05, 0.11, 0.045);
    shoulder.add(biceps);

    this.elbow.position.set(0, -0.29, 0);
    this.elbow.add(mesh(capsule(0.042, 0.22), body, 0, -0.14, 0));
    this.elbow.add(mesh(new THREE.SphereGeometry(0.045, 16, 12), body, 0, -0.3, 0)); // bàn tay
    const dumbbell = new THREE.Group();
    dumbbell.position.set(0, -0.3, 0);
    const bar = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 12), steel);
    bar.rotation.z = Math.PI / 2;
    dumbbell.add(bar);
    for (const x of [-0.11, 0.11]) {
      const plate = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 24), steel, x);
      plate.rotation.z = Math.PI / 2;
      dumbbell.add(plate);
    }
    this.elbow.add(dumbbell);
    shoulder.add(this.elbow);
    person.add(shoulder);
    this.scene.add(person);

    // nhìn nghiêng từ phía tay phải, hơi chếch trước
    this.camera.position.set(-2.2, 1.35, 1.3);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(-0.15, 1.15, 0.1);
    this.controls.enablePan = false;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 4;
    this.controls.minPolarAngle = Math.PI * 0.2;
    this.controls.maxPolarAngle = Math.PI * 0.6;
    this.controls.update();

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.applyColor();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setElbowAngle(deg: number): void {
    this.targetAngle = deg;
  }

  setBicepsIntensity(k: number): void {
    this.targetIntensity = k;
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
  }

  private frame() {
    const now = performance.now();
    const dt = now - this.lastT;
    this.lastT = now;
    const instant = this.reducedMotion.matches;
    this.angle = smoothTo(this.angle, this.targetAngle, dt, instant ? 0 : ANGLE_TAU_MS);
    this.intensity = smoothTo(this.intensity, this.targetIntensity, dt, instant ? 0 : COLOR_TAU_MS);
    this.elbow.rotation.x = elbowRotationX(this.angle);
    this.applyColor();
    this.renderer.render(this.scene, this.camera);
  }
}
