# 云策教务 — UI 设计审查报告集

> 审查完成日期：2026-06-14
> 本文件夹包含全部8个模块的设计审查报告，供跨会话查阅

---

## 文件索引

| # | 文件 | 模块 | P0 | P1 | P2 | 修复状态 |
|---|------|------|-----|-----|-----|----------|
| 1 | [01-campus-settings.md](file:///d:/Coding/yunceWX/yunce/docs/UI-design/Todo/review-reports/01-campus-settings.md) | 校区设置 | 4 | 4 | 4 | P0+P2已修复 |
| 2 | [02-student-management.md](file:///d:/Coding/yunceWX/yunce/docs/UI-design/Todo/review-reports/02-student-management.md) | 学员管理 | 2 | 4 | 3 | 方案已确认 |
| 3 | [03-teacher-management.md](file:///d:/Coding/yunceWX/yunce/docs/UI-design/Todo/review-reports/03-teacher-management.md) | 教师管理 | 0 | 3 | 4 | 方案已确认 |
| 4 | [04-class-management.md](file:///d:/Coding/yunceWX/yunce/docs/UI-design/Todo/review-reports/04-class-management.md) | 班级管理 | 2 | 3 | 3 | 方案已确认 |
| 5 | [05-lesson-deduction.md](file:///d:/Coding/yunceWX/yunce/docs/UI-design/Todo/review-reports/05-lesson-deduction.md) | 消课流程 | 2 | 2 | 2 | 方案已确认 |
| 6 | [06-lesson-recharge.md](file:///d:/Coding/yunceWX/yunce/docs/UI-design/Todo/review-reports/06-lesson-recharge.md) | 课时充值 | 1 | 3 | 2 | 方案已确认 |
| 7 | [07-add-student.md](file:///d:/Coding/yunceWX/yunce/docs/UI-design/Todo/review-reports/07-add-student.md) | 添加学员 | 1 | 3 | 2 | 方案已确认 |
| 8 | [08-homepage.md](file:///d:/Coding/yunceWX/yunce/docs/UI-design/Todo/review-reports/08-homepage.md) | 首页 | 1 | 3 | 2 | 方案已确认 |

**合计**: P0: 13 / P1: 25 / P2: 22

---

## 跨模块共性问题（新会话必读）

| # | 问题 | 涉及模块 | 优先级 | 说明 |
|---|------|----------|--------|------|
| G1 | 核心操作仅Toast未写入数据 | 班级/消课/充值/添加学员 | P0 | 原型演示通病，迁移Taro时需全部实现实际数据操作 |
| G2 | 列表数据硬编码 | 全部模块 | P1 | 迁移时需对接后端API |
| G3 | 选择器数据硬编码（教师/科目/学员） | 班级/消课/充值/添加学员 | P1 | 需从对应模块动态获取 |
| G4 | 搜索为前端过滤 | 学员管理 | P1 | 学员数>200时不可行，需后端搜索 |
| G5 | 分期付款组件重复实现 | 课时充值/添加学员 | P2 | 项目已有InstallmentPanel组件，迁移时复用 |
| G6 | 确认弹窗使用浏览器confirm() | 班级管理 | P2 | 迁移时改为自定义弹窗 |

---

## 各模块P0问题速查

### 校区设置（已修复）
- 校区图标分配缺失 → 按类型自动分配
- 校区切换作用域不清 → 全局/校区级配置标注
- 设为主校区数据联动缺失 → doSetMain完整实现
- 删除校区无二次确认 → 增加确认弹窗

### 学员管理
- P0-1: 删除学员无级联提示（关联课包/记录/家长）
- P0-2: 欠课学员无补课入口（仅有展示无操作）

### 班级管理
- P0-1: 消课未实际扣减课时（submitLesson仅Toast）
- P0-2: 创建班级未写入数据（submitCreate仅Toast）

### 消课流程
- P0-1: 消课未实际扣减课包余额
- P0-2: 班级消课未逐学员扣减（每人可能匹配不同课包）

### 课时充值
- P0-1: 充值未实际创建课包/更新余额

### 添加学员
- P0-1: 保存学员未创建记录

### 首页
- P0-1: 5种方案未定稿，无正式设计规范

---

## 原型文件位置

| 模块 | 原型路径 |
|------|----------|
| 校区设置 | `docs/UI-design/campus-settings/campus-settings.html` |
| 学员管理 | `docs/UI-design/Todo/student-management/student-management.html` |
| 教师管理 | `docs/UI-design/Todo/teacher-management/scheme-a-list-detail.html` |
| 班级管理 | `docs/UI-design/class-management/class-management.html` |
| 消课流程 | `docs/UI-design/lesson-deduction/lesson-deduction.html` |
| 课时充值 | `docs/UI-design/lesson-recharge/lesson-recharge.html` |
| 添加学员 | `docs/UI-design/添加学员页面/05-student-form-designs.html` |
| 首页 | `docs/UI-design/homepage/homepage-schemes-2.html` |

---

## 设计规范文件位置

| 模块 | 设计规范路径 | 迁移方案路径 |
|------|-------------|-------------|
| 校区设置 | `docs/UI-design/campus-settings/design-spec.md` | `docs/UI-design/campus-settings/migration-plan.md` |
| 学员管理 | `docs/UI-design/Todo/student-management/design-spec.md` | `docs/UI-design/Todo/student-management/migration-plan.md` |
| 教师管理 | `docs/UI-design/Todo/teacher-management/design-spec.md` | `docs/UI-design/Todo/teacher-management/migration-plan.md` |
| 班级管理 | `docs/UI-design/class-management/design-spec.md` | `docs/UI-design/class-management/migration-plan.md` |
| 消课流程 | `docs/UI-design/lesson-deduction/design-spec.md` | 无 |
| 课时充值 | `docs/UI-design/lesson-recharge/design-spec.md` | `docs/UI-design/lesson-recharge/migration-plan.md` |
| 添加学员 | 无 | `docs/UI-design/添加学员页面/MIGRATION.md` |
| 首页 | 无 | 无 |

---

## 技术栈（迁移参考）

- 框架: Taro 3.x + React 18
- 语言: TypeScript 严格模式
- 样式: UnoCSS 原子化类名 + presetRemRpx (baseFontSize=12, screenWidth=375)
- 状态管理: Zustand
- 日期: dayjs
- 已有可复用组件: BottomSheet, ChipPicker, InstallmentPanel, PageContainer, ActionButton, Avatar

---

## 下一步行动建议

1. **首页定稿** — 确定方案4（列表信息流式），输出正式设计规范
2. **消课流程补迁移方案** — 当前缺少migration-plan.md
3. **P0问题修复** — 按模块优先级：消课流程 > 班级管理 > 学员管理 > 课时充值 > 添加学员
4. **跨模块数据流设计** — 统一API接口规范，解决G1-G6共性问题
