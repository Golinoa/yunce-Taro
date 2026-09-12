---
last_updated: 2026-09-12
status: active
source: PDF「分层架构 + ArchUnit」「架构约束——缰绳」
---

# 架构边界（依赖方向）

> 本项目的分层依赖图。**下层不能反向依赖上层**，违反即代码评审不通过（可机械化的逐步转 ESLint 规则）。
> 与 PDF 案例的 `domain → config → mapper → service → controller` 对应，本项目为前端分层。

## 分层依赖图

```
types ──→ services ──→ stores ──→ pages / components
  │           │           │
  │           └────┬──────┘
  └──────── utils 可横向复用（不依赖业务层）
```

| 层 | 能依赖谁 | 禁止依赖 |
| --- | --- | --- |
| `types/` | 无（最底层） | services / stores / pages |
| `services/` | types、utils | stores / pages / components |
| `stores/` | types、services、utils | pages / components |
| `pages/` + `components/` | types、services、stores、utils | 页面之间互相 import（走路由） |

## 关键禁令

- ❌ `services` import `pages` / `components`（反向依赖）
- ❌ `stores` import `components` / `pages`
- ❌ 页面直接 `import '@/services/teacher'`（穿透聚合出口）
  ✅ `import { teacherService } from '@/services'`
- ❌ 循环依赖（`types ← services ← stores ← pages/components` 环）
- ❌ 组件目录外创建 `.tsx`（页面放 `pages/`，组件放 `components/`）

## 豁免白名单

以下场景允许**受控例外**（必须注明理由，不静默绕过）：

- 历史遗留耦合：`src/styles/` 遗留 SCSS 在迁移完成前可被引用（只减不增）
- 全局唯一的跨层工具：`utils/request.ts`（所有层可依赖）
- 类型仅存在于 `pages/` 的临时 DTO：允许在组件内定义（不 export 到其他层）

> 类比 PDF 的 `resideOutsideOfPackage("..legacy..")`：豁免是显式的、可审计的，不是默认的。

## 验证方式

- 人工：Code Review 时按本图检查 import 方向（`skills/code-review.md`）
- 机械（演进目标）：将上述禁令转成 ESLint `no-restricted-imports` 规则或自定义规则，加入 `npm run lint`，违反即 CI 阻断
- 快速自查命令：

```bash
# 找页面直连 services 内部文件的穿透引用
grep -rn "from '@/services/[a-z]" src/pages src/components | grep -v "index'"

# 找 services 反向依赖页面 / 组件
grep -rn "from '@/pages\|from '@/components" src/services src/stores
```

📖 See: `rules/00-core-stack.md`（依赖方向禁令）、`wiki/directory-structure.md`（目录总览）
