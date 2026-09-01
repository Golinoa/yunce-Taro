# 修复交接提示词 · R1 登录阻塞 + 登录/注册 UI 改版（2026-09-01）

> **用法**：整段复制到**修项目**会话。本会话只记录/查因，不改业务代码。  
> **真源**：`yunceTaro/docs/diagnostics/2026-09-01-manual-walkthrough-findings.md`  
> **宪法**：`yunceTaro/AGENTS.md`、`yunceTaro/Agents/frontend-meta-prompt.md`；后端 `yunce-back/yunce-backend/AGENTS.md`  
> **环境**：测环境 `https://dev.chancore.cn`；编译 `npm run dev:weapp:dev`（禁止回 Mock）

---

## 你要做什么（修项目会话）

严格遵守 AGENTS。**上线前联调：按最优方案一次做对，禁止「先凑合中期再改」。**  
优先打通真机登录主路径（含 **SES 异步发码**），再完成登录/注册 UI 与契约。改完后：`typecheck`/`相关测试` + **重编译 `dist`（`dev:weapp:dev` 或 `build:weapp:dev`）**，让走查方可继续真机联调。

---

## Part A — P0 阻塞修复（必须先做，否则走查进不了下一步）

### 现象（真机日志 2026-09-01 00:24）

1. 点「发送验证码」长时间「发送中」，**没有 60s 倒计时**  
2. **未注册邮箱**也能收到码并用「邮箱登录」建档登录  
3. 登录成功后进**空白页**，无失败兜底，无法继续走查  

### 已实锤根因（勿再猜）

#### A1 倒计时缺失 = FE 超时 vs SES 慢（非「没写倒计时」）

| 证据 | 值 |
|------|-----|
| FE `TIMEOUT` | `yunceTaro/src/utils/request.ts` → **10000ms** |
| 本次 `POST /api/app/v1/auth/email-code` | 服务器 **200 但 14198.729ms** |
| 倒计时逻辑 | `login/index.tsx`：仅 `prepareEmailLogin` 成功才 `startCountdown(60)` |

因果：客户端 10s 超时判失败 → 不启动倒计时；服务端 SES 仍发完 → 用户能收到码。

**本迭代最优解（上线前必做，禁止「先加长超时凑合、中期再异步」）：**

1. **后端（根因级 · P0 必做）**：`sendEmailCode` **禁止**在请求路径上同步 `await` 腾讯云 SES。  
   - 顺序：校验冷却 → 生成 OTP → **先写 Redis（OTP + 60s cd）** → **立即 `200` 返回** → **再异步投递 SES**（`setImmediate` / 队列 / fire-and-forget + 结构化日志均可，选仓库已有模式）  
   - SES 失败：打 error 日志；按现有策略决定是否 `invalidateEmailOtp`（须保证：接口已返回成功时，用户侧文案与「未收到码可重发」一致；冷却 key 行为写进注释/单测）  
   - 目标：`POST /auth/email-code` **p95 应回到百毫秒～1s 量级**（本机 DB/Redis），不再出现 ~14s 挡在 HTTP 上  
   - 单测：mock SES 慢/失败时，HTTP 仍快速返回；OTP 已可被 verify（或按你选定的失败失效策略断言）  
2. **前端（配套加固 · 同迭代必做）**：  
   - 发码成功即启动 **60s 倒计时**（与 Redis cd 对齐：`email-otp-redis.ts`）  
   - 可乐观：点发送即进冷却 UI；若接口明确失败再恢复并 Toast  
   - 发码接口可单独放宽 timeout 作兜底，**不能替代**后端异步；禁止只靠把全局 TIMEOUT 拉到 30s「顶住 SES」  
3. Toast 文案诚实区分：发送受理成功 / 校验失败 / 网络失败  

> 口径：上线前联调要的是**最优处理**。只加长 FE timeout 算降级凑合，**验收不通过**。

#### A2 登录页未注册直登 = 契约/产品冲突

| 证据 | 位置 |
|------|------|
| `sendEmailCode` 不查用户是否存在 | `auth.service.ts` |
| LOGIN → SES `purpose: register` | 日志已证实 |
| `emailLogin` 默认 `role: PRINCIPAL` 并 INSERT User/Profile | `auth.validator.ts` + 日志 |

**产品锁定（本迭代）：**

- **登录页**：只登录已有账号；发码/登录前校验邮箱（或账号）已注册；未注册 → 明确引导「去注册」，**禁止**静默建档  
- **注册页**：唯一建档入口（见 Part B）  
- 登录成功后必须有可达漏斗：**完善资料 / 选择身份**，禁止空白无反应  
- `navigateAfterAuth` / `Taro.redirectTo`：**必须有 fail 回调**（Toast + 可回登录或 `reLaunch` 安全页）  
- 登录成功导航不要只依赖 `useEffect(profile)`；成功回调里显式导航更稳  

#### A3 登录后空白

- 新用户无昵称会进 `profile-setup`（`auth-onboarding.ts`）；日志在 email-login 后无首页 API  
- 修：保证跳转成功；邮箱注册用户勿卡死在「仅微信头像/昵称」不可用路径；无机构用户强制 `identity-select`，禁止空首页卡死  
- 验收：注册/登录后至少能看到「完善资料」或「选择身份」可交互 UI，或诚实错误页  

---

## Part B — 登录 / 注册 UI + 落库（与 A 同迭代交付）

### B1 登录页 `package-auth/pages/login/index.tsx`

**目标主路径：账号 + 密码登录（不是验证码登录）。**

1. 主表单改为：  
   - 输入框 1：账号（文案用「账号」；底层可仍走邮箱/`password-login`，与现有 `POST /auth/password-login` 对齐）  
   - 输入框 2：密码  
2. 主按钮文案：**「账号登录」**（替换「邮箱登录」）  
3. 调用已有 `signInWithUsername` / `login()` → `AUTH_ENDPOINTS.passwordLogin`；测环境种子账号映射保留（`resolveDevLoginEmail`）  
4. **微信一键登录**可保留为次要 CTA（现有主按钮样式可对调：账号密码为主、微信为辅，或按现视觉「账号密码为主按钮」）  
5. 验证码登录若保留：降级为次要入口或去掉；**不得**再让未注册用户从登录页建档  
6. **用户协议文案优化**（示例，可微调语气，须保留可点协议链接）：  
   - 旧：「我已阅读并同意《用户协议》」  
   - 新建议：「登录即表示已阅读并同意《用户协议》」（或「未注册账号请先注册；登录即表示同意《用户协议》」）  
   - 勾选逻辑：可保留强制勾选，或「登录即同意」但须符合微信小程序合规；二选一写清并实现一致  

### B2 注册页 `package-auth/pages/register/index.tsx`

**当前问题**：注册页实际调用 `signInWithEmailCode`（登录即注册），**无密码**，且不走带密码落库。

**目标表单顺序：**

1. 邮箱（账号）  
2. 验证码 + 发送（修复 A1 超时/倒计时）  
3. **密码**  
4. **确认密码**（两次一致校验；长度对齐后端 6–20）  
5. 同意协议  
6. 按钮「注册账号」→ **落库成功**并进入 onboarding 漏斗  

**后端契约（必须改，现状不够）：**

- 现 `POST /auth/register`（`emailRegister`）**无** `code`、**无** `password`，不会写 `passwordHash`  
- `registerSchema` 需扩展，例如：`email` + `code`（LOGIN 或独立 REGISTER purpose）+ `password` + `role`（默认策略与产品一致：勿静默乱建校长业务数据；可先 PRINCIPAL/PARENT 按现注册流）  
- 流程：校验 OTP → `allowExisting: false` 创建 User/Profile → **写入 `passwordHash`** → 签发 session  
- 已注册邮箱：冲突错误，引导去登录  
- FE：`services/auth` 新增/改 `registerWithEmailPassword`，页面停止用 `signInWithEmailCode` 冒充注册  
- 单测：BE register 带密码；FE service/页面校验两次密码不一致  

### B3 编译与门禁

- FE：`npm run check`（或至少 typecheck）+ `dev:weapp:dev` / `build:weapp:dev` 更新 `dist`  
- BE：相关 `auth` 单测；测环境若需重启 API 请注明  
- 禁止恢复 Mock 日常路径；禁止碰生产库  

---

## 验收清单（走查方）

- [ ] 登录页可见账号 + 密码；按钮为「账号登录」；协议文案已优化  
- [ ] 种子账号（如 `principal1@yunce.com` / `123456`）密码登录可进后续页（非空白）  
- [ ] 未注册邮箱在**登录页**不能静默建档；有明确引导去注册  
- [ ] 注册：邮箱 + 验证码 + 两次密码 → 落库；可用该账号密码再登录  
- [ ] 发码：有 60s 倒计时；**`/auth/email-code` 不再同步等待 SES**（测环境日志耗时应远低于 10s，典型 <1–2s）；FE 不靠拉长全局超时硬顶  
- [ ] 登录/注册成功后必达完善资料或选择身份（可点），禁止纯空白无反馈  

---

## 参考文件

- 缺陷台账：`yunceTaro/docs/diagnostics/2026-09-01-manual-walkthrough-findings.md`  
- FE：`package-auth/pages/login/index.tsx`、`register/index.tsx`、`services/auth.ts`、`utils/request.ts`、`utils/auth-onboarding.ts`、`utils/auth.tsx`  
- BE：`auth.routes.ts`、`auth.validator.ts`、`auth.service.ts`（`sendEmailCode` / `emailLogin` / `emailRegister` / `emailPasswordLogin`）、`email/tencent-ses.ts`、`email/email-otp-redis.ts`  

---

## 超时根因说明（给修复者）

**主因：外部腾讯云 SES 同步发送慢（网络/第三方服务时延），叠加前端 10s 超时阈值过紧。不是本地 Prisma/业务 CPU 性能问题。**

- email-login 仅 **90ms** → DB/鉴权正常  
- email-code **~14s** 且日志有 `[SES] 邮件已提交` → 时间花在等待 SES API  
- 属 **出站网络 / 第三方邮件服务延迟** + **同步 await 设计** + **FE timeout 配置不匹配**；不是「业务代码算得慢」  

**上线前最优处理（本提示词强制）**：把 SES 移出请求关键路径（先落 OTP 再异步发信）+ FE 倒计时与失败态对齐。禁止「中期再说」。
