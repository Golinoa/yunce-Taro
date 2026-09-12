---
last_updated: 2026-09-12
status: active
---

# rules — 什么必须永远为真

## 规则格式（写新规则时必须遵守）

每条规则三要素，缺一不可——**Linter/Agent 读到报错就要能自愈，不需要人再解释**：

```
❌ [什么错了]
✅ FIX: [怎么改，给出代码片段]
📖 See: [哪个文档有详细说明]
```

## 索引

| 文件 | 覆盖范围 | 触发场景 |
| --- | --- | --- |
| `00-core-stack.md` | 技术栈锁定、依赖方向、导出与命名 | 任何代码改动 |
| `05-auth-and-privacy.md` | 邮箱认证口径、隐私授权图一/图二、协议弹窗 | 登录/注册/找回密码/隐私授权 |
| `06-membership-native-nav.md` | 会员页原生导航栏、订单详情入口位置 | 会员权益/订单相关页 |
| `07-walkthrough-frozen-chains.md` | 走查冻结链路（P0/P1 邀请/登录），改前必须评估 | 涉及 invite/wxacode/store-entry/auth 等 |
| `10-styling.md` | UnoCSS、设计 Token、rpx、禁 SCSS / 内联 style | 写样式 |
| `20-components.md` | 先查后写、组件结构、Props、JSDoc | 写 / 改组件 |
| `30-sheets-and-forms.md` | BottomSheet 单 prop、独立 Sheet、FormInput | 写弹窗 / 表单 |
| `40-data-and-services.md` | Service 唯一出口、禁止 Mock、契约核对 | 接接口 |
| `50-state-and-types.md` | Zustand 用法、TypeScript 严格度 | 写状态 / 类型 |
| `60-role-identity.md` | 角色身份四层模型（**改角色相关代码必读**） | 涉及 `UserRole`/`orgRole`/`campusRole`/`identity` |
| `70-wechat-platform.md` | 分包、主包体积、域名、API 可用性、渲染性能 | 小程序平台相关 |
| `80-compliance.md` | 隐私、最小必要、内容与资金合规 | 提审 / 涉及用户信息 |
| `90-scroll-interaction.md` | ScrollView、FAB、PickerView | 首页交互、滚轮选择器 |

## 加载策略

- **必读**：`00-core-stack.md` + 与任务直接相关的 1-2 个文件。
- **不要一次全读**：上下文是稀缺资源，全塞进来会挤掉任务本身。
- 冲突时以 `00-core-stack.md` 与仓库现行代码为准，并把冲突记进 ISSUES 台账。
