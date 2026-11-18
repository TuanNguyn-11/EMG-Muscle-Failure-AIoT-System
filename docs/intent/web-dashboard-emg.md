# Statement of Intent — Web dashboard giám sát EMG từ xa

Xác nhận ngày 2026-11-18.

- **Outcome:** Web dashboard giám sát từ xa bài curl tạ: mô hình **3D** người cầm tạ, khuỷu gập theo góc thật từ IMU; cơ bắp tay trước đỏ dần theo **mức gồng** (biên độ EMG); biểu đồ EMG thô, RMS, góc khuỷu chạy live; nhãn AI riêng **`CHƯA THẤT BẠI CƠ` / `ĐÃ THẤT BẠI CƠ`**.
- **Luồng dữ liệu:** ESP32-S3 (AI ở biên) → **Firebase Realtime Database**, hai luồng: dữ liệu đã xử lý (RMS, góc, nhãn AI) và dữ liệu thô đã giảm tần số, gửi theo gói → web nghe RTDB.
- **User:** Bạn/nhóm + giảng viên/hội đồng, xem từ bất kỳ đâu qua link.
- **Lịch sử:** Mỗi set là một phiên; trang lịch sử liệt kê phiên, mở ra phát lại biểu đồ + mô hình 3D, thấy thời điểm AI báo thất bại cơ.
- **Success:** Người thật gồng/gập tay → tay 3D gập theo, cơ đỏ dần, biểu đồ chạy với độ trễ thấp (mục tiêu < ~0.5 s); xem lại được các set đã tập.
- **Constraint:** Firebase RTDB; băng thông/chi phí ghi là giới hạn chính nên dữ liệu thô phải giảm tần số; phần cứng MyoWare + ESP32-S3 + IMU.
- **Out of scope:** đăng nhập/phân quyền nhiều người dùng, điều khiển thiết bị từ web, quản lý hồ sơ bệnh nhân, hiển thị % mỏi hay chẩn đoán y khoa, thay thế phân tích MATLAB.

## Ghi chú mở (chưa xác minh)
- Firmware hiện tại (`MyoWareRawS3`) chưa đọc IMU và chưa có mô hình AI.
- Tần số giảm mẫu dữ liệu thô chưa được tính theo giới hạn/chi phí RTDB.
