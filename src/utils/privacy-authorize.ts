/**
 * 调用相册 / 摄像头等隐私接口前，确保用户已同意小程序隐私指引。
 * 与 App 级 PrivacyPopup（onNeedPrivacyAuthorization）共用同一套同意态：
 * requirePrivacyAuthorize 会触发监听 → 弹窗 → 用户点同意后本 Promise resolve。
 */
import Taro from '@tarojs/taro';

export async function ensurePrivacyAuthorized(): Promise<void> {
  if (process.env.TARO_ENV !== 'weapp') return;

  const requirePrivacyAuthorize = (
    Taro as typeof Taro & {
      requirePrivacyAuthorize?: (opt: {
        success?: () => void;
        fail?: (err: { errMsg?: string }) => void;
      }) => void;
    }
  ).requirePrivacyAuthorize;

  if (typeof requirePrivacyAuthorize !== 'function') {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    requirePrivacyAuthorize({
      success: () => resolve(),
      fail: (err) => {
        const msg = err?.errMsg || '';
        if (/cancel|disagree|拒绝|不同意/i.test(msg)) {
          reject(new Error('需要同意隐私保护指引后才能从相册选择'));
          return;
        }
        // 未配置隐私指引等环境问题：不阻断选图（开发者工具常见），交由 chooseMedia 自身报错
        resolve();
      },
    });
  });
}
