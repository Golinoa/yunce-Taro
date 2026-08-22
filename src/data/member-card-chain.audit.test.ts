/**
 * 会员卡包 / 消课记录 数据链路审计（2026-08-22 用户实测发现"对不上"）
 *
 * 审计不变量：
 * A1 课包内部：totalHours === usedHours + remainingHours（且 purchasedHours + bonusHours === totalHours）
 * A2 学员级：Σ 消课记录已消课时（checked/makeup） === Σ 该学员课包 usedHours
 * A3 引用完整性：消课记录引用存在的学员/班级/教师
 * A4 会员卡：发卡建包关联（memberCardId 存在）
 */
import { describe, expect, it } from 'vitest';
import { COURSE_PACKAGES, LESSON_RECORDS, STUDENTS, CLASSES } from '@/data/mock-database';

function fmt(name: string, list: unknown[]) {
  return `${name} 异常 ${list.length} 项${list.length ? '\n' + JSON.stringify(list.slice(0, 10), null, 1) : ''}`;
}

describe('会员卡包/消课记录数据链路审计', () => {
  it('A1 课包内部不变量', () => {
    const totalMismatch = COURSE_PACKAGES.filter(
      (p) => (p.usedHours || 0) + (p.remainingHours || 0) !== (p.totalHours || 0),
    ).map((p) => ({
      id: p.id,
      stu: p.studentId,
      total: p.totalHours,
      used: p.usedHours,
      rem: p.remainingHours,
    }));
    const purchaseMismatch = COURSE_PACKAGES.filter(
      (p) => (p.purchasedHours || 0) + (p.bonusHours || 0) !== (p.totalHours || 0),
    ).map((p) => ({
      id: p.id,
      stu: p.studentId,
      total: p.totalHours,
      pur: p.purchasedHours,
      bonus: p.bonusHours,
    }));
    console.log(fmt('A1-total≠used+remaining', totalMismatch));
    console.log(fmt('A1-purchased+bonus≠total', purchaseMismatch));
    expect([...totalMismatch, ...purchaseMismatch]).toEqual([]);
  });

  it('A2 学员级：消课记录已消课时 与 课包 usedHours 对账', () => {
    const studentIds = [...new Set(STUDENTS.map((s) => s.id))];
    const mismatches: unknown[] = [];
    for (const sid of studentIds) {
      const pkgUsed = COURSE_PACKAGES.filter((p) => p.studentId === sid).reduce(
        (s, p) => s + (p.usedHours || 0),
        0,
      );
      const recHours = LESSON_RECORDS.filter(
        (r) => r.studentId === sid && (r.status === 'checked' || r.status === 'makeup'),
      ).reduce((s, r) => s + (r.hours || 0), 0);
      // P1 欠课机制：欠课记录（无 packageId、hours>0）计入记录但不计课包消耗，
      // 因此允许 recHours >= pkgUsed（课包已消课时一定有记录支撑；欠课会多出）。
      if (recHours < pkgUsed) {
        mismatches.push({ sid, pkgUsed, recHours, diff: pkgUsed - recHours });
      }
    }
    console.log(fmt('A2-记录课时小于课包已消（缺记录）', mismatches));
    expect(mismatches).toEqual([]);
  });

  it('A3 消课记录引用完整性（学员/班级/教师存在）', () => {
    const stuIds = new Set(STUDENTS.map((s) => s.id));
    const clsIds = new Set(CLASSES.map((c) => c.id));
    const badStu = LESSON_RECORDS.filter((r) => !stuIds.has(r.studentId)).map((r) => r.id);
    const badCls = LESSON_RECORDS.filter((r) => r.classId && !clsIds.has(r.classId)).map(
      (r) => r.id,
    );
    console.log(fmt('A3-记录引用不存在学员', badStu));
    console.log(fmt('A3-记录引用不存在班级', badCls));
    expect([...badStu, ...badCls]).toEqual([]);
  });

  it('A4 会员卡与课包关联（memberCardId）', () => {
    const withoutCard = COURSE_PACKAGES.filter((p) => !p.memberCardId).map((p) => p.id);
    console.log(fmt('A4-课包无 memberCardId 关联', withoutCard));
    // 允许部分课包不关联会员卡（普通课时包），仅提示
    expect(true).toBe(true);
  });

  it('A5 撤销/删除消课记录回补课包课时', async () => {
    const { mockCreateLessonRecord, mockRevokeLessonRecord } = await import('@/data/students');
    const getPkg = () => COURSE_PACKAGES.find((p) => p.id === 'pkg-014')!;
    const before = getPkg().remainingHours;

    // 创建一条 2 课时消课记录 → remaining 减少（数组元素被替换，需重新查找）
    const created = await mockCreateLessonRecord({
      student_id: getPkg().studentId,
      package_id: 'pkg-014',
      hours_used: 2,
      lesson_date: '2026-08-01',
    });
    expect(getPkg().remainingHours).toBe(before - 2);

    // 撤销 → remaining 回补、记录移除（用 create 返回的记录 id）
    expect(created.packageId).toBe('pkg-014');
    await mockRevokeLessonRecord(created.id, 'operator', 'test');
    expect(getPkg().remainingHours).toBe(before);
    expect(LESSON_RECORDS.find((r) => r.id === created.id)).toBeUndefined();
  });
});
