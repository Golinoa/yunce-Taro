import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCancelError, chooseImageTemp } from '@/utils/image-upload';
import { ensurePrivacyAuthorized } from '@/utils/privacy-authorize';

vi.mock('@/utils/privacy-authorize', () => ({
  ensurePrivacyAuthorized: vi.fn(),
}));

function stubWeappFileApis(): void {
  (Taro as unknown as { chooseMedia: typeof Taro.chooseMedia }).chooseMedia = vi
    .fn()
    .mockResolvedValue({
      tempFiles: [{ tempFilePath: 'wxfile://tmp/test.jpg', size: 1024 }],
    } as never);
  (Taro as unknown as { getImageInfo: typeof Taro.getImageInfo }).getImageInfo = vi
    .fn()
    .mockResolvedValue({ width: 100, height: 100 } as never);
  (Taro as unknown as { env: { USER_DATA_PATH: string } }).env = {
    USER_DATA_PATH: 'wxfile://usr',
  };
  (
    Taro as unknown as { getFileSystemManager: typeof Taro.getFileSystemManager }
  ).getFileSystemManager = vi.fn().mockReturnValue({
    mkdir: ({ success }: { success?: () => void }) => success?.(),
    copyFile: ({ success }: { success?: () => void }) => success?.(),
  });
}

describe('chooseImageTemp privacy gate', () => {
  beforeEach(() => {
    vi.mocked(ensurePrivacyAuthorized).mockReset();
    vi.mocked(ensurePrivacyAuthorized).mockResolvedValue(undefined);
    vi.stubEnv('TARO_ENV', 'weapp');
    stubWeappFileApis();
  });

  it('weapp 下 chooseMedia 前先 ensurePrivacyAuthorized', async () => {
    await chooseImageTemp();

    expect(ensurePrivacyAuthorized).toHaveBeenCalledTimes(1);
    expect(Taro.chooseMedia).toHaveBeenCalled();
  });

  it('隐私拒绝时抛错且不调用 chooseMedia', async () => {
    vi.mocked(ensurePrivacyAuthorized).mockRejectedValue(
      new Error('需要同意隐私保护指引后才能从相册选择'),
    );
    const chooseMediaMock = vi.mocked(Taro.chooseMedia);

    await expect(chooseImageTemp()).rejects.toThrow('需要同意隐私保护指引后才能从相册选择');
    expect(chooseMediaMock).not.toHaveBeenCalled();
  });

  it('用户取消选图仍抛 ImageCancelError', async () => {
    (Taro as unknown as { chooseMedia: typeof Taro.chooseMedia }).chooseMedia = vi
      .fn()
      .mockRejectedValue({ errMsg: 'chooseMedia:fail cancel' });

    await expect(chooseImageTemp()).rejects.toBeInstanceOf(ImageCancelError);
  });
});

describe('stabilizeAvatarLocalPath', () => {
  beforeEach(() => {
    vi.stubEnv('TARO_ENV', 'weapp');
    stubWeappFileApis();
    (Taro as unknown as { getFileInfo: typeof Taro.getFileInfo }).getFileInfo = vi
      .fn()
      .mockResolvedValue({ size: 1024 } as never);
  });

  it('持久化 chooseAvatar 返回的临时路径', async () => {
    const { stabilizeAvatarLocalPath } = await import('@/utils/image-upload');
    const path = await stabilizeAvatarLocalPath('wxfile://tmp/avatar.jpg');
    expect(path).toContain('wxfile://usr');
  });

  it('空路径抛 ImageCancelError', async () => {
    const { stabilizeAvatarLocalPath } = await import('@/utils/image-upload');
    await expect(stabilizeAvatarLocalPath('')).rejects.toBeInstanceOf(ImageCancelError);
  });
});
