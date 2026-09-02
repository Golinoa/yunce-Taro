/**
 * 课表危险操作弹窗文案（Q2-1）
 */
export type ScheduleDangerActionType = 'cancel' | 'delete' | 'batch-delete';

export type DangerActionMeta = {
  title: string;
  confirmText: string;
  tone: 'danger' | 'warning';
  description: string;
};

export function buildDangerActionMeta(input: {
  type: ScheduleDangerActionType | null;
  item?: { className: string; startTime: string; endTime: string } | null;
  lessonDate: string;
  batchCount: number;
}): DangerActionMeta | null {
  if (!input.type) return null;

  if (input.type === 'batch-delete') {
    return {
      title: '删除提示',
      confirmText: '确认删除',
      tone: 'danger',
      description: `确认删除所选 ${input.batchCount} 个班级吗？删除后会向相关学员发送班级解散通知。`,
    };
  }

  if (!input.item) return null;

  if (input.type === 'cancel') {
    return {
      title: '取消开课提醒',
      confirmText: '确认取消开课',
      tone: 'warning',
      description: `是否确定取消【${input.item.className}】${input.lessonDate} ${input.item.startTime}-${input.item.endTime}的课，取消后不可恢复并自动发送取消开课提醒给学员`,
    };
  }

  return {
    title: '删除提示',
    confirmText: '确认删除',
    tone: 'danger',
    description: '确认要批量删除所选课节吗，删除后将不能恢复?',
  };
}

export function buildRestoreLessonConfirmContent(input: {
  className: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
}): { title: string; content: string; confirmText: string } {
  return {
    title: '恢复开课',
    content: `确定恢复【${input.className}】${input.lessonDate} ${input.startTime}-${input.endTime} 的课程吗？`,
    confirmText: '恢复',
  };
}

export function buildSuspendLessonConfirmContent(input: {
  className: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
}): { title: string; content: string; confirmText: string } {
  return {
    title: '停课确认',
    content: `确定停课【${input.className}】${input.lessonDate} ${input.startTime}-${input.endTime}？停课后本节课临时取消，将向学员家长发送站内通知与订阅消息。`,
    confirmText: '确认停课',
  };
}

export function buildSuspendOpenSlotConfirmContent(input: {
  displayName: string;
  changeTime: string;
}): { title: string; content: string; confirmText: string } {
  return {
    title: '停课确认',
    content: `确定停课【${input.displayName}】${input.changeTime}？停课后本节开放时段临时取消，将向已约学员家长发送站内通知与订阅消息。`,
    confirmText: '确认停课',
  };
}

export function buildResumeClassConfirmContent(className: string): {
  title: string;
  content: string;
  confirmText: string;
} {
  return {
    title: '恢复上课',
    content: `确定恢复【${className}】上课？恢复后课表将重新展示该班排课/开放时段。`,
    confirmText: '恢复上课',
  };
}

export function buildSuspendNotifyCopy(input: {
  className: string;
  changeTime: string;
}): { title: string; content: string; changeReason: string } {
  return {
    title: `${input.className}停课通知`,
    content: `${input.changeTime} 的课程已临时停课取消，请留意老师后续安排。`,
    changeReason: '本节课临时停课',
  };
}

export function buildCancelLessonNotifyCopy(input: {
  className: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
}): { title: string; content: string } {
  return {
    title: `${input.className}已取消`,
    content: `${input.lessonDate} ${input.startTime}-${input.endTime} 的课程已取消`,
  };
}

export function buildCancelLessonRecordContent(input: {
  className: string;
  startTime: string;
  endTime: string;
}): string {
  return `取消开课：${input.className} ${input.startTime}-${input.endTime}`;
}

export function buildSuspendLessonRecordContent(input: {
  className: string;
  startTime: string;
  endTime: string;
}): string {
  return `停课：${input.className} ${input.startTime}-${input.endTime}`;
}

export function buildDissolveClassNotifyContent(className: string): {
  title: string;
  content: string;
} {
  return {
    title: '班级解散通知',
    content: `您所在的「${className}」已解散，请留意老师后续安排。`,
  };
}

export function formatLessonChangeTime(input: {
  lessonDate: string;
  startTime: string;
  endTime: string;
}): string {
  return `${input.lessonDate} ${input.startTime}-${input.endTime}`;
}
