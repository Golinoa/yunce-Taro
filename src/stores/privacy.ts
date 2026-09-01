/**
 * 隐私授权 Store — Zustand
 */
import { create } from 'zustand';
import { privacyStoreSnapshot, privacyTrace } from '@/utils/privacy-debug';

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
    privacyTrace('store.setContractName', { name });
    set({ contractName: name || '《隐私保护指引》' });
  },
  setNeedAuthorization: (need) => {
    privacyTrace('store.setNeedAuthorization', { need, before: privacyStoreSnapshot() });
    set((s) => ({
      needAuthorization: need,
      status: need ? (s.status === 'denied' ? 'denied' : 'need') : 'authorized',
      ...(need ? {} : { visible: false, prompting: false }),
    }));
  },
  setStatus: (status) => {
    privacyTrace('store.setStatus', { status });
    set({ status });
  },
  setPrompting: (prompting) => {
    privacyTrace('store.setPrompting', { prompting });
    set({ prompting });
  },
  setVisible: (visible) => {
    privacyTrace('store.setVisible', { visible });
    set({ visible });
  },

  enqueue: (resolve) => {
    privacyTrace('store.enqueue', { beforePending: get().pendingResolves.length });
    set((s) => ({
      pendingResolves: [...s.pendingResolves, resolve],
      visible: true,
      status: s.status === 'denied' ? 'denied' : 'need',
      needAuthorization: true,
    }));
    privacyTrace('store.enqueue.done', { afterPending: get().pendingResolves.length });
  },

  agree: () => {
    const resolves = get().pendingResolves;
    privacyTrace('store.agree', { resolveCount: resolves.length });
    resolves.forEach((r, index) => {
      try {
        r({ event: 'agree', buttonId: PRIVACY_AGREE_BUTTON_ID });
        privacyTrace('store.agree.resolve.ok', { index });
      } catch (err) {
        privacyTrace('store.agree.resolve.error', { index, err });
      }
    });
    set({
      pendingResolves: [],
      visible: false,
      needAuthorization: false,
      status: 'authorized',
    });
    privacyTrace('store.agree.done');
  },

  disagree: () => {
    const resolves = get().pendingResolves;
    privacyTrace('store.disagree', { resolveCount: resolves.length });
    resolves.forEach((r, index) => {
      try {
        r({ event: 'disagree' });
        privacyTrace('store.disagree.resolve.ok', { index });
      } catch (err) {
        privacyTrace('store.disagree.resolve.error', { index, err });
      }
    });
    set({
      pendingResolves: [],
      visible: true,
      needAuthorization: true,
      status: 'denied',
    });
    privacyTrace('store.disagree.done');
  },

  showBlockedGate: () => {
    privacyTrace('store.showBlockedGate', { before: privacyStoreSnapshot() });
    set({
      visible: true,
      needAuthorization: true,
      status:
        get().status === 'authorized' ? 'need' : get().status === 'denied' ? 'denied' : 'need',
    });
    privacyTrace('store.showBlockedGate.done');
  },
}));
