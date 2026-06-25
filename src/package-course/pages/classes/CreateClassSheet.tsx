import { View, Text, Picker, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import SheetInput, { SheetPickerItem, SheetSelectItem, SheetTag } from '@/components/SheetInput';
import type { ClassColor, ClassIcon, ClassType, TeachMode } from '@/types/class';
import type { CoursePackageTemplate } from '@/types/course-package';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { WEEKDAYS, TEACH_MODES, PACKAGE_TYPE_LABELS, CLASS_ICONS, CLASS_GRADIENT } from './useClasses';

interface CreateClassSheetProps {
  show: boolean;
  visible: boolean;
  onClose: () => void;
  // 表单
  name: string;
  setName: (v: string) => void;
  classType: ClassType;
  setClassType: (v: ClassType) => void;
  teachMode: TeachMode;
  setTeachMode: (v: TeachMode) => void;
  weekdays: string[];
  toggleWeekday: (day: string) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  teachers: string[];
  toggleTeacher: (t: string) => void;
  teacherOptions: TeacherUIModel[];
  selectedStudentIds: string[];
  scheduleText: string;
  saving: boolean;
  canCreate: boolean;
  submitBlockedReason: string;
  handleCreate: () => void;
  // 课程包
  selectedPackageId: string;
  setSelectedPackageId: (v: string) => void;
  packageTemplates: CoursePackageTemplate[];
  showPackagePicker: boolean;
  setShowPackagePicker: (v: boolean) => void;
  packagePickerVisible: boolean;
  setPackagePickerVisible: (v: boolean) => void;
  // 学员选择器
  showStudentPicker: boolean;
  pickerVisible: boolean;
  openStudentPicker: () => void;
  closeStudentPicker: () => void;
  pickerSearch: string;
  setPickerSearch: (v: string) => void;
  pickerTempIds: string[];
  togglePickerStudent: (id: string) => void;
  confirmStudentPicker: () => void;
  filteredStudents: Student[];
  color: ClassColor;
  setColor: (v: ClassColor) => void;
  icon: ClassIcon;
  setIcon: (v: ClassIcon) => void;
}

/** 创建班级弹窗（含课程包选择器、学员选择器） */
const CreateClassSheet: React.FC<CreateClassSheetProps> = ({
  show,
  visible,
  onClose,
  name,
  setName,
  classType,
  setClassType,
  teachMode,
  setTeachMode,
  weekdays,
  toggleWeekday,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  teachers,
  toggleTeacher,
  teacherOptions,
  selectedStudentIds,
  scheduleText,
  saving,
  canCreate,
  submitBlockedReason,
  handleCreate,
  selectedPackageId,
  setSelectedPackageId,
  packageTemplates,
  showPackagePicker,
  setShowPackagePicker,
  packagePickerVisible,
  setPackagePickerVisible,
  showStudentPicker,
  pickerVisible,
  openStudentPicker,
  closeStudentPicker,
  pickerSearch,
  setPickerSearch,
  pickerTempIds,
  togglePickerStudent,
  confirmStudentPicker,
  filteredStudents,
  color,
  setColor,
  icon,
  setIcon,
}) => {
  if (!show) return null;

  return (
    <View className="fixed inset-0 z-100">
      {/* 遮罩层 */}
      <View
        className={`absolute inset-0 transition-colors duration-300 ${visible ? 'bg-black/45' : 'bg-transparent'}`}
        onClick={saving ? undefined : onClose}
      />

      {/* 弹窗主体 */}
      <View
        className={`absolute bottom-0 left-0 right-0 rounded-t-[40rpx] px-10 pt-10 pb-[68rpx] transition-transform duration-300 ease-in-out max-h-[90vh] overflow-y-auto bg-white ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Handle */}
        <View className="w-[72rpx] h-[8rpx] rounded-full mx-auto mb-8 bg-d5e8e0" />

        {/* 标题 */}
        <View className="text-[32rpx] font-semibold text-foreground mb-8">创建班级</View>

        {/* 班级名称 */}
        <View className="mb-7">
          <View className="text-sm text-muted-foreground mb-3 font-medium">班级名称</View>
          <SheetInput
            placeholder="如：钢琴基础班"
            value={name}
            onInput={(e: { detail: { value?: string } }) => setName(e.detail.value || '')}
          />
        </View>

        {/* 班级头像 */}
        <View className="mb-7">
          <View className="text-sm text-muted-foreground mb-3 font-medium">班级头像</View>
          <View className="flex flex-wrap gap-3">
            {(Object.keys(CLASS_ICONS) as ClassIcon[]).map((key) => {
              const selected = icon === key;
              return (
                <View
                  key={key}
                  className={`w-[88rpx] h-[88rpx] rounded-[20rpx] flex items-center justify-center border-[2rpx] border-transparent ${selected ? 'ring-[6rpx] ring-primary border-primary' : ''}`}
                  onClick={() => setIcon(key)}
                >
                  <Icon name={CLASS_ICONS[key]} size={40} color={selected ? 'primary' : 'mutedForeground'} />
                </View>
              );
            })}
          </View>
        </View>

        {/* 班级颜色 */}
        <View className="mb-7">
          <View className="text-sm text-muted-foreground mb-3 font-medium">主题颜色</View>
          <View className="flex gap-3 flex-wrap">
            {(Object.keys(CLASS_GRADIENT) as ClassColor[]).map((c) => {
              const selected = color === c;
              return (
                <View
                  key={c}
                  className={`w-[88rpx] h-[88rpx] rounded-[20rpx] flex items-center justify-center relative ${CLASS_GRADIENT[c]} ${selected ? 'ring-[6rpx] ring-foreground ring-offset-[4rpx]' : 'opacity-65'}`}
                  onClick={() => setColor(c)}
                >
                  <Icon name={CLASS_ICONS[icon]} size={40} color="white" />
                </View>
              );
            })}
          </View>
        </View>

        {/* 授课模式 */}
        <View className="mb-7">
          <View className="text-sm text-muted-foreground mb-3 font-medium">授课模式</View>
          <View className="flex gap-3">
            {TEACH_MODES.map((m) => {
              const selected = teachMode === m.key;
              return (
                <View key={m.key}>
                  <SheetTag selected={selected} onClick={() => setTeachMode(m.key)}>
                    {m.label}
                  </SheetTag>
                </View>
              );
            })}
          </View>
        </View>

        {/* 上课类型 */}
        <View className="mb-7">
          <View className="text-sm text-muted-foreground mb-3 font-medium">上课类型</View>
          <View className="flex gap-3">
            <View>
              <SheetTag
                selected={classType === 'unlimited'}
                onClick={() => setClassType('unlimited')}
              >
                循环上课
              </SheetTag>
            </View>
            <View>
              <SheetTag selected={classType === 'limited'} onClick={() => setClassType('limited')}>
                课时制
              </SheetTag>
            </View>
          </View>
        </View>

        {/* 关联课程包（仅课时制） */}
        {classType === 'limited' && (
          <View className="mb-7">
            <View className="text-sm text-muted-foreground mb-3 font-medium">关联课程包</View>
            <SheetSelectItem
              onClick={() => {
                setShowPackagePicker(true);
                setTimeout(() => setPackagePickerVisible(true), 50);
              }}
            >
              {selectedPackageId ? (
                (() => {
                  const pkg = packageTemplates.find((p) => p.id === selectedPackageId);
                  return pkg ? (
                    <>
                      <View className="flex-1">
                        <View className="text-md font-medium text-foreground">{pkg.name}</View>
                        <View className="text-[20rpx] text-muted-foreground mt-1">
                          ¥{pkg.price} · {pkg.lesson_count}课时 · {pkg.duration}分钟
                        </View>
                      </View>
                      <Text className="text-sm text-muted-foreground">✕</Text>
                    </>
                  ) : null;
                })()
              ) : (
                <>
                  <Text className="text-md text-muted-foreground">选择课程包</Text>
                  <Text className="ml-auto text-sm text-muted-foreground">›</Text>
                </>
              )}
            </SheetSelectItem>
            {packageTemplates.length === 0 && (
              <View
                className="mt-4 text-sm text-primary font-medium py-5 px-6 rounded-[24rpx] border-[2rpx] border-dashed border-primary bg-primary-bg text-center"
                onClick={() =>
                  Taro.navigateTo({ url: '/package-course/pages/course-packages/index' })
                }
              >
                + 快捷添加课程包
              </View>
            )}
          </View>
        )}

        {/* 上课时间 */}
        <View className="mb-7">
          <View className="text-sm text-muted-foreground mb-3 font-medium">上课时间</View>
          <View className="flex gap-3 flex-wrap">
            {WEEKDAYS.map((day) => {
              const selected = weekdays.includes(day);
              return (
                <View
                  key={day}
                  className={`w-[76rpx] h-[76rpx] rounded-full border-[4rpx] flex items-center justify-center text-sm font-semibold ${selected ? 'border-primary bg-primary text-white' : 'text-muted-foreground'}`}
                  style={
                    selected ? undefined : { backgroundColor: '#f5faf8', borderColor: '#D5E8E0' }
                  }
                  onClick={() => toggleWeekday(day)}
                >
                  {day}
                </View>
              );
            })}
          </View>
          <View className="flex gap-4 items-center mt-5">
            <View className="flex-1 min-w-0">
              <Picker mode="time" value={startTime} onChange={(e) => setStartTime(e.detail.value)}>
                <SheetPickerItem>{startTime}</SheetPickerItem>
              </Picker>
            </View>
            <View className="text-md text-muted-foreground flex-shrink-0">—</View>
            <View className="flex-1 min-w-0">
              <Picker mode="time" value={endTime} onChange={(e) => setEndTime(e.detail.value)}>
                <SheetPickerItem>{endTime}</SheetPickerItem>
              </Picker>
            </View>
          </View>
          {scheduleText && (
            <View className="mt-4 text-sm text-primary font-medium py-3 px-5 bg-primary-bg rounded-lg">
              {scheduleText}
            </View>
          )}
        </View>

        {/* 上课日期范围（仅课时制） */}
        {classType === 'limited' && (
          <View className="mb-7">
            <View className="text-sm text-muted-foreground mb-3 font-medium">上课日期范围</View>
            <View className="flex gap-4">
              <View className="flex-1 min-w-0">
                <Picker
                  mode="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.detail.value)}
                >
                  <SheetPickerItem className={startDate ? '' : 'text-muted-foreground'}>
                    {startDate || '开始日期'}
                  </SheetPickerItem>
                </Picker>
              </View>
              <View className="flex-1 min-w-0">
                <Picker mode="date" value={endDate} onChange={(e) => setEndDate(e.detail.value)}>
                  <SheetPickerItem className={endDate ? '' : 'text-muted-foreground'}>
                    {endDate || '结束日期'}
                  </SheetPickerItem>
                </Picker>
              </View>
            </View>
          </View>
        )}

        {/* 授课老师 */}
        <View className="mb-7">
          <View className="text-sm text-muted-foreground mb-3 font-medium">授课老师</View>
          <View className="flex gap-4 flex-wrap">
            {teacherOptions.map((t) => {
              const selected = teachers.includes(t.id);
              return (
                <View key={t.id}>
                  <SheetTag selected={selected} onClick={() => toggleTeacher(t.id)}>
                    {t.name}
                  </SheetTag>
                </View>
              );
            })}
          </View>
        </View>

        {/* 添加学员 */}
        <View className="mb-7">
          <View className="text-sm text-muted-foreground mb-3 font-medium">添加学员</View>
          <SheetSelectItem dashed onClick={openStudentPicker}>
            <Text className="text-[26rpx] text-primary">👤</Text>
            <Text className="text-[26rpx] text-muted-foreground">选择学员</Text>
            {selectedStudentIds.length > 0 && (
              <View className="ml-auto text-xs font-semibold text-primary bg-primary-bg py-1 px-4 rounded-xl">
                {selectedStudentIds.length}人
              </View>
            )}
          </SheetSelectItem>
        </View>

        {/* 确认按钮 */}
        {!canCreate && submitBlockedReason ? (
          <View className="mb-3 text-sm text-muted-foreground">{submitBlockedReason}</View>
        ) : null}
        <View
          className={`w-full py-6 rounded-[28rpx] border-none text-[30rpx] font-semibold text-center mt-4 ${canCreate ? 'bg-gradient-primary text-white' : 'bg-gray-300 text-muted-foreground'}`}
          onClick={canCreate ? handleCreate : undefined}
        >
          {saving ? '创建中...' : '确认创建'}
        </View>
      </View>

      {/* ===== 学员选择器弹窗 ===== */}
      {showStudentPicker && (
        <View
          className={`fixed inset-0 z-200 transition-colors duration-300 ${pickerVisible ? 'bg-black/45' : 'bg-transparent'}`}
        >
          <View
            className={`absolute inset-0 ${pickerVisible ? 'bottom-[75%]' : 'bottom-full'}`}
            onClick={closeStudentPicker}
          />
          <View
            className={`absolute bottom-0 left-0 right-0 rounded-t-[40rpx] max-h-[75vh] flex flex-col transition-transform duration-300 ease-in-out bg-white ${pickerVisible ? 'translate-y-0' : 'translate-y-full'}`}
          >
            <View className="py-8 px-10 flex items-center justify-between border-b-d5e8e0">
              <Text className="text-[32rpx] font-semibold text-foreground">选择学员</Text>
              <View
                className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center"
                onClick={closeStudentPicker}
              >
                <Text className="text-sm text-muted-foreground">✕</Text>
              </View>
            </View>
            <View className="px-10 pt-6">
              <SheetInput
                placeholder="搜索学员姓名..."
                value={pickerSearch}
                onInput={(e: { detail: { value?: string } }) =>
                  setPickerSearch(e.detail.value || '')
                }
              />
            </View>
            <ScrollView scrollY className="flex-1 px-10 py-4 max-h-[50vh]">
              {filteredStudents.map((stu) => {
                const checked = pickerTempIds.includes(stu.id);
                return (
                  <View
                    key={stu.id}
                    className="flex items-center gap-5 py-5 border-b-e8e8e8"
                    onClick={() => togglePickerStudent(stu.id)}
                  >
                    <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="md" />
                    <View className="flex-1">
                      <View className="text-[26rpx] font-medium text-foreground">{stu.name}</View>
                      {stu.phone && (
                        <View className="text-[20rpx] text-muted-foreground mt-0_d5">
                          {stu.phone}
                        </View>
                      )}
                    </View>
                    <View
                      className={`w-[44rpx] h-[44rpx] rounded-md border-[4rpx] flex items-center justify-center flex-shrink-0 ${checked ? 'border-primary bg-primary' : 'bg-transparent'}`}
                      style={checked ? undefined : { borderColor: '#D5E8E0' }}
                    >
                      {checked && <Text className="text-[28rpx] text-white font-bold">✓</Text>}
                    </View>
                  </View>
                );
              })}
              {filteredStudents.length === 0 && (
                <View className="py-20 text-center">
                  <Text className="text-[26rpx] text-muted-foreground">暂无匹配学员</Text>
                </View>
              )}
            </ScrollView>
            <View className="py-6 px-10 pb-[68rpx] flex items-center gap-5 border-t-d5e8e0">
              <Text className="text-[26rpx] text-muted-foreground flex-1">
                已选 <Text className="text-primary font-semibold">{pickerTempIds.length}</Text> 人
              </Text>
              <View
                className="py-5 px-12 rounded-[28rpx] bg-gradient-primary text-white text-md font-semibold"
                onClick={confirmStudentPicker}
              >
                确认添加
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ===== 课程包选择器弹窗 ===== */}
      {showPackagePicker && (
        <View
          className={`fixed inset-0 z-200 transition-colors duration-300 ${packagePickerVisible ? 'bg-black/45' : 'bg-transparent'}`}
        >
          <View
            className={`absolute inset-0 ${packagePickerVisible ? 'bottom-[70%]' : 'bottom-full'}`}
            onClick={() => {
              setPackagePickerVisible(false);
              setTimeout(() => setShowPackagePicker(false), 300);
            }}
          />
          <View
            className={`absolute bottom-0 left-0 right-0 rounded-t-[40rpx] max-h-[70vh] flex flex-col transition-transform duration-300 ease-in-out bg-white ${packagePickerVisible ? 'translate-y-0' : 'translate-y-full'}`}
          >
            <View className="py-8 px-10 flex items-center justify-between border-b-d5e8e0">
              <Text className="text-[32rpx] font-semibold text-foreground">选择课程包</Text>
              <View
                className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center"
                onClick={() => {
                  setPackagePickerVisible(false);
                  setTimeout(() => setShowPackagePicker(false), 300);
                }}
              >
                <Text className="text-sm text-muted-foreground">✕</Text>
              </View>
            </View>
            <ScrollView scrollY className="flex-1 px-10 py-6 max-h-[50vh]">
              {packageTemplates.map((pkg) => {
                const selected = selectedPackageId === pkg.id;
                const typeLabel = PACKAGE_TYPE_LABELS[pkg.type] || '课时包';
                return (
                  <View
                    key={pkg.id}
                    className={`py-6 rounded-[24rpx] mb-4 border-[4rpx] ${selected ? 'border-primary bg-primary-bg' : ''}`}
                    style={
                      selected ? undefined : { backgroundColor: '#f5faf8', borderColor: '#D5E8E0' }
                    }
                    onClick={() => setSelectedPackageId(selected ? '' : pkg.id)}
                  >
                    <View className="flex items-center justify-between">
                      <View className="flex-1">
                        <View className="flex items-center gap-3">
                          <Text className="text-md font-semibold text-foreground">{pkg.name}</Text>
                          <View className="text-[20rpx] text-primary bg-primary-bg py-0_d5 px-3 rounded-lg font-medium">
                            {typeLabel}
                          </View>
                        </View>
                        <View className="text-[22rpx] text-muted-foreground mt-2">
                          ¥{pkg.price} · {pkg.lesson_count}课时 · {pkg.duration}分钟/节
                        </View>
                        {pkg.description && (
                          <View className="text-[20rpx] text-muted-foreground mt-1">
                            {pkg.description}
                          </View>
                        )}
                      </View>
                      {selected && <Text className="text-[32rpx] text-primary font-bold">✓</Text>}
                    </View>
                  </View>
                );
              })}
              {packageTemplates.length === 0 && (
                <View className="py-20 text-center">
                  <Text className="text-[26rpx] text-muted-foreground block mb-6">暂无课程包</Text>
                  <View
                    className="text-[26rpx] text-primary font-medium py-4 px-8 rounded-[28rpx] bg-primary-bg inline-block"
                    onClick={() =>
                      Taro.navigateTo({ url: '/package-course/pages/course-packages/index' })
                    }
                  >
                    去添加课程包
                  </View>
                </View>
              )}
            </ScrollView>
            <View className="py-6 px-10 pb-[68rpx] flex gap-4 border-t-d5e8e0">
              <View
                className="flex-1 py-5 rounded-[28rpx] text-muted-foreground text-md font-medium text-center bg-f5faf8 border-d5e8e0"
                onClick={() =>
                  Taro.navigateTo({ url: '/package-course/pages/course-packages/index' })
                }
              >
                + 新建课程包
              </View>
              <View
                className="flex-1 py-5 rounded-[28rpx] bg-gradient-primary text-white text-md font-semibold text-center"
                onClick={() => {
                  setPackagePickerVisible(false);
                  setTimeout(() => setShowPackagePicker(false), 300);
                }}
              >
                确认
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default CreateClassSheet;
