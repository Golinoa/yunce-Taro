/**
 * 学员跟进记录 Mock 数据
 */
import type { FollowRecord } from '@/types/follow-record';

const MOCK_FOLLOW_RECORDS: FollowRecord[] = [
  {
    id: 'fr-001',
    studentId: 'stu-001',
    content: '约课',
    operatorName: '李老师',
    createdAt: '2026-07-05 12:23',
  },
  {
    id: 'fr-002',
    studentId: 'stu-001',
    content: '家长沟通，确认下周上课时间',
    operatorName: '王老师',
    createdAt: '2026-07-03 15:40',
  },
  {
    id: 'fr-003',
    studentId: 'stu-002',
    content: '续费意向跟进',
    operatorName: '张老师',
    createdAt: '2026-07-04 10:15',
  },
  {
    id: 'fr-004',
    studentId: 'stu-003',
    content: '请假原因确认',
    operatorName: '李老师',
    createdAt: '2026-07-02 09:30',
  },
  {
    id: 'fr-005',
    studentId: 'stu-004',
    content: '生日祝福发送',
    operatorName: '前台小张',
    createdAt: '2026-07-01 18:00',
  },
];

/**
 * 根据学员 ID 查询跟进记录
 */
export const mockGetFollowRecordsByStudent = async (studentId: string): Promise<FollowRecord[]> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return MOCK_FOLLOW_RECORDS.filter((item) => item.studentId === studentId).sort((a, b) =>
    a.createdAt > b.createdAt ? -1 : 1,
  );
};

/**
 * 创建学员跟进记录
 */
export const mockCreateFollowRecord = async (
  data: Omit<FollowRecord, 'id' | 'createdAt'>,
): Promise<FollowRecord> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const record: FollowRecord = {
    ...data,
    id: `fr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
  };
  MOCK_FOLLOW_RECORDS.unshift(record);
  return record;
};

/**
 * 更新学员跟进记录
 */
export const mockUpdateFollowRecord = async (
  id: string,
  data: Partial<Pick<FollowRecord, 'content' | 'operatorName'>>,
): Promise<FollowRecord> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const index = MOCK_FOLLOW_RECORDS.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error('跟进记录不存在');
  }
  const updated: FollowRecord = {
    ...MOCK_FOLLOW_RECORDS[index],
    ...data,
  };
  MOCK_FOLLOW_RECORDS[index] = updated;
  return updated;
};

/**
 * 删除学员跟进记录
 */
export const mockDeleteFollowRecord = async (id: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const index = MOCK_FOLLOW_RECORDS.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error('跟进记录不存在');
  }
  MOCK_FOLLOW_RECORDS.splice(index, 1);
};
