import Taro from '@tarojs/taro';
import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ContactItem } from '@/components/ContactList';
import type { ScheduleItem } from '@/components/InstallmentPanel';
import { COURSE_MANAGEMENT_CLASS_TAB_URL } from '@/constants/course-category-ui';
import { studentService, packageService, campusService, subscribeMessageService } from '@/services';
import { subjectService } from '@/services/campus';
import { useStudentStore, usePackageTemplateStore } from '@/stores';
import type { CampusUIModel, Subject } from '@/types/campus';
import type { FeeMethod, CoursePackageTemplate } from '@/types/course-package';
import type { Student } from '@/types/student';
import { isAdmin, useAuth } from '@/utils/auth';
import {
  chooseImageTemp,
  isImageCancelError,
  isLocalWechatFilePath,
  uploadImage,
} from '@/utils/image-upload';
import { reportLocalDebug } from '@/utils/local-debug';
import { logError } from '@/utils/logger';
import { setRefreshSignal, REFRESH_SIGNAL } from '@/utils/refresh-signal';

/** 支付方式选项 */
export const FEE_METHOD_OPTIONS = [
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '现金', value: 'cash' },
  { label: '银行转账', value: 'transfer' },
  { label: '其他', value: 'other' },
];

/** 学生类型 */
export type StudentType = 'new' | 'old';

/** 老生迁移课包草稿：科目 + 剩余课时 + 可选有效期 */
export interface LegacyPackageDraft {
  id: string;
  subjectId: string;
  subjectName: string;
  remainingHours: string;
  expireEnabled: boolean;
  expireDate: string;
}

/** 表单错误 */
export interface FormErrors {
  name?: string;
  phone?: string;
  birthday?: string;
  initHours?: string;
  legacyPackages?: string;
  feeAmount?: string;
}

function createEmptyLegacyPackage(): LegacyPackageDraft {
  return {
    id: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    subjectId: '',
    subjectName: '',
    remainingHours: '',
    expireEnabled: false,
    expireDate: '',
  };
}

/** useStudentForm 返回值类型 */
export interface UseStudentFormReturn {
  isEdit: boolean;
  studentId: string;

  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  nickname: string;
  setNickname: React.Dispatch<React.SetStateAction<string>>;
  gender: string;
  setGender: React.Dispatch<React.SetStateAction<string>>;
  phone: string;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  birthday: string;
  setBirthday: React.Dispatch<React.SetStateAction<string>>;
  address: string;
  setAddress: React.Dispatch<React.SetStateAction<string>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  avatarUrl: string;
  setAvatarUrl: React.Dispatch<React.SetStateAction<string>>;
  feeAmount: string;
  setFeeAmount: React.Dispatch<React.SetStateAction<string>>;
  feeMethod: string;
  setFeeMethod: React.Dispatch<React.SetStateAction<string>>;

  studentType: StudentType;
  setStudentType: React.Dispatch<React.SetStateAction<StudentType>>;
  initHours: string;
  setInitHours: React.Dispatch<React.SetStateAction<string>>;

  /** 老生：多课包迁移 */
  legacyPackages: LegacyPackageDraft[];
  addLegacyPackage: () => void;
  removeLegacyPackage: (id: string) => void;
  updateLegacyPackage: (id: string, patch: Partial<LegacyPackageDraft>) => void;
  subjects: Subject[];

  /** 可选：缴费信息 */
  paymentEnabled: boolean;
  setPaymentEnabled: React.Dispatch<React.SetStateAction<boolean>>;

  contacts: ContactItem[];
  setContacts: React.Dispatch<React.SetStateAction<ContactItem[]>>;

  installmentEnabled: boolean;
  setInstallmentEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  installmentPeriod: number;
  setInstallmentPeriod: React.Dispatch<React.SetStateAction<number>>;
  schedule: ScheduleItem[];
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleItem[]>>;

  feeMethodOther: string;
  setFeeMethodOther: React.Dispatch<React.SetStateAction<string>>;

  packageTemplates: CoursePackageTemplate[];
  selectedPackageId: string;
  setSelectedPackageId: React.Dispatch<React.SetStateAction<string>>;
  selectedPackage: CoursePackageTemplate | undefined;
  showPackagePicker: boolean;
  setShowPackagePicker: React.Dispatch<React.SetStateAction<boolean>>;

  campusId: string;
  setCampusId: React.Dispatch<React.SetStateAction<string>>;
  campusOptions: CampusUIModel[];

  loading: boolean;
  loadError: string;
  notFound: boolean;
  errors: FormErrors;
  saving: boolean;
  canSubmit: boolean;
  submitBlockedReason: string;

  clearError: (field: keyof FormErrors) => void;
  validate: () => boolean;
  handleChooseAvatar: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleReset: () => void;
  reload: () => Promise<void>;
}

export function useStudentForm(): UseStudentFormReturn {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';

  const { isEdit, studentId } = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    const params = instance?.router?.params || {};
    const id = decodeURIComponent(params.id || '');
    return { isEdit: Boolean(id), studentId: id };
  }, []);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeMethod, setFeeMethod] = useState<string>('');

  const [studentType, setStudentType] = useState<StudentType>('new');
  const [initHours, setInitHours] = useState('');
  const [legacyPackages, setLegacyPackages] = useState<LegacyPackageDraft[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [paymentEnabled, setPaymentEnabled] = useState(false);

  const [contacts, setContacts] = useState<ContactItem[]>([
    { id: '1', relation: '妈妈', phone: '' },
  ]);

  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentPeriod, setInstallmentPeriod] = useState(3);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [feeMethodOther, setFeeMethodOther] = useState('');

  const [packageTemplates, setPackageTemplates] = useState<CoursePackageTemplate[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [showPackagePicker, setShowPackagePicker] = useState(false);

  const [campusOptions, setCampusOptions] = useState<CampusUIModel[]>([]);
  const [campusId, setCampusId] = useState('');

  const updateStudentInCache = useStudentStore((state) => state.updateInCache);
  const fetchPackageTemplatesByTeacher = usePackageTemplateStore((state) => state.fetchByTeacher);

  const selectedPackage = useMemo(
    () => packageTemplates.find((t) => t.id === selectedPackageId),
    [packageTemplates, selectedPackageId],
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const initStartAtRef = useState({ current: 0 })[0];

  const addLegacyPackage = useCallback(() => {
    setLegacyPackages((prev) => [...prev, createEmptyLegacyPackage()]);
  }, []);

  const removeLegacyPackage = useCallback((id: string) => {
    setLegacyPackages((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateLegacyPackage = useCallback((id: string, patch: Partial<LegacyPackageDraft>) => {
    setLegacyPackages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const loadFormData = useCallback(async () => {
    initStartAtRef.current = Date.now();
    reportLocalDebug({
      hypothesisId: 'H2',
      location: 'src/package-student/pages/student-form/useStudentForm.ts:loadFormData',
      msg: '[DEBUG] student form init start',
      data: { currentUserId, isEdit, studentId },
    });
    setLoading(true);
    setLoadError('');
    setNotFound(false);

    if (!currentUserId) {
      setLoadError('未获取到登录信息，请重新进入页面');
      setLoading(false);
      return;
    }

    try {
      const [campusList, subjectList] = await Promise.all([
        campusService.getList(),
        subjectService.getList(),
      ]);
      setCampusOptions(campusList);
      setSubjects(subjectList);
      const mainCampusId = campusList.find((campus) => campus.isMain)?.id || '';

      if (isEdit) {
        const stu = await studentService.getById(studentId);
        if (!stu) {
          setNotFound(true);
          return;
        }

        setName(stu.name || '');
        setNickname(stu.nickname || '');
        setGender(stu.gender === 'male' ? '男' : stu.gender === 'female' ? '女' : '');
        setPhone(stu.phone || '');
        setBirthday(stu.birthday || '');
        setAddress(stu.address || '');
        setNote(stu.note || '');
        setAvatarUrl(stu.avatar_url || '');
        setFeeAmount(stu.fee_amount ? String(stu.fee_amount) : '');
        setFeeMethod(stu.fee_method || '');
        setPaymentEnabled(Boolean(stu.fee_amount || stu.fee_method));
        setCampusId(stu.campus_id || mainCampusId);
        return;
      }

      const list = await fetchPackageTemplatesByTeacher(currentUserId, true);
      setPackageTemplates(list);
      setCampusId(mainCampusId);
    } catch (error) {
      logError('init student form', error);
      setLoadError('学员表单初始化失败，请稍后重试');
    } finally {
      reportLocalDebug({
        hypothesisId: 'H2',
        location: 'src/package-student/pages/student-form/useStudentForm.ts:loadFormData',
        msg: '[DEBUG] student form init end',
        data: {
          currentUserId,
          isEdit,
          studentId,
          durationMs: Date.now() - initStartAtRef.current,
        },
      });
      setLoading(false);
    }
  }, [currentUserId, isEdit, studentId, fetchPackageTemplatesByTeacher, initStartAtRef]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      errs.name = '请输入学生姓名';
    } else if (trimmedName.length > 20) {
      errs.name = '姓名最多20个字';
    }

    if (phone.trim() && !/^1[3-9]\d{9}$/.test(phone.trim())) {
      errs.phone = '请输入正确的11位手机号';
    }

    if (birthday) {
      const d = new Date(birthday);
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      if (d > now) errs.birthday = '出生日期不能晚于今天';
    }

    if (!isEdit) {
      if (studentType === 'old') {
        if (legacyPackages.length === 0) {
          errs.legacyPackages = '请至少添加一个课包';
        } else {
          const invalid = legacyPackages.some((pkg) => {
            const hours = parseInt(pkg.remainingHours, 10);
            if (!pkg.subjectId) return true;
            if (!pkg.remainingHours.trim() || Number.isNaN(hours) || hours <= 0) return true;
            if (pkg.expireEnabled && !pkg.expireDate) return true;
            return false;
          });
          if (invalid) {
            errs.legacyPackages = '请完善每个课包的科目、剩余课时与有效期';
          }
        }
      } else {
        const init = parseInt(initHours, 10) || 0;
        if (initHours && init < 0) errs.initHours = '初始课时不能为负数';
      }
    }

    if (paymentEnabled && feeAmount.trim()) {
      const amount = parseFloat(feeAmount);
      if (isNaN(amount) || amount < 0) errs.feeAmount = '金额不能为负数';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [
    name,
    phone,
    birthday,
    isEdit,
    studentType,
    initHours,
    legacyPackages,
    feeAmount,
    paymentEnabled,
  ]);

  const submitBlockedReason = useMemo(() => {
    if (!name.trim()) return '请输入学员姓名';
    if (name.trim().length > 20) return '学员姓名最多 20 个字';

    if (phone.trim() && !/^1[3-9]\d{9}$/.test(phone.trim())) {
      return '请输入正确的 11 位手机号';
    }

    if (birthday) {
      const date = new Date(birthday);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) return '出生日期不能晚于今天';
    }

    if (!isEdit) {
      if (studentType === 'new') {
        const init = parseInt(initHours, 10) || 0;
        if (!initHours.trim()) return '请填写初始课时';
        if (init <= 0) return '初始课时必须大于 0';
      } else {
        if (legacyPackages.length === 0) return '请至少添加一个历史课包';
        for (let i = 0; i < legacyPackages.length; i += 1) {
          const pkg = legacyPackages[i];
          const label = legacyPackages.length > 1 ? `课包${i + 1}` : '课包';
          if (!pkg.subjectId) return `请选择${label}的科目`;
          const hours = parseInt(pkg.remainingHours, 10);
          if (!pkg.remainingHours.trim() || Number.isNaN(hours) || hours <= 0) {
            return `请填写${label}的剩余课时`;
          }
          if (pkg.expireEnabled && !pkg.expireDate) {
            return `请选择${label}的到期日期`;
          }
        }
      }
    }

    if (paymentEnabled) {
      if (feeAmount.trim()) {
        const amount = parseFloat(feeAmount);
        if (Number.isNaN(amount) || amount < 0) return '缴费金额不能为负数';
      }
      if (feeMethod === 'other' && !feeMethodOther.trim()) {
        return '请填写具体支付方式';
      }
      if (installmentEnabled) {
        const amount = parseFloat(feeAmount || '0');
        if (!feeAmount || Number.isNaN(amount) || amount <= 0) return '分期付款前请先填写缴费金额';
        if (!schedule.length) return '请完善分期付款计划';
        if (
          schedule.some(
            (item) =>
              !item.date ||
              !item.amount ||
              Number.isNaN(parseFloat(String(item.amount))) ||
              parseFloat(String(item.amount)) <= 0,
          )
        ) {
          return '请填写完整的分期付款计划';
        }
      }
    }

    return '';
  }, [
    name,
    phone,
    birthday,
    isEdit,
    studentType,
    initHours,
    legacyPackages,
    paymentEnabled,
    feeAmount,
    feeMethod,
    feeMethodOther,
    installmentEnabled,
    schedule,
  ]);

  const canSubmit = useMemo(() => !submitBlockedReason, [submitBlockedReason]);

  const clearError = useCallback((field: keyof FormErrors) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleChooseAvatar = useCallback(async () => {
    try {
      // 统一封装：chooseMedia + 隐私预检 + 1:1 裁剪 + 持久化（临时文件不回收，预览稳定）
      const path = await chooseImageTemp({ maxSizeMB: 5, cropScale: '1:1' });
      setAvatarUrl(path);
      Taro.showToast({ title: '头像已选择', icon: 'success' });
    } catch (err) {
      // 用户取消：静默
      if (isImageCancelError(err)) return;
      Taro.showToast({ title: '头像选择失败，请重试', icon: 'none' });
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;

    if (!validate()) {
      Taro.showToast({ title: '请检查表单中的错误', icon: 'none' });
      return;
    }

    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      const hasDuplicate = await studentService.checkDuplicateName(
        currentUserId,
        name.trim(),
        isEdit ? studentId : undefined,
      );
      if (hasDuplicate) {
        const { confirm } = await Taro.showModal({
          title: '重复姓名提醒',
          content: `您已存在名为「${name.trim()}」的学生，是否继续保存？`,
          confirmText: '保存',
          cancelText: '取消',
        });
        if (!confirm) {
          setSaving(false);
          return;
        }
      }

      const teacherId = currentUserId;
      const feePayload = paymentEnabled
        ? {
            fee_amount: feeAmount ? parseFloat(feeAmount) : undefined,
            fee_method: (feeMethod || undefined) as FeeMethod | undefined,
          }
        : { fee_amount: undefined, fee_method: undefined };

      let newStudent: Student | undefined;
      let packageInitializationFailed = false;

      const resolveAvatarForStudent = async (
        targetStudentId: string,
      ): Promise<string | undefined> => {
        const raw = avatarUrl.trim();
        if (!raw) return undefined;
        if (!isLocalWechatFilePath(raw)) return raw;
        return uploadImage(raw, 'student_avatar', { refId: targetStudentId });
      };

      if (isEdit) {
        const remoteAvatar = await resolveAvatarForStudent(studentId);
        const updated = await studentService.update(studentId, {
          name: name.trim(),
          nickname: nickname.trim() || undefined,
          phone: phone.trim() || undefined,
          gender: gender === '男' ? 'male' : gender === '女' ? 'female' : undefined,
          birthday: birthday || undefined,
          address: address.trim() || undefined,
          note: note.trim() || undefined,
          avatar_url: remoteAvatar,
          ...feePayload,
          campus_id: campusId || undefined,
          campus_name: campusOptions.find((c) => c.id === campusId)?.name || undefined,
          teacher_id: teacherId,
        });
        if (updated) {
          updateStudentInCache(currentUserId, updated);
          setRefreshSignal(REFRESH_SIGNAL.students);
        }
        Taro.showToast({ title: '更新成功', icon: 'success' });
      } else {
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const localAvatarPending = isLocalWechatFilePath(avatarUrl) ? avatarUrl.trim() : '';
        const existingRemoteAvatar =
          avatarUrl.trim() && !localAvatarPending ? avatarUrl.trim() : undefined;

        newStudent = await studentService.create({
          teacher_id: teacherId,
          name: name.trim(),
          nickname: nickname.trim() || undefined,
          invite_code: inviteCode,
          phone: phone.trim() || undefined,
          gender: gender === '男' ? 'male' : gender === '女' ? 'female' : undefined,
          birthday: birthday || undefined,
          address: address.trim() || undefined,
          note: note.trim() || undefined,
          avatar_url: existingRemoteAvatar,
          ...feePayload,
          campus_id: campusId || undefined,
          campus_name: campusOptions.find((c) => c.id === campusId)?.name || undefined,
        });

        if (newStudent && localAvatarPending) {
          try {
            const remoteAvatar = await uploadImage(localAvatarPending, 'student_avatar', {
              refId: newStudent.id,
            });
            const withAvatar = await studentService.update(newStudent.id, {
              avatar_url: remoteAvatar,
            });
            if (withAvatar) {
              newStudent = withAvatar;
            } else {
              newStudent = { ...newStudent, avatar_url: remoteAvatar };
            }
          } catch (error) {
            logError('upload student avatar after create', error);
            Taro.showToast({ title: '学员已创建，头像上传失败可稍后编辑补传', icon: 'none' });
          }
        }

        if (newStudent) {
          updateStudentInCache(currentUserId, newStudent);
          setRefreshSignal(REFRESH_SIGNAL.students);

          try {
            if (studentType === 'old') {
              for (const pkg of legacyPackages) {
                const hours = parseInt(pkg.remainingHours, 10) || 0;
                if (hours <= 0 || !pkg.subjectId) continue;
                await packageService.create({
                  teacher_id: teacherId,
                  student_id: newStudent.id,
                  name: `${pkg.subjectName || '科目'}（历史导入）`,
                  total_hours: hours,
                  remaining_hours: hours,
                  purchased_remaining: hours,
                  bonus_remaining: 0,
                  status: 'active',
                  subject_id: pkg.subjectId,
                  end_date: pkg.expireEnabled ? pkg.expireDate || undefined : undefined,
                  expiry_date: pkg.expireEnabled ? pkg.expireDate || undefined : undefined,
                  note: `老生迁移：剩余 ${hours} 课时`,
                });
              }
            } else {
              const init = parseInt(initHours, 10) || 0;
              if (init > 0) {
                await packageService.create({
                  teacher_id: teacherId,
                  student_id: newStudent.id,
                  name: '初始课时',
                  total_hours: init,
                  remaining_hours: init,
                  purchased_remaining: init,
                  bonus_remaining: 0,
                  status: 'active',
                });
              }
            }
          } catch (error) {
            packageInitializationFailed = true;
            logError('init student package', error);
          }
        }

        if (packageInitializationFailed) {
          Taro.showToast({ title: '学员已创建，课时初始化失败', icon: 'none', duration: 2500 });
        } else {
          Taro.showToast({ title: '添加成功', icon: 'success' });
        }
      }

      if (!isEdit && newStudent) {
        Taro.hideToast();
        try {
          await subscribeMessageService.runFlow('E01', {
            studentId: newStudent.id,
            studentName: newStudent.name,
            campusId: campusId || undefined,
            role: profile?.currentContext?.role,
          });
        } catch (error) {
          logError('subscribe E01 after student create', error);
        }
        const canManageClasses = isAdmin(profile?.currentContext?.role);
        if (canManageClasses) {
          const { confirm } = await Taro.showModal({
            title: '学员已创建',
            content: '是否立即分班？',
            confirmText: '立即分班',
            cancelText: '稍后再说',
          });
          if (confirm) {
            Taro.navigateTo({ url: COURSE_MANAGEMENT_CLASS_TAB_URL });
          } else {
            Taro.navigateBack();
          }
        } else {
          // 教师无课程管理权限：进学员详情闭环，避免跳转后被守卫拦回
          Taro.navigateTo({
            url: `/package-student/pages/student-detail/index?id=${encodeURIComponent(newStudent.id)}`,
          });
        }
      } else {
        setTimeout(() => Taro.navigateBack(), 1500);
      }
    } catch (err) {
      logError('save student', err);
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    name,
    nickname,
    gender,
    phone,
    birthday,
    address,
    note,
    avatarUrl,
    feeAmount,
    feeMethod,
    studentId,
    isEdit,
    validate,
    submitBlockedReason,
    studentType,
    initHours,
    legacyPackages,
    currentUserId,
    updateStudentInCache,
    campusId,
    campusOptions,
    profile?.currentContext?.role,
    paymentEnabled,
  ]);

  const handleReset = useCallback(() => {
    setName('');
    setNickname('');
    setGender('');
    setPhone('');
    setBirthday('');
    setAddress('');
    setNote('');
    setAvatarUrl('');
    setFeeAmount('');
    setFeeMethod('');
    setInitHours('');
    setLegacyPackages([]);
    setStudentType('new');
    setPaymentEnabled(false);
    setInstallmentEnabled(false);
    setSchedule([]);
    setContacts([{ id: '1', relation: '妈妈', phone: '' }]);
    setSelectedPackageId('');
    setCampusId('');
    setErrors({});
  }, [currentUserId]);

  return {
    isEdit,
    studentId,
    loading,
    loadError,
    notFound,
    name,
    setName,
    nickname,
    setNickname,
    gender,
    setGender,
    phone,
    setPhone,
    birthday,
    setBirthday,
    address,
    setAddress,
    note,
    setNote,
    avatarUrl,
    setAvatarUrl,
    feeAmount,
    setFeeAmount,
    feeMethod,
    setFeeMethod,
    studentType,
    setStudentType,
    initHours,
    setInitHours,
    legacyPackages,
    addLegacyPackage,
    removeLegacyPackage,
    updateLegacyPackage,
    subjects,
    paymentEnabled,
    setPaymentEnabled,
    contacts,
    setContacts,
    installmentEnabled,
    setInstallmentEnabled,
    installmentPeriod,
    setInstallmentPeriod,
    schedule,
    setSchedule,
    feeMethodOther,
    setFeeMethodOther,
    packageTemplates,
    selectedPackageId,
    setSelectedPackageId,
    selectedPackage,
    showPackagePicker,
    setShowPackagePicker,
    campusId,
    setCampusId,
    campusOptions,
    errors,
    saving,
    canSubmit,
    submitBlockedReason,
    clearError,
    validate,
    handleChooseAvatar,
    handleSave,
    handleReset,
    reload: loadFormData,
  };
}
