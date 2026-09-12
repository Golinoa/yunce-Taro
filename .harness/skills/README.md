---
last_updated: 2026-09-12
status: active
---

# skills — 这件事按什么步骤做

> rules 回答「什么不能做」，skills 回答「按什么顺序做」。开工前**选一个**流程，逐步执行并在每步打勾。

## 索引

### 功能交付型

| Skill | 何时用 |
| --- | --- |
| `new-page.md` | 新增一个页面 |
| `new-module.md` | 新增一个业务模块（types → services → stores → components → pages） |
| `new-sheet.md` | 新增一个业务弹窗 |
| `code-review.md` | 提交前自检 / 审查他人改动 |
| `verify-build.md` | 改完运行代码后验证与交付说明 |
| `wechat-submit-check.md` | 准备提交微信审核 |

### 治理型（维护 Harness 本身）

| Skill | 何时用 |
| --- | --- |
| `rule-capture.md` | **沉淀新规则 / 新技能**：什么时候写 rules / skills、写哪、三要素校验 |
| `environment-review.md` | **每周**：环境审查（规则覆盖、文档漂移、工具链状态） |
| `doc-gardening.md` | **每两周**：扫文档-代码不一致并修复 |
| `tech-debt-sweep.md` | **每月**：技术债清理（独立 PR、不改变业务行为） |

## 通用节拍

```
理解（读 rules + wiki）→ 计划（在 changes/<feature>/ 写设计文档）→ 执行（最小改动）→ 验证（typecheck / lint / 编译）→ 审查（code-review）
```

任何一步不确定，先停下来查，不要靠猜推进。
