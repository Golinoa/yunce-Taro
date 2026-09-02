/**
 * 网关 / CDN 层 HTTP 错误 → 用户可读文案（非业务 4xx/5xx）
 */
export function mapGatewayErrorMessage(statusCode: number): string | null {
  if (statusCode === 502) {
    return '测环境网关异常（502），请确认本机 API 与 Cloudflare Tunnel 已启动';
  }
  if (statusCode === 503) {
    return '测环境服务暂不可用（503），请稍后重试或联系管理员';
  }
  if (statusCode === 504) {
    return '测环境响应超时（504），请检查网络或 Tunnel 状态';
  }
  if (statusCode === 530) {
    return '测环境公网入口未连通（530），请在本机运行 cloudflared tunnel run yunce-dev';
  }
  if (statusCode >= 500 && statusCode < 600) {
    return `测环境服务异常（${statusCode}），请稍后重试`;
  }
  return null;
}

/** Taro.request 网络 fail 时的文案 */
export function mapNetworkFailMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/timeout|超时/i.test(msg)) {
    return '请求超时，请检查网络或测环境 Tunnel 是否在线';
  }
  if (/fail|connect|network|abort/i.test(msg)) {
    return '无法连接测环境，请确认 dev.chancore.cn 可访问';
  }
  return '网络异常，请检查网络连接';
}
