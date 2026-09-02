/**
 * Service 层 — 文件上传 API
 *
 * Mock：返回本地路径，不走七牛。
 * 真实：POST /upload/token 拿凭证 → 直传七牛 → 返回 CDN url。
 */
import Taro from '@tarojs/taro';
import { post } from '@/utils/request';

/** 与后端 upload-token 一致的类型 */
export type UploadType = 'avatar' | 'venue' | 'course' | 'courseware' | 'common';

export interface UploadOptions {
  /** 上传类型，决定七牛 key 前缀与大小限制 */
  type?: UploadType;
  /** 原始文件名，用于生成可读 key */
  filename?: string;
}

/** 上传结果 */
export interface UploadResult {
  /** 文件访问 URL */
  url: string;
  /** 文件名 */
  filename: string;
}

interface UploadTokenPayload {
  token: string;
  uploadUrl: string;
  domain: string;
  bucket: string;
  prefix: string;
  key: string;
  url: string;
}

function resolveFilename(filePath: string, filename?: string): string {
  return filename || filePath.split('/').pop() || 'unknown.jpg';
}

async function fetchUploadToken(type: UploadType, filename: string): Promise<UploadTokenPayload> {
  return post<UploadTokenPayload>('/upload/token', { type, filename });
}

/** 直传七牛；成功后的访问地址以 token 响应中的 url 为准 */
function uploadToQiniu(
  filePath: string,
  payload: UploadTokenPayload,
  filename: string,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    Taro.uploadFile({
      url: payload.uploadUrl,
      filePath,
      name: 'file',
      formData: {
        token: payload.token,
        key: payload.key,
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let message = `七牛上传失败（${res.statusCode}）`;
          try {
            const body = JSON.parse(res.data) as { error?: string };
            if (body.error) {
              message = body.error;
            }
          } catch {
            /* 忽略解析失败 */
          }
          reject(new Error(message));
          return;
        }
        resolve({ url: payload.url, filename });
      },
      fail: (err) => {
        const raw = err.errMsg || '七牛上传请求失败';
        if (/ERR_CERT|certificate|证书|COMMON_NAME/i.test(raw)) {
          reject(
            new Error(
              '头像上传失败：七牛上传域名证书校验未通过，请确认微信后台 uploadFile 已配置 upload.qiniup.com',
            ),
          );
          return;
        }
        reject(new Error(raw));
      },
    });
  });
}

async function realUploadFile(
  filePath: string,
  type: UploadType,
  filename: string,
): Promise<UploadResult> {
  const tokenPayload = await fetchUploadToken(type, filename);
  return uploadToQiniu(filePath, tokenPayload, filename);
}

export const uploadService = {
  /**
   * 上传单个文件
   * mock 模式返回本地路径；真实模式走 token + 七牛直传
   */
  upload: (filePath: string, options: UploadOptions = {}): Promise<UploadResult> => {
    const type = options.type ?? 'common';
    const filename = resolveFilename(filePath, options.filename);
    return realUploadFile(filePath, type, filename);
  },

  /**
   * 批量上传多个文件
   * 任一文件失败则整体抛错，由调用方决定是否部分保留
   */
  uploadBatch: (filePaths: string[], options: UploadOptions = {}): Promise<UploadResult[]> => {
    return Promise.all(filePaths.map((fp) => uploadService.upload(fp, options)));
  },
};
