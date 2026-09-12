---
last_updated: 2026-09-12
status: active
---

# wiki — 这个项目的事实是什么

> wiki 存**事实清单**（有什么、在哪、长什么样），不存禁令。禁令在 `../rules/`。
> 按需查询，不要整体读进上下文。

| 文件 | 内容 |
| --- | --- |
| `directory-structure.md` | 目录结构、文件命名、导出规范 |
| `module-map.md` | **业务模块地图：分包→页面→服务映射 + mermaid 架构图（新增必查/必更）** |
| `architecture-boundaries.md` | 分层依赖图、跨层禁令、豁免白名单 |
| `component-catalog.md` | 组件清单与 Props（开发前必查） |
| `design-tokens.md` | Token 使用表、UnoCSS 约定 |
| `routing-and-pages.md` | 路由、生命周期、页面配置 |
| `api-integration.md` | 联调环境、数据链路、命令、台账入口 |
| `swappable-schedule-card.md` | 左滑卡片交互指南（手势分区 / Props / 互斥） |

## 维护

- 改代码后同步更新对应 wiki 条目，并重签 `last_updated`。
- 文档与代码不一致时，**以代码为准**并立即修文档（腐烂的文档比没有更误导）。
