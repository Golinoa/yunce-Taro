# 紧急待办（部署前必须修）· 2026-08-31

> **口径**：二次走查结论 — **仅推送部署打不通**下列链路；须先改代码再发版。  
> 详表：`2026-08-31-dual-app-secondary-walkthrough.md` / Canvas `dual-app-secondary-walkthrough.canvas.tsx`  
> **Git 备份**：同日三端 `chore: backup 2026-08-31 …`（小程序 / 后端 / 运营端 monorepo）

---

## P0 · 紧急（阻塞主任务）

| ID | 事项 | 端 | 动作 |
|----|------|----|------|
| E1 | 校长教务角色缺口：`/students`、班级/排课写等仅 `TEACHER`，校长 403 | BE | 教务读/写统一 `requireRole(['PRINCIPAL','TEACHER'])`（含单测改口径） |
| E2 | 校长首页聚合：`/home/teacher*` 仅 TEACHER | BE | 放行 PRINCIPAL |
| E3 | 教师本人薪资/台账：`GET /teachers`、`/:id` 仅校长 | BE+FE | 补 `GET /teachers/me`（或本人读）；台账/工资单停用 `profile.id` 猜 Teacher 主键 |
| E4 | 开放预约配置保存：FE `saveClassDaySlots` 生产 throw，BE 无 batch | BE+FE | 实装 slots batch 创建/删，或生产藏配置入口 |

## 部署依赖（代码已齐，未 migrate 仍断）

| ID | 事项 |
|----|------|
| D1 | `prisma migrate`：`20260831_teacher_profile_extended` |
| D2 | `prisma migrate`：`20260831_private_lesson_booking` |

## P1 · 紧随其后

- class-booking `related` / `slot-dates` / `auto-open` 生产空实现  
- 薪资模板套用 / 扣款改删 notWired  
- 门店管理占位；Mock 主包超 1.5MB  

## 建议顺序

1. E1+E2 角色矩阵 → 2. E3 `/teachers/me` → 3. E4 class-booking 写 → 4. D1+D2 部署迁移 → 5. 冒烟

## 备份记录

| 端 | 仓库 | 备份说明 |
|----|------|----------|
| 小程序 | `yunceTaro` | `chore: backup 2026-08-31 dual-app WIP + emergency backlog` |
| 后端 API | `yunce-back/yunce-backend` | `chore: backup 2026-08-31 dual-app BE WIP + emergency backlog` |
| 运营端 monorepo | `yunce-back`（含 admin + submodule 指针） | `chore: backup 2026-08-31 admin + backend pointer` |
