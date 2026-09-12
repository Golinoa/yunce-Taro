---
last_updated: 2026-09-12
status: active
source: PDF「后台清理 Agent 定时任务模板」「持续小额偿还技术债」
---

# Skill: 技术债清理（tech-debt-sweep）

> 后台清理 Agent 的落地版：定期扫技术债，**每个修复一个独立 PR**，持续小额偿还而非集中还债。

## 触发

- 每月例行一次（可并入环境审查）
- 用户要求"清理技术债"时

## 检查清单（逐项扫描，发现问题生成独立 PR）

| # | 检查项 | 扫描命令 / 方法 | 修复动作 |
| --- | --- | --- | --- |
| 1 | 超长文件 | `find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head` | 拆分为更小组件 / 工具 |
| 2 | 缺失测试 | `find src -name "*.ts" ! -name "*.test.ts" | head` | 为 Service / 工具补基础单测 |
| 3 | 未使用 import | `npm run lint`（noUnusedLocals 已开） | 清理 |
| 4 | TODO / FIXME 超 30 天 | `grep -rn "TODO\|FIXME" src/` | 处理或登记，不静默遗留 |
| 5 | 重复代码 | 人工抽查相似组件 / 逻辑 | 提取共享工具 / 组件 |
| 6 | 遗留 SCSS | `ls src/styles/` | 迁移为 UnoCSS 后删除 |
| 7 | 过时文档 | 见 `doc-gardening.md` | 修 / 标注 |

## 约束（重要）

- [ ] **每个修复独立 PR**，不要混在一起
- [ ] 每个修复后 `npm run check` 通过（typecheck + lint + format）
- [ ] 提交标题 `chore(cleanup): [具体描述]`
- [ ] **不改变业务行为**：清理类改动禁止顺手改逻辑 / 重构功能
- [ ] **不确定是否安全 → 跳过并标注原因**，不要冒险
- [ ] 涉及运行时代码 → 按 `verify-build.md` 向用户申请编译验证
- [ ] 涉及角色 / 权限代码 → 先读 `rules/60-role-identity.md`
- [ ] 涉及走查冻结链路（invite / auth / store-entry）→ 先读 `rules/07-walkthrough-frozen-chains.md`

## 完成标准

- [ ] 每个发现已修复（独立提交）或已登记跳过原因
- [ ] `npm run check` 全绿
- [ ] 无业务行为变更
