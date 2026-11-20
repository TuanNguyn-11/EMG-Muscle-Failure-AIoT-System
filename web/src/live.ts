import { limitToLast, onChildAdded, onValue, query, ref, type Unsubscribe } from 'firebase/database';
import { StreamChart, WINDOW_S } from './charts';
import { bicepsIntensity } from './color';
import { db, DEVICE_ID } from './firebase';
import { LABEL_TEXT, latchLabel } from './label';
import { RepCounter } from './reps';
import { RingBuffer } from './ringBuffer';
import { Arm3D } from './scene/arm3d';
import { parseLive, parseMeta, parseProcessed, parseRawChunk, RAW_CHUNK_LEN, type Label, type Live, type Meta, type Processed, type RawChunk } from './schema';
import { DEFAULT_PARAMS, processedAt, rawChunkAt, seededRandom } from './signal';
import { connStatus } from './status';
import './styles.css';

const RAW_HZ_MAX = 1000;
// tải dư 2 s so với cửa sổ để biểu đồ đầy ngay khi mở trang
const RAW_CHUNKS = Math.ceil(((WINDOW_S + 2) * RAW_HZ_MAX) / RAW_CHUNK_LEN);
const PROCESSED_N = (WINDOW_S + 2) * 10; // 10 Hz

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  state: $('conn-state'), detail: $('conn-detail'), pill: $('conn'),
  emgVal: $('emg-val'), rmsVal: $('rms-val'), angleVal: $('angle-val'),
  empty: $('charts-empty'), pause: $<HTMLButtonElement>('pause'),
  scene: $('scene'), statAngle: $('stat-angle'), statEffort: $('stat-effort'), effortBar: $('effort-bar'),
  banner: $('ai-banner'), bannerText: $('ai-text'),
  repGood: $('rep-good'), repBad: $('rep-bad'), repTotal: $('rep-total'), repShare: $('rep-share'),
  repBarGood: $('rep-bar-good'), repBarBad: $('rep-bar-bad'), signalsSub: $('signals-sub'),
  fake: $<HTMLButtonElement>('fake'), device: $('conn-device'),
};

const arm = new Arm3D(el.scene);

const bufEmg = new RingBuffer((WINDOW_S + 2) * RAW_HZ_MAX);
const bufRms = new RingBuffer(PROCESSED_N);
const bufAngle = new RingBuffer(PROCESSED_N);

const symmetric = (min: number, max: number): [number, number] => {
  const m = Math.max(Math.abs(min), Math.abs(max), 0.05) * 1.1;
  return [-m, m];
};
/** số tròn ≤ v với 1 chữ số có nghĩa (1.37 → 1, 0.068 → 0.06) */
const roundDown = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.floor(v / p) * p;
};

// Crosshair đồng bộ: khi rê chuột, viên giá trị của mỗi biểu đồ hiện giá trị tại thời điểm đó.
const hover: { x: number | null; emg?: number; rms?: number; angle?: number } = { x: null };
const onHover = (key: 'emg' | 'rms') => (p: { x: number; y: number; y2?: number } | null) => {
  hover.x = p?.x ?? null;
  hover[key] = p?.y;
  if (key === 'rms') hover.angle = p?.y2;
  pillsDirty = true; // chỉ cập nhật chữ, không vẽ lại biểu đồ (tránh vòng setData ↔ setCursor)
};
let pillsDirty = false;

const charts = {
  // RMS (trục trái, vùng đỏ) + góc (trục phải, đường xanh) trên cùng một biểu đồ
  combo: new StreamChart($('chart-combo'), {
    fill: true, color: '--color-effort', onHover: onHover('rms'),
    yRange: (_min, max) => [0, Math.max(max, (meta?.rmsRef ?? 0.5) * 1.15)],
    ySplits: () => { const r = meta?.rmsRef ?? 0.5; return [0, +(r / 2).toFixed(2), r]; },
    refLine: { color: '--color-muted-foreground', dash: [6, 4], label: 'MVC' },
    y2: { color: '--color-angle', yRange: () => [0, 160], ySplits: () => [0, 45, 90, 135], unit: '°' },
  }),
  emg: new StreamChart($('chart-emg'), {
    color: '--color-emg', yRange: symmetric, showX: true, onHover: onHover('emg'),
    ySplits: (_min, max) => { const r = roundDown(max / 1.1); return [-r, 0, r]; },
  }),
};

let live: Live | null = null;
let meta: Meta | null = null;
let sessionId: string | null = null;
let serverOffset = 0;
let paused = false;
let dirty = false;
let unsubs: Unsubscribe[] = [];
let label: Label = 0;
let lastAriaUpdate = 0;
const reps = new RepCounter();
let fakeTimer: ReturnType<typeof setInterval> | undefined;
let lastRealLive: Live | null = null;

const startedAt = () => meta?.startedAt ?? Number(sessionId?.slice(1) ?? 0);
const xOf = (t: number) => (t - startedAt()) / 1000;

// ---- Nạp dữ liệu: chung cho Firebase và chế độ Fake ----
function resetSession(sid: string | null) {
  unsubs.forEach((u) => u());
  unsubs = [];
  [bufEmg, bufRms, bufAngle].forEach((b) => b.clear());
  reps.reset();
  renderReps();
  sessionId = sid;
  meta = null;
  label = 0;
  dirty = true;
  el.banner.dataset.state = 'idle';
  el.bannerText.textContent = 'Chờ dữ liệu';
}

function setMeta(m: Meta | null) {
  meta = m;
  charts.combo.setRef(m?.rmsRef ?? null);
}

function ingestProcessed(p: Processed) {
  bufRms.push(xOf(p.t), p.rms);
  if (bufAngle.push(xOf(p.t), p.angle) && reps.push(p.angle)) renderReps();
  dirty = true;
}

function ingestRaw(c: RawChunk) {
  const dt = 1000 / (meta?.fsRaw ?? RAW_HZ_MAX);
  c.v.forEach((uV, i) => bufEmg.push(xOf(c.t0 + i * dt), uV / 1000));
  dirty = true;
}

function ingestLive(l: Live | null) {
  live = l;
  if (l) renderBody(l);
  renderStatus();
}

// ---- Firebase ----
function openSession(sid: string) {
  resetSession(sid);
  unsubs = [
    onValue(ref(db, `sessions/${sid}/meta`), (s) => setMeta(parseMeta(s.val()))),
    // tải cả phiên (không limit) để đếm đủ số lần tập; ring buffer chỉ giữ 12 s cuối để vẽ.
    // ponytail: phiên rất dài (> 30 phút ≈ 1.5 MB) nên để thiết bị gửi sẵn số lần tập.
    onChildAdded(ref(db, `sessionData/${sid}/processed`), (s) => {
      const p = parseProcessed(s.val());
      if (p) ingestProcessed(p);
    }),
    onChildAdded(query(ref(db, `sessionData/${sid}/raw`), limitToLast(RAW_CHUNKS)), (s) => {
      const c = parseRawChunk(s.val());
      if (c) ingestRaw(c);
    }),
  ];
}

function handleRealLive(l: Live | null) {
  if (l && l.sessionId !== sessionId) openSession(l.sessionId);
  ingestLive(l);
}

onValue(ref(db, '.info/serverTimeOffset'), (s) => (serverOffset = Number(s.val()) || 0));
onValue(ref(db, `devices/${DEVICE_ID}/live`), (s) => {
  lastRealLive = parseLive(s.val());
  if (!fakeTimer) handleRealLive(lastRealLive);
});

// ---- Fake: sinh dữ liệu tập liên tục ngay trong trình duyệt, không ghi lên Firebase ----
const FAKE = { ...DEFAULT_PARAMS, failureAtS: 30 }; // thất bại cơ sau 30 s cho demo nhanh
const FAKE_TICK_MS = 100;

function startFake() {
  const startedAt = Date.now();
  resetSession(`s${startedAt}`);
  setMeta({ deviceId: 'fake', startedAt, endedAt: null, fsRaw: RAW_HZ_MAX, rmsRef: FAKE.rmsRef, fwVersion: 'fake' });
  const rand = seededRandom(startedAt);
  let nextRawS = 0;
  const chunkS = RAW_CHUNK_LEN / RAW_HZ_MAX;
  fakeTimer = setInterval(() => {
    const tS = (Date.now() - startedAt) / 1000;
    const p = processedAt(startedAt, tS, FAKE);
    ingestProcessed(p);
    for (; nextRawS + chunkS <= tS; nextRawS += chunkS) ingestRaw(rawChunkAt(startedAt, nextRawS, RAW_CHUNK_LEN, RAW_HZ_MAX, FAKE, rand));
    ingestLive({ sessionId: sessionId!, ...p });
  }, FAKE_TICK_MS);
}

function stopFake() {
  clearInterval(fakeTimer);
  fakeTimer = undefined;
  resetSession(null);
  live = null;
  handleRealLive(lastRealLive); // quay lại dữ liệu thật
}

el.fake.addEventListener('click', () => {
  if (fakeTimer) stopFake();
  else startFake();
  const on = Boolean(fakeTimer);
  el.fake.toggleAttribute('data-on', on);
  el.fake.textContent = on ? 'Dừng Fake' : 'Fake';
  el.device.textContent = on ? 'dữ liệu giả' : DEVICE_ID;
  renderStatus();
});

function renderReps() {
  const total = reps.good + reps.bad;
  el.repTotal.textContent = String(total);
  el.repGood.textContent = String(reps.good);
  el.repBad.textContent = String(reps.bad);
  el.repShare.textContent = total ? `${Math.round((reps.good / total) * 100)}% đạt chuẩn` : 'chưa có lần tập';
  // thanh chia phần: độ rộng tỉ lệ với số lần; phần bằng 0 không vẽ
  el.repBarGood.style.flexGrow = String(reps.good);
  el.repBarBad.style.flexGrow = String(reps.bad);
  el.repBarGood.hidden = reps.good === 0;
  el.repBarBad.hidden = reps.bad === 0;
}

/** 3D, overlay và nhãn AI theo bản live mới nhất — không phụ thuộc nút tạm dừng biểu đồ. */
function renderBody(l: Live) {
  const k = bicepsIntensity(l.rms, meta?.rmsRef);
  arm.setElbowAngle(l.angle);
  arm.setBicepsIntensity(k);
  const pct = `${Math.round(k * 100)}%`;
  el.statAngle.textContent = l.angle.toFixed(0);
  el.statEffort.textContent = String(Math.round(k * 100));
  el.effortBar.style.width = pct;
  const now = performance.now();
  if (now - lastAriaUpdate > 1000) {
    lastAriaUpdate = now;
    el.scene.setAttribute('aria-label', `Mô hình tay phải, góc khuỷu ${l.angle.toFixed(0)} độ, mức gồng ${pct}`);
  }

  const prev = label;
  label = latchLabel(label, l.label);
  if (el.bannerText.textContent !== LABEL_TEXT[label]) {
    el.banner.dataset.state = label ? 'failure' : 'ok';
    el.bannerText.textContent = LABEL_TEXT[label];
    if (prev === 0 && label === 1) {
      el.banner.classList.remove('emphasize');
      void el.banner.offsetWidth; // chạy lại animation
      el.banner.classList.add('emphasize');
    }
  }
}

function renderStatus() {
  const st = fakeTimer
    ? { state: 'fake', text: 'FAKE', detail: '· đang chạy' }
    : connStatus(live, meta, Date.now() + serverOffset);
  el.pill.dataset.state = st.state;
  if (el.state.textContent !== st.text) el.state.textContent = st.text; // chỉ đổi khi cần để screen reader không đọc lặp
  el.detail.textContent = st.detail;
  el.empty.hidden = sessionId !== null;
}
setInterval(renderStatus, 250);

const fmt = (x: number | undefined, d: number) => (x === undefined ? '—' : x.toFixed(d));

function frame() {
  if (dirty && !paused) {
    dirty = false;
    const xMax = Math.max(bufRms.lastX ?? 0, bufEmg.lastX ?? 0);
    charts.emg.draw(bufEmg.toArrays(), xMax);
    const [xs, rms] = bufRms.toArrays();
    const [, ang] = bufAngle.toArrays();
    const n = Math.min(xs.length, ang.length); // hai bộ đệm cùng nhịp 10 Hz; lấy phần đuôi chung cho chắc
    charts.combo.draw([xs.slice(xs.length - n), rms.slice(rms.length - n), ang.slice(ang.length - n)], xMax);
    pillsDirty = true;
  }
  if (pillsDirty) {
    pillsDirty = false;
    const h = hover.x !== null;
    const rms = h ? hover.rms : bufRms.lastY;
    const pct = rms !== undefined && meta ? ` · ${Math.round((rms / meta.rmsRef) * 100)}% MVC` : '';
    el.emgVal.textContent = `${fmt(h ? hover.emg : bufEmg.lastY, 2)} mV`;
    el.rmsVal.textContent = `${fmt(rms, 2)} mV${pct}`;
    el.angleVal.textContent = `${fmt(h ? hover.angle : bufAngle.lastY, 0)}°`;
    el.signalsSub.textContent = h ? `Tại giây ${hover.x!.toFixed(1)} · rời chuột để xem trực tiếp` : '10 giây gần nhất';
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function togglePause() {
  paused = !paused;
  dirty = true;
  el.pause.querySelector('span')!.textContent = paused ? 'Tiếp tục biểu đồ' : 'Tạm dừng biểu đồ';
  el.pause.querySelector('.i-pause')!.toggleAttribute('hidden', paused);
  el.pause.querySelector('.i-play')!.toggleAttribute('hidden', !paused);
}
el.pause.addEventListener('click', togglePause);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    togglePause();
  }
});
// Tab ẩn: trình duyệt tự dừng requestAnimationFrame, dữ liệu vẫn được đệm.
