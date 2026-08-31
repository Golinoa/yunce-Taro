/**
 * TodoCollaboratorPage - 参与人选择（全屏单页双形态）
 *
 * 使用场景：创建待办时添加/查看参与人（仅从已登录的我的待办进入，不再包 withRouteGuard，
 * 避免首帧延迟挂载导致 useDidShow/useLoad 丢失、页面卡在加载中）。
 */
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import {
  TodoCollaboratorBottomAction,
  TodoCollaboratorNavBar,
  TodoCollaboratorListAvatar,
  TodoCollaboratorSelectRow,
  TodoCollaboratorViewRow,
  collaboratorSummaryToDisplay,
  type CollaboratorDisplayInfo,
} from '@/components/my-todos/todo-collaborator-shared';
import { useTeacherStore } from '@/stores';
import type { TeacherUIModel } from '@/types/teacher';
import {
  commitTodoCollaboratorResult,
  mergeCollaboratorSummaries,
  prepareTodoCollaboratorInput,
  readTodoCollaboratorMeta,
  resolveInitialCollaboratorIds,
  resolveInitialCollaboratorMode,
  type CollaboratorSummary,
} from '@/utils/todo-collaborator-select';

type CollaboratorPageMode = 'add' | 'view';

const MAX_STRIP_AVATARS = 5;

const TodoCollaboratorPage: React.FC = () => {
  const { teachers, fetchTeachers } = useTeacherStore();
  const [mode, setMode] = useState<CollaboratorPageMode>('add');
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [summaryMeta, setSummaryMeta] = useState<CollaboratorSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedIdsRef = useRef<string[]>([]);
  const summaryMetaRef = useRef<CollaboratorSummary[]>([]);
  const openedAsViewRef = useRef(false);
  const teacherMapRef = useRef<Record<string, TeacherUIModel>>({});

  const applySelection = useCallback((ids: string[], summaries: CollaboratorSummary[]) => {
    const merged = mergeCollaboratorSummaries(ids, summaries, Object.values(teacherMapRef.current));
    selectedIdsRef.current = ids;
    summaryMetaRef.current = merged;
    setSelectedIds(ids);
    setSummaryMeta(merged);
    prepareTodoCollaboratorInput(ids, merged);
  }, []);

  const hydrateFromEntry = useCallback(
    (queryIds?: string, queryMode?: string) => {
      const entryMode = resolveInitialCollaboratorMode(queryMode);
      const entryIds = resolveInitialCollaboratorIds(queryIds);
      const storedMeta = readTodoCollaboratorMeta();
      const mergedMeta = mergeCollaboratorSummaries(
        entryIds,
        storedMeta,
        Object.values(teacherMapRef.current),
      );

      openedAsViewRef.current = entryMode === 'view';
      setMode(entryMode);
      setKeyword('');
      applySelection(entryIds, mergedMeta);
    },
    [applySelection],
  );

  useLoad((options) => {
    const opt = options as Record<string, string | undefined>;
    hydrateFromEntry(opt.ids, opt.mode);
  });

  useEffect(() => {
    hydrateFromEntry();
  }, [hydrateFromEntry]);

  useEffect(() => {
    setLoading(true);
    void fetchTeachers().finally(() => setLoading(false));
  }, [fetchTeachers]);

  const teacherMap = useMemo(() => {
    const map: Record<string, TeacherUIModel> = {};
    teachers.forEach((teacher) => {
      map[teacher.id] = teacher;
    });
    return map;
  }, [teachers]);

  teacherMapRef.current = teacherMap;

  useEffect(() => {
    if (selectedIdsRef.current.length === 0) return;
    applySelection(selectedIdsRef.current, summaryMetaRef.current);
  }, [applySelection, teacherMap]);

  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.status === 'active'),
    [teachers],
  );

  const filtered = useMemo(() => {
    if (!keyword.trim()) return activeTeachers;
    const kw = keyword.trim();
    return activeTeachers.filter(
      (teacher) => teacher.name.includes(kw) || (teacher.subject || '').includes(kw),
    );
  }, [activeTeachers, keyword]);

  const displayItems = useMemo((): CollaboratorDisplayInfo[] => {
    return summaryMeta.map((item) => collaboratorSummaryToDisplay(item));
  }, [summaryMeta]);

  const handleToggleOne = useCallback(
    (id: string) => {
      const nextIds = selectedIdsRef.current.includes(id)
        ? selectedIdsRef.current.filter((item) => item !== id)
        : [...selectedIdsRef.current, id];
      applySelection(nextIds, summaryMetaRef.current);
    },
    [applySelection],
  );

  const handleRemoveOne = useCallback(
    (id: string) => {
      const teacher = summaryMetaRef.current.find((item) => item.id === id);
      const teacherName = teacher?.name || '该员工';
      Taro.showModal({
        title: '移除参与人',
        content: `确定将「${teacherName}」从参与人中移除？`,
        confirmText: '移除',
        cancelText: '取消',
        success: (result) => {
          if (!result.confirm) return;
          applySelection(
            selectedIdsRef.current.filter((item) => item !== id),
            summaryMetaRef.current,
          );
        },
      });
    },
    [applySelection],
  );

  const handleCancel = useCallback(() => {
    if (mode === 'view' && !openedAsViewRef.current) {
      setMode('add');
      return;
    }
    void Taro.navigateBack();
  }, [mode]);

  const handleOpenViewMode = useCallback(() => {
    if (selectedIdsRef.current.length === 0) return;
    setMode('view');
  }, []);

  const handlePrimaryAction = useCallback(() => {
    if (mode === 'view') {
      if (!openedAsViewRef.current) {
        setMode('add');
        return;
      }
      commitTodoCollaboratorResult(selectedIdsRef.current, summaryMetaRef.current);
      void Taro.navigateBack();
      return;
    }

    if (selectedIdsRef.current.length === 0) return;
    commitTodoCollaboratorResult(selectedIdsRef.current, summaryMetaRef.current);
    void Taro.navigateBack();
  }, [mode]);

  const renderAddBody = () => {
    if (loading) {
      return (
        <View className="flex min-h-0 flex-1 items-center justify-center">
          <Text className="text-[28rpx] text-muted-foreground">加载中...</Text>
        </View>
      );
    }

    if (filtered.length === 0) {
      return (
        <View className="flex min-h-0 flex-1 items-center justify-center px-[32rpx]">
          <Empty
            description={keyword.trim() ? '未找到匹配的员工' : '暂无可选员工'}
            icon="mdi-account-search"
          />
        </View>
      );
    }

    return (
      <ScrollView scrollY className="min-h-0 flex-1 px-[32rpx]">
        <View className="flex flex-col">
          {filtered.map((teacher) => (
            <TodoCollaboratorSelectRow
              key={teacher.id}
              teacher={teacher}
              checked={selectedIds.includes(teacher.id)}
              onToggle={() => handleToggleOne(teacher.id)}
            />
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderViewBody = () => {
    if (selectedIds.length === 0) {
      return (
        <View className="flex min-h-0 flex-1 items-center justify-center px-[32rpx]">
          <Empty description="暂未选择参与人" icon="mdi-account-group-outline" />
        </View>
      );
    }

    return (
      <ScrollView scrollY className="min-h-0 flex-1">
        <View className="px-[32rpx] pt-[16rpx]">
          <View className="overflow-hidden rounded-[20rpx] border border-border bg-card shadow-card">
            {displayItems.map((teacher, index) => (
              <View key={teacher.id}>
                <TodoCollaboratorViewRow
                  teacher={teacher}
                  onRemove={() => handleRemoveOne(teacher.id)}
                />
                {index < displayItems.length - 1 ? (
                  <View className="mx-[24rpx] h-[2rpx] bg-border" />
                ) : null}
              </View>
            ))}
          </View>
          <Text className="mt-[20rpx] block text-center text-[22rpx] text-muted-foreground">
            点击右侧 × 可移除参与人
          </Text>
        </View>
      </ScrollView>
    );
  };

  const navTitle = mode === 'view' ? '查看参与人' : '添加参与人';

  const primaryLabel =
    mode === 'view'
      ? openedAsViewRef.current
        ? '完成'
        : '返回添加'
      : `确定(${selectedIds.length})`;

  const primaryDisabled = mode === 'add' && selectedIds.length === 0;

  return (
    <View className="flex h-screen flex-col bg-background">
      <TodoCollaboratorNavBar title={navTitle} onCancel={handleCancel} />

      {mode === 'add' ? (
        <>
          <View className="shrink-0 px-[32rpx] pb-[16rpx] pt-[16rpx]">
            <View className="flex h-[72rpx] flex-row items-center gap-[12rpx] rounded-[16rpx] bg-muted px-[24rpx]">
              <Icon name="mdi-magnify" size={32} color="mutedForeground" />
              <Input
                className="flex-1 bg-transparent text-[28rpx] text-foreground"
                placeholder="搜索员工姓名"
                placeholderClass="text-muted-foreground"
                value={keyword}
                onInput={(event) => setKeyword(event.detail.value)}
                confirmType="search"
              />
            </View>
          </View>

          <View
            className={cn(
              'mx-[32rpx] mb-[16rpx] flex h-[88rpx] shrink-0 flex-row items-center rounded-[16rpx] border border-border bg-card px-[16rpx] press-bg',
              selectedIds.length === 0 && 'opacity-70',
            )}
            onClick={handleOpenViewMode}
          >
            <View className="flex min-w-0 flex-1 flex-row items-center overflow-hidden">
              {displayItems.length === 0 ? (
                <Text className="text-[24rpx] text-muted-foreground">暂未选择参与人</Text>
              ) : (
                displayItems.slice(0, MAX_STRIP_AVATARS).map((teacher, index) => (
                  <View
                    key={teacher.id}
                    className={cn('relative shrink-0', index > 0 && '-ml-[12rpx]')}
                  >
                    <TodoCollaboratorListAvatar
                      teacher={teacher}
                      className="border-2 border-card"
                    />
                  </View>
                ))
              )}
            </View>
            {selectedIds.length > MAX_STRIP_AVATARS ? (
              <Text className="ml-[8rpx] shrink-0 text-[22rpx] text-muted-foreground">
                +{selectedIds.length - MAX_STRIP_AVATARS}
              </Text>
            ) : null}
            <Icon name="mdi-chevron-right" size="sm" color="muted" className="ml-[8rpx] shrink-0" />
          </View>

          <View className="mx-[32rpx] mb-[8rpx] shrink-0">
            <Text className="text-[24rpx] text-primary">员工</Text>
          </View>

          {renderAddBody()}
        </>
      ) : (
        renderViewBody()
      )}

      <TodoCollaboratorBottomAction
        label={primaryLabel}
        disabled={primaryDisabled}
        onClick={handlePrimaryAction}
      />
    </View>
  );
};

export default TodoCollaboratorPage;
