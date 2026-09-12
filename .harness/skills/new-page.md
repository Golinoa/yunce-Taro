---
last_updated: 2026-09-12
status: active
---

# Skill: 新增页面

## 前置

- [ ] 读 `.harness/rules/00-core-stack.md`
- [ ] 涉及角色 / 权限 → 先读 `.harness/rules/60-role-identity.md`
- [ ] 确认该页面该进主包还是分包（`.harness/rules/70-wechat-platform.md`）

## 步骤

1. **建目录** `src/pages/page-name/`（kebab-case）
2. **写 `index.config.ts`**

   ```ts
   export default definePageConfig({
     navigationBarTitleText: '页面标题',
     navigationBarBackgroundColor: '#FAFDFB', // 主 Tab 页用 #5EC8A8
     navigationBarTextStyle: 'black',          // 主 Tab 页用 white
   });
   ```

   需要下拉刷新时加 `enablePullDownRefresh: true`。

3. **写 `index.tsx`**（固定骨架）

   ```tsx
   import React, { useState, useCallback } from 'react';
   import { View } from '@tarojs/components';
   import { useLoad, useDidShow } from '@tarojs/taro';
   import PageContainer from '@/components/PageContainer';
   import { xxxService } from '@/services';

   /**
    * PageName - 一句话说明
    * 使用场景：从哪里进入
    */
   const PageName: React.FC = () => {
     const [data, setData] = useState<Xxx[]>([]);
     const [loading, setLoading] = useState(true);

     useLoad((options) => { /* 初始化、读路由参数 */ });
     useDidShow(() => { /* 刷新数据 */ });

     const fetchData = useCallback(async () => {
       setLoading(true);
       try {
         setData(await xxxService.getList());
       } finally {
         setLoading(false);
       }
     }, []);

     return (
       <PageContainer title="页面标题" loading={loading}>
         <View className="p-4">{/* 内容 */}</View>
       </PageContainer>
     );
   };

   export default PageName;
   ```

4. **注册路由**：`src/app.config.ts` 的 `pages` 数组；Tab 页还要加 `tabBar.list`
5. **需要登录**：`export default withRouteGuard(PageName)`
6. **样式**：只用 UnoCSS 原子类 + Token + rpx
7. **验证**：转 `verify-build.md`

## 生命周期对照

| Hook | 用途 |
| --- | --- |
| `useLoad` | 首次加载、读路由参数 |
| `useDidShow` | 页面显示（含返回）刷新数据 |
| `useDidHide` | 暂停轮询等 |
| `usePullDownRefresh` | 下拉刷新（记得 `Taro.stopPullDownRefresh()`） |
| `useReachBottom` | 触底加载 |
| `useUnload` | 清理资源 |

禁止 class 组件生命周期，禁止 `<View onLoad={...} />`。
