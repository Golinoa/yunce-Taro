# 家长端全量路径覆盖补全（附录）

> **配套主报告**：[2026-08-31-parent-app-joint-walkthrough.md](./2026-08-31-parent-app-joint-walkthrough.md)  
> **补全日期**：2026-08-31  
> **目标**：对 `app.config.ts` **全部 123 个已注册页面** + 已知死页/断链入口，按家长角色（`parent`）给出可达性判定与完整走查路径；覆盖 Tab、金刚区、「我的」、课表、登录注册、分享落地、深链、守卫拦截全部可能性。  
> **依据**：`app.config.ts`、`route-guard.tsx`（`PUBLIC_PAGES` / `PAGE_ROLE_REQUIREMENTS` / `withRouteGuard`）、`auth-onboarding.ts`、`home-ui.ts`、全仓 `navigateTo`/`redirectTo`/`switchTab`/`reLaunch` 静态检索。

---

## A0. 覆盖口径

| 代号 | 含义 |
|------|------|
| **P-入口** | 家长可通过 Tab / 金刚区 /「我的」/ 课表 / 正常认证流点到 |
| **P-公开** | `PUBLIC_PAGES`；未登录亦可进（或页内再门禁） |
| **P-深链** | 已登录家长：未列入 `PAGE_ROLE_REQUIREMENTS`（或页未挂 `withRouteGuard`）→ 可 URL 直达；**无家长 UI 入口** |
| **P-拦截** | 已挂 `withRouteGuard` 且矩阵不含 `parent` → Toast「无权限」并回首页 |
| **P-断链** | 已注册，但**全仓无导航入口**（或仅遗留代码可达） |
| **P-隐藏入口** | UI 对家长 `hideForParent` / `!isStaff` 隐藏，但深链仍可能进 |
| **死页** | 源码存在但未注册 app.config，或零引用 |

**「百分百」定义**：每一个已注册路由至少出现在下方矩阵一次，并标注家长侧结果。主路径按「入口 → 页面 → 下一跳」穷尽代码跳转边；认证流、query 分支、组件级无路由交互单列。

---

## A1. 全量页面可达性矩阵（123）

### A1.1 Tab 主包（4）

| # | 路由 | 家长 | 说明 |
|---|------|------|------|
| 1 | `/pages/home/index` | **P-入口** | Tab；`withRouteGuard`；`isParentRole` 金刚区 |
| 2 | `/pages/schedule/index` | **P-入口** | Tab；家长过滤班级；无排课 FAB |
| 3 | `/pages/statistics/index` | **P-拦截** | `MANAGER_ROLES`；TabBar 家长不渲染 |
| 4 | `/pages/profile/index` | **P-入口** | Tab；`!isStaffRole` 家长网格 |

### A1.2 package-auth（14）

| # | 路由 | 家长 | 走查路径（预期 → 实际） |
|---|------|------|-------------------------|
| 5 | `/package-auth/pages/index/index` | P-深链 | 有 `withRouteGuard`；**无家长日常入口** |
| 6 | `/package-auth/pages/login/index` | **P-公开** | 未登录守卫 redirect；成功 → `navigateAfterAuth` |
| 7 | `.../login/forgot-account/index` | **P-公开 / P-断链** | PUBLIC；**全仓无 navigateTo**（LoginIssueSheet 未挂载） |
| 8 | `.../login/forgot-password/index` | **P-公开** | 登录「找回密码」L214 → 重置 → back/redirect 登录 |
| 9 | `.../login/contact-support/index` | **P-公开 / P-断链** | PUBLIC；**无 UI 入口** |
| 10 | `/package-auth/pages/register/index` | **P-公开** | 登录「注册」→ 邮箱码注册 → `navigateAfterAuth` |
| 11 | `.../register/role-select` | **P-公开 / P-断链** | PUBLIC；含 parent 选项；**现行注册不调用 `signUpStep1`** |
| 12 | `.../register/role-info` | **P-公开 / P-断链** | 遗留家长「学生邀请码」；仅 role-select 可达 |
| 13 | `.../profile-setup/index` | **P-入口** | `needsProfileSetup` → redirect；完成后 `navigateAfterProfileSetup` |
| 14 | `.../onboarding/index` | **P-入口** | 老家长未绑定 `needsOnboarding`；「绑定孩子」→ parent-onboarding；「门店入驻」→ store-entry（**随后 P-拦截**） |
| 15 | `.../identity-select/index` | **P-入口** | 新用户；「绑定机构」→ parent-onboarding；「门店入驻」→ store-entry（**P-拦截**） |
| 16 | `.../parent-onboarding/index` | **P-入口** | 邀请码绑定；成功 `navigateAfterLogin`；**无 withRouteGuard** |
| 17 | `.../role-switch/index` | **P-深链** | 多身份时 `navigateAfterLogin` 可进；首页/我的 Sheet **从未 setVisible(true)** |
| 18 | `.../role-switch/add-role` | **P-深链** | 自 role-switch；可选「我是家长」+ studentCode → `reLaunch` home |

### A1.3 package-student（15）

| # | 路由 | 家长 | 主入口路径 |
|---|------|------|------------|
| 19 | `.../students/index` | **P-拦截** | STAFF；金刚/我的不展示 |
| 20 | `.../student-detail/index` | **P-拦截** | STAFF |
| 21 | `.../student-form/index` | **P-拦截** | STAFF |
| 22 | `.../student-transfer/index` | **P-拦截** | STAFF；且全仓几乎无入口 |
| 23 | `.../parent-bind/index` | **P-公开** | 分享 `?studentId&token=`；未登录→login；绑定后 switchTab home |
| 24 | `.../member-card-issue/index` | **P-拦截** | STAFF |
| 25 | `.../member-card-detail/index` | **P-深链** | 有 guard、**矩阵未列** → 登录家长深链可进 |
| 26 | `.../member-card-edit/index` | **P-拦截** | STAFF |
| 27 | `.../follow-record-form/index` | **P-拦截** | STAFF |
| 28 | `.../help/index` | **P-入口** | 我的「使用帮助」；**无 withRouteGuard** |
| 29 | `.../child-detail/index` | **P-入口** | ParentHoursSection；**profile-edit 子女卡**；children 列表**不跳转**；无 guard |
| 30 | `.../children/index` | **P-入口** | 金刚「成长档案」/ 我的孩子卡；无 guard |
| 31 | `.../profile-edit/index` | **P-入口** | 我的齿轮；子女 Tab→child-detail；「添加子女」→ `studentService.create`（**BE 仅 TEACHER → 生产 403**）；无 guard |
| 32 | `.../attendance-anomaly/index` | **P-拦截** | STAFF |
| 33 | `.../renewal-reminder/index` | **P-拦截** | STAFF |

### A1.4 package-teacher（13）+ 死页

| # | 路由 | 家长 | 说明 |
|---|------|------|------|
| 34-36 | teacher-list / form / detail | **P-拦截** 或无入口深链 | list/form 多无 withRouteGuard+矩阵 Manager → **深链风险**；detail redirect form |
| 37 | salary-detail | **P-拦截**（若挂 STAFF 守卫）/ 深链 | 矩阵 STAFF |
| 38-45 | salary-* / attendance / templates | **P-拦截** 或深链 | 见矩阵；家长无 UI |
| 46 | monthly-flow | **P-深链** | 无角色矩阵；教师「台账」入口家长不可见 |
| — | staff-invite | **死页** | 未注册 app.config |

### A1.5 package-course（25）

| # | 路由 | 家长 | 主入口路径 |
|---|------|------|------------|
| 47 | `.../booking/index` | **P-深链** | 机构「我的预约」；`canAccessMyBookings` 仅 Staff；有 guard 无角色矩阵 |
| 48 | `.../my-course/index` | **P-入口** | 我的四态 `?tab=`；卡包误跳无 tab |
| 49 | `.../venue-booking/index` | **P-入口** | 课表场地卡 `?roomId=` |
| 50 | `.../course-management/index` | **P-深链** | 矩阵 Manager 但**页未 withRouteGuard** → 深链可进 |
| 51-57 | subject-* / card-* / category / course-form | **P-拦截或深链** | 矩阵有但部分未挂 HOC（见主报告 B3） |
| 58 | `.../package-form/index` | **P-深链** | 有 guard、**矩阵未列** → 家长深链可充值页 |
| 59 | `.../lesson-form/index` | **P-深链** | 有 guard、矩阵未列 → 深链可进消课表单 |
| 60 | `.../lesson-supplement/index` | **P-深链** | 同上 |
| 61 | `.../lesson-detail/index` | **P-入口** | notes/records → `?id=`；家长只读 |
| 62 | `.../schedule-form/index` | **P-深链** | 有 guard、矩阵未列 |
| 63 | `.../booking-rule/index` | **P-深链 / 断链** | 无家长 UI；几乎无 navigate |
| 64 | `.../teacher-booking-config/index` | **P-深链 / 断链** | 无 UI navigate |
| 65 | `.../booking-record-detail/index` | **P-入口** | my-course 详情；课表团课详情 `?id=` |
| 66-67 | batch-reschedule-* | **P-深链** | 有 guard、矩阵未列；课表 FAB 家长不渲染 |
| 68 | `.../records/index` | **P-入口** | 金刚/课程足迹；可选 `?studentId=` |
| 69 | `.../recharge-records/index` | **P-深链** | 有 guard、矩阵未列 |
| 70 | `.../leave-request/index` | **P-入口** | 金刚；课表请假带 `studentId&lessonKey&classId`；教师审批同页非家长主路径 |
| 71 | `.../parent-lesson-notes/index` | **P-入口** | `?type=homework\|comments` |

### A1.6 package-settings（31）

| # | 路由 | 家长 | 主入口路径 |
|---|------|------|------------|
| 72-78 | campus-settings* | **P-深链 / 隐藏** | 无家长入口；多数无角色矩阵 |
| 79 | campus-detail | **P-断链** | 全仓几乎无 navigate |
| 80-82 | venue-list / venue-form / room-form | **P-深链** | 店铺管理仅 Staff UI |
| 83 | system-settings | **P-入口** | 我的「账号设置」；`hideForParent` 过滤 |
| 84 | developer-mode | **P-隐藏入口** | 家长版本号 `onClick={undefined}`；深链仍可开 |
| 85 | permission-settings | **P-拦截** | 仅 admin |
| 86 | permission-form | **P-深链** | 未进矩阵 |
| 87 | threshold-config | **P-拦截** | 仅 admin |
| 88 | todo-settings | **P-拦截** | Manager |
| 89 | my-todos | **P-深链** | 有 guard、矩阵未列；首页「更多」待办仅 Staff 渲染 |
| 90 | todo-collaborator | **P-深链** | 自定义待办协作人 |
| 91 | audit-log | **P-深链** | hideForParent；**无 withRouteGuard、不在矩阵** |
| 92 | theme-settings | **P-入口** | 系统设置「主题颜色」 |
| 93 | feedback | **P-公开 + 入口** | 我的客服；help「去反馈」 |
| 94 | help（settings） | **P-深链** | 教师帮助；家长走 student/help |
| 95 | notification-send | **P-深链** | 无家长 UI |
| 96 | agreement | **P-公开 + 入口** | 设置/登录注册；`?type=user\|privacy` |
| 97 | about | **P-公开 + 入口** | 我的关于；可点门店入驻 → **随后 P-拦截** |
| 98 | membership | **P-深链** | 有 guard、矩阵未列；UI 仅 Manager |
| 99-100 | store-entry* | **P-拦截** | Manager；identity-select 有按钮但守卫拦 |
| 101 | notifications | **P-入口** | 首页铃铛；我的消息；`PARENT_NOTIFY_GROUPS` |
| 102 | message-auth | **P-入口** | notifications 内「补充发送次数」 |

### A1.7 package-statistics（6）— 全部 P-拦截

| # | 路由 | 家长 |
|---|------|------|
| 103-108 | alert-detail / finance-data / member-data / card-data / salary-data / record-transaction | **P-拦截**（`MANAGER_ROLES`） |

### A1.8 package-lead（15）

| # | 路由 | 家长 | 主入口路径 |
|---|------|------|------------|
| 109 | my-invite | **P-深链** | 无 guard；家长无入口 |
| 110 | trial-records | **P-深链** | 有 guard、页内 Staff；家长无入口 |
| 111-112 | lead-form / lead-detail | **P-深链** | 无 guard |
| 113 | trial-booking | **P-深链** | 机构约课；家长私教走 trial-slot-config |
| 114-115 | proxy-booking-form / proxy-member-select | **P-深链** | 代约；家长模式隐藏 |
| 116 | trial-slots | **P-深链** | |
| 117 | trial-slot-config | **P-入口** | 课表私教 → `?teacherId=&from=parent` |
| 118-122 | lead-booking-* / open-slot-edit / class-slot-config / invite-qrcode | **P-深链** | 无家长 UI |
| 123 | invite-landing | **P-公开** | 分享落地；Staff 已登录拦截回首页；家长/游客可走页内微信登录 |

**矩阵覆盖计数**：**123/123** 已注册页均已分类；+1 死页 `staff-invite`（教师附录已记）。

---

## A2. 家长主路径完整跳转树

### A2.1 认证 → 家长身份（现行）

```
未登录任意守卫页
 └─ redirect → login
      ├─ 协议勾选 / AgreementDialog → agreement?type=user
      ├─ 注册 → register → navigateAfterAuth
      ├─ 找回密码 → forgot-password → login
      ├─ forgot-account / contact-support 【断链：无入口】
      └─ 登录成功 → navigateAfterAuth (auth-onboarding.ts)
           ├─ needsProfileSetup → profile-setup → navigateAfterProfileSetup
           ├─ 新用户 + pendingInvite → navigateAfterLogin → home（RelationConfirmSheet）
           ├─ 新用户 → identity-select
           │            ├─ 绑定机构 → parent-onboarding → navigateAfterLogin → home
           │            └─ 门店入驻 → store-entry 【P-拦截】
           ├─ needsOnboarding(parent) → onboarding
           │            ├─ 绑定孩子 → parent-onboarding
           │            ├─ 门店入驻 → store-entry 【P-拦截】
           │            └─ 跳过 → navigateAfterLogin
           └─ 多身份 → role-switch → add-role? → reLaunch home
```

**遗留断链**：`register/role-select` → `role-info?role=parent`（可选 studentCode）— 代码在，现行邮箱注册不进入。

**分享公开链**：

```
parent-bind?studentId&token=
 ├─ 未登录 → login（可回跳）
 ├─ 非 parent → Toast
 └─ 确认绑定 → bindParent(mock) → switchTab home

invite-landing?...&type=...
 ├─ Staff 已登录 → 拦截回 home
 └─ 游客/家长 → 页内登录 → 试听券/表单/成功 → home
```

### A2.2 Tab 首页树

```
Tab 首页 (parent)
├─ 铃铛 → notifications → message-auth
├─ CampusSelectSheet（无路由，改 campusId）
├─ WechatBindReminder → WechatBindDialog（无路由）
├─ RelationConfirmSheet → organization.saveRelation（无路由）
├─ RoleSwitchSheet 【无打开入口】
├─ KingKong 8 格
│  ├─ 请假调课 → leave-request
│  │              ├─（可选预填）?studentId&lessonKey&classId
│  │              ├─ Mock：请假|调课 + makeup 本地
│  │              ├─ 非 Mock：仅请假；调课 Toast
│  │              └─ 提交成功 → navigateBack
│  ├─ 我要约课 → switchTab schedule
│  ├─ 我的课表 → #parent-schedule（页内滚动）
│  ├─ 我的课时 → #parent-hours（页内滚动）
│  ├─ 上课记录 → records[?studentId=] → lesson-detail?id=
│  ├─ 课后作业 → parent-lesson-notes?type=homework → lesson-detail
│  ├─ 课堂点评 → parent-lesson-notes?type=comments → lesson-detail
│  └─ 成长档案 → children
│                 ├─ 邀请亲属 Modal（复制邀请码，占位）
│                 ├─ 【不跳转 child-detail】
│                 └─ 空态 → switchTab profile / navigateBack
├─ ParentScheduleSection → switchTab schedule
└─ ParentHoursSection
   ├─ 有孩 → child-detail?id=&tab=packages
   └─ 无孩 → children
```

### A2.3 Tab 课表树

```
Tab 课表 (isParent)
├─ Tab：班课 | 团课 | 私教 | 场地（页内 state，无路由 query）
├─ 班课卡 /「请假」→ leave-request?studentId&lessonKey&classId
├─ 团课
│  ├─ 预约 → classBookingService.addBookingRecord + upsertParentBooking
│  ├─ 取消 → removeBookingRecord + 本地
│  └─ 详情 → booking-record-detail?id= → 本地履约 / navigateBack / E25
├─ 私教 TrialBookingView
│  └─ → trial-slot-config?teacherId=&from=parent
│         └─ 预约 → upsertParentBooking → navigateBack 【无后端】
├─ 场地卡 → venue-booking?roomId=
│            └─ 提交 → venueBookingService（路径错位）→ navigateBack / E23
└─ 排课 FAB 【不渲染】
```

### A2.4 Tab「我的」树

```
Tab 我的 (!isStaffRole)
├─ 齿轮 → profile-edit
│          ├─ Tab 个人资料（本地/资料更新）
│          ├─ Tab 子女
│          │   ├─ 卡片 → child-detail?id=
│          │   │          ├─ Tab guardians | packages | records
│          │   │          ├─ 复制邀请码 / 邀请家人
│          │   │          └─ packages → packageService.getByStudent 【PARENT 403】
│          │   └─ 添加子女 → studentService.create 【BE 仅 TEACHER → 403】
│          └─ 退出 → reLaunch login
├─ 孩子卡 0 孩 → 绑定 Sheet → findByInviteCode+bindParent 【恒 mock】
├─ 孩子卡有孩 → children
├─ 已预约|排队|待评价|已取消 → my-course?tab=
│                              ├─ 详情 → booking-record-detail
│                              ├─ 取消 → myCourseService.cancel（本地）
│                              └─ 评价 → EvaluateSheet 模拟提交
├─ 我的卡包 → my-course 【错链，应为 child-detail packages】
├─ 排行榜|积分 → Toast 占位
├─ 课程足迹 → records
├─ 使用帮助 → student/help → feedback
├─ 平台客服 → feedback
├─ 消息通知 → notifications → message-auth
├─ 账号设置 → system-settings
│              ├─ 主题 → theme-settings
│              ├─ 协议 → agreement
│              ├─ 退出 → reLaunch login
│              ├─ developer-mode 【家长入口禁用】
│              └─ 操作日志等 hideForParent 【深链仍可 audit-log】
├─ 关于 → about → store-entry【P-拦截】/ share
├─ WechatBindReminder
└─ RoleSwitchSheet 【无打开入口】
```

### A2.5 订阅消息触点（无独立业务页，须覆盖）

| 触点 | 事件/行为 | 证据 |
|------|-----------|------|
| 登录后 opt-in | `markLoginOptInPending` | auth-onboarding |
| profile 绑定成功 | `runFlow('E03')` | profile L215 |
| my-course 取消 | `runFlow('E25')` | my-course |
| booking-record-detail | E25 | booking-detail |
| venue-booking 提交 | `runFlow('E23')` | venue-booking |
| notifications → message-auth | 补充额度 | notifications L262 |
| invite-landing | 页内协议+订阅 | invite-landing |

---

## A3. Query / 条件分支全表（同一页多模式）

| 页面 | 参数 / 条件 | 家长行为 |
|------|-------------|----------|
| leave-request | `studentId`,`lessonKey`,`classId` | 预填申请 |
| leave-request | `isStaffRole` / `requestId` | 教师审批（非家长主路径） |
| leave-request | `isUseMock` | 是否展示调课 |
| parent-lesson-notes | `type=homework\|comments` | 过滤 homework / performance |
| my-course | `tab=booked\|waiting\|pending_evaluate\|cancelled` | 初始 Tab |
| child-detail | `id` 必填；`tab=guardians\|packages\|records` | 缺 id toast |
| records | `studentId` | 指定孩；否则仅第一孩 |
| booking-record-detail | `id` + fallback query | 本地 booking 展示 |
| trial-slot-config | `from=parent`,`teacherId` | 本地私教约 |
| venue-booking | `roomId` | 场地详情预约 |
| agreement | `type=user\|privacy` | 文案分支 |
| invite-landing | `t,c,type,guest,date,start,end…` | 分享落地全套 |
| parent-bind | `studentId`,`token` | 公开绑定 |
| schedule | Tab class/group/private/venue | 页内；无 URL |
| profile | `students.length===0` | 绑定 Sheet vs children |
| system-settings | hideForParent / managerOnly | 列表过滤 |
| notifications | isParentRole | PARENT_NOTIFY_GROUPS |
| login/register | 协议未勾 | AgreementDialog 拦截 |

---

## A4. 组件级路径（无独立路由，必须走查）

| 组件 | 挂载页 | 行为 | 下一跳 |
|------|--------|------|--------|
| KingKongSection | home | 8 格导航 | 见 A2.2 |
| ParentScheduleSection | home | 今日课 | switchTab schedule |
| ParentHoursSection | home | 课时/卡包 | child-detail / children |
| CampusSelectSheet | home | 切换校区 | 无 |
| RelationConfirmSheet | home | 选关系 saveRelation | 无 |
| WechatBindReminder | home / profile | 绑手机 Dialog | 无 |
| RoleSwitchSheet | home / profile | **不可打开** | — |
| TrialBookingView | schedule | isParent | trial-slot-config |
| EvaluateSheet | my-course | 评价提交模拟 | 无 |
| custom-tab-bar | 全局 | 三 Tab | home/schedule/profile |
| AgreementDialog | login/register | 协议 | agreement |

---

## A5. 相对主报告的补全清单（原遗漏）

| 类别 | 补全项 |
|------|--------|
| 页面 | profile-edit、profile-setup、message-auth、forgot-password、invite-landing、agreement query、settings/help（非主入口）、auth index |
| 断链公开页 | forgot-account、contact-support、register/role-select、role-info |
| 交互 | WechatBindReminder、RelationConfirmSheet、EvaluateSheet、CampusSelectSheet、协议勾选、订阅 runFlow、TabBar |
| 替代入口 | **profile-edit → child-detail**（children 列表反而不进） |
| 新阻塞 | profile-edit「添加子女」`POST /students` 仅 TEACHER（`student.routes.ts` L155） |
| 深链全集 | A1 中所有 **P-深链** 行（lesson-form、package-form、audit-log、lead 写页等） |
| 认证树 | A2.1 现行链 + 遗留链 + 分享链 |

---

## A6. 百分百冒烟清单（按树执行）

### 认证（必须全绿或全记缺陷）

1. 冷启动未登录 → login  
2. 登录协议未勾 → Dialog；勾选 → agreement?type=user  
3. 注册 → navigateAfterAuth → profile-setup（若需要）→ identity-select → parent-onboarding → home + RelationConfirm  
4. 老家长 unbound → onboarding → 绑定 / 跳过  
5. 找回密码闭环  
6. 深开 forgot-account / contact-support（预期：能开但无入口）  
7. parent-bind 未登录/非家长/缺 token/成功四态  
8. invite-landing 游客登录成功  

### Tab 与金刚（8+组件）

9. 首页 8 格逐一点 + 锚点滚动  
10. Campus / Wechat / RelationConfirm  
11. 课表四 Tab × 请假/约/取消/详情/私教/场地  
12. 我的全部宫格含占位 Toast、错链卡包、绑定 Sheet  

### 业务叶子

13. leave-request 无参 / 带参；Mock 调课 vs 生产禁调课  
14. my-course 四 tab × 取消/详情/评价  
15. records 无参（第一孩）与 `?studentId=`  
16. notes homework + comments → lesson-detail 只读  
17. child-detail 三 tab；卡包 403  
18. profile-edit 进详情；添加子女生产失败  
19. system-settings → theme / agreement / 退出  
20. notifications → message-auth  
21. feedback / about / help  

### 负向（证明拦截或深链风险）

22. 深链 statistics、students、store-entry → **应拦截**  
23. 深链 audit-log、package-form、lesson-form、my-invite → **记录是否放行（缺陷）**  
24. identity-select「门店入驻」→ 拦截回首页  

---

## A7. 问题增量（写入主报告第六节时合并）

| ID | 等级 | 问题 | 证据 |
|----|------|------|------|
| B8 | 阻塞 | profile-edit「添加子女」调 `POST /students`，BE 仅 TEACHER | profile-edit L406；student.routes.ts L155 |
| S11 | 严重 | children 不进详情，但 profile-edit 可进 — 路径不一致 | children vs profile-edit L310-313 |
| G13 | 一般 | forgot-account / contact-support 公开但无入口 | PUBLIC_PAGES；无 navigate |
| G14 | 一般 | register/role-select、role-info 遗留断链 | 无 signUpStep1 调用方 |
| G15 | 一般 | message-auth / profile-setup / invite-landing 原主报告未原子走查 | 本附录 A1/A2 |
| G16 | 一般 | P-深链页面体量大（课务写页、线索、audit-log） | A1.5–A1.8 |

---

*本附录与教师端 `2026-08-31-teacher-app-path-coverage-appendix.md` 同系列；与主报告一并构成家长端「业务走查 + 路径百分百」交付件。*
