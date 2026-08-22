# 会员卡包 / 消课记录 数据链路审查报告（2026-08-22）

> 背景：用户实测发现"会员卡包、消课记录是胡写的，对照不上"。
> 方法：全链路审计（发卡→课包→消课→剩余）＋ 页面数据源走查 ＋ 自动化对账用例（`src/data/member-card-chain.audit.test.ts`，A1~A5）。

---

## 一、审计结论（自动化对账）

| 审计项 | 修复前 | 修复后 |
|---|---|---|
| A1 课包内部不变量（total = used + remaining；purchased + bonus = total） | ✅ 0 异常 | ✅ 0 异常 |
| **A2 学员级对账：Σ消课记录已消课时 === Σ课包 usedHours** | ❌ **68/76 学员对不上**（记录普遍多出 100+ 课时） | ✅ **0 异常** |
| A3 消课记录引用完整性（学员/班级存在） | ✅ 无坏引用 | ✅ 无坏引用 |
| A4 会员卡↔课包关联（memberCardId） | 11 个种子课包无关联（回退存储值，可接受） | 提示级 |
| **A5 撤销/删除消课记录 → 回补课包课时** | ❌ **空实现 / 不回补** | ✅ 已实现 |

**核心根因**：种子消课记录由 `generateLessonRecords()` **随机生成**（按班级上课日、95% 签到随机小时），与手工种子的课包 `usedHours` 完全脱钩——两条数据源各写各的，必然对不上。

## 二、已修复（mock 数据 + 逻辑）

1. **消课记录与课包对账**（`mock-database.ts` 重写 `generateLessonRecords`）：按学员分配"可消预算 = Σ课包 usedHours − 固定示例记录已消课时"，签到记录逐步消耗预算；课包用尽后签到按 0 课时（赠课/免课时场景）。⇒ 每个学员 已消课时 ≡ 课包 usedHours，剩余课时 = total − used 完全自洽。
2. **补全缺失课包**：`stu-063/064/068`（国画班）有 6/28 补课示例记录（各 2 课时）但没有课包 → 新增 `pkg-012/013/014`（国画课包，used 2 / remaining 22），消除"无课包却有消课"的矛盾。
3. **撤销/删除消课记录回补课时**（`students.ts`）：`mockRevokeLessonRecord` 原为空桩、`mockDeleteLessonRecord` 只删记录不回补 → 新增 `refundPackageHours()`，按记录 `packageId` 回补 `remainingHours`、回扣 `usedHours`（finished 恢复 active）。
4. **记录字段归一**：`mockCreateLessonRecord` 统一落驼峰 `hours`/`packageId`（此前运行时记录只有 snake_case `hours_used`/`package_id`，回补与展示读不到），`LessonRecord` 类型新增 `packageId?`。
5. **回归测试**：新增 `member-card-chain.audit.test.ts`（A1~A5 共 5 条），全仓 18/18 通过。

## 三、页面链路走查发现（潜在问题 / 修复建议）

| # | 位置 | 问题 | 建议 |
|---|---|---|---|
| P1 | `class-checkin` / `lesson-form` | 选课包策略 `packages.find(p => p.remaining_hours >= hoursUsed)` 只取**第一个**剩余足够的课包；学员多课包时第一个不够、第二个够会被误判"课时不足" | 按"最早到期优先 / 剩余最多优先"选课包，并给出可选课包列表供教师指定 |
| P2 | `mockCreateLessonRecord` | 记录字段 snake/camel 双轨（`student_id`/`lesson_date`/`hours_used` vs `studentId`/`date`/`hours`），本次仅归一 `hours`/`packageId`，其余字段仍靠页面映射兜底 | 建议创建记录时全字段落驼峰，或统一走 `mapMockLessonRecord` 映射收口 |
| P3 | 种子课包 | 14 个课包无 `memberCardId` 关联（发卡链路本身闭环：发卡建包带关联；种子卡显示走存储值回退） | 联调后由后端契约决定种子数据是否补关联 |
| P4 | `mockUpdateLessonRecord` | 未检索到"修改消课记录"实现；若存在改记录入口（补卡/纠错），需同步课时变更 | 确认页面是否有改记录需求；有则实现"改课时→差额回补/追扣" |
| P5 | 时间基准 | 种子记录按真实时钟截断（CUR_DAY=22），与 L-04 时间基准修复一致，但"6/28 补课示例"为固定过去日期，跨月后示例会越来越旧 | 示例记录日期建议随当前月动态生成（仅影响演示效果） |

## 四、验证

- typecheck ✅ ｜ 单测 **18/18** ✅（新增 A1~A5 数据链审计）｜ build:weapp ✅

## 五、结论

"会员卡包/消课记录对不上"的根因是**种子消课记录随机生成、与课包脱钩**；已通过"按课包预算生成记录 + 撤销/删除回补课时"彻底闭合数据链，并用自动化对账用例锁死，防止再次漂移。P1~P5 为页面策略与工程建议，待用户确认是否本轮跟进。
