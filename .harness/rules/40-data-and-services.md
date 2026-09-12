---
last_updated: 2026-09-12
status: active
source: 全模块联调期；src/data 已删除
---

# R40 数据与 Service 铁律

## 唯一数据出口

❌ 页面 / 组件直接 `import ... from '@/data/*'`，或把业务列表硬编码在页面里

✅ FIX: 只从 `@/services` 取数。`src/data` 已删除，不得恢复。

```tsx
import { teacherService } from '@/services';
```

📖 See: ../wiki/api-integration.md

## 禁止伪造成功

❌ 接口没通就 `catch` 掉假装成功，或本地造一份假数据让 UI 跑起来

✅ FIX: `notWired` 是**未接通占位**，不是业务实现。触发路径登记进统一 ISSUES 台账，前端保留空态 / 错误态。

📖 See: ../wiki/api-integration.md

## Mock 只活在测试文件里

❌ 业务代码里出现 `mock*` 函数、假数据常量

✅ FIX: 测试替身只写在 `*.test.ts` / `*.test.tsx`；业务联调走真实 API。

## 契约核对（动手前）

❌ 凭猜测写请求路径、字段名、validator

✅ FIX: 先对照后端路由、validator 与现有 UI 字段再写 Service；不确定就先问，不猜。必要的 DTO 适配**不得改变 UI**，并在 PR 里写明原因。

## 数据流方向

```
页面 / 组件 → Zustand Store（跨页状态）→ Service → utils/request → 后端 API
```

- 401 / token 续期交给统一请求链路，**禁止**在每个页面另造登录逻辑。
- 写操作成功后按模块发刷新信号或 Store invalidate；切换机构要清理域缓存。
- 按模块验证：正常 / 空态 / 错误 / 权限 / 幂等 五种分支。

## 状态机

❌ 薪资状态反向跳转（`paid → confirmed`）

✅ FIX: `pending → confirmed → paid` 严格单向，类型层用 union type 约束。

📖 See: ../wiki/api-integration.md
