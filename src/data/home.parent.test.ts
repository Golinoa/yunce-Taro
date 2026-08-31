/**
 * 家长首页 mock 数据链
 * 锁定：子女绑定 → 课包 → 排课 可被首页聚合消费
 */
import { describe, expect, it } from 'vitest';
import {
  mockGetPackagesByStudent,
  mockGetRecordsByStudent,
  mockGetSchedulesByStudent,
  mockGetStudentsByParent,
} from '@/data/home';
import { CLASSES, SCHEDULES } from '@/data/mock-database';

const PARENT_ID = 'user-parent-001';

describe('家长首页 mock 数据链', () => {
  it('mockGetStudentsByParent 仅返回该家长绑定子女', async () => {
    const list = await mockGetStudentsByParent(PARENT_ID);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((s) => s.parentId === PARENT_ID)).toBe(true);
  });

  it('子女课包 remainingHours 与 total/used 自洽', async () => {
    const students = await mockGetStudentsByParent(PARENT_ID);
    const packages = await mockGetPackagesByStudent(students[0]!.id);
    expect(packages.length).toBeGreaterThan(0);
    for (const pkg of packages) {
      expect(pkg.studentId).toBe(students[0]!.id);
      expect(pkg.remainingHours).toBe(pkg.totalHours - pkg.usedHours);
      expect(pkg.remainingHours).toBeGreaterThanOrEqual(0);
    }
  });

  it('子女排课仅落在其 classIds 内', async () => {
    const students = await mockGetStudentsByParent(PARENT_ID);
    const student = students[0]!;
    const schedules = await mockGetSchedulesByStudent(student.id);
    for (const schedule of schedules) {
      expect(student.classIds).toContain(schedule.classId);
      expect(CLASSES.some((c) => c.id === schedule.classId)).toBe(true);
    }
    // 对照全量排课：不应出现无关班级
    const foreign = SCHEDULES.filter(
      (s) => !student.classIds.includes(s.classId) && schedules.some((x) => x.id === s.id),
    );
    expect(foreign).toHaveLength(0);
  });

  it('子女消课记录可按 studentId 拉取', async () => {
    const students = await mockGetStudentsByParent(PARENT_ID);
    const records = await mockGetRecordsByStudent(students[0]!.id, 20);
    expect(records.every((r) => r.studentId === students[0]!.id)).toBe(true);
  });
});
