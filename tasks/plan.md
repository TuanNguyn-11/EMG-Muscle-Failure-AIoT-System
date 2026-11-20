# Implementation Plan: Web dashboard giám sát EMG từ xa

Nguồn: [SPEC.md](../SPEC.md) (đã duyệt 2026-11-18). Task chi tiết: [todo.md](todo.md).

## Overview

Web tĩnh (Vite + TS) đọc Firebase Realtime Database: trang live (3 biểu đồ, người 3D cơ bắp thật, nhãn AI) và trang lịch sử (danh sách + phát lại). Toàn bộ phát triển chạy trên Firebase Emulator + simulator, nên không phải chờ firmware.

## Architecture Decisions

- **Simulator trước UI.** `tools/simulate-device.ts` ghi đúng hợp đồng dữ liệu vào emulator; mọi slice UI kiểm được ngay, và file này cũng là tài liệu sống cho nhóm firmware.
- **Giao diện 3D cố định, model thay được.** `arm3d.ts` chỉ lộ ra `setElbowAngle()` / `setBicepsIntensity()`; khung tạm (dev) và model glb thật cùng giao diện ⇒ chọn model không chặn các slice khác.
- **Live và replay dùng chung renderer.** Replay chỉ là một nguồn dữ liệu khác đẩy vào cùng charts + 3D.
- **Đọc dữ liệu thô bằng `limitToLast`** để listener không tải lại cả phiên.
- **Chốt nhãn AI ở web** (latch), không tin tuyệt đối từng bản ghi.

## Dependency Graph

```
schema.ts ──┬── simulator ──┬── live charts ──┐
            │               └── 3D (khung tạm) ┼── history list ── replay
rules ──────┘                      │           │
                         model glb thật ───────┘
                                              └── deploy
```

## Task List

### Phase 1: Foundation
- [ ] T1: Scaffold `web/` + `schema.ts` có test
- [ ] T2: Simulator ghi hợp đồng dữ liệu vào emulator
- [ ] T3: Database rules + rules test
- [ ] T4 (spike, rủi ro cao): Chọn model 3D cơ bắp thật

### Checkpoint A: Foundation
- [ ] `npm test`, `npm run test:rules`, `npm run build` đều xanh
- [ ] Simulator ghi dữ liệu thấy được trong Emulator UI
- [ ] Model đã chọn, license rõ → **có thể push lần đầu lên GitHub**

### Phase 2: Live
- [ ] T5: Live charts (EMG thô, RMS, góc) + báo mất kết nối
- [ ] T6: 3D khung tạm + màu cơ + nhãn AI chốt
- [x] T7: Thay bằng model glb thật

### Checkpoint B: Live demo
- [ ] Chạy simulator: tay 3D gập, cơ đỏ dần, biểu đồ chạy ≥ 30 fps, nhãn chốt
- [ ] Người duyệt xem demo trước khi làm lịch sử

### Phase 3: History
- [ ] T8: Danh sách phiên
- [ ] T9: Phát lại phiên (play/pause/tua, mốc thất bại cơ)

### Checkpoint C: History
- [ ] Phát lại phiên simulator 10 phút đồng bộ biểu đồ + 3D

### Phase 4: Deploy
- [ ] T10: Firebase project thật, deploy hosting + rules, tài liệu cho firmware

### Checkpoint D: Complete
- [ ] Success criteria 1–4b, 6–8 của SPEC đạt; tiêu chí 5 (độ trễ phần cứng) chờ firmware

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Không tìm được model cơ bắp thật có rig + biceps tách riêng, license hợp lệ | High | T4 làm sớm; phương án dự phòng: model anatomy không rig + tự xoay nhóm mesh cẳng tay quanh trục khuỷu |
| File glb nặng, chậm trên điện thoại | Med | Draco/meshopt nén, giảm đa giác, mục tiêu < 10 MB |
| Giới hạn gói Spark (băng thông, kết nối) | Med | Kiểm tra trang giá ở T10; dữ liệu thô chỉ tải 10 s gần nhất khi live |
| Lệch đồng hồ ESP32 ↔ máy xem làm sai số đo độ trễ | Low | Dùng `.info/serverTimeOffset`; chỉ ảnh hưởng hiển thị debug |
| Firmware chưa có IMU/AI | Med | Simulator thay thế; hợp đồng dữ liệu ghi trong SPEC |

## Open Questions

- Nguồn model 3D (T4): xem các phương án trong todo.md.
- Tên Firebase project / ai tạo project (T10).
