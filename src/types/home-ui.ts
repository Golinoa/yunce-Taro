/** 首页相关展示类型（原 data/home 类型迁出，供真 API 映射） */
export type StatsPeriod = 'today' | 'week' | 'lastWeek' | 'month';

export interface StatsData {
  checkinCount: number;
  leaveCount: number;
  lessonHours: number;
  lessonAmount: number;
}

export interface QuickEntry {
  label: string;
  /** mdi 回退图标（无 image 时使用） */
  icon: string;
  /** 3D 瓷片图：优先于 icon */
  image?: string;
  color: string;
  url: string;
}

export interface TodoItemData {
  id: string;
  title: string;
  type: 'alert' | 'recharge' | 'meeting' | 'salary' | 'checkin' | 'lead';
  time: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  scheduleId?: string;
  classId?: string;
  lessonDate?: string;
  remainingHours?: number;
}

export type OperationActionType = 'NONE' | 'PAGE' | 'TAB' | 'WEBVIEW' | 'ACTIVITY' | 'MINI_PROGRAM';

export interface OperationActionConfigData {
  type: OperationActionType;
  path?: string;
  url?: string;
  appId?: string;
  activityId?: string;
}

export interface OperationDisplayConfigData {
  badgeText?: string;
  theme?: 'dark' | 'light' | 'primary';
}

export interface OperationBannerItemData {
  id: string;
  title: string;
  imageUrl: string;
  summary?: string;
  content?: string;
  actionConfig?: OperationActionConfigData;
  displayConfig?: OperationDisplayConfigData;
}

export interface OperationActivityItemData {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  coverImageUrl?: string;
  actionConfig?: OperationActionConfigData;
  displayConfig?: OperationDisplayConfigData;
}

export interface HomeOperationContentData {
  placements: {
    banners: OperationBannerItemData[];
    cards: OperationActivityItemData[];
    floatings: OperationActivityItemData[];
    notices: OperationActivityItemData[];
    popups: OperationActivityItemData[];
  };
  updatedAt: string;
}
