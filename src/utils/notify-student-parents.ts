/**
 * 消课后通知学员家长（失败不抛，避免阻断已成功的消课）
 */
import { notificationService, studentService } from '@/services';
import { logError } from '@/utils/logger';

export async function notifyStudentParentsSafe(params: {
  studentId: string;
  senderId: string;
  title: string;
  content: string;
  logLabel?: string;
}): Promise<void> {
  const { studentId, senderId, title, content, logLabel = 'notifyStudentParentsSafe' } = params;
  try {
    const parents = await studentService.getParents(studentId);
    for (const binding of parents) {
      if (!binding.parent_id) continue;
      await notificationService.send({
        sender_id: senderId,
        receiver_id: binding.parent_id,
        title,
        content,
        related_id: studentId,
      });
    }
  } catch (err) {
    logError(logLabel, err);
  }
}
