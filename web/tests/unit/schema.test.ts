import { describe, expect, it } from 'vitest';
import { parseLive, parseMeta, parseProcessed, parseRawChunk, parseSummary } from '../../src/schema';

const p = { t: 1763470000000, rms: 0.4, angle: 92, label: 0 };

describe('parseProcessed', () => {
  it('nhận bản ghi đúng', () => expect(parseProcessed(p)).toEqual(p));
  it.each([
    ['thiếu trường', { t: 1, rms: 0.4, angle: 90 }],
    ['rms âm', { ...p, rms: -1 }],
    ['góc ngoài dải', { ...p, angle: 400 }],
    ['label lạ', { ...p, label: 2 }],
    ['NaN', { ...p, rms: NaN }],
    ['kiểu chuỗi', { ...p, t: '1' }],
    ['null', null],
    ['mảng', [1, 2]],
  ])('loại %s', (_, x) => expect(parseProcessed(x)).toBeNull());
  it('bỏ trường thừa', () => expect(parseProcessed({ ...p, extra: 1 })).toEqual(p));
});

describe('parseLive', () => {
  it('cần sessionId', () => {
    expect(parseLive(p)).toBeNull();
    expect(parseLive({ ...p, sessionId: 's1' })).toEqual({ ...p, sessionId: 's1' });
  });
});

describe('parseRawChunk', () => {
  it('nhận mảng số nguyên', () => expect(parseRawChunk({ t0: 5, v: [1, -2, 3] })).toEqual({ t0: 5, v: [1, -2, 3] }));
  it('loại mảng rỗng, số thực, mảng thưa từ RTDB', () => {
    expect(parseRawChunk({ t0: 5, v: [] })).toBeNull();
    expect(parseRawChunk({ t0: 5, v: [1.5] })).toBeNull();
    expect(parseRawChunk({ t0: 5, v: { 0: 1, 2: 3 } })).toBeNull();
  });
});

describe('parseMeta', () => {
  const m = { deviceId: 'd', startedAt: 100, fsRaw: 1000, rmsRef: 0.6, fwVersion: '0.1' };
  it('endedAt vắng mặt = null (phiên đang chạy)', () => expect(parseMeta(m)?.endedAt).toBeNull());
  it('nhận endedAt hợp lệ', () => expect(parseMeta({ ...m, endedAt: 200 })?.endedAt).toBe(200));
  it('loại endedAt trước startedAt, rmsRef ≤ 0', () => {
    expect(parseMeta({ ...m, endedAt: 50 })).toBeNull();
    expect(parseMeta({ ...m, rmsRef: 0 })).toBeNull();
  });
});

describe('parseSummary', () => {
  it('failureAtMs vắng = null', () => expect(parseSummary({ rmsMax: 1, durationMs: 10 })?.failureAtMs).toBeNull());
  it('loại durationMs âm', () => expect(parseSummary({ rmsMax: 1, durationMs: -1 })).toBeNull());
});
