# 小程序请求与缓存策略（落地说明）

> 与「数据分级 / Tab TTL / Store TTL / 写后失效」方案对齐。不引入 React Query。

## 数据分级

| 级别 | TTL 常量                    | 典型数据                                  |
| ---- | --------------------------- | ----------------------------------------- |
| L0   | `TTL.payment` / `TTL.quota` | 支付、履约、配额                          |
| L1   | `TTL.tab`（60s）            | 首页 / 课表辅数据 / 数据中心 / 我的主数据 |
| L2   | `TTL.list` / `TTL.lead`     | 学员、班级、教师、分类、模板、卡种、线索  |
| L3   | `TTL.campus`（15min）       | 校区列表                                  |

工具：[`src/utils/data-freshness.ts`](../../src/utils/data-freshness.ts)、[`src/utils/refetch-ttl.ts`](../../src/utils/refetch-ttl.ts)。

## Tab 闸门

- 首页 / 课表：既有 `isWithinRefetchTtl`
- 我的 / 数据：`useDidShow` 跳过首屏后按 TTL 再拉；配额可用更短 TTL，支付成功写 `REFRESH_SIGNAL.profileQuota`

## Store 约定

带读缓存的 Store 必须提供：

- `fetch...(..., force?: boolean)`
- `invalidate` / `invalidateCache`

写成功后调用 invalidate；下拉刷新传 `force: true`。

## 写后刷新信号

[`src/utils/refresh-signal.ts`](../../src/utils/refresh-signal.ts)

| Key                           | 用途                 |
| ----------------------------- | -------------------- |
| `schedule`                    | 点名/补录后课表重拉  |
| `membership` / `profileQuota` | 支付或兑换后配额强刷 |
| `students`                    | 学员列表强制重拉     |
| `home`                        | 预留                 |

## 切机构 / 切校区

[`resetDomainCaches('all' | 'campus')`](../../src/utils/reset-domain-caches.ts)

- `switchIdentity` / `applyAuthPayload` / `signOut` → `all`
- `setCurrentCampusId` 真切换 → `campus`

## 会员页

- 配额 / 订单态：进页必拉（L0）
- SKU：`paymentService.listSkus` 内存 60s；`invalidateMembershipSkuCache` 在域重置时清空

## 影响面补丁（审查后同步）

写路径若绕过 Store 直打 Service，在 TTL 下会假绿。已修正：

- 卡种表单/列表：走 `useCardTypeStore`；下拉刷新 `fetchList(true)`
- `course-category.invalidateCache`：恢复默认分类，避免串机构
- `course-template` 按 `entity.categoryId` 更新缓存桶
- 删除分类时 `invalidate` 模板缓存
- 排课相关写后统一 `emitScheduleRelatedRefresh()`（schedule / home / classes 三分信号，避免互相抢 consume）
- 首页只消费 `home`；课程管理班级辅数据消费 `classes` + `TTL.list`
- 学员：家长列表走 `fetchByParent` TTL；表单/调班写 `REFRESH_SIGNAL.students`
- 切校区不再清 SKU 短缓存（仅切机构 `all` 时清）

## 开发观测

`TARO_ENABLE_LOCAL_DEBUG=true` 时，1s 内重复 GET 会 `console.warn('[request-dedup] ...')`。
