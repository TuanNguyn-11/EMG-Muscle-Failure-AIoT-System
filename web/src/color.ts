// Màu cơ bắp tay theo mức gồng (SPEC + MASTER.md: --color-skin → --color-effort). Giá trị sRGB 0..1.
export type RGB = [number, number, number];

const hex = (h: string): RGB => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
export const SKIN = hex('E8B899');
export const RED = hex('EF4444');

export function bicepsIntensity(rms: number, rmsRef: number | undefined): number {
  if (!(rmsRef !== undefined && rmsRef > 0) || !Number.isFinite(rms)) return 0; // dữ liệu xấu → màu da, không đỏ giả
  return Math.min(1, Math.max(0, rms / rmsRef));
}

export function bicepsColor(intensity: number): RGB {
  const k = Math.min(1, Math.max(0, intensity));
  return [0, 1, 2].map((i) => SKIN[i]! + (RED[i]! - SKIN[i]!) * k) as RGB;
}

/** Lọc mũ: tiến về target với hằng số thời gian tau, không phụ thuộc fps. */
export function smoothTo(current: number, target: number, dtMs: number, tauMs: number): number {
  if (tauMs <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dtMs) / tauMs));
}
