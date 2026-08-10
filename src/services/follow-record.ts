/**
 * 学员跟进记录 Service 层
 */
import {
  mockCreateFollowRecord,
  mockDeleteFollowRecord,
  mockGetFollowRecordsByStudent,
  mockUpdateFollowRecord,
} from '@/data/follow-records';
import type { FollowRecord } from '@/types/follow-record';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const followRecordService = {
  /** 根据学员 ID 获取跟进记录列表 */
  getByStudent: async (studentId: string): Promise<FollowRecord[]> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await get<FollowRecord[]>(`/students/${studentId}/follow-records`);
    }
    return mockGetFollowRecordsByStudent(studentId);
  },

  /** 创建学员跟进记录 */
  create: async (data: Omit<FollowRecord, 'id' | 'createdAt'>): Promise<FollowRecord> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await post<FollowRecord>('/follow-records', data);
    }
    return mockCreateFollowRecord(data);
  },

  /** 更新学员跟进记录 */
  update: async (
    id: string,
    data: Partial<Pick<FollowRecord, 'content' | 'operatorName'>>,
  ): Promise<FollowRecord> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await put<FollowRecord>(`/follow-records/${id}`, data);
    }
    return mockUpdateFollowRecord(id, data);
  },

  /** 删除学员跟进记录 */
  delete: async (id: string): Promise<void> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await del<void>(`/follow-records/${id}`);
    }
    return mockDeleteFollowRecord(id);
  },
};
