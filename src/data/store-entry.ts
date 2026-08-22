/**
 * 门店入驻申请 — Mock 数据层
 *
 * 当前 mock 实现：提交入驻申请后自动创建对应校区，便于在校区卡片中展示定位。
 * 联调时改为向后端提交申请单即可。
 */
import { CAMPUS_ICONS } from '@/data/campus';
import { campusService } from '@/services/campus';
import type { CampusFormData, CampusType } from '@/types/campus';
import type { StoreEntryFormData, StoreEntryResult, StoreType } from '@/types/store-entry';

const STORE_TYPE_TO_CAMPUS_TYPE: Record<StoreType, CampusType> = {
  总店: 'main',
  分店: 'self',
};

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 提交门店入驻申请
 *
 * mock 环境下同步创建校区并立即开通（status: 'approved'），
 * 便于在校区卡片中即时查看定位；
 * 真实联调时只向 /api/store-entries 提交申请单，返回 status: 'pending' 等待人工审核。
 * 二者语义通过 status 区分，页面成功文案据此统一（见 pages/store-entry）。
 */
export async function mockSubmitStoreEntry(data: StoreEntryFormData): Promise<StoreEntryResult> {
  await delay();

  const iconMeta = CAMPUS_ICONS[Math.floor(Math.random() * CAMPUS_ICONS.length)];
  const campusData: CampusFormData = {
    name: data.name,
    type: STORE_TYPE_TO_CAMPUS_TYPE[data.type],
    isMain: data.type === '总店',
    phone: data.contactPhone,
    region: data.region.filter(Boolean).join('-'),
    address: data.address,
    icon: iconMeta.icon,
    iconGradient: iconMeta.gradient,
    locationName: data.locationName,
    latitude: data.latitude,
    longitude: data.longitude,
  };

  const campus = await campusService.add(campusData);

  return {
    id: `entry-${Date.now()}`,
    // mock 同步建校区即视为已开通，与真实后端的 'pending' 申请单语义区分
    status: 'approved',
    campusId: campus.id,
  };
}
