---
last_updated: 2026-10-01
status: active
---

# 进度 checklist

**Status: In Progress**（块 0–3 已完成；块 4 与日期参数修复未做）

## 已完成

### 块 0 · 口径地基（**业务行为零变化**） ✅ **2026-09-30**
- [x] 前端 `src/utils/lesson-identity.ts`：收敛 `isRecordOfLesson` / `isSameLessonSchedule` / `isSameLessonStartTime`（+ 新增 `isBookingOfLesson`）到唯一真源
- [x] 后端 `src/utils/lesson-identity.ts`：等价实现（同名函数、同语义）
- [x] 两侧各跑**同一批逐字一致**的表驱动用例（前端 vitest 31 条 / 后端 jest 31 条）
- [x] 现有调用点**不动** ⇒ 行为零变化（`lesson-record-scope`、`schedule-card-build` 改为再导出）

### 块 1 · 与「哪一节」无关的独立修复 ✅ **2026-10-01**
- [x] 后端三个记录取数口（`listLessonRecords` / `getRecordsByRange` / `getRecordsByMonth`）补
      `teacherId` / `teacherName` / `operatorTeacherName`（批量取名，避免 N+1）
- [x] 前端 `mapBackendLessonRecord` 去掉 `teacher_id: ''` 硬编码，补 `operator_teacher_id`
- [x] 后端单测补断言防回退；mock 补 `prisma.teacher.findMany`

### 块 2 · 预约侧存排课编号 ✅ **2026-10-01**
- [x] 后端：`MakeupBooking.scheduleId` 可空 + 外键 SET NULL + 索引（迁移 `20261001010000_makeup_booking_schedule_id`，已在真实库应用并核对）
- [x] 后端：validator 新增可选 `scheduleId`；service 落库前做存在性 + 同机构校验，**查不到置 null**（不让身份字段把写库搞挂）
- [x] 后端：家长请假生成的补课显式 `scheduleId: null` 并注明原因
- [x] 前端：试听弹层传 `referenceScheduleId`；补课创建传 `scheduleId`；卡片 id 从课表页传下去
- [x] 前端：`MakeupBooking` 类型补 `schedule_id`
- [x] **顺手修真实事故**：`makeup-booking` service 无 mapper，后端 camelCase 被当前端 snake_case 用
      ⇒ `b.lesson_date` 恒 undefined ⇒ 防御过滤把**所有补课预约全部过滤掉**。补映射 + 3 条单测

### 块 3 · 匹配侧接入统一口径 ✅ **2026-10-01**
- [x] `buildTrialLessonScheduleKey` 新增；`buildTrialBookingKeys` 每条预约同时产出**编号键 + 时段键**
- [x] `hasTrialBookingForLesson` 加排课编号参数：**编号优先 → 时段兜底**
- [x] 课表卡片构建传 `schedule.id`；预约成功后的本地标记也补编号键
- [x] 试听名单合并改走真源 `isBookingOfLesson`；补课 `getByClassDate` 同样接入（新增 `scheduleId` 参数）
- [x] 修 `useCallback` 漏依赖 `lessonScheduleId`（换了节次不重算）
- [x] 补 4 条角标/键单测（调课后仍命中 / 另一节不误标 / 无编号回落时段）
- [x] 后端 `home-today-schedule.service.ts` 试听去重改「编号优先、时段兜底」

## 未完成

### 块 4 · 让老师指明「第几节」（从班级列表入口）
- [ ] 解析当天课次（排课规则 + 临时调课叠加）
- [ ] 1 节自动带；≥2 节弹出选择；未选不让提交

### 块 5 · 日期参数名 bug
- [ ] `booking/index.tsx` 与 `lead-detail/index.tsx` 传 `date=`，点名页只读 `lessonDate` ⇒ 打开的是「今天」

## 验证

- [x] 前端 `tsc --noEmit` / eslint / prettier 全清
- [x] 前端 vitest **全量 830 条**通过
- [x] 后端 `tsc --noEmit` / eslint / prettier 全清
- [x] 后端 jest 相关范围（`lesson-record` / `makeup-booking` / `leave-request` / `home` / `utils`）**133 条**通过
- [ ] 后端 jest **全量**（未跑，等用户指示）
- [ ] 重编译 dev 包（向用户申请，需先关微信开发者工具）
- [ ] 真机 / 开发者工具验收：见 `design.md` 验收标准

## 时间线

| 日期 | 进展 |
| --- | --- |
| 2026-09-30 | 定位两条事故根因；完成三套方案对比与详细设计；口径写进 `.harness/`（`rules/45` + `wiki/lesson-identity`）；用户批准开工；**块 0** 落地（前后端同批 31 条用例） |
| 2026-10-01 | **块 1**（记录接口补老师字段，修「未知教师」）、**块 2**（补课表存排课编号 + 顺手修补课 mapper 事故）、**块 3**（角标/名单匹配改「编号优先、时段兜底」+ 后端首页去重）；两侧门禁全清，前端全量 830 条绿；顺手修好前端 2 条一直红的 `home.service` 用例（mock 漏 `prisma.subject`） |

## 遗留（登记，不属本次）

- 跨日调课后预约不跟到新日期（用户已确认可接受）
- 家长请假生成的补课拿不到排课编号 ⇒ 按时段兜底
- 同日调课不校验时间冲突（见 `decisions.md` D7）⇒ 两条规则撞同一时段时，编号不同的预约可能被时段兜底算进来（刻意保留，宁可多显示）
- `MakeupBooking` 唯一键含 `startTime`（调课前/后可能出现两条）
- `TemporaryReschedule.scheduleId` 无外键（删规则留孤儿，代码已容错）
- `LessonRecord` **没有助教列** ⇒ 流水账/名单只显示主讲与操作人，助教永远为空
