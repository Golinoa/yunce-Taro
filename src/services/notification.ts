/**
 * 通知 Service（Q2-4，从 student.ts 抽出）
 */
import type { Notification, NotificationType } from '@/types/notification';
import type { PaginatedResponse } from '@/utils/pagination';
import { API_PAGE_SIZE_BATCH, asPaginatedResponse, fetchAllPages } from '@/utils/pagination';
import { get, post, put } from '@/utils/request';

interface BackendNotificationItem {
  content?: null | string;
  createdAt: string;
  id: string;
  read: boolean;
  senderName?: null | string;
  title: string;
  type: 'SYSTEM' | 'LEAVE' | 'SCHEDULE' | 'CHECKIN' | 'HOMEWORK';
}

interface BackendNotificationListResponse {
  list: BackendNotificationItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

function mapBackendNotificationType(
  notification: Pick<BackendNotificationItem, 'type' | 'title'>,
): NotificationType {
  switch (notification.type) {
    case 'LEAVE':
      return /审批|结果|回复/.test(notification.title) ? 'leave_response' : 'leave_request';
    case 'SCHEDULE':
      return 'schedule_change';
    case 'CHECKIN':
      return 'lesson_complete';
    default:
      return 'general';
  }
}

function mapBackendNotification(notification: BackendNotificationItem): Notification {
  return {
    id: notification.id,
    sender_id: '',
    receiver_id: '',
    type: mapBackendNotificationType(notification),
    title: notification.title,
    content: notification.content || undefined,
    is_read: notification.read,
    created_at: notification.createdAt,
    sender: notification.senderName ? { name: notification.senderName } : undefined,
  };
}

function mapFrontendNotificationType(
  type?: NotificationType,
  title?: string,
): 'SYSTEM' | 'LEAVE' | 'SCHEDULE' | 'CHECKIN' | 'HOMEWORK' {
  switch (type) {
    case 'leave_request':
    case 'leave_response':
      return 'LEAVE';
    case 'schedule_change':
      return 'SCHEDULE';
    case 'lesson_complete':
      return 'CHECKIN';
    case 'general':
      return /作业/.test(title || '') ? 'HOMEWORK' : 'SYSTEM';
    default:
      return /请假/.test(title || '')
        ? 'LEAVE'
        : /排课|课表/.test(title || '')
          ? 'SCHEDULE'
          : /上课|消课|核销/.test(title || '')
            ? 'CHECKIN'
            : /作业/.test(title || '')
              ? 'HOMEWORK'
              : 'SYSTEM';
  }
}

export const notificationService = {
  /** 收件箱（分批拉全；列表页后续可改 usePagedQuery） */
  getByReceiver: async (_receiverId: string): Promise<Notification[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const data = await get<BackendNotificationListResponse>(
        `/notifications?${params.toString()}`,
      );
      return asPaginatedResponse(data, page, pageSize);
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendNotification);
  },
  markAsRead: async (notificationId: string) => {
    await put(`/notifications/${notificationId}/read`, {});
    return;
  },
  markAllAsRead: async (_receiverId: string) => {
    await put('/notifications/read-all', {});
    return;
  },
  send: async (data: {
    sender_id: string;
    receiver_id?: string;
    receiver_ids?: string[];
    title: string;
    content: string;
    related_id?: string;
    type?: NotificationType;
  }): Promise<Notification> => {
    const receiverIds = data.receiver_ids || (data.receiver_id ? [data.receiver_id] : []);
    const filteredReceiverIds = receiverIds.filter(Boolean);
    if (filteredReceiverIds.length === 0) {
      throw new Error('缺少通知接收者');
    }

    await post('/notifications', {
      receiverIds: filteredReceiverIds,
      type: mapFrontendNotificationType(data.type, data.title),
      title: data.title,
      content: data.content,
    });

    return {
      id: '',
      sender_id: data.sender_id,
      receiver_id: filteredReceiverIds[0],
      type:
        data.type ||
        mapBackendNotificationType({
          type: mapFrontendNotificationType(data.type, data.title),
          title: data.title,
        }),
      title: data.title,
      content: data.content,
      related_id: data.related_id,
      is_read: false,
      created_at: new Date().toISOString(),
    };
  },
};

/** 供单测复用 */
export const __notificationMappersForTest = {
  mapBackendNotificationType,
  mapFrontendNotificationType,
  mapBackendNotification,
};
