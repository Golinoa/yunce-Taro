/**
 * BookTrialByClassSheet - 从课表卡片快速预约试听
 *
 * 老师在课表页点击「约试听」后弹出居中弹框，支持：
 * - 从已有线索中选择（弹出 BottomSheet 选择）
 * - 手动输入新线索（姓名 + 家长电话）
 * - 一键为该班级创建试听预约
 */
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ActionButton from '@/components/ActionButton';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import PickerItem from '@/components/PickerItem';
import { leadService } from '@/services';
import type { Lead } from '@/types/lead';
import { useAuth } from '@/utils/auth';

type InputMode = 'select' | 'input';

export interface BookTrialByClassSheetProps {
  visible: boolean;
  classId?: string;
  campusId?: string;
  className?: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  teacherId?: string;
  teacherName?: string;
  onClose: () => void;
  /** 预约成功回调，返回班级和日期 */
  onSuccess?: (payload: { classId: string; lessonDate: string }) => void;
}

const BookTrialByClassSheet: React.FC<BookTrialByClassSheetProps> = ({
  visible,
  classId,
  campusId,
  className,
  lessonDate,
  startTime,
  endTime,
  teacherId,
  teacherName,
  onClose,
  onSuccess,
}) => {
  const { session } = useAuth();
  const userId = session?.user.id || '';

  const [mode, setMode] = useState<InputMode>('select');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadPickerVisible, setLeadPickerVisible] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 手动输入模式
  const [childName, setChildName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [note, setNote] = useState('');

  // 打开线索选择器
  const handleOpenLeadPicker = useCallback(() => {
    setKeyword('');
    setLeadPickerVisible(true);
    if (leads.length === 0) {
      setLoading(true);
      leadService
        .getLeadsByTeacher(userId)
        .then((list) => setLeads(list))
        .catch(() => setLeads([]))
        .finally(() => setLoading(false));
    }
  }, [userId, leads.length]);

  // 选择线索
  const handleSelectLead = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setLeadPickerVisible(false);
  }, []);

  // 弹框关闭时重置状态
  useEffect(() => {
    if (visible) {
      setMode('select');
      setSelectedLead(null);
      setChildName('');
      setParentPhone('');
      setNote('');
    }
  }, [visible]);

  const filteredLeads = useMemo(() => {
    if (!keyword) return leads;
    const kw = keyword.toLowerCase();
    return leads.filter(
      (l) =>
        (l.child_name || '').toLowerCase().includes(kw) ||
        (l.parent_phone || '').includes(kw) ||
        (l.parent_name || '').toLowerCase().includes(kw),
    );
  }, [leads, keyword]);

  const canSubmit = useMemo(() => {
    if (mode === 'select') return Boolean(selectedLead) && Boolean(classId);
    return Boolean(childName.trim()) && /^1\d{10}$/.test(parentPhone.trim()) && Boolean(classId);
  }, [mode, selectedLead, childName, parentPhone, classId]);

  const handleSubmit = useCallback(async () => {
    if (!classId || !canSubmit) return;

    setSubmitting(true);
    try {
      let leadId = selectedLead?.id;

      if (mode === 'input') {
        const newLead = await leadService.createLead(
          {
            child_name: childName.trim(),
            parent_phone: parentPhone.trim(),
            campus_id: campusId || 'campus-center',
            source_type: 'manual',
          },
          userId,
        );
        leadId = newLead.id;
      }

      await leadService.bookTrialByClass({
        leadId: leadId!,
        classId,
        className,
        lessonDate,
        startTime,
        endTime,
        teacherId,
        teacherName,
        operatorId: userId,
        note: note.trim() || undefined,
      });

      Taro.showToast({ title: '预约成功', icon: 'success' });
      onSuccess?.({ classId, lessonDate });
      onClose();
    } catch {
      Taro.showToast({ title: '预约失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    classId,
    campusId,
    className,
    lessonDate,
    startTime,
    endTime,
    teacherId,
    teacherName,
    userId,
    mode,
    selectedLead,
    childName,
    parentPhone,
    note,
    onSuccess,
    onClose,
  ]);

  return (
    <>
      {/* 主弹框 */}
      <Modal visible={visible} title="约试听" onClose={onClose}>
        <View className="px-[32rpx] py-[28rpx]">
          {/* 班级信息 */}
          <View className="mb-4 rounded-[16rpx] bg-primary/10 px-4 py-3">
            <Text className="text-[28rpx] font-medium text-primary">
              {className || '未命名班级'}
            </Text>
            <Text className="text-[24rpx] text-primary/80 mt-1">
              {lessonDate} {startTime}-{endTime}
            </Text>
          </View>

          {/* 选择 / 输入 切换 */}
          <View className="flex rounded-full bg-muted p-[4rpx] mb-4">
            <View
              className={cn(
                'flex-1 py-2 text-center rounded-full',
                mode === 'select' ? 'bg-white shadow-sm' : '',
              )}
              onClick={() => setMode('select')}
            >
              <Text
                className={cn(
                  'text-[26rpx]',
                  mode === 'select' ? 'text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                选择线索
              </Text>
            </View>
            <View
              className={cn(
                'flex-1 py-2 text-center rounded-full',
                mode === 'input' ? 'bg-white shadow-sm' : '',
              )}
              onClick={() => setMode('input')}
            >
              <Text
                className={cn(
                  'text-[26rpx]',
                  mode === 'input' ? 'text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                输入新线索
              </Text>
            </View>
          </View>

          {mode === 'select' ? (
            <>
              {!selectedLead ? (
                /* 未选择：点击加载线索 */
                <View
                  className="flex flex-col items-center justify-center gap-3 rounded-[16rpx] border-2 border-dashed border-border bg-muted/30 py-[48rpx] active:bg-muted/60"
                  onClick={handleOpenLeadPicker}
                >
                  <View className="flex h-[80rpx] w-[80rpx] items-center justify-center rounded-full bg-primary/10">
                    <Icon name="mdi-plus" size={36} className="text-primary" />
                  </View>
                  <Text className="text-[28rpx] font-medium text-foreground">选择已有线索</Text>
                  <Text className="text-[24rpx] text-muted-foreground">点击从线索库中选择</Text>
                </View>
              ) : (
                /* 已选择：显示选中线索，支持更换 */
                <View className="flex flex-col gap-3">
                  <PickerItem
                    iconType="avatar"
                    avatarChar={selectedLead.child_name[0]}
                    title={selectedLead.child_name}
                    subtitle={selectedLead.parent_phone || '暂无手机号'}
                    selected
                    right={{
                      type: 'change-btn',
                      onChangeClick: handleOpenLeadPicker,
                    }}
                  />
                </View>
              )}
            </>
          ) : (
            <View className="flex flex-col gap-4">
              <FormInput
                label="学员姓名"
                placeholder="请输入学员姓名"
                value={childName}
                onInput={(e) => setChildName(e.detail.value)}
                required
              />
              <FormInput
                label="家长手机号"
                placeholder="请输入11位手机号"
                value={parentPhone}
                onInput={(e) => setParentPhone(e.detail.value)}
                type="number"
                maxlength={11}
                required
              />
            </View>
          )}

          {/* 备注 */}
          <FormInput
            label="备注"
            placeholder="选填，填写特殊需求"
            value={note}
            onInput={(e) => setNote(e.detail.value)}
            multiline
            maxlength={200}
            className="mt-4"
          />
        </View>

        {/* 底部按钮 */}
        <View className="border-t border-border px-[32rpx] pt-4 pb-6">
          <ActionButton
            text={submitting ? '预约中...' : '确认预约'}
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            fixed={false}
          />
        </View>
      </Modal>

      {/* 线索选择底部弹窗 - 参考 StudentSelectSheet 设计 */}
      <BottomSheet
        visible={leadPickerVisible}
        title="选择线索"
        onClose={() => setLeadPickerVisible(false)}
        height="70vh"
      >
        {/* 搜索框 */}
        <View className="px-10 pt-4 pb-2">
          <View className="border-[2rpx] border-input rounded-[20rpx] py-[18rpx] px-[24rpx] bg-white">
            <Input
              className="w-full text-[26rpx] text-foreground"
              placeholder="搜索姓名或手机号"
              placeholderStyle="color:#9ca3af"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value || '')}
            />
          </View>
        </View>

        {/* 线索列表 */}
        <View className="px-10 pb-10">
          {loading ? (
            <View className="py-10 center">
              <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
            </View>
          ) : filteredLeads.length === 0 ? (
            <View className="py-10 center flex-col gap-3">
              <Icon name="mdi-account-search" size={56} className="text-muted-foreground" />
              <Text className="text-[26rpx] text-muted-foreground">
                {keyword ? '未找到匹配线索' : '暂无线索'}
              </Text>
            </View>
          ) : (
            filteredLeads.map((lead) => {
              const isSelected = selectedLead?.id === lead.id;
              return (
                <View
                  key={lead.id}
                  className={cn(
                    'flex items-center gap-5 py-5 border-b border-input/50',
                    isSelected ? 'bg-primary/5 -mx-4 px-4 rounded-2xl' : '',
                  )}
                  onClick={() => handleSelectLead(lead)}
                >
                  <View
                    className="w-[68rpx] h-[68rpx] rounded-full center flex-shrink-0"
                    style={{ background: '#5EC8A820' }}
                  >
                    <Text className="text-[28rpx] font-bold text-primary">
                      {(lead.child_name || '?')[0]}
                    </Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-medium text-foreground block">
                      {lead.child_name}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground/60 block mt-1">
                      {lead.parent_phone || '暂无手机号'}
                    </Text>
                  </View>
                  {isSelected && <Text className="text-primary text-lg">✓</Text>}
                </View>
              );
            })
          )}
        </View>
      </BottomSheet>
    </>
  );
};

export default BookTrialByClassSheet;
