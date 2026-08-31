/**
 * 我的课程页 pages/my-course/index
 *
 * 家长端「我的约课」入口统一页面，包含四个状态 Tab：
 * 已预约 / 排队中 / 待评价 / 已取消。
 *
 * 课程卡片样式复用预约页设计，数据接入 Mock 系统。
 * 全部使用 UnoCSS Token，随主题色联动。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, getCurrentInstance } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import EvaluateSheet from '@/components/EvaluateSheet';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import SegmentedControl from '@/components/SegmentedControl';
import { myCourseService } from '@/services';
import { subscribeMessageService } from '@/services/subscribe-message';
import type { MyCourseItem, MyCourseStatus } from '@/services/my-course';
import { useAuth } from '@/utils/auth';
import { usePrimaryNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';
import { useThemeStore } from '@/stores/theme';

/** 从路由参数读取目标 Tab（兼容首次进入与栈内复用再次进入） */
function readTabFromRouter(): MyCourseStatus | undefined {
  const tab = getCurrentInstance()?.router?.params?.tab as MyCourseStatus | undefined;
  return TABS.some((t) => t.key === tab) ? tab : undefined;
}

/** 主题 key → CSS 类名映射（对应 app.scss 里 .theme-orange / .theme-coral 选择器） */
const THEME_CLASS_MAP: Record<string, string> = {
  orange: 'theme-orange',
  coral: 'theme-coral',
  blue: '',
};

const TABS: { key: MyCourseStatus; label: string }[] = [
  { key: 'booked', label: '已预约' },
  { key: 'waiting', label: '排队中' },
  { key: 'pending_evaluate', label: '待评价' },
  { key: 'cancelled', label: '已取消' },
];

const STATUS_TEXT: Record<MyCourseStatus, string> = {
  booked: '已预约',
  waiting: '排队中',
  pending_evaluate: '待评价',
  cancelled: '已取消',
};

const STATUS_CLASS: Record<MyCourseStatus, string> = {
  booked: 'tag-primary',
  waiting: 'bg-warning/15 text-warning',
  pending_evaluate: 'bg-purple/15 text-purple',
  cancelled: 'bg-muted text-muted-foreground',
};

/** 格式化日期时间 */
function formatCourseTime(date: string, startTime: string, endTime: string): string {
  const d = dayjs(date);
  if (!d.isValid()) return `${startTime}-${endTime}`;
  return `${d.format('MM月DD日')} ${startTime}-${endTime}`;
}

const MyCourse: React.FC = () => {
  usePrimaryNavigationBar();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<MyCourseStatus>(() => readTabFromRouter() ?? 'booked');
  const [list, setList] = useState<MyCourseItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 评价弹窗
  const [evaluateSheetVisible, setEvaluateSheetVisible] = useState(false);
  const [evaluateCourse, setEvaluateCourse] = useState<MyCourseItem | null>(null);

  // 解析路由参数（每次页面显示重新读取，兼容栈内复用场景）
  useDidShow(() => {
    const tab = readTabFromRouter();
    if (tab) {
      setActiveTab(tab);
    }
  });

  // 读取当前主题，用于在最外层容器添加 theme class
  const { activeTheme } = useThemeStore();
  const themeClass = THEME_CLASS_MAP[activeTheme] || '';

  // 加载课程列表
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await myCourseService.getList(profile?.id);
      setList(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('加载我的课程失败', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // 按 Tab 过滤
  const filteredList = useMemo(() => {
    return list.filter((item) => item.status === activeTab);
  }, [list, activeTab]);

  // 操作按钮
  const renderActions = useCallback((item: MyCourseItem) => {
    if (item.status === 'booked') {
      return (
        <View className="flex items-center gap-[16rpx]">
          <View
            className="h-[64rpx] px-[28rpx] rounded-[32rpx] border border-border center press-scale"
            onClick={(e) => {
              e.stopPropagation();
              Taro.showModal({
                title: '取消预约',
                content: '确定要取消这门课程的预约吗？取消后将无法恢复。',
                success: async (res) => {
                  if (res.confirm) {
                    await myCourseService.cancel(item.bookingId);
                    setList((prev) =>
                      prev.map((i) =>
                        i.id === item.id ? { ...i, status: 'cancelled' as MyCourseStatus } : i,
                      ),
                    );
                    Taro.showToast({ title: '已取消预约', icon: 'success' });
                    void subscribeMessageService.runFlow('E25', {
                      bookingLabel: item.courseName,
                      className: item.courseName,
                    });
                  }
                },
              });
            }}
          >
            <Text className="text-[26rpx] text-muted-foreground">取消</Text>
          </View>
          <View
            className="h-[64rpx] px-[28rpx] rounded-[32rpx] bg-gradient-primary center press-scale"
            onClick={(e) => {
              e.stopPropagation();
              Taro.navigateTo({
                url: `/package-course/pages/booking-record-detail/index?id=${item.bookingId}`,
              });
            }}
          >
            <Text className="text-[26rpx] font-medium text-white">查看详情</Text>
          </View>
        </View>
      );
    }

    if (item.status === 'waiting') {
      return (
        <View className="flex items-center gap-[16rpx]">
          <View
            className="h-[64rpx] px-[28rpx] rounded-[32rpx] border border-border center press-scale"
            onClick={(e) => {
              e.stopPropagation();
              Taro.showModal({
                title: '取消排队',
                content: '确定要取消这门课程的排队吗？取消后将不再保留排队位置。',
                success: async (res) => {
                  if (res.confirm) {
                    await myCourseService.cancel(item.bookingId);
                    setList((prev) =>
                      prev.map((i) =>
                        i.id === item.id ? { ...i, status: 'cancelled' as MyCourseStatus } : i,
                      ),
                    );
                    Taro.showToast({ title: '已取消排队', icon: 'success' });
                    void subscribeMessageService.runFlow('E25', {
                      bookingLabel: item.courseName,
                      className: item.courseName,
                    });
                  }
                },
              });
            }}
          >
            <Text className="text-[26rpx] text-muted-foreground">取消排队</Text>
          </View>
          <View className="h-[64rpx] px-[28rpx] rounded-[32rpx] bg-warning/10 center">
            <Text className="text-[26rpx] font-medium text-warning">
              排队第 {item.queuePosition} 位
            </Text>
          </View>
        </View>
      );
    }

    if (item.status === 'pending_evaluate') {
      return (
        <View
          className="h-[64rpx] px-[28rpx] rounded-[32rpx] bg-muted center press-scale"
          onClick={(e) => {
            e.stopPropagation();
            Taro.showToast({ title: '评价功能即将上线', icon: 'none' });
          }}
        >
          <Text className="text-[26rpx] text-muted-foreground">评价即将上线</Text>
        </View>
      );
    }

    return (
      <View className="h-[64rpx] px-[28rpx] rounded-[32rpx] bg-muted center">
        <Text className="text-[26rpx] text-muted-foreground">已取消</Text>
      </View>
    );
  }, []);

  // 提交评价
  const handleEvaluateSubmit = useCallback(
    async (_payload: { rating: number; content: string }) => {
      if (!evaluateCourse) return;
      // 模拟提交
      await new Promise((resolve) => setTimeout(resolve, 600));
      // 更新本地状态：标记为已评价（从待评价列表移除）
      setList((prev) =>
        prev.map((item) =>
          item.id === evaluateCourse.id ? { ...item, status: 'booked' as MyCourseStatus } : item,
        ),
      );
      Taro.showToast({ title: '评价成功', icon: 'success' });
      setEvaluateCourse(null);
    },
    [evaluateCourse],
  );

  return (
    <View
      className={cn(
        'min-h-screen bg-background flex flex-col pb-[env(safe-area-inset-bottom)]',
        themeClass,
      )}
    >
      {/* ====== 顶部 Tab ====== */}
      <View className="sticky top-0 z-50 bg-card border-b border-border px-[32rpx] pt-[12rpx] pb-[16rpx]">
        <SegmentedControl
          options={TABS.map((tab) => ({ label: tab.label, value: tab.key }))}
          value={activeTab}
          onChange={(value) => setActiveTab(value as MyCourseStatus)}
        />
      </View>

      {/* ====== 课程列表 ====== */}
      <ScrollView scrollY className="flex-1" showScrollbar={false}>
        <View className="px-[32rpx] py-[24rpx] pb-[48rpx]">
          {loading ? (
            <Loading text="加载中..." />
          ) : filteredList.length === 0 ? (
            <Empty
              icon="mdi-calendar-blank"
              description={`暂无${TABS.find((t) => t.key === activeTab)?.label}课程`}
            />
          ) : (
            <View className="flex flex-col gap-[20rpx]">
              {filteredList.map((item) => (
                <View
                  key={item.id}
                  className={cn(
                    'bg-card rounded-[24rpx] p-[28rpx] shadow-card',
                    item.status === 'cancelled' && 'opacity-70',
                  )}
                >
                  {/* 标题行 */}
                  <View className="flex items-center justify-between mb-[16rpx]">
                    <Text className="text-[30rpx] font-bold text-foreground truncate flex-1 mr-[16rpx]">
                      {item.courseName}
                    </Text>
                    <View className={cn('tag', STATUS_CLASS[item.status])}>
                      <Text>{STATUS_TEXT[item.status]}</Text>
                    </View>
                  </View>

                  {/* 信息行 */}
                  <View className="flex items-center gap-[8rpx] mb-[10rpx]">
                    <Icon name="mdi-clock-outline" size={20} color="mutedForeground" />
                    <Text className="text-[26rpx] text-muted-foreground">
                      {formatCourseTime(item.date, item.startTime, item.endTime)}
                    </Text>
                  </View>

                  <View className="flex items-center gap-[8rpx] mb-[10rpx]">
                    <Icon name="mdi-account-outline" size={20} color="mutedForeground" />
                    <Text className="text-[26rpx] text-muted-foreground">
                      授课老师：{item.teacherName}
                    </Text>
                  </View>

                  {item.room && (
                    <View className="flex items-center gap-[8rpx] mb-[16rpx]">
                      <Icon name="mdi-map-marker-outline" size={20} color="mutedForeground" />
                      <Text className="text-[26rpx] text-muted-foreground">教室：{item.room}</Text>
                    </View>
                  )}

                  {item.status === 'waiting' && item.queuePosition && (
                    <View className="mb-[16rpx]">
                      <Text className="text-[24rpx] text-warning">
                        当前排在第 {item.queuePosition} 位
                      </Text>
                    </View>
                  )}

                  {item.status === 'pending_evaluate' && item.evaluateDeadline && (
                    <View className="mb-[16rpx]">
                      <Text className="text-[24rpx] text-purple">
                        评价截止：{formatCourseTime(item.evaluateDeadline, '', '')}
                      </Text>
                    </View>
                  )}

                  {/* 分隔线 + 操作 */}
                  <View className="h-[1rpx] bg-border/60 my-[20rpx]" />
                  <View className="flex items-center justify-end">{renderActions(item)}</View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ====== 评价弹窗 ====== */}
      <EvaluateSheet
        visible={evaluateSheetVisible}
        courseName={evaluateCourse?.courseName || ''}
        onClose={() => {
          setEvaluateSheetVisible(false);
          setEvaluateCourse(null);
        }}
        onSubmit={handleEvaluateSubmit}
      />
    </View>
  );
};

export default withRouteGuard(MyCourse);
