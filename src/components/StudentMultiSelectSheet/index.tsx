/**
 * StudentMultiSelectSheet - 学员多选底部弹窗
 *
 * 用于班课等场景从学员列表中多选学员，支持：
 * - 按姓名/手机号搜索
 * - 按科目筛选（基于学员课包的 subject_id），未关联科目时托底「全部科目」
 * - 功能性快捷查看标签：「未排班」(class_ids 为空) 与「已勾选」(当前选中)
 * - 弹窗拉满屏幕（fillHeight），列表内部滚动，确认按钮固定底部始终可点击
 * - 勾选框在右侧；超出容纳上限时直接禁止勾选并 toast 提醒，不再允许超额
 * - 学员行展示对应科目的会员卡（多卡折叠，点击展开查看，仅显示卡名），课时信息精简
 * - 确认后回调选中 ID 列表
 */
import { Input, ScrollView, View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import type { Subject } from '@/types/campus';
import type { Student } from '@/types/student';

export interface StudentMultiSelectSheetProps {
  /** 弹窗显隐 */
  visible: boolean;
  /** 可选学员列表 */
  students: Student[];
  /** 已选学员 ID 列表 */
  selectedIds: string[];
  /** 加载中 */
  loading?: boolean;
  /** 弹窗标题 */
  title?: string;
  /** 当前课程关联的科目 ID，用于默认筛选；未关联（空或不命中）时托底「全部科目」 */
  subjectId?: string;
  /** 科目列表，用于筛选器展示 */
  subjects?: Subject[];
  /** 最大可选人数（留空/0 表示不限制） */
  maxSelectable?: number;
  /** 关闭 */
  onClose: () => void;
  /** 确认选择 */
  onConfirm: (ids: string[]) => void;
}

const ALL_SUBJECT_VALUE = 'all';

/** 解析出「有效」的关联科目 ID：空值或不在科目列表中的一律视为未关联 */
const resolveEffectiveSubjectId = (subjectId?: string, subjects: Subject[] = []) =>
  subjectId && subjects.some((s) => s.id === subjectId) ? subjectId : undefined;

/** 计算与当前科目筛选匹配的会员卡（无科目约束/通用卡始终匹配） */
const getRelevantPackages = (student: Student, filterSubjectId: string) => {
  const packages = student.course_packages || [];
  if (filterSubjectId === ALL_SUBJECT_VALUE) return packages;
  return packages.filter((pkg) => !pkg.subject_id || pkg.subject_id === filterSubjectId);
};

/** 单个学员行：勾选框在右，展示对应科目会员卡（多卡可展开），课时信息精简 */
const StudentRow: React.FC<{
  student: Student;
  checked: boolean;
  disabled: boolean;
  filterSubjectId: string;
  onToggle: () => void;
}> = ({ student, checked, disabled, filterSubjectId, onToggle }) => {
  const [expanded, setExpanded] = useState(false);

  const packages = useMemo(
    () => getRelevantPackages(student, filterSubjectId),
    [student, filterSubjectId],
  );
  const totalRemaining = useMemo(
    () => (student.course_packages || []).reduce((sum, pkg) => sum + (pkg.remaining_hours || 0), 0),
    [student.course_packages],
  );

  return (
    <View
      className="flex flex-row items-center gap-[20rpx] px-[16rpx] py-[28rpx] press-bg border-b-[2rpx] border-border/40"
      onClick={onToggle}
    >
      {/* 头像 */}
      <Avatar name={student.name} avatarUrl={student.avatar_url} size="lg" />

      {/* 学员信息（会员卡 + 课时，精简） */}
      <View className="flex-1 min-w-0 flex flex-col gap-[10rpx]">
        <View className="flex flex-row items-center gap-[12rpx]">
          <Text className="text-[30rpx] font-medium text-foreground truncate">{student.name}</Text>
          {student.nickname && (
            <Text className="text-[24rpx] text-muted-foreground truncate max-w-[200rpx]">
              {student.nickname}
            </Text>
          )}
        </View>

        {/* 会员卡：对应科目，多卡折叠，点击展开仅看卡名 */}
        <View className="flex flex-row items-center gap-[8rpx] flex-wrap">
          {packages.length === 0 ? (
            <Text className="text-[22rpx] text-muted-foreground/70">无会员卡</Text>
          ) : (
            <>
              <View className="px-[12rpx] py-[4rpx] rounded-[8rpx] bg-primary/10">
                <Text className="text-[22rpx] text-primary">{packages[0].name}</Text>
              </View>
              {packages.length > 1 && (
                <View
                  className="flex flex-row items-center gap-[2rpx] px-[12rpx] py-[4rpx] rounded-[8rpx] bg-muted active:opacity-70"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((prev) => !prev);
                  }}
                >
                  <Text className="text-[22rpx] text-muted-foreground">等{packages.length}张</Text>
                  <Icon
                    name={expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                    size={20}
                    color="mutedForeground"
                  />
                </View>
              )}
            </>
          )}
          {/* 课时信息：极简 */}
          <Text
            className={cn(
              'text-[22rpx]',
              totalRemaining > 0 ? 'text-muted-foreground' : 'text-muted-foreground/70',
            )}
          >
            {totalRemaining} 课时
          </Text>
        </View>

        {/* 展开后的全部会员卡名称 */}
        {expanded && packages.length > 1 && (
          <View className="flex flex-row items-center gap-[8rpx] flex-wrap mt-[4rpx]">
            {packages.map((pkg) => (
              <View key={pkg.id} className="px-[12rpx] py-[4rpx] rounded-[8rpx] bg-muted">
                <Text className="text-[22rpx] text-foreground">{pkg.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 勾选圆圈：右侧；到达上限且未选中时置灰不可勾选 */}
      <View
        className={cn(
          'w-[44rpx] h-[44rpx] rounded-full flex items-center justify-center flex-shrink-0 border-[2rpx]',
          checked
            ? 'bg-primary border-primary'
            : disabled
              ? 'bg-muted border-muted-foreground/30'
              : 'bg-card border-muted-foreground',
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {checked ? (
          <Icon name="mdi-check" size={26} color="white" />
        ) : (
          /* 未选中时渲染一个同尺寸透明占位，保证圆圈「空态」几何一致、可见 */
          <View className="w-[18rpx] h-[18rpx]" />
        )}
      </View>
    </View>
  );
};

const StudentMultiSelectSheet: React.FC<StudentMultiSelectSheetProps> = ({
  visible,
  students,
  selectedIds,
  loading = false,
  title = '选择上课学员',
  subjectId,
  subjects = [],
  maxSelectable,
  onClose,
  onConfirm,
}) => {
  const [tempIds, setTempIds] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  // 科目筛选：优先使用课程的关联科目；未关联或不在列表中时托底「全部科目」
  const [filterSubjectId, setFilterSubjectId] = useState<string>(subjectId || ALL_SUBJECT_VALUE);
  // 未排班筛选：默认不选中
  const [unscheduledOnly, setUnscheduledOnly] = useState(false);
  // 已勾选快捷查看：默认不选中（独立查看当前选择，忽略科目/未排班筛选）
  const [selectedOnly, setSelectedOnly] = useState(false);

  // 打开时同步已选并重置搜索/筛选
  useEffect(() => {
    if (visible) {
      setTempIds([...selectedIds]);
      setKeyword('');
      setFilterSubjectId(resolveEffectiveSubjectId(subjectId, subjects) || ALL_SUBJECT_VALUE);
      setUnscheduledOnly(false);
      setSelectedOnly(false);
    }
  }, [visible, selectedIds, subjectId, subjects]);

  // 是否已到容纳上限（用于禁止继续勾选）
  const atCapacity = !!maxSelectable && maxSelectable > 0 && tempIds.length >= maxSelectable;

  const toggle = useCallback(
    (id: string) => {
      // 已选中：随时允许取消
      if (tempIds.includes(id)) {
        setTempIds((prev) => prev.filter((i) => i !== id));
        return;
      }
      // 未选中且已达上限：禁止勾选并提醒
      if (atCapacity) {
        Taro.showToast({ title: `已达容纳上限 ${maxSelectable} 人`, icon: 'none' });
        return;
      }
      setTempIds((prev) => [...prev, id]);
    },
    [tempIds, atCapacity, maxSelectable],
  );

  /** 判断学员是否匹配当前科目筛选 */
  const matchSubjectFilter = (student: Student, subjectFilterId: string) => {
    if (subjectFilterId === ALL_SUBJECT_VALUE) return true;
    const packages = student.course_packages || [];
    // 学员课包关联了该科目，或课包为通用（无 subject_id）时均视为符合
    return packages.some((pkg) => !pkg.subject_id || pkg.subject_id === subjectFilterId);
  };

  /** 按搜索、科目、未排班、已勾选过滤后的学员 */
  const filteredStudents = useMemo(() => {
    const lowerKeyword = keyword.trim().toLowerCase();
    const matchKeyword = (student: Student) => {
      if (!lowerKeyword) return true;
      const matchName = student.name.toLowerCase().includes(lowerKeyword);
      const matchPhone = student.phone?.includes(lowerKeyword) ?? false;
      return matchName || matchPhone;
    };

    // 「已勾选」为独立快捷视图：仅展示当前已选（仍受搜索影响），忽略科目/未排班筛选
    if (selectedOnly) {
      return students.filter((s) => tempIds.includes(s.id) && matchKeyword(s));
    }

    // 「未排班」为独立快捷视图：展示所有尚未排入任何班级的学员（仍受搜索影响），
    // 忽略科目筛选——目的是让用户一眼看到所有可排班的学员，而不是仅限当前科目。
    if (unscheduledOnly) {
      return students.filter((s) => matchKeyword(s) && (s.class_ids?.length ?? 0) === 0);
    }

    return students.filter((student) => {
      if (!matchKeyword(student)) return false;
      // 科目过滤
      if (!matchSubjectFilter(student, filterSubjectId)) return false;
      return true;
    });
  }, [students, keyword, filterSubjectId, unscheduledOnly, selectedOnly, tempIds]);

  const handleConfirm = () => {
    if (tempIds.length === 0) {
      Taro.showToast({ title: '请至少选择 1 名学员', icon: 'none' });
      return;
    }
    onConfirm(tempIds);
    onClose();
  };

  /** 筛选器标签：全部科目 */
  const filterOptions = useMemo(
    () => [{ id: ALL_SUBJECT_VALUE, name: '全部科目' }, ...subjects],
    [subjects],
  );

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} height="90vh" fillHeight>
      <View className="flex flex-col h-full px-[32rpx]">
        {/* 搜索栏 */}
        <View className="shrink-0 flex flex-row items-center gap-[16rpx] pt-[8rpx] pb-[24rpx]">
          <View className="flex-1 h-[72rpx] px-[24rpx] rounded-full bg-muted flex flex-row items-center gap-[12rpx]">
            <Icon name="mdi-magnify" size={32} color="mutedForeground" />
            <Input
              className="flex-1 text-[28rpx] text-foreground"
              placeholder="搜索学员姓名/手机号"
              placeholderClass="text-muted-foreground"
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value)}
              confirmType="search"
            />
            {keyword.length > 0 && (
              <View
                className="w-[40rpx] h-[40rpx] rounded-full bg-muted-foreground/20 flex items-center justify-center active:opacity-70"
                onClick={() => setKeyword('')}
              >
                <Icon name="mdi-close" size={24} color="mutedForeground" />
              </View>
            )}
          </View>
        </View>

        {/* 筛选器：科目（横向滚动，首项为「全部科目」托底） */}
        <View className="shrink-0 mb-[16rpx]">
          <ScrollView scrollX className="whitespace-nowrap">
            <View className="flex flex-row items-center gap-[16rpx] py-[8rpx]">
              {filterOptions.map((subject) => {
                const active = filterSubjectId === subject.id;
                return (
                  <View
                    key={subject.id}
                    className={cn(
                      'px-[24rpx] py-[10rpx] rounded-full border-[2rpx] press-scale inline-flex',
                      active
                        ? 'bg-primary border-primary'
                        : 'bg-card border-border text-foreground',
                    )}
                    onClick={() => setFilterSubjectId(subject.id)}
                  >
                    <Text
                      className={cn(
                        'text-[26rpx] font-medium',
                        active ? 'text-white' : 'text-foreground',
                      )}
                    >
                      {subject.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* 功能性快捷查看标签：未排班 / 已勾选（独立成行，语义区别于科目筛选） */}
        <View className="shrink-0 flex flex-row items-center gap-[16rpx] mb-[20rpx]">
          <View
            className={cn(
              'px-[24rpx] py-[10rpx] rounded-full border-[2rpx] press-scale inline-flex',
              unscheduledOnly
                ? 'bg-warning border-warning'
                : 'bg-card border-border text-foreground',
            )}
            onClick={() => {
              setUnscheduledOnly((prev) => !prev);
              setSelectedOnly(false);
            }}
          >
            <Text
              className={cn(
                'text-[26rpx] font-medium',
                unscheduledOnly ? 'text-white' : 'text-foreground',
              )}
            >
              未排班
            </Text>
          </View>
          <View
            className={cn(
              'px-[24rpx] py-[10rpx] rounded-full border-[2rpx] press-scale inline-flex',
              selectedOnly ? 'bg-primary border-primary' : 'bg-card border-border text-foreground',
            )}
            onClick={() => {
              setSelectedOnly((prev) => !prev);
              if (!selectedOnly) setUnscheduledOnly(false);
            }}
          >
            <Text
              className={cn(
                'text-[26rpx] font-medium',
                selectedOnly ? 'text-white' : 'text-foreground',
              )}
            >
              已勾选 ({tempIds.length})
            </Text>
          </View>
        </View>

        {/* 已选数量 + 清空 */}
        <View className="shrink-0 flex flex-row items-center justify-between mb-[16rpx]">
          <View className="flex flex-row items-center gap-[12rpx]">
            <Text className="text-[26rpx] text-muted-foreground">
              已选 {tempIds.length} 人 / 共 {filteredStudents.length} 人
            </Text>
            {maxSelectable && maxSelectable > 0 && (
              <Text className="text-[24rpx] text-muted-foreground">
                （上限 {maxSelectable} 人）
              </Text>
            )}
          </View>
          {tempIds.length > 0 && (
            <Text
              className="text-[26rpx] text-primary active:opacity-70"
              onClick={() => setTempIds([])}
            >
              清空
            </Text>
          )}
        </View>

        {/* 学员列表（可滚动区域，flex-1 撑满剩余空间，确认按钮固定底部） */}
        {loading ? (
          <View className="flex-1 min-h-0 flex items-center justify-center">
            <Text className="text-[28rpx] text-muted-foreground">加载中...</Text>
          </View>
        ) : filteredStudents.length === 0 ? (
          <View className="flex-1 min-h-0 flex items-center justify-center">
            <Empty description={selectedOnly ? '尚未选择学员' : '暂无符合要求的学员'} />
          </View>
        ) : (
          <ScrollView scrollY className="flex-1 min-h-0">
            <View className="flex flex-col">
              {filteredStudents.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  checked={tempIds.includes(s.id)}
                  disabled={atCapacity && !tempIds.includes(s.id)}
                  filterSubjectId={filterSubjectId}
                  onToggle={() => toggle(s.id)}
                />
              ))}
            </View>
          </ScrollView>
        )}

        {/* 确认按钮（固定底部，不被列表挤走，始终可点击） */}
        <View className="shrink-0 pt-[24rpx] pb-[48rpx]">
          <View
            className={cn(
              'w-full py-[24rpx] rounded-full flex items-center justify-center press-scale',
              tempIds.length > 0 ? 'bg-primary shadow-float' : 'bg-muted',
            )}
            onClick={handleConfirm}
          >
            <Text
              className={cn(
                'text-[30rpx] font-semibold',
                tempIds.length > 0 ? 'text-white' : 'text-muted-foreground',
              )}
            >
              {tempIds.length > 0 ? `确认选择（${tempIds.length}人）` : '请选择学员'}
            </Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default StudentMultiSelectSheet;
