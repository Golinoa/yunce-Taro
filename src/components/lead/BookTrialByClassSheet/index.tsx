/**
 * BookTrialByClassSheet - 从课表卡片快速预约试听 / 补课
 *
 * 老师在课表页点击「约试听/补课」后弹出居中弹框，支持：
 * - 补课：选择已有正式学员加入本节课
 * - 从已有线索中选择（弹出 BottomSheet 选择）
 * - 手动输入新线索（姓名 + 家长电话）
 */
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ActionButton from '@/components/ActionButton';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import PickerItem from '@/components/PickerItem';
import {
  classService,
  leadService,
  makeupBookingService,
  studentService,
  subscribeMessageService,
} from '@/services';
import { useCampusStore } from '@/stores/campus';
import type { Lead } from '@/types/lead';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';

type InputMode = 'makeup' | 'select' | 'input';

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
  const currentCampusId = useCampusStore((s) => s.currentCampusId);
  const resolvedCampusId = campusId || currentCampusId || '';

  const [mode, setMode] = useState<InputMode>('makeup');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [leadPickerVisible, setLeadPickerVisible] = useState(false);
  const [studentPickerVisible, setStudentPickerVisible] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classStudentIds, setClassStudentIds] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [childName, setChildName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [note, setNote] = useState('');

  const handleOpenLeadPicker = useCallback(() => {
    setKeyword('');
    setLeadPickerVisible(true);
    setLoading(true);
    leadService
      .getLeadsByTeacher(userId)
      .then((list) => setLeads(list))
      .catch((err) => {
        logError('BookTrialByClassSheet load leads', err);
        setLeads([]);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleOpenStudentPicker = useCallback(() => {
    setKeyword('');
    setStudentPickerVisible(true);
    setLoading(true);
    Promise.all([
      studentService.getByTeacher(userId, resolvedCampusId || undefined),
      classId ? classService.getStudents(classId) : Promise.resolve([] as Student[]),
    ])
      .then(([list, classStu]) => {
        setStudents(list);
        setClassStudentIds(new Set(classStu.map((s) => s.id)));
      })
      .catch((err) => {
        logError('BookTrialByClassSheet load students', err);
        setStudents([]);
        setClassStudentIds(new Set());
      })
      .finally(() => setLoading(false));
  }, [userId, resolvedCampusId, classId]);

  const handleSelectLead = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setLeadPickerVisible(false);
  }, []);

  const handleSelectStudent = useCallback((stu: Student) => {
    setSelectedStudent(stu);
    setStudentPickerVisible(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setMode('makeup');
      setSelectedLead(null);
      setSelectedStudent(null);
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

  const filteredStudents = useMemo(() => {
    // 本班正式学员不需要再约补课；优先展示其他班学员
    const base = students.filter((s) => !classStudentIds.has(s.id));
    if (!keyword) return base;
    const kw = keyword.toLowerCase();
    return base.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(kw) ||
        (s.nickname || '').toLowerCase().includes(kw) ||
        (s.phone || '').includes(kw),
    );
  }, [students, classStudentIds, keyword]);

  const canSubmit = useMemo(() => {
    if (!classId) return false;
    if (mode === 'makeup') return Boolean(selectedStudent);
    if (mode === 'select') return Boolean(selectedLead);
    return Boolean(childName.trim()) && /^1\d{10}$/.test(parentPhone.trim());
  }, [mode, selectedStudent, selectedLead, childName, parentPhone, classId]);

  const handleSubmit = useCallback(async () => {
    if (!classId || !canSubmit) return;
    if (!resolvedCampusId) {
      Taro.showToast({ title: '缺少校区信息，请先选择校区', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'makeup' && selectedStudent) {
        await makeupBookingService.create({
          studentId: selectedStudent.id,
          classId,
          lessonDate,
          startTime,
          endTime,
          teacherId,
          teacherName,
          source: 'teacher',
          note: note.trim() || undefined,
          createdBy: userId,
        });
        Taro.showToast({ title: '补课预约成功', icon: 'success' });
        onSuccess?.({ classId, lessonDate });
        onClose();
        return;
      }

      let leadId = selectedLead?.id;

      if (mode === 'input') {
        const newLead = await leadService.createLead(
          {
            child_name: childName.trim(),
            parent_phone: parentPhone.trim(),
            campus_id: resolvedCampusId,
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
        campusId: resolvedCampusId,
        lessonDate,
        startTime,
        endTime,
        teacherId,
        teacherName,
        operatorId: userId,
        note: note.trim() || undefined,
      });

      Taro.showToast({ title: '预约成功', icon: 'success' });
      void subscribeMessageService.runFlow('E24', {
        bookingLabel: `试听·${className}`,
      });
      onSuccess?.({ classId, lessonDate });
      onClose();
    } catch {
      Taro.showToast({ title: mode === 'makeup' ? '补课预约失败' : '预约失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    classId,
    resolvedCampusId,
    className,
    lessonDate,
    startTime,
    endTime,
    teacherId,
    teacherName,
    userId,
    mode,
    selectedLead,
    selectedStudent,
    childName,
    parentPhone,
    note,
    onSuccess,
    onClose,
  ]);

  const modeTabs: Array<{ key: InputMode; label: string }> = [
    { key: 'makeup', label: '补课' },
    { key: 'select', label: '选择线索' },
    { key: 'input', label: '输入新线索' },
  ];

  return (
    <>
      <Modal visible={visible} title="约试听/补课" onClose={onClose}>
        <View className="px-[32rpx] py-[28rpx]">
          <View className="mb-4 rounded-[16rpx] bg-primary/10 px-4 py-3">
            <Text className="text-[28rpx] font-medium text-primary">
              {className || '未命名班级'}
            </Text>
            <Text className="text-[24rpx] text-primary/80 mt-1">
              {lessonDate} {startTime}-{endTime}
            </Text>
          </View>

          <View className="flex rounded-full bg-muted p-[4rpx] mb-4">
            {modeTabs.map((tab) => (
              <View
                key={tab.key}
                className={cn(
                  'flex-1 py-2 text-center rounded-full',
                  mode === tab.key ? 'bg-white shadow-sm' : '',
                )}
                onClick={() => setMode(tab.key)}
              >
                <Text
                  className={cn(
                    'text-[24rpx]',
                    mode === tab.key ? 'text-primary font-medium' : 'text-muted-foreground',
                  )}
                >
                  {tab.label}
                </Text>
              </View>
            ))}
          </View>

          {mode === 'makeup' ? (
            <>
              {!selectedStudent ? (
                <View
                  className="flex flex-col items-center justify-center gap-3 rounded-[16rpx] border-2 border-dashed border-border bg-muted/30 py-[48rpx] active:bg-muted/60"
                  onClick={handleOpenStudentPicker}
                >
                  <View className="flex h-[80rpx] w-[80rpx] items-center justify-center rounded-full bg-primary/10">
                    <Icon name="mdi-plus" size={36} className="text-primary" />
                  </View>
                  <Text className="text-[28rpx] font-medium text-foreground">选择已有学员</Text>
                  <Text className="text-[24rpx] text-muted-foreground">
                    点击从学员库中选择来补课
                  </Text>
                </View>
              ) : (
                <View className="flex flex-col gap-3">
                  <PickerItem
                    iconType="avatar"
                    avatarUrl={selectedStudent.avatar_url}
                    avatarChar={selectedStudent.name?.[0]}
                    title={selectedStudent.name}
                    subtitle={
                      [selectedStudent.phone, selectedStudent.nickname]
                        .filter(Boolean)
                        .join(' · ') || '正式学员'
                    }
                    selected
                    right={{
                      type: 'change-btn',
                      onChangeClick: handleOpenStudentPicker,
                    }}
                  />
                </View>
              )}
            </>
          ) : null}

          {mode === 'select' ? (
            <>
              {!selectedLead ? (
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
                <View className="flex flex-col gap-3">
                  <PickerItem
                    iconType="avatar"
                    avatarUrl={selectedLead.avatar_url}
                    avatarChar={selectedLead.child_name[0]}
                    title={selectedLead.child_name}
                    subtitle={
                      [selectedLead.parent_name, selectedLead.parent_phone, selectedLead.child_age]
                        .filter(Boolean)
                        .join(' · ') || '暂无更多资料'
                    }
                    selected
                    right={{
                      type: 'change-btn',
                      onChangeClick: handleOpenLeadPicker,
                    }}
                  />
                </View>
              )}
            </>
          ) : null}

          {mode === 'input' ? (
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
          ) : null}

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

        <View className="border-t border-border px-[32rpx] pt-4 pb-6">
          <ActionButton
            text={
              submitting
                ? mode === 'makeup'
                  ? '预约中...'
                  : '预约中...'
                : mode === 'makeup'
                  ? '确认补课'
                  : '确认预约'
            }
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            fixed={false}
          />
        </View>
      </Modal>

      <BottomSheet
        visible={leadPickerVisible}
        title="选择线索"
        onClose={() => setLeadPickerVisible(false)}
        height="70vh"
      >
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
              const subtitle =
                [lead.parent_name, lead.parent_phone, lead.child_age].filter(Boolean).join(' · ') ||
                '暂无更多资料';
              return (
                <View
                  key={lead.id}
                  className={cn(
                    'flex items-center gap-5 py-5 border-b border-input/50',
                    isSelected ? 'bg-primary/5 -mx-4 px-4 rounded-2xl' : '',
                  )}
                  onClick={() => handleSelectLead(lead)}
                >
                  <Avatar name={lead.child_name} avatarUrl={lead.avatar_url} size="md" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-medium text-foreground block">
                      {lead.child_name}
                      {lead.child_nickname ? `（${lead.child_nickname}）` : ''}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground/60 block mt-1">
                      {subtitle}
                    </Text>
                  </View>
                  {isSelected && <Text className="text-primary text-lg">✓</Text>}
                </View>
              );
            })
          )}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={studentPickerVisible}
        title="选择补课学员"
        onClose={() => setStudentPickerVisible(false)}
        height="70vh"
      >
        <View className="px-10 pt-4 pb-2">
          <View className="border-[2rpx] border-input rounded-[20rpx] py-[18rpx] px-[24rpx] bg-white">
            <Input
              className="w-full text-[26rpx] text-foreground"
              placeholder="搜索学员姓名或手机号"
              placeholderStyle="color:#9ca3af"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value || '')}
            />
          </View>
        </View>

        <View className="px-10 pb-10">
          {loading ? (
            <View className="py-10 center">
              <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
            </View>
          ) : filteredStudents.length === 0 ? (
            <View className="py-10 center flex-col gap-3">
              <Icon name="mdi-account-search" size={56} className="text-muted-foreground" />
              <Text className="text-[26rpx] text-muted-foreground">
                {keyword ? '未找到匹配学员' : '暂无可补课学员'}
              </Text>
            </View>
          ) : (
            filteredStudents.map((stu) => {
              const isSelected = selectedStudent?.id === stu.id;
              const subtitle = [stu.phone, stu.nickname].filter(Boolean).join(' · ') || '正式学员';
              return (
                <View
                  key={stu.id}
                  className={cn(
                    'flex items-center gap-5 py-5 border-b border-input/50',
                    isSelected ? 'bg-primary/5 -mx-4 px-4 rounded-2xl' : '',
                  )}
                  onClick={() => handleSelectStudent(stu)}
                >
                  <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="md" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-medium text-foreground block">
                      {stu.name}
                      {stu.nickname ? `（${stu.nickname}）` : ''}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground/60 block mt-1">
                      {subtitle}
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
