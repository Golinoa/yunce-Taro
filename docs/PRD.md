# 云策教务小程序产品需求文档（PRD）

## 1. 项目概述

| 项目 | 说明 |
|---|---|
| 产品名称 | 云策教务 |
| 技术栈 | Taro 3.x + React 18 + TypeScript + UnoCSS |
| 目标用户 | 教培机构校长、授课教师、学生家长 |
| 核心定位 | 一账号多身份的轻量化教务管理工具 |

**产品核心原则**：人是核心实体，身份是人与机构的关系。一个自然人可在多个机构拥有多种身份，登录后可在 App 内随时切换身份上下文。

---

## 2. 整体功能架构

### 2.1 主包页面

| 页面 | 路径 | 说明 |
|---|---|---|
| 首页 | `pages/home/index` | 角色化首页，教师端已完整实现 |
| 统计 | `pages/statistics/index` | 教师数据中心 / 家长课时记录 |
| 我的 | `pages/profile/index` | 个人中心，按角色展示 |
| 登录 | `pages/login/index` | 微信/手机号/用户名登录 |
| 注册 | `pages/register/index` | 三步注册流程 |
| 角色切换 | `pages/role-switch/index` | 添加/切换身份 |
| 通知 | `pages/notifications/index` | 消息中心 |
| 协议 | `pages/agreement/index` | 用户协议/隐私政策 |

### 2.2 分包页面

| 分包 | 页面 | 功能 |
|---|---|---|
| package-student | 学员列表、学员详情、学员表单、家长绑定 | 学员全生命周期管理 |
| package-teacher | 教师列表、教师详情、工资明细 | 教师与薪资管理 |
| package-course | 班级、课程、课包、消课、请假、课表、上课记录 | 教务核心操作 |
| package-settings | 校区设置、反馈、通知发送 | 机构配置与服务 |
| package-statistics | 预警详情 | 统计辅助页 |

### 2.3 认证与身份体系

参考 `docs/UI-design/registration/design-spec.md`：

- **Step1**：创建账号（用户名/密码/邀请码）
- **Step2**：选择身份（校长/教师/家长）
- **Step3**：补充角色信息
  - 校长：机构名称、负责人手机号、机构地址（选填）
  - 教师：校区码（选填，可稍后绑定）
  - 家长：学生邀请码（选填，可稍后绑定）

身份切换入口全局统一，通过 `RoleSwitchSheet` 底部弹窗实现。

---

## 3. 首页入口设计

页面路径：`src/pages/home/index.tsx`

### 3.1 顶部导航区

| 元素 | 说明 |
|---|---|
| 机构名称 | 显示当前机构名，如"云策艺术培训" |
| 身份标签 | 显示当前角色（校长/教师/家长），点击唤起身份切换 |
| 校区选择器 | 切换主校区，教师/校长可见 |
| 消息通知 | 右上角铃铛图标，带未读红点 |

### 3.2 问候区

- 动态问候语："你好~ {昵称}"
- 昵称按字数动态缩放字号，最多显示 5 个字

### 3.3 统计概览区（教师端）

组件：`src/components/home/StatsOverview/index.tsx`

| 统计项 | 说明 |
|---|---|
| 签到次数 | 当前时段内签到人次 |
| 请假次数 | 当前时段内请假人次 |
| 点名课时 | 当前时段内实际消耗课时 |
| 课消金额 | 当前时段内课消金额 |

时段切换：今日 / 本周 / 上周 / 本月

### 3.4 金刚区入口

组件：`src/components/home/KingKongSection/index.tsx`

配置数据源：`src/data/home.ts` 中 `HOME_QUICK_ENTRIES`

| 入口 | 图标 | 跳转 |
|---|---|---|
| 课时消课 | mdi-check-circle | /package-course/pages/lesson-form/index |
| 添加学生 | mdi-account-plus | /package-student/pages/student-form/index |
| 课时充值 | mdi-cash-plus | /package-course/pages/package-form/index |
| 学员管理 | mdi-account-group | /package-student/pages/students/index |
| 班级管理 | mdi-school | /package-course/pages/classes/index |
| 课包管理 | mdi-package-variant | /package-course/pages/course-packages/index |
| 教师管理 | mdi-account-supervisor | /package-teacher/pages/teacher-list/index |
| 校区设置 | mdi-map-marker | /package-settings/pages/campus-settings/index |

**布局**：左侧大卡片（课时消课）+ 右侧两小卡片（添加学生、学员管理）+ 底部图标网格

### 3.5 Tab 内容区

组件实现：

- `src/components/home/TodayScheduleCard/index.tsx`
- `src/components/home/TodoList/index.tsx`
- `src/components/home/RecentLessonList/index.tsx`

| Tab | 内容 |
|---|---|
| 今日课表 | 当天排课列表，支持点名/查看，按状态排序 |
| 待办事项 | 待处理教务事项，带数量 badge |
| 最近消课 | 班级维度手风琴，展示学生消课与剩余课时 |

### 3.6 非教师端首页

当前非教师端显示占位提示："当前身份为校长/家长，专属首页开发中"，提供顶部角色切换入口。

---

## 4. Tab 入口设计

Tab 配置：`src/app.config.ts`

| Tab | 图标 | 页面 | 角色适配 |
|---|---|---|---|
| 首页 | home_selected / home_unselected | pages/home/index | 教师端完整，其他角色占位 |
| 统计 | checkin_selected / checkin_unselected | pages/statistics/index | 教师端数据中心，家长端课时记录 |
| 我的 | profile_selected / profile_unselected | pages/profile/index | 按角色差异化展示 |

**说明**：

- Tab 固定为 3 个，不随角色变化
- 首页与统计页内部按角色渲染不同内容
- 我的页按角色展示完全不同的功能卡片

---

## 5. 我的页面设计

页面路径：`src/pages/profile/index.tsx`

设计稿参考：

- `docs/UI-design/profile/01-profile.html`
- `docs/UI-design/profile/03-profile-roles.html`

### 5.1 通用结构（所有角色）

| 模块 | 说明 |
|---|---|
| 用户信息头部 | 头像、昵称、角色标签、机构名、设置入口 |
| 当前身份卡片 | 显示当前使用中的身份，点击切换 |
| 底部服务 | 客服咨询、服务中心 |
| 退出登录 | 红色退出按钮 |

### 5.2 教师视图

**常用工具**（ProfileGrid 4 列网格）：

| 入口 | 图标主题 | 跳转 |
|---|---|---|
| 工资查询 | warning | /package-teacher/pages/salary-detail/index |
| 请假审批 | accent | /package-course/pages/leave-request/index |
| 消息通知 | primary | /pages/notifications/index |
| 数据统计 | info | /pages/statistics/index |

**系统服务**（ProfileMenu 列表）：

| 入口 | 说明 |
|---|---|
| 校区设置 | 机构配置入口 |
| 帮助中心 | 跳转反馈页 |
| 意见反馈 | 跳转反馈页 |
| 用户协议 | /pages/agreement/index?type=user |
| 隐私政策 | /pages/agreement/index?type=privacy |

### 5.3 家长视图

**学生课时概览**（ProfileStats）：

| 指标 | 说明 |
|---|---|
| 总课时 | 当前选中学生的所有课包总课时 |
| 已消课 | 总课时 - 剩余课时 |
| 剩余课时 | 当前剩余可用课时 |

**孩子学习**（ProfileGrid 4 列网格）：

| 入口 | 跳转 |
|---|---|
| 学习记录 | /package-course/pages/records/index |
| 孩子课表 | /package-course/pages/records/index |
| 请假申请 | /package-course/pages/leave-request/index |
| 成长报告 | 开发中 |

**我的服务**（ProfileMenu 列表）：

| 入口 | 说明 |
|---|---|
| 消息通知 | /pages/notifications/index |
| 我的孩子 | 显示已绑定学生数量，点击切换学生 |
| 帮助中心 | 反馈页 |
| 用户协议 | 协议页 |
| 隐私政策 | 协议页 |

**绑定学生弹窗**：通过学生邀请码绑定，支持绑定多个孩子。

### 5.4 校长视图

当前代码中校长与教师共用 `isTeacher` 判断，因此我的页面展示与教师视图一致。区别体现在：

- 首页顶部身份标签显示"校长"
- 统计页可查看全机构数据
- 校区设置拥有更高权限

---

## 6. 三个身份展示信息差异

| 维度 | 校长 | 教师 | 家长 |
|---|---|---|---|
| 首页 | 当前占位，未来将展示机构运营总览 | 完整教师首页：统计、金刚区、课表/待办/消课 | 当前占位，未来将展示孩子课表与动态 |
| 统计页 | 运营视图 + 财务视图，全机构数据 | 运营视图 + 财务视图，本校区数据 | 课时记录：消耗/剩余/充值课时 |
| 我的页 | 与教师视图一致，强调校区设置 | 常用工具 + 系统服务 | 孩子课时卡片 + 孩子学习 + 我的服务 |
| 核心数据 | 机构、校区、教师、营收 | 班级、学员、课消、工资 | 孩子、课包、学习记录、请假 |
| 管理范围 | 全机构所有校区 | 本校区班级与学员 | 仅自己绑定的孩子 |

### 6.1 身份注册信息差异

| 身份 | 必填信息 | 选填信息 |
|---|---|---|
| 校长 | 机构名称、负责人手机号 | 机构地址 |
| 教师 | 无 | 校区码 |
| 家长 | 无 | 学生邀请码 |

### 6.2 权限矩阵

| 功能 | 校长 | 教师 | 家长 |
|---|---|---|---|
| 机构管理 | ✅ | — | — |
| 校区管理 | ✅ | — | — |
| 教师管理 | ✅ | — | — |
| 班级管理 | ✅ | ✅(本校区) | — |
| 课程管理 | ✅ | ✅(本校区) | — |
| 学员管理 | ✅ | ✅(本校区) | — |
| 课时消课 | ✅ | ✅ | — |
| 课时充值 | ✅ | ✅ | — |
| 查看孩子课时 | — | — | ✅ |
| 查看上课记录 | ✅ | ✅(本校区) | ✅(本孩子) |
| 统计分析 | ✅(全机构) | ✅(本校区) | — |
| 薪资管理 | ✅ | ✅(本人) | — |

---

## 7. 关键设计约束

- 样式：全部使用 UnoCSS 原子类，禁止新增 SCSS 文件
- 输入框：统一使用 `FormInput` 组件
- 弹窗：统一使用 `BottomSheet` 组件
- 状态管理：使用 Zustand
- 数据：页面只引用 `@/services`，Mock 数据统一在 `src/data/`
