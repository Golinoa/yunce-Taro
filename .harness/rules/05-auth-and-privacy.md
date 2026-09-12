---
last_updated: 2026-09-12
status: active
source: .cursor/rules/email-auth.mdc + privacy-auth.mdc 迁移
---

# R05 认证与隐私口径（业务专项，硬性）

> 登录 / 注册 / 隐私授权的**统一产品口径**。改这些路径前必读。

## 邮箱认证统一口径

### 未注册

- toast：**该邮箱尚未注册**（无额外引导）
- **不**发码、**不**启 60s 倒计时

### 发码冷却（60s）

- 含义：1 分钟内只能点一次「发送验证码」，**不**承诺邮件已送达
- **HTTP 200 后**才启动倒计时（禁止「一点就倒计时」）
- 429 / 过于频繁：保持倒计时
- 未注册 / 5xx / 网络失败：清倒计时
- 按钮文案：`发送验证码` 或 `59s`，**不用**占满式「发送中」

### purpose 与后端校验

| purpose | 发码前校验 |
| --- | --- |
| LOGIN / check-email / 密码登录 | 须已注册 |
| REGISTER | 须未注册 |
| RESET | 须已注册；**同步 SES**，失败 invalidate OTP |
| BIND | 已登录绑定 |

### 找回密码成功

- toast「密码已重置，请使用新密码登录」
- `redirectTo` 登录页 `?email=...&from=reset`
- 登录页 `useDidShow` 回填邮箱、**清空密码**

### 实现落点

- Hook：`src/utils/use-email-otp-send.ts`
- 文案：`src/constants/email-auth.ts`
- 校验：`POST /auth/check-email`（登录密码提交前）

---

## 隐私授权 × 用户协议 — 统一口径（禁止改错）

> 完整过程记录：`docs/diagnostics/2026-09-02-privacy-login-fix-handoff.md`
> 已验证基准：登录页进页弹官方图二；拒绝后再点按钮可重弹；同意后再弹图一并登录。

### 图一 / 图二（绝对不要搞反）

| 称呼 | 是什么 | UI | 代码 | 禁止当成 |
| --- | --- | --- | --- | --- |
| **图一** | 业务《用户协议》 | 白底自定义弹窗，蓝「同意」 | `AgreementDialog` | ❌ 不是微信隐私 |
| **图二** | 微信《隐私保护指引》 | 系统原生「用户隐私保护提示」，绿「同意」+ 灰「拒绝」 | `wx.requirePrivacyAuthorize`（不注册 listener 时由微信自绘） | ❌ 不是 `PrivacyPopup` |

**第三个不要再用的东西**：自研 `PrivacyPopup`（底部白底「隐私保护指引」）。注册 `onNeedPrivacyAuthorization` 后会**顶替**图二。当前产品要求：**只要官方图二，不要自研隐私弹窗**。

### 产品流程（登录页）

```
进入登录页 → 延迟唤起图二（requirePrivacyAuthorize）
    ↓ 用户拒绝
任意登录页操作（账号登录 / 微信登录 / 注册 / 找回密码）→ 同步栈再次 require 图二 + toast
    ↓ 用户同意图二
点击登录 → 未勾协议则弹图一（AgreementDialog）→ 同意后执行登录
```

### 实现铁律

1. **不要**在 `app.tsx` 注册 `registerPrivacyListener()` / `onNeedPrivacyAuthorization`，否则微信不再弹官方图二。
2. **进页弹窗**用主包 API：`promptWechatOfficialPrivacyOnPageEnter`（`src/utils/privacy.ts`）。
3. **点击再弹**用主包 API：`promptOfficialPrivacyOnUserAction`（同文件）。分包页面**禁止**从会拆到 `sub-common` 的模块单独拉隐私实现，优先只 import `@/utils/privacy`。
4. `requirePrivacyAuthorize` 必须在用户点击的**同步调用栈**内调用；**禁止**在 `getPrivacySetting.success` 里再 require（假同步栈 → 真机挂死）。
5. 登录 execute 内**不要**再 `await ensurePrivacyBeforeAuth()` 二次门闩。
6. 调试过滤：`privacy.trace`。期望进页见 `officialPrivacy.pageEnter*`；点击见 `login.runAfterOfficialPrivacy` + `officialPrivacy.userAction*`。**不应**再出现 `PrivacyPopup.mounted` / `onNeedPrivacyAuthorization.fired`。

### 关键文件

| 文件 | 职责 |
| --- | --- |
| `src/utils/privacy.ts` | 主包：进页 / 点击官方图二 |
| `src/utils/privacy-authorize.ts` | 兼容 re-export + ensure 查询；新逻辑写 privacy.ts |
| `src/package-auth/pages/login/index.tsx` | 进页图二 + `runAfterOfficialPrivacy` + 图一 |
| `src/components/AgreementDialog` | 仅图一 |
| `src/components/PrivacyPopup` | 遗留；产品路径勿再挂载 |

📖 See: `rules/80-compliance.md`（提审）、`skills/wechat-submit-check.md`
