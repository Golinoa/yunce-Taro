import { Button, Input, Picker, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { cardTypeService } from '@/services/card-type';
import { memberCardService } from '@/services/member-card';
import { useThemeStore } from '@/stores/theme';
import type { CardType } from '@/types/card-type';

type MigrationRow = {
  cardTypeId: string;
  remainingCount: string;
  expiredAt: string;
  remark: string;
};

const newRow = (): MigrationRow => ({
  cardTypeId: '',
  remainingCount: '',
  expiredAt: '',
  remark: '',
});

const StudentMigrationPage: React.FC = () => {
  const { activeTheme } = useThemeStore();
  const studentId = useMemo(() => Taro.getCurrentInstance().router?.params?.studentId || '', []);
  const [cardTypes, setCardTypes] = useState<CardType[]>([]);
  const [rows, setRows] = useState<MigrationRow[]>([newRow()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    cardTypeService
      .getList()
      .then((items) => {
        setCardTypes(items.filter((item) => item.kind === 'count' && item.status === 'active'));
      })
      .catch(() => Taro.showToast({ title: '卡种加载失败', icon: 'none' }))
      .finally(() => setLoading(false));
  }, []);

  const updateRow = (index: number, patch: Partial<MigrationRow>) => {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  };

  const submit = async () => {
    if (
      !studentId ||
      rows.some((row) => !row.cardTypeId || !row.remainingCount || !row.expiredAt || !row.remark)
    ) {
      Taro.showToast({ title: '请完整填写迁移信息', icon: 'none' });
      return;
    }
    const subjects = rows.map((row) => row.cardTypeId);
    if (new Set(subjects).size !== subjects.length) {
      Taro.showToast({ title: '同一科目只能迁移一次', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      for (const row of rows) {
        await memberCardService.migrate({
          cardTypeId: row.cardTypeId,
          studentId,
          remainingCount: Number(row.remainingCount),
          expiredAt: new Date(`${row.expiredAt}T23:59:59.000Z`).toISOString(),
          remark: row.remark.trim(),
          idempotencyKey: `migration:${studentId}:${row.cardTypeId}:${row.expiredAt}`,
        });
      }
      Taro.showToast({ title: '历史数据迁移成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 500);
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '迁移失败，请重试',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background px-[32rpx] py-[32rpx]')}
    >
      <Text className="text-[40rpx] font-bold text-foreground">历史数据迁移</Text>
      <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx] mb-[28rpx]">
        按科目录入旧系统剩余次数、有效期和备注；迁移卡金额为 0，不计售卡业绩。
      </Text>
      {loading ? (
        <Text className="text-muted-foreground">加载卡种中...</Text>
      ) : (
        rows.map((row, index) => (
          <View key={index} className="bg-card rounded-[24rpx] p-[24rpx] mb-[20rpx]">
            <Text className="text-foreground font-medium">科目 {index + 1}</Text>
            <Picker
              mode="selector"
              range={cardTypes.map((item) => item.name)}
              value={Math.max(
                0,
                cardTypes.findIndex((item) => item.id === row.cardTypeId),
              )}
              onChange={(event) =>
                updateRow(index, { cardTypeId: cardTypes[Number(event.detail.value)]?.id || '' })
              }
            >
              <View className="mt-[18rpx] border border-border rounded-[12rpx] p-[18rpx] text-muted-foreground">
                {cardTypes.find((item) => item.id === row.cardTypeId)?.name || '选择次数卡种'}
              </View>
            </Picker>
            <Input
              className="mt-[18rpx] border border-border rounded-[12rpx] p-[18rpx]"
              type="number"
              placeholder="剩余次数"
              value={row.remainingCount}
              onInput={(event) => updateRow(index, { remainingCount: event.detail.value })}
            />
            <Input
              className="mt-[18rpx] border border-border rounded-[12rpx] p-[18rpx]"
              type="text"
              placeholder="有效期（YYYY-MM-DD）"
              value={row.expiredAt}
              onInput={(event) => updateRow(index, { expiredAt: event.detail.value })}
            />
            <Input
              className="mt-[18rpx] border border-border rounded-[12rpx] p-[18rpx]"
              type="text"
              placeholder="迁移备注（必填）"
              value={row.remark}
              onInput={(event) => updateRow(index, { remark: event.detail.value })}
            />
          </View>
        ))
      )}
      <View className="flex gap-[20rpx] mb-[24rpx]">
        <Button className="flex-1" onClick={() => setRows((current) => [...current, newRow()])}>
          新增科目
        </Button>
        <Button
          className="flex-1"
          type="primary"
          loading={submitting}
          disabled={submitting}
          onClick={submit}
        >
          提交迁移
        </Button>
      </View>
    </View>
  );
};

export default StudentMigrationPage;
