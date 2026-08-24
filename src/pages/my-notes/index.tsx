/**
 * MyNotes - 我的笔记列表页
 *
 * 展示用户本地笔记，按日期分组；卡片含时间、字数与正文预览。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useState } from 'react';
import Icon from '@/components/Icon';
import Empty from '@/components/Empty';
import { useAuth } from '@/utils/auth';
import {
  countNoteChars,
  getUserNotes,
  groupNotesByDate,
  removeUserNote,
  type UserNoteRecord,
} from '@/utils/user-notes';
import { withRouteGuard } from '@/utils/route-guard';

const TAG_CLASS = {
  default: 'todo-card-tag-default',
  primary: 'todo-card-tag-primary',
  accent: 'todo-card-tag-accent',
  warning: 'todo-card-tag-warning',
} as const;

const MyNotes: React.FC = () => {
  const { profile } = useAuth();
  const [groups, setGroups] = useState(() => groupNotesByDate([]));

  const loadNotes = useCallback(() => {
    if (!profile?.id) {
      setGroups([]);
      return;
    }
    setGroups(groupNotesByDate(getUserNotes(profile.id)));
  }, [profile?.id]);

  useDidShow(() => {
    loadNotes();
  });

  usePullDownRefresh(() => {
    loadNotes();
    Taro.stopPullDownRefresh();
  });

  const handleDelete = useCallback(
    (note: UserNoteRecord) => {
      if (!profile?.id) return;
      Taro.showModal({
        title: '删除笔记',
        content: '删除后无法恢复，确认删除？',
        success: (result) => {
          if (!result.confirm) return;
          removeUserNote(profile.id, note.id);
          loadNotes();
          Taro.showToast({ title: '已删除', icon: 'success' });
        },
      });
    },
    [loadNotes, profile?.id],
  );

  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <View className="min-h-screen bg-background pb-safe-bottom">
      <ScrollView scrollY className="h-screen box-border px-[32rpx] pt-[24rpx]">
        <View className="flex flex-row flex-wrap gap-[12rpx] mb-[24rpx]">
          <View className="rounded-full bg-primary/10 px-[20rpx] py-[10rpx]">
            <Text className="text-[24rpx] text-primary font-medium">全部 {totalCount}</Text>
          </View>
          <View className="rounded-full bg-card border border-border px-[20rpx] py-[10rpx]">
            <Text className="text-[24rpx] text-muted-foreground">收件箱</Text>
          </View>
        </View>

        {groups.length === 0 ? (
          <Empty icon="mdi-note-text" description="在首页待办 Tab 点击「记笔记」快速记录" />
        ) : (
          groups.map((group) => (
            <View key={group.dateKey} className="mb-[32rpx]">
              <View className="flex flex-row items-center gap-[8rpx] mb-[16rpx]">
                <Icon name="mdi-calendar" size="xs" color="primary" />
                <Text className="text-[26rpx] font-semibold text-foreground">{group.label}</Text>
              </View>

              <View className="flex flex-col gap-[16rpx]">
                {group.items.map((note) => (
                  <View
                    key={note.id}
                    className="rounded-[24rpx] bg-card border border-border shadow-card px-[24rpx] py-[20rpx] press-scale"
                    onClick={() =>
                      Taro.navigateTo({ url: `/pages/note-detail/index?id=${encodeURIComponent(note.id)}` })
                    }
                  >
                    <View className="flex flex-row items-center justify-between mb-[12rpx]">
                      <Text className="text-[22rpx] text-muted-foreground">
                        {dayjs(note.createdAt).format('YYYY-MM-DD HH:mm:ss')} · {countNoteChars(note.content)}字
                      </Text>
                      <View
                        className="press-scale p-[8rpx]"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(note);
                        }}
                      >
                        <Icon name="mdi-dots-vertical" size="sm" color="muted" />
                      </View>
                    </View>
                    <View className="flex flex-row items-start gap-[12rpx]">
                      <View className={cn('rounded-[8rpx] px-[8rpx] py-[4rpx] shrink-0', TAG_CLASS[note.tagColor])}>
                        <Icon name="mdi-checkbox-multiple-marked-outline" size="xs" color="muted" />
                      </View>
                      <Text className="flex-1 text-[28rpx] text-foreground leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default withRouteGuard(MyNotes);
