---
last_updated: 2026-09-12
status: active
source: PDF「Doc-gardening Agent」「腐烂的文档比没有更误导」
---

# Skill: 文档园丁（doc-gardening）

> 每两周扫描一次**文档与代码的不一致**，发现过时内容就修，而不是等它误导别人。
> 原则：**过期文档比没有更误导**。

## 触发

- 每两周例行一次（可并入环境审查）
- 任何改代码后发现文档没跟上时，随手触发

## 扫描范围

| 目标 | 找什么 |
| --- | --- |
| `.harness/rules/*.md` | 规则描述与现行代码不符；`last_updated` 过期；source 丢失 |
| `.harness/wiki/*.md` | 事实清单过时（Mock 时代描述、已删目录、改名组件/Service） |
| `.harness/skills/*.md` | 步骤里的命令 / 路径已失效 |
| `AGENTS.md` | 入口地图是否还准确（新规则是否登记） |
| `docs/reference/*.md` | 历史快照标注是否还在；是否有人误当现行事实引用 |

## 高效扫描命令

```bash
# 找 Mock 时代残留描述（项目已真实 API 联调）
grep -rn "src/data/\|VITE_USE_MOCK=true\|Mock 驱动" --include="*.md" . | grep -v node_modules | grep -v "_archive"

# 找指向已删除文件 / 目录的引用
grep -rn "Agents/\|src/data/" --include="*.md" --include="*.mdc" . | grep -v node_modules | grep -v "_archive"

# 找 last_updated 超过 30 天的规则文件
find .harness -name "*.md" -newermt "-30 days" -not -newermt "today" | head
```

## 修复原则

- [ ] **以代码为准**：文档与代码冲突时，改文档
- [ ] 过时参考文档（如 code-wiki）→ 标注"历史快照，以 .harness 为准"，不逐条改
- [ ] 规则 / 事实过时 → 直接修内容 + 重签 `last_updated`
- [ ] 修复走独立提交，标题 `docs:` 前缀
- [ ] 无法判断是否正确 → 登记 ISSUES 台账，不瞎改

## 完成标准

- [ ] 无已知过时描述残留
- [ ] 每个 `.harness` 文件 `last_updated` 为当前日期或近期
- [ ] 发现的漂移已修或已登记
