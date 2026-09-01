# 微信登录优化计划（WechatLoginCoordinator + wechat-login 瘦身）

> 备份日期：2026-09-02  
> 计划初版：`a7a909c` / `b7b1fbc`  
> 自查复审：§12 · 跨模块复审：§13  
> 代码基线：yunceTaro `661c176` · yunce-backend `78c9ad6`  
> 范围：**仅**微信一键登录链路；不含 warmToken / Redis 存 code / 密码登录 / mapBackendProfile 大改

---

## 1. 现状审计（基于代码）

### 1.1 前端 wx.login 调用点（共 3 处，均无全局单飞）

| 文件 | 行 | 模式 |
|------|-----|------|
| `src/package-auth/pages/login/index.tsx` | 109 | `Taro.login()` → `signInWithWechat` |
| `src/package-lead/pages/invite-landing/index.tsx` | 366 | 同上（隐私用 `ensurePrivacyBeforeAuth`） |
| `src/package-auth/pages/invite-register/index.tsx` | 96 | 同上 |

页内仅有 `wechatSubmitting` 布尔防抖，**无法防跨页/协议弹窗并发重复 login**。

### 1.2 已有可复用模式

`src/utils/request.ts:134` — `refreshInFlight` 单飞 Promise，Coordinator 应对齐此模式。

### 1.3 后端 wechat-login 链路（`auth.service.ts:956`）

```
wechatLogin
  → realWechatLogin / mockWechatLogin     // jscode2session
  → initializeUserWithTransaction         // 事务：findOrCreate + tenant + mintSession
  → buildUserInfo(profile.id)             // ⚠️ 二次查库 + 角色统计
```

`buildUserInfo`（`:849`）在事务完成后 **重复**：

- `profile.findUnique`（事务刚写完）
- `resolvePrimaryTenantForUser`（事务内 `:832-834` 已算过）
- PRINCIPAL：`teacher.count` + `countStudents`（**前端 mapBackendProfile 不用 count**）

### 1.4 主登录页微信登录的实际用户范围（交叉验证结论）

前端 `wechatLogin(code)` 只 POST `{ code }`（`auth.ts:573`）。

后端 `wechatLoginSchema` 默认 `role: 'PRINCIPAL'`（`auth.validator.ts:22`）。

已有 TEACHER/PARENT 用户 openId 登录时，`findOrCreateProfile` 在 `profile.role !== profileData.role` 时抛 **ConflictError**（`auth.service.ts:435-437`），**进不了 navigateAfterAuth**。

因此 **登录页微信一键登录的有效路径**：

| 用户 | 行为 |
|------|------|
| 新用户 | 创建 PRINCIPAL → profile-setup / identity-select |
| 老 PRINCIPAL | organizationId 在 JWT → 可进 home |
| 老 TEACHER/PARENT | **当前即失败（角色冲突）**，非 onboarding 映射问题 |

`invite-landing` 登录成功后调 `markOnboardingSkipped()`（`:377`），与主登录页不同。

### 1.5 mapBackendProfile 与 onboarding（**不在本次范围**）

`mapBackendProfile` 未映射 `teacher_profile` / `parent_profile`，对 **密码登录** 的 TEACHER/PARENT 老用户可能有 onboarding 误判——这是 **既有问题**，与本次微信瘦身无因果关系。**不纳入本计划**，避免范围膨胀；日后可单独小 PR。

### 1.6 冷启动 enrichment

`getSession()` 走 `/auth/me` + `/profile`；登录成功路径直接用 login 响应 `navigateAfterAuth`，**不经过 getSession**。

---

## 2. 改造方案（两方案一起做，无冲突）

| 方案 | 层 | 接口契约 |
|------|-----|----------|
| A. WechatLoginCoordinator | 前端 | 不变 |
| B. wechat-login 瘦身 | 后端 only | 响应 schema 不变；`user` 内 **optional 统计字段可省略**；PRINCIPAL 必需字段保留 |

---

## 3. 改动文件清单

### 方案 A — 前端 Coordinator

| 操作 | 文件 |
|------|------|
| **新增** | `src/utils/wechat-login-coordinator.ts` |
| **新增** | `src/utils/wechat-login-coordinator.test.ts` |
| **改** | `src/package-auth/pages/login/index.tsx` |
| **改** | `src/package-lead/pages/invite-landing/index.tsx` |
| **改** | `src/package-auth/pages/invite-register/index.tsx` |
| **改** | `src/utils/auth.tsx` — `signInWithWechat` 内聚 `performWechatAuth` |

**不改**：`request.ts`、隐私模块、后端路由。

### 方案 B — 后端瘦身（**不改** transaction 对外签名）

| 操作 | 文件 |
|------|------|
| **改** | `yunce-backend/src/auth/auth.service.ts` |
| **改** | `wechatLogin`：用 `buildMinimalLoginUserInfo(profile, tenant, orgName)` 替代 `buildUserInfo` |
| **改** | `yunce-backend/src/auth/__tests__/auth.service.test.ts` |
| **改** | `yunce-backend/src/auth/__tests__/auth.share.test.ts`（回归） |

**不改**：`initializeUserWithTransaction` 返回值结构（稳定性：少动公共事务）、`auth.routes.ts`、`mapBackendProfile`。

---

## 4. 改造思路

### 4.1 WechatLoginCoordinator（整链单飞，对齐 `refreshInFlight`）

```typescript
let wechatAuthTask: Promise<LoginResult> | null = null;

/** wx.login + POST /wechat-login 作为一个原子任务单飞 */
export async function performWechatAuth(): Promise<LoginResult> {
  if (wechatAuthTask) return wechatAuthTask;
  wechatAuthTask = (async () => {
    const code = await obtainWxLoginCode(); // 内层单飞 Taro.login
    return wechatLogin(code);
  })().finally(() => { wechatAuthTask = null; });
  return wechatAuthTask;
}
```

**规则**：

- code **不落 Storage / Redis**
- 三处页面经 `signInWithWechat` → `performWechatAuth()`，不再直接 `Taro.login()`
- task 在 `finally` 释放；失败可重试

> **第三次复审**：仅单飞 `wx.login` 不够——同一 code 被两个调用各 POST 一次会 40029。须 **整链单飞**。

### 4.2 后端 wechat-login 瘦身（稳定优先）

**不修改** `initializeUserWithTransaction` 的返回类型。

在 `wechatLogin` 内：

```typescript
const tx = await initializeUserWithTransaction({ openId, unionId, role }, role, undefined, { inviteCode });
// 事务内已 resolve tenant，此处再 resolve 一次（1 次）仍少于 buildUserInfo（findUnique + resolve + counts）
const tenant = tx.profile.userId
  ? await resolvePrimaryTenantForUser(prisma, tx.profile.userId)
  : undefined;
const orgName = tenant ? await prisma.organization.findUnique(...) : null;
const user = buildMinimalLoginUserInfo(tx.profile, tenant, orgName);
return { token: tx.accessToken, refreshToken: tx.refreshToken, expiresIn: tx.expiresIn, isNewUser: tx.isNewUser, user };
```

`buildMinimalLoginUserInfo`：

- **保留**：与现 `mapBackendProfile` + `needsOnboarding`（PRINCIPAL）相关的字段
- **保留（非 PRINCIPAL 链路）**：`teacher.findFirst`（`user.id` 须为 teacher.id）、`parent` + student 最小字段——**仅去掉 count 类查询**，不删 id 解析
- **删除**：`teacher.count`、`countStudents`、`countByTeacher`、`class.count`
- **不修改**：`initializeUserWithTransaction`、`attachShareContext`（invite 归属仍在事务内）

> share 测试（`auth.share.test.ts`）走 `role: PARENT + inviteCode`，与主登录页不同；**事务逻辑不改**，仅 user 组装变轻。若 mock 依赖 `buildUserInfo` 二次 `findUnique`，实施时改为断言 transaction 返回的 profile。

---

## 5. 实施顺序

```
Phase 0  计划 + git checkpoint
Phase 1  方案 A（Coordinator + 单测）— 可独立上线
Phase 2  方案 B（后端 minimal + 单测）— 依赖 Phase 0 基线，不依赖 Phase 1 逻辑但可同 PR
Phase 3  联调 + 模拟 CI
```

**取消原 Phase 3（mapBackendProfile 大改）**：交叉验证后非本次阻塞项。

---

## 6. 验收标准

### 6.1 功能

| # | 场景 | 预期 |
|---|------|------|
| F1 | 登录页微信登录（新 PRINCIPAL） | profile-setup 或 identity-select |
| F2 | 登录页微信登录（老 PRINCIPAL 有 tenant） | 直接 home；不误进 identity-select |
| F3 | 登录页微信登录（老 TEACHER/PARENT） | **保持现行为**：toast 角色冲突（非回归） |
| F4 | invite-landing / invite-register | 与原行为一致 |
| F5 | 快速连点微信登录 | ≤1 次 `wx.login` + ≤1 次 `/wechat-login` |
| F6 | 首次失败后重试 | 可再次 login 成功 |

### 6.2 性能

| 指标 | 目标 |
|------|------|
| `/auth/wechat-login` TTFB（PRINCIPAL） | 相对基线下降（少 1 次 profile 重查 + 无 count） |
| `wx.login` 次数/单次成功登录 | ≤ 1 |

### 6.3 稳定性

- 无 code 持久化、无新 Redis 键
- 不改 transaction / 路由 / 前端 API 契约
- `auth.share.test.ts` 全绿

---

## 7. 工程覆盖（测试）

### 7.1 前端（方案 A）

`wechat-login-coordinator.test.ts`：并发 `performWechatAuth` 仅 1 次 login + 1 次 POST；失败后重试。

### 7.2 后端（方案 B）

`auth.service.test.ts`：

- PRINCIPAL wechatLogin：`teacher.count` / `countStudents` **spy 为 0 次**
- 响应仍含 `token`、`user.organizationId`（有 tenant 时）

`auth.share.test.ts`：现有用例回归。

### 7.3 模拟 CI

**backend**（`.github/workflows/ci.yml`）：`npm ci` → `db:generate` → `prisma:validate` → `typecheck` → `build` → `lint` → `test:ci`

**yunceTaro**：`npm run check` → `npm test` → `npm run build:weapp:dev`

---

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 改 transaction 返回值引发连锁 | **不改** transaction；仅在 wechatLogin 内 minimal 组装 |
| invite 页与 login 页隐私差异 | Coordinator 只管 code，不动隐私 |
| optional 统计字段被前端依赖 |  grep 确认 mapBackendProfile 不读 count；principal 统计仅 `/me` 等路径 |
| 其他登录仍用 buildUserInfo | ** intentional **；仅 wechatLogin 瘦身，减少 blast radius |

---

## 9. 回滚

| 阶段 | 操作 |
|------|------|
| Phase 1 | revert Coordinator 4 文件 |
| Phase 2 | revert auth.service wechatLogin + 测试 |
| 全量 | 计划初版基线 `661c176` / `78c9ad6` |

---

## 10. 参考

- [小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- [接口频率规范](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/api-frequency.html)
- 本项目：`request.ts:refreshInFlight` · `auth.validator.ts:wechatLoginSchema`

---

## 11. 不在本次范围（刻意不做）

- warmToken / Redis 存 code
- `mapBackendProfile` teacher/parent 映射（既有债务，单独 PR）
- 修改 wechat 默认 role 以支持 TEACHER/PARENT 主登录页微信登录（产品决策，非性能优化）
- 前端 `wechatLogin` 携带 `inviteCode`（`PENDING_INVITE_CODE_KEY` 已存但未 POST，**既有缺口**）
- `showLoading` 时机微调（体感项，稳定性无关）
- `emailPasswordLogin` 共用 minimal builder（可后续复用，非必须）

---

## 12. 自查复审记录（2026-09-02）

### 12.1 初版计划偏差（已修正）

| 初版断言 | 交叉验证 | 处置 |
|----------|----------|------|
| F3/F4 老 TEACHER/PARENT 微信登录进 home | 默认 role=PRINCIPAL → ConflictError | 移出验收；标为现行为 |
| Phase 3 必做 mapBackendProfile | 主路径微信登录到不了 TEACHER/PARENT navigate | **移出本计划** |
| 改 transaction 返回 tenant | 多 caller，blast radius 大 | 改为 wechatLogin 内局部 resolve |
| invalidate 仅 40029 | 前端无 40029 专用处理 | 改为「登录失败未拿 token」即 invalidate |

### 12.2 复审结论

- **两方案仍推荐一起做**：无架构冲突；方案 A 可独立交付。
- **方案 B 收益集中在 PRINCIPAL 路径**，与主登录页微信用户一致，目标对齐。
- **无需为 perfection 扩 scope**；稳定性边界清晰。
- **无明显安全漏洞**：不存 code、不改鉴权、不改 JWT  mint 逻辑。

### 12.3 复审后 git

| 仓库 | 提交 |
|------|------|
| yunceTaro | 本文件更新 → `docs: self-review wechat login optimization plan` |
| yunce-backend | 索引文件同步 |

---

## 13. 第三次复审：跨模块 / 跨链路影响（2026-09-02）

### 13.1 影响面矩阵

| 模块 / 链路 | 方案 A | 方案 B | 处理 |
|-------------|--------|--------|------|
| 登录三页 + `signInWithWechat` | 整链单飞 | 响应更快 | ✅ Phase 1 |
| `invite-landing` onboarding | 无逻辑改 | 无 | ✅ `markOnboardingSkipped` 保持 |
| `request.ts` refresh / 401 | 无 | 无 | ✅ 不触及 |
| `route-guard` / `auth-onboarding` | 无 | PRINCIPAL profile 字段不变 | ✅ F2 |
| 密码/邮箱/手机登录、register | 无 | 仍 `buildUserInfo` | ✅ 刻意隔离 |
| `/auth/me`、`getSession` | 无 | 无 | ✅ 不触及 |
| `home` 统计 | 无 | 走 `/home`，不读 login count | ✅ grep 验证 |
| `auth.share.test.ts` | 无 | 事务不变；mock 或需微调 | ✅ Phase 2 必跑 |
| `auth.service.test.ts` TEACHER | 无 | 保留 findFirst，去 count | ✅ §4.2 |
| Swagger / yunce-admin / E2E | 无 | 无 | ✅ 无影响 |

### 13.2 本次须写入计划的修正

| 缺口 | 适配 |
|------|------|
| 仅单飞 wx.login | 改为 `performWechatAuth` 整链单飞（§4.1） |
| minimal 误删 teacher/parent id 查询 | 只删 count（§4.2） |
| share.test mock 依赖二次 findUnique | Phase 2 实施时调整 mock |

### 13.3 既有缺口（记录，不纳入本次）

- 前端 `wechatLogin` 未 POST `inviteCode`（storage 有存）——与优化无关
- 主登录页 TEACHER/PARENT 微信登录 → ConflictError——现行为

### 13.4 结论

有影响项均已对照并适配；**不必为完美扩大 scope**；稳定性边界不变。
