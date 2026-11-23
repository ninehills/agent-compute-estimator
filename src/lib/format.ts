export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDecimal(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (Math.abs(value) >= 1000 && digits > 1) {
    return formatNumber(value, 1);
  }
  return formatNumber(value, digits);
}

export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) {
    return '0%';
  }
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatCompactTokens(tokens: number): string {
  if (tokens >= 1024 && tokens % 1024 === 0) {
    return `${tokens / 1024}K`;
  }
  if (tokens >= 10000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return formatNumber(tokens, 0);
}
