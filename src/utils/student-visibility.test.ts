import { describe, expect, it } from 'vitest';
import type { Student } from '@/types/student';
import { filterActiveStudents, isActiveStudent } from './student-visibility';

/** 列表行形状：status 可缺省（老数据/字段未下发） */
type Row = { id: string; status?: Student['status'] };

describe('isActiveStudent / filterActiveStudents（软删除学员可见性）', () => {
  it('active 视为在籍', () => {
    expect(isActiveStudent({ status: 'active' })).toBe(true);
  });

  it('deleted（后端 INACTIVE 软删除）不在籍', () => {
    expect(isActiveStudent({ status: 'deleted' })).toBe(false);
  });

  it('status 缺省时按在籍处理，避免误隐藏老数据', () => {
    expect(isActiveStudent({})).toBe(true);
    expect(isActiveStudent({ status: undefined })).toBe(true);
  });

  it('过滤后剔除软删除学员，保持原顺序', () => {
    const alive: Row = { id: 's1', status: 'active' };
    const removed: Row = { id: 's2', status: 'deleted' };
    const legacy: Row = { id: 's3' };
    const another: Row = { id: 's4', status: 'active' };

    expect(filterActiveStudents([alive, removed, legacy, another])).toEqual([
      alive,
      legacy,
      another,
    ]);
  });

  it('保留元素上的其它字段（不因过滤丢失类型）', () => {
    const list: Array<Row & { name: string }> = [{ id: 's1', status: 'active', name: '小明' }];
    expect(filterActiveStudents(list)[0].name).toBe('小明');
  });

  it('全为软删除时返回空数组', () => {
    expect(filterActiveStudents([{ status: 'deleted' as const }])).toEqual([]);
  });
});
