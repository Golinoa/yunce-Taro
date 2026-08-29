# 班课排课表单 · 前后端对照规格

> 前端持续改动时维护此文档，便于后端按条目对齐接口与字段。  
> 页面：`yunceTaro/src/package-course/pages/schedule-form` · 课表卡片动作见 §8  
> 更新时间：2026-08-28

---

## 1. 页面职责

| 模式 | 说明 | 前端状态 |
|------|------|----------|
| 班课新增/编辑 | 决定班级「什么时候上」 | **进行中（验收中）** |
| 团课 | 同班课表单；无学员列表；含**预约设置**（与时段配置同步） | **已开放**（`sourceMode=group`） |
| 班级调课 | 当天实例换时段，长期规则不变 | `mode=reschedule` 已接临时调课 |
| 学员调课 | 单人补课到别的安排 | 请假/调课页占位 |

---

## 2. 表单字段（班课）

| UI 文案 | 前端字段 | 后端建议 | 备注 |
|---------|----------|----------|------|
| 课程类型 | `scheduleType` | — | `class` \| `group` 可切换 |
| **班级名称** | `classId` | `classId` | 原「课程名称」；进页默认弹选择班级 |
| 老师 | `selectedTeachingTeacherId` | `teacherId` | 可编辑；默认带出班级老师 |
| 助教 | `selectedAssistantTeacherId` | `assistantTeacherId?` | 可编辑；后端若无字段需补 |
| 课程难度 | `courseLevel` | `class.level` 或排课扩展 | 目前多为本地态，持久化待确认 |
| 上课教室 | `room` | `room`（名称字符串） | 跟当前校区教室列表联动 |
| 消耗课时 | `consumedHours` | 建议 `hoursPerLesson` / `consumedHours` | 整页唯一，不按时间组 |
| **预约设置**（仅团课） | `autoOpenType` + `slotMaxCount` + `minOpenCount` | `class.autoOpenType` / `class.studentCount`(容量) / `class.minOpenCount` | 与时段配置 `class-slot-config` **同源**；选班带出、保存回写班级；`note` 亦写入元数据兼容 |
| 排课规则 | `schedulingMode` | `rule` \| `free` | |
| 开始日期 | `startDate` | `startDate` | 仅规则排课 |
| 重复方式 | `repeatMode` | `weekly` \| `biweekly` \| `alternate` | |
| 上课周几 | `selectedDays` | `dayOfWeeks[]`（后端 0–6） | 前端 1–7，提交需映射 |
| 结束方式 | `endMode` | `never` \| `by_date` \| `by_count` | **仅规则排课** |
| 结束日期 | `endDate` | `endDate` | `by_date` |
| 上课次数 | `endCount` | `maxOccurrences` | `by_count`：排满 N 次后失效 |
| 节假日是否排课 | `scheduleOnHoliday` | `scheduleOnHoliday` / 反义 `skipHoliday` | **仅规则排课**；是/否切换 |
| 上课时间组 | `timeSlots[]` | 多条或 `times[]` | 每周几 × 各时段笛卡尔积 |
| 自由排课日期 | `freeDates[]` | 具体日期列表 | 选哪天上哪天；**CalendarMonthSheet 多选**（课表 CalendarWeekSelector 同款视觉） |
| 备注 | `note` | `note` | 机构可见；放在学员卡下方最底 |
| 上课学员 | `classStudents` | `GET/POST/DELETE /classes/:id/students` | 见 §4 |

### 班级选择弹窗过滤

左侧：`全部` / `未排课` / `已排课`  
已排课判定：班级出现在任意 `schedules.classId`（前端 `classService.getScheduledClassIds`）。

---

## 3. 冲突检测

| 项 | 约定 |
|----|------|
| 接口 | `GET /schedules/check-conflict` |
| 入参 | `dayOfWeek, startTime, endTime, teacherId?, classId?, room?, excludeScheduleId?` |
| 出参 | `hasConflict, conflictSummary, conflicts[]`（含 `conflictTypes`: time/teacher/room/class） |
| 创建/更新 | 默认校验；`ignoreConflict: true` 可跳过（弹窗「忽略冲突」） |
| HTTP | 冲突时 **409**，`data` 为冲突结构 |

---

## 4. 上课学员与课时展示（对齐缺口）

| 能力 | 前端期望 | 当前后端 | 状态 |
|------|----------|----------|------|
| 班级学员列表 | id/name/avatar + **剩余课时** | `GET /classes/:id/students` 仅基础字段 | ⚠️ 缺 remainingHours |
| 剩余课时 | `course_packages[].remaining_hours` 求和 | 有 `GET /students/:id/hours` | 前端可逐人补拉；建议列表接口一并返回 |
| 添加/移除学员 | `POST/DELETE .../students` | 已有 | ✅ |
| 全部学员池（弹窗搜索） | `GET /students` 或按老师 | 已有 | 需带课包信息以便筛选未排班 |

**建议后端**：`GET /classes/:id/students` 增加：

```json
{
  "id": "...",
  "name": "...",
  "avatar": "...",
  "remainingHours": 12,
  "phone": "..."
}
```

---

## 5. 保存语义

### 规则排课

- 每周/隔周：`selectedDays × timeSlots` → 多条循环排课（或一条规则 + 多时段，待后端定模型）
- 隔天：仅 1 组时间，从 `startDate` 到结束条件
- `by_count`：生成/展开至 N 次后标记失效，不再往后排

### 自由排课

- `freeDates × timeSlots`；无结束方式、无节假日开关

### 前端当前实现

- Mock/真实：循环 `scheduleService.create` 多条（首版）
- 规则元数据暂写入 `note` 文本；正式字段落地后去掉

---

## 6. 待后端补齐清单（优先）

1. [ ] 排课规则字段：`repeatMode / endMode / endCount / scheduleOnHoliday / consumedHours / assistantTeacherId`
2. [ ] 班级学员列表返回 `remainingHours`（或嵌套课包）
3. [ ] 按次数结束后的排课/班级「失效」状态机
4. [ ] 助教、难度若挂在班级：更新班级接口支持；若挂在排课：扩展 Schedule
5. [ ] 自由排课按「具体日期实例」存储（仅 dayOfWeek 不够）
6. [ ] **`POST /lesson-records` 创建支持 `status: MAKEUP`**（补录）——见下方核对结论
7. [ ] 点名/补录细分出勤：前端有 `leave` / `absent`；后端枚举目前仅 `NORMAL | CANCELLED | MAKEUP`——请假/未到落库语义待定（content 文案占位或扩枚举）
8. [ ] **`Schedule.assistantTeacherId` 落库 + create/update/list/detail 透出**（Prisma `Schedule` 仍无此字段；Mock 已有，课表卡片助教依赖此字段或班级 `teachers`）
9. [ ] **排课列表/周课表返回 `teacherName` / `assistantTeacherName`（或嵌套 teacher）**；今日课表 `GET /schedules/today` **已返回** `teacherName`
10. [x] **`GET /schedules/today` 校长/管理员校区全员课表**（`resolveCampusWideView`：`PRINCIPAL` / org `OWNER`/`ADMIN`；教师仍仅本人）
11. [ ] 班级学员接口保证 `avatar` 稳定返回（课表卡片头像行；`listStudents` 已有字段，联调核对空头像）
12. [ ] **课表「约试听」联调**：`POST /leads/bookings` 已支持 `classId`；前端须传有效 `campusId`/`teacherId`（勿空串）

### §6.6 核对结论（2026-08-28 代码）

| 层 | 现状 | 需改 |
|----|------|------|
| `createLessonRecordSchema` | **无** `status` 字段（Zod 会剥掉客户端传入） | 增加可选 `status: NORMAL \| CANCELLED \| MAKEUP` |
| `createLessonRecord` service | 写死 `status: LessonStatus.NORMAL` | 改为 `input.status ?? NORMAL` |
| `updateLessonRecordSchema` | 已有 `status` | 无需改 |
| 课时回滚 | 删除/部分更新仅对 `NORMAL` 回滚套餐 | 确认 `MAKEUP` 是否同样扣/回滚课时（产品建议：**与 NORMAL 相同扣课时**） |

> 文档示例里的 `hours` 字段已过时：真实 create body 使用 **`duration`（分钟）**，服务端换算 `hoursUsed`。

---

## 8. 课表班课卡片动作链路（补录 / 编辑 / 点名）

> 组件：`ScheduleActionButton`（attend / adjust / edit / **neutral**）  
> 页面：`pages/schedule` 班课 Tab；信息行右侧点名/补录，分割线下头像 + 约试听

### 8.1 按钮显隐

| 卡片状态 | 信息行右侧 | 分割线下 | 跳转 |
|----------|------------|----------|------|
| `upcoming` / `urgent` | **点名**（主题色） | 头像 + **约试听 ›** | 点名→lesson-form；约试听→`BookTrialByClassSheet` |
| `active` | **继续点名** + 绿边框「上课中」 | 头像 | lesson-form |
| `ended` / `done`（历史，**30 天内**） | **补录**（淡中性色 `neutral`） | 头像（有则显示） | **卡片点击 = 补录按钮** |
| `ended` / `done`（**超过 30 天**） | **无按钮**（隐藏，不展示「不可补录」） | 头像（有则显示） | 点击 → lesson-form **仅查看**（`viewOnly=1`） |
| `cancelled` | 无 | — | 左滑恢复 |

**卡片主体点击（2026-08-28）**：

| 状态 | 与右侧按钮关系 |
|------|----------------|
| 未开课 / 上课中 | 与「点名 / 继续点名」同页 → `lesson-form` |
| 历史且 ≤30 天 | **与「补录」完全相同** → `lesson-form`（`done` 时带 `action=supplement`） |
| 历史且 >30 天 | **隐藏补录**；点卡片 → `lesson-form?viewOnly=1` 仅查看 |

> 状态计算 `resolveScheduleStatus` 前后端同源（按选中日期 vs 今天 + 消课记录），**非 Mock 独有**；Mock 仅提供排课/记录数据。  
> 窗口按 **自然日 30 天**（`today - 30` ≤ lessonDate），不是「自然月」。

### 8.2 业务语义

```
未点名 ──点名 / 点卡片──► lesson-form（提交点名 → POST /lesson-records × N）
已点名(≤30天) ──补录 / 点卡片──► lesson-form?action=supplement
                                 → 页内可「补录」「修改」
已点名(>30天) / 超时历史 ──点卡片──► lesson-form?viewOnly=1（底部「已提交」/「仅查看」，无补录修改）
编辑（未开课）──────────► schedule-form?id=
约试听 ────────────────► BookTrialByClassSheet → POST /leads/bookings
```

**补录定义（产品口径）**：这节课**已经上过并点过名**后，发现漏了 1～2 人，把人加进本节签到；不覆盖原有出勤结果。  
**补录按钮样式**：淡中性色（`muted` 底 + `muted-foreground` 字），不使用主题色，避免与「点名」抢视觉。

### 8.3 前端路由约定

```
/package-course/pages/lesson-form/index
  ?scheduleId=
  &classId=
  &lessonDate=YYYY-MM-DD
  &hasTrialStudent=0|1
  &action=supplement   // 可选；≤30 天且已点名：加载后自动打开补录选人
  &viewOnly=1          // 可选；>30 天历史卡强制仅查看
```

独立页 `lesson-supplement` 仍保留（lesson-detail 入口）；课表卡片统一走 lesson-form 补录态。  
**页内「补录 / 修改」与课表窗口一致：上课日起 30 天**（已从旧 24h 对齐）。

### 8.4 数据打通（Mock / 生产，禁止卡片硬编码）

| 展示字段 | Mock 来源 | 生产来源 | 备注 |
|----------|-----------|----------|------|
| 主讲 / 助教 | `SCHEDULES.teacherId` + `assistantTeacherId` → `mapMockSchedule` 解析名；或班级 `teachers` | Schedule.teacherId +（待补）assistantTeacherId；或 Class.teachers | 勿在 UI 写死姓名 |
| 人数 7/8 | 班级 `student_count` + 当日 lessonRecords | class students count + lesson-records | — |
| 教室 | `SCHEDULES.room` | Schedule.room（已有） | 无 room 不展示 |
| 头像行 | `classService.getStudents` → `avatar_url` | `GET /classes/:id/students` → avatar | 空则品牌占位图 |
| 上课中样式 | 前端 status=`active`（当日且当前时刻在 start–end） | 同前端时段算法 | 绿边框 + `course-tag-active`；**班课标题状态标签仅「上课中」「试听」** |
| 试听标签 | 当天 `classId|lessonDate` 有 pending/confirmed 试听预约 | `GET /leads/bookings` | **仅班课**；不按体验课包常驻打标 |
| **团课卡片** | 开放预约时段列表 | `class-booking` slots | **无试听、无约试听**；状态标签仅「上课中」；满员/可约用 `current/max` 表达 |

### 8.0 班课 vs 团课（勿混）

| | 班课（fixed） | 团课（open 预约） |
|--|--------------|------------------|
| 预约形态 | 固定排课；可「约试听」加线索试听 | 家长/代约占时段名额，**全是预约** |
| 标题状态标签 | **上课中**、**试听** | **仅上课中**（无试听标签） |
| 分割线操作 | 未开课可「约试听 ›」 | 已约头像 +「+」代约 |
| **补录** | **有**（历史课 ≤30 天） | **无**（卡片无补录按钮；不走 `action=supplement`） |
| 入口弹框 | `BookTrialByClassSheet` → `/leads/bookings` | 代约 / 开放时段配置，**不走试听线索** |
| 列表渲染 | `ScheduleCard` + 固定排课 | 开放时段卡片 `ClassBookingSlot` |

### 8.0.1 用户自定义分类 → 课表 Tab / 卡片（映射规则）

课表顶 Tab 由 `course-category` 驱动，**卡片形态看分类的 `mode`，不看分类名字**：

| 分类配置 | 课表表现 |
|----------|----------|
| `mode=class` | 渲染**班课卡片**（点名/补录/约试听） |
| `mode=group` | 渲染**团课开放时段卡片**（点名/代约，**无补录、无试听**） |
| `mode=private` | 进私教/预约视图 |
| `independentDisplay=true` | 独立顶 Tab；只展示 `class.category_id === 该分类 id` 的班级 |
| `independentDisplay=false` | 并入同 `mode` 的聚合 Tab（如「班课」），聚合内所有非独立分类的班级 |

**班级侧必须对齐**，否则 Tab 可能为空或对不上卡片：

| 字段 | 班课分类下 | 团课分类下 |
|------|------------|------------|
| `class.category_id` | 指向该分类（或系统 `cat-class`） | 指向该分类（或系统 `cat-group`） |
| `class.schedule_mode` | `fixed`（或缺省） | **`open`** |
| 数据源 | `schedules` 按周几展开 | `class-booking` 当日 slots |

> 缺口：创建/改班级时若只改了 `category_id`、未同步 `schedule_mode`，自定义「团课类」Tab 会滤出班级但 `open` 过滤后无时段 → 空列表。产品上应在选分类时按 `mode` 自动带出 `schedule_mode`（待补）。

系统默认 Mock：`cat-class` / `cat-group` / `cat-private` 均为 `independentDisplay=true`，故顶栏直接显示「班课」「团课」「私教」三个独立 Tab。

### 8.0.2 团课「预约设置」同步

时段配置页（`class-slot-config`）里的预约设置入口较深，已提取到**团课排课表单**，两边读写同一班级字段：

| UI | 班级字段 | 说明 |
|----|----------|------|
| 自动开班条件 | `auto_open_type` / `autoOpenType` | `manual` \| `full` \| `time` \| `full_or_time` |
| 每时段可约人数 | `student_count`（作容量默认值） | 新建时段的 `max_count` 默认取此值 |
| 最少开班人数 | `min_open_count` / `minOpenCount` | 约满/约满或到时间时生效 |

- 排课表单：选班带出 → 可编辑 → 保存时 `classService.update`
- 时段配置：保存时段时同步回写上述班级字段
- 排课 `note` 额外写入元数据便于兼容旧数据

### 8.5 停课（班课 / 团课）

> 2026-08-29 落地：与「取消本节」区分。

| 项 | 约定 |
|----|------|
| 状态 | `Class.status = paused`（可恢复为 `active`；`ended` 为结课） |
| 入口 | 课表左滑「编辑」旁「停课」；点名页头部「编辑」旁「停课」 |
| 效果 | 该班排课/开放时段从课表隐藏；家长无法新约；消课历史不受影响 |
| 恢复 | 课表底部「已停课班级」→「恢复上课」；或点名页「恢复」 |
| 与取消 | 「取消」= 取消**当天这一节**；「停课」= 暂停**整个班级** |

---
 后端对齐（消课 / 补录）

| 能力 | 前端行为 | 后端现状 | 待办 |
|------|----------|----------|------|
| 点名创建 | `POST /lesson-records`（扣课时） | ✅ `duration`→`hoursUsed` | — |
| 补录创建 | 同上 + body.`status=MAKEUP` + content「补录签到」 | ❌ create **schema 无 status** + service 写死 `NORMAL` | **需接（两处）** |
| 改状态 | `PUT /lesson-records/:id` `{ status }` | ✅ NORMAL/CANCELLED/MAKEUP | — |
| 列表筛选 | `?status=MAKEUP` | ✅ | — |
| 请假/未到 | 前端 leave/absent + content | ⚠️ 无对应枚举 | 扩枚举或约定 content |
| 取消开课 | status cancelled；duration 仍 ≥1 | create 要求 duration 1–480 | 0 课时取消需另约定 |
| 排课助教 | body/list `assistantTeacherId` | ❌ Schema 无字段 | **需接**（见 §6.8） |
| 今日课表范围 | 校长全校区 / 教师本人 | ✅ `getTodaySchedule` + `resolveCampusWideView` | 周课表是否同学口径另核 |

**建议 create body**（与 PUT 对齐；字段名以校验器为准）：

```json
{
  "studentId": "uuid",
  "classId": "uuid",
  "scheduleId": "uuid",
  "packageId": "uuid",
  "lessonDate": "2026-08-28",
  "duration": 60,
  "content": "补录签到",
  "status": "MAKEUP"
}
```

前端 `buildLessonRecordPayload` **已传 `status`**；当前会被 Zod 剥掉且 service 写死 NORMAL，补录仍可扣课时，但列表/统计无法区分「补录 vs 正常点名」。

### 8.6 课表「约试听」（BookTrialByClassSheet）

| 项 | 约定 |
|----|------|
| UI | 居中 Modal：选已有线索（BottomSheet）/ 手动输入姓名+电话 → 提交 |
| 入口 | **仅班课** `upcoming` / `urgent` 卡片分割线下「约试听 ›」；**团课不提供** |
| API | `POST /api/app/v1/leads/bookings`（非 trial-invites） |
| 必填 | `leadId, courseId, courseName, campusId, teacherId, lessonDate, startTime, endTime`；`bookingType=proxy`；`classId/className` 可选但课表应传 |
| 后端 | ✅ `createLeadBooking` 已落 `classId`、冲突校验、线索 status→`booked` |
| 前端注意 | `bookTrialByClass` 须传真实 `campusId`（校区 store / 卡片 `campusId`）；`teacherId` 用教师档案 id |
| 与 trial-invites | 家长邀请链路另一套；课表老师代约走 **leads/bookings** |

### 8.7 停课（班课 / 团课）

> 2026-08-29：与「取消本节」区分。

| 项 | 约定 |
|----|------|
| 状态 | `Class.status = paused`（可恢复为 `active`；`ended` 为结课） |
| 入口 | 课表左滑「编辑」旁「停课」；点名页头部「编辑」旁「停课」 |
| 效果 | 该班排课/开放时段从课表隐藏；家长无法新约；消课历史不受影响 |
| 恢复 | 课表底部「已停课班级」→「恢复上课」；或点名页「恢复」 |
| 与取消 | 「取消」= 取消**当天这一节**；「停课」= 暂停**整个班级** |

---

## 7. 变更日志

| 日期 | 变更 |
|------|------|
| 2026-08-29 | 班课/团课停课：`paused` 状态 + 课表/点名入口；点名页主按钮改主题色 |
| 2026-08-28 | 初稿：班课表单字段、冲突、学员课时缺口、规则/自由语义 |
| 2026-08-28 | 「课程名称」→「班级名称」；进页默认选班；过滤全部/未排/已排 |
| 2026-08-28 | 自由排课日期改用课表同款月历多选；备注置底；时间区滚动定位 |
| 2026-08-28 | `classService.getStudents` 补拉课包写入 `course_packages`（兼容后端暂无 remainingHours） |
| 2026-08-28 | 上课学员区加高（头像 lg / 空态 min-h 280rpx） |
| 2026-08-28 | 课表卡片恢复「补录/编辑/点名」；`action=supplement` deep link；§8 与后端 MAKEUP create 缺口 |
| 2026-08-28 | 选择班级弹窗：横向班课分类标签 + 课程管理同款卡片；覆盖全部 mode=class 分类 |
| 2026-08-28 | 班课卡片：补录改 `neutral` 淡中性色；§6 增助教字段等后端待办；Mock `mapMockSchedule` 解析教师名 |
| 2026-08-28 | 历史卡点击=补录；约试听弹框恢复；§6/§8 核对后端：MAKEUP create 双缺口、today 全校区已接、约试听走 leads/bookings |
| 2026-08-28 | 历史卡规则对齐：30 天内可补录/修改；超时隐藏补录按钮；点卡片 `viewOnly` 仅查看；lesson-form 窗口由 24h 改为 30 天 |
| 2026-08-28 | 厘清：试听仅班课；团课全预约、无试听标签/约试听；团课仅「上课中」状态标签 |
| 2026-08-28 | 厘清：团课无补录；自定义分类按 `mode`+`category_id`+`schedule_mode` 对齐卡片（§8.0.1） |
| 2026-08-28 | 团课排课表单提取「预约设置」（自动开班/每时段可约/最少开班），与时段配置 `class-slot-config` 双向同步班级字段 |
