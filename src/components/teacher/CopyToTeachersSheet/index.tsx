/**
 * CopyToTeachersSheet - 员工/教练多选底部弹窗
 *
 * 使用场景：
 * - 员工工资设置页「复制给其他员工」
 * - 待办协作人选择（@员工）
 *
 * 布局对齐 StudentMultiSelectSheet：标题 + 搜索 + 列表滚动 + 底部确认按钮。
 */
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import { useTeacherStore } from '@/stores/teacher';

export interface CopyToTeachersSheetProps {
  visible: boolean;
  /** 当前源员工 ID，需排除在选择列表外 */
  excludeTeacherId?: string;
  /** 打开时已选 id（协作人等场景回显） */
  value?: string[];
  /** 标题，默认「复制配置到」 */
  title?: string;
  /** 顶部说明文案 */
  description?: string;
  /** 搜索框占位 */
  searchPlaceholder?: string;
  /** 确定时是否至少选一位，默认 true */
  requireSelection?: boolean;
  /** 列表为空时的提示 */
  emptyText?: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 确定回调，返回选中的教师 id 数组 */
  onConfirm: (teacherIds: string[]) => void;
}

const DEFAULT_TITLE = '复制配置到';
const DEFAULT_DESCRIPTION =
  '把当前已保存的整套工资配置（底薪/课时费/阶梯/社保/助教/提成）复制给所选教练，覆盖他们现有配置。如刚改过配置，请先点「保存」再复制。';

const CopyToTeachersSheet: React.FC<CopyToTeachersSheetProps> = ({
  visible,
  excludeTeacherId,
  value,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  searchPlaceholder = '搜索教练姓名',
  requireSelection = true,
  emptyText = '暂无可选教练',
  onClose,
  onConfirm,
}) => {
  const { teachers, fetchTeachers } = useTeacherStore();
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    void fetchTeachers().finally(() => setLoading(false));
    setSelectedIds(value ? [...value] : []);
    setKeyword('');
  }, [visible, value, fetchTeachers]);

  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.status === 'active' && teacher.id !== excludeTeacherId),
    [teachers, excludeTeacherId],
  );

  const filtered = useMemo(() => {
    if (!keyword.trim()) return activeTeachers;
    const kw = keyword.trim();
    return activeTeachers.filter(
      (teacher) => teacher.name.includes(kw) || (teacher.subject || '').includes(kw),
    );
  }, [activeTeachers, keyword]);

  const allSelected = filtered.length > 0 && filtered.every((teacher) => selectedIds.includes(teacher.id));

  const handleToggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filtered.some((teacher) => teacher.id === id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((teacher) => teacher.id)])));
  }, [allSelected, filtered]);

  const handleConfirm = useCallback(() => {
    if (requireSelection && selectedIds.length === 0) {
      Taro.showToast({ title: '请至少选择一位教练', icon: 'none' });
      return;
    }
    onConfirm([...selectedIds]);
    onClose();
  }, [onClose, onConfirm, requireSelection, selectedIds]);

  const canConfirm = !requireSelection || selectedIds.length > 0;
  const confirmLabel = requireSelection
    ? selectedIds.length > 0
      ? `确认选择（${selectedIds.length}人）`
      : '请选择教练'
    : selectedIds.length > 0
      ? `确认选择（${selectedIds.length}人）`
      : '确认（可不选）';

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      heightRatio={0.72}
      fillHeight
      scrollable={false}
    >
      <View className="flex h-full flex-col px-[32rpx]">
        {description ? (
          <View className="shrink-0 pb-[16rpx]">
            <Text className="text-[24rpx] text-muted-foreground leading-relaxed">{description}</Text>
          </View>
        ) : null}

        <View className="shrink-0 flex flex-row items-center gap-[16rpx] pb-[16rpx]">
          <View className="flex h-[72rpx] flex-1 flex-row items-center gap-[12rpx] rounded-full bg-muted px-[24rpx]">
            <Icon name="mdi-magnify" size={32} color="mutedForeground" />
            <Input
              className="flex-1 text-[28rpx] text-foreground bg-transparent"
              placeholder={searchPlaceholder}
              placeholderClass="text-muted-foreground"
              value={keyword}
              onInput={(event) => setKeyword(event.detail.value)}
              confirmType="search"
            />
          </View>
        </View>

        <View className="mb-[12rpx] flex shrink-0 flex-row items-center justify-between">
          <Text
            className="text-[26rpx] font-medium text-primary press-bg px-[12rpx] py-[6rpx] rounded-[12rpx]"
            onClick={handleToggleAll}
          >
            {allSelected ? '取消全选' : '全选'}
          </Text>
          <Text className="text-[24rpx] text-muted-foreground">已选 {selectedIds.length} 人</Text>
        </View>

        {loading ? (
          <View className="flex min-h-0 flex-1 items-center justify-center">
            <Text className="text-[28rpx] text-muted-foreground">加载中...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex min-h-0 flex-1 items-center justify-center">
            <Empty
              description={keyword.trim() ? '未找到匹配的员工' : emptyText}
              icon="mdi-account-search"
            />
          </View>
        ) : (
          <ScrollView scrollY className="min-h-0 flex-1">
            <View className="flex flex-col pb-[8rpx]">
              {filtered.map((teacher) => {
                const checked = selectedIds.includes(teacher.id);
                return (
                  <View
                    key={teacher.id}
                    className="flex flex-row items-center border-b border-border/40 px-[8rpx] py-[24rpx] press-bg"
                    onClick={() => handleToggleOne(teacher.id)}
                  >
                    <Avatar name={teacher.name} avatarUrl={teacher.avatar} size="sm" />
                    <View className="ml-[16rpx] min-w-0 flex-1">
                      <Text className="text-[30rpx] font-medium text-foreground">{teacher.name}</Text>
                      {teacher.subject ? (
                        <Text className="text-[24rpx] text-muted-foreground">{teacher.subject}</Text>
                      ) : null}
                    </View>
                    <View
                      className={cn(
                        'flex h-[44rpx] w-[44rpx] items-center justify-center rounded-full border-[3rpx]',
                        checked ? 'border-primary bg-primary' : 'border-foreground/30 bg-white',
                      )}
                    >
                      {checked ? <Icon name="mdi-check" size={22} color="#fff" /> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}

        <View className="shrink-0 pb-[calc(32rpx+env(safe-area-inset-bottom))] pt-[20rpx]">
          <View
            className={cn(
              'flex w-full items-center justify-center rounded-full py-[24rpx] press-scale',
              canConfirm ? 'bg-primary shadow-float' : 'bg-muted',
            )}
            onClick={canConfirm ? handleConfirm : undefined}
          >
            <Text
              className={cn(
                'text-[30rpx] font-semibold',
                canConfirm ? 'text-white' : 'text-muted-foreground',
              )}
            >
              {confirmLabel}
            </Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default CopyToTeachersSheet;
