import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadService } from '@/services/upload';
import { post } from '@/utils/request';

vi.mock('@/utils/request', () => ({
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

const mockedPost = vi.mocked(post);
const uploadFileMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(Taro, { uploadFile: uploadFileMock });
});

describe('uploadService', () => {
  it('真实模式：先拿 token 再直传七牛', async () => {
    mockedPost.mockResolvedValue({
      token: 'qiniu-token',
      uploadUrl: 'https://upload.qiniup.com',
      domain: 'https://res.example.com',
      bucket: 'yunce-prod',
      prefix: 'avatar/',
      key: 'avatar/20260827/abcd_avatar.jpg',
      url: 'https://res.example.com/avatar/20260827/abcd_avatar.jpg',
    });

    uploadFileMock.mockImplementation((options) => {
      expect(options.url).toBe('https://upload.qiniup.com');
      expect(options.filePath).toBe('wxfile://tmp/photo.jpg');
      expect(options.formData).toEqual({
        token: 'qiniu-token',
        key: 'avatar/20260827/abcd_avatar.jpg',
      });
      options.success?.({
        statusCode: 200,
        data: JSON.stringify({ key: 'avatar/20260827/abcd_avatar.jpg' }),
        errMsg: 'uploadFile:ok',
      });
      return { abort: vi.fn() };
    });

    const result = await uploadService.upload('wxfile://tmp/photo.jpg', {
      type: 'avatar',
      filename: 'photo.jpg',
    });

    expect(mockedPost).toHaveBeenCalledWith('/upload/token', {
      type: 'avatar',
      filename: 'photo.jpg',
    });
    expect(result.url).toBe('https://res.example.com/avatar/20260827/abcd_avatar.jpg');
    expect(result.filename).toBe('photo.jpg');
  });

  it('七牛上传证书错误时给出可读提示', async () => {
    mockedPost.mockResolvedValue({
      token: 'qiniu-token',
      uploadUrl: 'https://upload.qiniup.com',
      domain: 'https://res.example.com',
      bucket: 'yunce-prod',
      prefix: 'avatar/',
      key: 'avatar/20260827/abcd_avatar.jpg',
      url: 'https://res.example.com/avatar/20260827/abcd_avatar.jpg',
    });

    uploadFileMock.mockImplementation((options) => {
      options.fail?.({ errMsg: 'uploadFile:fail net::ERR_CERT_COMMON_NAME_INVALID' });
      return { abort: vi.fn() };
    });

    await expect(uploadService.upload('wxfile://tmp/a.jpg')).rejects.toThrow('upload.qiniup.com');
  });

  it('七牛上传失败时抛出错误', async () => {
    mockedPost.mockResolvedValue({
      token: 'qiniu-token',
      uploadUrl: 'https://upload.qiniup.com',
      domain: 'https://res.example.com',
      bucket: 'yunce-prod',
      prefix: 'common/',
      key: 'common/20260827/abcd_file.jpg',
      url: 'https://res.example.com/common/20260827/abcd_file.jpg',
    });

    uploadFileMock.mockImplementation((options) => {
      options.fail?.({ errMsg: 'uploadFile:fail network error' });
      return { abort: vi.fn() };
    });

    await expect(uploadService.upload('wxfile://tmp/a.jpg')).rejects.toThrow('network error');
  });
});
