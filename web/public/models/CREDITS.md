# Nguồn model 3D

## body.glb — cánh tay phải, có vật liệu `MAT_Biceps`

- **Tác giả:** thành viên nhóm (điền tên) — dựng trong Blender cho Đồ án 1.
- **File gốc:** `Model 3D/Tao khoi1.blend` trong repo [EMG-Elbow-Angle-Acquisition-System](https://github.com/TuanNguyn-11/EMG-Elbow-Angle-Acquisition-System) (Git LFS).
- **Quyền dùng:** dùng trong đồ án của nhóm; hỏi tác giả trước khi dùng ở nơi khác.
- **Xử lý:** `web/tools/blender/export_arm.py` (Blender 5.3) — bỏ lưới điêu khắc gốc và cánh tay bản sao đứng yên, giảm còn ~80k tam giác, xuất GLB nén Draco (~1.7 MB).

| Mục | Giá trị |
|---|---|
| Xương | Shoulder → UpperArm → ForeArm → Hand (+ 4 xương phụ ở cẳng tay) |
| Gập khuỷu | xoay `ForeArm`; trục gập được tính lúc nạp từ hướng bắp tay (`MAT_Biceps`) và cẳng tay |
| Vật liệu | `MAT_ArmDefault` (da), `MAT_Biceps` (đổi màu theo mức gồng) |
