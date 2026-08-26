/**
 * 子女详情页 pages/child-detail/index
 *
 * 家长端点击子女卡片进入，展示子女资料、邀请监护人、卡包、出勤。
 * 不进入教师端的学员详情，保持轻量和家长视角。
 *
 * 全部使用 UnoCSS Token，随主题色联动。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, useLoad } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import SegmentedControl from '@/components/SegmentedControl';
import { lessonRecordService, packageService, studentService } from '@/services';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student, StudentParent } from '@/types/student';
import { useCardNavigationBar } from '@/utils/navigation-bar';

type TabKey = 'guardians' | 'packages' | 'records';

type Gender = 'male' | 'female' | 'other';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'guardians', label: '邀请监护人' },
  { key: 'packages', label: '卡包' },
  { key: 'records', label: '出勤' },
];

const GENDER_LABEL: Record<Gender, string> = { male: '男', female: '女', other: '其他' };

/** 状态文本映射 */
const RECORD_STATUS_TEXT: Record<string, string> = {
  normal: '正常上课',
  cancelled: '已撤销',
  makeup: '补课',
  leave: '请假',
  absent: '缺勤',
};

/** 格式化日期 */
function formatDate(date?: string): string {
  if (!date) return '-';
  const d = dayjs(date);
  return d.isValid() ? d.format('YYYY-MM-DD') : '-';
}

/** 课包状态文本 */
function packageStatusText(status: CoursePackage['status']): string {
  switch (status) {
    case 'active':
      return '使用中';
    case 'completed':
      return '已用完';
    case 'expired':
      return '已过期';
    case 'frozen':
      return '已冻结';
    default:
      return '未知';
  }
}

/** 生成邀请码 */
function getInviteCode(student: Student): string {
  return student.invite_code || `INV-${student.id.slice(-4).toUpperCase()}`;
}

const ChildDetail: React.FC = () => {
  useCardNavigationBar();

  const [studentId, setStudentId] = useState<string>('');
  const [student, setStudent] = useState<Student | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('guardians');

  const [packages, setPackages] = useState<CoursePackage[]>([]);
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [guardians, setGuardians] = useState<StudentParent[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingGuardians, setLoadingGuardians] = useState(false);

  // 加载学员详情
  const loadStudent = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingStudent(true);
    try {
      const detail = await studentService.getById(id);
      setStudent(detail);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('加载学员详情失败', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoadingStudent(false);
    }
  }, []);

  // 加载监护人列表
  const loadGuardians = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingGuardians(true);
    try {
      const list = await studentService.getParents(id);
      setGuardians(list);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('加载监护人失败', err);
    } finally {
      setLoadingGuardians(false);
    }
  }, []);

  // 加载课包和消课记录
  const loadData = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingData(true);
    try {
      const [pkgs, recs] = await Promise.all([
        packageService.getByStudent(id),
        lessonRecordService.getByStudent(id),
      ]);
      setPackages(pkgs);
      setRecords(
        recs
          .filter((r) => r.lesson_date)
          .sort((a, b) => dayjs(b.lesson_date).valueOf() - dayjs(a.lesson_date).valueOf()),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('加载课包/记录失败', err);
      Taro.showToast({ title: '数据加载失败', icon: 'none' });
    } finally {
      setLoadingData(false);
    }
  }, []);

  // 页面加载时解析参数并加载数据
  useLoad((options) => {
    const id = options?.id;
    if (!id) {
      Taro.showToast({ title: '缺少学员 ID', icon: 'none' });
      return;
    }
    setStudentId(id);
    loadStudent(id);
    loadGuardians(id);
    loadData(id);
  });

  // 返回页面时刷新
  useDidShow(() => {
    if (studentId) {
      loadStudent(studentId);
      loadGuardians(studentId);
      loadData(studentId);
    }
  });

  // 统计
  const stats = useMemo(() => {
    const lessonCount = records.filter(
      (r) => (r.hours_used || 0) > 0 && r.status !== 'cancelled',
    ).length;
    return {
      lessonCount,
      packageCount: packages.length,
    };
  }, [records, packages]);

  const relation = student?.relation || '子女';

  // 复制邀请码
  const handleCopyInviteCode = useCallback(() => {
    if (!student) return;
    const code = getInviteCode(student);
    Taro.setClipboardData({
      data: code,
      success: () => Taro.showToast({ title: '邀请码已复制', icon: 'success' }),
    });
  }, [student]);

  // 分享邀请码（小程序分享）
  const handleShareInvite = useCallback(() => {
    if (!student) return;
    const code = getInviteCode(student);
    // 优先使用微信分享，降级为复制
    Taro.showShareMenu({ withShareTicket: true });
    Taro.showToast({
      title: '请点击右上角「···」分享',
      icon: 'none',
      duration: 2000,
    });
    // 同时把邀请码写入剪贴板，方便粘贴
    Taro.setClipboardData({ data: code });
  }, [student]);

  return (
    <View className="min-h-screen bg-background flex flex-col pb-[env(safe-area-inset-bottom)]">
      {/* ====== 顶部导航 ====== */}
      <View className="sticky top-0 z-50 bg-card border-b border-border">
        <View className="pt-nav-safe">
          <View className="relative h-[88rpx] flex items-center justify-center">
            <View
              className="absolute left-[32rpx] flex items-center justify-center w-[64rpx] h-[64rpx] rounded-full active:bg-muted/60"
              onClick={() => Taro.navigateBack()}
            >
              <Icon name="mdi-chevron-left" size={40} color="foreground" />
            </View>
            <Text className="text-[34rpx] font-bold text-foreground">子女详情</Text>
          </View>
        </View>
      </View>

      <ScrollView scrollY className="flex-1" showScrollbar={false}>
        {loadingStudent && !student ? (
          <View className="py-[160rpx]">
            <Loading text="加载中..." />
          </View>
        ) : !student ? (
          <View className="py-[160rpx] px-[32rpx]">
            <Empty icon="mdi-account-question-outline" description="未找到子女信息" />
          </View>
        ) : (
          <View className="px-[32rpx] pt-[24rpx] pb-[40rpx] flex flex-col gap-[24rpx]">
            {/* ====== 基本信息卡片 ====== */}
            <View className="bg-card rounded-[28rpx] shadow-soft overflow-hidden">
              {/* 顶部主题色横条 */}
              <View className="h-[12rpx] bg-gradient-primary" />

              <View className="p-[32rpx]">
                {/* 头像 + 姓名行 */}
                <View className="flex items-center gap-[24rpx]">
                  <View className="relative flex-shrink-0">
                    <Avatar
                      name={student.name}
                      avatarUrl={student.avatar_url}
                      size="lg"
                      className="border-[4rpx] border-white shadow-float"
                    />
                    <View className="absolute -bottom-[4rpx] -right-[4rpx] w-[36rpx] h-[36rpx] rounded-full bg-gradient-primary center border-[3rpx] border-white">
                      <Icon
                        name={
                          student.gender === 'male'
                            ? 'mdi-gender-male'
                            : student.gender === 'female'
                              ? 'mdi-gender-female'
                              : 'mdi-account-child'
                        }
                        size={18}
                        color="white"
                      />
                    </View>
                  </View>

                  <View className="flex-1 min-w-0">
                    <Text className="text-[40rpx] font-bold text-foreground truncate block leading-tight">
                      {student.nickname || student.name}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground mt-[8rpx]">
                      {student.name}
                    </Text>
                    <View className="flex items-center gap-[12rpx] mt-[14rpx]">
                      <View className="tag-primary">
                        <Text>{relation}</Text>
                      </View>
                      <View className="tag-amber">
                        <Text>主监护人</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 统计数据 */}
                <View className="mt-[32rpx] pt-[24rpx] border-t border-border/60 grid grid-cols-3 gap-[16rpx]">
                  <View className="bg-background rounded-[20rpx] p-[20rpx] center-col">
                    <Text className="text-[32rpx] font-bold text-foreground leading-none">
                      {student.gender ? GENDER_LABEL[student.gender] : '未设置'}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground mt-[10rpx]">性别</Text>
                  </View>
                  <View className="bg-background rounded-[20rpx] p-[20rpx] center-col">
                    <Text className="text-[32rpx] font-bold text-primary leading-none">
                      {stats.lessonCount}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground mt-[10rpx]">上课次数</Text>
                  </View>
                  <View className="bg-background rounded-[20rpx] p-[20rpx] center-col">
                    <Text className="text-[32rpx] font-bold text-primary leading-none">
                      {stats.packageCount}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground mt-[10rpx]">持卡数量</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ====== Tab 切换 ====== */}
            <SegmentedControl
              options={TABS.map((tab) => ({ label: tab.label, value: tab.key }))}
              value={activeTab}
              onChange={(value) => setActiveTab(value as TabKey)}
            />

            {/* ====== Tab 内容 ====== */}
            {activeTab === 'guardians' && (
              <View className="flex flex-col gap-[24rpx]">
                {/* 邀请卡片 */}
                <View className="bg-gradient-primary rounded-[28rpx] p-[32rpx] shadow-elegant text-white relative overflow-hidden">
                  {/* 装饰圆 */}
                  <View className="absolute -top-[40rpx] -right-[40rpx] w-[180rpx] h-[180rpx] rounded-full bg-white/10" />
                  <View className="absolute -bottom-[60rpx] -left-[40rpx] w-[140rpx] h-[140rpx] rounded-full bg-white/8" />

                  <View className="relative z-10">
                    <View className="flex items-center gap-[12rpx] mb-[12rpx]">
                      <Icon name="mdi-account-multiple-plus" size={28} color="white" />
                      <Text className="text-[30rpx] font-bold">邀请家人一起绑定</Text>
                    </View>
                    <Text className="text-[24rpx] text-white/80 mb-[28rpx] leading-relaxed">
                      把邀请码分享给家人，对方绑定后即可共同管理孩子的课程与卡包
                    </Text>

                    {/* 邀请码 */}
                    <View className="bg-white/15 backdrop-blur rounded-[20rpx] p-[24rpx] flex items-center justify-between mb-[24rpx] border border-white/20">
                      <View>
                        <Text className="text-[22rpx] text-white/70 mb-[8rpx]">邀请码</Text>
                        <Text className="text-[38rpx] font-bold tracking-[4rpx]">
                          {getInviteCode(student)}
                        </Text>
                      </View>
                      <View
                        className="flex items-center gap-[8rpx] px-[22rpx] py-[12rpx] rounded-full bg-white/20 press-scale"
                        onClick={handleCopyInviteCode}
                      >
                        <Icon name="mdi-content-copy" size={20} color="white" />
                        <Text className="text-[24rpx] font-medium">复制</Text>
                      </View>
                    </View>

                    {/* 邀请按钮 */}
                    <View
                      className="h-[88rpx] rounded-[24rpx] bg-white center press-scale"
                      onClick={handleShareInvite}
                    >
                      <View className="flex items-center gap-[12rpx]">
                        <Icon name="mdi-share-variant" size={28} color="primary" />
                        <Text className="text-[30rpx] font-bold text-primary">邀请家人</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 已绑定监护人 */}
                <View className="bg-card rounded-[28rpx] p-[28rpx] shadow-soft min-h-[300rpx]">
                  <View className="flex items-center justify-between mb-[20rpx]">
                    <Text className="text-[30rpx] font-bold text-foreground">已绑定监护人</Text>
                    <View className="tag-primary">
                      <Text>{guardians.length} 人</Text>
                    </View>
                  </View>

                  {loadingGuardians ? (
                    <Loading text="加载中..." />
                  ) : guardians.length === 0 ? (
                    <Empty icon="mdi-account-group-outline" description="暂无绑定监护人" />
                  ) : (
                    <View className="flex flex-col gap-[16rpx]">
                      {guardians.map((guardian) => (
                        <View
                          key={guardian.id}
                          className="flex items-center gap-[20rpx] p-[22rpx] rounded-[20rpx] bg-background border border-border/60"
                        >
                          <Avatar
                            name={guardian.parent?.name || '家长'}
                            avatarUrl={guardian.parent?.avatar_url}
                            size="md"
                          />
                          <View className="flex-1 min-w-0">
                            <View className="flex items-center gap-[12rpx]">
                              <Text className="text-[28rpx] font-semibold text-foreground truncate">
                                {guardian.parent?.name || '家长'}
                              </Text>
                              {guardian.parent_id === student.parent_id && (
                                <View className="tag-amber">
                                  <Text>主监护人</Text>
                                </View>
                              )}
                            </View>
                            {guardian.parent?.phone && (
                              <Text className="text-[24rpx] text-muted-foreground mt-[6rpx]">
                                {guardian.parent.phone}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {activeTab === 'packages' && (
              <View className="bg-card rounded-[28rpx] p-[28rpx] shadow-soft min-h-[300rpx]">
                <View className="flex items-center justify-between mb-[20rpx]">
                  <Text className="text-[30rpx] font-bold text-foreground">现有会员卡</Text>
                  <View className="tag-primary">
                    <Text>{packages.length} 张</Text>
                  </View>
                </View>

                {loadingData ? (
                  <Loading text="加载中..." />
                ) : packages.length === 0 ? (
                  <Empty icon="mdi-wallet-outline" description="暂无会员卡" />
                ) : (
                  <View className="flex flex-col gap-[16rpx]">
                    {packages.map((pkg) => (
                      <View
                        key={pkg.id}
                        className="p-[24rpx] rounded-[20rpx] bg-background border border-border/60"
                      >
                        <View className="flex items-center justify-between mb-[14rpx]">
                          <View className="flex items-center gap-[12rpx]">
                            <View className="w-[48rpx] h-[48rpx] rounded-full bg-primary/10 center">
                              <Icon name="mdi-credit-card-outline" size={24} color="primary" />
                            </View>
                            <Text className="text-[28rpx] font-semibold text-foreground">
                              {pkg.name}
                            </Text>
                          </View>
                          <View
                            className={cn(
                              'tag',
                              pkg.status === 'active'
                                ? 'tag-primary'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            <Text>{packageStatusText(pkg.status)}</Text>
                          </View>
                        </View>

                        <View className="flex items-center justify-between">
                          <View className="center-col px-[16rpx] py-[10rpx] bg-background rounded-[12rpx]">
                            <Text className="text-[28rpx] font-bold text-foreground">
                              {pkg.remaining_hours || 0}
                            </Text>
                            <Text className="text-[20rpx] text-muted-foreground mt-[4rpx]">
                              剩余课时
                            </Text>
                          </View>
                          <View className="w-[2rpx] h-[48rpx] bg-border/60" />
                          <View className="center-col px-[16rpx] py-[10rpx] bg-background rounded-[12rpx]">
                            <Text className="text-[28rpx] font-bold text-foreground">
                              {pkg.total_hours || 0}
                            </Text>
                            <Text className="text-[20rpx] text-muted-foreground mt-[4rpx]">
                              总课时
                            </Text>
                          </View>
                          <View className="w-[2rpx] h-[48rpx] bg-border/60" />
                          <View className="center-col px-[16rpx] py-[10rpx] bg-background rounded-[12rpx]">
                            <Text className="text-[28rpx] font-bold text-foreground">
                              {Math.max((pkg.total_hours || 0) - (pkg.remaining_hours || 0), 0)}
                            </Text>
                            <Text className="text-[20rpx] text-muted-foreground mt-[4rpx]">
                              已用课时
                            </Text>
                          </View>
                        </View>

                        {pkg.end_date && (
                          <Text className="text-[22rpx] text-muted-foreground mt-[14rpx]">
                            有效期至 {formatDate(pkg.end_date)}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {activeTab === 'records' && (
              <View className="bg-card rounded-[28rpx] p-[28rpx] shadow-soft min-h-[300rpx]">
                <View className="flex items-center justify-between mb-[20rpx]">
                  <Text className="text-[30rpx] font-bold text-foreground">出勤记录</Text>
                  <View className="tag-primary">
                    <Text>{records.length} 条</Text>
                  </View>
                </View>

                {loadingData ? (
                  <Loading text="加载中..." />
                ) : records.length === 0 ? (
                  <Empty icon="mdi-calendar-check-outline" description="暂无出勤记录" />
                ) : (
                  <View className="flex flex-col gap-[16rpx]">
                    {records.map((record) => (
                      <View
                        key={record.id}
                        className={cn(
                          'p-[24rpx] rounded-[20rpx] bg-background border border-border/60',
                          record.status === 'cancelled' && 'opacity-60',
                        )}
                      >
                        <View className="flex items-center justify-between mb-[12rpx]">
                          <View className="flex items-center gap-[12rpx]">
                            <View className="w-[48rpx] h-[48rpx] rounded-full bg-primary/10 center">
                              <Icon name="mdi-book-open-variant" size={24} color="primary" />
                            </View>
                            <Text className="text-[28rpx] font-semibold text-foreground">
                              {record.class_name || '课程'}
                            </Text>
                          </View>
                          <View
                            className={cn(
                              'tag',
                              record.status === 'cancelled' || record.status === 'absent'
                                ? 'bg-muted text-muted-foreground'
                                : 'tag-primary',
                            )}
                          >
                            <Text>
                              {RECORD_STATUS_TEXT[record.status || 'normal'] || '正常上课'}
                            </Text>
                          </View>
                        </View>

                        <View className="flex items-center justify-between pl-[60rpx]">
                          <Text className="text-[24rpx] text-muted-foreground">
                            {formatDate(record.lesson_date)}
                          </Text>
                          {record.status !== 'cancelled' && (
                            <Text className="text-[24rpx] text-primary font-medium">
                              -{record.hours_used || 0} 课时
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default ChildDetail;
