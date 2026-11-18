// Chạy bằng `npm run test:rules` (firebase emulators:exec khởi động emulator database).
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const DEV = 'esp32s3-01';
const SID = 's1763470000000';
const T = '1763470000100';
const meta = { deviceId: DEV, startedAt: 1763470000000, fsRaw: 1000, rmsRef: 0.6, fwVersion: 't' };
const proc = { t: 1763470000100, rms: 0.3, angle: 90, label: 0 };
const live = { sessionId: SID, ...proc };

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-emg',
    database: { rules: readFileSync('database.rules.json', 'utf8') },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref('config/deviceUids').set({ devUid: DEV, otherUid: 'esp32s3-02' });
  });
});

const device = () => env.authenticatedContext('devUid').database();
const anon = () => env.unauthenticatedContext().database();
const seedSession = () => env.withSecurityRulesDisabled((ctx) => ctx.database().ref(`sessions/${SID}/meta`).set(meta));

describe('đọc', () => {
  it('ẩn danh đọc được live, sessions, sessionData', async () => {
    await assertSucceeds(anon().ref(`devices/${DEV}/live`).get());
    await assertSucceeds(anon().ref('sessions').get());
    await assertSucceeds(anon().ref(`sessionData/${SID}`).get());
  });
  it('không ai đọc được config', async () => {
    await assertFails(anon().ref('config').get());
    await assertFails(device().ref('config').get());
  });
});

describe('ghi của web (ẩn danh)', () => {
  it('bị chặn ở mọi nhánh', async () => {
    await seedSession();
    await assertFails(anon().ref(`devices/${DEV}/live`).set(live));
    await assertFails(anon().ref(`sessions/${SID}/meta/endedAt`).set(1763470009999));
    await assertFails(anon().ref(`sessionData/${SID}/processed/${T}`).set(proc));
    await assertFails(anon().ref(`sessions/${SID}`).remove());
  });
  it('tài khoản không đăng ký cũng bị chặn', async () => {
    const stranger = env.authenticatedContext('strangerUid').database();
    await assertFails(stranger.ref(`devices/${DEV}/live`).set(live));
    await assertFails(stranger.ref(`sessions/${SID}/meta`).set(meta));
  });
});

describe('ghi của thiết bị', () => {
  it('ghi được đúng luồng như simulator', async () => {
    const db = device();
    await assertSucceeds(db.ref(`sessions/${SID}/meta`).set(meta));
    await assertSucceeds(db.ref().update({
      [`devices/${DEV}/live`]: live,
      [`sessionData/${SID}/processed/${T}`]: proc,
      [`sessionData/${SID}/raw/${T}`]: { t0: proc.t, v: [1, -2, 3] },
    }));
    await assertSucceeds(db.ref(`sessions/${SID}`).update({
      'meta/endedAt': 1763470009999,
      summary: { failureAtMs: 5000, rmsMax: 0.7, durationMs: 9999 },
    }));
  });

  it('không ghi được live của thiết bị khác', async () => {
    await assertFails(device().ref('devices/esp32s3-02/live').set(live));
  });

  it('không chiếm hoặc xoá phiên của thiết bị khác', async () => {
    await seedSession();
    const other = env.authenticatedContext('otherUid').database();
    await assertFails(other.ref(`sessions/${SID}/meta`).set({ ...meta, deviceId: 'esp32s3-02' }));
    await assertFails(other.ref(`sessionData/${SID}/processed/${T}`).set(proc));
    await assertFails(device().ref(`sessions/${SID}`).remove());
  });

  it('không ghi dữ liệu trước khi có meta', async () => {
    await assertFails(device().ref(`sessionData/${SID}/processed/${T}`).set(proc));
  });

  it('bản ghi sai kiểu bị từ chối', async () => {
    await seedSession();
    const db = device();
    await assertFails(db.ref(`devices/${DEV}/live`).set({ ...live, label: 2 }));
    await assertFails(db.ref(`devices/${DEV}/live`).set({ ...live, angle: 500 }));
    await assertFails(db.ref(`sessionData/${SID}/processed/${T}`).set({ ...proc, rms: -1 }));
    await assertFails(db.ref(`sessionData/${SID}/processed/${T}`).set({ ...proc, extra: 1 }));
    await assertFails(db.ref(`sessionData/${SID}/processed/abc`).set(proc));
    await assertFails(db.ref(`sessionData/${SID}/raw/${T}`).set({ t0: proc.t, v: [99999] }));
    await assertFails(db.ref(`sessions/${SID}/meta/endedAt`).set(1));
    await assertFails(db.ref(`sessions/bad-id/meta`).set(meta));
  });
});
