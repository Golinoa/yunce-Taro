# FE-B4 报告：无感登录缺失（FE-11）与首页「未设置校区」（FE-12）

- 范围：**仅前端** `D:\Coding\yunce\yunceTaro`（未触碰 `yunce-back`，未改任何后端代码）
- 批次：FE-11（refresh 失败无终态 / 单飞覆盖不足）、FE-12（首页闪「未设置校区」）
- **本批未执行任何 git 写操作**（无 add / commit / tag / push / stash；未触碰 `.git`），也未执行 `git status` / `git diff`
- 附：**「前端无法自行规避轮换 401」的论证**（第三节）与**两处残余风险**（第六节）

---

## 一、FE-11：杀掉小程序后重进被要求重新登录

### 1.1 真实的根因链（以实际代码为准）

**① 后端 refresh 是「单次使用 + 轮换」，前端拿的凭据随时可能变成废票**

`yunce-backend/src/auth/auth.service.ts:1133-1150`（只读核对，未改）：

```ts
const revokeResult = await tx.authSession.updateMany({
  where: {
    id: payload.sessionId,
    profileId: payload.profileId,
    refreshTokenJti: payload.jti,        // ← jti 必须精确匹配
    sessionVersion: payload.sessionVersion,  // ← 版本必须精确匹配
    revokedAt: null,
    expiresAt: { gt: new Date() },
  },
  data: { revokedAt: new Date(), lastUsedAt: new Date() },
});
if (revokeResult.count !== 1) {
  throw new UnauthorizedError('刷新令牌无效');   // ← :1149 用户实测到的文案
}
```

`:1177` `const newSessionVersion = payload.sessionVersion + 1;`、`:1225-1233` 每次刷新都 **新建一条 session 行**、`:1247` 把旧 refresh token 的 jti 写进黑名单。
即：**同一枚 refreshToken 只能用一次**，客户端唯有从 refresh 响应体里拿到新票才能继续续期。

**② 前端只在「响应完整拿到 + 写盘成功」之后才持有新票，且没有任何自愈手段**

- 写盘点：`src/utils/request.ts:262-277`（改动前 `:159-174`）`persistRefreshedSession()` → `Taro.setStorageSync(AUTH_TOKEN_KEY, …)`。
- 前端全仓 **无 `sessionVersion` / 轮换对齐逻辑**（已 grep 确认，与任务书一致）。

于是任何「服务端已轮换成功、客户端未拿到或未写盘」的情形（最典型：**刷新过程中小程序被杀死/切后台被杀**），客户端就永久持有已作废的 refreshToken，此后每次冷启动 `POST /auth/refresh` 必然 401「刷新令牌无效」——用户被要求重新登录。

> 这条**前端无法自行规避**，论证见第三节；本批把「无法避免」变成「失败后一定有确定的、干净的终点」。

**③ refresh 失败的收尾是「半成品」，留下脏 profile + 卡中间态**（改动前 `src/utils/request.ts:176-236`、`:66-68`）

```ts
function clearAuthSession(): void {
  Taro.removeStorageSync(AUTH_TOKEN_KEY);   // ← :67 只清 token，profile 原封不动
}
...
      clearAuthSession();                    // ← :216 refresh 非 2xx 只清 token
      logRequestIssue('refresh_fail', { … });
      return null;                           // ← 到此结束：不跳登录页、没有终态
```

后果链（改动前的真实行为）：

1. `refreshAccessToken()` 返回 `null` → `resolveAccessToken()` 返回 `null` → **请求不带 `Authorization` 照发**；
2. 该请求再吃一次 401，才由业务 401 分支（`request.ts:368-378`）补做 `clearAuthSession(); redirectToLogin();` —— **跳登录页只是"间接地、迟到地"发生了一次**；若该接口恰好允许匿名，则**根本不跳**，用户留在页面上，看到的是「脏 profile（上一身份仍在）+ 空数据」的中间态；
3. 冷启动时并发请求会各自走一遍这条链：`POST /auth/refresh`（用户日志）、随后 `GET /auth/me` 401、`GET /org-permissions` 401 —— 正是同一枚废票炸出来的连锁 401；
4. `redirectToLogin()`（改动前 `:70-78`）**无任何并发护栏**，多个请求同时 401 会同时 `redirectTo`，只有第一次成功，其余静默失败（微信端 `redirectTo:fail`），观感就是「卡一下/反复弹」。

**④ 另有一条绕过单飞的 refresh 旁路（同族隐患，本批只查不改）**

`src/services/auth-session.ts:296-311`：

```ts
export async function refreshSessionForTenant(): Promise<…> {
  const stored = readStoredSession();
  const refreshToken = stored?.refresh_token;
  …
  const data = await post<…>(AUTH_ENDPOINTS.refresh, { refreshToken }, { skipAuth: true });
```

它**不走 `refreshInFlight`**，直接用同一枚 refreshToken 打后端。若与 request 层的刷新并发，两者只有一路能成功，另一路必 401；而**失败方如果是 request 层，它会 `clearAuthSession()` 把成功方刚写入的新票一起删掉** → 彻底登出。
调用点仅在门店入驻页（`package-settings/pages/store-entry/index.tsx:444`、`…/store-entry/pending/index.tsx:104`、`:125`），**不在本次冷启动链路上**，故本批未改，只作为残余风险上报（第六节）。

### 1.2 改了什么、为什么

文件：`src/utils/request.ts`

| 位置（改动后）                      | 改动                                                                                                            | 为什么                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `:73-82 clearAuthSession()`         | 从「只删 `AUTH_TOKEN_KEY`」→ **token + `USER_PROFILE_KEY` + `userRole` 一起删**                                  | 补掉任务书指出的漏项：会话已失效就不得留下「脏 profile」，否则首页会拿上一身份继续渲染（也直接喂给了 FE-12 的症状）                |
| `:84-109 redirectToLogin()`         | 新增 **1s 并发护栏** + `redirectTo` 失败时 `reLaunch` 兜底 + 整段 best-effort（跳转抛错不反噬请求链路）           | 「明确跳登录页」必须是**确定终点**：并发 401 只跳一次；跳转失败也要落到登录页，而不是停在中间态                                    |
| `:218-221` 新增两个模块级标记       | `rejectedRefreshToken`（本轮已被判死的凭据）/ `sessionTerminated`（会话已收口）                                 | 让「冷启动/并发」下**同一枚废票只尝试一次**、收口后**不再发注定 401 的请求**；两枚标记都**自愈**（重新登录写入新票/新 access 后自动解除） |
| `:228-232 terminateSession()`       | 新增：`sessionTerminated = true` → 清 token+profile+userRole → 跳登录页（幂等）                                  | FE-11 目标 a 的单一收口出口；并发/冷启动下只清一次、只跳一次                                                                       |
| `:234-309 refreshAccessToken()`     | 保留原 `refreshInFlight` 单飞；新增「已判死凭据直接短路」；**非 2xx 时先复查本地 refreshToken 是否已被别的刷新路径换新**（是则复用新 access，不判死）；失败才 `terminateSession()` | 单飞覆盖「并发 + 冷启动」；同时给「两路刷新抢同一枚票」这种**假失败**留出自愈出口（见 1.3 场景 ②）                                 |
| `:316-326 resolveAccessToken()`     | 拿到可用 access token 时解除 `sessionTerminated`                                                                | 保证「重新登录后功能立刻恢复」，标记不会把用户永久锁死在登出态                                                                    |
| `:384-394 performRequest()`         | 无 token 且会话已收口 → **直接抛 `ApiError(401,'登录已过期，请重新登录')`，不再把请求打到后端**                   | 消除用户日志里那种「refresh 401 之后紧接着 /auth/me 401、/org-permissions 401」的连锁噪声与无谓往返                                |
| `:430-435`、`:453-458` 业务 401 分支 | `clearAuthSession(); redirectToLogin();` → `terminateSession();`                                                | 全仓只有**一个**会话收口出口，行为一致、可审计（同时获得 profile 清理与并发护栏）                                                  |

**关于 refresh 单飞（目标 b）的复核结论**：原 `refreshInFlight` 的**并发**语义本身是对的（`refreshInFlight = (async () => …)()` 之前没有 `await`，不存在赋值前的交错窗口；`finally` 清空后所有 awaiter 仍共享同一 Promise 结果）。**真正的缺口在冷启动的"后续请求"**：刷新失败后 `refreshInFlight=null` 且（改动前）只清了 token，导致
① 后续请求会**各自重新 POST `/auth/refresh`**（若票还在）；
② 落在「无 token 请求 → 业务 401 → 再跳转」的次生路径上。
本批用 `rejectedRefreshToken`（同一枚废票不再重试）+ `sessionTerminated`（收口后不再发请求）把这两个缺口补齐。

### 1.3 三种场景的预期行为（改动后）

**场景 ①：杀掉小程序后重进（refreshToken 仍然有效）**
冷启动 → `AuthProvider.init()` → `getSession()` → `GET /auth/me` 发现 access 过期 → **一次** `POST /auth/refresh`（并发请求共用同一 `refreshInFlight`）→ 成功 → 新 access/refresh **双落盘**（`persistRefreshedSession`）→ 用户**免登直达原页面**。
（这条路径改动前也基本可用；本批的收益是：并发/冷启动只打一次 refresh，且不会再有第二条路径把新票误删。）

**场景 ②：refresh 返回 401（凭据已被作废/无效）**
`POST /auth/refresh` 401 →（先复查：本地 refreshToken 未被换新，说明不是"输给另一路刷新"）→ `terminateSession()`：
token + profile + userRole **一次清干净** → `redirectTo('/package-auth/pages/login/index')`（失败则 `reLaunch` 兜底）→ 用户**明确地、只一次地**落到登录页；随后并发/后续请求**不再打后端**（直接抛「登录已过期，请重新登录」），不会出现 `/auth/me`、`/org-permissions` 各 401 一串、也不会反复弹跳。
**注意：此场景下"免登"是不可能的**（凭据已废，只有服务端能补发）——本批交付的是「不卡死、不反复、不脏态」。要真正免登需要后端侧改动，见第三节。

**场景 ③：首页刷新（登录态有效）**
首页先用**本地校区快照**渲染出上次的校区（含名称/地址/营业状态），**不再出现瞬间的「未设置校区」**；`/campuses` 在后台返回后自动校准（切校区、权限变化、改店名等都会跟上）。
**只有快照和远端都没有校区数据时**，才显示「未设置校区」。

### 1.4 FE-11 的回归用例（新增 `src/utils/request-refresh.test.ts`）

- 用例 1（`request-refresh.test.ts:55`）：冷启动现场（access 过期 + 脏 profile + 作废 refreshToken），3 个并发请求 →
  `Taro.request` **只被调用 1 次且就是 `/auth/refresh`**、token 与 profile 均被清空、`redirectTo` **只被调用 1 次**且 url 为登录页、3 个请求全部如期失败。
- 用例 2（`request-refresh.test.ts:92`）：refresh 成功（轮换 `R1→R2`）→ 2 个并发业务请求**只换一次 token**，`access_token=fresh-access` / `refresh_token=R2` **双落盘**，两个业务请求都带上 `Bearer fresh-access`。

---

## 二、FE-12：刷新后首页显示「未设置校区」

### 2.1 真实的根因（以实际代码为准）

兜底文案的触发条件只有一个：**首页拿到的 `campus` 是 `null`**。

- `src/components/home/campus-card/index.tsx:93-96`：`const raw = campus?.name || '未设置校区'`
- `src/pages/home/index.tsx:122-125`：
  ```ts
  const currentCampus = useMemo<CampusUIModel | null>(() => {
    const byId = campuses.find((c) => c.id === currentCampusId);
    return byId || campuses.find((c) => c.isMain) || campuses[0] || null;   // ← campuses 为空 ⇒ null ⇒ 兜底文案
  }, [campuses, currentCampusId]);
  ```
- 而 `campuses` 来自 Zustand store，**改动前初始值恒为 `[]`**：`src/stores/campus.ts:126`（改动前）`campuses: []`。
  它唯一的填充途径是首页这条查询（`src/pages/home/index.tsx:303-308`）：
  ```ts
  useQuery({ queryKey: ['campuses', currentRole ?? ''], queryFn: () => fetchCampuses(), enabled: Boolean(currentRole) });
  ```

所以「未设置校区」的充要条件与任务书一致：**`currentRole` 未就绪（`enabled=false`）或 `/campuses` 尚未返回的窗口内，store 里一个校区都没有** → 渲染兜底文案。
已核实的相关事实：校区 id **确实已持久化**（`src/stores/campus.ts:34 / :128-129`，key `yunce_current_campus_id` / `yunce_last_visited_campus_id`），**但没有任何地方持久化校区"内容"（名称/地址/营业时间）**，所以仅凭 id 无法在首屏渲染出校区名。

> 补充（同族、本批**未改**，仅记录）：`resetDomainCaches('all')`（切机构/登出）会调 `useCampusStore.invalidateCache()` 把内存 `campuses` 清成 `[]`，而首页那条 `useQuery` 有 `staleTime: 30_000` 且 `useDidShow` 用的是 `stale: true` 过滤——**内存被外部清空后，React Query 侧不认为该 query 陈旧，30s 内不会重拉**，这也能造成一段「未设置校区」。这属于任务书明确划为后续批次的「TanStack 缓存与 store 两套真相源」问题，本批只记录建议（见第六节）。

### 2.2 改了什么、为什么

文件：`src/stores/campus.ts`（**未改任何页面/组件**，符合"只改状态恢复与渲染时机、不动文案与布局"）

| 位置（改动后）                                     | 改动                                                                                  | 为什么                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `:42-73`                                           | 新增 `CAMPUS_SNAPSHOT_KEY = 'yunce_campus_list_snapshot'` + `readCampusSnapshot()` / `persistCampusSnapshot()` | 给「校区内容」补一份本地快照；解析失败一律当空，不影响主链路                                                |
| `:159`                                             | `campuses: readCampusSnapshot()`（原 `campuses: []`）                                  | **store 初始化即带上次成功拉取的校区** ⇒ 首页首帧就能渲染出校区名，不再闪兜底文案；`fetchCampuses` 随后照常后台校准 |
| `:193` `fetchCampuses` 成功                        | 写入快照                                                                              | 快照 = 「上次成功拉取的结果」；**失败不写**（`catch` 分支不动快照），所以网络失败时页面仍显示旧校区而不是「未设置校区」 |
| `:203` `invalidateCache()`                         | 清快照                                                                                | 登出/切机构时必须一起清，避免下一个上下文先渲染上一家的门店                                                |
| `:223 / :238 / :255 / :272` 增删改主校区           | 同步写快照                                                                            | 保持「内存列表 = 快照」，避免增删校区后冷启动看到的还是旧列表                                              |

**为什么这样改就能消掉用户看到的现象**：
`readCampusSnapshot()` 在 `create()` 初始化时同步执行（`Taro.getStorageSync` 是同步 API），因此**首帧 render 时 `campuses` 已经非空**，`currentCampus` 立刻命中 `byId / isMain / [0]` 之一 → `displayName` 取到真实校区名。
`enabled: Boolean(currentRole)` 是否就绪、`/campuses` 是否返回，都不再影响首屏文案——后台请求完成后 `set({campuses})` 触发重渲染自动校准，整个过程没有引入新的加载态、没有改文案与布局、没有引入任何像素/样式改动（本批**零 UI 改动**）。

### 2.3 FE-12 的回归用例（`src/stores/campus-load.test.ts` 新增 3 例）

- `:47` `fetchCampuses` 成功落快照；**失败时保留旧快照**（不会把"加载失败"写成"没有校区"）。
- `:57` `invalidateCache()`（登出/切机构）会移除快照，避免串上一家的校区。
- `:65` **冷启动**：本地有快照 ⇒ 新 import 的 store 初始 `campuses` 非空（首页首个 render 就有校区，不会先渲染「未设置校区」）。

---

## 三、为什么前端无法自行规避「轮换导致的 401」（任务书 c 项）

结论：**不能**。这不是"还没实现"，而是**信息上不可能**：

1. **新凭据只存在于服务端**：新票是后端在 `refreshTokens()` 事务里新签的 JWT，`sessionVersion`（`auth.service.ts:1177`）与 `jti`（`:1230`）都由服务端生成并写库；`jti` 还藏在签名后的 refreshToken 内部。前端**无法推算、无法自签**。
2. **旧凭据在服务端已被硬作废**：旧 session 行被 `revokedAt` 置位（`:1143-1145`）、旧 jti 进黑名单（`:1247`），且校验条件含 `refreshTokenJti = payload.jti` **且** `sessionVersion = payload.sessionVersion` **且** `revokedAt = null` —— 重放旧票必然 `count !== 1` → 401。**服务端没有"旧票宽限窗口"，也没有"重放返回已签发的新票"语义**，所以客户端用旧票重试是**数学上不可能成功**的。
3. **前端能做的只有「不把事情弄得更糟」**：本批的做法是 —— 同一枚废票不再重试（`rejectedRefreshToken`）、识别"输给另一路刷新"的假失败并复用新票（`refreshAccessToken` 的非 2xx 复查分支）、失败后一次性收口到登录页（`terminateSession`）、收口后不再发注定 401 的请求（`sessionTerminated`）。
4. **若要做到"刷到一半被杀也能免登"，必须后端配合**（本次不改后端，仅建议）：
   - 方案 A：refresh token **复用检测 + 短宽限窗口**（旧票在 N 秒内重放时，返回**同一份**已签发的新票对，而不是 401）；
   - 方案 B：把刷新做成**幂等**（以 `sessionId + sessionVersion` 为幂等键，重复请求返回同一结果）；
   - 方案 C：前端在**拿到响应后立刻落盘**（已是现状），并把「refresh 请求发出 → 落盘」这段做到最短（本批未引入额外 await，现状已最短）。

**a/b 修复后用户会看到什么**：
- 凭据仍有效 → **无感续期，不受影响**；
- 凭据已废（如用户日志里的 401）→ **一次性、干净地进登录页**（token/profile/userRole 全清、只跳一次、不再有连锁 401、不会停在「有身份但没数据」的中间态），登录一次即可恢复；
- 首页 → **显示上次的校区**，不再闪「未设置校区」。

**额外发现（需后端侧确认，前端无法判定）**：用户日志里 `GET /auth/me` 401 耗时仅 `0.182ms`，说明**服务端在触库之前就拒绝了**（签名/过期校验即返回）。这既可能是「access 已过期」（正常），也可能是「token 的签发环境与当前 API 环境的 JWT secret 不一致」——后者会让**所有存量会话的 refresh 都返回「刷新令牌无效」且永远无法自愈**（前端无论怎么改都只能引导重登）。建议后端核对 `POST /auth/refresh` 401 分支的日志（是 `verifyRefreshToken` 抛错还是 `revokeResult.count !== 1`）以及各环境密钥配置。

---

## 四、验证证据（实际命令 + 真实输出）

全部在 `D:\Coding\yunce\yunceTaro` 下执行；`npm run` 不注入 `node_modules/.bin`，故直调二进制。

### 4.1 TypeScript

```
$ node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
TSC_EXIT=0
```

### 4.2 ESLint（4 个改动文件）

```
$ node ./node_modules/eslint/bin/eslint.js src/utils/request.ts src/utils/request-refresh.test.ts src/stores/campus.ts src/stores/campus-load.test.ts
ESLINT_EXIT=0
```

（首次执行有 8 个 `prettier/prettier` 报错 + 1 个 `import/order` warning，已用 `eslint --fix` 修复后复跑为 0 问题。）

### 4.3 Prettier

```
$ node ./node_modules/prettier/bin/prettier.cjs --write src/utils/request.ts src/utils/request-refresh.test.ts src/stores/campus.ts src/stores/campus-load.test.ts
src/utils/request.ts 120ms (unchanged)
src/utils/request-refresh.test.ts 22ms (unchanged)
src/stores/campus.ts 57ms (unchanged)
src/stores/campus-load.test.ts 8ms (unchanged)
PRETTIER_EXIT=0
```

### 4.4 定向 vitest（**只跑定向用例，未跑全量**）

```
$ node ./node_modules/vitest/vitest.mjs run src/utils/request-refresh.test.ts src/utils/request.test.ts \
    src/stores/campus-load.test.ts src/utils/single-flight.test.ts --reporter=basic

 RUN  v2.1.9 D:/Coding/yunce/yunceTaro

 ✓ src/utils/single-flight.test.ts (6 tests) 43ms
 ✓ src/utils/request-refresh.test.ts (2 tests) 78ms
 ✓ src/stores/campus-load.test.ts (5 tests) 12ms
 ✓ src/utils/request.test.ts (5 tests) 670ms

 Test Files  4 passed (4)
      Tests  18 passed (18)
   Duration  2.20s
```

同族回归（认证/路由守卫/数据新鲜度，确认未被打断）：

```
$ node ./node_modules/vitest/vitest.mjs run src/services/auth.test.ts src/utils/route-guard.test.ts \
    src/services/home.parent.test.ts src/utils/refetch-ttl.test.ts src/utils/data-freshness.test.ts --reporter=basic

 ✓ src/utils/refetch-ttl.test.ts (2 tests) 3ms
 ✓ src/utils/data-freshness.test.ts (3 tests) 3ms
 ✓ src/services/auth.test.ts (17 tests) 923ms
 ✓ src/services/home.parent.test.ts (4 tests) 4ms
 ✓ src/utils/route-guard.test.ts (8 tests) 5ms

 Test Files  5 passed (5)
      Tests  34 passed (34)
   Duration  3.72s
```

> 说明：本机 vitest 可正常运行（`node ./node_modules/vitest/vitest.mjs`），单个文件 2～4s。

### 4.5 未执行的验证

- **未做真机/小程序端冷启动验证**：本机无法杀掉小程序进程复现冷启动（见第六节第 1 条）。
- **未跑全量测试**（任务书要求定向）。
- **未跑 `npm run build`**（本批无构建产物变更）。
- 未做后端联调抓包（后端只读核对，未改动、未运行）。

---

## 五、改动文件清单

```
src/utils/request.ts                    （FE-11 主改）
src/utils/request-refresh.test.ts       （新增，FE-11 回归用例）
src/stores/campus.ts                    （FE-12 主改）
src/stores/campus-load.test.ts          （FE-12 回归用例，追加 3 例）
```

诊断文档（工作区可见产物，按前批惯例**不入库**）：

```
docs/diagnostics/FE-B4-REPORT.md
```

**未改动的相关文件（说明）**：`src/pages/home/index.tsx`、`src/components/home/campus-card/index.tsx` 本批**未改**——「未设置校区」的判定源只是 `currentCampus === null`，而 `currentCampus` 由 store 的 `campuses` 推导；让 store 初始化即带快照即可满足"先用快照渲染、再后台校准"，无需改动页面渲染时机，也避免了触碰 UI/文案。

### 与任务书的不一致处（以实际代码为准）

| 任务书写的                                                       | 实际                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/utils/request.ts:175` 起 `refreshInFlight`                   | 实际在 `:176`（改动后 `:205`）                              |
| `:215` refresh 返回 401 时只 `clearAuthSession(); return null`    | 实际在 `:216-222`（非 2xx 与 catch 两条失败路径都在此收尾） |
| `:358-367` 业务请求 401 分支                                     | 实际在 `:368-378`（HTTP 401）；另有 `:346-352`（2xx 但 `body.code===401`） |
| `auth.tsx:275-279 persistAuth` / `:306` 冷启动读回                | 实际 `:275-288` / `:306`，一致                              |
| `auth-session.ts:46-57 getSession/readStoredSession`              | 实际 `readStoredSession` 在 `:46-73`、`getSession` 在 `:75-112` |
| `refreshSessionForTenant`（任务书未提及）                        | 实际存在，`auth-session.ts:296-365`，是**绕过单飞的第二条 refresh 路径**（见 1.1 ④） |

---

## 六、未完成项 / 不确定项

1. **无法在本机复现真机冷启动**：FE-11/FE-12 的"杀进程后重进"必须在真机（或开发者工具清缓存后重启编译）验证。本批只做到：静态路径分析 + 单测（含冷启动现场构造）+ tsc/eslint/prettier 全绿。**建议**真机验收脚本：① 登录后杀小程序重进 → 应免登；② 手动清掉后端该 session（或制造 refresh 401）后重进 → 应**一次**落到登录页、首页不再出现「未设置校区」；③ 首页下拉/切回 → 校区卡片保持上次校区。
2. **`0.182ms` 的 401 需后端侧定性**（第三节末）：可能是 access 过期（正常），也可能是 JWT secret/环境不一致（**所有存量会话永久无法续期**）。纯前端无法区分；若属后者，前端无论怎么改都只能引导重登，需先修后端配置。
3. **残余风险：refresh 的"任何失败"都会收口登出**（本批按任务书 a 项实现：refresh 失败 = 清态 + 跳登录页，以保证"确定的终点"）。这包含 **网络抖动/超时/5xx** 这类"票其实还有效"的失败：改动前同样会清 token（`:223-229` catch 分支），所以**行为未变差，但也没变好**。
   进一步观察：即便把 request 层改成"网络失败不清态"，`src/services/auth-session.ts:108-110`（`getSession()` 的 catch → `clearStoredAuth()`）与 `src/utils/auth.tsx:322-327`（`init()` 的 catch → `clearPersistedAuth()`）**仍会因任意异常清空本地会话**，所以真正修掉"网络抖动被登出"需要一并调整这两处 —— 属**另一批**（跨 3 个文件、涉及登录态恢复语义），本批未擅自扩大范围。
   建议后续批次做法：仅在「服务端明确拒绝 refresh（401/403）」时收口登出；网络/超时/5xx 保留凭据，并让本次请求以网络错误失败（而不是无 token 打出 401）。
4. **残余风险：第二条未经单飞的 refresh 路径未修**（`src/services/auth-session.ts:296-365` `refreshSessionForTenant`，调用点 `package-settings/pages/store-entry/{index:444,pending:104,125}`）。它与 request 层刷新并发时会浪费掉一次轮换（本批已让 request 层把这种"输给另一路"的 401 识别为假失败并复用新票，但**反向**——即该函数自己拿到 401——仍会直接失败）。建议后续统一到 request 层的 refresh 单飞。
5. **FE-12 残余：`invalidateCache()` 清内存后 React Query 30s 内不重拉**（`src/stores/campus.ts:203` 清空 `campuses`，`src/pages/home/index.tsx:303-308` `staleTime: 30_000`，`useDidShow` 用 `stale: true` 过滤）。本批用快照把"首屏空白"消掉了，但该窗口内仍可能显示**上一次的**校区（旧数据而非空白）。按任务书约束 3，这属于「全局 TanStack Query 缓存落位」范畴，**只建议不改**：建议后续让 `invalidateCache()` 同时 `queryClient.invalidateQueries(['campuses'])`，或让首页改用 `refetch` 语义。
6. **`redirectToLogin` 与 route-guard 的冷启动延迟不一致**：route-guard 的跳转在冷启动 2s 内会 `setTimeout 450ms` 延后（`src/utils/route-guard.tsx:302-305`），request 层是立即跳。改动前后 request 层都是立即跳（本批只加了 1s 并发锁与失败兜底），**未经真机验证**是否会在极早期触发导航异常；若真机出现"极早跳转失败"，建议复用 `isColdStartGracePeriod()` 统一口径。
7. **`userRole` 这个 storage key 两处重复定义**（`src/utils/request.ts:81` 与 `src/utils/auth.tsx:248` 字面量），本批沿用既有写法未做抽取，以免扩大 diff。
8. **本报告未纳入 git**：按任务书"本批禁止任何 git 写操作"，仅作为工作区可见产物交付。

---

## 七、commit 状态：**未创建（本批被明令禁止 git 写操作）**

- 未执行 `git add` / `git commit` / `git tag` / `git push` / `git stash`，未触碰 `.git`（未动 reflog / repack / gc / 手写 refs）。
- 为避免刷新 index，也未执行 `git status` / `git diff`；上表"改动文件清单"由编辑记录与文件内容确认（每个文件均已用 `Read` 复核最终内容）。
- 提交由上层在健康副本中按第五节清单完成。**若上层需要新增/修改文件的最终内容指纹，可指示我重新 `Read` 后逐字输出。**
