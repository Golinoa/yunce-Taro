# 待办四象限（事态等级）— 前端接口契约

> 状态：前端链路已写完；后端按本文补接口后即可联调。  
> 前端入口：`homeService.updateTodoQuadrant`（`src/services/home.ts`）  
> 前缀：`/api/app/v1`（与现有 home 模块一致）

---

## 1. 更新象限（必做）

```
PUT /home/teacher/todos/:todoId/quadrant
```

| 项 | 说明 |
|---|---|
| 鉴权 | `requireAuth` |
| 角色 | 与待办列表一致：`TEACHER`（若校长/管理员也看教师首页待办，需一并放开） |
| Path | `todoId`：待办唯一 id（系统待办 / 自定义待办均可） |

### Request body

```json
{
  "quadrant": "q2"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `quadrant` | `'q1' \| 'q2' \| 'q3' \| 'q4'` | 是 | 艾森豪威尔四象限 |

| 值 | 含义 |
|---|---|
| `q1` | 重要且紧急 |
| `q2` | 重要不紧急 |
| `q3` | 紧急不重要 |
| `q4` | 不紧急不重要 |

### Response `data`（建议）

```json
{
  "todoId": "todo-pending-leaves",
  "quadrant": "q2"
}
```

### 业务语义

- 系统可按规则给出**默认**象限；用户拖拽后以本接口结果为准（用户重分配事态等级）。
- 需按 **用户维度** 持久化（同一 todoId 不同用户可有不同象限）。
- 幂等：重复 PUT 同一 `quadrant` 应成功。

### 错误

| HTTP | 场景 |
|---|---|
| 400 | `quadrant` 非法 |
| 401 / 403 | 未登录 / 无权限 |
| 404 | todoId 不存在或无权 |

---

## 2. 列表带回覆盖（强烈建议，多端同步）

扩展现有：

```
GET /home/teacher/todos
```

在现有计数字段外增加：

```json
{
  "expiringPackages": 0,
  "lowHourStudents": 0,
  "pendingLeaves": 0,
  "quadrantOverrides": {
    "todo-pending-leaves": "q1",
    "custom-todo-xxx": "q3"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `quadrantOverrides` | `Record<todoId, quadrant>` | 当前用户的全部象限覆盖；无则 `{}` 或省略 |

前端在 `getTodoItems` 真实分支会把该表写入本地缓存，再经 `enrichTodoItem` 应用到每条待办。

---

## 3. 前端联调开关

| 模式 | 行为 |
|---|---|
| `VITE_USE_MOCK=true` | 只写本地（custom-todos + `todo-quadrant-override`），不发 PUT |
| `VITE_USE_MOCK=false` | 先 `PUT .../quadrant`，成功后再写本地缓存 |

后端未上线前请保持 Mock；接口就绪后关 Mock 即可打到真实 PUT。

---

## 4. 后端落地清单（对照）

- [ ] `PUT /home/teacher/todos/:todoId/quadrant`
- [ ] 按 userId + todoId 存象限
- [ ] `GET /home/teacher/todos` 返回 `quadrantOverrides`
- [ ] 与前端约定一致的 `q1`–`q4` 枚举
- [ ] 鉴权角色与 `GET .../todos` 对齐
