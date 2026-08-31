/** DatePickerSheet 年份/月日列（函数产出，避免模块级可变常量导致打包撞名） */
import dayjs from 'dayjs';

export const DATE_PICKER_YEAR_START = 1950;

export function getDatePickerYearEnd(): number {
  return dayjs().year() + 15;
}

export function getDatePickerYears(): string[] {
  const end = getDatePickerYearEnd();
  return Array.from({ length: end - DATE_PICKER_YEAR_START + 1 }, (_, i) =>
    String(DATE_PICKER_YEAR_START + i),
  );
}

export function getDatePickerMonths(): string[] {
  return Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
}

export function getDatePickerDays(): string[] {
  return Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
}

export function datePickerYearIndex(year: number, years: string[]): number {
  return Math.max(0, Math.min(years.length - 1, year - DATE_PICKER_YEAR_START));
}
