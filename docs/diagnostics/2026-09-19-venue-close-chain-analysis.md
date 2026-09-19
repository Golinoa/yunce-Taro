# 场地"新增保存不关页"链路分析（2026-09-19）

## 现象
- **删除**：场地管理 → 点具体场地 → 删除 → 提示删除成功 → **回到场地管理页** ✅
- **新增**：场地管理 → 添加 → 填名称 → 保存 → 提示"创建成功" → **没回场地管理页** ❌

## 真根因：请求层把「201 创建成功」当异常抛出

### 决定性证据（真机 Console，临时埋点 `[VENUE-DBG]`）
```
[VENUE-DBG] handleSave:enter {isEdit: false, hasCampus: true, name: "阿斯顿", stack: Array(3)}
[VENUE-DBG] handleSave:catch {err: "创建成功"}      ← 保存没进 success 分支，直接落 catch
```
`setTimeout(goBackToList, 400)` 写在 `try` 内，**从未被执行** → 既不关页也不刷新。
而删除日志一路正常：`handleBackToList:enter → navigateBack:success → page:unload → list:didShow`
（证明**关页逻辑自始至终没问题**）。

### 代码根因
`src/utils/request.ts` 响应层原本写死：
```ts
if (body.code === 0 || body.code === 200) return body.data;   // 只认 0 / 200
...
throw new ApiError(body.code, body.message);                  // 其它 code 一律当错误
```
而后端 `yunce-backend/src/utils/response.ts`：
```ts
export const created = <T>(res, data, message = '创建成功') => success(res, data, message, 201);
```
→ **新增类接口返回 HTTP 201 + `code: 201`（默认 message 就是"创建成功"）**，
前端把这条**成功响应当异常抛出**；用户看到的"创建成功"其实是 **catch 里弹的错误 toast**。

### 影响面（系统级）
| 操作 | 后端助手 | code | 数量 | 修复前 |
|---|---|---|---|---|
| **增**（创建） | `created()` | **201** | **58 处** | ❌ 全部"假失败"（进 catch） |
| **改**（更新） | `success()` | 200 | 338 处 | ✅ 本正常 |
| **删**（删除） | `noContent()`/`success()` | 200 | 8 处 | ✅ 本正常 |

前端响应解析**只有 `request.ts` 一个入口**（已核实无绕过），故一次修复覆盖全部接口。

## 修复

`request.ts` 新增成功码判定，替换两处硬编码（业务响应 + `/auth/refresh`）：
```ts
function isSuccessCode(code: unknown): boolean {
  return code === 0 || (typeof code === 'number' && code >= 200 && code < 300);
}
```

## 本次一并修复/加固
1. **请求层成功码**：`0` 或任意 `2xx`（本条为真根因）。
2. **场地关页按栈算 delta**：`goBackToList` 用 `getCurrentPages()` 算出到列表页的距离，一次退掉所有叠加表单层；栈内无列表页才 `redirectTo` 兜底。
3. **`navigateToOnce` 栈顶幂等**：目标页已是栈顶则不压栈，防慢速双击叠出两层同款页面。
4. **容量只允许数字**：`type="number"` + `maxlength=5` + `replace(/\D/g, '')`。
5. **列表「返回即强刷」**：`shownOnceRef`，非首进一律重拉，不依赖 refresh-signal 时序。

## 验证
- tsc `--noEmit` 0 错误；prettier `--check` 通过；eslint 0 错误；`request-refresh.test.ts` 5/5。
- dev dist 重建；核对产物含 `isSuccessCode`（`0===e||"number"==typeof e&&e>=200&&e<300`）且无残留旧判定。
- 真机复测：新增场地保存后正常回到场地管理页并刷新列表。

## 沉淀规则（建议入 .harness）
1. **成功码白名单必须以后端响应包装器 `response.ts` 为单一事实源**：成功 = `0` 或任意 `2xx`（`created()` 用 201）。
2. **写后关页**若目标为固定列表页，按栈算 delta 一次退到目标，而非固定 `navigateBack()` 一层。
3. **推入表型入口**必须栈顶幂等（`navigateToOnce` 已内置）。
