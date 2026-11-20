# Live page (`index.html`) — ghi đè MASTER

## Bố cục (bento, cập nhật 2026-11-20)

Style: **Bento Box Grid** (`ui-ux-pro-max --domain style`): card trắng bo 20px, khoảng cách 16px, bóng `--shadow-card`, nền `#F5F8FC`. Card dữ liệu không phóng to khi hover vì không bấm được.

**≥ 1024 px**: header 68px + lưới 2 cột (5fr | 7fr), vừa một màn hình:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [▲] EMG Muscle Failure                  (● LIVE · 0.2 s · esp32s3-01) [Fake]│
│     Giám sát bài curl tạ · tay phải                                         │
├──────────────────────────────┬────────────────────────────┬────────┬───────┤
│ (Mô hình 3D)     Kéo để xoay │ (✓) NHẬN ĐỊNH AI           │TẬP     │KHÔNG  │
│                              │     CHƯA THẤT BẠI CƠ       │CHUẨN 9 │CHUẨN 2│
│        Người 3D              ├────────────────────────────┴────────┴───────┤
│     (nền gradient,           │ Tín hiệu · 10 giây gần nhất  [⏸ Tạm dừng]   │
│      bóng mềm dưới chân)     │ ■ EMG thô                         (0.12 mV) │
│                              │ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ │
│ ┌──────┐ ┌────────────────┐  │ ■ RMS  nét đứt = MVC        (0.42 mV · 68%) │
│ │ 92°  │ │ Mức gồng 68% ██░│  │ ▁▂▅▇▅▂▁ (vùng tô mờ)                         │
│ └──────┘ └────────────────┘  │ ■ Góc khuỷu                          (92°)  │
└──────────────────────────────┴─────────────────────────────────────────────┘
```

- Ô **Nhận định AI**: 3 trạng thái `idle` (xám, "Chờ dữ liệu"), `ok` (nền xanh nhạt, icon tròn xanh), `failure` (nền cam, chữ navy).
- **Biểu đồ**: RMS và góc là biểu đồ vùng (gradient 22% → 0%); EMG thô chỉ có đường (tín hiệu đối xứng quanh 0, tô vùng gây rối mắt).
- Header: logo vuông xanh primary + tên + phụ đề; chip trạng thái dạng viên thuốc (xanh nhạt + chấm nhấp nháy khi LIVE, cam nhạt khi FAKE); nút **Fake** primary, chuyển cam khi đang bật.

**768–1023 px:** một cột: 3D (48vh) → KPI → tín hiệu (mỗi biểu đồ 170px).
**< 768 px:** như trên, 3D 42vh; ô AI chiếm cả hàng, 2 ô đếm chia đôi; ẩn phụ đề, mã thiết bị, gợi ý xoay.

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

## Ô số liệu (dataviz)
- Một ô **Lần tập**: tổng số (sans 600, màu navy) + "x% đạt chuẩn" + thanh chia phần 8px (xanh = chuẩn, cam = không chuẩn, khe 2px) + chú thích có ô màu và số navy.
- Giá trị và nhãn luôn dùng màu chữ; màu trạng thái chỉ nằm trên ô màu/thanh.

## Bố cục một màn hình (chốt với người dùng, thay bố cục bento ở trên)
- Màn mục tiêu 1920×1080 (vừa luôn từ 1280×720 trở lên): **không cuộn**, `.dash` cao `100dvh − header`.
- Header navy #0B1E3A, chữ trắng; chip trạng thái: chữ nói trạng thái, chấm màu là tín hiệu phụ.
- Hàng 1: 4 ô số liệu — Nhận định AI · Góc khuỷu · Mức gồng (% MVC + thanh) · Lần tập. Số 44px semibold navy.
- Hàng 2: 3D (trái) và Tín hiệu (phải) rộng bằng nhau.
- Tín hiệu: **một biểu đồ gộp** RMS (vùng đỏ, trục trái mV, đường MVC) + góc (đường #145da0, trục phải °) — người dùng chọn hai thang đo dù đã được báo rủi ro đọc nhầm; chú thích ghi rõ "trục trái/trục phải". Dải EMG thô bên dưới mang trục thời gian.
- Dưới 1024px rộng hoặc 640px cao: xếp dọc và cuộn bình thường.
