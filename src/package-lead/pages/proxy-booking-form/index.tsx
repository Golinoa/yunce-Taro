import { Input, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useLoad } from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import PackageSelectSheet from '@/components/proxy-booking/PackageSelectSheet';
import type { PackageOption } from '@/components/proxy-booking/PackageSelectSheet';
import { homeService, leadService, teacherService } from '@/services';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';

const MEMBER_SELECT_RESULT_KEY = 'yunce:proxy-member-select:result';

/**
 * 添加代约页面
 *
 * 从老师时段管理页或记录页进入，点击加号打开双 Tab 弹窗选择线索/会员，
 * 一次选一个，支持多次添加，统一提交创建试听预约。
 */

interface PageParams {
  teacherId?: string;
  date?: string;
  time?: string;
  endTime?: string;
  mode?: 'group' | 'private';
  classId?: string;
  className?: string;
  /** 班级科目 ID，用于默认选中同科目会员卡 */
  subjectId?: string;
}

interface SelectedUser {
  id: string;
  name: string;
  type: 'member' | 'lead';
  subTitle?: string;
  avatarUrl?: string;
  packageId?: string;
  packageName?: string;
}

const TIME_OPTIONS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
  '21:30',
];

/** 计算结束时间：startTime + 30分钟，纯数学运算避免 dayjs 链式调用在小程序运行时报错 */
function computeEndTime(startTime: string): string {
  const index = TIME_OPTIONS.indexOf(startTime);
  if (index >= 0 && index < TIME_OPTIONS.length - 1) {
    return TIME_OPTIONS[index + 1];
  }
  const [hour, minute] = startTime.split(':').map(Number);
  const totalMinutes = hour * 60 + minute + 30;
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
}

const AddProxyBookingPage: React.FC = () => {
  const { profile } = useAuth();
  const [params, setParams] = useState<PageParams>({});
  const [teacher, setTeacher] = useState<TeacherUIModel | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [note, setNote] = useState('');
  const [memberPackages, setMemberPackages] = useState<Record<string, PackageOption[]>>({});
  const [packageSheet, setPackageSheet] = useState<{
    visible: boolean;
    memberId?: string;
    memberName?: string;
    selectedId?: string;
  }>({ visible: false });

  useLoad((options) => {
    const opt = options as Record<string, string>;
    setParams({
      teacherId: opt.teacherId,
      date: opt.date ? decodeURIComponent(opt.date) : undefined,
      time: opt.time ? decodeURIComponent(opt.time) : undefined,
      endTime: opt.endTime ? decodeURIComponent(opt.endTime) : undefined,
      mode: (opt.mode as 'group' | 'private') || 'private',
      classId: opt.classId,
      className: opt.className ? decodeURIComponent(opt.className) : undefined,
      subjectId: opt.subjectId ? decodeURIComponent(opt.subjectId) : undefined,
    });
  });

  const operatorId = profile?.id || '';
  const campusId = profile?.currentContext?.campusId || '';

  useEffect(() => {
    const loadData = async () => {
      if (!params.teacherId || !campusId) return;
      try {
        const list = await teacherService.getList();
        const t = list.find((item) => item.id === params.teacherId) || null;
        setTeacher(t);
      } catch {
        Taro.showToast({ title: '加载老师信息失败', icon: 'none' });
      }
    };
    void loadData();
  }, [campusId, params.teacherId]);

  // 为已选会员自动加载会员卡列表
  useEffect(() => {
    const loadPackages = async () => {
      const memberIds = selectedUsers.filter((u) => u.type === 'member').map((u) => u.id);
      const missingIds = memberIds.filter((id) => !memberPackages[id]);
      if (missingIds.length === 0) return;

      const results = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const list = await homeService.getPackagesByStudent(id);
            const options: PackageOption[] = list
              .filter((pkg) => (pkg.status || 'active') === 'active')
              .map((pkg) => ({
                id: pkg.id,
                name: pkg.name,
                remainingHours: pkg.remainingHours ?? pkg.totalHours ?? 0,
                subjectId: pkg.subjectId,
              }));
            return { id, options };
          } catch {
            return { id, options: [] };
          }
        }),
      );

      setMemberPackages((prev) => {
        const next = { ...prev };
        results.forEach(({ id, options }) => {
          next[id] = options;
        });
        return next;
      });
    };
    void loadPackages();
  }, [selectedUsers, memberPackages]);

  // 自动选中会员卡：优先匹配课程科目，其次仅有一张卡时默认选中
  useEffect(() => {
    setSelectedUsers((prev) =>
      prev.map((user) => {
        if (user.type !== 'member' || user.packageId) return user;
        const options = memberPackages[user.id];
        if (!options || options.length === 0) return user;

        let target = options[0];
        if (params.subjectId) {
          const matched = options.find((item) => item.subjectId === params.subjectId);
          if (matched) target = matched;
        }
        return { ...user, packageId: target.id, packageName: target.name };
      }),
    );
  }, [memberPackages, params.subjectId]);

  const selectedMemberIds = useMemo(
    () => selectedUsers.filter((u) => u.type === 'member').map((u) => u.id),
    [selectedUsers],
  );
  const selectedLeadIds = useMemo(
    () => selectedUsers.filter((u) => u.type === 'lead').map((u) => u.id),
    [selectedUsers],
  );

  /** 从选择会员页面返回：将新选会员追加到已选列表（去重） */
  const handleMembersConfirm = useCallback((newMembers: SelectedUser[]) => {
    setSelectedUsers((prev) => {
      const existingIds = new Set(prev.map((u) => u.id));
      const append = newMembers.filter((m) => !existingIds.has(m.id));
      return [...prev, ...append];
    });
  }, []);

  /** 进入选择会员页面，已选会员不再展示 */
  const handleAddMember = useCallback(() => {
    if (!params.teacherId) {
      Taro.showToast({ title: '缺少老师信息', icon: 'none' });
      return;
    }
    const excludedIds = encodeURIComponent(selectedUsers.map((u) => u.id).join(','));
    void Taro.navigateTo({
      url: `/package-lead/pages/proxy-member-select/index?teacherId=${encodeURIComponent(params.teacherId)}&excludedIds=${excludedIds}`,
    });
  }, [params.teacherId, selectedUsers]);

  /** 从本地存储读取选择结果 */
  useDidShow(() => {
    try {
      const raw = Taro.getStorageSync<string>(MEMBER_SELECT_RESULT_KEY);
      if (!raw) return;
      Taro.removeStorageSync(MEMBER_SELECT_RESULT_KEY);
      const parsed = JSON.parse(raw) as Array<{
        id: string;
        name: string;
        avatarUrl?: string;
        phone?: string;
      }>;
      const newMembers: SelectedUser[] = parsed.map((m) => ({
        id: m.id,
        name: m.name,
        type: 'member' as const,
        subTitle: m.phone,
        avatarUrl: m.avatarUrl,
      }));
      handleMembersConfirm(newMembers);
    } catch {
      // 忽略解析失败
    }
  });

  const handleOpenPackageSheet = useCallback((user: SelectedUser) => {
    setPackageSheet({
      visible: true,
      memberId: user.id,
      memberName: user.name,
      selectedId: user.packageId,
    });
  }, []);

  const handlePackageConfirm = useCallback(
    (pkg: PackageOption) => {
      const memberId = packageSheet.memberId;
      if (!memberId) return;
      setPackageSheet((prev) => ({ ...prev, visible: false }));
      setSelectedUsers((prev) =>
        prev.map((u) =>
          u.id === memberId ? { ...u, packageId: pkg.id, packageName: pkg.name } : u,
        ),
      );
    },
    [packageSheet.memberId],
  );

  const handleRemoveUser = useCallback((id: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!params.teacherId || !params.date || !params.time || !campusId) {
      Taro.showToast({ title: '缺少预约信息', icon: 'none' });
      return;
    }
    if (selectedUsers.length === 0) {
      Taro.showToast({ title: '请至少选择一位代约用户', icon: 'none' });
      return;
    }

    // 校验每个会员都已选择要消耗的会员卡
    const membersWithoutPackage = selectedUsers.filter((u) => u.type === 'member' && !u.packageId);
    if (membersWithoutPackage.length > 0) {
      Taro.showToast({
        title: `请为 ${membersWithoutPackage[0].name} 选择会员卡`,
        icon: 'none',
      });
      return;
    }

    const memberPackagesMap: Record<string, string> = {};
    selectedUsers.forEach((u) => {
      if (u.type === 'member' && u.packageId) {
        memberPackagesMap[u.id] = u.packageId;
      }
    });

    setSubmitting(true);
    try {
      await leadService.batchCreateProxyBookings({
        memberIds: selectedMemberIds,
        leadIds: selectedLeadIds,
        memberPackages: memberPackagesMap,
        teacherId: params.teacherId,
        teacherName: teacher?.name,
        lessonDate: params.date,
        startTime: params.time,
        endTime: computeEndTime(params.time),
        courseId: 'course-default',
        courseName: '体验课',
        campusId,
        trialMode: params.mode || 'private',
        operatorId,
        note,
      });
      Taro.showToast({ title: '代约成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({ title: '代约失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    campusId,
    note,
    operatorId,
    params.date,
    params.mode,
    params.teacherId,
    params.time,
    selectedLeadIds,
    selectedMemberIds,
    selectedUsers,
    teacher?.name,
  ]);

  const endTimeText = params.endTime || computeEndTime(params.time || '');
  const courseTagText = params.mode === 'group' ? '团课' : '私教';
  const submitText =
    selectedUsers.length > 0 ? `立即代约（${selectedUsers.length}人）` : '立即代约';

  return (
    <View className="flex h-screen flex-col bg-background">
      <ScrollView scrollY className="flex-1 px-[24rpx] py-[24rpx]">
        {/* 课程信息 */}
        <View className="mb-[32rpx] flex flex-col items-center gap-[12rpx] px-[24rpx] pt-[16rpx]">
          <View className="flex items-center gap-[12rpx]">
            <Text className="text-[40rpx] font-bold leading-tight text-foreground">
              {params.className || '体验课'}
            </Text>
            <View className="rounded-[8rpx] bg-[#ff8a4c] px-[12rpx] py-[4rpx]">
              <Text className="text-[22rpx] font-medium text-white">{courseTagText}</Text>
            </View>
          </View>
          <Text className="text-[28rpx] leading-normal text-muted-foreground">
            开课时间 {params.time || '--:--'}-{endTimeText} ({params.date || '--'})
          </Text>
        </View>

        {/* 已选会员卡片 */}
        {selectedUsers.length > 0 && (
          <View className="mb-[24rpx] flex flex-col gap-[20rpx]">
            {selectedUsers.map((user) => (
              <View
                key={`${user.type}-${user.id}`}
                className="rounded-[24rpx] bg-card px-[28rpx] py-[28rpx]"
              >
                <View className="flex items-center justify-between">
                  <View className="flex items-center gap-[20rpx]">
                    <Avatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
                    <Text className="text-[32rpx] font-semibold text-foreground">{user.name}</Text>
                  </View>
                  <View
                    className="rounded-[8rpx] px-[16rpx] py-[8rpx] active:bg-muted"
                    onClick={() => handleRemoveUser(user.id)}
                  >
                    <Text className="text-[26rpx] text-[#ff8a4c]">移除</Text>
                  </View>
                </View>

                <View
                  className="mt-[24rpx] flex items-center justify-between border-t border-border-light pt-[20rpx]"
                  onClick={() => handleOpenPackageSheet(user)}
                >
                  <Text className="text-[28rpx] text-foreground">会员卡</Text>
                  <View className="flex items-center gap-[8rpx]">
                    <Text
                      className={cn(
                        'text-[28rpx]',
                        user.packageName ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {user.packageName || '请选择会员卡'}
                    </Text>
                    <Icon name="mdi-chevron-right" size={24} className="text-muted-foreground" />
                  </View>
                </View>

                <View className="mt-[20rpx] flex items-center justify-between border-t border-border-light pt-[20rpx]">
                  <Text className="text-[28rpx] text-foreground">预约人次</Text>
                  <View className="flex items-center gap-[20rpx]">
                    <View className="center h-[48rpx] w-[48rpx] rounded-full bg-muted active:opacity-80">
                      <Icon name="mdi-minus" size={20} className="text-muted-foreground" />
                    </View>
                    <Text className="min-w-[40rpx] text-center text-[32rpx] font-semibold text-foreground">
                      1
                    </Text>
                    <View className="center h-[48rpx] w-[48rpx] rounded-full bg-[#ff8a4c] active:opacity-80">
                      <Icon name="mdi-plus" size={20} className="text-white" />
                    </View>
                  </View>
                </View>

                <View className="mt-[20rpx] flex items-center justify-between border-t border-border-light pt-[20rpx]">
                  <Text className="text-[28rpx] text-foreground">本次扣减</Text>
                  <Text className="text-[32rpx] font-semibold text-foreground">1</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 添加会员按钮 */}
        <View
          className="mb-[24rpx] flex items-center justify-center gap-[12rpx] rounded-[24rpx] bg-card py-[30rpx] active:bg-muted"
          onClick={handleAddMember}
        >
          <Icon name="mdi-plus" size={28} className="text-[#ff8a4c]" />
          <Text className="text-[30rpx] font-medium text-[#ff8a4c]">添加会员</Text>
        </View>

        {/* 备注 */}
        <View className="rounded-[24rpx] bg-card px-[28rpx] py-[28rpx] mb-[24rpx]">
          <Input
            className="h-[120rpx] text-[28rpx] leading-normal text-foreground"
            placeholder="请输入备注（非必填项）"
            placeholderClass="text-muted-foreground"
            value={note}
            onInput={(e) => setNote(e.detail.value || '')}
          />
        </View>
      </ScrollView>

      {/* 底部提交按钮 */}
      <View className="flex-shrink-0 px-[32rpx] pb-safe-bar pt-[20rpx]">
        <View
          className={cn(
            'h-[88rpx] rounded-full center text-[32rpx] font-medium transition-colors',
            selectedUsers.length > 0 && !submitting
              ? 'bg-[#ff8a4c] text-white'
              : 'bg-[#e0e0e0] text-white',
          )}
          onClick={handleSubmit}
        >
          {submitting ? '提交中...' : submitText}
        </View>
      </View>

      {/* 会员卡选择弹窗 */}
      <PackageSelectSheet
        visible={packageSheet.visible}
        memberName={packageSheet.memberName}
        options={packageSheet.memberId ? memberPackages[packageSheet.memberId] || [] : []}
        selectedId={packageSheet.selectedId}
        onClose={() => setPackageSheet((prev) => ({ ...prev, visible: false }))}
        onConfirm={handlePackageConfirm}
      />
    </View>
  );
};

definePageConfig({
  navigationBarTitleText: '添加代约',
});

export default AddProxyBookingPage;
