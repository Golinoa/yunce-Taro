# 云策教务 · 代码审查报告（首轮）

> 依据：`CODE_REVIEW_STANDARD.md` v1.0 ｜ 审查角色：CodeReviewExpert（火眼眼）
> 审查范围：数据一致性核心链路（teacher / salary / mock 层 / 统一教师视图）+ 规范抽样
> 审查日期：2026-08-22 ｜ 自动化门禁（Gate 1）：`npm run typecheck` ✅ 0 error

## 一、总体印象

**好的一面**：类型系统干净（typecheck 全绿）；Store action 普遍采用不可变更新、无直接 mutate；薪资计算 `calcTotal` 收敛为纯函数；`PickerView` 的 `indicator-style` 全部用 `px`，符合小程序铁律；教师管理库已建立"向统一视图同步"的机制，方向正确。

**核心问题**：数据一致性是最大短板，且集中在**月份维度与双教师模型**两处结构性缺陷。标准 §4 最担心的"同一份数据多副本、改动未同步"正在发生——只是目前被 Mock 层掩盖，联调后会放大。另有一处用户可见的派生计数语义错误，以及裸 `<Input>` 在业务页面大面积出现，说明"规范落地"仍参差不齐。

**结论**：存在 **2 个 🔴 Blocker**（均属数据一致性，建议合并前必修），**6 个 🟡 Suggestion**，**3 个 💭 Nit**。

---

## 二、发现清单（按优先级）

| # | 级别 | 维度 | 问题 | 位置 |
|---|------|------|------|------|
| 1 | 🔴 | 数据一致性 | 历史/未来月份数据为不可变快照，写操作后刷新静默丢数据 | `src/data/teacher.ts:781-802` / `:284` |
| 2 | 🔴 | 数据一致性 | 写操作与读取月份口径不一致，跨月视图错位 + 确认变 no-op | `src/stores/teacher.ts:208` vs `:284` |
| 3 | 🟡 | 正确性/派生 | `getPendingCount` 语义错误（非 archived ≠ 待确认） | `src/stores/teacher.ts:380` |
| 4 | 🟡 | 数据一致性 | 实发金额 `mockExecutePay` 与 `calcTotal` 不一致 | `src/data/teacher.ts:929-934` vs `:25-37` |
| 5 | 🟡 | 跨模块同步 | 双教师模型，薪资字段永不同步到统一视图 | `src/data/mock-database.ts:662-701` |
| 6 | 🟡 | 规范落地 | 业务页面大面积直接使用裸 `<Input>` | 多处（见 §三.6） |
| 7 | 🟡 | 错误处理 | Store 写操作无 try/catch 与回滚 | `src/stores/teacher.ts:206-239` |
| 8 | 🟡 | 状态机 | `SalaryStatus` 含 `teacher_confirmed` 但无对应流转 | `src/types/teacher.ts:32` |
| 9 | 💭 | 逻辑 | `toggleSelectAll` 纳入"离职未归档"教师 | `src/stores/teacher.ts:249-259` |
| 10 | 💭 | 健壮性 | `mockUpdateSalaryModel` 用 `modelIdx` 比较，顺序变化即失配 | `src/data/teacher.ts:1077` |
| 11 | 💭 | 一致性 | 三个统计口径（`active` / 非 `archived`）不自洽 | `src/stores/teacher.ts:379-388` |

---

## 三、详细发现（🔴🔴 + 关键 🟡）

### 🔴 发现 1：历史/未来月份数据为不可变快照，写操作后刷新静默丢数据

**现象**：`mockGetTeachers(campusId, month)` 对**非当前月**返回 `genMonthSnapshot(month)`，而该函数由**静态常量 `mockTeachers`** 重新 `map` 生成（`src/data/teacher.ts:736`），完全不读取内存可变源 `_teachers`；且对过去月份强制 `salaryStatus='archived'`（`:748`）。

**触发**：`addDeduction / updateDeduction / deleteDeduction` 在写完后调用 `teacherService.getList(undefined, get().salaryMonth)`（`src/stores/teacher.ts:284/290/296`）。当用户处于 **7 月**视图新增扣款 → mock 已写入 `_teachers` → 随即以 `salaryMonth='2026-07'` 重新拉取 → 返回的是从 `mockTeachers` 重新生成的快照 → **刚加的扣款立刻消失**。

**为什么是 Blocker**：这是标准 §4.2.3（列表/详情/缓存同步）与 §4.2.7（Mock 引用一致性）的直接违反，且属于**静默数据丢失**——用户操作后界面"看起来没反应/数据回退"，无任何报错。联调后若后端按月份快照语义实现，问题会原样带上线。

**建议**：
- 让 `_teachers` 成为**唯一可变源**，按月维度在 `_teachers` 上维护（如 `_teachersByMonth: Record<month, TeacherUIModel[]>`），`getList(month)` 始终读写该源，删除 `genMonthSnapshot` 的"覆盖式重生成"逻辑。
- 或至少在写操作后**以写操作返回的实体为准刷新 store**，而非盲查 `getList(month)`。

---

### 🔴 发现 2：写操作与读取的月份口径不一致，跨月视图错位

**现象**：
- `confirmSalary`（`src/stores/teacher.ts:206-210`）调用 `teacherService.getList()` —— **忽略月份，恒取当前月 `_teachers`**。
- `addDeduction` 等调用 `teacherService.getList(undefined, get().salaryMonth)` —— **尊重月份**。

**触发**：用户在 7 月视图点"确认薪资" → `mockConfirmSalary` 对该月快照（状态被强制 `archived`）是 no-op → 刷新却拉回 8 月 `_teachers`。结果：**7 月视图点确认毫无效果，且列表瞬间跳成 8 月数据**，与顶部月份选择器展示的"2026-07"严重错位。

**为什么是 Blocker**：同一 Store 内写/读对"当前看的是哪个月"理解不一致，属于标准 §4.2.3 的跨视图数据错位，会直接导致用户**误操作 + 看到错误月份数据**。

**建议**：统一月份口径——Store 内所有写操作前后都显式携带 `salaryMonth`，且底层数据源按月索引，避免"忽略月份即取当前月"的隐式行为。

---

### 🟡 发现 3：`getPendingCount` 语义错误（非 archived ≠ 待确认）

**位置**：`src/stores/teacher.ts:380`
```ts
getPendingCount: () => get().teachers.filter((t) => t.salaryStatus !== 'archived').length,
```
**问题**：返回的是"所有未归档（含 confirmed / sending / pending）"的数量，而非"待确认（pending）"数量。该值被 `useTeacherList.ts:109` 的 `pendingCount` 消费并展示（标签为"待确认"）。若 UI 以"待确认"呈现，则是一条**用户可见的错误计数**。同一文件 `:104-107` 的 `salaryTeachers` 列表也用"非 archived"口径，与状态机语义漂移。

**建议**：改为 `t.salaryStatus === 'pending'`；并复核列表过滤口径，使"列表项"与"计数"一致。

---

### 🟡 发现 4：实发金额与界面应发金额不一致

**位置**：`mockExecutePay`（`src/data/teacher.ts:929-934`）内联计算：
```ts
const total = t.base + t.hours * t.rate + t.attend + t.perf
  + t.deductions.reduce(...);
```
而界面展示的 `calcTotal`（`src/stores/teacher.ts:25-37`）还**减去社保(socialInsurance)、迟到(lateFine)、其他罚款(otherFine)，并加奖金(bonusAmount)**。两处算法不同 → **发放后写入 `payHistory.amount` 的金额 ≠ 发放前界面显示的金额**，违反标准 §4.2.1（单一计算口径/派生一致）。

**建议**：发放时使用与 `calcTotal` 同一纯函数，避免双份算法漂移。

---

### 🟡 发现 5：双教师模型导致薪资字段无法跨模块同步

**现象**：存在两套教师类型——
- `TeacherUIModel`（`src/types/teacher.ts:398`）：含 `salaryStatus / deductions / salaryRule / salaryTemplateId`，是薪资事实源，仅存于 `data/teacher.ts` 的 `_teachers`。
- `Teacher`（`src/types/teacher.ts:6`，统一视图）：被 class-booking、home、statistics、students、campus 广泛引用（`mock-database.TEACHERS`）。

`syncTeacherView` → `buildTeacherView`（`src/data/mock-database.ts:662-701`）**只同步 `name/phone/role/status/subjects`**，薪资字段完全不进入统一视图（统一视图教师 `pendingSalary: 0` 写死）。

**风险**：任何需要"某教师本月薪资状态/扣款"的**跨模块**场景（如首页待发薪资汇总、课表关联教师薪资、统计排行）都拿不到真实薪资数据。这正是用户最担心的"跨模块数据准确与同步"缺口，且是**结构性**的——不修模型，薪资数据永远被锁死在 teacher 模块内。

**建议**：将薪资相关字段并入统一 `Teacher` 模型，`buildTeacherView` 一并同步；或在统一视图上保留对管理库的引用，避免双份真相。

---

### 🟡 发现 6：业务页面大面积直接使用裸 `<Input>`

**现象**：约 40 处页面/组件直接使用小程序 `<Input>`，与 `AGENTS.md`「输入框必须用 FormInput」冲突，例如：
- `package-settings/pages/venue-form/index.tsx:221,338`
- `package-course/pages/class-form/index.tsx:840`
- `package-course/pages/lesson-form/index.tsx:2085,2108,2260,2305`
- `package-course/pages/package-form/index.tsx:384,480,549,561`
- `components/teacher/SalaryEditSheet/index.tsx:117,135,151,167`
- `components/teacher/SalaryModelSheet/index.tsx:165,180,194,209`

> 注：`FormInput`、`FormCell`、`SheetInput` 内部使用 `<Input>` 属正常（它们就是封装层）。问题在业务页面**绕过了封装**。

**建议**：表单类输入统一收口为 `FormInput`；若确为搜索/只读展示框需豁免，请在 `AGENTS.md` 显式列白名单，否则按违规处理。

---

### 🟡 发现 7：Store 写操作无 try/catch 与回滚

**现象**：`confirmSalary / batchConfirm / executePay / addDeduction` 等（`src/stores/teacher.ts:206-239`）均为 `await service(); await getList(); set(...)`，无异常捕获。

**风险**：若"写成功后刷新 `getList` 失败"，mock/后端已前滚而 store 停留在旧值 → UI 与数据源不一致（标准 §4.2.4 乐观更新与回滚的反面）。当前为同步 mock 不易触发，联调后真实网络抖动会暴露。

**建议**：写操作包裹 `try/catch`；失败时不静默，回滚本地或提示刷新；或明确"刷新失败由页面层兜底 toast + 重试入口"。

---

### 🟡 发现 8：状态机不完整（`teacher_confirmed` 悬空）

**位置**：`SalaryStatus`（`src/types/teacher.ts:32`）含 `pending | confirmed | sending | teacher_confirmed | archived`，但 mock 流转仅实现 `pending→confirmed→sending→archived`（`mockConfirmSalary:884` / `mockSendSalarySlip:963` / `mockExecutePay:917`），`teacher_confirmed` 既未被设置也未在流转中校验。

**建议**：要么删除未使用的 `teacher_confirmed`，要么补全流程并在中心化流转处校验，避免状态枚举与实现脱节（标准 §4.2.2）。

---

### 💭 发现 9-11（Nit，不阻塞）

- **9**：`toggleSelectAll`（`:249-259`）选中条件 `status==='active' || salaryStatus!=='archived'` 会把"已离职但未归档"教师纳入批量操作，语义存疑。
- **10**：`mockUpdateSalaryModel`（`:1077`）用 `t.modelIdx !== _salaryModels.findIndex(...)` 比较；模型顺序一旦变化即失配，应改用 `modelId` 关联。
- **11**：`getActiveCount / getTotalHours / getTotalSalary`（`:379-388`）三者纳入口径不一致（一个看 `active`，另两个看"非 archived"），仪表盘数字彼此不自洽。

---

## 四、数据一致性专项验证（对照标准 §4）

### 4.1 专项检查项结果

| 检查项（§4.2） | 结论 | 证据 |
|------|------|------|
| 4.2.1 单一数据源 | ⚠️ 部分达标 | 薪资源唯一在 `_teachers`，但计算口径分裂（发现 4）；跨模块另有 `TEACHERS` 副本（发现 5） |
| 4.2.2 状态机完整性 | ⚠️ 单向但缺态 | 流转单向正确，但 `teacher_confirmed` 悬空（发现 8） |
| 4.2.3 列表/详情/缓存同步 | 🔴 不达标 | 跨月刷新丢数据、跨月视图错位（发现 1、2） |
| 4.2.4 乐观更新与回滚 | ⚠️ 无乐观更新、无回滚 | store 写操作无 try/catch（发现 7） |
| 4.2.5 跨 Store 同步 | 🔴 不达标 | 薪资字段不进统一视图（发现 5） |
| 4.2.6 跨服务一致性 | ⏸ 待联调 | Mock 阶段无法验证幂等/补偿，建议联调后补 DC-08 |
| 4.2.7 Mock 引用一致性 | 🔴 不达标 | 非当前月返回静态基数据重生成，忽略内存改动（发现 1） |

### 4.2 DC 场景走查（基于代码静态推演）

| 场景 | 当前行为 | 判定 |
|------|----------|------|
| DC-01 确认薪资→返回列表 | 当前月 OK；**非当前月失效/错位** | 🔴（非当前月） |
| DC-02 编辑教师→返回列表 | `updateTeacher` 后 `getList()` 刷新当前月 OK | 🟢 |
| DC-03 删除教师→关联模块 | `syncTeacherView` 刷新统一视图，方向正确 | 🟢（字段不全见发现 5） |
| DC-04 分班/调班双向一致 | 依赖统一视图，薪资不同步（发现 5） | 🟡 |
| DC-05 课表变更→双方课表 | 排课为独立 Mock，未与教师/学员联动 | 🟡 |
| DC-06 已发放再确认 | `mockExecutePay` 仅处理 `sending`，已 `archived` 不会被重复发放 | 🟢 |
| DC-07 写操作失败回滚 | 无 try/catch，无法回滚（发现 7） | 🔴 |
| DC-08 双击提交幂等 | Mock 无去重/前置校验，联调需验证 | ⏸ |

---

## 五、正向实践（值得保留/推广）

- ✅ `npm run typecheck` 全绿，类型严格模式落实到位。
- ✅ Store action 普遍不可变更新（`.map` / `[...arr]`），无直接 mutate state。
- ✅ `calcTotal` 为纯函数，薪资计算收敛。
- ✅ 全部 `PickerView` 的 `indicatorStyle` 均为 `px`（48px），符合小程序铁律。
- ✅ Service 层只抛错不弹 UI，符合 `api-service.md` 分层。
- ✅ 教师管理库已建立 `syncTeacherView` 同步统一视图的机制（方向对，仅字段覆盖不全）。

---

## 六、整改优先级与下一步

**合并前必修（🔴）**：
1. 修复 §三.1 / §三.2——统一月份维度数据源，禁止 `genMonthSnapshot` 覆盖式重生成；写/读统一携带 `salaryMonth`。
2. 修复 §三.3——`getPendingCount` 改为 `=== 'pending'`。

**建议本轮修（🟡）**：发现 4、5、6、7、8（其中 5 为结构性，建议排期专项重构；6 可借 lint 规则批量收口）。

**后续动作**：
- 将"裸 `<Input>`"纳入 ESLint 自定义规则或 `lint:fix` 批量替换。
- 联调后补跑 DC-07 / DC-08（真实网络失败与幂等）。
- 在 `AGENTS.md` 第八节增加指向 `CODE_REVIEW_STANDARD.md` 的索引，使标准成为每次 PR 的默认门禁。

> 审查标注沿用火眼眼规范：🔴 Blocker（阻塞合并）／🟡 Suggestion（建议修）／💭 Nit（可选）。
