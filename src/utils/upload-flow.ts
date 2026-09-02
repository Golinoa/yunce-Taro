/**
 * 图片上传流程统一封装（B-01/L-03）
 *
 * 背景：lesson-form 与 feedback 原先各自使用已废弃的选图 API，且
 * lesson-form 的 catch 块完全静默（上传失败无任何提示）。
 *
 * 本模块将「选图 → 上传 → 反馈」流程收敛为一个可注入依赖的纯函数：
 * - 数量上限：提示「最多上传 N 张图片」并直接返回 false，不触发选图
 * - 用户取消（ImageCancelError）：静默返回 false，不打扰用户
 * - 上传失败：统一提示「图片上传失败，请重试」
 * - 成功：onSuccess(url)，可选成功 toast
 *
 * 依赖（choose/upload/toast/onSuccess）由调用方注入，便于 vitest 单测
 * 覆盖全部分支；页面内仅需配置业务差异（来源裁剪比例、上传类型、数量）。
 */
import Taro from '@tarojs/taro';
import { isImageCancelError } from '@/utils/image-upload';

/** toast 入参（与 Taro.showToast 对齐的子集） */
export interface UploadFlowToastOptions {
  title: string;
  icon?: 'none' | 'success';
}

/** 上传流程依赖配置 */
export interface UploadFlowOptions {
  /** 当前已选图片数量（用于上限校验） */
  currentCount: number;
  /** 允许的最大图片数量 */
  maxCount: number;
  /** 选图函数：返回本地文件路径；用户取消时抛 ImageCancelError */
  choose: () => Promise<string>;
  /** 上传函数：本地路径 → 线上 URL */
  upload: (path: string) => Promise<string>;
  /** 成功回调（接收线上 URL） */
  onSuccess: (url: string) => void;
  /** 上传中状态回调（可选） */
  onUploadingChange?: (uploading: boolean) => void;
  /** toast 提示（可选；默认走 Taro.showToast，测试时注入 spy） */
  toast?: (options: UploadFlowToastOptions) => void;
  /** 成功 toast 文案；不配置则成功时不弹 toast */
  successToastTitle?: string;
}

/**
 * 执行一次完整的「选图 → 上传 → 反馈」流程。
 *
 * @returns 是否上传成功（false = 上限/取消/失败）
 */
export async function runImageUploadFlow(options: UploadFlowOptions): Promise<boolean> {
  const {
    currentCount,
    maxCount,
    choose,
    upload,
    onSuccess,
    onUploadingChange,
    toast,
    successToastTitle,
  } = options;
  const showToast: (opts: UploadFlowToastOptions) => void =
    toast ?? ((opts) => Taro.showToast({ icon: 'none', ...opts }));

  if (currentCount >= maxCount) {
    showToast({ title: `最多上传${maxCount}张图片` });
    return false;
  }

  let path: string;
  try {
    path = await choose();
  } catch (err) {
    // 用户取消：静默（替代原先的 tempFilePath 判断法）
    if (isImageCancelError(err)) {
      return false;
    }
    // 选图阶段异常（隐私拒绝等）：同样提示失败，避免无声无息
    showToast({ title: '图片上传失败，请重试' });
    return false;
  }

  onUploadingChange?.(true);
  try {
    const url = await upload(path);
    onSuccess(url);
    if (successToastTitle) {
      showToast({ title: successToastTitle, icon: 'success' });
    }
    return true;
  } catch {
    showToast({ title: '图片上传失败，请重试' });
    return false;
  } finally {
    onUploadingChange?.(false);
  }
}
