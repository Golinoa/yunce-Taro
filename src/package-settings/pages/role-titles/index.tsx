/**
 * 角色称呼：机构级展示名（不影响权限）
 * 交互：顶部实时预览标签 → 快捷业态 → 三组点选；点选即保存。
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import {
  MANAGER_TITLE_OPTIONS,
  PARENT_TITLE_OPTIONS,
  ROLE_TITLE_PRESETS,
  TEACHER_TITLE_OPTIONS,
  matchRoleTitlePresetId,
  type ManagerTitle,
  type ParentTitle,
  type RoleTitles,
  type TeacherTitle,
} from '@/constants/role-glossary';
import { useRoleGlossaryStore } from '@/stores/role-glossary';
import { isAdmin, useAuth } from '@/utils/auth';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <View
      className={cn(
        'center h-[64rpx] min-w-[120rpx] rounded-full px-[28rpx] border press-scale',
        selected ? 'border-primary bg-primary/10' : 'border-border bg-card',
      )}
      onClick={onClick}
    >
      <Text
        className={cn('text-[28rpx]', selected ? 'text-primary font-semibold' : 'text-foreground')}
      >
        {label}
      </Text>
    </View>
  );
}

function PreviewPill({ label, locked }: { label: string; locked?: boolean }) {
  return (
    <View
      className={cn('rounded-full px-[20rpx] py-[8rpx]', locked ? 'bg-muted' : 'bg-warning-bg')}
    >
      <Text className={cn('text-[24rpx]', locked ? 'text-muted-foreground' : 'text-warning')}>
        {label}
      </Text>
    </View>
  );
}

const RoleTitlesPage: React.FC = () => {
  useCardNavigationBar();
  const { currentRole } = useAuth();
  const storeTitles = useRoleGlossaryStore((s) => s.titles);
  const load = useRoleGlossaryStore((s) => s.load);
  const saveTitles = useRoleGlossaryStore((s) => s.saveTitles);
  const [draft, setDraft] = useState<RoleTitles>(storeTitles);
  const [saving, setSaving] = useState(false);

  useDidShow(() => {
    void load().then(() => {
      setDraft(useRoleGlossaryStore.getState().titles);
    });
  });

  const presetId = useMemo(() => matchRoleTitlePresetId(draft), [draft]);

  const persist = useCallback(
    async (next: RoleTitles) => {
      if (!isAdmin(currentRole)) {
        Taro.showToast({ title: '仅管理员可修改', icon: 'none' });
        return;
      }
      setDraft(next);
      if (saving) return;
      setSaving(true);
      try {
        await saveTitles(next);
        Taro.showToast({ title: '已更新', icon: 'success' });
      } catch {
        Taro.showToast({ title: '保存失败', icon: 'none' });
      } finally {
        setSaving(false);
      }
    },
    [currentRole, saveTitles, saving],
  );

  const setManager = (manager: ManagerTitle) => void persist({ ...draft, manager });
  const setTeacher = (teacher: TeacherTitle) => void persist({ ...draft, teacher });
  const setParent = (parent: ParentTitle) => void persist({ ...draft, parent });

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[24rpx] pb-[40rpx]">
        {/* 实时预览：少文案，靠标签感知 */}
        <View className="rounded-[28rpx] bg-card shadow-soft px-[28rpx] py-[28rpx] mb-[24rpx]">
          <View className="flex flex-wrap gap-[12rpx]">
            <PreviewPill label="管理员" locked />
            <PreviewPill label={draft.manager} />
            <PreviewPill label={draft.teacher} />
            <PreviewPill label="助教" locked />
            <PreviewPill label="前台" locked />
            <PreviewPill label={draft.parent} />
          </View>
        </View>

        {/* 快捷业态 */}
        <View className="mb-[8rpx] flex flex-wrap gap-[12rpx]">
          {ROLE_TITLE_PRESETS.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              selected={presetId === p.id}
              onClick={() => void persist(p.titles)}
            />
          ))}
        </View>

        {/* 三组点选 */}
        <View className="mt-[28rpx] rounded-[28rpx] bg-card shadow-soft overflow-hidden">
          <View className="px-[28rpx] py-[28rpx] border-b border-border/60">
            <Text className="text-[26rpx] text-muted-foreground mb-[16rpx] block">管理层</Text>
            <View className="flex flex-wrap gap-[16rpx]">
              {MANAGER_TITLE_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={draft.manager === opt}
                  onClick={() => setManager(opt)}
                />
              ))}
            </View>
          </View>
          <View className="px-[28rpx] py-[28rpx] border-b border-border/60">
            <Text className="text-[26rpx] text-muted-foreground mb-[16rpx] block">授课</Text>
            <View className="flex flex-wrap gap-[16rpx]">
              {TEACHER_TITLE_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={draft.teacher === opt}
                  onClick={() => setTeacher(opt)}
                />
              ))}
            </View>
          </View>
          <View className="px-[28rpx] py-[28rpx]">
            <Text className="text-[26rpx] text-muted-foreground mb-[16rpx] block">学员侧</Text>
            <View className="flex flex-wrap gap-[16rpx]">
              {PARENT_TITLE_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={draft.parent === opt}
                  onClick={() => setParent(opt)}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(RoleTitlesPage);
