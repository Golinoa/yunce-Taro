# FE-B4.1 报告：并发续期单飞 / refresh 失败收口分级 / 校区快照与 RQ staleTime 一致性

- 范围：仅前端 `D:\Coding\yunce\yunceTaro`（未触碰 `yunce-back`）
- 约束遵守：**未执行任何 git 写操作**（无 add / commit / tag / push / stash，未读写 `.git`）；未改 UI 布局/样式/交互/文案（仅改了首页校区分支的**数据层 staleTime** 与注释）
- 前置语义（B4，未破坏）：`clearAuthSession()` 连 `USER_PROFILE_KEY`/`userRole` 一起清；`redirectToLogin()` 并发 1s 锁 + `fail → reLaunch` 兜底 + try/catch；`rejectedRefreshToken` / `sessionTerminated` / `terminateSession()`；**「本地无 refreshToken 时不主动跳登录」保留不变**（request.ts:257-263）

---

## 一、`refreshSessionForTenant` 绕过单飞（已修）

**根因**：`src/services/auth-session.ts:307-311`（改前）自己 `post('/auth/refresh', {refreshToken}, {skipAuth:true})`，与 `src/utils/request.ts` 的 `refreshInFlight`（request.ts:245 起）是两套互相不可见的续期通道。冷启动多请求 + 切租户并发放生时，会同时发出两次 `POST /auth/refresh`；后端 refresh 是「单次使用 + 轮换」（每次 bump `sessionVersion` 并 revoke 旧会话），后到的一路把先到的一路刚换到的票轮换作废 → 本地拿到废票 → 用户被踢下线。

**改了什么**：
- `src/utils/request.ts:349-370` 新增导出
  - `export type SessionRefreshOutcome = { ok:true; accessToken:string } | { ok:false; reason:'rejected'|'retryable' }`
  - `export async function refreshSessionOnce(): Promise<SessionRefreshOutcome>`：**强制**续期（不做「access 仍有效就短路」），内部就是 `refreshAccessToken()`，因此与静默续期共用同一个 `refreshInFlight` → 同一时刻只有一次 `POST /auth/refresh`；不抛异常，失败原因按 `sessionTerminated` 区分 `rejected` / `retryable`。
- `src/services/auth-session.ts:300-370`：`refreshSessionForTenant` 不再自己 POST，改为 `await refreshSessionOnce()`；失败时 `rejected → '刷新会话失败，请重新登录'`、`retryable → '刷新会话失败，请重试'`；成功分支仍用 `/auth/me` + 新 JWT 重映射 Profile（`organizationId` 与 token 同为真实 UUID），JWT 兜底分支原样保留。
- 对外返回值语义不变：仍是 `{ ok, error?, profile? }`，调用方（`package-settings/pages/store-entry/index.tsx:444`、`.../store-entry/pending/index.tsx:104,125`）无需改动。
- 顺带（同一分支内、防死循环）：request.ts:292 把 `expiresIn` 兜底为 `|| 7200`，避免后端不返回 `expiresIn` 时写入 `NaN` 导致 `readAccessToken()` 永远判过期、反复续期。

**为什么不用 `resolveAccessToken`**：入驻批准后必须**强制**换票才能拿到带新 `organizationId` 的 JWT，若走 `resolveAccessToken` 会因 access 尚未过期而直接返回旧票，语义会坏掉。

---

## 二、refresh 失败收口过宽（已按状态码分级）

**根因**：改前 `src/utils/request.ts` 的 `refreshAccessToken` 两处无条件收口——非 2xx 分支与 `catch` 分支都会 `terminateSession()`（清态 + 跳登录）。Taro.request 的 `fail` 回调**没有 statusCode**，网络错误/超时也会落进同一个 `catch`，于是弱网/后端抖动等于把用户踢到登录页。

**改了什么**（`src/utils/request.ts`）：
1. `request.ts:232-243` 新增模块级 `refreshTransientFailure: string | null`（值即给用户看的文案），语义 = 本轮 refresh 因**可重试原因**失败；`refreshTransientFailure = null` 在每次新尝试开始时重置（request.ts:251）。
2. `request.ts:305-321`：保留「假失败调和」（另一路已轮换 → 复用本地新 access token，B4 语义未动），随后**只有 `res.statusCode === 401`** 才 `rejectedRefreshToken = refreshToken` + `terminateSession()`。
3. `request.ts:323-332`：非 401（5xx / 429 / 其它）→ 置 `refreshTransientFailure`（429 用统一文案 `操作太频繁，稍后再试`，5xx 用 `服务暂时不可用，请稍后重试`），**不清会话、不跳登录**，返回 null。
4. `request.ts:333-341`：`catch`（网络错误 / 超时）→ `refreshTransientFailure = mapNetworkFailMessage(err)`，**不清会话、不跳登录**，不再写 `rejectedRefreshToken`（网络抖动不代表凭据失效）。
5. `request.ts:441-452`：关键补刀——续期没换成时**绝不发无 `Authorization` 的业务请求**。原实现会让请求裸奔出去，后端必然回 401，又被 401 分支收口，「不清会话」等于白改。现在 `token` 为空且非 `sessionTerminated` 且 `refreshTransientFailure` 时直接 `throw new ApiError(-1, refreshTransientFailure)`（与既有网络失败同码 -1，调用方按网络异常处理、可重试）。
6. `request.ts:294-296`：续期成功顺带 `sessionTerminated = false`（会话恢复即解除收口标记）。
7. B4 保留项未动：`refreshToken === rejectedRefreshToken` 直接返回不再空打后端；无 refreshToken 时不跳登录。

---

## 三、校区快照 vs React Query `staleTime`（核实：**确实存在不一致，已最小改动修一致**）

**核实过程（按实际代码，非任务书行号）**
- 首页渲染源是 Zustand store 的 `campuses`（`src/pages/home/index.tsx:87,122-125,751`），**不是** `useQuery` 的 `data`（该查询的返回值未被消费，request 只是"触发器"）。
- 因此 `invalidateCache()`（`src/stores/campus.ts:201-213`：清快照 + 清内存 + `lastCampusesFetchAt = 0`）**不会出现"继续显示旧校区列表"**——旧列表在 store 里已被清空。
- 但存在另一种同源不一致，且更隐蔽：`useQuery({ queryKey:['campuses', currentRole], staleTime: 30_000 })`（改前 `src/pages/home/index.tsx:303-308`）在 30s 内认为缓存新鲜 → **不再调用 `queryFn`** → `fetchCampuses()` 根本不执行。而登出 / 切机构走的 `resetDomainCaches('all')`（`src/utils/reset-domain-caches.ts:39-44`，由 `src/utils/auth.tsx:571/639/654` 触发）只清了 store，`QueryClient` 是 `src/app.tsx:50` 的模块级单例、从不清理，`queryKey` 在「同角色重新登录/回到首页」时不变 → 首页停在被清空的 store 上：校区卡片空白、`campuses.length === 0` 还会给管理者误弹「未设置校区」引导（`src/pages/home/index.tsx:112-120`）。另外 `refreshHome()` 失效的是 `['home']` 前缀（`index.tsx:69`），覆盖不到 `['campuses', …]`。
- 结论：**症状不是"显示旧列表"，而是"清了但（在 staleTime 窗口内）不重拉"**，属真实不一致。

**改了什么（最小改动，1 处语义 + 常量+注释）**
- `src/pages/home/index.tsx:74-83` 新增 `CAMPUSES_QUERY_STALE_TIME_MS = 0`（带理由注释）；`index.tsx:314-323` 该查询改用之，其余两个查询（aggregate / todos）保持 `HOME_QUERY_STALE_TIME_MS = 30_000`。
- 逻辑依据：校区列表的**唯一新鲜度来源**回归 store 的 `TTL.campus = 15min`（`src/utils/data-freshness.ts:20`），RQ 只负责"触发 store 拉取"。稳态下每次进首页都会走到 `fetchCampuses()`，由 store TTL 短路 → **不多发网络**；`invalidateCache` 归零后必然真正重拉。未引入全局缓存层、未把 QueryClient 下沉到 store、未动 `queryKey` 形状。

---

## 四、验证（真实命令 + 真实输出）

环境：Windows 侧 Node 直调（按要求不在 WSL 跑）。

1) 类型检查
```
cd /d/Coding/yunce/yunceTaro && node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
→ 输出为空，TSC_EXIT=0
```

2) Lint / 格式（改动文件）
```
node ./node_modules/eslint/bin/eslint.js src/utils/request.ts src/services/auth-session.ts src/pages/home/index.tsx src/services/auth.test.ts src/utils/request-refresh.test.ts src/stores/campus-load.test.ts
→ 首次报 1 个 prettier/prettier 格式错（request-refresh.test.ts:144）；`prettier --write src/utils/request-refresh.test.ts` 后复跑 eslint 输出为空
node ./node_modules/prettier/bin/prettier.cjs --check <同上 6 个文件>
→ 全部通过（All matched files use Prettier code style）
```

3) 定向测试（5 个文件，36 用例全绿）
```
cd /d/Coding/yunce/yunceTaro && node ./node_modules/vitest/vitest.mjs run src/utils/request-refresh.test.ts src/stores/campus-load.test.ts src/utils/request.test.ts src/services/auth.test.ts src/services/organization.bind-code.test.ts

 RUN  v2.1.9 D:/Coding/yunce/yunceTaro
 ✓ src/services/organization.bind-code.test.ts (2 tests)
 ✓ src/stores/campus-load.test.ts (6 tests)
 ✓ src/utils/request.test.ts (5 tests)
 ✓ src/utils/request-refresh.test.ts (5 tests)
 ✓ src/services/auth.test.ts (18 tests)
 Test Files  5 passed (5)
      Tests  36 passed (36)
```

### 新增/调整用例证明了什么
**新增 4 个（本批要求 ≥2）**
- `request-refresh.test.ts` · 「refresh 5xx：不清会话、不跳登录，本次请求按可重试失败；随后恢复可续期成功」：断言无 token 的业务请求**一次都没发**（`spy` 里非 refresh 调用数 = 0）、`AUTH_TOKEN_KEY`/`USER_PROFILE_KEY` 均未被清、`redirectTo` **未调用**、首次调用以 `code:-1` 失败；随后把 refresh 改回 200，同一条 `get` 再次调用即成功并把 `fresh-access/R2` 落盘 → 证明「网络/5xx 不定终态 + 下次仍能续期成功」。
- `request-refresh.test.ts` · 「refresh 网络错误/超时（`request:fail timeout`）：不清会话、不跳登录」：覆盖 Taro `fail` 回调无 statusCode 的真实形态，断言 token/profile 保留、未跳登录。
- `request-refresh.test.ts` · 「并发续期只发一次：`refreshSessionForTenant` 与静默续期共用同一单飞」：refresh 端故意 `await 10ms` 让两路真正重叠，`Promise.all([get('/a'), refreshSessionForTenant()])` 后断言 `POST /auth/refresh` **恰好 1 次**，且业务请求带上 `Bearer fresh-access` → 直接证明第一件事已修（改前此用例会看到 2 次）。
- `campus-load.test.ts` · 「清缓存后 `fetchCampuses` 不再被 TTL 短路，必然真正重拉（首页 staleTime=0 依赖此语义）」：TTL 内重复调用只打 1 次网络 → `invalidateCache()` 后调用即打第 2 次并恢复 1 条校区 → 锁住第三件事所依赖的 store 侧不变量。
- `auth.test.ts` · 「`refreshSessionForTenant`：续期可重试失败时提示『请重试』而不是『请重新登录』」（新增）+ 原「换 token 后 Profile.organizationId 与 JWT 对齐」用例改为断言 `refreshSessionOnce` 被调用 1 次。

**同步调整的既有用例（附理由）**
- `src/services/auth.test.ts:4-12`：`@/utils/request` 的工厂 mock 增加 `refreshSessionOnce: vi.fn()`。理由：`refreshSessionForTenant` 的契约从「本模块 POST /auth/refresh」变为「复用 request 层单飞入口」，原 `post` mock 已不再被该函数消费；用例断言语义不变（仍验证 organizationId/JWT 对齐），并新增断言 `refreshSessionOnce` 恰好调用 1 次。
- `src/utils/request-refresh.test.ts:12-17`：`@/utils/build-env` mock 补 `isDevApiEnv` / `isUseMock`。理由：该文件新增 import `@/services/auth-session`，其依赖链 `services/auth-shared` 在模块初始化时调用 `isDevApiEnv()`，原 mock 只有 `getApiBaseUrl` 会抛 "No isDevApiEnv export"（不影响被测逻辑，仅补 mock 面）。
- `src/stores/campus-load.test.ts`：仅新增用例，既有 5 个用例未改。

---

## 五、改动文件完整清单（相对 `yunceTaro/`）

```
src/utils/request.ts
src/services/auth-session.ts
src/pages/home/index.tsx
src/utils/request-refresh.test.ts
src/stores/campus-load.test.ts
src/services/auth.test.ts
docs/diagnostics/FE-B4.1-REPORT.md
```

---

## 六、未完成 / 不确定项（不夸大）

1. **第三件没有 home 组件级测试**：由于未引入 React 测试栈（也不在本次范围），`staleTime: 0` 这一侧只由 `CAMPUSES_QUERY_STALE_TIME_MS` 常量 + store 侧回归用例 + 代码路径分析保证，未做首页挂载行为测试。
2. **`refreshTransientFailure` 的窗口语义**：它是「本轮"这次续期尝试"的结果」，在每次 `refreshAccessToken()` 开始时重置；跨请求读取只在 `resolveAccessToken()` 返回 null 的分支发生，因此不会串味。但若未来有人新增绕过 `resolveAccessToken` 的取 token 路径，需要一并接入该标记。
3. **非 401 的 4xx（403/404/422）也按「可重试」处理**（任务书口径「其余按可重试处理」）。若后端将来用 4xx 表达「refreshToken 永久失效」，需要补充分支；目前后端 refresh 失效为 401（`UnauthorizedError('刷新令牌无效')`）。
4. 第三件未采用「在清快照处顺手清 RQ cache」的方案（B4 建议之一），因为那需要把 `QueryClient` 单例从 `app.tsx` 抽出成共享模块、或在 store 里引入对 RQ 的依赖；本次选了改动面更小、且把"新鲜度唯一来源"归位到 store 的方案。若上层更希望按 B4 原建议做，可在此报告基础上再评估。
5. 只跑了定向测试（5 个文件 36 例）与全量 `tsc`/改动文件 `eslint`+`prettier`，**未跑全量测试套件、未做真机联调**（按任务书要求）。
