import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import { studentService } from '@/services';
import { useStudentStore } from '@/stores';
import type {
  Student,
  StudentSort,
  StudentFilter,
  SubjectFilter,
  StudentSummary,
  PackageTag,
  StudentCardStatus,
} from '@/types/student';
import { SORT_OPTIONS, FILTER_OPTIONS, SUBJECT_OPTIONS } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { getAvatarGradientByName } from '@/utils/avatar-color';
import {
  getStudentCardStatus,
  getCardBorderColor,
  getProgressGradient,
  getHoursColor,
  calcStudentProgress,
  generatePackageTags,
  calcStudentSummary,
} from '@/utils/hours-status';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 计算学生剩余课时汇总 */
function calcRemainingHours(packages?: Student['course_packages']): number {
  if (!packages) return 0;
  return packages.reduce((sum, p) => sum + (p.remaining_hours || 0), 0);
}

/** 课包标签颜色映射 */
const TAG_COLOR_MAP: Record<PackageTag['color'], { bg: string; text: string }> = {
  primary: { bg: '#f0faf5', text: '#5EC8A8' },
  amber: { bg: '#faf6ee', text: '#d4a24e' },
  danger: { bg: '#fef2f2', text: '#D94040' },
  purple: { bg: '#f3f0fb', text: '#9b7ed8' },
  accent: { bg: '#fdf0f4', text: '#e88aaa' },
  info: { bg: '#f0f5fb', text: '#6ba3d6' },
};

const Students: React.FC = () => {
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';

  const [students, setStudents] = useState<Student[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<StudentSort>('default');
  const [filterStatus, setFilterStatus] = useState<StudentFilter>('all');
  const [filterSubject, setFilterSubject] = useState<SubjectFilter>('all');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterStatusOpen, setFilterStatusOpen] = useState(false);
  const [filterSubjectOpen, setFilterSubjectOpen] = useState(false);

  const studentStore = useStudentStore();

  // 加载学员列表
  const loadStudents = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      let list: Student[];
      if (isTeacher) {
        list = await studentStore.fetchByTeacher(profile.id);
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
  }, [profile, isTeacher]);

  const loadRef = useRef(loadStudents);
  useEffect(() => {
    loadRef.current = loadStudents;
  }, [loadStudents]);
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);
  useDidShow(() => {
    loadRef.current();
  });

  // 下拉刷新
  usePullDownRefresh(async () => {
    await loadStudents();
    Taro.stopPullDownRefresh();
  });

  // 搜索防抖
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [keyword]);

  // 筛选 + 排序后的列表
  const filteredStudents = useMemo(() => {
    let result = [...students];

    // 搜索过滤
    if (debouncedKeyword) {
      const kw = debouncedKeyword.toLowerCase();
      result = result.filter(
        (s) => (s.name || '').toLowerCase().includes(kw) || (s.phone || '').includes(kw),
      );
    }

    // 课时状态筛选
    if (filterStatus !== 'all') {
      result = result.filter((s) => getStudentCardStatus(s) === filterStatus);
    }

    // 科目筛选：按课包名称中包含科目关键词
    if (filterSubject !== 'all') {
      const subjectKeywords: Record<SubjectFilter, string[]> = {
        all: [],
        piano: ['钢琴', 'piano', '琴'],
        vocal: ['声乐', 'vocal', '唱歌', '演唱'],
        theory: ['乐理', 'theory', '视唱'],
        calligraphy: ['书法', 'calligraphy', '写字'],
        general: ['通用', 'general', '综合'],
      };
      const keywords = subjectKeywords[filterSubject] || [];
      if (keywords.length > 0) {
        result = result.filter((s) =>
          (s.course_packages || []).some((pkg) =>
            keywords.some((kw) => (pkg.name || '').toLowerCase().includes(kw)),
          ),
        );
      }
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
  }, [students, debouncedKeyword, filterStatus, filterSubject, sortBy]);

  // 统计摘要
  const summary: StudentSummary = useMemo(() => calcStudentSummary(students), [students]);

  // 关闭所有下拉
  const closeAllDropdowns = useCallback(() => {
    setSortOpen(false);
    setFilterStatusOpen(false);
    setFilterSubjectOpen(false);
  }, []);

  const goToDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/student-detail/index?id=${encodeURIComponent(id)}` });
  };

  const goToAdd = () => {
    Taro.navigateTo({ url: '/pages/student-form/index' });
  };

  const handleSortSelect = (value: StudentSort) => {
    setSortBy(value);
    setSortOpen(false);
  };

  const handleFilterStatusSelect = (value: StudentFilter) => {
    setFilterStatus(value);
    setFilterStatusOpen(false);
  };

  const handleFilterSubjectSelect = (value: SubjectFilter) => {
    setFilterSubject(value);
    setFilterSubjectOpen(false);
  };

  const toggleSort = () => {
    const next = !sortOpen;
    closeAllDropdowns();
    setSortOpen(next);
  };

  const toggleFilterStatus = () => {
    const next = !filterStatusOpen;
    closeAllDropdowns();
    setFilterStatusOpen(next);
  };

  const toggleFilterSubject = () => {
    const next = !filterSubjectOpen;
    closeAllDropdowns();
    setFilterSubjectOpen(next);
  };

  return (
    <View className="min-h-screen bg-background">
      {/* ====== 渐变头部 ====== */}
      <View className="bg-gradient-primary px-5 pt-10 pb-5">
        {/* 标题行 */}
        <View className="flex items-center justify-between">
          <Text className="text-2xl font-bold text-white">学员管理</Text>
        </View>

        {/* 统计摘要 */}
        <View className="mt-3 rounded-xl px-4 py-3 flex bg-white/20">
          <View className="flex-1 center-col">
            <Text className="text-white text-xl font-bold">{summary.total}</Text>
            <Text className="text-white/90 text-xs mt-[2rpx]">总学员</Text>
          </View>
          <View className="w-px h-10 bg-white/25" />
          <View className="flex-1 center-col">
            <Text className="text-white text-xl font-bold">{summary.sufficient}</Text>
            <Text className="text-white/90 text-xs mt-[2rpx]">课时充足</Text>
          </View>
          <View className="w-px h-10 bg-white/25" />
          <View className="flex-1 center-col">
            <Text className="text-xl font-bold" style={{ color: '#ffe082' }}>
              {summary.low}
            </Text>
            <Text style={{ color: 'rgba(255,224,130,0.95)' }} className="text-xs mt-[2rpx]">
              课时不足
            </Text>
          </View>
          <View className="w-px h-10 bg-white/25" />
          <View className="flex-1 center-col">
            <Text className="text-xl font-bold" style={{ color: '#ffc1cc' }}>
              {summary.owe}
            </Text>
            <Text style={{ color: 'rgba(255,193,204,0.95)' }} className="text-xs mt-[2rpx]">
              欠课
            </Text>
          </View>
        </View>

        {/* 搜索栏 + 筛选按钮 + 添加按钮 */}
        <View className="flex items-center gap-2 mt-3">
          <View className="flex-1 rounded-xl px-4 py-2_d5 flex items-center gap-2 bg-glass-25">
            <Icon name="mdi-magnify" size="xs" color="rgba(255,255,255,0.65)" />
            <Input
              className="flex-1 text-sm text-white"
              placeholder="搜索姓名或手机号"
              placeholderStyle="color:rgba(255,255,255,0.65)"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value || '')}
              confirmType="search"
            />
            {keyword && (
              <View
                className="w-[36rpx] h-[36rpx] rounded-full bg-white/40 center"
                onClick={() => setKeyword('')}
              >
                <Icon name="mdi-close" size={18} color="white" />
              </View>
            )}
          </View>
          {/* 筛选按钮 */}
          <View className="relative">
            <View
              className={`w-10 h-10 rounded-xl center press-scale ${sortOpen ? 'bg-white/40' : 'bg-glass-25'}`}
              onClick={toggleSort}
            >
              <Icon
                name="mdi-filter-variant"
                size="sm"
                color={sortOpen ? 'white' : 'rgba(255,255,255,0.85)'}
              />
            </View>
            {sortOpen && (
              <View className="absolute top-full right-0 mt-[12rpx] bg-white rounded-[24rpx] shadow-float py-[12rpx] min-w-[280rpx] z-100">
                {SORT_OPTIONS.map((opt) => (
                  <View
                    key={opt.value}
                    className={`flex items-center px-[24rpx] py-[20rpx] mx-[12rpx] rounded-[16rpx] ${sortBy === opt.value ? 'bg-primary-bg text-primary' : 'text-foreground'}`}
                    onClick={() => handleSortSelect(opt.value)}
                  >
                    <Text
                      className={`text-[26rpx] flex-1 ${sortBy === opt.value ? 'font-semibold text-primary' : ''}`}
                    >
                      {opt.label}
                    </Text>
                    {sortBy === opt.value && <Icon name="mdi-check" size="xs" color="#5EC8A8" />}
                  </View>
                ))}
              </View>
            )}
          </View>
          {/* 添加学员按钮 */}
          {isTeacher && (
            <View className="w-10 h-10 rounded-xl bg-white/25 center press-scale" onClick={goToAdd}>
              <Icon name="mdi-plus" size="sm" color="white" />
            </View>
          )}
        </View>
      </View>

      {/* ====== 筛选栏 ====== */}
      <View className="flex bg-white relative z-10">
        {/* 课时状态筛选 */}
        <View className="flex-1 relative">
          <View
            className={`flex items-center justify-center gap-[8rpx] py-[22rpx] px-[24rpx] ${filterStatus !== 'all' ? 'text-primary font-semibold' : 'text-muted-foreground font-medium'}`}
            onClick={toggleFilterStatus}
          >
            <Text className="text-[26rpx]">
              {FILTER_OPTIONS.find((o) => o.value === filterStatus)?.label || '课时状态'}
            </Text>
            <Icon
              name="mdi-chevron-down"
              size={28}
              color={filterStatus !== 'all' ? '#5EC8A8' : '#7a9a8e'}
            />
          </View>
          {filterStatusOpen && (
            <View className="absolute top-full left-0 right-0 bg-white rounded-b-[24rpx] shadow-float py-[12rpx] z-100">
              {FILTER_OPTIONS.map((opt) => (
                <View
                  key={opt.value}
                  className={`flex items-center gap-[16rpx] px-[24rpx] py-[20rpx] mx-[12rpx] rounded-[16rpx] ${filterStatus === opt.value ? 'bg-primary-bg' : ''}`}
                  onClick={() => handleFilterStatusSelect(opt.value)}
                >
                  <View
                    className="w-[12rpx] h-[12rpx] rounded-full"
                    style={{ background: opt.dotColor }}
                  />
                  <Text
                    className={`text-[26rpx] flex-1 ${filterStatus === opt.value ? 'text-primary font-semibold' : 'text-foreground'}`}
                  >
                    {opt.label}
                  </Text>
                  {filterStatus === opt.value && (
                    <Icon name="mdi-check" size="xs" color="#5EC8A8" />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
        {/* 分隔线 */}
        <View className="w-[2rpx] bg-[#f0f0f0]" />
        {/* 科目筛选 */}
        <View className="flex-1 relative">
          <View
            className={`flex items-center justify-center gap-[8rpx] py-[22rpx] px-[24rpx] ${filterSubject !== 'all' ? 'text-primary font-semibold' : 'text-muted-foreground font-medium'}`}
            onClick={toggleFilterSubject}
          >
            <Text className="text-[26rpx]">
              {SUBJECT_OPTIONS.find((o) => o.value === filterSubject)?.label || '科目'}
            </Text>
            <Icon
              name="mdi-chevron-down"
              size={28}
              color={filterSubject !== 'all' ? '#5EC8A8' : '#7a9a8e'}
            />
          </View>
          {filterSubjectOpen && (
            <View className="absolute top-full left-0 right-0 bg-white rounded-b-[24rpx] shadow-float py-[12rpx] z-100">
              {SUBJECT_OPTIONS.map((opt) => (
                <View
                  key={opt.value}
                  className={`flex items-center gap-[16rpx] px-[24rpx] py-[20rpx] mx-[12rpx] rounded-[16rpx] ${filterSubject === opt.value ? 'bg-primary-bg' : ''}`}
                  onClick={() => handleFilterSubjectSelect(opt.value)}
                >
                  <Text
                    className={`text-[26rpx] flex-1 ${filterSubject === opt.value ? 'text-primary font-semibold' : 'text-foreground'}`}
                  >
                    {opt.label}
                  </Text>
                  {filterSubject === opt.value && (
                    <Icon name="mdi-check" size="xs" color="#5EC8A8" />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* ====== 学员卡片列表 ====== */}
      <ScrollView
        scrollY
        className="px-[32rpx] pt-[24rpx] pb-[120rpx]"
        style={{ height: 'calc(100vh - 500rpx)' }}
      >
        {filteredStudents.map((student, index) => {
          const cardStatus = getStudentCardStatus(student);
          const borderColor = getCardBorderColor(cardStatus);
          const progress = calcStudentProgress(student);
          const tags = generatePackageTags(student);
          const remainingHours = calcRemainingHours(student.course_packages);
          const hoursColor = getHoursColor(remainingHours);
          const avatarGradient = getAvatarGradientByName(student.name);

          return (
            <View
              key={student.id}
              className="bg-white rounded-[32rpx] p-[32rpx] shadow-soft mb-[24rpx] press-scale"
              style={{ borderLeft: `6rpx solid ${borderColor}` }}
              onClick={() => goToDetail(student.id)}
            >
              {/* 上部：头像 + 信息 + 课时 */}
              <View className="flex items-center gap-[24rpx]">
                {/* 头像 */}
                <View
                  className="w-[96rpx] h-[96rpx] rounded-full center flex-shrink-0"
                  style={{ background: avatarGradient }}
                >
                  <Text className="text-[36rpx] font-bold text-white">{student.name[0]}</Text>
                </View>
                {/* 信息 */}
                <View className="flex-1 min-w-0">
                  <Text className="text-[32rpx] font-bold text-foreground">{student.name}</Text>
                  <View className="flex items-center gap-[12rpx] mt-[4rpx]">
                    {student.phone && (
                      <>
                        <Text className="text-[24rpx] text-muted-foreground">{student.phone}</Text>
                        <View className="w-[6rpx] h-[6rpx] rounded-full bg-muted-foreground/40" />
                      </>
                    )}
                    <Text className="text-[24rpx] text-muted-foreground">
                      {student.birthday || '暂无生日'}
                    </Text>
                  </View>
                </View>
                {/* 课时 */}
                <View className="flex items-center gap-[16rpx] flex-shrink-0">
                  <View className="text-right">
                    <Text className="text-[40rpx] font-bold block" style={{ color: hoursColor }}>
                      {remainingHours}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground">课时</Text>
                  </View>
                  <Icon name="mdi-chevron-right" size="sm" color="#a0b8ad" />
                </View>
              </View>

              {/* 课包标签行 */}
              {tags.length > 0 && (
                <View className="flex gap-[12rpx] mt-[20rpx] flex-wrap">
                  {tags.map((tag, i) => (
                    <View
                      key={i}
                      className="py-[6rpx] px-[16rpx] rounded-[12rpx]"
                      style={{ background: TAG_COLOR_MAP[tag.color].bg }}
                    >
                      <Text
                        className="text-[22rpx] font-medium"
                        style={{ color: TAG_COLOR_MAP[tag.color].text }}
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
                      className="h-full rounded-[4rpx]"
                      style={{
                        width: `${Math.min(progress.percentage, 100)}%`,
                        background: getProgressGradient(cardStatus),
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
            </View>
          );
        })}

        {/* 空状态 */}
        {filteredStudents.length === 0 && !loading && (
          <Empty
            description={
              debouncedKeyword
                ? '未找到匹配的学员'
                : isTeacher
                  ? '暂无学员，点击上方添加'
                  : '暂无关联学员'
            }
          />
        )}
      </ScrollView>

      {/* 点击空白关闭下拉 */}
      {(sortOpen || filterStatusOpen || filterSubjectOpen) && (
        <View
          className="fixed inset-0 z-50"
          style={{ background: 'transparent' }}
          onClick={closeAllDropdowns}
        />
      )}
    </View>
  );
};

export default withRouteGuard(Students);
