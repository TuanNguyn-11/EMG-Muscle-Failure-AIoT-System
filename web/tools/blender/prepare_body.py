"""Chuẩn bị body.glb từ model MakeHuman (CC0) cho web dashboard.

Việc script làm:
  1. Nạp file FBX xuất từ MakeHuman (hoặc dùng scene đang mở trong Blender).
  2. Tìm mesh da có gắn xương, chọn vùng CƠ BẮP TAY TRƯỚC PHẢI theo trọng số skin của
     xương cánh tay trên phải + vị trí phía trước cánh tay, gán vật liệu riêng "biceps_r"
     (bản sao vật liệu da, nên lúc thả lỏng trông y như da).
  3. Xuất GLB có xương (không animation) ra --out.

Chạy (không cần mở giao diện Blender):
  blender -b --python web/tools/blender/prepare_body.py -- --fbx D:/model/body.fbx --out web/public/models/body.glb

Nếu vùng được chọn nằm ở MẶT SAU cánh tay, chạy lại với --forward 0,1,0.
Nếu báo không tìm thấy xương, script in danh sách vertex group để chọn đúng tên cho --bones.
Chạy thêm --preview để lưu ảnh render kiểm tra vùng biceps (tô đỏ) cạnh file --out.
"""
import argparse
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--fbx", help="file FBX từ MakeHuman; bỏ trống = dùng scene đang mở")
ap.add_argument("--out", required=True, help="đường dẫn body.glb")
# Tên xương cánh tay trên phải: skeleton Default của MakeHuman (upperarm01/02.R) hoặc Game engine (upperarm_r)
ap.add_argument("--bones", default="upperarm01.R,upperarm02.R")
ap.add_argument("--min-weight", type=float, default=0.5, help="tổng trọng số tối thiểu theo các xương trên")
ap.add_argument("--span", default="0.15,0.85", help="đoạn dọc xương (0=vai, 1=khuỷu) chứa bụng cơ")
ap.add_argument("--forward", default="0,-1,0", help="hướng mặt trước cơ thể trong Blender (MakeHuman nhập vào: -Y)")
ap.add_argument("--front", type=float, default=0.3, help="cos góc tối thiểu so với hướng trước (0.3 ≈ ±72°)")
ap.add_argument("--preview", action="store_true")
args = ap.parse_args(argv)

if args.fbx:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(args.fbx))

armature = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
if armature is None:
    sys.exit("Không có armature: khi xuất từ MakeHuman phải chọn một Skeleton (tab Pose/Animate > Skeleton).")

skinned = [o for o in bpy.data.objects if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)]
if not skinned:
    sys.exit("Không có mesh nào gắn armature.")
body = max(skinned, key=lambda o: len(o.data.vertices))
print(f"Mesh da: {body.name} ({len(body.data.vertices)} đỉnh)")

wanted = [b.strip() for b in args.bones.split(",") if b.strip()]
names = [n for n in wanted if n in body.vertex_groups and n in armature.data.bones]
if not names:
    arm_groups = sorted(g.name for g in body.vertex_groups if "arm" in g.name.lower())
    sys.exit(f"Không thấy xương {wanted}. Vertex group có chữ 'arm': {arm_groups}")
print(f"Xương cánh tay trên phải: {names}")

# đoạn xương trong toạ độ thế giới, tư thế nghỉ
mw = armature.matrix_world
head = mw @ armature.data.bones[names[0]].head_local
tail = mw @ armature.data.bones[names[-1]].tail_local
seg = tail - head
t0, t1 = (float(x) for x in args.span.split(","))
forward = Vector(tuple(float(x) for x in args.forward.split(","))).normalized()
gidx = {body.vertex_groups[n].index for n in names}
bw = body.matrix_world

picked = set()
for v in body.data.vertices:
    w = sum(g.weight for g in v.groups if g.group in gidx)
    if w < args.min_weight:
        continue
    p = bw @ v.co
    t = (p - head).dot(seg) / seg.length_squared
    if not (t0 <= t <= t1):
        continue
    radial = p - (head + seg * t)
    if radial.length > 1e-6 and radial.normalized().dot(forward) >= args.front:
        picked.add(v.index)

faces = [poly for poly in body.data.polygons if all(i in picked for i in poly.vertices)]
if len(faces) < 20:
    sys.exit(f"Chỉ chọn được {len(faces)} mặt — thử --forward 0,1,0 hoặc giảm --min-weight / --front.")

src = body.material_slots[faces[0].material_index].material if body.material_slots else None
biceps = src.copy() if src else bpy.data.materials.new("biceps_r")
biceps.name = "biceps_r"
body.data.materials.append(biceps)
idx = len(body.data.materials) - 1
for poly in faces:
    poly.material_index = idx
body.name = "body"
print(f"Gán biceps_r cho {len(faces)} mặt ({len(picked)} đỉnh).")

out = os.path.abspath(args.out)
os.makedirs(os.path.dirname(out), exist_ok=True)
opts = dict(filepath=out, export_format="GLB", export_skins=True, export_animations=False, export_apply=False)
try:
    bpy.ops.export_scene.gltf(**opts, export_image_format="JPEG")  # ảnh da JPEG cho nhẹ
except TypeError:
    bpy.ops.export_scene.gltf(**opts)
print(f"Đã xuất {out} ({os.path.getsize(out) / 1e6:.1f} MB)")

if args.preview:
    # ảnh kiểm tra: tô đỏ biceps_r, camera nhìn chéo trước bên phải (không ảnh hưởng file đã xuất)
    biceps.use_nodes = False
    biceps.diffuse_color = (1, 0, 0, 1)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x, scene.render.resolution_y = 800, 1000
    cam = bpy.data.objects.new("preview_cam", bpy.data.cameras.new("preview_cam"))
    scene.collection.objects.link(cam)
    target = (head + tail) / 2
    cam.location = target + forward * 1.2 + (tail - head).cross(forward).normalized() * -0.6
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.splitext(out)[0] + "_preview.png"
    bpy.ops.render.render(write_still=True)
    print(f"Ảnh kiểm tra: {scene.render.filepath}")
