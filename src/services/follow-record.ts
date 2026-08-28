/**
 * 学员跟进记录 Service 层
 */
import type { FollowRecord } from '@/types/follow-record';
import { loadFollowRecordsMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';

export const followRecordService = {
  /** 根据学员 ID 获取跟进记录列表 */
  getByStudent: async (studentId: string): Promise<FollowRecord[]> => {
        if (!isUseMock()) {
      // TODO: real API
    }
    const { mockGetFollowRecordsByStudent } = await loadFollowRecordsMock();
    return mockGetFollowRecordsByStudent(studentId);
  },

  /** 创建学员跟进记录 */
  create: async (data: Omit<FollowRecord, 'id' | 'createdAt'>): Promise<FollowRecord> => {
        if (!isUseMock()) {
      // TODO: real API
    }
    const { mockCreateFollowRecord } = await loadFollowRecordsMock();
    return mockCreateFollowRecord(data);
  },

  /** 更新学员跟进记录 */
  update: async (
    id: string,
    data: Partial<Pick<FollowRecord, 'content' | 'operatorName'>>,
  ): Promise<FollowRecord> => {
        if (!isUseMock()) {
      // TODO: real API
    }
    const { mockUpdateFollowRecord } = await loadFollowRecordsMock();
    return mockUpdateFollowRecord(id, data);
  },

  /** 删除学员跟进记录 */
  delete: async (id: string): Promise<void> => {
        if (!isUseMock()) {
      // TODO: real API
    }
    const { mockDeleteFollowRecord } = await loadFollowRecordsMock();
    return mockDeleteFollowRecord(id);
  },
};
