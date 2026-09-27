/**
 * LegacyPackagesEditor - 老生历史课包录入（R1 + R6 共用一套表单、一条链路）
 *
 * 使用场景：
 *  - R6：学员详情「卡包」/ 学员列表「会员操作」→ 居中弹框（`studentId` 已知，组件自带提交按钮）；
 *  - R1：学员表单「老生」分支 → **受控嵌入**（此时学员还没建档 ⇒ 不传 `studentId`、`showActions={false}`，
 *        由表单在学员创建成功后调用 `submitLegacyRows(studentId, rows)` 完成期初入账）。
 *
 * 说明：提交走 `opening` 期初入账接口（B4，原「历史数据迁移」页与接口已下线）。
 * 多科目录单：一科一张卡，同一科目（卡种）只能录一次；金额为 0、不计售卡业绩。
 * **有效期允许留空 = 永久有效**（后端落 `expiredAt = null`，卡包按"永久卡"展示）。
 */
import { Button, Input, Picker, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useState } from 'react';
import { cardTypeService } from '@/services/card-type';
import { memberCardService } from '@/services/member-card';
import type { CardType } from '@/types/card-type';

export type LegacyRow = {
  cardTypeId: string;
  remainingCount: string;
  /** `YYYY-MM-DD`；**留空 = 永久有效** */
  expiredAt: string;
  remark: string;
};

export const newLegacyRow = (): LegacyRow => ({
  cardTypeId: '',
  remainingCount: '',
  expiredAt: '',
  remark: '',
});

/**
 * 校验录入行（组件与学员表单共用，避免两套规则漂移）。
 * 返回错误文案；`null` 表示通过。
 */
export const validateLegacyRows = (rows: LegacyRow[]): string | null => {
  if (rows.length === 0) return '请至少录入一个科目';
  if (rows.some((row) => !row.cardTypeId || !row.remainingCount || !row.remark)) {
    return '请完整填写录入信息';
  }
  if (rows.some((row) => Number(row.remainingCount) <= 0)) return '剩余次数必须大于 0';
  const keys = rows.map((row) => row.cardTypeId);
  if (new Set(keys).size !== keys.length) return '同一科目只能录入一次';
  return null;
};

/** 到期日 → 提交用 ISO 串；留空返回 `undefined`（= 永久） */
export const toExpiryIso = (dateText: string): string | undefined =>
  dateText ? new Date(`${dateText}T23:59:59.000Z`).toISOString() : undefined;

/**
 * 期初入账提交（逐科目建卡）——**唯一提交实现**，弹框与学员表单都走这里。
 * 幂等键包含到期日；永久卡用 `forever` 占位，避免与有到期日的历史录入撞键。
 */
export const submitLegacyRows = async (studentId: string, rows: LegacyRow[]): Promise<void> => {
  for (const row of rows) {
    await memberCardService.openLedger({
      cardTypeId: row.cardTypeId,
      studentId,
      remainingCount: Number(row.remainingCount),
      expiredAt: toExpiryIso(row.expiredAt),
      remark: row.remark.trim(),
      idempotencyKey: `opening:${studentId}:${row.cardTypeId}:${row.expiredAt || 'forever'}`,
    });
  }
};

export interface LegacyPackagesEditorProps {
  /** 已建档学员；**新建学员场景不要传**（建档后再用 `submitLegacyRows` 提交） */
  studentId?: string;
  /** 受控值：传入即受控（组件不自己提交），由宿主用 `submitLegacyRows` 提交 */
  value?: LegacyRow[];
  onChange?: (rows: LegacyRow[]) => void;
  /** 是否显示自带的「新增/取消/提交」底部按钮（受控嵌入时通常传 false） */
  showActions?: boolean;
  /** 「新增一行」按钮文案 */
  addLabel?: string;
  /**
   * 自动录入依据：传入则**不显示**「录入依据」输入框，提交时用该文案补齐。
   *
   * 用于「新建学员」场景 —— 那是高频建档流程，不该为审计字段增加填写负担
   * （后端 `remark` 仍必填，由这里统一补齐）；事后补录（卡包弹框）仍需人工填写依据。
   */
  autoRemark?: string;
  /** 全部科目提交成功后回调（宿主借此关闭弹框 / 刷新卡包） */
  onSubmitted?: () => void;
  onCancel?: () => void;
}

const LegacyPackagesEditor: React.FC<LegacyPackagesEditorProps> = ({
  studentId,
  value,
  onChange,
  showActions = true,
  addLabel = '新增科目',
  autoRemark,
  onSubmitted,
  onCancel,
}) => {
  const [innerRows, setInnerRows] = useState<LegacyRow[]>([newLegacyRow()]);
  const [cardTypes, setCardTypes] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const controlled = value !== undefined;
  const rows = value ?? innerRows;
  /**
   * 校验与提交用的行：`autoRemark` 存在时补齐录入依据
   * （新建学员场景不暴露该输入框，但后端 `remark` 必填）。
   */
  const effectiveRows = autoRemark
    ? rows.map((row) => ({ ...row, remark: row.remark || autoRemark }))
    : rows;

  const updateRows = (next: LegacyRow[] | ((current: LegacyRow[]) => LegacyRow[])) => {
    const resolved = typeof next === 'function' ? next(rows) : next;
    if (controlled) onChange?.(resolved);
    else setInnerRows(resolved);
  };

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
    updateRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  };

  const submit = async () => {
    if (!studentId) {
      Taro.showToast({ title: '缺少学员信息', icon: 'none' });
      return;
    }
    const invalid = validateLegacyRows(effectiveRows);
    if (invalid) {
      Taro.showToast({ title: invalid, icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await submitLegacyRows(studentId, effectiveRows);
      Taro.showToast({ title: '历史课时录入成功', icon: 'success' });
      onSubmitted?.();
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
        按科目录入旧系统剩余次数、有效期与录入依据；期初卡金额为
        0，不计售卡业绩。有效期留空表示永久有效。
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
              placeholder="有效期（留空 = 永久有效）"
              value={row.expiredAt}
              onInput={(event) => updateRow(index, { expiredAt: event.detail.value })}
            />
            {autoRemark ? null : (
              <Input
                className="mt-[18rpx] border border-border rounded-[12rpx] p-[18rpx] bg-card"
                type="text"
                placeholder="录入依据（必填，如：原系统台账截图）"
                value={row.remark}
                onInput={(event) => updateRow(index, { remark: event.detail.value })}
              />
            )}
            {rows.length > 1 ? (
              <View
                className="mt-[16rpx] text-[24rpx] text-destructive"
                onClick={() => updateRows((current) => current.filter((_, i) => i !== index))}
              >
                删除本行
              </View>
            ) : null}
          </View>
        ))
      )}
      <View className="flex gap-[20rpx] mt-[8rpx]">
        <Button
          className="flex-1"
          onClick={() => updateRows((current) => [...current, newLegacyRow()])}
        >
          {addLabel}
        </Button>
        {showActions ? (
          <>
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
          </>
        ) : null}
      </View>
    </View>
  );
};

export default LegacyPackagesEditor;
