// Quy ước: cánh tay trên thõng theo −Y, người nhìn về +Z. Gập khuỷu đưa cẳng tay về phía trước (+Z),
// tức quay quanh trục X một góc âm. angle = góc gập (0 = duỗi thẳng).
export const ELBOW_MIN = 0;
export const ELBOW_MAX = 160;

export function elbowRotationX(angleDeg: number): number {
  const a = Math.min(ELBOW_MAX, Math.max(ELBOW_MIN, angleDeg));
  return (-a * Math.PI) / 180;
}
