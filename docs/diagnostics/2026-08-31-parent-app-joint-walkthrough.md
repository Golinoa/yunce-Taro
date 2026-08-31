# 家长端前后端联合走查报告

> **走查日期**：2026-08-31  
> **走查范围**：`yunceTaro` 家长端（角色 `parent`）全链路原子页 + `yunce-backend` 对应接口  
> **走查方法**：基于源码静态走查（路由守卫、页面交互、Service/Mapper、后端 routes/validator），**禁止猜测**；每条结论附代码位置  
> **角色口径**：见 `docs/role-visibility-matrix.md` §2.4 / §3；权威入口为三 Tab + 金刚区 +「我的」网格  
> **结构说明**：仓库**无**独立 `package-parent`；家长页散落在主包与 `package-auth` / `package-student` / `package-course` / `package-settings` / `package-lead`  
> **路径百分百补全**：[2026-08-31-parent-app-path-coverage-appendix.md](./2026-08-31-parent-app-path-coverage-appendix.md)（`app.config` **123/123** 页可达性矩阵 + 完整跳转树 + query 分支 + 负向深链）

---

## 0. 结论摘要

| 维度 | 判定 |
|------|------|
| 业务逻辑符合性 | **部分符合**。机构绑定、首页聚合、班课自助约、请假提交、消课只读主路径可通；约课四态/私教约/评价/卡包入口与产品语义偏离 |
| 合理性 | **中等风险**。「我的卡包」误跳「我的课程」；成长档案列表不进详情（profile-edit 反可进）；排行榜/积分占位仍展示 |
| 功能完整性 | **缺口明显**。我的课程四态、私教家长约、补课、场地预约、邀请码展示、课包列表权限、评价提交、资料页「添加子女」未打通或仅本地 |
| 阻塞性问题 | **存在**。场地契约错位；课包 PARENT 403；邀请码自造；添加子女 `POST /students` 仅 TEACHER；深链越权面大 |
| 性能瓶颈 | **存在隐患**。上课记录/作业点评多孩全量拉取；课表家长重复 `getByParent`；请假页过重预取 |
| 前端工程化 | **有缺口**。`hideForParent` ≠ 守卫；多页缺登录守卫；P-深链写操作页未进矩阵 |
| 测试完备性 | **不足**。家长业务页接近零测试；无 E2E；仅首页聚合/金刚区常量有单测 |
| 路径覆盖 | **附录已穷尽 123 注册页**；主报告覆盖 P-入口原子页；断链/深链/负向见附录 A1/A6 |

**问题统计**：阻塞 8 / 严重 11 / 一般 16 / 建议 8（见第六节清单；含附录增量 B8/S11/G13–G16）

**已打通主链路（可联调）**：`POST /organization/bind`、`GET /home/parent`、`GET /students`（家长绑定范围）、`POST /leave-requests`、`GET /lesson-records`、`GET /schedules`、`POST /class-booking/slots/:id/records`

---

## 1. 走查边界与入口地图

### 1.1 家长端可见 Tab

| Tab | 路径 | 家长可见 | 依据 |
|-----|------|----------|------|
| 首页 | `/pages/home/index` | ✓ | `custom-tab-bar/index.tsx` `buildTabList`：非 admin/principal 不渲染「数据」 |
| 课表 | `/pages/schedule/index` | ✓ | 同上 |
| 数据 | `/pages/statistics/index` | ✗ | Tab 不渲染 + `PAGE_ROLE_REQUIREMENTS` = Manager |
| 我的 | `/pages/profile/index` | ✓ | `!isStaffRole` 走家长视图 |

### 1.2 首页金刚区（家长）

来源：`constants/home-ui.ts` L9-57 + `KingKongSection.handleNavigate`

| 交互元素 | 预期跳转/行为 | 实际（代码） |
|----------|---------------|--------------|
| 请假调课 | 请假申请页 | → `/package-course/pages/leave-request/index` |
| 我要约课 | 课表 Tab | → `/pages/schedule/index`（`switchTab`） |
| 我的课表 | 页内锚点 | → `#parent-schedule` → `handleParentAnchor`（`home/index.tsx`） |
| 我的课时 | 页内锚点 | → `#parent-hours` |
| 上课记录 | 消课列表 | → `/package-course/pages/records/index` |
| 课后作业 | 学习反馈·作业 | → `parent-lesson-notes?type=homework` |
| 课堂点评 | 学习反馈·点评 | → `parent-lesson-notes?type=comments` |
| 成长档案 | 孩子列表 | → `/package-student/pages/children/index` |

### 1.3 「我的」页家长区块

来源：`pages/profile/index.tsx`

| 区块 | 入口 | 预期 | 实际 |
|------|------|------|------|
| 头部设置 | 齿轮 | 编辑资料 | → `profile-edit`（L303-305） |
| 孩子卡片 | 0 孩 / 有孩 | 绑定 / 成长档案 | 0 孩→绑定 Sheet；有孩→`children`（L308-315） |
| 约课四态 | 已预约/排队/待评价/已取消 | 我的课程对应 Tab | → `my-course?tab=`（L490-511） |
| 我的卡包 | 课包/卡包页 | **误跳** `my-course` | L519-522 |
| 排行榜 / 积分中心 | 业务页 | **Toast 占位** | `handlePlaceholder` L525-537 |
| 课程足迹 | 上课记录 | → `records` | L530-532 ✓ |
| 使用帮助 / 客服 / 消息 / 账号设置 | 对应页 | 均有真实路由 | L547-565 ✓ |
| 核心数据四列 | 真实统计 | **恒为 0** | `parentStats` L571-578 |

### 1.4 绑定 / 身份入口

| 入口 | 路径 | 用途 |
|------|------|------|
| 身份选择「绑定机构」 | `parent-onboarding` | 学员邀请码绑定（**现行主路径**） |
| 新用户完善资料 | `profile-setup` → `identity-select` | `navigateAfterAuth` |
| 老家长未绑定 | `onboarding` → `parent-onboarding` | `needsOnboarding` |
| 教师分享链接 | `parent-bind?studentId&token=` | 公开页绑定学员 |
| 课表/课程分享落地 | `invite-landing` | PUBLIC；Staff 拦截 |
| 注册选家长（遗留） | `register/role-select` → `role-info` | **现行邮箱注册不进入**（断链） |
| 新增身份「我是家长」 | `role-switch/add-role` | 多身份深链；Sheet 无打开入口 |

### 1.5 路径覆盖索引（百分百）

完整 **123 页矩阵、跳转树、query 分支、冒烟清单** 见附录，勿仅依赖本节入口表：

→ [parent-app-path-coverage-appendix.md](./2026-08-31-parent-app-path-coverage-appendix.md)

分类速查：`P-入口` / `P-公开` / `P-深链` / `P-拦截` / `P-断链` / `P-隐藏入口`。

---

## 2. 原子页走查记录

> 每页格式：**走查路径 / 预期 / 实际结果**。交互按钮尽可能穷尽；表单另列字段对齐。

### 2.1 首页 `pages/home/index`（家长）

| 项 | 内容 |
|----|------|
| **走查路径** | 登录家长身份 → Tab「首页」 |
| **预期** | 金刚区、今日课表、课时卡包、消息入口可用；数据按绑定孩子聚合 |
| **实际结果** | `isParentRole` → `KingKongSection variant="grid"` + `ParentScheduleSection` / `ParentHoursSection`。数据：`homeService.getParent(profile.id)`（约 L362-375）；真接口 `GET /home/parent`（`services/home.ts` L1149-1153） |

**交互核对**

| 元素 | 预期 | 实际 |
|------|------|------|
| 铃铛 | 消息中心 | → `notifications`（约 L823-825） |
| 校区卡片 | 切换校区 Sheet | `CampusSelectSheet` ✓ |
| 金刚区 8 格 | 见 §1.2 | 与 `PARENT_HOME_QUICK_ENTRIES` 一致 ✓ |
| 「去课表看看」/课表卡 | 课表 Tab | `ParentScheduleSection.handleGo` → `switchTab` schedule |
| 「去续费与查账」/「查看卡包」 | 孩子课包 | → `child-detail?tab=packages` 或 `children`（`ParentHoursSection`） |
| `RoleSwitchSheet` | 可切换身份 | **无打开入口**：`roleSheetVisible` 从未 `set(true)` |

**前后端**：`GET /home/parent` 主体已打通；`recentRecords` 后端有、前端未消费（`home.service.ts` vs FE mapper）。

---

### 2.2 课表 `pages/schedule/index`（家长）

| 项 | 内容 |
|----|------|
| **走查路径** | Tab「课表」→ 班课/团课/私教/场地 |
| **预期** | 仅看绑定孩子班级；可请假；团课/私教可约；无排课 FAB |
| **实际结果** | 班级：`studentService.getByParent` → `parentClassIds` 过滤（约 L505-527、L747-749）。班课「请假」→ `leave-request?studentId&lessonKey&classId`（约 L2228-2253）。排课 FAB：`{!isParent && DraggableFab}`（约 L3630-3648）✓ |

**关键交互**

| 元素 | 预期 | 实际（代码） |
|------|------|--------------|
| 班课请假 | 请假页带参 | navigateTo leave-request ✓ |
| 团课预约 | 写入后端约课 | `classBookingService.addBookingRecord` + `upsertParentBooking`（约 L2519-2577）— **双写本地** |
| 团课取消 | 取消约课 | `handleParentCancelOpenSlot` + `removeBookingRecord` |
| 团课详情 | 预约详情 | → `booking-record-detail` |
| 私教 Tab | 选时段约课 | `TrialBookingView isParent` → `trial-slot-config?from=parent` |
| 场地卡 | 场地预约 | → `venue-booking?roomId=` |

**数据打通**：班课约 `POST /class-booking/slots/:id/records` **已打通**；本地 `parent-bookings` 另存一份（`utils/parent-bookings.ts`）。私教家长约 **仅本地**（见 §2.15）。

---

### 2.3 我的 `pages/profile/index`（家长）

| 项 | 内容 |
|----|------|
| **走查路径** | Tab「我的」 |
| **预期** | 孩子、约课、服务、设置入口正确；统计真实 |
| **实际结果** | `!isStaffRole` 家长视图；孩子列表 `getByParent`（L124-139）；统计 **写死 0**（L571-578） |

**交互核对**：见 §1.3。额外：

| 元素 | 预期 | 实际 |
|------|------|------|
| 绑定 Sheet 确认 | 邀请码绑定孩子 | `findByInviteCode` + `bindParent`（L192-234）— **二者真环境恒 mock**（`student.ts` L1682-1685） |
| RoleSwitchSheet | 切换身份 | **无打开入口**（同首页） |
| 公众号卡片 | 关注引导 | `false &&` 隐藏（约 L641） |

**阻塞/严重**：卡包错链（L522）；绑定 Sheet 依赖未接真接口的 `findByInviteCode`/`bindParent`（与 onboarding 的 `organizationService.bind` 不是同一路径）。

---

### 2.4 我的课程 `package-course/pages/my-course`

| 项 | 内容 |
|----|------|
| **走查路径** | 我的 → 已预约/排队/待评价/已取消；或金刚区相关 |
| **预期** | 四态列表来自服务端；可取消、评价、看详情 |
| **实际结果** | `myCourseService.getList`：Mock 走 mock；**非 Mock 仅 `readParentBookings` 本地 storage**（`services/my-course.ts` L59-65）。**无 HTTP API** |

| 元素 | 预期 | 实际 |
|------|------|------|
| Tab 切换 | 按状态筛 | 本地 `setActiveTab` ✓ |
| 取消预约/排队 | 调后端取消 | Mock 有 mockCancel；非 Mock 仅 `updateParentBookingStatus`（L68-75） |
| 查看详情 | 预约详情 | → `booking-record-detail?id=` ✓ |
| 去评价 → 提交 | 写入评价 API | **`setTimeout` 模拟**；状态改为 `booked`（`my-course/index.tsx` L226-240） |

**阻塞**：生产态「我的课程」与后端无契约；评价未持久化且状态回写语义可疑（待评价→booked）。

---

### 2.5 请假调课 `package-course/pages/leave-request`（家长申请）

| 项 | 内容 |
|----|------|
| **走查路径** | 首页金刚区「请假调课」/ 课表班课「请假」 |
| **预期** | 选孩子、类型（请假/调课）、原课、原因；提交成功；调课可选目标课 |
| **实际结果** | 家长表单分支；提交 `leaveService.create`（约 L315-328） |

**表单字段对齐**

| 前端字段 | 校验 | 提交映射 | 后端 Zod | 对齐 |
|----------|------|----------|----------|------|
| `studentId` | 必填 | `studentId` | ✓ | ✓ |
| `leaveType` | leave / reschedule | `type` | `leave\|reschedule` | ✓（提交） |
| `selectedLesson` → date | 必填 | `startDate`/`endDate` | ✓ | ✓ |
| `reason` | trim 必填，max 200 | `reason` | ✓ | ✓ |
| `targetLesson` → `newDate` | 调课必填 | `newDate` | ✓ | ✓ |
| `parent_id` / `teacher_id` | — | **未进 POST body** | 后端自取上下文 | 可接受 |

**UI 分叉**：非 Mock 仅展示「请假」；点调课 Toast「真实联调阶段暂不支持调课申请」（L629-644）。Mock 可走调课并调用 `makeupBookingService.create`（**无后端 makeup 路由**，写本地）。

**列表回显缺口**：`mapBackendLeave` **写死** `type: 'leave'`，不消费后端 `type`/`newDate`（`student.ts` L1378-1394）→ 调课申请即使写入库，列表侧会丢类型。

---

### 2.6 上课记录 `package-course/pages/records`（家长）

| 项 | 内容 |
|----|------|
| **走查路径** | 金刚区「上课记录」/ 我的「课程足迹」 |
| **预期** | 查看全部绑定孩子的消课记录；可进课节详情 |
| **实际结果** | `getByParent` 后，无 `routeStudentId` 时 **只拉第一个孩子** `getByStudent`（`records/index.tsx` L117-121）。家长无学员筛选条（`isTeacher &&`） |

| 元素 | 预期 | 实际 |
|------|------|------|
| 本周/本月/全部/自定义 | 日期筛 | 前端滤 ✓ |
| 记录点击 | 课节详情 | `navigateToLessonDetail` ✓ |
| 多孩记录 | 全部聚合 | **仅第一孩** — 功能不完整 |

**前后端**：`GET /lesson-records?studentId` 对 PARENT **已打通**（读）。

---

### 2.7 预约详情 `package-course/pages/booking-record-detail`

| 项 | 内容 |
|----|------|
| **走查路径** | 我的课程 → 查看详情；课表团课「详情」 |
| **预期** | 展示服务端预约详情；取消/状态变更打后端 |
| **实际结果** | 数据源 `readParentBookingById`（本地 storage）；快捷操作多依赖 `updateParentBookingStatus` / `notificationService.send` |

**严重**：整页无后端 GET；履约状态仅本地，与 `class-booking` 真约可能不一致。

---

### 2.8 学习反馈 `package-course/pages/parent-lesson-notes`

| 项 | 内容 |
|----|------|
| **走查路径** | 金刚区「课后作业」/「课堂点评」 |
| **预期** | 按 type 列出绑定孩子的作业或点评；点进课节 |
| **实际结果** | `getByParent` + 各孩 `lessonRecordService.getByStudent`；滤 `homework` / `performance`（约 L56-64）；点击 → `lesson-detail?id=` |

**前后端**：读路径 **已打通**。无独立 notes API。教师写入路径若未传 `performance`/`homeworkImages`，则家长侧可能长期为空（见教师端报告消课写入契约）。

---

### 2.9 课节详情 `package-course/pages/lesson-detail`（家长只读）

| 项 | 内容 |
|----|------|
| **走查路径** | parent-lesson-notes / records → `?id=` |
| **预期** | 只读教学内容、点评、作业；无教务写操作 |
| **实际结果** | 展示 `performance`/`homework`；「编辑课时」仅 Manager、「撤销消课」仅 Teacher（约 L767、L782）。家长靠 `isStaffRole` 隐藏写按钮 ✓ |

---

### 2.10 场地预约 `package-course/pages/venue-booking`

| 项 | 内容 |
|----|------|
| **走查路径** | 课表 → 场地卡 |
| **预期** | 选日/时段/人数 → 创建预约（家长可自助） |
| **实际结果** | 页内无角色分支；提交 `venueBookingService.createBooking`（约 L209-243） |

**前后端对照（阻塞）**

| FE path | BE 实际 | 问题 |
|---------|---------|------|
| `GET /venue-booking/venues` | `GET /venues`（无 PARENT 创建权） | 路径错位 + 角色 |
| `POST /venue-booking/bookings` body 含 peopleCount/unitPrice | `POST /venues/bookings` body=`venueId,roomId,date,startTime,endTime,purpose?`；角色 PRINCIPAL/TEACHER | 路径+字段+角色 |
| `GET /venue-booking/bookings/my` | `GET /venues/bookings/my`（含 PARENT） | 仅此前缀接近，FE 仍错前缀 |

证据：`services/venue-booking.ts` L14-98；`yunce-backend` `routes/index.ts` 挂载 `/venues`；`venue.routes.ts`。

---

### 2.11 成长档案列表 `package-student/pages/children`

| 项 | 内容 |
|----|------|
| **走查路径** | 金刚区「成长档案」/ 我的孩子卡片 |
| **预期** | 绑定孩子列表；点卡片进详情；可邀请亲属 |
| **实际结果** | `getByParent`（约 L49）；**卡片不跳转 `child-detail`**；邀请亲属为复制邀请码 Modal，注释「占位」（L63-77） |

| 元素 | 预期 | 实际 |
|------|------|------|
| 返回 | navigateBack | ✓ |
| 空态「回到我的」 | profile Tab | ✓ |
| 邀请码行 | 复制真实邀请码 | 复制 `student.invite_code` — 但该字段由 FE `buildInviteCode` 自造（见 §2.12） |
| 邀请亲属 | 共享档案 | 占位复制码 |

**合理性**：首页课时区可进 `child-detail`，本列表却不能，路径不一致。

---

### 2.12 孩子详情 `package-student/pages/child-detail`

| 项 | 内容 |
|----|------|
| **走查路径** | 首页课时「查看卡包/详情」；**非** children 列表（列表未挂跳转） |
| **预期** | 监护人 / 卡包 / 出勤三 Tab 数据真实 |
| **实际结果** | `getById` + `getParents` + `packageService.getByStudent` + `getByStudent` 消课（约 L90-141） |

**前后端**

| 调用 | 状态 | 证据 |
|------|------|------|
| `GET /students/:id` | **已打通**（含 coursePackages 内嵌） | BE getDetail |
| `packageService.getByStudent` → `GET /course-packages?studentId` | **PARENT 403**（仅 TEACHER） | `course-package.routes.ts` L27 等 |
| `getParents` | **前端未接**（恒 mock） | `student.ts` L1676 |
| 邀请码展示 | **不一致**：`buildInviteCode(id)` → `INV-${id.slice(-4)}`，详情 API **不返回**真实 `Student.inviteCode` | `student.ts` L551, L595, L627；BE getDetail 无 inviteCode |

**阻塞**：卡包 Tab 真环境调课包列表会失败；应改用详情内嵌 `coursePackages` 或后端对 PARENT 放行。

---

### 2.13 分享绑定 `package-student/pages/parent-bind`

| 项 | 内容 |
|----|------|
| **走查路径** | 教师分享 `parent-bind?studentId=&token=`（公开页） |
| **预期** | 校验一次性 token；家长登录后绑定学员 |
| **实际结果** | 仅检查 `token` 非空（L74-76）；绑定 `studentService.bindParent`（L82）— **恒 mock**，且 **token 未传 API** |

| 元素 | 预期 | 实际 |
|------|------|------|
| 确认绑定 | 服务端校验 token 并绑定 | 本地 mock bind；token 客户端随机（`invite-parent-link.ts`） |
| 成功/失败返回首页 | switchTab home | ✓ |

**严重**：与「一次性 token」注释不符；生产应用 `organization/bind` 或后端签发绑定令牌。

---

### 2.14 家长引导 `package-auth/pages/parent-onboarding`

| 项 | 内容 |
|----|------|
| **走查路径** | identity-select / onboarding「绑定孩子」 |
| **预期** | 输入学员邀请码绑定机构/孩子，进入主流程 |
| **实际结果** | `organizationService.bind(trimmed)` → `POST /organization/bind`（约 L40）**已打通**；成功 `navigateAfterLogin` |

| 字段 | 校验 | 对齐 |
|------|------|------|
| `code` | 必填、toUpperCase | body `inviteCode` ✓ |

---

### 2.15 私教时段 `package-lead/pages/trial-slot-config`（`from=parent`）

| 项 | 内容 |
|----|------|
| **走查路径** | 课表私教 → TrialBookingView → 本页 |
| **预期** | 选时段创建服务端私教预约 |
| **实际结果** | `isParentMode`：左侧预约写 `upsertParentBooking`（L274-311）后 toast + `navigateBack`；**不调后端约课 API**；右侧按钮 parent 直接 return |

**阻塞**：私教家长约课仅本地 storage，换设备/清缓存即丢；与班课真约路径不一致。

---

### 2.16 使用帮助 `package-student/pages/help`

| 项 | 内容 |
|----|------|
| **走查路径** | 我的 → 使用帮助 |
| **预期** | 帮助文档可读 |
| **实际结果** | 功能三卡无 onClick；文案「内容待填充 / 帮助内容整理中」；「去反馈」→ feedback；电话客服复制微信号 |

**一般**：占位页，功能不完整。

---

### 2.17 系统设置等（家长可见）

#### `system-settings`

| 项 | 内容 |
|----|------|
| **走查路径** | 我的 → 账号设置 |
| **预期** | 仅账号相关项；机构配置隐藏 |
| **实际结果** | `hideForParent` / `managerOnly` / `adminOnly` 过滤；家长可见主题、协议、版本、退出。版本点击家长侧 `onClick={undefined}` |

**工程风险**：`hideForParent` 的「操作日志」等 **未** 同步进 `PAGE_ROLE_REQUIREMENTS`，深链可越权（见第六节 B3）。

#### `notifications`

| 元素 | 预期 | 实际 |
|------|------|------|
| 分组 | 家长通知组 | `PARENT_NOTIFY_GROUPS` ✓ |
| 总开关 | 持久化 | `subscribeMessageService.setMasterNotifyEnabled` |
| 分项开关 | 持久化 | **仅本地 setState，无持久化 API**（`handleToggle`） |

#### `feedback` / `agreement` / `about` / `theme-settings`

| 页 | 走查结论 |
|----|----------|
| feedback | 类型/内容/图片/联系方式 → `feedbackService.create`；内容必填 ✓ |
| agreement | 静态文案，含家长端说明 ✓ |
| about | 可读；含门店入驻入口 — 家长若点入依赖 route-guard |
| theme-settings | `useThemeStore.setTheme` 本地主题 ✓ |

---

### 2.18 身份 / 注册相关（家长）

| 页 | 走查路径 | 预期 | 实际 |
|----|----------|------|------|
| `login` | 未登录守卫 | 登录后进家长流 | 协议勾选；→ `navigateAfterAuth`（`auth-onboarding.ts` L143-178） |
| `register` | 登录→注册 | 邮箱码注册 | 成功同 `navigateAfterAuth`；**不经** role-select |
| `forgot-password` | 登录找回密码 | 重置后回登录 | ✓（L214 → forgot-password） |
| `forgot-account` / `contact-support` | 应可找回/客服 | 公开页 | **P-断链**：无 UI navigate |
| `profile-setup` | 新用户缺昵称 | 完善后继续 | → `navigateAfterProfileSetup` ✓ |
| `identity-select` | 新用户 | 绑定机构 | → `parent-onboarding`；门店入驻 → store-entry **随后 P-拦截** |
| `onboarding` | 老家长未绑定 | 绑定孩子 / 跳过 | → parent-onboarding；`markOnboardingSkipped` ✓ |
| `register/role-select` / `role-info` | 遗留注册 | 可选 parent + 邀请码 | **断链**：无 `signUpStep1` 调用方 |
| `role-switch` / `add-role` | 多身份 | 切换/新增家长 | 路由可达；首页/我的 Sheet **无打开入口** |

### 2.19 资料编辑 `package-student/pages/profile-edit`（原报告遗漏）

| 项 | 内容 |
|----|------|
| **走查路径** | 我的 → 齿轮 → profile-edit |
| **预期** | 改个人资料；查看/管理子女；可进成长详情 |
| **实际结果** | Tab「个人资料 / 子女」；子女卡 → `child-detail?id=`（L310-313）；「添加子女」Sheet → `studentService.create`（L406-416） |

**表单（添加子女）**：昵称/关系/性别必填；生日、头像选填；自造 `invite_code`。  
**阻塞**：后端 `POST /students` `requireRole(['TEACHER'])`（`student.routes.ts` L155）→ 家长生产 **403**。正确路径应为邀请码绑定（organization/bind），而非家长自建学员。

### 2.20 订阅授权 `package-settings/pages/message-auth`（原报告遗漏）

| 项 | 内容 |
|----|------|
| **走查路径** | 消息通知 → 补充发送次数 |
| **预期** | 查看额度并授权攒次数 |
| **实际结果** | `subscribeMessageService.bootstrap` + 分组授权（`message-auth/index.tsx`）；`withRouteGuard` ✓ |

### 2.21 分享落地 `package-lead/pages/invite-landing`（原报告遗漏）

| 项 | 内容 |
|----|------|
| **走查路径** | 外部分享打开 `invite-landing?...` |
| **预期** | 游客/家长可登录后看课/领券；员工勿占坑 |
| **实际结果** | PUBLIC；Staff 非 guest 拦截回首页；页内微信登录；query 含 `type/t/c/date/...`（附录 A3） |

### 2.22 组件级交互（无独立路由，原报告不完整）

| 组件 | 走查路径 | 预期 | 实际 |
|------|----------|------|------|
| WechatBindReminder | 首页/我的顶条 | 引导绑微信手机 | Dialog，无路由跳转 |
| RelationConfirmSheet | 绑定后回首页 | 选父子关系 | `organizationService.saveRelation` ✓ |
| CampusSelectSheet | 首页校区卡 | 切换校区 | 仅改 `currentCampusId` |
| EvaluateSheet | my-course 待评价 | 提交评价 | 模拟成功，无 API |
| custom-tab-bar | 任意 Tab 页 | 三 Tab 切换 | home / schedule / profile |
| AgreementDialog | 登录/注册 | 强制协议 | 可进 agreement |

> 其余 P-入口页见 §2.1–2.17；**全部 123 页**分类与负向深链见附录 A1。

---

## 3. 表单与接口契约总表（家长主路径）

| # | 场景 | FE 调用 | BE | 状态 |
|---|------|---------|-----|------|
| A1 | 邀请码绑定（onboarding） | `POST /organization/bind` | 有，PARENT | **已打通** |
| A2 | 关系确认 | `POST /organization/bindings/:id/relation` | 有 | **已打通** |
| A3 | 我的机构 | `GET /organization/me` | 有 | **已打通** |
| A4 | profile 绑定 Sheet | `findByInviteCode` + `bindParent` | BE 有 by-invite-code；bind-parent **仅 TEACHER**；FE 恒 mock | **前端未接 / 路径错误** |
| A5 | 分享 parent-bind | bindParent + 客户端 token | 无 token 校验 API | **仅 mock** |
| A6 | 邀请码展示 | `buildInviteCode` | DB 有 inviteCode，详情不回 | **字段不一致** |
| B1 | 请假提交 | `POST /leave-requests` | PARENT 可建 | **已打通** |
| B2 | 请假列表映射 | `mapBackendLeave` 写死 leave | 库有 type/newDate | **回显不一致** |
| B3 | 调课 + makeup | 非 Mock 禁 UI；Mock 写本地 | 无 makeup 模块 | **后端缺失** |
| C1 | 我的课程四态 | 本地 parent-bookings | 无聚合 API | **仅本地** |
| C2 | 评价提交 | setTimeout | 无 | **未接** |
| D1 | 消课/作业/点评读 | `GET /lesson-records` | PARENT | **已打通** |
| E1 | 孩子详情 | `GET /students/:id` | PARENT | **已打通** |
| E2 | 卡包列表 | `GET /course-packages` | **仅 TEACHER** | **权限阻塞** |
| E3 | 监护人列表 | getParents mock | BE 有 `/parents` | **前端未接** |
| E6 | profile-edit 添加子女 | `POST /students` | **仅 TEACHER** | **权限阻塞** |
| F* | 场地预约全家桶 | `/venue-booking/*` | `/venues/*` | **路径/字段/角色错位** |
| G1 | 班课自助约 | `POST .../class-booking/.../records` | PARENT→self | **已打通** |
| G2 | 私教 from=parent | upsertParentBooking | 无 | **仅本地** |
| H1 | 首页聚合 | `GET /home/parent` | 有 | **已打通** |
| H2 | 课表 | `GET /schedules` | PARENT 过滤 | **已打通** |

---

## 4. 分维度评估

### 4.1 业务逻辑符合性

- 符合：绑定 onboarding、班课自助约、请假提交、消课只读、课表班级过滤、无排课 FAB。
- 不符合：卡包入口指向约课列表；评价提交后状态回到 `booked`；邀请码自造与真实绑定码脱节；「我的」统计恒 0。

### 4.2 合理性

- children 不进 child-detail，但首页课时与 **profile-edit 子女卡**可进 — 信息架构断裂（S11）。
- 排行榜/积分/帮助占位仍占金刚位/宫格，易造成「假功能」预期。
- Mock 可调课、生产不可 — 演示与真机行为分叉。
- 资料页提供「添加子女」却走教师建档 API，与「邀请码绑定」产品模型冲突（B8）。

### 4.3 功能完整性

- 缺失：服务端「我的课程」、私教家长约、补课资源、场地家长可约、真实邀请码共享、评价 API、通知分项持久化、家长自助建档。
- 部分：多孩上课记录只看第一孩；监护人 Tab 仅 mock。

### 4.4 阻塞性问题

见第六节 **B1–B8**。任一落地生产家长主路径时，卡包、场地、私教约、邀请码分享、我的课程四态、资料页添加子女均可能中断或静默失败。

### 4.5 性能瓶颈

- `records` / `parent-lesson-notes`：按孩全量 `getByStudent`，无分页。
- `schedule`：家长路径重复 `getByParent` + 仍拉全校教师列表。
- `leave-request`：`loadLessons` 预取整校区 classes/schedules（含生产无调课场景）。
- `profile` / `home`：`useDidShow` 重复拉数。

### 4.6 前端工程化

- 路由：矩阵项未挂 `withRouteGuard`；`hideForParent` ≠ 安全；`children`/`child-detail`/`help`/`parent-onboarding` 缺登录守卫。
- Mock：`my-booking-seed` 等静态 import；Mock 主包超 1.5MB 仅告警（`postbuild-weapp-fixes.mjs`）。
- 文档：`docs/backend-migration.md` 家长路径过时（仍写 `/api/parents/:id/students` 等）。

### 4.7 测试完备性

| 有测试 | 无测试（家长关键） |
|--------|-------------------|
| `home.parent.test.ts`、`data/home.parent.test.ts`、`home-ui.test.ts`、onboarding 1 例 | leave-request、my-course、parent-lesson-notes、children、child-detail、parent-bind、parent-onboarding、parent-bookings、parent-leave-lessons、课表家长约 |

无 Playwright/Cypress/小程序 automator；无页面集成测试。

---

## 5. 走查路径总览（冒烟清单）

**完整 24 步百分百冒烟（含负向深链）**见附录 **A6**。主报告精简必测：

1. 登录/注册 → profile-setup? → identity-select → parent-onboarding 真码绑定 → home + RelationConfirm  
2. 首页金刚区 8 入口 + Campus / Wechat 组件  
3. 课表四 Tab：请假 / 团课约取消详情 / 私教 from=parent / 场地  
4. 我的：四态 my-course、错链卡包、profile-edit→child-detail、添加子女（预期 403）  
5. children 复制自造码 → organization/bind（预期失败）  
6. child-detail 卡包 Tab（预期 403）；notes → lesson-detail 只读  
7. notifications → message-auth；system-settings → theme/agreement/退出  
8. parent-bind / invite-landing 公开链；forgot-password  
9. 负向：statistics/students/store-entry **应拦截**；audit-log/package-form/lesson-form **记录是否放行**

---

## 6. 问题清单（按等级）

### 阻塞（B）

| ID | 问题 | 代码依据 | 影响 |
|----|------|----------|------|
| B1 | 场地预约 FE `/venue-booking/*` 与 BE `/venues/*` 路径、body、方法、角色全面不对齐；家长无创建权 | `venue-booking.ts`；`venue.routes.ts`；`routes/index.ts` L111 | 家长场地约课不可用 |
| B2 | 卡包 Tab 调 `GET /course-packages` 仅 TEACHER；PARENT 403 | `course-package.routes.ts`；`child-detail` 调 packageService | 成长档案卡包不可用 |
| B3 | 机构写操作页大量未进矩阵或未挂 `withRouteGuard`；`hideForParent` 不等于安全（如 audit-log） | `route-guard.tsx`；`system-settings`；附录 A1 P-深链 | 家长深链越权 |
| B4 | 我的课程四态 / 取消：非 Mock 仅本地 storage，无服务端 API | `my-course.ts` L59-75；`parent-bookings.ts` | 生产约课列表不可信 |
| B5 | 私教 `from=parent` 仅 `upsertParentBooking`，无后端 | `trial-slot-config/index.tsx` L274-311 | 私教约课不落库 |
| B6 | 子女邀请码前端自造，无法用于 `organization/bind` | `student.ts` L551；BE 详情无 inviteCode | 邀请亲属/分享绑定失效 |
| B7 | profile「我的」绑定 Sheet 依赖恒 mock 的 findByInviteCode/bindParent | `profile` L201-206；`student.ts` L1682-1685 | 我的页内绑定生产失败（应改走 organization.bind） |
| B8 | profile-edit「添加子女」调 `POST /students`，BE 仅 TEACHER | `profile-edit` L406；`student.routes.ts` L155 | 资料页添加子女生产失败 |

### 严重（S）

| ID | 问题 | 代码依据 |
|----|------|----------|
| S1 | 「我的卡包」跳转 `my-course` 而非卡包/详情 | `profile/index.tsx` L519-522 |
| S2 | 评价「模拟提交」，无 API；状态改回 `booked` | `my-course/index.tsx` L226-240 |
| S3 | parent-bind token 仅非空校验，不传后端 | `parent-bind/index.tsx` L74-82；`invite-parent-link.ts` |
| S4 | 非 Mock 禁调课；Mock 可调 + makeup 无后端 | `leave-request` L629-644；`makeup-booking.ts` |
| S5 | 请假列表映射丢 `type`/`newDate` | `student.ts` `mapBackendLeave` L1386 |
| S6 | 家长上课记录默认只拉第一孩 | `records/index.tsx` L117-121 |
| S7 | `parentStats` 恒为 0 | `profile/index.tsx` L571-578 |
| S8 | 预约详情履约操作仅本地 storage | `booking-record-detail` + `parent-bookings.ts` |
| S9 | 家长业务页几乎零单测、无 E2E | vitest 清单见 §4.7 |
| S10 | Mock 种子静态进包 + 主包超 1.5MB 仅告警 | `my-booking.ts` import seed；`postbuild-weapp-fixes.mjs` |
| S11 | children 列表不进详情，profile-edit 可进 — 路径不一致 | `children` vs `profile-edit` L310-313 |

### 一般（G）

| ID | 问题 | 代码依据 |
|----|------|----------|
| G1 | 排行榜 / 积分中心 Toast 占位仍展示 | `profile` L525-537 |
| G2 | 帮助页内容占位 | `help/index.tsx` |
| G3 | children「邀请亲属」占位；卡片不进详情 | `children` L63-77、无 navigate child-detail |
| G4 | 首页/我的 RoleSwitchSheet 无打开入口 | home / profile 无 setVisible(true) |
| G5 | 通知分项开关不持久化 | `notifications` handleToggle |
| G6 | `getParents` / `verifyStudentCode` 真环境未接 | `student.ts` / `auth.ts` |
| G7 | 首页 `recentRecords` 后端有、FE 未用 | home mapper |
| G8 | children/child-detail/help/parent-onboarding 缺登录守卫 | 各页 `export default` 无 withRouteGuard |
| G9 | 班课约成功双写本地，易与后端漂移 | schedule `upsertParentBooking` |
| G10 | 文档 `backend-migration.md` 家长路径过时 | docs vs 现实现 |
| G11 | about 含门店入驻入口对家长可见性依赖守卫 | about 页 |
| G12 | 系统设置「定时备份」空 route Toast | system-settings |
| G13 | forgot-account / contact-support 公开但无入口 | PUBLIC_PAGES；无 navigate |
| G14 | register/role-select、role-info 遗留断链 | 无 signUpStep1 调用方 |
| G15 | 原主报告未覆盖 message-auth / profile-setup / invite-landing 等 | 附录 A5 |
| G16 | P-深链写页体量大（lesson-form、package-form、lead 写页等） | 附录 A1.5–A1.8 |

### 建议（P）

| ID | 建议 | 依据 |
|----|------|------|
| P1 | 多孩 records / notes 聚合 + 分页 | records / parent-lesson-notes |
| P2 | 课表家长去掉重复 getByParent、缩小教师列表 | schedule load |
| P3 | 请假页生产态跳过 makeup 全量预取 | leave-request loadLessons |
| P4 | child-detail 卡包优先用详情内嵌 coursePackages | 避免 403 |
| P5 | 统一绑定入口：一律 organization.bind + 真实 inviteCode | A1 vs A4/A5 |
| P6 | 补 parent-bookings / leave / my-course 单测与冒烟 E2E | §4.7 |
| P7 | my-booking-seed 改动态 import 并进 mock-exclude | 工程化 |
| P8 | 刷新 role-visibility 与 backend-migration 文档 | 防联调走旧契约 |

---

## 7. 修复优先级建议（执行向）

1. **契约对齐**：场地预约前缀/角色；课包 PARENT 只读或改用详情内嵌；邀请码回传真实值并去掉 `buildInviteCode`。  
2. **绑定统一**：profile Sheet / parent-bind 改走 `organization/bind` 或签发服务端 token；废弃 mock-only bindParent 家长路径。  
3. **约课闭环**：班课约以 class-booking 为唯一真相；补「我的课程」聚合 API 或明确文档「仅本地」；私教家长约补后端。  
4. **产品一致性**：修正卡包跳转；children→child-detail；隐藏或下线占位宫格；补齐 parentStats 或隐藏。  
5. **安全**：Staff 写操作页补 `withRouteGuard` + 矩阵；家长页补登录守卫。  
6. **请假**：生产开放调课需后端 makeup + 列表回显 type/newDate；否则文案改为「仅请假」。  
7. **测试**：service 层 vitest → 关键路径小程序冒烟清单自动化。

---

## 8. 附录索引

### 8.1 路径百分百

→ **[2026-08-31-parent-app-path-coverage-appendix.md](./2026-08-31-parent-app-path-coverage-appendix.md)**  
含：123 页可达性矩阵、认证/首页/课表/我的完整跳转树、query 全表、组件级路径、24 步冒烟、问题增量。

### 8.2 家长 P-入口原子页文件索引

| 路由 | 实现文件 |
|------|----------|
| `/pages/home/index` | `src/pages/home/index.tsx` + Parent* / KingKong |
| `/pages/schedule/index` | `src/pages/schedule/index.tsx` |
| `/pages/profile/index` | `src/pages/profile/index.tsx` |
| my-course / leave-request / records / booking-record-detail / parent-lesson-notes / lesson-detail / venue-booking | `package-course/pages/...` |
| children / child-detail / parent-bind / help / **profile-edit** | `package-student/pages/...` |
| parent-onboarding / identity-select / onboarding / **profile-setup** / login* / register* / role-switch* | `package-auth/pages/...` |
| system-settings / notifications / **message-auth** / feedback / agreement / about / theme-settings | `package-settings/pages/...` |
| trial-slot-config（`from=parent`）/ **invite-landing** | `package-lead/pages/...` |

**相关后端模块**：`home`、`organization`、`student`、`leave-request`、`lesson-record`、`schedule`、`class`、`class-booking`、`venue`、`course-package`、`auth`、`notification`、`subscribe`。

---

*本报告与教师端走查 + 路径附录同系列；结论均来自 2026-08-31 源码走查，随代码变更需复核。*
