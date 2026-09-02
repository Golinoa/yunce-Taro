/**
 * runImageUploadFlow 测试
 *
 * 覆盖「选图 → 上传 → 反馈」流程的全部分支：
 * - 数量上限：不触发选图，提示上限
 * - 正常流程：选图 → 上传 → onSuccess(url)，uploading 状态正确变化
 * - 用户取消（ImageCancelError）：静默返回 false，无任何 toast
 * - 上传失败：toast「图片上传失败，请重试」，uploading 复位
 * - 选图阶段异常（非取消）：同样提示失败
 */
import { describe, expect, it, vi } from 'vitest';
import { ImageCancelError } from '@/utils/image-upload';
import { runImageUploadFlow, type UploadFlowOptions } from '@/utils/upload-flow';

function makeOptions(
  overrides: Partial<UploadFlowOptions> = {},
): Required<Pick<UploadFlowOptions, 'choose' | 'upload' | 'onSuccess' | 'toast'>> &
  UploadFlowOptions {
  return {
    currentCount: 0,
    maxCount: 3,
    choose: vi.fn().mockResolvedValue('wxfile://tmp/a.jpg'),
    upload: vi.fn().mockResolvedValue('https://cdn.example.com/a.jpg'),
    onSuccess: vi.fn(),
    toast: vi.fn(),
    ...overrides,
  };
}

describe('runImageUploadFlow', () => {
  it('达到数量上限：不触发选图，提示上限，返回 false', async () => {
    const options = makeOptions({ currentCount: 3, maxCount: 3 });

    const ok = await runImageUploadFlow(options);

    expect(ok).toBe(false);
    expect(options.choose).not.toHaveBeenCalled();
    expect(options.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '最多上传3张图片' }),
    );
  });

  it('正常流程：选图 → 上传 → onSuccess(url)，uploading 先 true 后 false，返回 true', async () => {
    const onUploadingChange = vi.fn();
    const options = makeOptions({ onUploadingChange, successToastTitle: '上传成功' });

    const ok = await runImageUploadFlow(options);

    expect(ok).toBe(true);
    expect(options.choose).toHaveBeenCalledTimes(1);
    expect(options.upload).toHaveBeenCalledWith('wxfile://tmp/a.jpg');
    expect(options.onSuccess).toHaveBeenCalledWith('https://cdn.example.com/a.jpg');
    expect(onUploadingChange).toHaveBeenNthCalledWith(1, true);
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    expect(options.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '上传成功', icon: 'success' }),
    );
  });

  it('未配置 successToastTitle 时成功不弹成功 toast', async () => {
    const options = makeOptions();

    const ok = await runImageUploadFlow(options);

    expect(ok).toBe(true);
    expect(options.toast).not.toHaveBeenCalled();
  });

  it('用户取消（ImageCancelError）：静默返回 false，无任何 toast', async () => {
    const options = makeOptions({ choose: vi.fn().mockRejectedValue(new ImageCancelError()) });

    const ok = await runImageUploadFlow(options);

    expect(ok).toBe(false);
    expect(options.upload).not.toHaveBeenCalled();
    expect(options.onSuccess).not.toHaveBeenCalled();
    expect(options.toast).not.toHaveBeenCalled();
  });

  it('上传失败：toast「图片上传失败，请重试」，uploading 复位，返回 false', async () => {
    const onUploadingChange = vi.fn();
    const options = makeOptions({
      upload: vi.fn().mockRejectedValue(new Error('network down')),
      onUploadingChange,
    });

    const ok = await runImageUploadFlow(options);

    expect(ok).toBe(false);
    expect(options.onSuccess).not.toHaveBeenCalled();
    expect(options.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '图片上传失败，请重试' }),
    );
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);
  });

  it('选图阶段异常（非取消）：提示失败，不进入上传', async () => {
    const options = makeOptions({ choose: vi.fn().mockRejectedValue(new Error('隐私拒绝')) });

    const ok = await runImageUploadFlow(options);

    expect(ok).toBe(false);
    expect(options.upload).not.toHaveBeenCalled();
    expect(options.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '图片上传失败，请重试' }),
    );
  });
});
