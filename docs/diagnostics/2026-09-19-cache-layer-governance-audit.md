# 缓存层治理审计（护栏 G1–G7 + 计划 §8 回签项）

> 对象：`docs/diagnostics/2026-09-19-frontend-cache-layer-plan.md`
> 方法：逐条比对计划要求与**当前代码**（每行结论附 `文件:行` 证据）。
> 目的：为 §8 回签提供可签字的事实底稿，并列出尚未落实的缺口。

---

## 一、护栏现状（对照计划 §2）

| # | 护栏 | 现状证据 | 判定 |
|---|---|---|---|
| **G1** | key 命名空间四维（org+user+role+campus） | `utils/cache-scope.ts` 已解析四维并用于 `cache-store` 键；**但 `services/membership-cache.ts:17-18` 仍是 `yunce:membership:quota-v1` / `yunce:membership:sku-v1`，无任何租户维度** | ⚠️ **缺口**（计划 §2 G1 原文标注"必须改"） |
| **G2** | 版本护栏 | `utils/cache-store.ts:24-26` `CACHE_SCHEMA_VERSION` + `clearIfVersionMismatch`，已挂 app 启动 | ✅ 已落实 |
| **G3** | 失效入口 100% 覆盖 | `utils/reset-domain-caches.ts` 统一入口；调用方：`utils/auth.tsx:571`(switchIdentity) / `:639`(applyAuthPayload) / `:654`(signOut) + `stores/campus.ts:589`(切校区) | ✅ 已落实（计划要求补的 role-switch 已在） |
| **G4** | 并发去重 | `cache-store` 自建 inflight（不复用 membership 私有 inflight） | ✅ 已落实 |
| **G5** | 容量上限 + 不静默 | `cache-store.ts:28-31` 单 key 1MB / 总 2MB + `logError`；`membership-cache.ts:49-54` `writeStorage` 已从静默改为 `logError` | ✅ 已落实 |
| **G6** | 回退开关 | `constants/cache-flags.ts`（现 `cacheEnabled: true`）+ `isCacheEnabledForOrg`，禁用时 `getCache` 早返回 null | ✅ 已落实 |
| **G7** | TTL 时间源 | ✅ **已解决**：后端业务响应体无 `serverTime`，但网关返回标准 HTTP `Date` 头（实测 dev/prod 均可用）→ `utils/server-clock.ts` 校正偏移，缓存 TTL 改用 `serverNow()` | ✅ 已落地 |

---

## 二、计划 §8 回签项逐条结论

### Q1 · 复核 §1.1 资损清单是否遗漏 —— **发现缺口**

扫描全服务层"动钱/动课时/动配额"端点，以下**未列入 §1.1**：

| 端点 | 性质 |
|---|---|
| `/teachers/salary/execute-pay` | **实际发薪**（最典型资损） |
| `/teachers/salary/batch-confirm`、`generate-month`、`send-slip`、`/{id}/confirm` | 薪资核算/确认/发放链路 |
| `/lesson-debts/{studentId}/settle` | 课时欠费结清 |
| `/course-package-refunds` | 课时包退费 |
| `/data-center/salary` | 薪资经营数据 |

**现状风险评级：潜在（非现实）**——这些端点**当前都没有接入缓存**（无 `withCache`/`getCache` 调用点），所以今天不会产生旧值。风险在于**后续有人加缓存就踩**，且清单是"唯一事实源"，漏项会误导后来者。

**已执行（2026-09-19）**：上述端点已补进计划 §1.1（"薪资发放链路" + "课时结算 / 退费"两组增补项）。

### Q2 · 家长端与教师端是否共享缓存 key —— **G1 已隔离，但 membership-cache 例外，需业务确认**

- `cache-store` 侧：`utils/cache-scope.ts` 的键含 `role` 维度 → **已隔离** ✅。
- `membership-cache` 侧：键无任何维度 → **同一微信用户在家长 ↔ 教师之间切换时，会员页首帧理论上可能读到另一角色的卡面**；当前仅靠 `resetDomainCaches('all')`（切换时清）兜底。

**决策（已执行）**：**补键内租户维度**。理由：键内隔离后，即使某条切换路径**漏了 `resetDomainCaches`**，最坏结果也只是 miss 回源、**不可能串数据**——把"靠人记得清"换成"结构上不可能错"，这正是本项目历史上多次踩的坑（漏失效→静默脏数据）。代价极低（只是多些 miss，不会读到错数据），且是计划 §2 G1 的原文要求。

实现：键改为 `yunce:membership:quota-v1:{orgId}:{userId}:{role}` / `sku-v1:{orgId}:{userId}:{role}`（不含 `campusId`——配额与 SKU 与校区无关，带上只会白丢命中）；内存盒子额外记录写入时的作用域，作用域变化即视为未命中；失效改为**按前缀清**（键含维度后无法只删单个 key）。

### Q3 · TTL 时间源 —— **已解决（零后端改动，走 HTTP `Date` 头）**

证据（2026-09-19 实测 `curl -D -`）：`yunce-backend/src/admin/admin.system.service.ts:53` 是唯一返回 `serverTime` 的地方，业务响应体确实没有。

**结论（方案 2 落地）**：网关（dev = Cloudflare、prod = nginx）**均返回标准 HTTP `Date` 响应头且时间准确**（秒级精度，足够支撑分钟~小时级 TTL）。故新增 `utils/server-clock.ts`：

- `syncServerClock(res.header)` 在 `utils/request.ts` 的每个响应回调里调用一次，算出偏移量并落盘（跨冷启动有效）；
- 缓存 TTL 一律改用 `serverNow()`（`utils/cache-store.ts`、`services/membership-cache.ts`）；
- 护栏：无头 / 解析失败 → 保持既有偏移；偏移 > 7 天 → 忽略（防中间件伪造 `Date`）；偏差 ≤ 1s → 归零且**不落盘**（常规用户零写入）。
- 单测 `src/utils/server-clock.test.ts`（10 例）覆盖正常校正 / 秒级容忍 / 降级 / 异常头 / 跨冷启动恢复。

**故 Q3 无需后端排期**（后端仍可选做 `serverTime`，届时把 `syncServerClock` 换成读响应体即可，接口不变）。

### Q4 · 灰度首个白名单机构 —— **已作废**（产品未发布，免灰度）

### Q5 · 预存在的配额缓存是否处置 —— **需业务定夺（唯一真实功能取舍）**

- 现状：`services/membership-cache.ts` 把 `organization/quota-usage` **持久化**（`TTL.quota = 20s`，`peekMembershipQuotaCache` 首帧用），而 §1.1 把该接口列为 **D1 绝对禁缓存**。
- 取舍：
  - **保留**：会员页冷启动秒开（20s 内首帧免网络）；代价是配额在 20s 内可能显示旧值（超额售卡的窗口）。
  - **下线**：严格符合 D1；代价是会员页首帧回到网络等待。
**评估结论（2026-09-19）：保留**，并把定位写死在代码注释里（"仅供首帧展示，不作任何决策依据"）。

关键论证：**配额是后端强制的** —— `yunce-backend/src/version/quota.service.ts:191/201/208/213` 在超限时直接抛 **422 `QUOTA_EXCEEDED`**，前端只据此弹升级引导。因此前端缓存**不可能造成资损**：最坏情况是"界面显示还有额度、点下去被后端拒绝"，属 UX 层面的轻微不适。它的失败模式是**展示陈旧**，不是**资损**。

佐证：会员页 `useDidShow` 里**无论如何都会重新拉配额**（`membership/index.tsx:226` `loadQuotaUsage({ soft })`），缓存只影响"首帧是否转圈"与 `soft` 标志 —— 真实陈旧窗口 ≈ 一次网络往返（亚秒级），远小于 20s。

→ **已执行（2026-09-19，用户回签）**：§1.1 已把 `organization/quota-usage` 从 D1 移出，新增 §1.4「展示类短窗口（D4）」并注明依据（后端 `quota.service.ts` 强制 422 → 前端展示缓存不构成资损路径）。

---

## 三、本轮已执行的治理动作

1. **修正文档-代码漂移**：`utils/cache-store.ts:4-6` 原写"交付形态：**休眠**…`cacheEnabled=false`（默认）"，与 `constants/cache-flags.ts` 的 `cacheEnabled: true` 不符 → 已改为"**已启用**（免灰度决策）＋ 开关保留为紧急回退"。
2. **Q1 落地**：计划 §1.1 增补 7 条动钱端点（薪资发放链路 + 课时结算 / 退费）。
3. **Q2 落地**：`services/membership-cache.ts` 补 G1 租户维度 —— 键加 `{orgId}:{userId}:{role}`、内存盒子加作用域校验、失效改为按前缀清（tsc / eslint / prettier 全绿）。
4. **Q5 评估落地**：保留配额缓存，并在 `peekMembershipQuotaCache` 注释里写死"仅供首帧展示、不作任何决策依据；权威判定以后端 422 QUOTA_EXCEEDED 为准"。

---

## 四、缺口清单与建议处置（按优先级）

| 序 | 事项 | 类型 | 风险 | 建议 |
|---|---|---|---|---|
| 1 | §1.1 补 7 条动钱端点（Q1） | 文档 | 潜在 | ✅ **已完成** |
| 2 | `membership-cache` 补 G1 租户维度（Q2） | 代码 | 中（资损相邻） | ✅ **已完成**（门禁全绿） |
| 3 | Q5 配额缓存去留 | 业务决策 | 展示陈旧（非资损） | ✅ **已评估：保留** + 注释定性 |
| 4 | §1.1 中 `organization/quota-usage` 的 D1→展示类 归类修正（Q5 附带） | 文档 | 低 | ✅ **已完成**（新增 §1.4 D4） |
| 5 | TTL 时间源（Q3） | 前端 | 低 | ✅ **已完成**（`utils/server-clock.ts` 走 HTTP `Date` 头，免后端排期） |
| 6 | G3 覆盖复核已通过 | — | — | 无需动作 |

## 五、待签字汇总（供业务方一次性回签）

- [x] **Q1**：§1.1 增补 7 条动钱端点 —— **已执行**
- [x] **Q2**：隔离策略 —— **已执行（键内隔离：`org` + `user` + `role`）**
- [x] **Q5**：配额缓存 —— **已评估并保留**（附注释定性：仅展示、不决策）
- [x] **Q3**：TTL 时间源 —— **已执行（HTTP `Date` 头校正，零后端改动）**
- [x] §1.1 中 `organization/quota-usage` 的 D1 → "展示类短窗口"归类修正 —— **已执行**
- [x] 固化进 `.harness/rules/40-data-and-services.md`（成功码判定 + TTL 时间源两条新规则）

> **签字状态：全部闭合**（2026-09-19，用户回签"这些方案都按照你的建议来吧"）。
