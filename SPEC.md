# Spec: Web dashboard giám sát EMG từ xa

> Nguồn: [docs/intent/web-dashboard-emg.md](docs/intent/web-dashboard-emg.md) (đã xác nhận 2026-11-18).
> Trạng thái: **ĐÃ DUYỆT 2026-11-18** (open questions 1–5 đã chốt; còn câu hỏi về nguồn model 3D). Firmware ESP32 (IMU, AI ở biên, ghi RTDB) **không** thuộc spec này; spec này chỉ định nghĩa *hợp đồng dữ liệu* mà firmware phải ghi.

## Giả định (sửa ngay nếu sai)

1. Một thiết bị duy nhất (`deviceId = "esp32s3-01"`), một người tập tại một thời điểm.
2. **Thiết bị bắt đầu/kết thúc phiên** (nút bấm trên thiết bị, tương tự phím B/Q của MATLAB). Web chỉ đọc, không điều khiển.
3. ESP32 đã đồng bộ giờ NTP; mọi `t` là epoch milliseconds.
4. Dữ liệu thô được ESP32 lọc chống aliasing rồi giảm từ ~20 kHz xuống **1000 Hz** chỉ để hiển thị; phân tích vẫn dùng `capture.bin` + MATLAB.
5. Góc khuỷu đo bằng **2 IMU** (cánh tay trên + cẳng tay); firmware tính góc tương đối và gửi một số `angle` (độ, 0° = duỗi thẳng, tăng khi gập). Mô hình 3D chỉ xoay khuỷu; vai đứng yên. Tay được mô phỏng là **tay phải**.
6. Màu cơ: `intensity = clamp(rms / rmsRef, 0, 1)`, với `rmsRef` = RMS của **lần gồng tối đa (MVC)** đo ở đầu phiên, thiết bị ghi vào `meta`.
6b. Nhãn AI **chốt một chiều**: khi `label = 1` thì giữ `ĐÃ THẤT BẠI CƠ` đến hết phiên (web cũng tự chốt, kể cả khi lỡ nhận lại 0).
7. Dùng gói Firebase Spark (miễn phí) cho demo.
8. Web không đăng nhập; thiết bị ghi bằng một tài khoản Firebase Auth riêng (xem Boundaries).

## Objective

Cho nhóm và giảng viên/hội đồng mở một link để xem **trực tiếp** người tập curl tạ:

- Mô hình **3D** người cầm tạ, khuỷu tay gập theo `angle` thật.
- Cơ bắp tay trước đổi màu từ màu da sang đỏ theo **mức gồng** (`intensity`).
- Ba biểu đồ chạy theo thời gian: **EMG thô**, **RMS**, **góc khuỷu**.
- Nhãn AI riêng biệt: `CHƯA THẤT BẠI CƠ` / `ĐÃ THẤT BẠI CƠ` (không dùng màu đỏ của cơ để báo nhãn này).
- Trang **lịch sử**: danh sách phiên; mở một phiên để phát lại biểu đồ + 3D, có mốc thời điểm AI báo thất bại cơ.
- **Đếm lần tập** (tính từ góc khuỷu): *chuẩn* = gập ≥ 120°, *không chuẩn* = gập 45–120°; lần tập kết thúc khi tay về ≤ 30° (`web/src/reps.ts`).
- Nút **Fake**: sinh dữ liệu tập liên tục ngay trong trình duyệt (không ghi Firebase) để demo khi chưa có thiết bị; thất bại cơ sau 30 s, sau đó biên độ giảm dần nên các lần tập thành không chuẩn.
- Giao diện dùng bảng màu chung với app Fall Guard / Healthcare Map (xem design-system MASTER.md).

### User stories

- Là giảng viên, tôi mở link trên điện thoại và thấy tay 3D gập theo người thật trong vòng chưa đầy 0.5 giây.
- Là người làm đồ án, tôi chọn set hôm qua và phát lại để chỉ cho hội đồng lúc AI báo thất bại cơ.

## Hợp đồng dữ liệu (Firebase Realtime Database)

```
config/deviceUids/{authUid}: "<deviceId>"   ← chỉ admin tạo trên Console; không ai đọc được

devices/{deviceId}/live            ← ghi đè ~10 Hz (web live chỉ nghe nút này)
  { sessionId, t, rms, angle, label }          label: 0 = CHƯA THẤT BẠI CƠ, 1 = ĐÃ THẤT BẠI CƠ

sessions/{sessionId}/meta          ← ghi ĐẦU TIÊN khi bắt đầu phiên; endedAt ghi lúc kết thúc
  { deviceId, startedAt, endedAt?, fsRaw: 1000, rmsRef, fwVersion }
sessions/{sessionId}/summary       ← ghi lúc kết thúc
  { failureAtMs?, rmsMax, durationMs }         failureAtMs tính từ startedAt

sessionData/{sessionId}/processed/{t}     ← 10 Hz, append
  { t, rms, angle, label }
sessionData/{sessionId}/raw/{t0}          ← 4 gói/giây, append
  { t0, v: [int16 × 250] }                     mẫu i có thời gian t0 + i·1000/fsRaw
```

- `sessionId` = `"s" + startedAt` (ví dụ `s1763470000000`); khoá `{t}`, `{t0}` là epoch ms 13 chữ số ⇒ sắp xếp theo thời gian, dùng được `limitToLast` / `startAt`.
- Đơn vị: `t` epoch ms · `rms` mV · `angle` độ (0 = duỗi, −10…180) · `v` µV int16.
- **Vì sao tách `sessions` và `sessionData`:** RTDB đọc một nút là tải cả cây con. Trang danh sách phiên chỉ đọc `sessions` (vài trăm byte mỗi phiên), không kéo theo hàng MB dữ liệu thô.
- Thiết bị ghi bằng tài khoản Firebase Auth email/password; quyền ghi xét theo `config/deviceUids`. Thiết bị phải ghi `meta` trước rồi mới ghi được `sessionData` của phiên đó. Ví dụ ghi chuẩn: [web/tools/simulate-device.ts](web/tools/simulate-device.ts).

Ước lượng dung lượng (để kiểm tra giới hạn Spark): dữ liệu thô khoảng 5 KB/s dạng JSON, tức khoảng 3 MB cho phiên 10 phút; dữ liệu đã xử lý khoảng 0.5 KB/s. *Giới hạn Spark (1 GB lưu trữ, 10 GB tải xuống/tháng, 100 kết nối đồng thời) được ghi theo trí nhớ, cần kiểm tra lại trên trang giá của Firebase.*

## Tech Stack

| Phần | Lựa chọn | Lý do |
|---|---|---|
| Build | Vite 8 + TypeScript 7 (vanilla, không framework) | Chỉ có 2 trang; không cần React |
| 3D | three.js 0.187 (cài ở T6) | Chuẩn de facto cho WebGL |
| Biểu đồ | uPlot 1.6 (cài ở T5) | Vẽ hàng nghìn điểm/giây mượt, nhẹ hơn Chart.js nhiều |
| Dữ liệu | firebase JS SDK 13 (modular, chỉ `database`) | |
| Hosting | Firebase Hosting | Cùng project với RTDB |
| Test | Vitest 5 + `@firebase/rules-unit-testing` 6 + Firebase Emulator | |
| Công cụ ngoài | Node 24, Java 21 (cho emulator), firebase-tools 15 cài global | firebase-tools không đưa vào devDependencies vì quá nặng |

Mô hình 3D: **người có cơ bắp như thật**, nạp từ file glTF (`GLTFLoader` có sẵn trong three.js). Hợp đồng với file model, để code không phụ thuộc model cụ thể:

- File: `web/public/models/body.glb` (Draco nén nếu > 10 MB).
- Là skinned mesh có xương; tên xương khuỷu phải và tên mesh cơ bắp tay phải khai báo trong `src/scene/modelConfig.ts` (ví dụ `elbowBone: "RightForeArm"`, `bicepsMesh: "biceps_brachii_r"`).
- Cơ bắp tay trước phải là **mesh hoặc material riêng** để tô màu độc lập; nếu không tách được thì dùng vertex group/texture mask (đắt công hơn, hỏi trước).
- Có model người cầm tạ hoặc gắn một quả tạ (mesh đơn giản) vào xương bàn tay phải.
- License phải cho phép dùng trong đồ án và đưa lên GitHub (CC0/CC-BY); ghi nguồn trong `web/public/models/CREDITS.md`.
- Trong lúc chưa có model thật, code dùng khung tạm dựng bằng khối cơ bản cùng giao diện `setElbowAngle()` / `setBicepsIntensity()` — chỉ để phát triển, **không** dùng khi demo.

Giao diện: theo [design-system/emg-muscle-failure/MASTER.md](design-system/emg-muscle-failure/MASTER.md) (+ `pages/live.md`, `pages/history.md`). Font Fira Sans/Fira Code qua Google Fonts; icon Lucide chép SVG inline (không thêm dependency).

## Commands

```bash
cd web
npm install
npm run emu                      # emulator database + auth (project demo-emg), UI ở http://127.0.0.1:4000
npm run dev                      # Vite dev server, tự nối emulator
npm run simulate                 # giả lập ESP32; tuỳ chọn: -- --failure-at 60 --duration 0 --period 3
npm test                         # vitest run tests/unit
npm run test:rules               # tự bật emulator, chạy tests/rules
npm run build                    # tsc --noEmit && vite build
npm run deploy                   # firebase deploy --only hosting,database
```

## Project Structure

```
web/
  index.html            → Trang live
  session.html          → Lịch sử: ?id= trống = danh sách phiên, có id = phát lại
  src/
    firebase.ts         → Khởi tạo app; dùng emulator khi chạy dev
    schema.ts           → Kiểu dữ liệu + hàm kiểm tra dữ liệu đọc từ RTDB
    color.ts            → rms, rmsRef → intensity → màu cơ
    ringBuffer.ts       → Bộ đệm cửa sổ thời gian cho biểu đồ live
    charts.ts           → 3 biểu đồ uPlot
    scene/arm3d.ts      → Người 3D, setElbowAngle(), setBicepsIntensity()
    live.ts             → Gắn listener của devices/{id}/live và raw vào UI
    history.ts          → Danh sách phiên + phát lại theo timeline
  tools/simulate-device.ts
  tests/                → *.test.ts (Vitest), rules.test.ts
  database.rules.json
  firebase.json
docs/intent/            → Tóm tắt yêu cầu đã xác nhận
```

## Code Style

TypeScript strict, ES module, đặt tên `camelCase`, mỗi file một trách nhiệm. Dữ liệu từ RTDB luôn được kiểm tra trước khi dùng. Hàm thuần (pure) tách khỏi mã DOM/three.js để test được.

```ts
// color.ts
export const SKIN = [0.91, 0.72, 0.60] as const;
export const RED  = [0.85, 0.10, 0.10] as const;

export function bicepsIntensity(rms: number, rmsRef: number): number {
  if (!(rmsRef > 0) || !Number.isFinite(rms)) return 0; // dữ liệu xấu → màu da, không đỏ giả
  return Math.min(1, Math.max(0, rms / rmsRef));
}

export function bicepsColor(intensity: number): [number, number, number] {
  return [0, 1, 2].map(i => SKIN[i] + (RED[i] - SKIN[i]) * intensity) as [number, number, number];
}
```

## Testing Strategy

| Mức | Nội dung | Công cụ |
|---|---|---|
| Unit | `color.ts`, `schema.ts` (loại bỏ bản ghi thiếu hoặc sai trường), `ringBuffer.ts`, tính timeline khi phát lại | Vitest |
| Rules | Web ẩn danh đọc được nhưng không ghi được; tài khoản thiết bị ghi được; bản ghi sai kiểu bị từ chối | rules-unit-testing + emulator |
| Tích hợp | `npm run simulate` + `npm run dev`: biểu đồ chạy, tay gập, cơ đổi màu, nhãn đổi | Kiểm tra thủ công bằng checklist |
| Phần cứng | ESP32 thật: đo độ trễ = `Date.now() − live.t` hiển thị trên trang (chế độ debug) | Thủ công |

Không đặt mục tiêu coverage theo phần trăm; mọi hàm thuần trong `src/` đều phải có test.

## Boundaries

- **Always:**
  - Kiểm tra dữ liệu ở `schema.ts` trước khi đưa vào UI.
  - Chạy `npm test` trước khi deploy.
  - Hiển thị rõ trạng thái "mất kết nối" hoặc "thiết bị không gửi dữ liệu" khi `live.t` cũ hơn 2 giây.
  - Giữ nhãn AI tách biệt với màu cơ.
- **Ask first:**
  - Thay đổi hợp đồng dữ liệu RTDB, vì nó ảnh hưởng firmware.
  - Thêm dependency ngoài bảng Tech Stack.
  - Chuyển sang gói Blaze (trả phí).
  - Dùng model 3D bên ngoài.
- **Never:**
  - Mở quyền ghi công khai cho RTDB.
  - Commit service account hoặc mật khẩu tài khoản thiết bị.
  - Hiển thị phần trăm mỏi, chẩn đoán hoặc xác suất y khoa.
  - Ghi đè hay xóa dữ liệu phiên từ phía web.

## Success Criteria

1. Khi chạy simulator ở 10 Hz processed + 4 Hz raw, trang live hiển thị 3 biểu đồ với cửa sổ 10 giây gần nhất, chạy ở ≥ 30 fps trên laptop phổ thông.
2. `angle` thay đổi thì khuỷu tay 3D xoay đúng góc (sai lệch hình học dưới 1°, có unit test cho phép tính quay).
3. `rms = 0` thì cơ màu da; `rms ≥ rmsRef` thì cơ đỏ hoàn toàn; ở giữa thì nội suy tuyến tính (unit test).
4. Nhãn AI đổi trong ≤ 1 chu kỳ cập nhật sau khi `label` lên 1, và giữ `ĐÃ THẤT BẠI CƠ` đến hết phiên dù sau đó nhận `label = 0` (unit test).
4b. Khi demo, mô hình là người cơ bắp như thật (glb theo hợp đồng ở Tech Stack); khuỷu phải xoay theo `angle`, chỉ vùng cơ bắp tay trước đổi màu.
5. Dùng ESP32 thật qua Wi‑Fi: độ trễ trung vị `Date.now() − t` dưới 500 ms trong một phiên 2 phút.
6. Trang lịch sử liệt kê các phiên mới nhất trước; phát lại một phiên 10 phút với biểu đồ + 3D đồng bộ, có nút play/pause/tua, và mốc `failureAtMs` được đánh dấu trên trục thời gian.
7. Rules test đạt: ẩn danh không ghi được, thiết bị ghi được.
8. Chạy được trên Chrome bản mới trên desktop và Android.

## Quyết định đã chốt (2026-11-18)

1. Góc khuỷu: **2 IMU**.
2. `rmsRef`: **MVC** đầu phiên.
3. Dữ liệu thô **1000 Hz**: đủ cho demo.
4. Nhãn AI: **giữ nguyên** đến hết phiên sau khi báo thất bại cơ.
5. Mô hình 3D: **người có cơ bắp như thật** (không dùng khối cơ bản khi demo).

## Open Questions

1. **Nguồn model 3D:** lấy model nào, license gì, ai rig xương và tách mesh cơ bắp tay (xem phần Tech Stack)?
