---
last_updated: 2026-09-12
status: active
---

# 路由、生命周期与页面配置

## 页面生命周期（Taro Hooks，禁止 class 生命周期）

| Hook | 触发时机 | 用途 |
| --- | --- | --- |
| `useLoad(fn)` | 页面首次加载 | 初始化数据、读取路由参数 |
| `useDidShow(fn)` | 页面显示（含返回） | 刷新数据、重置状态 |
| `useDidHide(fn)` | 页面隐藏 | 暂停轮询等 |
| `usePullDownRefresh(fn)` | 下拉刷新 | 刷新列表数据 |
| `useReachBottom(fn)` | 触底 | 加载更多 |
| `useUnload(fn)` | 页面卸载 | 清理资源 |

❌ `componentDidMount` / `componentWillUnmount` / `<View onLoad={...}>`
✅ 一律用上述 Taro Hooks。

## 路由跳转

```typescript
import Taro from '@tarojs/taro';

Taro.navigateTo({ url: '/pages/teacher-detail/index?id=123' }); // 普通页面
Taro.switchTab({ url: '/pages/home/index' });                  // TabBar 页面
Taro.redirectTo({ url: '/pages/login/index' });                // 替换当前页
Taro.navigateBack({ delta: 1 });                               // 返回
```

- 跨分包跳转用正确路径；Tab 页必须 `switchTab`，非 Tab 用 `navigateTo` / `redirectTo`。
- 路由参数在 `useLoad((options) => { const id = options?.id; })` 中取。

## 路由守卫

需要登录的页面用 `withRouteGuard` 包裹：

```tsx
import { withRouteGuard } from '@/utils/route-guard';

const TeacherList: React.FC = () => { ... };
export default withRouteGuard(TeacherList);
```

## 页面配置（index.config.ts）

```typescript
export default definePageConfig({
  navigationBarTitleText: '页面标题',
  navigationBarBackgroundColor: '#5EC8A8', // 或 '#FAFDFB'
  navigationBarTextStyle: 'white',          // 或 'black'
});
```

| 页面类型 | 导航栏背景 | 导航栏文字 |
| --- | --- | --- |
| 首页 / 主 TabBar 页 | `#5EC8A8` | `white` |
| 列表页 / 详情页 / 表单页 | `#FAFDFB` | `black` |

## 路由与分包

- 页面路由统一在 `src/app.config.ts` 注册，分包 `subPackages` 配置。
- 分包：`package-auth` / `package-student` / `package-teacher` / `package-course` / `package-settings` / `package-statistics` / `package-lead`。
- **主包只放 4 个 Tab 页**：`home`（首页）/ `schedule`（课表）/ `statistics`（数据）/ `profile`（我的）+ 启动必需页面。
- 新页面归属哪个包按业务模块定，**避免主包膨胀**（主包体积约束见 `rules/70-wechat-platform.md`）。

## 页面文件约定

```
pages/page-name/
├── index.tsx          # 页面组件（默认导出）
└── index.config.ts    # 页面配置（navigationBarTitleText、enablePullDownRefresh、disableScroll 等）
```

- 页面目录 kebab-case；页面组件统一 `index.tsx`。
- 业务分包页面同样 `index.tsx` + `index.config.ts` 结构。
- 页面 config 可设 `disableScroll: true`（弹层页面防滚动穿透）。

## 生命周期与数据加载

- 首屏数据走 `useLoad` / `useShow`（Taro hooks），Tab 页用 `useShow` 做回前台刷新。
- 数据一律来自 `@/services`（唯一出口），页面不直接调 mock、不硬编码。
- 列表加载注意 `scroll-into-view` / ScrollView 交互铁律，见 `rules/90-scroll-interaction.md`。

## TabBar

- TabBar 图标放 `assets/icons/`，配置在 `app.config.ts` 的 `tabBar.list`。
- 新增 Tab 图标需同步处理主包图片白名单（体积优化见 `rules/70-wechat-platform.md`）。
