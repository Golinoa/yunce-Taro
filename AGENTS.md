# AGENTS.md — yunceTaro（云策教务小程序）AI 开发指令面

> **本文件只是地图。** 规则正文**唯一**在 [`.harness/`](.harness/README.md)，动手前先按地图加载，不要凭记忆或猜。
>
> **当前联调约束（2026-09-08）**：[统一模块入口](../yunce-back/yunce-backend/docs/development/README.md)。全模块验收；前端 UI 固定，后端优先兼容前端。问题和冲突进统一台账，历史进度数字不代表当前验收。

---

## 📍 按任务导航

| 你要做什么 | 加载什么 |
| --- | --- |
| 任何代码改动（必读） | [`.harness/rules/README.md`](.harness/rules/README.md) — 规则索引 |
| 技术栈 / 目录结构 / 工程化 | [`.harness/rules/00-core-stack.md`](.harness/rules/00-core-stack.md) |
| 邮箱认证 / 隐私授权 | [`.harness/rules/05-auth-and-privacy.md`](.harness/rules/05-auth-and-privacy.md) |
| 会员 / 原生导航 | [`.harness/rules/06-membership-native-nav.md`](.harness/rules/06-membership-native-nav.md) |
| 走查冻结链路 | [`.harness/rules/07-walkthrough-frozen-chains.md`](.harness/rules/07-walkthrough-frozen-chains.md) |
| 写样式 | [`.harness/rules/10-styling.md`](.harness/rules/10-styling.md) + [`wiki/design-tokens.md`](.harness/wiki/design-tokens.md) |
| 写 / 改组件 | [`.harness/rules/20-components.md`](.harness/rules/20-components.md) + [`wiki/component-catalog.md`](.harness/wiki/component-catalog.md) |
| 写弹窗或表单 | [`.harness/rules/30-sheets-and-forms.md`](.harness/rules/30-sheets-and-forms.md) → [`skills/new-sheet.md`](.harness/skills/new-sheet.md) |
| 接接口 / 数据层 | [`.harness/rules/40-data-and-services.md`](.harness/rules/40-data-and-services.md) + [`wiki/api-integration.md`](.harness/wiki/api-integration.md) |
| 状态管理 / 类型 | [`.harness/rules/50-state-and-types.md`](.harness/rules/50-state-and-types.md) |
| **角色 / 权限 / 身份（硬性必读）** | [`.harness/rules/60-role-identity.md`](.harness/rules/60-role-identity.md) |
| 微信平台能力（订阅消息 / 授权） | [`.harness/rules/70-wechat-platform.md`](.harness/rules/70-wechat-platform.md) |
| 隐私 / 合规 / 提审 | [`.harness/rules/80-compliance.md`](.harness/rules/80-compliance.md) |
| 滚动 / 蒙层 / PickerView / 手势交互 | [`.harness/rules/90-scroll-interaction.md`](.harness/rules/90-scroll-interaction.md) |
| 新增页面 | [`.harness/skills/new-page.md`](.harness/skills/new-page.md) |
| 新增业务模块 | [`.harness/skills/new-module.md`](.harness/skills/new-module.md) |
| 提交前自检 | [`.harness/skills/code-review.md`](.harness/skills/code-review.md) |
| 编译与交付 | [`.harness/skills/verify-build.md`](.harness/skills/verify-build.md) |
| 提交微信审核 | [`.harness/skills/wechat-submit-check.md`](.harness/skills/wechat-submit-check.md) |
| 沉淀新规则 / 新技能 | [`.harness/skills/rule-capture.md`](.harness/skills/rule-capture.md) |
| 环境审查 / 文档园丁 / 技术债 | [`environment-review.md`](.harness/skills/environment-review.md) · [`doc-gardening.md`](.harness/skills/doc-gardening.md) · [`tech-debt-sweep.md`](.harness/skills/tech-debt-sweep.md) |
| 查项目事实 | [`.harness/wiki/README.md`](.harness/wiki/README.md) — 目录 / Token / 组件 / 路由 / 环境 |
| **查业务在哪（模块地图）** | [`.harness/wiki/module-map.md`](.harness/wiki/module-map.md) — 分包 → 页面 → services/stores + 架构图 |
| 架构边界（谁依赖谁） | [`.harness/wiki/architecture-boundaries.md`](.harness/wiki/architecture-boundaries.md) |
| 任务进展（跨会话续接） | [`.harness/changes/<feature>/`](.harness/changes/README.md) |

## 🗺️ 结构总览

```
.harness/
├── rules/     # 什么必须永远为真（14 个约束，按任务加载 1-2 个）
├── skills/    # 这件事按什么步骤做（6 功能交付 + 4 治理，共 11 个）
├── agents/    # 谁来做、有什么权限（engineer / reviewer / researcher）
├── wiki/      # 这个项目的事实是什么（按需查询，含模块地图）
└── changes/   # 当前任务进展到哪（每功能一目录）
```

## ⚠️ 四条底线（违反即返工）

1. **先加载后动手**：规则索引没读就改代码 = 默认返工。
2. **冲突以 `.harness` 为准**：本文件只导航；`.cursor/rules/00-harness-entry.mdc`、`codex.md` 均为一行指针，不复制正文。
3. **编译由用户执行**：AI 需要编译时先向用户申请并说明命令与用途，**不自行跑构建**。交付前跑 `npm run check`（typecheck + lint）。
4. **推远程默认 `dev-*`**：**禁止擅自打 `v*` 或上传微信体验版**，除非用户明确要求。详见 [`rules/00-core-stack.md`](.harness/rules/00-core-stack.md)。

## 🧰 常用命令

```bash
npm run typecheck     # TypeScript 类型检查
npm run lint          # ESLint
npm run format:check  # 格式检查
npm run check         # 全量检查（typecheck + lint + format）
npm test              # Vitest
```

## 🔗 相关文档

- 后端工程规则：[`../yunce-back/yunce-backend/.harness/`](../yunce-back/yunce-backend/.harness/README.md)
- 运营后台工程规则：[`../yunce-back/yunce-admin/apps/web-antd/.harness/`](../yunce-back/yunce-admin/apps/web-antd/.harness/README.md)
- 联调入口 / 修复计划：[`../yunce-back/yunce-backend/docs/development/README.md`](../yunce-back/yunce-backend/docs/development/README.md)
