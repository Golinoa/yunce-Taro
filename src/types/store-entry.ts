/**
 * 门店入驻申请模块 — 类型定义
 */

/** 门店类型：总店 / 分店 */
export type StoreType = '总店' | '分店';

/** 门店入驻申请表单数据 */
export interface StoreEntryFormData {
  /** 门店名称 */
  name: string;
  /** 门店类型 */
  type: StoreType;
  /** 省市区 */
  region: string[];
  /** 详细地址 */
  address: string;
  /** 地图定位名称（chooseLocation 返回的 name） */
  locationName?: string;
  /** 纬度 */
  latitude?: number;
  /** 经度 */
  longitude?: number;
  /** 负责人称呼 */
  contactName: string;
  /** 负责人手机号 */
  contactPhone: string;
}

/** 门店入驻申请结果 */
export interface StoreEntryResult {
  /** 申请记录 ID */
  id: string;
  /** 申请状态 */
  status: 'pending' | 'approved' | 'rejected';
  /** 关联校区 ID（mock 环境下提交后直接创建） */
  campusId?: string;
}
