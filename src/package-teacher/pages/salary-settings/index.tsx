/**
 * 薪资设置列表页
 *
 * 展示每位员工的当前薪资规则摘要，点击进入详情页配置。
 * 首次进入显示新手引导弹窗（第 6 步 / 共 6 步）。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import PageIntroSheet from '@/components/PageIntroSheet';
import { useTeacherStore } from '@/stores/teacher';
import { useThemeStore } from '@/stores/theme';
import type { BaseSalaryMode, LessonFeeMode, TeacherUIModel } from '@/types/teacher';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const INTRO_STORAGE_KEY = 'salary_settings_intro_hidden';

/** 底薪模式映射 */
const BASE_MODE_TEXT: Record<BaseSalaryMode, string> = {
  fixed: '固定底薪',
  personal_perf: '按个人业绩',
  shop_perf: '按全店业绩',
};

/** 课时费模式映射 */
const LESSON_MODE_TEXT: Record<LessonFeeMode, string> = {
  unified: '统一课时费',
  by_course: '按课程设置',
  by_attendance: '按上课人数',
  by_monthly_tier: '按月课量阶梯',
  by_perf_tier: '按业绩阶梯',
};

/** 提取某老师薪资规则摘要文本 */
function summarizeTeacher(t: TeacherUIModel): string {
  const rule = t.salaryRule;
  if (!rule) {
    // 降级：老数据 base/rate
    if (t.base > 0 && t.rate > 0) {
      return `底薪 ¥${t.base} · 课时 ¥${t.rate}/节`;
    }
    if (t.rate > 0) {
      return `课时 ¥${t.rate}/节`;
    }
    return '暂未配置';
  }
  const parts: string[] = [];
  if (rule.baseMode === 'fixed') {
    parts.push(`底薪 ¥${rule.fixedBaseAmount || 0}`);
  } else {
    parts.push(BASE_MODE_TEXT[rule.baseMode]);
  }
  if (rule.lessonFeeMode === 'unified') {
    parts.push(`课时 ¥${rule.unifiedLessonRate || 0}/节`);
  } else {
    parts.push(LESSON_MODE_TEXT[rule.lessonFeeMode]);
  }
  if (rule.insurance.enabled) {
    parts.push('缴纳社保');
  }
  if (
    rule.commissionMode !== 'none' &&
    rule.commissionTiers.some((x) => x.perfThreshold !== '' && x.rate !== '')
  ) {
    parts.push('含提成');
  }
  return parts.join(' · ');
}

const SalarySettingsPage: React.FC = () => {
  useCardNavigationBar();
  const { activeTheme } = useThemeStore();
  const { teachers, fetchAll } = useTeacherStore();
  const [introVisible, setIntroVisible] = useState(false);
  const [keyword] = useState('');

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

  const list = useMemo(() => {
    const arr = teachers.filter((t) => t.status === 'active');
    if (!keyword.trim()) return arr;
    const kw = keyword.trim();
    return arr.filter((t) => t.name.includes(kw) || (t.subject || '').includes(kw));
  }, [teachers, keyword]);

  const handleOpenDetail = useCallback((teacher: TeacherUIModel) => {
    Taro.navigateTo({
      url: `/package-teacher/pages/salary-form/index?teacherId=${teacher.id}&name=${encodeURIComponent(teacher.name)}`,
    });
  }, []);

  return (
    <View className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background pb-safe-bar')}>
      {/* 搜索框 */}
      <View className="px-[32rpx] py-[20rpx] bg-white">
        <View className="flex items-center gap-[12rpx] px-[24rpx] py-[16rpx] rounded-[24rpx] bg-muted">
          <Icon name="mdi-magnify" size={20} className="text-muted-foreground" />
          {/* 暂不加 SearchInput，用占位，后续可切换真实输入 */}
          <Text className="text-[26rpx] text-muted-foreground flex-1">搜索老师姓名 / 科目</Text>
        </View>
      </View>

      {/* 列表 */}
      <ScrollView scrollY className="mt-[16rpx]">
        {list.length === 0 ? (
          <View className="py-[200rpx]">
            <Empty />
          </View>
        ) : (
          <View className="px-[32rpx] flex flex-col gap-[20rpx] pb-[32rpx]">
            {list.map((t) => {
              const summary = summarizeTeacher(t);
              return (
                <View
                  key={t.id}
                  className="bg-white rounded-[28rpx] px-[28rpx] py-[24rpx] shadow-card press-bg flex items-center"
                  onClick={() => handleOpenDetail(t)}
                >
                  <Avatar name={t.name} size="md" />
                  <View className="flex-1 ml-[20rpx] min-w-0">
                    <View className="flex items-center gap-[12rpx] mb-[8rpx]">
                      <Text className="text-[30rpx] font-semibold text-foreground">{t.name}</Text>
                      {t.salaryTemplateId && (
                        <View className="px-[12rpx] py-[2rpx] rounded-[8rpx] bg-primary/10 text-primary text-[20rpx] font-medium">
                          使用模板
                        </View>
                      )}
                    </View>
                    <Text className="text-[24rpx] text-muted-foreground block truncate">
                      {summary}
                    </Text>
                  </View>
                  <Icon name="mdi-chevron-right" size={24} className="text-muted-foreground" />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 新手引导弹窗 */}
      <PageIntroSheet
        visible={introVisible}
        currentStep={6}
        totalSteps={6}
        title="第 6 步：薪资规则"
        description="为每位员工配置基础工资、课时费、提成规则，签到 / 退课时系统会自动结算。"
        bulletPoints={[
          '进入并查看一次后即标记为「已了解」',
          '具体规则可以稍后慢慢调整，不影响其它配置',
        ]}
        storageKey={INTRO_STORAGE_KEY}
        onClose={() => setIntroVisible(false)}
      />
    </View>
  );
};

export default SalarySettingsPage;
