/**
 * 新增保存成功后的统一收尾（场地 / 员工 / 学员三条链路共用）
 *
 * 背景（2026-09-25 修复）——三条新增链路此前各自为政，暴露两个缺陷：
 * 1. **成功提示被自己抹掉**：员工与学员在 showToast 之后紧接着调 `Taro.hideToast()`，
 *    用户完全看不到「添加成功 / 学员已创建」。（原意是怕 toast 挡住后续 modal，
 *    但 hideToast 的时机选在了 toast 刚弹出时，等于白弹。）
 * 2. **跳转被可挂起的副作用卡住**：`await subscribeMessageService.runFlow(...)` 被放在
 *    「提示」与「跳转」之间。`runFlow → openPrompt`（stores/subscribe-auth.ts）返回的
 *    Promise **只在用户点击订阅弹框时才 resolve**，一旦不 resolve，后面的弹窗与跳转
 *    永远不会执行 —— 这就是「新增成功却没有跳转」的成因。
 *
 * 因此统一时序固定为：
 *   成功 toast（完整播完 1500ms）→ 询问是否继续新增 → 继续（重置表单留在本页）/ 返回列表
 *
 * 使用约定：
 * - **不要**在 showToast 之后自己调 hideToast，交给 `askContinueCreate` 在 toast 播完后处理；
 * - 订阅授权等非阻断副作用请改为 `void runFlow(...)` fire-and-forget，**不要 await**，
 *   否则又会把跳转卡住。
 */
import Taro from '@tarojs/taro';

/** 与 Taro.showToast 默认时长一致：让成功提示完整播完再弹窗 */
export const SUCCESS_TOAST_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 等成功提示播完，再询问「是否继续新增」。
 *
 * 两个都不能省的细节：
 * - 不能在 showToast 之后立刻 hideToast 或立刻 showModal（前者让提示不可见，
 *   后者在微信下可能因 toast 未消失而弹不出来）；
 * - 所以先等 toast 自然播完，再 hide 一次兜底，最后才弹 modal。
 *
 * @param subject 业务主体名词，用于拼文案。如「学员」→「学员已保存 / 是否继续新增学员？」
 * @returns true = 继续新增（调用方重置表单并留在本页）；false = 返回列表
 */
export async function askContinueCreate(subject: string): Promise<boolean> {
  await delay(SUCCESS_TOAST_MS);
  Taro.hideToast();
  const { confirm } = await Taro.showModal({
    title: `${subject}已保存`,
    content: `是否继续新增${subject}？`,
    confirmText: '继续新增',
    cancelText: '返回列表',
  });
  return confirm;
}

/**
 * 精确回到页面栈里的目标列表页。
 *
 * 表单只可能由列表页经 navigateTo 压入，按页面栈算出到列表页的距离 delta，
 * 一次退掉所有叠加的表单层（防慢速双击叠层时只退一层、露出底层同款表单）；
 * 栈内无列表页（深链直达）才 redirectTo 兜底。
 *
 * @param listPath 不带前导斜杠的页面路径，如 'package-settings/pages/venue-list/index'
 */
export function backToListPage(listPath: string): void {
  const pages = Taro.getCurrentPages();
  let delta = 0;
  for (let i = pages.length - 2; i >= 0; i--) {
    const route = (pages[i] as { route?: string } | undefined)?.route || '';
    if (route.includes(listPath)) {
      delta = pages.length - 1 - i;
      break;
    }
  }
  if (delta > 0) {
    Taro.navigateBack({ delta });
  } else {
    Taro.redirectTo({ url: `/${listPath}` });
  }
}
