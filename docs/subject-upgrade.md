# 科目体系升级说明

> 版本：v1.0
> 日期：2026-06-11
> 前端负责人：前端组
> 后端负责人：后端组

---

## 一、升级背景

### 1.1 现状问题

当前系统中"科目"没有独立实体，科目信息隐含在课包名称中（如"钢琴课"="钢琴"科目）。这导致以下问题：

1. **消课匹配不可靠**：班级消课时，系统通过 `mockGetActivePackagesByStudent` 查找"任意一个剩余够的课包"扣减，可能扣错科目（钢琴班扣了乐理课的课时）
2. **通用课包无法区分**：综合课包、赠送课时、家庭共享课包无法归类
3. **统计报表缺失**：无法按科目统计收入、消课量、学员分布
4. **名称依赖**：课包/班级改名会导致隐含的科目关联断裂

### 1.2 升级目标

1. 新建 `subjects`（科目）表，作为轻量分类标签
2. 班级和课包可选关联科目（`subject_id` 可为 null，表示通用/综合）
3. 消课时按科目智能匹配课包，老师可手动切换
4. 消课记录冗余记录科目，方便查询和统计
5. 新增课包科目变更申请机制，处理跨科目使用场景

---

## 二、业务场景梳理

### 2.1 课包科目变更场景

| # | 场景 | 描述 | 触发方式 | 处理逻辑 |
|---|------|------|----------|----------|
| S1 | **跨科目排课** | 小明报了书法课，美术老师给小明排课，需要用小明的课包 | 美术老师排课时选了小明的书法课包 | 系统自动向负责人发起申请：将小明的书法课包变为通用课包 |
| S2 | **跨科目消课** | 小明报了书法课，临时上了美术课，美术老师手动消课 | 美术老师消课时选了小明的书法课包 | 同 S1，自动发起科目变更申请 |
| S3 | **转科** | 小明书法课不上了，改学毛笔，毛笔老师排课 | 毛笔老师排课时，小明已无书法班级 | 发起申请后，负责人可选择：①变为通用课包 ②改为毛笔科目专用课包 |
| S4 | **家庭共享** | 小明和小红是兄妹，共用一个课包 | 负责人手动设置 | 课包通过 `package_students` 关联多个学员，科目可设为通用 |
| S5 | **综合课包** | 暑假班含钢琴+乐理+视唱，一个课包多科目 | 创建课包时不选科目 | `subject_id = null`，消课时老师手动选课包，记录中冗余 `subject_id` |
| S6 | **赠送课时** | 老师奖励2节课，不属于任何科目 | 创建课包时标记为赠送 | `subject_id = null`，`type = 'gift'` |
| S7 | **体验课** | 新生试听，还没确定科目 | 创建课包时标记为体验 | `subject_id = null`，`type = 'trial'` |
| S8 | **补课跨班** | 钢琴A班缺课，去B班补 | 老师手动消课选B班 | B班科目=钢琴，自动匹配小明的钢琴课包，无需申请 |
| S9 | **按次收费** | 不卖课包，每次上课现场交费 | 消课时选"现场缴费" | 使用特殊课包 `type = 'pay_per_lesson'`，不扣减课时 |

### 2.2 科目变更申请流程

```
老师操作（排课/消课）→ 选了跨科目课包 → 系统自动生成申请
    ↓
负责人收到通知 → 审批
    ↓
    ├─ 通过：课包 subject_id 变更（改为目标科目 或 改为 null 通用）
    └─ 拒绝：课包不变，老师需选其他课包或取消操作
```

**申请表设计**：见下方 `package_change_requests` 表。

---

## 三、数据库设计

### 3.1 新增表

#### subjects（科目表）

```sql
CREATE TABLE subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID NOT NULL REFERENCES teachers(id),  -- 所属教师
  name        VARCHAR(20) NOT NULL,                    -- 科目名称，如"钢琴"、"书法"
  sort_order  INT DEFAULT 0,                           -- 排序权重
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, name)  -- 同一教师下科目名唯一
);
```

#### package_students（课包-学员关联表）

> 替代 `course_packages.student_id` 的一对一关系，支持家庭共享课包。

```sql
CREATE TABLE package_students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id  UUID NOT NULL REFERENCES course_packages(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  role        VARCHAR(10) NOT NULL DEFAULT 'owner',  -- owner=购买者, sharer=共享使用者
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(package_id, student_id)  -- 同一学员不能重复关联同一课包
);

-- 索引
CREATE INDEX idx_package_students_student ON package_students(student_id);
CREATE INDEX idx_package_students_package ON package_students(package_id);
```

#### package_change_requests（课包变更申请表）

```sql
CREATE TABLE package_change_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES teachers(id),       -- 申请人（老师）
  package_id      UUID NOT NULL REFERENCES course_packages(id), -- 待变更的课包
  student_id      UUID NOT NULL REFERENCES students(id),       -- 课包所属学员
  request_type    VARCHAR(20) NOT NULL,  -- 'to_general'=变通用, 'to_subject'=转科目
  target_subject_id UUID REFERENCES subjects(id),              -- 转科目时的目标科目（to_subject时必填）
  reason          TEXT,                  -- 申请原因（系统自动生成）
  status          VARCHAR(10) NOT NULL DEFAULT 'pending',  -- pending/approved/rejected
  reviewer_id     UUID REFERENCES teachers(id),              -- 审批人（负责人）
  review_note     TEXT,                  -- 审批备注
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pcr_teacher ON package_change_requests(teacher_id);
CREATE INDEX idx_pcr_status ON package_change_requests(status);
CREATE INDEX idx_pcr_package ON package_change_requests(package_id);
```

### 3.2 现有表变更

#### classes 表新增字段

```sql
ALTER TABLE classes ADD COLUMN subject_id UUID REFERENCES subjects(id);
-- subject_id 可为 NULL，表示综合班/未分类
COMMENT ON COLUMN classes.subject_id IS '关联科目，NULL表示综合班';
```

#### course_packages 表新增字段

```sql
ALTER TABLE course_packages ADD COLUMN subject_id UUID REFERENCES subjects(id);
-- subject_id 可为 NULL，表示通用课包
COMMENT ON COLUMN course_packages.subject_id IS '关联科目，NULL表示通用课包';

-- 注意：原有的 student_id 字段保留，后续通过数据迁移转移到 package_students 表
-- 迁移完成后可考虑废弃 student_id 字段
```

#### lesson_records 表新增字段

```sql
ALTER TABLE lesson_records ADD COLUMN class_id UUID REFERENCES classes(id);
ALTER TABLE lesson_records ADD COLUMN subject_id UUID REFERENCES subjects(id);
ALTER TABLE lesson_records ADD COLUMN is_owe BOOLEAN NOT NULL DEFAULT FALSE;
-- 三个字段均可为 NULL（is_owe 除外）
COMMENT ON COLUMN lesson_records.class_id IS '消课关联的班级，NULL表示无班级消课';
COMMENT ON COLUMN lesson_records.subject_id IS '消课时的科目（冗余记录，方便查询统计）';
COMMENT ON COLUMN lesson_records.is_owe IS '是否欠课（课包课时不足时仍消课）';
```

### 3.3 数据迁移

```sql
-- 1. 从现有课包名称提取科目，创建 subjects 记录
INSERT INTO subjects (teacher_id, name)
SELECT DISTINCT teacher_id, name
FROM course_packages
WHERE name IS NOT NULL
ON CONFLICT (teacher_id, name) DO NOTHING;

-- 2. 回填 course_packages.subject_id
UPDATE course_packages cp
SET subject_id = s.id
FROM subjects s
WHERE cp.teacher_id = s.teacher_id
  AND cp.name = s.name
  AND cp.subject_id IS NULL;

-- 3. 从现有 course_packages.student_id 迁移到 package_students
INSERT INTO package_students (package_id, student_id, role)
SELECT id, student_id, 'owner'
FROM course_packages
WHERE student_id IS NOT NULL
ON CONFLICT (package_id, student_id) DO NOTHING;

-- 4. 回填 lesson_records.class_id（从排课记录关联）
-- 此步骤需根据实际排课数据逻辑补充

-- 5. 回填 lesson_records.subject_id（从课包关联）
UPDATE lesson_records lr
SET subject_id = cp.subject_id
FROM course_packages cp
WHERE lr.package_id = cp.id
  AND lr.subject_id IS NULL;
```

---

## 四、后端接口设计

### 4.1 科目管理

#### GET /api/subjects

获取当前教师的科目列表

**请求参数**：无（从 token 获取 teacher_id）

**响应示例**：
```json
{
  "code": 0,
  "data": [
    {
      "id": "sub-001",
      "name": "钢琴",
      "teacher_id": "teacher-001",
      "sort_order": 0,
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-15T10:00:00Z"
    },
    {
      "id": "sub-002",
      "name": "书法",
      "teacher_id": "teacher-001",
      "sort_order": 1,
      "created_at": "2026-02-01T10:00:00Z",
      "updated_at": "2026-02-01T10:00:00Z"
    }
  ]
}
```

#### POST /api/subjects

创建科目

**请求参数**：
```json
{
  "name": "美术",
  "sort_order": 2
}
```

**响应示例**：
```json
{
  "code": 0,
  "data": {
    "id": "sub-003",
    "name": "美术",
    "teacher_id": "teacher-001",
    "sort_order": 2,
    "created_at": "2026-06-11T10:00:00Z",
    "updated_at": "2026-06-11T10:00:00Z"
  }
}
```

#### PUT /api/subjects/:id

更新科目

**请求参数**：
```json
{
  "name": "毛笔书法",
  "sort_order": 1
}
```

#### DELETE /api/subjects/:id

删除科目（仅当无班级和课包关联时可删除）

**响应示例**：
```json
{
  "code": 0,
  "message": "删除成功"
}
```
```json
{
  "code": 4001,
  "message": "该科目下还有 3 个班级和 5 个课包，无法删除"
}
```

---

### 4.2 课包-学员关联

#### GET /api/students/:id/packages

获取学员的所有可用课包（含共享课包）

**请求参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| subject_id | string | 否 | 按科目筛选 |

**响应示例**：
```json
{
  "code": 0,
  "data": [
    {
      "id": "pkg-001",
      "name": "钢琴课",
      "subject_id": "sub-001",
      "subject_name": "钢琴",
      "total_hours": 24,
      "remaining_hours": 18,
      "type": "hour_package",
      "role": "owner",
      "shared_with": []
    },
    {
      "id": "pkg-010",
      "name": "家庭共享课包",
      "subject_id": null,
      "subject_name": null,
      "total_hours": 60,
      "remaining_hours": 42,
      "type": "hour_package",
      "role": "sharer",
      "shared_with": ["张小明"]
    }
  ]
}
```

#### POST /api/packages/:id/share

共享课包给其他学员

**请求参数**：
```json
{
  "student_id": "s-002",
  "role": "sharer"
}
```

#### DELETE /api/packages/:id/share/:studentId

取消课包共享

---

### 4.3 消课（升级）

#### POST /api/lessons

创建消课记录（升级版）

**请求参数**：
```json
{
  "student_id": "s-001",
  "package_id": "pkg-001",
  "class_id": "cls-001",
  "subject_id": "sub-001",
  "lesson_date": "2026-06-11T14:30:00Z",
  "hours_used": 1,
  "is_owe": false,
  "content": "练习曲目：致爱丽丝",
  "performance": "4星",
  "homework": "继续练习右手部分",
  "homework_images": ["https://xxx/1.jpg"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| student_id | string | 是 | 学员ID |
| package_id | string | 是 | 扣减的课包ID |
| class_id | string | 否 | 关联班级ID（班级消课必填，单人消课可选） |
| subject_id | string | 否 | 科目ID（冗余记录，有class_id时从班级带入，无班级时从课包带入） |
| lesson_date | string | 是 | 上课时间 |
| hours_used | number | 是 | 消课课时 |
| is_owe | boolean | 否 | 是否欠课（课包课时不足时由前端传入，默认false） |
| content | string | 否 | 教学内容 |
| performance | string | 否 | 学生表现 |
| homework | string | 否 | 课后作业 |
| homework_images | string[] | 否 | 作业图片 |

**后端需额外处理**：
1. 校验 `package_id` 对应的课包是否属于该学员（通过 `package_students` 关联）
2. 校验课包剩余课时是否足够
3. 如果课包科目与班级科目不匹配，自动创建 `package_change_requests` 申请
4. 扣减课包 `remaining_hours`
5. 冗余写入 `subject_id`（优先取 class 的 subject_id，其次取 package 的 subject_id）

**响应示例**：
```json
{
  "code": 0,
  "data": {
    "id": "lr-001",
    "student_id": "s-001",
    "package_id": "pkg-001",
    "class_id": "cls-001",
    "subject_id": "sub-001",
    "hours_used": 1,
    "change_request_id": null
  }
}
```

**当触发科目变更申请时**：
```json
{
  "code": 0,
  "data": {
    "id": "lr-001",
    "student_id": "s-001",
    "package_id": "pkg-002",
    "class_id": "cls-002",
    "subject_id": null,
    "hours_used": 1,
    "change_request_id": "pcr-001",
    "change_request_status": "pending"
  }
}
```

#### POST /api/lessons/batch

班级批量消课

**请求参数**：
```json
{
  "class_id": "cls-001",
  "lesson_date": "2026-06-11T14:30:00Z",
  "hours_used": 1,
  "content": "集体课教学内容",
  "students": [
    {
      "student_id": "s-001",
      "package_id": "pkg-001",
      "is_absent": false,
      "is_owe": false
    },
    {
      "student_id": "s-002",
      "package_id": "pkg-003",
      "is_absent": true,
      "is_owe": false
    },
    {
      "student_id": "s-003",
      "package_id": "pkg-007",
      "is_absent": false,
      "is_owe": true
    }
  ]
}
```

**后端处理**：遍历 `students`，对 `is_absent=false` 的学员逐个创建消课记录，逻辑同单条消课。`is_owe=true` 时允许课包课时不足，扣减后 `remaining_hours` 可为负数。

---

### 4.4 课包科目变更申请

#### GET /api/package-change-requests

获取变更申请列表（负责人视角）

**请求参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | pending/approved/rejected |

**响应示例**：
```json
{
  "code": 0,
  "data": [
    {
      "id": "pcr-001",
      "teacher_id": "teacher-002",
      "teacher_name": "李老师",
      "package_id": "pkg-002",
      "package_name": "书法课",
      "student_id": "s-001",
      "student_name": "张小明",
      "request_type": "to_general",
      "target_subject_id": null,
      "target_subject_name": null,
      "reason": "李老师为张小明排美术课，需要使用书法课包",
      "status": "pending",
      "created_at": "2026-06-11T10:00:00Z"
    },
    {
      "id": "pcr-002",
      "teacher_id": "teacher-003",
      "teacher_name": "赵老师",
      "package_id": "pkg-005",
      "package_name": "书法课",
      "student_id": "s-001",
      "student_name": "张小明",
      "request_type": "to_subject",
      "target_subject_id": "sub-004",
      "target_subject_name": "毛笔",
      "reason": "赵老师为张小明排毛笔课，张小明已无书法班级",
      "status": "pending",
      "created_at": "2026-06-11T11:00:00Z"
    }
  ]
}
```

#### PUT /api/package-change-requests/:id/review

审批变更申请

**请求参数**：
```json
{
  "action": "approve",
  "review_note": "同意变更为通用课包",
  "override_subject_id": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | string | 是 | "approve" 或 "reject" |
| review_note | string | 否 | 审批备注 |
| override_subject_id | string | 否 | 审批时可覆盖申请的目标科目。null=通用课包，具体ID=转指定科目 |

**后端处理（approve时）**：
1. 更新 `course_packages.subject_id` 为 `override_subject_id`（如有）或申请中的 `target_subject_id`
2. 更新申请状态为 approved
3. 通知申请老师审批结果

---

### 4.5 班级/课包接口升级

#### POST /api/classes（创建班级 - 升级）

新增 `subject_id` 字段：

```json
{
  "name": "钢琴基础班",
  "subject_id": "sub-001",
  "type": "unlimited",
  "schedule": "每周二、四 14:00-15:30",
  "weekdays": ["二", "四"],
  "start_time": "14:00",
  "end_time": "15:30",
  "teachers": ["teacher-001"],
  "color": "primary"
}
```

#### POST /api/packages（创建课包 - 升级）

新增 `subject_id` 和 `shared_student_ids` 字段：

```json
{
  "student_id": "s-001",
  "name": "钢琴课",
  "subject_id": "sub-001",
  "total_hours": 24,
  "remaining_hours": 24,
  "type": "hour_package",
  "fee_amount": 2400,
  "fee_method": "wechat",
  "shared_student_ids": ["s-002"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| subject_id | string | 否 | 科目ID，null=通用课包 |
| shared_student_ids | string[] | 否 | 共享学员ID列表，自动创建 package_students 关联 |

---

## 五、前端页面影响评估

### 5.1 需要修改的页面

| 页面 | 文件路径 | 改动内容 | 优先级 |
|------|----------|----------|--------|
| **消课表单** | `pages/lesson-form/index.tsx` | 1. 单人模式新增"选择班级"（可选）和"选择课包"步骤<br>2. 课包按科目分组显示<br>3. 班级模式每学员可切换课包<br>4. 提交时传 class_id、subject_id | **P0** |
| **班级创建/编辑** | `pages/class-form/index.tsx` | 1. 新增"科目"下拉选择字段<br>2. 科目列表从接口获取<br>3. 可不选（综合班） | **P0** |
| **课包创建/编辑** | `pages/package-form/index.tsx` | 1. 新增"科目"下拉选择字段<br>2. 新增"共享学员"多选<br>3. 可不选科目（通用课包） | **P0** |
| **班级详情** | `pages/class-detail/index.tsx` | 1. 班级信息区显示科目标签<br>2. 学员列表显示推荐课包 | **P1** |
| **学员详情** | `pages/student-detail/index.tsx` | 1. 课包列表按科目分组显示<br>2. 共享课包标注"共享"<br>3. 课包卡片显示科目标签 | **P1** |
| **消课记录** | `pages/records/index.tsx` | 1. 新增按科目筛选<br>2. 记录卡片显示科目名称 | **P1** |
| **消课详情** | `pages/lesson-detail/index.tsx` | 1. 显示科目名称和班级名称 | **P1** |
| **统计页** | `pages/statistics/index.tsx` | 1. 新增按科目维度统计<br>2. 科目收入排行 | **P2** |
| **首页** | `pages/home/index.tsx` | 1. 家长端课包列表按科目分组<br>2. 教师端今日课程显示科目 | **P2** |
| **班级列表** | `pages/classes/index.tsx` | 1. 班级卡片显示科目标签 | **P2** |
| **课包模板** | `pages/course-packages/index.tsx` | 1. 模板新增科目字段 | **P2** |
| **排课表单** | `pages/schedule-form/index.tsx` | 1. 选择班级后自动带入科目<br>2. 排课触发课包匹配时，跨科目自动发申请 | **P1** |

### 5.2 需要新增的页面

| 页面 | 建议路径 | 功能 | 优先级 |
|------|----------|------|--------|
| **科目管理** | `pages/subjects/index.tsx` | 科目的增删改排序 | **P0** |
| **变更申请列表** | `pages/change-requests/index.tsx` | 负责人查看和审批课包变更申请 | **P1** |

### 5.3 需要新增的UI组件

| 组件 | 说明 | 使用页面 |
|------|------|----------|
| **SubjectPicker** | 科目下拉选择器，支持"不选（通用）"选项 | class-form, package-form |
| **PackageSelector** | 课包选择器，按科目分组，支持共享/通用标签 | lesson-form |
| **SubjectTag** | 科目标签组件，不同科目不同颜色 | 多处 |
| **ChangeRequestCard** | 变更申请卡片，显示申请信息和审批操作 | change-requests |

### 5.4 需要修改的类型定义

| 文件 | 改动 |
|------|------|
| `types/course-package.ts` | `CoursePackage` 新增 `subject_id?`, `subject_name?`；新增 `PackageStudentRole` 类型 |
| `types/class.ts` | `Class` 新增 `subject_id?`, `subject_name?` |
| `types/lesson-record.ts` | `LessonRecord` 新增 `class_id?`, `subject_id?`, `subject_name?`, `class_name?` |
| `types/index.ts` | 新增导出 `Subject`, `PackageChangeRequest` 类型 |
| 新建 `types/subject.ts` | `Subject` 接口定义 |
| 新建 `types/package-change-request.ts` | `PackageChangeRequest` 接口定义 |

---

## 六、前端实施计划

### Phase 1：基础数据层（P0）

1. 新建 `types/subject.ts`、`types/package-change-request.ts` 类型定义
2. 更新 `types/class.ts`、`types/course-package.ts`、`types/lesson-record.ts`
3. 新建 `pages/subjects/index.tsx` 科目管理页
4. 更新 `pages/class-form/index.tsx` 新增科目选择
5. 更新 `pages/package-form/index.tsx` 新增科目选择+共享学员
6. 更新 Mock 数据层 `data/students.ts`，添加科目相关 mock 函数

### Phase 2：消课核心流程（P0）

7. 重构 `pages/lesson-form/index.tsx`：
   - **单人模式**：选学员 → 选班级（可选）→ 课包自动匹配（选了班级时）→ 填信息 → 提交
   - **班级模式**：选班级 → 学员名单（每人自动匹配课包，显示课包状态）→ 填信息 → 批量提交
   - 提交时传 `class_id`、`subject_id`
8. 消课匹配逻辑（详见第八节）：
   - **单人消课**：选了班级 → 自动匹配同科目课包 → 只显示匹配的课包（隐藏其他）→ 课时不够时才展开其他课包并提醒
   - **班级消课**：每人自动匹配默认课包 → 不显示课包选择器 → 课包不足显示"欠课" → 欠课需二次确认 → 无课包不可消课

### Phase 3：信息展示升级（P1）

9. 更新 `pages/class-detail/index.tsx` 显示科目标签
10. 更新 `pages/student-detail/index.tsx` 课包按科目分组
11. 更新 `pages/records/index.tsx` 新增科目筛选
12. 更新 `pages/lesson-detail/index.tsx` 显示科目和班级
13. 新建 `pages/change-requests/index.tsx` 变更申请审批页
14. 更新 `pages/schedule-form/index.tsx` 排课触发课包匹配

### Phase 4：统计与优化（P2）

15. 更新 `pages/statistics/index.tsx` 按科目统计
16. 更新 `pages/home/index.tsx` 课包分组展示
17. 更新 `pages/classes/index.tsx` 班级卡片科目标签
18. 更新 `pages/course-packages/index.tsx` 模板科目字段

---

## 七、前端所需后端接口优先级

| 优先级 | 接口 | 说明 |
|--------|------|------|
| **P0** | `GET /api/subjects` | 科目列表，创建班级/课包时需要 |
| **P0** | `POST /api/subjects` | 创建科目 |
| **P0** | `PUT /api/subjects/:id` | 编辑科目 |
| **P0** | `DELETE /api/subjects/:id` | 删除科目 |
| **P0** | `GET /api/students/:id/packages`（升级） | 返回含 subject_id、role、shared_with 的课包列表 |
| **P0** | `POST /api/lessons`（升级） | 新增 class_id、subject_id 参数 |
| **P0** | `POST /api/lessons/batch` | 班级批量消课 |
| **P0** | `POST /api/classes`（升级） | 新增 subject_id 参数 |
| **P0** | `POST /api/packages`（升级） | 新增 subject_id、shared_student_ids 参数 |
| **P1** | `POST /api/packages/:id/share` | 共享课包 |
| **P1** | `DELETE /api/packages/:id/share/:studentId` | 取消共享 |
| **P1** | `GET /api/package-change-requests` | 变更申请列表 |
| **P1** | `PUT /api/package-change-requests/:id/review` | 审批变更申请 |
| **P2** | `GET /api/lessons`（升级） | 支持按 subject_id 筛选 |
| **P2** | `GET /api/statistics/by-subject` | 按科目统计 |

---

## 八、消课匹配算法（前端参考）

### 8.1 单人消课匹配规则

```
输入：studentId, classId（可选）, hoursNeeded（默认1）
输出：课包选择区域UI状态

步骤：
1. 查询学员所有可用课包 GET /api/students/:id/packages
2. 如果有 classId 且班级有 subjectId：
   a. 筛选同科目课包 matchedPkgs
   b. 如果 matchedPkgs 中有 remaining >= hoursNeeded 的：
      → 自动选中该课包，只显示这一个课包（隐藏其他）
      → 显示提示"已根据「班级名」自动匹配XX课包"
   c. 如果 matchedPkgs 存在但都不够（remaining < hoursNeeded）：
      → 显示匹配课包（灰色，标注"课时不足"）
      → 展开其他课包供选择（通用课包优先）
      → 显示警告"XX课包课时不足，请选择其他课包"
   d. 如果没有 matchedPkgs：
      → 展开通用课包（推荐）+ 其他科目课包
      → 显示提示"未找到XX课包，请选择其他课包"
3. 如果没有 classId 或班级无 subjectId：
   → 显示所有课包按科目分组
   → 无自动选中，老师手动选择
4. 选中跨科目课包时：
   → 显示变更申请提示横幅
```

### 8.2 班级消课匹配规则

```
输入：classId, hoursNeeded（默认1）
输出：学员名单（每人含课包状态）

步骤：
1. 获取班级学员列表
2. 对每个学员自动匹配默认课包：
   a. 优先匹配同科目且够用的课包
   b. 其次匹配同科目但不够的课包
   c. 其次匹配通用且够用的课包
   d. 其次匹配通用但不够的课包
   e. 最后任意课包
3. 根据匹配结果显示学员状态：
   - 课包够用 → 显示"科目名 · 剩余X课时"（绿色）→ 出席/请假按钮
   - 课包不足 → 显示"欠课 · 科目名仅剩X课时"（橙色）→ "欠课确认"按钮（需二次确认）
   - 无课包 → 显示"无可用课包"（红色）→ "无课包"按钮（禁用，不可消课）
4. 不显示课包选择器，班级消课默认使用匹配的课包
```

### 8.3 欠课处理逻辑

```
欠课定义：学员的默认课包 remaining_hours < hoursNeeded

处理方式：
1. 班级消课时：
   - 欠课学员显示橙色"欠课确认"按钮
   - 点击后弹出二次确认对话框：
     "XX的XX课包仅剩X课时，本次需扣X课时，确认后将记录为欠课。是否继续？"
   - 确认后：标记为出席，消课记录中标记欠课状态
   - 取消后：保持当前状态，不消课

2. 单人消课时：
   - 课包不足时自动展开其他课包选择
   - 仍选择不足课包时，提交时提醒"课时不足将记录为欠课"

3. 无课包学员：
   - 班级消课中不可消课（按钮禁用）
   - 单人消课无法进入（无课包可选）

后端处理：
- 消课记录新增 is_owe boolean 字段
- 扣减后 remaining_hours 允许为负数（表示欠课）
- 统计报表中欠课记录单独标记
```

---

## 九、注意事项

1. **向后兼容**：`subject_id` 字段均为可选（nullable），不影响现有数据。未设置科目的班级和课包照常工作
2. **渐进式升级**：前端可先实现科目选择和消课匹配，变更申请机制可后续迭代
3. **课包名称不再等于科目名**：升级后课包名称是展示名（如"钢琴基础课包"），科目是独立分类（如"钢琴"），两者解耦
4. **package_students 迁移**：需要后端在部署时执行数据迁移脚本，将现有 `course_packages.student_id` 转移到 `package_students` 表
5. **负责人角色**：变更申请的审批人需要是机构负责人，需确认当前系统是否有负责人角色概念，若无可暂用教师角色代替
