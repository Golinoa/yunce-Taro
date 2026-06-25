# [OPEN] principal-login-freeze

## 背景

- 症状 1：使用校长身份登录后看不到任何 mock 数据
- 症状 2：微信开发者工具提示“模拟器长时间没有响应”，怀疑存在复杂运算、频繁重渲染或死循环

## 初始假设

1. 校长身份进入的页面数据加载条件判断有误，导致 principal 角色没有命中 mock 查询分支，所以页面显示为空。
2. `useEffect` / `useDidShow` / Zustand store action 之间形成重复触发链，导致页面不断请求或不断 setState，引发模拟器卡死。
3. 路由守卫、登录态恢复或身份切换逻辑把校长身份重定向到错误页面，或持续重复导航，造成“无数据 + 假死”。
4. 首页或统计页对校长身份复用了教师/家长分支中的不兼容数据结构，运行时异常被吞掉后表现为空白。
5. Mock 数据本身存在 principal 角色缺失、组织/校区上下文缺失或 store 初始化失败，导致后续链路无法取到可展示数据。

## 调试原则

- 第一步只做证据收集，不修改业务逻辑
- 首个逻辑改动只能是插桩
- 在确认根因前不做猜测式修复

## 当前状态

- 会话已创建，准备检查静态链路并添加最小运行时插桩

## 已完成的证据收集

- 已启动调试服务，环境文件为 `.dbg/principal-login-freeze.env`
- 已在以下链路加入最小插桩：
  - `src/utils/auth.tsx`
  - `src/utils/route-guard.tsx`
  - `src/pages/home/index.tsx`
  - `src/pages/statistics/useStatistics.ts`

## 静态检查发现

- 首页 `src/pages/home/index.tsx` 会把 `principal` 视为 staff，但其数据入口仍先调用 `homeService.getTeacher(profile.id)`，需要确认 principal 是否稳定返回聚合数据。
- `npm run typecheck` 失败，当前仓库存在大量历史类型错误，不适合作为“运行稳定”的证据来源。
- 初次 `$env:VITE_USE_MOCK='true'; npm run build:weapp` 失败，直接阻断编译：
  - `src/data/students.ts` 中 `mockGetClassById` 被重复声明两次。

## 已实施修复

- 删除 `src/data/students.ts` 中重复的 `mockGetClassById` 声明。
- 修复后重新执行 `$env:VITE_USE_MOCK='true'; npm run build:weapp`，编译成功，`dist/app.json` 已生成。
- 根据用户提供的运行时堆栈，定位到小程序环境启动时报 `ReferenceError: process is not defined`。
- 已对以下文件增加小程序兼容保护：
  - `src/utils/logger.ts`
  - `src/utils/request.ts`
- 已删除旧 `dist` 并重新执行 Mock 模式编译，当前编译成功。

## 下一步

- 由用户在微信开发者工具复现“校长登录后无数据 / 模拟器卡住”。
- 读取 Debug Server 采集到的日志，确认是：
  - 路由重复跳转
  - 首页 loadData 提前返回
  - 统计页反复刷新
  - 其他渲染热点
