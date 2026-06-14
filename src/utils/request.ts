/**
 * 请求工具层
 * 封装 Taro.request，统一处理 token、错误码、超时等
 * 联调时只需修改 BASE_URL 和拦截器逻辑
 */
import Taro from '@tarojs/taro';

const BASE_URL = ''; // 联调时改为后端地址，如 'https://api.example.com/v1'
const TIMEOUT = 10000;
const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';

/** API 统一响应格式 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

/** 获取存储的 token */
function getToken(): string | null {
  try {
    const raw = Taro.getStorageSync(AUTH_TOKEN_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // 检查过期
    if (session.expires_at * 1000 < Date.now()) return null;
    return session.access_token || null;
  } catch {
    return null;
  }
}

/** 请求配置 */
interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, unknown>;
  header?: Record<string, string>;
  /** 是否跳过自动 token 注入 */
  skipAuth?: boolean;
}

/** 核心请求函数 */
export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, skipAuth = false } = options;

  // 注入 token
  if (!skipAuth) {
    const token = getToken();
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const res = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header,
      },
      timeout: TIMEOUT,
    });

    // HTTP 状态码检查
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // 如果后端返回 { code, data, message } 格式
      if (res.data && typeof res.data === 'object' && 'code' in res.data) {
        const body = res.data as ApiResponse<T>;
        if (body.code === 0 || body.code === 200) {
          return body.data;
        }
        throw new ApiError(body.code, body.message);
      }
      // 直接返回数据
      return res.data as T;
    }

    // 401 未授权 → 跳转登录
    if (res.statusCode === 401) {
      Taro.removeStorageSync(AUTH_TOKEN_KEY);
      Taro.redirectTo({ url: '/pages/login/index' });
      throw new ApiError(401, '登录已过期，请重新登录');
    }

    throw new ApiError(res.statusCode, `请求失败 (${res.statusCode})`);
  } catch (err) {
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

/** GET 请求 */
export function get<T = unknown>(url: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>({ url, method: 'GET', data: params });
}

/** POST 请求 */
export function post<T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ url, method: 'POST', data });
}

/** PUT 请求 */
export function put<T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ url, method: 'PUT', data });
}

/** DELETE 请求 */
export function del<T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ url, method: 'DELETE', data });
}
