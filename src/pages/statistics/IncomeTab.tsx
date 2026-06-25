import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';
import BarChart from '@/components/statistics/BarChart';
import ChartContainer from '@/components/statistics/ChartContainer';
import type { ChartDataItem } from '@/components/statistics/ChartContainer';
import KpiCard from '@/components/statistics/KpiCard';
import RankList from '@/components/statistics/RankList';
import type { RankItem } from '@/components/statistics/RankList';
import { formatDateCN } from '@/utils/format';
import { FEE_METHOD_MAP } from './useStatistics';

interface IncomeTabProps {
  isTeacher: boolean;
  incomeData: { totalIncome: number; feeCount: number; avgPrice: number };
  displayIncomeTrend: ChartDataItem[];
  compareData: { mom: string; momValue: string; yoy: string; yoyValue: string };
  displayPaymentRank: { label: string; value: number; unit: string }[];
  paymentRank: RankItem[];
  incomeDetail: {
    id: string;
    name: string;
    type: string;
    date: string;
    amount: number;
    method: string;
  }[];
}

/** 收入统计 Tab 内容 */
const IncomeTab: React.FC<IncomeTabProps> = ({
  isTeacher,
  incomeData,
  displayIncomeTrend,
  compareData,
  displayPaymentRank,
  paymentRank,
  incomeDetail,
}) => {
  return (
    <>
      <KpiCard
        data={[
          { id: 'i1', label: '总收入', value: `¥${incomeData.totalIncome}`, unit: '' },
          { id: 'i2', label: '收费记录', value: incomeData.feeCount, unit: '笔' },
          { id: 'i3', label: '平均客单价', value: `¥${Math.round(incomeData.avgPrice)}`, unit: '' },
        ]}
      />

      <ChartContainer title="近6个月收入趋势" data={displayIncomeTrend} unit="元" theme="accent" />

      <View className="grid grid-cols-2 gap-3 mb-5">
        <View className="bg-white rounded-2xl p-4 shadow-soft text-center">
          <Text className="text-sm text-muted-foreground mb-1">环比上月</Text>
          <Text
            className={`text-2xl font-bold ${compareData.mom.startsWith('-') ? 'text-destructive' : 'text-success'}`}
          >
            {compareData.mom}
          </Text>
          <Text className="text-xs text-muted-foreground mt-1">{compareData.momValue}</Text>
        </View>
        <View className="bg-white rounded-2xl p-4 shadow-soft text-center">
          <Text className="text-sm text-muted-foreground mb-1">同比去年同月</Text>
          <Text
            className={`text-2xl font-bold ${compareData.yoy.startsWith('-') ? 'text-destructive' : 'text-success'}`}
          >
            {compareData.yoy}
          </Text>
          <Text className="text-xs text-muted-foreground mt-1">{compareData.yoyValue}</Text>
        </View>
      </View>

      {isTeacher && <BarChart title="收费方式收入排行" data={displayPaymentRank} unit="元" />}

      {isTeacher && paymentRank.length > 0 && (
        <RankList title="收费方式明细" data={paymentRank} mode="payment" emptyText="暂无明细数据" />
      )}

      {/* 收入明细列表 */}
      {incomeDetail.length > 0 && (
        <>
          <Text className="text-xl font-semibold text-foreground mb-3 mt-6">收入明细</Text>
          <View className="flex flex-col gap-3">
            {incomeDetail.map((item) => (
              <View key={item.id} className="bg-white rounded-2xl p-4 shadow-soft">
                <View className="flex items-center justify-between">
                  <View className="flex items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-gradient-accent flex items-center justify-center">
                      <Icon name="mdi-cash" size="sm" color="white" />
                    </View>
                    <View className="flex flex-col gap-1">
                      <Text className="text-lg font-medium text-foreground">{item.name}</Text>
                      <Text className="text-sm text-muted-foreground">
                        {formatDateCN(item.date)} · {item.type}
                      </Text>
                    </View>
                  </View>
                  <View className="flex flex-col items-end gap-1">
                    <Text className="text-lg font-semibold text-primary">¥{item.amount}</Text>
                    <Text className="text-sm text-muted-foreground">
                      {FEE_METHOD_MAP[item.method] || item.method}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
};

export default IncomeTab;
