import { View, Text } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useMemo } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { packageService } from '@/services';
import { useAuth } from '@/utils/auth';
import { withRouteGuard } from '@/utils/route-guard';

/** 充值记录项 */
interface RechargeRecord {
  id: string;
  packageId?: string;
  studentId: string;
  studentName: string;
  packageName?: string;
  totalHours?: number;
  giftHours: number;
  hours?: number;
  feeAmount?: number | undefined;
  feeMethod?: string | undefined;
  method?: string;
  createdAt: string;
}

/** 支付方式映射 */
const FEE_METHOD_LABEL: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  transfer: '转账',
  other: '其他',
};

/** 格式化日期 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

/**
 * RechargeRecordsPage - 充值记录列表页
 *
 * 使用场景：查看所有学员的课时充值历史记录
 * 功能：按时间倒序展示、按学员筛选
 */
const RechargeRecordsPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';

  const [records, setRecords] = useState<RechargeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStudentId, setFilterStudentId] = useState('');

  // 学员列表（从记录中提取去重）
  const studentOptions = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => {
      if (!map.has(r.studentId)) {
        map.set(r.studentId, r.studentName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [records]);

  // 筛选后的记录
  const filteredRecords = useMemo(() => {
    if (!filterStudentId) return records;
    return records.filter((r) => r.studentId === filterStudentId);
  }, [records, filterStudentId]);

  // 加载数据
  const fetchRecords = useCallback(async () => {
    if (!currentUserId) return;
    try {
      setLoading(true);
      const data = await packageService.getRechargeRecords(
        currentUserId,
        filterStudentId || undefined,
      );
      setRecords(data);
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [currentUserId, filterStudentId]);

  useLoad(() => {
    fetchRecords();
  });

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-[200rpx]">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <View className="min-h-screen bg-f5faf8">
      {/* 筛选栏 */}
      {studentOptions.length > 1 && (
        <View className="sticky top-0 z-10 bg-card px-[32rpx] py-[20rpx] border-b border-border/30">
          <View className="flex gap-[16rpx] overflow-x-auto">
            <View
              className={cn(
                'py-[12rpx] px-[28rpx] rounded-full text-[24rpx] font-medium whitespace-nowrap flex-shrink-0',
                !filterStudentId ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
              )}
              onClick={() => setFilterStudentId('')}
            >
              全部
            </View>
            {studentOptions.map((s) => (
              <View
                key={s.id}
                className={cn(
                  'py-[12rpx] px-[28rpx] rounded-full text-[24rpx] font-medium whitespace-nowrap flex-shrink-0',
                  filterStudentId === s.id
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground',
                )}
                onClick={() => setFilterStudentId(s.id)}
              >
                {s.name}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 记录列表 */}
      {filteredRecords.length === 0 ? (
        <Empty description="暂无充值记录" />
      ) : (
        <View className="px-[32rpx] py-[24rpx] flex flex-col gap-[20rpx]">
          {filteredRecords.map((record) => (
            <View key={record.id} className="bg-card rounded-[24rpx] p-[32rpx] shadow-soft">
              {/* 顶部：学员名 + 时间 */}
              <View className="flex items-center justify-between mb-[16rpx]">
                <View className="flex items-center gap-[12rpx]">
                  <View className="w-[48rpx] h-[48rpx] rounded-full bg-primary-15 flex items-center justify-center">
                    <Text className="text-[24rpx] font-bold text-primary">
                      {record.studentName[0]}
                    </Text>
                  </View>
                  <Text className="text-[28rpx] font-semibold text-foreground">
                    {record.studentName}
                  </Text>
                </View>
                <Text className="text-[22rpx] text-muted-foreground">
                  {formatDate(record.createdAt)}
                </Text>
              </View>

              {/* 课包名 */}
              <Text className="text-[26rpx] text-muted-foreground block mb-[16rpx]">
                {record.packageName}
              </Text>

              {/* 底部：课时 + 金额 */}
              <View className="flex items-center justify-between">
                <View className="flex items-center gap-[16rpx]">
                  <View className="py-[6rpx] px-[20rpx] rounded-md bg-primary-15">
                    <Text className="text-[22rpx] font-semibold text-primary">
                      {record.totalHours}课时
                    </Text>
                  </View>
                  {record.giftHours > 0 && (
                    <View className="py-[6rpx] px-[20rpx] rounded-md bg-success-15">
                      <Text className="text-[22rpx] font-semibold text-success">
                        +{record.giftHours}赠送
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex items-center gap-[8rpx]">
                  {record.feeAmount != null && record.feeAmount > 0 && (
                    <Text className="text-[30rpx] font-bold text-foreground">
                      ¥{record.feeAmount}
                    </Text>
                  )}
                  {record.feeMethod && (
                    <Text className="text-[20rpx] text-muted-foreground">
                      {FEE_METHOD_LABEL[record.feeMethod] || record.feeMethod}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default withRouteGuard(RechargeRecordsPage);
