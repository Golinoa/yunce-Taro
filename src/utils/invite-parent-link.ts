/**
 * 邀请家长绑定 — 复制小程序邀请链接（E08/E09 第三按钮）
 */
import Taro from '@tarojs/taro';

export async function copyParentInviteLink(studentId: string): Promise<void> {
  if (!studentId) {
    Taro.showToast({ title: '学员信息异常', icon: 'none' });
    return;
  }

  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const path = `/package-student/pages/parent-bind/index?studentId=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token)}`;
  const link = `package-auth/pages/index/index?redirect=${encodeURIComponent(path)}`;

  await Taro.setClipboardData({ data: link });
  Taro.showToast({
    title: '邀请链接已复制，请发送给家长',
    icon: 'none',
    duration: 2500,
  });
}
