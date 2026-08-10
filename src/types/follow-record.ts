/**
 * 学员跟进记录类型
 */
export interface FollowRecord {
  id: string;
  /** 学员 ID */
  studentId: string;
  /** 跟进内容 */
  content: string;
  /** 操作人名称 */
  operatorName?: string;
  /** 跟进时间 */
  createdAt: string;
}
