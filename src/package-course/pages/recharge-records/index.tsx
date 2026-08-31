import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import StudentAvatar from '@/components/student/StudentAvatar';
import { usePagedQuery } from '@/hooks/usePagedQuery';
import { packageService } from '@/services';
import type { PackageTransaction } from '@/types/course-package';
import { useAuth } from '@/utils/auth';
import { withRouteGuard } from '@/utils/route-guard';

/** 支付方式映射 */
const FEE_METHOD_LABEL: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  transfer: '转账',
  other: '其他',
};

const PAGE_SIZE = 30;

/** 格式化日期 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

/** 金额最小为 0，不允许空 */
function resolveAmount(record: PackageTransaction): number {
  const raw =
    record.type === 'refund'
      ? (record.refund_amount ?? record.fee_amount)
      : (record.fee_amount ?? record.refund_amount);
  return Math.max(0, Number(raw) || 0);
}

type TransactionFilterType = 'all' | 'recharge' | 'refund';

const DROPDOWN_SCROLL_THRESHOLD = 6;
const DROPDOWN_MAX_HEIGHT = '420rpx';

interface LocalFilterOption {
  label: string;
  value: string;
}

interface LocalFilterItem {
  id: string;
  label: string;
  value: string;
  options: LocalFilterOption[];
}

interface LocalFilterBarProps {
  filters: LocalFilterItem[];
  activeId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string, value: string) => void;
}

const LocalFilterBar: React.FC<LocalFilterBarProps> = ({
  filters,
  activeId,
  onToggle,
  onSelect,
}) => (
  <View className="flex rounded-t-[24rpx] bg-card shadow-soft overflow-visible">
    {filters.map((filter, index) => {
      const isActive = activeId === filter.id;
      const isScrollable = filter.options.length > DROPDOWN_SCROLL_THRESHOLD;

      return (
        <View
          key={filter.id}
          className={cn('relative flex-1', index > 0 && 'border-l border-border/30')}
        >
          <View
            className={cn(
              'flex items-center justify-center gap-[8rpx] py-[24rpx] text-[26rpx] font-medium transition-colors',
              isActive ? 'text-primary font-semibold' : 'text-muted-foreground',
            )}
            onClick={() => onToggle(filter.id)}
          >
            <Text className="truncate">{filter.label}</Text>
            <Text className={cn('text-[20rpx] transition-transform', isActive && 'rotate-180')}>
              ▼
            </Text>
          </View>

          {isActive && (
            <View className="absolute left-0 right-0 top-full z-50 overflow-hidden rounded-b-[24rpx] bg-card shadow-float">
              <ScrollView
                scrollY={isScrollable}
                style={{
                  height: isScrollable ? DROPDOWN_MAX_HEIGHT : 'auto',
                  maxHeight: DROPDOWN_MAX_HEIGHT,
                }}
              >
                {filter.options.map((option) => (
                  <View
                    key={option.value}
                    className={cn(
                      'flex items-center px-[28rpx] py-[24rpx] text-[24rpx] active:bg-muted transition-colors',
                      filter.value === option.value
                        ? 'bg-primary-bg text-primary font-semibold'
                        : 'text-foreground',
                    )}
                    onClick={() => onSelect(filter.id, option.value)}
                  >
                    <Text className="flex-1">{option.label}</Text>
                    {filter.value === option.value && (
                      <Text className="text-[22rpx] text-primary">✓</Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      );
    })}
  </View>
);

/**
 * RechargeRecordsPage - 课包流水列表页
 *
 * 首屏 30 条 + 触底/按钮续拉，避免一次拉全量给服务器带来压力。
 */
const RechargeRecordsPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';

  const [filterStudentId, setFilterStudentId] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionFilterType>('all');
  const [routeStudentId, setRouteStudentId] = useState('');
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [studentOptions, setStudentOptions] = useState<Array<{ id: string; name: string }>>([]);

  const queryStudentId = routeStudentId || filterStudentId || undefined;

  const fetcher = useCallback(
    async (page: number, pageSize: number) => {
      if (!currentUserId) {
        return {
          list: [] as PackageTransaction[],
          pagination: { page, pageSize, total: 0, totalPages: 1 },
        };
      }
      return packageService.getTransactions(currentUserId, {
        studentId: queryStudentId,
        page,
        pageSize,
      });
    },
    [currentUserId, queryStudentId],
  );

  const { list, total, loading, loadingMore, hasMore, reload, loadMore } =
    usePagedQuery<PackageTransaction>({
      pageSize: PAGE_SIZE,
      fetcher,
      enabled: Boolean(currentUserId),
    });

  // 累积学员筛选项（随分页追加）
  useEffect(() => {
    setStudentOptions((prev) => {
      const map = new Map(prev.map((s) => [s.id, s.name]));
      list.forEach((r) => {
        if (!map.has(r.student_id)) {
          map.set(r.student_id, r.student_name);
        }
      });
      return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    });
  }, [list]);

  const filteredRecords = useMemo(() => {
    if (typeFilter === 'all') return list;
    return list.filter((record) => record.type === typeFilter);
  }, [list, typeFilter]);

  const filterConfigs = useMemo(() => {
    const filters: Array<{
      id: string;
      label: string;
      value: string;
      options: Array<{ label: string; value: string }>;
    }> = [];

    if (!routeStudentId) {
      filters.push({
        id: 'student',
        label: studentOptions.find((item) => item.id === filterStudentId)?.name || '全部学员',
        value: filterStudentId || 'all',
        options: [
          { label: '全部学员', value: 'all' },
          ...studentOptions.map((item) => ({ label: item.name, value: item.id })),
        ],
      });
    }

    filters.push({
      id: 'type',
      label:
        typeFilter === 'all' ? '全部流水' : typeFilter === 'recharge' ? '充值记录' : '退费记录',
      value: typeFilter,
      options: [
        { label: '全部流水', value: 'all' },
        { label: '充值记录', value: 'recharge' },
        { label: '退费记录', value: 'refund' },
      ],
    });

    return filters;
  }, [filterStudentId, routeStudentId, studentOptions, typeFilter]);

  useLoad(() => {
    const params = Taro.getCurrentInstance().router?.params || {};
    const studentId = decodeURIComponent(params.studentId || '');
    setRouteStudentId(studentId);
    setFilterStudentId(studentId);
  });

  useEffect(() => {
    if (!currentUserId) return;
    void reload().catch(() => {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    });
  }, [currentUserId, queryStudentId, reload]);

  const handleFilterToggle = useCallback((id: string) => {
    setActiveFilterId((prev) => (prev === id ? null : id));
  }, []);

  const handleFilterSelect = useCallback((id: string, value: string) => {
    if (id === 'student') {
      setFilterStudentId(value === 'all' ? '' : value);
    }
    if (id === 'type') {
      setTypeFilter(value as TransactionFilterType);
    }
    setActiveFilterId(null);
  }, []);

  const handleLoadMore = useCallback(() => {
    void loadMore().catch(() => {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    });
  }, [loadMore]);

  if (loading && list.length === 0) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-[200rpx]">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <View className="min-h-screen bg-f5faf8 pb-[80rpx]">
      <View className="px-[32rpx] relative z-10 pt-[20rpx]">
        <LocalFilterBar
          filters={filterConfigs}
          activeId={activeFilterId}
          onToggle={handleFilterToggle}
          onSelect={handleFilterSelect}
        />
      </View>

      {filteredRecords.length === 0 ? (
        <View className="px-[32rpx] pt-[32rpx]">
          <Empty description="暂无课包流水" />
        </View>
      ) : (
        <View
          className="px-[32rpx] py-[24rpx] flex flex-col gap-[20rpx]"
          onClick={() => setActiveFilterId(null)}
        >
          {filteredRecords.map((record) => {
            const amount = resolveAmount(record);
            const methodKey = record.fee_method || 'other';
            return (
              <View
                key={record.id}
                className={cn(
                  'rounded-[24rpx] p-[32rpx] shadow-soft border press-scale',
                  record.type === 'refund'
                    ? 'bg-[#f4f5f7] border-[#e5e7eb]'
                    : 'bg-card border-transparent',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!record.student_id) return;
                  void Taro.navigateTo({
                    url: `/package-student/pages/student-detail/index?id=${encodeURIComponent(record.student_id)}`,
                  });
                }}
              >
                <View className="flex items-center justify-between mb-[16rpx]">
                  <View className="flex items-center gap-[12rpx] min-w-0">
                    <StudentAvatar
                      name={record.student_name}
                      src={record.student_avatar}
                      size="sm"
                    />
                    <Text
                      className={cn(
                        'text-[28rpx] font-semibold truncate',
                        record.type === 'refund' ? 'text-[#4b5563]' : 'text-foreground',
                      )}
                    >
                      {record.student_name}
                    </Text>
                    <View
                      className={cn(
                        'rounded-full px-[16rpx] py-[6rpx] flex-shrink-0',
                        record.type === 'refund' ? 'bg-[#e5e7eb]' : 'bg-primary-bg',
                      )}
                    >
                      <Text
                        className={cn(
                          'text-[20rpx] font-semibold',
                          record.type === 'refund' ? 'text-[#6b7280]' : 'text-primary',
                        )}
                      >
                        {record.type === 'refund' ? '退费' : '充值'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-[22rpx] text-muted-foreground flex-shrink-0 ml-[12rpx]">
                    {formatDate(record.created_at)}
                  </Text>
                </View>

                <Text
                  className={cn(
                    'text-[26rpx] block mb-[16rpx]',
                    record.type === 'refund' ? 'text-[#6b7280]' : 'text-muted-foreground',
                  )}
                >
                  {record.package_name}
                </Text>

                <View className="flex items-start justify-between gap-[24rpx]">
                  <View className="flex flex-1 flex-wrap items-center gap-[16rpx]">
                    {record.type === 'recharge' && (
                      <>
                        <View className="py-[6rpx] px-[20rpx] rounded-md bg-primary-15">
                          <Text className="text-[22rpx] font-semibold text-primary">
                            充值 {record.purchased_hours || 0}课时
                          </Text>
                        </View>
                        {(record.gift_hours || 0) > 0 && (
                          <View className="py-[6rpx] px-[20rpx] rounded-md bg-success-15">
                            <Text className="text-[22rpx] font-semibold text-success">
                              +{record.gift_hours}赠送
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                    {record.type === 'refund' && (
                      <Text className="text-[24rpx] text-[#6b7280]">
                        原因：{record.reason || '无'}
                      </Text>
                    )}
                  </View>
                  <View className="flex flex-col items-end gap-[4rpx] flex-shrink-0">
                    <Text className="text-[20rpx] text-muted-foreground">
                      {FEE_METHOD_LABEL[methodKey] || methodKey}
                    </Text>
                    <Text
                      className={cn(
                        'text-[30rpx] font-bold',
                        record.type === 'refund' ? 'text-[#6b7280]' : 'text-foreground',
                      )}
                    >
                      {record.type === 'refund' ? '-' : ''}¥{amount}
                    </Text>
                  </View>
                </View>
                {record.operator_name && (
                  <Text className="mt-[16rpx] block text-[22rpx] text-muted-foreground">
                    操作人：{record.operator_name}
                  </Text>
                )}
              </View>
            );
          })}

          {hasMore ? (
            <View
              className="mt-[8rpx] rounded-[18rpx] py-[20rpx] flex items-center justify-center bg-muted active:opacity-70"
              onClick={handleLoadMore}
            >
              <Text className="text-[26rpx] text-muted-foreground">
                {loadingMore ? '加载中...' : `加载更多（${list.length}/${total}）`}
              </Text>
            </View>
          ) : (
            <View className="mt-[8rpx] flex items-center justify-center py-[12rpx]">
              <Text className="text-[22rpx] text-muted-foreground">共 {total} 条流水</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default withRouteGuard(RechargeRecordsPage);
