import { limitToLast, onChildAdded, onValue, query, ref, type Unsubscribe } from 'firebase/database';
import { StreamChart, WINDOW_S } from './charts';
import { bicepsIntensity } from './color';
import { db, DEVICE_ID } from './firebase';
import { LABEL_TEXT, latchLabel } from './label';
import { RingBuffer } from './ringBuffer';
import { Arm3D } from './scene/arm3d';
import { parseLive, parseMeta, parseProcessed, parseRawChunk, RAW_CHUNK_LEN, type Label, type Live, type Meta } from './schema';
import { connStatus } from './status';
import './styles.css';

const PROCESSED_HZ = 10;
const RAW_HZ_MAX = 1000;
// tải dư 2 s so với cửa sổ để biểu đồ đầy ngay khi mở trang
const RAW_CHUNKS = Math.ceil(((WINDOW_S + 2) * RAW_HZ_MAX) / RAW_CHUNK_LEN);
const PROCESSED_N = (WINDOW_S + 2) * PROCESSED_HZ;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  state: $('conn-state'), detail: $('conn-detail'), pill: $('conn'),
  emgVal: $('emg-val'), rmsVal: $('rms-val'), angleVal: $('angle-val'),
  empty: $('charts-empty'), pause: $<HTMLButtonElement>('pause'),
  scene: $('scene'), sceneAngle: $('scene-angle'), sceneEffort: $('scene-effort'), sceneEffortBar: $('scene-effort-bar'),
  banner: $('ai-banner'), bannerText: $('ai-text'),
};

const arm = new Arm3D(el.scene);

const bufEmg = new RingBuffer((WINDOW_S + 2) * RAW_HZ_MAX);
const bufRms = new RingBuffer(PROCESSED_N);
const bufAngle = new RingBuffer(PROCESSED_N);

const symmetric = (min: number, max: number): [number, number] => {
  const m = Math.max(Math.abs(min), Math.abs(max), 0.05) * 1.1;
  return [-m, m];
};
const charts = {
  emg: new StreamChart($('chart-emg'), { color: '--color-emg', yRange: symmetric }),
  rms: new StreamChart($('chart-rms'), {
    color: '--color-effort',
    yRange: (_min, max) => [0, Math.max(max, (meta?.rmsRef ?? 0.5) * 1.15)],
    refLine: { color: '--color-muted-foreground', dash: [6, 4] },
  }),
  angle: new StreamChart($('chart-angle'), { color: '--color-angle', yRange: () => [0, 160] }),
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

const startedAt = () => meta?.startedAt ?? Number(sessionId?.slice(1) ?? 0);
const xOf = (t: number) => (t - startedAt()) / 1000;

function openSession(sid: string) {
  unsubs.forEach((u) => u());
  [bufEmg, bufRms, bufAngle].forEach((b) => b.clear());
  sessionId = sid;
  meta = null;
  label = 0;
  unsubs = [
    onValue(ref(db, `sessions/${sid}/meta`), (s) => {
      meta = parseMeta(s.val());
      charts.rms.setRef(meta?.rmsRef ?? null);
    }),
    onChildAdded(query(ref(db, `sessionData/${sid}/processed`), limitToLast(PROCESSED_N)), (s) => {
      const p = parseProcessed(s.val());
      if (!p) return;
      bufRms.push(xOf(p.t), p.rms);
      bufAngle.push(xOf(p.t), p.angle);
      dirty = true;
    }),
    onChildAdded(query(ref(db, `sessionData/${sid}/raw`), limitToLast(RAW_CHUNKS)), (s) => {
      const c = parseRawChunk(s.val());
      if (!c) return;
      const dt = 1000 / (meta?.fsRaw ?? RAW_HZ_MAX);
      c.v.forEach((uV, i) => bufEmg.push(xOf(c.t0 + i * dt), uV / 1000));
      dirty = true;
    }),
  ];
}

onValue(ref(db, '.info/serverTimeOffset'), (s) => (serverOffset = Number(s.val()) || 0));
onValue(ref(db, `devices/${DEVICE_ID}/live`), (s) => {
  live = parseLive(s.val());
  if (live && live.sessionId !== sessionId) openSession(live.sessionId);
  if (live) renderBody(live);
  renderStatus();
});

/** 3D, overlay và nhãn AI theo bản live mới nhất — không phụ thuộc nút tạm dừng biểu đồ. */
function renderBody(l: Live) {
  const k = bicepsIntensity(l.rms, meta?.rmsRef);
  arm.setElbowAngle(l.angle);
  arm.setBicepsIntensity(k);
  const pct = `${Math.round(k * 100)}%`;
  el.sceneAngle.textContent = `${l.angle.toFixed(0)}°`;
  el.sceneEffort.textContent = pct;
  el.sceneEffortBar.style.width = pct;
  const now = performance.now();
  if (now - lastAriaUpdate > 1000) {
    lastAriaUpdate = now;
    el.scene.setAttribute('aria-label', `Mô hình tay phải, góc khuỷu ${l.angle.toFixed(0)} độ, mức gồng ${pct}`);
  }

  const prev = label;
  label = latchLabel(label, l.label);
  el.banner.hidden = false;
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
  const st = connStatus(live, meta, Date.now() + serverOffset);
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
    charts.rms.draw(bufRms.toArrays(), xMax);
    charts.angle.draw(bufAngle.toArrays(), xMax);
    const rms = bufRms.lastY;
    const pct = rms !== undefined && meta ? ` · ${Math.round((rms / meta.rmsRef) * 100)}% MVC` : '';
    el.emgVal.textContent = `${fmt(bufEmg.lastY, 2)} mV`;
    el.rmsVal.textContent = `${fmt(rms, 2)} mV${pct}`;
    el.angleVal.textContent = `${fmt(bufAngle.lastY, 0)}°`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function togglePause() {
  paused = !paused;
  dirty = true;
  el.pause.setAttribute('aria-pressed', String(paused));
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
