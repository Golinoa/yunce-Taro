/**
 * 订阅消息 UI 状态（全局弹框 / 弹窗）
 */
import { create } from 'zustand';
import type {
  OpenPromptInput,
  OpenRenewSheetInput,
  SubscribePromptAction,
  SubscribeSheetAction,
  SubscribeTemplateGroup,
} from '@/types/subscribe-message';

interface BannerState {
  visible: boolean;
  message: string;
  group?: SubscribeTemplateGroup;
}

interface PromptState extends OpenPromptInput {
  visible: boolean;
  resolve?: (action: SubscribePromptAction) => void;
}

interface SheetState extends OpenRenewSheetInput {
  visible: boolean;
  resolve?: (action: SubscribeSheetAction) => void;
}

interface SubscribeAuthStore {
  prompt: PromptState;
  sheet: SheetState;
  banner: BannerState;
  openPrompt: (input: OpenPromptInput) => Promise<SubscribePromptAction>;
  closePrompt: (action: SubscribePromptAction) => void;
  openRenewSheet: (input: OpenRenewSheetInput) => Promise<SubscribeSheetAction>;
  closeSheet: (action: SubscribeSheetAction) => void;
  hideBanner: () => void;
}

const emptyPrompt = (): PromptState => ({
  visible: false,
  presetId: 'student_created',
});

const emptySheet = (): SheetState => ({
  visible: false,
  presetId: 'checkin_renew',
  scene: '',
  groups: [],
});

export const useSubscribeAuthStore = create<SubscribeAuthStore>((set, get) => ({
  prompt: emptyPrompt(),
  sheet: emptySheet(),
  banner: { visible: false, message: '' },

  openPrompt: (input) =>
    new Promise<SubscribePromptAction>((resolve) => {
      set({
        prompt: {
          ...input,
          visible: true,
          resolve,
        },
      });
    }),

  closePrompt: (action) => {
    const { prompt } = get();
    prompt.resolve?.(action);
    set({ prompt: emptyPrompt() });
  },

  openRenewSheet: (input) =>
    new Promise<SubscribeSheetAction>((resolve) => {
      set({
        sheet: {
          ...input,
          visible: true,
          resolve,
        },
      });
    }),

  closeSheet: (action) => {
    const { sheet } = get();
    sheet.resolve?.(action);
    set({ sheet: emptySheet() });
  },

  hideBanner: () => {
    set({ banner: { visible: false, message: '' } });
  },
}));
