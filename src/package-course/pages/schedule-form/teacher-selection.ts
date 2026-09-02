/**
 * 排课表单教师选择解析（Q2-3）
 */
import type { Class } from '@/types/class';
import type { TeacherUIModel } from '@/types/teacher';

export function getTeacherSelectionInfo(params: {
  classInfo: Class | null;
  teacherById: Record<string, TeacherUIModel>;
  fallbackTeacherId?: string;
  fallbackTeacherName?: string;
  fallbackAssistantTeacherId?: string;
  fallbackAssistantTeacherName?: string;
}) {
  const {
    classInfo,
    teacherById,
    fallbackTeacherId,
    fallbackTeacherName,
    fallbackAssistantTeacherId,
    fallbackAssistantTeacherName,
  } = params;
  const tIds = classInfo?.teachers?.length
    ? classInfo.teachers
    : classInfo?.teacher_id
      ? [classInfo.teacher_id]
      : [];
  const teachers = tIds.map((id) => teacherById[id]).filter(Boolean) as TeacherUIModel[];
  const lead =
    teachers.find((t) => t.role !== 'assist') ||
    (classInfo?.teacher_id ? teacherById[classInfo.teacher_id] : undefined) ||
    (fallbackTeacherId ? teacherById[fallbackTeacherId] : undefined);
  const assist =
    teachers.find((t) => t.role === 'assist' && t.id !== lead?.id) ||
    (fallbackAssistantTeacherId ? teacherById[fallbackAssistantTeacherId] : undefined);
  return {
    leadTeacherId: lead?.id || fallbackTeacherId || '',
    leadTeacherName: lead?.name || fallbackTeacherName || '待分配',
    assistantTeacherId: assist?.id || fallbackAssistantTeacherId || '',
    assistantTeacherName: assist?.name || fallbackAssistantTeacherName || '未安排',
  };
}
