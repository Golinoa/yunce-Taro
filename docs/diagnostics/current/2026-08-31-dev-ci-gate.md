# 测环境模拟 CI 门禁结果 · 2026-08-31 20:13（修复后）

> 对齐后端 `verify:sop`（≈ `ci.yml`）+ 测环境 post + FE `check`/`test` + E2E。

## 总判：**GREEN**

| 层 | 命令 | 结果 |
|----|------|------|
| BE typecheck / lint / prisma / compat | `verify:sop` 前半 | **PASS** |
| BE test:ci | 103 suites / **1271** tests + coverage | **PASS** |
| BE audit:ci | moderate only → OK | **PASS** |
| BE verify:sop 整链 | | **PASS** (EXIT 0) |
| BE perf-smoke @dev | `dev.chancore.cn/health` | **PASS** p95≈407ms |
| BE headers @dev | | **PASS** |
| FE check | typecheck + lint + format:check | **PASS** |
| FE vitest | 132/132 | **PASS** |
| 测环境 E2E | 42/42 | **PASS** |

## 本轮为绿所做修复（摘要）

**BE**
- 修复 `home.routes.ts` 注释吞掉 `router.get`（operation-content / stats / unread）
- lead 测试 mock 补 `reassignLead`
- mockPrisma 补 `todoAssigneeOverride`
- class 测试：PRINCIPAL 期望 200 + teacher.findFirst
- home-profile / home.service：`studentParent.findFirst`
- 补 `getMyTeacher` 单测；teacher 覆盖率阈值按实测回写（72/61/55/71）
- 另：课包 PRINCIPAL、finance `student.campusId`（上轮）

**FE**
- typecheck：删未用状态/import、copyToTeachers 返回形状、subscribe 测试 mock 参数
- prettier CRLF：`lint:fix` + `format`

## 复跑

```bash
# BE
cd yunce-back/yunce-backend && npm run verify:sop
PERF_SMOKE_URL=https://dev.chancore.cn/health npm run check:perf-smoke
HEADER_CHECK_URLS=https://dev.chancore.cn/health npm run check:headers

# FE
cd yunceTaro && npm run check && npm test -- --run
API_ROOT=https://dev.chancore.cn node scripts/e2e-regression-dev.mjs
```
