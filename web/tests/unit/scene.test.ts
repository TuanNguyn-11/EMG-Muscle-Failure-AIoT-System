import { Euler, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { bicepsColor, bicepsIntensity, RED, SKIN, smoothTo } from '../../src/color';
import { latchLabel } from '../../src/label';
import { elbowRotationX } from '../../src/scene/elbow';

describe('elbowRotationX', () => {
  const UPPER = new Vector3(0, -1, 0);
  const flexion = (angle: number) => {
    const fore = UPPER.clone().applyEuler(new Euler(elbowRotationX(angle), 0, 0));
    return { deg: (UPPER.angleTo(fore) * 180) / Math.PI, fore };
  };

  it.each([0, 30, 92, 140, 160])('gập %i° → góc giữa hai đoạn tay sai < 1°', (a) => {
    expect(Math.abs(flexion(a).deg - a)).toBeLessThan(1);
  });
  it('cẳng tay gập về phía trước (+Z)', () => expect(flexion(90).fore.z).toBeGreaterThan(0.99));
  it('kẹp ngoài dải 0–160°', () => {
    expect(flexion(-10).deg).toBeCloseTo(0);
    expect(flexion(180).deg).toBeCloseTo(160);
  });
});

describe('màu cơ', () => {
  it('rms 0 → màu da; rms ≥ rmsRef → đỏ hoàn toàn; giữa → tuyến tính', () => {
    expect(bicepsColor(bicepsIntensity(0, 0.6))).toEqual(SKIN);
    expect(bicepsColor(bicepsIntensity(0.9, 0.6))).toEqual(RED);
    const mid = bicepsColor(bicepsIntensity(0.3, 0.6));
    mid.forEach((c, i) => expect(c).toBeCloseTo((SKIN[i]! + RED[i]!) / 2));
  });
  it('dữ liệu xấu → 0 (không đỏ giả)', () => {
    expect(bicepsIntensity(0.5, undefined)).toBe(0);
    expect(bicepsIntensity(0.5, 0)).toBe(0);
    expect(bicepsIntensity(NaN, 0.6)).toBe(0);
  });
  it('smoothTo: τ=0 nhảy ngay; sau 1τ đạt ~63%; dt âm không lùi', () => {
    expect(smoothTo(0, 1, 16, 0)).toBe(1);
    expect(smoothTo(0, 1, 100, 100)).toBeCloseTo(1 - Math.exp(-1));
    expect(smoothTo(0.5, 1, -5, 100)).toBe(0.5);
  });
});

describe('latchLabel', () => {
  it('lên 1 thì giữ 1, kể cả nhận lại 0', () => {
    let l = latchLabel(0, 0);
    expect(l).toBe(0);
    l = latchLabel(l, 1);
    l = latchLabel(l, 0);
    expect(l).toBe(1);
  });
});
