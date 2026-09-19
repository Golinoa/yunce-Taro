# 「进入页面秒进」方案 · 红队复核与修正（2026-09-19）

> 原始提案 → 独立只读复核会话红队审查 → 主会话逐条验证 → 修正后方案。
> 复核评分：**6/10（方向对，执行细节踩了三个已知坑）**；修正后预计 **8+**。

## 一、原始提案（初版）

- P0 去掉阻塞：loading 仅在"首次且无数据"时全屏；loading 延迟 ~250ms + 最短显示 300~500ms。
- P1 加本地快照（照 `useCampusStore` 范式）：冷启动首帧渲染上次数据。
- P2 SWR：进入立即渲染快照 → 异步拉新 → 直接 setState 新数组（不做深比较）。
- P3 预取：`preloadRule` / 上一页预取。

## 二、被证伪的三条（均已本会话复核确认）

| # | 原表述 | 判定 | 证据 |
|---|---|---|---|
| 1 | P0 用"延迟显示 + 最短显示"由自己实现 | **重复造轮子 + 会变慢** | `src/components/Loading/index.tsx:20` 已有 `LOADING_APPEAR_DELAY_MS = 120` 与 `delayMs` prop；`src/hooks/useDelayedLoading.ts:30` 已有阈值 Hook（默认 500ms，16+ 页面在用）。两套叠加 → 600ms 请求要转 900ms+，**比现状更慢** |
| 2 | P1「照 campus store 范式」建快照 | **选到仓库最弱范式** | `src/stores/campus.ts:48` 的 `CAMPUS_SNAPSHOT_KEY` 是**单一全局键，无 org/user/role/campus 维度**，靠"列表空则删键 + `resetDomainCaches` 手动挂载"兜底。而初版方案自己写的边界是"scope 用 org+campus+role"——**自相矛盾** |
| 3 | P3 用 `preloadRule` 预取 | **已完成项** | `src/app.config.ts:197-214` 已有规则，且 :200 已做"蜂窝网络不预下载"的克制处理 |

### 另有一条**致命写法**（复核发现，已验证）

若按 hook 文档"drop-in 替换 `useState(true)`"使用 `useDelayedLoading`：
- 该 Hook 初值 `useState(false)`（`src/hooks/useDelayedLoading.ts:31`）；
- 冷启动首帧 `loading=false` + `rooms=[]` → 命中 `venue-list:139` 的 **`Empty`「暂无场地」**；
- 即 **复活 `src/package-settings/pages/venue-list/index.tsx:33-34` 注释里专门修掉的 bug**（"若初值为 false 会先闪一帧『暂无场地』"）。

**结论：`venue-list` 必须保留 `useState(true)`；延迟只通过 `<Loading delayMs={350} />` 表达。**

## 三、复核确认成立的

- ✅ `withCache` **不是 SWR**：`cache-helpers.ts:21-22` 命中即 return；根因 `cache-store.ts:111` 过期返回 null。全仓无任何 SWR 实现（`withCache` 仅 3 个调用方：`course-template` / `course-category` / `card-type`）。
- ✅ 缓存基座已开（`cache-flags.ts:15` `cacheEnabled: true`）、`roomService.getList` 未接缓存。
- ✅ 28 个页面是"`useState(true)` + `import Loading`"阻塞模式（交集实测）。
- ✅ `venues/rooms` 已被 `docs/diagnostics/2026-09-19-frontend-cache-layer-plan.md §1.3 D3` 列为**可长缓存**、§3.3 定为写后失效 → 接缓存**有既有计划背书**。

### 对"每次进入都转圈"的精确化（重要）

初版说"必然先转圈"过强，复核指出 `venue-list:102` 的 `if (loading && rooms.length === 0)` guard 已生效。**两者都对，取决于路径**：

- **从场地表单 `navigateBack` 返回**：页面实例存活、`rooms` 保留 → **不转圈**（今天已是"先渲染旧数据 + 后台刷新"）。
- **从「我的」重新进入**：`venue-list` 已被卸载，**fresh mount** → `rooms=[]` → **必然转圈**。← **用户实际感受到的慢在这里，也正是 P1 快照要解决的目标场景。**

## 四、修正后的执行顺序

| 序 | 事项 | 与初版差异 |
|---|---|---|
| 1 | `cache-store` 新增 `peekCache`（**忽略 TTL** 的读取）+ `cache-helpers` 新增 `withCacheSWR`（复用 `runWithInflight` 做并发去重） | **替代**初版 P1「自建 store」 |
| 2 | `venue-list` 接 1，`rooms` 冷启动首帧直接命中缓存 | 初版 P1，**换基座** |
| 3 | `venue-list` **保留** `:102` guard 与 `useState(true)`，仅用 `<Loading delayMs={350} />` 防闪 | **修正**初版 P0 |
| 4 | 写后失效沿用现有 `REFRESH_SIGNAL.venues` + `invalidateDomain`（**一行不动**） | 初版 P2，机制不变 |
| 5 | 低风险字典/配置页（`campus-settings/{holidays,notify,pay-day,sub-campus,subjects}`）批量复制范式 | 初版 Q7 分批 |
| 6 | 骨架屏（照 `TrialBookingSkeleton` 范式，行高对齐场地卡片） | **新增**，体验优于 spinner |
| — | ~~P3 `preloadRule`~~ | **删除**（已完成、收益低） |

### 硬约束（修正版）

1. **不改 `getCache`** 的过期返回 null 语义（`cache-store.ts:111`）——会破坏 `withCache` 的 5 个既有测试与 3 个 store 行为。
2. **不新写延迟/最短显示逻辑**（R20「先查后写」；已有 `Loading.delayMs` / `useDelayedLoading`）。
3. **不为 rooms 自建 store**——R50 冻结条款针对"校区数据双时钟"，自建 store 会制造同类问题第二实例。
4. **不动 `venue-list` 的「返回即强刷」与 `REFRESH_SIGNAL.venues`**——R40 `40-data-and-services.md:48` 硬性要求，且是 2026-09-19 场地事故的修复成果。
5. **"直接覆盖新数组"仅适用于 venue-list**。作通用规则有反例：R90 `90-scroll-interaction.md:35`（ScrollView 内 setState 会丢滚动位置）、行级展开/编辑态（`venue-form:54,68` 的 `formInitializedRef` 防覆盖用户输入）。

## 五、页面分级（28 个同类页）

- **低风险（优先改）**：`campus-settings/{holidays,notify,pay-day,sub-campus,subjects}`、`venue-list`（接口正落在 §1.3 D3 可长缓存）。
- **中风险（需真机回归）**：`booking`、`card-form`、`category-form`、`parent-lesson-notes`、`monthly-flow`、`staff-invite`、`notification-send`、`message-auth`、`student-detail`、`trial-records`。
- **绝对不改（R07 冻结链路 / 资损域）**：`campus-invite-landing`、`invite-register`、`invite-landing`、`store-referral-landing`（`**/invite*`、`**/store-referral*` 属触发 glob，改行为须先问）；`membership-orders`（下单/开通）；`student-transfer`、`member-card-issue/edit/detail`、`renewal-reminder`（课时包资损）；`attendance-anomaly`、`follow-record-form`（审批）。
- **注意**：`campus-settings/index.tsx:360` 已接入 R50 冻结的校区 harness，改其 loading 需先修订 R50 文档，不得顺手改。

## 六、治理项（未决）

- `cache-store.ts:4` 文件注释仍写"交付形态：休眠…`cacheEnabled=false`（默认）"，与 `cache-flags.ts:15` 的 `true` **文档-代码漂移**，应修正。
- `docs/diagnostics/2026-09-19-frontend-cache-layer-plan.md:183` 标注"发布前须回签 §8 Q1/Q2/Q5"（资损清单 / 家长↔教师隔离 / serverTime）**尚未签字**；本次扩大 rooms 缓存使用面应先确认该回签状态。

## 七、一句话结论

方向（持久化慢变数据 + 削减进入阻塞感知）与仓库既有结论一致；但初版**执行细节踩了三个已知坑**（复活 venue-list 闪空态、选到最弱缓存范式、重复实现已有能力）。按上表修正后可直接落地。
