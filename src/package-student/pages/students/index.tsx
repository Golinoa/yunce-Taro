import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import LeadCard from '@/components/lead/LeadCard';
import MemberActionSheet from '@/components/student/MemberActionSheet';
import StudentAvatar from '@/components/student/StudentAvatar';
import { LEAD_FILTER_TAB_OPTIONS } from '@/constants/lead';
import { campusService } from '@/services/campus';
import { studentService } from '@/services/student';
import { useStudentStore } from '@/stores';
import { useLeadStore } from '@/stores/lead';
import type { LeadFilterTab } from '@/types/lead';
import type { Student, StudentSort, PackageTag } from '@/types/student';
import { SORT_OPTIONS } from '@/types/student';
import { syncAlertThresholdFromCampus } from '@/utils/alert-config';
import { isStaffRole, useAuth } from '@/utils/auth';
import {
  getStudentCardStatus,
  getCardBorderColorClass,
  getProgressGradientClass,
  getHoursColorClass,
  calcStudentProgress,
  generatePackageTags,
} from '@/utils/hours-status';
import { logError } from '@/utils/logger';
import { useThemedNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';
import { useBatchRender } from '@/utils/use-batch-render';

/** 顶部 Tab 类型 */
type MainTab = 'member' | 'lead';

/** 会员子筛选 Tab */
type MemberSubTab =
  | 'all'
  | 'active'
  | 'private'
  | 'renew'
  | 'silent'
  | 'frozen'
  | 'birthday'
  | 'lost';

/** 会员子筛选选项（减轻视觉权重） */
const MEMBER_SUB_TAB_OPTIONS: { key: MemberSubTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '在籍' },
  { key: 'private', label: '私教' },
  { key: 'renew', label: '续卡' },
  { key: 'silent', label: '沉默' },
  { key: 'frozen', label: '冻卡' },
  { key: 'birthday', label: '生日' },
  { key: 'lost', label: '流失' },
];

/** 计算学生剩余课时汇总 */
function calcRemainingHours(packages?: Student['course_packages']): number {
  if (!packages) return 0;
  return packages.reduce((sum, p) => sum + (p.remaining_hours || 0), 0);
}

/** 课包标签颜色映射（使用 UnoCSS Token 类名） */
const TAG_COLOR_MAP: Record<PackageTag['color'], { bg: string; text: string }> = {
  primary: { bg: 'bg-success-bg', text: 'text-success' },
  amber: { bg: 'bg-warning-bg', text: 'text-amber' },
  danger: { bg: 'bg-destructive-5', text: 'text-destructive' },
  purple: { bg: 'bg-accent-bg', text: 'text-accent' },
  accent: { bg: 'bg-primary-bg', text: 'text-primary' },
  info: { bg: 'bg-info-bg', text: 'text-info' },
};

const Students: React.FC = () => {
  const { profile, session } = useAuth();
  const isTeacher = isStaffRole(profile?.currentContext?.role);

  // 导航栏与「我的」/数据页同款弥散渐变顶部色无缝衔接
  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.primarySoftBg,
    frontColor: '#000000',
  }));

  // ====== 主 Tab 状态 ======
  const [mainTab, setMainTab] = useState<MainTab>('member');

  // ====== 会员 Tab 状态 ======
  const [students, setStudents] = useState<Student[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<StudentSort>('default');
  const [memberSubTab, setMemberSubTab] = useState<MemberSubTab>('all');
  const [sortOpen, setSortOpen] = useState(false);

  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);

  // 同步当前校区课时预警阈值（卡片黄标依赖）
  useEffect(() => {
    const campusId = profile?.currentContext?.campusId;
    if (!campusId) return;
    void campusService
      .getById(campusId)
      .then((campus) => {
        if (campus) {
          syncAlertThresholdFromCampus({
            hoursAlertThreshold: campus.hoursAlertThreshold,
            daysAlertThreshold: campus.daysAlertThreshold,
            amountAlertThreshold: campus.amountAlertThreshold,
          });
        }
      })
      .catch((err) => logError('sync alert threshold', err));
  }, [profile?.currentContext?.campusId]);

  // 加载学员列表
  const loadStudents = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      let list: Student[];
      if (isTeacher) {
        list = await fetchStudentsByTeacher(profile.id);
      } else {
        list = await studentService.getByParent(profile.id);
      }
      setStudents(list);
    } catch (err) {
      logError('loadStudents', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [profile, isTeacher, fetchStudentsByTeacher]);

  // ====== 线索 Tab 状态 ======
  const teacherId = session?.user.id || '';
  const {
    cache: leadCache,
    loading: leadLoading,
    activeFilterTab,
    fetchCards,
    fetchSummary,
    setActiveFilterTab,
    invalidate,
  } = useLeadStore();

  // 当前 tab 的缓存 key
  const leadCacheKey = `${teacherId}::${activeFilterTab}`;
  const leadList = useMemo(() => leadCache[leadCacheKey] || [], [leadCache, leadCacheKey]);
  const isLeadLoading = leadLoading[leadCacheKey];

  // 加载线索数据
  const loadLeads = useCallback(async () => {
    if (!teacherId) return;
    fetchCards(teacherId, activeFilterTab);
    fetchSummary(teacherId);
  }, [teacherId, activeFilterTab, fetchCards, fetchSummary]);

  // ====== 公共生命周期 ======
  const loadStudentsRef = useRef(loadStudents);
  useEffect(() => {
    loadStudentsRef.current = loadStudents;
  }, [loadStudents]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useDidShow(() => {
    if (mainTab === 'member') {
      loadStudentsRef.current();
    } else {
      loadLeads();
    }
  });

  // 下拉刷新
  usePullDownRefresh(async () => {
    if (mainTab === 'member') {
      await loadStudents();
    } else {
      if (teacherId) {
        invalidate(teacherId);
        await Promise.all([
          fetchCards(teacherId, activeFilterTab, true),
          fetchSummary(teacherId, true),
        ]);
      }
    }
    Taro.stopPullDownRefresh();
  });

  // 关闭所有下拉
  const closeAllDropdowns = useCallback(() => {
    setSortOpen(false);
  }, []);

  // ====== 搜索防抖（会员/线索共用 keyword） ======
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [keyword]);

  // Tab 切换时清空搜索和子筛选
  const handleMainTabChange = useCallback(
    (tab: MainTab) => {
      setMainTab(tab);
      setKeyword('');
      setDebouncedKeyword('');
      setMemberSubTab('all');
      closeAllDropdowns();
      if (tab === 'lead') {
        loadLeads();
      }
    },
    [loadLeads, closeAllDropdowns],
  );

  // 会员子 Tab 切换
  const handleMemberSubTabChange = useCallback((tab: MemberSubTab) => {
    setMemberSubTab(tab);
  }, []);

  // 后端搜索（大数据量时使用）
  const [remoteResults, setRemoteResults] = useState<Student[]>([]);
  const [remoteSearching, setRemoteSearching] = useState(false);
  const useRemoteSearch = students.length >= 200;

  useEffect(() => {
    if (!useRemoteSearch || !debouncedKeyword || debouncedKeyword.length < 2 || !profile?.id) {
      setRemoteResults([]);
      return;
    }
    setRemoteSearching(true);
    studentService
      .search(profile.id, debouncedKeyword)
      .then(setRemoteResults)
      .catch(() => setRemoteResults([]))
      .finally(() => setRemoteSearching(false));
  }, [debouncedKeyword, useRemoteSearch, profile?.id]);

  // 筛选 + 排序后的列表
  const filteredStudents = useMemo(() => {
    let result = [...students];

    // 搜索过滤
    if (debouncedKeyword) {
      if (useRemoteSearch) {
        const remoteIds = new Set(remoteResults.map((r) => r.id));
        result = result.filter((s) => remoteIds.has(s.id));
      } else {
        const kw = debouncedKeyword.toLowerCase();
        result = result.filter(
          (s) => (s.name || '').toLowerCase().includes(kw) || (s.phone || '').includes(kw),
        );
      }
    }

    // 会员子 Tab 筛选（基于现有数据做简化映射）
    if (memberSubTab !== 'all') {
      const today = dayjs();
      result = result.filter((s) => {
        const packages = s.course_packages || [];
        const hasActive = packages.some((p) => p.status === 'active');
        const hasFrozen = packages.some((p) => p.status === 'frozen');
        const cardStatus = getStudentCardStatus(s);
        const isBirthdayMonth = s.birthday ? dayjs(s.birthday).month() === today.month() : false;

        switch (memberSubTab) {
          case 'active':
            return hasActive;
          case 'private':
            // 私教课包：通过课包名称关键词识别（数据完善后可改用类型字段）
            return packages.some((p) => (p.name || '').includes('私教'));
          case 'renew':
            return cardStatus === 'low' || cardStatus === 'expiring' || cardStatus === 'owe';
          case 'silent':
            // 沉默会员：有有效课包且剩余课时较多（数据完善后可改用最近消课时间）
            return hasActive && calcRemainingHours(packages) >= 10;
          case 'frozen':
            return hasFrozen;
          case 'birthday':
            return isBirthdayMonth;
          case 'lost':
            return !hasActive && !hasFrozen;
          default:
            return true;
        }
      });
    }

    // 排序
    if (sortBy !== 'default') {
      result.sort((a, b) => {
        switch (sortBy) {
          case 'hours-desc':
            return calcRemainingHours(b.course_packages) - calcRemainingHours(a.course_packages);
          case 'hours-asc':
            return calcRemainingHours(a.course_packages) - calcRemainingHours(b.course_packages);
          case 'name-asc':
            return (a.name || '').localeCompare(b.name || '', 'zh');
          case 'name-desc':
            return (b.name || '').localeCompare(a.name || '', 'zh');
          default:
            return 0;
        }
      });
    }

    return result;
  }, [students, debouncedKeyword, memberSubTab, sortBy, remoteResults, useRemoteSearch]);

  // ====== 分批渲染（P-02）：长列表首屏仅渲染前 50 条，上拉追加 ======
  const {
    visibleList: visibleStudents,
    hasMore: hasMoreStudents,
    onScrollToLower: onStudentsScrollToLower,
    reset: resetStudentBatch,
  } = useBatchRender(filteredStudents);
  // 筛选/搜索/排序变化时重置回首批（避免旧批次残留）
  useEffect(() => {
    resetStudentBatch();
  }, [debouncedKeyword, memberSubTab, sortBy, resetStudentBatch]);

  // ====== 线索 Tab：搜索过滤 ======
  const filteredLeads = useMemo(() => {
    if (!debouncedKeyword) return leadList;
    const kw = debouncedKeyword.toLowerCase();
    return leadList.filter(
      (item) =>
        (item.child_name || '').toLowerCase().includes(kw) ||
        (item.parent_phone || '').includes(kw),
    );
  }, [leadList, debouncedKeyword]);

  // ====== 会员 Tab：下拉菜单 ======
  const goToDetail = (id: string) => {
    Taro.navigateTo({
      url: `/package-student/pages/student-detail/index?id=${encodeURIComponent(id)}`,
    });
  };

  const [memberActionVisible, setMemberActionVisible] = useState(false);

  const handleOpenMemberAction = useCallback(() => {
    setMemberActionVisible(true);
  }, []);

  const handleCloseMemberAction = useCallback(() => {
    setMemberActionVisible(false);
  }, []);

  const handleNewCard = useCallback(() => {
    Taro.navigateTo({ url: '/package-student/pages/student-form/index' });
  }, []);

  const handleBatchExtend = useCallback(() => {
    Taro.showToast({ title: '批量延期功能开发中', icon: 'none' });
  }, []);

  const handleBlacklist = useCallback(() => {
    Taro.showToast({ title: '门店黑名单功能开发中', icon: 'none' });
  }, []);

  const handleSortSelect = (value: StudentSort) => {
    setSortBy(value);
    setSortOpen(false);
  };

  const toggleSort = () => {
    const next = !sortOpen;
    closeAllDropdowns();
    setSortOpen(next);
  };

  // ====== 线索 Tab：事件处理 ======
  const handleLeadTabChange = useCallback(
    (tab: LeadFilterTab) => {
      setActiveFilterTab(tab);
      if (teacherId) {
        fetchCards(teacherId, tab);
      }
    },
    [teacherId, setActiveFilterTab, fetchCards],
  );

  const handleAddLead = useCallback(() => {
    Taro.navigateTo({ url: '/package-lead/pages/lead-form/index' });
  }, []);

  return (
    <View className="min-h-screen bg-background flex flex-col">
      {/* ====== 搜索栏紧贴原生导航（同「我的」/数据页弥散渐变） ====== */}
      <View className="bg-gradient-diffuse-top px-[32rpx] pt-[16rpx] pb-[20rpx] flex-shrink-0 relative overflow-hidden">
        <View className="flex items-center gap-[16rpx] relative z-10">
          <View className="flex-1 rounded-full px-[24rpx] py-[12rpx] flex items-center gap-[10rpx] bg-card/90 shadow-card">
            <Icon name="mdi-magnify" size={20} color="#9ca3af" />
            <Input
              className="flex-1 text-[26rpx] text-foreground"
              placeholder={mainTab === 'member' ? '搜索会员姓名或手机号' : '搜索线索姓名或手机号'}
              placeholderStyle="color:#9ca3af"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value || '')}
              confirmType="search"
            />
            {keyword && (
              <View
                className="w-[36rpx] h-[36rpx] rounded-full bg-muted center"
                onClick={() => setKeyword('')}
              >
                <Icon name="mdi-close" size="xxs" color="white" />
              </View>
            )}
          </View>
          {/* 排序 */}
          <View className="relative flex-shrink-0">
            <View
              className={cn(
                'flex items-center gap-[6rpx] px-[20rpx] py-[14rpx] rounded-full bg-card/80 shadow-card',
                sortBy !== 'default' ? 'text-primary font-semibold' : 'text-foreground-secondary',
              )}
              onClick={toggleSort}
            >
              <Text className="text-[24rpx]">
                {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || '排序'}
              </Text>
              <Icon name="mdi-chevron-down" size={24} color="muted" />
            </View>
            {sortOpen && (
              <View className="absolute top-full right-0 mt-[12rpx] bg-white rounded-[24rpx] shadow-float py-[12rpx] min-w-[240rpx] z-100">
                {SORT_OPTIONS.map((opt) => (
                  <View
                    key={opt.value}
                    className={cn(
                      'flex items-center px-[24rpx] py-[20rpx] mx-[12rpx] rounded-[16rpx]',
                      sortBy === opt.value ? 'bg-primary-bg text-primary' : 'text-foreground',
                    )}
                    onClick={() => handleSortSelect(opt.value)}
                  >
                    <Text
                      className={cn(
                        'text-[26rpx] flex-1',
                        sortBy === opt.value ? 'font-semibold text-primary' : '',
                      )}
                    >
                      {opt.label}
                    </Text>
                    {sortBy === opt.value && <Icon name="mdi-check" size="xs" color="success" />}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ====== Tab 切换：会员 / 客资（白色背景区域） ====== */}
      <View className="bg-white flex-shrink-0 px-[32rpx] pt-[20rpx] pb-[16rpx]">
        <View className="flex justify-center">
          <View className="flex items-center gap-[8rpx] bg-muted/40 rounded-full p-[6rpx]">
            <View
              className={cn(
                'px-[48rpx] py-[12rpx] rounded-full',
                mainTab === 'member' ? 'bg-primary shadow-elegant' : '',
              )}
              onClick={() => handleMainTabChange('member')}
            >
              <Text
                className={cn(
                  'text-[28rpx] font-medium',
                  mainTab === 'member' ? 'text-white' : 'text-muted-foreground',
                )}
              >
                会员
              </Text>
            </View>
            <View
              className={cn(
                'px-[48rpx] py-[12rpx] rounded-full',
                mainTab === 'lead' ? 'bg-primary shadow-elegant' : '',
              )}
              onClick={() => handleMainTabChange('lead')}
            >
              <Text
                className={cn(
                  'text-[28rpx] font-medium',
                  mainTab === 'lead' ? 'text-white' : 'text-muted-foreground',
                )}
              >
                客资
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ====== 会员 Tab：轻量子筛选标签 + 统计 ====== */}
      {mainTab === 'member' && (
        <View className="bg-white flex-shrink-0">
          <ScrollView scrollX className="whitespace-nowrap px-[24rpx] pb-[16rpx]">
            <View className="inline-flex gap-[12rpx]">
              {MEMBER_SUB_TAB_OPTIONS.map((tab) => (
                <View
                  key={tab.key}
                  className={cn(
                    'px-[20rpx] py-[10rpx] rounded-full',
                    memberSubTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/50 text-muted-foreground',
                  )}
                  onClick={() => handleMemberSubTabChange(tab.key)}
                >
                  <Text
                    className={cn(
                      'text-[24rpx]',
                      memberSubTab === tab.key ? 'font-semibold text-primary' : 'font-medium',
                    )}
                  >
                    {tab.label}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <View className="px-[32rpx] pb-[16rpx]">
            <Text className="text-[24rpx] text-muted-foreground">
              共{' '}
              <Text className="text-[28rpx] font-bold text-foreground">
                {filteredStudents.length}
              </Text>{' '}
              位会员
            </Text>
          </View>
        </View>
      )}

      {/* ====== 线索 Tab：筛选标签（下划线样式，平均分布） ====== */}
      {mainTab === 'lead' && (
        <View className="px-[32rpx] pt-[24rpx] pb-[16rpx] flex-shrink-0 bg-white">
          <View className="flex">
            {LEAD_FILTER_TAB_OPTIONS.map((tab) => (
              <View
                key={tab.key}
                className="flex-1 relative pb-[12rpx] center"
                onClick={() => handleLeadTabChange(tab.key)}
              >
                <Text
                  className={cn(
                    'text-[28rpx]',
                    activeFilterTab === tab.key
                      ? 'text-primary font-semibold'
                      : 'text-muted-foreground font-medium',
                  )}
                >
                  {tab.label}
                </Text>
                {activeFilterTab === tab.key && (
                  <View className="absolute bottom-0 left-[20%] right-[20%] h-[4rpx] rounded-full bg-primary" />
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ====== 会员 Tab：学员卡片列表 ====== */}
      {mainTab === 'member' && (
        <ScrollView scrollY className="flex-1" onScrollToLower={onStudentsScrollToLower}>
          <View className="px-[32rpx] pt-[24rpx] pb-[24rpx]">
            {visibleStudents.map((student) => {
              const cardStatus = getStudentCardStatus(student);
              const borderColorClass = getCardBorderColorClass(cardStatus);
              const progress = calcStudentProgress(student);
              const tags = generatePackageTags(student);
              const remainingHours = calcRemainingHours(student.course_packages);
              const hoursColorClass = getHoursColorClass(remainingHours);
              return (
                <View
                  key={student.id}
                  className={cn(
                    'bg-white rounded-[32rpx] p-[32rpx] shadow-soft mb-[24rpx] press-scale',
                    borderColorClass,
                  )}
                  onClick={() => goToDetail(student.id)}
                >
                  {/* 上部：头像 + 信息 + 课时 */}
                  <View className="flex items-center gap-[24rpx]">
                    {/* 头像 */}
                    <StudentAvatar name={student.name} src={student.avatar_url} size="md" />
                    {/* 信息 */}
                    <View className="flex-1 min-w-0">
                      <Text className="text-[32rpx] font-semibold text-foreground">
                        {student.name}
                      </Text>
                      {(student.nickname || student.phone || student.birthday) && (
                        <View className="flex items-center gap-[12rpx] mt-[4rpx]">
                          {student.nickname ? (
                            <Text className="text-[24rpx] text-muted-foreground">
                              {student.nickname}
                            </Text>
                          ) : null}
                          {student.nickname && student.phone ? (
                            <View className="w-[6rpx] h-[6rpx] rounded-full bg-muted-foreground/40" />
                          ) : null}
                          {student.phone && (
                            <>
                              <Text className="text-[24rpx] text-muted-foreground">
                                {student.phone}
                              </Text>
                              <View className="w-[6rpx] h-[6rpx] rounded-full bg-muted-foreground/40" />
                            </>
                          )}
                          <Text className="text-[24rpx] text-muted-foreground">
                            {student.birthday || '暂无生日'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {/* 课时 */}
                    <View className="flex items-center gap-[16rpx] flex-shrink-0">
                      <View className="text-right">
                        <Text className={cn('text-[40rpx] font-bold block', hoursColorClass)}>
                          {remainingHours}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground">课时</Text>
                      </View>
                      <Icon name="mdi-chevron-right" size="sm" color="mutedForeground" />
                    </View>
                  </View>

                  {/* 课包标签行 */}
                  {tags.length > 0 && (
                    <View className="flex gap-[12rpx] mt-[20rpx] flex-wrap">
                      {tags.map((tag, i) => (
                        <View
                          key={i}
                          className={cn(
                            'py-[6rpx] px-[16rpx] rounded-[12rpx]',
                            TAG_COLOR_MAP[tag.color].bg,
                          )}
                        >
                          <Text
                            className={cn(
                              'text-[22rpx] font-medium',
                              TAG_COLOR_MAP[tag.color].text,
                            )}
                          >
                            {tag.name} {tag.remainingHours}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 进度条 */}
                  {progress.total > 0 && (
                    <View className="mt-[20rpx]">
                      <View className="h-[8rpx] bg-border rounded-[4rpx] overflow-hidden">
                        <View
                          className={cn(
                            'h-full rounded-[4rpx]',
                            getProgressGradientClass(cardStatus),
                          )}
                          style={{
                            width: `${Math.min(progress.percentage, 100)}%`,
                          }}
                        />
                      </View>
                      <View className="flex justify-between mt-[8rpx]">
                        <Text className="text-[22rpx] text-muted-foreground">
                          已用 {progress.used} 课时
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground">
                          共 {progress.total} 课时
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 课时不足 / 无可用课包 → 去充值 */}
                  {(cardStatus === 'low' ||
                    cardStatus === 'expiring' ||
                    cardStatus === 'expired' ||
                    cardStatus === 'owe') && (
                    <View
                      className={cn(
                        'mt-[20rpx] flex items-center justify-between px-[20rpx] py-[16rpx] rounded-[16rpx]',
                        cardStatus === 'expired' || cardStatus === 'owe'
                          ? 'bg-destructive/10'
                          : 'bg-warning/10',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        Taro.navigateTo({
                          url: `/package-course/pages/package-form/index?studentId=${student.id}`,
                        });
                      }}
                    >
                      <Text
                        className={cn(
                          'text-[24rpx]',
                          cardStatus === 'expired' || cardStatus === 'owe'
                            ? 'text-destructive'
                            : 'text-warning',
                        )}
                      >
                        {cardStatus === 'expired'
                          ? '暂无可用课包，请尽快充值'
                          : cardStatus === 'owe'
                            ? '课时透支，请尽快充值'
                            : cardStatus === 'expiring'
                              ? '课包即将到期，建议续费'
                              : '课时不足，建议充值'}
                      </Text>
                      <View
                        className={cn(
                          'px-[20rpx] py-[8rpx] rounded-full',
                          cardStatus === 'expired' || cardStatus === 'owe'
                            ? 'bg-destructive/20'
                            : 'bg-warning/20',
                        )}
                      >
                        <Text
                          className={cn(
                            'text-[24rpx] font-medium',
                            cardStatus === 'expired' || cardStatus === 'owe'
                              ? 'text-destructive'
                              : 'text-warning',
                          )}
                        >
                          去充值
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* 空状态 */}
            {filteredStudents.length === 0 && !loading && (
              <>
                <Empty
                  description={
                    debouncedKeyword
                      ? '未找到匹配的学员'
                      : isTeacher
                        ? '暂无学员，点击上方添加'
                        : '暂无关联学员'
                  }
                />
                {/* 本地无结果 + 未启用远程搜索 → 显示"搜索更多" */}
                {debouncedKeyword &&
                  !useRemoteSearch &&
                  debouncedKeyword.length >= 2 &&
                  profile?.id && (
                    <View
                      className="mt-4 py-3 px-6 rounded-full bg-primary/10 self-center"
                      onClick={() => {
                        setRemoteSearching(true);
                        studentService
                          .search(profile.id, debouncedKeyword)
                          .then((results) => {
                            if (results.length > 0) {
                              setStudents((prev) => {
                                const existingIds = new Set(prev.map((s) => s.id));
                                const newStudents = results.filter((r) => !existingIds.has(r.id));
                                return [...prev, ...newStudents];
                              });
                            }
                          })
                          .catch(() => {})
                          .finally(() => setRemoteSearching(false));
                      }}
                    >
                      <Text className="text-[26rpx] text-primary font-medium">
                        {remoteSearching ? '搜索中...' : '搜索更多学员'}
                      </Text>
                    </View>
                  )}
              </>
            )}

            {/* 分批渲染：还有更多时显示加载提示（上拉自动追加） */}
            {hasMoreStudents && (
              <View className="py-[24rpx] text-center text-[24rpx] text-muted-foreground">
                上拉加载更多…
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ====== 线索 Tab：线索卡片列表 ====== */}
      {mainTab === 'lead' && (
        <ScrollView scrollY className="flex-1">
          <View className="px-[32rpx] pt-[24rpx] pb-[200rpx]">
            {/* 加载中 */}
            {isLeadLoading && filteredLeads.length === 0 && (
              <View className="py-20 center">
                <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
              </View>
            )}

            {/* 空状态 */}
            {!isLeadLoading && filteredLeads.length === 0 && (
              <View className="py-20 center flex-col gap-3">
                <Icon name="mdi-account-search" size={64} className="text-muted-foreground" />
                <Text className="text-[28rpx] text-muted-foreground">
                  {debouncedKeyword ? '未找到匹配的线索' : '暂无线索'}
                </Text>
              </View>
            )}

            {/* 线索卡片 */}
            <View className="flex flex-col gap-3">
              {filteredLeads.map((item) => (
                <LeadCard key={item.id} data={item} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* 点击空白关闭排序下拉 */}
      {sortOpen && (
        <View className="fixed inset-0 z-50 bg-transparent" onClick={closeAllDropdowns} />
      )}

      {/* 悬浮添加按钮 - 参考图片胶囊风格 */}
      {isTeacher && (
        <View
          className="fixed bottom-[160rpx] right-[32rpx] z-100"
          onClick={mainTab === 'member' ? handleOpenMemberAction : handleAddLead}
        >
          <View className="flex items-center gap-[8rpx] px-[28rpx] py-[18rpx] rounded-full bg-gradient-primary shadow-schedule-fab">
            <Icon name="mdi-plus" size="sm" color="white" />
            <Text className="text-[28rpx] text-white font-medium">
              {mainTab === 'member' ? '会员操作' : '客资录入'}
            </Text>
          </View>
        </View>
      )}

      {/* 会员操作弹窗 */}
      <MemberActionSheet
        visible={memberActionVisible}
        onClose={handleCloseMemberAction}
        onNewCard={handleNewCard}
        onBatchExtend={handleBatchExtend}
        onBlacklist={handleBlacklist}
      />
    </View>
  );
};

export default withRouteGuard(Students);
