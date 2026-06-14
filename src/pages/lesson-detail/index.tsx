import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { lessonRecordService, studentService } from '@/services';
import { useStudentStore } from '@/stores';
import type { LessonRecord } from '@/types/lesson-record';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 支付方式映射 */
const FEE_METHOD_MAP: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  transfer: '转账',
  other: '其他',
};

const LessonDetail: React.FC = () => {
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';
  const studentStore = useStudentStore();

  const recordId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.id || '');
  }, []);

  const [record, setRecord] = useState<LessonRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRecord = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    try {
      const data = await lessonRecordService.getById(recordId);
      setRecord(data);
    } catch (err) {
      logError('load record', err);
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  // 图片预览
  const handlePreviewImage = useCallback((urls: string[], current: string) => {
    Taro.previewImage({ current, urls });
  }, []);

  // 编辑
  const handleEdit = useCallback(() => {
    Taro.navigateTo({
      url: `/pages/lesson-form/index?recordId=${encodeURIComponent(recordId)}&mode=edit`,
    });
  }, [recordId]);

  // 删除（二次确认）
  const handleDelete = useCallback(async () => {
    const { confirm } = await Taro.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除这条消课记录吗？',
      confirmColor: '#ef4444',
    });
    if (!confirm) return;

    try {
      await lessonRecordService.remove(recordId);
      if (profile?.id) studentStore.invalidate(profile.id);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1000);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  }, [recordId]);

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-50">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (!record) {
    return (
      <PageContainer>
        <View className="flex flex-col items-center justify-center pt-50 gap-4">
          <Icon name="mdi-alert-circle" size="xxl" color="muted" />
          <Text className="text-lg text-muted-foreground">记录不存在或已被删除</Text>
        </View>
      </PageContainer>
    );
  }

  const studentName = record.student?.name || '学生';
  const packageName = record.course_package?.name || '课程';

  return (
    <PageContainer>
      <View className="min-h-screen bg-gradient-subtle pb-12">
        {/* ====== 1. 顶部信息卡片 ====== */}
        <View className="bg-gradient-primary px-8 pt-12 pb-14 rounded-b-60rpx shadow-elegant">
          <View className="flex items-center gap-6 mb-7">
            <View className="w-28 h-28 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              <Avatar name={studentName} avatarUrl={record.student?.avatar_url} size="lg" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-2xl font-bold block">{studentName}</Text>
              <Text className="text-white/80 text-base block mt-1">{packageName}</Text>
            </View>
          </View>
          <View className="bg-white/20 backdrop-blur-sm rounded-3xl py-5 px-7 flex items-center justify-between">
            <Text className="text-white/80 text-base">上课时间</Text>
            <Text className="text-white text-lg font-semibold">{record.lesson_date}</Text>
          </View>
        </View>

        {/* ====== 2. 详细信息列表 ====== */}
        <View className="px-8 -mt-6 flex flex-col gap-5">
          {/* 课时消耗 */}
          <View className="bg-white rounded-3xl p-7 shadow-soft">
            <View className="flex items-center gap-4 mb-4">
              <View className="w-18 h-18 rounded-2xl bg-gradient-subtle flex items-center justify-center flex-shrink-0">
                <Icon name="mdi-timer" size="sm" color="primary" />
              </View>
              <Text className="text-lg font-medium text-foreground">课时消耗</Text>
            </View>
            <Text className="text-3xl font-bold text-primary">{record.hours_used} 课时</Text>
          </View>

          {/* 课程内容 */}
          {record.content && (
            <View className="bg-white rounded-3xl p-7 shadow-soft">
              <View className="flex items-center gap-4 mb-4">
                <View className="w-18 h-18 rounded-2xl bg-gradient-subtle flex items-center justify-center flex-shrink-0">
                  <Icon name="mdi-note-text" size="sm" color="primary" />
                </View>
                <Text className="text-lg font-medium text-foreground">上课内容</Text>
              </View>
              <Text className="text-base text-muted-foreground leading-relaxed">
                {record.content}
              </Text>
            </View>
          )}

          {/* 学生表现 */}
          {record.performance && (
            <View className="bg-white rounded-3xl p-7 shadow-soft">
              <View className="flex items-center gap-4 mb-4">
                <View className="w-18 h-18 rounded-2xl bg-gradient-subtle flex items-center justify-center flex-shrink-0">
                  <Icon name="mdi-star" size="sm" color="warning" />
                </View>
                <Text className="text-lg font-medium text-foreground">课堂表现</Text>
              </View>
              <Text className="text-base text-muted-foreground leading-relaxed">
                {record.performance}
              </Text>
            </View>
          )}

          {/* 课后作业 */}
          {(record.homework || (record.homework_images && record.homework_images.length > 0)) && (
            <View className="bg-white rounded-3xl p-7 shadow-soft">
              <View className="flex items-center gap-4 mb-4">
                <View className="w-18 h-18 rounded-2xl bg-gradient-subtle flex items-center justify-center flex-shrink-0">
                  <Icon name="mdi-book-open" size="sm" color="primary" />
                </View>
                <Text className="text-lg font-medium text-foreground">课后作业</Text>
              </View>
              {record.homework && (
                <Text className="text-base text-muted-foreground leading-relaxed">
                  {record.homework}
                </Text>
              )}
              {record.homework_images && record.homework_images.length > 0 && (
                <View className="flex flex-wrap gap-3 mt-4">
                  {record.homework_images.map((img, idx) => (
                    <Image
                      key={idx}
                      src={img}
                      mode="aspectFill"
                      className="w-40 h-40 rounded-2xl"
                      onClick={() => handlePreviewImage(record.homework_images!, img)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 费用信息 */}
          {record.fee_amount != null && record.fee_amount > 0 && (
            <View className="bg-white rounded-3xl p-7 shadow-soft">
              <View className="flex items-center gap-4 mb-4">
                <View className="w-18 h-18 rounded-2xl bg-gradient-subtle flex items-center justify-center flex-shrink-0">
                  <Icon name="mdi-cash" size="sm" color="warning" />
                </View>
                <Text className="text-lg font-medium text-foreground">收费信息</Text>
              </View>
              <View className="flex items-center justify-between py-2">
                <Text className="text-base text-muted-foreground">金额</Text>
                <Text className="text-2xl font-bold text-primary">
                  ¥{record.fee_amount.toFixed(2)}
                </Text>
              </View>
              <View className="flex items-center justify-between py-2">
                <Text className="text-base text-muted-foreground">支付方式</Text>
                <Text className="text-base font-medium text-foreground">
                  {FEE_METHOD_MAP[record.fee_method || ''] || record.fee_method || '-'}
                </Text>
              </View>
            </View>
          )}

          {/* 记录信息 */}
          <View className="bg-white rounded-3xl p-7 shadow-soft">
            <View className="flex items-center gap-4 mb-4">
              <View className="w-18 h-18 rounded-2xl bg-gradient-subtle flex items-center justify-center flex-shrink-0">
                <Icon name="mdi-information" size="sm" color="info" />
              </View>
              <Text className="text-lg font-medium text-foreground">记录信息</Text>
            </View>
            <View className="flex items-center justify-between py-2">
              <Text className="text-base text-muted-foreground">记录编号</Text>
              <Text className="text-base font-medium text-foreground">{record.id.slice(0, 8)}</Text>
            </View>
            {record.created_at && (
              <View className="flex items-center justify-between py-2">
                <Text className="text-base text-muted-foreground">创建时间</Text>
                <Text className="text-base font-medium text-foreground">
                  {record.created_at || '-'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ====== 3. 操作按钮（教师视图） ====== */}
        {isTeacher && (
          <View className="px-8 flex gap-5">
            <View
              className="flex-1 py-6 rounded-3xl bg-gradient-primary shadow-elegant flex items-center justify-center transition"
              onClick={handleEdit}
            >
              <Text className="text-white text-lg font-semibold">编辑记录</Text>
            </View>
            <View
              className="flex-1 py-6 rounded-3xl bg-white border border-destructive flex items-center justify-center transition"
              onClick={handleDelete}
            >
              <Text className="text-destructive text-lg font-semibold">删除记录</Text>
            </View>
          </View>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(LessonDetail);
