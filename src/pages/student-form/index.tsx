import { View, Text, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import Card from '@/components/Card';
import CardHeader from '@/components/CardHeader';
import ChipPicker from '@/components/ChipPicker';
import ContactList from '@/components/ContactList';
import InstallmentPanel from '@/components/InstallmentPanel';
import type { ContactItem } from '@/components/ContactList';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import type { ScheduleItem } from '@/components/InstallmentPanel';
import PageContainer from '@/components/PageContainer';
import SegmentedControl from '@/components/SegmentedControl';
import { studentService, packageService } from '@/services';
import { useStudentStore, usePackageTemplateStore } from '@/stores';
import type { FeeMethod, CoursePackageTemplate } from '@/types/course-package';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 支付方式选项 */
const FEE_METHOD_OPTIONS = [
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '现金', value: 'cash' },
  { label: '银行转账', value: 'bank' },
  { label: '其他', value: 'other' },
];

/** 学生类型 */
type StudentType = 'new' | 'old';

/** 表单错误 */
interface FormErrors {
  name?: string;
  phone?: string;
  birthday?: string;
  initHours?: string;
  totalHours?: string;
  usedHours?: string;
  hours?: string;
}

const StudentForm: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';

  // 判断是编辑还是创建
  const { isEdit, studentId } = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    const params = instance?.router?.params || {};
    const mode = params.mode || '';
    const id = decodeURIComponent(params.id || '');
    return { isEdit: mode === 'edit' && Boolean(id), studentId: id };
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

  // Store 实例
  const studentStore = useStudentStore();
  const packageTemplateStore = usePackageTemplateStore();

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

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // 编辑模式：加载已有数据
  useEffect(() => {
    if (!isEdit || !studentId) return;
    studentService.getById(studentId).then((stu) => {
      if (stu) {
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
      }
    });
  }, [isEdit, studentId]);

  // 新建模式：通过 Store 加载课包模板（优先缓存）
  useEffect(() => {
    if (isEdit || !currentUserId) return;
    packageTemplateStore.fetchByTeacher(currentUserId).then((list) => setPackageTemplates(list));
  }, [isEdit, currentUserId]);

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

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, phone, birthday, isEdit, studentType, totalHours, usedHours, initHours]);

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
    if (!validate()) {
      Taro.showToast({ title: '请检查表单中的错误', icon: 'none' });
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
        });
        // 更新 Store 缓存
        if (updated) studentStore.updateInCache(currentUserId, updated);
        Taro.showToast({ title: '更新成功', icon: 'success' });
      } else {
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newStudent = await studentService.create({
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
        });

        if (newStudent) {
          // 更新 Store 缓存
          studentStore.updateInCache(currentUserId, newStudent);

          if (studentType === 'old') {
            const total = parseInt(totalHours) || 0;
            const used = parseInt(usedHours) || 0;
            const remaining = total - used;
            if (total > 0) {
              await packageService.create({
                teacher_id: currentUserId,
                student_id: newStudent.id,
                name: '历史课时导入',
                total_hours: total,
                remaining_hours: remaining,
                status: 'active',
                note: `总${total}课时，已消${used}课时，剩余${remaining}课时`,
              });
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
                status: 'active',
              });
            }
          }
        }

        Taro.showToast({ title: '添加成功', icon: 'success' });
      }

      setTimeout(() => Taro.navigateBack(), 1500);
    } catch (err) {
      logError('save student', err);
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
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
    studentType,
    initHours,
    totalHours,
    usedHours,
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
    setErrors({});
  }, []);

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen pb-[200rpx]" style={{ background: '#F5FAF8' }}>
        {/* ====== 渐变头部（对齐设计稿 .navbar） ====== */}
        <View
          className="bg-gradient-primary rounded-b-[60rpx] shadow-elegant relative overflow-hidden"
          style={{ padding: '48rpx 32rpx 64rpx' }}
        >
          {/* 装饰圆 */}
          <View
            className="absolute top-[32rpx] right-[32rpx] w-[96rpx] h-[96rpx] rounded-full bg-white/10"
            style={{ filter: 'blur(40rpx)' }}
          />
          <View
            className="absolute bottom-0 left-[64rpx] w-[64rpx] h-[64rpx] rounded-full bg-white/10"
            style={{ filter: 'blur(32rpx)' }}
          />
          <View className="relative z-10 flex flex-col items-center">
            <Text className="text-lg font-semibold text-white mb-[8rpx]">
              {isEdit ? '编辑学员' : '添加学员'}
            </Text>
            <Text className="text-sm text-white/70">填写学员基本信息</Text>
          </View>
        </View>

        {/* ====== 头像区（对齐设计稿 .avatar-section） ====== */}
        <View
          className="flex flex-col items-center pt-[16rpx] pb-[8rpx]"
          onClick={handleChooseAvatar}
        >
          {avatarUrl ? (
            <Avatar
              name={name}
              avatarUrl={avatarUrl}
              size="xl"
              className="border-[8rpx] border-white shadow-elegant"
            />
          ) : (
            <View
              className="w-[176rpx] h-[176rpx] rounded-full flex items-center justify-center"
              style={{ background: '#FAFDFB', border: '4rpx dashed #D5E8E0' }}
            >
              {name ? (
                <Text className="text-[64rpx] font-bold text-muted-foreground">{name[0]}</Text>
              ) : (
                <Text className="text-[72rpx] text-primary font-extralight leading-none">+</Text>
              )}
            </View>
          )}
          <Text className="text-sm text-muted-foreground mt-[16rpx]">
            {avatarUrl ? '点击更换头像' : '点击上传头像'}
          </Text>
        </View>

        {/* ====== 表单卡片区域 ====== */}
        <View className="px-[32rpx] flex flex-col gap-[24rpx]">
          {/* ── 1. 基础信息卡 ── */}
          <Card shadow="soft" padding="lg">
            <CardHeader title="基础信息" />
            <View className="flex flex-col gap-[32rpx]">
              <FormInput
                label="学员姓名"
                required
                placeholder="请输入学员姓名"
                value={name}
                onInput={(e) => {
                  setName(e.detail.value || '');
                  clearError('name');
                }}
                error={errors.name}
              />

              {/* 昵称 + 性别 两列（对齐设计稿 .row2） */}
              <View className="flex gap-[24rpx]">
                <View className="flex-1 min-w-0">
                  <FormInput
                    label="昵称"
                    placeholder="选填，如小名或英文名"
                    value={nickname}
                    onInput={(e) => setNickname(e.detail.value || '')}
                  />
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex flex-col mb-0">
                    <View className="flex flex-row items-center gap-1 mb-[12rpx]">
                      <Text className="text-sm text-muted-foreground font-medium">性别</Text>
                    </View>
                    <View className="flex flex-row gap-[20rpx]">
                      {['男', '女'].map((g) => (
                        <View
                          key={g}
                          className={`gender-opt ${gender === g ? 'gender-active' : 'gender-inactive'}`}
                          onClick={() => setGender(gender === g ? '' : g)}
                        >
                          <Text className="text-base">{g === '男' ? '♂' : '♀'}</Text>
                          <Text className="text-sm">{g}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              {/* 生日 + 手机号 两列 */}
              <View className="flex gap-[24rpx]">
                <View className="flex-1 min-w-0">
                  <View className="flex flex-col">
                    <View className="flex flex-row items-center gap-1 mb-[12rpx]">
                      <Text className="text-sm text-muted-foreground font-medium">出生日期</Text>
                    </View>
                    <Picker
                      mode="date"
                      value={birthday || '2015-01-01'}
                      start="1950-01-01"
                      end={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        setBirthday(e.detail.value);
                        clearError('birthday');
                      }}
                    >
                      <View className="w-full py-[22rpx] px-[28rpx] rounded-2xl border-[2rpx] border-solid border-border bg-background flex flex-row items-center justify-between">
                        <Text
                          className={
                            birthday
                              ? 'text-base text-foreground'
                              : 'text-base text-muted-foreground/60'
                          }
                        >
                          {birthday || '请选择'}
                        </Text>
                        <Icon name="mdi-calendar" size="sm" color="muted" />
                      </View>
                    </Picker>
                    {errors.birthday && (
                      <View className="flex flex-row items-center gap-1 mt-[8rpx]">
                        <View className="w-[28rpx] h-[28rpx] rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
                          <Text className="text-white text-[20rpx] font-bold leading-none">!</Text>
                        </View>
                        <Text className="text-xs text-destructive">{errors.birthday}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View className="flex-1 min-w-0">
                  <FormInput
                    label="手机号"
                    placeholder="11位手机号"
                    type="number"
                    maxlength={11}
                    value={phone}
                    onInput={(e) => {
                      setPhone(e.detail.value || '');
                      clearError('phone');
                    }}
                    error={errors.phone}
                  />
                </View>
              </View>
            </View>
          </Card>

          {/* ── 2. 联系信息卡 ── */}
          <Card shadow="soft" padding="lg">
            <CardHeader title="联系信息" dotColor="info" />
            <View className="flex flex-col gap-[32rpx]">
              <FormInput
                label="家庭地址"
                placeholder="请输入家庭地址（选填）"
                value={address}
                onInput={(e) => setAddress(e.detail.value || '')}
              />
              <View className="flex flex-col">
                <View className="flex flex-row items-center gap-1 mb-[12rpx]">
                  <Text className="text-sm text-muted-foreground font-medium">联系方式</Text>
                </View>
                <ContactList contacts={contacts} onChange={setContacts} maxCount={3} />
              </View>
            </View>
          </Card>

          {/* ── 3. 课时设置卡（仅新建模式） ── */}
          {!isEdit && (
            <Card shadow="soft" padding="lg">
              <CardHeader title="课时设置" subtitle="仅新建时填写" dotColor="warning" />
              <View className="flex flex-col gap-[32rpx]">
                {/* 提示条（对齐设计稿 .info-hint） */}
                <View
                  className={`flex flex-row items-center gap-[12rpx] py-[16rpx] px-[20rpx] rounded-xl ${studentType === 'old' ? 'bg-warning-bg' : 'bg-primary-bg'}`}
                >
                  <Icon
                    name="mdi-information-outline"
                    size="sm"
                    color={studentType === 'old' ? 'warning' : 'primary'}
                  />
                  <Text
                    className={`text-xs font-medium leading-relaxed ${studentType === 'old' ? 'text-amber' : 'text-primary'}`}
                  >
                    {studentType === 'new'
                      ? '新生从零开始记录课时，老生需录入已有课时数据'
                      : '请准确录入老生的总课时和已消课时，系统将自动计算剩余'}
                  </Text>
                </View>

                {/* 学生类型选择器 */}
                <SegmentedControl
                  options={[
                    { label: '新生', value: 'new' },
                    { label: '老生', value: 'old' },
                  ]}
                  value={studentType}
                  onChange={(v) => {
                    setStudentType(v as StudentType);
                    setSelectedPackageId('');
                  }}
                />

                {/* 新生：课包选择 + 初始课时 */}
                {studentType === 'new' && (
                  <View className="flex flex-col gap-[32rpx]">
                    {/* 课包选择行 */}
                    {packageTemplates.length > 0 && (
                      <View className="flex flex-col">
                        <View className="flex flex-row items-center gap-1 mb-[12rpx]">
                          <Text className="text-sm text-muted-foreground font-medium">
                            选择课包
                          </Text>
                          <Text className="text-xs text-muted-foreground/60">
                            （选填，自动填充课时和金额）
                          </Text>
                        </View>
                        <View
                          className="w-full py-[22rpx] px-[28rpx] rounded-2xl border-[2rpx] border-solid border-border bg-background flex flex-row items-center justify-between"
                          onClick={() => setShowPackagePicker(true)}
                        >
                          <Text
                            className={
                              selectedPackage
                                ? 'text-base text-foreground'
                                : 'text-base text-muted-foreground/60'
                            }
                          >
                            {selectedPackage ? selectedPackage.name : '请选择课包'}
                          </Text>
                          <View className="flex flex-row items-center gap-2">
                            {selectedPackage && (
                              <Text className="text-sm text-primary">
                                {selectedPackage.lesson_count}课时 / ¥{selectedPackage.price}
                              </Text>
                            )}
                            <Text className="text-muted-foreground text-sm">›</Text>
                          </View>
                        </View>
                      </View>
                    )}
                    <FormInput
                      label="初始课时"
                      required
                      placeholder="例如：20"
                      type="number"
                      value={initHours}
                      onInput={(e) => {
                        setInitHours(e.detail.value || '');
                        setSelectedPackageId('');
                        clearError('initHours');
                      }}
                      error={errors.initHours}
                    />
                  </View>
                )}

                {/* 老生：历史课时 */}
                {studentType === 'old' && (
                  <View className="flex flex-col gap-[32rpx]">
                    <View className="flex gap-[24rpx]">
                      <View className="flex-1 min-w-0">
                        <FormInput
                          label="总充值课时"
                          required
                          placeholder="例如：40"
                          type="number"
                          value={totalHours}
                          onInput={(e) => {
                            setTotalHours(e.detail.value || '');
                            clearError('totalHours');
                            clearError('hours');
                          }}
                          error={errors.totalHours}
                        />
                      </View>
                      <View className="flex-1 min-w-0">
                        <FormInput
                          label="已消课时"
                          required
                          placeholder="例如：12"
                          type="number"
                          value={usedHours}
                          onInput={(e) => {
                            setUsedHours(e.detail.value || '');
                            clearError('usedHours');
                            clearError('hours');
                          }}
                          error={errors.usedHours || errors.hours}
                        />
                      </View>
                    </View>
                    {/* 剩余课时计算标签（对齐设计稿 .calc-row） */}
                    {(totalHours || usedHours) && (
                      <View className="flex flex-row items-center gap-[16rpx]">
                        <View className="flex flex-row items-center gap-[8rpx] py-[10rpx] px-[24rpx] rounded-md bg-primary-bg">
                          <Text className="text-xs font-semibold text-primary">
                            剩余课时：{remainingHours}
                          </Text>
                        </View>
                        {totalHours && parseInt(totalHours) > 0 && (
                          <View className="flex flex-row items-center gap-[8rpx] py-[10rpx] px-[24rpx] rounded-md bg-info-bg">
                            <Text className="text-xs font-semibold text-info">
                              已用比例：
                              {Math.round(
                                (parseInt(usedHours || '0') / parseInt(totalHours)) * 100,
                              )}
                              %
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Card>
          )}

          {/* ── 4. 缴费信息卡 ── */}
          <Card shadow="soft" padding="lg">
            <CardHeader title="缴费信息" dotColor="accent" />
            <View className="flex flex-col gap-[32rpx]">
              {/* 金额输入（对齐设计稿 .amount-input-wrap） */}
              <FormInput
                label="缴费金额"
                placeholder="0.00"
                type="digit"
                value={feeAmount}
                onInput={(e) => {
                  // 只允许数字和一个小数点
                  const raw = e.detail.value || '';
                  const filtered = raw
                    .replace(/[^\d.]/g, '')
                    .replace(/^(\d*\.)(.*)$/, (_, a, b) => a + b.replace(/\./g, ''));
                  setFeeAmount(filtered);
                }}
                prefix="¥"
              />

              {/* 支付方式 */}
              <View className="flex flex-col">
                <View className="flex flex-row items-center gap-1 mb-[16rpx]">
                  <Text className="text-sm text-muted-foreground font-medium">支付方式</Text>
                </View>
                <ChipPicker
                  options={FEE_METHOD_OPTIONS}
                  value={feeMethod}
                  onChange={(val) => setFeeMethod(val as string)}
                />
                {/* "其他"选中时展开自定义输入 */}
                {feeMethod === 'other' && (
                  <View className="mt-[20rpx]">
                    <FormInput
                      placeholder="请填写具体支付方式"
                      value={feeMethodOther}
                      onInput={(e) => setFeeMethodOther(e.detail.value || '')}
                    />
                  </View>
                )}
              </View>

              {/* 分期付款开关（对齐设计稿 .installment-toggle） */}
              <View className="flex flex-row items-center justify-between py-[28rpx] border-t border-border/30 mt-[28rpx]">
                <View className="flex flex-col">
                  <Text className="text-sm font-semibold text-foreground">分期付款</Text>
                  <Text className="text-xs text-muted-foreground/60 mt-[4rpx]">
                    {!feeAmount || parseFloat(feeAmount) <= 0
                      ? '请先填写缴费金额'
                      : '金额较大时可选择分期支付'}
                  </Text>
                </View>
                <View
                  className={`w-[96rpx] h-[56rpx] rounded-full p-[6rpx] ${installmentEnabled ? 'bg-primary' : 'bg-border'} ${!feeAmount || parseFloat(feeAmount) <= 0 ? 'opacity-40' : ''}`}
                  onClick={() => {
                    if (!feeAmount || parseFloat(feeAmount) <= 0) {
                      Taro.showToast({ title: '请先填写缴费金额', icon: 'none' });
                      return;
                    }
                    setInstallmentEnabled(!installmentEnabled);
                  }}
                >
                  <View
                    className={`w-[44rpx] h-[44rpx] rounded-full bg-white shadow-card ${installmentEnabled ? 'translate-x-[40rpx]' : ''}`}
                    style={{ transition: 'transform 0.25s ease' }}
                  />
                </View>
              </View>

              {/* 分期面板 */}
              <InstallmentPanel
                totalAmount={feeAmount}
                enabled={installmentEnabled}
                onToggle={setInstallmentEnabled}
                periodCount={installmentPeriod}
                onPeriodChange={setInstallmentPeriod}
                schedule={schedule}
                onScheduleChange={setSchedule}
              />
            </View>
          </Card>

          {/* ── 5. 备注卡 ── */}
          <Card shadow="soft" padding="lg">
            <CardHeader title="备注" dotColor="muted" />
            <FormInput
              placeholder="学员特殊情况、过敏史、家长接送要求等..."
              value={note}
              onInput={(e) => setNote(e.detail.value || '')}
              multiline
              maxlength={200}
              minHeight="100rpx"
            />
          </Card>
        </View>

        {/* ====== 底部按钮栏（对齐设计稿 .btn-bar） ====== */}
        <View
          className="fixed bottom-0 left-0 right-0 flex flex-row gap-[20rpx] px-[32rpx] pt-[20rpx] bg-white/98 border-t border-border/30"
          style={{
            paddingBottom: 'calc(20rpx + env(safe-area-inset-bottom))',
            backdropFilter: 'blur(8px)',
          }}
        >
          {!isEdit && (
            <View
              className="flex-1 h-[96rpx] rounded-full border-[2rpx] border-solid border-border bg-white flex items-center justify-center"
              onClick={handleReset}
            >
              <Text className="text-base font-semibold text-foreground">重置</Text>
            </View>
          )}
          <View
            className={`flex-1 h-[96rpx] rounded-full flex items-center justify-center ${!name.trim() || saving ? 'bg-muted' : 'bg-gradient-primary-dark'}`}
            style={
              !name.trim() || saving ? {} : { boxShadow: '0 12rpx 40rpx rgba(94,200,168,0.30)' }
            }
            onClick={handleSave}
          >
            <Text
              className={`text-base font-semibold ${!name.trim() || saving ? 'text-muted-foreground' : 'text-white'}`}
            >
              {isEdit ? '更新' : '保存学员'}
            </Text>
          </View>
        </View>

        {/* ====== 课包选择弹窗 ====== */}
        <BottomSheet
          show={showPackagePicker}
          visible={showPackagePicker}
          title="选择课包"
          onClose={() => setShowPackagePicker(false)}
          maxHeight="70vh"
        >
          <View className="px-10 pb-10">
            {packageTemplates.map((tpl) => {
              const isSelected = selectedPackageId === tpl.id;
              return (
                <View
                  key={tpl.id}
                  className={`flex items-center gap-5 p-[28rpx] rounded-[24rpx] border-[3rpx] mb-4 shadow-soft ${isSelected ? 'border-primary bg-primary-5' : 'border-input bg-white/50'}`}
                  onClick={() => {
                    if (selectedPackageId === tpl.id) {
                      setSelectedPackageId('');
                    } else {
                      setSelectedPackageId(tpl.id);
                      setInitHours(String(tpl.lesson_count));
                      setFeeAmount(String(tpl.price));
                    }
                    setShowPackagePicker(false);
                  }}
                >
                  <View
                    className="w-[84rpx] h-[84rpx] rounded-[20rpx] flex items-center justify-center flex-shrink-0"
                    style={{ background: '#5EC8A820' }}
                  >
                    <Text className="text-[40rpx]">📚</Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[28rpx] font-semibold text-foreground block">
                      {tpl.name}
                    </Text>
                    <View className="flex gap-2 mt-2">
                      <View className="py-1 px-3 rounded-sm bg-primary-15">
                        <Text className="text-[20rpx] text-primary font-medium">
                          {tpl.lesson_count}课时
                        </Text>
                      </View>
                      {tpl.valid_days ? (
                        <View className="py-1 px-3 rounded-sm bg-amber-15">
                          <Text className="text-[20rpx] text-amber font-medium">
                            {tpl.valid_days}天
                          </Text>
                        </View>
                      ) : (
                        <View className="py-1 px-3 rounded-sm bg-purple-15">
                          <Text className="text-[20rpx] text-purple font-medium">永久</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className="flex flex-col items-end gap-3 flex-shrink-0">
                    {tpl.price > 0 && (
                      <Text className="text-[30rpx] font-bold text-primary">¥{tpl.price}</Text>
                    )}
                    <View
                      className={`w-[40rpx] h-[40rpx] rounded-full border-[4rpx] flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-input'}`}
                    >
                      {isSelected && <Text className="text-[20rpx] text-white">✓</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
            {packageTemplates.length === 0 && (
              <View className="py-[48rpx] flex flex-col items-center">
                <Text className="text-sm text-muted-foreground">暂无可用课包</Text>
              </View>
            )}
          </View>
        </BottomSheet>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(StudentForm);
