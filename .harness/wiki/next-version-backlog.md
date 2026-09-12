---
last_updated: 2026-09-12
status: active
source: .cursor/rules/next-version-backlog.mdc 迁移
---

# 下个版本待办（Next Version Backlog）

> 本版不做，仅记录口径，防止被误当成"当前需求"实现。

## 员工上下班签到 · 考勤记录

- **本版不做**：首页 / 教学台账不再提供与「上课记录 / 课消」重复的考勤入口。
- **下版要做**：员工上下班签到流水（非上课点名）。
- **加载约定**（已对齐产品口径）：
  - 禁止 `getAll` / 一次拉全库
  - 「全部」按**月份折叠**：默认展开本月明细；历史月展开时再拉该月分页
  - 先拉月份索引（month + count），再 `month + page + pageSize` 拉明细
- **入口**：下版再挂金刚位 / 教学台账「考勤」Tab，文案明确为「签到考勤」。
