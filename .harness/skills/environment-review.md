---
last_updated: 2026-09-12
status: active
source: PDF「每周 30 分钟环境审查」落地清单
---

# Skill: 环境审查（environment-review）

> 每周一次（约 30 分钟），检查 Harness 本身是否跟得上代码库。**审查环境，不是审查代码。**
> 建议频率：每周一次；重大重构 / 多轮迭代后可随时触发。

## 检查清单

### 1. 规则是否覆盖新 bad pattern

- [ ] 本周 CI / Review 中出现的报错，`rules/` 是否已覆盖？（未覆盖 → 走 `rule-capture.md`）
- [ ] 是否有规则被反复违反 3 次以上？（→ 应转成 ESLint 规则或强化规则）
- [ ] 是否存在互相冲突的规则？（冲突只保留一条）

### 2. 文档是否跟代码一致

- [ ] `wiki/` 事实是否过时（如 Mock 时代描述、已删目录、改名组件）？
- [ ] 新增组件 / Service / 路由是否登记进 `wiki/component-catalog.md` / `routing-and-pages.md`？
- [ ] `changes/` 是否有 Design 状态过期（Draft 超 30 天）？
- [ ] 发现不一致 → 运行 `doc-gardening.md` 修复

### 3. 技术债信号

- [ ] 超长文件 / 缺失测试 / 未用 import 是否有积累？（→ `tech-debt-sweep.md`）
- [ ] 遗留 SCSS（`src/styles/`）迁移进度是否推进？

### 4. 工具链状态

- [ ] `npm run check` 是否通过？（typecheck + lint + format）
- [ ] CI 是否正常？（`ci.yml` 最近一次结果）
- [ ] 依赖是否有异常升级尝试（package.json 未预期的变化）？

### 5. 智能体适配层

- [ ] AGENTS.md 入口地图是否还准确（新规则是否漏登记）？
- [ ] 指针层（`.cursor/00-harness-entry.mdc`、`codex.md`）是否仍只指路不复制？

## 输出

- 发现问题 → 走对应 skill（rule-capture / doc-gardening / tech-debt-sweep）
- 无可做项 → 在 `changes/environment-review/` 记录"本周无异常"（日期）

## 节奏

- **每周**：环境审查（本 skill）
- **每两周**：doc-gardening
- **每月**：review 全部 rules 是否仍成立（可并入环境审查）
