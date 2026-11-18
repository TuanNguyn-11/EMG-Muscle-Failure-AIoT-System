# Design System Master — EMG Muscle Failure

> Trang nào có file `pages/<trang>.md` thì quy tắc trong đó **ghi đè** file này.
> Sinh bằng `ui-ux-pro-max` 2.13.0 (2026-11-18), sau đó đã sửa tay. Phần "Đã loại khỏi bản sinh tự động" ở cuối giải thích các chỗ bỏ.

**Loại sản phẩm:** Dashboard giám sát thời gian thực (IoT / y sinh) · **Chế độ:** tối (mặc định duy nhất ở v1)
**Design dials:** Variance 4 (cân bằng) · Motion 3 (nhẹ) · Density 8 (dày, kiểu dashboard)
**Style:** Data-Dense Dashboard (`style: data-dense-dashboard`): lưới 12 cột, gap 8px, card padding 12px, hiển thị tối đa dữ liệu.

---

## 1. Màu

### Nền & bề mặt

| Vai trò | Hex | Biến |
|---|---|---|
| Background | `#0F172A` | `--color-background` |
| Card | `#1B2336` | `--color-card` |
| Muted (nền phụ, track slider) | `#272F42` | `--color-muted` |
| Border | `#475569` | `--color-border` |
| Foreground (chữ chính) | `#F8FAFC` | `--color-foreground` |
| Muted foreground (chữ phụ, nhãn trục) | `#94A3B8` | `--color-muted-foreground` |
| Focus ring | `#FFFFFF` | `--color-ring` |

### Màu mang nghĩa — mỗi màu **một nghĩa duy nhất**

| Ý nghĩa | Hex | Biến | Dùng ở |
|---|---|---|---|
| **Mức gồng** (RMS / cơ bắp tay) | `#EF4444` | `--color-effort` | Đường RMS, cơ bắp tay đỏ hoàn toàn, thanh mức gồng |
| Màu da (cơ thả lỏng) | `#E8B899` | `--color-skin` | Điểm đầu dải màu cơ |
| EMG thô | `#38BDF8` | `--color-emg` | Đường tín hiệu thô |
| Góc khuỷu | `#A78BFA` | `--color-angle` | Đường góc, số đo góc |
| **ĐÃ THẤT BẠI CƠ** (nhãn AI) | `#F59E0B` | `--color-failure` | Banner nhãn, mốc trên timeline |
| CHƯA THẤT BẠI CƠ | `#22C55E` | `--color-ok` | Banner nhãn |
| Đang kết nối / LIVE | `#22C55E` | `--color-live` | Chấm trạng thái thiết bị |
| Mất dữ liệu / stale | `#94A3B8` | `--color-stale` | Chấm + chữ "Thiết bị không gửi dữ liệu" |

**Quy tắc màu:**
- Đỏ chỉ dùng cho **mức gồng**. Nhãn thất bại cơ dùng **hổ phách**, kèm icon và chữ. Không bao giờ dùng đỏ cho cảnh báo, để người xem không nhầm "cơ đỏ" với "đã thất bại".
- Không truyền đạt bằng màu đơn thuần: nhãn AI luôn có chữ + icon; mỗi biểu đồ có tiêu đề + giá trị hiện tại dạng số.
- Chữ trên nền `--color-card` phải đạt tương phản ≥ 4.5:1 (các màu trên đều đạt trên `#1B2336`; chữ trên banner hổ phách/xanh dùng `#0F172A`).

---

## 2. Chữ

- **Sans (nhãn, tiêu đề, nội dung):** Fira Sans 400/500/600
- **Mono (mọi con số: góc, RMS, thời gian, ID phiên):** Fira Code 400/500. Có `font-variant-numeric: tabular-nums` để số không nhảy độ rộng khi cập nhật 10 Hz.
- Nguồn: kết quả `typography` "Dashboard Data" (Fira Code + Fira Sans).

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Fira+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

| Token | Cỡ | Dùng |
|---|---|---|
| `--text-xs` | 12px | Nhãn trục, chú thích |
| `--text-sm` | 14px | Nhãn card, bảng |
| `--text-base` | 16px | Nội dung, nút |
| `--text-lg` | 20px | Tiêu đề card |
| `--text-display` | 40px mono | Số góc / % gồng lớn trên khung 3D |
| `--text-banner` | 24px 600 | Nhãn AI |

Line-height 1.5 cho chữ, 1.2 cho số lớn.

---

## 3. Khoảng cách, bo góc, bóng

| Token | Giá trị |
|---|---|
| `--space-xs` | 2px |
| `--space-sm` | 4px |
| `--space-md` | 8px (gap lưới) |
| `--space-lg` | 12px (padding card) |
| `--space-xl` | 16px |
| `--space-2xl` | 24px |
| `--radius-sm` | 6px (nút, badge) |
| `--radius-md` | 10px (card) |

Bóng: nền tối nên không dùng bóng để tách lớp; tách bằng `--color-card` + viền 1px `--color-border`.

---

## 4. Component

```css
:root { color-scheme: dark; }

.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
}

.btn {
  min-height: 44px; min-width: 44px;          /* vùng chạm tối thiểu */
  padding: 0 var(--space-xl);
  border-radius: var(--radius-sm);
  background: var(--color-muted);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
  font: 500 var(--text-base)/1 "Fira Sans", sans-serif;
  cursor: pointer;
  transition: background-color 150ms ease;
}
.btn:hover { background: #334155; }
.btn:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }

.status-pill { display: inline-flex; gap: var(--space-sm); align-items: center; font-size: var(--text-sm); }
.status-pill::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }

.ai-banner {                     /* role="status" aria-atomic="true" */
  display: flex; gap: var(--space-md); align-items: center;
  padding: var(--space-lg) var(--space-xl);
  border-radius: var(--radius-md);
  font: 600 var(--text-banner)/1.2 "Fira Sans", sans-serif;
  color: #0F172A;
}
.ai-banner[data-state="ok"]      { background: var(--color-ok); }
.ai-banner[data-state="failure"] { background: var(--color-failure); }

.num { font-family: "Fira Code", monospace; font-variant-numeric: tabular-nums; }
```

**Icon:** Lucide, chép SVG inline (không thêm dependency): `activity` (live), `wifi-off` (stale), `circle-check` (chưa thất bại), `octagon-alert` (đã thất bại), `history`, `play`, `pause`, `rewind`. Icon chỉ trang trí có `aria-hidden="true"`; nút chỉ có icon phải có `aria-label`.

---

## 5. Biểu đồ (uPlot)

Từ kết quả `chart` "Real-Time Streaming":
- Vẽ bằng canvas, giữ bộ đệm **10 s** gần nhất (spec), trục x là thời gian tương đối (giây).
- Mỗi biểu đồ: tiêu đề + **giá trị hiện tại dạng số** ở góc phải (ví dụ `RMS 0.42 mV · 68%`).
- RMS vẽ thêm đường ngang nét đứt tại `rmsRef` (MVC), nhãn "MVC".
- Có nút **Tạm dừng / Tiếp tục** cập nhật biểu đồ (yêu cầu a11y cho nội dung tự chạy); 3D và nhãn AI vẫn cập nhật khi tạm dừng.
- Nền biểu đồ trong suốt trên card; lưới `rgba(148,163,184,0.15)`; nhãn trục `--color-muted-foreground` 12px.
- Không dùng animation chuyển tiếp của thư viện; chỉ đẩy điểm mới.

---

## 6. 3D (three.js)

Từ `--stack threejs`:
- Nạp bằng `GLTFLoader` và **traverse `gltf.scene`** để cấu hình material/shadow cho mọi mesh con; lấy mesh biceps theo tên trong `modelConfig.ts`.
- Cơ bắp tay: material **riêng** (clone), chỉ đổi `color` theo `bicepsColor(intensity)`; làm mượt bằng lọc mũ (τ ≈ 100 ms) để không nhấp nháy ở 10 Hz.
- Nền canvas `--color-background`; một đèn hemisphere + một directional, không cần shadow ở v1 (tiết kiệm GPU điện thoại).
- Xoay camera bằng chuột **và** chạm (OrbitControls hỗ trợ cả hai); giới hạn góc để luôn nhìn thấy tay phải.
- Overlay trên canvas: số góc lớn (`--text-display`, màu `--color-angle`) + thanh mức gồng (dải `--color-skin` → `--color-effort`).
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`; dừng vòng render khi tab ẩn (`visibilitychange`).

---

## 7. Chuyển động

- Thay đổi trạng thái UI (hover, banner đổi): 150–200 ms, `ease-out`.
- Banner đổi sang "ĐÃ THẤT BẠI CƠ": một lần nhấn mạnh nhẹ (scale 1 → 1.02 → 1, 300 ms); **không** nhấp nháy lặp.
- `prefers-reduced-motion: reduce`: bỏ hiệu ứng nhấn mạnh và làm mượt màu cơ; dữ liệu vẫn cập nhật.
- Không dùng GSAP / scroll reveal (dashboard một màn hình, không cuộn để khám phá).

---

## 8. Responsive

Breakpoint: 375 · 768 · 1024 · 1440. Mobile-first; không cuộn ngang; không chặn zoom (`<meta name="viewport" content="width=device-width, initial-scale=1">`).

---

## 9. Anti-patterns

- ❌ Đỏ cho bất cứ thứ gì không phải mức gồng.
- ❌ Hiển thị "LIVE" khi dữ liệu đã cũ > 2 s: phải chuyển sang trạng thái stale kèm thời điểm cập nhật cuối.
- ❌ Glassmorphism / `backdrop-filter` chồng lên canvas 3D hoặc biểu đồ.
- ❌ Emoji làm icon.
- ❌ Mỗi con số là một `aria-live` riêng: chỉ banner AI và trạng thái kết nối là `role="status"`.
- ❌ Phần trăm mỏi, chẩn đoán, xác suất y khoa (SPEC).

---

## 10. Pre-delivery checklist

- [ ] Tương phản chữ ≥ 4.5:1; focus ring thấy rõ khi dùng bàn phím
- [ ] Vùng chạm ≥ 44×44 px, cách nhau ≥ 8 px
- [ ] Nhãn AI có chữ + icon, không chỉ màu
- [ ] Trạng thái stale hiển thị đúng khi tắt simulator
- [ ] `prefers-reduced-motion` được tôn trọng
- [ ] Không cuộn ngang ở 375 px; thử 768 / 1024 / 1440
- [ ] 3D + 3 biểu đồ ≥ 30 fps trên laptop; thử trên Android thật

---

## Đã loại khỏi bản sinh tự động

| Bản sinh đề xuất | Lý do loại |
|---|---|
| Font Cinzel + Josefin Sans | Khớp nhầm nhóm "bất động sản/xa xỉ"; thay bằng Fira Sans + Fira Code (truy vấn `typography` riêng) |
| Style Glassmorphism | `backdrop-filter` trên canvas 3D + biểu đồ tốn GPU điện thoại và giảm tương phản số liệu; thay bằng Data-Dense Dashboard (truy vấn `style` riêng) |
| Pattern "Operations Landing" (hero, CTA, how it works) | Đây là trang landing marketing; dashboard không có CTA. Chỉ giữ ý "nhãn live phải có thời điểm cập nhật và trạng thái stale, có nút tạm dừng" |
| GSAP scroll reveal | Dashboard một màn hình, không cuộn; tránh thêm dependency |
| Card hover nâng lên + `cursor: pointer` trên mọi card | Card dashboard không bấm được; chỉ phần tử bấm được mới có pointer |
| Modal nền trắng, input viền `#E2E8F0` | Không hợp chế độ tối; v1 không có modal/form |
