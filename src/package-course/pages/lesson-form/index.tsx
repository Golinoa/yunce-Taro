import { View, Text, Input, Picker, Textarea, Image, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ActionButton from '@/components/ActionButton';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import ClassSelector from '@/components/lesson/ClassSelector';
import StudentCard from '@/components/lesson/StudentCard';
import PageContainer from '@/components/PageContainer';
import PickerItem from '@/components/PickerItem';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import StarRating from '@/components/StarRating';
import Stepper from '@/components/Stepper';
import StudentAvatar from '@/components/student/StudentAvatar';
import { checkThresholdAlert } from '@/data/operation-alert';
import {
  studentService,
  packageService,
  lessonRecordService,
  leaveService,
  notificationService,
  classService,
  subjectService,
  uploadService,
  teacherService,
  leadService,
} from '@/services';
import { auditLogService } from '@/services/audit-log';
import { campusService, roomService } from '@/services/campus';
import { useStudentStore, useClassStore } from '@/stores';
import { useCampusStore } from '@/stores/campus';
import type { CampusUIModel, Room } from '@/types/campus';
import type { Class } from '@/types/class';
import type { CoursePackage } from '@/types/course-package';
import type { Lead, LeadBooking } from '@/types/lead';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import type { Subject } from '@/types/subject';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { hasTrialPackage, pickBestPackage } from '@/utils/package-helper';
import { withRouteGuard } from '@/utils/route-guard';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

/** 格式化日期为 YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 格式化时间为 HH:mm */
function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function isDateWithinRange(targetDate: string, startDate?: string, endDate?: string) {
  if (!targetDate || !startDate) {
    return false;
  }
  const end = endDate || startDate;
  return targetDate >= startDate && targetDate <= end;
}

/** 根据日期返回星期几 */
function getWeekday(dateStr: string): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return weekdays[date.getDay()];
}

const SCHEDULE_REFRESH_SIGNAL_KEY = 'yunce:schedule:refresh';
const LESSON_EDIT_RESULT_KEY = 'yunce:lesson-form:edit-result';
const FORM_CARD_CLASS_NAME = 'mx-[24rpx] mb-3 overflow-hidden rounded-[20rpx] bg-white shadow-soft';

/** 签到状态：签到/请假/未到 */
type CheckinStatus = 'checked' | 'leave' | 'absent';

/** 状态对应样式 */
const CHECKIN_OPTION_STYLES: Record<
  CheckinStatus,
  { label: string; activeBg: string; activeText: string; activeBorder?: string }
> = {
  checked: { label: '签到', activeBg: 'bg-success', activeText: 'text-white' },
  leave: { label: '请假', activeBg: 'bg-destructive', activeText: 'text-white' },
  absent: { label: '未到', activeBg: 'bg-warning', activeText: 'text-white' },
};

/** 单个状态选项按钮（圆角胶囊） */
const CheckinOptionButton: React.FC<{
  status: CheckinStatus;
  current: CheckinStatus;
  onClick: () => void;
}> = ({ status, current, onClick }) => {
  const active = status === current;
  const style = CHECKIN_OPTION_STYLES[status];
  return (
    <View
      className={`flex h-[52rpx] flex-1 items-center justify-center rounded-full border ${active ? `${style.activeBg} border-transparent` : 'border-border bg-muted/30'}`}
      onClick={onClick}
    >
      <Text
        className={`text-center text-[22rpx] font-medium ${active ? style.activeText : 'text-muted-foreground'}`}
      >
        {style.label}
      </Text>
    </View>
  );
};

/** 学员签到卡片 - 图片风格：居中头像+两按钮（签到/未到请假切换）+编辑 */
const CheckinCard: React.FC<{
  name: string;
  status: CheckinStatus;
  remaining?: string;
  deduct?: string;
  isTrial?: boolean;
  onToggleStatus: (next: CheckinStatus) => void;
  onOpenDetailSheet: () => void;
}> = ({
  name,
  status,
  remaining = '',
  deduct = '',
  isTrial = false,
  onToggleStatus,
  onOpenDetailSheet,
}) => {
  const handleRightButtonClick = () => {
    if (status === 'checked') {
      onToggleStatus('absent');
    } else if (status === 'absent') {
      onToggleStatus('leave');
    } else {
      onToggleStatus('absent');
    }
  };
  const rightLabel = status === 'leave' ? '请假' : '未到';
  const rightActive = status === 'leave' || status === 'absent';
  const rightActiveBg = status === 'leave' ? 'bg-destructive' : 'bg-warning';

  return (
    <View className="relative flex flex-col items-center rounded-[20rpx] bg-white px-[16rpx] py-[20rpx] shadow-card">
      {isTrial ? (
        <View className="absolute left-0 top-0 rounded-tl-[20rpx] rounded-br-[12rpx] bg-error/10 px-[12rpx] py-[4rpx]">
          <Text className="text-[18rpx] font-medium text-error">试听</Text>
        </View>
      ) : null}
      <View
        className="absolute right-[6rpx] top-[6rpx] flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full bg-muted/40 active:opacity-70"
        onClick={onOpenDetailSheet}
      >
        <Icon name="mdi-square-edit-outline" size="md" color="primary" />
      </View>
      <StudentAvatar name={name} size="md" />
      <Text className="mt-[12rpx] text-center text-[28rpx] font-medium text-foreground line-clamp-1">
        {name}
      </Text>
      <View className="relative mt-[12rpx] grid w-full grid-cols-2 gap-x-[16rpx] gap-y-[4rpx]">
        <Text className="text-center text-[22rpx] text-muted-foreground">剩余</Text>
        <Text className="text-center text-[22rpx] text-muted-foreground">扣课</Text>
        <Text className="text-center text-[24rpx] text-destructive line-clamp-1">
          {remaining || '-'}
        </Text>
        <Text className="text-center text-[24rpx] text-destructive line-clamp-1">
          {deduct || '-'}
        </Text>
        {/* 分割竖线 */}
        <View className="absolute bottom-[4rpx] left-1/2 top-[4rpx] w-[1rpx] -translate-x-1/2 bg-border" />
      </View>
      <View className="mt-[16rpx] grid w-full grid-cols-2 gap-[16rpx]">
        <CheckinOptionButton
          status="checked"
          current={status}
          onClick={() => onToggleStatus('checked')}
        />
        <View
          className={`flex h-[52rpx] flex-1 items-center justify-center rounded-full border ${rightActive ? `${rightActiveBg} border-transparent` : 'border-border bg-muted/30'}`}
          onClick={handleRightButtonClick}
        >
          <Text
            className={`text-center text-[22rpx] font-medium ${rightActive ? 'text-white' : 'text-muted-foreground'}`}
          >
            {rightLabel}
          </Text>
        </View>
      </View>
    </View>
  );
};

/** 学员编辑底部弹窗 - 调课/移除/备注 */
const StudentEditSheet: React.FC<{
  visible: boolean;
  target: {
    type: 'formal' | 'trial';
    id: string;
    name: string;
    remaining: string;
    deduct: string;
    courseName?: string;
    student?: Student;
  } | null;
  remark: string;
  classes: Class[];
  selectedClassId: string;
  onRemarkChange: (value: string) => void;
  onClose: () => void;
  onTransfer: (student: Student, targetClassId: string) => void;
  onRemove: (student: Student) => void;
  onConfirm: () => void;
}> = ({
  visible,
  target,
  remark,
  classes,
  selectedClassId,
  onRemarkChange,
  onClose,
  onTransfer,
  onRemove,
  onConfirm,
}) => {
  const [showTransferList, setShowTransferList] = useState(false);

  if (!target) {
    return null;
  }

  const isTrial = target.type === 'trial';
  const canManage = !isTrial && Boolean(target.student);

  return (
    <BottomSheet visible={visible} title="" height="auto" scrollable={false} onClose={onClose}>
      <View className="px-[32rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))] pt-[24rpx]">
        {/* 头部：头像 + 调课/移除 */}
        <View className="mb-[32rpx] flex items-center justify-between">
          <View className="flex items-center gap-[16rpx]">
            <StudentAvatar name={target.name} size="md" />
            <Text className="text-[32rpx] font-medium text-foreground">{target.name}</Text>
          </View>
          {canManage ? (
            <View className="flex items-center gap-[24rpx]">
              <Text
                className="text-[26rpx] text-primary"
                onClick={() => setShowTransferList((prev) => !prev)}
              >
                调课
              </Text>
              {target.student ? (
                <Text
                  className="text-[26rpx] text-destructive"
                  onClick={() => onRemove(target.student!)}
                >
                  移除
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* 调课班级列表 */}
        {showTransferList && canManage ? (
          <View className="mb-[24rpx] rounded-[16rpx] bg-muted/50 px-[20rpx] py-[16rpx]">
            <Text className="mb-[12rpx] block text-[24rpx] text-muted-foreground">
              选择目标班级
            </Text>
            <View className="flex flex-col gap-[12rpx]">
              {classes
                .filter((cls) => cls.id !== selectedClassId)
                .map((cls) => (
                  <View
                    key={cls.id}
                    className="flex items-center justify-between rounded-[12rpx] bg-white px-[20rpx] py-[18rpx]"
                    onClick={() => {
                      if (target.student) {
                        onTransfer(target.student, cls.id);
                      }
                      setShowTransferList(false);
                    }}
                  >
                    <Text className="text-[26rpx] text-foreground">{cls.name}</Text>
                    <Icon name="mdi-chevron-right" size="sm" color="muted" />
                  </View>
                ))}
              {classes.filter((cls) => cls.id !== selectedClassId).length === 0 ? (
                <Text className="block text-center text-[24rpx] text-muted-foreground">
                  暂无其他班级
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* 信息行 */}
        <View className="mb-[24rpx] flex flex-col">
          <View className="flex items-center justify-between border-b border-border/40 py-[24rpx]">
            <Text className="text-[28rpx] text-muted-foreground">消耗课程</Text>
            <Text className="text-[28rpx] font-medium text-foreground">
              {target.courseName || '-'}
            </Text>
          </View>
          <View className="flex items-center justify-between border-b border-border/40 py-[24rpx]">
            <Text className="text-[28rpx] text-muted-foreground">扣课时</Text>
            <Text className="text-[28rpx] font-medium text-foreground">{target.deduct || '0'}</Text>
          </View>
          <View className="flex items-center justify-between py-[24rpx]">
            <Text className="text-[28rpx] text-muted-foreground">剩余课时</Text>
            <Text className="text-[28rpx] font-medium text-foreground">
              {target.remaining || '-'}
            </Text>
          </View>
        </View>

        {/* 备注 */}
        <View className="mb-[24rpx]">
          <Text className="mb-[12rpx] block text-[28rpx] text-foreground">备注</Text>
          <View className="rounded-[16rpx] bg-muted/30 px-[20rpx] py-[16rpx]">
            <Textarea
              className="h-[160rpx] w-full text-[28rpx] leading-[44rpx] text-foreground placeholder:text-muted-foreground/60"
              placeholder="请输入备注（学员端不可见）"
              value={remark}
              onInput={(e) => onRemarkChange(e.detail.value)}
              maxlength={200}
            />
          </View>
        </View>

        {/* 确定按钮 */}
        <View className="flex justify-center pb-[8rpx]">
          <View
            className="flex w-full items-center justify-center rounded-[48rpx] bg-[#FF7E67] py-[24rpx]"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <Text className="text-[28rpx] font-medium text-white">确定</Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

const LessonForm: React.FC = () => {
  const { profile } = useAuth();
  const navSafeHeight = useNavSafeHeight();

  const routeParams = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return instance?.router?.params || {};
  }, []);

  const studentIdParam = useMemo(() => {
    const v = routeParams.studentId || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const classIdParam = useMemo(() => {
    const v = routeParams.classId || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const lessonDateParam = useMemo(() => {
    const v = routeParams.lessonDate || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const lessonTimeParam = useMemo(() => {
    const v = routeParams.lessonTime || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const recordIdParam = useMemo(() => {
    const v = routeParams.recordId || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const modeParam = useMemo(() => {
    const v = routeParams.mode || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const scheduleIdParam = useMemo(() => {
    const v = routeParams.scheduleId || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const isEditEntryAttempt = Boolean(recordIdParam) || modeParam === 'edit';

  // ===== 模式切换 =====
  const [mode, setMode] = useState<'single' | 'class'>(classIdParam ? 'class' : 'single');

  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);
  const invalidateStudents = useStudentStore((state) => state.invalidate);
  const fetchClassesByTeacher = useClassStore((state) => state.fetchByTeacher);

  // ===== 单人模式状态 =====
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [matchedPackage, setMatchedPackage] = useState<CoursePackage | null>(null);
  const [matchedSubject, setMatchedSubject] = useState<Subject | null>(null);

  // ===== 班级模式状态 =====
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(classIdParam);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [checkedStudentIds, setCheckedStudentIds] = useState<Set<string>>(new Set());
  const [leaveStudentIds, setLeaveStudentIds] = useState<Set<string>>(new Set());
  const [studentPackages, setStudentPackages] = useState<Map<string, CoursePackage>>(new Map());
  const [studentSubjects, setStudentSubjects] = useState<Map<string, Subject | null>>(new Map());
  const [showAddStudentSheet, setShowAddStudentSheet] = useState(false);
  const [pendingAddStudentIds, setPendingAddStudentIds] = useState<Set<string>>(new Set());
  const [addStudentKeyword, setAddStudentKeyword] = useState('');

  // ===== 试听学员状态（团课约试听） =====
  const [trialBookings, setTrialBookings] = useState<LeadBooking[]>([]);
  /** 试听学员签到状态映射：bookingId → CheckinStatus */
  const [trialCheckinMap, setTrialCheckinMap] = useState<Record<string, CheckinStatus>>({});
  const [trialLeadMap, setTrialLeadMap] = useState<Record<string, Lead>>({});

  // ===== 当前身份 =====
  const currentUserId = profile?.id || '';
  const currentTeacherId = profile?.teacher_profile?.id || currentUserId;
  const attendanceRecordActorId = currentUserId || currentTeacherId;
  const [teacherOptions, setTeacherOptions] = useState<TeacherUIModel[]>([]);
  const [selectedTeachingTeacherId, setSelectedTeachingTeacherId] = useState('');
  const [selectedAssistantTeacherId, setSelectedAssistantTeacherId] = useState('');

  // ===== 课程信息 =====
  const now = useMemo(() => new Date(), []);
  const [lessonDate, setLessonDate] = useState(lessonDateParam || formatDate(now));
  const [lessonTime, setLessonTime] = useState(lessonTimeParam || formatTime(now));
  const [hoursUsed, setHoursUsed] = useState(1);
  const [content, setContent] = useState('');
  const [performance, setPerformance] = useState(0);
  const [homework, setHomework] = useState('');
  const [homeworkImages, setHomeworkImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ===== 校区 / 教室 =====
  const { currentCampusId } = useCampusStore();
  const [campusOptions, setCampusOptions] = useState<CampusUIModel[]>([]);
  const [campusId, setCampusId] = useState(currentCampusId);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState('');
  /** 统一弹窗选择器（PickerSheet 标准组件）：teacher/campus/room */
  const [selector, setSelector] = useState<{
    visible: boolean;
    type: 'teacher' | 'campus' | 'room' | null;
  }>({ visible: false, type: null });

  // ===== 班级模式：搜索/扣费/筛选 =====
  const [studentSearchKeyword, setStudentSearchKeyword] = useState('');
  const [feeAmount, setFeeAmount] = useState<string>('0');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | CheckinStatus>('all');

  // ===== 学员卡片编辑弹窗 =====
  const [showStudentDetailSheet, setShowStudentDetailSheet] = useState(false);
  const [detailSheetTarget, setDetailSheetTarget] = useState<{
    type: 'formal' | 'trial';
    id: string;
    name: string;
    remaining: string;
    deduct: string;
    courseName?: string;
    student?: Student;
  } | null>(null);
  const [detailSheetRemark, setDetailSheetRemark] = useState('');

  const applyClassTeacherDefaults = useCallback(
    (classInfo: Class | null, options: TeacherUIModel[]) => {
      if (!classInfo) {
        setSelectedTeachingTeacherId(currentTeacherId);
        setSelectedAssistantTeacherId('');
        return;
      }

      const configuredTeacherIds = classInfo.teachers?.length
        ? classInfo.teachers
        : classInfo.teacher_id
          ? [classInfo.teacher_id]
          : [];
      const configuredTeachers = configuredTeacherIds
        .map((id) => options.find((teacher) => teacher.id === id))
        .filter((teacher): teacher is TeacherUIModel => Boolean(teacher));
      const leadTeacher =
        configuredTeachers.find((teacher) => teacher.role !== 'assist') ||
        configuredTeachers[0] ||
        options.find((teacher) => teacher.id === classInfo.teacher_id) ||
        options.find((teacher) => teacher.id === currentTeacherId) ||
        null;
      const assistantTeacher =
        configuredTeachers.find(
          (teacher) => teacher.role === 'assist' && teacher.id !== leadTeacher?.id,
        ) || null;

      setSelectedTeachingTeacherId(leadTeacher?.id || currentTeacherId);
      setSelectedAssistantTeacherId(assistantTeacher?.id || '');
    },
    [currentTeacherId],
  );

  useEffect(() => {
    if (classIdParam) {
      setMode('class');
    }
    if (lessonDateParam) {
      setLessonDate(lessonDateParam);
    }
    if (lessonTimeParam) {
      setLessonTime(lessonTimeParam);
    }
  }, [classIdParam, lessonDateParam, lessonTimeParam]);

  // 从编辑页返回后回写更新字段
  useDidShow(() => {
    try {
      const result = Taro.getStorageSync(LESSON_EDIT_RESULT_KEY);
      if (!result) return;
      const data = JSON.parse(result);
      if (data.lessonDate) setLessonDate(data.lessonDate);
      if (data.startTime && data.endTime) setLessonTime(`${data.startTime}-${data.endTime}`);
      if (data.leadTeacherId) setSelectedTeachingTeacherId(data.leadTeacherId);
      if (data.assistantTeacherId !== undefined)
        setSelectedAssistantTeacherId(data.assistantTeacherId);
      if (data.content !== undefined) setContent(data.content);
      if (data.remark !== undefined) setHomework(data.remark);
      Taro.removeStorageSync(LESSON_EDIT_RESULT_KEY);
    } catch (err) {
      logError('lesson-form apply edit result', err);
    }
  });

  useEffect(() => {
    if (!isEditEntryAttempt) {
      return;
    }

    Taro.showToast({
      title: '历史消课记录不支持编辑',
      icon: 'none',
    });

    const goSchedulePage = () => {
      Taro.switchTab({ url: '/pages/schedule/index' }).catch(() => {});
    };

    const timer = setTimeout(() => {
      if (Taro.getCurrentPages().length > 1) {
        Taro.navigateBack().catch(() => {
          goSchedulePage();
        });
        return;
      }

      goSchedulePage();
    }, 250);

    return () => clearTimeout(timer);
  }, [isEditEntryAttempt]);

  const loadApprovedLeaveStudentIds = useCallback(
    async (students: Student[]) => {
      if (!lessonDate || students.length === 0) {
        const emptySet = new Set<string>();
        setLeaveStudentIds(emptySet);
        return emptySet;
      }

      const leaveList = await leaveService.getByTeacher(currentTeacherId);
      const classStudentIds = new Set(students.map((student) => student.id));
      const nextLeaveStudentIds = new Set(
        leaveList
          .filter(
            (leave) =>
              leave.status === 'approved' &&
              classStudentIds.has(leave.student_id) &&
              isDateWithinRange(lessonDate, leave.original_date, leave.end_date),
          )
          .map((leave) => leave.student_id),
      );
      setLeaveStudentIds(nextLeaveStudentIds);
      return nextLeaveStudentIds;
    },
    [currentTeacherId, lessonDate],
  );

  /** 加载该班级/日期的试听预约学员 */
  const loadTrialBookings = useCallback(async () => {
    if (!selectedClassId || !lessonDate || !currentUserId) {
      setTrialBookings([]);
      setTrialCheckinMap({});
      setTrialLeadMap({});
      return;
    }

    try {
      const bookings = await leadService.getLeadBookingsByTeacher(currentUserId, {
        startDate: lessonDate,
        endDate: lessonDate,
        status: 'confirmed',
      });
      const classBookings = bookings.filter(
        (b) => b.class_id === selectedClassId && b.lesson_date === lessonDate,
      );
      setTrialBookings(classBookings);

      const leadIds = [...new Set(classBookings.map((b) => b.lead_id))];
      const leads = await Promise.all(leadIds.map((id) => leadService.getLeadById(id)));
      const nextLeadMap: Record<string, Lead> = {};
      leads.forEach((lead) => {
        if (lead) {
          nextLeadMap[lead.id] = lead;
        }
      });
      setTrialLeadMap(nextLeadMap);
      // 试听学员默认全部"未到"
      const initMap: Record<string, CheckinStatus> = {};
      classBookings.forEach((b) => {
        initMap[b.id] = 'absent';
      });
      setTrialCheckinMap(initMap);
    } catch (err) {
      logError('loadTrialBookings', err);
      setTrialBookings([]);
      setTrialLeadMap({});
      setTrialCheckinMap({});
    }
  }, [currentUserId, lessonDate, selectedClassId]);

  // ===== 初始化加载 =====
  useEffect(() => {
    if (isEditEntryAttempt) {
      return;
    }

    const loadData = async () => {
      const [classList, teacherList, campusList] = await Promise.all([
        fetchClassesByTeacher(currentUserId),
        teacherService.getList(),
        campusService.getList(),
      ]);
      setClasses(classList);
      setTeacherOptions(teacherList);
      setCampusOptions(campusList);
      const mainCampusId = campusList.find((campus) => campus.isMain)?.id || '';
      setCampusId((prev) => prev || mainCampusId);
      setSelectedTeachingTeacherId((prev) => {
        if (prev) return prev;
        const matchedTeacher =
          teacherList.find((teacher) => teacher.id === currentTeacherId) ||
          teacherList.find((teacher) => teacher.name === profile?.name);
        return matchedTeacher?.id || currentTeacherId;
      });

      if (studentIdParam) {
        const stu = await studentService.getById(studentIdParam);
        if (stu) {
          setSelectedStudent(stu);
          setCampusId(stu.campus_id || mainCampusId);
          // 内联匹配逻辑，避免依赖 autoMatchPackage
          const pkgs = await packageService.getActiveByStudent(stu.id);
          const best = pickBestPackage(pkgs, hoursUsed);
          setMatchedPackage(best);
          if (best?.subject_id) {
            const sub = await subjectService.getById(best.subject_id);
            setMatchedSubject(sub);
          } else {
            setMatchedSubject(null);
          }
        }
      }

      if (classIdParam) {
        const [classInfo, students] = await Promise.all([
          classService.getById(classIdParam),
          classService.getStudents(classIdParam),
        ]);
        setSelectedClassId(classIdParam);
        setCampusId(classInfo?.campus_id || mainCampusId);
        applyClassTeacherDefaults(classInfo, teacherList);
        setClassStudents(students);
        await loadApprovedLeaveStudentIds(students);
        setCheckedStudentIds(new Set());
        // 为每个学员匹配课包
        const pkgMap = new Map<string, CoursePackage>();
        const subMap = new Map<string, Subject | null>();
        for (const stu of students) {
          const pkgs = await packageService.getActiveByStudent(stu.id);
          const best = pickBestPackage(pkgs, hoursUsed);
          if (best) {
            pkgMap.set(stu.id, best);
            if (best.subject_id) {
              const sub = await subjectService.getById(best.subject_id);
              subMap.set(stu.id, sub);
            } else {
              subMap.set(stu.id, null);
            }
          }
        }
        setStudentPackages(pkgMap);
        setStudentSubjects(subMap);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在 URL 参数变化时初始化
  }, [
    classIdParam,
    currentTeacherId,
    currentUserId,
    fetchClassesByTeacher,
    applyClassTeacherDefaults,
    isEditEntryAttempt,
    loadApprovedLeaveStudentIds,
    profile?.name,
    studentIdParam,
  ]);

  // 班级/日期变化时重新加载试听学员
  useEffect(() => {
    void loadTrialBookings();
  }, [loadTrialBookings]);

  // 根据选中校区加载教室列表
  useEffect(() => {
    const loadRooms = async () => {
      if (!campusId) {
        setRooms([]);
        return;
      }
      try {
        const list = await roomService.getList({ campusId });
        setRooms(list);
      } catch (err) {
        logError('lesson-form load rooms', err);
        setRooms([]);
      }
    };
    loadRooms();
  }, [campusId]);

  // ===== 单人模式：自动匹配课包 =====
  const autoMatchPackage = useCallback(
    async (studentId: string) => {
      const pkgs = await packageService.getActiveByStudent(studentId);
      const best = pickBestPackage(pkgs, hoursUsed);
      setMatchedPackage(best);

      if (best?.subject_id) {
        const sub = await subjectService.getById(best.subject_id);
        setMatchedSubject(sub);
      } else {
        setMatchedSubject(null);
      }
    },
    [hoursUsed],
  );

  // 课时变化时重新匹配
  useEffect(() => {
    if (selectedStudent && mode === 'single') {
      autoMatchPackage(selectedStudent.id);
    }
  }, [hoursUsed, selectedStudent, mode, autoMatchPackage]);

  // ===== 单人模式：选择学生 =====
  const loadAllStudentsIfNeeded = useCallback(async () => {
    if (allStudents.length === 0) {
      const list = await fetchStudentsByTeacher(currentUserId);
      setAllStudents(list);
    }
  }, [allStudents.length, currentUserId, fetchStudentsByTeacher]);

  const handleOpenStudentPicker = useCallback(async () => {
    await loadAllStudentsIfNeeded();
    setShowStudentPicker(true);
  }, [loadAllStudentsIfNeeded]);

  const handleOpenAddStudentSheet = useCallback(async () => {
    await loadAllStudentsIfNeeded();
    setShowAddStudentSheet(true);
  }, [loadAllStudentsIfNeeded]);

  const handleSelectStudent = useCallback(
    async (stu: Student) => {
      setSelectedStudent(stu);
      setCampusId(stu.campus_id || campusId);
      setShowStudentPicker(false);
      await autoMatchPackage(stu.id);
    },
    [autoMatchPackage, campusId],
  );

  const selectedTeachingTeacher = useMemo(
    () => teacherOptions.find((teacher) => teacher.id === selectedTeachingTeacherId) || null,
    [teacherOptions, selectedTeachingTeacherId],
  );

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId],
  );
  const isClassDirectEntry = Boolean(classIdParam);
  const shouldShowModeTabs = !isClassDirectEntry;

  /** 上课时间范围：优先使用班级起止时间，否则按当前时间+1小时兜底 */
  const lessonTimeRange = useMemo(() => {
    if (selectedClass?.start_time && selectedClass?.end_time) {
      return `${selectedClass.start_time}-${selectedClass.end_time}`;
    }
    if (lessonTime) {
      const [h, m] = lessonTime.split(':').map((v) => parseInt(v, 10));
      const start = new Date();
      start.setHours(h || 0, m || 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(start.getHours())}:${pad(start.getMinutes())}-${pad(end.getHours())}:${pad(end.getMinutes())}`;
    }
    return '';
  }, [lessonTime, selectedClass?.end_time, selectedClass?.start_time]);

  const pageTitle = useMemo(() => {
    return mode === 'class' ? '班级消课' : '课时消课';
  }, [mode]);

  // ===== 班级模式：加载班级学员 =====
  const loadClassStudents = useCallback(
    async (classId: string) => {
      setSelectedClassId(classId);
      const [classInfo, students] = await Promise.all([
        classService.getById(classId),
        classService.getStudents(classId),
      ]);
      if (classInfo?.campus_id) {
        setCampusId(classInfo.campus_id);
      }
      if (classInfo?.room) {
        setRoom(classInfo.room);
      }
      applyClassTeacherDefaults(classInfo, teacherOptions);
      setClassStudents(students);
      await loadApprovedLeaveStudentIds(students);
      setCheckedStudentIds(new Set());

      // 为每个学员匹配课包
      const pkgMap = new Map<string, CoursePackage>();
      const subMap = new Map<string, Subject | null>();
      for (const stu of students) {
        const pkgs = await packageService.getActiveByStudent(stu.id);
        const best = pickBestPackage(pkgs, hoursUsed);
        if (best) {
          pkgMap.set(stu.id, best);
          if (best.subject_id) {
            const sub = await subjectService.getById(best.subject_id);
            subMap.set(stu.id, sub);
          } else {
            subMap.set(stu.id, null);
          }
        }
      }
      setStudentPackages(pkgMap);
      setStudentSubjects(subMap);
    },
    [applyClassTeacherDefaults, hoursUsed, loadApprovedLeaveStudentIds, teacherOptions],
  );

  // ===== 班级模式：切换班级 =====
  const handleSelectClass = useCallback(
    (classId: string) => {
      loadClassStudents(classId);
    },
    [loadClassStudents],
  );

  useEffect(() => {
    if (mode !== 'class' || classStudents.length === 0) {
      return;
    }

    const syncLeaveStudents = async () => {
      const approvedLeaveIds = await loadApprovedLeaveStudentIds(classStudents);
      setCheckedStudentIds((prev) => {
        const next = new Set<string>();
        classStudents.forEach((student) => {
          if (approvedLeaveIds.has(student.id)) {
            return;
          }
          if (prev.has(student.id)) {
            next.add(student.id);
          }
        });
        return next;
      });
    };

    void syncLeaveStudents();
  }, [classStudents, loadApprovedLeaveStudentIds, mode]);

  const handleBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => {
        void Taro.switchTab({ url: '/pages/schedule/index' });
      },
    });
  }, []);

  const emitScheduleRefreshSignal = useCallback(() => {
    try {
      Taro.setStorageSync(SCHEDULE_REFRESH_SIGNAL_KEY, String(Date.now()));
    } catch (err) {
      logError('emit schedule refresh signal', err);
    }
  }, []);

  const handleSubmitSuccessReturn = useCallback(
    (title: string, icon: 'success' | 'none' = 'success', duration = 1800) => {
      emitScheduleRefreshSignal();
      Taro.showToast({ title, icon, duration });
      setTimeout(() => {
        Taro.navigateBack({
          fail: () => {
            void Taro.switchTab({ url: '/pages/schedule/index' });
          },
        });
      }, 240);
    },
    [emitScheduleRefreshSignal],
  );

  const loadLessonRecordsByDate = useCallback(async () => {
    if (!attendanceRecordActorId || !lessonDate) {
      return [] as LessonRecord[];
    }
    return lessonRecordService.getByTeacherAndRange(
      attendanceRecordActorId,
      lessonDate,
      lessonDate,
    );
  }, [attendanceRecordActorId, lessonDate]);

  // ===== 班级模式：切换签到状态 =====
  /** 切换到指定状态：签到/请假/未到 */
  const handleSetStudentCheckin = useCallback((studentId: string, nextStatus: CheckinStatus) => {
    if (nextStatus === 'checked') {
      setCheckedStudentIds((prev) => {
        const next = new Set(prev);
        next.add(studentId);
        return next;
      });
      setLeaveStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    } else if (nextStatus === 'leave') {
      setCheckedStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
      setLeaveStudentIds((prev) => {
        const next = new Set(prev);
        next.add(studentId);
        return next;
      });
    } else {
      // 未到：从 checked 和 leave 都移除
      setCheckedStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
      setLeaveStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  }, []);

  // ===== 试听学员签到状态切换 =====
  const handleSetTrialCheckin = useCallback((bookingId: string, nextStatus: CheckinStatus) => {
    setTrialCheckinMap((prev) => ({ ...prev, [bookingId]: nextStatus }));
  }, []);

  const presentTrialBookings = useMemo(
    () => trialBookings.filter((b) => trialCheckinMap[b.id] === 'checked'),
    [trialBookings, trialCheckinMap],
  );
  const leaveTrialBookings = useMemo(
    () => trialBookings.filter((b) => trialCheckinMap[b.id] === 'leave'),
    [trialBookings, trialCheckinMap],
  );
  const absentTrialBookings = useMemo(
    () => trialBookings.filter((b) => trialCheckinMap[b.id] === 'absent'),
    [trialBookings, trialCheckinMap],
  );

  // ===== 班级模式：出勤学员 =====
  const presentStudents = useMemo(
    () => classStudents.filter((s) => checkedStudentIds.has(s.id)),
    [classStudents, checkedStudentIds],
  );
  const leaveStudents = useMemo(
    () => classStudents.filter((student) => leaveStudentIds.has(student.id)),
    [classStudents, leaveStudentIds],
  );
  const absentStudents = useMemo(
    () =>
      classStudents.filter(
        (student) => !checkedStudentIds.has(student.id) && !leaveStudentIds.has(student.id),
      ),
    [checkedStudentIds, classStudents, leaveStudentIds],
  );
  const classCheckedCount = presentStudents.length;
  const classLeaveCount = leaveStudents.length;
  const classAbsentCount = absentStudents.length;
  const allSelectableChecked =
    classStudents.length > 0 && classCheckedCount === classStudents.length;

  const addableStudents = useMemo(
    () =>
      allStudents.filter(
        (student) => !classStudents.some((currentStudent) => currentStudent.id === student.id),
      ),
    [allStudents, classStudents],
  );

  const filteredAddableStudents = useMemo(() => {
    const keyword = addStudentKeyword.trim().toLowerCase();
    if (!keyword) {
      return addableStudents;
    }

    return addableStudents.filter((student) => {
      const searchText =
        `${student.name}${student.nickname || ''}${student.phone || ''}`.toLowerCase();
      return searchText.includes(keyword);
    });
  }, [addStudentKeyword, addableStudents]);

  // ===== 图片上传 =====
  const handleUploadImage = useCallback(async () => {
    if (homeworkImages.length >= 3) {
      Taro.showToast({ title: '最多上传3张图片', icon: 'none' });
      return;
    }
    try {
      const res = await Taro.chooseImage({
        count: Math.min(3 - homeworkImages.length, 3),
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });
      setUploading(true);
      const tempPaths = res.tempFilePaths || [];
      // 通过 uploadService 上传，mock 阶段返回固定 URL
      const results = await uploadService.uploadBatch(tempPaths);
      const urls = results.map((r) => r.url);
      setHomeworkImages((prev) => [...prev, ...urls]);
      if (urls.length > 0) {
        Taro.showToast({ title: `上传成功 ${urls.length} 张`, icon: 'success' });
      }
    } catch {
      // 用户取消或上传失败
    } finally {
      setUploading(false);
    }
  }, [homeworkImages]);

  const handleRemoveImage = useCallback((index: number) => {
    setHomeworkImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleOpenStudentDetailSheet = useCallback(
    (target: {
      type: 'formal' | 'trial';
      id: string;
      name: string;
      remaining: string;
      deduct: string;
      courseName?: string;
      student?: Student;
    }) => {
      setDetailSheetTarget(target);
      setDetailSheetRemark('');
      setShowStudentDetailSheet(true);
    },
    [],
  );

  const handleCloseStudentDetailSheet = useCallback(() => {
    setShowStudentDetailSheet(false);
  }, []);

  const handleTransferStudent = useCallback(
    async (student: Student, targetClassId: string) => {
      if (!selectedClassId) {
        return;
      }
      try {
        await classService.transferStudent(selectedClassId, targetClassId, student.id);
        Taro.showToast({ title: '调班成功', icon: 'success' });
        setClassStudents((prev) => prev.filter((s) => s.id !== student.id));
        setStudentPackages((prev) => {
          const next = new Map(prev);
          next.delete(student.id);
          return next;
        });
        setShowStudentDetailSheet(false);
      } catch (err) {
        logError('transfer student', err);
        Taro.showToast({ title: '调班失败', icon: 'none' });
      }
    },
    [selectedClassId],
  );

  const handleRemoveStudent = useCallback(
    async (student: Student) => {
      if (!selectedClassId) {
        return;
      }
      const res = await Taro.showModal({
        title: '确认移除',
        content: `确定将 ${student.name} 从班级移除吗？`,
        confirmText: '移除',
        confirmColor: '#ef4444',
      });
      if (!res.confirm) {
        return;
      }
      try {
        await classService.removeStudent(selectedClassId, student.id);
        Taro.showToast({ title: '移除成功', icon: 'success' });
        setClassStudents((prev) => prev.filter((s) => s.id !== student.id));
        setStudentPackages((prev) => {
          const next = new Map(prev);
          next.delete(student.id);
          return next;
        });
        setShowStudentDetailSheet(false);
      } catch (err) {
        logError('remove student', err);
        Taro.showToast({ title: '移除失败', icon: 'none' });
      }
    },
    [selectedClassId],
  );

  const handleTogglePendingStudent = useCallback((studentId: string) => {
    setPendingAddStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAllStudents = useCallback(() => {
    if (allSelectableChecked) {
      setCheckedStudentIds(new Set());
      return;
    }
    setCheckedStudentIds(
      new Set(
        classStudents
          .filter((student) => !leaveStudentIds.has(student.id))
          .map((student) => student.id),
      ),
    );
  }, [allSelectableChecked, classStudents, leaveStudentIds]);

  const handleConfirmAddStudents = useCallback(async () => {
    if (pendingAddStudentIds.size === 0) {
      Taro.showToast({ title: '请选择学员', icon: 'none' });
      return;
    }

    const appendedStudents = addableStudents.filter((student) =>
      pendingAddStudentIds.has(student.id),
    );
    if (appendedStudents.length === 0) {
      Taro.showToast({ title: '暂无可添加学员', icon: 'none' });
      return;
    }

    const packageEntries = await Promise.all(
      appendedStudents.map(async (student) => {
        const pkgs = await packageService.getActiveByStudent(student.id);
        const best = pickBestPackage(pkgs, hoursUsed);
        if (!best) {
          return { studentId: student.id, pkg: null, subject: null };
        }

        const subject = best.subject_id ? await subjectService.getById(best.subject_id) : null;
        return { studentId: student.id, pkg: best, subject };
      }),
    );

    setClassStudents((prev) => [...prev, ...appendedStudents]);
    setCheckedStudentIds((prev) => {
      const next = new Set(prev);
      pendingAddStudentIds.forEach((studentId) => {
        if (!leaveStudentIds.has(studentId)) {
          next.add(studentId);
        }
      });
      return next;
    });
    setStudentPackages((prev) => {
      const next = new Map(prev);
      packageEntries.forEach(({ studentId, pkg }) => {
        if (pkg) {
          next.set(studentId, pkg);
        }
      });
      return next;
    });
    setStudentSubjects((prev) => {
      const next = new Map(prev);
      packageEntries.forEach(({ studentId, pkg, subject }) => {
        if (pkg) {
          next.set(studentId, subject);
        }
      });
      return next;
    });
    setShowAddStudentSheet(false);
    setPendingAddStudentIds(new Set());
    setAddStudentKeyword('');
  }, [addableStudents, hoursUsed, leaveStudentIds, pendingAddStudentIds]);

  // ===== 单人模式提交 =====
  const handleSingleSubmit = useCallback(async () => {
    if (!selectedStudent) {
      Taro.showToast({ title: '请选择学生', icon: 'none' });
      return;
    }
    if (!matchedPackage) {
      Taro.showToast({ title: '没有可用课包', icon: 'none' });
      return;
    }
    if (hoursUsed <= 0) {
      Taro.showToast({ title: '消课课时必须大于0', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const lessonDateValue = lessonDate;

      // 检测跨科目：课包科目与学生其他课包科目不一致
      const isCrossSubject =
        !!matchedPackage.subject_id &&
        !!matchedSubject &&
        studentSubjects.get(selectedStudent.id)?.id !== matchedPackage.subject_id;

      // 真实后端会在创建消课时自动扣减课时，前端不能重复调用扣减接口。
      const createdRecord = await lessonRecordService.create({
        teacher_id: selectedTeachingTeacherId || currentTeacherId,
        operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
        student_id: selectedStudent.id,
        package_id: matchedPackage.id,
        lesson_date: lessonDateValue,
        hours_used: hoursUsed,
        is_cross_subject: isCrossSubject || undefined,
        package_subject: isCrossSubject ? matchedSubject?.name : undefined,
        class_subject: isCrossSubject ? studentSubjects.get(selectedStudent.id)?.name : undefined,
        content: content.trim() || undefined,
        performance: performance > 0 ? `${performance}星` : undefined,
        homework: homework.trim() || undefined,
        homework_images: homeworkImages.length > 0 ? homeworkImages : undefined,
        campus_id: campusId || undefined,
        room: room || undefined,
      });

      // 跨科目消课通知校长
      if (isCrossSubject) {
        // TODO: 联调时替换为真实校长 ID
        await notificationService.send({
          sender_id: profile?.id || '',
          receiver_id: 'principal',
          title: '跨科目消课提醒',
          content: `${selectedStudent.name} 使用「${matchedSubject?.name}」课包消课 ${hoursUsed} 课时（班级科目：${studentSubjects.get(selectedStudent.id)?.name || '通用'}）`,
          related_id: selectedStudent.id,
        });
      }

      const parents = await studentService.getParents(selectedStudent.id);
      for (const binding of parents) {
        await notificationService.send({
          sender_id: profile?.id || '',
          receiver_id: binding.parent_id,
          title: `${selectedStudent.name} 课时已消课`,
          content: `本次消课 ${hoursUsed} 课时，剩余 ${createdRecord.remaining_hours ?? Math.max(matchedPackage.remaining_hours - hoursUsed, 0)} 课时`,
          related_id: selectedStudent.id,
        });
      }

      invalidateStudents(currentUserId);
      // 审计日志（用户口径 2026-08-22）：单人消课属重要日志
      try {
        await auditLogService.record({
          action: 'lesson.record',
          operatorId: currentUserId || profile?.id || '',
          operatorName: profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'lesson_record',
          targetId: createdRecord.id,
          detail: `单人消课：学员「${selectedStudent.name}」消课 ${hoursUsed} 课时（课包「${matchedPackage?.name || matchedPackage.id}」${isCrossSubject ? '，跨科目' : ''}）`,
          meta: {
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            packageId: matchedPackage.id,
            hours: hoursUsed,
            crossSubject: isCrossSubject || false,
          },
        });
      } catch (e) {
        logError('audit lesson.record', e);
      }
      // 预警：扣课时后剩余降到阈值 → 立即提醒一次（去重）
      const alertHit =
        checkThresholdAlert(
          selectedStudent.id,
          createdRecord.remaining_hours ??
            Math.max((matchedPackage.remaining_hours ?? 0) - hoursUsed, 0),
        ) === 'triggered';
      handleSubmitSuccessReturn(alertHit ? '消课成功，课时不足已提醒' : '消课成功');
    } catch (err) {
      logError('submit lesson', err);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedStudent,
    matchedPackage,
    hoursUsed,
    selectedTeachingTeacherId,
    currentTeacherId,
    currentUserId,
    lessonDate,
    content,
    performance,
    homework,
    homeworkImages,
    profile,
    invalidateStudents,
    handleSubmitSuccessReturn,
    matchedSubject,
    studentSubjects,
    campusId,
    room,
  ]);

  // ===== 班级模式：提交点名 =====
  const handleClassSubmit = useCallback(async () => {
    if (!selectedClassId) {
      Taro.showToast({ title: '请选择班级', icon: 'none' });
      return;
    }
    if (classStudents.length === 0 && trialBookings.length === 0) {
      Taro.showToast({ title: '班级内暂无学员', icon: 'none' });
      return;
    }
    if (hoursUsed <= 0) {
      Taro.showToast({ title: '消课课时必须大于0', icon: 'none' });
      return;
    }

    const trialSummary =
      trialBookings.length > 0
        ? `；试听学员签到${presentTrialBookings.length}名，未到${absentTrialBookings.length}名（不扣课时）`
        : '';
    const attendanceSummaryText =
      presentStudents.length > 0
        ? `签到${presentStudents.length}名，请假${leaveStudents.length}名，未到${classAbsentCount}名；签到学员每人消课${hoursUsed}课时${trialSummary}。`
        : `本次无签到学员，将记录请假${leaveStudents.length}名、未到${classAbsentCount}名，不扣减课时${trialSummary}。`;

    const confirmResult = await Taro.showModal({
      title: '确认消课',
      content: `确认提交“${selectedClass?.name || '该班级'}”点名结果？\n${attendanceSummaryText}`,
      confirmText: '确认消课',
      confirmColor: '#2563eb',
    });

    if (!confirmResult.confirm) {
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    const failList: { name: string; reason: string }[] = [];

    try {
      const lessonDateValue = lessonDate;
      const existingRecords = await loadLessonRecordsByDate();
      const trialStudentIds = new Set(trialBookings.map((b) => b.trial_student_id));
      const existingClassRecords = existingRecords.filter(
        (record) =>
          record.class_id === selectedClassId &&
          record.lesson_date === lessonDateValue &&
          (classStudents.some((student) => student.id === record.student_id) ||
            trialStudentIds.has(record.student_id)),
      );

      // 点名页按当前表单结果重算整节课出勤，先清理本节课已存在的占位或签到记录，避免重复提交冲突。
      await Promise.all(
        existingClassRecords
          .filter((record) =>
            ['normal', 'makeup', 'leave', 'absent'].includes(record.status || 'normal'),
          )
          .map((record) => lessonRecordService.remove(record.id)),
      );

      for (const student of presentStudents) {
        const pkg = studentPackages.get(student.id);
        if (!pkg) {
          failList.push({ name: student.name, reason: '无可用课包' });
          continue;
        }

        try {
          // 检测跨科目：课包科目与学生其他课包科目不一致
          const studentSubject = studentSubjects.get(student.id);
          const isCrossSubject =
            !!pkg.subject_id && !!studentSubject && pkg.subject_id !== studentSubject.id;

          const createdRecord = await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: student.id,
            package_id: pkg.id,
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: hoursUsed,
            is_cross_subject: isCrossSubject || undefined,
            package_subject: isCrossSubject ? pkg.name : undefined,
            class_subject: isCrossSubject ? studentSubject?.name : undefined,
            content: content.trim() || undefined,
            performance: performance > 0 ? `${performance}星` : undefined,
            homework: homework.trim() || undefined,
            homework_images: homeworkImages.length > 0 ? homeworkImages : undefined,
            campus_id: campusId || undefined,
            room: room || undefined,
          });

          if (isCrossSubject) {
            await notificationService.send({
              sender_id: profile?.id || '',
              receiver_id: 'principal',
              title: '跨科目消课提醒',
              content: `${student.name} 使用「${pkg.name}」课包消课 ${hoursUsed} 课时（班级科目：${studentSubject?.name || '通用'}）`,
              related_id: student.id,
            });
          }

          const parents = await studentService.getParents(student.id);
          for (const binding of parents) {
            await notificationService.send({
              sender_id: profile?.id || '',
              receiver_id: binding.parent_id,
              title: `${student.name} 课时已核销`,
              content: `本次核销 ${hoursUsed} 课时，剩余 ${createdRecord.remaining_hours ?? Math.max(pkg.remaining_hours - hoursUsed, 0)} 课时`,
              related_id: student.id,
            });
          }

          successCount += 1;
        } catch (err) {
          logError('classSubmit single student', err);
          failList.push({ name: student.name, reason: '消课失败' });
        }
      }

      for (const student of leaveStudents) {
        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: student.id,
            package_id: '',
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: 0,
            status: 'leave',
            content: '家长已请假，本节课自动记为请假',
            campus_id: campusId || undefined,
            room: room || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit leave student', err);
          failList.push({ name: student.name, reason: '请假记录失败' });
        }
      }

      for (const student of absentStudents) {
        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: student.id,
            package_id: '',
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: 0,
            status: 'absent',
            content: '点名未到，待老师后续补录签到',
            campus_id: campusId || undefined,
            room: room || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit absent student', err);
          failList.push({ name: student.name, reason: '未到记录失败' });
        }
      }

      // 试听学员：签到不扣课时，请假/未到也记录考勤
      for (const booking of presentTrialBookings) {
        const lead = trialLeadMap[booking.lead_id];
        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: booking.trial_student_id,
            package_id: '',
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: 0,
            status: 'normal',
            content: `试听签到${booking.note ? `（${booking.note}）` : ''}`,
            campus_id: campusId || undefined,
            room: room || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit trial present', err);
          failList.push({ name: lead?.child_name || '试听学员', reason: '试听签到记录失败' });
        }
      }

      for (const booking of leaveTrialBookings) {
        const lead = trialLeadMap[booking.lead_id];
        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: booking.trial_student_id,
            package_id: '',
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: 0,
            status: 'leave',
            content: '试听学员请假',
            campus_id: campusId || undefined,
            room: room || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit trial leave', err);
          failList.push({ name: lead?.child_name || '试听学员', reason: '试听请假记录失败' });
        }
      }

      for (const booking of absentTrialBookings) {
        const lead = trialLeadMap[booking.lead_id];
        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: booking.trial_student_id,
            package_id: '',
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: 0,
            status: 'absent',
            content: '试听预约未到',
            campus_id: campusId || undefined,
            room: room || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit trial absent', err);
          failList.push({ name: lead?.child_name || '试听学员', reason: '试听未到记录失败' });
        }
      }

      if (failList.length === 0) {
        invalidateStudents(currentUserId);
        handleSubmitSuccessReturn(
          `签到${presentStudents.length + presentTrialBookings.length}人（含试听${presentTrialBookings.length}人），请假${leaveStudents.length}人，未到${classAbsentCount + absentTrialBookings.length}人`,
        );
      } else if (successCount === 0) {
        Taro.showToast({ title: '全部消课失败', icon: 'none' });
      } else {
        invalidateStudents(currentUserId);
        handleSubmitSuccessReturn(
          `${successCount}条记录成功，${failList.length}条失败`,
          'none',
          3000,
        );
      }
    } catch (err) {
      logError('class submit', err);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    content,
    currentTeacherId,
    currentUserId,
    homework,
    homeworkImages,
    hoursUsed,
    invalidateStudents,
    handleSubmitSuccessReturn,
    lessonDate,
    loadLessonRecordsByDate,
    leaveStudents,
    absentStudents,
    performance,
    classStudents,
    presentStudents,
    profile?.id,
    selectedAssistantTeacherId,
    selectedClass?.name,
    selectedClassId,
    selectedTeachingTeacherId,
    classAbsentCount,
    studentPackages,
    studentSubjects,
    trialBookings,
    presentTrialBookings,
    leaveTrialBookings,
    absentTrialBookings,
    trialLeadMap,
    campusId,
    room,
  ]);

  // ===== 统一提交 =====
  const handleSubmit = useCallback(() => {
    if (isEditEntryAttempt) {
      Taro.showToast({ title: '历史消课记录不支持编辑', icon: 'none' });
      return;
    }

    if (mode === 'single') {
      handleSingleSubmit();
    } else {
      handleClassSubmit();
    }
  }, [handleClassSubmit, handleSingleSubmit, isEditEntryAttempt, mode]);

  // ===== 提交按钮文案 =====
  const submitText = useMemo(() => {
    if (mode === 'single') {
      if (!selectedStudent || !matchedPackage) return '确认消课';
      const isOwe = matchedPackage.remaining_hours < hoursUsed;
      return isOwe ? `确认消课（欠课${hoursUsed}课时）` : `确认消课 ${hoursUsed}课时`;
    }
    const totalPresent = presentStudents.length + presentTrialBookings.length;
    if (totalPresent === 0) return '确认消课';
    return `确认消课 ${totalPresent}人×${hoursUsed}课时`;
  }, [
    matchedPackage,
    mode,
    presentStudents.length,
    presentTrialBookings.length,
    selectedStudent,
    hoursUsed,
  ]);

  // ===== 班级学员签到状态映射（给卡片用） =====
  const studentCheckinStatusMap = useMemo(() => {
    const map: Record<string, CheckinStatus> = {};
    classStudents.forEach((stu) => {
      if (leaveStudentIds.has(stu.id)) {
        map[stu.id] = 'leave';
      } else if (checkedStudentIds.has(stu.id)) {
        map[stu.id] = 'checked';
      } else {
        map[stu.id] = 'absent';
      }
    });
    return map;
  }, [classStudents, checkedStudentIds, leaveStudentIds]);

  /** 过滤后的正式学员列表（搜索+考勤筛选） */
  const filteredClassStudents = useMemo(() => {
    let result = classStudents;
    const keyword = studentSearchKeyword.trim().toLowerCase();
    if (keyword) {
      result = result.filter((stu) => stu.name.toLowerCase().includes(keyword));
    }
    if (attendanceFilter !== 'all') {
      result = result.filter((stu) => {
        const status = studentCheckinStatusMap[stu.id] || 'absent';
        return attendanceFilter === 'absent'
          ? status === 'absent' || status === 'leave'
          : status === attendanceFilter;
      });
    }
    return result;
  }, [attendanceFilter, classStudents, studentCheckinStatusMap, studentSearchKeyword]);

  /** 过滤后的试听学员列表（搜索+考勤筛选） */
  const filteredTrialBookings = useMemo(() => {
    let result = trialBookings;
    const keyword = studentSearchKeyword.trim().toLowerCase();
    if (keyword) {
      result = result.filter((booking) => {
        const lead = trialLeadMap[booking.lead_id];
        return (lead?.child_name || '').toLowerCase().includes(keyword);
      });
    }
    if (attendanceFilter !== 'all') {
      result = result.filter((booking) => {
        const status = trialCheckinMap[booking.id] || 'absent';
        return attendanceFilter === 'absent'
          ? status === 'absent' || status === 'leave'
          : status === attendanceFilter;
      });
    }
    return result;
  }, [attendanceFilter, trialBookings, trialLeadMap, studentSearchKeyword, trialCheckinMap]);

  /** 合并学员列表：试听优先 */
  const mergedStudentList = useMemo(() => {
    const trials = filteredTrialBookings.map((booking) => ({
      type: 'trial' as const,
      id: booking.id,
      booking,
      name: trialLeadMap[booking.lead_id]?.child_name || '未知学员',
    }));
    const formals = filteredClassStudents.map((student) => ({
      type: 'formal' as const,
      id: student.id,
      student,
    }));
    return [...trials, ...formals];
  }, [filteredClassStudents, filteredTrialBookings, trialLeadMap]);

  /** 试听课剩余/扣课显示 */
  const getTrialCardInfo = useCallback(() => {
    return { remaining: '试听', deduct: '0课时' };
  }, []);

  /** 学员扣课/剩余/课程显示 */
  const getStudentCardInfo = useCallback(
    (student: Student) => {
      const pkg = studentPackages.get(student.id);
      if (!pkg) {
        return { courseName: '无课包', remaining: '无课包', deduct: '0课时' };
      }
      const remainingText =
        pkg.expiry_date && !pkg.remaining_hours
          ? `${Math.max(0, Math.ceil((new Date(pkg.expiry_date).getTime() - Date.now()) / 86400000))}天`
          : `${pkg.remaining_hours}课时`;
      const subject = studentSubjects.get(student.id);
      return {
        courseName: subject?.name || pkg.name || '未命名课程',
        remaining: remainingText,
        deduct: `${hoursUsed}课时`,
      };
    },
    [hoursUsed, studentPackages, studentSubjects],
  );

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-background pb-28">
        {/* 白色导航栏 */}
        <View className="border-b border-black/5 bg-white px-4">
          <View className="flex items-end pb-[6rpx]" style={{ height: `${navSafeHeight}px` }}>
            <View className="flex min-w-0 flex-1 items-center gap-[8rpx]">
              <View
                className="flex h-[56rpx] w-[56rpx] items-center justify-center"
                onClick={handleBack}
              >
                <Icon name="mdi-chevron-left" size="md" color="foreground" />
              </View>
              <Text className="flex-1 truncate text-[30rpx] font-semibold text-foreground">
                {mode === 'class' ? selectedClass?.name || pageTitle : pageTitle}
              </Text>
            </View>
          </View>
        </View>

        {/* 模式切换 Tab - 白色背景+底部指示器 */}
        {shouldShowModeTabs ? (
          <View className="bg-white shadow-sm">
            <View className="flex">
              <View
                className="flex-1 flex items-center justify-center py-3_d5 relative"
                onClick={() => setMode('single')}
              >
                <Text
                  className={`text-base font-medium ${mode === 'single' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  学员消课
                </Text>
                {mode === 'single' && (
                  <View className="absolute bottom-0 left-0 right-0 h-0_d5 bg-primary" />
                )}
              </View>
              <View
                className="flex-1 flex items-center justify-center py-3_d5 relative"
                onClick={() => setMode('class')}
              >
                <Text
                  className={`text-base font-medium ${mode === 'class' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  班级消课
                </Text>
                {mode === 'class' && (
                  <View className="absolute bottom-0 left-0 right-0 h-0_d5 bg-primary" />
                )}
              </View>
            </View>
          </View>
        ) : null}

        {/* ====== 单人模式 ====== */}
        {mode === 'single' && (
          <>
            {/* 选择学员 */}
            <View className="mx-[24rpx] mt-6 mb-6">
              <View className="flex items-center gap-1 mb-3">
                <Text className="text-lg text-foreground">选择学员</Text>
                <Text className="text-lg text-destructive">*</Text>
              </View>

              {selectedStudent ? (
                <>
                  <StudentCard
                    name={selectedStudent.name}
                    nickname={selectedStudent.nickname}
                    avatarUrl={selectedStudent.avatar_url}
                    matchedPackage={matchedPackage}
                    subject={matchedSubject}
                    hoursNeeded={hoursUsed}
                    onChange={() => setShowStudentPicker(true)}
                  />
                  {/* 跨科目提示 */}
                  {matchedPackage?.subject_id &&
                    matchedSubject &&
                    studentSubjects.get(selectedStudent.id)?.id !== matchedPackage.subject_id && (
                      <View className="mt-2 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30">
                        <Text className="text-[26rpx] text-warning">
                          该课包科目与班级不一致，消课将标记为跨科目
                        </Text>
                      </View>
                    )}
                </>
              ) : (
                <View
                  className="btn-secondary border-2 border-dashed border-primary/40 gap-2 bg-primary/5 py-3"
                  onClick={handleOpenStudentPicker}
                >
                  <Text className="text-2xl text-primary font-bold">+</Text>
                  <Text className="text-base text-primary">点击选择学员</Text>
                </View>
              )}
            </View>

            {/* 消课信息（选学员后显示） */}
            {selectedStudent && (
              <>
                {/* 主讲老师 */}
                <View className="mx-[24rpx] mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <View className="flex items-center gap-1 mb-3">
                    <Text className="text-lg text-foreground">主讲老师</Text>
                    <Text className="text-lg text-destructive">*</Text>
                  </View>
                  <View
                    className="border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden press-scale"
                    onClick={() => setSelector({ visible: true, type: 'teacher' })}
                  >
                    <View className="flex-1 min-w-0">
                      <Text className="text-lg text-foreground truncate block">
                        {selectedTeachingTeacher?.name || profile?.name || '请选择主讲老师'}
                      </Text>
                      <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] block truncate">
                        默认当前操作人，可改为其他老师
                      </Text>
                    </View>
                    <Icon name="mdi-chevron-right" size="sm" color="muted" />
                  </View>
                </View>

                {/* 消课课时 */}
                <View className="mx-[24rpx] mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <View className="flex items-center gap-1 mb-3">
                    <Text className="text-lg text-foreground">消课课时</Text>
                    <Text className="text-lg text-destructive">*</Text>
                  </View>
                  <Stepper value={hoursUsed} min={0.5} step={0.5} onChange={setHoursUsed} />
                </View>

                {/* 上课时间 */}
                <View className="mx-[24rpx] mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <Text className="text-lg text-foreground">上课时间</Text>
                  <View className="flex gap-5 mt-3">
                    <Picker
                      mode="date"
                      value={lessonDate}
                      onChange={(e) => setLessonDate(e.detail.value || lessonDate)}
                    >
                      <View className="flex-1 border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden">
                        <Text className="text-lg text-foreground">{lessonDate}</Text>
                        <Icon name="mdi-calendar" size="sm" color="muted" />
                      </View>
                    </Picker>
                    <Picker
                      mode="time"
                      value={lessonTime}
                      onChange={(e) => setLessonTime(e.detail.value || lessonTime)}
                    >
                      <View className="flex-1 border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden">
                        <Text className="text-lg text-foreground">{lessonTime}</Text>
                        <Icon name="mdi-clock-outline" size="sm" color="muted" />
                      </View>
                    </Picker>
                  </View>
                </View>

                {/* 上课地点 */}
                <View className="mx-[24rpx] mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <Text className="text-lg text-foreground">上课地点</Text>
                  <View className="flex flex-col gap-5 mt-3">
                    <View
                      className="flex-1 border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden press-scale"
                      onClick={() => setSelector({ visible: true, type: 'campus' })}
                    >
                      <Text className="text-lg text-foreground">
                        {campusOptions.find((item) => item.id === campusId)?.name || '请选择校区'}
                      </Text>
                      <Icon name="mdi-chevron-right" size="sm" color="muted" />
                    </View>
                    <View
                      className="flex-1 border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden press-scale"
                      onClick={() => setSelector({ visible: true, type: 'room' })}
                    >
                      <Text className="text-lg text-foreground">{room || '请选择教室'}</Text>
                      <Icon name="mdi-chevron-right" size="sm" color="muted" />
                    </View>
                  </View>
                </View>

                {/* 教学内容 */}
                <View className="mx-[24rpx] mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <Text className="text-lg text-foreground">教学内容</Text>
                  <Textarea
                    className="w-full mt-3 p-4 bg-background rounded-2xl text-base text-foreground min-h-[120rpx]"
                    placeholder="选填"
                    value={content}
                    onInput={(e) => setContent(e.detail.value || '')}
                  />
                </View>

                {/* 学生表现 */}
                <View className="mx-[24rpx] mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <Text className="text-lg text-foreground">学生表现</Text>
                  <View className="mt-3">
                    <StarRating value={performance} onChange={setPerformance} />
                  </View>
                </View>

                {/* 课后作业 */}
                <View className="mx-[24rpx] mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <Text className="text-lg text-foreground">课后作业</Text>
                  <Textarea
                    className="w-full mt-3 p-4 bg-background rounded-2xl text-base text-foreground min-h-[120rpx]"
                    placeholder="选填"
                    value={homework}
                    onInput={(e) => setHomework(e.detail.value || '')}
                  />
                  {/* 图片上传 */}
                  <View className="flex flex-wrap gap-3 mt-3">
                    {homeworkImages.map((img, idx) => (
                      <View key={idx} className="relative w-[160rpx] h-[160rpx]">
                        <Image
                          src={img}
                          mode="aspectFill"
                          className="w-[160rpx] h-[160rpx] rounded-xl"
                        />
                        <View
                          className="absolute -top-2 -right-2 w-[40rpx] h-[40rpx] rounded-full bg-destructive flex items-center justify-center"
                          onClick={() => handleRemoveImage(idx)}
                        >
                          <Text className="text-white text-xs">×</Text>
                        </View>
                      </View>
                    ))}
                    {homeworkImages.length < 3 && (
                      <View
                        className={`w-[160rpx] h-[160rpx] rounded-xl border-2 border-dashed border-input flex items-center justify-center bg-background ${uploading ? 'state-loading' : 'press-scale'}`}
                        onClick={uploading ? undefined : handleUploadImage}
                      >
                        <Text className="text-2xl text-muted-foreground">
                          {uploading ? '...' : '+'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {/* ====== 班级模式 ====== */}
        {mode === 'class' && (
          <>
            {/* 头部信息卡片：时间段/日期/老师/编辑 */}
            {selectedClassId ? (
              <View className="mx-[24rpx] mt-3 rounded-[20rpx] bg-white px-[28rpx] py-[24rpx] shadow-soft">
                <View className="flex items-start justify-between gap-[20rpx]">
                  <View className="flex-1">
                    <Text className="block text-[44rpx] font-bold leading-[56rpx] text-foreground">
                      {lessonTimeRange}
                    </Text>
                    <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
                      {lessonDate}（{getWeekday(lessonDate)}）
                    </Text>
                    <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
                      老师：{selectedTeachingTeacher?.name || profile?.name || '-'}
                    </Text>
                    <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
                      上课内容：{content || '-'}
                    </Text>
                    <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
                      备注：{homework || '-'}
                    </Text>
                  </View>
                  <View
                    className="flex items-center justify-center rounded-[12rpx] bg-[#FF7E67] px-[28rpx] py-[12rpx]"
                    onClick={() => {
                      if (!scheduleIdParam) {
                        Taro.showToast({ title: '缺少课节信息', icon: 'none' });
                        return;
                      }
                      const [startTime = '', endTime = ''] = lessonTimeRange.split('-');
                      Taro.navigateTo({
                        url:
                          `/package-course/pages/lesson-edit/index?scheduleId=${encodeURIComponent(scheduleIdParam)}` +
                          `&classId=${encodeURIComponent(selectedClassId)}` +
                          `&className=${encodeURIComponent(selectedClass?.name || '')}` +
                          `&lessonDate=${encodeURIComponent(lessonDate)}` +
                          `&startTime=${encodeURIComponent(startTime)}` +
                          `&endTime=${encodeURIComponent(endTime)}` +
                          `&leadTeacherId=${encodeURIComponent(selectedTeachingTeacherId)}` +
                          `&assistantTeacherId=${encodeURIComponent(selectedAssistantTeacherId || '')}` +
                          `&room=${encodeURIComponent('')}` +
                          `&content=${encodeURIComponent(content)}` +
                          `&homework=${encodeURIComponent(homework)}`,
                      });
                    }}
                  >
                    <Text className="text-[24rpx] font-medium leading-none text-white">编辑</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View className="pt-3">
              {/* 班级选择（非直接进入时显示） */}
              {!isClassDirectEntry ? (
                <View className={FORM_CARD_CLASS_NAME}>
                  <View className="border-b border-black/5 px-4 py-3">
                    <View className="mb-[6rpx] flex items-center gap-1">
                      <Text className="text-[24rpx] text-foreground">班级</Text>
                      <Text className="text-[24rpx] text-destructive">*</Text>
                    </View>
                    <ClassSelector
                      classes={classes}
                      selectedClassId={selectedClassId}
                      onSelect={handleSelectClass}
                    />
                  </View>
                </View>
              ) : null}

              {selectedClassId ? (
                <>
                  {/* 搜索框 */}
                  <View className={FORM_CARD_CLASS_NAME}>
                    <View className="flex items-center gap-[16rpx] px-4 py-3">
                      <Icon name="mdi-magnify" size="sm" color="muted" />
                      <Input
                        className="flex-1 text-[26rpx] text-foreground"
                        value={studentSearchKeyword}
                        onInput={(e) => setStudentSearchKeyword(e.detail.value || '')}
                        placeholder="请输入学员姓名"
                        placeholderClass="text-muted-foreground"
                      />
                    </View>
                  </View>

                  {/* 消耗课时 */}
                  <View className={FORM_CARD_CLASS_NAME}>
                    <View className="flex items-center justify-between px-4 py-3">
                      <Text className="text-[28rpx] text-foreground">消耗课时</Text>
                      <Stepper value={hoursUsed} min={0.5} step={0.5} onChange={setHoursUsed} />
                    </View>
                  </View>

                  {/* 授课扣费 */}
                  <View className={FORM_CARD_CLASS_NAME}>
                    <View className="flex items-center justify-between px-4 py-3">
                      <Text className="text-[28rpx] text-foreground">授课扣费</Text>
                      <View className="flex items-center gap-[8rpx]">
                        <Input
                          className="w-[160rpx] rounded-xl bg-background px-4 py-2 text-right text-[28rpx] text-foreground"
                          type="digit"
                          value={feeAmount}
                          onInput={(e) => setFeeAmount(e.detail.value || '0')}
                          placeholder="0"
                          placeholderClass="text-muted-foreground"
                        />
                        <Text className="text-[26rpx] text-muted-foreground">元</Text>
                      </View>
                    </View>
                  </View>

                  {/* 考勤状态筛选 */}
                  <View className={FORM_CARD_CLASS_NAME}>
                    <View
                      className="flex items-center justify-between px-4 py-3"
                      onClick={() =>
                        Taro.showActionSheet({
                          itemList: ['全部', '签到', '请假', '未到'],
                          success: (res) => {
                            const map: Array<'all' | CheckinStatus> = [
                              'all',
                              'checked',
                              'leave',
                              'absent',
                            ];
                            setAttendanceFilter(map[res.tapIndex] || 'all');
                          },
                        })
                      }
                    >
                      <Text className="text-[28rpx] text-foreground">考勤状态</Text>
                      <View className="flex items-center gap-[8rpx]">
                        <Text className="text-[26rpx] text-muted-foreground">
                          {attendanceFilter === 'all'
                            ? '全部'
                            : CHECKIN_OPTION_STYLES[attendanceFilter].label}
                        </Text>
                        <Icon name="mdi-chevron-right" size="sm" color="muted" />
                      </View>
                    </View>
                  </View>

                  {/* 统计信息 */}
                  <View className="mx-[24rpx] mb-3">
                    <Text className="text-[24rpx] text-muted-foreground">
                      学员已选
                      <Text className="text-destructive">
                        {classCheckedCount + classLeaveCount + classAbsentCount}
                      </Text>
                      ，签到
                      <Text className="text-destructive">{classCheckedCount}</Text>
                      ，请假
                      <Text className="text-destructive">{classLeaveCount}</Text>
                      ，未到
                      <Text className="text-destructive">{classAbsentCount}</Text>
                    </Text>
                  </View>

                  {/* 学员列表 - 试听优先 */}
                  <View className="mx-[24rpx] mb-3">
                    <View className="mb-[16rpx] flex items-center justify-between">
                      <Text className="text-[26rpx] font-medium text-foreground">学员列表</Text>
                      <View
                        className="flex items-center justify-center rounded-[12rpx] bg-muted px-[16rpx] py-[8rpx]"
                        onClick={handleOpenAddStudentSheet}
                      >
                        <Text className="text-[22rpx] font-medium leading-none text-muted-foreground">
                          添加学员
                        </Text>
                      </View>
                    </View>
                    <View className="grid grid-cols-2 gap-[16rpx]">
                      {mergedStudentList.map((item) => {
                        if (item.type === 'trial') {
                          const booking = item.booking;
                          const status = trialCheckinMap[booking.id] || 'absent';
                          const info = getTrialCardInfo();
                          return (
                            <CheckinCard
                              key={booking.id}
                              name={item.name}
                              status={status}
                              remaining={info.remaining}
                              deduct={info.deduct}
                              isTrial
                              onToggleStatus={(next) => handleSetTrialCheckin(booking.id, next)}
                              onOpenDetailSheet={() =>
                                handleOpenStudentDetailSheet({
                                  type: 'trial',
                                  id: booking.id,
                                  name: item.name,
                                  remaining: info.remaining,
                                  deduct: info.deduct,
                                  courseName: '试听',
                                })
                              }
                            />
                          );
                        }
                        const stu = item.student;
                        const status = studentCheckinStatusMap[stu.id] || 'absent';
                        const info = getStudentCardInfo(stu);
                        return (
                          <CheckinCard
                            key={stu.id}
                            name={stu.name}
                            status={status}
                            remaining={info.remaining}
                            deduct={info.deduct}
                            onToggleStatus={(next) => handleSetStudentCheckin(stu.id, next)}
                            onOpenDetailSheet={() =>
                              handleOpenStudentDetailSheet({
                                type: 'formal',
                                id: stu.id,
                                name: stu.name,
                                remaining: info.remaining,
                                deduct: info.deduct,
                                courseName: info.courseName,
                                student: stu,
                              })
                            }
                          />
                        );
                      })}
                    </View>
                    {mergedStudentList.length === 0 ? (
                      <View className="rounded-[20rpx] bg-white px-[24rpx] py-[32rpx] shadow-soft">
                        <Text className="text-center text-[24rpx] text-muted-foreground">
                          暂无匹配学员
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          </>
        )}

        {/* ====== 学员选择弹窗 ====== */}
        <BottomSheet
          show={showStudentPicker}
          visible={showStudentPicker}
          title="选择学员"
          onClose={() => setShowStudentPicker(false)}
        >
          <View className="p-5">
            {/* 搜索框 */}
            <View className="flex items-center gap-3 mb-3 px-3 py-2 bg-muted rounded-xl">
              <Icon name="mdi-magnify" size="sm" color="muted" />
              <Input
                className="flex-1 text-sm text-foreground bg-transparent"
                placeholder="搜索学员姓名或手机号"
                placeholderClass="text-muted-foreground"
              />
            </View>

            {/* 学员列表 */}
            <View className="flex flex-col gap-1">
              {allStudents.map((stu) => (
                <PickerItem
                  key={stu.id}
                  iconType="avatar"
                  avatarBgColor="#5EC8A8"
                  avatarUrl={stu.avatar_url}
                  avatarChar={stu.name[0]}
                  title={stu.name}
                  subtitle={stu.phone || ''}
                  selected={selectedStudent?.id === stu.id}
                  right={{
                    type: 'check-icon',
                    checked: selectedStudent?.id === stu.id,
                  }}
                  onClick={() => handleSelectStudent(stu)}
                />
              ))}
            </View>
          </View>
        </BottomSheet>

        <BottomSheet
          visible={showAddStudentSheet}
          title="添加学员到点名名单"
          maxHeight="78vh"
          scrollable={false}
          onClose={() => {
            setShowAddStudentSheet(false);
            setAddStudentKeyword('');
            setPendingAddStudentIds(new Set());
          }}
        >
          <View className="flex flex-col bg-white" style={{ height: 'calc(78vh - 120rpx)' }}>
            <View className="border-b border-border/70 px-[32rpx] pb-[20rpx] pt-[8rpx]">
              <View className="flex items-center gap-[16rpx] rounded-[22rpx] bg-muted px-[24rpx] py-[18rpx]">
                <Icon name="mdi-magnify" size="sm" color="#94a3b8" />
                <Input
                  className="flex-1 text-[26rpx] text-foreground"
                  value={addStudentKeyword}
                  onInput={(event) => setAddStudentKeyword(event.detail.value)}
                  placeholder="搜索学员姓名 / 昵称 / 手机号"
                  placeholderClass="input-placeholder"
                  confirmType="search"
                />
              </View>
            </View>

            <ScrollView scrollY className="min-h-0 flex-1 bg-white px-[32rpx] py-[24rpx]">
              <View className="flex flex-col gap-[16rpx] pb-[12rpx]">
                {filteredAddableStudents.map((student) => {
                  const checked = pendingAddStudentIds.has(student.id);
                  const pkg = studentPackages.get(student.id) || null;
                  const subject = studentSubjects.get(student.id);
                  const isOwe = pkg && pkg.remaining_hours < hoursUsed;
                  const noPackage = !pkg;
                  const isTrialStudent =
                    hasTrialPackage(student.course_packages) || hasTrialPackage(pkg ? [pkg] : []);
                  const subtitle = noPackage
                    ? '无可用课包'
                    : isOwe
                      ? `欠课 · ${subject ? subject.name : pkg.name}仅剩${pkg.remaining_hours}课时`
                      : `${subject ? subject.name : pkg.name} · ${pkg.remaining_hours}课时`;

                  return (
                    <PickerItem
                      key={student.id}
                      iconType="avatar"
                      avatarBgColor={noPackage ? '#D9404020' : isOwe ? '#E8C46820' : '#5EC8A820'}
                      avatarUrl={student.avatar_url}
                      avatarChar={student.name[0]}
                      title={student.name}
                      titleExtra={
                        isTrialStudent ? (
                          <View className="rounded-[8rpx] bg-error/10 px-[12rpx] py-[4rpx]">
                            <Text className="text-center text-[20rpx] font-medium text-error">
                              试听
                            </Text>
                          </View>
                        ) : undefined
                      }
                      subtitle={subtitle}
                      selected={checked}
                      right={{
                        type: 'checkbox',
                        checked,
                        onCheckChange: () => handleTogglePendingStudent(student.id),
                      }}
                      onClick={() => handleTogglePendingStudent(student.id)}
                    />
                  );
                })}

                {filteredAddableStudents.length === 0 ? (
                  <View className="rounded-[20rpx] bg-muted px-[24rpx] py-[24rpx]">
                    <Text className="text-[24rpx] text-muted-foreground">
                      {addStudentKeyword.trim() ? '没有找到匹配的学员。' : '当前没有可添加的学员。'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <View className="border-t border-border bg-white px-[32rpx] pb-[32rpx] pt-[20rpx]">
              <View
                className={`rounded-[48rpx] py-[24rpx] text-center ${
                  pendingAddStudentIds.size > 0 ? 'bg-primary' : 'bg-border'
                }`}
                onClick={
                  pendingAddStudentIds.size > 0 ? () => void handleConfirmAddStudents() : undefined
                }
              >
                <Text className="text-[28rpx] font-semibold text-white">
                  确认添加 {pendingAddStudentIds.size} 人
                </Text>
              </View>
            </View>
          </View>
        </BottomSheet>

        {/* ====== 学员编辑弹窗 ====== */}
        <StudentEditSheet
          visible={showStudentDetailSheet}
          target={detailSheetTarget}
          remark={detailSheetRemark}
          classes={classes}
          selectedClassId={selectedClassId}
          onRemarkChange={setDetailSheetRemark}
          onClose={handleCloseStudentDetailSheet}
          onTransfer={handleTransferStudent}
          onRemove={handleRemoveStudent}
          onConfirm={() => {
            if (detailSheetTarget) {
              // 备注可保存到对应学员的考勤记录中（后续对接 API）
              Taro.showToast({ title: '备注已保存', icon: 'success' });
            }
          }}
        />

        {/* ====== 底部操作栏 ====== */}
        {mode === 'class' ? (
          <View className="fixed bottom-0 left-0 right-0 z-100 border-t border-border bg-white px-[32rpx] pt-[20rpx] pb-safe-bar">
            <View className="flex items-center justify-between gap-[24rpx]">
              <View
                className="flex items-center gap-[12rpx]"
                onClick={handleToggleSelectAllStudents}
              >
                <View
                  className={`flex h-[36rpx] w-[36rpx] items-center justify-center rounded-full border-2 ${allSelectableChecked ? 'border-primary bg-primary' : 'border-muted-foreground bg-white'}`}
                >
                  {allSelectableChecked ? <Icon name="mdi-check" size="xs" color="white" /> : null}
                </View>
                <Text className="text-[26rpx] text-foreground">全选签到</Text>
              </View>
              <View
                className={`rounded-[48rpx] px-[48rpx] py-[22rpx] ${submitting || !selectedClassId ? 'bg-muted' : 'bg-[#FF7E67]'}`}
                onClick={submitting || !selectedClassId ? undefined : handleSubmit}
              >
                <Text className="text-center text-[28rpx] font-medium text-white">
                  {submitting ? '提交中...' : '提交点名'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <ActionButton
            text={submitText}
            disabled={submitting || !selectedStudent}
            onClick={handleSubmit}
          />
        )}
      </View>

      {/* 统一弹窗选择器（PickerSheet 标准组件） */}
      <PickerSheet
        visible={selector.visible}
        title={
          selector.type === 'teacher'
            ? '选择主讲老师'
            : selector.type === 'campus'
              ? '选择校区'
              : '选择教室'
        }
        options={
          selector.type === 'teacher'
            ? teacherOptions.map((t): PickerOption => ({ label: t.name, value: t.id }))
            : selector.type === 'campus'
              ? [
                  { label: '请选择', value: '' },
                  ...campusOptions.map((c): PickerOption => ({ label: c.name, value: c.id })),
                ]
              : [
                  { label: '请选择', value: '' },
                  ...rooms
                    .filter((r) => r.status === 'active')
                    .map((r): PickerOption => ({ label: r.name, value: r.name })),
                ]
        }
        value={
          selector.type === 'teacher'
            ? selectedTeachingTeacherId
            : selector.type === 'campus'
              ? campusId
              : room
        }
        onClose={() => setSelector((prev) => ({ ...prev, visible: false }))}
        onConfirm={(v) => {
          if (selector.type === 'teacher') setSelectedTeachingTeacherId(v);
          else if (selector.type === 'campus') {
            setCampusId(v);
            setRoom('');
          } else setRoom(v);
          setSelector((prev) => ({ ...prev, visible: false }));
        }}
      />
    </PageContainer>
  );
};

export default withRouteGuard(LessonForm);
