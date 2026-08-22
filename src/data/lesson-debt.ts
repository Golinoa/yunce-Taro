/**
 * 欠课记录 Mock 数据层（P1 欠课机制）
 *
 * 提供：按学员查未结欠课 / 记欠课 / 结算欠课（划扣 deduct / 平账 waive）
 * 存储：本地 storage（mock 阶段），联调落后端「欠课台账」表。
 */
import Taro from '@tarojs/taro';
import { LESSON_DEBT_STORAGE_KEY, type LessonDebt } from '@/types/lesson-debt';

function load(): LessonDebt[] {
  try {
    const raw = Taro.getStorageSync(LESSON_DEBT_STORAGE_KEY);
    return Array.isArray(raw) ? (raw as LessonDebt[]) : [];
  } catch {
    return [];
  }
}

function persist(list: LessonDebt[]): void {
  try {
    Taro.setStorageSync(LESSON_DEBT_STORAGE_KEY, list);
  } catch {
    // ignore
  }
}

let _debts: LessonDebt[] = load();

/** 查某学员未结清欠课（同步，供页面/数据层直接消费） */
export function getPendingDebtsByStudent(studentId: string): LessonDebt[] {
  return _debts.filter((d) => d.studentId === studentId && d.status === 'pending');
}

/** 查某学员未结欠课合计课时 */
export function getPendingDebtHours(studentId: string): number {
  return getPendingDebtsByStudent(studentId).reduce((sum, d) => sum + d.hours, 0);
}

/** 记一笔欠课（欠课上课时调用） */
export function addDebt(params: {
  studentId: string;
  subjectId?: string;
  subjectName?: string;
  hours: number;
  sourceRecordId?: string;
}): LessonDebt {
  const debt: LessonDebt = {
    id: `debt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    studentId: params.studentId,
    subjectId: params.subjectId,
    subjectName: params.subjectName,
    hours: Math.max(Number(params.hours) || 0, 0),
    sourceRecordId: params.sourceRecordId,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  _debts = [..._debts, debt];
  persist(_debts);
  return debt;
}

/**
 * 结算某学员的欠课。
 * @param type deduct=划扣抵扣 / waive=平账豁免
 * @param maxSettleHours deduct 时的抵扣额度（如新充值课时数）；缺省=全额结清
 * @returns 本次结清课时 + 剩余未结欠课课时
 */
export function settleDebts(
  studentId: string,
  type: 'deduct' | 'waive',
  maxSettleHours?: number,
): { settledHours: number; remainingDebtHours: number } {
  const pending = getPendingDebtsByStudent(studentId);
  if (pending.length === 0) return { settledHours: 0, remainingDebtHours: 0 };

  const now = new Date().toISOString();

  // 平账豁免：全部结清
  if (type === 'waive') {
    const settledHours = pending.reduce((sum, d) => sum + d.hours, 0);
    _debts = _debts.map((d) =>
      d.studentId === studentId && d.status === 'pending'
        ? { ...d, status: 'settled' as const, settledType: 'waive' as const, settledAt: now }
        : d,
    );
    persist(_debts);
    return { settledHours, remainingDebtHours: 0 };
  }

  // 划扣抵扣：按抵扣额度逐笔扣（欠课可能只抵一部分，剩余保留 pending）
  let budget =
    maxSettleHours === undefined ? Number.POSITIVE_INFINITY : Math.max(maxSettleHours, 0);
  let settledHours = 0;
  _debts = _debts.map((d) => {
    if (d.studentId !== studentId || d.status !== 'pending') return d;
    if (budget <= 0) return d;
    const take = Math.min(d.hours, budget);
    settledHours += take;
    budget -= take;
    const rest = d.hours - take;
    return rest <= 0
      ? { ...d, status: 'settled' as const, settledType: 'deduct' as const, settledAt: now }
      : { ...d, hours: rest };
  });
  persist(_debts);
  return { settledHours, remainingDebtHours: getPendingDebtHours(studentId) };
}
