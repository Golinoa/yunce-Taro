/**
 * 通知类型
 */
export type NotificationType =
  | 'lesson_complete' // 消课通知
  | 'leave_request' // 请假申请
  | 'leave_response' // 请假审批结果
  | 'schedule_change' // 排课变更
  | 'general'; // 通用通知

/**
 * 通知信息 (notifications 表)
 */
export interface Notification {
  id: string;
  sender_id: string;
  receiver_id: string;
  type: NotificationType;
  title: string;
  content?: string;
  is_read: boolean;
  related_id?: string;
  created_at: string;
  // 关联查询字段
  sender?: {
    name: string;
  };
}
