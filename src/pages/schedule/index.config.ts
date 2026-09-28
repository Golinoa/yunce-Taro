export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTextStyle: 'white',
  usingComponents: {},
  /**
   * 下拉刷新。
   * 页面内容在**内层 ScrollView** 中滚动（班课/团课/场地三个视图各自带滚动容器），
   * 页面本身不滚动；与 `package-settings/pages/my-todos`、`package-student/pages/students`
   * 同一约定，都是「页面级 enablePullDownRefresh + 内层 ScrollView」。
   */
  enablePullDownRefresh: true,
});
