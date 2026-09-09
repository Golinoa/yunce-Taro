import type { TeacherBookingConfig } from '@/utils/booking-one-on-one';
import type { BookingRuleState } from '@/utils/booking-rules';
import { get, put } from '@/utils/request';

export const bookingConfigService = {
  getRules: (campusId?: string) =>
    get<BookingRuleState>('/booking-config/rules', campusId ? { campusId } : undefined),
  saveRules: (rules: BookingRuleState, campusId?: string) =>
    put<BookingRuleState>(
      '/booking-config/rules' + (campusId ? `?campusId=${encodeURIComponent(campusId)}` : ''),
      rules as unknown as Record<string, unknown>,
    ),
  getTeacher: (teacherId: string) =>
    get<TeacherBookingConfig | null>(`/booking-config/teachers/${teacherId}`),
  saveTeacher: (config: TeacherBookingConfig) =>
    put<TeacherBookingConfig>(
      `/booking-config/teachers/${config.teacherId}`,
      config as unknown as Record<string, unknown>,
    ),
  getVenue: () => get<{ enabled: boolean }>('/booking-config/venue'),
  saveVenue: (enabled: boolean) => put<{ enabled: boolean }>('/booking-config/venue', { enabled }),
};
