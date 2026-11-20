// Đếm lần tập từ chuỗi góc khuỷu: một lần = rời vùng nghỉ, gập lên, quay về vùng nghỉ.
// ponytail: ngưỡng cố định là tham số nghiên cứu (như ngưỡng MATLAB), chưa hiệu chỉnh theo từng người.
export const REST_ANGLE = 30; // ≤ 30° coi là tay duỗi / nghỉ
export const MIN_PEAK = 45;   // gập chưa tới 45° thì không tính là một lần tập
export const GOOD_PEAK = 120; // đỉnh ≥ 120° = đủ biên độ = tập chuẩn

export type RepResult = 'good' | 'bad';

export class RepCounter {
  good = 0;
  bad = 0;
  private active = false;
  private peak = 0;

  /** Trả về kết quả khi một lần tập vừa kết thúc, ngược lại null. */
  push(angle: number): RepResult | null {
    if (!this.active) {
      if (angle >= MIN_PEAK) {
        this.active = true;
        this.peak = angle;
      }
      return null;
    }
    this.peak = Math.max(this.peak, angle);
    if (angle > REST_ANGLE) return null;
    this.active = false;
    const r: RepResult = this.peak >= GOOD_PEAK ? 'good' : 'bad';
    this[r]++;
    return r;
  }

  reset(): void {
    this.good = this.bad = this.peak = 0;
    this.active = false;
  }
}
