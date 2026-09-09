> **历史资料（2026-09-08 收口）**：保留问题背景与证据；其中完成度、待办、命令和旧方案未经当前版本复验，不作为开发指令。当前工作从 [模块联调入口](../../../yunce-back/yunce-backend/docs/development/README.md) 开始。

# 门店入驻 · 待审核中间页 & 漏斗修复计划

> 制定日期：2026-09-02  
> **产品真源**：`yunce-backend/docs/PM/current/2026-09-01-store-entry-product-glossary.md`  
> **审核时效口径**：**1–3 个工作日**（不用 48 小时）  
> **状态**：已实施（2026-09-02）· CI：`lint` + `test` 270/270 + `coverage` 全绿

---

## 0. 背景与问题

| #   | 走查问题                           | 根因                                                                |
| --- | ---------------------------------- | ------------------------------------------------------------------- |
| 1   | 「去绑定邮箱」跳个人资料，流程断链 | store-entry 用 `navigateTo profile-edit`，未用页内 `BindEmailSheet` |
| 2   | 「下次再说」提交报「提交失败」     | `catch {}` 吞掉 409 `PENDING_EXISTS`                                |
| 3   | 已有待审核申请仍能填表重复提交     | 填表页进页未查 `queryLatest`                                        |
| 4   | 重进小程序仍进 identity-select     | 漏斗未以 `queryLatest` 为真源；demo org 使 `needsOnboarding=false`  |
| 5   | pending 页 UX 不符合产品           | 客服 QR 常驻；缺「体验演示门店」入口                                |

---

## 1. 产品口径（本迭代锁定）

### 1.1 页面架构（不变）

```text
about → store-entry（填表）→ store-entry/pending（中间页）
                              ├─ 先体验演示门店 → 机构端首页（demo）
                              └─ 联系客服催办 → BottomSheet + QR
```

### 1.2 pending 中间页 · PENDING 态

| 元素   | 文案                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------ |
| 导航栏 | 申请已提交                                                                                             |
| 主标题 | 提交成功，等待审核中                                                                                   |
| 说明   | 我们已收到您的入驻申请，将在 **1–3 个工作日** 内完成审核。通过后您将成为机构管理员，自有门店正式开通。 |
| 按钮 A | **先体验演示门店**（副文案：审核期间可先熟悉系统功能）                                                 |
| 按钮 B | **联系客服催办**（副文案：加急审核请添加客服微信）                                                     |

- 客服 QR **默认不展示**，点按钮后 BottomSheet 弹出。
- 演示门店按钮：`refreshSessionForTenant` → `refreshProfile` → `switchTab` 首页；首次可 Toast 提示「当前为演示环境」。

### 1.3 漏斗真源

**禁止**仅用 `needsOnboarding()` / JWT `organizationId` 判断（提交后 demo 机构会导致误判）。

**必须**以 `GET /store-entry/applications/latest` 为准：

| latest 状态             | 填表页                  | 登录/冷启动默认                          |
| ----------------------- | ----------------------- | ---------------------------------------- |
| 无记录                  | 可填表                  | identity-select                          |
| PENDING                 | redirect pending        | redirect pending（跳过 identity-select） |
| APPROVED + 无自有店 JWT | redirect pending 成功态 | pending / 进机构端                       |
| APPROVED + 自有店 JWT   | —                       | 机构端首页                               |
| REJECTED                | 可填表 / pending 驳回态 | pending 驳回态                           |

### 1.4 其它规则

- 绑邮箱 = 软要求；页内 `BindEmailSheet`；「下次再说」可提交。
- 409 `PENDING_EXISTS` = **幂等成功** → redirect pending，不 Toast 失败。
- 提交防抖：`submitting` + `submitInFlightRef`，弱网禁止连点。
- **删除** store-entry mount 时 `clearIdentitySelectionPending()`；改在**提交成功**时清除。
- identity-path 白名单注释：打开 store-entry **不清除** pending（与代码对齐）。

---

## 2. 实施清单

### Phase A · 基础设施

| ID  | 文件                              | 改动                                             |
| --- | --------------------------------- | ------------------------------------------------ |
| A1  | `utils/store-entry-onboarding.ts` | 新建：漏斗解析、409 解析、latest 缓存（TTL 60s） |
| A2  | `constants/store-entry-copy.ts`   | 新增 `STORE_ENTRY_PENDING_COPY`                  |
| A3  | `services/store-entry.ts`         | `queryLatestSafe()`（404→null）                  |
| A4  | `utils/store-entry-submit.ts`     | 导出类型复用；错误解析可迁 onboarding            |

### Phase B · 页面

| ID  | 文件                              | 改动                                                        |
| --- | --------------------------------- | ----------------------------------------------------------- |
| B1  | `pending/index.tsx`               | PENDING 双按钮 + 客服 Sheet + 文案                          |
| B2  | `store-entry/index.tsx`           | 进页拦截、BindEmailSheet、防抖、409、提交成功 clearIdentity |
| B3  | `auth-onboarding.ts`              | `navigateAfterAuth` async：PENDING → pending                |
| B4  | `utils/store-entry-onboarding.ts` | `maybeRedirectStoreEntryPendingHub` 冷启动一次检查          |
| B5  | `utils/app-startup.ts`            | 冷启动延后调用漏斗检查                                      |

### Phase C · 文档

| ID  | 文件                              | 改动                        |
| --- | --------------------------------- | --------------------------- |
| C1  | `store-entry-product-glossary.md` | 补 pending 中间页、漏斗例外 |
| C2  | 本文档                            | 验收 + CI                   |

---

## 3. 验收标准（VH / 真机）

| ID       | 场景       | 步骤                         | 期望                                                       | 优先级 |
| -------- | ---------- | ---------------------------- | ---------------------------------------------------------- | ------ |
| VH-SE-01 | 首次提交   | 填表 → 申请入驻              | 进 pending；主标题「提交成功，等待审核中」；1–3 工作日文案 | P0     |
| VH-SE-02 | 双按钮     | pending PENDING 态           | 见「先体验演示门店」「联系客服催办」；无常驻 QR            | P0     |
| VH-SE-03 | 演示门店   | 点按钮 A                     | 进 home tab（demo）；Toast 演示环境提示                    | P0     |
| VH-SE-04 | 客服催办   | 点按钮 B                     | BottomSheet + QR；可放大                                   | P0     |
| VH-SE-05 | 进页拦截   | 已有 PENDING 再进填表        | 自动 redirect pending                                      | P0     |
| VH-SE-06 | 409 幂等   | 弱网连点提交                 | 不 Toast 失败；最终进 pending                              | P0     |
| VH-SE-07 | 绑邮箱     | 点「去绑定」                 | 页内 BindEmailSheet，不跳 profile                          | P0     |
| VH-SE-08 | 重进小程序 | 已登录 + PENDING，杀进程重开 | 不进 identity-select；进 pending 或 home 后再检→pending    | P0     |
| VH-SE-09 | 审核通过   | Admin 批准后                 | pending 成功态 →「进入我的机构」→ 机构端                   | P0     |
| VH-SE-10 | 驳回       | Admin 驳回                   | pending 驳回原因 + 重提                                    | P1     |
| VH-SE-11 | 未登录预览 | 未登录开填表                 | 可预览填表；提交引导登录                                   | P1     |

---

## 4. 自动化测试 & 覆盖率

### 4.1 必跑 CI 命令（本地模拟全绿）

```bash
cd yunceTaro
npm run lint
npm run test
npm run coverage
```

**通过标准：**

| 检查项                                   | 门槛                               |
| ---------------------------------------- | ---------------------------------- |
| `eslint src/`                            | 0 error                            |
| `vitest run`                             | 全通过                             |
| coverage `lines`（全局门禁）             | ≥ 30%（vitest.config 既有门槛）    |
| **新增文件** `store-entry-onboarding.ts` | lines ≥ **83%**（本迭代实测 ~84%） |
| **扩展** `store-entry-submit.test.ts`    | 覆盖 409 解析 + 漏斗 destination   |
| **扩展** `auth-onboarding.test.ts`       | 覆盖 PENDING → pending 分支        |

### 4.2 单测用例清单

**`store-entry-onboarding.test.ts`**

- `resolveStoreEntrySubmitError`：PENDING_EXISTS → redirect_pending
- `resolveStoreEntrySubmitError`：未知错误 → toast fallback
- `resolveStoreEntryFunnelDestination`：null latest → identity-select
- `resolveStoreEntryFunnelDestination`：PENDING → pending
- `resolveStoreEntryFunnelDestination`：APPROVED + needsOnboarding → pending
- `resolveStoreEntryFormGate`：PENDING → redirect pending；REJECTED → form；null → form
- 缓存：TTL 内复用；invalidate 后刷新

**`store-entry-submit.test.ts`**（保留既有 + 无回归）

**`auth-onboarding.test.ts`**

- `navigateAfterAuth`：mock queryLatest PENDING → redirect pending，clear identity pending

### 4.3 vitest coverage include 扩展

```typescript
'src/utils/store-entry-onboarding.ts',
'src/utils/store-entry-submit.ts',
'src/constants/store-entry-copy.ts',
```

---

## 5. 影响范围

| 模块          | 影响                      |
| ------------- | ------------------------- |
| 门店入驻 FE   | 核心改动                  |
| 登录漏斗      | navigateAfterAuth async   |
| 冷启动        | app-startup 一次 redirect |
| 后端          | **无改动**                |
| Admin 审核    | 无                        |
| 家长/员工邀请 | 无                        |

---

## 6. 明确不做

- 合并填表 + pending 为单页
- 改 409 后端语义
- 每次 route-guard 打 API（用 TTL 缓存 + 登录/冷启动触发）
- 48 小时 SLA 文案

---

## 7. 实施顺序

```text
1. 本文档 + glossary 补全
2. store-entry-onboarding.ts + tests
3. store-entry-copy + pending 页 UI
4. store-entry 填表页
5. auth-onboarding + app-startup
6. lint + test + coverage 全绿
```
