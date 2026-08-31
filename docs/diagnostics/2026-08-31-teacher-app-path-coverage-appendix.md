# 教师端全量路径覆盖补全（附录）

> **配套主报告**：[2026-08-31-teacher-app-joint-walkthrough.md](./2026-08-31-teacher-app-joint-walkthrough.md)  
> **补全日期**：2026-08-31  
> **目标**：对 `app.config.ts` **全部 123 个已注册页面** + 未注册死页，按教师角色（`teacher`/`assistant`）给出可达性判定与完整走查路径；覆盖入口、深链、待办跳转、Redirect、守卫拦截全部可能性。  
> **依据**：`app.config.ts`、`route-guard.tsx` `PAGE_ROLE_REQUIREMENTS`、全仓 `navigateTo`/`redirectTo`/`switchTab`/`TODO_TYPE_URL` 静态检索。

---

## A0. 覆盖口径

| 代号 | 含义 |
|------|------|
| **T-入口** | 教师角色可通过 Tab / 金刚区 /「我的」/ 课表正常点到 |
| **T-深链** | 无角色守卫或守卫含 STAFF，但 UI 无入口；仅 URL/待办/分享可进 |
| **T-拦截** | `PAGE_ROLE_REQUIREMENTS` 不含 teacher → Toast「无权限」回首页 |
| **T-家长页** | 未列守卫默认开放，但 UI/数据面向家长；教师深链可进但非主路径 |
| **共用认证** | 登录/注册/切身份，教师生命周期会经过 |
| **死页** | 源码存在但未注册或零引用 |

**「百分百」定义**：每一个已注册路由至少出现在下方矩阵一次，并标注教师侧结果（可进 / 拦截 / 深链 / 非主路径）。交互路径按「入口 → 页面 → 下一跳」穷尽代码中的跳转边。

---

## A1. 全量页面可达性矩阵（123 + 1）

### A1.1 Tab 主包（4）

| # | 路由 | 教师 | 说明 |
|---|------|------|------|
| 1 | `/pages/home/index` | T-入口 | Tab |
| 2 | `/pages/schedule/index` | T-入口 | Tab |
| 3 | `/pages/statistics/index` | **T-拦截** | `MANAGER_ROLES`；TabBar 对教师不渲染 |
| 4 | `/pages/profile/index` | T-入口 | Tab |

### A1.2 package-auth（14）— 共用认证

| # | 路由 | 教师 | 走查路径（预期 → 实际） |
|---|------|------|-------------------------|
| 5 | `/package-auth/pages/index/index` | 共用 | 启动入口 → 按会话分流登录/主页 |
| 6 | `/package-auth/pages/login/index` | 共用 | 未登录访问任意守卫页 → redirect 登录；登录成功 → onboarding/home |
| 7 | `.../login/forgot-account/index` | 共用 | 登录页忘记账号 → 找回账号页 |
| 8 | `.../login/forgot-password/index` | 共用 | 登录页忘记密码 → 重置；成功 → redirect 登录 |
| 9 | `.../login/contact-support/index` | 共用 | 登录联系客服 |
| 10 | `/package-auth/pages/register/index` | 共用 | 登录→注册；可进协议 |
| 11 | `.../register/role-select` | 共用 | 注册选角色 |
| 12 | `.../register/role-info` | 共用 | 角色信息；可回退 register/role-select |
| 13 | `.../profile-setup/index` | 共用 | `auth-onboarding` 引导完善资料 |
| 14 | `.../onboarding/index` | 共用 | 入驻选择；门店入驻（Manager）/家长 onboarding |
| 15 | `.../identity-select/index` | 共用 | 多身份选择（无角色限制） |
| 16 | `.../parent-onboarding/index` | 家长向 | onboarding 可跳；教师非主路径 |
| 17 | `.../role-switch/index` | T-入口 | `RoleSwitchSheet` / 无权限时 redirect；→ add-role |
| 18 | `.../role-switch/add-role` | T-入口 | 添加身份 |

### A1.3 package-student（15）

| # | 路由 | 教师 | 主入口路径 |
|---|------|------|------------|
| 19 | `.../students/index` | **T-入口** | 首页三卡片「学员管理」；`StudentQuickList` |
| 20 | `.../student-detail/index` | **T-入口** | 学员列表卡片；考勤异常/续费提醒/待办充值；上课记录点学员 |
| 21 | `.../student-form/index` | **T-入口** | 金刚「添加学员」；学员列表 FAB |
| 22 | `.../student-transfer/index` | **T-深链** | 守卫 STAFF；**全仓无 navigateTo 引用**（仅 app.config + route-guard） |
| 23 | `.../parent-bind/index` | 家长/公开 | PUBLIC_PAGES；教师非主路径 |
| 24 | `.../member-card-issue/index` | **T-入口** | 学员详情「发卡」 |
| 25 | `.../member-card-detail/index` | **T-入口** | 学员详情点卡 → 详情 → 可进 edit |
| 26 | `.../member-card-edit/index` | **T-入口** | 卡详情编辑 |
| 27 | `.../follow-record-form/index` | **T-入口** | 学员详情新增/编辑跟进 |
| 28 | `.../help/index` | 家长向 | profile 家长用；教师「使用帮助」走 settings/help |
| 29 | `.../child-detail/index` | T-家长页 | profile-edit / ParentHours；教师深链可进 |
| 30 | `.../children/index` | T-家长页 | 家长「我的孩子」；教师「我的」不展示该入口 |
| 31 | `.../profile-edit/index` | **T-入口** | 我的页头部设置齿轮 |
| 32 | `.../attendance-anomaly/index` | **T-入口** | 金刚「考勤异常」 |
| 33 | `.../renewal-reminder/index` | **T-入口** | 金刚「续费提醒」；系统设置阈值跳转 |

### A1.4 package-teacher（13 注册 + 1 死）

| # | 路由 | 教师 | 主入口路径 |
|---|------|------|------------|
| 34 | `.../teacher-list/index` | **T-拦截** | Manager；店铺管理 |
| 35 | `.../teacher-form/index` | **T-拦截** | list FAB/编辑 |
| 36 | `.../teacher-detail/index` | **T-拦截** | redirect → teacher-form |
| 37 | `.../salary-detail/index` | **T-深链/可进** | 守卫 STAFF；列表/发薪跳转；教师无「我的」直达 |
| 38 | `.../salary-adjust/index` | **T-拦截** | Manager |
| 39 | `.../attendance/index` | **T-深链** | STAFF；**redirect → records** |
| 40 | `.../salary-home/index` | **T-拦截** | Manager |
| 41 | `.../salary-payment/index` | **T-拦截** | 待办 type=salary 也会指这里 → **教师点待办被守卫拦截** |
| 42 | `.../salary-settings/index` | **T-拦截** | |
| 43 | `.../salary-form/index` | **T-拦截** | |
| 44 | `.../salary-template/index` | **T-拦截** | |
| 45 | `.../salary-template-form/index` | **T-拦截** | |
| 46 | `.../monthly-flow/index` | **T-入口** | 我的→教学台账；无守卫 |
| — | `.../staff-invite/index` | **死页** | **未注册 app.config**；零导航引用 |

### A1.5 package-course（25）

| # | 路由 | 教师 | 主入口路径 |
|---|------|------|------------|
| 47 | `.../booking/index` | **T-入口** | 三卡片「我的预约」；台账；课表预约标签；monthly-flow redirect |
| 48 | `.../my-course/index` | T-家长页 | 家长约课；教师非主路径 |
| 49 | `.../venue-booking/index` | **T-入口** | 课表场地卡；首页今日课 venue；booking 打开场地 |
| 50 | `.../course-management/index` | **T-拦截** | Manager；**待办 checkin 无 scheduleId 时默认 URL 指向此页 → 教师拦截** |
| 51 | `.../subject-management/index` | **T-拦截** | |
| 52 | `.../subject-form/index` | **T-拦截** | |
| 53 | `.../card-management/index` | **T-拦截** | |
| 54 | `.../card-form/index` | **T-拦截** | |
| 55 | `.../card-member-list/index` | **T-深链** | STAFF；仅 Manager 卡种管理可进；教师无入口 |
| 56 | `.../category-form/index` | **T-拦截** | |
| 57 | `.../course-form/index` | **T-拦截** | lesson-form 内可 navigate 班级编辑 → **教师点进会被守卫拦截** |
| 58 | `.../package-form/index` | **T-入口** | 金刚充值；学员列表快捷充值；无角色守卫 |
| 59 | `.../lesson-form/index` | **T-入口** | 课表点名/补录；三卡片快速消课；今日课；试听签到 |
| 60 | `.../lesson-supplement/index` | **T-入口** | lesson-detail「补录」；可回课表 |
| 61 | `.../lesson-detail/index` | **T-入口** | records / LessonConsumptionList / 首页记录点击 |
| 62 | `.../schedule-form/index` | **T-入口** | 课表编辑/新建 FAB；可跳 holidays |
| 63 | `.../booking-rule/index` | **T-深链** | 无守卫；**无 UI navigate**（仅 help 文案 id） |
| 64 | `.../teacher-booking-config/index` | **T-深链** | 无守卫；**无 UI navigate 引用** |
| 65 | `.../booking-record-detail/index` | **T-入口** | 课表团课预约条；booking；my-course |
| 66 | `.../batch-reschedule-select/index` | **T-入口** | 课表批量调课 |
| 67 | `.../batch-reschedule-confirm/index` | **T-入口** | select → confirm |
| 68 | `.../records/index` | **T-入口** | 金刚/台账/attendance redirect |
| 69 | `.../recharge-records/index` | **T-入口** | 金刚「充值记录」 |
| 70 | `.../leave-request/index` | **T-入口** | 课表请假入口；待办/深链 requestId；家长金刚有、教师金刚无但 Staff 可进 |
| 71 | `.../parent-lesson-notes/index` | T-家长页 | 家长作业/点评；教师深链可进 |

### A1.6 package-settings（31）

| # | 路由 | 教师 | 主入口路径 |
|---|------|------|------------|
| 72 | `.../campus-settings/index` | **T-深链** | 无守卫；StoreOnboarding「门店」仅 Manager 可见；教师可深链 |
| 73 | `.../campus-settings/sub-campus` | T-深链 | 校区设置子页 |
| 74 | `.../campus-settings/pay-day` | T-深链 | |
| 75 | `.../campus-settings/holidays` | **T-入口** | schedule-form「节假日」；Manager 店铺「停课放假」 |
| 76 | `.../campus-settings/subjects` | T-深链 | |
| 77 | `.../campus-settings/notify` | T-深链 | |
| 78 | `.../campus-settings/campus-data/index` | T-深链 | sub-campus / pay-day |
| 79 | `.../campus-detail/index` | **T-深链** | **全仓无 navigateTo**（仅注册） |
| 80 | `.../venue-list/index` | **T-拦截场景** | 店铺管理仅 Manager；教师无入口；无守卫则可深链 |
| 81 | `.../venue-form/index` | 同上 | venue-list 新增/编辑 |
| 82 | `.../room-form/index` | **T-深链** | **无 navigateTo 引用**（venue-form 自身当教室表单） |
| 83 | `.../system-settings/index` | **T-入口** | 我的→系统管理 |
| 84 | `.../developer-mode/index` | T-深链 | 版本号连点解锁 |
| 85 | `.../permission-settings/index` | **T-拦截** | 仅 admin |
| 86 | `.../permission-form/index` | **T-拦截/深链** | 未在 PAGE_ROLE；从 permission-settings 进 |
| 87 | `.../threshold-config/index` | **T-拦截** | 仅 admin；页内又 redirect 续费提醒 |
| 88 | `.../todo-settings/index` | **T-拦截** | Manager |
| 89 | `.../my-todos/index` | **T-入口** | 首页待办「更多」 |
| 90 | `.../todo-collaborator/index` | **T-入口** | 自定义待办选协作人（storage 桥） |
| 91 | `.../audit-log/index` | **T-入口** | 系统设置「操作日志」 |
| 92 | `.../theme-settings/index` | **T-入口** | 系统设置「主题颜色」（文档与矩阵不一致处见主报告） |
| 93 | `.../feedback/index` | **T-入口** | 系统管理「平台客服」；PUBLIC |
| 94 | `.../help/index` | **T-入口** | 系统管理「使用帮助」 |
| 95 | `.../notification-send/index` | **T-深链** | **无 UI navigate** |
| 96 | `.../agreement/index` | **T-入口** | 系统设置 / 登录注册协议 |
| 97 | `.../about/index` | **T-入口** | 我的底部关于；可进 store-entry（Manager） |
| 98 | `.../membership/index` | **T-拦截场景** | 我的会员卡仅 Manager |
| 99 | `.../store-entry/index` | **T-拦截** | Manager |
| 100 | `.../store-entry/pending/index` | **T-拦截** | Manager |
| 101 | `.../notifications/index` | **T-入口** | 首页消息铃铛；系统管理 |
| 102 | `.../message-auth/index` | **T-入口** | notifications 内订阅授权；subscribe-message 常量 |

### A1.7 package-statistics（6）— 全部 T-拦截

| # | 路由 | 教师 |
|---|------|------|
| 103-108 | alert-detail / finance-data / member-data / card-data / salary-data / record-transaction | **T-拦截** |

**例外风险**：待办 `alert` 类型 URL → `alert-detail`（`todo.ts` L291）。教师点预警待办 → **守卫拦截**。充值类走 student-detail，不受影响。

### A1.8 package-lead（15）

| # | 路由 | 教师 | 主入口路径 |
|---|------|------|------------|
| 109 | `.../my-invite/index` | **T-入口** | 金刚「意向学员」；待办 lead |
| 110 | `.../trial-records/index` | **T-入口** | 金刚「试听记录」 |
| 111 | `.../lead-form/index` | **T-入口** | my-invite 新增；学员列表转线索 |
| 112 | `.../lead-detail/index` | **T-入口** | LeadCard；trial-records；booking 试听 |
| 113 | `.../trial-booking/index` | **T-入口** | ScheduleBookingSwitch「约课」；lead-detail 代约确认；invite-landing |
| 114 | `.../proxy-booking-form/index` | **T-入口** | 课表代约；TrialBookingView；trial-slot-config |
| 115 | `.../proxy-member-select/index` | **T-入口** | proxy-booking-form 选会员 |
| 116 | `.../trial-slots/index` | **T-入口** | my-invite「时段」 |
| 117 | `.../trial-slot-config/index` | **T-入口** | TrialBookingView 配置入口 |
| 118 | `.../lead-booking-detail/index` | **T-深链** | 需核对是否仍有跳转；保留注册 |
| 119 | `.../lead-booking-edit/index` | **T-入口** | TrialBookingView 编辑预约 |
| 120 | `.../open-slot-edit/index` | **T-入口** | 课表开放时段左滑编辑 |
| 121 | `.../class-slot-config/index` | **T-入口** | 课表 `handleOpenClassSlotConfig` |
| 122 | `.../invite-qrcode/index` | **T-入口** | my-invite 邀约码 |
| 123 | `.../invite-landing/index` | 共用/分享 | 分享落地；Staff 已登录可回首页 |

**矩阵覆盖计数**：123/123 已注册页均已分类；+1 死页 `staff-invite`。

---

## A2. 教师主路径完整跳转树（入口 → 叶子）

### A2.1 首页树

```
Tab 首页
├─ KingKong 三卡片
│  ├─ 快速消课 → lesson-form
│  │              ├─ 提交消课 → switchTab 课表
│  │              └─ 编辑班级 → course-form?type=class  【教师：守卫拦截】
│  ├─ 我的预约 → booking
│  │              ├─ 打开试听 → lead-detail
│  │              ├─ 打开场地 → venue-booking
│  │              ├─ 打开家长约 → booking-record-detail
│  │              ├─ 团课签到 → lesson-form(+leadBookingId)
│  │              └─ 私教签到 → API（页内，无跳转）
│  └─ 学员管理 → students
│                 ├─ FAB 添加 → student-form
│                 │              └─ 保存后可选 → course-management【教师：拦截】
│                 ├─ 卡片 → student-detail
│                 │         ├─ 发卡 → member-card-issue
│                 │         ├─ 卡详情 → member-card-detail → member-card-edit
│                 │         ├─ 跟进 → follow-record-form
│                 │         ├─ 上课记录项 → lesson-detail
│                 │         ├─ 请假同意/拒绝 → leaveService（页内）
│                 │         └─ 退费提交 → 页内
│                 ├─ 快捷充值 → package-form?studentId=
│                 └─ 转线索 → lead-form
├─ KingKong 八宫格
│  ├─ 课时充值 → package-form
│  ├─ 添加学员 → student-form
│  ├─ 上课记录 → records → lesson-detail → (补录)lesson-supplement / (点名)lesson-form / (编辑)schedule-form
│  ├─ 试听记录 → trial-records → lead-detail
│  │                              ├─ 代约确认 → trial-booking
│  │                              └─ 班课签到 → lesson-form
│  ├─ 充值记录 → recharge-records（页内列表，无二级路由）
│  ├─ 考勤异常 → attendance-anomaly → student-detail
│  ├─ 续费提醒 → renewal-reminder → student-detail
│  └─ 意向学员 → my-invite
│                 ├─ 新增 → lead-form
│                 ├─ 二维码 → invite-qrcode
│                 ├─ 时段 → trial-slots → (配置)trial-slot-config → proxy-booking-form → proxy-member-select
│                 └─ 卡片 → lead-detail（同上）
├─ 消息铃铛 → notifications → message-auth
├─ 待办「更多」→ my-todos →（选协作人）todo-collaborator
├─ 待办卡片点击（按 type，见 A3）
├─ 今日课卡片 → TodayScheduleCard
│  ├─ venue → venue-booking
│  ├─ 试听班课 → lesson-form
│  ├─ tag 预约 → booking?date=
│  └─ 常规 → lesson-form(scheduleId…)
├─ 学员快链 StudentQuickList → students / student-detail
└─ 校区引导 → switchTab 我的
```

### A2.2 课表树

```
Tab 课表
├─ ScheduleBookingSwitch「约课」→ trial-booking
│     └─ TrialBookingView
│           ├─ 配置时段 → trial-slot-config
│           ├─ 代约表单 → proxy-booking-form → proxy-member-select
│           └─ 编辑预约 → lead-booking-edit
├─ 班课卡片
│  ├─ 主点击 → lesson-form（点名/补录/只读）
│  ├─ 约试听/补课 → BookTrialByClassSheet（页内 Sheet，可写 makeup）
│  ├─ 请假 → leave-request?studentId&lessonKey…
│  ├─ 左滑编辑 → schedule-form?id=
│  ├─ 调课/停课/取消/恢复 → 页内 API + Toast
│  └─ 补录入口 → lesson-form?action=supplement
├─ 团课开放时段
│  ├─ 代约 → proxy-booking-form
│  ├─ 配置 → class-slot-config
│  ├─ 编辑 → open-slot-edit
│  ├─ 预约记录条 → booking-record-detail
│  └─ 取消/休息/恢复 → 页内
├─ 私教 → TrialBookingView（同约课）
├─ 场地卡 → venue-booking?roomId=
├─ FAB 新建排课 → schedule-form?sourceMode=
│     └─ 节假日 → campus-settings/holidays
└─ 批量调课/删除 → batch-reschedule-select → batch-reschedule-confirm
```

### A2.3 我的树（教师）

```
Tab 我的
├─ 头部设置 → profile-edit（可注销 → login）
├─ ProfileStats（恒 0，无跳转）
├─ 教学台账
│  ├─ 课时流水 → monthly-flow?tab=lessons
│  ├─ 工资记录 → monthly-flow?tab=salary
│  ├─ 我的预约 → booking
│  └─ 上课记录 → records
│  monthly-flow 内 Tab「我的预约」→ redirect booking
├─ 营销×4 → Toast 占位（无路由）
├─ 系统管理
│  ├─ 使用帮助 → settings/help → feedback
│  ├─ 平台客服 → feedback
│  ├─ 消息通知 → notifications → message-auth
│  └─ 系统设置 → system-settings
│        ├─ 操作日志 → audit-log
│        ├─ 主题颜色 → theme-settings
│        ├─ 用户协议 → agreement
│        ├─ 同步日历 → 页内开关
│        ├─ 开发者模式 → developer-mode →（可跳）profile-setup/onboarding/login…
│        └─ 退出 → reLaunch login
└─ 关于 → about（门店入驻按钮对教师：进 store-entry 会被守卫拦截）
```

**教师不可见但代码存在**：店铺管理 / 会员卡 / StoreOnboarding 七步（campus/venue/staff/course/subject/package/salary）— 均 Manager。

---

## A3. 待办驱动路径（原先遗漏）

来源：`services/todo.ts` `TODO_TYPE_URL` + `map` 逻辑 L238-246

| 待办 type | 目标 URL | 教师点击实际 |
|-----------|----------|--------------|
| checkin + 有 scheduleId | `lesson-form?scheduleId&classId&lessonDate` | ✓ 可进点名 |
| checkin **无** scheduleId | `COURSE_MANAGEMENT_CLASS_TAB_URL` → **course-management** | **守卫拦截（阻塞）** |
| recharge / alert-recharge | `student-detail?id=` | ✓ |
| salary | `salary-payment` | **守卫仅 Manager → 拦截（阻塞）** |
| lead | `my-invite` | ✓ |
| alert（经营预警） | `alert-detail?alertId=` | **统计守卫拦截（阻塞）** |
| meeting | 无固定 URL（undefined） | Toast/无跳或空 |

---

## A4. Redirect / 兼容路径（原先遗漏）

| 起点 | 行为 | 终点 | 依据 |
|------|------|------|------|
| `attendance` | redirectTo | `records` | attendance/index.tsx L13 |
| `monthly-flow?tab=bookings` | redirectTo | `booking` | monthly-flow L61-64 |
| `monthly-flow?tab=attendance` | 映射 tab | `lessons` | monthly-flow L36-37 |
| `teacher-detail?id=` | redirectTo | `teacher-form?id=` | teacher-detail L13-17 |
| `threshold-config` | navigate | `renewal-reminder` | threshold-config L15-21 |
| 越权任意页 | switchTab | `home` | route-guard L185 |
| 401 | redirectTo | `login` | request.ts |

---

## A5. 零入口但仍注册的「幽灵页」（教师侧）

以下页面在 `app.config` 注册，**全仓无 `navigateTo`/`redirectTo` 指向**（或仅注释/帮助文案），教师只能靠手动拼 URL / 开发者工具进入：

| 路由 | 守卫 | 风险 |
|------|------|------|
| `student-transfer` | STAFF | 转校功能无入口，功能完整性缺口 |
| `booking-rule` | 无 | 配置页孤立 |
| `teacher-booking-config` | 无 | 配置页孤立 |
| `campus-detail` | 无 | 孤立 |
| `room-form` | 无 | 与 venue-form 职责重叠/孤立 |
| `notification-send` | 无 | 孤立 |
| `lead-booking-detail` | 无 | 可能被 lead-booking-edit 替代，需产品确认 |
| `staff-invite`（未注册） | — | 死代码 |

---

## A6. 补全后的交互走查记录（先前报告未展开页）

格式统一：**走查路径 / 预期 / 实际**。

### A6.1 `student-form` 保存后跳转

| 项 | 内容 |
|----|------|
| **走查路径** | 首页→添加学员→填表保存；或表单内引导去班级 |
| **预期** | 保存成功返回列表或进入可选班级 |
| **实际** | `useStudentForm.ts` L607：`navigateTo(COURSE_MANAGEMENT_CLASS_TAB_URL)` → **course-management（Manager）**；教师触发则 **无权限回首页** |

### A6.2 `lesson-form` → `course-form`

| 项 | 内容 |
|----|------|
| **走查路径** | 点名页内编辑班级入口 |
| **预期** | 教师可改所带班信息，或按钮隐藏 |
| **实际** | L2844-2845 navigate course-form；守卫 MANAGER → **教师拦截** |

### A6.3 `schedule-form` → `holidays`

| 项 | 内容 |
|----|------|
| **走查路径** | 课表→编辑/新建排课→节假日 |
| **预期** | 查看/配置停课日 |
| **实际** | schedule-form L808-809 → `campus-settings/holidays`；无角色守卫，教师可进 |

### A6.4 `batch-reschedule-*`

| 项 | 内容 |
|----|------|
| **走查路径** | 课表→批量调课→选班→确认 |
| **预期** | 完成批量调课返回课表 |
| **实际** | select L210-211 → confirm；数据 `temporaryRescheduleService` |

### A6.5 `venue-booking`

| 项 | 内容 |
|----|------|
| **走查路径** | 课表场地 Tab / 今日课 venue / booking 打开 |
| **预期** | 场地预约详情与操作 |
| **实际** | 页内操作；无再跳其它业务页（检索无 navigateTo） |

### A6.6 `recharge-records`

| 项 | 内容 |
|----|------|
| **走查路径** | 金刚「充值记录」 |
| **预期** | 充值流水列表，可下钻学员/课包 |
| **实际** | 页面内列表；**无二级 navigateTo**（需确认是否仅展示） |

### A6.7 `notifications` → `message-auth`

| 项 | 内容 |
|----|------|
| **走查路径** | 首页铃铛 / 系统管理→消息 → 订阅授权 |
| **预期** | 配置微信订阅消息 |
| **实际** | notifications L262 → `subscribeMessageService.messageAuthPageUrl` |

### A6.8 `my-todos` / `todo-collaborator`

| 项 | 内容 |
|----|------|
| **走查路径** | 首页待办更多→我的待办→添加自定义待办选协作人 |
| **预期** | 选人后回待办表单 |
| **实际** | `todo-collaborator-select.ts` PAGE_PATH；storage 回传 |

### A6.9 `profile-edit`

| 项 | 内容 |
|----|------|
| **走查路径** | 我的→齿轮 |
| **预期** | 改头像昵称等；可退出登录 |
| **实际** | 可 `reLaunch` login（L260）；含孩子入口时进 child-detail（家长向） |

### A6.10 `leave-request`（课表入口）

| 项 | 内容 |
|----|------|
| **走查路径** | 课表卡片请假按钮 → `leave-request?...` |
| **预期** | 教师审批或查看该课相关请假 |
| **实际** | schedule L2251-2252、L2320-2321；Staff 模式列表审批（见主报告 B3） |

### A6.11 `trial-booking` / `proxy-*` / `open-slot-edit` / `class-slot-config`

| 项 | 内容 |
|----|------|
| **走查路径** | 课表约课切换或团课操作 |
| **预期** | 完成试听/代约/时段配置 |
| **实际** | 路径见 A2.2；均无角色守卫，教师可进 |

### A6.12 `invite-qrcode` / `invite-landing`

| 项 | 内容 |
|----|------|
| **走查路径** | my-invite→二维码；外部扫码→landing |
| **预期** | 生成邀请；落地注册/约课 |
| **实际** | invite-qrcode 页内；landing 可 switchTab home / trial-booking |

### A6.13 `audit-log` / `theme-settings` / `agreement` / `about` / `feedback` / `help`

| 项 | 内容 |
|----|------|
| **走查路径** | 系统设置 / 系统管理对应项 |
| **预期** | 各自功能页 |
| **实际** | 均可进入；about→store-entry 对教师拦截；help→feedback |

### A6.14 `developer-mode`

| 项 | 内容 |
|----|------|
| **走查路径** | 系统设置连点版本号→密码→开发者页 |
| **预期** | 调试跳转 |
| **实际** | 可 navigate profile-setup / onboarding / parent-onboarding / login |

### A6.15 `salary-detail`（教师深链）

| 项 | 内容 |
|----|------|
| **走查路径** | 拼 URL `salary-detail?id=` 或管理端发薪跳转 |
| **预期** | 看本人工资单 |
| **实际** | 守卫 STAFF 可进；流水仍 Mock（主报告 S1）；无「我的」入口 |

### A6.16 `card-member-list`（教师深链）

| 项 | 内容 |
|----|------|
| **走查路径** | 仅 Manager 卡种管理→会员列表；或深链 |
| **预期** | STAFF 可看持卡会员 |
| **实际** | 守卫 STAFF；列表→student-detail（L136-137） |

### A6.17 `student-transfer`（幽灵）

| 项 | 内容 |
|----|------|
| **走查路径** | 无正式入口；手动打开 |
| **预期** | 学员转校/转班 |
| **实际** | 守卫 STAFF 可进；**产品链路断裂** |

### A6.18 `booking-rule` / `teacher-booking-config`（幽灵）

| 项 | 内容 |
|----|------|
| **走查路径** | 无入口 |
| **预期** | 配置约课规则 / 教师约课配置 |
| **实际** | 页存在；与 `booking-rules` 本地存储相关；教师无法从 UI 到达 |

### A6.19 家长向页教师深链（`my-course` / `children` / `child-detail` / `parent-lesson-notes` / `parent-bind`）

| 项 | 内容 |
|----|------|
| **走查路径** | 手动 URL 或错误分享 |
| **预期** | 应拒绝或无数据 |
| **实际** | 多数无 STAFF/PARENT 互斥守卫 → **教师可进家长页**（数据层可能空）；合理性风险 |

### A6.20 Manager 全拦截簇（教师点击结果统一）

走查路径：待办 salary/alert、添加学员后去班级、点名页编辑班级、深链 statistics/*、salary-*（除 detail）、teacher-list/form、course/subject/card 配置、store-entry、permission、todo-settings、threshold-config  

| **预期** | 无入口或明确无权限 |
| **实际** | `redirectToForbidden`：Toast + switchTab 首页（route-guard L181-188） |

---

## A7. 新发现问题（路径补全发现，并入主清单）

| ID | 等级 | 问题 | 依据 |
|----|------|------|------|
| B6 | 阻塞 | 待办 checkin 缺 scheduleId 时跳转 course-management，教师无权限 | `todo.ts` L101-104、L238-246；`course-category-ui.ts` L16-17；route-guard L81 |
| B7 | 阻塞 | 待办 salary → salary-payment，教师无权限 | `todo.ts` L102；route-guard L58 |
| B8 | 阻塞 | 待办 alert → alert-detail，教师无权限 | `todo.ts` L291；route-guard L96 |
| B9 | 阻塞 | 学员表单保存后可跳 course-management，教师无权限 | `useStudentForm.ts` L607 |
| S10 | 严重 | lesson-form 提供跳转 course-form，教师点入被拦 | lesson-form L2844-2845 |
| S11 | 严重 | `student-transfer` / `booking-rule` / `teacher-booking-config` / `campus-detail` / `room-form` / `notification-send` 零入口 | 全仓 grep 无 navigate |
| G13 | 一般 | 教师可深链进入家长页（my-course/children/…）缺互斥守卫 | PAGE_ROLE 未列 |
| G14 | 一般 | salary-detail 教师可进但「我的」无入口，发现性差 | profile 台账无工资单直达 |
| A9 | 建议 | 幽灵页注册清理或补入口 | app.config |

**更新后问题统计建议**：阻塞 **9** / 严重 **11** / 一般 **14** / 建议 **9**

---

## A8. 覆盖验收清单

- [x] `app.config.ts` 123 页逐条分类（A1）
- [x] 未注册死页 staff-invite
- [x] Tab / 金刚 / 三卡片 / 我的 / 课表 FAB 与左滑
- [x] 待办全部 type 跳转（A3）
- [x] 全部 redirect 兼容链（A4）
- [x] 零入口幽灵页列出（A5）
- [x] 守卫拦截页统一结论（A6.20）
- [x] 家长页教师深链风险（A6.19）
- [x] StoreOnboarding 七步仅 Manager（A2.3）
- [x] 分享落地 invite-landing

---

## A9. 与主报告关系

- 主报告 §2 保留「重点页」深度字段/接口走查。  
- **本附录保证路径空间穷尽**；主报告问题清单应合并 A7 新增 ID。  
- 真机冒烟建议：用 Mock 切 `teacher1`，按 A2 树点一遍 + 故意点 A3 三条阻塞待办验证 B6–B8。

*静态路径穷尽；运行时动态 `item.url` 若后端下发未在 TODO_TYPE 枚举内的地址，需以接口契约二次核对。*
