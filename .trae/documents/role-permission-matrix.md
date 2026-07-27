# 云策教务 - 角色权限矩阵

> 文档版本：v1.1  
> 梳理日期：2026-07-26  
> 状态：待产品确认  

---

## 一、角色定义

### 1.1 业务角色

| 业务身份 | 说明 |
|---|---|
| **管理员** | 注册机构的人，最高权限，可管理所有校区、账号、全局配置 |
| **校长** | 机构下的校区管理者，可管理自己校区的教务 |
| **老师** | 授课老师，管理自己的课程、班级、学员 |
| **助教** | 辅助老师，权限比老师略低（可点名、考勤，不可编辑/创建/删除） |
| **家长** | 学生家长，用于约课、查看课时、接收通知 |

### 1.2 代码角色映射

当前类型定义在 `src/types/profile.ts`：

```ts
export type UserRole = 'principal' | 'teacher' | 'parent';
```

为对齐业务角色，建议扩展为：

```ts
export type UserRole = 'admin' | 'principal' | 'teacher' | 'assistant' | 'parent';
```

| 业务身份 | 代码角色 | 备注 |
|---|---|---|
| 管理员 | `admin` | 新增 |
| 校长 | `principal` | 已有，历史数据中注册机构的人当前都是该角色 |
| 老师 | `teacher` | 已有 |
| 助教 | `assistant` | 新增 |
| 家长 | `parent` | 已有 |

### 1.3 过渡兼容策略

**当前现状**：后端尚未新增 `admin` 和 `assistant` 角色，注册机构的人统一为 `principal`。

**过渡方案**（admin 上线前）：

| 过渡期逻辑 | 说明 |
|---|---|
| `isAdmin(role)` = `role === 'admin' \|\| role === 'principal'` | principal 临时享有管理员权限，可进入系统设置 |
| `isStaffRole(role)` 包含 `assistant` | 助教走机构端视图（教师视图简化版） |

**正式期**（后端角色拆分完成后）：

| 正式期逻辑 | 说明 |
|---|---|
| `isAdmin(role)` = `role === 'admin'` | 仅 admin 可进入系统设置，principal 降为校区管理者 |
| 历史 principal 数据由后端批量迁移为 `admin` | 需配合数据库迁移脚本 |

> ⚠️ 权限矩阵中标注 `[过渡]` 的项表示过渡期 principal 享有 admin 权限，正式期需收回。

---

## 二、权限图例

| 符号 | 含义 |
|---|---|
| ✅ | 可见且可用（完整操作权限） |
| 👁 | 可见但仅查看/受限（不可编辑/创建/删除） |
| ❌ | 不可见/不可用 |

---

## 三、权限矩阵

> 矩阵中 admin 列为**正式期**权限，principal 列为**正式期**权限。  
> 过渡期 principal 的权限 = admin 列（因 `isAdmin(principal) === true`）。

### 3.1 底部 TabBar

| Tab | admin | principal | teacher | assistant | parent |
|---|---|---|---|---|---|
| 首页 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 课表 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 统计 | ✅ | ✅ | ✅ | 👁 仅自己 | 👁 仅个人课时 |
| 我的 | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.2 主包页面

| 页面/功能 | admin | principal | teacher | assistant | parent |
|---|---|---|---|---|---|
| **首页 (pages/home/index)** | 教师端完整版 | 教师端完整版 | 教师端完整版 | 教师端简化版（无统计卡片） | 家长端（仅未读消息 + 运营位） |
| **课表 (pages/schedule/index)** | 全校课表 + 所有操作 | 本校课表 + 大部分操作 | 自己的课表 + 点名 | 协助班级课表 + 点名 | ❌ 家长通过「我的约课」入口进入约课页，不直接用课表 Tab |
| **约课 (pages/booking/index)** | 查看/管理开放预约 | 查看/管理开放预约 | 查看/管理开放预约 | 👁 查看 | ✅ 家长约课入口 |
| **统计 (pages/statistics/index)** | 运营 + 财务全校数据 | 运营 + 财务本校数据 | 仅自己相关数据 | 仅协助班级数据 | 仅个人课时统计 |
| **我的 (pages/profile/index)** | 全部入口（含系统设置） | 除系统设置外全部 | 教师视图 | 教师视图简化 | 家长视图 |
| **通知 (pages/notifications/index)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **协议 (pages/agreement/index)** | ✅ | ✅ | ✅ | ✅ | ✅ |

> **家长课表 Tab 说明**：当前 TabBar 配置家长可见课表 Tab，但课表页无家长专属视图。建议要么在课表页增加家长视图（展示孩子课程），要么对家长隐藏课表 Tab。需产品确认。

### 3.3 学员管理 (package-student)

| 页面 | admin | principal | teacher | assistant | parent |
|---|---|---|---|---|---|
| 学员列表 (students) | ✅ 全校 | ✅ 本校 | ✅ 自己的学员 | 👁 查看 | ❌ |
| 学员详情 (student-detail) | ✅ | ✅ | ✅ | 👁 查看 | ✅ 自己的孩子 |
| 学员表单 (student-form) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 学员转移 (student-transfer) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 家长绑定 (parent-bind) | ✅ | ✅ | ✅ | ✅ | ✅ 自己绑定 |

### 3.4 教师管理 (package-teacher)

| 页面 | admin | principal | teacher | assistant | parent |
|---|---|---|---|---|---|
| 教师列表 (teacher-list) | ✅ | ✅ | 👁 查看 | 👁 查看 | ❌ |
| 教师详情 (teacher-detail) | ✅ | ✅ | ✅ 自己 | 👁 查看 | ❌ |
| 薪资详情 (salary-detail) | ✅ | ✅ | ✅ 自己 | ❌ | ❌ |
| 考勤 (attendance) | ✅ | ✅ | ✅ 自己 | ✅ 自己 | ❌ |

### 3.5 课程 / 班级 / 课包 (package-course)

| 页面 | admin | principal | teacher | assistant | parent |
|---|---|---|---|---|---|
| 班级列表 (classes) | ✅ | ✅ | ✅ 自己的 | 👁 查看 | ❌ |
| 班级详情 (class-detail) | ✅ | ✅ | ✅ | 👁 查看 | ❌ |
| 班级表单 (class-form) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 点名消课 (class-checkin) | ✅ | ✅ | ✅ | ✅ 协助点名 | ❌ |
| 课包列表 (course-packages) | ✅ | ✅ | ✅ | 👁 查看 | ✅ 自己的 |
| 课包表单 (package-form) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 排课表单 (schedule-form) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 课程详情 (lesson-detail) | ✅ | ✅ | ✅ | 👁 查看 | ❌ |
| 课程编辑 (lesson-edit) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 课程补充 (lesson-supplement) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 请假 (leave-request) | ✅ 审批+管理 | ✅ 审批+管理 | ✅ 提交 | ✅ 提交 | ✅ 提交 |
| 消课记录 (records) | ✅ | ✅ | ✅ | ✅ | ✅ 自己的 |
| 充值记录 (recharge-records) | ✅ | ✅ | ✅ | ❌ | ✅ 自己的 |
| 批量调课 (batch-reschedule) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 预约记录详情 (booking-record-detail) | ✅ | ✅ | ✅ | 👁 查看 | ✅ 自己的 |
| 预约规则 (booking-rule) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 教师约课配置 (teacher-booking-config) | ✅ | ✅ | ✅ 自己 | ❌ | ❌ |

### 3.6 设置 (package-settings)

| 页面 | admin | principal | teacher | assistant | parent |
|---|---|---|---|---|---|
| **系统设置 (system-settings)** | ✅ 全部项 | ✅ `[过渡]` 全部项 / 正式期仅通用项 | ✅ 仅通用项 | ✅ 仅通用项 | ✅ 仅通用项 |
| 校区设置 (campus-settings) | ✅ 可编辑 | ✅ 可编辑 | 👁 仅查看 | ❌ | ❌ |
| 使用反馈 (feedback) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 发送通知 (notification-send) | ✅ | ✅ | ✅ | ❌ | ❌ |

> **系统设置项分类**：
> - **通用项**（所有角色可见）：操作记录、主题颜色、用户协议、退出登录
> - **管理员专属项**（仅管理员可见）：课表管理、定时备份、重置新手引导
> - 过渡期 `isAdmin(principal) === true`，principal 可见全部项

### 3.7 试听线索 (package-lead)

| 页面 | admin | principal | teacher | assistant | parent |
|---|---|---|---|---|---|
| 我的邀约 (my-invite) | ✅ | ✅ | ✅ 自己的邀约 | ✅ 自己的邀约 | ❌ |
| 线索详情 (lead-detail) | ✅ | ✅ | ✅ 分配给自己的 | 👁 协助跟进 | ❌ |
| 线索表单 (lead-form) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 试听预约 (trial-booking) | ✅ | ✅ | ✅ | ✅ | ✅ 家长预约 |
| 代约页面 (proxy-booking-form) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 会员选择 (proxy-member-select) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 试听时段 (trial-slots) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 时段配置 (trial-slot-config) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 开放时段编辑 (open-slot-edit) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 班级时段配置 (class-slot-config) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 邀约二维码 (invite-qrcode) | ✅ | ✅ | ✅ | ❌ | ❌ |
| 邀约落地页 (invite-landing) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 预约详情 (lead-booking-detail) | ✅ | ✅ | ✅ | 👁 查看 | ✅ 自己的 |
| 预约编辑 (lead-booking-edit) | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 四、当前代码现状

### 4.1 角色判断函数

```ts
// src/utils/auth.tsx
export const isStaffRole = (role: UserRole | null | undefined): boolean => {
  return role === 'teacher' || role === 'principal';
};
```

当前仅区分「机构端」和「家长端」，无法细分管理员/校长/老师/助教。

### 4.2 系统设置入口

当前 `src/pages/profile/index.tsx` 中：

- 教师视图的「系统管理」里包含「系统设置」→ 所有 isStaffRole 用户可见
- 家长视图的「系统管理」里也包含「系统设置」→ 家长也可见

需调整为仅 `isAdmin` 可见。

### 4.3 后端角色映射

```ts
// src/services/auth.ts
const mapBackendRole = (role: BackendRole): UserRole => {
  switch (role) {
    case 'PARENT':  return 'parent';
    case 'TEACHER': return 'teacher';
    case 'PRINCIPAL':
    default:        return 'principal';
  }
};
```

扩展后需新增 `ADMIN` / `ASSISTANT` 分支。

### 4.4 路由守卫

当前 `src/utils/route-guard.tsx` 仅校验登录态，不校验角色权限。敏感页面需要在页面内部或路由层补充角色拦截。

---

## 五、建议的代码实现

### 5.1 扩展 UserRole

```ts
// src/types/profile.ts
export type UserRole = 'admin' | 'principal' | 'teacher' | 'assistant' | 'parent';
```

### 5.2 新增权限判断函数

```ts
// src/utils/auth.tsx

/** 是否为管理员（过渡期 principal 同享，正式期仅 admin） */
export const isAdmin = (role: UserRole | null | undefined): boolean =>
  role === 'admin' || role === 'principal'; // 正式期改为 role === 'admin'

/** 是否为机构端（admin + principal + teacher + assistant） */
export const isStaffRole = (role: UserRole | null | undefined): boolean =>
  role === 'admin' || role === 'principal' || role === 'teacher' || role === 'assistant';

/** 是否为校长及以上（admin + principal） */
export const isPrincipalOrAbove = (role: UserRole | null | undefined): boolean =>
  role === 'admin' || role === 'principal';

/** 是否为教学角色（teacher + assistant，不含管理岗） */
export const isTeachingRole = (role: UserRole | null | undefined): boolean =>
  role === 'teacher' || role === 'assistant';

/** 是否为老师（不含助教） */
export const isTeacherRole = (role: UserRole | null | undefined): boolean =>
  role === 'teacher';

/** 是否为助教 */
export const isAssistantRole = (role: UserRole | null | undefined): boolean =>
  role === 'assistant';

/** 是否为学生家长 */
export const isParentRole = (role: UserRole | null | undefined): boolean =>
  role === 'parent';
```

> `isAdmin` 和 `isPrincipalOrAbove` 当前逻辑相同，但语义不同：  
> - `isAdmin` 用于**功能访问控制**（如系统设置），正式期会改为 `role === 'admin'`  
> - `isPrincipalOrAbove` 用于**数据范围控制**（如校区级数据），永久包含 principal

### 5.3 入口控制示例

```ts
// src/pages/profile/index.tsx
const systemItems = useMemo(() => {
  const items = [
    { label: '使用帮助', ... },
    { label: '平台客服', ... },
    { label: '消息通知', ... },
  ];
  if (isAdmin(currentRole)) {
    items.push({ label: '系统设置', ... });
  }
  return items;
}, [currentRole]);
```

### 5.4 页面级角色守卫示例

```ts
// src/package-settings/pages/system-settings/index.tsx
useEffect(() => {
  if (!isAdmin(currentRole)) {
    Taro.showToast({ title: '无权限访问', icon: 'none' });
    Taro.navigateBack();
  }
}, [currentRole]);
```

### 5.5 后端角色映射扩展

```ts
// src/services/auth.ts
const mapBackendRole = (role: BackendRole): UserRole => {
  switch (role) {
    case 'ADMIN':     return 'admin';
    case 'ASSISTANT': return 'assistant';
    case 'PARENT':    return 'parent';
    case 'TEACHER':   return 'teacher';
    case 'PRINCIPAL':
    default:          return 'principal';
  }
};
```

---

## 六、已确认事项

| # | 问题 | 决策 | 实施方式 |
|---|---|---|---|
| 1 | admin 与 principal 的拆分时机 | 过渡期 principal = admin，正式期后端拆分 | `isAdmin` 过渡期包含 principal |
| 2 | 家长课表 Tab | 家长不直接使用课表页 | 课表页内家长重定向到约课页 |
| 3 | 助教能否单独点名 | 允许，助教与老师点名权限相同 | class-checkin 不区分 teacher/assistant |
| 4 | 助教是否需要「我的约课」入口 | 不需要，约课由老师代约 | 教师视图不增加约课入口 |
| 5 | 老师能否查看全校班级列表 | 允许查看，不可操作他人班级 | classes 页面查看全校 |
| 6 | 校长统计范围 | 默认本校，可选切换校区 | statistics 页面校区筛选 |

---

## 七、相关文件

| 文件 | 用途 |
|---|---|
| `src/types/profile.ts` | UserRole 类型定义 |
| `src/utils/auth.tsx` | 角色判断函数 + AuthProvider |
| `src/services/auth.ts` | 后端角色映射 mapBackendRole |
| `src/pages/profile/index.tsx` | 个人中心入口（系统设置可见性） |
| `src/package-settings/pages/system-settings/index.tsx` | 系统设置页面 |
| `src/utils/route-guard.tsx` | 路由守卫（仅登录态校验） |
