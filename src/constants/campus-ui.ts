import type { CampusType, PartnerMode } from '@/types/campus';

/** 默认场地负责人 userId（真实环境由后端返回，此处仅作表单占位） */
export const DEFAULT_VENUE_MANAGER_USER_ID = 'user-principal-001';

export const CAMPUS_ICONS = [
  { icon: '🏢', gradient: 'linear-gradient(135deg, hsl(168 55% 58%), hsl(168 55% 75%))' },
  { icon: '🏫', gradient: 'linear-gradient(135deg, hsl(200 55% 65%), hsl(200 55% 80%))' },
  { icon: '🎓', gradient: 'linear-gradient(135deg, hsl(340 60% 78%), hsl(340 60% 88%))' },
  { icon: '🎨', gradient: 'linear-gradient(135deg, hsl(27 87% 67%), hsl(27 87% 82%))' },
] as const;

export const CAMPUS_TYPE_MAP: Record<
  CampusType,
  { label: string; tagBg: string; tagText: string; dotColor: string }
> = {
  main: {
    label: '总校区',
    tagBg: 'bg-primary-bg',
    tagText: 'text-primary',
    dotColor: 'bg-primary',
  },
  self: {
    label: '自营校区',
    tagBg: 'bg-primary-bg',
    tagText: 'text-primary',
    dotColor: 'bg-primary',
  },
  partner: { label: '合作校区', tagBg: 'bg-info-bg', tagText: 'text-info', dotColor: 'bg-info' },
};

export const PARTNER_MODE_MAP: Record<PartnerMode, string> = {
  hourly_share: '课时分成',
  venue_rental: '场地租赁',
};

export const HOLIDAY_STATUS_MAP = {
  rest: { label: '休息', bg: 'bg-destructive/10', text: 'text-destructive' },
  adjust: { label: '调课', bg: 'bg-primary-bg', text: 'text-primary' },
} as const;

export const SUBJECT_ICONS = [
  { icon: '🎹', color: '#5EC8A8', gradient: 'linear-gradient(135deg, #5EC8A8, #4AB893)' },
  { icon: '🎤', color: '#9B7ED8', gradient: 'linear-gradient(135deg, #9B7ED8, #7E63C9)' },
  { icon: '📘', color: '#6BA3D6', gradient: 'linear-gradient(135deg, #6BA3D6, #4B85BB)' },
  { icon: '💃', color: '#E89BB8', gradient: 'linear-gradient(135deg, #E89BB8, #D97CA2)' },
  { icon: '✍️', color: '#D4A24E', gradient: 'linear-gradient(135deg, #D4A24E, #B9852F)' },
  { icon: '🎨', color: '#E8864A', gradient: 'linear-gradient(135deg, #E8864A, #D66D2B)' },
  { icon: '🎸', color: '#6BA3D6', gradient: 'linear-gradient(135deg, #6BA3D6, #4D86BD)' },
  { icon: '🥁', color: '#F08A5D', gradient: 'linear-gradient(135deg, #F08A5D, #D96A38)' },
];
