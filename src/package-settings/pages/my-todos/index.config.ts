export default definePageConfig({
  navigationStyle: 'custom',
  enablePullDownRefresh: true,
  /** 禁止页面级滚动，只走列表 ScrollView，避免点卡片开弹层时整页被系统推走 */
  disableScroll: true,
});
