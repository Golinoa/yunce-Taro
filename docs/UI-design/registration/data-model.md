# 云策教务 - 用户身份与机构数据模型

> 本文档用于指导后端库表设计与前端状态管理。
> 核心原则：**用户认证与业务身份解耦，一个账号可在多个机构拥有不同身份。**

---

## 一、设计目标

1. 支持微信一键登录 + 账号密码登录。
2. 支持一个账号在多个机构拥有不同身份（校长 / 教师 / 家长）。
3. 支持一个教师绑定多个校区任教。
4. 支持一个家长绑定多个校区的多个孩子。
5. 支持校长身份直接使用教师功能，无需额外切换。
6. 登录后根据身份上下文返回对应数据。

---

## 二、核心原则

- **`users` 表只负责认证**：微信 openid、账号密码。
- **`profiles` 表只存基础资料**：昵称、头像、手机号。
- **身份不由 `profiles.role` 单一字段决定**，而是通过 `organization_members` 关系表表达。
- **一个用户在一个机构内只能有一种身份**，通过唯一索引保证。
- 校长不创建 `teachers` 记录，校长身份天然拥有教师权限。

---

## 三、数据表结构

### 3.1 用户认证

```sql
tables.users
- id: uuid PK
- openid: string UNIQUE          -- 微信 openid，微信登录用
- username: string UNIQUE NULL   -- 账号密码登录用
- password_hash: string NULL
- created_at: timestamp
- updated_at: timestamp
```

### 3.2 用户资料

```sql
tables.profiles
- id: uuid PK
- user_id: uuid FK -> users.id UNIQUE
- name: string                   -- 真实姓名或昵称
- avatar_url: string NULL
- phone: string NULL
- created_at: timestamp
- updated_at: timestamp
```

### 3.3 机构

```sql
tables.organizations
- id: uuid PK
- name: string
- owner_user_id: uuid FK -> users.id  -- 创建者（校长）
- contact_phone: string NULL
- address: string NULL
- created_at: timestamp
- updated_at: timestamp
```

### 3.4 校区

```sql
tables.campuses
- id: uuid PK
- organization_id: uuid FK -> organizations.id
- name: string
- address: string NULL
- created_at: timestamp
- updated_at: timestamp
```

### 3.5 机构成员（身份关系核心表）

```sql
tables.organization_members
- id: uuid PK
- user_id: uuid FK -> users.id
- organization_id: uuid FK -> organizations.id
- role: enum('principal', 'teacher', 'parent')
- is_default: boolean DEFAULT false   -- 登录后默认使用的身份
- created_at: timestamp
- updated_at: timestamp

UNIQUE(user_id, organization_id)       -- 一个机构内只能有一种身份
```

### 3.6 教师实体

```sql
tables.teachers
- id: uuid PK
- user_id: uuid FK -> users.id
- organization_id: uuid FK -> organizations.id
- name: string
- phone: string NULL
- created_at: timestamp
- updated_at: timestamp

UNIQUE(user_id, organization_id)       -- 一个机构内只有一个教师实体
```

### 3.7 教师 - 校区（多对多）

```sql
tables.teacher_campuses
- id: uuid PK
- teacher_id: uuid FK -> teachers.id
- campus_id: uuid FK -> campuses.id
- is_main: boolean DEFAULT false       -- 主校区，首页默认展示
- created_at: timestamp

UNIQUE(teacher_id, campus_id)
```

### 3.8 家长实体

```sql
tables.parents
- id: uuid PK
- user_id: uuid FK -> users.id
- name: string
- phone: string NULL
- created_at: timestamp
- updated_at: timestamp
```

> 家长不与机构强绑定，通过 `parent_students` → `students` 间接关联机构。

### 3.9 学生

```sql
tables.students
- id: uuid PK
- organization_id: uuid FK -> organizations.id
- campus_id: uuid FK -> campuses.id
- name: string
- student_code: string UNIQUE         -- 学号 / 系统生成的绑定码
- created_at: timestamp
- updated_at: timestamp
```

### 3.10 家长 - 学生（多对多）

```sql
tables.parent_students
- id: uuid PK
- parent_id: uuid FK -> parents.id
- student_id: uuid FK -> students.id
- relationship: string NULL           -- 爸爸 / 妈妈 / 监护人等
- created_at: timestamp

UNIQUE(parent_id, student_id)
```

### 3.11 邀请码

```sql
tables.invite_codes
- id: uuid PK
- code: string UNIQUE
- type: enum('campus', 'student')     -- 校区码 / 学生码
- organization_id: uuid FK -> organizations.id
- target_id: uuid                     -- campus_id 或 student_id
- expires_at: timestamp NULL
- used_by: uuid FK -> users.id NULL   -- 使用者
- used_at: timestamp NULL
- is_active: boolean DEFAULT true
- created_at: timestamp
```

---

## 四、注册流程数据写入

### 4.1 校长创建机构

1. 创建 `organizations`，`owner_user_id` = 当前 user_id。
2. 创建 `organization_members`，`role = 'principal'`，`is_default = true`。
3. **不创建** `teachers` 记录。
4. 创建第一个 `campuses`（校长注册时填写机构地址可对应主校区）。

### 4.2 教师加入机构

1. 用户输入校区码，后端校验 `invite_codes`（type='campus'）。
2. 创建 `teachers` 记录。
3. 创建 `teacher_campuses` 记录，`is_main = true`。
4. 创建 `organization_members`，`role = 'teacher'`，`is_default` 根据情况设置。
5. 标记邀请码为已使用。

### 4.3 家长加入机构

1. 用户输入学生码，后端校验 `invite_codes`（type='student'）。
2. 创建 `parents` 记录（如不存在）。
3. 创建 `parent_students` 记录。
4. 创建 `organization_members`，`role = 'parent'`，`organization_id` 从学生所属机构获取。
5. 标记邀请码为已使用。

> 同一家长绑定第二个孩子时，不重复创建 `parents`，只新增 `parent_students` 和 `organization_members`（如果跨机构）。

---

## 五、登录后身份识别

### 5.1 后端返回示例

```json
{
  "user": {
    "id": "u_001",
    "name": "张老师",
    "avatar_url": "..."
  },
  "identities": [
    {
      "role": "principal",
      "organizationId": "org_001",
      "organizationName": "云策艺术培训",
      "campusIds": ["camp_001", "camp_002"],
      "isDefault": true
    },
    {
      "role": "teacher",
      "organizationId": "org_002",
      "organizationName": "明日教育",
      "campusIds": ["camp_003"],
      "isDefault": false
    }
  ],
  "currentIdentity": {
    "role": "principal",
    "organizationId": "org_001",
    "campusId": "camp_001"
  }
}
```

### 5.2 前端跳转逻辑

| 身份数量 | 处理方式 |
|---|---|
| 0 | 新用户，进入注册流程（选择身份 → 补全信息） |
| 1 | 直接进入该身份首页 |
| 2+ | 进入角色切换页，选择后进入首页 |

---

## 六、身份切换

### 6.1 切换现有身份

- 前端切换 `currentIdentity`（role + organizationId + campusId）。
- 重新请求首页数据。

### 6.2 添加新身份

- 进入「选择身份 → 补全信息」流程，与首次注册一致。
- 完成后新增 `organization_members` 记录。
- 回到角色切换页，用户可选择使用新身份。

---

## 七、权限规则

| 身份 | 数据权限 |
|---|---|
| principal | 查看整个机构所有校区数据；拥有教师所有功能 |
| teacher | 查看自己任教校区的班级、学生、课程数据 |
| parent | 仅查看自己绑定的学生数据 |

### 7.1 校长为何不需要 teachers 记录

- 校长通过 `organization_members.role = 'principal'` 鉴权。
- 校长默认拥有所有校区的教师权限，不需要逐条写入 `teacher_campuses`。
- 只有校长去其他机构任教时，才需要在那个机构以 `teacher` 身份注册。

---

## 八、索引建议

```sql
-- 认证查询
CREATE INDEX idx_users_openid ON users(openid);
CREATE INDEX idx_users_username ON users(username);

-- 成员关系
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);

-- 教师校区
CREATE INDEX idx_teacher_campuses_teacher ON teacher_campuses(teacher_id);
CREATE INDEX idx_teacher_campuses_campus ON teacher_campuses(campus_id);

-- 家长学生
CREATE INDEX idx_parent_students_parent ON parent_students(parent_id);
CREATE INDEX idx_parent_students_student ON parent_students(student_id);

-- 邀请码
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
```

---

## 九、边界情况处理

| 情况 | 处理 |
|---|---|
| 用户已是教师，又在同机构被设为校长 | 拒绝，同机构内只能有一种身份 |
| 校长想换机构任教 | 以 teacher 身份加入新机构，不冲突 |
| 家长绑定第二个孩子 | 复用 `parents`，新增 `parent_students` |
| 教师离职 | 删除 `organization_members` 和 `teacher_campuses` 记录，可保留 `teachers` 历史 |
| 邀请码过期 | 后端校验 `expires_at` 和 `is_active`，返回"邀请码无效或已过期" |
| 用户删除微信后重新登录 | 通过 `openid` 仍能匹配到原账号和身份 |

---

## 十、前端状态映射

```ts
// src/types/profile.ts
export type UserRole = 'principal' | 'teacher' | 'parent';

export interface Identity {
  role: UserRole;
  organizationId: string;
  organizationName: string;
  campusIds: string[];
  isDefault: boolean;
}

export interface CurrentContext {
  role: UserRole;
  organizationId: string;
  campusId?: string;
  teacherId?: string;
  parentId?: string;
}

export interface Profile {
  id: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  identities: Identity[];
  currentContext: CurrentContext;
}
```

---

## 十一、待后端确认事项

1. 是否使用 `campus_ids` 冗余字段缓存，还是完全通过关联表查询？
2. 学生绑定码是否允许长期有效？
3. 机构解散/校长转让时，历史数据如何处理？
4. 是否需要 `audit_logs` 记录身份变更？
