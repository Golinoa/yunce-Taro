---
last_updated: 2026-09-12
status: active
---

# agents — 谁来做、有什么权限

> 专业化本身就是上下文管理策略：每个角色只带自己需要的上下文，运行在 "Smart Zone" 内。

| 角色 | 职责 | 工具权限 | 何时启用 |
| --- | --- | --- | --- |
| `frontend-engineer.md` | 实现具体任务 | 限定范围的读写 | 默认执行者 |
| `reviewer.md` | 审查改动、标记问题 | 只读 + 标记 | 每次交付前 |
| `researcher.md` | 探索代码库、摸清现状 | 只读 | 需求不清 / 找不到实现 |

## 交接约定

1. **researcher → engineer**：调研结论落进 `changes/<feature>/design.md`，不要只留在对话里。
2. **engineer → reviewer**：交付时附「改了哪些文件 + 跑了哪些检查 + 未决问题」。
3. **reviewer → engineer**：按 `skills/code-review.md` 逐条给结论；发现的问题要么当场修，要么记进 ISSUES。
4. 一个问题连续 3 次修复失败 → 停下来报告，换思路，不要重复同一种尝试。
