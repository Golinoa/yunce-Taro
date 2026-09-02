export default definePageConfig({
  navigationBarTitleText: '新增课程',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
  // 禁用页面原生滚动，防止 PageContainer 的 min-h-screen + 安全区/底部留白
  // 产生竖向原生滚动；弹窗(BottomSheet 用 position:fixed)开合时会触发微信
  // 「fixed 元素切换导致原生页面滚动位置重置到顶部」的 BUG。
  // 本页内容滚动由内部 ScrollView(flex-1，在 h-screen flex-col overflow-hidden 容器内) 承载，不受此开关影响。
  // 注意：PageContainer 不再传 safeBottom，避免 pb-safe-bottom 给外层容器增加
  // 额外高度导致 navigateTo 页面出现原生滚动条/ScrollView 鼠标滚轮失效。
  disableScroll: true,
});
