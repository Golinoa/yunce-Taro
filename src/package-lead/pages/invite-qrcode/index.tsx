/**
 * 邀约二维码页 package-lead/pages/invite-qrcode
 *
 * 展示老师专属邀约二维码和链接，支持复制和转发。
 */
import React, { useMemo } from 'react';
import InviteQrSection from '@/components/lead/InviteQrSection';
import PageContainer from '@/components/PageContainer';
import { useAuth } from '@/utils/auth';

const InviteQrcodePage: React.FC = () => {
  const { profile, currentIdentity, session } = useAuth();

  const inviteLink = useMemo(() => {
    // 实际项目中由后端生成短链接
    const teacherId = session?.user.id || '';
    const campusId = profile?.currentContext?.campusId || '';
    return `https://yunce.app/invite?t=${teacherId}&c=${campusId}`;
  }, [session?.user.id, profile?.currentContext?.campusId]);

  return (
    <PageContainer>
      <InviteQrSection
        teacherName={profile?.name || '老师'}
        campusName={currentIdentity?.organizationName || ''}
        inviteLink={inviteLink}
      />
    </PageContainer>
  );
};

export default InviteQrcodePage;
