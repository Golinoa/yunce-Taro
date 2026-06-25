# 云策教务 — 模块清单与审查状态

> 最后更新：2026-06-14

---

## 模块总览

| # | 模块名 | 设计文件路径 | 原型文件 | 设计规范 | 迁移方案 | 审查状态 |
|---|--------|-------------|----------|----------|----------|----------|
| 1 | 首页 | `UI-design/homepage/` | homepage-schemes.html, homepage-schemes-2.html | 无 | 无 | ✅ 已审查 |
| 2 | 校区设置 | `UI-design/campus-settings/` | campus-settings.html | design-spec.md | migration-plan.md | ✅ 已审查(已修复) |
| 3 | 学员管理 | `UI-design/Todo/student-management/` | student-management.html | design-spec.md | migration-plan.md | ✅ 已审查 |
| 4 | 教师管理 | `UI-design/Todo/teacher-management/` | scheme-a-list-detail.html | design-spec.md, design-annotations.md | migration-plan.md | ✅ 已审查 |
| 5 | 班级管理 | `UI-design/class-management/` | class-management.html | design-spec.md | migration-plan.md | ✅ 已审查 |
| 6 | 消课流程 | `UI-design/lesson-deduction/` | lesson-deduction.html | design-spec.md | 无 | ✅ 已审查 |
| 7 | 课时充值 | `UI-design/lesson-recharge/` | lesson-recharge.html | design-spec.md | migration-plan.md | ✅ 已审查 |
| 8 | 添加学员 | `UI-design/添加学员页面/` | 05-student-form-designs.html | 无 | MIGRATION.md | ✅ 已审查 |

---

## 各模块详情

### 1. 首页 (homepage)
- **路径**: `docs/UI-design/homepage/`
- **原型**: homepage-schemes.html（方案1/2/3）、homepage-schemes-2.html
- **设计规范**: 无独立 design-spec.md
- **迁移方案**: 无
- **说明**: 包含多种首页布局方案，含仪表盘数据驱动式等
- **审查状态**: ✅ 已审查 — 5种方案未定稿，无正式设计规范（P0:1 P1:3 P2:2）
- **报告文件**: `Todo/homepage/review-report.md`

### 2. 校区设置 (campus-settings)
- **路径**: `docs/UI-design/campus-settings/`
- **原型**: campus-settings.html, campus-card-options.html
- **设计规范**: design-spec.md
- **迁移方案**: migration-plan.md
- **子模块**: 校区信息卡片、校区选择器、通知设置、分校区管理、发薪日设置、校区科目、节假日设置、课时单价
- **审查状态**: ✅ 已审查 — 发现12个问题（4个P0 / 4个P1 / 4个P2），P0和P2已修复
- **报告文件**: `campus-settings/1.md`

### 3. 学员管理 (student-management)
- **路径**: `docs/UI-design/Todo/student-management/`
- **原型**: student-management.html
- **设计规范**: design-spec.md
- **迁移方案**: migration-plan.md
- **说明**: 学员列表+学员详情，含搜索筛选、课时预警、课包/记录/请假/家长管理
- **审查状态**: ✅ 已审查 — P0:2 P1:4 P2:3
- **报告文件**: `Todo/student-management/review-report.md`

### 4. 教师管理 (teacher-management)
- **路径**: `docs/UI-design/Todo/teacher-management/`
- **原型**: scheme-a-list-detail.html
- **设计规范**: design-spec.md, design-annotations.md
- **迁移方案**: migration-plan.md
- **说明**: 教师/薪资/排课三Tab，含薪资模板、批量确认发放
- **审查状态**: ✅ 已审查 — P0:0 P1:3 P2:4（P0已在原型中修复）
- **报告文件**: `Todo/teacher-management/review-report.md`

### 5. 班级管理 (class-management)
- **路径**: `docs/UI-design/class-management/`
- **原型**: class-management.html
- **设计规范**: design-spec.md
- **迁移方案**: migration-plan.md
- **说明**: 班级列表、班级详情、排课管理
- **审查状态**: ✅ 已审查 — P0:2 P1:3 P2:3
- **报告文件**: `Todo/class-management/review-report.md`

### 6. 消课流程 (lesson-deduction)
- **路径**: `docs/UI-design/lesson-deduction/`
- **原型**: lesson-deduction.html
- **设计规范**: design-spec.md
- **迁移方案**: 无
- **说明**: 教师端消课操作，含签到、课包选择、课时扣减
- **审查状态**: ✅ 已审查 — P0:2 P1:2 P2:2
- **报告文件**: `Todo/lesson-deduction/review-report.md`

### 7. 课时充值 (lesson-recharge)
- **路径**: `docs/UI-design/lesson-recharge/`
- **原型**: lesson-recharge.html
- **设计规范**: design-spec.md
- **迁移方案**: migration-plan.md
- **说明**: 教师端课时充值，含课包模板、自定义课包、分期付款
- **审查状态**: ✅ 已审查 — P0:1 P1:3 P2:2
- **报告文件**: `Todo/lesson-recharge/review-report.md`

### 8. 添加学员 (student-form)
- **路径**: `docs/UI-design/添加学员页面/`
- **原型**: 05-student-form-designs.html
- **设计规范**: 无独立文件
- **迁移方案**: MIGRATION.md, PROJECT-ISSUES.md
- **说明**: 学员添加表单设计
- **审查状态**: ✅ 已审查 — P0:1 P1:3 P2:2
- **报告文件**: `Todo/student-management/add-student-review-report.md`

---

## 审查进度

| 模块 | 审查日期 | 问题数 | 报告文件 |
|------|----------|--------|----------|
| 首页 | 2026-06-14 | P0:1 P1:3 P2:2 | Todo/homepage/review-report.md |
| 校区设置 | 2026-06-14 | P0:4 P1:4 P2:4 (已修复) | campus-settings/1.md |
| 学员管理 | 2026-06-14 | P0:2 P1:4 P2:3 | Todo/student-management/review-report.md |
| 教师管理 | 2026-06-14 | P0:0 P1:3 P2:4 | Todo/teacher-management/review-report.md |
| 班级管理 | 2026-06-14 | P0:2 P1:3 P2:3 | Todo/class-management/review-report.md |
| 消课流程 | 2026-06-14 | P0:2 P1:2 P2:2 | Todo/lesson-deduction/review-report.md |
| 课时充值 | 2026-06-14 | P0:1 P1:3 P2:2 | Todo/lesson-recharge/review-report.md |
| 添加学员 | 2026-06-14 | P0:1 P1:3 P2:2 | Todo/student-management/add-student-review-report.md |

---

## 全局问题汇总

### 跨模块共性问题

| # | 问题 | 涉及模块 | 优先级 |
|---|------|----------|--------|
| G1 | 原型中核心操作（消课/充值/创建）未实际写入数据，仅Toast提示 | 班级/消课/充值/添加学员 | P0 |
| G2 | 列表数据硬编码，未与后端API对接 | 全部模块 | P1 |
| G3 | 教师列表/科目列表/学员列表等选择器数据硬编码 | 班级/消课/充值/添加学员 | P1 |
| G4 | 搜索为前端过滤，学员数>200时不可行 | 学员管理 | P1 |
| G5 | 分期付款组件重复实现 | 课时充值/添加学员 | P2 |
| G6 | 确认弹窗使用浏览器原生confirm() | 班级管理 | P2 |
