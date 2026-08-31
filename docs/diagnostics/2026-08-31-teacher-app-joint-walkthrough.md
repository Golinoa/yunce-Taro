# 教师端前后端联合走查报告

> **走查日期**：2026-08-31  
> **走查范围**：`yunceTaro` 机构端（Staff：`teacher` / `assistant`，并覆盖其可达的管理侧页面）+ `yunce-backend` 对应接口  
> **走查方法**：基于源码静态走查（路由守卫、页面交互、Service/Mapper、后端 routes/validator），**禁止猜测**；每条结论附代码位置  
> **角色口径**：见 `docs/role-visibility-matrix.md`；本报告以 **教师角色 `teacher`** 为主路径，管理角色（`admin`/`principal`）仅在「教师管理 / 薪资」相关页补记  
> **路径全量补全**：[2026-08-31-teacher-app-path-coverage-appendix.md](./2026-08-31-teacher-app-path-coverage-appendix.md)（`app.config` **123/123** 页可达性矩阵 + 跳转树 + 待办/Redirect/幽灵页）

---

## 0. 结论摘要

| 维度 | 判定 |
|------|------|
| 业务逻辑符合性 | **部分符合**。课表点名/补录链路较完整；教学台账、我的统计、薪资明细在生产态仍为 Mock/硬编码 |
| 合理性 | **中等风险**。入口文案与跳转不一致；多条待办/表单跳向 Manager 专属页导致教师无权限 |
| 功能完整性 | **缺口明显**。营销占位；员工扩展字段未对接；若干注册页零入口（幽灵页） |
| 阻塞性问题 | **存在**。台账 Mock、人事状态更新失效、请假校长 403、**待办/保存后跳转 Manager 页** |
| 性能瓶颈 | **存在隐患**。上课记录按学员 N 次拉取；课表页体量极大 |
| 前端工程化 | **基本合规**，但存在未注册页、幽灵页、文档口径漂移 |
| 测试完备性 | **不足**。`package-teacher` 页面零测试；路径契约/待办跳转无 E2E |

**问题统计**：阻塞 **9** / 严重 **11** / 一般 **14** / 建议 **9**（第六节 + 附录 A7）

---

## 1. 走查边界与入口地图

### 1.1 教师端可见 Tab

| Tab | 路径 | 教师可见 | 依据 |
|-----|------|----------|------|
| 首页 | `/pages/home/index` | ✓ | `role-visibility-matrix.md` §2.3；`custom-tab-bar` |
| 课表 | `/pages/schedule/index` | ✓ | 同上 |
| 数据 | `/pages/statistics/index` | —（守卫拦截） | `route-guard.tsx` L90：`MANAGER_ROLES` |
| 我的 | `/pages/profile/index` | ✓ | 同上 |

### 1.2 教师端主入口（首页金刚区）

来源：`constants/home-ui.ts` L61-109 + `KingKongSection` 三卡片 `TRIPLE_CARD_CONFIG`（`components/home/KingKongSection/index.tsx` L45-64）

| 交互元素 | 预期跳转/行为 | 实际（代码） |
|----------|---------------|--------------|
| 快速消课 | 进入点名/消课 | → `/package-course/pages/lesson-form/index` |
| 我的预约 | 预约台账 | → `/package-course/pages/booking/index` |
| 学员管理 | 学员列表 | → `/package-student/pages/students/index` |
| 课时充值 | 充值表单 | → `/package-course/pages/package-form/index` |
| 添加学员 | 学员表单 | → `/package-student/pages/student-form/index` |
| 上课记录 | 课消列表 | → `/package-course/pages/records/index` |
| 试听记录 | 试听列表 | → `/package-lead/pages/trial-records/index` |
| 充值记录 | 充值流水 | → `/package-course/pages/recharge-records/index` |
| 考勤异常 | 异常列表 | → `/package-student/pages/attendance-anomaly/index` |
| 续费提醒 | 续费页 | → `/package-student/pages/renewal-reminder/index` |
| 意向学员 | 线索列表 | → `/package-lead/pages/my-invite/index` |

导航实现：`KingKongSection` L118-139（`navigateTo` / Tab 用 `switchTab`）。

### 1.3 「我的」页教师区块

来源：`pages/profile/index.tsx`

| 区块 | 入口 | 预期 | 实际 |
|------|------|------|------|
| 头部设置 | 齿轮 | 编辑资料 | → `/package-student/pages/profile-edit/index`（L303-305） |
| 核心数据 | 累计出勤等 | 展示真实统计 | **恒为 0**（`teacherStats` L477-485） |
| 教学台账 | 课时流水 | 月台账·课时 | → `monthly-flow?tab=lessons`（L455） |
| 教学台账 | 工资记录 | 月台账·工资 | → `monthly-flow?tab=salary`（L460） |
| 教学台账 | 我的预约 | 预约列表 | → `/package-course/pages/booking/index`（L465） |
| 教学台账 | 上课记录 | 课消列表 | → `/package-course/pages/records/index`（L470） |
| 营销活动 | 秒杀/拼团/优惠券/邀请有礼 | 业务页 | **Toast「努力开发中」**（L384-410） |
| 系统管理 | 使用帮助 / 客服 / 消息 / 系统设置 | 对应页 | 均有真实路由（L422-444） |
| 店铺管理 | — | 教师不可见 | `isManagerRole` 才渲染（L661-674）✓ |

---

## 2. 原子页走查记录（教师可达）

> 每页格式：**走查路径 / 预期 / 实际结果**。交互按钮尽可能穷尽；表单另列字段对齐。

### 2.1 首页 `pages/home/index`

| 项 | 内容 |
|----|------|
| **走查路径** | 登录教师身份 → Tab「首页」 |
| **预期** | 金刚区、待办、今日课、消息入口可用；数据按本人/校区过滤 |
| **实际结果** | Staff 渲染 `KingKongSection` + 待办运营区（`home/index.tsx` L875、L894、L1061）。快捷入口走 `homeService.getQuickEntries(role)` → 非 parent 返回 `HOME_QUICK_ENTRIES`（`services/home.ts` L1040-1044）。待办「更多」→ `/package-settings/pages/my-todos/index`（L567）。消息 → `notifications`（L824）。 |

**交互核对**

| 元素 | 预期 | 实际 |
|------|------|------|
| 待办卡片点击 | 按 `item.url` 跳转 | `TodoQuadrantBoard` L424 `navigateTo` |
| 今日课「记录」 | 进课次详情 | `navigateToLessonDetail` |
| 上课记录入口 | 上课记录页 | L994-995 → `records` |

**问题**：无独立阻塞；依赖下游页面数据真实性（见台账/统计）。

---

### 2.2 课表 `pages/schedule/index`

| 项 | 内容 |
|----|------|
| **走查路径** | Tab「课表」→ 班课/团课/私教/场地切换 → 卡片操作 |
| **预期** | Staff 可排课、点名、补录、约试听、调课/停课；数据按教师/校区加载 |
| **实际结果** | 数据加载：`scheduleService.getByTeacher` / `classService.getByTeacher` / `studentService.getByTeacher`（约 L1015-1022）。主操作进点名页 `lesson-form`（L1591-1597）；历史补录带 `action=supplement`（L1521-1547）；超时仅查看 `viewOnly=1`（L1550-1564）。 |

**关键交互**

| 元素 | 预期 | 实际（代码） |
|------|------|--------------|
| 卡片主点击 | 点名 / 补录 / 查看 | `handlePrimaryAction` L1568+ |
| 点名按钮 | 进 lesson-form | `handleCheckIn` → navigateTo lesson-form |
| 约试听 | 试听预约流 | 卡片子按钮 + `BookTrialByClassSheet` |
| 左滑编辑 | 编辑排课 | → `schedule-form`（约 L1650） |
| 调课 | 临时调课 | → 相关调课页（约 L1666） |
| 停课/取消/恢复 | 改排课状态 | L1679-1993 一带 Toast + service |
| 批量调课/删除 | 选班后确认 | FAB + BottomSheet L2456+ |
| 排课 FAB | 新建排课 | navigateTo schedule-form / lesson 相关 |

**表单/接口**：排课、点名依赖 `schedule` / `lessonRecord` / `temporaryReschedule` 服务；后端 `schedule.routes` 对 TEACHER+PRINCIPAL 放行（`schedule.routes.ts` L61、L86）。

**问题**：单文件体量极大（3000+ 行）→ 性能/可维护性风险（建议级）。微信端 `stopPropagation` 不可靠，已用 `cardActionLockRef` 兜底（注释 L618）— 合理。

---

### 2.3 我的 `pages/profile/index`

| 项 | 内容 |
|----|------|
| **走查路径** | Tab「我的」 |
| **预期** | 展示教师身份、真实出勤/课时类统计；台账与系统入口可用 |
| **实际结果** | 身份标签正确（`ROLE_LABEL` + `isStaffRole`）。**统计四格写死 0**（L477-485）。营销全占位。台账四入口见 §1.3。 |

| 元素 | 预期 | 实际 |
|------|------|------|
| ProfileStats | 回显真实数据 | **恒 0，无接口**（L477-485、L596-599） |
| 关于品牌 | 关于页 | → `about`（L323-325） |
| 微信绑定提醒 | 引导绑定 | `WechatBindReminder` 组件 |

**等级**：**严重** — 核心数据卡片对用户呈现虚假信息。

---

### 2.4 教学台账 `package-teacher/pages/monthly-flow`

| 项 | 内容 |
|----|------|
| **走查路径** | 我的 → 课时流水 / 工资记录 |
| **预期** | 按月聚合本人课时、应发/实发、工资明细；可切「我的预约」 |
| **实际结果** | UI 有月份切换、摘要卡、课时/工资列表（`monthly-flow/index.tsx`）。`activeTab==='bookings'` 时 **强制 `redirectTo` booking 页**（L61-64），页内 Tab「我的预约」无法停留。 |

**数据层**

| 项 | 预期 | 实际 |
|----|------|------|
| Mock | 本地 bundle | `buildMockBundle`（`teacher-monthly-flow.ts` L119-272） |
| 生产 | 对接消课/薪资 API | **仍 `return buildMockBundle`**（L276-284 注释「生产接口待对接」） |

**字段对齐**：无后端契约；`TeacherMonthlyFlowBundle` 仅前端自造。后端无 `/teachers/monthly-flow` 类路由。

| 元素 | 预期 | 实际 |
|------|------|------|
| 上月/下月 | 切换月份重载 | L84-95 + `loadData` |
| Tab 课时/工资 | 展示列表 | L161-210 |
| Tab 我的预约 | 页内列表 | **跳走 booking**（L61-64） |
| 旧链 `?tab=attendance` | 兼容 | 落到 lessons（L36-37）✓ |

**等级**：**阻塞**（生产数据未打通）。

---

### 2.5 考勤页 `package-teacher/pages/attendance`

| 项 | 内容 |
|----|------|
| **走查路径** | 深链 / 旧入口 → attendance |
| **预期** | 教师考勤（签到）或明确下线说明 |
| **实际结果** | `useDidShow` **直接 redirect** → `records`（`attendance/index.tsx` L12-14）。注释写明「下版再做上下班签到」。 |

| 元素 | 预期 | 实际 |
|------|------|------|
| 进入页 | 考勤 UI | **无 UI，瞬转上课记录** |

**合理性**：避免 404 合理，但金刚区/旧文案若仍称「考勤」会误导（当前金刚区已无「考勤」字样，改为「上课记录」）。**一般**。

---

### 2.6 上课记录 `package-course/pages/records`

| 项 | 内容 |
|----|------|
| **走查路径** | 首页金刚 / 我的台账 / attendance 重定向 |
| **预期** | 教师名下学员课消记录；可按日期/学员筛选；点进详情 |
| **实际结果** | Staff：`fetchStudentsByTeacher` 后对每名学员 `lessonRecordService.getByStudent`（L99-104）→ **N+1 请求**。家长路径按绑定孩子。 |

| 元素 | 预期 | 实际 |
|------|------|------|
| 快捷范围 周/月/全部/自定义 | 过滤列表 | L67-81 |
| 学员筛选 | 过滤 | `filterStudentId` |
| 列表项点击 | 课次详情 | `navigateToLessonDetail` |

**性能**：**严重** — 学员多时串行/并行多次拉取（L101-104）。

---

### 2.7 我的预约 `package-course/pages/booking`

| 项 | 内容 |
|----|------|
| **走查路径** | 首页三卡片 / 我的台账 / monthly-flow redirect |
| **预期** | 与当前老师相关的试听/团课/私教/场地预约时间线 |
| **实际结果** | 聚合 `myBookingService` / `leadService` / `venueBookingService`（`booking/index.tsx` 头部注释与 import）。操作权限 `resolveMyBookingActions`（`related-booking-scope.ts`）。 |

| 元素 | 预期 | 实际 |
|------|------|------|
| 状态 Tab | 筛选 | `MY_BOOKING_STATUS_TABS` |
| 卡片打开 | 详情/关联页 | `onOpen` |
| 签到 / 取消 / 场地签到 | 按权限 | L95+ `canCheckIn` 等 |

**数据打通**：依赖各 booking 服务的 mock/生产分支（需按环境验证）；页面本身交互闭环完整。

---

### 2.8 请假/调课审批 `package-course/pages/leave-request`

| 项 | 内容 |
|----|------|
| **走查路径** | 待办深链 `?requestId=` / 教师主动进入 |
| **预期** | 教师看待审批列表；同意/拒绝；家长为申请表单 |
| **实际结果** | `isStaffRole` 时标题「请假/调课审批」，`leaveService.getByTeacher`（L105-107）；审批 `updateStatus`（约 L257/L281）。 |

**前后端字段**

| 前端 | 后端 | 对齐 |
|------|------|------|
| `create`: `student_id`, `original_date`, `end_date`, `reason`, `type`, `new_date` | `studentId`, `startDate`, `endDate`, `reason`, `type`, `newDate` | Service 已映射（`student.ts` L2220-2228）✓ |
| `updateStatus('approved'\|'rejected')` | `PUT .../approve` body `{ status: APPROVED\|REJECTED }` | L2252-2256 ✓ |
| 列表 | `GET /leave-requests` | ✓ |

**阻塞点**：后端路由 `requireRole(['TEACHER', 'PARENT'])`（`leave-request.routes.ts` L28、L85），**不含 PRINCIPAL**。校长身份走前端 Staff 审批页时生产会 **403**。审批接口同样仅 `TEACHER`（L85）。

另：列表服务对非 TEACHER/PARENT 的 `where` 几乎为空过滤（`leave-request.service.ts` L412-447），即便放行校长也需补数据范围。

---

### 2.9 课时充值 `package-course/pages/package-form`

| 项 | 内容 |
|----|------|
| **走查路径** | 首页 → 课时充值 |
| **预期** | 选学员/课包/价格/分期等并提交；教师可操作名下学员 |
| **实际结果** | 双 Tab「课时充值 / 发会员卡」（页面注释）。`usePackageForm` 管状态。路由守卫：**未**列入 `PAGE_ROLE_REQUIREMENTS`，已登录即可进（含家长深链风险）。 |

**一般**：建议补 STAFF 守卫，与学员 CRUD 一致。

---

### 2.10 添加学员 `package-student/pages/student-form`

| 项 | 内容 |
|----|------|
| **走查路径** | 首页 → 添加学员 |
| **预期** | STAFF 可建档；字段与后端 CreateStudent 一致 |
| **实际结果** | 守卫 `STAFF_ROLES`（`route-guard.tsx` L73）✓。表单逻辑在 `useStudentForm.ts`（未在本报告逐字段展开；建议单独立项复核）。 |

---

### 2.11 学员列表/详情 `students` / `student-detail`

| 项 | 内容 |
|----|------|
| **走查路径** | 首页三卡片「学员管理」→ 列表 → 详情 |
| **预期** | 教师 own 范围学员；详情可请假审批、发卡、跟进 |
| **实际结果** | 守卫 STAFF（L71-72）。详情内请假审批复用 `leaveService.updateStatus`（`student-detail` 约 L595-614）— 同 §2.8 校长 403 风险。 |

---

### 2.12 意向学员 `package-lead/pages/my-invite`

| 项 | 内容 |
|----|------|
| **走查路径** | 首页 → 意向学员 |
| **预期** | 线索列表、筛选、新增、邀约码 |
| **实际结果** | `useLeadStore.fetchCards/fetchSummary`（L37-41）；新增 → `lead-form`（L76）；二维码 → `invite-qrcode`（L81）。 |

| 元素 | 预期 | 实际 |
|------|------|------|
| Tab 筛选 | 切换列表 | `handleTabChange` L64-71 |
| 下拉刷新 | 失效缓存重拉 | L45-54 |
| 线索卡片 | 进详情 | `LeadCard`（组件内跳转） |

---

### 2.13 试听记录 / 充值记录 / 考勤异常 / 续费提醒

| 页面 | 走查路径 | 预期 | 实际 |
|------|----------|------|------|
| `trial-records` | 金刚区 | Staff 试听列表 | 有 `isStaffRole` 校验（`trial-records/index.tsx` L172、L230） |
| `recharge-records` | 金刚区 | 充值流水 | 页面存在；建议核对 teacher scope |
| `attendance-anomaly` | 金刚区 | 异常考勤 | 守卫 STAFF（route-guard L78）；非 Staff toast 拦截 |
| `renewal-reminder` | 金刚区 | 续费提醒 | 守卫 STAFF（L79）；阈值配置与校长能力交叉 |

---

### 2.14 点名/消课 `package-course/pages/lesson-form`

| 项 | 内容 |
|----|------|
| **走查路径** | 课表卡片 / 首页「快速消课」 |
| **预期** | 勾选到课、提交消课、试听生处理 |
| **实际结果** | 核心教务页；拉请假 `leaveService.getByTeacher`（约 L707）、课消 `lessonRecordService`。与课表参数 `scheduleId/classId/lessonDate` 联通（schedule L1541-1546）。 |

**业务符合性**：历史补录 30 天窗口在课表侧校验（schedule L1535-1536）与入口一致 ✓。

---

### 2.15 系统设置（教师可见项）

路径：`package-settings/pages/system-settings/index`

| 设置项 | 教师预期（矩阵文档） | 代码实际 |
|--------|----------------------|----------|
| 操作日志 | 本人 | 可见（`hideForParent`，L59-65） |
| 主题颜色 | 文档写「教师 —」 | **代码全员可见**（L66-70，无 managerOnly）→ **文档漂移** |
| 待办提醒 | — | `managerOnly`（L72-74）✓ |
| 同步手机日历 | ✓ | `canUseCalendarSync` 开关（L111） |
| 用户协议 / 版本 / 退出 | ✓ | 有 |
| 场地预约 / 请假自动审批 | — | 仅 Manager 区块 |

| 元素 | 预期 | 实际 |
|------|------|------|
| 定时备份（admin） | 占位 | `route:''` → Toast 开发中（L289-291） |
| 退出登录 | 清会话 | `signOut` |

---

### 2.16 薪资详情 `package-teacher/pages/salary-detail`（Staff 可进）

| 项 | 内容 |
|----|------|
| **走查路径** | 管理端发薪流 / 深链；守卫 `STAFF_ROLES`（route-guard L64） |
| **预期** | 本人或授权范围内真实工资单 |
| **实际结果** | 课时费/提成流水由 **`genMockLessonRecords` / `genMockCommissionRecords` 本地生成**（`salary-detail/index.tsx` L25-55），非后端明细。 |

**等级**：**严重**（展示假流水）。

---

## 3. 管理侧「教师管理」模块（admin/principal）

> 教师角色入口隐藏 + 守卫拦截；校长走查店铺管理 → 员工管理。

### 3.1 员工列表 `teacher-list`

| 元素 | 预期 | 实际 |
|------|------|------|
| Tab 在职/离职 | 过滤 | L35-38、L79 |
| 卡片点击 | 详情 | → teacher-detail |
| 左滑离职 | 离职弹窗 | `ResignSheet` + `resignTeacher` → `POST /teachers/:id/resign` ✓ |
| 左滑删除 | 删除员工 | `updateTeacher` 改 status/resign*（L147-152） |
| 恢复在职 | 改回 active | `updateTeacher`（L167-172） |
| FAB 新增 | 表单 | → teacher-form |

**生产对齐问题**：`mapUiTeacherToUpdatePayload` **仅** `name/role/subject/institution/color/payRemark`（`teacher-api.mapper.ts` L126-134），**不含 `status`/`resignType`**。后端 `updateTeacherSchema` 同样无 status（`teacher.validator.ts` L24-32）。  
→ **删除 / 恢复在生产不会真正改状态**（最多无字段 PUT）。**阻塞**。

后端教师写接口均为 `requireRole(['PRINCIPAL'])`（`teacher.routes.ts`），前端 `admin` 是否映射为 PRINCIPAL 取决于鉴权会话；`middleware/auth.ts` AuthUser.role 仅 `PRINCIPAL|TEACHER|PARENT`（L19）— 与前端 `ADMIN/ASSISTANT` 模型存在体系差（**严重**，跨模块）。

### 3.2 员工表单 `teacher-form`

**前端表单字段**（`teacher-form/index.tsx` `FormState` L39-48）：

| UI 字段 | 写入 TeacherUIModel | 后端 create/update |
|---------|---------------------|-------------------|
| identity | → `role` 映射 lead/assist/parttime（L60-65） | `role` enum ✓（语义：教学角色，非机构身份） |
| name | ✓ | ✓ |
| phone | ✓（仅创建） | create 必填 ✓；update schema **无 phone** |
| gender | ✓ | **无** |
| birthday | ✓ | **无** |
| intro | ✓ | **无** |
| promoImages | ✓ | **无** |
| showInPrivateList | ✓ | **无** |
| avatar | UI 有品牌默认图 | create schema **无 avatar** |

保存调用 `addTeacher`/`updateTeacher`（L193-216）→ 生产走 mapper **丢扩展字段**。  
Mock 本地可「保存成功」，生产 **静默丢数据** → **严重 / 功能不完整**。

### 3.3 薪资管理簇（salary-home / payment / template / settings / adjust / form）

| 项 | 结论 |
|----|------|
| 守卫 | `MANAGER_ROLES`（route-guard L57-63）✓ |
| 后端 | `/teachers/salary*`、`salary-models`、`salary-settings` 均 PRINCIPAL（teacher.routes） |
| 未接线 | `sendSalarySlip`、`updateDeduction`、`deleteDeduction`、部分 schedule/rule → `notWired`（`teacher.ts` L150-183、L249+） |
| 历史问题 | 设计审查已记班级差异费率、历史快照等（`docs/UI-design/Todo/teacher-management/review-report.md`）仍相关 |

### 3.4 `staff-invite` 页

| 项 | 内容 |
|----|------|
| **走查路径** | 源码存在 `package-teacher/pages/staff-invite/` |
| **预期** | 校区员工邀请 |
| **实际结果** | **`app.config.ts` 未注册该页**（L51-66 无 `staff-invite`）；工程内无其它 navigate 引用。文件头注释出现乱码（编码损坏）。**死代码 / 功能未上线**。 |

---

## 4. 数据打通总表（教师相关核心）

| 能力 | 前端 Service | 后端 | 打通状态 |
|------|--------------|------|----------|
| 教师 CRUD 列表 | `teacherService` | `GET/POST/PUT /teachers` | 基本字段可通；扩展字段不通 |
| 离职 | `resign` | `POST /:id/resign` | ✓ |
| 删除/恢复 | `update` 改 status | update 无 status | **不通** |
| 教学台账 | `teacherMonthlyFlowService` | 无对应 API | **Mock only** |
| 薪资确认/发放 | teacherService | `/teachers/salary/*` | 管理端可通；明细页仍有 Mock 流水 |
| 请假列表/审批 | `leaveService` | `/leave-requests` | Teacher✓；Principal **路由拒绝** |
| 课消记录 | `lessonRecordService` | lesson 相关模块 | 可用；列表 N+1 |
| 分享邀请 | — | `GET /teachers/me/share-invite` 等 | 后端有；前端入口需确认是否挂到 UI |

---

## 5. 分维度评估

### 5.1 业务逻辑符合性

- 课表点名/补录期限、取消态拦截：符合。  
- 考勤入口并入上课记录：产品注释明确，符合「下版签到」规划。  
- 员工「删除」语义实为标记离职，且生产更新字段缺失：**不符合**人事闭环。  
- 请假审批角色：前端 Staff 含校长，后端仅 TEACHER：**不符合**。

### 5.2 合理性

- 台账 Tab「我的预约」redirect：与页内 Segmented 并存，交互突兀。  
- 我的页统计全 0：误导经营感知。  
- 营销四入口对教师展示但全占位：入口噪音。  
- 文档写教师不可见主题色，代码可见：维护成本。

### 5.3 功能完整性

- 营销、门店管理占位、定时备份占位、员工扩展资料、教学台账真数据、工资单真实流水：**不完整**。  
- `notWired` 多项薪资周边能力。

### 5.4 阻塞性

见第六节「阻塞」。

### 5.5 性能

- `records` 按学员多次 `getByStudent`（L101-104）。  
- `schedule/index.tsx` 超大单文件，首屏逻辑重。  
- `teacherService.getList` 已用 `fetchAllPages`（较好）。

### 5.6 前端工程化

- Service 统一出口（`services/index.ts`）规范良好。  
- `withRouteGuard` + `PAGE_ROLE_REQUIREMENTS` 体系清晰。  
- 问题：未注册 `staff-invite`；`staff-invite` 乱码；role-visibility 与 system-settings 主题口径不一致；`package-teacher` 无测试。

### 5.7 测试完备性

| 类型 | 现状 |
|------|------|
| 单元 | 有 `data/teacher.test.ts`、`teacher-chain.test.ts` 等；**无** package-teacher 页面测试 |
| 集成 | 后端有 `teacher.service.test`、`leave-request.service.test`；前后端契约测试缺失 |
| E2E | 未见教师端主路径 E2E |
| 缺口 | 台账生产分支、teacher-form 字段映射、删除/恢复、校长请假审批 |

---

## 6. 问题清单（按等级）

### 阻塞（P0）

| ID | 问题 | 依据 |
|----|------|------|
| B1 | 教学台账生产环境仍返回 Mock bundle，真实课时/工资未打通 | `services/teacher-monthly-flow.ts` L276-284 |
| B2 | 员工列表「删除」「恢复」依赖 `updateTeacher` 传 `status`，Mapper/后端 schema 均不支持，生产无效 | `teacher-list/index.tsx` L141-172；`teacher-api.mapper.ts` L126-134；`teacher.validator.ts` L24-32 |
| B3 | 请假列表/审批 API 仅允许 TEACHER/PARENT，校长走 Staff 审批页生产 403 | `leave-request.routes.ts` L28、L85；前端 `isStaffRole` 含 principal |
| B4 | 教师表单扩展字段（gender/birthday/intro/promoImages/showInPrivateList）无后端字段，生产静默丢失 | `teacher-form` FormState；`createTeacherSchema`/`updateTeacherSchema` |
| B5 | 我的页核心统计恒为 0，无法反映出勤/课时等业务真相 | `pages/profile/index.tsx` L477-485 |
| B6 | 待办 checkin 缺 `scheduleId` 时跳转 `course-management`，教师守卫拦截 | `services/todo.ts` L101-104、L238-246；`constants/course-category-ui.ts` L16-17 |
| B7 | 待办 salary → `salary-payment`（仅 Manager），教师点击无权限 | `todo.ts` L102；`route-guard.tsx` L58 |
| B8 | 待办 alert → `alert-detail`（仅 Manager），教师点击无权限 | `todo.ts` L291；`route-guard.tsx` L96 |
| B9 | 学员表单保存后可跳 `course-management`，教师无权限回首页 | `student-form/useStudentForm.ts` L607 |

### 严重（P1）

| ID | 问题 | 依据 |
|----|------|------|
| S1 | 工资详情页课时费/提成流水本地 `genMock*`，非接口数据 | `salary-detail/index.tsx` L25-55 |
| S2 | 上课记录教师路径按学员 N 次拉取，学员多时性能差 | `records/index.tsx` L99-104 |
| S3 | 多项薪资能力 `notWired`（工资条、扣款改删、课表规则等） | `services/teacher.ts` L150-183、249+ |
| S4 | 后端 AuthUser 角色仅 PRINCIPAL/TEACHER/PARENT，与前端 admin/assistant 五角色模型不对齐 | `middleware/auth.ts` L19；`services/auth.ts` BackendRole |
| S5 | `staff-invite` 未进 `app.config`，功能不可达 | `app.config.ts` L51-66 vs 页面目录 |
| S6 | 台账「我的预约」Tab 强制 redirect，页内信息架构断裂 | `monthly-flow/index.tsx` L61-64 |
| S7 | 营销活动对教师可见但 100% 占位 | `profile/index.tsx` L384-410 |
| S8 | 门店管理「门店管理」项占位 Toast | `profile/index.tsx` L333-335、`handlePlaceholder` |
| S9 | 设计审查遗留：班级差异课时费率未落地 | `docs/.../teacher-management/review-report.md` P1-1 |
| S10 | `lesson-form` 提供跳转 `course-form`，教师点入被拦 | `lesson-form/index.tsx` L2844-2845；route-guard L88 |
| S11 | 多个已注册页零 UI 入口（幽灵页）：`student-transfer` / `booking-rule` / `teacher-booking-config` / `campus-detail` / `room-form` / `notification-send` | 全仓无 navigate；见附录 A5 |

### 一般（P2）

| ID | 问题 | 依据 |
|----|------|------|
| G1 | attendance 页无内容瞬转 records，深链体验突兀 | `attendance/index.tsx` L12-14 |
| G2 | `package-form` 等充值页未进 PAGE_ROLE_REQUIREMENTS | `route-guard.tsx` 无对应项 |
| G3 | `monthly-flow` 未角色守卫，家长可深链 | 同上 |
| G4 | 主题颜色：文档称教师不可见，代码可见 | matrix §2.3 vs `system-settings` L66-70 |
| G5 | update 不支持改手机号，与表单编辑预期可能不符 | `updateTeacherSchema` 无 phone |
| G6 | 删除员工文案「已删除」实为标记离职 | `teacher-list` L145-153 |
| G7 | 台账类型仍含 `attendance`/`reviews` 等死类型 | `teacher-monthly-flow.ts` L9-14 |
| G8 | KingKong 注释「考勤管理」与现入口「上课记录」文案残留 | `KingKongSection` L36 注释 |
| G9 | 请假自动审批默认逻辑与前端开关需联调确认 | `leave-request.service.ts` L253-255 |
| G10 | 分享邀请后端已有 `/teachers/me/*`，教师端入口不明显 | `teacher.routes.ts` L74-128 |
| G11 | `staff-invite` 源文件注释乱码 | `staff-invite/index.tsx` L1-2 |
| G12 | 课时充值/发卡对教师权限粒度未按 own 二次声明 | 守卫缺口 |
| G13 | 教师可深链进入家长页（`my-course`/`children`/…）缺互斥守卫 | `PAGE_ROLE_REQUIREMENTS` 未列 |
| G14 | `salary-detail` 教师可进但「我的」无工资单入口，发现性差 | profile 台账无直达 |

### 建议（P3）

| ID | 问题 | 依据 |
|----|------|------|
| A1 | 拆分 `schedule/index.tsx` 降低维护与渲染成本 | 文件 3600+ 行级 |
| A2 | `package-teacher` 补页面级单测 / 关键路径 E2E | Glob 测试为 0 |
| A3 | 台账与 booking 入口统一（去掉空 Tab 或内嵌列表） | monthly-flow vs profile |
| A4 | 同步更新 `role-visibility-matrix.md` 主题色口径 | docs vs code |
| A5 | 员工删除改为调用 resign API 或新增 DELETE，并补恢复接口 | 当前 update 滥用 |
| A6 | 上课记录改为后端按 teacherId+range 聚合接口 | 对齐 `getByTeacherAndRange` 已有能力（lessonRecord） |
| A7 | 营销入口教师端隐藏至功能就绪 | profile marketingItems |
| A8 | 注册 staff-invite 或删除死代码 | app.config / 目录 |
| A9 | 幽灵页补入口或从 app.config 下线 | 附录 A5 |

---

## 7. 推荐修复优先级（落地顺序）

1. **B6–B9**：待办/表单跳转改为教师可达页（`lesson-form` / `monthly-flow?tab=salary` / `student-detail` / 保存后 `navigateBack`），避免点进即「无权限」。  
2. **B1 + B5**：台账与我的统计接真数据（或生产态隐藏入口/展示「暂未开通」）。  
3. **B2 + B4**：员工状态变更与表单字段契约一次性对齐（validator + mapper + UI）。  
4. **B3**：请假路由 `requireRole` 增加 PRINCIPAL（及数据范围）。  
5. **S1 + S3 + S10**：工资详情去 Mock；lesson-form 对教师隐藏 course-form 入口。  
6. **S11**：幽灵页补入口或下线。  
7. **测试**：待办 URL × 角色矩阵、teacher-form 映射、leave 审批、monthly-flow 生产分支。

---

## 8. 走查覆盖核对表

| 模块 | 覆盖方式 | 状态 |
|------|----------|------|
| `app.config` 全部 123 页 | 附录 A1 可达性矩阵 | ✓ 100% |
| Tab / 金刚 / 课表 / 我的跳转树 | 附录 A2 | ✓ |
| 待办全部 type | 附录 A3 | ✓ |
| Redirect / 兼容链 | 附录 A4 | ✓ |
| 幽灵页 / 死页 | 附录 A5 | ✓ |
| 重点页字段与接口 | 主报告 §2–§4 | ✓ |
| 管理侧员工/薪资 | 主报告 §3 | ✓ |
| 真机点击 | — | 未做（建议按附录 A8 冒烟） |

详细路径见：[路径覆盖附录](./2026-08-31-teacher-app-path-coverage-appendix.md)

---

## 9. 附录：关键代码索引

| 主题 | 路径 |
|------|------|
| 路由与角色守卫 | `src/utils/route-guard.tsx` |
| 角色可见性文档 | `docs/role-visibility-matrix.md` |
| 首页快捷入口 | `src/constants/home-ui.ts` |
| 金刚区导航 | `src/components/home/KingKongSection/index.tsx` |
| 待办跳转 | `src/services/todo.ts` |
| 我的页 | `src/pages/profile/index.tsx` |
| 教学台账 UI/Service | `src/package-teacher/pages/monthly-flow/index.tsx`、`src/services/teacher-monthly-flow.ts` |
| 教师 API/Mapper | `src/services/teacher.ts`、`src/services/mappers/teacher-api.mapper.ts` |
| 后端教师路由 | `yunce-backend/src/teacher/teacher.routes.ts`、`teacher.validator.ts` |
| 请假 | `src/services/student.ts`（leaveService）、`yunce-backend/src/leave-request/*` |
| 课表 | `src/pages/schedule/index.tsx` |
| **全量路径附录** | `docs/diagnostics/2026-08-31-teacher-app-path-coverage-appendix.md` |

---

*本报告「实际结果」均来自静态代码走查；路径空间已按 app.config 123 页穷尽（见附录）。建议 Mock 切 `teacher1` 按附录 A2/A3 做手工冒烟，重点验证 B6–B9。*
