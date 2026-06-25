# [OPEN] Debug Session: page-slow-nav

## Symptom
- 微信小程序页面点击后整体进入偏慢。
- 全量页面功能基本正常，但偶发 `navigateTo:fail timeout`。
- 用户反馈是“全部点了一遍没有功能问题，但存在性能问题，加载进入页面太慢”。

## Hypotheses
- H1: 目标页面初始化存在过长异步链路，导致页面切换超时。
- H2: 页面进入时存在重复加载或重复 effect，导致首屏耗时异常。
- H3: 路由守卫或登录态检查重复执行，拉长跳转路径。
- H4: 页面包体/首屏渲染过重，导致开发者工具中的页面切换超时。

## Instrumentation Plan
- 在路由守卫记录进入时序、鉴权耗时与放行时机。
- 在高频入口页记录初始化开始/结束、关键异步请求耗时、是否重复触发。
- 在页面导航发起侧记录点击时间和目标页面。

## Evidence Log
- Debug Server started for session `page-slow-nav`.
- Instrumentation added to:
  - `src/utils/request.ts`
  - `src/utils/route-guard.tsx`
  - `src/components/home/KingKongSection/index.tsx`
  - `src/package-course/pages/package-form/usePackageForm.ts`
  - `src/package-student/pages/student-form/useStudentForm.ts`
  - `src/package-course/pages/classes/useClasses.ts`
- `npm run build:weapp` completed successfully after instrumentation.
- Runtime evidence from `trae-debug-log-page-slow-nav.ndjson`:
  - `route-guard pass` is consistently about 202-220ms.
  - `package-form init end` is about 85-96ms.
  - `student-form init end` is about 83-90ms.
  - `classes preload end` is about 87-88ms.
  - No repeated runaway init loops or long async chains were observed in this run.

## Status
- Awaiting user confirmation whether to treat as fixed/observed or continue monitoring.
