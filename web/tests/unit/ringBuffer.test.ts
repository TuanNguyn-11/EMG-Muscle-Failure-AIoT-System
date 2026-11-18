import { describe, expect, it } from 'vitest';
import { RingBuffer } from '../../src/ringBuffer';

describe('RingBuffer', () => {
  it('giữ thứ tự khi chưa đầy', () => {
    const b = new RingBuffer(4);
    b.push(1, 10);
    b.push(2, 20);
    expect(b.toArrays()).toEqual([[1, 2], [10, 20]]);
    expect(b.lastY).toBe(20);
  });

  it('đè phần tử cũ nhất khi đầy, vẫn đúng thứ tự', () => {
    const b = new RingBuffer(3);
    for (let i = 1; i <= 5; i++) b.push(i, i * 10);
    expect(b.toArrays()).toEqual([[3, 4, 5], [30, 40, 50]]);
    expect(b.size).toBe(3);
  });

  it('bỏ điểm trùng hoặc đến muộn', () => {
    const b = new RingBuffer(3);
    b.push(5, 1);
    expect(b.push(5, 2)).toBe(false);
    expect(b.push(4, 2)).toBe(false);
    expect(b.toArrays()).toEqual([[5], [1]]);
  });

  it('clear về rỗng', () => {
    const b = new RingBuffer(2);
    b.push(1, 1);
    b.clear();
    expect(b.size).toBe(0);
    expect(b.lastX).toBeUndefined();
    expect(b.toArrays()).toEqual([[], []]);
  });
});
