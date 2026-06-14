# 教师管理模块 - 业务边界问题与迁移计划

> 原型文件：`scheme-a-list-detail.html`

---

## 一、业务边界问题清单

经过完整梳理，以下为当前 UI 原型中未覆盖或存在逻辑缺陷的业务边界：

### 1. 薪资流转边界

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| S1 | **工资单详情页发放未走二次确认** | 高 | `salaryDetailAction()` 中已确认→已发放直接调用 `t.salaryStatus='paid'`，未弹出确认弹窗和备注输入，与薪资Tab的发放流程不一致 |
| S2 | **薪资状态不可回退** | 中 | 已发放不可撤回，已确认不可退回待确认，UI上无"撤销"入口，但业务上可能需要"撤回确认"场景 |
| S3 | **批量确认无确认弹窗** | 低 | 批量确认直接执行，无确认提示。虽然确认是轻操作，但批量场景可能误触 |
| S4 | **已离职教师薪资处理** | 高 | 离职教师 `hours=0`，薪资列表 `filter(t.status==='active')` 直接过滤，但离职当月可能有未结清薪资需发放 |
| S5 | **0课时教师薪资显示** | 中 | 新添加教师课时为0，薪资明细显示"0课时 · ¥0"，卡片信息量不足，应区分"无课时"和"待排课" |

### 2. 工资计算边界

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| C1 | **扣款金额未计入薪资汇总** | 高 | `renderSalaryList` 中 `totalAll` 计算未减去扣款：`totalAll+=t.base+lf+t.attend+t.perf`，而 `calcTotal` 是减了扣款的，导致汇总总额与明细总额不一致 |
| C2 | **班级计费覆盖逻辑未实现** | 中 | 教师详情页展示了"班级计费覆盖"（如钢琴基础班 ¥120/课时），但实际计算仍用 `hours*rate`，未按班级差异化计费 |
| C3 | **工资模型切换后历史数据** | 中 | 切换工资模型后，当月薪资立即按新模型计算，但已确认/已发放的月份是否应保留原模型数据？ |
| C4 | **补发金额为负数校验** | 低 | 扣款弹窗中"补发"类型金额输入无校验，可能输入负数 |

### 3. 数据完整性边界

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| D1 | **添加教师缺少兼职角色选项** | 中 | 添加/编辑教师弹窗只有"主讲"和"助教"两个角色，但数据中有"兼职"角色，缺少该选项 |
| D2 | **教师手机号脱敏处理** | 低 | 编辑教师时 `phone.replace(/\*/g,'1234')` 将脱敏号还原为真实号，但实际业务中应从接口获取真实号，不应前端还原 |
| D3 | **教师ID自增可能重复** | 低 | `newId=teachers.length+1`，删除教师后ID可能重复，应使用UUID或后端生成 |
| D4 | **备注仅存储在内存** | 中 | `payRemark` 仅在当前会话有效，刷新后丢失，历史记录中的备注是硬编码的模拟数据 |

### 4. 交互体验边界

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| U1 | **历史记录无真实数据关联** | 中 | `renderHistoryList` 使用硬编码数据，与教师数据和薪资状态完全无关，切换月份后数据不变 |
| U2 | **历史记录无备注来源** | 中 | 历史列表中的备注是硬编码的（如"含课时调整+2"），与发放时填写的备注无关联 |
| U3 | **年月选择器初始年份硬编码** | 低 | `pickerYear=2025, pickerMonth=5` 硬编码初始值，应从当前日期动态计算 |
| U4 | **排课Tab筛选栏显示时机** | 低 | 排课筛选栏（校区/科目）在非排课Tab时也渲染在DOM中，仅通过display控制 |
| U5 | **批量操作栏始终显示** | 低 | 即使所有教师已发放（无可选项目），批量操作栏仍显示，应条件隐藏 |
| U6 | **工资单详情页底部按钮状态** | 中 | 已发放状态下仍显示"已完成"按钮，应隐藏或改为"返回" |

### 5. 权限与安全边界

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| P1 | **无权限控制** | 高 | 所有操作（确认/发放/编辑/删除）无权限区分，实际业务中应有管理员/普通教务角色区分 |
| P2 | **标记离职无确认** | 中 | "标记离职"直接执行，无确认弹窗，且离职后无法恢复 |
| P3 | **导出工资记录未实现** | 低 | 更多操作中"导出工资记录"仅提示"功能开发中" |

---

## 二、优先修复建议

### P0 - 必须修复（数据不一致/流程断裂）

| 问题 | 修复方案 | 状态 |
|------|---------|------|
| S1 工资单详情发放未走二次确认 | `salaryDetailAction()` 中 confirmed→paid 改为弹出 payConfirmModal | ✅ 已修复 |
| C1 汇总额未减扣款 | `renderSalaryList` 中 `totalAll` 改用 `calcTotal(t)` | ✅ 已修复 |
| S4 离职教师未结清薪资 | 薪资列表过滤条件改为 `status==='active' || salaryStatus!=='paid'`，离职教师显示"已离职"标签 | ✅ 已修复 |

### P1 - 应该修复（功能缺失/体验问题）

| 问题 | 修复方案 | 状态 |
|------|---------|------|
| D1 缺少兼职角色选项 | 添加/编辑弹窗增加"兼职教师"选项，selectRole/selectEditRole/saveEditTeacher 均已适配 | ✅ 已修复 |
| U1 历史记录无真实数据 | 基于教师数据+月份偏移生成历史快照 | 待迁移时实现 |
| U2 历史备注与发放备注关联 | 将 payRemark 存入月度快照数据 | 待迁移时实现 |
| U6 已发放状态底部按钮 | 已发放时隐藏操作按钮 | ✅ 已修复 |
| P2 标记离职无确认 | 增加离职确认弹窗（含离职类型选择+原因输入+未结清薪资提示） | ✅ 已修复 |

### P2 - 可选优化

| 问题 | 修复方案 |
|------|---------|
| S2 状态不可回退 | 增加"撤回确认"功能（仅已确认→待确认） |
| S3 批量确认无确认 | 增加轻量确认提示 |
| C2 班级计费覆盖 | 实现按班级差异化计费逻辑 |
| P2 标记离职无确认 | 增加确认弹窗+离职原因选择 |

---

## 三、迁移策略

### 3.1 原则

1. **UnoCSS 原子化样式**：所有新样式使用 UnoCSS class，不创建 SCSS 文件
2. **自适应写法**：使用 `presetRemRpx`（baseFontSize=12, screenWidth=375），所有尺寸用 rem 单位自动转 rpx
3. **设计 Token 对齐**：颜色、圆角、阴影使用 `theme.ts` 和 `uno.config.ts` 中已定义的 token
4. **组件复用**：抽取可复用组件到 `src/components/`，复用已有 BottomSheet/ChipPicker 等
5. **渐进迁移**：按优先级分批实施，每批可独立验证

### 3.2 样式映射表

| 原型 CSS | UnoCSS 类名 | 说明 |
|---------|------------|------|
| `color: var(--primary)` | `text-primary` | 主色文字 |
| `background: var(--primary)` | `bg-primary` | 主色背景 |
| `background: var(--primary-bg)` | `bg-primary-10` | 主色浅底 |
| `background: var(--bg-page)` | `bg-page` | 页面背景 |
| `border: 1px solid var(--border)` | `border border-border` | 边框 |
| `border-radius: 16px` | `rounded-2xl` | 卡片圆角 |
| `border-radius: 12px` | `rounded-xl` | 输入框圆角 |
| `border-radius: 24px` | `rounded-3xl` | 按钮圆角 |
| `font-size: 14px` | `text-md` | 正文 |
| `font-size: 16px` | `text-lg` | 标题 |
| `font-size: 12px` | `text-xs` | 辅助 |
| `padding: 16px` | `p-4` | 卡片内边距 |
| `box-shadow: var(--shadow)` | `shadow-soft` | 卡片阴影 |

### 3.3 设计 Token → 项目 Token 映射

| 设计 Token | 项目 Token | 色值 |
|-----------|-----------|------|
| --primary | --primary / text-primary | #5EC8A8 |
| --amber | --amber / text-amber | #d4a24e |
| --success | --success / text-success | #3ABF6E |
| --destructive | --destructive / text-destructive | #D94040 |
| --purple | --purple / text-purple | #9b7ed8 |
| --info | --info / text-info | #6ba3d6 |
| --accent | --accent / text-accent | #e88aaa |
| --border | --border / border-border | #D5E8E0 |
| --bg-page | bg-page / --background | #F5FAF8 |

---

## 四、分批迁移计划

### P0 - 数据模型扩展（前置依赖）

**目标**：扩展类型定义和 Mock 数据，为 UI 迁移提供数据支撑

| 任务 | 文件 | 说明 |
|------|------|------|
| 扩展 Teacher 类型 | `src/types/teacher.ts` | 新增 payRemark/payHistory/salaryModel 等字段 |
| 新增 SalaryModel 类型 | `src/types/teacher.ts` | 工资模型定义（名称/类型/参数） |
| 新增 PayHistory 类型 | `src/types/teacher.ts` | 月度发薪快照（含备注） |
| 新增 mockTeachers | `src/data/teachers.ts` | 教师列表 Mock |
| 新增 mockSalaryModels | `src/data/teachers.ts` | 工资模型 Mock |
| 新增 mockScheduleData | `src/data/teachers.ts` | 排课数据 Mock |

### P1 - 教师列表页

**目标**：实现教师Tab主列表 + 筛选

| 任务 | 文件 | 说明 |
|------|------|------|
| TeacherListPage | `pages/teacher-list/index.tsx` | 主页面容器 |
| TeacherCard | `components/TeacherCard/index.tsx` | 教师卡片（头像+信息+薪资状态） |
| FilterBar | `components/FilterBar/index.tsx` | 下拉筛选栏（角色/科目/状态） |
| AddTeacherSheet | `components/AddTeacherSheet/index.tsx` | 添加教师底部弹窗 |
| 集成到页面 | `pages/teacher-list/index.tsx` | 组装列表+筛选+添加 |

### P2 - 薪资管理页

**目标**：实现薪资Tab（本月/历史/设置）

| 任务 | 文件 | 说明 |
|------|------|------|
| SalaryPanel | `pages/teacher-list/components/SalaryPanel/index.tsx` | 薪资Tab容器 |
| SalarySummary | `components/SalarySummary/index.tsx` | 发薪提醒+快捷入口+汇总 |
| SalaryItem | `components/SalaryItem/index.tsx` | 薪资明细卡片（含勾选） |
| BatchActionBar | `components/BatchActionBar/index.tsx` | 批量操作栏 |
| PayConfirmSheet | `components/PayConfirmSheet/index.tsx` | 发放确认弹窗（含备注） |
| MonthPicker | `components/MonthPicker/index.tsx` | 年月选择器 |
| SalaryHistory | `pages/teacher-list/components/SalaryHistory/index.tsx` | 历史记录列表 |
| SalarySettings | `pages/teacher-list/components/SalarySettings/index.tsx` | 设置面板 |

### P3 - 排课页

**目标**：实现排课Tab

| 任务 | 文件 | 说明 |
|------|------|------|
| SchedulePanel | `pages/teacher-list/components/SchedulePanel/index.tsx` | 排课Tab容器 |
| WeekBar | `components/WeekBar/index.tsx` | 周视图导航 |
| DaySchedule | `components/DaySchedule/index.tsx` | 日课表时间线 |

### P4 - 教师详情页

**目标**：实现教师详情（薪资/课时/反馈/排课四Tab）

| 任务 | 文件 | 说明 |
|------|------|------|
| TeacherDetailPage | `pages/teacher-detail/index.tsx` | 详情页容器 |
| DetailHeader | `components/DetailHeader/index.tsx` | 渐变头部+统计 |
| EditTeacherSheet | `components/EditTeacherSheet/index.tsx` | 编辑教师弹窗 |
| SalaryTab | `pages/teacher-detail/components/SalaryTab/index.tsx` | 薪资Tab |
| LessonTab | `pages/teacher-detail/components/LessonTab/index.tsx` | 课时Tab |
| FeedbackTab | `pages/teacher-detail/components/FeedbackTab/index.tsx` | 反馈Tab |
| ScheduleTab | `pages/teacher-detail/components/ScheduleTab/index.tsx` | 排课Tab |

### P5 - 工资单详情页

**目标**：实现独立工资单详情页

| 任务 | 文件 | 说明 |
|------|------|------|
| SalaryDetailPage | `pages/salary-detail/index.tsx` | 工资单详情页 |
| StatusFlow | `components/StatusFlow/index.tsx` | 状态流转步骤条 |
| SalaryBreakdown | `components/SalaryBreakdown/index.tsx` | 金额构成卡片 |
| LessonDetailList | `components/LessonDetailList/index.tsx` | 课时明细列表 |
| DeductionCard | `components/DeductionCard/index.tsx` | 扣款/补发卡片 |
| DeductionSheet | `components/DeductionSheet/index.tsx` | 添加扣款弹窗 |

### P6 - 优化与收尾

| 任务 | 说明 |
|------|------|
| 修复S1 | 工资单详情页发放走二次确认 |
| 修复C1 | 汇总额减去扣款 |
| 修复D1 | 添加/编辑弹窗增加兼职角色 |
| 修复S4 | 离职教师未结清薪资处理 |
| 表单校验 | 教师姓名必填+手机号格式+金额非负 |
| 骨架屏 | 列表加载时显示骨架卡片 |
| 空状态 | 无教师/无排课时的提示 |
| 边界情况 | 网络错误、数据为空 |

---

## 五、组件抽取计划

从原型中抽取为独立可复用组件：

| 组件 | 路径 | 说明 | 复用已有 |
|------|------|------|---------|
| TeacherCard | `components/TeacherCard/` | 教师信息卡片 | 否 |
| FilterBar | `components/FilterBar/` | 下拉筛选栏 | 否 |
| SalaryItem | `components/SalaryItem/` | 薪资明细卡片 | 否 |
| BatchActionBar | `components/BatchActionBar/` | 批量操作栏 | 否 |
| PayConfirmSheet | `components/PayConfirmSheet/` | 发放确认弹窗 | 底层用 BottomSheet |
| MonthPicker | `components/MonthPicker/` | 年月选择器 | 否 |
| WeekBar | `components/WeekBar/` | 周视图导航 | 否 |
| StatusFlow | `components/StatusFlow/` | 状态流转步骤条 | 否 |
| SalaryBreakdown | `components/SalaryBreakdown/` | 金额构成 | 否 |
| DeductionSheet | `components/DeductionSheet/` | 扣款弹窗 | 底层用 BottomSheet |

已有可复用组件：

| 组件 | 路径 | 用途 |
|------|------|------|
| BottomSheet | `components/BottomSheet/` | 各类底部弹窗 |
| ChipPicker | `components/ChipPicker/` | 角色选择/类型选择 |
| PageContainer | `components/PageContainer/` | 页面容器 |
| ActionButton | `components/ActionButton/` | 操作按钮 |

---

## 六、注意事项

1. **自适应写法**：所有尺寸使用 rem 单位，由 `presetRemRpx` 自动转换，不要硬编码 rpx 值
2. **设计 Token**：颜色使用 `text-primary`、`bg-muted` 等 token 类名，不要直接写 `#5EC8A8`
3. **Taro 限制**：
   - 不支持 `onclick` 内联事件，需用 `onClick={handler}`
   - 弹窗用 `<Popup>` 组件或自定义 BottomSheet
   - 浮窗内滚动需用 `<ScrollView>`
4. **数据流**：页面间通过路由参数传递 teacherId，数据从 Mock/API 获取
5. **薪资状态机**：严格遵循 pending→confirmed→paid 单向流转，不可逆
6. **发放二次确认**：所有 confirmed→paid 的操作必须经过确认弹窗，包括工资单详情页
7. **备注持久化**：发放备注需存入月度快照，历史记录可查看
8. **离职教师**：离职当月仍可能有未结清薪资，需特殊处理
