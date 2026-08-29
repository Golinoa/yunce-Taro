# 云策教务 — 修复计划总纲

> 创建日期：2026-06-21
> 基于审查报告（P0:13 / P1:25 / P2:22）+ Taro 代码实际实现交叉比对
> **P0 ✅ P1 ✅ P2 ✅ 已全部完成**

---

## 文件索引

| 文件                                                         | 阶段     | 核心目标                                                               |
| ------------------------------------------------------------ | -------- | ---------------------------------------------------------------------- |
| [01-p0-data-flow.md](./01-p0-data-flow.md)                   | 第一阶段 | P0 核心数据流打通                                                      |
| [02-p1-feature-completion.md](./02-p1-feature-completion.md) | 第二阶段 | P1 功能补全 + 硬编码消除                                               |
| [03-homepage-redesign.md](./03-homepage-redesign.md)         | 第三阶段 | 首页重构 + TabBar 改造（TASK-26 已完成；TASK-27/29/30 按用户决策调整） |
| [04-p2-details.md](./04-p2-details.md)                       | 第四阶段 | P2 细节优化                                                            |
| [05-api-migration.md](./05-api-migration.md)                 | 第五阶段 | 后端 API 对接                                                          |
| [06-home-ux-backlog.md](./06-home-ux-backlog.md)             | 持续     | 首页 & 周边体验待办（#1–#12）                                          |
| [07-todo-quadrant-api-contract.md](./07-todo-quadrant-api-contract.md) | 契约 | 待办四象限 API                                                         |
| [08-todo-module-api-contract.md](./08-todo-module-api-contract.md)   | 契约 | 待办模块 API                                                           |
| [09-platform-capabilities-backlog.md](./09-platform-capabilities-backlog.md) | 持续 | 小程序平台能力待办（转发分享、添加桌面、NutUI 补通用组件等）          |
| [subscribe-message/](./subscribe-message/README.md)          | 持续     | 微信订阅消息方案与接口契约                                             |

---

## 执行顺序与依赖关系

```
第一阶段（P0 数据流）     ← 当前最紧急，所有后续阶段的前置
  │
  ▼
第二阶段（P1 功能补全）    ← 数据流打通后，按子阶段 2A→2B→2C→2D→2E→2F 顺序
  │
  ▼
第三阶段（首页重构）       ← 功能稳定后，涉及路由/TabBar 全局变更
  │
  ▼
第四阶段（P2 细节）        ← 持续优化，可与第五阶段并行
  │
  ▼
第五阶段（API 对接）       ← 后端就绪后，按模块逐个切换
```

---

## 审查问题现状对照

审查报告中的 P0 问题（消课/充值/创建仅 Toast 未写入）在 Taro 代码中**已基本修复**：

- 消课：`lessonRecordService.create()` + `packageService.deductHours()` ✅
- 充值：`packageService.createRecharge()` ✅
- 创建班级：`classService.create()` + `addStudents()` ✅
- 保存学员：`studentService.create()` + 课包创建 ✅

**但存在以下遗留问题**（第一、二阶段重点）：

1. 课包扣减未拆分购买/赠送课时（FIFO）
2. 班级消课缺少预览确认
3. 消课撤销功能缺失
4. 教师列表硬编码（`TEACHER_LIST`）
5. 各模块 P1 功能缺口

---

## Spec 文档格式约定

每个 Spec 文件包含以下结构：

```markdown
## TASK-XX: 任务标题

### 问题描述

- 当前现状
- 存在的问题

### 实现方案

- 步骤化实现指引
- 涉及文件及修改内容

### 涉及文件

| 文件 | 操作 | 说明 |
| ---- | ---- | ---- |

### 验收标准

- [ ] 具体验收条件

### 依赖

- 前置任务
```

---

## 开发规范提醒

执行任何 Spec 时必须遵守：

1. 样式用 UnoCSS 原子类，禁止新增 SCSS
2. 输入框用 `FormInput`，弹窗用 `BottomSheet`
3. 状态管理用 Zustand Store
4. 页面只引用 `@/services`，禁止直接引用 `@/data/`
5. TypeScript 严格模式，禁止隐式 any
6. 每个新增组件必须有 JSDoc 注释
