/**
 * 表单「未保存离开确认」：基于微信 wx.enableAlertBeforeUnload（基础库 2.12.0+）。
 * 开启后，用户点左上角返回或触发 navigateBack 时，系统会弹「是否离开」确认框；
 * 关闭则直接退出。能力不可用（如开发者工具模拟器）时静默降级，不影响退出。
 */
export function setLeaveGuard(enabled: boolean): void {
  const wxObj = (globalThis as { wx?: Record<string, unknown> }).wx;
  if (!wxObj) return;
  try {
    if (enabled && typeof wxObj.enableAlertBeforeUnload === 'function') {
      (wxObj.enableAlertBeforeUnload as (opt: { message: string }) => void)({
        message: '有未保存的修改，退出将丢失',
      });
    } else if (!enabled && typeof wxObj.disableAlertBeforeUnload === 'function') {
      (wxObj.disableAlertBeforeUnload as () => void)();
    }
  } catch {
    /* 静默 */
  }
}
