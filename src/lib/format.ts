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

export function formatTokenVolume(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return '0';
  }
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(2)}B`;
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return formatNumber(tokens, 0);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 s';
  }
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const rem = seconds - mins * 60;
    return `${mins}分${rem.toFixed(1)}秒`;
  }
  return `${seconds.toFixed(1)} s`;
}
