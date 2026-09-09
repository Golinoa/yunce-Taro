import Taro from '@tarojs/taro';
import { get, put } from '@/utils/request';

export type TeacherBookingStatus = 'open' | 'rest' | 'unset';

export interface TeacherBookingTimeSlot {
  id: string;
  startTime: string;
  endTime: string;
}

export interface TeacherBookingConfig {
  teacherId: string;
  teacherName: string;
  subject: string;
  campusId: string;
  campusName: string;
  status: TeacherBookingStatus;
  availableWeekdays: number[];
  timeSlots: TeacherBookingTimeSlot[];
  advanceDays: number;
  capacityPerSlot: number;
  /** 每周重复：开启后当前时段配置按周自动重复，无需频繁配置 */
  weeklyRepeat: boolean;
  notes: string;
  updatedAt: string;
}

const STORAGE_KEY = 'yunce:booking:one-on-one-configs';
const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function createTeacherBookingConfig(params: {
  teacherId: string;
  teacherName: string;
  subject?: string;
  campusId?: string;
  campusName?: string;
  status?: TeacherBookingStatus;
}): TeacherBookingConfig {
  return {
    teacherId: params.teacherId,
    teacherName: params.teacherName,
    subject: params.subject || '未配置课程',
    campusId: params.campusId || '',
    campusName: params.campusName || '未分配校区',
    status: params.status || 'unset',
    availableWeekdays: [1, 3, 5],
    timeSlots: [
      {
        id: `${params.teacherId}-0900`,
        startTime: '09:00',
        endTime: '10:00',
      },
      {
        id: `${params.teacherId}-1930`,
        startTime: '19:30',
        endTime: '20:30',
      },
    ],
    advanceDays: 14,
    capacityPerSlot: 1,
    weeklyRepeat: false,
    notes: '',
    updatedAt: new Date().toISOString(),
  };
}

export function readTeacherBookingConfigs(): Record<string, TeacherBookingConfig> {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (!raw || typeof raw !== 'object') {
      return {};
    }
    return raw as Record<string, TeacherBookingConfig>;
  } catch {
    return {};
  }
}

export function writeTeacherBookingConfigs(configs: Record<string, TeacherBookingConfig>) {
  Taro.setStorageSync(STORAGE_KEY, configs);
}

export function readTeacherBookingConfig(teacherId: string): TeacherBookingConfig | null {
  const configs = readTeacherBookingConfigs();
  return configs[teacherId] || null;
}

export function writeTeacherBookingConfig(config: TeacherBookingConfig) {
  const configs = readTeacherBookingConfigs();
  configs[config.teacherId] = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  writeTeacherBookingConfigs(configs);
  void put(
    `/booking-config/teachers/${config.teacherId}`,
    config as unknown as Record<string, unknown>,
  ).catch(() => undefined);
}

export async function fetchTeacherBookingConfig(
  teacherId: string,
): Promise<TeacherBookingConfig | null> {
  const config = await get<TeacherBookingConfig | null>(`/booking-config/teachers/${teacherId}`);
  if (config) writeTeacherBookingConfig(config);
  return config;
}

export async function saveTeacherBookingConfig(
  config: TeacherBookingConfig,
): Promise<TeacherBookingConfig> {
  const saved = await put<TeacherBookingConfig>(
    `/booking-config/teachers/${config.teacherId}`,
    config as unknown as Record<string, unknown>,
  );
  writeTeacherBookingConfig(saved);
  return saved;
}

export function getTeacherBookingWeekdaySummary(weekdays: number[]): string {
  if (weekdays.length === 0) {
    return '未设置开放日';
  }
  return weekdays
    .slice()
    .sort((left, right) => left - right)
    .map((weekday) => WEEKDAY_LABELS[weekday - 1] || '')
    .filter(Boolean)
    .join('、');
}

export function getTeacherBookingNextSlotSummary(config: TeacherBookingConfig | null): string {
  if (!config || config.status !== 'open' || config.timeSlots.length === 0) {
    return '暂无可预约时段';
  }

  const firstSlot = [...config.timeSlots].sort((left, right) =>
    `${left.startTime}-${left.endTime}`.localeCompare(`${right.startTime}-${right.endTime}`),
  )[0];

  return `${getTeacherBookingWeekdaySummary(config.availableWeekdays)} ${firstSlot.startTime}-${firstSlot.endTime}`;
}
