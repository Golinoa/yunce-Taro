export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTextStyle: 'white',
  // 禁用页面整体滚动，防止外层 PageContainer 的 padding-bottom
  // 在 navigateTo（非 tabBar）页面产生垂直滚动，从而消费 Swiper 的水平滑动手势。
  // 排课页是 tabBar 页面，小程序对 tabBar 页面有特殊滚动处理，因此无需此项。
  disableScroll: true,
});
