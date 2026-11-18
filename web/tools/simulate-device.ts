// Giả lập ESP32: ghi đúng hợp đồng dữ liệu (SPEC.md) vào Firebase Emulator qua REST,
// giống cách firmware sẽ ghi. Chạy: npm run emu (cửa sổ khác) rồi npm run simulate.
// ponytail: chỉ nhắm emulator (token "owner" để đăng ký thiết bị); project thật làm ở T10.
import { parseArgs } from 'node:util';
import { RAW_CHUNK_LEN } from '../src/schema';
import { DEFAULT_PARAMS, processedAt, rawChunkAt, seededRandom } from './signal';

const DB = 'http://127.0.0.1:9000';
const NS = 'demo-emg-default-rtdb';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const DEVICE_ID = 'esp32s3-01';
const FS_RAW = 1000;
const TICK_MS = 100;
const RAW_MS = (RAW_CHUNK_LEN / FS_RAW) * 1000;

const { values } = parseArgs({
  options: {
    'failure-at': { type: 'string', default: '60' },
    duration: { type: 'string', default: '0' },
    period: { type: 'string', default: '3' },
  },
});
const params = { ...DEFAULT_PARAMS, failureAtS: Number(values['failure-at']), periodS: Number(values.period) };
const durationS = Number(values.duration);

async function req(method: string, path: string, body: unknown, token: string, asOwner = false) {
  const auth = asOwner ? '' : `&auth=${token}`;
  const res = await fetch(`${DB}/${path}.json?ns=${NS}${auth}`, {
    method,
    headers: asOwner ? { Authorization: 'Bearer owner' } : {},
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} /${path} → ${res.status} ${await res.text()}`);
}

async function deviceToken(): Promise<{ uid: string; idToken: string }> {
  const body = JSON.stringify({ email: `${DEVICE_ID}@device.local`, password: 'emulator-only', returnSecureToken: true });
  for (const op of ['signInWithPassword', 'signUp']) {
    const res = await fetch(`${AUTH}/accounts:${op}?key=demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (res.ok) {
      const j = (await res.json()) as { localId: string; idToken: string };
      return { uid: j.localId, idToken: j.idToken };
    }
  }
  throw new Error('Không đăng nhập được Auth emulator — đã chạy `npm run emu` chưa?');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

async function main() {
  const { uid, idToken } = await deviceToken();
  await req('PUT', `config/deviceUids/${uid}`, DEVICE_ID, '', true);

  const startedAt = Date.now();
  const sid = `s${startedAt}`;
  await req('PUT', `sessions/${sid}/meta`, { deviceId: DEVICE_ID, startedAt, fsRaw: FS_RAW, rmsRef: params.rmsRef, fwVersion: 'sim-0.1' }, idToken);
  console.log(`Phiên ${sid} — thất bại cơ ở ${params.failureAtS}s. Ctrl+C để kết thúc.`);

  const rand = seededRandom(startedAt);
  let stop = false;
  process.on('SIGINT', () => (stop = true));

  let rmsMax = 0;
  let failureAtMs: number | null = null;
  let nextRawS = 0;

  for (let tick = 0; !stop; tick++) {
    const tS = (tick * TICK_MS) / 1000;
    if (durationS > 0 && tS >= durationS) break;

    const p = processedAt(startedAt, tS, params);
    rmsMax = Math.max(rmsMax, p.rms);
    if (p.label === 1 && failureAtMs === null) failureAtMs = p.t - startedAt;

    const patch: Record<string, unknown> = {
      [`devices/${DEVICE_ID}/live`]: { sessionId: sid, ...p },
      [`sessionData/${sid}/processed/${p.t}`]: p,
    };
    // gói thô phủ [nextRawS, nextRawS + 0.25s) chỉ gửi khi khoảng đó đã trôi qua
    while (nextRawS + RAW_MS / 1000 <= tS) {
      const c = rawChunkAt(startedAt, nextRawS, RAW_CHUNK_LEN, FS_RAW, params, rand);
      patch[`sessionData/${sid}/raw/${c.t0}`] = c;
      nextRawS += RAW_MS / 1000;
    }
    await req('PATCH', '', patch, idToken);
    if (tick % 50 === 0) process.stdout.write(`\r${tS.toFixed(0)}s  góc ${p.angle}°  RMS ${p.rms} mV  label ${p.label}   `);

    await sleep(startedAt + (tick + 1) * TICK_MS - Date.now());
  }

  const endedAt = Date.now();
  await req('PATCH', `sessions/${sid}`, {
    'meta/endedAt': endedAt,
    summary: { failureAtMs, rmsMax, durationMs: endedAt - startedAt },
  }, idToken);
  console.log(`\nĐã kết thúc phiên ${sid}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
