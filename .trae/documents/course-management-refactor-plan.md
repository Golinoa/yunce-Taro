# 课程管理页面重构计划

## 背景与目标

当前项目中「课程管理」入口在个人中心仍为占位状态（`handlePlaceholder`），而现有 `package-course/pages/classes/index.tsx` 是「班级管理」，承载的是班级实例（含学生、排课、课时等）。

从用户截图可见，期望的「课程管理」是一个**课程模板管理**页面：
- 顶部按课程类型 Tab 切换：班课 / 团课 / 私教
- 课程模板列表：名称 + 「复制」操作
- 底部「新增课程」按钮
- 首次进入弹出「第 4 步：建课程」引导弹窗
- 新增课程表单页：课程名称、类型、时长、容纳人数、价格等字段

本次重构目标：
1. 新建独立的「课程管理」页面与「新增课程」表单页
2. 默认分类为 **班课 / 团课 / 私教**
3. 全面接入项目主题色系统（`primary` #3B6EF5），替换截图中的橙色 `warning`

## 关键决策

### 1. 不强行复用现有 `class-form`

现有 `class-form` 是「班级创建」表单，核心字段是学生、老师、时间、课包绑定；而截图中的「新增课程」是「课程模板创建」，字段为课程名称、类型、时长、容纳人数、价格、课程颜色、难度等。

强行复用会产生大量条件分支，与项目 memory 中「6 个试听相关页面应独立存在」的教训一致。因此：
- 新建 `course-form` 页面
- 数据模型独立为 `CourseTemplate`

### 2. 页面与文件结构

| 用途 | 路径 |
|------|------|
| 课程管理列表页 | `src/package-course/pages/course-management/index.tsx` |
| 新增/编辑课程表单页 | `src/package-course/pages/course-form/index.tsx` |
| 课程模板类型 | `src/types/course-template.ts` |
| 课程模板 Service | `src/services/course-template.ts` |
| 课程模板 Mock 数据 | `src/data/course-template.ts` |
| 课程模板 Store | `src/stores/course-template.ts` |

## 实现步骤

### 步骤 1：类型定义

在 `src/types/course-template.ts` 定义：
- `CourseCategory = 'class' | 'group' | 'private'`（班课 / 团课 / 私教）
- `CourseTemplate` 接口：id、name、category、duration、capacity、price、experiencePrice、color、level、subjectId、description、isOnline、onlineMeetingId、status 等

### 步骤 2：Service 与 Mock 数据

在 `src/services/course-template.ts` 实现 `courseTemplateService`：
- `getList(category)`：按分类获取课程模板列表
- `create(data)`：创建课程模板
- `update(id, data)`：更新课程模板
- `copy(id)`：复制课程模板
- `remove(id)`：删除课程模板

所有方法通过 `USE_MOCK` 开关在 mock 与真实 API 间切换。

在 `src/data/course-template.ts` 提供：
- 默认分类常量 `DEFAULT_COURSE_CATEGORIES`
- 示例 mock 数据：美术素描班、书法基础班等

### 步骤 3：状态管理

在 `src/stores/course-template.ts` 实现 Zustand store：
- `templates: CourseTemplate[]`
- `loading / error`
- `fetchByCategory(category)`
- `create / update / copy / remove`

### 步骤 4：课程管理列表页

`src/package-course/pages/course-management/index.tsx`：
- 顶部自定义导航栏（白色背景 + 黑色标题）
- Tab 栏：班课 / 团课 / 私教 + 「新增分类」按钮
  - 激活态使用 `text-primary` + 下划线 `bg-primary`
  - 「新增分类」使用 `bg-primary` 主题色按钮
- 课程模板列表卡片：
  - 左侧课程名称
  - 右侧「复制」按钮（`text-primary`）+ 右箭头
  - 卡片背景 `bg-card`，圆角使用项目 Token
- 底部「新增课程」按钮：白色背景 + `text-primary` + `border-primary`
- 空状态：「暂无班课/团课/私教课程」
- 页面引导弹窗 `PageIntroSheet`：
  - `currentStep={4} totalSteps={6}`
  - 标题：第 4 步：建课程
  - 描述与要点对齐截图

### 步骤 5：新增课程表单页

`src/package-course/pages/course-form/index.tsx`：
- 使用 `PageContainer` + 自定义导航栏
- 表单字段（对齐截图）：
  - 课程名称（FormInput）
  - 课程类型 Picker（班课 / 团课 / 私教）
  - 课程时长
  - 容纳人数
  - 「点击展开高级设置」展开区：
    - 课程颜色选择
    - 所属技能
    - 年龄组
    - 新客体验价 / 单价
    - 最低开课人数
    - 截止预约时间 / 取消排队时间 / 不可取消时间
    - 自动签到 / 学员自助签到 / 允许签到角色
    - 课程难度
    - 课程简介
    - 首页课程底图 / 课程背景图
- 底部「确认新增」主按钮：`bg-primary` 主题色
- 所有必填项校验与友好提示

### 步骤 6：路由与个人中心入口

- 在 `src/app.config.ts` 的 `package-course` subPackages 中注册：
  - `pages/course-management/index`
  - `pages/course-form/index`
- 在 `src/pages/profile/index.tsx` 中将「课程管理」的 `onClick` 从 `handlePlaceholder` 改为跳转 `/package-course/pages/course-management/index`

### 步骤 7：主题色统一

- 所有激活态、主按钮、图标、下划线使用 `primary`（#3B6EF5）
- 不使用 `warning` 橙色作为主题
- 统一使用 UnoCSS Token：`bg-primary`、`text-primary`、`border-primary`、`bg-card`、`shadow-soft` 等

## 待验证清单

- [ ] `npm run typecheck` 通过
- [ ] `npm run lint:fix` 通过
- [ ] `npm run format:check` 通过
- [ ] `$env:VITE_USE_MOCK="true"; npm run build:weapp` 编译成功
- [ ] 个人中心「课程管理」可正确进入新页面
- [ ] Tab 切换正常，默认显示「班课」
- [ ] 页面引导弹窗首次进入显示
- [ ] 新增课程表单页可正常跳转
