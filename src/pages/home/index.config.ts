export default definePageConfig({
  // 使用自定义导航栏，隐藏原生标题并将内容整体上移
  navigationStyle: 'custom',
  navigationBarTextStyle: 'white',
  /** 禁止页面级滚动，只走内部 ScrollView，避免弹层/输入时整页被系统推走 */
  disableScroll: true,
  /** 自定义 TabBar 必需 */
  usingComponents: {},
});
