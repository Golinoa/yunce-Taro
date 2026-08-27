/**
 * 门店入驻申请 — Mock 数据层
 *
 * 当前 mock 实现：提交入驻申请后自动创建对应校区，便于在校区卡片中展示定位。
 * 联调时改为向后端提交申请单即可。
 */
import Taro from '@tarojs/taro';
import { CAMPUS_ICONS } from '@/data/campus';
import { campusService } from '@/services/campus';
import type { CampusFormData, CampusType } from '@/types/campus';
import type {
  StoreEntryFormData,
  StoreEntryLatestResult,
  StoreEntryResult,
  StoreType,
} from '@/types/store-entry';

const STORE_TYPE_TO_CAMPUS_TYPE: Record<StoreType, CampusType> = {
  总店: 'main',
  分店: 'self',
};

/** mock 申请单本地状态 key（pending 页 queryLatest / 重新提交用） */
const MOCK_ENTRY_STATE_KEY = 'yunce:mock-store-entry-state';

interface MockEntryState {
  applicationId: string;
  organizationId: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
}

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readMockEntryState(): MockEntryState | null {
  try {
    const raw = Taro.getStorageSync(MOCK_ENTRY_STATE_KEY);
    return raw ? (JSON.parse(raw) as MockEntryState) : null;
  } catch {
    return null;
  }
}

function writeMockEntryState(state: MockEntryState): void {
  try {
    Taro.setStorageSync(MOCK_ENTRY_STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
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

  const applicationId = `entry-${Date.now()}`;
  const organizationId = `org-entry-${Date.now()}`;
  // mock 同步建校区即视为已开通，与真实后端的 'pending' 申请单语义区分
  writeMockEntryState({
    applicationId,
    organizationId,
    name: data.name,
    status: 'approved',
  });

  return {
    id: applicationId,
    status: 'approved',
    campusId: campus.id,
    applicationId,
    organizationId,
  };
}

/** 查询最新入驻申请状态（真实模式 GET /store-entry/applications/latest） */
export async function mockQueryLatest(): Promise<StoreEntryLatestResult> {
  await delay();
  const state = readMockEntryState();
  if (!state) {
    return { application: null, organization: null };
  }
  return {
    application: {
      id: state.applicationId,
      status: state.status,
      rejectReason: state.rejectReason,
    },
    organization: {
      id: state.organizationId,
      status:
        state.status === 'approved'
          ? 'active'
          : state.status === 'rejected'
            ? 'rejected'
            : 'pending',
      name: state.name,
      rejectReason: state.rejectReason,
    },
  };
}

/** 被拒绝后重新提交（真实模式 POST /store-entry/applications/re-submit） */
export async function mockResubmit(data: StoreEntryFormData): Promise<StoreEntryResult> {
  await delay();
  const state = readMockEntryState();
  const applicationId = state?.applicationId || `entry-${Date.now()}`;
  const organizationId = state?.organizationId || `org-entry-${Date.now()}`;
  writeMockEntryState({
    applicationId,
    organizationId,
    name: data.name,
    status: 'pending',
  });
  return {
    id: applicationId,
    status: 'pending',
    applicationId,
    organizationId,
  };
}
