/** 学员跟进记录 Service：对接后端 /follow-records 契约。 */
import type { FollowRecord } from '@/types/follow-record';
import { formatApiDateTime } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

type BackendFollowRecord = Record<string, unknown>;

function mapFollowRecord(raw: BackendFollowRecord): FollowRecord {
  return {
    id: String(raw.id ?? ''),
    studentId: String(raw.studentId ?? ''),
    content: String(raw.content ?? ''),
    operatorName: raw.operatorName ? String(raw.operatorName) : undefined,
    createdAt: formatApiDateTime(raw.createdAt),
  };
}

export const followRecordService = {
  /** 根据学员 ID 获取跟进记录列表；后端同时执行学员所属机构校验。 */
  getByStudent: async (studentId: string): Promise<FollowRecord[]> => {
    const data = await get<BackendFollowRecord[]>(`/students/${studentId}/follow-records`);
    return (Array.isArray(data) ? data : []).map(mapFollowRecord);
  },

  /** 创建跟进记录，操作人由后端认证上下文确定。 */
  create: async (data: Omit<FollowRecord, 'id' | 'createdAt'>): Promise<FollowRecord> => {
    const raw = await post<BackendFollowRecord>('/follow-records', {
      studentId: data.studentId,
      content: data.content,
    });
    return mapFollowRecord(raw);
  },

  /** 更新跟进记录；仅发送后端 validator 支持的字段。 */
  update: async (
    id: string,
    data: Partial<Pick<FollowRecord, 'content' | 'operatorName'>>,
  ): Promise<FollowRecord> => {
    const raw = await put<BackendFollowRecord>(`/follow-records/${id}`, {
      ...(data.content !== undefined ? { content: data.content } : {}),
    });
    return mapFollowRecord(raw);
  },

  delete: async (id: string): Promise<void> => {
    await del(`/follow-records/${id}`);
  },
};
