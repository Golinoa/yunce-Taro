/**
 * 首页待办提醒设置（用户口径 2026-08-24）
 *
 * 控制哪些事项进入首页「待办事项」Tab；与「消息通知」页（站外推送）分离。
 * 入口：我的 → 系统设置 → 待办提醒
 */
import Taro from '@tarojs/taro';

/** 待办提醒开关项（不含 showTabBadge，其为展示层开关） */
export type TodoReminderKey =
  | 'attendanceCheckin'
  | 'studentRecharge'
  | 'financePackage'
  | 'leavePending'
  | 'leadFollowUp'
  | 'salaryRemind'
  | 'meetingRemind';

/** 待办项分类，与开关项一一对应（showTabBadge 仅控制 Tab 角标）；custom 为用户自建待办 */
export type TodoItemCategory = TodoReminderKey | 'custom';

export interface TodoSettings {
  /** 昨日/历史未点名补录提醒 */
  attendanceCheckin: boolean;
  /** 学员课时不足 / 续费提醒 */
  studentRecharge: boolean;
  /** 课包即将到期等财务类提醒 */
  financePackage: boolean;
  /** 请假待审批 */
  leavePending: boolean;
  /** 线索待跟进（预留，Mock 暂未接入） */
  leadFollowUp: boolean;
  /** 发薪日 / 工资待确认提醒 */
  salaryRemind: boolean;
  /** 教学/经营复盘类提醒 */
  meetingRemind: boolean;
  /** 首页 Tab 是否显示待办数量角标 */
  showTabBadge: boolean;
}

export const TODO_SETTINGS_KEY = 'yunce:todo-settings';

export const DEFAULT_TODO_SETTINGS: TodoSettings = {
  attendanceCheckin: true,
  studentRecharge: true,
  financePackage: true,
  leavePending: true,
  leadFollowUp: true,
  salaryRemind: true,
  meetingRemind: true,
  showTabBadge: true,
};

/** 读取待办提醒设置，未配置时使用默认值（默认全开） */
export function getTodoSettings(): TodoSettings {
  try {
    const stored = Taro.getStorageSync(TODO_SETTINGS_KEY) as Partial<TodoSettings> | undefined;
    if (!stored || typeof stored !== 'object') {
      return { ...DEFAULT_TODO_SETTINGS };
    }
    return { ...DEFAULT_TODO_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_TODO_SETTINGS };
  }
}

/** 持久化待办提醒设置（局部更新） */
export function saveTodoSettings(partial: Partial<TodoSettings>): TodoSettings {
  const next = { ...getTodoSettings(), ...partial };
  try {
    Taro.setStorageSync(TODO_SETTINGS_KEY, next);
  } catch {
    /* 静默 */
  }
  return next;
}

/** 单项开关 */
export function setTodoSettingKey(key: keyof TodoSettings, enabled: boolean): TodoSettings {
  return saveTodoSettings({ [key]: enabled });
}

/** Tab 角标是否展示 */
export function getTodoShowTabBadge(): boolean {
  return getTodoSettings().showTabBadge !== false;
}

/** 按用户开关过滤待办列表 */
export function filterTodosBySettings<T extends { category?: TodoItemCategory }>(
  items: T[],
): T[] {
  const settings = getTodoSettings();
  return items.filter((item) => {
    if (item.category === 'custom') return true;
    if (!item.category) return true;
    return settings[item.category] !== false;
  });
}
