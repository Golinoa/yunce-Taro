/**
 * 老师管理列表页
 *
 * 简洁的员工列表：
 * - 顶部「在职 / 已离职」切换
 * - 老师卡片：头像、姓名、身份标签
 * - 卡片左滑露出「离职」「删除」操作按钮
 * - 底部统计文案
 * - 右下角悬浮「新增员工」按钮
 */
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageIntroSheet from '@/components/PageIntroSheet';
import SwappableScheduleCard from '@/components/schedule/SwappableScheduleCard';
import ResignSheet from '@/components/teacher/ResignSheet';
import { BRAND_LOGO } from '@/constants/brand';
import { IDENTITY_TAG_MAP, TEACHER_IDENTITY_OPTIONS } from '@/constants/teacher-ui';
import { auditLogService } from '@/services/audit-log';
import { PAGE_INTRO_STORAGE_KEYS } from '@/services/onboarding';
import { useTeacherStore } from '@/stores/teacher';
import { useThemeStore } from '@/stores/theme';
import type { ResignType, TeacherStatus, TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { useCardNavigationBar } from '@/utils/navigation-bar';

type StatusTab = Extract<TeacherStatus, 'active' | 'resigned'>;

const TAB_LIST: { key: StatusTab; label: string }[] = [
  { key: 'active', label: '在职' },
  { key: 'resigned', label: '已离职' },
];

const INTRO_STORAGE_KEY = PAGE_INTRO_STORAGE_KEYS.staff;

const TeacherListPage: React.FC = () => {
  useCardNavigationBar();
  const { profile } = useAuth();
  const { activeTheme } = useThemeStore();
  const { teachers, loading, error, fetchAll, resignTeacher, updateTeacher } = useTeacherStore();
  const [activeTab, setActiveTab] = useState<StatusTab>('active');

  // 左滑卡片互斥管理
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  // 离职弹窗
  const [resignTarget, setResignTarget] = useState<TeacherUIModel | null>(null);
  const [resignSubmitting, setResignSubmitting] = useState(false);

  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<TeacherUIModel | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // 恢复确认弹窗
  const [restoreTarget, setRestoreTarget] = useState<TeacherUIModel | null>(null);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);

  // 页面引导弹窗
  const [introVisible, setIntroVisible] = useState(false);

  useDidShow(() => {
    void fetchAll();
    try {
      const hidden = Taro.getStorageSync(INTRO_STORAGE_KEY);
      if (hidden !== true) {
        setIntroVisible(true);
      }
    } catch {
      setIntroVisible(true);
    }
  });

  const list = useMemo(() => teachers.filter((t) => t.status === activeTab), [teachers, activeTab]);

  const countText = useMemo(() => {
    const label = activeTab === 'active' ? '在职员工' : '已离职员工';
    return `共${list.length}位${label}`;
  }, [list.length, activeTab]);

  const handleAdd = useCallback(() => {
    Taro.navigateTo({ url: '/package-teacher/pages/teacher-form/index' });
  }, []);

  const handleEdit = useCallback((id: string) => {
    Taro.navigateTo({ url: `/package-teacher/pages/teacher-form/index?id=${id}` });
  }, []);

  // 切换 Tab 时收起所有已展开的滑动按钮
  const handleTabChange = useCallback((tab: StatusTab) => {
    setActiveTab(tab);
    setOpenCardId(null);
  }, []);

  // 离职确认
  const handleResignConfirm = useCallback(
    async (type: ResignType, reason?: string) => {
      if (!resignTarget) return;
      setResignSubmitting(true);
      try {
        await resignTeacher(resignTarget.id, type, reason);
        // 审计日志（用户口径 2026-08-22）：教师离职属人事变更
        try {
          await auditLogService.record({
            action: 'staff.resign',
            operatorId: profile?.id || '',
            operatorName: profile?.name || '未知',
            operatorRole: profile?.currentContext?.role || 'unknown',
            targetType: 'teacher',
            targetId: resignTarget.id,
            detail: `教师离职：「${resignTarget.name}」（${type === 'quit' ? '主动离职' : type === 'dismiss' ? '机构辞退' : type === 'expire' ? '合同到期' : '其他'}）${reason ? `，原因：${reason}` : ''}`,
            meta: {
              teacherId: resignTarget.id,
              teacherName: resignTarget.name,
              resignType: type,
              reason: reason || undefined,
            },
          });
        } catch (e) {
          logError('audit staff.resign', e);
        }
        Taro.showToast({ title: '已标记离职', icon: 'success' });
        setResignTarget(null);
        // 切换到已离职 Tab，避免在职列表闪烁空态
        setActiveTab('resigned');
      } catch {
        Taro.showToast({ title: '操作失败', icon: 'none' });
      } finally {
        setResignSubmitting(false);
      }
    },
    [resignTarget, resignTeacher, profile],
  );

  // 删除确认
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      // 将教师标记为已删除（通过 updateTeacher 将 status 设为 resigned 并添加备注）
      // 当前 mock 无物理删除，采用"标记删除"策略：更新名称为"已删除"
      await updateTeacher(deleteTarget.id, {
        status: 'resigned',
        resignType: 'dismiss',
        resignReason: '管理员删除',
        resignDate: new Date().toISOString().slice(0, 10),
      });
      Taro.showToast({ title: '已删除', icon: 'success' });
      setDeleteTarget(null);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteTarget, updateTeacher]);

  // 恢复在职
  const handleRestoreConfirm = useCallback(async () => {
    if (!restoreTarget) return;
    setRestoreSubmitting(true);
    try {
      await updateTeacher(restoreTarget.id, {
        status: 'active',
        resignType: undefined,
        resignReason: undefined,
        resignDate: undefined,
      });
      Taro.showToast({ title: '已恢复在职', icon: 'success' });
      setRestoreTarget(null);
      // 切换到在职 Tab，避免已离职列表闪烁空态
      setActiveTab('active');
    } catch {
      Taro.showToast({ title: '恢复失败', icon: 'none' });
    } finally {
      setRestoreSubmitting(false);
    }
  }, [restoreTarget, updateTeacher]);

  if (loading && !teachers.length) {
    return (
      <View
        className={cn(
          `theme-${activeTheme}`,
          'flex flex-col h-screen bg-background items-center justify-center',
        )}
      >
        <Loading text="加载老师数据中..." />
      </View>
    );
  }

  if (error && !teachers.length) {
    return (
      <View
        className={cn(
          `theme-${activeTheme}`,
          'flex flex-col h-screen bg-background px-[32rpx] items-center justify-center',
        )}
      >
        <Empty description={error} actionText="重新加载" onAction={() => void fetchAll()} />
      </View>
    );
  }

  return (
    <View className={cn(`theme-${activeTheme}`, 'flex flex-col h-screen bg-background')}>
      {/* 状态切换 Tab */}
      <View className="flex flex-row items-center justify-center py-[24rpx]">
        <View className="flex flex-row items-center bg-muted rounded-full p-[6rpx]">
          {TAB_LIST.map((tab) => (
            <View
              key={tab.key}
              className={cn(
                'px-[40rpx] py-[14rpx] rounded-full transition-all',
                activeTab === tab.key ? 'bg-primary shadow-soft' : 'bg-transparent',
              )}
              onClick={() => handleTabChange(tab.key)}
            >
              <Text
                className={cn(
                  'text-[28rpx] font-medium',
                  activeTab === tab.key ? 'text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {tab.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 老师列表 */}
      <ScrollView
        scrollY
        enhanced
        scrollWithAnimation
        className="flex-1 px-[32rpx] pb-[200rpx]"
        onScroll={() => setOpenCardId(null)}
      >
        {list.length === 0 ? (
          <View className="pt-[120rpx]">
            <Empty description={`暂无${activeTab === 'active' ? '在职' : '已离职'}员工`} />
          </View>
        ) : (
          <View className="flex flex-col gap-[20rpx]">
            {list.map((teacher) => (
              <SwappableTeacherCard
                key={teacher.id}
                teacher={teacher}
                openCardId={openCardId}
                onOpenChange={setOpenCardId}
                onClick={() => handleEdit(teacher.id)}
                onResign={() => setResignTarget(teacher)}
                onRestore={() => setRestoreTarget(teacher)}
                onDelete={() => setDeleteTarget(teacher)}
              />
            ))}
          </View>
        )}

        {/* 底部统计 */}
        {list.length > 0 && (
          <View className="flex flex-row items-center justify-center py-[40rpx]">
            <Text className="text-[26rpx] text-muted-foreground">{countText}</Text>
          </View>
        )}
      </ScrollView>

      {/* 新增员工悬浮按钮 */}
      <View
        className="fixed right-[32rpx] bottom-[calc(64rpx+env(safe-area-inset-bottom))] flex flex-row items-center gap-[8rpx] px-[28rpx] py-[18rpx] rounded-full bg-primary shadow-float press-scale"
        onClick={handleAdd}
      >
        <Icon name="mdi-plus" size={28} color="hsl(var(--primary-foreground))" />
        <Text className="text-[28rpx] font-medium text-primary-foreground">新增员工</Text>
      </View>

      {/* 离职确认弹窗 */}
      <ResignSheet
        visible={!!resignTarget}
        teacherName={resignTarget?.name || ''}
        submitting={resignSubmitting}
        onConfirm={handleResignConfirm}
        onClose={() => setResignTarget(null)}
      />

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="确认删除"
        description={`删除后「${deleteTarget?.name || ''}」将从列表中消失，且不可恢复。确认删除？`}
        confirmText="删除"
        tone="danger"
        confirmLoading={deleteSubmitting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* 恢复在职确认弹窗 */}
      <ConfirmDialog
        visible={!!restoreTarget}
        title="确认恢复"
        description={`将「${restoreTarget?.name || ''}」恢复为在职状态？`}
        confirmText="恢复"
        tone="primary"
        confirmLoading={restoreSubmitting}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestoreConfirm}
      />

      {/* 页面引导弹窗 */}
      <PageIntroSheet
        visible={introVisible}
        onClose={() => setIntroVisible(false)}
        storageKey={INTRO_STORAGE_KEY}
        currentStep={3}
        totalSteps={6}
        title="第 3 步：添加员工 / 授课人员"
        description="员工分 3 种角色，绑定手机号后即可用该号码登录小程序处理工作。"
        bulletPoints={[
          '授课人员：只能看自己排到的课、签到 / 取消签到、查自己的工资',
          '前台：可帮所有会员预约 / 签到、开卡续费收银，但看不到工资 / 门店设置',
          '店长：拥有门店全部权限，包括员工、卡种、营销、财务',
          '一个手机号只能绑 1 个员工身份，不能既当授课人员又当前台 —— 同一人多角色请用不同手机号',
        ]}
      />
    </View>
  );
};

/** 可左滑操作的老师卡片 */
const SwappableTeacherCard: React.FC<{
  teacher: TeacherUIModel;
  openCardId: string | null;
  onOpenChange: (id: string | null) => void;
  onClick: () => void;
  onResign: () => void;
  onRestore: () => void;
  onDelete: () => void;
}> = ({ teacher, openCardId, onOpenChange, onClick, onResign, onRestore, onDelete }) => {
  const identityKey = teacher.identity || 'teacher';
  const identityOption = TEACHER_IDENTITY_OPTIONS.find((o) => o.value === identityKey);
  const identityLabel = identityOption?.label || '老师';
  const tagStyle = IDENTITY_TAG_MAP[identityKey];
  const isActive = teacher.status === 'active';

  /** 左滑操作按钮：在职显示「离职+删除」，已离职显示「恢复+删除」 */
  const actions = useMemo(() => {
    const items: Array<{
      label: string;
      onClick: () => void;
      disabled?: boolean;
      variant?: 'default' | 'danger' | 'warning';
    }> = [];
    if (isActive) {
      items.push({ label: '离职', onClick: onResign, variant: 'warning' });
    } else {
      items.push({ label: '恢复', onClick: onRestore, variant: 'default' });
    }
    items.push({ label: '删除', onClick: onDelete, variant: 'danger' });
    return items;
  }, [isActive, onResign, onRestore, onDelete]);

  return (
    <SwappableScheduleCard
      cardId={teacher.id}
      openCardId={openCardId}
      onOpenChange={onOpenChange}
      actions={actions}
      onClick={onClick}
      radiusClassName="rounded-[24rpx]"
    >
      <View className="bg-card px-[28rpx] py-[24rpx] flex flex-row items-center gap-[24rpx]">
        <View className="w-[100rpx] h-[100rpx] rounded-full p-[4rpx] border-[2rpx] border-primary bg-card shrink-0">
          <Image
            className="w-full h-full rounded-full"
            src={BRAND_LOGO}
            mode="aspectFill"
            lazyLoad
          />
        </View>

        <View className="flex-1 min-w-0 flex flex-col gap-[8rpx]">
          <View className="flex flex-row items-center gap-[12rpx]">
            <Text className="text-[32rpx] font-medium text-foreground">{teacher.name}</Text>
            <View className={cn('px-[12rpx] py-[4rpx] rounded-[8rpx]', tagStyle.bg)}>
              <Text className={cn('text-[22rpx] font-medium leading-none', tagStyle.text)}>
                {identityLabel}
              </Text>
            </View>
          </View>
          <Text className="text-[26rpx] text-muted-foreground">{teacher.classes} 个班级</Text>
        </View>

        <Icon name="mdi-chevron-right" size={32} color="muted" />
      </View>
    </SwappableScheduleCard>
  );
};

export default TeacherListPage;
