/** 导航业务展示格式化。 */
export function formatDistance(value: number): string {
  return `${value.toFixed(1)} 局部单位`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

export function requiredNumber(id: string): number {
  const value = Number((document.getElementById(id) as HTMLInputElement).value);
  if (!Number.isFinite(value)) throw new Error("请输入有效的局部坐标");
  return value;
}
