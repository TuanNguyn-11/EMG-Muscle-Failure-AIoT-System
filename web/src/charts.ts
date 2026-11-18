import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

export const WINDOW_S = 10;

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export interface ChartSpec {
  color: string;                                   // tên biến CSS, ví dụ --color-emg
  yRange: (min: number, max: number) => [number, number];
  refLine?: { color: string; dash: number[] };     // đường ngang (vd. MVC)
}

/** Một biểu đồ thời gian chạy theo cửa sổ [xMax − 10 s, xMax], tự co theo khung chứa. */
export class StreamChart {
  private readonly u: uPlot;
  private xMax = WINDOW_S;
  private ref: number | null = null;

  constructor(el: HTMLElement, spec: ChartSpec) {
    const grid = { stroke: 'rgba(148,163,184,0.15)', width: 1 };
    const axis = { stroke: css('--color-muted-foreground'), grid, ticks: grid, font: '12px "Fira Code", monospace' };
    const series: uPlot.Series[] = [{}, { stroke: css(spec.color), width: 1.5, points: { show: false } }];
    if (spec.refLine) series.push({ stroke: css(spec.refLine.color), dash: spec.refLine.dash, width: 1, points: { show: false } });

    this.u = new uPlot(
      {
        width: el.clientWidth || 300,
        height: el.clientHeight || 120,
        legend: { show: false },
        cursor: { show: false },
        scales: {
          x: { time: false, range: () => [this.xMax - WINDOW_S, this.xMax] },
          y: { range: (_u, min, max) => spec.yRange(min ?? 0, max ?? 0) },
        },
        axes: [{ ...axis, values: (_u, ticks) => ticks.map((t) => `${t.toFixed(0)}s`) }, { ...axis, size: 48 }],
        series,
      },
      [[], [], ...(spec.refLine ? [[]] : [])],
      el,
    );
    new ResizeObserver(() => this.u.setSize({ width: el.clientWidth, height: el.clientHeight })).observe(el);
  }

  setRef(y: number | null): void {
    this.ref = y;
  }

  draw([xs, ys]: [number[], number[]], xMax: number): void {
    this.xMax = Math.max(WINDOW_S, xMax);
    const data: uPlot.AlignedData = this.u.series.length === 3
      ? [xs, ys, xs.map(() => this.ref)]
      : [xs, ys];
    this.u.setData(data);
  }
}
