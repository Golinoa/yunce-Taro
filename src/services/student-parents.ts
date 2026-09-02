/**
 * 学员家长绑定 Service / 映射（Q2-4，从 student.ts 抽出）
 */
import type { StudentParent } from '@/types/student';
import { del, get, post } from '@/utils/request';

export interface BackendStudentParentItem {
  id: string;
  profileId?: string | null;
  userId?: string | null;
  relation?: string | null;
  bindStatus?: string | null;
  createdAt?: string;
  profile?: {
    nickname?: string | null;
    phone?: string | null;
    avatar?: string | null;
  } | null;
}

export function mapBackendStudentParent(
  studentId: string,
  item: BackendStudentParentItem,
): StudentParent {
  const profileId = item.profileId || '';
  return {
    id: item.id,
    student_id: studentId,
    /** 通知 receiverId = profileId */
    parent_id: profileId,
    parent: item.profile
      ? {
          id: profileId,
          name: item.profile.nickname || '家长',
          phone: item.profile.phone || undefined,
          avatar_url: item.profile.avatar || undefined,
        }
      : undefined,
    created_at: item.createdAt || '',
  };
}

export const studentParentService = {
  getParents: async (studentId: string): Promise<StudentParent[]> => {
    const list = await get<BackendStudentParentItem[]>(`/students/${studentId}/parents`);
    return (list || []).map((item) => mapBackendStudentParent(studentId, item));
  },

  removeParent: async (studentId: string, bindingId: string) => {
    await del(`/students/${studentId}/parents/${bindingId}`);
  },

  findByInviteCode: async (code: string) => {
    return get<{
      id: string;
      name: string;
      avatar?: string | null;
      nickname?: string | null;
      teacher?: {
        id: string;
        nickname?: string | null;
        avatar?: string | null;
        institution?: string | null;
      };
    }>(`/students/by-invite-code/${encodeURIComponent(code)}`);
  },

  /**
   * 绑定家长到学员（后端按手机号绑定）
   * @deprecated 业务侧请使用 parent-invite-links
   */
  bindParent: async (studentId: string, phone: string, relation = '家长') => {
    return post(`/students/${studentId}/bind-parent`, { phone, relation });
  },
};
