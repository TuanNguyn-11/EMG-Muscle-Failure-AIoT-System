import type { Label } from './schema';

/** Nhãn AI chốt một chiều: đã lên 1 thì giữ 1 đến hết phiên (SPEC, quyết định #4). */
export const latchLabel = (prev: Label, next: Label): Label => (prev === 1 ? 1 : next);

export const LABEL_TEXT: Record<Label, string> = {
  0: 'CHƯA THẤT BẠI CƠ',
  1: 'ĐÃ THẤT BẠI CƠ',
};
