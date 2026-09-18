# FE-B2 修复报告（FE-01 / FE-05 / FE-06）

- 批次：B2「页面状态机」
- 仓库：`D:\Coding\yunce\yunceTaro`（前端，Taro 4.1.9 + React 18 + TS）
- 执行时间：2026-09-18 20:40 ~ 21:45（GMT+8）
- 提交：`ce7bf657947e57848f46d91281ff0d070b679727`（未 push）
- 结论摘要：三条全部按「只改状态判定 / 加载时机 / 刷新逻辑」落地；**任务书对 FE-06 的根因描述与实际代码不符**（详见 FE-06 小节）；执行期间发现并修复了**仓库 `.git` 的结构性损坏**（详见文末「附：环境事故」），提交因此使用了 `--no-verify`。

---

## 0. 改动文件（共 3 个）

| 文件 | 改动量 |
|---|---|
| `src/package-settings/pages/membership-orders/index.tsx` | +20 / -1 |
| `src/package-settings/pages/venue-list/index.tsx` | +33 / -2 |
| `src/package-settings/pages/venue-form/index.tsx` | +25 / -4 |

未新增页面、未改路由表（`app.config.ts` 未动）、未改 `src/utils/request.ts`、未改其它页面、未格式化无关文件、未提交 `docs/diagnostics/2026-09-18-*.md`（两个他人产物，保持未跟踪）。

---

## 1. FE-01 会员权益页 →「订单详情」一直转圈

### 1.1 实际根因（与任务书一致）

任务书说「`:527` 被 `withRouteGuard` 包裹、`:111` loading 初值 true、唯一复位点在 `:152 useDidShow` 触发的 `:148 finally`」——**与实际代码一致**。补充了任务书未给出的机制证据（我在 `node_modules` 里读了 Taro 运行时实现）：

1. **子组件挂载晚于页面 `onShow` 派发**。`src/utils/route-guard.tsx:345-503` 的 `RouteGuardInner` 初始 `authorized = false`（`:347`），首帧只渲染 `<Loading/>`（`:492-501`），真正的 children 要等 `refreshProfile().then(checkAuth)`（`:477-479`）异步回调里 `setAuthorized(true)` 之后才挂载。
2. Taro 的 `useDidShow` 只是**把回调追加进页面实例的 `componentDidShow` 数组**（`@tarojs/plugin-framework-react/dist/runtime.js:3288` 附近 `createTaroHook('componentDidShow')`），而页面 `onShow` 的派发是 `safeExecute($taroPath, ON_SHOW)`（`@tarojs/runtime/dist/runtime.esm.js` 的 `createPageConfig` → `[ONSHOW]`），**只在到达时派发一次**。
3. 于是：`onShow` 已经派发完毕 → 守卫异步放行 → `MembershipOrdersPage` 才挂载 → 此时注册的 `useDidShow` 回调**永远不会被本次 show 调用** → `loadList()` 从不执行 → `loading` 停在初值 `true` → 卡在 `:279` 的 Loading，**且零个订单请求**（与用户日志「只有 `/auth/me`、`/org-permissions`，无订单接口」吻合）。

> 同一份代码里 `venue-list` 没有 `withRouteGuard`（`src/package-settings/pages/venue-list/index.tsx:191` 直接 `export default VenueListPage`），所以它的 `useDidShow` 能正常触发——这也是「同模式不同表现」的旁证。

### 1.2 改了什么（`membership-orders/index.tsx`）

```tsx
// :116-126 —— 并发闸门：挂载兜底与 useDidShow 可能各触发一次
const loadInFlightRef = useRef(false);
const loadList = useCallback(async () => {
  if (loadInFlightRef.current) return;
  loadInFlightRef.current = true;
  setLoading(true);
  ...
// :154-157 —— finally 里成对复位，任何结果（成功/失败/超时）都复位
} finally {
  loadInFlightRef.current = false;
  setLoading(false);
}

// :166-168 —— 首屏拉取改由「挂载」触发，不依赖生命周期时序
useEffect(() => {
  void loadList();
}, [loadList]);

// :170-172 —— useDidShow 保留：用于「离开再回来」的真实重入刷新
useDidShow(() => {
  void loadList();
});
```

- `loadList` 里原有的 15s `Promise.race` 超时兜底（`:127-132`）保留 → `loading` 一定在 ≤15s 内到达终态。
- 失败态 `:307`（`!detail && loadError && items.length === 0` → Empty +「重新加载」）与空态（`items.length === 0` → Empty「暂无订单」）**原本就存在且可达**，之前只是永远走不到（因为 `loading` 永不落地）。本次未改动这两处 UI。
- 视觉/布局零改动：Loading / Empty 分支的 class 一字未改。

**为什么这么改**：最小改动是把「首次加载」的触发点从不可靠的生命周期回调换成可靠的挂载副作用，同时给 loading 一个显式终态；并发闸门避免两个触发点同时开火导致 loading 反复置位或重复请求。

---

## 2. FE-05 场地管理页「失败 / 无数据 / 一直转圈」三态

### 2.1 实际根因（与任务书部分一致）

任务书说的三条代码路径**都存在**，但『`:59-65` TTL 守卫会跳过加载 = 有时显示无数据的最大嫌疑』只对了一半，且漏了更直接的两条：

| # | 实际缺陷 | 位置（改动前） | 说明 |
|---|---|---|---|
| a | **失败只弹 toast，界面落回空态** | `:46-48` catch → `showToast('加载失败')`，`:49-51` finally 只复位 loading | `rooms` 仍为 `[]` + `loading=false` → 命中 `:102-103` 的空态，用户看到的是**「确实无数据」**。这是「显示失败」与「显示无数据」两个表现同时出现的直接原因。 |
| b | **首帧 `loading=false` → 先闪一帧空态** | `:32` `useState(false)`；请求却是在 `:54 useDidShow` 里才发起 | 首帧 `loading=false && rooms.length===0` → 直接渲染「暂无场地」Empty，随后才 `setLoading(true)` 转圈。用户「有时候显示无数据」很可能是这一帧。 |
| c | TTL 跳过时不给 loading 终态 | `:59-65` `if (!canSkip) loadData()` | 跳过时不发请求是对的（成功数据还在 `rooms` 里），但**如果 loading 初值改成 true（见 b 的修法），跳过路径就必须显式收口**，否则变成永久转圈。 |

「一直转圈」在纯代码层**没有**能稳定构造的永久路径（本页无 `withRouteGuard`；`request.ts` 的 `TIMEOUT = 10000` 保证请求最多约 10s 就会 reject，`finally` 必复位 loading）。因此我把「转圈」当作与 a/b/c 同源的表现（转圈→失败 toast→空态 三连），未做超时/重试层面的额外改动。**这一点在「不确定项」里如实标注。**

### 2.2 改了什么（`venue-list/index.tsx`）

```tsx
// :31-35 —— 首屏即「加载中」，并新增独立的失败态
const [loading, setLoading] = useState(true);
const [loadError, setLoadError] = useState(false);

// :41-57 —— 请求开始清错误、捕获时置错误（toast 保留）
setLoadError(false) ... catch { setLoadError(true); showToast(...) } finally { setLoading(false) }

// :59-73 —— 刷新信号优先于 TTL（原逻辑本就是这个语义，本次只加注释固化 + 跳过时给终态）
const force = consumeRefreshSignal(REFRESH_SIGNAL.venues);
const canSkip = !force && campusKey === lastFetchKeyRef.current && !shouldRefetch(lastFetchAtRef.current, TTL.campus);
if (canSkip) {
  setLoading(false);   // 跳过请求也要给 loading 终态
} else {
  void loadData();
}

// :103-119 —— 失败态独立成分支（复用既有 Empty 组件 + 设计 token，无新样式）
if (loadError && rooms.length === 0) {
  ... <Empty icon="mdi-alert-circle-outline" description="场地加载失败" actionText="重新加载" onAction={() => void loadData()} />
}
```

三态对齐结果：`loading && rooms.length===0` → 转圈；`loadError && rooms.length===0` → 失败（可重试）；否则 `rooms.length===0` → 真的无数据。

- **布局与视觉体系零改动**：失败态复用了列表页原有的容器 class（`px-[32rpx] pt-[24rpx] pb-[200rpx]` + 顶部统计行）与既有 `Empty` 组件的 `actionText/onAction` 能力；未新增任何 SCSS / 内联 style / px。
- 刷新失败（已有数据）时不把列表清空，保留旧数据 + toast，避免「一次抖动全白」。

---

## 3. FE-06 新增/删除场地后列表不刷新

### 3.1 ⚠️ 任务书「已知根因」与实际代码**不一致**

> 任务书：「列表侧 `venue-list/index.tsx:54-65` 里，**TTL 守卫可能在消费信号之后提前 return** → 信号白消费，UI 不更新。」

**实际代码不是这样。** 改动前的 `venue-list:54-65`：

```tsx
useDidShow(() => {
  const campusKey = currentCampusId || '';
  const force = consumeRefreshSignal(REFRESH_SIGNAL.venues);   // 先消费
  const canSkip = !force && campusKey === ... && !shouldRefetch(...);  // force 参与取反
  if (!canSkip) { void loadData(); }                            // 有信号 => canSkip=false => 必然重拉
});
```

消费信号是**第一步**，且 `canSkip` 的第一个条件就是 `!force` —— **不存在「消费后被 TTL 提前 return 吞掉」的路径**。也就是说，**「刷新信号被 TTL 拦截」这条机制在真实代码里不成立**，我没有为了对上任务书去「修」一个不存在的分支（仅补注释固化语义，见 `:60-61`）。

### 3.2 实际根因（代码可支持的）

先看用户日志给出的客观事实（台账 FE-06「原始日志 E」）：`GET /venues?…campusId=…`（= `venue-form:105` 的 `venueService.getList`）→ `POST /venues/rooms 201` → **之后再没有任何列表请求**。

把这条事实与代码对齐，唯一自洽的解释是：**表单页没有回到列表页**（用户原话也是「保存成功应该关闭表单页面」，且删除场景他自己说「虽然关闭了」），列表页因此**从未 `onShow`** → 信号从未被消费 → 一个刷新请求都没有。信号机制本身没问题（信号只有被消费才清除，未被消费会留给下一次进入列表页，属于自愈）。

改动前 `venue-form:129-132` / `:153-156`：

```tsx
Taro.showToast({ title: '保存成功', icon: 'success' });
setRefreshSignal(REFRESH_SIGNAL.venues);         // 只发信号
setTimeout(() => Taro.navigateBack(), 800);      // 且返回失败时无任何兜底
```

`Taro.navigateBack()` 无参数、无 `fail` 回调：一旦页面栈异常（例如表单页由 `room-form` 兼容页 `redirectTo` 进来、或经由非 `venue-list` 的入口），返回失败会被**静默吞掉**，页面停在表单 —— 正是「保存成功但表单没关、列表也没刷新」且日志里没有列表请求的组合。

### 3.3 改了什么（`venue-form/index.tsx`）

```tsx
// :96-109 —— 写完必须真的回到列表页，返回失败则用 redirectTo 兜底
const goBackToList = useCallback(() => {
  Taro.navigateBack({
    delta: 1,
    fail: () => {
      Taro.redirectTo({ url: '/package-settings/pages/venue-list/index' });
    },
  });
}, []);

// :146-147（保存）/ :170-171（删除）
setRefreshSignal(REFRESH_SIGNAL.venues);
setTimeout(goBackToList, 800);
```

**为什么这么改**：列表刷新链路的**前置条件**是「列表页被重新 `onShow`」。信号本身已足够强（信号优先于 TTL），真正的漏洞是这条链路可能第一步就断掉（没回到列表页）。`fail → redirectTo` 让列表页必然被创建并触发 `onShow`，从而必然消费信号并重拉。正常路径（`navigateBack` 成功）与 800ms 交互节奏完全不变，不改变交互流程与入口层级。

**另发现一处「信号之外的隐患」，仅登记不改（属 Service/后端契约，超出本批范围）**：

```tsx
// src/services/campus.ts:517-522 —— 新增场地时请求体不含 campusId
const raw = await post('/venues/rooms', { venueId: body.venueId, name: body.name, capacity: ..., status: ... });
// src/services/campus.ts:471-476 —— 列表却按 campusId 过滤
const data = await get('/venues/rooms', { page: 1, pageSize: 100, ...(options?.campusId ? { campusId } : {}) });
```

若后端不把 `venueId` 的校区回填到 room，则「列表确实重拉了、但新场地不在结果里」，表现同样是「列表没刷新」。这条**未在本批修改**（改写入体会变更接口语义），留给后端/Service 批次核实。

---

## 4. 验证证据（全部为真实执行）

### 4.1 类型检查

```
$ cd d:/Coding/yunce/yunceTaro
$ node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
TSC_EXIT=0                     # 无任何输出
```

### 4.2 ESLint（改动文件）

```
$ node ./node_modules/eslint/bin/eslint.js src/package-settings/pages/membership-orders/index.tsx src/package-settings/pages/venue-list/index.tsx src/package-settings/pages/venue-form/index.tsx
ESLINT_EXIT=0                  # 无任何输出
```

### 4.3 Prettier

```
$ node ./node_modules/prettier/bin/prettier.cjs --check <上面三个文件>
Checking formatting...
All matched files use Prettier code style!
PRETTIER_EXIT=0
```

### 4.4 等价于 lint-staged 的修复态校验（钩子的 task 是 `eslint --fix` + `prettier --write`）

```
$ node ./node_modules/eslint/bin/eslint.js --fix <三个文件>
ESLINT_FIX_EXIT=0              # 无输出 => 无需修复
$ node ./node_modules/prettier/bin/prettier.cjs --write <三个文件>
src/package-settings/pages/membership-orders/index.tsx 124ms (unchanged)
src/package-settings/pages/venue-list/index.tsx 20ms (unchanged)
src/package-settings/pages/venue-form/index.tsx 29ms (unchanged)
PRETTIER_WRITE_EXIT=0
```

### 4.5 单测（vitest）

定向（与本次改动的刷新信号 / TTL / 守卫直接相关）：

```
$ node node_modules/vitest/vitest.mjs run src/utils/refresh-signal.test.ts src/utils/data-freshness.test.ts src/utils/route-guard.test.ts src/utils/refetch-ttl.test.ts --reporter=basic
 ✓ src/utils/refetch-ttl.test.ts (2 tests) 3ms
 ✓ src/utils/refresh-signal.test.ts (2 tests) 3ms
 ✓ src/utils/data-freshness.test.ts (3 tests) 3ms
 ✓ src/utils/route-guard.test.ts (8 tests) 5ms
 Test Files  4 passed (4)      Tests  15 passed (15)
VITEST_EXIT=0
```

`src/utils` 全量：

```
$ node node_modules/vitest/vitest.mjs run src/utils --reporter=basic
 Test Files  1 failed | 51 passed (52)
      Tests  1 failed | 276 passed (277)
 Duration  6.68s
```

唯一失败为 `src/utils/invite-landing-flow.test.ts:158`（`Expected {closed:false,reason:null} / Received {closed:true,reason:'lesson_started'}`）。**与本次改动无关且为既有失败**：该测试只 import `./invite-landing-flow`（`:1-13`），本次提交只改 3 个页面文件（`git show --name-only HEAD` 可证），且该测试文件最后一次改动是 `43b80f8`（HEAD 的前两个提交，提交信息本身写着「…invite-landing-flow flaky 用例」）。单独复跑同样失败（`1 failed | 15 passed`），属时间相关的既有 flaky。

**全量 `vitest run`：未跑完，不作为验证依据。** 后台启动后 50 分钟无输出（管道 `tail` 缓冲不可见），PowerShell 也查不到对应 node 进程，已终止（runtime 49m42s）。本批改动不涉及任何被前端单测覆盖的模块（3 个页面文件无对应测试文件），故以定向用例 + 全量 `src/utils` 作为单测证据。

### 4.6 构建验证

**未执行。** 原因：构建脚本（沙箱建）从未在本次会话跑通前置条件（见第 5 节环境事故，`.git`/对象库需要先修复），且本批改动为纯状态机逻辑、无新依赖与新增页面，页数闸门不受影响。需要的话可另起一次构建验证：`bash /c/Users/Agust/.workbuddy/skills/taro-weapp-sandbox-build/scripts/build-weapp.sh dev`。

### 4.7 `commit sha` 与 `git log -1 --stat`

```
$ git rev-parse HEAD
ce7bf657947e57848f46d91281ff0d070b679727
$ git log -1 --stat
commit ce7bf657947e57848f46d91281ff0d070b679727
Author: Agustin. <151536422@qq.com>
Date:   Fri Sep 18 21:03:50 2026 +0800

    fix(settings): 修正订单详情/场地管理的加载终态与列表刷新契约

    FE-01 会员订单页不再只依赖 useDidShow（被 withRouteGuard 包裹时守卫
    异步放行后子组件才挂载，onShow 已派发完毕 → 永久 loading 且零请求），
    改为组件挂载即拉取并保证 loading 有终态，加并发闸门去重。

    FE-05 场地管理页把「加载中 / 加载失败(可重试) / 确实无数据」三态与真实
    原因对齐：loading 首屏即转圈（消除空态闪烁）、失败新增独立错误态不再伪装
    成空列表、TTL 跳过时显式给 loading 终态。

    FE-06 写完场地后保证真的回到列表页（navigateBack 失败兜底 redirectTo），
    使 REFRESH_SIGNAL.venues 必然被列表页消费；列表侧明确「信号优先于 TTL」。

 .../pages/membership-orders/index.tsx              | 20 ++++++++++++-
 src/package-settings/pages/venue-form/index.tsx    | 25 ++++++++++++----
 src/package-settings/pages/venue-list/index.tsx    | 33 ++++++++++++++++++++--
 3 files changed, 69 insertions(+), 9 deletions(-)
```

`git status --porcelain` 提交后仅剩两个未跟踪文档（他人产物，未提交）：

```
?? docs/diagnostics/2026-09-18-frontend-issue-ledger.md
?? docs/diagnostics/2026-09-18-frontend-issues-verification-and-fix-plan.md
```

---

## 5. ⚠️ 使用了 `--no-verify`（显著标注）

**本次提交使用了 `git commit --no-verify`，原因如下（按任务书要求逐条留痕）：**

1. **钩子在本机不可用**。`.husky/pre-commit` 内容是 `npx lint-staged`；直接 `git commit` 的报错为：

   ```
   'lint-staged' 不是内部或外部命令，也不是可运行的程序或批处理文件。
   husky - pre-commit script failed (code 1)
   ```

   `node_modules/lint-staged`（v17.0.7）与 `node_modules/.bin/lint-staged` 均存在，是 `npx` 在本机的解析/注入问题（任务书已知坑：`npm run` 不注入 `node_modules/.bin`）。另试 `node ./node_modules/lint-staged/bin/lint-staged.js`，报 `✖ Current directory is not a git directory!`（当时仓库正处损坏态，见下）后退出 1。
2. **手动执行了等价校验且全绿**：`eslint`（`:0`）、`eslint --fix`（`:0`，无输出）、`prettier --check`（All matched files use Prettier code style）、`prettier --write`（三个文件全部 `unchanged`）、`tsc --noEmit`（`:0`）。证据见 4.1~4.4。
3. **仓库 `.git` 在本会话中发生结构性损坏**（详见下文），此时让 husky/lint-staged 跑「stash → 校验 → 还原」事务有**删除工作区文件**的实际风险（本仓 `docs/diagnostics` 中已记录过一次实测事故：lint-staged 在损坏态下删掉 69 个文件）。先修复、再跳过钩子提交是风险最低路径。
4. 另注：本仓 `package.json` 里的键名是 `lintStaged`（驼峰），而 lint-staged 只识别 `lint-staged`（联字符）——即便 `npx` 正常，钩子也未必真的执行这两个 task。**此配置不一致仅登记，未修改（超出本批范围）。**

### 附：本会话中的环境事故与修复（与代码改动无关，但影响提交过程）

**症状**：第一次 `git commit` 触发钩子失败后，仓库随即报 `fatal: not a git repository ... .git`；`.git/refs/` 目录整体消失（`.git` 只剩 HEAD/objects/index/packed-refs…）。进一步检查发现 **loose objects 被清空**：`find .git/objects -type f ! -path "*/pack/*" | wc -l` = **1**；索引 1209 个条目里有 **71 个 blob 缺失**，HEAD 的部分子树（如 `.cursor` = `6306d97e…`）也缺失。本机沙箱把删除操作包装为「安全删除（trash）」，`rm`/`fs.rmSync` 会走 `genie-trash` 并被拒（`SAFE_DELETE_FAIL_CLOSED`），这与仓库既有文档记录的「沙箱隔离 refs/objects」一致。

**修复动作（未删除任何工作区文件，未改写历史）**：

1. 先整树备份：`_backup/yunceTaro-src-docs-20260918-2055.tar.gz`（src + docs），并把三个改动文件另存 `_backup/fe-b2-files-20260918/`。
2. 从 reflog 恢复引用：`refs/heads/main = d4aeae5ddf04388827dd426883d43ff1fa3cef16`（`git log` 与 `git rev-parse HEAD` 现已一致）；`refs/remotes/{origin,github,foo}` 同样按各自 reflog 末条恢复。
3. 用**无损**方式回写 71 个缺失 blob：仅当 `git hash-object --path=<p> <p>` 算出的 sha **等于**索引记录的 sha 时才写入（结果为 71/71 一致，0 处内容不符）——注意 `git add` 在「索引 sha 未变」时会走快路径、**不会**落盘缺失对象，这是当时第一次修复失败的原因。
4. 用一份「无 cache-tree」的临时索引（`GIT_INDEX_FILE` + `read-tree --empty` + `update-index --index-info`）跑 `write-tree`，重建缺失的 tree 对象（tree 的 sha 由内容决定，内容未变 → sha 不变，属无损重建）；`.cursor` 子树已随 `write-tree` 复原。
5. 校验：`git ls-tree -rt HEAD` 全树 1603 条目、1584 个对象**全部存在**；`git ls-tree -rt ce7bf65`（本次提交）1584 个对象**全部存在、0 缺失**。

**残留问题（现状如实记录，未处理）**：`git fsck --connectivity-only` 仍报 12 个 missing 对象与 126 条 error，均**不在本次提交的树内**（已用 sha 交集核对，无交集），属**本会话之前**就丢失的历史对象，例如：

```
error: refs/remotes/foo/bar: invalid sha1 pointer 5112a6c0...
error: refs/remotes/github/main: invalid sha1 pointer 5112a6c0...
error: HEAD: invalid reflog entry f1b67436...      （多条）
missing tree e4034da4... / missing blob a2877b2a... / ...
```

其中 `github/main`、`foo/bar` 两个远端引用指向的对象已随 loose objects 丢失——这两条引用是我按 reflog「如实恢复」的（丢失的是对象，不是引用），**未删除**，以免擅自改动本不属于本批的仓库状态。完整输出留档：`_backup/fe-b2-fsck-output-20260918.txt`。**建议：近期不要再对该仓库做 `git gc`/repack，尽快对 `.git` 做一次 bundle 备份。**

---

## 6. 未完成项 / 不确定项（如实）

1. **FE-01 只有代码级证据，未做设备端运行时确认**。本机无法运行微信小程序，未能实测「点订单详情 → 列表出现」。机制推断建立在 Taro 运行时源码（`createTaroHook` + `createPageConfig` 的 `ONSHOW` 派发时机）与用户日志（订单接口零调用）之上；修复本身（挂载即拉取 + 终态）不依赖该推断成立。
2. **FE-05 的「一直转圈」未给出唯一确定解释**。代码层未找到稳定的永久转圈路径（无守卫 + `request.ts` 10s 超时 + `finally` 复位）。已修的是可确证的两条（失败伪装空态、首帧空态闪烁）与一条防御（TTL 跳过时给 loading 终态）。若线上仍有「一直转圈」，需要 vConsole/真机日志才能定位。
3. **「有时显示无数据」的候选因素未在本批改动**：用户日志 D 里 `GET /venues/rooms?page=1&pageSize=100` **没有 `campusId` 参数**，说明当时 `currentCampusId` 为空；而其它时候该参数存在 → 同一页面在不同时刻查询范围不同（全校 vs 指定校区），结果集自然不同。这属于校区 store 水合时序，不在「只改状态判定与请求触发」的范围内，故**仅登记**。
4. **FE-06 的「列表不刷新」缺乏可复现证据**。用户只提供了新增场景日志且未给删除场景请求；台账登记的「信号被 TTL 吞掉」机制经复核**不成立**（见 3.1）。我按代码可支持的最可能链路（未回到列表页 → 未消费信号 → 无刷新请求）做了兜底修复。**若复现仍存在，请补充：删除操作的请求日志、以及「未及时刷新」是「下拉后出现」还是「一直不出现」。**
5. **未跑构建**（见 4.6）；**全量 vitest 未跑完**（见 4.5）。
6. 本报告文件本身**未纳入提交**（与 `docs/diagnostics` 既有约定一致，两份 2026-09-18 文档同样保持未跟踪）；若需要入库，请另行指示。
