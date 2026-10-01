---
last_updated: 2026-10-01
status: active
source: 全模块联调期；src/data 已删除；2026-09-19 增补成功码判定与 TTL 时间源；2026-10-01 增补「枚举字段全量映射」（点名状态事故：leave/absent 漏发 ⇒ 请假被记成已签到、缺勤 422 建不出来）
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

## 枚举字段必须**全量映射**，不许"漏了就丢"（2026-10-01 点名状态事故）

❌ 写方向（前端 → 后端）的枚举映射只列几个分支，其余取值落成 `undefined`，
   而请求体又用 `...(status ? { status } : {})` 把该字段**整个省略**：

```ts
// ❌ 漏了 leave / absent
const status = data.status === 'cancelled' ? 'CANCELLED'
  : data.status === 'makeup' ? 'MAKEUP'
  : data.status === 'normal' || !data.status ? 'NORMAL'
  : undefined;
```

✅ FIX: 用**闭集 `Record`** 覆盖类型的全部取值，并让"没给"与"显式值"分开表达：

```ts
/** 写方向的唯一真源；与读方向的 mapBackendXxxStatus 成对放在同一文件 */
const FRONTEND_TO_BACKEND_LESSON_STATUS: Record<NonNullable<LessonRecord['status']>, string> = {
  normal: 'NORMAL', makeup: 'MAKEUP', leave: 'LEAVE', absent: 'ABSENT', cancelled: 'CANCELLED',
};
// ...
status: data.status ? FRONTEND_TO_BACKEND_LESSON_STATUS[data.status] : 'NORMAL',
```

并要求补 `it.each` 覆盖**每一个取值**的回归测试（如 `services/lesson-record-status.test.ts`）。

⚠️ **为什么这是"静默失效"级别**：后端普遍有默认值兜底（`const status = input.status ?? LessonStatus.NORMAL`），
所以**字段缺失会被后端解释成一个合法值**，前端拿不到任何报错。2026-10-01 实测后果：
`leave` 漏发 ⇒ 请假被记成 `NORMAL` ⇒ **点名页把请假学员显示成"已签到"**（读方向 `mapRecordStatusToCheckin` 本来就按 `leave` 设计）；
`absent` 漏发 ⇒ 缺勤路径同时带 `createDebt: true`，撞后端规则 `if (input.createDebt && !isAbsent) throw 422「只有缺勤记录可以创建欠课」`
⇒ **缺勤记录根本建不出来**，连带欠课（`LessonDebt`）功能整条不可达。
推论：**"这条路径很久没被跑通"往往不是没人用，而是它一直在静默失败。**

📖 See: ../../docs/diagnostics（同类静默失效家族：45-lesson-identity 的 `classId` 漏列、R40 的「响应成功码判定」）


