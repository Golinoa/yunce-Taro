---
last_updated: 2026-09-12
status: active
owner: @product
source: 微信审核红线
---

# R80 合规红线（提审必过）

> 立场：给出**能否上线 / 缺什么配置**的明确结论，不提供绕审核的灰招。

## 隐私协议

❌ 登录 / 注册前无法触达《用户协议》《隐私政策》，或默认勾选

✅ FIX: 复用 `AgreementDialog` / `AgreementSheet`，协议页 `/package-settings/pages/agreement/index?type=...`；未同意不得继续。

- `app.config.ts` 中 `requiredPrivateInfos` 必须覆盖所有用到的隐私接口（`chooseLocation`、`chooseMedia` 等），未声明会报错。
- `__usePrivacyCheck__` 上线前必须为合规开启状态；临时 `false` 只是过渡。
- 协议文案 / 收集清单变更时：协议页 + 后台《个人信息保护指引》+ `requiredPrivateInfos` 三者同步。

## 最小必要

- 能不收集就不收集；能本地处理就不上传；能脱敏就脱敏（手机号中间位、学员敏感备注）。
- 头像昵称：走用户主动选择，禁止已废弃的强制 `getUserProfile` 套路。
- 手机号：走官方 `button open-type="getPhoneNumber"`，说明用途，禁止强制绑定。
- 定位 / 选点：仅用户主动操作时触发，说明用途，失败给手动填写降级。
- 相册 / 选图：说明用途、限制大小与张数，拒绝授权不崩溃、可跳过。
- 剪贴板、通讯录、日历、录音、蓝牙：默认不用；确需必须有业务必要并写入隐私指引。

## 存储与日志

❌ 明文落盘密码；日志打印身份证、完整银行卡、验证码、Token

✅ FIX: Token / 身份上下文用受控存储；日志与 Toast 脱敏。

## 内容与业务

- 类目 / 命名 / 简介 / 截图与实际能力一致（「松果排课」，教务工具属性）。
- 禁止诱导分享、诱导关注、虚假承诺、夸大招生话术。
- 涉及学费 / 充值必须走微信支付合规流程，前端不得伪造支付成功态，金额与后端一致。
- UGC 展示注意 XSS 风险，不可信 HTML 不随意 `rich-text`。
- 多角色数据隔离：家长只看到自己的孩子，教师按 scope，校长 / 管理员按校区。

## 安全与审计

- 写操作（权限变更、发薪、消课、转校）应可追踪，已有 audit 能力不要绕过。
- 正式包关闭调试后门、Mock 开关、测试账号明文。

## 提审自检清单

📖 See: ../skills/wechat-submit-check.md
