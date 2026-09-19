---
last_updated: 2026-09-19
status: active
source: 全模块联调期；src/data 已删除；2026-09-19 增补成功码判定与 TTL 时间源
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

## 响应成功码判定（2026-09-19 场地事故）

❌ 在业务代码里硬编码成功码：`if (body.code === 0 || body.code === 200)`

✅ FIX: 一律走统一判定 `isSuccessCode(code)`（**`0` 或任意 `2xx`**）。后端 `yunce-backend/src/utils/response.ts` 的 `created()` 返回 **HTTP 201 + `code: 201` + `message: '创建成功'`**，全仓 **58 处**创建接口走它。只认 0/200 会把**成功响应当异常抛出** → 写操作落 `catch` → **弹「创建成功」却当作失败**，其后的关页 / 刷新全被跳过（表现：新增成功却不关页、不刷新）。

```ts
// ✅ FIX
if (isSuccessCode(body.code)) return body.data;
// ❌ 不要这样
if (body.code === 0 || body.code === 200) return body.data;
```

> 排查契约类「假失败」的顺序：① 看 `catch` 里的 `err.message`——若像**成功文案**（"创建成功"/"更新成功"）就是本坑；② 对照后端响应助手（`created`/`success`/`noContent`）；③ 修 `utils/request.ts` 这一处总闸，**不要逐页改**。

📖 See: ../../docs/diagnostics/2026-09-19-venue-close-chain-analysis.md

## 缓存 TTL 的时间源

❌ 用设备本地时钟判 TTL：`if (Date.now() - box.at >= ttlMs)`

✅ FIX: 一律用 `serverNow()`（`utils/server-clock.ts`）。它由每个 HTTP 响应的标准 `Date` 头校正（网关 nginx / Cloudflare 实测可用），与设备时钟解耦——设备时钟偏快会让缓存**永不命中**，偏慢则**永不失效**。未同步到偏移时自动等价 `Date.now()`（降级）。

```ts
// ✅ FIX
import { serverNow } from '@/utils/server-clock';
if (serverNow() - box.at >= ttlMs) return null;
```

适用范围：`utils/cache-store.ts`、`services/membership-cache.ts` 等**持久化缓存**的读写时间戳。页内 `useRef` 级会话 TTL（`utils/data-freshness.ts`）不强制。

📖 See: ../../docs/diagnostics/2026-09-19-frontend-cache-layer-plan.md（§2 G7）；../../docs/diagnostics/2026-09-19-cache-layer-governance-audit.md

