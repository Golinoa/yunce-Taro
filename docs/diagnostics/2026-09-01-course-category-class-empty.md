# 诊断短记 · 课程分类 / 班课空列表（2026-09-01）

> 走查问题 1 / 4 定位与修复摘要

## 结论

| 项 | 结论 |
|----|------|
| 课表 tab 消失 | **FE bug**：`courseCategoryService.getList()` stub `[]`，store 覆盖默认三类 → 独立展示 tab 为空 |
| 课程页无课 | 分类清空 + `courseTemplateService` stub；**团课/私教无独立 BE 模板域**（勿接课包模板）；班课应来自 `GET /classes` |
| Seed | `prisma/seed.ts` 会创建班级；空列表更可能是 JWT 无 `organizationId` 时校长 list 返回空，或分类 tab 未渲染导致「看起来没课」 |

## 本轮修复

- Store：空 API → 保留默认班课/团课/私教（`resolveCourseCategoriesFromApi`）
- 校长 `GET /classes`：JWT 无 org 时 DB `resolvePrincipalOrganizationId`
- 课程管理：始终拉 `/classes`（不因无 teacherId 跳过）

## 验收

手动重启 API 后：principal1 课表可见三 tab；课程·班课可见机构活跃班级（若库中有 seed/业务数据）。
