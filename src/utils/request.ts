/**
 * 请求工具层
 * 封装 Taro.request，统一处理 token、错误码、超时等
 * 联调时只需修改 BASE_URL 和拦截器逻辑
 */
import Taro from '@tarojs/taro';
import { mapGatewayErrorMessage, mapNetworkFailMessage } from '@/utils/api-gateway-error';
import { getApiBaseUrl } from '@/utils/build-env';
import { reportLocalDebug } from '@/utils/local-debug';
import { logRequestIssue } from '@/utils/logger';
import { singleFlight } from '@/utils/single-flight';
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

/** 限流退避：收到 429 后的静默窗口（ms），窗口内的新请求先等再发，避免继续加压 */
const RATE_LIMIT_BACKOFF_MS = 1500;
/** 限流提示防抖（ms）：同一波 429 只提示一次 */
const RATE_LIMIT_TOAST_DEBOUNCE_MS = 3000;
const RATE_LIMIT_MESSAGE = '操作太频繁，稍后再试';
/** /auth/* 不受退避影响：限流时也要保证用户能重新登录、能续期 */
const AUTH_PATH_PREFIX = '/auth/';
const isAuthPath = (url: string): boolean => url.startsWith(AUTH_PATH_PREFIX);

let rateLimitBackoffUntil = 0;
let rateLimitToastAt = 0;

/**
 * 429 是限流，不是会话失效：禁止清登录态、禁止跳登录页。
 * 只做统一提示 + 短暂退避，让用户停在原页面。
 */
function handleRateLimited(url: string): void {
  if (!isAuthPath(url)) {
    rateLimitBackoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
  }

  const now = Date.now();
  if (now - rateLimitToastAt < RATE_LIMIT_TOAST_DEBOUNCE_MS) {
    return;
  }
  rateLimitToastAt = now;
  Taro.showToast({ title: RATE_LIMIT_MESSAGE, icon: 'none', duration: 2000 });
}

/** 退避窗口内的请求先等待再发出 */
async function waitForRateLimitBackoff(url: string): Promise<void> {
  if (isAuthPath(url)) {
    return;
  }
  const remaining = rateLimitBackoffUntil - Date.now();
  if (remaining <= 0) {
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, remaining));
}

/** 登录页路由（getCurrentPages 的 route 不带前导 /；跳转 url 必须带） */
const LOGIN_PAGE_ROUTE = 'package-auth/pages/login/index';
const LOGIN_PAGE_URL = `/${LOGIN_PAGE_ROUTE}`;
/** 跳登录页护栏：并发 401 只跳一次，避免后到的 redirectTo 被前一次导航顶掉后静默失败 */
const LOGIN_REDIRECT_LOCK_MS = 1000;
let loginRedirectedAt = 0;

/**
 * 清本地会话。
 * 必须连 profile / userRole 一起清：只清 token 会留下「脏 profile」，
 * 让首页在"已无登录态"时仍拿旧身份继续渲染（FE-11 漏项）。
 */
function clearAuthSession(): void {
  Taro.removeStorageSync(AUTH_TOKEN_KEY);
  Taro.removeStorageSync(USER_PROFILE_KEY);
  Taro.removeStorageSync('userRole');
}

/**
 * 跳登录页（确定终点）：并发/冷启动下多个请求同时 401，只跳一次；
 * 已在登录页时不重复跳；redirectTo 失败（如栈顶是 TabBar 根页）时 reLaunch 兜底，
 * 保证一定落到登录页而不是停在中间态。
 * 整个跳转是 best-effort：跳转本身抛错不允许反噬请求链路（路由守卫会在下次 checkAuth 兜底）。
 */
function redirectToLogin(): void {
  try {
    const currentPages = Taro.getCurrentPages();
    const currentRoute = currentPages[currentPages.length - 1]?.route;
    if (currentRoute === LOGIN_PAGE_ROUTE) {
      return;
    }
    const now = Date.now();
    if (now - loginRedirectedAt < LOGIN_REDIRECT_LOCK_MS) {
      return;
    }
    loginRedirectedAt = now;

    Taro.redirectTo({
      url: LOGIN_PAGE_URL,
      fail: () => {
        Taro.reLaunch({ url: LOGIN_PAGE_URL });
      },
    });
  } catch {
    /* 跳转失败不阻塞请求层 */
  }
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

/**
 * 本轮已被判定「不可再用」的 refreshToken。
 * 后端 refresh 是「单次使用 + 轮换」：每次刷新都会 bump sessionVersion 并 revoke 旧会话，
 * 同一个已被拒的凭据再打一次只会继续 401。这里记住它，避免冷启动/后续请求反复 POST /auth/refresh。
 * 重新登录会写入新的 refreshToken，值不同即自动解除，无需显式重置。
 */
let rejectedRefreshToken: string | null = null;

/** 会话已收口为「必须重新登录」：不再尝试续期，也不再发注定 401 的业务请求 */
let sessionTerminated = false;

/**
 * 本轮 refresh 是否因「可重试原因」失败（网络错误 / 超时 / 5xx / 429），值是给用户看的提示文案。
 *
 * 为什么必须区分：refresh 失败分两类——
 * 1. 401：凭据无效（后端轮换后旧票必然被拒）→ 会话终态，清态 + 跳登录；
 * 2. 网络/超时/5xx/429：后端抖动，凭据本身还没被判定无效 → **不得**踢人下线。
 * 此时若照旧不带 token 继续发业务请求，后端必然回 401，又会被 401 分支当成会话失效把人踢掉
 * （弱网自杀）。所以这里记住"这次没换成"，让本次请求按可重试的网络错误失败，下次请求再续期。
 */
let refreshTransientFailure: string | null = null;

/**
 * 会话失效收口（终态，幂等）：清 token + profile + userRole → 明确跳登录页。
 * 冷启动/多并发下可能有多个请求同时发现会话失效，这里保证只清一次、只跳一次，
 * 不会留下「脏 profile + 卡在中间态」。
 */
function terminateSession(): void {
  sessionTerminated = true;
  clearAuthSession();
  redirectToLogin();
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  // 每次新的续期尝试先清「可重试失败」标记；只有本次真的失败才重新置上
  refreshTransientFailure = null;

  refreshInFlight = (async () => {
    const refreshToken = readRefreshToken();
    if (!refreshToken) {
      // 本地已无续期凭据：顺手清掉可能残留的脏 profile。
      // 此处不主动跳登录页——公开页（邀请落地/入驻填表）在未登录时也会发非 skipAuth 请求，
      // 主动跳会把它们误踢到登录页；真正的鉴权失败由业务 401 分支收口。
      clearAuthSession();
      return null;
    }

    if (refreshToken === rejectedRefreshToken) {
      // 该凭据本轮已被判定不可用：直接按「无会话」返回，不再打后端
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
          persistRefreshedSession(
            body.data.token,
            body.data.refreshToken,
            body.data.expiresIn || 7200,
          );
          rejectedRefreshToken = null;
          // 续期成功 ⇒ 会话恢复正常，解除上一次的收口标记
          sessionTerminated = false;
          return body.data.token;
        }
      }

      // 非 2xx：有一种「假失败」——并发的另一路刷新（如 services/auth-session.ts 的
      // refreshSessionForTenant）已用同一个 refreshToken 换到了新凭据，
      // 本轮 401 只是"输给了另一路"。此时本地 refreshToken 已变，直接复用新 access token。
      const latestRefreshToken = readRefreshToken();
      if (latestRefreshToken && latestRefreshToken !== refreshToken) {
        const latestAccessToken = readAccessToken();
        if (latestAccessToken) {
          return latestAccessToken;
        }
      }

      // 只有 401 才是「凭据无效」的终态：清态 + 跳登录
      if (res.statusCode === 401) {
        rejectedRefreshToken = refreshToken;
        logRequestIssue('refresh_fail', {
          path: '/auth/refresh',
          statusCode: res.statusCode,
          errMsg: 'refresh rejected',
        });
        terminateSession();
        return null;
      }

      // 5xx / 429 / 其它非 401：后端抖动，凭据未必失效 —— 不清会话、不跳登录，按可重试处理
      refreshTransientFailure =
        res.statusCode === 429 ? RATE_LIMIT_MESSAGE : '服务暂时不可用，请稍后重试';
      logRequestIssue('refresh_fail', {
        path: '/auth/refresh',
        statusCode: res.statusCode,
        errMsg: 'refresh temporarily failed',
      });
      return null;
    } catch (err) {
      // 网络错误 / 超时：与 5xx 同等对待，保留会话，下次请求仍有机会续期成功
      refreshTransientFailure = mapNetworkFailMessage(err);
      logRequestIssue('refresh_fail', {
        path: '/auth/refresh',
        errMsg: err instanceof Error ? err.message : String(err),
      });
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** 续期结果：供 services 层区分「必须重新登录」与「可重试失败」，避免两种失败用同一句文案 */
export type SessionRefreshOutcome =
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'rejected' | 'retryable' };

/**
 * 供 services 层（services/auth-session.ts 的 refreshSessionForTenant）复用的**强制**续期入口。
 *
 * - 与静默续期共用同一个 refreshInFlight（单飞）：同一时刻只会发出一次 POST /auth/refresh。
 *   后端 refresh 是「单次使用 + 轮换」，并发两次会让先到的那张新票立刻作废 → 用户被踢下线。
 * - 强制：不做「access 仍有效就跳过」的短路，入驻批准后必须重新换票才能拿到带新 organizationId 的 JWT。
 * - 不抛出：失败一律走返回值，调用方按 reason 决定文案与后续动作。
 */
export async function refreshSessionOnce(): Promise<SessionRefreshOutcome> {
  const accessToken = await refreshAccessToken();
  if (accessToken) {
    return { ok: true, accessToken };
  }
  return { ok: false, reason: sessionTerminated ? 'rejected' : 'retryable' };
}

async function resolveAccessToken(skipAuth: boolean): Promise<string | null> {
  if (skipAuth) {
    return null;
  }
  const current = readAccessToken();
  if (current) {
    // 有可用 access token ⇒ 会话正常（含重新登录后），解除上一次的收口标记
    sessionTerminated = false;
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

/**
 * GET 去重键：同 method + url + query 视为同一请求。
 * query 按键名排序，避免同参数不同书写顺序漏去重。
 */
function buildGetDedupeKey(
  url: string,
  data: Record<string, unknown> | undefined,
  skipAuth: boolean,
): string {
  const query = data
    ? Object.keys(data)
        .sort()
        .map((key) => `${key}=${String(data[key])}`)
        .join('&')
    : '';
  return `GET ${url}?${query}${skipAuth ? ' #anon' : ''}`;
}

/**
 * 核心请求函数
 *
 * GET 走 in-flight 去重：同一瞬间（同 method+url+query）的重复请求复用同一个 Promise。
 * 契约（与 utils/single-flight.ts 一致）：
 * - 只合并并发，响应返回即释放，不做跨页面长期缓存，下次调用照常发请求；
 * - 失败不驻留，后续重试照常有重新请求的机会；
 * - 仅 GET，PUT/POST/PATCH/DELETE 一律不去重。
 */
export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  if ((options.method ?? 'GET') === 'GET') {
    const key = buildGetDedupeKey(options.url, options.data, options.skipAuth === true);
    return singleFlight(key, () => performRequest<T>(options));
  }
  return performRequest<T>(options);
}

/** 实际发起请求（GET 去重与写请求共用） */
async function performRequest<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, skipAuth = false, timeout = TIMEOUT } = options;
  const startAt = Date.now();

  // 上一波 429 的退避窗口内，先等再发（/auth/* 除外，保证能重新登录与续期）
  await waitForRateLimitBackoff(url);

  // 注入 token（过期时尝试 refresh）
  if (!skipAuth) {
    const token = await resolveAccessToken(skipAuth);
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    } else if (sessionTerminated) {
      // 会话已收口为「必须重新登录」（已清态 + 已跳登录页）：
      // 不再把注定 401 的请求打到后端，避免冷启动一堆 /auth/me、/org-permissions 401 噪声
      throw new ApiError(401, '登录已过期，请重新登录');
    } else if (refreshTransientFailure) {
      // 有 refreshToken 但这次没换成（网络/超时/5xx/429）：会话仍有效，禁止踢人下线。
      // 也绝不能落到「不带 Authorization 发请求」——后端必然回 401，反而触发会话收口。
      throw new ApiError(-1, refreshTransientFailure);
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
            terminateSession();
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

    // 429：限流。不清登录态、不跳登录页，统一提示并退避
    if (res.statusCode === 429) {
      handleRateLimited(url);
      throw new ApiError(429, RATE_LIMIT_MESSAGE);
    }

    // 401：鉴权失败
    if (res.statusCode === 401) {
      const message = extractErrorMessage(res);
      if (skipAuth) {
        // password-login / register 等：后端已有「邮箱或密码错误」，勿改成「登录已过期」
        throw new ApiError(401, message || '邮箱或密码错误');
      }
      terminateSession();
      throw new ApiError(401, message?.includes('过期') ? message : '登录已过期，请重新登录');
    }

    // 统一解析后端错误消息（修复 422 等丢失 message 的问题）
    const gatewayMessage = mapGatewayErrorMessage(res.statusCode);
    const errorMessage = gatewayMessage ?? extractErrorMessage(res);
    if (res.statusCode >= 500) {
      logRequestIssue('http5xx', {
        path: url,
        statusCode: res.statusCode,
        errMsg: errorMessage,
      });
    }
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
    const errMsg = err instanceof Error ? err.message : String(err);
    const isTimeout = /timeout|超时/i.test(errMsg);
    logRequestIssue(isTimeout ? 'timeout' : 'network', {
      path: url,
      errMsg,
    });
    throw new ApiError(-1, mapNetworkFailMessage(err));
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
