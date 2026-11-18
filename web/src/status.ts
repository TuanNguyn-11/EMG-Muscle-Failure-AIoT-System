import type { Live, Meta } from './schema';

export const STALE_MS = 2000;

export type ConnState = 'waiting' | 'live' | 'stale' | 'ended';

export interface ConnStatus {
  state: ConnState;
  text: string;    // đọc bởi screen reader (role=status), chỉ đổi khi trạng thái đổi
  detail: string;  // thời gian, cập nhật liên tục, không live-region
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour12: false });

/** nowMs đã cộng serverTimeOffset để so được với giờ thiết bị. */
export function connStatus(live: Live | null, meta: Meta | null, nowMs: number): ConnStatus {
  if (!live) return { state: 'waiting', text: 'Chờ thiết bị', detail: '' };
  if (meta?.endedAt != null) return { state: 'ended', text: 'Phiên đã kết thúc', detail: `· lúc ${clock(meta.endedAt)}` };
  const age = nowMs - live.t;
  if (age > STALE_MS) return { state: 'stale', text: 'Thiết bị không gửi dữ liệu', detail: `· cập nhật cuối ${clock(live.t)}` };
  return { state: 'live', text: 'LIVE', detail: `· ${(Math.max(0, age) / 1000).toFixed(1)} s trước` };
}
