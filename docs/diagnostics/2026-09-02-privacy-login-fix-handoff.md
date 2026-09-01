# 隐私授权 × 登录流程 — 过程记录与最终口径

> **日期**：2026-09-02  
> **仓库**：`yunceTaro`  
> **状态**：已彻底解决（开发者工具验证通过）  
> **相关 commit**：  
> - `14a1440` — 改用微信官方图二、去掉自研挂载、进页弹窗、TabBar 修复  
> - （本记录对应提交）— 拒绝后点击重弹、主包 API 统一、口径固化  

---

## 0. 统一口径（以后以本节为准）

| 称呼 | 含义 | UI | 代码 |
|------|------|-----|------|
| **图一** | 业务《用户协议》 | 自定义白底弹窗，蓝「同意」 | `AgreementDialog` |
| **图二** | 微信《隐私保护指引》 | 系统「用户隐私保护提示」，绿同意 / 灰拒绝 | `requirePrivacyAuthorize`（**不**注册 `onNeedPrivacyAuthorization`） |

**禁止混淆**：早期文档曾把「图一/图二」写反。自研 `PrivacyPopup` ≠ 图二；注册 listener 后微信**不会**再弹官方图二。

**产品顺序**：

1. 进入登录页 → **图二**  
2. 用户拒绝图二 → 登录页任意操作再次唤起图二（+ toast）  
3. 用户同意图二后点登录 → **图一** → 登录  

Cursor 规则：`.cursor/rules/privacy-auth.mdc`（alwaysApply）

---

## 1. 问题演变（多轮踩坑摘要）

| 轮次 | 错误做法 | 后果 |
|------|----------|------|
| A | `getPrivacySetting.success` 里才 `require`（假同步栈） | 真机不弹窗、登录挂死；单测全绿 |
| B | 注册 `onNeedPrivacyAuthorization` + 挂载 `PrivacyPopup` | 弹的是自研框，**永远看不到**官方图二 |
| C | 图一/图二称呼写反 | 改错弹窗、对不上产品截图 |
| D | 登录 execute 内再 `ensurePrivacyBeforeAuth` | 授权成功后仍可能被掐断 |
| E | 隐私实现放分包易进 `sub-common` | `module ... is not defined`，登录页白屏/无弹窗 |
| F | 拒绝后未在按钮同步栈再 `require`；或改完未 rebuild | 拒绝后点按钮无反应；trace 无 `userAction` |

---

## 2. 最终实现（当前正确）

### 2.1 原则

- **不**在 `app.tsx` 注册隐私 listener，保留微信系统图二。  
- 进页 / 点击 API 都放在主包 `src/utils/privacy.ts`。  
- 登录页只 `import` `@/utils/privacy`。  
- 点击路径：`promptOfficialPrivacyOnUserAction`（同步栈 require；已授权则跳过）。  
- 进页路径：`promptWechatOfficialPrivacyOnPageEnter`（默认 delay 450ms；已授权跳过）。  
- 图一仍走 `AgreementDialog` + `ensureAgreement`。

### 2.2 关键文件

| 文件 | 职责 |
|------|------|
| `src/utils/privacy.ts` | `promptWechatOfficialPrivacyOnPageEnter`、`promptOfficialPrivacyOnUserAction` |
| `src/utils/privacy-authorize.ts` | 兼容 re-export、`ensurePrivacy*` 查询 |
| `src/package-auth/pages/login/index.tsx` | 进页图二 + `runAfterOfficialPrivacy` + 图一 |
| `src/app.tsx` | 不注册 listener、不挂载 PrivacyPopup |
| `.cursor/rules/privacy-auth.mdc` | 全局口径 |

### 2.3 调试

Console 过滤：`privacy.trace`

| 场景 | 期望 trace |
|------|------------|
| 进登录页 | `login.page.show` → `officialPrivacy.pageEnter.schedule` → `officialPrivacy.pageEnter` |
| 拒绝图二 | `officialPrivacy.pageEnter.fail` → `store.setStatus: denied` |
| 拒绝后再点登录等 | `login.runAfterOfficialPrivacy` → `officialPrivacy.userAction` |
| 同意后登录 | 图一 → `login.executeWechatLogin.start` 等 |
| 不应出现 | `PrivacyPopup.mounted`、`onNeedPrivacyAuthorization.fired` |

微信工具提示「请适配小程序隐私保护指引」在用户拒绝后可能出现，属合规提醒，不等于业务崩溃。改完必须 **rebuild + 开发者工具编译刷新** 再验。

---

## 3. 验证清单（已通过）

- [x] 进登录页弹出官方图二  
- [x] 拒绝后 `status: denied`  
- [x] 拒绝后点按钮再次弹出图二  
- [x] 同意图二后点登录弹出图一  
- [x] 无 sub-common `module is not defined`  
- [x] `privacy-authorize` 单测通过  

---

## 4. 历史对照（勿再采用）

旧 handoff 中「图一=隐私 / 图二=用户协议」及「必须 registerPrivacyListener + PrivacyPopup」均为**过时方案**，以本文 **§0** 与 `privacy-auth.mdc` 为准。
