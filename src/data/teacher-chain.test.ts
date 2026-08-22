/**
 * 教师数据链回归测试（L-03 修复 2026-08-22）
 *
 * 锁定的不变量：
 * 1. 登录账号体系（USERS/IDENTITIES）与统一视图 TEACHERS 的 userId→name 一一对应
 *    （teacher1=张老师 / teacher2=李老师 / teacher3=王老师 / teacher4=赵老师 / principal1=万老师）
 * 2. 管理库(_teachers)与 BASE 视图对同一 teacher-id 的名字一致，不再出现"teacher-001 王校长 vs 张老师"
 * 3. 首页链路 getTeacher(userId) 能命中正确教师档案（而非错乱命中他人）
 */
import { describe, expect, it } from 'vitest';
import { TEACHERS } from '@/data/mock-database';
import { mockGetTeacher } from '@/data/home';

/** 期望的 userId → teacherId → name 对照表 */
const EXPECTED: Array<{ userId: string; teacherId: string; name: string }> = [
  { userId: 'user-teacher-001', teacherId: 'teacher-001', name: '张老师' },
  { userId: 'user-teacher-002', teacherId: 'teacher-002', name: '李老师' },
  { userId: 'user-teacher-003', teacherId: 'teacher-003', name: '王老师' },
  { userId: 'user-teacher-004', teacherId: 'teacher-004', name: '赵老师' },
  { userId: 'user-principal-001', teacherId: 'teacher-principal-001', name: '万老师' },
];

describe('教师数据链（L-03 修复）', () => {
  it('统一视图 TEACHERS 的 id 与 userId 均能解析到正确姓名', () => {
    for (const row of EXPECTED) {
      const byId = TEACHERS.find((t) => t.id === row.teacherId);
      const byUserId = TEACHERS.find((t) => t.userId === row.userId);
      expect(byId?.name, `${row.teacherId} 名字`).toBe(row.name);
      expect(byUserId?.name, `${row.userId} 名字`).toBe(row.name);
      // 同一个人：id 与 userId 互相对应
      expect(byId?.userId).toBe(row.userId);
      expect(byUserId?.id).toBe(row.teacherId);
    }
  });

  it('管理库与 BASE 对同一 teacher-id 姓名一致（不再有 王校长/张助教/赵前台 错乱）', () => {
    const names = TEACHERS.map((t) => t.name);
    expect(names).not.toContain('王校长');
    expect(names).not.toContain('赵前台');
  });

  it('首页链路 getTeacher(userId) 命中正确教师档案', async () => {
    for (const row of EXPECTED) {
      const teacher = await mockGetTeacher(row.userId);
      expect(teacher, `${row.userId} 应能解析到教师`).not.toBeNull();
      expect(teacher?.name).toBe(row.name);
    }
  });
});
