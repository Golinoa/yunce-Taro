---
last_updated: 2026-09-30
status: active
---

# 课节身份（「哪一节课」）事实清单

> wiki 只写**事实**（有什么、在哪、长什么样）。禁令见 [`../rules/45-lesson-identity.md`](../rules/45-lesson-identity.md)。
> 冲突时**以代码为准**，并回来修本页。

## 1. 排课编号（「哪一节课」的身份）

| 事实 | 值 |
| --- | --- |
| 编号是什么 | 排课表 `Schedule` 那一行的主键 `id`（`varchar(191)`，Prisma `@default(uuid())`） |
| 谁生成 | **数据库自动生成**。应用侧没有任何编号生成逻辑 |
| 何时生成 | 每新增一条排课规则生成 1 个；批量排课拆成几条就生成几个 |
| 一节课的身份 | **`(Schedule.id, lessonDate)`**（一条规则横跨很多日期，必须带日期） |
| 归属对象 | 班课/团课看 `classId`；私教 1 对 1 看 `studentId`（`Schedule` 两个字段二选一） |
| 会重复 / 回收吗 | 不会（uuid + 主键） |

## 2. 编号在调课后变不变（逐场景，已核实代码 + 真实库）

| 场景 | 走的接口 | 编号 | 备注 |
| --- | --- | --- | --- |
| 同日临时调课（改时段） | `POST /attendance/reschedules/batch` | **不变** | 只写 `TemporaryReschedule`，**从不改 `Schedule` 行** |
| 跨日临时调课 | 同上 | **不变** | 原日期上已下的预约不会跟到新日期（已知口径） |
| 改规则本身（时间/星期/老师/教室） | `PUT /schedules/:id` | **不变** | 原地更新，不是删了重建 |
| 暂停 / 恢复规则 | `POST /schedules/:id/rule-status` | **不变** | 只改 `status` |
| 停止后重建 | 后端**禁止** resume 已停止规则，只能新建 | **换新的** | 新规则确实是新的课程序列 |
| 删除规则 | `DELETE /schedules/:id`（硬删除） | **作废** | 见 §4 |

## 3. 各表里的排课编号字段

| 表 | 列名 | 有无外键 | 状态 |
| --- | --- | --- | --- |
| `LessonRecord`（点名/消课记录） | `scheduleId` | ✅ 有（`DELETE_RULE = SET NULL`） | 已接入 |
| `LeadBooking`（试听预约） | `referenceScheduleId` | ❌ 无（软引用） | **列已存在**，前端此前不传 |
| `MakeupBooking`（补课预约） | — | — | **待加 `scheduleId`** |
| `TemporaryReschedule` | `scheduleId` | ❌ **无任何外键** | 删规则会留孤儿；现有代码查不到就跳过，安全 |

> 全库**只有 `LessonRecord` 一张表有外键指向 `Schedule`**（实测 `information_schema.KEY_COLUMN_USAGE`）。

## 4. 外键 / 删除行为（**事实在后端 wiki，不在这里重复**）

后端侧的 schema 字段、外键删除策略（实测）、删 / 停 / 改 / 调课对记录的实际影响，
统一放在后端 wiki：

> [`../../../yunce-back/yunce-backend/.harness/wiki/lesson-identity.md`](../../../yunce-back/yunce-backend/.harness/wiki/lesson-identity.md)

前端侧只需要记住三条结论：

1. **删排课规则不会删记录**（`LessonRecord_scheduleId_fkey` 删除策略是 `SET NULL`），只丢"哪一节"的归属。
2. **删班级 / 删学员都是软删除**（只改状态），流水账一点不动。
3. **唯一会真删流水账的是机构解散**（注销机构，属预期但不可逆）。

## 5. 流水账（消课记录）取数链路与字段归属

```
流水账页 package-course/pages/records
  → lessonRecordService.getByStudent(studentId)
  → GET /lesson-records?studentId=
  → listLessonRecords()            ← lesson-record.service.ts

点名页 package-course/pages/lesson-form
  → GET /lesson-records/by-range   ← 点名页唯一取数口
```

**取数不依赖排课表**：`lessonRecordListArgs` 只 include `student` / `package` / `memberCard` / `class`；
`getRecordsByRange` 的 where 只有 `lessonDate` 区间 ⇒ **删排课不会让记录查不出来**。

**用户验收只看三项**（2026-09-30 口径）：课程名称 / 老师 / 操作人。

| 字段 | 来源 | 是否依赖排课表 |
| --- | --- | --- |
| 课程名称 `className` | 记录的 `class` 关联（`Class` 表） | ❌ 不依赖 |
| 老师 `teacherId` | `LessonRecord` 自己的列 | ❌ 不依赖 |
| 操作人 `operatorTeacherId` | `LessonRecord` 自己的列 | ❌ 不依赖 |

> ⚠️ **当前缺陷**：`listLessonRecords` 与 `getRecordsByRange` 的返回体**都没有老师字段**
> （前端 DTO `BackendLessonRecordListItem` 早已声明 `teacherId/teacherName/assistantTeacher*/operatorTeacherName`）；
> 且前端 `mapBackendLessonRecord` 把 **`teacher_id` 硬编码成 `''`** ⇒ 流水账落回「未知教师」。待修。

## 6. 唯一真源（代码位置）

| 用途 | 位置 |
| --- | --- |
| 记录属于哪一节 | `src/utils/lesson-record-scope.ts` → `isRecordOfLesson` / `isSameLessonSchedule` |
| 预约属于哪一节 / 试听角标 | `src/utils/schedule-card-build.ts` → `buildTrialLessonKey` / `hasTrialBookingForLesson` / `isSameLessonStartTime` / `normalizeLessonStartTime` |
| 时段归一化 | `src/utils/schedule-card-build.ts` → `normalizeLessonStartTime`（`HH:mm:ss` / `HH:mm` → `HH:mm`） |

兜底差异（**别写成一样**）：

- 记录**没有时段列** ⇒ 任一侧缺 `scheduleId` 就**不区分**（宁可多显示，不能吞记录）
- 预约**有时段** ⇒ 缺编号时**回落比时段**（变严不变松，绝不再"整天乱挂"）

## 7. 已知边界（不是 bug，是刻意保留）

- 跨日调课后，原日期上的预约不跟到新日期（用户已确认可接受）
- 家长请假自动生成的补课（`leave-request.service.ts`）拿不到排课编号 ⇒ 只能按时段兜底
- 删除排课后记录失去"哪一节"归属 ⇒ 退化为按班级+日期+时段
- 从「班级列表」入口点名时页面不知道是哪一节 ⇒ 由 `../changes/lesson-identity-feature/` 解决
- 同日临时调课**不校验时间冲突**（前端 `checkDateConflict` 在"同日期"时直接返回无冲突；后端无校验）⇒ 可能两节课同一时段；新口径靠编号区分，不会认错人
- `TemporaryReschedule.originalTime` **名不符实**：实际存的是**调课后**的开始时间（前端 `saveBatch` 传的 `schedule` 已是改过时间的对象）
