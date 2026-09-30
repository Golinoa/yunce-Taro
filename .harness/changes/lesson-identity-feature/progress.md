---
last_updated: 2026-09-30
status: active
---

# 进度 checklist

**Status: In Progress**（块 0 已完成）

## 计划中

### 块 0 · 口径地基（Approved 后第一步，**业务行为零变化**） ✅ **已完成 2026-09-30**
- [x] 前端 `src/utils/lesson-identity.ts`：收敛 `isRecordOfLesson` / `isSameLessonSchedule` / `hasTrialBookingForLesson` / `isSameLessonStartTime` 到唯一真源
- [x] 后端 `src/utils/lesson-identity.ts`：等价实现（同名函数、同语义）
- [x] 两侧各跑**同一批逐字一致**的表驱动用例（前端 vitest / 后端 jest）
- [x] 现有调用点**不动** ⇒ 跑完系统行为零变化，只是口径被固化并被测试盯住

### 块 1 · 无关身份的独立修复（可先做、独立回归）
- [ ] 后端 `listLessonRecords` + `getRecordsByRange` 补老师字段
- [ ] 前端 `mapBackendLessonRecord` 去掉 `teacher_id: ''` 硬编码，补 `operator_teacher_id` / `assistant_teacher_id`
- [ ] 修日期参数名 bug（`date=` → `lessonDate=`，并兼容读 `date`）

### 块 2 · 预约侧存排课编号
- [ ] 迁移：`MakeupBooking.scheduleId`（可空 + 外键 SET NULL）
- [ ] 试听弹层传 `referenceScheduleId`；补课创建传 `scheduleId`
- [ ] 后端补课 validator + 存在性校验兜底（查不到置 `null`）

### 块 3 · 匹配侧接入统一口径
- [ ] 课表角标 `hasTrialBookingForLesson` 加排课编号（编号优先、时段兜底）
- [ ] `buildTrialBookingKeys` 改为带编号的索引
- [ ] `getByClassDate` 防御过滤、点名页名单合并、补录、详情接入
- [ ] 后端 `home-today-schedule.service.ts` 试听合并改口径

### 块 4 · 让老师指明「第几节」（从班级列表入口）
- [ ] 解析当天课次（排课规则 + 临时调课叠加）
- [ ] 1 节自动带；≥2 节弹出选择；未选不让提交

## 验证

- [ ] 前端 `tsc --noEmit` + eslint + prettier
- [ ] 前端 vitest 全量
- [ ] 后端 `tsc --noEmit` + `jest src/lesson-record` 等
- [ ] 重编译 dev 包（向用户申请，需先关微信开发者工具）
- [ ] 真机/开发者工具验收：见 `design.md` 验收标准

## 时间线

| 日期 | 进展 |
| --- | --- |
| 2026-09-30 | 定位两条事故根因；完成三套方案对比与详细设计；口径已写进 `.harness/`（`rules/45` + `wiki/lesson-identity`）；**Draft，等 Approved** |

## 遗留（登记，不属本次）

- 跨日调课后预约不跟到新日期（用户已确认可接受）
- 家长请假生成的补课拿不到排课编号 ⇒ 按时段兜底
- 同日调课不校验时间冲突（见 `decisions.md` D7）
- `MakeupBooking` 唯一键含 `startTime`（调课前/后可能出现两条）
- `TemporaryReschedule.scheduleId` 无外键（删规则留孤儿，代码已容错）
