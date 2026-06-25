import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useState, useEffect } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import type { TeacherRole, SalaryModelType, TeacherUIModel } from '@/types/teacher';

/**
 * EditTeacherSheet - 编辑教师弹窗
 *
 * 使用场景：教师详情页"编辑"按钮触发
 * 功能：修改姓名/手机号/科目/角色/工资模型
 * 相关组件：AddTeacherSheet（添加教师，结构类似）
 */

interface EditTeacherSheetProps {
  visible: boolean;
  teacher: TeacherUIModel | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (
    id: string,
    data: {
      name: string;
      phone: string;
      subject: string;
      role: TeacherRole;
      modelType: SalaryModelType;
    },
  ) => void;
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

/** 根据 modelIdx 推断工资模型类型 */
const getSalaryModelType = (modelIdx: number): SalaryModelType => {
  if (modelIdx === 0) return 'standard';
  if (modelIdx === 1) return 'hourly';
  return 'custom';
};

const EditTeacherSheet: React.FC<EditTeacherSheetProps> = ({
  visible,
  teacher,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('钢琴');
  const [role, setRole] = useState<TeacherRole>('lead');
  const [modelType, setModelType] = useState<SalaryModelType>('standard');

  // 回填数据
  useEffect(() => {
    if (visible && teacher) {
      setName(teacher.name);
      setPhone(teacher.phone);
      setSubject(teacher.subject);
      setRole(teacher.role);
      setModelType(getSalaryModelType(teacher.modelIdx));
    }
  }, [visible, teacher]);

  const handleSubmit = () => {
    if (submitting) return;
    if (!teacher || !name.trim()) return;
    onSubmit(teacher.id, {
      name: name.trim(),
      phone: phone.trim(),
      subject,
      role,
      modelType,
    });
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="编辑教师" onClose={handleClose}>
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
          {submitting ? '保存中...' : '保存修改'}
        </View>
      </View>
    </BottomSheet>
  );
};

export default EditTeacherSheet;
