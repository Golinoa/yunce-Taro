import React, { useMemo, useState } from 'react';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useSubscribeAuthStore } from '@/stores/subscribe-auth';
import SubscribePromptDialog from './SubscribePromptDialog';
import SubscribeQuotaBanner from './SubscribeQuotaBanner';
import SubscribeRenewSheet from './SubscribeRenewSheet';

/**
 * 全局订阅消息 UI Host — 挂载于 app.tsx
 * 业务页只调 subscribeMessageService，禁止散落 Dialog
 */
export const SubscribeAuthHost: React.FC = () => {
  const prompt = useSubscribeAuthStore((s) => s.prompt);
  const sheet = useSubscribeAuthStore((s) => s.sheet);
  const banner = useSubscribeAuthStore((s) => s.banner);
  const closePrompt = useSubscribeAuthStore((s) => s.closePrompt);
  const closeSheet = useSubscribeAuthStore((s) => s.closeSheet);
  const hideBanner = useSubscribeAuthStore((s) => s.hideBanner);

  const [authLoading, setAuthLoading] = useState(false);

  const promptCopy = useMemo(() => {
    if (!prompt.visible) {
      return null;
    }
    return subscribeMessageService.formatPresetBody(prompt.presetId, prompt.variables ?? {});
  }, [prompt.visible, prompt.presetId, prompt.variables]);

  const sheetCopy = useMemo(() => {
    if (!sheet.visible) {
      return null;
    }
    return subscribeMessageService.formatRenewBody(sheet.presetId);
  }, [sheet.visible, sheet.presetId]);

  const handlePromptPrimary = async () => {
    if (authLoading) return;
    setAuthLoading(true);
    try {
      closePrompt('primary');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSheetPrimary = () => {
    closeSheet('primary');
  };

  return (
    <>
      {promptCopy ? (
        <SubscribePromptDialog
          visible={prompt.visible}
          title={promptCopy.title}
          body={promptCopy.body}
          primaryText={promptCopy.primaryText}
          secondaryText={promptCopy.secondaryText}
          tertiaryText={promptCopy.tertiaryText}
          showTertiary={prompt.showTertiary}
          loading={authLoading}
          onPrimary={handlePromptPrimary}
          onSecondary={() => closePrompt('secondary')}
          onTertiary={() => closePrompt('tertiary')}
        />
      ) : null}

      {sheetCopy ? (
        <SubscribeRenewSheet
          visible={sheet.visible}
          title={sheetCopy.title}
          body={sheetCopy.body}
          primaryText={sheetCopy.primaryText}
          secondaryText={sheetCopy.secondaryText}
          loading={authLoading}
          onPrimary={handleSheetPrimary}
          onSecondary={() => closeSheet('secondary')}
        />
      ) : null}

      <SubscribeQuotaBanner
        visible={banner.visible}
        message={banner.message}
        onDismiss={hideBanner}
      />
    </>
  );
};

export default SubscribeAuthHost;
