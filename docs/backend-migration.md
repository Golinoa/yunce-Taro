# 后端对接备忘录

本文档记录前端 Mock 数据层与真实后端 API 的对应关系，供后端开发与前端联调参考。

---

## 一、必须实现的安全机制

### 1. 认证与授权

| 机制 | 说明 | 前端配合 |
|------|------|----------|
| JWT Token | 登录后返回 access_token / refresh_token | 前端已实现 token 存储与自动恢复，需后端返回相同结构 |
| Token 刷新 | access_token 过期后用 refresh_token 换新 | 前端需增加请求拦截器自动刷新逻辑 |
| 接口鉴权 | 所有业务接口需验证 Bearer Token | 前端需在请求头统一携带 Authorization |
| 角色权限 | teacher / parent 角色隔离，接口层校验 | 前端已做 UI 层权限控制，后端需做数据层校验 |

### 2. 数据安全

| 机制 | 说明 |
|------|------|
| 教师数据隔离 | 教师只能访问自己创建的学生/班级/排课/记录 |
| 家长数据隔离 | 家长只能访问已绑定学生的数据 |
| 邀请码校验 | 家长注册/绑定时验证邀请码有效性 |
| 输入校验 | 后端对所有入参做类型、长度、格式校验 |

---

## 二、API 接口清单

### 认证模块 (`/api/auth`)

对应前端文件: `src/data/auth.ts`

| 前端函数 | 建议接口 | 方法 | 请求参数 | 返回结构 |
|----------|----------|------|----------|----------|
| `mockLogin` | `/api/auth/login` | POST | `{ username, password }` | `{ session: { access_token, refresh_token, expires_at, user: { id, email } }, profile: { id, name, role, ... } }` |
| `mockRegister` | `/api/auth/register` | POST | `{ username, password, role, name, inviteCode? }` | 同 login 返回结构 |
| `mockGetSession` | `/api/auth/session` | GET | Header: Authorization | `{ session, profile }` |
| `mockLogout` | `/api/auth/logout` | POST | Header: Authorization | `{ success: true }` |
| `mockValidateInviteCode` | `/api/auth/validate-invite` | POST | `{ code }` | `{ valid, studentId?, studentName? }` |

### 学生模块 (`/api/students`)

对应前端文件: `src/data/students.ts`

| 前端函数 | 建议接口 | 方法 | 请求参数 | 返回结构 |
|----------|----------|------|----------|----------|
| `mockGetStudentsByTeacher` | `/api/teachers/:id/students` | GET | teacher_id (路径参数) | `Student[]` |
| `mockGetStudentsByParent` | `/api/parents/:id/students` | GET | parent_id (路径参数) | `Student[]` |
| `mockGetStudentById` | `/api/students/:id` | GET | student_id (路径参数) | `Student` |
| `mockCreateStudent` | `/api/students` | POST | `{ teacher_id, name, nickname?, invite_code, gender?, birthday?, phone?, address?, note?, fee_amount?, fee_method? }` | `Student` |
| `mockUpdateStudent` | `/api/students/:id` | PUT | 同 create 字段 | `Student` |
| `mockGetParentsByStudent` | `/api/students/:id/parents` | GET | student_id (路径参数) | `StudentParent[]` |
| `mockBindStudentToParent` | `/api/students/:id/bind-parent` | POST | `{ parent_id, invite_code }` | `{ success }` |

### 课时套餐模块 (`/api/packages`)

对应前端文件: `src/data/students.ts`

| 前端函数 | 建议接口 | 方法 | 请求参数 | 返回结构 |
|----------|----------|------|----------|----------|
| `mockGetActivePackagesByStudent` | `/api/students/:id/packages` | GET | student_id (路径参数) | `CoursePackage[]` |
| `mockCreatePackage` | `/api/packages` | POST | `{ teacher_id, student_id, name, total_hours, remaining_hours, status }` | `CoursePackage` |
| `mockUpdatePackage` | `/api/packages/:id` | PUT | 同 create 字段 | `CoursePackage` |
| `mockDeductPackageHours` | `/api/packages/:id/deduct` | POST | `{ hours }` | `CoursePackage` |

### 消课记录模块 (`/api/records`)

对应前端文件: `src/data/students.ts`

| 前端函数 | 建议接口 | 方法 | 请求参数 | 返回结构 |
|----------|----------|------|----------|----------|
| `mockGetLessonRecordsByTeacher` | `/api/teachers/:id/records` | GET | teacher_id, 可选 date 范围筛选 | `LessonRecord[]` |
| `mockGetLessonRecordsByStudent` | `/api/students/:id/records` | GET | student_id | `LessonRecord[]` |
| `mockGetLessonRecordById` | `/api/records/:id` | GET | record_id | `LessonRecord` |
| `mockCreateLessonRecord` | `/api/records` | POST | `{ teacher_id, student_id, package_id, lesson_date, hours_used, content?, performance?, homework?, photos? }` | `LessonRecord` |
| `mockDeleteLessonRecord` | `/api/records/:id` | DELETE | record_id | `{ success }` |

### 班级模块 (`/api/classes`)

对应前端文件: `src/data/students.ts`

| 前端函数 | 建议接口 | 方法 | 请求参数 | 返回结构 |
|----------|----------|------|----------|----------|
| `mockGetClassesByTeacher` | `/api/teachers/:id/classes` | GET | teacher_id | `Class[]` |
| `mockGetClassById` | `/api/classes/:id` | GET | class_id | `Class` |
| `mockGetStudentsByClass` | `/api/classes/:id/students` | GET | class_id | `Student[]` |
| `mockCreateClass` | `/api/classes` | POST | `{ teacher_id, name, description? }` | `Class` |
| `mockUpdateClass` | `/api/classes/:id` | PUT | 同 create 字段 | `Class` |
| `mockDeleteClass` | `/api/classes/:id` | DELETE | class_id | `{ success }` |
| `mockAddStudentsToClass` | `/api/classes/:id/students` | POST | `{ student_ids: string[] }` | `{ success }` |
| `mockRemoveStudentFromClass` | `/api/classes/:id/students/:studentId` | DELETE | class_id, student_id | `{ success }` |

### 排课模块 (`/api/schedules`)

对应前端文件: `src/data/students.ts`

| 前端函数 | 建议接口 | 方法 | 请求参数 | 返回结构 |
|----------|----------|------|----------|----------|
| `mockGetSchedulesByTeacher` | `/api/teachers/:id/schedules` | GET | teacher_id | `Schedule[]` |
| `mockCreateSchedule` | `/api/schedules` | POST | `{ teacher_id, student_id, day_of_week, start_time, end_time, color?, note? }` | `Schedule` |
| `mockUpdateSchedule` | `/api/schedules/:id` | PUT | 同 create 字段 | `Schedule` |
| `mockDeleteSchedule` | `/api/schedules/:id` | DELETE | schedule_id | `{ success }` |

### 请假模块 (`/api/leaves`)

对应前端文件: `src/data/students.ts`

| 前端函数 | 建议接口 | 方法 | 请求参数 | 返回结构 |
|----------|----------|------|----------|----------|
| `mockGetLeaveRequestsByStudent` | `/api/students/:id/leaves` | GET | student_id | `LeaveRequest[]` |
| `mockCreateLeaveRequest` | `/api/leaves` | POST | `{ student_id, type, start_date, end_date, reason? }` | `LeaveRequest` |
| `mockUpdateLeaveRequest` | `/api/leaves/:id` | PUT | 同 create 字段 + status | `LeaveRequest` |

### 通知模块 (`/api/notifications`)

对应前端文件: `src/data/students.ts`

| 前端函数 | 建议接口 | 方法 | 请求参数 | 返回结构 |
|----------|----------|------|----------|----------|
| `mockGetNotificationsByUser` | `/api/users/:id/notifications` | GET | user_id, 可选 type 筛选 | `Notification[]` |
| `mockGetUnreadCount` | `/api/users/:id/notifications/unread-count` | GET | user_id | `{ count: number }` |
| `mockSendNotification` | `/api/notifications` | POST | `{ sender_id, recipient_ids, type, title, content }` | `Notification` |
| `mockMarkNotificationRead` | `/api/notifications/:id/read` | PUT | notification_id | `{ success }` |

### 首页聚合接口 (`/api/home`)

对应前端文件: `src/data/home.ts`

| 前端函数 | 建议接口 | 方法 | 请求参数 | 返回结构 |
|----------|----------|------|----------|----------|
| `mockGetTeacher` | `/api/teachers/:id` | GET | user_id | `Teacher` |
| `mockGetStudents` | `/api/teachers/:id/students` | GET | teacher_id | `Student[]` |
| `mockGetTodaySchedules` | `/api/teachers/:id/schedules/today` | GET | teacher_id | `Schedule[]` |
| `mockGetRecentRecords` | `/api/teachers/:id/records/recent` | GET | teacher_id, limit | `LessonRecord[]` |
| `mockGetTotalRemainingHours` | `/api/teachers/:id/remaining-hours` | GET | teacher_id | `{ total: number }` |
| `mockGetTodayRecordCount` | `/api/teachers/:id/records/today-count` | GET | teacher_id | `{ count: number }` |
| `mockGetStudentsByParent` | `/api/parents/:id/students` | GET | parent_id | `Student[]` |
| `mockGetSchedulesByStudent` | `/api/students/:id/schedules` | GET | student_id | `Schedule[]` |
| `mockGetRecordsByStudent` | `/api/students/:id/records` | GET | student_id, limit | `LessonRecord[]` |
| `mockGetPackagesByStudent` | `/api/students/:id/packages` | GET | student_id | `CoursePackage[]` |

### 反馈模块 (`/api/feedback`)

对应前端文件: `src/data/feedback.ts`

| 前端函数 | 建议接口 | 方法 | 请求参数 | 返回结构 |
|----------|----------|------|----------|----------|
| `mockCreateFeedback` | `/api/feedback` | POST | `{ user_id, role, content, images }` | `{ success }` |

---

## 三、前端配合修改清单

对接真实后端时，前端需做以下改动：

### 1. 创建 API 请求层

- 新建 `src/utils/request.ts`，封装 Taro.request，统一处理：
  - 请求头注入 Authorization Bearer Token
  - 401 自动跳转登录页
  - Token 过期自动刷新
  - 统一错误码处理

### 2. 替换 Mock 数据调用

- 将 `src/data/*.ts` 中所有 `mock*` 函数替换为真实 API 调用
- 保持函数签名和返回类型不变，页面层代码无需修改
- 建议逐模块替换，每替换一个模块做一次联调测试

### 3. 环境变量配置

- 开发环境可继续使用 Mock 数据
- 生产环境切换为真实 API
- 建议在 `src/data/` 下创建 `api.ts`，通过环境变量自动选择 Mock 或真实接口

### 4. 文件上传

- 反馈图片上传需对接 OSS/CDN
- 消课记录照片上传需对接 OSS/CDN
- 前端需实现图片压缩后再上传

---

## 四、原代码安全漏洞对照

| 漏洞 | 修复状态 | 后端需注意 |
|------|----------|------------|
| 硬编码用户 ID (teacher-001/parent-001) | 已修复，改为动态获取 profile.id | 后端接口必须校验当前用户是否有权访问请求的资源 |
| 错误信息直接暴露 (err?.message) | 已修复，改为通用提示文案 | 后端返回的错误信息不应包含堆栈、SQL 等敏感信息 |
| 生产环境 console 输出 | 已修复，通过 logger.ts 环境判断控制 | — |
| Mock 数据明文密码 | 仅开发环境使用 | 后端必须使用 bcrypt 等算法加密存储密码 |
| Token 存储在 localStorage | 小程序使用 wx.setStorageSync | 后端需设置合理的 Token 过期时间，支持 Token 撤销 |

---

## 五、验收标准

### 功能验收

- [ ] 所有页面正常加载，无白屏
- [ ] 登录/注册流程完整
- [ ] 教师 CRUD 学生/班级/排课/消课记录
- [ ] 家长查看孩子信息/课时/排课/记录
- [ ] 通知发送与接收
- [ ] 请假申请与审批

### 安全验收

- [ ] 未登录无法访问业务页面（路由守卫生效）
- [ ] 教师 A 无法访问教师 B 的数据
- [ ] 家长只能查看已绑定学生的数据
- [ ] Token 过期后自动跳转登录页
- [ ] 生产环境无 console 敏感信息输出
- [ ] 所有接口返回通用错误提示，不暴露后端细节

### 性能验收

- [ ] 首页加载时间 < 2s
- [ ] 页面切换流畅，无明显卡顿
- [ ] 列表页滚动流畅
