import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import SegmentedControl from '@/components/SegmentedControl';
import type { ExpenseCategoryType, IncomeCategoryType } from '@/data/data-center';
import { dataCenterService } from '@/services/data-center';

/**
 * 记一笔页面
 *
 * 快速记录收入或支出，包含：
 * - 顶部：支出/入账 分段切换 + 日期选择
 * - 金额输入：¥ 符号 + 大数字显示区
 * - 摊销周期（可选）+ 备注输入
 * - 分类图标网格
 * - 底部数字键盘（0-9 + . + 删除 + 确定）
 */
const RecordTransaction: React.FC = () => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('0');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<(ExpenseCategoryType | IncomeCategoryType)[]>([]);
  // 以下三项在提交时读取但无 UI 修改入口，保留为常量避免死状态
  const date = dayjs().format('YYYY-MM-DD');
  const note = '';
  const [showAmortization, setShowAmortization] = useState(false);
  const amortizationPeriod = '';
  const [submitting, setSubmitting] = useState(false);

  /** 加载分类数据 */
  useEffect(() => {
    const loadCategories = async () => {
      if (type === 'expense') {
        const result = await dataCenterService.getExpenseCategories();
        setCategories(result);
      } else {
        const result = await dataCenterService.getIncomeCategories();
        setCategories(result);
      }
      setSelectedCategory(null);
    };
    loadCategories();
  }, [type]);

  /** 切换类型 */
  const handleTypeChange = useCallback((value: string) => {
    setType(value as 'expense' | 'income');
    setAmount('0');
    setSelectedCategory(null);
  }, []);

  /** 数字键盘输入 */
  const handleKeyPress = useCallback((key: string) => {
    setAmount((prev) => {
      if (key === 'del') {
        if (prev.length <= 1 || (prev.length === 2 && prev.startsWith('-'))) {
          return '0';
        }
        return prev.slice(0, -1);
      }

      if (key === '.') {
        if (prev.includes('.')) return prev;
        return prev + '.';
      }

      if (prev === '0') {
        return key === '.' ? '0.' : key;
      }

      // 限制小数点后两位
      if (prev.includes('.')) {
        const decimalPart = prev.split('.')[1];
        if (decimalPart && decimalPart.length >= 2) return prev;
      }

      // 限制最大金额 999999.99
      if (!prev.includes('.') && prev.length >= 6) return prev;

      return prev + key;
    });
  }, []);

  /** 选择分类 */
  const handleCategorySelect = useCallback((categoryId: string) => {
    if (categoryId === 'manage') {
      Taro.showToast({ title: '分类管理', icon: 'none' });
      return;
    }
    setSelectedCategory(categoryId);
  }, []);

  /** 选择日期 */
  const handleDateSelect = useCallback(() => {
    Taro.showToast({ title: '日期选择', icon: 'none' });
  }, []);

  /** 提交 */
  const handleSubmit = useCallback(async () => {
    if (!selectedCategory) {
      Taro.showToast({ title: '请选择分类', icon: 'none' });
      return;
    }

    const amountNum = parseFloat(amount);
    if (amountNum <= 0) {
      Taro.showToast({ title: '请输入金额', icon: 'none' });
      return;
    }

    const selectedCat = categories.find((c) => c.id === selectedCategory);

    setSubmitting(true);
    try {
      const recordData = {
        amount: amountNum,
        type,
        category: selectedCat?.name || '',
        date,
        remark: note || '',
        ...(showAmortization && amortizationPeriod
          ? { amortizationPeriod: parseInt(amortizationPeriod, 10) }
          : {}),
      };
      await dataCenterService.createTransaction(recordData);
      Taro.showToast({ title: '记录成功', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch {
      Taro.showToast({ title: '记录失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    type,
    amount,
    selectedCategory,
    categories,
    date,
    note,
    showAmortization,
    amortizationPeriod,
  ]);

  /** 格式化显示金额 */
  const formatDisplayAmount = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return num.toLocaleString('zh-CN', {
      minimumFractionDigits: value.includes('.') ? value.split('.')[1]?.length || 0 : 0,
      maximumFractionDigits: 2,
    });
  };

  /** 数字键盘布局 */
  const keyboardKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'del'],
  ];

  return (
    <View className="min-h-screen bg-background flex flex-col">
      {/* 顶部类型切换 + 日期 */}
      <View className="bg-white px-[32rpx] pt-[24rpx] pb-[20rpx]">
        <View className="flex items-center justify-between mb-[24rpx]">
          <View className="w-[320rpx]">
            <SegmentedControl
              options={[
                { label: '支出', value: 'expense' },
                { label: '入账', value: 'income' },
              ]}
              value={type}
              onChange={handleTypeChange}
            />
          </View>
          <View
            className="flex items-center gap-[8rpx] bg-muted px-[20rpx] py-[12rpx] rounded-full"
            onClick={handleDateSelect}
          >
            <Icon name="mdi-calendar" size={24} color="muted" />
            <Text className="text-[26rpx] text-foreground font-medium">
              {dayjs(date).format('MM月DD日')}
            </Text>
            <Icon name="mdi-chevron-down" size={20} color="muted" />
          </View>
        </View>

        {/* 金额显示区 */}
        <View className="flex items-end justify-center py-[32rpx]">
          <Text
            className={`text-[48rpx] font-bold mr-[8rpx] ${
              type === 'expense' ? 'text-destructive' : 'text-success'
            }`}
          >
            ¥
          </Text>
          <Text
            className={`text-[80rpx] font-bold leading-none ${
              type === 'expense' ? 'text-destructive' : 'text-success'
            }`}
          >
            {formatDisplayAmount(amount)}
          </Text>
        </View>
      </View>

      {/* 可滚动内容区 */}
      <ScrollView className="flex-1" scrollY>
        <View className="px-[24rpx] py-[24rpx]">
          {/* 摊销周期（仅支出） */}
          {type === 'expense' && (
            <View className="bg-white rounded-[24rpx] p-[24rpx] mb-[24rpx] shadow-card">
              <View
                className="flex items-center justify-between"
                onClick={() => setShowAmortization(!showAmortization)}
              >
                <View className="flex items-center gap-[12rpx]">
                  <Icon name="mdi-calendar-clock" size={28} color="primary" />
                  <Text className="text-[28rpx] text-foreground font-medium">摊销周期</Text>
                  <Text className="text-[24rpx] text-muted-foreground">（可选）</Text>
                </View>
                <Icon
                  name={showAmortization ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                  size={24}
                  color="muted"
                />
              </View>
              {showAmortization && (
                <View className="mt-[20rpx] flex items-center gap-[16rpx]">
                  <View className="flex-1 h-[80rpx] rounded-[16rpx] bg-muted px-[20rpx] flex items-center">
                    <Text className="text-[28rpx] text-foreground">
                      {amortizationPeriod || '请输入摊销月数'}
                    </Text>
                  </View>
                  <Text className="text-[26rpx] text-muted-foreground">个月</Text>
                </View>
              )}
            </View>
          )}

          {/* 备注 */}
          <View className="bg-white rounded-[24rpx] p-[24rpx] mb-[24rpx] shadow-card">
            <View className="flex items-center gap-[12rpx] mb-[16rpx]">
              <Icon name="mdi-file-document-outline" size={28} color="primary" />
              <Text className="text-[28rpx] text-foreground font-medium">备注</Text>
            </View>
            <View className="min-h-[80rpx] bg-muted rounded-[16rpx] px-[20rpx] py-[16rpx]">
              <Text
                className={`text-[28rpx] ${note ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {note || '添加备注...'}
              </Text>
            </View>
          </View>

          {/* 分类图标网格 */}
          <View className="bg-white rounded-[24rpx] p-[24rpx] shadow-card">
            <Text className="text-[28rpx] text-foreground font-medium block mb-[20rpx]">
              选择分类
            </Text>
            <View className="grid grid-cols-4 gap-[16rpx]">
              {categories.map((category) => {
                const isSelected = selectedCategory === category.id;
                return (
                  <View
                    key={category.id}
                    className={`flex flex-col items-center gap-[8rpx] py-[16rpx] rounded-[16rpx] transition-all ${
                      isSelected ? 'bg-primary-10' : 'press-bg'
                    }`}
                    onClick={() => handleCategorySelect(category.id)}
                  >
                    <View
                      className={`w-[72rpx] h-[72rpx] rounded-[20rpx] flex items-center justify-center ${
                        isSelected
                          ? 'bg-gradient-primary'
                          : type === 'expense'
                            ? 'bg-destructive-10'
                            : 'bg-success-bg'
                      }`}
                    >
                      <Icon
                        name={category.icon}
                        size={32}
                        color={
                          isSelected ? 'white' : type === 'expense' ? 'destructive' : 'success'
                        }
                      />
                    </View>
                    <Text
                      className={`text-[22rpx] ${
                        isSelected ? 'text-primary font-medium' : 'text-foreground-secondary'
                      }`}
                    >
                      {category.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 底部数字键盘 */}
      <View className="bg-white border-t-[2rpx] border-border pb-safe-bar">
        <View className="flex">
          {/* 数字键区 */}
          <View className="flex-1">
            {keyboardKeys.map((row, rowIndex) => (
              <View key={rowIndex} className="flex">
                {row.map((key) => {
                  const isDel = key === 'del';
                  return (
                    <View
                      key={key}
                      className={`flex-1 h-[100rpx] flex items-center justify-center border-r-[2rpx] border-b-[2rpx] border-border press-bg ${
                        rowIndex === keyboardKeys.length - 1 && isDel ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleKeyPress(key)}
                    >
                      {isDel ? (
                        <Icon name="mdi-delete" size={36} color="foreground" />
                      ) : (
                        <Text className="text-[40rpx] font-medium text-foreground">{key}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
          {/* 确定按钮 */}
          <View
            className={`w-[180rpx] flex items-center justify-center press-scale ${
              submitting ? 'opacity-60' : ''
            }`}
            style={{
              background:
                type === 'expense'
                  ? 'linear-gradient(135deg, hsl(var(--destructive)), hsl(var(--destructive)))'
                  : 'linear-gradient(135deg, hsl(var(--success)), hsl(var(--success)))',
            }}
            onClick={!submitting ? handleSubmit : undefined}
          >
            <Text className="text-[32rpx] font-bold text-white">
              {submitting ? '提交中' : '确定'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default RecordTransaction;
