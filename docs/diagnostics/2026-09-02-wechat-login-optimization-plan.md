# 微信登录优化计划（WechatLoginCoordinator + wechat-login 瘦身）

> 备份日期：2026-09-02  
> 基线提交：yunceTaro `661c176` · yunce-backend `78c9ad6`  
> 范围：**仅**微信一键登录链路；不含 warmToken / Redis 存 code / 密码登录合并 check-email

---

## 1. 现状审计（基于代码，非拍脑袋）

### 1.1 前端 wx.login 调用点（共 3 处，均无全局单飞）

| 文件 | 行 | 模式 |
|------|-----|------|
| `src/package-auth/pages/login/index.tsx` | 109 | `Taro.login()` → `signInWithWechat` |
| `src/package-lead/pages/invite-landing/index.tsx` | 366 | 同上（隐私用 `ensurePrivacyBeforeAuth`） |
| `src/package-auth/pages/invite-register/index.tsx` | 96 | 同上 |

页内仅有 `wechatSubmitting` 布尔防抖，**无法防跨页/协议弹窗并发重复 login**。

### 1.2 已有可复用模式

`src/utils/request.ts:134` — `refreshInFlight` 单飞 Promise，Coordinator 应对齐此模式：

```typescript
let refreshInFlight: Promise<string | null> | null = null;
```

### 1.3 后端 wechat-login 链路（`auth.service.ts:956`）

```
wechatLogin
  → realWechatLogin / mockWechatLogin     // jscode2session
  → initializeUserWithTransaction         // 事务：findOrCreate + tenant + mintSession
  → buildUserInfo(profile.id)             // ⚠️ 二次查库 + 角色统计
```

`buildUserInfo`（`:849`）在事务完成后 **重复**：

- `profile.findUnique`（事务刚写完）
- `resolvePrimaryTenantForUser`（事务内已 resolve 过）
- PRINCIPAL：`teacher.count` + `countStudents`
- TEACHER：`teacher.findFirst` + `countByTeacher` + `class.count`
- PARENT：`studentParent.findUnique`

对比：`emailPasswordLogin`（`:1551`）走 `buildLoginResponseForProfile` → 同样调 `buildUserInfo`，但密码登录不是本次范围。

### 1.4 前端对登录响应的依赖（关键）

`mapBackendAuthPayload` → `mapBackendProfile`（`auth.ts:292`）**仅映射**：

- `profileId / nickname / phone / email / avatar / role`
- `organizationId / campusId`（JWT + user 字段，`pickRealTenantId`）
- `organizationName`（来自 `user.principal?.institution` 或 `user.teacher?.institution`）

**未映射**（即登录后 Profile 中缺失）：

- `teacher_profile.*`
- `parent_profile.*`
- PRINCIPAL 的 `teacherCount / studentCount`（BackendUserInfo 接口本身也不含 count）

`navigateAfterAuth`（`auth-onboarding.ts:189`）依赖：

| 角色 | 判断 | 登录响应是否足够 |
|------|------|------------------|
| PRINCIPAL | `organizationId` UUID | ✅ 有 |
| TEACHER | `teacher_profile.institution` | ❌ 未映射 → 恒为 undefined → 可能误进 identity-select |
| PARENT | `parent_profile.bind_status / student_id` | ❌ 未映射 → 恒为 undefined → 可能误进 identity-select |

**结论**：方案二瘦身时必须 **补全 mapBackendProfile 对 teacher/parent 最小字段映射**，或登录成功后 **`/auth/me`  enrichment 再 navigate**；仅删 buildUserInfo 统计不够，需一并处理 onboarding 字段。

### 1.5 冷启动已有 enrichment

`getSession()`（`auth.ts:1036`）：storage token → `/auth/me` → 非 principal 再 `/profile`。

登录页成功路径 **未调用 getSession**，直接用 login 响应 profile 做 `navigateAfterAuth`。

---

## 2. 改造方案（两方案一起做，无冲突）

| 方案 | 层 | 接口契约 |
|------|-----|----------|
| A. WechatLoginCoordinator | 前端 | 不变 |
| B. wechat-login 瘦身 + profile 映射补全 | 后端 + 前端 map | `POST /auth/wechat-login { code }` 响应结构不变，user 字段 **只减统计、不删 onboarding 必需字段** |

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
| **可选改** | `src/utils/auth.tsx` — `signInWithWechat` 文档注明 code 来源统一 |

**不改**：`request.ts`（refresh 单飞已独立）、隐私模块、后端路由。

### 方案 B — 后端瘦身 + 前端映射

| 操作 | 文件 |
|------|------|
| **改** | `yunce-backend/src/auth/auth.service.ts` |
| **新增** | `buildMinimalLoginUserInfo(profile, tenant, orgName?)` 或在 transaction 返回值中带 tenant |
| **改** | `wechatLogin` 用 minimal builder 替代 `buildUserInfo` |
| **改** | `yunce-backend/src/auth/__tests__/auth.service.test.ts` |
| **改** | `yunce-backend/src/auth/__tests__/auth.share.test.ts`（若有 wechat 断言字段） |
| **改** | `yunceTaro/src/services/auth.ts` — `mapBackendProfile` 补 teacher/parent 最小映射 |
| **新增** | `yunceTaro/src/services/auth.wechat-profile.test.ts`（或扩展现有 auth.test.ts） |

**不改**：`auth.routes.ts` / `auth.controller.ts` / `wechatLoginSchema`（契约不变）。

---

## 4. 改造思路

### 4.1 WechatLoginCoordinator

```typescript
// wechat-login-coordinator.ts
let loginCodeTask: Promise<string> | null = null;

export function obtainWxLoginCode(): Promise<string> {
  if (!loginCodeTask) {
    loginCodeTask = Taro.login()
      .then((r) => {
        if (!r.code) throw new Error('wx.login: no code');
        return r.code;
      })
      .finally(() => { loginCodeTask = null; });
  }
  return loginCodeTask;
}

export function invalidateWxLoginCodeTask(): void {
  loginCodeTask = null;
}
```

**规则**：

- code **不落 Storage / Redis**
- `/wechat-login` 返回 40029 或「code 无效」→ `invalidateWxLoginCodeTask()` 后允许重试
- 三处页面 `Taro.login()` 全部替换为 `obtainWxLoginCode()`

**login/index.tsx 附加（非必须，体感）**：

- `showLoading` 移到 `obtainWxLoginCode()` **之后**，仅遮后端阶段

### 4.2 后端 wechat-login 瘦身

**Step 1**：让 `initializeUserWithTransaction` 返回 `{ profile, tenant?, organizationName? }`（tenant 已在 `:832-834` 算过，避免 buildUserInfo 再算）。

**Step 2**：新增 `buildMinimalLoginUserInfo`：

```typescript
// 保留：id, profileId, nickname, role, avatar, phone, email, organizationId, campusId, organizationName
// 保留 onboarding：teacher.institution, parent.bindStatus, parent.student(id,name)
// 删除：teacherCount, studentCount, classCount, countByTeacher, countStudents
```

**Step 3**：`wechatLogin` 改为：

```typescript
const { profile, isNewUser, ..., tenant } = await initializeUserWithTransaction(...);
const user = buildMinimalLoginUserInfo(profile, tenant);
return { token, refreshToken, expiresIn, isNewUser, user };
```

**Step 4**：前端 `mapBackendProfile` 增加：

```typescript
teacher_profile: user.teacher ? { id, invite_code, institution } : undefined,
parent_profile: user.parent ? { id, bind_status, relation, student_id, student_name } : undefined,
```

确保 `needsOnboarding` 对老用户 TEACHER/PARENT 不误判。

---

## 5. 实施顺序

```
Phase 0  本文档 + git checkpoint（当前）
Phase 1  方案 A（Coordinator + 单测）
Phase 2  方案 B 后端 minimal user + 单测
Phase 3  方案 B 前端 mapBackendProfile + 单测
Phase 4  联调 + 模拟 CI 全绿
```

Phase 1/2 可同 PR 分 commit，便于回滚。

---

## 6. 验收标准

### 6.1 功能

| # | 场景 | 预期 |
|---|------|------|
| F1 | 登录页微信一键登录（新用户） | 成功 → profile-setup 或 identity-select |
| F2 | 登录页微信一键登录（老 PRINCIPAL 有 tenant） | 直接进 home tab |
| F3 | 登录页微信一键登录（老 TEACHER 有 institution） | **不进** identity-select，进 home |
| F4 | 登录页微信一键登录（老 PARENT 已绑定学生） | **不进** identity-select，进 home |
| F5 | invite-landing 微信登录 | 与原行为一致 |
| F6 | invite-register 微信注册 | 与原行为一致 |
| F7 | 快速连点「微信一键登录」 | 只 1 次 wx.login + 1 次 /wechat-login |
| F8 | 弱网 code 过期 | toast 失败；重试可成功 |

### 6.2 性能（devtools 网络面板，同环境对比基线）

| 指标 | 目标 |
|------|------|
| `/auth/wechat-login` TTFB | 相对基线下降（PRINCIPAL/TEACHER 角色更明显） |
| wx.login 调用次数/单次登录 | ≤ 1 |

### 6.3 稳定性

- 无 code 持久化
- 无新增后端 Redis 键
- API 契约 `/auth/wechat-login` 请求/响应 JSON schema 不变（仅 user 内 optional 统计字段可为 0/省略）

---

## 7. 工程覆盖（测试）

### 7.1 前端新增

**`wechat-login-coordinator.test.ts`**

| 用例 | 断言 |
|------|------|
| 并发 2 次 obtainWxLoginCode | Taro.login mock 只调用 1 次 |
| 第一次 reject | 第二次可重新 login |
| invalidate 后 | 新 task 重新调 login |

**`auth.wechat-profile.test.ts`（或扩展 auth.test.ts）**

| 用例 | 断言 |
|------|------|
| mapBackendProfile + TEACHER user.teacher | `teacher_profile.institution` 有值 |
| mapBackendProfile + PARENT user.parent | `parent_profile.bind_status` 有值 |
| needsOnboarding 老 TEACHER/PARENT | 不误判需 onboarding |

Mock：`Taro.login` via vitest.setup 已有模式。

### 7.2 后端新增/修改

**`auth.service.test.ts` — wechatLogin describe**

| 用例 | 断言 |
|------|------|
| PRINCIPAL 登录 | `teacher.count` / `countStudents` **不被调用**（spy） |
| TEACHER 登录 | 返回 user.teacher.institution；无 classCount 查询 |
| 响应仍含 token + organizationId | 契约保持 |

**`auth.share.test.ts`**

- 现有 invite/wechat 用例全绿（回归）

### 7.3 现有套件回归

| 仓库 | 命令 |
|------|------|
| yunceTaro | `npm test` |
| yunceTaro | `npm run typecheck && npm run lint && npm run format:check` |
| yunce-backend | `npm test -- src/auth/__tests__/auth.service.test.ts` |
| yunce-backend | `npm test -- src/auth/__tests__/auth.share.test.ts` |
| yunce-backend | `npm run test:ci`（模拟 CI 全量） |

---

## 8. 模拟 CI（本地执行清单）

### yunce-backend（对齐 `.github/workflows/ci.yml`）

```bash
cd yunce-back/yunce-backend
npm ci
npm run db:generate
npm run prisma:validate
npm run typecheck
npm run build
npm run lint
npm run test:ci
```

> CI 触发：打 `ci-*` tag 或 workflow_dispatch。日常 push main 不跑。

### yunceTaro（无 GitHub Actions，本地 gate）

```bash
cd yunceTaro
npm ci
npm run check          # typecheck + lint + format:check
npm test
npm run build:weapp:dev # 分包校验 + dev API 产物
```

---

## 9. 已知风险与缓解

| 风险 | 缓解 |
|------|------|
| TEACHER/PARENT 老用户误进 identity-select | Phase 3 必做 mapBackendProfile 补全 + F3/F4 验收 |
| initializeUserWithTransaction 改返回值 | 仅 wechatLogin 消费；单测覆盖 |
| invite-landing 隐私 API 与 login 页不同 | Coordinator 只管 login，不动隐私 |
| buildUserInfo 其他登录路径未改 | 本次仅 wechatLogin；password-login 后续可复用 minimal builder |

---

## 10. 参考

- 微信官方：[小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html) · [接口频率规范](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/api-frequency.html)
- 社区：Promise 单飞 [博客园静默登录](https://www.cnblogs.com/caihongmin/p/17534420.html) · token 加锁 [技术栈](https://jishuzhan.net/article/2026857281065910273)
- 本项目：`request.ts:refreshInFlight` · `auth-onboarding.ts:needsOnboarding`

---

## 11. 回滚

| 阶段 | 操作 |
|------|------|
| Phase 1 | revert Coordinator 相关 4 文件 |
| Phase 2+3 | revert auth.service minimal + mapBackendProfile |
| 全量 | 回到基线 `661c176` / `78c9ad6` |
