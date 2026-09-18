/**
 * 邀约二维码页 package-lead/pages/invite-qrcode
 *
 * 取教师固定招生码（Teacher.parentInviteCode，永久有效、可多人复用）
 * → 调用微信 getwxacodeunlimit 生成真实小程序码。
 * 家长扫码直达 invite-register，scene 携带固定 P 码。
 * （旧「每次新建 24h 临时码」流程已按已决 #3 删除）
 */
import { useDidShow, useShareAppMessage } from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import InviteQrSection from '@/components/lead/InviteQrSection';
import PageContainer from '@/components/PageContainer';
import { parentShareInviteService } from '@/services/parent-share-invite';
import { useAuth } from '@/utils/auth';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { buildWxacodeImageSrc } from '@/utils/wxacode-scene';

const InviteQrcodePage: React.FC = () => {
  useCardNavigationBar();
  const { profile, currentIdentity } = useAuth();

  const [inviteLink, setInviteLink] = useState('');
  const [qrImageSrc, setQrImageSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWxacode = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // ③ 类固定招生码：GET 取教师固定码（永久有效、可多人复用），不再每次新建临时码
      const myInvite = await parentShareInviteService.getMyShareInvite();
      const wxacode = await parentShareInviteService.getWxacode(myInvite.parentInviteCode);
      setInviteLink(myInvite.parentInviteLandingPath || wxacode.landingPath);
      setQrImageSrc(buildWxacodeImageSrc(wxacode.imageBase64));
    } catch (e) {
      setQrImageSrc('');
      setError(e instanceof Error ? e.message : '生成小程序码失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    void loadWxacode();
  });

  useShareAppMessage(() => ({
    title: `${profile?.name || '老师'}邀请您加入${currentIdentity?.organizationName || '机构'}`,
    // 微信分享 path 根路径前不加 /
    path: (inviteLink || 'package-auth/pages/invite-register/index').replace(/^\//, ''),
  }));

  return (
    <PageContainer>
      <InviteQrSection
        teacherName={profile?.name || profile?.nickname || '老师'}
        campusName={currentIdentity?.organizationName || ''}
        inviteLink={inviteLink}
        qrImageSrc={qrImageSrc}
        permanent
        loading={loading}
        error={error}
        onRefresh={() => {
          void loadWxacode();
        }}
      />
    </PageContainer>
  );
};

export default InviteQrcodePage;
