/**
 * LegacyPackagesEditor - 老生历史课包录入表单（R1 + R6 共用）
 *
 * 使用场景：
 *  - R6：学员详情「卡包」tab 的「历史课包录入」入口（居中弹框内，studentId 已知）；
 *  - R1：学员列表「会员操作」→「录入历史课时」（弹框内先选学员，再录科目）。
 *
 * 说明：提交走 `opening` 期初入账接口（B4，原「历史数据迁移」页与接口已下线）。
 * 多科目录单：一科一张卡，同一科目只能录一次；金额为 0、不计售卡业绩。
 */
import { Button, Input, Picker, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useState } from 'react';
import { cardTypeService } from '@/services/card-type';
import { memberCardService } from '@/services/member-card';
import type { CardType } from '@/types/card-type';

type LegacyRow = {
  cardTypeId: string;
  remainingCount: string;
  expiredAt: string;
  remark: string;
};

const newRow = (): LegacyRow => ({
  cardTypeId: '',
  remainingCount: '',
  expiredAt: '',
  remark: '',
});

export interface LegacyPackagesEditorProps {
  studentId: string;
  /** 全部科目提交成功后回调（宿主借此关闭弹框 / 刷新卡包） */
  onSubmitted: () => void;
  onCancel?: () => void;
}

const LegacyPackagesEditor: React.FC<LegacyPackagesEditorProps> = ({
  studentId,
  onSubmitted,
  onCancel,
}) => {
  const [cardTypes, setCardTypes] = useState<CardType[]>([]);
  const [rows, setRows] = useState<LegacyRow[]>([newRow()]);
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

  const updateRow = (index: number, patch: Partial<LegacyRow>) => {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  };

  const submit = async () => {
    if (
      !studentId ||
      rows.some((row) => !row.cardTypeId || !row.remainingCount || !row.expiredAt || !row.remark)
    ) {
      Taro.showToast({ title: '请完整填写录入信息', icon: 'none' });
      return;
    }
    const subjects = rows.map((row) => row.cardTypeId);
    if (new Set(subjects).size !== subjects.length) {
      Taro.showToast({ title: '同一科目只能录入一次', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      for (const row of rows) {
        await memberCardService.openLedger({
          cardTypeId: row.cardTypeId,
          studentId,
          remainingCount: Number(row.remainingCount),
          expiredAt: new Date(`${row.expiredAt}T23:59:59.000Z`).toISOString(),
          remark: row.remark.trim(),
          idempotencyKey: `opening:${studentId}:${row.cardTypeId}:${row.expiredAt}`,
        });
      }
      Taro.showToast({ title: '历史课时录入成功', icon: 'success' });
      onSubmitted();
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '录入失败，请重试',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="w-full">
      <Text className="block text-[24rpx] text-muted-foreground mb-[20rpx]">
        按科目录入旧系统剩余次数、有效期与录入依据；期初卡金额为 0，不计售卡业绩。
      </Text>
      {loading ? (
        <Text className="text-muted-foreground">加载卡种中...</Text>
      ) : (
        rows.map((row, index) => (
          <View key={index} className="bg-muted rounded-[24rpx] p-[24rpx] mb-[20rpx]">
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
              <View className="mt-[18rpx] border border-border rounded-[12rpx] p-[18rpx] text-muted-foreground bg-card">
                {cardTypes.find((item) => item.id === row.cardTypeId)?.name || '选择次数卡种'}
              </View>
            </Picker>
            <Input
              className="mt-[18rpx] border border-border rounded-[12rpx] p-[18rpx] bg-card"
              type="number"
              placeholder="剩余次数"
              value={row.remainingCount}
              onInput={(event) => updateRow(index, { remainingCount: event.detail.value })}
            />
            <Input
              className="mt-[18rpx] border border-border rounded-[12rpx] p-[18rpx] bg-card"
              type="text"
              placeholder="有效期（YYYY-MM-DD）"
              value={row.expiredAt}
              onInput={(event) => updateRow(index, { expiredAt: event.detail.value })}
            />
            <Input
              className="mt-[18rpx] border border-border rounded-[12rpx] p-[18rpx] bg-card"
              type="text"
              placeholder="录入依据（必填，如：原系统台账截图）"
              value={row.remark}
              onInput={(event) => updateRow(index, { remark: event.detail.value })}
            />
          </View>
        ))
      )}
      <View className="flex gap-[20rpx] mt-[8rpx]">
        <Button className="flex-1" onClick={() => setRows((current) => [...current, newRow()])}>
          新增科目
        </Button>
        <Button className="flex-1" onClick={onCancel}>
          取消
        </Button>
        <Button
          className="flex-1"
          type="primary"
          loading={submitting}
          disabled={submitting}
          onClick={submit}
        >
          提交
        </Button>
      </View>
    </View>
  );
};

export default LegacyPackagesEditor;
