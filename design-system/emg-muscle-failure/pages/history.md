# History page (`session.html`) — ghi đè MASTER

## Danh sách phiên (`session.html` không có `?id=`)

Bảng, mới nhất trước; mỗi hàng bấm được (cả hàng là link, cao ≥ 44px):

| Bắt đầu | Thời lượng | Kết quả AI | RMS max | |
|---|---|---|---|---|
| 18/11 12:04 | 03:12 | `octagon-alert` Đã thất bại cơ @ 02:41 (hổ phách) | 92% MVC | Xem › |
| 18/11 11:50 | 02:05 | `circle-check` Chưa thất bại cơ (xanh) | 74% MVC | Xem › |
| 18/11 11:42 | — | `activity` Đang chạy | — | Xem live › |

- Số liệu dùng `.num` (Fira Code, tabular).
- < 768 px: bảng chuyển thành danh sách card (2 dòng mỗi phiên), không cuộn ngang.
- Trạng thái rỗng: "Chưa có phiên nào. Chạy `npm run simulate` hoặc bật thiết bị."

## Phát lại (`session.html?id=...`)

Dùng **đúng bố cục trang live** (cùng component), khác ở:

- Header: `← Danh sách` · `Phiên 18/11 12:04 · 03:12` thay cho pill LIVE.
- Thanh điều khiển cố định ở đáy:

```
[▶] [⏪ 5s]  02:41 / 03:12  ━━━━━━━━━━━━━━━━━━━◆━━━━━━━━━  [1× ▾]
                                               ↑ mốc ĐÃ THẤT BẠI CƠ (hổ phách, có tooltip/nhãn chữ)
```

- Thanh tua: `<input type="range">` (bàn phím ←/→ tua 1 s, Shift = 5 s); mốc thất bại cơ là hình thoi hổ phách + nhãn "Thất bại cơ 02:41" (không chỉ dựa vào màu).
- Tốc độ: 0.5× / 1× / 2×.
- Banner AI hiển thị trạng thái **tại thời điểm đang phát** (trước mốc = chưa, sau mốc = đã).
- Biểu đồ hiển thị cửa sổ 10 s quanh thời điểm phát; không có nút tạm dừng riêng (đã có nút play/pause).
- Phím tắt: `Space` play/pause.
