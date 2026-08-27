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
  id?: string;
  /** 申请状态 */
  status: 'pending' | 'approved' | 'rejected';
  /** 关联校区 ID（mock 环境下提交后直接创建） */
  campusId?: string;
  /** 入驻申请单 ID（POST /store-entry/applications 返回） */
  applicationId?: string;
  /** 关联机构 ID */
  organizationId?: string;
  /** 拒绝原因（rejected 时展示） */
  rejectReason?: string;
}

/** 门店入驻最新申请状态（GET /store-entry/applications/latest 返回） */
export interface StoreEntryLatestResult {
  /** 最新申请单；无申请记录时为 null */
  application?: {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectReason?: string | null;
    contactPhone?: string;
  } | null;
  /** 关联机构；无申请记录时为 null */
  organization?: {
    id: string;
    status: string;
    rejectReason?: string | null;
    name?: string;
  } | null;
}
