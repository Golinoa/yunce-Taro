---
last_updated: 2026-09-12
status: active
---

# 联调环境、数据链路与命令

## 环境

| 环境 | API 域名 | 用途 |
| --- | --- | --- |
| 线上 | `https://api.chancore.cn/api/app/v1` | 生产 |
| 联调 | `https://devops.chancore.cn/api/app/v1` | 开发联调（dev） |

- 域名切换在 `src/services/` 请求层（`utils/request.ts`）按构建环境控制。
- Mock 由 `VITE_USE_MOCK` 构建期切换；**生产构建守卫强制关闭 mock**（G-01 守卫）。

## 数据链路（唯一出口）

```
页面 / 组件 ──> @/services/<module>.ts ──> utils/request.ts ──> 后端 API
                      │
                      └──> types/（接口类型） / stores/（Zustand 状态）
```

- 页面**只允许** `import { xxxService } from '@/services'`，禁止直引 `@/data/` 或 mock。
- Service 层是唯一数据出口，也是唯一事实源校验点。
- 字段 / 路由 / validator 以真实后端契约为准，不猜路径、不假成功。

## 关键命令（AI 可自行执行）

```bash
npm run typecheck      # TS 类型检查
npm run lint           # ESLint
npm run format:check   # Prettier 格式检查
npm run check          # 全量（typecheck + lint + format）
npm test               # Vitest 单测
```

## 编译（用户亲自执行，AI 不跑构建）

- 开发：`npm run dev:weapp`（热更）
- 构建：`npm run build:weapp:prod` / `npm run build:weapp:dev`（scripts/）
- AI 需要编译时**先向用户申请**并说明命令与用途；仅 `dist/app.js` 缺失时才全量 / 清缓存。
- 验收要点：`dist/app.js` 存在 + 含对应 API 域名。
- 交付注明是否重编译，详见 `skills/verify-build.md`。

## 台账入口

- 问题 / 冲突统一登记：`yunce-back/yunce-backend/docs/development/ISSUES.md`。
- 决策记录：`yunce-back/yunce-backend/docs/development/PRODUCT.md`。
- 完成标准：`yunce-back/yunce-backend/docs/development/ACCEPTANCE.md`。
