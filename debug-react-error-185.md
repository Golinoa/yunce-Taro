# Debug Session: react-error-185
- **Status**: [OPEN]
- **Issue**: 微信小程序课程分包页面触发 Minified React error #185
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-react-error-185.ndjson

## Reproduction Steps
1. 进入 `package-course` 相关页面
2. 执行触发报错的页面操作
3. 观察微信开发者工具控制台出现 `Minified React error #185`

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 页面在渲染阶段触发了无限更新或递归状态写入 | High | Med | Pending |
| B | `useEffect` / `useMemo` / `useCallback` 依赖不稳定，导致提交阶段循环渲染 | High | Med | Pending |
| C | 列表渲染 key 或条件渲染切换导致 Fiber 树异常重建，在小程序运行时被放大 | Med | Med | Pending |
| D | 分包页面里有同步调用导航、弹窗或 store 写入，发生在 render 或 layout effect 时 | Med | Low | Pending |
| E | 某个自定义 Hook 在课程分包页面内根据异步结果反复 setState，导致渲染风暴 | High | Med | Pending |

## Log Evidence
- Debug server started and env file generated: `.dbg/react-error-185.env`
- Instrumentation added for:
  - `src/utils/route-guard.tsx`
  - `src/package-course/pages/classes/useClasses.ts`
  - `src/package-course/pages/package-form/usePackageForm.ts`
  - `src/package-course/pages/class-form/index.tsx`
  - `src/package-course/pages/schedule-form/index.tsx`
  - `src/package-course/pages/records/index.tsx`
  - `src/package-course/pages/course-packages/index.tsx`
- First instrumentation attempt failed in WeChat Mini Program runtime because `fetch` is unavailable there.
- Instrumentation transport has been switched to `Taro.request` and rebuilt successfully.
- Debug server restarted; local port `127.0.0.1:7777` is reachable again.
- User reproduction confirms:
  - `课时充值` page crashes with React `#185`
  - `添加学员` page also crashes with React `#185`
  - DevTools freezes after a short stall
- Runtime log confirms `src/package-course/pages/package-form/usePackageForm.ts` enters a self-triggering init loop:
  - effect count exceeds 100 in milliseconds
  - `studentStoreChanged/packageTemplateStoreChanged` keeps flipping after each fetch
- Confirmed root cause:
  - multiple pages read the whole Zustand store via `useStudentStore()` / `useClassStore()` / `usePackageTemplateStore()`
  - those store objects are placed into `useEffect` / `useCallback` dependency arrays
  - the effect/callback then calls `fetchByTeacher()` or similar store-mutating methods
  - store state updates replace the selected object reference, retriggering the effect and causing React `#185` (`Maximum update depth exceeded`)
- Same-structure high-risk pages found:
  - `src/package-course/pages/package-form/usePackageForm.ts`
  - `src/package-student/pages/student-form/useStudentForm.ts`
  - `src/package-course/pages/classes/useClasses.ts`
  - `src/package-course/pages/class-form/index.tsx`
  - `src/package-course/pages/schedule-form/index.tsx`
  - `src/package-course/pages/records/index.tsx`
  - `src/package-course/pages/course-packages/index.tsx`
  - `src/package-student/pages/students/index.tsx`
  - `src/package-settings/pages/notification-send/index.tsx`

## Verification Conclusion
- Pending
