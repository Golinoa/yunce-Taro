/**
 * 机构 SaaS 会员在线支付（个人虚拟支付）
 * POST /payments/membership/orders
 * POST /payments/membership/orders/:id/resume
 * POST /payments/membership/orders/:id/close
 * GET  /payments/membership/orders
 * GET  /payments/membership/orders/:id
 * GET  /payments/membership/skus
 */
import Taro from '@tarojs/taro';
import { get, post } from '@/utils/request';

export type MembershipSku = {
  versionCode: string;
  name: string;
  description?: string | null;
  /** 分 */
  price: number;
  durationDays: number;
  productId: string;
  maxMembers: number;
  maxEmployees: number;
  maxCampuses: number;
};

export type VirtualPayData = {
  signData: string;
  mode: 'short_series_goods';
  paySig: string;
  signature: string;
};

export type CreateMembershipOrderResult = {
  orderId: string;
  outTradeNo: string;
  versionCode: string;
  versionName: string;
  goodsPrice: number;
  durationDays: number;
  status?: string;
  createdAt?: string;
  expiresAt?: string | null;
  payData: VirtualPayData;
  resumed?: boolean;
  mock?: boolean;
};

export type PaymentOrderStatusResult = {
  orderId: string;
  outTradeNo: string;
  wxOrderId?: string | null;
  status: string;
  versionCode: string;
  versionName?: string;
  productId?: string;
  goodsPrice: number;
  durationDays?: number;
  createdAt?: string;
  expiresAt?: string | null;
  paidAt?: string | null;
  fulfilledAt?: string | null;
  closedAt?: string | null;
  failReason?: string | null;
  expireHint?: string | null;
  orgExpireAt?: string | null;
};

export type MembershipOrderListResult = {
  items: PaymentOrderStatusResult[];
  total: number;
  page: number;
  pageSize: number;
};

function formatPriceYuan(fen: number): string {
  return (fen / 100).toFixed(fen % 100 === 0 ? 0 : 2);
}

/** iOS 虚拟支付需微信 ≥ 8.0.68 */
export function checkIosWechatVersionForVirtualPay(): boolean {
  try {
    const sys = Taro.getSystemInfoSync();
    if (sys.platform !== 'ios') return true;
    const cur = String(sys.version || '')
      .split('.')
      .map((n) => Number(n) || 0);
    const base = [8, 0, 68];
    for (let i = 0; i < 3; i += 1) {
      if ((cur[i] || 0) > base[i]) return true;
      if ((cur[i] || 0) < base[i]) break;
    }
    Taro.showModal({
      title: '提示',
      content: '请将微信更新至最新版后再进行支付',
      showCancel: false,
    });
    return false;
  } catch {
    return true;
  }
}

type VirtualPayInvoker = (options: {
  signData: string;
  mode: string;
  paySig: string;
  signature: string;
  success: () => void;
  fail: (err: { errMsg?: string }) => void;
}) => void;

function invokeRequestVirtualPayment(payData: VirtualPayData): Promise<void> {
  return new Promise((resolve, reject) => {
    const taroApi = (Taro as unknown as { requestVirtualPayment?: VirtualPayInvoker })
      .requestVirtualPayment;
    const globalWx = (
      globalThis as unknown as { wx?: { requestVirtualPayment?: VirtualPayInvoker } }
    ).wx?.requestVirtualPayment;
    const invoker = taroApi || globalWx;
    if (!invoker) {
      reject(new Error('当前基础库不支持虚拟支付'));
      return;
    }
    invoker({
      ...payData,
      success: () => resolve(),
      fail: (err) => reject(new Error(err?.errMsg || '支付失败')),
    });
  });
}

async function pollOrderUntilDone(
  orderId: string,
  maxAttempts = 12,
): Promise<PaymentOrderStatusResult> {
  let last: PaymentOrderStatusResult | null = null;
  for (let i = 0; i < maxAttempts; i += 1) {
    last = await paymentService.getOrder(orderId);
    if (last.status === 'FULFILLED' || last.status === 'CLOSED' || last.status === 'REFUNDED') {
      return last;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return last!;
}

async function finishPayFlow(
  created: CreateMembershipOrderResult,
): Promise<{ ok: boolean; message: string; order?: PaymentOrderStatusResult }> {
  if (created.mock) {
    const done = await paymentService.mockComplete(created.orderId);
    return {
      ok: done.status === 'FULFILLED',
      message: done.status === 'FULFILLED' ? '开通成功' : `状态：${done.status}`,
      order: done,
    };
  }

  try {
    await invokeRequestVirtualPayment(created.payData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '支付取消或失败';
    if (/cancel|取消/i.test(msg)) {
      return {
        ok: false,
        message: '已取消支付',
        order: {
          orderId: created.orderId,
          outTradeNo: created.outTradeNo,
          status: 'PAYING',
          versionCode: created.versionCode,
          goodsPrice: created.goodsPrice,
          expiresAt: created.expiresAt,
        },
      };
    }
    return { ok: false, message: msg };
  }

  const done = await pollOrderUntilDone(created.orderId);
  if (done.status === 'FULFILLED') {
    return { ok: true, message: '开通成功', order: done };
  }
  return {
    ok: false,
    message: '支付结果确认中，请稍后刷新会员页',
    order: done,
  };
}

export const paymentService = {
  formatPriceYuan,

  listSkus: async (): Promise<{ enabled: boolean; skus: MembershipSku[] }> => {
    try {
      return await get<{ enabled: boolean; skus: MembershipSku[] }>('/payments/membership/skus');
    } catch {
      return { enabled: false, skus: [] };
    }
  },

  listOrders: async (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<MembershipOrderListResult> => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return get<MembershipOrderListResult>(`/payments/membership/orders${qs ? `?${qs}` : ''}`);
  },

  createOrder: async (versionCode: string): Promise<CreateMembershipOrderResult> => {
    const login = await Taro.login();
    if (!login.code) {
      throw new Error('微信登录失败，请重试');
    }
    return post<CreateMembershipOrderResult>('/payments/membership/orders', {
      versionCode,
      loginCode: login.code,
    });
  },

  resumeOrder: async (orderId: string): Promise<CreateMembershipOrderResult> => {
    const login = await Taro.login();
    if (!login.code) {
      throw new Error('微信登录失败，请重试');
    }
    return post<CreateMembershipOrderResult>(`/payments/membership/orders/${orderId}/resume`, {
      loginCode: login.code,
    });
  },

  closeOrder: (orderId: string) =>
    post<PaymentOrderStatusResult>(`/payments/membership/orders/${orderId}/close`, {}),

  getOrder: (orderId: string) =>
    get<PaymentOrderStatusResult>(`/payments/membership/orders/${orderId}`),

  mockComplete: (orderId: string) =>
    post<PaymentOrderStatusResult>(`/payments/membership/orders/${orderId}/mock-complete`, {}),

  /**
   * 完整购买：下单（或复用待付）→ 拉起支付（或 mock）→ 轮询履约
   */
  purchaseMembership: async (
    versionCode: string,
  ): Promise<{ ok: boolean; message: string; order?: PaymentOrderStatusResult }> => {
    if (!checkIosWechatVersionForVirtualPay()) {
      return { ok: false, message: '请更新微信后再支付' };
    }
    const created = await paymentService.createOrder(versionCode);
    return finishPayFlow(created);
  },

  /** 继续支付既有待付单 */
  continuePay: async (
    orderId: string,
  ): Promise<{ ok: boolean; message: string; order?: PaymentOrderStatusResult }> => {
    if (!checkIosWechatVersionForVirtualPay()) {
      return { ok: false, message: '请更新微信后再支付' };
    }
    const resumed = await paymentService.resumeOrder(orderId);
    return finishPayFlow(resumed);
  },
};
