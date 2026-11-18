# Live page (`index.html`) — ghi đè MASTER

## Bố cục

**≥ 1024 px** — header + lưới 12 cột, cao vừa một màn hình (không cuộn):

```
┌──────────────────────────────────────────────────────────────────────┐
│ EMG Muscle Failure      ● LIVE · 0.2 s trước · esp32s3-01  [Lịch sử] │  header 56px
├───────────────────────────────┬──────────────────────────────────────┤
│                               │ [✓ CHƯA THẤT BẠI CƠ]   Phiên 12:04  │  banner AI
│        Người 3D               ├──────────────────────────────────────┤
│        (5 cột)                │ EMG thô              −0.12 mV       │
│                               │ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ │
│   92°     ← số góc lớn        ├──────────────────────────────────────┤
│   Mức gồng ██████░░ 68%       │ RMS                 0.42 mV · 68%   │
│                               │ ---- MVC ----------------------------│
│                               ├──────────────────────────────────────┤
│                               │ Góc khuỷu                  92°      │
│                               │ ⏸ Tạm dừng biểu đồ                   │
└───────────────────────────────┴──────────────────────────────────────┘
```

- Cột trái (5/12): canvas 3D chiếm toàn bộ chiều cao; overlay góc dưới-trái: số góc + thanh mức gồng.
- Cột phải (7/12): banner AI, rồi 3 biểu đồ chia đều chiều cao còn lại, nút tạm dừng ở cuối.

**768–1023 px:** 3D ở trên (45vh), banner, 3 biểu đồ bên dưới (cuộn dọc được).
**< 768 px:** như trên, 3D 40vh, biểu đồ cao 140px mỗi cái; header thu gọn còn chấm trạng thái + icon `history`.

## Trạng thái

| Trạng thái | Header | Banner AI | 3D | Biểu đồ |
|---|---|---|---|---|
| Chưa có phiên | `● Chờ thiết bị` (stale) | ẩn, thay bằng chữ "Chưa có phiên đang chạy" | tư thế duỗi, cơ màu da | trống + chữ hướng dẫn |
| Live | `● LIVE · x s trước` (xanh) | theo `label` (đã chốt) | theo dữ liệu | chạy |
| Stale > 2 s | `wifi-off Thiết bị không gửi dữ liệu · cập nhật cuối hh:mm:ss` (xám) | giữ nguyên giá trị cuối | đứng yên ở giá trị cuối | dừng, không xoá |
| Phiên kết thúc | `Phiên đã kết thúc` + link "Xem lại" | giữ giá trị cuối | đứng yên | dừng |

## A11y riêng trang

- `role="status" aria-atomic="true"` cho banner AI (đọc "Đã thất bại cơ") và pill kết nối; không gắn cho số góc/RMS.
- Canvas 3D có `aria-label="Mô hình tay phải, góc khuỷu 92 độ, mức gồng 68 phần trăm"`, cập nhật **tối đa 1 lần/giây**.
- Phím tắt: `Space` = tạm dừng/tiếp tục biểu đồ.
