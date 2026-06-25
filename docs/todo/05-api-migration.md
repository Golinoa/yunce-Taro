# 第五阶段：后端 API 对接

> 优先级：中（后端就绪后执行）
> 前置依赖：后端 API 开发完成
> 按模块逐个切换，保留 mock fallback

---

## 总体策略

### 切换原则

1. **逐模块切换**：auth → student → class → package → teacher → campus → statistics → home
2. **环境变量控制**：`VITE_USE_MOCK=true/false`，默认 true
3. **保留 mock 函数**：不删除，作为 fallback 和测试用
4. **接口契约不变**：Service 方法签名不变，只改内部实现

### 切换流程

```
1. 后端提供 API 文档（Swagger/Postman）
2. 对齐接口契约（请求/响应格式）
3. 修改 Service 文件：mock → request.get/post/put/delete
4. 设置 VITE_USE_MOCK=false
5. 联调测试
6. 确认通过 → 合并
```

---

## TASK-37: 请求工具完善

### 问题描述

`src/utils/request.ts` 需完善拦截器，支持 token 注入、错误码映射、刷新逻辑。

### 实现方案

```typescript
// 请求拦截器
request.interceptors.request.use((config) => {
  const token = Taro.getStorageSync('token');
  if (token) {
    config.header = { ...config.header, Authorization: `Bearer ${token}` };
  }
  return config;
});

// 响应拦截器
request.interceptors.response.use(
  (res) => {
    const { code, data, message } = res.data;
    if (code === 0) return data;
    if (code === 401) {
      // token 过期 → 刷新或跳转登录
      return refreshTokenAndRetry(config);
    }
    Taro.showToast({ title: message || '请求失败', icon: 'none' });
    return Promise.reject(new Error(message));
  },
  (err) => {
    Taro.showToast({ title: '网络异常', icon: 'none' });
    return Promise.reject(err);
  }
);
```

### 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/utils/request.ts` | 修改 | 完善拦截器 |

### 验收标准

- [ ] 请求自动注入 token
- [ ] 401 自动刷新 token 或跳转登录
- [ ] 业务错误码统一处理
- [ ] 网络异常友好提示

---

## TASK-38: Auth 模块 API 对接

### 切换清单

| Service 方法 | HTTP | 接口路径 |
|-------------|------|----------|
| `wxLogin` | POST | `/auth/wx-login` |
| `phoneLogin` | POST | `/auth/phone-login` |
| `register` | POST | `/auth/register` |
| `getProfile` | GET | `/auth/profile` |
| `switchRole` | POST | `/auth/switch-role` |
| `refreshToken` | POST | `/auth/refresh-token` |

### 验收标准

- [ ] 微信登录正常
- [ ] 账号登录正常
- [ ] 注册流程正常
- [ ] Token 刷新正常
- [ ] 角色切换正常

---

## TASK-39: Student 模块 API 对接

### 切换清单

| Service 方法 | HTTP | 接口路径 |
|-------------|------|----------|
| `getStudents` | GET | `/students` |
| `getStudentDetail` | GET | `/students/:id` |
| `createStudent` | POST | `/students` |
| `updateStudent` | PUT | `/students/:id` |
| `deleteStudent` | DELETE | `/students/:id` |
| `getStudentPackages` | GET | `/students/:id/packages` |
| `deductHours` | POST | `/students/:id/deduct` |
| `revokeLessonRecord` | POST | `/lesson-records/:id/revoke` |

### 验收标准

- [ ] 学员列表正常加载
- [ ] 学员详情正常展示
- [ ] 创建/编辑/删除学员正常
- [ ] 消课扣减正常
- [ ] 撤销消课正常

---

## TASK-40: Class 模块 API 对接

### 切换清单

| Service 方法 | HTTP | 接口路径 |
|-------------|------|----------|
| `getClasses` | GET | `/classes` |
| `getClassDetail` | GET | `/classes/:id` |
| `createClass` | POST | `/classes` |
| `updateClass` | PUT | `/classes/:id` |
| `addStudents` | POST | `/classes/:id/students` |
| `removeStudent` | DELETE | `/classes/:id/students/:studentId` |
| `transferStudent` | POST | `/classes/:id/transfer` |

### 验收标准

- [ ] 班级列表正常加载
- [ ] 班级详情正常展示
- [ ] 创建/编辑班级正常
- [ ] 添加/移除学员正常
- [ ] 调班正常

---

## TASK-41: Package 模块 API 对接

### 切换清单

| Service 方法 | HTTP | 接口路径 |
|-------------|------|----------|
| `getPackageTemplates` | GET | `/package-templates` |
| `createRecharge` | POST | `/recharges` |
| `getRechargeRecords` | GET | `/recharges` |

### 验收标准

- [ ] 课包模板列表正常
- [ ] 充值创建正常
- [ ] 充值记录正常

---

## TASK-42: Teacher 模块 API 对接

### 切换清单

| Service 方法 | HTTP | 接口路径 |
|-------------|------|----------|
| `getTeachers` | GET | `/teachers` |
| `getTeacherDetail` | GET | `/teachers/:id` |
| `createTeacher` | POST | `/teachers` |
| `updateTeacher` | PUT | `/teachers/:id` |
| `getSalaryDetail` | GET | `/teachers/:id/salary` |
| `confirmSalary` | POST | `/teachers/:id/salary/confirm` |
| `batchConfirmSalary` | POST | `/teachers/salary/batch-confirm` |

### 验收标准

- [ ] 教师列表正常加载
- [ ] 教师详情正常展示
- [ ] 薪资计算正常
- [ ] 确认/批量确认正常

---

## TASK-43: Campus 模块 API 对接

### 切换清单

| Service 方法 | HTTP | 接口路径 |
|-------------|------|----------|
| `getCampusInfo` | GET | `/campus` |
| `updateCampus` | PUT | `/campus` |
| `getSubjects` | GET | `/campus/subjects` |
| `createSubject` | POST | `/campus/subjects` |
| `getHolidays` | GET | `/campus/holidays` |
| `getPayDays` | GET | `/campus/pay-days` |

### 验收标准

- [ ] 校区信息正常加载
- [ ] 科目管理正常
- [ ] 假期管理正常
- [ ] 发薪日设置正常

---

## TASK-44: Statistics + Home 模块 API 对接

### 切换清单

| Service 方法 | HTTP | 接口路径 |
|-------------|------|----------|
| `getStatistics` | GET | `/statistics` |
| `getHomeStats` | GET | `/home/stats` |
| `getSchedule` | GET | `/home/schedule` |

### 验收标准

- [ ] 统计页数据正常
- [ ] 首页统计数据正常
- [ ] 课表数据正常

---

## 环境变量配置

```typescript
// src/config/env.ts
export const USE_MOCK = process.env.VITE_USE_MOCK === 'true';

// src/services/student.ts
import { USE_MOCK } from '@/config/env';

export const studentService = {
  async getStudents(params: StudentQuery) {
    if (USE_MOCK) return mockGetStudents(params);
    return request.get<StudentListResponse>('/students', { data: params });
  },
  // ...
};
```
