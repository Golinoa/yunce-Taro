import type { ClassColor, ClassIcon } from '@/types/class';

/** 班级图标映射（10 个教培相关 MDI 图标） */
export const CLASS_ICONS: Record<ClassIcon, string> = {
  piano: 'mdi-piano',
  dance: 'mdi-dance',
  art: 'mdi-palette',
  calligraphy: 'mdi-fountain-pen-tip',
  basketball: 'mdi-basketball',
  speech: 'mdi-microphone',
  rubik: 'mdi-puzzle',
  go: 'mdi-chess-pawn',
  book: 'mdi-book-open-page-variant',
  music: 'mdi-music-note',
};

/** 班级渐变背景映射 */
export const CLASS_GRADIENT: Record<ClassColor, string> = {
  primary: 'bg-class-primary',
  red: 'bg-class-red',
  amber: 'bg-class-amber',
  purple: 'bg-class-purple',
  info: 'bg-class-info',
  teal: 'bg-class-teal',
};

/** 格式化日期为中文 */
export function formatDateCN(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
