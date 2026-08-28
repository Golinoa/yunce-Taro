import Taro from '@tarojs/taro';
import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ContactItem } from '@/components/ContactList';
import type { ScheduleItem } from '@/components/InstallmentPanel';
import { COURSE_MANAGEMENT_CLASS_TAB_URL } from '@/constants/course-category-ui';
import { studentService, packageService, campusService, subscribeMessageService } from '@/services';
import { useStudentStore, usePackageTemplateStore } from '@/stores';
import type { CampusUIModel } from '@/types/campus';
import type { FeeMethod, CoursePackageTemplate } from '@/types/course-package';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { isUseMock } from '@/utils/build-env';
import { reportLocalDebug } from '@/utils/local-debug';
import { logError } from '@/utils/logger';

const USE_MOCK = isUseMock();

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

/** 老生课时构成 */
export type HoursComposition = 'purchased' | 'bonus' | 'mixed';

/** 表单错误 */
export interface FormErrors {
  name?: string;
  phone?: string;
  birthday?: string;
  initHours?: string;
  totalHours?: string;
  usedHours?: string;
  hours?: string;
  feeAmount?: string;
}

/** useStudentForm 返回值类型 */
export interface UseStudentFormReturn {
  // 路由参数
  isEdit: boolean;
  studentId: string;

  // 基础信息字段
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

  // 学生类型 & 课时
  studentType: StudentType;
  setStudentType: React.Dispatch<React.SetStateAction<StudentType>>;
  initHours: string;
  setInitHours: React.Dispatch<React.SetStateAction<string>>;
  totalHours: string;
  setTotalHours: React.Dispatch<React.SetStateAction<string>>;
  usedHours: string;
  setUsedHours: React.Dispatch<React.SetStateAction<string>>;
  hoursComposition: HoursComposition;
  setHoursComposition: React.Dispatch<React.SetStateAction<HoursComposition>>;

  // 联系人
  contacts: ContactItem[];
  setContacts: React.Dispatch<React.SetStateAction<ContactItem[]>>;

  // 分期付款
  installmentEnabled: boolean;
  setInstallmentEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  installmentPeriod: number;
  setInstallmentPeriod: React.Dispatch<React.SetStateAction<number>>;
  schedule: ScheduleItem[];
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleItem[]>>;

  // 其他支付方式
  feeMethodOther: string;
  setFeeMethodOther: React.Dispatch<React.SetStateAction<string>>;

  // 课包模板
  packageTemplates: CoursePackageTemplate[];
  selectedPackageId: string;
  setSelectedPackageId: React.Dispatch<React.SetStateAction<string>>;
  selectedPackage: CoursePackageTemplate | undefined;
  showPackagePicker: boolean;
  setShowPackagePicker: React.Dispatch<React.SetStateAction<boolean>>;

  // 所属校区
  campusId: string;
  setCampusId: React.Dispatch<React.SetStateAction<string>>;
  campusOptions: CampusUIModel[];

  // 计算值
  remainingHours: number;

  // 表单状态
  loading: boolean;
  loadError: string;
  notFound: boolean;
  errors: FormErrors;
  saving: boolean;
  canSubmit: boolean;
  submitBlockedReason: string;

  // 方法
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

  // 判断是编辑还是创建
  const { isEdit, studentId } = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    const params = instance?.router?.params || {};
    const id = decodeURIComponent(params.id || '');
    return { isEdit: Boolean(id), studentId: id };
  }, []);

  // 表单字段
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

  // 学生类型 & 课时（仅新建模式）
  const [studentType, setStudentType] = useState<StudentType>('new');
  const [initHours, setInitHours] = useState('');
  const [totalHours, setTotalHours] = useState('');
  const [usedHours, setUsedHours] = useState('');
  const [hoursComposition, setHoursComposition] = useState<HoursComposition>('purchased');

  // 联系人列表
  const [contacts, setContacts] = useState<ContactItem[]>([
    { id: '1', relation: '妈妈', phone: '' },
  ]);

  // 分期付款
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentPeriod, setInstallmentPeriod] = useState(3);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

  // "其他"支付方式自定义输入
  const [feeMethodOther, setFeeMethodOther] = useState('');

  // 课包模板（新生选择课包用）
  const [packageTemplates, setPackageTemplates] = useState<CoursePackageTemplate[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [showPackagePicker, setShowPackagePicker] = useState(false);

  // 所属校区
  const [campusOptions, setCampusOptions] = useState<CampusUIModel[]>([]);
  const [campusId, setCampusId] = useState('');

  // Store 实例
  const updateStudentInCache = useStudentStore((state) => state.updateInCache);
  const fetchPackageTemplatesByTeacher = usePackageTemplateStore((state) => state.fetchByTeacher);

  // 当前选中的课包模板
  const selectedPackage = useMemo(
    () => packageTemplates.find((t) => t.id === selectedPackageId),
    [packageTemplates, selectedPackageId],
  );

  // 老学生剩余课时
  const remainingHours = useMemo(() => {
    const total = parseInt(totalHours) || 0;
    const used = parseInt(usedHours) || 0;
    return total - used;
  }, [totalHours, usedHours]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const initStartAtRef = useState({ current: 0 })[0];

  const loadFormData = useCallback(async () => {
    initStartAtRef.current = Date.now();
    // #region debug-point H2:student-form-init-start
    reportLocalDebug({
      hypothesisId: 'H2',
      location: 'src/package-student/pages/student-form/useStudentForm.ts:loadFormData',
      msg: '[DEBUG] student form init start',
      data: { currentUserId, isEdit, studentId },
    });
    // #endregion
    setLoading(true);
    setLoadError('');
    setNotFound(false);

    if (!currentUserId) {
      setLoadError('未获取到登录信息，请重新进入页面');
      setLoading(false);
      return;
    }

    try {
      const campusList = await campusService.getList();
      setCampusOptions(campusList);
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
      // #region debug-point H2:student-form-init-end
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
      // #endregion
      setLoading(false);
    }
  }, [currentUserId, isEdit, studentId, fetchPackageTemplatesByTeacher, initStartAtRef]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  // 表单校验
  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      errs.name = '请输入学生姓名';
    } else if (trimmedName.length > 20) {
      errs.name = '姓名最多20个字';
    }

    if (phone.trim()) {
      if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
        errs.phone = '请输入正确的11位手机号';
      }
    }

    if (birthday) {
      const d = new Date(birthday);
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      if (d > now) {
        errs.birthday = '出生日期不能晚于今天';
      }
    }

    if (!isEdit) {
      if (studentType === 'old') {
        const total = parseInt(totalHours) || 0;
        const used = parseInt(usedHours) || 0;
        if (used > total) {
          errs.hours = '已消课时不能大于总充值课时';
        }
        if (totalHours && total < 0) {
          errs.totalHours = '总课时不能为负数';
        }
        if (usedHours && used < 0) {
          errs.usedHours = '已消课时不能为负数';
        }
      } else {
        const init = parseInt(initHours) || 0;
        if (initHours && init < 0) {
          errs.initHours = '初始课时不能为负数';
        }
      }
    }

    // 金额校验
    if (feeAmount.trim()) {
      const amount = parseFloat(feeAmount);
      if (isNaN(amount) || amount < 0) {
        errs.feeAmount = '金额不能为负数';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, phone, birthday, isEdit, studentType, totalHours, usedHours, initHours, feeAmount]);

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
        const total = parseInt(totalHours, 10);
        const used = parseInt(usedHours, 10);
        if (!totalHours.trim()) return '请填写总充值课时';
        if (Number.isNaN(total) || total <= 0) return '总充值课时必须大于 0';
        if (!usedHours.trim()) return '请填写已消课时';
        if (Number.isNaN(used) || used < 0) return '已消课时不能小于 0';
        if (used > total) return '已消课时不能大于总充值课时';
      }
    }

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

    return '';
  }, [
    name,
    phone,
    birthday,
    isEdit,
    studentType,
    initHours,
    totalHours,
    usedHours,
    feeAmount,
    feeMethod,
    feeMethodOther,
    installmentEnabled,
    schedule,
  ]);

  const canSubmit = useMemo(() => !submitBlockedReason, [submitBlockedReason]);

  // 清除某个字段的错误
  const clearError = useCallback((field: keyof FormErrors) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // 头像上传
  const handleChooseAvatar = useCallback(async () => {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });
      const tempPath = res.tempFilePaths[0];
      if (!tempPath) return;
      setAvatarUrl(tempPath);
      Taro.showToast({ title: '头像已选择', icon: 'success' });
    } catch {
      // 用户取消选择
    }
  }, []);

  // 保存
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

      let newStudent: Student | undefined;
      let packageInitializationFailed = false;

      if (isEdit) {
        const updated = await studentService.update(studentId, {
          name: name.trim(),
          nickname: nickname.trim() || undefined,
          phone: phone.trim() || undefined,
          gender: gender === '男' ? 'male' : gender === '女' ? 'female' : undefined,
          birthday: birthday || undefined,
          address: address.trim() || undefined,
          note: note.trim() || undefined,
          avatar_url: avatarUrl || undefined,
          fee_amount: feeAmount ? parseFloat(feeAmount) : undefined,
          fee_method: (feeMethod || undefined) as FeeMethod | undefined,
          campus_id: campusId || undefined,
          campus_name: campusOptions.find((c) => c.id === campusId)?.name || undefined,
        });
        // 更新 Store 缓存
        if (updated) updateStudentInCache(currentUserId, updated);
        Taro.showToast({ title: '更新成功', icon: 'success' });
      } else {
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        newStudent = await studentService.create({
          teacher_id: currentUserId,
          name: name.trim(),
          nickname: nickname.trim() || undefined,
          invite_code: inviteCode,
          phone: phone.trim() || undefined,
          gender: gender === '男' ? 'male' : gender === '女' ? 'female' : undefined,
          birthday: birthday || undefined,
          address: address.trim() || undefined,
          note: note.trim() || undefined,
          avatar_url: avatarUrl || undefined,
          fee_amount: feeAmount ? parseFloat(feeAmount) : undefined,
          fee_method: (feeMethod || undefined) as FeeMethod | undefined,
          campus_id: campusId || undefined,
          campus_name: campusOptions.find((c) => c.id === campusId)?.name || undefined,
        });

        if (newStudent) {
          // 更新 Store 缓存
          updateStudentInCache(currentUserId, newStudent);

          try {
            if (studentType === 'old') {
              const total = parseInt(totalHours) || 0;
              const used = parseInt(usedHours) || 0;
              const remaining = total - used;
              if (total > 0) {
                const createdPackage = await packageService.create({
                  teacher_id: currentUserId,
                  student_id: newStudent.id,
                  name: '历史课时导入',
                  total_hours: total,
                  remaining_hours: remaining,
                  purchased_remaining: remaining,
                  bonus_remaining: 0,
                  status: 'active',
                  note:
                    hoursComposition === 'bonus' && !USE_MOCK
                      ? `总${total}课时，已消${used}课时，剩余${remaining}课时；当前联调阶段按统一课时导入，未区分赠送课时`
                      : `总${total}课时，已消${used}课时，剩余${remaining}课时`,
                });

                if (!USE_MOCK && used > 0) {
                  await packageService.deductHours(createdPackage.id, used);
                }
              }
            } else {
              const init = parseInt(initHours) || 0;
              if (init > 0) {
                await packageService.create({
                  teacher_id: currentUserId,
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

      // 新建学员成功后：先订阅消息引导（E01），再询问是否分班
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
        const { confirm } = await Taro.showModal({
          title: '学员已创建',
          content: '是否立即分班？',
          confirmText: '立即分班',
          cancelText: '稍后再说',
        });
        if (confirm) {
          Taro.navigateTo({
            url: COURSE_MANAGEMENT_CLASS_TAB_URL,
          });
        } else {
          Taro.navigateBack();
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
    totalHours,
    usedHours,
    currentUserId,
    updateStudentInCache,
    hoursComposition,
    campusId,
    campusOptions,
    profile?.currentContext?.role,
  ]);

  // 重置表单
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
    setTotalHours('');
    setUsedHours('');
    setStudentType('new');
    setInstallmentEnabled(false);
    setSchedule([]);
    setContacts([{ id: '1', relation: '妈妈', phone: '' }]);
    setSelectedPackageId('');
    setCampusId('');
    setErrors({});
  }, []);

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
    totalHours,
    setTotalHours,
    usedHours,
    setUsedHours,
    hoursComposition,
    setHoursComposition,
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
    remainingHours,
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
