---
last_updated: 2026-09-12
status: active
---

# changes — 任务进展状态（持久化记忆）

> 每个功能一个目录，设计文档 + 进度 checklist 落盘。
> **Agent 跨会话靠这里的文件系统续接上下文，不靠聊天记录。**

## 约定

1. **一个功能一个目录**：`changes/<module>-feature/`（kebab-case），如 `changes/coupon-feature/`。
2. 目录内固定三件套：
   - `design.md` — 设计文档（目标 / 非目标 / 涉及模块 / 验收标准），从 `_template/design.md` 复制。
   - `progress.md` — 进度 checklist（计划 → 进行中 → 已完成，带日期）。
   - `decisions.md` — 关键决策与原因（遇到冲突、取舍时记录）。
3. **任务态**：设计文档未 Approved 前，编码 Agent 不应开始实现（见 `skills/new-module.md` 流程）。
4. 状态流转用标题标注：`Status: Draft → Approved → In Progress → Implemented`。
5. 完成后**不删目录**，留作审计与上下文（后续同类功能可复用）。

## 如何开始

```bash
mkdir -p changes/<module>-feature
cp changes/_template/design.md changes/<module>-feature/design.md
```

然后写目标 → 找 reviewer 确认 → 开工。模板见 `changes/_template/design.md`。
