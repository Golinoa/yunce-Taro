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
import { TTL, markFetched, shouldRefetch } from '@/utils/data-freshness';
import { buildInviteLandingUrl } from '@/utils/invite-landing-url';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { buildWxacodeImageSrc } from '@/utils/wxacode-scene';

const InviteQrcodePage: React.FC = () => {
  useCardNavigationBar();
  const { profile, currentIdentity } = useAuth();

  /** 复制/展示用的**网址**（H5 落地页，浏览器/微信外均可打开） */
  const [inviteLink, setInviteLink] = useState('');
  /** 微信分享用的小程序路径（分享 path 必须是小程序页面路径，不能传网址） */
  const [sharePath, setSharePath] = useState('');
  const [qrImageSrc, setQrImageSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 招生码为教师固定码（永久有效、可多人复用）；小程序码生成属较重网络调用，
  // 用 TTL 守卫避免 useDidShow 反复进页时重复拉取与重复生成。
  const lastFetchAtRef = React.useRef<number | null>(null);

  const loadWxacode = useCallback(async () => {
    // 5min 内已成功生成过 → 跳过重复请求（首次进入 lastFetchAtRef 为 null 必定拉取）
    if (!shouldRefetch(lastFetchAtRef.current, TTL.list)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // ③ 类固定招生码：GET 取教师固定码（永久有效、可多人复用），不再每次新建临时码
      const myInvite = await parentShareInviteService.getMyShareInvite();
      const wxacode = await parentShareInviteService.getWxacode(myInvite.parentInviteCode);
      // 分享：小程序页面路径（微信要求 path 为小程序内路径）
      setSharePath(myInvite.parentInviteLandingPath || wxacode.landingPath);
      // 复制/展示：普通网址（H5 落地页），替代原先不可分享的小程序内部路径
      setInviteLink(buildInviteLandingUrl(myInvite.parentInviteCode));
      setQrImageSrc(buildWxacodeImageSrc(wxacode.imageBase64));
      markFetched(lastFetchAtRef);
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
    // 微信分享 path 必须是小程序页面路径（不能用网址），根路径前不加 /
    path: (sharePath || 'package-auth/pages/invite-register/index').replace(/^\//, ''),
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
