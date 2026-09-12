---
last_updated: 2026-09-12
status: active
owner: @frontend
---

# .harness — 云策教务前端（yunceTaro）驾驭层

> 本目录是 **AI 编码规则的唯一事实源**。**所有智能体（Cursor / Codex / WorkBuddy 等）统一从这里加载约束**，动手前按这里加载上下文，不要凭记忆或猜。

## 唯一规则源原则（硬性）

1. **规则正文只允许存在于 `.harness/`**——`rules/` 放约束、`skills/` 放流程、`agents/` 放角色、`wiki/` 放事实、`changes/` 放任务态。
2. **其他智能体的配置文件（`.cursor/rules/*.mdc`、Codex 的 rules、WorkBuddy 的 AGENTS 注入等）一律只做"指针"**：指向根目录 `AGENTS.md` 入口地图，不复制正文。正文出现第二份 = 两份真相 = 违反本原则。
3. **新规则先想归属**：约束 → `rules/`，事实 → `wiki/`，流程 → `skills/`，角色 → `agents/`，任务 → `changes/`。
4. **规则可追溯**：每条 `rules/` 规则都应能追溯到一次真实事故或反复出现的 Review 意见。新增时写明来源。
5. **过期文档比没有更糟**：改代码后同步修订对应规则并重签 `last_updated`。

## 这是什么

Harness（驾驭层）是让 Agent 稳定工作的约束与反馈系统。它不替代 Taro / ESLint / CI，而是**位于它们之上**：
把「团队口头约定」翻译成可机械执行的规则，让环境而不是人去保证一致性。

闭环：**约束（rules） → 告知（wiki） → 验证（skills/verify-build） → 纠正（skills/code-review）**

## 五目录职责

| 目录 | 回答的问题 | 何时加载 |
| --- | --- | --- |
| `rules/` | 什么必须永远为真 | 每次会话读 `rules/README.md` 索引，按任务加载对应文件 |
| `skills/` | 这件事按什么步骤做 | 开工前选一个流程，逐步执行 |
| `agents/` | 谁来做、有什么权限 | 需要分角色（执行 / 审查 / 调研）时 |
| `wiki/` | 这个项目的事实是什么 | 按需查询，不常驻上下文 |
| `changes/` | 当前任务进展到哪 | 每个功能开一个目录，跨会话续接 |

## 快速导航

| 你想做什么 | 去哪里 |
| --- | --- |
| 改任何代码前的底线 | `rules/README.md` |
| 写样式 | `rules/10-styling.md` + `wiki/design-tokens.md` |
| 写 / 改组件 | `rules/20-components.md` + `wiki/component-catalog.md` |
| 写弹窗或表单 | `rules/30-sheets-and-forms.md` → `skills/new-sheet.md` |
| 接接口 | `rules/40-data-and-services.md` + `wiki/api-integration.md` |
| 新增页面 | `skills/new-page.md` |
| 新增业务模块 | `skills/new-module.md` |
| 动角色 / 权限 / 身份 | `rules/60-role-identity.md`（**硬性，必读**） |
| 提交前自检 | `skills/code-review.md` |
| 编译与交付 | `skills/verify-build.md` |
| 提交微信审核 | `skills/wechat-submit-check.md` |
| **沉淀新规则 / 新技能** | `skills/rule-capture.md` |
| **每周环境审查 / 每两周文档园丁 / 每月技术债** | `skills/environment-review.md` · `doc-gardening.md` · `tech-debt-sweep.md` |
| 架构边界（谁依赖谁） | `wiki/architecture-boundaries.md` |

## 使用纪律

1. **先加载，后动手**：不确定就读 `rules/README.md` 索引，别猜。
2. **rules 与 wiki 不重复**：rules 写「禁止什么 + 怎么改」，wiki 写「事实清单」。新增内容先判断归属。
3. **规则可追溯**：每条 `rules/` 规则都应能追溯到一次真实事故或反复出现的 Review 意见。新增时写明来源。
4. **一个功能一个 `changes/` 目录**：设计文档 + 进度 checklist 落盘，跨会话靠文件系统续接。
5. **过期文档比没有更糟**：改代码后同步修订对应规则并重签 `last_updated`。

## 与既有文件的关系

- 根目录 `AGENTS.md` → **入口地图**（所有智能体共享的导航），顶部快速导航指向本目录；正文为迁移兼容层。
- `.cursor/rules/00-harness-entry.mdc` → **唯一导航层**：`alwaysApply` 全局生效，正文只指向 `AGENTS.md` + `.harness/`，不复制规则（原 17 个分主题 mdc 已合并删除）。
- `codex.md` → Codex 适配层指针，同样只指路不复制。
- WorkBuddy → 以根 `AGENTS.md` 为注入入口，规则一律读 `.harness/`。
- 归档（`docs/diagnostics/_archive/`）→ 历史记录，不承担规则职责。

> **约定**：以后任何智能体新增规则，只能写进 `.harness/`；各工具适配层保持指针不动。
