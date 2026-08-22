# 代码审查复审报告（首轮 Re-Audit）

> 复审对象：`CODE_REVIEW_REPORT.md`（首轮，2026-08-22）
> 复审依据：`CODE_REVIEW_STANDARD.md` v1.0 + 实际代码重读
> 复审方法：对首轮每一项发现**回读真实代码逐行核对**，并主动排查首轮可能遗漏的维度（含 UI 可达性、跨模块同步、状态机文档一致性、死代码）
> 复审结论：**首轮结论基本正确，核心数据一致性问题属实；2 处需校准严重度/机制描述，并补充 4 项遗漏。无虚构/误报结论。**

---

## 0. 自动化门禁复核（Gate 1）

`npm run typecheck` 仍 **0 error**（首轮结论保持）。问题仍集中在数据一致性与规范落地，不在类型层。

---

## 1. 首轮发现逐项复核

| # | 首轮结论 | 复核裁定 | 关键证据 |
|---|----------|----------|----------|
| 🔴1 | 跨月数据静默丢失（`addDeduction` 写后按 `salaryMonth` 重拉 → 扣款消失） | **根因属实，但机制描述需修正；当前为潜在缺陷（latent）** | 见 §2 |
| 🔴2 | 跨月视图错位（`confirmSalary` 用 `getList()` 无月份，7 月确认却刷新成 8 月） | **降级为 🟡（潜在不一致 / 代码异味，非当前可达的数据丢失）** | 见 §3 |
| 🟡 | `getPendingCount` 返回"非 archived 数"而非"待确认数" | **确认 + 扩展**（项目内存在两个相互矛盾的"待确认"计数） | 见 §4 |
| 🟡 | `mockExecutePay` 实发算法 ≠ 界面 `calcTotal` | **确认 + 强化**（连课时费口径都不同） | 见 §5 |
| 🟡 | 双教师模型（薪资字段不进统一视图） | **确认 + 扩展**（还漏同步了 `status`，见遗漏 A） | 见 §6 |
| 🟡 | 业务页约 40 处裸 `<Input>` | **确认 + 修正计数（≈47 处，业务层约 44 处）** | 见 §7 |
| 🟡 | Store 写操作无 try/catch 回滚 | **确认**（仅 `fetchAll` 有；写操作均无，`salary-adjust` 页内自救有） | 见 §8 |
| 🟡 | `SalaryStatus.teacher_confirmed` 悬空未实现 | **确认 + 扩展**（状态机文档与实现整体漂移，见遗漏 C） | 见 §9 |
| 💭 | 正向实践（typecheck 干净 / 不可变更新 / `calcTotal` 纯函数 / PickerView 均 px / Service 仅抛错） | **全部确认成立** | — |

---

## 2. 🔴1 复核与修正（核心数据一致性，根因属实）

**根因（已确认，100% 真实）** — `src/data/teacher.ts`：
- L797：`mockGetTeachers` 对任意**非当前月**返回 `genMonthSnapshot(month)`，而 `genMonthSnapshot`（L731–779）**从静态常量 `mockTeachers` 重新 map 生成**（L736），完全忽略内存可变源 `_teachers`。
- 所有写操作（`mockConfirmSalary`/`mockUpdateTeacher`/`mockAddDeduction`/`mockExecutePay` 等）都只改 `_teachers`，即**仅"当前月"持有真实可变数据**，历史/未来月永远是"按月份种子即时编造 + 只读"的快照。
- 这违反标准「单一数据源」「列表/详情/缓存同步」专项——是真实的数据架构缺陷。

**机制描述需修正（重要）**：
1. 首轮称扣款走 `addDeduction` 且"刚加的扣款立刻消失"。但**实际扣款 UI（`salary-adjust`）持久化走的是 `updateTeacher(id, { deductions })`**（`src/package-teacher/pages/salary-adjust/index.tsx:344`），**不是** `addDeduction`。
2. 进一步核实：**`addDeduction` / `updateDeduction` / `deleteDeduction` 三个 Store/Service 方法在全仓库无任何页面调用，属死代码**（grep `addDeduction` 仅在 `stores/teacher.ts` 与 `services/teacher.ts` 出现）。首轮引用的活跃路径并不活跃。
3. **当前 UI 不可触发跨月写入**：`salary-payment` 中过去月份被 `genMonthSnapshot` **强制 `archived`**（L748），`handleOpenDetail` 对 `archived` 只开只读 `salary-detail`；未来月份被 Picker 拦截（`handleNextMonth` L214）。故"编辑 7 月扣款后消失"在当前 Mock/UI 下**不可达**。

**裁定**：根因视为 **🔴 潜在数据完整性缺陷（latent，须在上线前修复）**——一旦接入真实后端、或开放"历史月份复核/纠错"，非当前月数据将不可逆丢失或被编造数据覆盖。但首轮"当前即可见数据丢失"的即时性描述**过强**，应予纠正。建议将首轮 🔴1 改写为："非当前月数据源非单一可信源（`_teachers` 仅存当前月，历史/未来月由静态 `mockTeachers` 即时编造且只读）"，严重度标注为 **🔴-latent**。

---

## 3. 🔴2 复核与降级（月份作用域不一致）

**不一致属实（已确认）** — `src/stores/teacher.ts`：
- 不传月份重拉：`confirmSalary`(L208)、`batchConfirm`(L214)、`executePay`(L225)、`executeSend`(L236)、`addTeacher`(L266)、`updateTeacher`(L272)、`resignTeacher`(L278)、`applySalaryTemplate`(L346)、`updateTeacherSalaryRule`(L363)、`copySalaryRuleToTeachers`(L372)。
- 传月份重拉：仅 `addDeduction`(L284)、`updateDeduction`(L290)、`deleteDeduction`(L296)。

**但即时数据丢失不可达**：确认（`confirmSalary`）只在当前月可达（过去月被强制 `archived` 后确认按钮隐藏，见 `salary-payment` L540 `stats.pending>0` 才显示"一键核对"）。当前月下 `getList()` 正确返回当前月，行为正确。

**裁定**：降级为 **🟡**。它仍是真实的一致性/可维护性缺陷（写后重拉未统一携带 `salaryMonth`），并在"未来开放历史月操作"时会升级为 🔴。首轮将其与 🔴1 并列、并描述为"7 月确认刷新成 8 月"**过度定性**，复审修正。

---

## 4. 🟡 `getPendingCount` 语义（确认 + 扩展）

- `stores/teacher.ts:380`：`getPendingCount = () => teachers.filter(t => t.salaryStatus !== 'archived').length` —— 计的是"非归档总数"，**非"待确认"**。
- 使用点 `useTeacherList.ts:109`（暴露给教师列表页 L323）。
- **新发现（遗漏点）**：同一应用里存在**两个互相矛盾的"待确认"计数**——`salary-payment` 页用自算的 `stats.pending`（`statusCounts.pending`，正确），而教师列表用 `getPendingCount`（错误）。两处口径不一，维护易错。裁定保持 🟡，建议统一为单一 `getPendingCount` 且严格按 `salaryStatus === 'pending'` 计数。

---

## 5. 🟡 `mockExecutePay` 实发 ≠ `calcTotal`（确认 + 强化）

`src/data/teacher.ts:929–934`：
```ts
const total = t.base + t.hours * t.rate + t.attend + t.perf
  + t.deductions.reduce((s,d)=> s + (d.type==='bonus'? d.amount : -d.amount), 0);
```
而界面 `calcTotal`（`stores/teacher.ts:25–37`）还减去 `socialInsurance/lateFine/otherFine`、加上 `bonusAmount`，且**优先用 `categoryLessonFees`** 而非 `hours*rate`。

→ 实发金额与界面应发金额**两个口径都不同**（既漏减款项，又忽略分类课时费）。若某教师有 `lateFine` 或自定义 `categoryLessonFees`，发放额与展示额对不上。保持 🟡，建议发放时统一调用 `calcTotal`（或抽公共薪资计算服务）。

---

## 6. 🟡 双教师模型（确认 + 扩展，见遗漏 A）

`buildTeacherView`（`src/data/mock-database.ts:662–701`）只同步 `name/phone/role/subjects`。薪资字段（`salaryStatus/deductions/salaryRule/salaryTemplateId`）确实不进统一视图（class/home/statistics）——首轮已指出。

**但首轮遗漏了更基础的同步缺口**：该函数在合并路径（L667–678）与新增路径（L682–697）**两处都把 `status` 硬编码为 `'active'`**。即：教师管理库里已 `resigned` 的教师，在统一视图（班级/学员/首页/统计所读）中**永远是 `active`**。这是跨模块数据一致性硬伤，且比薪资字段缺失更基础。见遗漏 A。

---

## 7. 🟡 裸 `<Input>`（确认 + 修正计数）

grep `<Input` 全仓命中 **29 个文件、共 50 处**。其中 3 处为合理内部封装：`FormInput/index.tsx`、`FormCell/index.tsx`、`SheetInput/index.tsx`。**业务代码约 44 处裸 Input**（首轮"约 40"偏少，修正为 ≈44）。涉及 `SalaryEditSheet`、`SalaryModelSheet`、`package-form`、`lesson-form`、`class-form`、`ProxyUserSelectSheet` 等。保持 🟡，建议按 AGENTS.md「输入框必须用 FormInput」批量替换。

---

## 8. 🟡 写操作无 try/catch（确认）

仅 `fetchAll`（L170）有 try/catch。写操作 `confirmSalary/batchConfirm/executePay/executeSend/addTeacher/updateTeacher/resignTeacher/addDeduction/...` **均无 try/catch**；若底层 mock 抛错，`set` 不执行、UI 卡在 loading。例外：`salary-adjust` 的 `handleSave` 页内已有 try/catch（L343–358），属良好实践。保持 🟡，建议 Store 写操作统一 `try/catch + logError` 并回滚 loading。

---

## 9. 🟡 `teacher_confirmed` 悬空（确认 + 扩展，见遗漏 C）

`SalaryStatus`（`types/teacher.ts:32`）含 `teacher_confirmed`，其 `SALARY_STATUS_META` 标签为"已确认"（L65–68），但**全代码无任何赋值点**（仅类型定义 + 元数据映射）。首轮已指出"悬空未实现"。

**扩展（遗漏 C）**：实际状态机与 `AGENTS.md` 文档**整体漂移**——文档写 `pending→confirmed→paid`，而代码实现是 `pending→confirmed→sending→archived`（`sending`=发送工资单后的"确认中"，L58–61），且 `normalizeSalaryStatus` 把旧值 `paid` 归一为 `archived`（L83）。即：`paid` 已改名为 `archived`、中间多了 `sending`、还留了一个永不触发的 `teacher_confirmed`。建议统一文档与代码，删除或实现 `teacher_confirmed`，避免后续维护误解。

---

## 10. 首轮遗漏项汇总（新增）

| 编号 | 维度 | 发现 | 严重度 | 证据 |
|------|------|------|--------|------|
| **A** | 数据一致性 | `buildTeacherView` 把 `status` **硬编码 `'active'`**（L672/L692），离职状态不进统一视图 → 班级/学员/统计仍见已离职教师为在职 | 🟡（高影响） | `mock-database.ts:662–701` |
| **B** | 数据一致性 | `buildTeacherView` 对管理库新增教师赋 `campusIds: []`（L688）→ 新增教师在按校区筛选的选择器中不可见 | 💭 | `mock-database.ts:688` |
| **C** | 数据一致性/文档 | 状态机文档（`pending→confirmed→paid`）与实现（`pending→confirmed→sending→archived` + 孤儿 `teacher_confirmed`）漂移 | 🟡 | `types/teacher.ts:32,58,65,83` + `AGENTS.md` |
| **D** | 数据一致性 | 应用内存在**两个矛盾的"待确认"计数**（`teacher-list` 用错误 `getPendingCount` vs `salary-payment` 用正确 `stats.pending`） | 🟡 | `useTeacherList.ts:109` vs `salary-payment:198` |
| **E** | 可维护性 | `addDeduction/updateDeduction/deleteDeduction` 为**死代码**（无页面调用，实际扣款走 `updateTeacher`） | 💭 | grep 全仓 |
| **F** | 规范 | 裸 `<Input>` 实际 ≈44 处（首轮"约 40"偏少） | 🟡（计数修正） | grep 统计 |

> 说明：A/C/D 属首轮"数据一致性专项"应覆盖但未覆盖的点，是本次复审的主要增量价值。

---

## 11. 总体裁定与修复优先级

### 首轮结论可信度
- **无误报**：8 项首轮发现全部在代码中找到确凿证据，无虚构。
- **2 项需校准**：🔴1（机制描述过强，实为 latent）、🔴2（即时数据丢失不可达，降级 🟡）。
- **新增 6 项遗漏**（A–F），其中 A/C/D 为本应被"数据一致性专项"覆盖的关键缺口。
- **结论**：首轮对"数据一致性"核心判断**正确且高价值**；复审使其更精确、更完整。标准 `CODE_REVIEW_STANDARD.md` 的专项检查项本身有效，但建议在第 §4.2 增加两条：`统一视图字段同步完整性`、`状态机文档与实现一致性`。

### 修复优先级（建议）
1. **P0（上线前必修）**：🔴1 根因——确立非当前月的单一可信数据源（真实后端接入时 `_teachers` 须按月份维度存储/查询，禁止历史月由静态常量编造）。
2. **P1（高优先）**：A 离职状态同步、C 状态机文档与实现对齐、D 统一"待确认"计数、§5 发放额统一 `calcTotal`。
3. **P2（规范整改）**：🔴2 写后重拉统一携带 `salaryMonth`、§7 裸 Input 批量替换、§8 写操作 try/catch、E 清理死代码。

### 一句话总结
> 首轮审查"方向对、核心准"；复审把 🔴2 降级、把 🔴1 从"即时丢失"修正为"潜在架构缺陷"，并补上**离职状态不同步、状态机文档漂移、双待确认计数**三块首轮漏掉的数据一致性缺口——整体结论更稳、更可落地。
