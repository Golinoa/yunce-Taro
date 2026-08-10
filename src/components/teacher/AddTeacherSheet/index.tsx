import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import { useCampusStore } from '@/stores/campus';
import type { TeacherRole, SalaryModelType } from '@/types/teacher';

/**
 * AddTeacherSheet - 添加教师弹窗
 *
 * 使用场景：教师列表页顶部"添加教师"按钮触发
 * 功能：填写姓名/手机号/科目/角色/工资模型/可授课校区/跨校区上课开关，提交后新增教师
 * 相关组件：EditTeacherSheet（编辑教师，结构类似）
 */

interface AddTeacherSheetProps {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    phone: string;
    subject: string;
    role: TeacherRole;
    modelType: SalaryModelType;
    /** 可授课校区ID列表 */
    campusIds: string[];
    /** 是否允许跨校区上课 */
    canCrossCampus: boolean;
  }) => void;
}

const ROLE_OPTIONS: { label: string; value: TeacherRole }[] = [
  { label: '主讲', value: 'lead' },
  { label: '助教', value: 'assist' },
  { label: '兼职', value: 'parttime' },
];

const MODEL_OPTIONS: { label: string; value: SalaryModelType; desc: string }[] = [
  { label: '标准主讲', value: 'standard', desc: '底薪+课时费+全勤+绩效' },
  { label: '纯课时', value: 'hourly', desc: '仅课时费，无底薪无奖金' },
  { label: '自定义', value: 'custom', desc: '自定义各项参数' },
];

const SUBJECT_OPTIONS = [
  '钢琴',
  '声乐',
  '乐理',
  '书法',
  '美术',
  '吉他',
  '舞蹈',
  '架子鼓',
  '小提琴',
];

const AddTeacherSheet: React.FC<AddTeacherSheetProps> = ({
  visible,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const campuses = useCampusStore((state) => state.campuses);
  const campusOptions = useMemo(() => campuses.filter((campus) => campus.id), [campuses]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('钢琴');
  const [role, setRole] = useState<TeacherRole>('lead');
  const [modelType, setModelType] = useState<SalaryModelType>('standard');
  const [selectedCampusIds, setSelectedCampusIds] = useState<string[]>([]);
  const [canCrossCampus, setCanCrossCampus] = useState(false);

  const toggleCampus = (campusId: string) => {
    setSelectedCampusIds((prev) =>
      prev.includes(campusId) ? prev.filter((id) => id !== campusId) : [...prev, campusId],
    );
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setSubject('钢琴');
    setRole('lead');
    setModelType('standard');
    setSelectedCampusIds([]);
    setCanCrossCampus(false);
  };

  const handleSubmit = () => {
    if (submitting) return;
    if (!name.trim()) {
      return;
    }
    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      subject,
      role,
      modelType,
      campusIds: selectedCampusIds,
      canCrossCampus,
    });
    resetForm();
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="添加教师" onClose={handleClose}>
      <View className="px-4 pb-6">
        {/* 姓名 */}
        <FormInput
          label="姓名"
          required
          placeholder="请输入教师姓名"
          value={name}
          onInput={(e) => setName(e.detail.value)}
        />

        {/* 手机号 */}
        <FormInput
          label="手机号"
          placeholder="请输入手机号"
          type="number"
          maxlength={11}
          value={phone}
          onInput={(e) => setPhone(e.detail.value)}
        />

        {/* 科目 */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2 block">科目</Text>
          <View className="flex flex-wrap gap-2">
            {SUBJECT_OPTIONS.map((s) => (
              <View
                key={s}
                className={cn(
                  'py-[8rpx] px-[28rpx] rounded-[16rpx] border-[2rpx] border-solid text-sm font-medium',
                  subject === s
                    ? 'border-primary bg-primary-bg text-primary font-semibold'
                    : 'border-border bg-background text-muted-foreground',
                )}
                onClick={() => setSubject(s)}
              >
                {s}
              </View>
            ))}
          </View>
        </View>

        {/* 角色 */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2 block">角色</Text>
          <View className="flex gap-2">
            {ROLE_OPTIONS.map((opt) => (
              <View
                key={opt.value}
                className={cn(
                  'flex-1 py-[20rpx] rounded-2xl border-[2rpx] border-solid text-center text-sm font-medium',
                  role === opt.value
                    ? 'border-primary bg-primary-bg text-primary font-semibold'
                    : 'border-border bg-background text-muted-foreground',
                )}
                onClick={() => setRole(opt.value)}
              >
                {opt.label}
              </View>
            ))}
          </View>
        </View>

        {/* 工资模型 */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-foreground mb-2 block">工资模型</Text>
          <View className="flex flex-col gap-2">
            {MODEL_OPTIONS.map((opt) => (
              <View
                key={opt.value}
                className={cn(
                  'py-3 px-4 rounded-xl border-[2rpx] border-solid',
                  modelType === opt.value
                    ? 'border-primary bg-primary-bg'
                    : 'border-border bg-background',
                )}
                onClick={() => setModelType(opt.value)}
              >
                <View className="flex items-center justify-between">
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      modelType === opt.value ? 'text-primary font-semibold' : 'text-foreground',
                    )}
                  >
                    {opt.label}
                  </Text>
                  {modelType === opt.value && <Text className="text-primary text-xs">✓</Text>}
                </View>
                <Text className="text-xs text-muted-foreground mt-1">{opt.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 可授课校区 */}
        {campusOptions.length > 0 && (
          <View className="mb-4">
            <View className="flex items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-foreground">可授课校区</Text>
              <Text className="text-xs text-muted-foreground">可多选</Text>
            </View>
            <View className="flex flex-wrap gap-2">
              {campusOptions.map((campus) => {
                const selected = selectedCampusIds.includes(campus.id);
                return (
                  <View
                    key={campus.id}
                    className={cn(
                      'flex items-center gap-[8rpx] py-[12rpx] px-[24rpx] rounded-[16rpx] border-[2rpx] border-solid text-sm font-medium',
                      selected
                        ? 'border-primary bg-primary-bg text-primary'
                        : 'border-border bg-background text-muted-foreground',
                    )}
                    onClick={() => toggleCampus(campus.id)}
                  >
                    <Icon
                      name={selected ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'}
                      size={16}
                      color={selected ? 'primary' : 'muted'}
                    />
                    <Text className={cn('text-sm', selected ? 'text-primary' : 'text-foreground')}>
                      {campus.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 跨校区上课开关 */}
        {selectedCampusIds.length > 1 && (
          <View className="mb-6">
            <View
              className="flex items-center justify-between py-[22rpx] px-[28rpx] rounded-2xl bg-primary-5 border-[3rpx] border-border-light"
              onClick={() => setCanCrossCampus((prev) => !prev)}
            >
              <View>
                <Text className="text-sm font-semibold text-foreground">允许跨校区上课</Text>
                <Text className="text-xs text-muted-foreground mt-1">
                  开启后该老师可在所选校区间排课
                </Text>
              </View>
              <View
                className={cn(
                  'w-[96rpx] h-[52rpx] rounded-full relative transition-colors duration-200',
                  canCrossCampus ? 'bg-primary' : 'bg-muted',
                )}
              >
                <View
                  className={cn(
                    'absolute top-[4rpx] w-[44rpx] h-[44rpx] rounded-full bg-white shadow-sm transition-all duration-200',
                    canCrossCampus ? 'left-[48rpx]' : 'left-[4rpx]',
                  )}
                />
              </View>
            </View>
          </View>
        )}

        {/* 提交按钮 */}
        <View
          className={cn(
            'w-full py-[28rpx] rounded-2xl text-center text-base font-semibold',
            name.trim() && !submitting
              ? 'bg-gradient-primary text-white'
              : 'bg-muted text-muted-foreground',
          )}
          onClick={name.trim() && !submitting ? handleSubmit : undefined}
        >
          {submitting ? '添加中...' : '确认添加'}
        </View>
      </View>
    </BottomSheet>
  );
};

export default AddTeacherSheet;
