/**
 * 隐私授权 Store — Zustand
 *
 * 对接微信《个人信息保护指引》平台合规要求：
 *  - wx.onNeedPrivacyAuthorization 触发时（任意隐私受限接口调用 / requirePrivacyAuthorize），
 *    入栈 resolve 并展示隐私弹窗。
 *  - 用户在弹窗点击「同意并继续」（原生按钮 open-type="agreePrivacyAuthorization"）后，
 *    调用所有 pending resolve({ event: 'agree' })，被拦截的隐私接口才会继续执行。
 *  - 点击「暂不使用」则 resolve({ event: 'disagree' })，被拦截接口以隐私未授权失败。
 *
 * 与业务层 AgreementSheet（登录注册前的用户协议+隐私政策确认）相互独立，
 * 这里处理的是微信基础库强制的隐私授权流程。
 */
import { create } from 'zustand';

/** 微信 onNeedPrivacyAuthorization 回调注入的 resolve 函数 */
export type PrivacyResolve = (params: { event: 'agree' | 'disagree'; buttonId?: string }) => void;

/** 同意按钮 id，必须与实际渲染的原生 agree 按钮 id 一致（基础库会校验按钮是否被点击过） */
export const PRIVACY_AGREE_BUTTON_ID = 'privacy-agree-btn';

interface PrivacyState {
  /** 弹窗是否展示 */
  visible: boolean;
  /** 隐私协议名称（来自 wx.getPrivacySetting.privacyContractName），如《松果排课隐私保护指引》 */
  contractName: string;
  /** 是否仍需授权（来自 wx.getPrivacySetting.needAuthorization） */
  needAuthorization: boolean;
  /** 待处理的隐私接口 resolve 列表（onNeedPrivacyAuthorization 可能在同一时机多次触发） */
  pendingResolves: PrivacyResolve[];

  setContractName: (name: string) => void;
  setNeedAuthorization: (need: boolean) => void;
  /** 由 onNeedPrivacyAuthorization 触发：入栈 resolve 并展示弹窗 */
  enqueue: (resolve: PrivacyResolve) => void;
  /** 用户同意：放行所有 pending 隐私接口并收起弹窗 */
  agree: () => void;
  /** 用户拒绝：拒绝所有 pending 隐私接口并收起弹窗 */
  disagree: () => void;
}

export const usePrivacyStore = create<PrivacyState>((set, get) => ({
  visible: false,
  contractName: '《隐私保护指引》',
  needAuthorization: false,
  pendingResolves: [],

  setContractName: (name) => set({ contractName: name || '《隐私保护指引》' }),
  setNeedAuthorization: (need) => set({ needAuthorization: need }),

  enqueue: (resolve) => {
    set((s) => ({
      pendingResolves: [...s.pendingResolves, resolve],
      visible: true,
    }));
  },

  agree: () => {
    const resolves = get().pendingResolves;
    resolves.forEach((r) => {
      try {
        r({ event: 'agree', buttonId: PRIVACY_AGREE_BUTTON_ID });
      } catch {
        // 单个 resolve 异常不影响其余接口
      }
    });
    set({ pendingResolves: [], visible: false });
  },

  disagree: () => {
    const resolves = get().pendingResolves;
    resolves.forEach((r) => {
      try {
        r({ event: 'disagree' });
      } catch {
        // 忽略
      }
    });
    set({ pendingResolves: [], visible: false });
  },
}));
