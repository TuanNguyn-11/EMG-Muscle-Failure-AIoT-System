/** Bộ đệm vòng cho chuỗi (x tăng dần, y). Điểm có x ≤ x cuối bị bỏ (trùng/đến muộn). */
export class RingBuffer {
  private readonly xs: Float64Array;
  private readonly ys: Float64Array;
  private start = 0;
  private len = 0;

  constructor(readonly capacity: number) {
    this.xs = new Float64Array(capacity);
    this.ys = new Float64Array(capacity);
  }

  get size(): number {
    return this.len;
  }

  get lastX(): number | undefined {
    return this.len ? this.xs[(this.start + this.len - 1) % this.capacity] : undefined;
  }

  get lastY(): number | undefined {
    return this.len ? this.ys[(this.start + this.len - 1) % this.capacity] : undefined;
  }

  push(x: number, y: number): boolean {
    const last = this.lastX;
    if (last !== undefined && x <= last) return false;
    const i = (this.start + this.len) % this.capacity;
    this.xs[i] = x;
    this.ys[i] = y;
    if (this.len < this.capacity) this.len++;
    else this.start = (this.start + 1) % this.capacity;
    return true;
  }

  clear(): void {
    this.start = 0;
    this.len = 0;
  }

  /** Mảng theo thứ tự thời gian, dạng uPlot cần. */
  toArrays(): [number[], number[]] {
    const xs = new Array<number>(this.len);
    const ys = new Array<number>(this.len);
    for (let k = 0; k < this.len; k++) {
      const i = (this.start + k) % this.capacity;
      xs[k] = this.xs[i]!;
      ys[k] = this.ys[i]!;
    }
    return [xs, ys];
  }
}
