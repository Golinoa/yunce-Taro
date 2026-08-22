/**
 * 新增线索页 package-lead/pages/lead-form
 *
 * 老师手动录入线索信息：孩子信息、家长信息、来源课程、备注。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback } from 'react';
import ActionButton from '@/components/ActionButton';
import FormInput from '@/components/FormInput';
import PageContainer from '@/components/PageContainer';
import { leadService } from '@/services';
import { auditLogService } from '@/services/audit-log';
import { useLeadStore } from '@/stores/lead';
import type { LeadFormData } from '@/types/lead';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';

/** 性别选项 */
const GENDER_OPTIONS = [
  { value: 'male' as const, label: '男' },
  { value: 'female' as const, label: '女' },
];

const LeadFormPage: React.FC = () => {
  const { profile, session } = useAuth();
  const { invalidate } = useLeadStore();

  const [form, setForm] = useState<LeadFormData>({
    child_name: '',
    child_nickname: '',
    child_gender: 'male',
    child_age: '',
    parent_name: '',
    parent_phone: '',
    campus_id: profile?.currentContext?.campusId || '',
    source_course_id: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const updateField = useCallback(
    <K extends keyof LeadFormData>(key: K, value: LeadFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const userId = session?.user.id;

  const handleSubmit = useCallback(async () => {
    if (!form.child_name.trim()) {
      Taro.showToast({ title: '请输入孩子姓名', icon: 'none' });
      return;
    }
    if (!form.parent_phone?.trim()) {
      Taro.showToast({ title: '请输入家长手机号', icon: 'none' });
      return;
    }

    const teacherId = userId || '';
    if (!teacherId) {
      Taro.showToast({ title: '教师信息异常', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const lead = await leadService.createLead(form, teacherId);

      // 审计日志（用户口径 2026-08-22）：线索创建（谁邀请/录入）属重要运营数据
      try {
        await auditLogService.record({
          action: 'lead.create',
          operatorId: teacherId || profile?.id || '',
          operatorName: profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'lead',
          targetId: lead.id,
          detail: `新建线索：学员「${form.child_name}」${form.parent_phone ? `（家长 ${form.parent_phone}）` : ''}`,
          meta: { leadId: lead.id, childName: form.child_name, parentPhone: form.parent_phone },
        });
      } catch (e) {
        logError('audit lead.create', e);
      }

      // 去重提示
      if (lead.duplicate_hint) {
        Taro.showModal({
          title: '提示',
          content: '检测到同名同手机号线索已存在，是否继续？',
          confirmText: '继续',
          cancelText: '返回',
        });
      }

      // 列表缓存失效
      invalidate(teacherId);

      Taro.showToast({ title: '创建成功', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 1000);
    } catch {
      Taro.showToast({ title: '创建失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [form, userId, invalidate, profile]);

  return (
    <PageContainer>
      <View className="px-page-padding py-4">
        {/* 孩子信息 */}
        <Text className="text-[28rpx] font-semibold text-foreground mb-3">孩子信息</Text>
        <View className="bg-white rounded-[24rpx] p-4 mb-6">
          <FormInput
            label="姓名"
            placeholder="请输入孩子姓名"
            value={form.child_name}
            onInput={(e) => updateField('child_name', e.detail.value)}
            required
          />
          <FormInput
            label="昵称"
            placeholder="请输入孩子昵称（选填）"
            value={form.child_nickname || ''}
            onInput={(e) => updateField('child_nickname', e.detail.value)}
          />

          {/* 性别选择 */}
          <View className="flex items-center justify-between py-3 border-b border-border">
            <Text className="text-[28rpx] text-foreground">性别</Text>
            <View className="flex gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <View
                  key={opt.value}
                  className={cn(
                    'px-[24rpx] py-[8rpx] rounded-full',
                    form.child_gender === opt.value ? 'bg-primary' : 'bg-muted',
                  )}
                  onClick={() => updateField('child_gender', opt.value)}
                >
                  <Text
                    className={cn(
                      'text-[24rpx]',
                      form.child_gender === opt.value ? 'text-white' : 'text-foreground-secondary',
                    )}
                  >
                    {opt.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <FormInput
            label="年龄"
            placeholder="请输入孩子年龄（选填）"
            value={form.child_age || ''}
            onInput={(e) => updateField('child_age', e.detail.value)}
            type="number"
          />
        </View>

        {/* 家长信息 */}
        <Text className="text-[28rpx] font-semibold text-foreground mb-3">家长信息</Text>
        <View className="bg-white rounded-[24rpx] p-4 mb-6">
          <FormInput
            label="姓名"
            placeholder="请输入家长姓名（选填）"
            value={form.parent_name || ''}
            onInput={(e) => updateField('parent_name', e.detail.value)}
          />
          <FormInput
            label="手机号"
            placeholder="请输入家长手机号"
            value={form.parent_phone || ''}
            onInput={(e) => updateField('parent_phone', e.detail.value)}
            type="number"
            required
          />
        </View>

        {/* 其他信息 */}
        <Text className="text-[28rpx] font-semibold text-foreground mb-3">其他信息</Text>
        <View className="bg-white rounded-[24rpx] p-4 mb-6">
          <FormInput
            label="来源课程"
            placeholder="选择来源课程（选填）"
            value={form.source_course_id || ''}
            onInput={(e) => updateField('source_course_id', e.detail.value)}
          />
          <FormInput
            label="备注"
            placeholder="请输入备注（选填）"
            value={form.notes || ''}
            onInput={(e) => updateField('notes', e.detail.value)}
            multiline
            maxlength={500}
          />
        </View>
      </View>

      <ActionButton
        text={submitting ? '提交中...' : '确认添加'}
        onClick={handleSubmit}
        disabled={submitting}
      />
    </PageContainer>
  );
};

export default LeadFormPage;
