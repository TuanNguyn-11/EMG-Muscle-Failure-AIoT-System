# Tasks: Web dashboard giám sát EMG

Lệnh chạy từ thư mục `web/`. Mọi task phải giữ `npm test` và `npm run build` xanh.

## Phase 1: Foundation

- [x] **T1: Scaffold `web/` + schema** — S
  - Acceptance: Vite + TS strict chạy được `npm run dev`; `schema.ts` có kiểu + `parseLive/parseProcessed/parseRawChunk/parseMeta` trả `null` cho bản ghi thiếu/sai kiểu; `firebase.ts` nối emulator khi dev.
  - Verify: `npm test` (test schema), `npm run build`.
  - Files: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/src/schema.ts`, `web/tests/schema.test.ts`, `web/firebase.json`
  - Deps: —

- [x] **T2: Simulator** — S
  - Acceptance: `npm run simulate` tạo phiên mới (meta có `rmsRef`), ghi `live` + `processed` 10 Hz, `raw` 4 gói/s × 250 mẫu, chu kỳ curl ~3 s (góc 0→140°, RMS theo góc), `label` lên 1 sau N đợt và giữ nguyên; Ctrl+C ghi `endedAt` + `summary`.
  - Verify: Emulator UI thấy đủ các nút; mọi bản ghi qua được `schema.ts` (test dùng chung hàm sinh dữ liệu).
  - Files: `web/tools/simulate-device.ts`, `web/tools/signal.ts`, `web/tests/signal.test.ts`
  - Deps: T1

- [x] **T3: Database rules** — S
  - Acceptance: đọc công khai; chỉ uid thiết bị ghi được; validate kiểu cho `live`, `processed`, `raw`, `meta`.
  - Verify: `npm run test:rules`.
  - Files: `web/database.rules.json`, `web/tests/rules.test.ts`
  - Deps: T1

- [ ] **T4: Spike chọn model 3D** — S, rủi ro cao, cần người dùng
  - Acceptance: có 1 model được chọn, ghi rõ nguồn + license; đã xác nhận (trong three.js editor hoặc Blender) có xương khuỷu phải và mesh/vùng biceps phải tách được; kích thước sau nén ước < 10 MB.
  - Verify: ghi kết quả vào `web/public/models/CREDITS.md`; người dùng duyệt.
  - Files: `web/public/models/CREDITS.md`, `web/tools/blender/prepare_body.py`
  - Deps: —
  - Tiến độ (2026-11-18): **đã chọn MakeHuman (CC0) + Blender**; script tách `biceps_r` + xuất GLB đã viết (mới kiểm cú pháp, chưa chạy với Blender). Chờ người dùng xuất FBX và chạy script.

### Checkpoint A
- [ ] Test + rules test + build xanh · simulator chạy · model đã chọn · **push lần đầu**

## Phase 2: Live

- [x] **T5: Live charts** — M
  - Acceptance: 3 biểu đồ uPlot cửa sổ 10 s (EMG thô, RMS, góc) cập nhật từ simulator; raw dùng `limitToLast`; banner "Thiết bị không gửi dữ liệu" khi `live.t` cũ > 2 s.
  - Verify: `npm test` (ringBuffer), kiểm tay ≥ 30 fps trên laptop.
  - Files: `web/index.html`, `web/src/live.ts`, `web/src/charts.ts`, `web/src/ringBuffer.ts`, `web/tests/ringBuffer.test.ts`
  - Deps: T2

- [x] **T6: 3D khung tạm + màu cơ + nhãn AI** — M
  - Acceptance: `arm3d.ts` với `setElbowAngle()`/`setBicepsIntensity()`; `color.ts` theo SPEC; `label.ts` chốt một chiều; nhãn hiển thị tách khỏi màu cơ.
  - Verify: `npm test` (color, label latch, phép quay khuỷu sai < 1°), kiểm tay với simulator.
  - Files: `web/src/scene/arm3d.ts`, `web/src/color.ts`, `web/src/label.ts`, `web/tests/color.test.ts`, `web/tests/label.test.ts`
  - Deps: T2

- [ ] **T7: Model glb thật** — M
  - Acceptance: `GLTFLoader` nạp `body.glb`; `modelConfig.ts` khai báo tên xương/mesh; chỉ biceps đổi màu; tạ gắn vào bàn tay phải; lỗi nạp model hiện thông báo rõ.
  - Verify: kiểm tay với simulator trên desktop + Android; `npm run build`.
  - Files: `web/src/scene/arm3d.ts`, `web/src/scene/modelConfig.ts`, `web/public/models/body.glb`, `web/public/models/CREDITS.md`
  - Deps: T4, T6

### Checkpoint B
- [ ] Demo live với simulator · người dùng duyệt

## Phase 3: History

- [ ] **T8: Danh sách phiên** — S
  - Acceptance: `session.html` không có `id` → danh sách phiên mới nhất trước (thời điểm, thời lượng, có/không thất bại cơ); bấm vào mở phát lại.
  - Verify: kiểm tay sau 2–3 lần chạy simulator.
  - Files: `web/session.html`, `web/src/history.ts`
  - Deps: T1

- [ ] **T9: Phát lại phiên** — M
  - Acceptance: tải processed + raw của phiên; play/pause/tua; biểu đồ + 3D đồng bộ theo timeline; mốc `failureAtMs` trên trục thời gian.
  - Verify: `npm test` (hàm timeline: chọn mẫu theo thời điểm), kiểm tay phiên 10 phút.
  - Files: `web/src/history.ts`, `web/src/timeline.ts`, `web/tests/timeline.test.ts`
  - Deps: T5, T7, T8

### Checkpoint C
- [ ] Phát lại phiên 10 phút đồng bộ

## Phase 4: Deploy

- [ ] **T10: Deploy** — S, cần người dùng tạo Firebase project
  - Acceptance: hosting + rules deploy thành công; tài khoản thiết bị tạo trong Firebase Auth; README hướng dẫn chạy; kiểm lại giới hạn gói Spark.
  - Verify: mở URL hosting trên điện thoại, chạy simulator trỏ vào project thật.
  - Files: `web/.firebaserc`, `README.md`
  - Deps: T3, T9

### Checkpoint D
- [ ] SPEC success criteria đạt (trừ #5 chờ firmware)
