---
last_updated: 2026-09-12
status: active
---

# Skill: 验证与交付

> **编译由用户亲自执行**。需要在 AI 侧跑构建时，先向用户申请并说明命令与用途，不要自行启动全量构建。

## 分层验证（由快到慢）

| 层级 | 命令 | 何时跑 |
| --- | --- | --- |
| 类型 | `npm run typecheck` | 每次改 `src/**/*.ts(x)` |
| 规范 | `npm run lint` | 每次改代码 |
| 格式 | `npm run format:check` | 提交前 |
| 全量静态 | `npm run check` | 交付前（= typecheck + lint + format:check） |
| 单测 | `npm test` | 改了逻辑 / 工具函数 / Service |
| 覆盖率 | `npm run coverage` | 需要量化时 |
| 编译 | `npm run build:weapp:dev` | 影响运行时代码时 |

## 编译命令（用户执行）

| 命令 | 用途 |
| --- | --- |
| `npm run dev:weapp` | 开发 + 热更 |
| `npm run dev:weapp:dev` | 开发，连测试环境、关 Mock |
| `npm run build:weapp:dev` | 测试环境构建 |
| `npm run build:weapp:prod` | 生产构建 |
| `npm run build:weapp:clean` | 清缓存全量（仅 dist 损坏时用） |

> 增量优先，全量慢。只有 dist 损坏（如 `dist/app.js` 缺失）才清缓存全量重建。
> 仅修改文档无需业务编译。

## 交付时必须说明

- [ ] 是否已重编译，dist 是否是最新
- [ ] 跑了哪些检查、结果如何
- [ ] 未接通 / 待确认项是否登记进 ISSUES 台账
- [ ] 有无需要用户决策的冲突（前端 UI 已固定，后端优先兼容前端）

## 验收要点

```bash
ls -la dist/app.js                      # 存在
grep -r "api.chancore.cn" dist/ | head -1   # 生产域名存在
```

## 验证分支（业务改动）

按模块验证**五种分支**：正常 / 空态 / 错误 / 无权限 / 幂等。

## 标签与推送

| 标签 | 触发 | 用途 |
| --- | --- | --- |
| `dev-*` / `ci-*` | `ci.yml` 质量门禁 | **默认**：推代码、跑 CI |
| `v*` | `release.yml` prod 构建 + `upload:weapp` | **仅当用户明确要求**发体验版 |

**默认 `dev-*`，禁止擅自打 `v*` 或执行 `upload:weapp`。** 详见 `.cursor/rules/taro-tag-default-dev.mdc`。
