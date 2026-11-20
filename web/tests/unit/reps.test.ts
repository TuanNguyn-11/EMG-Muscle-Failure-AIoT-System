import { describe, expect, it } from 'vitest';
import { RepCounter } from '../../src/reps';
import { angleAt, DEFAULT_PARAMS as P, repPeak } from '../../src/signal';

const feed = (c: RepCounter, angles: number[]) => angles.map((a) => c.push(a)).filter(Boolean);

describe('RepCounter', () => {
  it('đủ biên độ → chuẩn; thiếu biên độ → không chuẩn', () => {
    const c = new RepCounter();
    expect(feed(c, [0, 60, 130, 60, 10])).toEqual(['good']);
    expect(feed(c, [0, 50, 90, 40, 20])).toEqual(['bad']);
    expect([c.good, c.bad]).toEqual([1, 1]);
  });

  it('dao động nhỏ dưới 45° không tính', () => {
    const c = new RepCounter();
    expect(feed(c, [0, 20, 40, 10, 0])).toEqual([]);
  });

  it('chưa về vùng nghỉ thì chưa kết thúc lần tập', () => {
    const c = new RepCounter();
    expect(feed(c, [0, 130, 50, 35])).toEqual([]);
    expect(feed(c, [25])).toEqual(['good']);
  });

  it('reset về 0', () => {
    const c = new RepCounter();
    feed(c, [0, 130, 0]);
    c.reset();
    expect([c.good, c.bad]).toEqual([0, 0]);
  });

  it('đếm đúng tín hiệu giả lập ở 10 Hz: 20 lần trước thất bại có 2 lần thiếu biên độ, sau thất bại đều không chuẩn', () => {
    const c = new RepCounter();
    for (let t = 0; t < P.failureAtS; t += 0.1) c.push(angleAt(t, P));
    expect([c.good, c.bad]).toEqual([18, 2]);
    for (let t = P.failureAtS; t < P.failureAtS + 5 * P.periodS; t += 0.1) c.push(angleAt(t, P));
    expect([c.good, c.bad]).toEqual([18, 7]);
  });
});

describe('repPeak', () => {
  it('sau thất bại biên độ giảm dần nhưng không dưới 50%', () => {
    const fail = P.failureAtS / P.periodS;
    expect(repPeak(fail, P)).toBeLessThan(120);
    expect(repPeak(fail + 100, P)).toBeCloseTo(P.maxAngle * 0.5);
  });
});
