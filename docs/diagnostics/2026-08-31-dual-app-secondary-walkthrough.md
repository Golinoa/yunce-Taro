# 双端二次走查结论（2026-08-31）

> 代码走查，非真机。交互版见 Canvas：`dual-app-secondary-walkthrough.canvas.tsx`

## 总判

Sprint 0–4 止血有效（绑定/约班读服务端/场地私教契约/人事 restore 等），**生产仍有 4 个 P0**：校长教务角色缺口、教师本人薪资断链、开放约配置不可写、（部署前）迁移依赖。

## P0

| # | 问题 | 路径 | 根因 |
|---|------|------|------|
| 1 | 校长学员列表/建档 403 | 校长→学员 | `students` 路由仅 TEACHER；单测确认 PRINCIPAL→403 |
| 2 | 校长首页聚合 403 | 校长首页 | `/home/teacher*` 仅 TEACHER |
| 3 | 教师工资单断链 | 台账→查看工资单 | `GET /teachers`、`/:id` 仅 PRINCIPAL；教师读本人失败 |
| 4 | 开放约配置保存失败 | 排课→开放预约配置 | FE `saveClassDaySlots` 生产 throw；BE 无 batch |

## P1

- class-booking `related` / `slot-dates` / `auto-open` 生产空数组  
- 私教 + 教师扩展字段依赖未部署迁移  
- 薪资模板套用失败；扣款改删 notWired  
- 门店管理占位 Toast  
- Mock 主包超 1.5MB  

## P2

- 评价假成功死代码（按钮已「即将上线」）  
- `profile.id` 可能 ≠ `teacherId`  
- `teacher-booking-config` 无入口  
- 班级/排课写接口大量缺 PRINCIPAL（与 #1 同类）  
- marketing flag 开启后仍四格占位  

## 建议下一刀

1. 教务 API 统一 `PRINCIPAL | TEACHER`  
2. `GET /teachers/me` + 台账改 me  
3. class-booking batch 或藏入口  
4. 部署 `20260831_teacher_profile_extended`、`20260831_private_lesson_booking`
