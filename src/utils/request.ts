/**
 * 请求工具层
 * 封装 Taro.request，统一处理 token、错误码、超时等
 * 联调时只需修改 BASE_URL 和拦截器逻辑
 */
import Taro from '@tarojs/taro';
import { reportLocalDebug } from '@/utils/local-debug';

// 小程序运行时没有 Node.js 的 process，全局访问前必须先做兼容判断。
// 小程序端默认走 app 口径，避免与 admin 后台接口混用。
const RAW_BASE_URL =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.TARO_API_BASE_URL || '/api/app/v1'
    : '/api/app/v1';
const TIMEOUT = 10000;
const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');
const buildRequestUrl = (url: string): string => {
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${BASE_URL}${normalizedPath}`;
};

function clearAuthSession(): void {
  Taro.removeStorageSync(AUTH_TOKEN_KEY);
}

function redirectToLogin(): void {
  const currentPages = Taro.getCurrentPages();
  const currentRoute = currentPages[currentPages.length - 1]?.route;
  if (currentRoute === 'package-auth/pages/login/index') {
    return;
  }

  Taro.redirectTo({ url: '/package-auth/pages/login/index' });
}

/** API 统一响应格式 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

/** 获取存储的 token */
function readAccessToken(): string | null {
  try {
    const raw = Taro.getStorageSync(AUTH_TOKEN_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const expiresAt = Number(session.expires_at ?? 0);
    if (!session.access_token) return null;
    // 提前 60 秒视为过期，便于静默刷新
    if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now() + 60_000) {
      return null;
    }
    return session.access_token || null;
  } catch {
    return null;
  }
}

function readRefreshToken(): string | null {
  try {
    const raw = Taro.getStorageSync(AUTH_TOKEN_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session.refresh_token || null;
  } catch {
    return null;
  }
}

function persistRefreshedSession(token: string, refreshToken: string, expiresIn: number): void {
  try {
    const raw = Taro.getStorageSync(AUTH_TOKEN_KEY);
    const session = raw ? JSON.parse(raw) : {};
    const next = {
      ...session,
      access_token: token,
      refresh_token: refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    };
    Taro.setStorageSync(AUTH_TOKEN_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = readRefreshToken();
    if (!refreshToken) {
      clearAuthSession();
      return null;
    }

    try {
      const res = await Taro.request({
        url: buildRequestUrl('/auth/refresh'),
        method: 'POST',
        data: { refreshToken },
        header: { 'Content-Type': 'application/json' },
        timeout: TIMEOUT,
      });

      if (res.statusCode >= 200 && res.statusCode < 300 && res.data && typeof res.data === 'object') {
        const body = res.data as ApiResponse<{
          token: string;
          refreshToken: string;
          expiresIn: number;
        }>;
        if (body.code === 0 || body.code === 200) {
          persistRefreshedSession(body.data.token, body.data.refreshToken, body.data.expiresIn);
          return body.data.token;
        }
      }

      clearAuthSession();
      return null;
    } catch {
      clearAuthSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function resolveAccessToken(skipAuth: boolean): Promise<string | null> {
  if (skipAuth) {
    return null;
  }
  const current = readAccessToken();
  if (current) {
    return current;
  }
  return refreshAccessToken();
}

/** 请求配置 */
interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: Record<string, unknown>;
  header?: Record<string, string>;
  /** 是否跳过自动 token 注入 */
  skipAuth?: boolean;
}

/** 核心请求函数 */
export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, skipAuth = false } = options;
  const startAt = Date.now();

  // 注入 token（过期时尝试 refresh）
  if (!skipAuth) {
    const token = await resolveAccessToken(skipAuth);
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const res = await Taro.request({
      url: buildRequestUrl(url),
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header,
      },
      timeout: TIMEOUT,
    });

    // #region debug-point H1:request-success
    reportLocalDebug({
      hypothesisId: 'H1',
      location: 'src/utils/request.ts:request',
      msg: '[DEBUG] request success',
      data: {
        method,
        url,
        durationMs: Date.now() - startAt,
        statusCode: res.statusCode,
      },
    });
    // #endregion

    // HTTP 状态码检查
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // 如果后端返回 { code, data, message } 格式
      if (res.data && typeof res.data === 'object' && 'code' in res.data) {
        const body = res.data as ApiResponse<T>;
        if (body.code === 0 || body.code === 200) {
          return body.data;
        }
        if (body.code === 401) {
          clearAuthSession();
          redirectToLogin();
        }
        throw new ApiError(body.code, body.message);
      }
      // 直接返回数据
      return res.data as T;
    }

    // 401 未授权 → 跳转登录
    if (res.statusCode === 401) {
      clearAuthSession();
      redirectToLogin();
      throw new ApiError(401, '登录已过期，请重新登录');
    }

    throw new ApiError(res.statusCode, `请求失败 (${res.statusCode})`);
  } catch (err) {
    // #region debug-point H1:request-fail
    reportLocalDebug({
      hypothesisId: 'H1',
      location: 'src/utils/request.ts:request',
      msg: '[DEBUG] request fail',
      data: {
        method,
        url,
        durationMs: Date.now() - startAt,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    // #endregion
    if (err instanceof ApiError) throw err;
    // 网络错误
    throw new ApiError(-1, '网络异常，请检查网络连接');
  }
}

/** API 错误类 */
export class ApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiError';
  }
}

/** POST 请求 */
export function post<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  options?: { skipAuth?: boolean },
): Promise<T> {
  return request<T>({ url, method: 'POST', data, skipAuth: options?.skipAuth });
}

/** GET 请求 */
export function get<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  options?: { skipAuth?: boolean },
): Promise<T> {
  return request<T>({ url, method: 'GET', data: params, skipAuth: options?.skipAuth });
}

/** PUT 请求 */
export function put<T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ url, method: 'PUT', data });
}

/** PATCH 请求 */
export function patch<T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ url, method: 'PATCH', data });
}

/** DELETE 请求 */
export function del<T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ url, method: 'DELETE', data });
}
