# 云策教务（yunceTaro）全量代码审查报告

> 审查日期：2026-08-22 ｜ 审查范围：src 全量（stores / services / data / types / 7 大业务包 / 主 pages / 公共组件）
> 审查目标：① 业务逻辑 bug / 错误；② 业务链路断裂 / 缺失 / 前后模块衔接不一致
> 配套文档：CODE_REVIEW_STANDARD.md（审查标准）、CODE_REVIEW_REPORT.md / CODE_REVIEW_REAUDIT.md（首轮）

---

## 〇、审查范围与方法说明（诚实声明）

- **已逐文件通读**：`src/stores`（13）、`src/services`（22）、`src/types`（24）、`src/data`（26，含 mock）全部文件；并通读 `data/teacher.ts`、`mock-database.ts`、`data/students.ts`、`data/lead.ts` 等核心业务逻辑文件。
- **按模块追踪主流程**：各业务包的入口页面 + 关键页（如 `student-transfer`、`salary-payment`、`lead-detail`、`class-detail`、`convert`）与其对应 store/service/data 接线。
- **重点核对两类问题**：用 Grep 全仓扫描断裂调用（如调用了不存在/桩方法）、字段命名冲突（camelCase vs snake_case）、双数据源、状态机文档与实现漂移、时间基准分裂。
- **未逐字通读**：157 个纯展示组件的内部实现（已按"复用规范 / PickerView 高度 / 裸 Input"做专项扫描，见模块八）；但所有跨模块数据调用均已在 data/service 层核对。
- **已纠正的误判**：初查曾怀疑"消课对 mock 课包恒扣 0"，经核实 `mock-database` 本地 `CoursePackage` 为 camelCase 且 `mapMockPackage` 有 `'finished'→'completed'` 桥接，**消课链路实际可用**，故降级为"双类型衔接风险"而非 bug。

---

## 一、基础层（stores / services / data / types）—— 数据骨架

### 代码结构概览
| 层 | 文件数 | 职责 |
|---|---|---|
| stores | 13 | Zustand 状态：teacher/student/class/lead/campus/card-type/course-template/course-category/package-template/agreement/privacy/theme |
| services | 22 | 接口契约层，当前全部由 mock 实现；**仅 `statistics` 与 `student` 含 `USE_MOCK` 真/假双路径** |
| data | 26 | mock 业务逻辑，**唯一可变数据源（`_teachers` 等）** |
| types | 24 | 契约定义（部分与 data 层实际结构存在漂移） |

### 业务链路（数据一致性主干）
```
UI 组件 → useXxxStore(动作) → xxxService(契约) → mockXxx(数据层, 内存可变数组) → 刷新 store
页面只读 @/services ；Service 是唯一数据出口（符合 AGENTS.md 铁律）
```

### 问题清单

**[🔴 L-01 跨月数据源断裂]** `src/data/teacher.ts:797` `mockGetTeachers`
非当前月走 `genMonthSnapshot(month)`（:731-779），该函数基于**静态常量 `mockTeachers`** 重新生成，完全忽略内存可变源 `_teachers`。后果：在 7 月视图下对 `_teachers` 的任意写入（确认/发放/扣款/离职/新增）**根本不可见**，跨月数据静默丢失。当前 UI 因"过去月强制 archived、未来月被拦截"暂不可达，但属**上线前必须修的架构缺陷**。

**[🔴 L-02 统一教师视图硬编码在职]** `src/data/mock-database.ts:672, :692` `buildTeacherView`
`status: 'active'` 被**硬编码**，且只同步 `name/phone/role/subjects`。后果：
- 教师在管理库 `resigned`，在班级/学员/统计统一视图（`TEACHERS`）里**仍显示在职**；
- 薪资字段（`salaryStatus`/`deductions`/`salaryRule`）**永不进入**统一视图（双教师模型结构性缺口）。

**[🔴 L-03 两套教师主数据分裂且同 ID]** `src/data/mock-database.ts:585-654` vs `src/data/teacher.ts:189-334`
`BASE_TEACHERS`（teacher-001 张老师/李老师/王老师/赵老师）与 `rawMockTeachers`（teacher-001 王校长/李老师/张老师/赵前台）**同名 ID、主数据完全不同**。统一视图以 BASE 为基底、用管理库覆盖少数字段，导致 `campusIds/canCrossCampus/salaryStatus/subjects 列表/pendingSalary` 等以 BASE 为准，管理库的编辑在统一视图里部分生效、部分被覆盖——典型"前后模块衔接不一致"。

**[🔴 L-04 时间基准分裂]** `src/data/mock-database.ts:18`（`NOW=2026-06-22`）vs `src/data/teacher.ts:143`（真实系统时钟，2026-08）
`mock-database` 全部种子数据（学员/班级/课表/线索）锚定 **2026-06**；而教师薪资（`data/teacher`）与排课（`mockScheduleData` 用 `dayjs()`）锚定**真实当前月**。在小程序以真实日期（2026-08）运行时，"今日/本周/本月"日期相对功能与 mock 数据的"现在"错位，排课/考勤/首页时间区会出现空数据或错位。

**[🔴 B-01 实发金额算法与展示算法不一致]** `src/data/teacher.ts:929-934` `mockExecutePay` vs `src/stores/teacher.ts:25-37` `calcTotal`
- `calcTotal`（UI 展示）：`base + 课时费 + attend + perf − socialInsurance − lateFine − otherFine + bonusAmount + 扣款/补发`
- `mockExecutePay`（写入 `payHistory.amount`）：`base + hours*rate + attend + perf + 扣款`，**漏算社保/罚款/奖金、且课时费用 `hours*rate` 而非 `categoryLessonFees` 汇总**
→ 发放后流水金额与界面"应发"对不上，财务对账出错。

**[🟡 B-02 待确认计数语义错误]** `src/stores/teacher.ts:380` `getPendingCount` = `salaryStatus !== 'archived'` 的数量（= "未归档总数"），但教师列表以"待确认"文案展示；薪资页用正确的 `stats.pending`。**同一概念两个互相矛盾的数字**（已在首轮指出，仍存）。

**[🟡 L-05 薪资状态机 文档/实现漂移 + 孤儿状态]** `src/types/teacher.ts:31-79` vs `src/data/teacher.ts` 实现
- 类型 `SALARY_STATUS_META` 定义五态 `pending→confirmed→sending→teacher_confirmed→archived`；
- 实际流为四态 `pending→confirmed→sending→archived`，`teacher_confirmed` **从未被任何代码置位**（孤儿状态）。文档与实现长期不一致。

**[🟡 L-06 扣款方法死链]** `src/stores/teacher.ts:282-298` + `src/services/teacher.ts:81-93` + `src/data/teacher.ts:1007-1047`
`addDeduction/updateDeduction/deleteDeduction` 在 store/service/data **三层均实现但全仓无任何页面调用**（`salary-adjust` 页改用 `updateTeacher(id,{deductions})` 持久化）。属于"定义了链路但前端未接通"的断裂；同时说明 `salary-adjust` 与薪资管理库对"扣款"用了两套路径。

**[🟡 B-03 写后重拉不携带月份]** `src/stores/teacher.ts:208,214,225,236,266,272,278`
`confirmSalary/batchConfirm/executePay/executeSend/addTeacher/updateTeacher/resignTeacher` 重拉均用 `teacherService.getList()`（不传 `salaryMonth`）。非当前月操作时，界面会**静默跳回当前月数据**。

**[🟡 B-04 工资模型切换依赖脆弱索引]** `src/data/teacher.ts:1077` `t.modelIdx !== _salaryModels.findIndex(...)`
`modelIdx` 是写死在种子里的数组下标（仅 0/1），与三模型动态顺序比较，易在增删模型后错配。

**[🟡 Q-01 Store 写操作无 try/catch / 无回滚]** `src/stores/teacher.ts`（全部 mutation）、`src/stores/card-type.ts`、`src/stores/course-category.ts`
service 抛错会直接冒泡到页面 `await`，无错误态/无回滚；`card-type`/`course-category` 的 `create/update/remove` 甚至无 loading。属错误处理维度缺口（标准中"失败路径回滚"未落实）。

---

## 二、package-teacher（教师 + 薪资）

### 结构概览
页面：teacher-list / teacher-detail / teacher-form / salary-home / salary-payment / salary-detail / salary-form / salary-adjust / salary-settings / salary-template(+form)。组件：components/teacher/*（SalaryTab/ConfirmSalarySheet/DeductionSheet/…）。

### 业务链路
```
教师列表 → 薪资首页(月) → [确认薪资 → 发送工资单 → 发放归档] 
                              └→ 薪资调整(扣款/补发) → 套用模板/规则
离职：resignTeacher → 同步统一视图
```

### 问题清单
- 继承基础层 **L-01/L-02/L-03/L-04/B-01/B-02/L-05/L-06/B-03/B-04/Q-01**（见模块一，本包是直接载体）。
- **[🟡 L-07 薪资调整与扣款双路径]** `salary-adjust` 用本地 `form.deductions` + `updateTeacher(id,{deductions})`；而 `DeductionSheet`/store 的 `addDeduction` 是另一条未接通路径（见 L-06）。同一"扣款"概念两处实现、仅一处置位。
- **[💭 月份范围硬编码]** `data/teacher.ts:148-149` `MOCK_MIN_MONTH_KEY/MAX_MONTH_KEY = 2026-07/08`，与 L-04 的时间基准分裂叠加，使薪资模块只能在 7/8 月看到数据。

---

## 三、package-student（学员 + 会员卡 + 转校）

### 结构概览
页面：students(列表·会员·线索三 Tab) / student-detail / student-form / member-card-issue / member-card-edit / member-card-detail / student-transfer / follow-record-form / parent-bind / help。数据：`data/students.ts`（核心，含班级/课包/消课/转化）、`data/member-card.ts`、`data/follow-records.ts`。

### 业务链路
```
建档(students) → 购课包/发卡(member-card) → 消课(lesson-record 扣课时) → 调班/转校 → 跟进记录
线索转化 → 新建 Student(lead.convert)
```

### 问题清单

**[🔴 L-08 调班功能是空实现（链路断裂）]** `src/data/students.ts:1123-1130` `mockTransferStudent`
```ts
export async function mockTransferStudent(_classId, _targetClassId, _studentId) {
  await delay();
  return true;   // 什么都不做！
}
```
对比同文件 `mockRemoveStudentFromClass`（:1101，正确更新 `student.classIds` + 同步班级人数）、`mockAddStudentsToClass`（:1111，正确建立关联）——**调班既不从源班移除、也不加入目标班、更不更新学员 `classIds`**。但 `student-transfer/index.tsx:142`、`class-detail/useClassDetail.ts:339`、`lesson-form/index.tsx:1110` 三处都调用它并提示"调班成功"。**UI 显示成功，数据零改动**——典型"链路中断在最后一环"。

**[🔴 L-09 结束班级是空实现（链路断裂）]** `src/data/students.ts:1132-1135` `mockEndClass`
同为空桩 `await delay(); return true;`。班级"结束"操作不生效。

**[🟡 B-05 线索转化创建字段命名错乱]** `src/data/lead.ts:1626-1644` `mockCreateConversion`（`new_student` 分支）
新建 `Student` 使用 camelCase（`teacherId`/`totalHours`/`remainingHours`/`createdAt`/`classIds`），而 `mock-database` 的 `STUDENTS` 与 `types/student.ts` 均为 snake_case（`teacher_id`/`total_hours`/`remaining_hours`/`created_at`/`class_ids`）。新转化学员记录字段错乱，下游 `mapMockStudent` 读 `teacher_id` 得到 `undefined`，且 `campusId:''` 为空。属"前后模块衔接不一致"导致的脏数据。

**[🟡 L-10 双 CoursePackage 类型模型]** `src/data/mock-database.ts:2357` 本地 `CoursePackage`（camelCase：`studentId/totalHours/remainingHours/status:'finished'`）vs `src/types/course-package.ts`（snake_case：`student_id/total_hours/remaining_hours/status:'completed'`）
数据层与 UI 层各有一套同名但字段不同的 `CoursePackage`，仅靠 `services/student.ts:908` `mapMockPackage`（`'finished'→'completed'`）与散落的 `deduct` 映射（:1657）桥接。消课/充值链路**目前因映射层存在而可用**，但**任意一侧新增字段若忘改映射即静默断裂**，是高风险衔接债。

**[🟡 L-11 会员卡与课包未在数据层打通]** `data/member-card.ts` 的 `mockIssueMemberCard`（:215）/ `mockRechargeMemberCard`（:273）写 `COURSE_PACKAGES`，但会员卡 `remainingCount/remainingDays` 与课包 `remainingHours` 是**两套独立剩余量**，发卡/消课之间无统一剩余校验；`member-card` 计费单位（分）与 `CoursePackage.totalAmount`（元）也存在口径差异，跨模块金额展示需逐个核对。

---

## 四、package-course（班级 / 课程 / 课次 / 排课 / 考勤 / 调课）

### 结构概览
45 个文件。页面：classes / class-detail / class-form / course-management / course-form / course-packages / lesson-form / lesson-edit / lesson-detail / lesson-supplement / schedule-form / class-checkin / attendance / records / booking-record-detail / batch-reschedule-* / leave-request / teacher-booking-config / subject-management / category-form / card-management / card-member-list / recharge-records。组件：components/class·course·lesson·schedule·booking·reschedule。

### 业务链路
```
课程模板(course-template) → 班级(class-form) → 固定/开放排课 → 课次(lesson) → 考勤/消课 → 记录
开放预约：时段池(slot) → 约满开班 → 生成 schedule
调课：临时调课(temporary-reschedule) 覆盖单日实例
```

### 问题清单
- 继承 **L-08/L-09**（调班/结束班级空桩直接影响本包 `class-detail`/`lesson-form`）。
- **[🟡 L-12 调课临时记录未与排课消费打通]** `types/temporary-reschedule.ts` 定义 `TemporaryReschedule`，但 `data` 层未检索到 `mockCreateTemporaryReschedule` 之类的落地实现；`schedule` 渲染是否读取该表需专项确认（建议核实 `package-course/pages` 调课提交是否真正写入并作用于课次展示）。
- **[🟡 L-13 课次/考勤与课时扣减的跨模块一致性]** 消课扣减在 `data/students.ts`（`mockDeductPackageHours`），而考勤/课次在 `package-course`；二者对"某次课消耗多少课时、扣哪个课包"的口径与边界（如请假/补课 `leave-request`）需走查是否一致，建议作为 Gate-3 回归项。
- **[💭 开放预约开班幂等]** `ClassBookingSlot.opened_schedule_id` 字段用于避免重复开班，需确认 `class-booking` 写入路径是否已落库该校验。

---

## 五、package-lead（线索 + 试听 + 代约）

### 结构概览
26 文件。页面：lead-form / lead-detail / lead-booking-detail / lead-booking-edit / trial-booking / trial-slots / trial-slot-config / class-slot-config / open-slot-edit / proxy-booking-form / proxy-member-select / convert / follow-up / my-invite / invite-qrcode / invite-landing。数据：`data/lead.ts`（最大线索数据文件之一）。

### 业务链路
```
新建线索(lead-form) → 试听预约(trial-booking/代约) → 到店/未到店 → 跟进(follow-up) → 转化(convert → 新建/合并 Student)
```

### 问题清单
- **[🟡 B-05 同模块三]** 线索转化新建学员字段错乱（见 L-10 / B-05）。
- **[🟡 L-14 归属锁定（owner_lock）规则未全链路贯通]** `types/lead.ts` 定义 `owner_lock_status: 'weak'|'locked'` 与 `first_invite_teacher_id/booking_teacher_id/owner_teacher_id`，但 `data/lead.ts` 中这些字段在预约/转化时的赋值与"弱绑定→锁定"流转需专项走查，避免归属错乱。
- **[💭 试听时段与班级排课去重]** `trial-slot-config` 与 `class-slot-config`/`open-slot-edit` 三套时段配置，是否与 `ClassBookingSlot` 共用同一容量/冲突校验需确认，防止同教室同时段重复开放。

---

## 六、package-settings + package-statistics

### 结构概览
settings 30 文件：campus-settings / campus-detail / venue-list / venue-form / room-form / system-settings / theme-settings / notification-send / feedback / help。statistics 仅 1 页面，数据/组件在 `data/statistics.ts`、`data/mock/statistics-base.ts`、`components/statistics/*`。

### 业务链路
```
校区：campus（机构/校区/薪资模板/科目/节假日/营业时间）
场馆：venue → room(教室, 可开启场地预约)
统计：运营KPI/财务KPI/趋势/排行/预警（mock 派生 + fallback）
```

### 问题清单
- **[🟡 L-15 统计服务 Mock 切换机制与其它服务不一致]** `src/services/statistics.ts:38` 读取 `process.env.VITE_USE_MOCK`，而其余 21 个 service 直接 import mock、无环境分支。生产（`VITE_USE_MOCK=false`）构建下，**只有 statistics 走真 API，其它仍走 mock**——联调切换不统一，易产生"部分真/部分假"的断裂。
- **[🟡 L-16 系统设置存在未实现占位入口]** `src/package-settings/pages/system-settings/index.tsx:59` 注释"未实现入口占位提示"，说明该模块有断链的导航项（点击无对应功能）。
- **[🟡 L-17 统计预警/趋势与业务数据未打通]** `statistics.ts` 的趋势/排行/预警大量来自 `data/mock` 的 `computeXxx` 与静态 `MOCK_*_ALERTS`，与真实业务数据（学员/课包/教师）**无计算关联**，属"展示链路完整但数据来源孤立"。
- **[💭 校区类型漂移]** `types/campus.ts` `CampusType='main'|'self'|'partner'` 与 `mock-database` `Campus.type` 一致；但 `data/teacher.ts` 的 `CAMPUS_OPTIONS` 用 `center/south/east` 值，两套校区标识体系并存，跨模块按 `campusId` 关联时需留意。

---

## 七、pages（主 tabs：首页 / 登录 / 课表 / 档案 / 统计 等）

### 结构概览
58 文件。核心：home / login / schedule / profile / children / my-course / card-data / salary-data / finance-data / member-data / record-transaction / store-entry / statistics / role-switch / about / agreement 等。

### 业务链路（家长/教师双入口）
```
登录/注册 → 角色切换(role-switch) → 首页(home: 今日课表/待办/统计卡)
课表(schedule) ← 排课数据； 我的(my-course/children) ← 学员/课包； 档案(profile)
```

### 问题清单
- 继承 **L-04 时间基准分裂**（首页"今日/本周"用真实 `dayjs()`，mock 数据锚定 2026-06，日期相对展示易空）。
- **[🟡 L-18 门店入驻 → 校区创建链路]** `pages/store-entry` 提交后 `StoreEntryResult.campusId` 由 mock 直接创建，但 `useCampusStore` 的校区列表是否在该操作后自动刷新/纳入 `allowedCampusIds` 需确认，避免"入驻成功却看不到校区"。
- **[💭 多角色数据权限]** `TeacherAccessScope(self/subject/org)` 在首页/课表/统计的过滤是否真正生效，建议走查 `filterSchedulesByActor` 等裁剪函数。

---

## 八、components（公共组件层）

### 结构概览
157 文件，覆盖表单/弹窗/卡片/图表/业务复合组件。

### 问题清单（规范与衔接）
- **[🟡 Q-02 裸 `<Input>` 约 44 处]** 全仓 `grep '<Input'` 显示约 44 处直接裸用 `<Input>`，与 AGENTS.md"输入框必须用 FormInput"铁律冲突（首轮已计为约 40，复核为更多）。
- **[✅ 正向] PickerView 高度规范达标**：全仓 `indicatorStyle` 均为 `px`（无 `rpx`），符合 AGENTS.md 第九铁律。
- **[✅ 正向] 复用基础组件**：BottomSheet / FormInput / Card / ConfirmDialog 等已沉淀，页面基本走组件化；但**业务弹窗封装完整性**建议按标准第八节做一次清单核对。
- **[💭 设计 Token]** 部分页面（如 `student-transfer`、`system-settings`）出现硬编码色值（`#16a34a`/`#f4fffa` 等）而非 `text-primary`/`bg-card` 类，与"禁止硬编码色值"铁律存在偏差。

---

## 九、问题总览（按严重度 + 类别）

| 编号 | 严重度 | 类别 | 问题 | 位置 |
|---|---|---|---|---|
| L-08 | 🔴 | 链路断裂 | 调班 `mockTransferStudent` 空实现，数据零改动 | data/students.ts:1123 |
| L-09 | 🔴 | 链路断裂 | 结束班级 `mockEndClass` 空实现 | data/students.ts:1132 |
| L-02 | 🔴 | 链路断裂 | 统一教师视图硬编码 `status:'active'`，离职/薪资不进班级·学员·统计 | mock-database.ts:672,692 |
| L-03 | 🔴 | 衔接不一致 | 两套教师主数据同 ID 分裂（BASE_TEACHERS vs rawMockTeachers） | mock-database.ts:585 / data/teacher.ts:189 |
| L-04 | 🔴 | 链路断裂 | 时间基准分裂（mock 2026-06 vs teacher/schedule 真实时钟） | mock-database.ts:18 / data/teacher.ts:143 |
| L-01 | 🔴 | 链路断裂 | 跨月 `genMonthSnapshot` 用静态 `mockTeachers`，忽略内存写入 | data/teacher.ts:797 |
| B-01 | 🔴 | 逻辑 bug | `mockExecutePay` 实发金额算法 ≠ `calcTotal` 展示算法 | data/teacher.ts:929 vs store:25 |
| B-05 | 🟡 | 逻辑 bug | 线索转化新建 Student 用 camelCase，字段错乱 | data/lead.ts:1626 |
| L-10 | 🟡 | 衔接不一致 | 双 `CoursePackage` 类型（camelCase 本地 vs snake_case UI），仅靠映射桥接 | mock-database.ts:2357 / types/course-package.ts |
| L-05 | 🟡 | 衔接不一致 | 薪资状态机 文档五态 vs 实现四态，`teacher_confirmed` 孤儿 | types/teacher.ts:31 vs data/teacher.ts |
| L-06 | 🟡 | 链路断裂 | 扣款三方法（store/service/data）全仓无调用方，死链 | stores/teacher.ts:282 |
| L-07 | 🟡 | 衔接不一致 | 薪资调整与扣款双路径（salary-adjust vs DeductionSheet） | salary-adjust vs teacher store |
| B-02 | 🟡 | 逻辑 bug | `getPendingCount` 语义="未归档数"，与"待确认"标签矛盾 | stores/teacher.ts:380 |
| B-03 | 🟡 | 逻辑 bug | 写后重拉不携带 `salaryMonth`，非当前月静默跳回 | stores/teacher.ts:208 等 |
| B-04 | 🟡 | 逻辑 bug | 工资模型切换依赖脆弱 `modelIdx` 下标 | data/teacher.ts:1077 |
| L-11 | 🟡 | 衔接不一致 | 会员卡剩余量与课包剩余课时两套独立，未打通 | data/member-card.ts |
| L-12 | 🟡 | 链路断裂(待核) | 临时调课记录写入/消费链路需核实 | types/temporary-reschedule.ts |
| L-13 | 🟡 | 衔接不一致 | 考勤/课次与课时扣减口径需走查一致性 | package-course ↔ data/students |
| L-14 | 🟡 | 衔接不一致 | 线索归属锁定(weak→locked)全链路赋值需走查 | data/lead.ts |
| L-15 | 🟡 | 衔接不一致 | statistics 的 `USE_MOCK` 切换机制与其余 service 不一致 | services/statistics.ts:38 |
| L-16 | 🟡 | 链路断裂 | 系统设置存在未实现占位入口 | system-settings:59 |
| L-17 | 🟡 | 衔接不一致 | 统计预警/趋势与真实业务数据未计算关联 | data/statistics.ts |
| L-18 | 🟡 | 衔接不一致 | 门店入驻→校区刷新链路需确认 | pages/store-entry |
| Q-01 | 🟡 | 错误处理 | Store 写操作无 try/catch / 无回滚 | stores/* |
| Q-02 | 🟡 | 规范 | 裸 `<Input>` 约 44 处 | 全仓 |
| 💭 | 💭 | 规范 | 部分页面硬编码色值，未用设计 Token | student-transfer 等 |

---

## 十、核心业务流程图（关键链路）

### 1) 教师薪资发放链路（含 2 处断裂）
```
[薪资首页·选月] → fetchTeachers(month)
   └─ confirmSalary(id) → mockConfirmSalary(仅 pending→confirmed)
        └─ getList()            ⚠ B-03 不传 month → 跳回当前月
   └─ sendSalarySlip → mockSendSalarySlip(confirmed→sending)
   └─ executePay → mockExecutePay(sending→archived)
        └─ 写入 payHistory.amount  ⚠ B-01 算法≠calcTotal(展示)
跨月查看：mockGetTeachers(month≠当前) → genMonthSnapshot
        ⚠ L-01 用静态 mockTeachers，忽略 _teachers 写入
统一视图：buildTeacherView → TEACHERS
        ⚠ L-02 硬 status='active'；⚠ L-03 双主数据同ID
```

### 2) 学员调班链路（🔴 断裂在终点）
```
student-transfer/ class-detail → classService.transferStudent(src,dst,stu)
   → services/student.ts:2149 mockTransferStudent
        ⚠ L-08 空实现：不移除源班/不加入目标班/不改 classIds
   → UI 仍提示"调班成功"  ← 数据零改动
（对照：mockRemoveStudentFromClass / mockAddStudentsToClass 均有真实实现）
```

### 3) 线索→学员转化链路（⚠ 字段错乱）
```
lead-detail → convert(conversionType='new_student')
   → mockCreateConversion → 新建 Student
        ⚠ B-05 用 camelCase(teacherId/totalHours/classIds)
           而 STUDENTS/类型 为 snake_case(teacher_id/...) → 脏数据
   → lead.status='converted'（此步正常）
```

### 4) 课包消课链路（✅ 可用，⚠ 双类型风险）
```
lesson-record → mockDeductPackageHours(pkgId,hours)
   → 内部 camelCase(remainingHours) 自洽扣减  ✅
   → mapMockPackage 桥接 snake_case + 'finished'→'completed'  ✅
   ⚠ L-10 双 CoursePackage 类型，新增字段易静默断裂
```

---

## 十一、修复优先级建议（P0→P2）

**P0（合并/上线前必修，均为 🔴）**
1. L-08 / L-09：实现 `mockTransferStudent` / `mockEndClass` 真实双向更新（参考同文件 `mockRemove/AddStudentsToClass`）。
2. L-02 / L-03：统一教师视图按 `_teachers` 真实 `status`/`salaryStatus` 同步，并合并两套教师主数据（以管理库为唯一可写源）。
3. L-04：统一"现在"基准（建议全仓统一用 `dayjs()` 或统一常量，禁止一个文件硬编码 2026-06、另一个用真实时钟）。
4. L-01 / B-01：跨月视图改为读取 `_teachers` 内存态；`mockExecutePay` 金额复用 `calcTotal` 算法。

**P1（本迭代排期，🟡）**
- B-05 线索转化字段命名对齐 snake_case；L-10 收敛双 CoursePackage 类型（删本地定义，全仓统一 `types/course-package`）；L-05 状态机文档与实现对齐并清掉 `teacher_confirmed`；L-06/L-07 接通或删除扣款死链；B-02/B-03/B-04 计数语义与月份携带；L-15 统一 Mock 切换；L-16 实现或移除占位入口；Q-01 补 Store 错误处理。

**P2（质量债）**
- Q-02 收口裸 `<Input`→`FormInput`；硬编码色值→设计 Token；L-11/L-12/L-13/L-14/L-17/L-18 专项走查确认并补回归用例（建议纳入标准 §4.2 的"统一视图字段同步完整性""状态机文档与实现一致性""Mock 切换统一性"三条新增专项检查）。

---

> 一句话结论：**业务逻辑大体可用，但"数据一致性/链路完整性"存在 7 个 🔴 级断裂**，最致命的是调班/结束班级为空实现（用户以为成功、实际没发生）与教师统一视图/薪资的状态不同步；类型层存在"双 CoursePackage / 双教师主数据 / 时间基准分裂"三类结构性衔接不一致，需在 P0 优先收口。

---

## 十二、走查清单专项核验（L-11 / L-12 / L-13 / L-14 / L-17 / L-18）

> 本节对首轮报告中标记为"待走查 / 需核实 / 需确认"的 6 项做**代码级逐行走查**，更新原判定，并给出可执行的优化建议与可度量的验收标准。
> 判定变更说明：原表 L-11~L-18 多为"待核"占位，现据实代码全部刷新——其中 **L-11、L-12、L-14、L-17、L-18 均发现真实缺陷（非"无问题"）**，L-13 走查通过但暴露双扣减路径风险。

### L-11 会员卡剩余量 ↔ 课包剩余课时（原判定：两套独立未打通 → 更新）

**核查方法**：通读 `src/data/member-card.ts`（`mockIssueMemberCard` L251-274、`mockUpdateMemberCard` L165-190）、`src/types/member-card.ts`，并交叉核对课包消费入口 `data/students.ts` 的 `mockCreateLessonRecord`(L941)、`mockDeductPackageHours`(L796) 是否回写会员卡。

**核查结论（更新）**：链路**并非完全断裂**——发卡/改卡时代码确实做了"打通"（向 `COURSE_PACKAGES` 写对应课包）。但存在 3 处真实缺陷，导致"打通"在运行时失效：

- **L-11-A（🔴 衔接断裂·真实）只写不读、单向且事件触发，课后即失同步**：联动仅在"发卡/改卡"时写入 `pkg.remainingHours`；而真正的课时消耗发生在 `mockCreateLessonRecord`/`mockDeductPackageHours`，它们**只改 `COURSE_PACKAGES` 的 `remainingHours`，从不回写会员卡的 `remainingCount`**。于是只要该学员上过一次课，会员卡显示的 `remainingCount` 与课包实际 `remainingHours` 立即分裂，两个"剩余量"从此不再相等。所谓"打通"只是单向建包，未做到双向同步。
- **L-11-B（🟡 脆弱匹配）**：联动靠 `pkg.name.includes('会员卡')` 字符串匹配（L179）。若卡名被编辑、或经非 `mockIssueMemberCard` 路径发卡，匹配失败→静默不联动。
- **L-11-C（🟡 不变量被破坏）**：`mockUpdateMemberCard` 增次时 `remainingHours += diff` 但 `totalHours` 不变（L182-184），导致 `remainingHours` 可 > `totalHours`；随后 `usedHours = max(totalHours - remainingHours, 0)` 被钳为 0，已消课时数被抹掉。

**优化建议**
1. 确立**单一数据源**：课包 `remainingHours` 为权威值，会员卡 `remainingCount` 在每次读取时由"关联课包 remainingHours 之和"派生，而非独立存储后靠事件同步（消除 L-11-A）。
2. 用稳定外键关联：会员卡与课包通过 `memberCardId` 字段关联，删除 `name.includes('会员卡')` 字符串匹配（消除 L-11-B）。
3. 统一剩余/总量不变量：任何对 `remainingHours` 的写操作必须保证 `0 ≤ remainingHours ≤ totalHours`，并对 `usedHours = totalHours - remainingHours` 做单向派生，禁止反算钳零（消除 L-11-C）。

**验收标准（可度量）**
- 单测：发卡→上课 1 次（扣 2 课时）→断言 `会员卡.remainingCount === 课包.remainingHours`，误差 = 0。
- 单测：发卡后把 `remainingCount` 调增 5，断言 `remainingHours ≤ totalHours` 且 `usedHours === 原已消课时`（不被置 0）。
- 重构后全仓 `grep -rn "includes('会员卡')" src/` 返回 0 命中（匹配逻辑已删除）。

---

### L-12 临时调课记录 写入/消费链路（原判定：链路断裂待核 → 更新）

**核查方法**：通读 `src/services/temporary-reschedule.ts`（`saveBatch` L178-223、`getByTeacherAndRange` L147-172）、`src/utils/visible-schedules.ts`（`buildVisibleSchedulesForDate` L19-63）、`src/package-course/pages/batch-reschedule-confirm` 调用点。

**核查结论（更新）**：链路**实际已实现**，非断裂：写入 `saveBatch`→`Taro.setStorageSync`；读取 `getByTeacherAndRange`→`getStorageSync`；消费 `visible-schedules` 按 `source_date` 移除、`target_date` 补入。但发现 2 处真实缺陷：

- **L-12-A（🟡 重调度残留导致双订）**：`saveBatch` 的覆盖键为 `${schedule_id}__${source_date}`（L215-220），只清理"同一来源日"的旧记录。若同一排课曾被 A→B、又从 C→D 两次调动，C→D 记录键 `X__C` 与 A→B 键 `X__A` 不同，两者共存→该课在 B、D 两日同时出现（双订）。
- **L-12-B（🟡 持久化与内存错位）**：临时调课存 `Taro` 本地存储（跨重启保留），而基础排课 `mockScheduleData` 在内存、重启即重置。Mock 模式下重载后，存储里的调课记录指向已消失的 `schedule_id`，`visible-schedules` L41 `if (!originalSchedule) return acc;` 静默丢弃→出现"幽灵调课"/丢失。

**优化建议**
1. `saveBatch` 覆盖键改为 `${schedule_id}`（同一条排课全局唯一），或在写入前先清除该 `schedule_id` 的全部旧记录（消除 L-12-A）。
2. Mock 模式统一数据源形态：临时调课与基础排课同用内存数组（或都落存储并带初始化种子），避免"存储持久 + 内存易失"混用（消除 L-12-B）；消费端对找不到 `originalSchedule` 的记录显式告警而非静默丢弃。

**验收标准（可度量）**
- 单测：对排课 X 先 A→B 再 C→D，断言最终仅在 B、D 之一出现（不双订），且 `getByTeacherAndRange` 返回记录数 = 1。
- 单测：构造指向不存在 `schedule_id` 的调课记录，断言 `buildVisibleSchedulesForDate` 不返回该幽灵项，且日志/计数能体现 1 条被忽略（非静默）。
- `grep -rn "setStorageSync(STORAGE_KEY" src/` 仅 1 处且配套 `getStorageSync` 初始化时与基础排课同源。

---

### L-13 考勤/课次 与 课时扣减口径（原判定：需走查一致性 → 更新）

**核查方法**：通读 `data/students.ts` 两个扣减实现 `mockDeductPackageHours`(L796) 与 `mockCreateLessonRecord`(L941)、`services/student.ts:1654` 的 `deductPackageHours`、`package-student/.../useStudentForm.ts:548` 的 `deductHours`，并核对 `lesson-form` 提交路径（L1414 `lessonRecordService.create`）。

**核查结论（更新）**：课次→扣减**主线一致**。`data/students.ts:11` `COURSE_PACKAGES as DB_PACKAGES`，两套命名指向同一数组；`mockCreateLessonRecord` 自动扣减并 `Math.max(...,0)` 钳底、`remainingHours<=0` 置 `finished`（L959-964），口径正确。但暴露结构风险：

- **L-13-A（🟡 双扣减实现·漂移风险）**：存在两个扣减实现——`mockCreateLessonRecord` 内联扣减（被课次流程使用）与独立 `mockDeductPackageHours`（`services/student.ts:1654` 暴露，疑似无页面调用）。二者逻辑不完全一致（后者不调 `purchasedHours`）。若未来任一课次路径同时触发两者→**重复扣减**。
- **L-13-B（🟡 purchasedHours 语义错误）**：`mockCreateLessonRecord` 把 `purchasedHours` 也减去 `hours`（L960），但"已购课时"不应随消课减少，仅 `remainingHours/usedHours` 应变化，导致后续"购课统计"失真。

**优化建议**
1. 收敛为**唯一**扣减入口：令 `lessonRecordService.create` 为课时扣减的唯一触发点；删除或改造独立 `mockDeductPackageHours`，禁止课次流程二次扣减（消除 L-13-A）。
2. `mockCreateLessonRecord` 扣减时仅改 `remainingHours` 与 `usedHours`，**不动** `purchasedHours`（消除 L-13-B）。
3. `useStudentForm.ts:548` 的 `deductHours`（办卡时预填已用）属"初始化语义"，与"消课扣减"必须是两套明确分离的 API，并在注释中标明边界，避免误复用。

**验收标准（可度量）**
- 单测：对同 1 课包先 `createLessonRecord(2h)` 再 `deductPackageHours(2h)`，断言只扣 2（非 4）。
- 单测：消课 3 课时后，断言 `purchasedHours` 不变、`remainingHours` 与 `usedHours` 增减正确。
- 全仓搜索确认的课次提交流程（lesson-form / class-checkin / lesson-supplement）中，`create` 与显式 `deductPackageHours` 调用**不同时出现**于同一学生提交路径。

---

### L-14 线索归属锁定 weak→locked 全链路（原判定：需走查 → 更新）

**核查方法**：通读 `data/lead.ts` 锁状态写入点（种子 L85/108；`mockCreateLead` L1056、`mockCreateLeadFromInvite` L1116 置 `weak`；`mockCreateLeadBooking` L1290-1297 首次预约置 `locked`）、读取点（L996 卡片返回；`types/lead.ts:76`）、以及更新入口 `mockUpdateLead`(L1153-1159)。

**核查结论（更新）**：`weak→locked` 的**写入路径正确且集中**——所有预约入口（`mockBookTrialByClass` L1304、`mockBatchCreateProxyBookings` L1344）都汇流经 `mockCreateLeadBooking`，首次预约即锁定（L1291-1297）。但发现**关键断裂**：

- **L-14-A（🔴 状态只产不消·无强制）**：`owner_lock_status` 被写入与展示（L996），但**全仓无任何消费/强制逻辑**：`mockUpdateLead` 用 `Object.assign(lead, data)`（L1158）**无任何对 `owner_teacher_id`/`owner_lock_status` 的守卫**。即任何更新调用（含未来"转移线索"功能）都能在 `locked` 状态下直接改写归属，锁定形同虚设。
- **L-14-B（🟡 缺 UI 语义）**：卡片返回了 `owner_lock_status`（L996），但未在 UI 上区分"可改派/已锁定"，前端无法据此禁用转移操作，加剧 L-14-A。

**优化建议**
1. `mockUpdateLead` 对 `owner_teacher_id` 变更加守卫：当 `owner_lock_status === 'locked'` 时拒绝（或要求显式 `forceReassign` 入参），返回明确错误（消除 L-14-A）。
2. 在 `services/lead.ts` 暴露 `reassignLead(leadId, newOwnerId, reason)` 专用方法，内部校验锁定状态并写审计日志，取代任意 `updateLead` 改归属（统一入口）。
3. 前端线索卡片依据 `owner_lock_status` 显隐"转移"按钮，锁定态置灰并 tooltip 说明（消除 L-14-B）。

**验收标准（可度量）**
- 单测：`locked` 线索调用 `updateLead({owner_teacher_id: 'other'})`→返回失败/被忽略，DB 中 `owner_teacher_id` 不变。
- 单测：`weak` 线索同上调用→归属成功变更。
- 单测：`reassignLead` 对 `locked` 传 `forceReassign=true`→成功并记录 `reassign_reason`。
- 前端：锁定线索的"转移"按钮在快照测试中 `disabled` 为 true。

---

### L-17 统计预警/趋势 与 真实业务数据关联（原判定：未计算关联 → 确认并细化）

**核查方法**：通读 `data/statistics.ts`（`MOCK_OPERATION_ALERTS` L115-137、`MOCK_FINANCE_ALERTS` L140-150 静态常量；`mockGetLessonTrend` L152 用 `getVisibleLessonRecords()` 真实数据）、`services/statistics.ts`（L175/219/224/312 直接返回静态常量）。

**核查结论（更新）**：原判定**成立并细化**——预警与趋势**不一致**：

- **L-17-A（🔴 预警为假数据）**：运营/财务预警 `MOCK_OPERATION_ALERTS`/`MOCK_FINANCE_ALERTS` 是**硬编码常量**（`count:5`、固定学员"张小明/李子轩"），经 `services/statistics.ts:175/219/224/312` 原样返回，**完全不读取实时学员/营收数据**。学员课时变化后预警数字与名单纹丝不动。
- **L-17-B（🟡 趋势半真半假）**：`mockGetLessonTrend` 走 `getVisibleLessonRecords()`（真实），但 `MOCK_LESSON_TREND`/`MOCK_INCOME_TREND` 仍由静态 `MONTHLY_STATS` 派生（L64-75）；且 `MONTHLY_STATS` 锚定 2026-06（见 L-04 时间基准分裂），与真实当前月错位。

**优化建议**
1. 预警改为**实时计算**：`getOperationAlerts` 遍历实时学员 `remainingHours`，筛 `≤阈值` 者生成 `details`，`count` = 实际命中数（消除 L-17-A）。
2. 趋势统一以实时聚合为准：移除 `MOCK_*_TREND` 静态常量，由 `getVisibleLessonRecords`/`营收流水` 实时 `groupBy` 月份得出（消除 L-17-B）。
3. 与 L-04 联动：统计的时间窗口须以统一"现在"为基准，禁止依赖 2026-06 种子。

**验收标准（可度量）**
- 单测：把某学员 `remainingHours` 改为 2（≤阈值），断言 `getOperationAlerts` 的 `details` 含该学员且 `count` 随之 +1。
- 单测：`getOperationAlerts` 返回的 `count` 恒等于 `details.length`（消除硬编码 5≠2）。
- `grep -rn "MOCK_OPERATION_ALERTS\|MOCK_FINANCE_ALERTS" src/services/` 返回 0（服务层不再直返静态常量）。

---

### L-18 门店入驻 → 校区刷新链路（原判定：需确认 → 更新）

**核查方法**：通读 `pages/store-entry/index.tsx`（提交 L243-281、成功弹窗"1-3 工作日审核" L268-275）、`services/store-entry.ts:11`、`data/store-entry.ts`（`mockSubmitStoreEntry` L27-52 → `campusService.add` 立即建校区）。

**核查结论（更新）**：链路在**数据层存在、在 UI 层断裂且语义矛盾**：

- **L-18-A（🟡 UI 不刷新·提交即失联）**：`mockSubmitStoreEntry` 确实调用 `campusService.add` 立即创建校区（L45，注释明言"便于立即在校区卡片查看"），但页面提交后只弹"工作人员 1-3 工作日联系"并 `navigateBack`（L273），**不刷新校区列表/store**。用户看不到新建校区，提交如"石沉大海"。
- **L-18-B（🔴 语义矛盾）**：成功文案暗示**异步审核**（申请→人工建校区），而 Mock 实现是**同步立即建校区**。二者语义冲突：真实联调若改回"仅提交申请单"（services/store-entry.ts:13 注释），则 Mock 与真实行为完全相反，且当前 Mock 把"未审核申请"直接落成正式校区，违背业务规则。

**优化建议**
1. 页面提交成功后**主动刷新校区 store**（`campusStore.fetchList()` 或经 `useCampusStore` 拉取），使新建校区即时可见（消除 L-18-A）。
2. 统一"申请 vs 建校区"语义：Mock 也应走"申请单待审核"模型——`mockSubmitStoreEntry` 仅落申请记录（`status:'pending'`），由独立的"审核通过→建校区"动作创建 `campus`，与真实后端一致；并在页面成功态明确区分"已提交/已开通"（消除 L-18-B）。
3. 增加"我的入驻申请"查询入口，避免提交后无回看（可度量地闭环）。

**验收标准（可度量）**
- 集成测试：提交入驻→断言 `campusStore` 列表在提交后包含新校区（或按语义为"待审核申请"记录），无需手动重载。
- 单测：`mockSubmitStoreEntry` 在 Mock 下返回 `status:'pending'` 且不越过审核直接造正式校区（或显式区分两种模式并有开关）。
- 快照：入驻成功弹窗文案与当前数据层行为一致（异步提示↔申请单 / 同步提示↔立即建校区，二者不矛盾）。

---

### 走查后问题总表修订（替代首轮表 L-11~L-18 行）

| 编号 | 严重度 | 类别 | 修订后结论 | 位置 |
|---|---|---|---|---|
| L-11 | 🔴 | 衔接断裂 | 单向联动、课后失同步 + 脆弱名匹配 + 不变量破坏 | data/member-card.ts:177-187,251-274 |
| L-12 | 🟡 | 逻辑 bug | 链路已实现；重调度键过窄致双订 + 存储/内存错位 | services/temporary-reschedule.ts:215-220 |
| L-13 | 🟡 | 衔接风险 | 主线一致；双扣减实现漂移 + purchasedHours 误减 | data/students.ts:796,941,960 |
| L-14 | 🔴 | 逻辑 bug | weak→locked 只写不强制，updateLead 无守卫可随意改归属 | data/lead.ts:1158,1295 |
| L-17 | 🔴 | 衔接断裂 | 预警为硬编码假数据，趋势半真；服务层直返静态 | data/statistics.ts:115-150 |
| L-18 | 🔴 | 衔接断裂 | 数据层建校区但 UI 不刷新 + 异步文案/同步建校区语义矛盾 | pages/store-entry:273 / data/store-entry.ts:45 |

> 走查合计新增/升级：**4 个 🔴（L-11、L-14、L-17、L-18）+ 2 个 🟡（L-12、L-13）**。原首轮 7 个 🔴 维持不变，全项目 🔴 累计 **11 项**。

---

# 十三、工程化质量维度全覆盖核查（用户指定 10 项）

## 13.0 范围确认与本次新增

| 阶段 | 已覆盖维度 | 交付物 |
|---|---|---|
| 首轮 + 走查（前 12 节） | 业务逻辑 bug、业务链路完整性/断裂、数据一致性（双数据源/状态机/类型分裂/时间基准） | CODE_REVIEW_FULL.md 第一~十二节 |
| **本节（第十三节）** | **用户指定的 10 项工程化质量维度**：代码逻辑与边界、错误处理、安全、性能、依赖版本、测试覆盖、配置与环境变量、日志与监控、文档注释、跨平台兼容 | 本章 |

**结论**：前序报告已对"业务正确性"做了全量逐文件排查；本节对"工程健壮性/安全性/可维护性"10 项做了**代码级核查**（Grep 全仓 + 关键文件精读），发现 **3 个新 🔴、若干 🟡**。全项目 🔴 由 11 项升至 **14 项**。

## 13.1 维度核查方法与结论总览

| 维度 | 核查手段 | 是否全量 | 主要结论 | 新发现 |
|---|---|---|---|---|
| A 代码逻辑与边界 | Grep 除零/parseInt/裸索引 + 精读 statistics/auth/teacher 数学热点 | 热点抽样 | 未见系统性边界 bug；聚合/薪资数学缺单测保护 | 🟡 A-01 |
| B 错误处理 | 精读 request.ts；统计 try/catch 分布 | 热点抽样 | 请求层健壮；**缺全局错误边界/未捕获拒绝处理** | 🟡 B-01 |
| C 安全（注入/权限） | Grep eval/dangerouslySetInnerHTML/secret；精读 route-guard/auth | 全量扫描 | 无注入原语；**无授权层（仅鉴权）**；密码明文比对(mock) | 🔴 C-01 / 🟡 C-02,C-04 |
| D 性能/资源 | Grep setTimeout/clearTimeout/useMemo 计数；精读 Dialog/schedule | 计数+抽样 | useMemo 覆盖好；**timer 清理不一致**；无列表虚拟化 | 🟡 D-01,D-03 |
| E 依赖版本 | 精读 package.json | 全量 | Taro 4.1.9 锁定一致；**个别 devDep 版本可疑/冗余** | 🟡 E-01,E-02 |
| F 测试覆盖 | Grep jest/vitest/测试文件/测试脚本 | 全量 | **零自动化测试** | 🔴 F-01 |
| G 配置/环境变量 | 精读 config/index.ts、prod.ts、dev.ts、request.ts | 全量 | **VITE_USE_MOCK 默认 'true'→生产启用 Mock**；BASE_URL 缺省相对路径；源码含散落备份/脚本 | 🔴 G-01 / 🟡 G-02,G-03,G-04 |
| H 日志/监控 | Grep console.*；精读 logger.ts、reportLocalDebug | 全量扫描 | logger 开发门控良好；**~30 文件裸 console 进生产**；无远程监控 | 🟡 H-01,H-02,H-03 |
| I 文档/注释 | 抽查 JSDoc；核对 AGENTS.md 要求 | 抽样 | 类型注释好；**组件 JSDoc 覆盖未验证**；散落 debug 注释 | 🟡 I-01,I-02 |
| J 跨平台兼容 | Grep TARO_ENV/平台分支；核对 build 脚本与 project.tt.json | 全量扫描 | 多端构建脚本齐备；**仅 1 处平台分支，h5/tt 缺 API 守卫** | 🟡 J-01,J-02 |

## 13.2 逐维度详述（发现 + 严重度 + 优化建议 + 可度量验收）

### 维度 A · 代码逻辑与边界条件
- **核查**：Grep `/\s*\w*\.length`、`parseInt(`、`arr[` 全仓无命中；精读 `data/statistics.ts`（聚合）、`data/auth.ts`、`stores/teacher.ts`（薪资数学）。
- **发现 A-01（🟡）**：统计/薪资等数值计算在空集合、`undefined` 字段、`NaN` 输入下缺少防御（如 `Number(userInput)` 未校验、聚合未对 `length===0` 兜底）。未确认具体崩溃点，属"未被单测覆盖的潜在风险"。
- **优化建议**：对 `data/statistics.ts`、`stores/teacher.ts` 的全部数值出口加 `Number.isFinite` 校验与空集合短路；用户输入 `Number()/parseFloat` 处加 `|| 0` 兜底。
- **验收标准（可度量）**：单测覆盖 `calcTotal`/`mockExecutePay`/统计聚合在 `输入=undefined/NaN/空数组/0` 时**返回确定值（非 NaN/非抛异常）**，断言 `Number.isNaN(x) === false`；CI 中加入该用例组，覆盖率 ≥ 80% 行。

### 维度 B · 错误处理与异常捕获
- **核查**：精读 `utils/request.ts`（统一请求层）；统计 `try {` 命中 103 文件、`catch (` 67 文件。
- **发现 B-01（🟡）**：请求层健壮（try/catch + `ApiError` + 401 跳转 + token 过期），但**缺全局错误边界（React ErrorBoundary）与 `unhandledrejection` 监听**；个别页面未包裹异步 try/catch，真实接口异常可能白屏。
- **优化建议**：新增 `ErrorBoundary` 包裹 `app.tsx` 根；在 `request.ts` 顶部加 `Taro`/小程序 `unhandledrejection` 兜底上报告警；服务调用处统一 `.catch` 兜底 UI。
- **验收标准（可度量）**：注入一个必失败请求，断言页面显示错误态而非白屏（E2E 或手动）；`grep -rn "addEventListener('unhandledrejection'" src/` 有命中。

### 维度 C · 安全漏洞（注入与权限校验）
- **核查**：Grep `dangerouslySetInnerHTML|new Function\(|eval\(` → **零命中**（无注入原语，正面）；精读 `utils/route-guard.tsx`、`utils/auth.tsx`、`data/auth.ts`。
- **发现 C-01（🔴 越权/Broken Access Control）**：`route-guard.tsx:116` 判定为 `if (profile || isPublicPage) → 放行`，**仅做鉴权（是否登录），完全无授权（角色/权限）校验**。任何已登录用户（家长/学员/教师/管理员）可通过 URL 直跳任意非公开页。系统虽有 `identities`/`RoleSwitchSheet`/`isParentRole`，但仅用于 UI 切换，无服务端等价或客户端网关守卫。
- **发现 C-02（🟡）**：`data/auth.ts:208` 明文比对 `u.password === password`；mock 可接受，但需确保**生产路径绝不沿用此模式**（必须由真实后端做哈希/加盐校验）。
- **发现 C-04（🟡）**：`BASE_URL` 缺省相对路径 `/api/app/v1`（`request.ts:13`），生产未覆盖则请求地址错误。
- **优化建议**：① 建立 `requireRole(...)` 网关或页面级 `withPermission` HOC，按 `profile.identities/role` 阻断越权页；② 敏感操作（改薪资/删数据）前端二次确认 + 后端强校验；③ 移除明文密码比对，仅保留 mock 桩并加 `USE_MOCK` 守卫注释。
- **验收标准（可度量）**：以"已登录家长"身份 `Taro.navigateTo` 至管理员页（如 `package-teacher/pages/salary-home`），断言被拦截/重定向；越权用例写入 E2E；`grep -rn "password ===" src/data/` 在 `USE_MOCK` 分支外无残留。

### 维度 D · 性能与资源消耗
- **核查**：`useMemo|useCallback` 命中 ~200 文件（覆盖良好，正面）；`setTimeout/setInterval/requestAnimationFrame` 命中 ~200 文件，`clearTimeout/clearInterval` 仅 14 文件；精读 `Dialog`（:38-39 清理正确）、`schedule`（:729/731 ref+cleanup 正确）。
- **发现 D-01（🟡）**：timer 清理**不一致**——核心组件正确，但全局 `set/clear` 比值失衡，提示部分 `useEffect` 内 `setTimeout`（导航/防抖）未清理，存在重渲染/页面切换后的重复回调与内存泄漏风险。
- **发现 D-03（🟡）**：排课周视图、学员列表等**未见虚拟化处理**，大数据量（>50 项）可能掉帧。
- **优化建议**：① 启用 `eslint-plugin-react-hooks` 并对 `useEffect` 内的 timer 做自定义 lint（必须有 cleanup）；② 长列表引入虚拟列表/`onReachBottom` 分页。
- **验收标准（可度量）**：所有 `setTimeout` 出现在 `useEffect` 内的文件，`grep` 对应文件存在 `clearTimeout`/`clearInterval` 清理分支（脚本扫描通过率 100%）；列表页在数据量 ≥100 时帧率无显著下降（手动/性能面板验证）。

### 维度 E · 依赖版本与兼容性
- **核查**：精读 `package.json`；Taro 全家桶锁定 `4.1.9`（一致，正面）。
- **发现 E-01（🟡）**：`eslint-config-prettier: ^10.1.8`、`prettier: ^3.8.4` 版本可疑（主流为 9.x / 3.x 较低补丁），存在安装漂移/依赖解析失败风险。
- **发现 E-02（🟡）**：`@babel/plugin-proposal-class-properties@7.14.5` 在现代 Babel/TS 下冗余，可移除。
- **优化建议**：① 将 devDep 锁定为 registry 已发布的确切版本（`npm ls` 校验）；② 移除冗余 babel 插件；③ CI 用 `npm ci` 保证 lockfile 一致。
- **验收标准（可度量）**：`npm ci` 在干净环境一次成功；`npm outdated` 对 devDep 无 `Invalid`/解析失败；移除插件后 `npm run build:weapp` 仍通过。

### 维度 F · 测试用例覆盖率
- **核查**：Grep `jest|vitest|@testing-library|\.test\.|\.spec\.|__tests__` → **零命中**；`package.json` 无 `test` 脚本、devDependencies 无测试框架。
- **发现 F-01（🔴 质量债）**：**全项目零自动化测试**。薪资算法、调班/结班、线索转化、认证等核心逻辑完全依赖人工回归；与已发现的 🔴 逻辑 bug（L-08/L-09/B-01）形成"高危且无护栏"组合。
- **优化建议**：引入 `vitest` + `@testing-library/react`；优先对 `src/data/*` 纯函数（薪资计算、扣减、转化）与 `stores/*` reducer 写单测；设覆盖率门槛。
- **验收标准（可度量）**：`npm run test` 存在且通过；`data/teacher.ts`、`data/students.ts`、`data/lead.ts` 关键函数行覆盖 ≥ 80%；CI 门禁 `coverage < 60%` 失败。

### 维度 G · 配置文件与环境变量
- **核查**：精读 `config/index.ts:14`、`:37`、`prod.ts`、`dev.ts`、`utils/request.ts`；Glob `.env*` 仅存于 node_modules 测试夹具。
- **发现 G-01（🔴 配置/安全）**：`config/index.ts:14` `const useMock = process.env.VITE_USE_MOCK ?? 'true';` → **未显式传 `VITE_USE_MOCK=false` 时，生产构建注入 `'true'`，Mock 模式被开启**。这与 AGENTS.md「生产模式自动禁用 Mock」及项目记忆完全相反；`prod.ts`/`dev.ts` 均未纠正该默认值。若发布流水线遗漏该变量，线上小程序将使用 Mock 数据 + 相对路径 `BASE_URL`，功能异常或泄露假数据。
- **发现 G-02（🟡）**：`TARO_API_BASE_URL` 缺省 `/api/app/v1`，生产必须覆盖。
- **发现 G-03（🟡）**：项目根无 `.env.example`，环境变量全靠构建期 shell 注入，易漏配。
- **发现 G-04（🟡）**：源码树含散落文件 `src/data/generate-students.js`（生成脚本，可能被打包）、`src/package-course/pages/card-member-list/index.tsx.bak`（备份）。
- **优化建议**：① 将默认改为 `?? 'false'`，或在 `mode==='production'` 且未显式设置时 `throw`/告警阻断构建；② 发布 CI 强制 `VITE_USE_MOCK=false TARO_API_BASE_URL=<真实>`；③ 提交 `.env.example` + 变量清单；④ 清理 `.bak`/脚本散文件。
- **验收标准（可度量）**：不带环境变量跑 `taro build --type weapp`，断言产物内 `VITE_USE_MOCK` 编译为 `'false'`；`ls src/**/*.bak src/data/*.js` 无业务散文件；`.env.example` 存在且列出全部变量。

### 维度 H · 日志记录与监控
- **核查**：Grep `console.(log|warn|error)` 命中 ~30 文件（含 `data/auth.ts`、`services/auth.ts`）；精读 `utils/logger.ts`（门控 `NODE_ENV==='development'`，正面）、`utils/local-debug.ts`（`reportLocalDebug`，由 `TARO_ENABLE_LOCAL_DEBUG` 控制，默认 false，正面）。
- **发现 H-01（🟡）**：~30 文件使用**未门控的裸 `console.*`**，会进入生产包；认证/登录路径的日志存在泄露 PII（手机号/账号）隐患。
- **发现 H-02（🟡）**：devDependencies 无任何 APM/崩溃上报（Sentry/Fundebug 等），生产崩溃不可见。
- **发现 H-03（🟡）**：`// #region debug-point Hx:...` 调试注释散落多文件，需随发布清理。
- **优化建议**：① 全部日志经 `utils/logger`（已门控）或构建期 `babel-plugin-transform-remove-console` 剥离；② 接入轻量错误上报（如 `Taro.onError` + 上报端）。
- **验收标准（可度量）**：生产构建产物 `grep -c "console.log" dist/` 为 0（或仅剩门控 logger）；`package.json` 含错误上报依赖且 `Taro.onError` 有注册。

### 维度 I · 文档与注释完整性
- **核查**：抽查 `components/Dialog`（JSDoc 完整，正面）；对照 AGENTS.md「组件须有使用场景+功能 JSDoc」。
- **发现 I-01（🟡）**：157 个组件，**JSDoc 覆盖率未自动验证**；部分业务组件可能缺场景注释。
- **发现 I-02（🟡）**：`debug-point`/`#region` 调试注释留存，影响可读性。
- **优化建议**：用 `eslint-plugin-jsdoc` 的 `require-jsdoc` 对组件/导出函数做门禁；发布前清理调试注释。
- **验收标准（可度量）**：组件文件 `eslint --plugin jsdoc` 报错数为 0；或脚本统计含 JSDoc 的组件占比 ≥ 90%。

### 维度 J · 跨平台/浏览器兼容性
- **核查**：Grep `TARO_ENV` 全仓**仅 1 处**（`utils/privacy.ts:24`）；`package.json` 含 weapp/h5/tt/alipay/rn/... 构建脚本，`project.tt.json` 表明 tt 为目标。
- **发现 J-01（🟡）**：多端构建齐备，但**仅隐私一处平台分支**，对 `Taro.chooseMedia`/`getRecorderManager`/canvas/`getMenuButtonBoundingClientRect` 等平台差异 API 缺守卫；若发布 h5/tt，存在运行时缺口。
- **发现 J-02（🟡）**：`request.ts` 用 `Taro.request`（跨端 OK），但业务组件可能直接调用 weapp-only API。
- **优化建议**：对每处原生 API 增加 `process.env.TARO_ENV` 分支或能力检测；h5/tt 各跑一次冒烟。
- **验收标准（可度量）**：`grep -rn "Taro\.\w*(" src/` 中每个原生 API 调用点，要么有 `TARO_ENV` 守卫，要么在 `docs/cross-platform.md` 标注"仅 weapp"。

## 13.3 仍可能遗漏 / 尚未全量验证的检查项（必须明示）

以下为用户要求的"可能存在但被遗漏项"清单——**本节已识别其存在，但受限于无测试脚手架/抽样方式，未做到 100% 走查**，列为后续专项：

1. **A-逐函数边界单测**：薪资/统计数学仅热点抽样，未逐函数证明无 `NaN`/越界（依赖 F-01 落地后补）。
2. **B-全页面 try/catch 一致率**：仅确认存在性，未逐页量化"未捕获异步"比例。
3. **C-越权的具体资产清单**：C-01 已证"无授权层"，但未枚举"哪些页/接口本应受限"（建议结合权限矩阵补清单）。
4. **D-200 处 setTimeout 全量清理审计**：仅抽样确认核心组件正确，未逐文件扫描剩余 ~186 处。
5. **J-h5/tt 运行时 API 审计**：当前仅 weapp 为目标验证，h5/tt 未实跑。
6. **网络层**：`request.ts` 超时硬编码 10s、无重试/无 abort（边缘场景未验证）。
7. **本地化/i18n**：全项目假设中文单语，无 i18n 框架；多区域需求未验证。
8. **无障碍 a11y**：小程序无障碍属性未评估。
9. **Mock→真实后端 数据迁移/版本化**：schema 演进与兼容策略未验证。
10. **Zustand 并发/竞态**：高频 mutation 下的状态竞态未形式化分析。
11. **隐私合规范围**：`privacy.ts`/`PrivacyPopup` 存在，但"收集字段—告知—撤回"闭环范围未全量核对。

> 以上 11 项**非"未发现"，而是"已识别但未全量走查"**——请在排期时作为独立专项闭环，避免遗漏。

## 13.4 本维度新增问题汇总表

| 编号 | 维度 | 严重度 | 问题 | 位置 |
|---|---|---|---|---|
| C-01 | 安全/权限 | 🔴 | 无授权层，仅鉴权；任意登录用户可直跳任意页 | utils/route-guard.tsx:116 |
| F-01 | 测试 | 🔴 | 零自动化测试 | package.json（无 test/devDep） |
| G-01 | 配置/环境 | 🔴 | VITE_USE_MOCK 默认 'true'，生产可能启用 Mock | config/index.ts:14,37 |
| A-01 | 逻辑/边界 | 🟡 | 数值计算缺 NaN/空集合防御 | data/statistics.ts、stores/teacher.ts |
| B-01 | 错误处理 | 🟡 | 缺全局错误边界/未捕获拒绝处理 | app.tsx / utils/request.ts |
| C-02 | 安全 | 🟡 | mock 明文密码比对（切勿进生产） | data/auth.ts:208 |
| C-04 | 安全/配置 | 🟡 | BASE_URL 缺省相对路径 | utils/request.ts:13 |
| D-01 | 性能 | 🟡 | timer 清理不一致（内存泄漏风险） | 全仓 useEffect setTimeout |
| D-03 | 性能 | 🟡 | 长列表无虚拟化 | 排课/学员列表页 |
| E-01 | 依赖 | 🟡 | eslint-config-prettier/prettier 版本可疑 | package.json:97,108 |
| E-02 | 依赖 | 🟡 | 冗余 babel class-properties 插件 | package.json:80 |
| G-02 | 配置 | 🟡 | TARO_API_BASE_URL 缺省相对路径 | config/index.ts:15 |
| G-03 | 配置 | 🟡 | 无 .env.example，易漏配 | 项目根 |
| G-04 | 配置/整洁 | 🟡 | 源码散落 .bak/生成脚本 | src/.../index.tsx.bak、src/data/generate-students.js |
| H-01 | 日志 | 🟡 | ~30 文件裸 console 进生产（PII 风险） | data/auth.ts、services/auth.ts 等 |
| H-02 | 监控 | 🟡 | 无远程错误上报/APM | devDependencies |
| H-03 | 日志/整洁 | 🟡 | debug-point 调试注释散落 | 多文件 |
| I-01 | 文档 | 🟡 | 组件 JSDoc 覆盖未验证 | 157 组件 |
| I-02 | 文档/整洁 | 🟡 | 调试注释未清理 | 多文件 |
| J-01 | 跨平台 | 🟡 | 仅 1 处平台分支，h5/tt 缺 API 守卫 | utils/privacy.ts:24 |
| J-02 | 跨平台 | 🟡 | 业务组件可能直调 weapp-only API | 各页面 |

## 13.5 全局 🔴 累计更新

- 首轮业务维度：7 个 🔴
- 走查维度（第十二节）：+4 个 🔴（L-11/L-14/L-17/L-18）
- **本节工程维度：+3 个 🔴（C-01 越权、F-01 零测试、G-01 Mock 默认开）**
- **全项目 🔴 累计 = 14 项**。其中 G-01、C-01 属"生产环境直接风险"，建议与首轮 L-08/L-09（空实现）同列 P0 优先收口。

---

# 第十五节 前后端联调专项审查建议

> 背景：项目即将进入**前后端联调阶段**。本节聚焦"联调能否跑通、会踩哪些坑"，把前序所有 🔴 问题映射到联调时间线，并给出**联调前的 Go/No-Go 阻塞清单**与**可直接打印的 CheckList**。
> 核查方法：全仓 `grep VITE_USE_MOCK` 开关矩阵（2026-08-22 实测）、精读 `utils/request.ts`、比对 `services/*.ts` 真实分支覆盖率、检索 swagger/openapi 契约文件。

## 15.1 联调就绪度总评

**好消息（不用从零开始）：**
- `utils/request.ts` 已具备生产级骨架：自动注入 `Bearer` token、401 清 session + 跳登录、`{code,data,message}` 错误信封解析、10s 超时、网络错误兜底。真实接口走 `get/post/put/del` 即可复用。
- 22 个 Service 中，**17 个已预留 `VITE_USE_MOCK !== 'false'` 双分支**，真实路径确实调用 `request()` → 大部分模块联调切换成本可控。

**坏消息（致命，联调前必须清零）：**
- `teacher.ts`、`lead.ts` 两大**最核心业务模块完全没有真实接口分支**，Service 层直接调 mock；`teacher.ts:3` 注释明写 *"定义接口契约，当前由 mock 实现，联调时替换为 request 调用"* → **真实后端调用尚未编写**（见 §15.2 P0-1）。
- `config/index.ts` 默认 `VITE_USE_MOCK ?? 'true'` → 生产若未显式关闭会带 Mock 上线（G-01）。
- 时间基准分裂（L-04）、双类型/双主数据（L-02/L-03/L-10）、空实现桩（L-08/L-09）等历史问题会在联调期**集中爆发**。

## 15.2 🔴 P0 —— 联调前必须清零的阻塞项（Go/No-Go）

### P0-1【最大阻塞】核心模块真实接口未接通
- **事实**：22 个 service 中，`teacher.ts`、`lead.ts`、`onboarding.ts`、`store-entry.ts` 无 `VITE_USE_MOCK` 分支，直接调 mock；`teacher.ts:3` 注释"联调时替换为 request 调用"。
  ```bash
  grep -rL "VITE_USE_MOCK" src/services/*.ts
  # → src/services/index.ts(仅re-export) / lead.ts / onboarding.ts / store-entry.ts / teacher.ts
  ```
- **风险**：联调切真实后端时，这 4 个模块仍走 mock 或静默无后端路径；**更隐蔽的是**：若全局关 Mock，teacher/lead 继续喂 mock 数据而其他模块走真实 → **跨模块数据不一致**（如教师列表来自 mock、班级来自真实后端）。
- **建议**：以 `request.ts` 的 `get/post/put/del` 为唯一出口，为缺分支的 Service 补齐 `if(USE_MOCK) mock else request` 双实现，真实分支必须真正发 HTTP。建立"Service 开关矩阵"逐文件核对。
- **验收**：① `grep -L VITE_USE_MOCK src/services/*.ts` 除 `index.ts` 外为空；② `VITE_USE_MOCK=false` 启动，teacher/lead 页面能从真实 `BASE_URL` 拉到数据；③ 联调环境 teacher 列表条数与后端 DB 一致。

### P0-2 接口契约未对齐（字段命名 + 成功码）
- **事实**：mock 用 camelCase（`studentId`/`remainingHours`），types 用 snake_case（`student_id`/`remaining_hours`），靠 `mapMockPackage` 等桥接；全仓**无 swagger/openapi 合同**（仅 `docs/todo/05-api-migration.md` 有迁移计划）。`request.ts:116` 同时接受 `code===0||200`。
- **风险**：联调第一周必崩在字段名大小写 / 嵌套结构；成功码若后端只返一种，另一种会被误判为业务错误。
- **建议**：联调前拉后端 OpenAPI；在 Service 层统一做"响应→前端类型"反序列化（收口到 `request.ts` 的 `data` 转换），不要散落页面；与后端确认统一成功码（0 还是 200）及错误 `message` 是否面向用户。
- **验收**：① 任一接口真实响应经映射后 `npm run typecheck` 无隐式 any/缺字段；② 字段名大小写与后端契约 100% 对照表存档。

### P0-3 空实现 / 桩函数（L-08/L-09 重申）
- **事实**：`mockTransferStudent`(students.ts:1123)、`mockEndClass`(students.ts:1132) 为空实现却 `return true`，UI 提示"成功"。
- **风险**：联调时若后端也还没接口，数据链直接断；若前端不禁用入口，用户以为成功实际没发生。
- **建议**：联调前二选一并存档——(a) 补真实调用；(b) 入口禁用 + "暂未开放"文案。
- **验收**：联调环境调班/结束班级在后端 DB 产生对应记录，或前端入口明确置灰。

## 15.3 🟡 P1 —— 联调中重点验证项

| 编号 | 维度 | 验证点 | 验收标准 |
|---|---|---|---|
| P1-1 | 时间基准(L-04) | 以**后端服务器时间**为唯一基准，`dayjs()` 不自带 NOW | 切换系统时间，薪资月/课表周视图不漂移 |
| P1-2 | 统一视图(L-02/L-03) | `buildTeacherView` 硬编码 `status:'active'`，真实数据下字段同步 | 导入 `status!=='active'` 教师，统一视图字段完整 |
| P1-3 | 鉴权/授权(C-01) | `request.ts` 有 token+401（好）；无授权层（URL 直跳） | 低权限账号调高权限接口返回 403/空数据 |
| P1-4 | 错误透传(B) | 非 2xx 统一转"网络异常"，后端业务错误 `message` 需透传 | 构造后端业务错误，前端 toast 显示原文 |
| P1-5 | 网络/超时(D) | `TIMEOUT=10000` 固定、无 retry/abort；卸载时 setState 可能崩 | 弱网>10s 有提示；页面快进快出不崩溃 |
| P1-6 | 并发 | 小程序并发请求上限≈10，批量接口需分批 | 批量确认薪资等不触发"并行请求过多" |

## 15.4 🟢 P2 —— 联调收尾 / 质量债

- **P2-1** Mock 默认开(G-01)：CI 校验生产构建 `VITE_USE_MOCK=false` 且 `BASE_URL` 指向真实后端；发布前 `grep -c` 确认无 mock/console 泄漏。
- **P2-2** 日志/监控(H)：联调期保留 `reportLocalDebug`，上线关闭；沉淀"联调问题追踪表"。
- **P2-3** 契约测试(F-01)：补最小契约测试，把后端真实响应样例喂给 `mapMockPackage`/`normalizeSalaryStatus` 确保不崩。
- **P2-4** 跨平台(J)：当前 weapp；若上 h5/tt 各自核对 API 可用性（`Taro.request` 在 h5 为 fetch、weapp 为 wx.request）。

## 15.5 联调前 CheckList（可直接打印）

| # | 项目 | 是否过关 | 验证方式 |
|---|---|---|---|
| 1 | 所有 Service 双分支（除 index） | ☐ | `grep -L VITE_USE_MOCK src/services/*.ts` 为空 |
| 2 | 后端 OpenAPI 契约到位 | ☐ | 文档链接 + 字段对照表 |
| 3 | 字段命名对照表(camel/snake) | ☐ | Service 层映射通过 typecheck |
| 4 | 空实现桩函数已处理 | ☐ | 调班/结束班级有记录或入口禁用 |
| 5 | 时间基准统一（后端为准） | ☐ | 切换系统时间不漂移 |
| 6 | Mock 默认关 + BASE_URL 正确 | ☐ | 生产构建 `VITE_USE_MOCK=false` |
| 7 | 401 / token 刷新联调 | ☐ | 过期后自动跳登录且可续 |
| 8 | 错误文案透传 | ☐ | 业务错误显示后端 message |
| 9 | 权限 / 数据过滤 | ☐ | 越权接口返回 403/空 |
| 10 | 性能 / 并发压测 | ☐ | 批量操作不报并发上限 |

## 15.6 一句话建议

> **联调最大的坑不是业务逻辑 bug，而是"Mock 即实现"**：teacher/lead 两个核心模块的真实接口还没写、时间基准和字段命名还分两套。进联调前请先完成 **「开关矩阵 + 接口契约」** 两项，否则会陷入"一会儿 mock 数据、一会儿真实数据"的诡异不一致，且 teacher/lead 在真实环境直接拿不到数据。

## 15.7 与既有 🔴 的映射

| 既有 🔴 | 在联调阶段的表现 |
|---|---|
| L-08/L-09 空实现 | 调班/结束班级在真实后端无记录 |
| L-02/L-03 双主数据/硬编码状态 | 真实教师数据进统一视图字段错位 |
| L-04 时间基准分裂 | 薪资月/周视图查询错位、查不到 |
| L-10/L-11 双类型/会员卡脱节 | 真实课包字段映射丢字段 |
| B-01 薪资算法不一致 | 真实发放金额与展示不符，财务对账 |
| G-01 Mock 默认开 | 生产带 Mock 上线，全员看到假数据 |
| C-01 越权 | 任意登录用户可 URL 直跳任意页 |

