import { describe, expect, it } from 'vitest';
import { parseProcessed, parseRawChunk, RAW_CHUNK_LEN } from '../../src/schema';
import { angleAt, DEFAULT_PARAMS as P, labelAt, processedAt, rawChunkAt, rmsAt, seededRandom } from '../../src/signal';

const T0 = 1763470000000;

describe('signal', () => {
  it('góc 0° đầu chu kỳ, cực đại ở nửa chu kỳ', () => {
    expect(angleAt(0, P)).toBeCloseTo(0);
    expect(angleAt(P.periodS / 2, P)).toBeCloseTo(P.maxAngle);
  });

  it('RMS lúc gập ở cuối buổi lớn hơn đầu buổi (bù mỏi), không vượt 1.1·MVC', () => {
    const half = P.periodS / 2;
    expect(rmsAt(P.failureAtS + half, P)).toBeGreaterThan(rmsAt(half, P));
    for (let t = 0; t < 120; t += 0.1) expect(rmsAt(t, P)).toBeLessThanOrEqual(P.rmsRef * 1.1);
  });

  it('label chốt 1 từ failureAtS trở đi', () => {
    expect(labelAt(P.failureAtS - 0.1, P)).toBe(0);
    for (let t = P.failureAtS; t < P.failureAtS + 30; t += 1) expect(labelAt(t, P)).toBe(1);
  });

  it('mọi bản ghi processed qua được schema', () => {
    for (let t = 0; t < 90; t += 0.1) expect(parseProcessed(processedAt(T0, t, P))).not.toBeNull();
  });

  it('gói thô đủ 250 mẫu int16, qua schema, lặp lại được với cùng seed', () => {
    const a = rawChunkAt(T0, 1, RAW_CHUNK_LEN, 1000, P, seededRandom(7));
    const b = rawChunkAt(T0, 1, RAW_CHUNK_LEN, 1000, P, seededRandom(7));
    expect(a.v).toHaveLength(RAW_CHUNK_LEN);
    expect(parseRawChunk(a)).not.toBeNull();
    expect(a).toEqual(b);
    expect(a.t0).toBe(T0 + 1000);
  });
});
