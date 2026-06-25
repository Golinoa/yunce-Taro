/**
 * 协议同意状态 Store
 * 登录/注册共用，一次同意后本次会话不再重复弹窗
 */
import Taro from '@tarojs/taro';
import { create } from 'zustand';

const AGREEMENT_STORAGE_KEY = 'yunce_agreed_to_terms_v1';

interface AgreementState {
  agreed: boolean;
  setAgreed: (agreed: boolean) => void;
}

export const useAgreementStore = create<AgreementState>((set) => ({
  agreed: Taro.getStorageSync(AGREEMENT_STORAGE_KEY) === true,
  setAgreed: (agreed) => {
    Taro.setStorageSync(AGREEMENT_STORAGE_KEY, agreed);
    set({ agreed });
  },
}));
