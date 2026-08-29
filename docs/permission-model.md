# 权限体系规划（2026-08-22 用户口径确认）

> 状态：**规划基座已落地（类型模型 + 页面访问矩阵），授权 UI 未实现（规划中）**  
> **UI 可见性落地矩阵（按角色）**：见 [role-visibility-matrix.md](./role-visibility-matrix.md)（Tab / 我的 / 课表 / 系统设置 / 路由守卫，2026-08-29 收口）  
> 代码落点：`src/types/permission.ts`（模型）、`src/utils/route-guard.tsx`（页面访问矩阵）、
> 数据层 `filterXxxByActor`（数据范围过滤，已有）

---

## 一、角色定义（用户口径，务必以此为准）

| 角色 | 定位 | 数据范围 | 权限要点 |
|---|---|---|---|
| **管理员 admin** | **机构创建者**（注册机构的人） | `all`（机构全部） | 拥有校区所有数据查看权限；**可进行权限分配**（授权/关闭某些数据权限，UI 暂未实现，规划中） |
| **校长 principal** | 管理员**任命**的职位 | `all`（校区全部） | 拥有校区所有数据查看权限；部分数据模块可由管理员通过开关授权/关闭 |
| **老师 teacher** | 教学岗 | `own`（默认仅本人名下） | 默认查看**自己的学生**的数据；可由管理员/校长开关授权扩大 |
| **前台 assistant** | 前台岗 | `own` | 同老师：默认仅本人名下数据 |
| **家长 parent** | 家长端 | `own`（绑定孩子） | 仅查看**所绑定机构下绑定孩子**的数据；**未绑定任何孩子（即未绑定机构）→ 什么数据都看不到** |

## 二、数据范围模型 `DataScope`

```
own   → 仅本人名下数据（teacher/assistant 默认；parent=绑定孩子）
campus→ 所属校区全部数据
all   → 机构全部数据（admin/principal）
```

当前数据层已具备 actor 过滤：`filterStudentsByActor` / `filterSchedulesByActor` /
`filterPackagesByActor` / `filterLessonRecordsByActor`（按当前身份裁剪数据），
是 `own` 范围的实际执行层；家长端读取按 `parent_profile.student_id` 绑定过滤。

## 三、数据模块 `DataModule`（授权开关的粒度）

| 模块 | 说明 | 默认可见角色 |
|---|---|---|
| `salary` 薪资 | 薪资列表/发放/模板 | admin/principal/teacher(本人) |
| `students` 学员 | 学员档案/会员卡/调班 | 机构端全部（teacher/assistant 按 own 过滤） |
| `classes` 班级/课程 | 班级/排课/考勤 | 机构端全部 |
| `leads` 线索 | 线索/试听/代约 | admin/principal/teacher/assistant |
| `finance` 经营数据 | 统计/财务/经营看板 | admin/principal |
| `staff` 员工管理 | 教师/员工管理 | admin/principal |
| `settings` 系统设置 | 系统/校区设置 | admin（校长默认不可见） |

## 四、角色默认权限矩阵（`ROLE_PERMISSION_MAP`）

| 角色 | defaultScope | defaultModules | toggleable |
|---|---|---|---|
| admin | all | 全部模块 | ✅ |
| principal | all | 除 settings 外全部 | ✅（由 admin 开关） |
| teacher | own | students/classes/leads/salary | ✅（由 admin/principal 开关） |
| assistant | own | students/classes/leads | ✅（由 admin/principal 开关） |
| parent | own | students（仅绑定孩子） | ❌ |

## 五、页面访问矩阵（当前落地 · `PAGE_ROLE_REQUIREMENTS`）

- **admin/principal**：全部管理页（薪资管理/教师管理/学员/课程/经营看板/门店入驻）
- **teacher**：本人薪资详情、考勤、学员、班级、线索（默认 own 范围）
- **assistant**：学员、班级、线索（无薪资）
- **parent**：不可进入任何管理页，仅家长端页面（首页/课表/预约/我的课程/子女/档案等）
- 未列入矩阵的页面：所有已登录用户可访问

## 六、授权开关 UI（规划中，未实现）

管理员在「机构设置」中对 **principal/teacher/assistant** 三个角色逐模块开关：

1. **入口**：建议放在系统设置（`system-settings`）→「角色权限」；当前该页有占位项可复用
2. **粒度**：按 `DataModule`（薪资/学员/班级/线索/经营数据/员工/设置）+ 数据范围（own/campus/all）
3. **存储**：`grantedModules` / `grantedScope` 随角色-机构维度持久化（mock 存本地，联调落后端表）
4. **生效路径**：页面访问由 `ROLE_PERMISSION_MAP + grantedModules` 动态推导（届时
   `PAGE_ROLE_REQUIREMENTS` 收敛为入口清单）；数据层 filter 按 grantedScope 裁剪；
   **接口层必须二次校验（服务端强制）**，前端校验仅作体验兜底

## 七、家长绑定规则

- 家长身份通过绑定码/邀请绑定到机构下孩子（`parent_profile.student_id` + `bind_status`）
- 已绑定：仅可见绑定孩子相关数据（子女/课包/课表/课时）
- 未绑定（`bind_status === 'unbound'` 或无 `student_id`）：**所有数据为空**（`hasBoundChild()` 判定）

## 八、演进路线

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 类型基座 `types/permission.ts` + 页面访问矩阵 + 数据层 actor 过滤 | ✅ 已落地 |
| P1 | 授权开关 UI（系统设置 → 角色权限）+ grantedModules 持久化 | ⏳ 待排期 |
| P2 | 接口级权限校验（后端强制，前端防 UI 直跳仅体验） | ⏳ 联调时与后端对齐 |
| P3 | 权限审计日志（谁在何时授权/关闭了什么） | ⏳ 规划 |
