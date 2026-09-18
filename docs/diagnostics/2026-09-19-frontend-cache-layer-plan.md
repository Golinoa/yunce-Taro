# 前端缓存层专项计划（D1/D2/D3 · 资损级护栏版）

> 配套：`2026-09-19-frontend-performance-review-plan.md` §3 缓存判据 + §4 守卫。
> 状态：**已交叉复核（Red-Team 2026-09-19）**。A1/B1/B4 可实施；B2 条件实施；B3 待 §8 确认。严禁未确认就动持久化缓存（B 档全部受 `cacheEnabled` 门控，默认关）。
> 原则：**评估≠改造；高 ROI 低风险先落地；资损级改动带护栏 + 灰度 + 自动化回归**。

---

## 0. 为什么现在做、为什么分两档

P1 已完成的 TTL 守卫（`data-freshness.ts` 的 `shouldRefetch` + 组件 `useRef`）是**纯内存、随页面卸载即失**的去重，不落盘、不跨页、不跨会话——所以它**零资损风险**，可以放心全量铺。

但"缓存层"真正的价值（砍首屏耗时、弱网可用、离线兜底）来自**持久化落盘**。一旦落盘，就出现三个资损级风险：**串租户**（A 机构读到 B 机构卡面）、**写后不失效**（买了课还显示旧余额）、**容量/异常静默**（缓存写满或异常导致白屏/数据错乱）。因此本专项分两档推进：

| 档 | 内容 | 资损风险 | 可否现在做 |
|---|---|---|---|
| **A 档 · 内存去重扩面** | 把 P1 的 TTL 守卫范式铺到更多"列表/慢变"页（非资损域） | 无（不落盘） | ✅ 可直接排期 |
| **B 档 · 持久化缓存层** | 落盘缓存 + 全套 §4 护栏 + 灰度 | **资损级** | ⛔ 需本计划确认 + 护栏落地 + 自动化回归后才做 |

---

## 0.5 交叉复核结论（Red-Team · 2026-09-19 · 只读独立复核）

> 红队对计划 + 现有代码做了只读交叉复核，下列结论已并入上方护栏（G1–G7）与批次裁决。

1. **路径修正**：`membership-cache.ts` 实际位于 `src/services/`（原 §2/§3 标错为 `src/utils/`）。
2. **`prefetchInflight` 不可复用**：其为 `membership-cache.ts` 模块私有变量，cache-store 须**自建** inflight（修订 G4）。
3. **`serverTime` 当前不可用**：前端响应无服务端时间戳，G7 暂以 `Date.now()` 降级并标注，待后端支持。
4. **键公式缺角色维度**：G1 命名空间已补 `role/端`，否则同一用户家长↔教师双角色会串缓存（关联 §8 Q2）。
5. **G2 版本清空缺触发点**：须在 app 启动钩子调用 `clearIfVersionMismatch()`（B1 落实）。
6. **G3 切换覆盖缺口**：`resetDomainCaches` 现有调用方仅 `auth.tsx`(3×,all) + `campus.ts`(campus)；**role-switch / 家长↔教师切换无调用方** → B1 须补（修订 G3）。
7. **预存在的资损隐患（独立于本计划）**：`membership-cache.ts` 已持久化配额缓存（`peekMembershipQuotaCache` + `TTL.quota=20s`）用于首帧，而 §1.1 将 `organization/quota-usage` 列为 D1 禁缓存。该行为现网已在跑，**非本计划引入**；本计划**不改其 prod 行为**（避免负向影响），单独列为待业务确认项（§8.5），不在 B1 范围内。

### 修订后批次裁决（go/no-go）
| 批次 | 裁决 | 说明 |
|---|---|---|
| **A1 内存去重扩面** | ✅ GO | 纯内存不落盘，零负向，可立即排期 |
| **B4 门禁与度量** | ✅ GO | 仅度量/门禁，只读，安全 |
| **B1 缓存基座 + bug 修复** | ✅ GO-WITH-CONDITIONS | 自建 inflight；补 G1 role 维度 + G3 调用方 + G2 启动钩子；强制所有 `get()` 受 `cacheEnabled` 门控且禁用早返回 null；serverTime 降级 |
| **B2 D3 字典长缓存** | ⚠️ 条件 GO | 依赖 B1 完成 + G3 调用方就位；字典为机构级无角色差异，资损风险最低，可休眠交付 |
| **B3 D2 写后失效** | ⛔ NO-GO | 待 §8 Q1 资损清单复核 + refresh-signal 域 key/详情生产者补全 + 配额矛盾定夺后方可实施 |

> **本轮（2026-09-19）实施范围**：A1 + B1 + B4。B2 条件交付（休眠），B3 暂缓待确认。所有 B 档代码受 `cacheEnabled=false` 门控，**prod 行为完全不变**。

---

## 1. 资损清单（绝对禁缓存 / 写后失效，来源 §3.1 / §3.3）

**1.1 绝对禁缓存（TTL=0，stale 即资损）—— D1**
- 支付：`payment.getOrder` 订单态
- 配额：`organization/quota-usage`（超额售卡 / 超员开班）
- 排课冲突：`schedules/check-conflict`（教师/教室双占）
- 课时包：`package.deductHours`、`getActiveByStudent`、`remainingHours`（**直接资损**）
- 审批：`leave` 审批
- 上传：`upload token`
- 触达：`notification` 发送与订阅额度（重复推送）
- 关系：`student-parents` 绑定、`organization bindings`（**跨租户**）

**1.2 写后失效（不是 TTL，写成功立即 invalidate）—— D2**
- 权限配置与角色授予
- 会员 SKU 改价
- 校区·场地·教室·科目 CRUD
- 学员·班级·教师列表
- 充值 / 退费

> 这些接口**允许缓存，但缓存键必须挂失效入口**，写成功后同步 `setRefreshSignal` / `invalidate`。

**1.3 可长缓存（分钟~小时，落盘安全）—— D3**
- 字典类：course-category、card-type、course-template、package-template、subjects、venues、rooms、holidays
- 校区 15min
- 历史月 `statistics.getFullYear`

---

## 2. 护栏清单（B 档实施必须逐条满足，来源 §4）

| # | 护栏 | 落地要求 | 关联现有代码 |
|---|---|---|---|
| G1 | **key 命名空间** | 必须含 `orgId + userId + role/端 + campusId + schemaVersion + 域`（已补 role 维度，避免家长↔教师双角色串缓存） | `membership-cache.ts:17-18` 现**无租户维度** → 首帧可读到上一租户卡面，必须改 |
| G2 | **版本护栏** | 启动钩子比对 `APP_VERSION` 不符即整体清空；读取做结构校验，失败丢弃不渲染（防白屏） | 新建 `clearIfVersionMismatch()`，于 app 启动调用 |
| G3 | **失效入口** | 新增持久缓存**必须挂进 `utils/reset-domain-caches.ts`**，覆盖：切机构 / 切校区 / 登出 / role-switch / 家长↔教师 **100%** | `reset-domain-caches.ts` 现仅 `auth.tsx`(3×,all)+`campus.ts`(campus) 调用；**role-switch / 家长↔教师切换无调用方 → B1 须补** |
| G4 | **并发去重** | cache-store **自建** inflight 去重；写成功后同步失效 | ⚠️ `prefetchInflight` 为 `membership-cache.ts` 模块私有，**不可复用**，cache-store 须自建 |
| G5 | **容量上限** | 单 key ≤1MB、总 ≤2MB；`setStorageSync` catch **须 `logError` 埋点**（不可静默） | `membership-cache.ts:48-54` 现**静默 catch** → 改 |
| G6 | **回退开关** | 全局 `cacheEnabled`，按机构/版本灰度，关即直连——**不靠 revert**；**所有 `get()` 在禁用时早返回 null**，杜绝静默读缓存 | 新建 `config/cache-flags.ts`（默认 **false**） |
| G7 | **TTL 时间源** | 优先服务端时间戳；**现前端响应无 `serverTime` → 暂以 `Date.now()` 降级并标注**，待后端支持 | 需后端在响应头/字段给 `serverTime`（G7 暂降级） |

---

## 3. 现状病灶盘点（实施前必读）

| 位置 | 问题 | 风险 |
|---|---|---|
| `src/services/membership-cache.ts:17-18` | 缓存 key 无租户维度 | **串租户**（资损级） |
| `src/services/membership-cache.ts:47` | `setStorageSync` 异常静默 catch | 容量满/异常无感知，可能白屏 |
| `src/services/data-center.ts` 与 `src/package-statistics/services/data-center.ts` | **双份实现** | 违反 L1「service 唯一出口」，缓存策略不一致 |
| `src/utils/reset-domain-caches.ts` | 切机构/校区/登出/role-switch/家长↔教师覆盖不全 | G3 不达标，切换后 stale |
| `src/utils/refresh-signal.ts` | 已建立 `REFRESH_SIGNAL` 写入机制，但**缺 venues 之外的更多域 key**，且详情页无生产者 | D2 失效信号需补全 |

---

## 4. 实施批次

### 批次 A1 · 内存去重扩面（低风险，可立即排期）
- 把 P1 范式（`lastFetchAtRef` + `shouldRefetch` + `consumeRefreshSignal`）铺到更多**列表/慢变**页（对照 §3.3 D2、§3.2 D3 的列表类）。
- 跳过一切 §1.1 D1 接口对应页。
- 沿用 P1 的"主会话审查 + 子会话执行 + 备份标签 + 推 `ci-*` 跑门禁"流程。

### 批次 B1 · 缓存基座（先造安全的工具，不接业务）
- 新建 `src/utils/cache-store.ts`：最小可用持久缓存封装——`namespace(域)` → key 拼 `orgId+userId+campusId+schemaVersion`；`get(key, ttlMs, serverTime)` 结构校验失败即丢弃；`set` 单 key≤1MB/总≤2MB 超限拒绝并埋点；`setStorageSync` try/catch 全部 `logError` 不静默；复用 `prefetchInflight` 做 inflight 去重。
- 新建 `src/config/cache-flags.ts`：`cacheEnabled`（默认 **false**，灰度开启）+ 按 `orgId` 白名单。
- 改造 `membership-cache.ts` 接入 G1/G5（补命名空间 + 去静默）。
- 补全 `reset-domain-caches.ts` 的 G3 切换事件。

### 批次 B2 · D3 长缓存落盘（先吃最安全的）
- 字典类（card-type / course-template / subjects / venues / rooms / holidays）+ 校区 15min，用 B1 基座落盘。
- 这些不改价频繁、错一位只显示不对、刷新即恢复，**资损风险最低**，作为灰度首发。

### 批次 B3 · D2 写后失效落盘
- 权限/角色、会员 SKU、学员/班级/教师列表、充值退费。
- 每个写成功路径**必须** `setRefreshSignal` 相应 key 或 `cacheStore.invalidate(域)`。
- 需补 `refresh-signal.ts` 缺失的域 key + 详情页返回生产者信号。

### 批次 B4 · 门禁与度量固化（P4）
- 把 `request-instrument.ts` 的 `summarizeColdStart` / `countByUrl` 接入真机采集，量化 B 档前后首屏请求数/耗时。
- 补 `build:weapp:prod` 的体积门禁（计划 v2 修订 #12：现 postbuild 1.5MB 门禁未执行）。

---

## 5. 灰度与回退方案

1. **开关先行**：`cacheEnabled` 默认 `false`，所有 B 档改动在开关关闭时**完全走直连**，行为等价于今天。
2. **白名单灰度**：按 `orgId` 白名单放量（如先 1 个内部测试机构），观察对账无差异再扩。
3. **一键回退不靠 revert**：出问题只需把 `cacheEnabled` 置 `false`（配置/后端开关），无需发版回滚。
4. **版本护栏兜底**：`APP_VERSION` 不符自动清空，避免旧缓存结构污染新版本。
5. **监控项**：缓存命中率、setStorageSync 异常数（G5 埋点）、`consumeRefreshSignal` 触发频次（验证 D2 失效生效）。

---

## 6. 验证与回归（B 档必做）

- **写后失效自动化测试**：mock「写入成功 → 立即读取应命中失效（回源）」用例，覆盖 B2/B3 每个接入域。
- **串租户测试**：A 机构写缓存、切到 B 机构读，断言读不到 A 的数据（G1）。
- **容量/异常测试**：注入 `setStorageSync` 抛错，断言不白屏、有 `logError`、降级直连（G5）。
- **CI 门禁**：B 档每批一 commit，推 `ci-*` 标签跑 `npm run check`（typecheck+lint+format）→ coverage → `build:weapp:dev`，全绿方可合并。

---

## 7. 明确不做（防过度设计）

1. 不为统一而统一重构（Zustand ↔ React Query 二选一）。
2. 不给 §1.1 D1 清单强一致数据加任何缓存（列表例外：可缓存 + 详情强制校验 + 写后失效）。
3. 不引入重量级缓存框架（只做 `cache-store.ts` 最小封装）。
4. 不做无量化支撑的 `memo` 化 / 组件拆分。

---

## 8. 需要你（业务方）确认项

1. **复核 §1.1 资损清单**是否遗漏（尤其有没有其他"stale 即亏钱"的接口）。
2. **家长端与教师端是否共享缓存 key**——判据：不应共享（G1 命名空间已区分，需你确认业务上确实隔离）。
3. **后端能否在响应给 `serverTime`**（G7 前置；若不能，B 档 TTL 先用 `Date.now()` 并标注降级，待后端支持）。
4. **灰度首个白名单机构**选哪个（内部测试机构优先）。
5. **预存在的配额缓存是否处置**：`membership-cache.ts` 已持久化 `organization/quota-usage`（`peekMembershipQuotaCache` + `TTL.quota=20s`）用于首帧，而 §1.1 将其列为 D1 禁缓存。**本计划不改其 prod 行为**（避免负向影响），请你定夺：保留（20s 首帧优化，进页即刷新鲜值）/ 下线（严格 D1）。此为独立项，不阻塞 A1/B1/B4。

---

## 9. 建议的下一步动作（按你确认后的顺序）

1. **本轮（2026-09-19）已执行**：交叉复核 → 定稿 → A1（内存去重扩面）+ B1（缓存基座 + bug 修复，休眠于 `cacheEnabled=false`）+ B4（门禁/度量）→ 推送 + 跑 CI。
2. **B3（D2 写后失效）暂缓**，待你回签 §8 Q1–Q5（尤其 Q1 资损清单复核、Q5 配额缓存定夺）后实施。
3. B2（D3 字典落盘）条件交付（休眠），待 G3 调用方就位 + Q2 确认后灰度首发。
4. 每批推 `ci-*` 跑门禁，全绿合并；`cacheEnabled` 保持默认关，等你给白名单再开。

---

## 10. 2026-09-19 追加决策：产品未发布，免灰度

> 业务方拍板：产品尚未发布，无真实用户与对账压力，**取消灰度放量环节**。

1. `CACHE_FLAGS.cacheEnabled` 直接置 `true`（`constants/cache-flags.ts`）；开关**保留为紧急回退**（置 false 即全量直连，无需发版）。
2. **B2 已实施（D3 字典落盘）**：`card-type` / `course-category` / `course-template` 三域经 `utils/cache-helpers.ts` 的 `withCache` 接入（TTL.campus=15min，冷启动命中免网络）；作用域经 `utils/cache-scope.ts` 同步解析（profile storage + campus store）。
3. **B3 轻量版已实施（写后失效）**：上述三域 CRUD 成功后 `invalidateDomain`；`resetDomainCaches('all')` 连带 `clearAllCache()`（切机构/切身份/登出双保险）。
4. **重资损域维持不持久化**（权限/角色、会员 SKU、学员/班级/教师列表、充值退费）——内存守卫（TTL + refresh-signal）已覆盖，未发布阶段无对账压力；**发布前须回签 §8 Q1/Q2/Q5 并评估 D2 持久化**。
5. §8 Q4（灰度白名单机构）作废；Q3（serverTime）仍建议发布前由后端支持（现 G7 以 `Date.now()` 降级）。
