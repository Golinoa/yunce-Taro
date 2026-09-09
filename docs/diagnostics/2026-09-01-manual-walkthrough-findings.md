> **历史资料（2026-09-08 收口）**：保留问题背景与证据；其中完成度、待办、命令和旧方案未经当前版本复验，不作为开发指令。当前工作从 [模块联调入口](../../../yunce-back/yunce-backend/docs/development/README.md) 开始。

# 真机走查缺陷台账（测环境 · 只记 + 查因）

> **环境**：开发测环境 `dev.chancore.cn` / 真机微信小程序  
> **角色分工**：走查方汇报 → 本会话记录与根因证据 → 另一会话修复  
> **判定**：✅ 通过 / ⚠️ 已知占位 / ❌ 失败

---

## R1 — 登录页邮箱发码 / 未注册直登 / 登录后空白（2026-09-01 00:24）

| 项               | 内容                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| **编号**         | R1                                                                                            |
| **路径**         | `package-auth/pages/login` → 发验证码 → 邮箱登录                                              |
| **账号**         | 未注册邮箱（日志掩码 `15***@qq.com`）                                                         |
| **UA**           | Android 真机微信 MiniProgram（见服务器日志）                                                  |
| **判定**         | ❌                                                                                            |
| **现象（用户）** | ① 点发送后停在「发送中」，无 60s 倒计时防抖；② 未注册也能收到码并登录；③ 登录后空白页、无兜底 |

### 服务器日志摘要（用户提供）

| 时间     | 请求                     | 结果                   | 关键信号                                                                                                      |
| -------- | ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| 00:24:49 | `POST /auth/email-code`  | **200 / 14198.729 ms** | SES `purpose: register`，subject「登录验证码」，`credentialSource: env`                                       |
| 00:25:10 | `POST /auth/email-login` | **200 / 90 ms**        | Prisma **INSERT User** + **INSERT Profile** + AuthSession；随后 Student/Teacher COUNT（校长 `buildUserInfo`） |
| 登录后   | （无后续业务 API）       | —                      | 日志在 email-login 后截止 → **未打到首页类接口**                                                              |

---

### R1-a 发送中无 60s 倒计时 — 根因（有证据）

**结论：前端请求超时 10s，发码实际 ~14s；客户端判失败故不启动倒计时，服务端仍发成功。**

| 证据                                                                                     | 位置                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 客户端 `TIMEOUT = 10000`                                                                 | `yunceTaro/src/utils/request.ts` L13 / L106                  |
| 本次发码耗时 **14199ms > 10000**                                                         | 服务器日志 `POST .../email-code 200 14198.729 ms`            |
| 倒计时**仅在** `prepareEmailLogin` 成功且 `status === 'ready'` 后调用 `startCountdown()` | `login/index.tsx` L137–146；`CODE_COUNTDOWN_SEC = 60` 已实现 |
| 失败分支：`setSendingCode(false)` 后 Toast 失败，**不** `startCountdown`                 | 同上 L139–143                                                |
| 后端 Redis 冷却 60s 独立存在，与 FE 倒计时无关                                           | `email-otp-redis.ts` `EMAIL_OTP_COOLDOWN_SECONDS = 60`       |

**因果链**

```
点击发码 → UI「发送中」
  → Taro.request 10s 超时 → FE 当失败 → 按钮恢复「发送验证码」、无 60s
  → 服务端 SES 继续跑完 → 14s 后 200 + 邮件已发
  → 用户仍能收到码并登录（FE/BE 状态分裂）
```

**修复方向（交给修项目会话，本会话不改；上线前最优 · 本迭代必做）**：`sendEmailCode` **先写 Redis OTP 并立即 200，SES 异步发送**（禁止同步 await 挡在 HTTP 上）；FE 成功/乐观启动 60s 倒计时。仅加长 FE timeout 不算过验收。详见交接提示词 A1。

---

### R1-b 未注册也发码并可登录 — 根因（有证据）

**结论：按当前契约，登录页邮箱码 = 登录/自动注册；发码不查用户是否存在；登录默认角色 PRINCIPAL 并建档。**

| 证据                                                                                   | 位置                                                                             |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `sendEmailCode` **无** Profile/User 存在性校验，只做冷却 + 写 OTP + SES                | `auth.service.ts` L139–167                                                       |
| LOGIN purpose → SES 用途 `register`                                                    | `emailOtpPurposeToSes` → `return 'register'`；日志 `"purpose": "register"`       |
| 邮件标题仍用「登录验证码」                                                             | `ses-email-templates` / env 默认 subject；日志 `subject: 【松果排课】登录验证码` |
| FE 登录发码 `purpose: 'LOGIN'`，成功即 `status: 'ready'`                               | `services/auth.ts` `prepareEmailLogin` L575–580                                  |
| `emailLoginSchema.role` **optional default `'PRINCIPAL'`**                             | `auth.validator.ts` L47–51                                                       |
| `emailLogin` → `initializeUserWithTransaction` → `findOrCreateProfile` 无则 **INSERT** | `auth.service.ts` L1073–1083、L339–365                                           |
| 日志：无 Profile 命中后 **INSERT User / INSERT Profile**                               | 用户日志 00:25:10                                                                |

**产品口径冲突**：UI 有独立「注册账号」入口，但登录页验证码路径对未注册邮箱同样开通并默认校长身份——用户感知为「未查是否有用户就发码允许登录」。

**修复方向（产品拍板后）**：登录发码前查邮箱已注册，未注册拒绝并发引导去注册；或保留 passwordless 注册但文案/角色明确、禁止默认 PRINCIPAL 静默建档。

---

### R1-c 登录后空白、无兜底 — 根因（有证据 + 待真机确认页面名）

**结论：登录成功后前端按「新用户缺昵称」走完善资料/身份漏斗；日志无首页 API，说明未进入正常首页数据加载。空白更像漏斗页未达预期或跳转失败且无失败兜底。**

| 证据                                                                                     | 位置                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| 登录 200 且新建 PRINCIPAL（无 nickname）；`buildUserInfo` 走校长 COUNT                   | 日志 INSERT + Student/Teacher COUNT         |
| FE `signInWithEmailCode` 对 `isNewUser` 打标                                             | `auth.tsx` L407–408                         |
| 登录页 `profile` 变化 → `navigateAfterAuth`                                              | `login/index.tsx` L36–40                    |
| `needsProfileSetup`：新用户或昵称为空/`未命名用户` → **强制** `redirectTo` profile-setup | `auth-onboarding.ts` L89–100、L154–158      |
| Mapper：无 nickname/phone → `name = '未命名用户'`                                        | `services/auth.ts` `mapBackendProfile` L206 |
| profile-setup / identity-select **不请求**首页 API → 与「登录后日志无后续」一致          | 静态路径                                    |
| `navigateAfterAuth` / `redirectTo` **无** fail 回调、无 Toast、无回登录兜底              | `auth-onboarding.ts` L143–182               |
| 登录页 `executeEmailLogin` 成功后只 `justLoggedIn`，**不**根据返回值主动导航             | `login/index.tsx` L94–112（依赖 useEffect） |

**高概率落点（按优先级）**

1. 已 `redirectTo` `/package-auth/pages/profile-setup/index`（完善资料），真机分包白屏/样式异常/用户未识别 → 感知「空白无反应」
2. `redirectTo` 失败（分包未就绪等）且无 catch → 停在已登录态中间态
3. 若误入首页：`withRouteGuard` 未授权时全屏 Loading（「正在准备页面」），可被描述为空白；但通常会打 home API——**与当前日志不符，优先级低于 1/2**

**请走查方补一眼（便于修会话验收）**：空白页顶栏标题是否为「完善资料」/「选择您的身份」，或开发者工具当前路由 path。

**修复方向**：登录成功同步导航 + `redirectTo` fail → Toast/回登录；邮箱新用户漏斗与微信完善资料分流；无机构 PRINCIPAL 强制 identity-select 并禁止静默进空首页。

---

## 产品增量（2026-09-01 走查方追加 · 随 R1 同批修）

| ID   | 要求                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------- |
| R1-d | 登录页主路径改为**账号 + 密码**；按钮文案「账号登录」；优化同意协议文案                                 |
| R1-e | 注册页验证码下方加**密码 + 确认密码**；点注册须**落库**（含 passwordHash）；勿再用 email-login 冒充注册 |

交接提示词（整段复制给修项目会话）：`2026-09-01-fix-handoff-prompt-r1-auth-ui.md`

## 状态

| ID     | 记录 | 根因证据            | 修复                                     | 复测    |
| ------ | ---- | ------------------- | ---------------------------------------- | ------- |
| R1-a   | ✅   | ✅ 超时 vs 14s      | ✅ SES 异步 + FE 倒计时/受理文案         | ⏳ 真机 |
| R1-b   | ✅   | ✅ 契约/日志 INSERT | ✅ LOGIN 禁建档；REGISTER purpose 隔离   | ⏳ 真机 |
| R1-c   | ✅   | ✅ 漏斗+无后续 API  | ✅ redirect fail 兜底 + 成功回调显式导航 | ⏳ 真机 |
| R1-d/e | ✅   | —                   | ✅ 账号密码登录 + 注册双密码落库         | ⏳ 真机 |

### 2026-09-01 ~01:15 代码验收（初审）

当时总判不通过：`Profile.create` spread 含 `passwordHash`。

### 2026-09-01 ~01:22 复审（通过）

**代码审：通过。** 真机仍待走查方签收。

| 清单项                                                                    | 结果                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 登录页账号+密码、「账号登录」、协议文案                                   | ✅                                                                  |
| 未注册不能登录页静默建档                                                  | ✅                                                                  |
| SES 异步、HTTP 不堵                                                       | ✅                                                                  |
| 注册 → User 写 passwordHash；Profile.create **显式字段、无 passwordHash** | ✅（`auth.service.ts` + 单测 `not.toHaveProperty('passwordHash')`） |
| 跳转 fail 兜底 + 成功显式导航                                             | ✅                                                                  |
| BE emailRegister / REGISTER / async SES 相关单测                          | ✅ 8 pass                                                           |
| 真机种子登录 / 新注册再密码登录 / 发码耗时                                | ⏳                                                                  |

真机建议：`principal1@yunce.com` / `123456` 账号登录 → 非空白页；新邮箱注册 → 再用密码登录。
