import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services', () => ({
  studentService: {
    getParents: vi.fn(),
  },
  notificationService: {
    send: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logError: vi.fn(),
}));

describe('notifyStudentParentsSafe (Q2-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('向有 parent_id 的绑定发送通知', async () => {
    const { studentService, notificationService } = await import('@/services');
    vi.mocked(studentService.getParents).mockResolvedValueOnce([
      { id: 'b1', student_id: 's1', parent_id: 'p1', created_at: '' },
      { id: 'b2', student_id: 's1', parent_id: '', created_at: '' },
    ]);
    const { notifyStudentParentsSafe } = await import('./notify-student-parents');
    await notifyStudentParentsSafe({
      studentId: 's1',
      senderId: 'teacher-1',
      title: '消课',
      content: 'ok',
    });
    expect(notificationService.send).toHaveBeenCalledTimes(1);
    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ receiver_id: 'p1', title: '消课' }),
    );
  });

  it('getParents 失败不抛出', async () => {
    const { studentService } = await import('@/services');
    const { logError } = await import('@/utils/logger');
    vi.mocked(studentService.getParents).mockRejectedValueOnce(new Error('boom'));
    const { notifyStudentParentsSafe } = await import('./notify-student-parents');
    await expect(
      notifyStudentParentsSafe({
        studentId: 's1',
        senderId: 't1',
        title: 't',
        content: 'c',
      }),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalled();
  });
});
