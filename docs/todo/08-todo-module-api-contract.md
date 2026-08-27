# 待办模块 API 契约（前端定稿）

> 状态：前端按本文实现；后端按本文补接口即可联调。  
> **订阅消息模块定稿（独立）**：[`09-subscribe-message-api-contract.md`](./09-subscribe-message-api-contract.md)  
> 前缀：`/api/app/v1`（与 `request.ts` 一致）  
> 前端唯一出口：`todoService`（`src/services/todo.ts`）  
> 废弃：计数聚合 `GET /home/teacher/todos`、`homeService.*Todo*` 薄封装

---

## 0. 设计原则

1. **列表返回完整 Todo 数组**，不再用「计数拼文案」冒充待办。
2. **系统待办 + 自定义待办共用同一 DTO**（`TodoDto` ↔ 前端 `TodoItem`）。
3. **续费提醒 ID 唯一**：`alert-recharge-{studentId}`（课时回升按此 id 清除完成态）。
4. **完成态由服务端权威**；Mock 阶段用本地 storage 模拟，字段形状与真接口一致。
5. `view=home` 排除无提醒随手记；`view=all` 全量（可按 `month` 筛）。

---

## 1. DTO

### 1.1 TodoDto（列表项 / 读写响应）

```json
{
  "id": "alert-recharge-stu-001",
  "title": "「小明」课时续费提醒",
  "desc": "剩余 3 课时 · 请尽快跟进续费",
  "url": "/package-course/pages/recharge-records/index",
  "level": "urgent",
  "category": "studentRecharge",
  "actionLabel": "完成",
  "remindAt": "2026-08-26T07:00:00.000Z",
  "note": null,
  "quadrant": "q2",
  "remindEnabled": true,
  "todoCategoryId": "inbox",
  "completed": false,
  "sourceType": "system",
  "pushedAt": "2026-08-26T07:00:00.000Z",
  "displayDay": "2026-08-26",
  "sharedScope": "campus_ops",
  "assigneeTeacherIds": ["teacher-001"],
  "collaborationMode": null,
  "memberCompletions": null,
  "completion": null,
  "createdAt": "2026-08-26T07:00:00.000Z",
  "refType": "student",
  "refId": "stu-001"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 全局唯一。自定义：`custom-todo-*`；续费：`alert-recharge-{studentId}` |
| `title` | string | 是 | 标题 |
| `desc` | string | 是 | 副文案 |
| `url` | string \| null | 否 | 小程序内跳转路径（含 query） |
| `level` | `urgent\|high\|normal\|low` | 否 | 事态等级（兼容旧 UI） |
| `category` | 见下表 | 是 | 对应「待办提醒」开关 |
| `actionLabel` | string \| null | 否 | 操作文案，默认「完成」 |
| `remindAt` | ISO string \| null | 否 | 提醒时刻 |
| `note` | string \| null | 否 | 备注 |
| `quadrant` | `q1\|q2\|q3\|q4` | 否 | 四象限；缺省由前端兜底 |
| `remindEnabled` | boolean | 否 | 默认 true |
| `todoCategoryId` | string | 否 | 收件箱/自定义夹，默认 `inbox` |
| `completed` | boolean | 是 | 展示态 |
| `sourceType` | `system\|custom` | 是 | 系统推送 / 用户自建 |
| `pushedAt` | ISO string \| null | 否 | 系统推送时间 |
| `displayDay` | `YYYY-MM-DD` \| null | 否 | 时间轴锚定日 |
| `sharedScope` | `private\|campus_ops` | 否 | 默认 `private`；续费等为 `campus_ops` |
| `assigneeTeacherIds` | string[] \| null | 否 | 协作人 |
| `collaborationMode` | `collaborative\|individual` \| null | 否 | 有协作人时生效 |
| `memberCompletions` | Record\|null | 否 | 各自完成记录 |
| `completion` | object\|null | 否 | `{ completedAt, completedBy, completedByName, note? }` |
| `createdAt` | ISO string \| null | 否 | 创建时间 |
| `refType` | string \| null | 否 | 关联实体类型：`student` / `schedule` / `alert` … |
| `refId` | string \| null | 否 | 关联实体 id |

### 1.2 category 枚举

| 值 | 含义 |
|----|------|
| `attendanceCheckin` | 未点名补录 |
| `studentRecharge` | 学员续费 |
| `financePackage` | 课包到期等财务 |
| `leavePending` | 请假待审 |
| `leadFollowUp` | 线索跟进 |
| `salaryRemind` | 发薪/薪资 |
| `meetingRemind` | 复盘/会议 |
| `custom` | 用户自建 |

### 1.3 稳定 ID 约定

| 类型 | id 规则 |
|------|---------|
| 自定义 | `custom-todo-{uuid}` |
| 学员续费 | `alert-recharge-{studentId}` |
| 财务预警 | `todo-alert-{alertId}` |
| 昨日未点名 | `todo-unattended-{scheduleId}-{YYYY-MM-DD}` |
| 其它系统 | `todo-{biz}-{stableKey}` |

---

## 2. 接口列表

### 2.1 拉取列表

```
GET /todos?view=home|all&campusId=&month=YYYY-MM
```

| Query | 说明 |
|-------|------|
| `view` | `home`=首页（排除无提醒随手记）；`all`=我的待办全量 |
| `campusId` | 可选，校区过滤 |
| `month` | 可选，`view=all` 时按月，默认当月 |

**Response `data`**

```json
{
  "items": [ /* TodoDto[] */ ],
  "quadrantOverrides": {
    "alert-recharge-stu-001": "q1"
  }
}
```

- `quadrantOverrides`：当前用户维度覆盖；无则 `{}` 或省略。
- 鉴权角色：`teacher` / `principal` / `admin`（与首页待办可见角色一致）。

### 2.2 新建自定义待办

```
POST /todos
```

```json
{
  "title": "跟进试听家长",
  "note": "备注",
  "remindEnabled": true,
  "remindDate": "2026-08-27",
  "remindTime": "15:00",
  "quadrant": "q3",
  "todoCategoryId": "inbox",
  "collaboratorIds": ["teacher-002"],
  "collaborationMode": "collaborative"
}
```

→ `data`: `TodoDto`（`sourceType=custom`）

### 2.3 更新自定义待办

```
PUT /todos/:todoId
```

Body 同创建（部分字段）；仅 `custom-todo-*` 可改。  
→ `data`: `TodoDto`

### 2.4 删除自定义待办

```
DELETE /todos/:todoId
```

→ `data`: `{ "ok": true }`

### 2.5 完成

```
POST /todos/:todoId/complete
```

```json
{ "note": "已电话沟通", "memberId": "user-xxx" }
```

→ `data`: `{ "todoId": "...", "completion": { ... } }`

- 系统待办：写完成态；续费类在课时回升前不再推送。
- 自定义：按协作模式处理（协同一次完成 / 各自完成）。

### 2.6 重开

```
POST /todos/:todoId/reopen
```

→ `data`: `{ "todoId": "...", "ok": true }`

### 2.7 更新四象限

```
PUT /todos/:todoId/quadrant
```

```json
{ "quadrant": "q2" }
```

→ `data`: `{ "todoId": "...", "quadrant": "q2" }`

按 **userId + todoId** 持久化，幂等。

---

## 3. 课时回升 → 再提醒

当学员剩余课时因充值 / 撤销消课回升到阈值以上：

1. 后端清除该学员 `alert-recharge-{studentId}` 的完成态（等价 reopen）。
2. 下次 `GET /todos` 应再次出现该条（若仍满足续费条件）。

前端 Mock：本地同时 `clearTodoRead` + `clearTodoCompletion`。

---

## 4. 前端联调开关

| 模式 | 行为 |
|------|------|
| `VITE_USE_MOCK=true` | 本地聚合（自定义 storage + 预警 + mock 系统项），不发上述请求 |
| `VITE_USE_MOCK=false` | 全部走本文接口；失败显式报错，不回落 Mock 演示数据 |

---

## 5. 后端落地清单

- [ ] `GET /todos`
- [ ] `POST /todos` / `PUT /todos/:id` / `DELETE /todos/:id`
- [ ] `POST /todos/:id/complete` / `POST /todos/:id/reopen`
- [ ] `PUT /todos/:id/quadrant`
- [ ] 续费 id = `alert-recharge-{studentId}`；课时回升清完成态
- [ ] 鉴权角色与首页待办一致
- [ ] （可选废弃）旧 `GET /home/teacher/todos` 计数接口
