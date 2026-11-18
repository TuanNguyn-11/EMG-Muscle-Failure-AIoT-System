import { describe, expect, it } from 'vitest';
import type { Live, Meta } from '../../src/schema';
import { connStatus, STALE_MS } from '../../src/status';

const live: Live = { sessionId: 's1', t: 10_000, rms: 0.1, angle: 10, label: 0 };
const meta: Meta = { deviceId: 'd', startedAt: 0, endedAt: null, fsRaw: 1000, rmsRef: 0.6, fwVersion: 'x' };

describe('connStatus', () => {
  it('chưa có live → chờ thiết bị', () => expect(connStatus(null, null, 0).state).toBe('waiting'));
  it('mới → live, hiện tuổi dữ liệu', () => {
    const s = connStatus(live, meta, 10_200);
    expect(s.state).toBe('live');
    expect(s.detail).toContain('0.2 s');
  });
  it('quá 2 s → stale', () => {
    expect(connStatus(live, meta, 10_000 + STALE_MS).state).toBe('live');
    expect(connStatus(live, meta, 10_000 + STALE_MS + 1).state).toBe('stale');
  });
  it('phiên có endedAt → ended, kể cả khi live còn mới', () => {
    expect(connStatus(live, { ...meta, endedAt: 10_000 }, 10_100).state).toBe('ended');
  });
  it('lệch đồng hồ làm tuổi âm vẫn hiển thị 0.0 s', () => {
    expect(connStatus(live, meta, 9_000).detail).toContain('0.0 s');
  });
});
