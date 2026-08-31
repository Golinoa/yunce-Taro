/**
 * 分期计划纯函数（与 UI 解耦，便于单测；避免从 InstallmentPanel 入口拉 React/Taro）
 */
import dayjs from 'dayjs';

export interface ScheduleItem {
  period: number;
  amount: string;
  date: string;
  reminder: boolean;
}

export function getPeriodOptions(): Array<{ label: string; value: string }> {
  return [
    { label: '2期', value: '2' },
    { label: '3期', value: '3' },
    { label: '6期', value: '6' },
    { label: '12期', value: '12' },
  ];
}

/** 生成分期计划：金额均分，日期从今天起每期 +1 个月 */
export function buildInstallmentSchedule(totalAmount: number, count: number): ScheduleItem[] {
  const total = Math.max(0, totalAmount);
  const safeCount = Math.max(1, count);
  const perPeriod = total > 0 ? Math.floor((total / safeCount) * 100) / 100 : 0;
  const lastAmount = total > 0 ? Math.round((total - perPeriod * (safeCount - 1)) * 100) / 100 : 0;
  const base = dayjs().startOf('day');
  const items: ScheduleItem[] = [];
  for (let i = 0; i < safeCount; i += 1) {
    items.push({
      period: i + 1,
      amount: i === safeCount - 1 ? String(lastAmount) : String(perPeriod),
      date: base.add(i, 'month').format('YYYY-MM-DD'),
      reminder: false,
    });
  }
  return items;
}
