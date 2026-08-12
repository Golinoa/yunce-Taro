import type { Room } from './campus';

/** 场地预约时段状态 */
export type VenueBookingSlotStatus = 'available' | 'booked' | 'closed';

/** 场地预约时段 */
export interface VenueBookingSlot {
  /** 时段唯一标识 */
  id: string;
  /** 场地/教室ID */
  roomId: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 开始时间 HH:mm */
  startTime: string;
  /** 结束时间 HH:mm */
  endTime: string;
  /** 当前已约人数 */
  bookedCount: number;
  /** 最大可约人数（默认取教室容量） */
  maxCount: number;
  /** 时段状态 */
  status: VenueBookingSlotStatus;
  /** 该时段单价（元） */
  price: number;
}

/** 场地预约记录 */
export interface VenueBookingRecord {
  /** 预约ID */
  id: string;
  /** 预约人用户ID */
  userId: string;
  /** 预约人姓名 */
  userName: string;
  /** 场地/教室ID */
  roomId: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 开始时间 HH:mm */
  startTime: string;
  /** 结束时间 HH:mm */
  endTime: string;
  /** 预约人数 */
  peopleCount: number;
  /** 单价（元） */
  unitPrice: number;
  /** 总价（元） */
  totalPrice: number;
  /** 预约状态 */
  status: 'pending' | 'confirmed' | 'cancelled';
  /** 创建时间 */
  createdAt: string;
}

/** 可预约场地（教室）视图模型 */
export interface BookableVenue extends Room {
  /** 所属场馆名称 */
  venueName: string;
  /** 实时在场人数 */
  currentCount: number;
  /** 今日入场人数 */
  todayEntryCount: number;
  /** 在场会员头像列表 */
  memberAvatars: string[];
}
