/**
 * 新增 / 编辑课程表单页
 *
 * 用于创建或编辑课程模板，支持基础信息和高级设置。
 * 所有字段采用左标签右输入/值的行内布局。
 */
import { ScrollView, View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import FormRow from '@/components/FormRow';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import StudentMultiSelectSheet from '@/components/StudentMultiSelectSheet';
import {
  AGE_GROUP_OPTIONS,
  CHECKIN_ROLE_OPTIONS,
  COURSE_COLOR_OPTIONS,
  DEADLINE_OPTIONS,
  STUDENT_SELF_CHECKIN_OPTIONS,
} from '@/data/course-template';
import { subjectService } from '@/services/campus';
import { courseTemplateService } from '@/services/course-template';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useCourseTemplateStore } from '@/stores/course-template';
import { useStudentStore } from '@/stores/student';
import { useTeacherStore } from '@/stores/teacher';
import type { Subject } from '@/types/campus';
import { CLASS_LEVEL_LABELS } from '@/types/class';
import type { CourseCategoryConfig } from '@/types/course-category';
import type {
  CheckinRole,
  CourseCategory,
  CourseTemplate,
  CourseTemplateFormData,
} from '@/types/course-template';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { chooseImageTemp } from '@/utils/image-upload';

/** 表单字段错误 */
interface FormErrors {
  name?: string;
  categoryId?: string;
  duration?: string;
  capacity?: string;
  experiencePrice?: string;
  price?: string;
}

type PickerType =
  | 'category'
  | 'subject'
  | 'teacher'
  | 'assistant'
  | 'ageGroup'
  | 'deadline'
  | 'cancelQueue'
  | 'nonCancel'
  | 'selfCheckin'
  | 'level'
  | 'autoCheckin';

/** Tooltip 提示文案 */
const TOOLTIPS: Record<string, string> = {
  price:
    '该课程的单次约课收费价格，用于非会员通过小程序按次付费场景，该价格也是次卡、储值卡计算单节耗卡价格的依据。',
  color: '用于在课表中区分不同课程，建议不同课程使用不同颜色。',
  selfCheckin: '开启后，学员签到时需在场馆附近一定距离内才能操作，防止未到店签到。',
  autoCheckin: '开启后，系统会在课程结束后自动为已预约学员完成签到。',
  allowCheckinRoles:
    '未勾选的角色在该课程的签到台仅可查看，不能签到/取消签到；被关闭签到的角色代约时不会自动签到。',
};

/**
 * 分组小标题：主题色竖线 + 文字（语义：分组类型，颜色随主题切换而变化）
 * 同一文件内复用 6 次，避免重复 JSX
 */
/**
 * 课程图片上传子组件
 *
 * 与通用 ImageUploader 不同：
 * - 提供「整宽（如背景图 405×190 横图）」与「方形（如课程封面 1/3 宽）」两种布局
 * - 中央 + 号 + 主副文案完全按设计稿还原（除了颜色，蓝色品牌主色）
 * - 已上传图片占满整框（aspectFill），右上角悬浮删除按钮
 */
type CourseImageUploaderProps = {
  /** 当前图片 URL，未上传时为空 */
  value?: string;
  /** 图片变更回调，删除时回 undefined */
  onChange: (value?: string) => void;
  /** 占位标题（如「上传背景图」） */
  title: string;
  /** 占位副标题（如「上传后可预览和更换」） */
  subtitle?: string;
  /** 布局：fullWidth=整宽容器 / square=方形容器 */
  layout?: 'fullWidth' | 'square';
  /** 方形模式的尺寸（rpx），默认 200 */
  squareSizeRpx?: number;
  /** 最大文件大小（MB） */
  maxSizeMB?: number;
};

const CourseImageUploader: React.FC<CourseImageUploaderProps> = ({
  value,
  onChange,
  title,
  subtitle,
  layout = 'fullWidth',
  squareSizeRpx = 200,
  maxSizeMB = 2,
}) => {
  const handleChoose = useCallback(async () => {
    try {
      const tempPath = await chooseImageTemp({ maxSizeMB });
      onChange(tempPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : '选择图片失败';
      if (message.includes('超过') || message.includes('限制')) {
        void Taro.showModal({
          title: '图片过大',
          content: message,
          showCancel: false,
          confirmText: '知道了',
        });
      } else if (!message.includes('取消') && !message.toLowerCase().includes('cancel')) {
        Taro.showToast({ title: message, icon: 'none' });
      }
    }
  }, [maxSizeMB, onChange]);

  const handleDelete = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onChange(undefined);
    },
    [onChange],
  );

  const handlePreview = useCallback(() => {
    if (!value) return;
    void Taro.previewImage({ current: value, urls: [value] });
  }, [value]);

  /** 已上传：渲染图片预览 + 删除按钮，整宽模式 aspectFill 充满，square 同理 */
  if (value) {
    if (layout === 'fullWidth') {
      return (
        <View
          className="w-full h-[320rpx] rounded-[24rpx] overflow-hidden relative border-[2rpx] border-border press-scale"
          onClick={handlePreview}
        >
          <Image className="w-full h-full" src={value} mode="aspectFill" lazyLoad />
          <View
            className="absolute top-[16rpx] right-[16rpx] w-[56rpx] h-[56rpx] rounded-full bg-black/50 flex items-center justify-center z-10 active:opacity-70"
            onClick={handleDelete}
          >
            <Icon name="mdi-close" size={32} color="white" />
          </View>
        </View>
      );
    }
    return (
      <View
        className="rounded-[24rpx] overflow-hidden relative border-[2rpx] border-border press-scale"
        style={{ width: `${squareSizeRpx}rpx`, height: `${squareSizeRpx}rpx` }}
        onClick={handlePreview}
      >
        <Image className="w-full h-full" src={value} mode="aspectFill" lazyLoad />
        <View
          className="absolute top-[8rpx] right-[8rpx] w-[44rpx] h-[44rpx] rounded-full bg-black/50 flex items-center justify-center z-10 active:opacity-70"
          onClick={handleDelete}
        >
          <Icon name="mdi-close" size={26} color="white" />
        </View>
      </View>
    );
  }

  /** 未上传：按布局渲染虚线占位区 */
  if (layout === 'fullWidth') {
    return (
      <View
        className="w-full h-[320rpx] rounded-[24rpx] border-[2rpx] border-dashed border-primary/40 flex flex-col items-center justify-center gap-[12rpx] active:opacity-70 bg-primary/5"
        onClick={handleChoose}
      >
        <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary/15 flex items-center justify-center">
          <Icon name="mdi-plus" size={56} color="primary" />
        </View>
        <Text className="text-[28rpx] font-semibold text-primary">{title}</Text>
        {subtitle && <Text className="text-[24rpx] text-muted-foreground">{subtitle}</Text>}
      </View>
    );
  }
  return (
    <View
      className="rounded-[24rpx] border-[2rpx] border-dashed border-primary/40 flex flex-col items-center justify-center gap-[12rpx] active:opacity-70 bg-primary/5"
      style={{ width: `${squareSizeRpx}rpx`, height: `${squareSizeRpx}rpx` }}
      onClick={handleChoose}
    >
      <View className="w-[72rpx] h-[72rpx] rounded-full bg-primary/15 flex items-center justify-center">
        <Icon name="mdi-plus" size={42} color="primary" />
      </View>
      <Text className="text-[24rpx] font-medium text-primary">{title}</Text>
    </View>
  );
};

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <View className="flex flex-row items-center gap-[12rpx] pb-[24rpx]">
    <View className="w-[6rpx] h-[28rpx] rounded-[4rpx] bg-warning" />
    <Text className="text-[28rpx] font-semibold text-foreground">{title}</Text>
  </View>
);

const CourseFormPage: React.FC = () => {
  const { create, update, remove } = useCourseTemplateStore();
  const { categories, fetchList } = useCourseCategoryStore();
  const { profile } = useAuth();
  const { teachers, fetchTeachers } = useTeacherStore();
  const { fetchByTeacher } = useStudentStore();
  const instance = Taro.getCurrentInstance();
  const courseId = decodeURIComponent(instance?.router?.params?.id || '');
  const isEdit = !!courseId;

  // 基础字段
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [duration, setDuration] = useState('60');
  const [capacity, setCapacity] = useState('12');

  // 高级设置展开
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // 高级字段
  const [color, setColor] = useState(COURSE_COLOR_OPTIONS[0]);
  const [subjectId, setSubjectId] = useState('');
  const [ageGroup, setAgeGroup] = useState<'child' | 'teen' | 'adult' | 'mix' | string>('mix');
  const [experiencePrice, setExperiencePrice] = useState('');
  const [price, setPrice] = useState('');
  const [minOpenCount, setMinOpenCount] = useState('');
  const [bookingDeadline, setBookingDeadline] = useState('60');
  const [cancelQueueTime, setCancelQueueTime] = useState('60');
  const [nonCancelTime, setNonCancelTime] = useState('120');
  const [autoCheckin, setAutoCheckin] = useState<'follow_category' | 'allow' | 'forbid'>(
    'follow_category',
  );
  const [studentSelfCheckin, setStudentSelfCheckin] = useState<
    'follow_category' | 'allow' | 'forbid'
  >('follow_category');
  const [allowCheckinRoles, setAllowCheckinRoles] = useState<CheckinRole[]>([
    'teacher',
    'receptionist',
  ]);
  const [level, setLevel] = useState<'all' | 'basic' | 'advanced' | 'expert' | string>('all');
  const [customLevels, setCustomLevels] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [homeImage, setHomeImage] = useState('');

  // 自定义年龄组 / 自定义课程难度（picker 内新增）
  const [customAgeGroups, setCustomAgeGroups] = useState<string[]>([]);

  // 班课模式字段
  const [teacherId, setTeacherId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [studentIds, setStudentIds] = useState<string[]>([]);
  // 班课学员列表
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);

  // 科目列表（从科目管理数据源获取）
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // 记录用户是否手动修改过容纳人数，避免切换分类时覆盖用户输入
  const capacityTouchedRef = React.useRef(false);
  // 记录是否已设置过默认分类，避免 categories 刷新后覆盖用户手动选择
  const defaultCategorySetRef = React.useRef(false);

  // 根据选择的 categoryId 推导分类对象和课程模式
  const selectedCategory = useMemo<CourseCategoryConfig | undefined>(
    () => categories.find((item) => item.id === categoryId),
    [categories, categoryId],
  );
  const category = useMemo<CourseCategory>(
    () => selectedCategory?.mode ?? 'class',
    [selectedCategory],
  );

  /** 已选上课学员（从学员列表中按 id 匹配，用于独立卡片展示） */
  const selectedStudents = useMemo<Student[]>(
    () =>
      studentIds
        .map((id) => studentList.find((s) => s.id === id))
        .filter((s): s is Student => Boolean(s)),
    [studentIds, studentList],
  );

  /** 班课模式：隐藏开课与价格/预约规则/签到规则，改为班课信息区块 */
  const isClassMode = category === 'class';

  // 加载状态
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // 选择器弹窗
  const [picker, setPicker] = useState<{ visible: boolean; type: PickerType }>({
    visible: false,
    type: 'category',
  });

  // 颜色选择弹窗
  const [colorPickerVisible, setColorPickerVisible] = useState(false);

  // 角色多选弹窗
  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [roleTemp, setRoleTemp] = useState<CheckinRole[]>([]);

  // 班课-学员多选弹窗
  const [studentSelectVisible, setStudentSelectVisible] = useState(false);

  // 加载分类列表，编辑时加载课程详情
  useEffect(() => {
    void fetchList().then(() => {
      if (!isEdit && !defaultCategorySetRef.current) {
        // 新增时默认选中当前激活分类，没有则选第一个；
        // 直接从 store 取最新列表，避免闭包拿到旧 categories
        const state = useCourseCategoryStore.getState();
        const defaultId = state.activeCategoryId || state.categories[0]?.id || '';
        if (defaultId) {
          setCategoryId(defaultId);
          defaultCategorySetRef.current = true;
        }
      }
    });

    if (!isEdit) return;
    setLoading(true);
    Taro.setNavigationBarTitle({ title: '编辑课程' });
    courseTemplateService
      .getById(courseId)
      .then((data) => {
        if (data) {
          fillForm(data);
        }
      })
      .finally(() => setLoading(false));
  }, [courseId, isEdit, fetchList]);

  // 加载科目列表和教师列表
  useEffect(() => {
    subjectService.getList().then(setSubjects);
    fetchTeachers();
  }, [fetchTeachers]);

  // 班课模式：加载学员列表（依赖当前教师身份）
  useEffect(() => {
    if (!isClassMode || !profile?.id) return;
    setStudentLoading(true);
    fetchByTeacher(profile.id)
      .then(setStudentList)
      .finally(() => setStudentLoading(false));
  }, [isClassMode, profile?.id, fetchByTeacher]);

  // 新建时根据课程模式设置默认容纳人数：私教默认 1，班课/团课默认 12
  useEffect(() => {
    if (isEdit || capacityTouchedRef.current) return;
    setCapacity(category === 'private' ? '1' : '12');
  }, [category, isEdit]);

  const fillForm = (data: CourseTemplate) => {
    setName(data.name);
    setCategoryId(data.categoryId);
    setDuration(String(data.duration));
    setCapacity(String(data.capacity));
    setColor(data.color || COURSE_COLOR_OPTIONS[0]);
    setSubjectId(data.subjectId || '');
    // 恢复自定义年龄组/课程难度（编辑时从持久化数据重建）
    if (data.customAgeGroup) {
      setCustomAgeGroups([data.customAgeGroup]);
      setAgeGroup(`custom:${data.customAgeGroup}`);
    } else {
      setCustomAgeGroups([]);
      setAgeGroup(data.ageGroup || 'mix');
    }
    if (data.customLevel) {
      setCustomLevels([data.customLevel]);
      setLevel(`custom:${data.customLevel}`);
    } else {
      setCustomLevels([]);
      setLevel(data.level || 'all');
    }
    setExperiencePrice(data.experiencePrice ? String(data.experiencePrice / 100) : '');
    setPrice(data.price ? String(data.price / 100) : '');
    setMinOpenCount(data.minOpenCount ? String(data.minOpenCount) : '');
    setBookingDeadline(String(data.bookingDeadline ?? 60));
    setCancelQueueTime(String(data.cancelQueueTime ?? 60));
    setNonCancelTime(String(data.nonCancelTime ?? 120));
    setAutoCheckin(data.autoCheckin || 'follow_category');
    setStudentSelfCheckin(data.studentSelfCheckin || 'follow_category');
    setAllowCheckinRoles(
      (data.allowCheckinRoles?.length
        ? data.allowCheckinRoles
        : ['teacher', 'receptionist']) as CheckinRole[],
    );
    setDescription(data.description || '');
    setBackgroundImage(data.backgroundImage || '');
    setHomeImage(data.homeImage || '');
    setTeacherId(data.teacherId || '');
    setAssistantId(data.assistantId || '');
    setStudentIds(data.studentIds || []);
  };

  // 选择器选项
  const pickerConfig: {
    title: string;
    options: PickerOption[];
    value: string;
    onConfirm: (value: string) => void;
  } = useMemo(() => {
    switch (picker.type) {
      case 'category':
        return {
          title: '所属分类',
          options: categories.map((item) => ({
            label: item.name,
            value: item.id,
          })),
          value: categoryId,
          onConfirm: (value: string) => setCategoryId(value),
        };
      case 'subject':
        return {
          title: '所属科目',
          options: subjects.map((s) => ({ label: s.name, value: s.id })),
          value: subjectId,
          onConfirm: (value: string) => setSubjectId(value),
        };
      case 'teacher':
        return {
          title: '授课老师',
          options: teachers.map((t) => ({ label: t.name, value: t.id })),
          value: teacherId,
          onConfirm: (value: string) => setTeacherId(value),
        };
      case 'assistant':
        return {
          title: '助教',
          options: teachers.map((t) => ({ label: t.name, value: t.id })),
          value: assistantId,
          onConfirm: (value: string) => setAssistantId(value),
        };
      case 'ageGroup':
        return {
          title: '年龄组',
          options: [
            ...AGE_GROUP_OPTIONS,
            ...customAgeGroups.map((label) => ({ label, value: `custom:${label}` })),
          ],
          value: ageGroup,
          onConfirm: (value: string) => setAgeGroup(value),
        };
      case 'deadline':
        return {
          title: '截止预约时间',
          options: DEADLINE_OPTIONS.map((item) => ({
            label: item.label,
            value: String(item.value),
          })),
          value: bookingDeadline,
          onConfirm: (value: string) => setBookingDeadline(value),
        };
      case 'cancelQueue':
        return {
          title: '取消排队时间',
          options: DEADLINE_OPTIONS.map((item) => ({
            label: item.label,
            value: String(item.value),
          })),
          value: cancelQueueTime,
          onConfirm: (value: string) => setCancelQueueTime(value),
        };
      case 'nonCancel':
        return {
          title: '不可取消时间',
          options: DEADLINE_OPTIONS.map((item) => ({
            label: item.label,
            value: String(item.value),
          })),
          value: nonCancelTime,
          onConfirm: (value: string) => setNonCancelTime(value),
        };
      case 'selfCheckin':
        return {
          title: '学员自助签到',
          options: STUDENT_SELF_CHECKIN_OPTIONS,
          value: studentSelfCheckin,
          onConfirm: (value: string) => setStudentSelfCheckin(value as typeof studentSelfCheckin),
        };
      case 'autoCheckin':
        return {
          title: '自动签到',
          options: STUDENT_SELF_CHECKIN_OPTIONS,
          value: autoCheckin,
          onConfirm: (value: string) => setAutoCheckin(value as typeof autoCheckin),
        };
      case 'level':
        return {
          title: '课程难度',
          options: [
            ...Object.entries(CLASS_LEVEL_LABELS).map(([value, label]) => ({ label, value })),
            ...customLevels.map((label) => ({ label, value: `custom:${label}` })),
          ],
          value: level,
          onConfirm: (value: string) => setLevel(value),
        };
      default:
        return { title: '', options: [], value: '', onConfirm: () => {} };
    }
  }, [
    picker.type,
    categories,
    categoryId,
    subjectId,
    subjects,
    teachers,
    teacherId,
    assistantId,
    ageGroup,
    bookingDeadline,
    cancelQueueTime,
    nonCancelTime,
    studentSelfCheckin,
    autoCheckin,
    level,
    customAgeGroups,
    customLevels,
  ]);

  const openPicker = useCallback((type: PickerType) => {
    setPicker({ visible: true, type });
  }, []);

  const closePicker = useCallback(() => {
    setPicker((prev) => ({ ...prev, visible: false }));
  }, []);

  // 角色多选弹窗
  const openRolePicker = useCallback(() => {
    setRoleTemp([...allowCheckinRoles]);
    setRolePickerVisible(true);
  }, [allowCheckinRoles]);

  const toggleRoleTemp = useCallback((role: CheckinRole) => {
    setRoleTemp((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }, []);

  const confirmRolePicker = useCallback(() => {
    setAllowCheckinRoles(roleTemp);
    setRolePickerVisible(false);
  }, [roleTemp]);

  const handleCapacityInput = useCallback(
    (e: { detail: { value: string } }) => {
      capacityTouchedRef.current = true;
      setCapacity(e.detail.value);
    },
    [setCapacity],
  );

  const validate = useCallback((): boolean => {
    const nextErrors: FormErrors = {};
    if (!name.trim()) {
      nextErrors.name = '请输入课程名称';
    }
    if (!categoryId) {
      nextErrors.categoryId = '请选择所属分类';
    }
    const durationNum = Number(duration);
    if (!duration || Number.isNaN(durationNum) || durationNum <= 0) {
      nextErrors.duration = '请输入正确的课程时长';
    }
    const capacityNum = Number(capacity);
    if (!capacity || Number.isNaN(capacityNum) || capacityNum <= 0) {
      nextErrors.capacity = '请输入正确的容纳人数';
    }
    // 非班课模式的价格字段校验（必填且需为有效数字）
    if (!isClassMode) {
      if (!experiencePrice) {
        nextErrors.experiencePrice = '请输入新客体验价';
      } else if (Number.isNaN(Number(experiencePrice)) || Number(experiencePrice) < 0) {
        nextErrors.experiencePrice = '请输入正确的价格';
      }
      if (!price) {
        nextErrors.price = '请输入单价';
      } else if (Number.isNaN(Number(price)) || Number(price) < 0) {
        nextErrors.price = '请输入正确的价格';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [name, categoryId, duration, capacity, isClassMode, experiencePrice, price]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      Taro.showToast({ title: '请检查表单填写', icon: 'none' });
      return;
    }
    setSaving(true);

    const formData: CourseTemplateFormData = {
      name: name.trim(),
      categoryId,
      category,
      duration: Number(duration),
      capacity: Number(capacity),
      color,
      subjectId: subjectId || undefined,
      subjectName: subjectId ? subjects.find((s) => s.id === subjectId)?.name : undefined,
      ageGroup: ageGroup.startsWith('custom:')
        ? ('mix' as 'child' | 'teen' | 'adult' | 'mix')
        : (ageGroup as 'child' | 'teen' | 'adult' | 'mix'),
      customAgeGroup: ageGroup.startsWith('custom:') ? ageGroup.slice('custom:'.length) : undefined,
      experiencePrice: experiencePrice ? Math.round(Number(experiencePrice) * 100) : undefined,
      price: price ? Math.round(Number(price) * 100) : undefined,
      minOpenCount: minOpenCount ? Number(minOpenCount) : undefined,
      bookingDeadline: Number(bookingDeadline),
      cancelQueueTime: Number(cancelQueueTime),
      nonCancelTime: Number(nonCancelTime),
      autoCheckin,
      studentSelfCheckin,
      allowCheckinRoles,
      level: level.startsWith('custom:')
        ? ('all' as 'all' | 'basic' | 'advanced' | 'expert')
        : (level as 'all' | 'basic' | 'advanced' | 'expert'),
      customLevel: level.startsWith('custom:') ? level.slice('custom:'.length) : undefined,
      description: description.trim() || undefined,
      backgroundImage: backgroundImage || undefined,
      homeImage: homeImage || undefined,
      teacherId: teacherId || undefined,
      teacherName: teacherId ? teachers.find((t) => t.id === teacherId)?.name : undefined,
      assistantId: assistantId || undefined,
      assistantName: assistantId ? teachers.find((t) => t.id === assistantId)?.name : undefined,
      studentIds: studentIds.length > 0 ? studentIds : undefined,
    };

    try {
      if (isEdit) {
        await update(courseId, formData);
        Taro.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await create(formData);
        Taro.showToast({ title: '新增成功', icon: 'success' });
      }
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({ title: isEdit ? '保存失败' : '新增失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    validate,
    name,
    categoryId,
    category,
    duration,
    capacity,
    color,
    subjectId,
    subjects,
    ageGroup,
    experiencePrice,
    price,
    minOpenCount,
    bookingDeadline,
    cancelQueueTime,
    nonCancelTime,
    autoCheckin,
    studentSelfCheckin,
    allowCheckinRoles,
    level,
    description,
    isEdit,
    courseId,
    create,
    update,
    backgroundImage,
    homeImage,
    teachers,
    teacherId,
    assistantId,
    studentIds,
  ]);

  const handleDelete = useCallback(async () => {
    const { confirm } = await Taro.showModal({
      title: '确认删除',
      content: `删除后「${name}」将不可恢复，是否确认删除？`,
      confirmColor: '#EF4444',
    });
    if (!confirm) return;
    setDeleting(true);
    try {
      await remove(courseId);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 800);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [courseId, name, remove]);

  if (loading) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载课程信息中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="h-screen flex flex-col overflow-hidden">
      {/* 关键修复：scroll-view 在 flex 容器内必须同时声明 flex-1 + min-h-0，
          否则 flex item 的 min-height:auto 会让它按内容撑开，
          导致没有溢出、滚动条/鼠标滚轮失效。 */}
      <ScrollView scrollY className="flex-1 min-h-0">
        <View className="px-[32rpx] py-[24rpx] pb-[180rpx] flex flex-col gap-[24rpx]">
          {/* 基础信息卡片 */}
          <Card className="p-[32rpx]">
            {/* 课程名称 */}
            <FormRow
              label="课程名称"
              required
              editable
              placeholder="请输入课程名称"
              value={name}
              onInput={(e) => setName(e.detail.value)}
              error={errors.name}
            />

            {/* 所属分类 */}
            <FormRow
              label="所属分类"
              required
              onClick={() => openPicker('category')}
              error={errors.categoryId}
            >
              <Text
                className={cn(
                  'text-[30rpx]',
                  selectedCategory ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {selectedCategory?.name ?? '请选择'}
              </Text>
            </FormRow>

            {/* 班课模式：所属科目 */}
            {isClassMode && (
              <FormRow label="所属科目" required onClick={() => openPicker('subject')}>
                <Text
                  className={cn(
                    'text-[30rpx]',
                    subjectId ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {subjectId ? subjects.find((s) => s.id === subjectId)?.name : '请选择'}
                </Text>
              </FormRow>
            )}

            {/* 课程时长 */}
            <FormRow
              label="课程时长（分）"
              required
              editable
              placeholder="请输入课程时长"
              value={duration}
              onInput={(e) => setDuration(e.detail.value)}
              inputType="number"
              error={errors.duration}
            />

            {/* 容纳人数 */}
            <FormRow
              label="容纳人数（人）"
              required
              editable
              placeholder="请输入容纳人数"
              value={capacity}
              onInput={handleCapacityInput}
              inputType="number"
              error={errors.capacity}
            />
          </Card>

          {/* 高级设置展开按钮 - 保留现状 */}
          <View
            className="flex flex-row items-center justify-center gap-[8rpx] py-[16rpx] press-scale"
            onClick={() => setAdvancedOpen((prev) => !prev)}
          >
            <Text className="text-[28rpx] font-medium text-primary">
              {advancedOpen ? '点击收起高级设置' : '点击展开高级设置'}
            </Text>
            <Icon
              name={advancedOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}
              size={28}
              color="primary"
            />
          </View>

          {/* 高级设置 - 按"配置类型"分为 6 个子卡片 */}
          {advancedOpen && (
            <View className="flex flex-col gap-[24rpx]">
              {/* 1. 课程展示 */}
              <Card className="p-[32rpx]">
                <SectionTitle title="课程展示" />
                <View className="flex flex-col">
                  <FormRow
                    label="课程颜色"
                    hint={TOOLTIPS.color}
                    onClick={() => setColorPickerVisible(true)}
                  >
                    {color ? (
                      <View className="flex flex-row items-center gap-[12rpx]">
                        <View
                          className="w-[32rpx] h-[32rpx] rounded-[8rpx]"
                          style={{ backgroundColor: color }}
                        />
                        <Text className="text-[30rpx] text-foreground">已选择</Text>
                      </View>
                    ) : (
                      <Text className="text-[30rpx] text-muted-foreground">请选择</Text>
                    )}
                  </FormRow>
                  <FormRow label="年龄组" onClick={() => openPicker('ageGroup')} border>
                    <Text className="text-[30rpx] text-foreground">
                      {ageGroup.startsWith('custom:')
                        ? ageGroup.slice('custom:'.length)
                        : AGE_GROUP_OPTIONS.find((a) => a.value === ageGroup)?.label}
                    </Text>
                  </FormRow>
                  <FormRow label="课程难度" onClick={() => openPicker('level')} border={false}>
                    <View className="px-[20rpx] py-[6rpx] rounded-[8rpx] bg-primary/10">
                      <Text className="text-[24rpx] font-medium text-primary">
                        {level.startsWith('custom:')
                          ? level.slice('custom:'.length)
                          : CLASS_LEVEL_LABELS[level as keyof typeof CLASS_LEVEL_LABELS]}
                      </Text>
                    </View>
                  </FormRow>
                </View>
              </Card>

              {/* 班课信息（仅班课模式） */}
              {isClassMode && (
                <Card className="p-[32rpx]">
                  <SectionTitle title="班课信息" />
                  <View className="flex flex-col">
                    {/* 授课老师 */}
                    <FormRow label="授课老师" onClick={() => openPicker('teacher')} border>
                      <Text
                        className={cn(
                          'text-[30rpx]',
                          teacherId ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {teacherId ? teachers.find((t) => t.id === teacherId)?.name : '请选择'}
                      </Text>
                    </FormRow>
                    {/* 助教 */}
                    <FormRow label="助教" onClick={() => openPicker('assistant')} border={false}>
                      <Text
                        className={cn(
                          'text-[30rpx]',
                          assistantId ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {assistantId ? teachers.find((t) => t.id === assistantId)?.name : '请选择'}
                      </Text>
                    </FormRow>
                  </View>
                </Card>
              )}

              {/* 上课学员（仅班课模式，独立卡片） */}
              {isClassMode && (
                <Card className="p-[32rpx]">
                  {/* 头部：标题 + 人数徽标 + 添加/管理 */}
                  <View className="flex flex-row items-center justify-between mb-[16rpx]">
                    <View className="flex flex-row items-center gap-[12rpx]">
                      <View className="w-[6rpx] h-[28rpx] rounded-[4rpx] bg-warning" />
                      <Text className="text-[28rpx] font-semibold text-foreground">上课学员</Text>
                      <View className="px-[14rpx] py-[4rpx] rounded-full bg-primary/10">
                        <Text className="text-[22rpx] font-medium text-primary">
                          {studentIds.length} 人
                        </Text>
                      </View>
                    </View>
                    <View
                      className="flex flex-row items-center gap-[6rpx] active:opacity-70 press-scale"
                      onClick={() => setStudentSelectVisible(true)}
                    >
                      <Icon name="mdi-plus" size={28} color="primary" />
                      <Text className="text-[26rpx] font-medium text-primary">
                        {studentIds.length > 0 ? '管理' : '添加'}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[24rpx]">
                    从学员库中选择参加本次班课的学员，可随时增减。
                  </Text>

                  {/* 已选学员网格 / 空状态 */}
                  {selectedStudents.length > 0 ? (
                    <View className="flex flex-row flex-wrap gap-x-[28rpx] gap-y-[28rpx]">
                      {selectedStudents.map((student) => {
                        const remaining =
                          student.course_packages?.reduce(
                            (sum, pkg) => sum + (pkg.remaining_hours || 0),
                            0,
                          ) || 0;
                        return (
                          <View
                            key={student.id}
                            className="flex flex-col items-center gap-[10rpx] relative w-[112rpx]"
                          >
                            <Avatar name={student.name} avatarUrl={student.avatar_url} size="md" />
                            {/* 移除按钮 */}
                            <View
                              className="absolute -top-[6rpx] -right-[6rpx] w-[32rpx] h-[32rpx] rounded-full bg-destructive border-[2rpx] border-card flex items-center justify-center active:opacity-70"
                              onClick={(e) => {
                                e.stopPropagation();
                                setStudentIds((prev) => prev.filter((i) => i !== student.id));
                              }}
                            >
                              <Icon name="mdi-close" size={18} color="white" />
                            </View>
                            <Text className="text-[22rpx] text-foreground text-center truncate w-full">
                              {student.name}
                            </Text>
                            {remaining > 0 && (
                              <Text className="text-[20rpx] text-muted-foreground">
                                剩 {remaining} 课时
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View
                      className="flex flex-col items-center justify-center gap-[16rpx] py-[48rpx] rounded-[20rpx] border-[2rpx] border-dashed border-border active:opacity-70 press-scale"
                      onClick={() => setStudentSelectVisible(true)}
                    >
                      <View className="w-[80rpx] h-[80rpx] rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon name="mdi-plus" size={40} color="primary" />
                      </View>
                      <Text className="text-[26rpx] text-muted-foreground">尚未选择上课学员</Text>
                      <Text className="text-[24rpx] text-primary font-medium active:opacity-70">
                        点击此处添加
                      </Text>
                    </View>
                  )}
                </Card>
              )}

              {/* 非班课模式：开课与价格 / 预约规则 / 签到规则 */}
              {!isClassMode && (
                <>
                  {/* 2. 开课与价格 */}
                  <Card className="p-[32rpx]">
                    <SectionTitle title="开课与价格" />
                    <View className="flex flex-col">
                      <FormRow
                        label="新客体验价"
                        editable
                        placeholder="必填项"
                        value={experiencePrice}
                        onInput={(e) => setExperiencePrice(e.detail.value)}
                        inputType="digit"
                        suffix="元"
                        error={errors.experiencePrice}
                        border
                      />
                      <FormRow
                        label="单价"
                        hint={TOOLTIPS.price}
                        editable
                        placeholder="必填项"
                        value={price}
                        onInput={(e) => setPrice(e.detail.value)}
                        inputType="digit"
                        suffix="元"
                        error={errors.price}
                        border
                      />
                      <FormRow
                        label="最低开课人数"
                        editable
                        placeholder="请选择"
                        value={minOpenCount}
                        onInput={(e) => setMinOpenCount(e.detail.value)}
                        inputType="number"
                        border={false}
                      />
                    </View>
                  </Card>

                  {/* 3. 预约规则 */}
                  <Card className="p-[32rpx]">
                    <SectionTitle title="预约规则" />
                    <View className="flex flex-col">
                      <FormRow label="截止预约时间" onClick={() => openPicker('deadline')} border>
                        <Text className="text-[30rpx] text-foreground">
                          {DEADLINE_OPTIONS.find((d) => String(d.value) === bookingDeadline)?.label}
                        </Text>
                      </FormRow>
                      <FormRow
                        label="取消排队时间"
                        onClick={() => openPicker('cancelQueue')}
                        border
                      >
                        <Text className="text-[30rpx] text-foreground">
                          {DEADLINE_OPTIONS.find((d) => String(d.value) === cancelQueueTime)?.label}
                        </Text>
                      </FormRow>
                      <FormRow
                        label="不可取消时间"
                        onClick={() => openPicker('nonCancel')}
                        border={false}
                      >
                        <Text className="text-[30rpx] text-foreground">
                          {DEADLINE_OPTIONS.find((d) => String(d.value) === nonCancelTime)?.label}
                        </Text>
                      </FormRow>
                    </View>
                  </Card>

                  {/* 4. 签到规则 */}
                  <Card className="p-[32rpx]">
                    <SectionTitle title="签到规则" />
                    <View className="flex flex-col">
                      <FormRow
                        label="自动签到"
                        hint={TOOLTIPS.autoCheckin}
                        onClick={() => openPicker('autoCheckin')}
                        border
                      >
                        <Text className="text-[30rpx] text-foreground">
                          {STUDENT_SELF_CHECKIN_OPTIONS.find((s) => s.value === autoCheckin)?.label}
                        </Text>
                      </FormRow>
                      <FormRow
                        label="学员自助签到"
                        hint={TOOLTIPS.selfCheckin}
                        onClick={() => openPicker('selfCheckin')}
                        border
                      >
                        <Text className="text-[30rpx] text-foreground">
                          {
                            STUDENT_SELF_CHECKIN_OPTIONS.find((s) => s.value === studentSelfCheckin)
                              ?.label
                          }
                        </Text>
                      </FormRow>
                      <FormRow
                        label="允许签到角色"
                        hint={TOOLTIPS.allowCheckinRoles}
                        onClick={openRolePicker}
                        border={false}
                      >
                        <Text className="text-[30rpx] text-foreground">
                          {allowCheckinRoles.length > 0
                            ? allowCheckinRoles
                                .map((r) => CHECKIN_ROLE_OPTIONS.find((o) => o.value === r)?.label)
                                .filter(Boolean)
                                .join('、')
                            : '请选择'}
                        </Text>
                      </FormRow>
                    </View>
                  </Card>
                </>
              )}

              {/* 5. 课程介绍 */}
              <Card className="p-[32rpx]">
                <SectionTitle title="课程介绍" />
                <FormInput
                  label="课程简介"
                  placeholder="暂无"
                  value={description}
                  onInput={(e) => setDescription(e.detail.value)}
                  multiline
                  minHeight="200rpx"
                />
              </Card>

              {/* 6. 课程图片：背景图整宽上传框 + 封面左文字右方框 */}
              <Card className="p-[32rpx]">
                <SectionTitle title="课程图片" />
                <View className="flex flex-col gap-[40rpx]">
                  {/* 课程背景图：整宽上传框 */}
                  <View className="flex flex-col gap-[16rpx]">
                    <View className="flex flex-row items-center gap-[12rpx]">
                      <Text className="text-[30rpx] font-medium text-foreground">课程背景图</Text>
                      <View className="px-[16rpx] py-[6rpx] rounded-full bg-primary/10">
                        <Text className="text-[22rpx] text-primary font-medium">约课首页</Text>
                      </View>
                    </View>
                    <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
                      显示在首页课程卡底尾。建议使用 405×190 横图，未上传将使用默认背景。
                    </Text>
                    <CourseImageUploader
                      value={backgroundImage}
                      onChange={(v) => setBackgroundImage(v ?? '')}
                      title="上传背景图"
                      subtitle="上传后可预览和更换"
                      layout="fullWidth"
                    />
                  </View>

                  <View className="h-[1rpx] bg-border/30" />

                  {/* 课程封面：左文字说明 + 右方形上传框（卡片内嵌两栏） */}
                  <View className="flex flex-col gap-[16rpx]">
                    <View className="flex flex-row items-center gap-[12rpx]">
                      <Text className="text-[30rpx] font-medium text-foreground">课程封面</Text>
                      <View className="px-[16rpx] py-[6rpx] rounded-full bg-primary/10">
                        <Text className="text-[22rpx] text-primary font-medium">分享使用</Text>
                      </View>
                    </View>
                    <View className="flex flex-row items-start gap-[24rpx]">
                      <View className="flex-1 min-w-0">
                        <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
                          用于分享课程、生成课表推荐等场景，推荐清晰方图。未上传不影响首页背景图。
                        </Text>
                      </View>
                      <CourseImageUploader
                        value={homeImage}
                        onChange={(v) => setHomeImage(v ?? '')}
                        title="上传封面"
                        layout="square"
                        squareSizeRpx={200}
                      />
                    </View>
                  </View>
                </View>
              </Card>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 底部确认按钮 */}
      <View className="fixed left-[32rpx] right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))] flex flex-col gap-[16rpx]">
        <View
          className={cn(
            'w-full py-[26rpx] rounded-full bg-primary flex items-center justify-center press-scale shadow-float',
            saving && 'opacity-60 pointer-events-none',
          )}
          onClick={() => void handleSubmit()}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {saving ? '保存中...' : isEdit ? '保存' : '确认新增'}
          </Text>
        </View>

        {isEdit && (
          <View
            className={cn(
              'w-full py-[26rpx] rounded-full bg-card border-[2rpx] border-border flex items-center justify-center press-scale',
              deleting && 'opacity-60 pointer-events-none',
            )}
            onClick={() => void handleDelete()}
          >
            <Text className="text-[30rpx] font-semibold text-destructive">
              {deleting ? '删除中...' : '删除'}
            </Text>
          </View>
        )}
      </View>

      {/* 选择器弹窗 */}
      <PickerSheet
        visible={picker.visible}
        title={pickerConfig.title}
        options={pickerConfig.options}
        value={pickerConfig.value}
        addable={picker.type === 'ageGroup' || picker.type === 'level'}
        addPrompt={
          picker.type === 'ageGroup' ? '年龄组' : picker.type === 'level' ? '难度' : '选项'
        }
        addPlaceholder={
          picker.type === 'ageGroup'
            ? '如：中老年、幼儿'
            : picker.type === 'level'
              ? '如：入门级'
              : '请输入名称'
        }
        customOptions={
          picker.type === 'ageGroup'
            ? customAgeGroups.map((label) => ({ label, value: `custom:${label}` }))
            : picker.type === 'level'
              ? customLevels.map((label) => ({ label, value: `custom:${label}` }))
              : undefined
        }
        onAdd={(label) => {
          if (picker.type === 'ageGroup') {
            setCustomAgeGroups((prev) => (prev.includes(label) ? prev : [...prev, label]));
            setAgeGroup(`custom:${label}`);
          } else if (picker.type === 'level') {
            setCustomLevels((prev) => (prev.includes(label) ? prev : [...prev, label]));
            setLevel(`custom:${label}`);
          }
        }}
        onDeleteCustom={(value) => {
          const label = value.startsWith('custom:') ? value.slice('custom:'.length) : value;
          if (picker.type === 'ageGroup') {
            setCustomAgeGroups((prev) => prev.filter((l) => l !== label));
            if (ageGroup === value) setAgeGroup('mix');
          } else if (picker.type === 'level') {
            setCustomLevels((prev) => prev.filter((l) => l !== label));
            if (level === value) setLevel('all');
          }
        }}
        onClose={closePicker}
        onConfirm={(value) => {
          pickerConfig.onConfirm(value);
          closePicker();
        }}
      />

      {/* 颜色选择弹窗 */}
      <BottomSheet
        visible={colorPickerVisible}
        title="课程颜色"
        onClose={() => setColorPickerVisible(false)}
        height="auto"
        scrollable={false}
      >
        <View className="px-[32rpx] pb-[48rpx] pt-[16rpx]">
          <Text className="text-[26rpx] text-muted-foreground mb-[24rpx]">
            用于在课表中区分不同课程，建议不同课程使用不同颜色。
          </Text>
          <View className="flex flex-row flex-wrap gap-[24rpx]">
            {COURSE_COLOR_OPTIONS.map((c) => (
              <View
                key={c}
                className={cn(
                  'w-[80rpx] h-[80rpx] rounded-[20rpx] press-scale',
                  color === c && 'ring-[4rpx] ring-offset-[4rpx] ring-primary',
                )}
                style={{ backgroundColor: c }}
                onClick={() => {
                  setColor(c);
                  setColorPickerVisible(false);
                }}
              />
            ))}
          </View>
        </View>
      </BottomSheet>

      {/* 角色多选弹窗 */}
      <BottomSheet
        visible={rolePickerVisible}
        title="允许签到角色"
        onClose={() => setRolePickerVisible(false)}
        height="auto"
        scrollable={false}
      >
        <View className="px-[32rpx] pb-[48rpx]">
          <View className="flex flex-col gap-[12rpx]">
            <View className="flex flex-row items-center justify-between py-[24rpx] border-b border-border">
              <Text className="text-[30rpx] text-foreground">门店管理员</Text>
              <Text className="text-[24rpx] text-muted-foreground">始终可签</Text>
            </View>
            {CHECKIN_ROLE_OPTIONS.map((role) => {
              const checked = roleTemp.includes(role.value);
              return (
                <View
                  key={role.value}
                  className="flex flex-row items-center justify-between py-[24rpx] border-b border-border press-bg"
                  onClick={() => toggleRoleTemp(role.value)}
                >
                  <Text className="text-[30rpx] text-foreground">{role.label}</Text>
                  <View
                    className={cn(
                      'w-[40rpx] h-[40rpx] rounded-full flex items-center justify-center',
                      checked ? 'bg-warning' : 'border-[2rpx] border-muted-foreground',
                    )}
                  >
                    {checked && <Icon name="mdi-check" size={24} color="white" />}
                  </View>
                </View>
              );
            })}
          </View>
          <Text className="mt-[24rpx] text-[24rpx] text-muted-foreground leading-relaxed">
            未勾选的角色在该课程的签到台仅可查看，不能签到/取消签到；被关闭签到的角色代约时不会自动签到。
          </Text>
          <View
            className="mt-[32rpx] w-full py-[24rpx] rounded-full bg-primary flex items-center justify-center press-scale"
            onClick={confirmRolePicker}
          >
            <Text className="text-[30rpx] font-semibold text-white">确定</Text>
          </View>
        </View>
      </BottomSheet>

      {/* 班课-学员多选弹窗 */}
      <StudentMultiSelectSheet
        visible={studentSelectVisible}
        students={studentList}
        selectedIds={studentIds}
        loading={studentLoading}
        onClose={() => setStudentSelectVisible(false)}
        onConfirm={(ids) => setStudentIds(ids)}
      />
    </PageContainer>
  );
};

// eslint-disable-next-line import/no-named-as-default-member
definePageConfig({
  navigationBarTitleText: '新增课程',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
  // 禁用页面原生滚动，防止 PageContainer 的 min-h-screen + 安全区/底部留白
  // 产生竖向原生滚动；弹窗(BottomSheet 用 position:fixed)开合时会触发微信
  // 「fixed 元素切换导致原生页面滚动位置重置到顶部」的 BUG。
  // 本页内容滚动由内部 ScrollView(flex-1，在 h-screen flex-col overflow-hidden 容器内) 承载，不受此开关影响。
  // 注意：PageContainer 不再传 safeBottom，避免 pb-safe-bottom 给外层容器增加
  // 额外高度导致 navigateTo 页面出现原生滚动条/ScrollView 鼠标滚轮失效。
  disableScroll: true,
});

export default CourseFormPage;
