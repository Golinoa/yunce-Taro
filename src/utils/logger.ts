/**
 * 安全日志工具：仅在开发环境输出，生产环境静默
 * 对接真实 API 后可替换为远程日志服务
 */

const isDev = process.env.NODE_ENV === 'development';

/** 开发环境输出错误日志 */
export function logError(context: string, err?: unknown): void {
  if (isDev) {
    console.error(`[${context}]`, err);
  }
}

/** 开发环境输出警告日志 */
export function logWarn(context: string, msg?: unknown): void {
  if (isDev) {
    console.warn(`[${context}]`, msg);
  }
}
