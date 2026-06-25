# 云策教务 — UI 设计审查提示词规范

> 用途：新开会话时，将下方提示词发送给 AI，对指定模块进行全面设计审查

---

## 使用方法

1. 打开新会话
2. 复制下方【审查提示词】模板
3. 替换 `{模块名}` 和 `{文件路径}` 为实际值
4. 发送给 AI，等待审查报告
5. 将报告保存到 `docs/UI-design/Todo/{模块名}/review-report.md`

---

## 审查提示词模板

```
请对 {模块名} 的设计方案进行全面审查与评估。

审查范围：
- 原型文件：{文件路径}（HTML文件，可直接浏览器打开）
- 设计规范：{design-spec路径}（如有）
- 迁移方案：{migration-plan路径}（如有）

请按以下五个维度逐项分析，输出结构化报告：

---

### 一、业务流程验证（权重最高）

1. 梳理该模块的完整业务流程（从用户进入模块到完成核心操作的每一步）
2. 验证流程中是否存在逻辑断层（某步骤缺少入口/出口/过渡）
3. 验证是否存在流程冲突（两个操作互相矛盾、数据不一致）
4. 验证是否有隐含的业务规则未在UI中体现

### 二、缺失项识别

1. 缺少的业务步骤（流程中应有但未设计的环节）
2. 缺少的功能模块（同类产品常见但本设计未包含的）
3. 缺少的交互环节（操作后缺少反馈/确认/引导）
4. 缺少的数据字段（表单中应有但未提供的输入项）
5. 缺少的边界状态（空状态/加载态/错误态/极端数据）

### 三、设计一致性

1. 与全局设计语言（design-spec）的对齐情况：颜色、圆角、阴影、字号
2. 与其他模块的交互模式一致性（同类操作是否用同样的UI模式）
3. 图标/emoji 的分配规则是否清晰一致
4. 弹窗/浮层/确认框的使用模式是否统一

### 四、落地可行性

1. 数据架构：前端状态管理是否可行，数据源是否明确
2. API 依赖：需要哪些后端接口，是否存在接口设计难点
3. 级联影响：该模块的操作是否影响其他模块的数据一致性
4. 性能风险：长列表/大数据量/频繁操作是否有性能隐患
5. 权限控制：不同角色（教师/家长/管理员）的可见可操作范围

### 五、边界条件与限制

1. 极端数据：0条记录/100+条记录/超长文本/特殊字符
2. 并发冲突：多人同时操作同一数据
3. 网络异常：离线/超时/数据提交失败
4. 设备差异：不同屏幕尺寸/安全区域/深色模式
5. 业务边界：该模块适用的机构规模/业务场景/不适用场景

---

### 输出格式要求

1. 问题清单：按 P0(严重)/P1(重要)/P2(一般) 分级，每条包含：
   - 问题描述
   - 影响范围
   - 建议修复方案
2. 改进建议：按优先级排序的可执行改进项
3. 落地关键注意事项：开发实现时必须注意的技术要点
4. 与其他模块的关联风险：该模块变更可能影响的其他模块

请先通读所有设计文件，再输出报告。不要跳过任何维度。
```

---

## 模块参数速查表

复制审查提示词时，替换参数用：

| 模块名 | 原型文件路径 | design-spec | migration-plan |
|--------|-------------|-------------|----------------|
| 首页 | `docs/UI-design/homepage/homepage-schemes.html` | 无 | 无 |
| 校区设置 | `docs/UI-design/campus-settings/campus-settings.html` | `docs/UI-design/campus-settings/design-spec.md` | `docs/UI-design/campus-settings/migration-plan.md` |
| 学员管理 | `docs/UI-design/Todo/student-management/student-management.html` | `docs/UI-design/Todo/student-management/design-spec.md` | `docs/UI-design/Todo/student-management/migration-plan.md` |
| 教师管理 | `docs/UI-design/Todo/teacher-management/scheme-a-list-detail.html` | `docs/UI-design/Todo/teacher-management/design-spec.md` | `docs/UI-design/Todo/teacher-management/migration-plan.md` |
| 班级管理 | `docs/UI-design/class-management/class-management.html` | `docs/UI-design/class-management/design-spec.md` | `docs/UI-design/class-management/migration-plan.md` |
| 消课流程 | `docs/UI-design/lesson-deduction/lesson-deduction.html` | `docs/UI-design/lesson-deduction/design-spec.md` | 无 |
| 课时充值 | `docs/UI-design/lesson-recharge/lesson-recharge.html` | `docs/UI-design/lesson-recharge/design-spec.md` | `docs/UI-design/lesson-recharge/migration-plan.md` |
| 添加学员 | `docs/UI-design/添加学员页面/05-student-form-designs.html` | 无 | `docs/UI-design/添加学员页面/MIGRATION.md` |

---

## 审查报告归档规范

审查完成后，将报告保存为：
```
docs/UI-design/Todo/{模块名}/review-report.md
```

报告文件头部格式：
```markdown
# {模块名} — UI 设计审查报告

> 审查日期：YYYY-MM-DD
> 审查范围：原型文件 + 设计规范 + 迁移方案
> 问题统计：P0: X / P1: X / P2: X

---

（报告正文）
```

同时更新 `module-registry.md` 中的审查状态和问题数。
