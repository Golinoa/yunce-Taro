---
last_updated: 2026-10-01
status: active
owner: @frontend
source: 用户实测事故 2026-09-30 两条：①「只给一节课加了试听学员，结果整条排课规则/整天的课都带试听」；②「同日临时调课后，试听学员从点名名单里消失了」。根因都是「哪一节课」的判定口径错。**2026-10-01 追加**：用户实测「删掉一条排课规则后，历史日期上已经上过课的卡片也消失了」⇒ 删规则改为软停止，且**所有按日期展开课次的地方必须按「规则有效期 + 停止日」收窄**（规则 6）。
---

# 45 · 课节身份（「哪一节课」）判定口径

> **改课表 / 试听 / 补课 / 点名 / 补录相关代码前必读。**
> 一句话：**判定「哪一节课」只能认排课编号（`Schedule.id`）+ 日期，不认时段。**

## 铁律

**一节课的身份 = `(scheduleId, lessonDate)`**，其中：

- `scheduleId` = 排课表那一行的主键（**系统里早就有，不许新造编号体系**）；
- `scheduleId` + `lessonDate` 唯一确定"某一天的那一节"（一条排课规则横跨很多日期，必须带日期）；
- 归属对象：班课/团课比 `classId`，私教 1 对 1 比 `studentId`。

### 为什么不能用「班级 + 日期 + 时段」

| 理由 | 说明 |
| --- | --- |
| **时段会变** | 临时调课只往 `TemporaryReschedule` 写一条，**从不改 `Schedule` 行**。拿时段当身份，一改时间就断链（事故②就是这么来的）。 |
| **时段有歧义** | 一个班同一天可排多节课（实测：初级书法班周一有 09:00 与 14:00 两条规则）。只按「班级+日期」会把当天的每一节都算上（事故①）。 |

## 三要素

### 规则 1：禁止只按「班级 + 日期」判定哪一节

```md
❌ `records.filter(r => r.class_id === classId && r.lesson_date === date)`
    或 `bookings.filter(b => b.class_id === classId && b.lesson_date === date)`
   ⇒ 同一天多节课时会把所有节的数据混在一起。

✅ FIX: 统一走唯一真源，至少带上日期 + 归属对象，并优先用排课编号：
    // 记录侧
    import { isRecordOfLesson } from '@/utils/lesson-record-scope';
    records.filter((r) => isRecordOfLesson(r, { classId, lessonDate, scheduleId }));

    // 预约侧（试听角标 / 点名名单合并）
    import { hasTrialBookingForLesson, buildTrialLessonKey, isSameLessonStartTime,
             normalizeLessonStartTime } from '@/utils/schedule-card-build';
    hasTrialBookingForLesson(keys, classId, lessonDate, startTime, scheduleId);

📖 See: `../../../Docs/2026-09-30-lesson-identity-detailed-design.md`（§3 身份口径）、
        `../wiki/lesson-identity.md`（事实清单）
```

### 规则 2：禁止新造「课次编号 / 课节 ID」

```md
❌ 为了区分一节课而新建 `LessonOccurrence` 表 / 生成一套新编号 / 用 `classId+date+time` 拼业务主键
   ⇒ 这就是"给同一个概念造第二份真相"。

✅ FIX: 直接用现成的排课编号：
    卡片：`ScheduleCardItem.id` 就是排课编号（`schedule-card-build.ts` 里 `id: schedule.id`）。
    预约：试听用 `LeadBooking.referenceScheduleId`（列已存在），补课用 `MakeupBooking.scheduleId`。

📖 See: `../wiki/lesson-identity.md`（编号从哪来、调课后变不变）
```

### 规则 3：创建预约时必须把排课编号带下去

```md
❌ `bookTrialByClass({ classId, lessonDate, startTime, endTime })` —— 不传排课编号
   ⇒ 预约只有时段，同日调课后就认不出这节课了（事故②）。

✅ FIX: 调课弹层手里就有卡片，把编号一起传：
    await leadService.bookTrialByClass({ ..., referenceScheduleId: bookSheetItem.id });
    await makeupBookingService.create({ ..., scheduleId: bookSheetItem.id });

📖 See: `../../../Docs/2026-09-30-lesson-identity-detailed-design.md`（§5.3）
```

### 规则 4：记录接口的序列化不许摘掉 `classId` / `scheduleId`

```md
❌ 记录接口只返回 `className`，不返回 `classId` / `scheduleId`
   ⇒ 前端 `record.class_id` 恒 undefined ⇒ 已点名状态、重复点名保护、补录学员合并**全部静默失效**，
      同班同一天重复提交会**重复消课（资损）**。2026-09-30 已修过一次（`getRecordsByRange`）。

✅ FIX: 两个取数口都必须原样返回这两列，并保留单测断言：
    `GET /lesson-records/by-range` 与 `GET /lesson-records` 的序列化 → `classId` + `scheduleId`

📖 See: `../wiki/lesson-identity.md`（取数链路与外键删除策略）
```

### 规则 5：拿不到排课编号时的兜底（不许反过来猜）

| 数据 | 有无时段列 | 缺编号时怎么办 |
| --- | --- | --- |
| 记录 `LessonRecord` | ❌ **没有** | **不区分**（沿用 `isSameLessonSchedule`：任一侧缺编号即放行）——宁可多显示，不能吞记录 |
| 预约（试听 / 补课） | ✅ 有 `startTime` | **回落比时段**——变严不变松，绝不再"整天乱挂" |

```md
❌ 预约侧为了"能显示"就把缺编号的预约放开到整天 ⇒ 退回「整条规则都带试听」的老毛病。
✅ FIX: 编号优先；编号拿不到才按 `normalizeLessonStartTime()` 比时段；目标时段也为空才不过滤。
```

## 唯一真源（改动只改这里，别在各处各写一份）

| 用途 | 位置 |
| --- | --- |
| 记录属于哪一节 | `src/utils/lesson-record-scope.ts` → `isRecordOfLesson` / `isSameLessonSchedule` |
| 预约属于哪一节 / 试听角标 | `src/utils/schedule-card-build.ts` → `buildTrialLessonKey` / `hasTrialBookingForLesson` / `isSameLessonStartTime` / `normalizeLessonStartTime` |
| **规则在某天还成不成立**（有效期 + 停止日） | `src/utils/schedule-rule-effective.ts` → `isScheduleRuleEffectiveOnDate` |

> 后续会把两处收敛成 `src/utils/lesson-identity.ts`（见 `../changes/lesson-identity-feature/`），**在那之前以上两处即唯一真源**。

### 规则 6：展开课次必须按「规则有效期 + 停止日」收窄（2026-10-01 用户口径）

```md
❌ 只按 `day_of_week` 展开规则就渲染课次（卡片 / 红点 / 调课 / 日历同步 / 冲突预检）
   ⇒ ① 排课时设的「开始日期/结束日期」被静默忽略（后端 `dateRangeFilter` 已生效 ⇒ 与首页今日课表打架）；
      ② **「删了规则再重建」**（新规则 start_date 默认=今天）会把新规则回填到历史日期
         ⇒ 同一节课出现**两张卡片**；
      ③ 删掉/停止的规则在**所有日期**继续出课（历史该留、未来不该留，方向刚好反了）。

✅ FIX: 一律过 `isScheduleRuleEffectiveOnDate(rule, date)`：
       `start_date ≤ 日期 ≤ end_date`（空缺不设限）+（若 `STOPPED`）`日期 ≤ stopped_at`。
   ⚠️ **必须全量覆盖 5 个消费方**，漏一处就是口径分裂：
       课表卡片 `schedule-card-build` / 日历红点 `schedule-derived-logic` / 批量调课 `visible-schedules` /
       日历同步 `services/calendar-sync` / 调课冲突预检 `services/temporary-reschedule`。
   ⚠️ 前端类型与 mapper 要带 `start_date` / `end_date`（后端早就返回，前端曾整列丢弃）。

🧭 口径：**排课规则 = 计划；历史课表 = 资产。删规则只删未来、历史必须照旧渲染。**
   用户原话（2026-10-01）：「删除规则，历史课程卡片也要渲染，记录保存，这是账本不能删，只删未来的排课。」

📖 See: `../../../yunce-back/yunce-backend/.harness/changes/schedule-soft-delete/design.md`（含边界清单 B1–B9）
```

## 验收（改完必做）

- [ ] 同班同一天两节课：只给第 1 节加试听 ⇒ **只有第 1 节挂「试听」**
- [ ] 给第 1 节点完名 ⇒ 再打开第 2 节 **显示「未点名」**
- [ ] 同日临时调课后 ⇒ 调课前下的试听/补课预约**仍在名单与角标里**
- [x] 从**没有节次信息的入口**（首页快速消课 / 预约页 / 线索详情）⇒ 点名页让老师指明「第几节」：
      该班当天 **1 节自动带**、**≥2 节必须选**（未选拦提交）、**0 节退回不区分**
- [x] 删掉一条排课规则 ⇒ **历史日期的卡片仍在**（含已点名的状态）、**未来日期不再出卡片**、
      日历红点同步、流水账不变（2026-10-01 用户口径；单测：`schedule-rule-effective` / `schedule-card-build` / `schedule-derived-logic`）
- [x] 「删了再重建」⇒ 历史只有老卡片、未来只有新卡片，**不重复**（同一批单测）
