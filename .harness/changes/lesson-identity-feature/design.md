---
last_updated: 2026-09-30
status: active
---

# 课节身份统一（「哪一节课」只认排课编号）

**Status: Draft**（未 Approved 不开始编码）

## 目标

- 解决两条实测事故：① 只给一节课加试听，结果整条排课规则/整天的课都带试听；② 同日临时调课后，试听学员从点名名单消失。
- 根因同一条：系统里**每一节课没有稳定身份**，只能用「班级 + 日期 + 时段」描述，而时段会变、有歧义。
- 做法：把"哪一节课"的判定统一收口到**排课编号（`Schedule.id`）+ 日期**，编号优先、时段兜底。

## 非目标（明确不做）

- [x] **不新造课次编号 / 不建 `LessonOccurrence` 表**（现成编号够用；新建那套 = 重建排课域，改动数倍）
- [x] **不做同日调课的时间冲突校验**（不影响身份判定；需先定义"什么算冲突"，属独立一块）
- [x] **不给"删除排课规则"加禁止保护**（用户口径：只要流水账留得住 + 三项对得上即可，已核实成立）
- [x] **不改 `MakeupBooking` 的唯一键**（涉及并发去重语义，独立评估）
- [x] **不改跨日调课"预约不跟着换日期"的既有口径**（用户已确认可接受）

## 涉及模块

| 端 | 文件 / 目录 | 改动类型 |
| --- | --- | --- |
| 前端 | `src/utils/lesson-identity.ts` | **新增**（口径唯一真源，收敛现有两处） |
| 前端 | `src/utils/lesson-record-scope.ts`、`src/utils/schedule-card-build.ts` | 修改（接入统一口径） |
| 前端 | `src/pages/schedule/schedule-loaders-logic.ts`、`use-schedule-derived.ts`、`ScheduleMainViews.tsx` | 修改（传排课编号） |
| 前端 | `src/components/lead/BookTrialByClassSheet/index.tsx` | 修改（创建预约带排课编号） |
| 前端 | `src/services/makeup-booking.ts`、`src/services/lesson-record.ts` | 修改（入参 + 映射） |
| 前端 | `src/package-course/pages/lesson-form/*`（点名页） | 修改（名单合并 + 让老师指明第几节） |
| 前端 | `src/package-course/pages/booking/index.tsx`、`package-lead/pages/lead-detail/index.tsx` | 修改（日期参数名 bug） |
| 后端 | `prisma/schema.prisma` + 迁移 | **新增** `MakeupBooking.scheduleId`（可空 + 外键 SET NULL） |
| 后端 | `src/utils/lesson-identity.ts` | **新增**（等价口径） |
| 后端 | `src/makeup-booking/*.ts` | 修改（入参 + 存在性校验兜底） |
| 后端 | `src/lesson-record/lesson-record.service.ts` | 修改（补老师字段；保留 `classId`/`scheduleId`） |
| 后端 | `src/home/home-today-schedule.service.ts` | 修改（试听合并改口径） |

## 数据契约

- `GET /lesson-records` 与 `/by-range`：必须返回 `classId` + `scheduleId`；**并补老师字段**（`teacherId/teacherName/assistantTeacherId/assistantTeacherName/operatorTeacherName`）。
- `POST /makeup-bookings`：新增可选 `scheduleId`（校验存在性，查不到置 `null`，不得因此写失败）。
- `POST /leads/bookings`：`referenceScheduleId` **字段已存在**，前端传值即可。
- 字段类型：`src/types/lesson-record.ts`、`src/types/lead.ts`。

## 交互与 UI

- 从「班级列表」入口点名时，需让老师指明**第几节**（当天只有 1 节则自动带上、不打扰；多节时选择）。
  ⇒ 采用方案 **A：选班后弹「第几节」**（改动集中在点名页），见 `decisions.md`。
- 先查 `wiki/component-catalog.md` 看能否复用现有选择组件。

## 验收标准（可测）

- [ ] 同班同一天两节课：只给第 1 节加试听 ⇒ **只有第 1 节挂「试听」**
- [ ] 给第 1 节点完名 ⇒ 再打开第 2 节 **显示「未点名」**，且不被带成已点名
- [ ] 同日临时调课后 ⇒ 调课前下的试听/补课预约**仍在角标与点名名单里**
- [ ] 在 14:00 那节「恢复本节课」⇒ **只动 14:00**，不删 09:00 的停课记录
- [ ] 删除排课规则 ⇒ 流水账保留，**课程名称 / 老师 / 操作人**三项能对得上
- [ ] 单测：`lesson-identity.ts` 口径用例（前后端同一批场景）
- [ ] 门禁：`tsc --noEmit` + eslint + prettier；如需重编译向用户申请

## 风险与决策记录

- 见 `decisions.md`
- 详细方案：`../../../../Docs/2026-09-30-lesson-identity-detailed-design.md`
- 口径约束：`../../rules/45-lesson-identity.md`；事实清单：`../../wiki/lesson-identity.md`
