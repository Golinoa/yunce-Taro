/**
 * Service 层 — 文件上传 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 Taro.uploadFile 调用
 */
import Taro from '@tarojs/taro';

/** 上传结果 */
export interface UploadResult {
  /** 文件访问 URL */
  url: string;
  /** 文件名 */
  filename: string;
}

// 与 src/utils/request.ts 保持一致的 mock 开关口径
const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
const RAW_BASE_URL =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.TARO_API_BASE_URL || '/api/app/v1'
    : '/api/app/v1';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

/** 获取存储的 token（与 request.ts 保持一致） */
function getToken(): string | null {
  try {
    const raw = Taro.getStorageSync(AUTH_TOKEN_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const expiresAt = Number(session.expires_at ?? 0);
    if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) {
      return null;
    }
    return session.access_token || null;
  } catch {
    return null;
  }
}

/** mock 上传：返回固定占位 URL */
async function mockUploadFile(_filePath: string, filename: string): Promise<UploadResult> {
  // 模拟网络延迟
  await new Promise((r) => setTimeout(r, 500));
  return {
    url: `https://cdn.yunce.app/mock/${Date.now()}-${filename}`,
    filename,
  };
}

export const uploadService = {
  /**
   * 上传单个文件
   * mock 模式返回占位 URL；真实模式调用 /upload 接口
   * 失败时抛出错误，由调用方处理提示
   */
  upload: (filePath: string, filename?: string): Promise<UploadResult> => {
    const name = filename || filePath.split('/').pop() || 'unknown.jpg';

    if (USE_MOCK) {
      return mockUploadFile(filePath, name);
    }

    // 真实接口：联调时启用
    return new Promise<UploadResult>((resolve, reject) => {
      const token = getToken();
      Taro.uploadFile({
        url: `${BASE_URL}/upload`,
        filePath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`上传失败（${res.statusCode}）`));
            return;
          }
          try {
            const data = JSON.parse(res.data) as { url?: string; data?: { url?: string } };
            // 兼容两种返回结构：直接返回 { url } 或 { data: { url } }
            const url = data.url || data.data?.url;
            if (!url) {
              reject(new Error('上传响应缺少 url 字段'));
              return;
            }
            resolve({ url, filename: name });
          } catch {
            reject(new Error('上传响应解析失败'));
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '上传请求失败'));
        },
      });
    });
  },

  /**
   * 批量上传多个文件
   * 任一文件失败则整体抛错，由调用方决定是否部分保留
   */
  uploadBatch: async (filePaths: string[]): Promise<UploadResult[]> => {
    const results = await Promise.all(filePaths.map((fp) => uploadService.upload(fp)));
    return results;
  },
};
