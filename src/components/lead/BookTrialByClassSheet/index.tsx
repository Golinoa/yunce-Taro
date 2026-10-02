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
import dayjs from 'dayjs';
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
  subscribeMessageService,
} from '@/services';
import { useStudentStore } from '@/stores';
import { useCampusStore } from '@/stores/campus';
import type { Class } from '@/types/class';
import type { Lead } from '@/types/lead';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { REFRESH_SIGNAL, setRefreshSignal } from '@/utils/refresh-signal';
import { canOperateHistoricalLesson } from '@/utils/schedule-guard';
import {
  autoCheckInMakeupStudent,
  autoCheckInTrialStudent,
  hasCheckedInLesson,
  type AutoCheckInResult,
} from './auto-checkin';

/**
 * 二次确认（用户口径 2026-10-01）：**只有「确定」才继续写入**；
 * 选「取消」= 中断整个添加流程，一条数据都不写、弹层也不关。
 */
async function askCheckInConfirm(params: {
  title: string;
  content: string;
  confirmText: string;
}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    void Taro.showModal({
      title: params.title,
      content: params.content,
      confirmText: params.confirmText,
      cancelText: '取消',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false),
    });
  });
}

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
  /**
   * 本节所属排课的编号（课表卡片的 `id`）。
   * 试听/补课都会把它一起存进预约 ⇒ 以后这节课被同日调课改了时段，
   * 预约仍认得它（排课编号不变）。拿不到就留空，读取端按「班级+日期+时段」兜底。
   */
  scheduleId?: string;
  /**
   * 这节课是否**已下课**（过去日期，或当日已下课/已点名）。
   *
   * 由调用方用同一个真源 `isHistoricalClassCard(卡片 status, 日期, now)` 算好传进来，
   * 不要在这里自己按时间猜——否则会出现「卡片上没有补录按钮、弹层里却能签到」的口径分裂。
   * 用途：只有已下课的课才谈得上「签到」；未来课只能建预约。
   */
  historical?: boolean;
  onClose: () => void;
  /**
   * 预约成功回调，返回班级、日期、**本节时段**与本次预约类型（补课 / 试听）。
   * 必须带 startTime：同一班同一天可能排多节课，只按班级+日期标记会把当天的
   * 每一节课都当成有试听。
   */
  onSuccess?: (payload: {
    classId: string;
    lessonDate: string;
    startTime: string;
    mode: 'makeup' | 'trial';
  }) => void;
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
  scheduleId,
  historical = false,
  onClose,
  onSuccess,
}) => {
  const { session, profile } = useAuth();
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
  const [classDetail, setClassDetail] = useState<Class | null>(null);

  // 课表卡片可能只带班级 ID，不能假设卡片上的老师/校区字段永远完整。
  // 打开弹层时补取班级详情，预约时优先使用数据库中的授课老师和校区。
  useEffect(() => {
    if (!visible || !classId) {
      setClassDetail(null);
      return;
    }
    let cancelled = false;
    void classService
      .getById(classId)
      .then((detail) => {
        if (!cancelled) setClassDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setClassDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, classId]);

  const bookingCampusId = classDetail?.campus_id || resolvedCampusId;
  const bookingTeacherId = classDetail?.teacher_id || teacherId || '';
  const bookingClassName = className || classDetail?.name || '试听课';

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
      // 复用学员 store 的统一入口：自带软删除过滤，保证补课学员列表不含已删除学员。
      useStudentStore.getState().fetchByTeacher(userId, resolvedCampusId || undefined),
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
    if (!bookingCampusId) {
      Taro.showToast({ title: '缺少校区信息，请先选择校区', icon: 'none' });
      return;
    }
    if (!bookingTeacherId) {
      Taro.showToast({ title: '缺少授课老师信息，请刷新课表后重试', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      /**
       * 本节课能不能「签到」——补课与试听**共用同一个判定**：
       * 只有**已下课**的课才谈得上签到（人到了），且要在 30 天补录期内
       * （`canOperateHistoricalLesson` 是既有口径）。未来课只能建预约。
       */
      const canCheckIn = historical && canOperateHistoricalLesson(dayjs(lessonDate), dayjs());

      if (mode === 'makeup' && selectedStudent) {
        const targetStudent = selectedStudent;
        /**
         * 二次确认（用户口径 2026-10-01）：明确告知「确定即自动签到」，
         * 取消就中断添加流程，不做任何写入。
         */
        const confirmed = await askCheckInConfirm(
          canCheckIn
            ? {
                title: '补课并签到',
                content: `将为「${targetStudent.name}」在本节课签到并消课 1 课时，确定吗？`,
                confirmText: '确定并签到',
              }
            : historical
              ? {
                  title: '仅添加补课',
                  content: `本节课已超过 30 天补录期限，只能添加补课、无法签到。仍要添加「${targetStudent.name}」吗？`,
                  confirmText: '仅添加',
                }
              : {
                  title: '添加补课',
                  content: `将为「${targetStudent.name}」添加本节课的补课（本节课还没下课，届时在点名页签到）。确定吗？`,
                  confirmText: '确定',
                },
        );
        if (!confirmed) return;

        await makeupBookingService.create({
          studentId: targetStudent.id,
          classId,
          lessonDate,
          startTime,
          endTime,
          /**
           * ⚠️ 不再上报 `teacherId`：老师归属由**后端按这节课的配置**解析
           * （`Schedule.teacherId` → 兜底 `Class.teacherId`）。历史上这里传的是
           * 「当前操作人的 identity id」，校长账号会传成 Profile.id ⇒ 后端 404「教师不存在」。
           */
          teacherName,
          scheduleId,
          source: 'teacher',
          note: note.trim() || undefined,
          createdBy: userId,
        });
        // 写后失效：课表卡片与点名页名单快照要能看到这条补课（原缺口 G1）
        setRefreshSignal(REFRESH_SIGNAL.schedule);

        if (!canCheckIn) {
          Taro.showToast({
            title: historical ? '补课已添加（超 30 天不可签到）' : '补课已添加',
            icon: 'none',
            duration: 2200,
          });
          onSuccess?.({ classId, lessonDate, startTime, mode: 'makeup' });
          onClose();
          return;
        }

        // 确定后「添加并且签到」：复用点名页的单人消课链路（幂等，不会重复消课）
        const checkin = await autoCheckInMakeupStudent({
          student: targetStudent,
          classId,
          scheduleId,
          lessonDate,
          campusId: bookingCampusId,
          currentUserId: userId,
          currentTeacherId: bookingTeacherId,
          profile,
        });

        if (checkin.ok) {
          Taro.showToast({
            title: checkin.alreadyCheckedIn ? '已在补课名单（已签到）' : '已添加并签到',
            icon: 'success',
            duration: 1800,
          });
        } else {
          Taro.showToast({ title: '补课已添加，未签到', icon: 'none', duration: 1500 });
          if (checkin.reason) {
            setTimeout(() => {
              Taro.showToast({ title: checkin.reason!.slice(0, 32), icon: 'none', duration: 2500 });
            }, 1600);
          }
        }
        onSuccess?.({ classId, lessonDate, startTime, mode: 'makeup' });
        onClose();
        return;
      }

      // ==================== 试听：与补课**同一套**「确定即添加并签到」流程 ====================
      let leadId = selectedLead?.id;
      let trialStudentId = selectedLead?.trial_student_id || '';
      let trialStudentName = selectedLead?.child_name || childName.trim() || '试听学员';

      if (mode === 'input') {
        const newLead = await leadService.createLead(
          {
            child_name: childName.trim(),
            parent_phone: parentPhone.trim(),
            campus_id: bookingCampusId,
            source_type: 'manual',
          },
          userId,
        );
        leadId = newLead.id;
        trialStudentId = newLead.trial_student_id;
        trialStudentName = newLead.child_name || childName.trim() || '试听学员';
      }

      /**
       * 幂等前置检查：该学员本节已签到 ⇒ 不重复建预约、不重复写记录。
       * 放在建单之前，是因为后端对「同线索同时段重复预约」会直接 422 拦下，
       * 先判掉能让"再点一次"得到一个说得清的结果而不是一句报错。
       */
      if (trialStudentId) {
        try {
          if (
            await hasCheckedInLesson({
              studentId: trialStudentId,
              classId,
              lessonDate,
              scheduleId,
            })
          ) {
            Taro.showToast({
              title: `${trialStudentName} 已在本节课签到`,
              icon: 'none',
              duration: 2000,
            });
            onSuccess?.({ classId, lessonDate, startTime, mode: 'trial' });
            onClose();
            return;
          }
        } catch (err) {
          // 查不到旧记录不能当"没签到"（宁可多一次后端校验，也不能重复写记录）
          logError('BookTrialByClassSheet trial checkin precheck', err);
        }
      }

      const trialConfirmed = await askCheckInConfirm(
        canCheckIn
          ? {
              title: '试听并签到',
              content: `将为「${trialStudentName}」在本节课签到（试听不消课时），确定吗？`,
              confirmText: '确定并签到',
            }
          : historical
            ? {
                title: '仅添加试听',
                content: `本节课已超过 30 天补录期限，只能添加预约、无法签到。仍要添加「${trialStudentName}」吗？`,
                confirmText: '仅添加',
              }
            : {
                title: '预约试听',
                content: `将为「${trialStudentName}」预约本节课的试听（本节课还没下课，届时在点名页签到）。确定吗？`,
                confirmText: '确定',
              },
      );
      if (!trialConfirmed) return;

      await leadService.bookTrialByClass({
        leadId: leadId!,
        classId,
        className: bookingClassName,
        campusId: bookingCampusId,
        lessonDate,
        startTime,
        endTime,
        /** 「哪一节」的排课编号：存下来后，同日调课改了时段也不会让预约失配 */
        referenceScheduleId: scheduleId,
        teacherId: bookingTeacherId,
        teacherName,
        operatorId: userId,
        note: note.trim() || undefined,
      });
      // 写后失效：课表角标与点名页名单快照要立刻看到这条预约（与补课同口径）
      setRefreshSignal(REFRESH_SIGNAL.schedule);
      void subscribeMessageService.runFlow('E24', {
        bookingLabel: `试听·${bookingClassName}`,
      });

      if (!canCheckIn) {
        Taro.showToast({
          title: historical ? '预约成功（超 30 天不可签到）' : '预约成功',
          icon: 'success',
          duration: 2000,
        });
        onSuccess?.({ classId, lessonDate, startTime, mode: 'trial' });
        onClose();
        return;
      }

      // 确定后「添加并且签到」：试听不消课时，只写一条 NORMAL 的试听签到记录
      const trialCheckin: AutoCheckInResult = trialStudentId
        ? await autoCheckInTrialStudent({
            studentId: trialStudentId,
            studentName: trialStudentName,
            classId,
            scheduleId,
            lessonDate,
            currentTeacherId: bookingTeacherId,
          })
        : { ok: false, reason: '未取到试听学员信息，请进点名页手动签到' };

      if (trialCheckin.ok) {
        Taro.showToast({
          title: trialCheckin.alreadyCheckedIn ? '已在试听名单（已签到）' : '已添加并签到',
          icon: 'success',
          duration: 1800,
        });
      } else {
        Taro.showToast({ title: '预约成功，未签到', icon: 'none', duration: 1500 });
        if (trialCheckin.reason) {
          setTimeout(() => {
            Taro.showToast({
              title: trialCheckin.reason!.slice(0, 32),
              icon: 'none',
              duration: 2500,
            });
          }, 1600);
        }
      }
      onSuccess?.({ classId, lessonDate, startTime, mode: 'trial' });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      Taro.showToast({
        title: message ? message.slice(0, 32) : mode === 'makeup' ? '补课预约失败' : '预约失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    classId,
    bookingCampusId,
    bookingClassName,
    lessonDate,
    startTime,
    endTime,
    scheduleId,
    bookingTeacherId,
    teacherName,
    userId,
    profile,
    historical,
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
