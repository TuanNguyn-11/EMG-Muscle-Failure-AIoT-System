// Tín hiệu giả cho simulator: hàm thuần, có seed, để test được.
import type { Label, Processed, RawChunk } from './schema';

export interface SimParams {
  rmsRef: number;      // mV, MVC
  restRms: number;     // mV, nền khi thả lỏng
  periodS: number;     // một lần curl (lên + xuống)
  maxAngle: number;    // độ
  failureAtS: number;  // thời điểm AI "báo" thất bại cơ
  partialEvery: number; // trước thất bại: cứ N lần có 1 lần gập thiếu biên độ
}

export const DEFAULT_PARAMS: SimParams = { rmsRef: 0.6, restRms: 0.03, periodS: 3, maxAngle: 140, failureAtS: 60, partialEvery: 7 };

/** Góc gập lớn nhất của lần tập thứ `rep`: thỉnh thoảng thiếu biên độ; sau thất bại cơ biên độ giảm dần. */
export function repPeak(rep: number, p: SimParams): number {
  const failRep = Math.floor(p.failureAtS / p.periodS);
  if (rep >= failRep) return p.maxAngle * Math.max(0.5, 0.85 - 0.05 * (rep - failRep));
  return rep % p.partialEvery === p.partialEvery - 1 ? p.maxAngle * 0.6 : p.maxAngle;
}

export function angleAt(tS: number, p: SimParams): number {
  const rep = Math.floor(tS / p.periodS);
  const frac = tS / p.periodS - rep;
  return (repPeak(rep, p) * (1 - Math.cos(2 * Math.PI * frac))) / 2; // về 0° ở ranh giới mỗi lần ⇒ liên tục
}

/** RMS tăng theo góc và tăng dần theo thời gian (bù mỏi), không vượt 1.1·MVC. */
export function rmsAt(tS: number, p: SimParams): number {
  const effort = angleAt(tS, p) / p.maxAngle;
  const fatigueGain = 1 + 0.6 * Math.min(1, tS / p.failureAtS);
  return Math.min(p.rmsRef * 1.1, p.restRms + 0.5 * p.rmsRef * effort * fatigueGain);
}

export function labelAt(tS: number, p: SimParams): Label {
  return tS >= p.failureAtS ? 1 : 0;
}

export function processedAt(startedAt: number, tS: number, p: SimParams): Processed {
  return {
    t: Math.round(startedAt + tS * 1000),
    rms: round3(rmsAt(tS, p)),
    angle: Math.round(angleAt(tS, p) * 10) / 10,
    label: labelAt(tS, p),
  };
}

/** Một gói dữ liệu thô: nhiễu Gauss có đường bao = RMS tại từng mẫu, đơn vị µV. */
export function rawChunkAt(startedAt: number, t0S: number, n: number, fs: number, p: SimParams, rand: () => number): RawChunk {
  const v = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const uV = gauss(rand) * rmsAt(t0S + i / fs, p) * 1000;
    v[i] = Math.max(-32768, Math.min(32767, Math.round(uV)));
  }
  return { t0: Math.round(startedAt + t0S * 1000), v };
}

/** mulberry32 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
