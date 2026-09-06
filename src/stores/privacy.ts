/**
 * 隐私授权 Store — Zustand
 */
import { create } from 'zustand';

/** 微信 onNeedPrivacyAuthorization 回调注入的 resolve 函数 */
export type PrivacyResolve = (params: { event: 'agree' | 'disagree'; buttonId?: string }) => void;

/** 同意按钮 id，必须与实际渲染的原生 agree 按钮 id 一致（基础库会校验按钮是否被点击过） */
export const PRIVACY_AGREE_BUTTON_ID = 'privacy-agree-btn';

export type PrivacyAuthStatus = 'unknown' | 'authorized' | 'need' | 'denied';

interface PrivacyState {
  visible: boolean;
  contractName: string;
  needAuthorization: boolean;
  status: PrivacyAuthStatus;
  prompting: boolean;
  pendingResolves: PrivacyResolve[];

  setContractName: (name: string) => void;
  setNeedAuthorization: (need: boolean) => void;
  setStatus: (status: PrivacyAuthStatus) => void;
  setPrompting: (prompting: boolean) => void;
  setVisible: (visible: boolean) => void;
  enqueue: (resolve: PrivacyResolve) => void;
  agree: () => void;
  disagree: () => void;
  showBlockedGate: () => void;
}

export const usePrivacyStore = create<PrivacyState>((set, get) => ({
  visible: false,
  contractName: '《隐私保护指引》',
  needAuthorization: false,
  status: 'unknown',
  prompting: false,
  pendingResolves: [],

  setContractName: (name) => {
    set({ contractName: name || '《隐私保护指引》' });
  },
  setNeedAuthorization: (need) => {
    set((s) => ({
      needAuthorization: need,
      status: need ? (s.status === 'denied' ? 'denied' : 'need') : 'authorized',
      ...(need ? {} : { visible: false, prompting: false }),
    }));
  },
  setStatus: (status) => {
    set({ status });
  },
  setPrompting: (prompting) => {
    set({ prompting });
  },
  setVisible: (visible) => {
    set({ visible });
  },

  enqueue: (resolve) => {
    set((s) => ({
      pendingResolves: [...s.pendingResolves, resolve],
      visible: true,
      status: s.status === 'denied' ? 'denied' : 'need',
      needAuthorization: true,
    }));
  },

  agree: () => {
    const resolves = get().pendingResolves;
    resolves.forEach((r) => {
      try {
        r({ event: 'agree', buttonId: PRIVACY_AGREE_BUTTON_ID });
      } catch {
        // ignore resolve errors
      }
    });
    set({
      pendingResolves: [],
      visible: false,
      needAuthorization: false,
      status: 'authorized',
    });
  },

  disagree: () => {
    const resolves = get().pendingResolves;
    resolves.forEach((r) => {
      try {
        r({ event: 'disagree' });
      } catch {
        // ignore resolve errors
      }
    });
    set({
      pendingResolves: [],
      visible: true,
      needAuthorization: true,
      status: 'denied',
    });
  },

  showBlockedGate: () => {
    set({
      visible: true,
      needAuthorization: true,
      status:
        get().status === 'authorized' ? 'need' : get().status === 'denied' ? 'denied' : 'need',
    });
  },
}));
