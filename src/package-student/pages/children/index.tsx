/**
 * 子女档案页 pages/children/index
 *
 * 家长视角：展示已绑定孩子的档案（只读）+ 「邀请亲属」入口
 *
 * 设计原则（精简版）：
 * - 顶部沉浸式头部 + 「我的孩子」标题
 * - 每个孩子一张卡片：头像 + 姓名 + 性别/生日 + 邀请码 + 「邀请亲属查看」按钮
 * - 列表为空时给出引导：「去绑定孩子」回到 profile 入口
 *
 * 头像策略：用户上传了用上传的；未上传统一用品牌默认图 sgpk.png
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import StudentAvatar from '@/components/student/StudentAvatar';
import { studentService } from '@/services';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

const GENDER_MAP: Record<NonNullable<Student['gender']>, string> = {
  male: '男',
  female: '女',
  other: '其他',
};

const Children: React.FC = () => {
  const { profile } = useAuth();
  const navSafeHeight = useNavSafeHeight();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canGoBack = Taro.getCurrentPages().length > 1;

  // 加载已绑定的孩子
  const loadStudents = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const list = await studentService.getByParent(profile.id);
      // 只展示存活的
      setStudents(list.filter((s) => s.status !== 'deleted'));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '加载子女档案失败');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // 邀请亲属：复制后端真实 inviteCode（无码则提示联系老师）
  const handleInviteRelatives = useCallback((student: Student) => {
    const code = student.invite_code?.trim();
    const hasCode = Boolean(code && code !== '请联系老师');
    Taro.showModal({
      title: '邀请亲属查看',
      content: hasCode
        ? `已为你生成 ${student.name} 的专属邀请码，你可以通过分享小程序二维码或链接给配偶/家人，对方完成注册后即可查看孩子的课表与约课。`
        : `${student.name} 暂无可用邀请码，请联系老师生成后再邀请亲属。`,
      confirmText: hasCode ? '复制邀请码' : '我知道了',
      showCancel: hasCode,
      cancelText: '关闭',
      success: ({ confirm }) => {
        if (confirm && hasCode && code) {
          Taro.setClipboardData({ data: code });
          Taro.showToast({ title: '邀请码已复制', icon: 'success' });
        }
      },
    });
  }, []);

  const handleOpenDetail = useCallback((student: Student) => {
    Taro.navigateTo({
      url: `/package-student/pages/child-detail/index?id=${encodeURIComponent(student.id)}`,
    });
  }, []);

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen flex flex-col bg-background">
        {/* ====== 顶部沉浸式头部 ====== */}
        <View
          className="bg-gradient-diffuse-custom-nav px-page-padding pb-[48rpx]"
          style={{ paddingTop: `${navSafeHeight + 24}px` }}
        >
          <View className="flex items-center justify-between">
            <View className="flex items-center gap-[16rpx]">
              {canGoBack && (
                <View
                  className="flex items-center justify-center w-[56rpx] h-[56rpx] rounded-full bg-white/15 active:bg-white/25"
                  onClick={() => Taro.navigateBack()}
                >
                  <Icon name="mdi-chevron-left" size={32} color="white" />
                </View>
              )}
              <Text className="text-[36rpx] font-bold text-white">我的孩子</Text>
            </View>
            <Text className="text-[26rpx] text-white/85">共 {students.length} 位</Text>
          </View>
          <Text className="block text-[26rpx] text-white/80 mt-[20rpx] leading-[40rpx]">
            为孩子维护准确的姓名、性别与生日，便于教师识别{'\n'}邀请配偶或家人共同管理孩子档案
          </Text>
        </View>

        {/* ====== 内容区 ====== */}
        <View className="relative z-10 -mt-[24rpx] flex-1 px-page-padding pb-[40rpx]">
          {errorMsg && (
            <View className="bg-destructive/10 border-2 border-destructive/20 rounded-[24rpx] p-5 flex items-center gap-3 mb-[24rpx]">
              <Text className="flex-1 text-destructive text-md">{errorMsg}</Text>
              <View className="px-4 py-2 rounded-full bg-destructive" onClick={loadStudents}>
                <Text className="text-destructive-foreground text-md font-medium">重试</Text>
              </View>
            </View>
          )}

          {loading && students.length === 0 ? (
            <View className="py-[120rpx] text-center">
              <Text className="text-[26rpx] text-muted-foreground">加载中…</Text>
            </View>
          ) : students.length === 0 ? (
            <View className="py-[80rpx]">
              <Empty
                icon="mdi-account-child-outline"
                description="暂未绑定孩子 — 请回到「我的」页面使用邀请码绑定孩子"
                actionText="回到我的"
                onAction={() =>
                  canGoBack ? Taro.navigateBack() : Taro.switchTab({ url: '/pages/profile/index' })
                }
              />
            </View>
          ) : (
            <ScrollView scrollY showScrollbar={false} enhanced>
              <View className="flex flex-col gap-[24rpx] pt-[8rpx]">
                {students.map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    onInviteRelatives={handleInviteRelatives}
                    onOpenDetail={handleOpenDetail}
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </PageContainer>
  );
};

export default Children;

/* ============================================
 * 单个学员档案卡片（只读）
 * ============================================ */
interface StudentCardProps {
  student: Student;
  onInviteRelatives: (student: Student) => void;
  onOpenDetail: (student: Student) => void;
}

const StudentCard: React.FC<StudentCardProps> = ({ student, onInviteRelatives, onOpenDetail }) => {
  const genderLabel = student.gender ? GENDER_MAP[student.gender] : '未设置';
  const birthdayLabel = student.birthday || '未设置';

  return (
    <View
      className="rounded-[32rpx] bg-card shadow-soft p-[28rpx] active:opacity-90"
      onClick={() => onOpenDetail(student)}
    >
      {/* 头部：头像 + 姓名 + 标签 */}
      <View className="flex items-center gap-[20rpx]">
        <View className="relative w-[112rpx] h-[112rpx] rounded-full border-[4rpx] border-solid border-white shadow-soft bg-white overflow-hidden">
          <StudentAvatar name={student.name} src={student.avatar_url} size="lg" className="w-full h-full" />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-[34rpx] font-bold text-foreground truncate block">
            {student.name}
          </Text>
          <Text className="mt-[8rpx] text-[24rpx] text-muted-foreground truncate block">
            {(student.campus_name || student.campus_id) ?? '未分配校区'}
          </Text>
        </View>
        <View
          className="w-[88rpx] h-[88rpx] rounded-2xl bg-primary-bg center active:bg-primary-10 press-scale"
          onClick={(e) => {
            e.stopPropagation();
            onInviteRelatives(student);
          }}
        >
          <Icon name="mdi-share-variant-outline" size={36} color="primary" />
        </View>
      </View>

      {/* 基础信息列表 */}
      <View className="mt-[24rpx] flex flex-col">
        <InfoRow label="性别" value={genderLabel} />
        <InfoRow label="生日" value={birthdayLabel} />
        <InfoRow
          label="学员邀请码"
          value={student.invite_code}
          copyable={Boolean(student.invite_code && student.invite_code !== '请联系老师')}
        />
        <InfoRow label="所属校区" value={student.campus_name || '由教师分配'} />
      </View>

      {/* 底部按钮：邀请亲属 */}
      <View
        className={cn(
          'mt-[28rpx] flex items-center justify-center gap-[8rpx] py-[22rpx] rounded-2xl press-scale',
          'bg-primary-bg text-primary',
        )}
        onClick={(e) => {
          e.stopPropagation();
          onInviteRelatives(student);
        }}
      >
        <Icon name="mdi-account-multiple-plus-outline" size="sm" color="primary" />
        <Text className="text-[28rpx] font-semibold text-primary">邀请亲属查看</Text>
      </View>
    </View>
  );
};

/* ============================================
 * 信息行
 * ============================================ */
interface InfoRowProps {
  label: string;
  value: string;
  copyable?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, copyable }) => {
  const handleCopy = useCallback(() => {
    if (!copyable) return;
    Taro.setClipboardData({ data: value });
    Taro.showToast({ title: '已复制', icon: 'success' });
  }, [copyable, value]);

  return (
    <View
      className={cn(
        'flex items-center justify-between py-[20rpx]',
        'border-t border-[1rpx] border-border/60',
      )}
    >
      <Text className="text-[26rpx] text-muted-foreground w-[180rpx] flex-shrink-0">{label}</Text>
      <View
        className={cn(
          'flex items-center gap-[12rpx] flex-1 justify-end',
          copyable && 'active:opacity-70',
        )}
        onClick={copyable ? handleCopy : undefined}
      >
        <Text
          className={cn(
            'text-[28rpx] text-right',
            value.startsWith('未') ? 'text-muted-foreground' : 'text-foreground font-medium',
          )}
        >
          {value}
        </Text>
        {copyable && <Icon name="mdi-content-copy" size="xxs" color="mutedForeground" />}
      </View>
    </View>
  );
};
