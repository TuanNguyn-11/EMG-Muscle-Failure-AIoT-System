"""Xuất mô hình cánh tay của nhóm (Tao khoi1.blend, repo Đồ án 1) thành body.glb cho web.

Việc script làm:
  1. Bỏ lưới điêu khắc gốc "Vert.002" (3 triệu đỉnh, không gắn xương).
  2. Giảm lưới "Icosphere.002" (~1 triệu tam giác) còn khoảng --tris tam giác.
     Decimate đặt TRƯỚC modifier Armature nên trọng số xương được giữ lại.
  3. Bỏ cánh tay bản sao đứng yên (nằm đối xứng qua x = 0), chỉ giữ tay phải có xương.
  4. Xuất GLB gồm cánh tay + bộ xương + vật liệu (MAT_Biceps giữ nguyên tên), nén Draco.

Chạy (không cần mở giao diện Blender), từ thư mục Do_an_2:
  blender -b "D:/duong/dan/Tao khoi1.blend" --python web/tools/blender/export_arm.py -- --out web/public/models/body.glb

Không ghi đè file .blend gốc (script không lưu .blend).
"""
import argparse
import os
import sys

import bpy

ARM_MESH = "Icosphere.002"
SCULPT_SRC = "Vert.002"

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="body.glb")
ap.add_argument("--tris", type=int, default=160_000, help="số tam giác của CẢ HAI tay sau khi giảm (bỏ tay bản sao còn ~một nửa)")
args = ap.parse_args(argv)

ob = bpy.data.objects.get(ARM_MESH)
if ob is None:
    sys.exit(f"Không thấy đối tượng {ARM_MESH}. Có: {[o.name for o in bpy.data.objects]}")
arm = ob.parent  # Armature
src = bpy.data.objects.get(SCULPT_SRC)
if src is not None:
    bpy.data.objects.remove(src)

tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
ratio = min(1.0, args.tris / tris)
print(f"[export_arm] {tris:,} tam giác → ratio {ratio:.3f}")

dec = ob.modifiers.new("Decimate", "DECIMATE")
dec.ratio = ratio
with bpy.context.temp_override(object=ob, active_object=ob):
    bpy.ops.object.modifier_move_to_index(modifier=dec.name, index=0)
    bpy.ops.object.modifier_apply(modifier=dec.name)

# File có thêm một cánh tay bản sao đứng yên (khi xuất bị gán vào "neutral_bone").
import bmesh  # noqa: E402

bm = bmesh.new()
bm.from_mesh(ob.data)
deform = bm.verts.layers.deform.verify()
# Tay bản sao nằm đối xứng qua mặt phẳng x = 0 (toạ độ thế giới): giữ phía có các đỉnh gắn xương ForeArm.
mw = ob.matrix_world
fore = ob.vertex_groups["ForeArm"].index
moving = [(mw @ v.co).x for v in bm.verts if v[deform].get(fore, 0) > 0.5]
side = sum(moving) / len(moving)
loose = [v for v in bm.verts if (mw @ v.co).x * side < 0]
bmesh.ops.delete(bm, geom=loose, context="VERTS")
bm.to_mesh(ob.data)
bm.free()
print(f"[export_arm] bỏ {len(loose):,} đỉnh của cánh tay bản sao")

after = sum(len(p.vertices) - 2 for p in ob.data.polygons)
print(f"[export_arm] còn {after:,} tam giác, vật liệu: {[m.name for m in ob.data.materials if m]}")

for o in bpy.context.view_layer.objects:
    o.select_set(o in (ob, arm))
out = os.path.abspath(args.out)
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_selection=True,
    export_skins=True,
    export_animations=False,
    export_draco_mesh_compression_enable=True,
)
print(f"[export_arm] đã xuất {out} ({os.path.getsize(out) / 1e6:.1f} MB)")
