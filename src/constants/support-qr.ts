/**
 * 全局客服 / 维修企微二维码
 *
 * CDN 为主（七牛），本地为构建回退；保存相册优先走 CDN download。
 */

import { MEDIA_IMAGE_BASE } from '@/constants/brand';

/** 七牛 CDN 正式地址 */
export const SUPPORT_REPAIR_QR_CDN =
  'https://res.chancore.cn/platform/static/support-repair-qr.png';

/** 主包本地回退（压缩 WebP ~26KB；完整 PNG 只走七牛） */
export const SUPPORT_REPAIR_QR_LOCAL = `${MEDIA_IMAGE_BASE}/support-repair-qr.webp`;

/** 默认展示用 URL（优先 CDN） */
export const SUPPORT_REPAIR_QR_URL = SUPPORT_REPAIR_QR_CDN;

/** 默认弹窗文案：添加客服维修 */
export const SUPPORT_QR_DEFAULT_COPY = {
  titleLine1: '添加客服',
  titleLine2: '维修企微码',
  description: '扫码添加客服微信，\n1对1对接维修与售后问题',
  saveLabel: '保存图片',
} as const;

/** 会员 · 申请众创 */
export const SUPPORT_QR_MEMBERSHIP_FREE_COPY = {
  titleLine1: '申请众创版',
  titleLine2: '添加客服企微',
  description: '添加后说明「申请众创」\n审核通过后为你开通',
  saveLabel: '保存图片',
} as const;

/** 会员 · 升级补差 / 联系运营 */
export const SUPPORT_QR_MEMBERSHIP_UPGRADE_COPY = {
  titleLine1: '升级补差',
  titleLine2: '添加运营企微',
  description: '添加后说明当前版本与目标版本\n运营核算补差后为你开通',
  saveLabel: '保存图片',
} as const;

/** 门店入驻 · 催办审核 */
export const SUPPORT_QR_EXPEDITE_COPY = {
  titleLine1: '催办入驻审核',
  titleLine2: '添加客服企微',
  description: '添加后说明门店名称与提交时间\n客服协助加急处理',
  saveLabel: '保存图片',
} as const;
