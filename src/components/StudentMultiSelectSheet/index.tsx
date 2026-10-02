/**
 * StudentMultiSelectSheet - 学员多选底部弹窗
 *
 * 用于班课等场景从学员列表中多选学员，支持：
 * - 按姓名/手机号搜索
 * - 按科目筛选（基于学员课包的 subject_id），未关联科目时托底「全部科目」
 * - 功能性快捷查看标签：「未排班」(class_ids 为空) 与「已勾选」(当前选中)
 * - 弹窗高度约为当前窗口可用高度的 2/3（windowHeight 比例，非 vh），列表内部滚动，确认按钮固定底部
 * - 勾选框在右侧；超出容纳上限时直接禁止勾选并 toast 提醒，不再允许超额
 * - 学员行展示对应科目的会员卡（多卡折叠，点击展开查看，仅显示卡名），课时信息精简
 * - 确认后回调选中 ID 列表
 */
import { Input, ScrollView, View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import StudentAvatar from '@/components/student/StudentAvatar';
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
  /** 是否展示「未排班」快捷筛选（仅新增/编辑课程页开启） */
  showUnscheduledFilter?: boolean;
  /** 关闭 */
  onClose: () => void;
  /** 确认选择 */
  onConfirm: (ids: string[]) => void;
}

const ALL_SUBJECT_VALUE = 'all';

/**
 * 解析出「有效」的关联科目 ID。
 * 2026-10-02 修复：班级的 `subject` 是自由字符串、存在**两代数据**（新数据存 Subject UUID、
 * 种子/老数据存中文名称），原来只按 id 比对 ⇒ 名称永远不命中 ⇒ 过滤回落「全部科目」失效。
 * 现在同时接受 id 与名称，命中后统一归一化为 Subject.id。
 */
export const resolveEffectiveSubjectId = (subjectId?: string, subjects: Subject[] = []) => {
  if (!subjectId) return undefined;
  const hit = subjects.find((s) => s.id === subjectId || s.name === subjectId);
  return hit?.id;
};

/** 计算与当前科目筛选匹配的会员卡（无科目约束/通用卡始终匹配） */
const getRelevantPackages = (student: Student, filterSubjectId: string) => {
  const packages = student.course_packages || [];
  if (filterSubjectId === ALL_SUBJECT_VALUE) return packages;
  return packages.filter((pkg) => !pkg.subject_id || pkg.subject_id === filterSubjectId);
};

/**
 * 判断学员是否匹配当前科目筛选。
 *
 * 2026-10-02 修复过滤失效的根因：学员**列表**接口只返回课时聚合，前端把每个学员映射成
 * 一个**无科目的"课时汇总"假卡包** ⇒ `pkg.subject_id` 恒为空 ⇒ 按"通用卡"恒放行 ⇒ 过滤形同虚设。
 * 现在列表接口返回 `package_subject_ids`（学员有效课包覆盖的科目集合），优先按它判定：
 * - 有集合且非空 ⇒ 只放行覆盖了所选科目的学员；
 * - 集合为空 ⇒ 无课包（可能只有会员卡等通用余额）⇒ 视为通用、放行（与"无科目约束的卡始终匹配"同口径）；
 * - 字段缺失（旧缓存/其他数据源）⇒ 回落旧的卡包比对逻辑，行为不变。
 */
export const matchSubjectFilter = (
  student: Pick<Student, 'course_packages' | 'package_subject_ids'>,
  subjectFilterId: string,
): boolean => {
  if (subjectFilterId === ALL_SUBJECT_VALUE) return true;
  if (student.package_subject_ids) {
    const ids = student.package_subject_ids;
    if (ids.length === 0) return true;
    return ids.includes(subjectFilterId);
  }
  const packages = student.course_packages || [];
  return packages.some((pkg) => !pkg.subject_id || pkg.subject_id === subjectFilterId);
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
      {/* 头像：统一 StudentAvatar */}
      <StudentAvatar name={student.name} src={student.avatar_url} size="md" />

      {/* 学员信息（会员卡 + 课时，精简） */}
      <View className="flex-1 min-w-0 flex flex-col gap-[10rpx]">
        <View className="flex flex-row items-center gap-[12rpx]">
          <Text className="text-[32rpx] font-semibold text-foreground truncate">
            {student.name}
          </Text>
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
  showUnscheduledFilter = false,
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
      // 单选上限 1：点选新学员直接替换，无需先取消
      if (maxSelectable === 1) {
        setTempIds([id]);
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
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      heightRatio={2 / 3}
      fillHeight
      // 关键：禁用外层 BottomSheet 的 ScrollView 包裹，由本组件内部 flex-1 ScrollView 管理学员列表
      // 否则嵌套 ScrollView 会导致内层点击失效、滚动卡顿
      scrollable={false}
    >
      <View className="flex flex-col h-full px-[32rpx]">
        {/* 搜索栏 */}
        <View className="shrink-0 flex flex-row items-center gap-[16rpx] pt-[8rpx] pb-[24rpx]">
          <View className="flex-1 h-[72rpx] px-[24rpx] rounded-button bg-muted flex flex-row items-center gap-[12rpx]">
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

        {/* 功能性快捷查看标签：未排班（仅课程表单）/ 已勾选 */}
        <View className="shrink-0 flex flex-row items-center gap-[16rpx] mb-[20rpx]">
          {showUnscheduledFilter ? (
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
          ) : null}
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
            {/* 顶部 pt-[16rpx]：第一排学员与上方统计栏留出间距，避免贴头（全引用处统一生效） */}
            <View className="flex flex-col pt-[16rpx]">
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

        {/* 确认按钮（固定底部，不被列表挤走，始终可点击）；pb 带上安全区避免被手势条遮住 */}
        <View className="shrink-0 pt-[24rpx] pb-[calc(48rpx+env(safe-area-inset-bottom))]">
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
              {tempIds.length === 0
                ? '请选择学员'
                : maxSelectable === 1
                  ? '确认选择'
                  : `确认选择（${tempIds.length}人）`}
            </Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default StudentMultiSelectSheet;
