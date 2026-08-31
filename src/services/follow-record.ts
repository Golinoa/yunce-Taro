/**
 * 学员跟进记录 Service 层
 */
import type { FollowRecord } from '@/types/follow-record';

export const followRecordService = {
  /** 根据学员 ID 获取跟进记录列表 */
  getByStudent: async (_studentId: string): Promise<FollowRecord[]> => {
    throw new Error('跟进记录 API 暂未接通');
  },

  /** 创建学员跟进记录 */
  create: async (_data: Omit<FollowRecord, 'id' | 'createdAt'>): Promise<FollowRecord> => {
    throw new Error('跟进记录 API 暂未接通');
  },

  /** 更新学员跟进记录 */
  update: async (
    _id: string,
    _data: Partial<Pick<FollowRecord, 'content' | 'operatorName'>>,
  ): Promise<FollowRecord> => {
    throw new Error('跟进记录 API 暂未接通');
  },

  /** 删除学员跟进记录 */
  delete: async (_id: string): Promise<void> => {
    throw new Error('跟进记录 API 暂未接通');
  },
};
