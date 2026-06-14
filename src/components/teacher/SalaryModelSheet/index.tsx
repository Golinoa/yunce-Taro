import { View, Text, Input } from '@tarojs/components';
import cn from 'classnames';
import React, { useState, useEffect } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import type { SalaryModel, SalaryModelType } from '@/types/teacher';

/**
 * SalaryModelSheet - 工资模型新建/编辑弹窗
 *
 * 使用场景：教师列表薪资设置Tab中新建/编辑工资模型
 * 功能：填写模型名称 + 选择模型类型（标准主讲/纯课时/自定义）+ 配置参数
 * 相关组件：PaymentSettingsSheet（发放设置）
 */

interface SalaryModelSheetProps {
  visible: boolean;
  /** 编辑时传入已有模型，新建时传 null */
  model: SalaryModel | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    type: SalaryModelType;
    base: number;
    rate: number;
    attend: number;
    perf: number;
  }) => void;
}

const MODEL_TYPE_OPTIONS: { label: string; value: SalaryModelType; desc: string }[] = [
  { label: '标准主讲', value: 'standard', desc: '底薪+课时费+全勤+绩效' },
  { label: '纯课时', value: 'hourly', desc: '仅课时费，无底薪无奖金' },
  { label: '自定义', value: 'custom', desc: '自定义各项参数' },
];

const SalaryModelSheet: React.FC<SalaryModelSheetProps> = ({
  visible,
  model,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<SalaryModelType>('standard');
  const [base, setBase] = useState('3000');
  const [rate, setRate] = useState('100');
  const [attend, setAttend] = useState('500');
  const [perf, setPerf] = useState('700');

  // 回填数据
  useEffect(() => {
    if (visible && model) {
      setName(model.name);
      setType(model.type);
      setBase(String(model.base));
      setRate(String(model.rate));
      setAttend(String(model.attend));
      setPerf(String(model.perf));
    } else if (visible && !model) {
      setName('');
      setType('standard');
      setBase('3000');
      setRate('100');
      setAttend('500');
      setPerf('700');
    }
  }, [visible, model]);

  // 根据类型自动填充预设值
  const handleTypeChange = (t: SalaryModelType) => {
    setType(t);
    if (t === 'standard') {
      setBase('3000');
      setRate('100');
      setAttend('500');
      setPerf('700');
    } else if (t === 'hourly') {
      setBase('0');
      setRate('80');
      setAttend('0');
      setPerf('0');
    }
    // custom 不自动填充
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      type,
      base: Number(base) || 0,
      rate: Number(rate) || 0,
      attend: Number(attend) || 0,
      perf: Number(perf) || 0,
    });
  };

  const handleClose = () => {
    onClose();
  };

  const isCustom = type === 'custom';

  return (
    <BottomSheet
      visible={visible}
      title={model ? '编辑工资模型' : '新建工资模型'}
      onClose={handleClose}
    >
      <View className="px-4 pb-6">
        {/* 模型名称 */}
        <FormInput
          label="模型名称"
          required
          placeholder="请输入模型名称"
          value={name}
          onInput={(e) => setName(e.detail.value)}
        />

        {/* 模型类型 */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2 block">模型类型</Text>
          <View className="flex flex-col gap-2">
            {MODEL_TYPE_OPTIONS.map((opt) => (
              <View
                key={opt.value}
                className={cn(
                  'py-3 px-4 rounded-xl border-[2rpx] border-solid',
                  type === opt.value
                    ? 'border-primary bg-primary-bg'
                    : 'border-border bg-background',
                )}
                onClick={() => handleTypeChange(opt.value)}
              >
                <View className="flex items-center justify-between">
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      type === opt.value ? 'text-primary font-semibold' : 'text-foreground',
                    )}
                  >
                    {opt.label}
                  </Text>
                  {type === opt.value && <Text className="text-primary text-xs">✓</Text>}
                </View>
                <Text className="text-xs text-muted-foreground mt-1">{opt.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 参数配置 - 自定义或编辑时显示 */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-foreground mb-2 block">参数配置</Text>
          <View className="bg-card rounded-2xl p-4 flex flex-col gap-3">
            {/* 底薪 */}
            <View className="flex items-center justify-between">
              <Text className="text-sm text-muted-foreground">底薪</Text>
              <View
                className="flex items-center gap-1 py-[14rpx] px-[20rpx] rounded-xl"
                style={{ backgroundColor: '#f5faf8', border: '3rpx solid #D5E8E0' }}
              >
                <Text className="text-xs text-muted-foreground">¥</Text>
                <Input
                  className="w-[120rpx] text-sm text-foreground text-right"
                  type="digit"
                  value={base}
                  onInput={(e) => setBase(e.detail.value)}
                  disabled={!isCustom}
                />
              </View>
            </View>

            {/* 课时费单价 */}
            <View className="flex items-center justify-between">
              <Text className="text-sm text-muted-foreground">课时费单价</Text>
              <View
                className="flex items-center gap-1 py-[14rpx] px-[20rpx] rounded-xl"
                style={{ backgroundColor: '#f5faf8', border: '3rpx solid #D5E8E0' }}
              >
                <Text className="text-xs text-muted-foreground">¥</Text>
                <Input
                  className="w-[120rpx] text-sm text-foreground text-right"
                  type="digit"
                  value={rate}
                  onInput={(e) => setRate(e.detail.value)}
                />
              </View>
            </View>

            {/* 全勤奖 */}
            <View className="flex items-center justify-between">
              <Text className="text-sm text-muted-foreground">全勤奖</Text>
              <View
                className="flex items-center gap-1 py-[14rpx] px-[20rpx] rounded-xl"
                style={{ backgroundColor: '#f5faf8', border: '3rpx solid #D5E8E0' }}
              >
                <Text className="text-xs text-muted-foreground">¥</Text>
                <Input
                  className="w-[120rpx] text-sm text-foreground text-right"
                  type="digit"
                  value={attend}
                  onInput={(e) => setAttend(e.detail.value)}
                  disabled={!isCustom}
                />
              </View>
            </View>

            {/* 绩效奖金 */}
            <View className="flex items-center justify-between">
              <Text className="text-sm text-muted-foreground">绩效奖金</Text>
              <View
                className="flex items-center gap-1 py-[14rpx] px-[20rpx] rounded-xl"
                style={{ backgroundColor: '#f5faf8', border: '3rpx solid #D5E8E0' }}
              >
                <Text className="text-xs text-muted-foreground">¥</Text>
                <Input
                  className="w-[120rpx] text-sm text-foreground text-right"
                  type="digit"
                  value={perf}
                  onInput={(e) => setPerf(e.detail.value)}
                  disabled={!isCustom}
                />
              </View>
            </View>
          </View>

          {/* 预览 */}
          <View className="mt-3 p-3 rounded-xl bg-amber-10">
            <Text className="text-xs text-amber block">
              薪资公式：{Number(base) > 0 ? `底薪 ¥${base} + ` : ''}课时费(课时数 × ¥{rate})
              {Number(attend) > 0 ? ` + 全勤 ¥${attend}` : ''}
              {Number(perf) > 0 ? ` + 绩效 ¥${perf}` : ''}
            </Text>
          </View>
        </View>

        {/* 提交按钮 */}
        <View
          className={cn(
            'w-full py-[28rpx] rounded-2xl text-center text-base font-semibold',
            name.trim() ? 'bg-gradient-primary text-white' : 'bg-muted text-muted-foreground',
          )}
          onClick={name.trim() ? handleSubmit : undefined}
        >
          {model ? '保存修改' : '创建模型'}
        </View>
      </View>
    </BottomSheet>
  );
};

export default SalaryModelSheet;
