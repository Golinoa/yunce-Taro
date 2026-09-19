# 校区数据 Harness · 最终设计（冻结版）

> 背景：校区数据在首页/数据页/auth-index 出现过三套读取实现与两套自愈实现，且首页 RQ 中间层引入双时钟导致过"校区卡片永久空白"（2026-09-19 根治时临时以 RQ invalidate 自愈止血）。
> 本文是**最终方案**：全 app 校区数据统一到既有 harness（`useCampusStore`），一次性收敛后**冻结**。

---

## 1. 审核结论（2026-09-19，实施前）

| 消费点                        | 原实现                                                                   | 判定                                                     |
| ----------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| 首页 `pages/home`             | RQ query(`['campuses',role]`) + RQ invalidate 自愈 + selectCurrentCampus | ❌ RQ 为冗余中间层（双时钟，bug 根源）；自愈与数据页重复 |
| 数据页 `pages/statistics`     | didShow 手写自愈（ok===false→force）+ strict 派生                        | ❌ 自愈语义与首页不一致（语义本身正确，收敛为准）        |
| `package-auth/pages/index`    | mount 直调 fetchCampuses（无自愈）+ 第三份 currentCampus 派生            | ❌ 漏网：一次失败即空白                                  |
| 表单（student/schedule-form） | TTL 守卫下 fetchCampuses+fetchSubjects                                   | ✅ 写路径，保留                                          |
| campus-settings / store-entry | CRUD 后 force fetch                                                      | ✅ 写路径，保留                                          |

## 2. 最终 Harness（全 app 唯一）

**数据源与网络路径唯一**：`useCampusStore`

- TTL 15min（`TTL.campus`）+ 冷启动快照（`yunce_campus_list_snapshot`）；
- 写后失效：`resetDomainCaches`（切机构/切身份/登出）+ 写路径 force fetch；
- 派生唯一：`selectCurrentCampus(campuses, id, {strict?})`。

**读取+自愈唯一入口**：`useCampusList()`（stores/campus.ts，与 store 同源）

```ts
const { campuses, currentCampusId, currentCampus, loading, error, ensureLoaded } = useCampusList();
```

- `ensureLoaded()`：**全 app 唯一自愈实现** = `fetchCampuses()`；失败（返回 false）→ `fetchCampuses(true)` 强拉重试一次；`store.loading` 防并发；store TTL 防重复网络。可安全地在每次 `useDidShow` 调用。
- 需要身份闸门的页面（首页）：`useEffect(() => { if (ready) void ensureLoaded(); }, [ready])` + didShow 内 `if (ready) void ensureLoaded()`。

## 3. 页面规则（冻结）

1. **禁止**页面自写校区 fetch / 自愈 / currentCampus 派生——一律走 `useCampusList()`。
2. 写路径（CRUD、切换校区、入驻）继续直调 store action（force 语义），不受本规则约束。
3. **禁止**给校区列表再加 React Query 中间层（store 即新鲜度权威，双时钟已证伪）。
4. 修改本 harness 须先修订本文档并说明理由，不得顺手改。

## 4. 本次收敛迁移记录（一次性，行为对齐）

- `stores/campus.ts`：+`useCampusList()`（唯一自愈 + 派生内聚）。
- `pages/home`：删 campuses RQ query 与 RQ 自愈分支 → hook（ready 闸门保留，语义与修复后一致）。
- `pages/statistics`：didShow 手写自愈块 → `ensureLoaded()`（语义等价，即收敛基准）。
- `package-auth/pages/index`：换 hook（获得自愈 + 消除第三份派生）。
