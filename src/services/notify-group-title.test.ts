import { describe, expect, it } from 'vitest';
import { getNotifyGroupTitle } from '@/services/campus';

describe('notify group titles', () => {
  it('返回可读中文分组标题', () => {
    expect(getNotifyGroupTitle('parent')).toBe('家长通知');
    expect(getNotifyGroupTitle('teacher')).toBe('教师通知');
    expect(getNotifyGroupTitle('student_parent')).toBe('学员家长');
    expect(getNotifyGroupTitle('unknown')).toBe('unknown');
  });
});
