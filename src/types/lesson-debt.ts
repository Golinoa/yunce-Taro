/**
 * 欠课记录类型（P1 欠课机制）
 *
 * 业务口径（用户 2026-08-22）：
 * - 上课时该科目课包课时不足 → 老师可选「欠课上课」或「划扣其他课包」
 * - 欠课上课：课时照上，欠下的课时记入欠课账（本类型）
 * - 再次充值时 → 老师选「划扣」（新课时先抵欠课）或「平账」（欠课豁免，UI 提醒并选择）
 */
export interface LessonDebt {
  id: string;
  studentId: string;
  /** 欠课所属科目 */
  subjectId?: string;
  subjectName?: string;
  /** 欠课时（>0） */
  hours: number;
  /** 产生欠课的消课记录 id */
  sourceRecordId?: string;
  createdAt: string;
  status: 'pending' | 'settled';
  /** 结算方式：deduct=划扣抵扣 / waive=平账豁免 */
  settledType?: 'deduct' | 'waive';
  settledAt?: string;
}

/** 欠课存储 key（mock 阶段本地持久化，联调落后端） */
export const LESSON_DEBT_STORAGE_KEY = 'yunce-lesson-debts';
