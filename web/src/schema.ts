// Hợp đồng dữ liệu RTDB (SPEC.md). Mọi dữ liệu đọc từ RTDB đi qua các hàm parse
// ở đây; bản ghi sai trả về null để UI bỏ qua thay vì vẽ giá trị rác.

/** 0 = CHƯA THẤT BẠI CƠ, 1 = ĐÃ THẤT BẠI CƠ */
export type Label = 0 | 1;

/** devices/{deviceId}/live — ghi đè ~10 Hz */
export interface Live {
  sessionId: string;
  t: number;      // epoch ms
  rms: number;    // mV
  angle: number;  // độ, 0 = duỗi thẳng
  label: Label;
}

/** sessions/{id}/processed/{t} — append 10 Hz */
export type Processed = Omit<Live, 'sessionId'>;

/** sessions/{id}/raw/{t0} — 250 mẫu, mẫu i ở t0 + i·1000/fsRaw */
export interface RawChunk {
  t0: number;
  v: number[];    // µV, int16
}

/** sessions/{id}/meta */
export interface Meta {
  deviceId: string;
  startedAt: number;
  endedAt: number | null;
  fsRaw: number;
  rmsRef: number;   // RMS của lần gồng tối đa (MVC), mV
  fwVersion: string;
}

/** sessions/{id}/summary — ghi lúc kết thúc */
export interface Summary {
  failureAtMs: number | null;  // tính từ startedAt
  rmsMax: number;
  durationMs: number;
}

export const ANGLE_MIN = -10;
export const ANGLE_MAX = 180;
export const RAW_CHUNK_LEN = 250;

type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
const isLabel = (x: unknown): x is Label => x === 0 || x === 1;
const isAngle = (x: unknown): x is number => isNum(x) && x >= ANGLE_MIN && x <= ANGLE_MAX;

export function parseProcessed(x: unknown): Processed | null {
  if (!isObj(x)) return null;
  const { t, rms, angle, label } = x;
  if (!isNum(t) || !isNum(rms) || rms < 0 || !isAngle(angle) || !isLabel(label)) return null;
  return { t, rms, angle, label };
}

export function parseLive(x: unknown): Live | null {
  if (!isObj(x) || !isStr(x.sessionId)) return null;
  const p = parseProcessed(x);
  return p && { sessionId: x.sessionId, ...p };
}

export function parseRawChunk(x: unknown): RawChunk | null {
  if (!isObj(x) || !isNum(x.t0)) return null;
  // RTDB trả mảng; mảng thưa (thiếu phần tử) đến dưới dạng object -> loại
  const v = x.v;
  if (!Array.isArray(v) || v.length === 0 || !v.every(Number.isInteger)) return null;
  return { t0: x.t0, v };
}

export function parseMeta(x: unknown): Meta | null {
  if (!isObj(x)) return null;
  const { deviceId, startedAt, endedAt = null, fsRaw, rmsRef, fwVersion } = x;
  if (!isStr(deviceId) || !isNum(startedAt) || !isStr(fwVersion)) return null;
  if (!isNum(fsRaw) || fsRaw <= 0 || !isNum(rmsRef) || rmsRef <= 0) return null;
  if (endedAt !== null && (!isNum(endedAt) || endedAt < startedAt)) return null;
  return { deviceId, startedAt, endedAt, fsRaw, rmsRef, fwVersion };
}

export function parseSummary(x: unknown): Summary | null {
  if (!isObj(x)) return null;
  const { failureAtMs = null, rmsMax, durationMs } = x;
  if (!isNum(rmsMax) || !isNum(durationMs) || durationMs < 0) return null;
  if (failureAtMs !== null && (!isNum(failureAtMs) || failureAtMs < 0)) return null;
  return { failureAtMs, rmsMax, durationMs };
}
