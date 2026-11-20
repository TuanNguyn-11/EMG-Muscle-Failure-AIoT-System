import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

export const WINDOW_S = 10;

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export interface ChartSpec {
  color: string;                                   // tên biến CSS, ví dụ --color-emg
  yRange: (min: number, max: number) => [number, number];
  ySplits?: (min: number, max: number) => number[]; // vạch trục y cố định, ít và tròn số
  refLine?: { color: string; dash: number[]; label: string }; // đường ngang có nhãn trực tiếp (vd. MVC)
  fill?: boolean;                                  // tô vùng mờ dưới đường (biểu đồ vùng)
  showX?: boolean;                                 // chỉ biểu đồ dưới cùng hiện trục thời gian
  onHover?: (p: { x: number; y: number; y2?: number } | null) => void; // crosshair đồng bộ → đọc giá trị
  // đường thứ hai dùng thang đo riêng ở trục phải (người dùng chọn gộp RMS + góc vào một biểu đồ)
  y2?: { color: string; yRange: () => [number, number]; ySplits?: () => number[]; unit?: string };
}

/** #RRGGBB + alpha → rgba() */
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Một biểu đồ thời gian chạy theo cửa sổ [xMax − 10 s, xMax], tự co theo khung chứa. */
export class StreamChart {
  private readonly u: uPlot;
  private xMax = WINDOW_S;
  private ref: number | null = null;
  private nData = 2; // x + các đường dữ liệu (không tính đường tham chiếu)

  constructor(el: HTMLElement, spec: ChartSpec) {
    const muted = css('--color-muted-foreground');
    const grid = { stroke: 'rgba(11,30,58,0.06)', width: 1 }; // lưới chìm: navy rất mờ
    const axis = { stroke: muted, grid, ticks: { show: false }, font: '12px "Fira Code", monospace', gap: 4 };
    const color = css(spec.color);
    const fill = spec.fill
      ? (u: uPlot) => {
          const g = u.ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
          g.addColorStop(0, alpha(color, 0.2));
          g.addColorStop(1, alpha(color, 0));
          return g;
        }
      : undefined;
    const series: uPlot.Series[] = [{}, { stroke: color, width: 2, fill, points: { show: false } }];
    if (spec.y2) series.push({ stroke: css(spec.y2.color), width: 2, scale: 'y2', points: { show: false } });
    if (spec.refLine) series.push({ stroke: css(spec.refLine.color), dash: spec.refLine.dash, width: 1, points: { show: false } });

    const xAxis: uPlot.Axis = spec.showX
      ? { ...axis, size: 26, values: (_u, ticks) => ticks.map((t) => `${t.toFixed(0)}s`) }
      : { show: false };
    const yAxis: uPlot.Axis = {
      ...axis, size: 44, grid: { ...grid, show: true },
      ...(spec.ySplits && { splits: (u: uPlot) => spec.ySplits!(u.scales.y!.min ?? 0, u.scales.y!.max ?? 0) }),
    };
    const y2 = spec.y2;
    const y2Axis: uPlot.Axis[] = y2
      ? [{
          ...axis, scale: 'y2', side: 1, size: 44, grid: { show: false },
          ...(y2.ySplits && { splits: () => y2.ySplits!() }),
          values: (_u, ticks) => ticks.map((t) => `${t}${y2.unit ?? ''}`),
        }]
      : [];
    this.nData = 2 + (y2 ? 1 : 0);

    this.u = new uPlot(
      {
        width: el.clientWidth || 300,
        height: el.clientHeight || 120,
        legend: { show: false },
        cursor: {
          sync: { key: 'signals' },                    // một crosshair chạy qua cả 3 biểu đồ
          y: false,
          drag: { x: false, y: false },
          points: { size: 8, width: 2, fill: css('--color-white') },
        },
        scales: {
          x: { time: false, range: () => [this.xMax - WINDOW_S, this.xMax] },
          y: { range: (_u, min, max) => spec.yRange(min ?? 0, max ?? 0) },
          ...(y2 && { y2: { range: () => y2.yRange() } }),
        },
        axes: [xAxis, yAxis, ...y2Axis],
        series,
        hooks: {
          setCursor: [(u) => {
            const i = u.cursor.idx;
            const x = i == null ? undefined : u.data[0][i];
            const y = i == null ? undefined : u.data[1]![i];
            const y2v = i == null || !y2 ? undefined : u.data[2]![i];
            spec.onHover?.(x == null || y == null ? null : { x, y, y2: y2v ?? undefined });
          }],
          // nhãn trực tiếp ở đầu phải đường tham chiếu, thay cho chú thích
          draw: spec.refLine ? [(u) => {
            if (this.ref == null) return;
            const yPx = u.valToPos(this.ref, 'y', true);
            const ctx = u.ctx;
            ctx.save();
            ctx.font = `600 ${11 * devicePixelRatio}px "Segoe UI", sans-serif`;
            ctx.fillStyle = muted;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(spec.refLine!.label, u.bbox.left + u.bbox.width - 4, yPx - 3);
            ctx.restore();
          }] : [],
        },
      },
      Array.from({ length: series.length }, () => []) as unknown as uPlot.AlignedData,
      el,
    );
    new ResizeObserver(() => this.u.setSize({ width: el.clientWidth, height: el.clientHeight })).observe(el);
  }

  setRef(y: number | null): void {
    this.ref = y;
  }

  /** data = [xs, ys, ys2?] cùng độ dài; đường tham chiếu tự thêm vào cuối. */
  draw(data: number[][], xMax: number): void {
    this.xMax = Math.max(WINDOW_S, xMax);
    const xs = data[0]!;
    const all: (number | null)[][] = data.slice(0, this.nData);
    if (this.u.series.length > this.nData) all.push(xs.map(() => this.ref));
    this.u.setData(all as uPlot.AlignedData);
  }
}
