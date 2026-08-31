/**
 * 家长端：课后作业 / 课堂点评列表
 * 复用上课记录与课节详情，不重写消课链路
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { lessonRecordService, studentService } from '@/services';
import type { LessonRecord } from '@/types/lesson-record';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

type NoteType = 'homework' | 'comments';

const TYPE_META: Record<NoteType, { title: string; empty: string; fieldLabel: string }> = {
  homework: {
    title: '课后作业',
    empty: '暂无课后作业',
    fieldLabel: '作业',
  },
  comments: {
    title: '课堂点评',
    empty: '暂无课堂点评',
    fieldLabel: '点评',
  },
};

function resolveType(raw?: string): NoteType {
  return raw === 'comments' ? 'comments' : 'homework';
}

const ParentLessonNotesPage: React.FC = () => {
  const { profile } = useAuth();
  const noteType = useMemo(() => {
    const raw = Taro.getCurrentInstance()?.router?.params?.type;
    return resolveType(raw ? decodeURIComponent(raw) : undefined);
  }, []);
  const meta = TYPE_META[noteType];

  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile?.id) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const children = await studentService.getByParent(profile.id);
      const groups = await Promise.all(
        children.map((child) => lessonRecordService.getByStudent(child.id)),
      );
      const all = groups.flat().sort((a, b) => b.lesson_date.localeCompare(a.lesson_date));
      const filtered = all.filter((item) =>
        noteType === 'homework' ? Boolean(item.homework?.trim()) : Boolean(item.performance?.trim()),
      );
      setRecords(filtered);
    } catch (err) {
      logError('ParentLessonNotes load', err);
      setRecords([]);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [profile?.id, noteType]);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: meta.title });
    void loadData();
  });

  const openDetail = (record: LessonRecord) => {
    Taro.navigateTo({
      url: `/package-course/pages/lesson-detail/index?id=${encodeURIComponent(record.id)}`,
    });
  };

  return (
    <PageContainer className="bg-background min-h-screen">
      <View className="px-[28rpx] pb-[48rpx] pt-[16rpx]">
        <Text className="mb-[24rpx] block text-[34rpx] font-bold text-foreground">{meta.title}</Text>

        {loading ? (
          <Loading text="加载中..." />
        ) : records.length === 0 ? (
          <Empty
            icon={noteType === 'homework' ? 'mdi-notebook-edit-outline' : 'mdi-message-text-outline'}
            description={meta.empty}
          />
        ) : (
          <View className="flex flex-col gap-[20rpx]">
            {records.map((record) => {
              const preview =
                noteType === 'homework' ? record.homework || '' : record.performance || '';
              return (
                <View
                  key={record.id}
                  className="rounded-[24rpx] bg-card p-[28rpx] shadow-card press-scale"
                  onClick={() => openDetail(record)}
                >
                  <View className="mb-[12rpx] flex flex-row items-center justify-between">
                    <Text className="text-[28rpx] font-semibold text-foreground">
                      {record.student?.name || '学员'}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground">{record.lesson_date}</Text>
                  </View>
                  <View className="mb-[12rpx] flex flex-row items-center gap-[8rpx]">
                    <Icon name="mdi-book-open-variant" size={22} color="muted" />
                    <Text className="text-[22rpx] text-muted-foreground">
                      {record.class_name || record.course_package?.name || '课程'}
                    </Text>
                  </View>
                  <Text className="mb-[8rpx] block text-[22rpx] text-muted-foreground">
                    {meta.fieldLabel}
                  </Text>
                  <Text className="line-clamp-3 text-[26rpx] leading-normal text-foreground">
                    {preview}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(ParentLessonNotesPage);
