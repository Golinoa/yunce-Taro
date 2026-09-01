/**
 * 请求工具层
 * 封装 Taro.request，统一处理 token、错误码、超时等
 * 联调时只需修改 BASE_URL 和拦截器逻辑
 */
import Taro from '@tarojs/taro';
import { getApiBaseUrl } from '@/utils/build-env';
import { reportLocalDebug } from '@/utils/local-debug';
import { decodeAccessTokenClaims, pickRealTenantId } from '@/utils/tenant-id';

// 必须用 getApiBaseUrl()：小程序运行时通常没有 process，
// 若写成「有 process 才用绝对地址、否则 /api/app/v1」会打到相对路径 → 一律「网络异常」。
const BASE_URL = getApiBaseUrl().replace(/\/+$/, '');
const TIMEOUT = 10000;
const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
const USER_PROFILE_KEY = 'yunce-edu-user-profile';
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

/**
 * 静默 refresh 换 token 后，把 Profile.currentContext.organizationId 与 JWT 对齐。
 * 禁止只换 token 不改 Profile（否则假 orgId / 批后无 org 会继续联调假绿）。
 */
function syncProfileTenantFromAccessToken(accessToken: string): void {
  try {
    const claims = decodeAccessTokenClaims(accessToken);
    const organizationId = pickRealTenantId([claims.organizationId]);
    const campusId = pickRealTenantId([claims.campusId]) || undefined;
    const raw = Taro.getStorageSync(USER_PROFILE_KEY);
    if (!raw) return;
    const prev = JSON.parse(raw) as {
      identities?: Array<Record<string, unknown>>;
      currentContext?: Record<string, unknown>;
      [key: string]: unknown;
    };
    if (!prev?.currentContext) return;
    const next = {
      ...prev,
      identities: (prev.identities || []).map((identity, index) => {
        if (index !== 0) return identity;
        const { campusIds: _prevCampusIds, ...restIdentity } = identity;
        return {
          ...restIdentity,
          organizationId,
          ...(campusId ? { campusIds: [campusId] } : {}),
        };
      }),
      currentContext: (() => {
        const { campusId: _prevCampusId, ...restContext } = prev.currentContext || {};
        return {
          ...restContext,
          organizationId,
          ...(campusId ? { campusId } : {}),
        };
      })(),
    };
    Taro.setStorageSync(USER_PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
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
    syncProfileTenantFromAccessToken(token);
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

      if (
        res.statusCode >= 200 &&
        res.statusCode < 300 &&
        res.data &&
        typeof res.data === 'object'
      ) {
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
  /** 单请求超时（ms）；默认 TIMEOUT。发码等路径可单独放宽作兜底，不可替代后端异步 */
  timeout?: number;
}

/** 核心请求函数 */
export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, skipAuth = false, timeout = TIMEOUT } = options;
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
      timeout,
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
          // 登录/注册等 skipAuth：透传「邮箱或密码错误」，禁止当成会话过期
          if (!skipAuth) {
            clearAuthSession();
            redirectToLogin();
          }
        }
        if (isQuotaExceededMessage(body.message)) {
          handleQuotaExceeded(body.message);
        }
        throw new ApiError(body.code, body.message);
      }
      // 直接返回数据
      return res.data as T;
    }

    // 401：鉴权失败
    if (res.statusCode === 401) {
      const message = extractErrorMessage(res);
      if (skipAuth) {
        // password-login / register 等：后端已有「邮箱或密码错误」，勿改成「登录已过期」
        throw new ApiError(401, message || '邮箱或密码错误');
      }
      clearAuthSession();
      redirectToLogin();
      throw new ApiError(401, message?.includes('过期') ? message : '登录已过期，请重新登录');
    }

    // 统一解析后端错误消息（修复 422 等丢失 message 的问题）
    const errorMessage = extractErrorMessage(res);
    if (isQuotaExceededMessage(errorMessage)) {
      handleQuotaExceeded(errorMessage);
    }
    throw new ApiError(res.statusCode, errorMessage);
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

/** ===== QUOTA_EXCEEDED 升级引导（P0）=====
 * 后端配额拦截统一返回 422，message 以 QUOTA_EXCEEDED: 开头。
 * 识别后弹一次升级引导弹窗（防抖 3s），提示用户联系运营升级版本。
 */
let quotaModalShownAt = 0;

function handleQuotaExceeded(rawMessage: string): void {
  const now = Date.now();
  if (now - quotaModalShownAt < 3000) {
    return;
  }
  quotaModalShownAt = now;
  const friendly = rawMessage.replace(/^QUOTA_EXCEEDED:\s*/, '');
  Taro.showModal({
    title: '版本配额已达上限',
    content: `${friendly}。请升级版本或联系运营开通更高配额。`,
    showCancel: false,
    confirmText: '我知道了',
  });
}

/** 是否 QUOTA_EXCEEDED 类错误消息 */
function isQuotaExceededMessage(message: unknown): boolean {
  return typeof message === 'string' && message.startsWith('QUOTA_EXCEEDED:');
}

/** 从响应体中提取可读 message（兼容 {code,data,message} 与纯文本） */
function extractErrorMessage(res: { statusCode: number; data: unknown }): string {
  if (res.data && typeof res.data === 'object' && 'message' in res.data) {
    const msg = (res.data as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg;
    }
  }
  return `请求失败 (${res.statusCode})`;
}

/** POST 请求 */
export function post<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  options?: { skipAuth?: boolean; timeout?: number },
): Promise<T> {
  return request<T>({
    url,
    method: 'POST',
    data,
    skipAuth: options?.skipAuth,
    timeout: options?.timeout,
  });
}

/** Drop undefined/null/empty/"undefined" so MiniProgram does not send literal query junk */
function sanitizeQueryParams(
  params?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'undefined') continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/** GET 请求 */
export function get<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  options?: { skipAuth?: boolean },
): Promise<T> {
  return request<T>({
    url,
    method: 'GET',
    data: sanitizeQueryParams(params),
    skipAuth: options?.skipAuth,
  });
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
