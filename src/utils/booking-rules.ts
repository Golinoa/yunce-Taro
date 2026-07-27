import Taro from '@tarojs/taro';

export interface BookingRuleState {
  parentVisible: boolean;
  waitlistEnabled: boolean;
  waitlistLimit: number;
  cancelEnabled: boolean;
  cancelDeadlineHours: number;
  bookingDeadlineEnabled: boolean;
  bookingDeadlineMinutes: number;
  dailyLimitEnabled: boolean;
  dailyLimit: number;
  campusOnly: boolean;
}

export const BOOKING_RULE_STORAGE_KEY = 'yunce:booking-rule-settings';
export const WAITLIST_LIMIT_OPTIONS = [3, 5, 8, 10];
export const CANCEL_DEADLINE_OPTIONS = [2, 6, 12, 24];
export const BOOKING_DEADLINE_OPTIONS = [30, 60, 120, 180];
export const DAILY_LIMIT_OPTIONS = [1, 2, 3, 5];

export const DEFAULT_BOOKING_RULES: BookingRuleState = {
  parentVisible: true,
  waitlistEnabled: true,
  waitlistLimit: 5,
  cancelEnabled: true,
  cancelDeadlineHours: 12,
  bookingDeadlineEnabled: true,
  bookingDeadlineMinutes: 120,
  dailyLimitEnabled: true,
  dailyLimit: 2,
  campusOnly: true,
};

export function readBookingRules(): BookingRuleState {
  try {
    const raw = Taro.getStorageSync(BOOKING_RULE_STORAGE_KEY);
    if (!raw || typeof raw !== 'object') {
      return DEFAULT_BOOKING_RULES;
    }

    return {
      ...DEFAULT_BOOKING_RULES,
      ...(raw as Partial<BookingRuleState>),
    };
  } catch {
    return DEFAULT_BOOKING_RULES;
  }
}

export function writeBookingRules(rules: BookingRuleState) {
  Taro.setStorageSync(BOOKING_RULE_STORAGE_KEY, rules);
}

export function formatBookingDeadline(minutes: number): string {
  if (minutes >= 60) {
    return `开课前 ${minutes / 60} 小时`;
  }
  return `开课前 ${minutes} 分钟`;
}

export function getBookingRuleSummaryList(rules: BookingRuleState): string[] {
  const summaryList: string[] = [];

  if (rules.bookingDeadlineEnabled) {
    summaryList.push(`${formatBookingDeadline(rules.bookingDeadlineMinutes)}截止`);
  }
  if (rules.waitlistEnabled) {
    summaryList.push(`支持候补${rules.waitlistLimit}人`);
  }
  if (rules.dailyLimitEnabled) {
    summaryList.push(`每天限约${rules.dailyLimit}节`);
  }
  if (rules.campusOnly) {
    summaryList.push('仅限本校区');
  }

  return summaryList;
}
