import { View, Text, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { lessonRecordService } from '@/services';
import { useStudentStore } from '@/stores';
import type { LessonRecord } from '@/types/lesson-record';
import { isStaffRole, useAuth } from '@/utils/auth';
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

/** 教师 24h 内可撤销，校长 7 天内可撤销 */
const REVOKE_LIMIT_HOURS_TEACHER = 24;
const REVOKE_LIMIT_HOURS_PRINCIPAL = 24 * 7;

/** 判断消课记录是否可撤销 */
function canRevoke(record: LessonRecord, role?: string): { allowed: boolean; reason?: string } {
  if (record.revoke_status === 'revoked') {
    return { allowed: false, reason: '该记录已撤销' };
  }
  if (!record.created_at) {
    return { allowed: false, reason: '无法确定创建时间' };
  }
  const created = new Date(record.created_at).getTime();
  const now = Date.now();
  const hoursDiff = (now - created) / (1000 * 60 * 60);

  if (role === 'principal') {
    if (hoursDiff > REVOKE_LIMIT_HOURS_PRINCIPAL) {
      return { allowed: false, reason: `已超过${REVOKE_LIMIT_HOURS_PRINCIPAL / 24}天撤销时限` };
    }
  } else {
    if (hoursDiff > REVOKE_LIMIT_HOURS_TEACHER) {
      return { allowed: false, reason: `已超过${REVOKE_LIMIT_HOURS_TEACHER}小时撤销时限` };
    }
  }
  return { allowed: true };
}

const LessonDetail: React.FC = () => {
  const { profile } = useAuth();
  const isTeacher = isStaffRole(profile?.currentContext?.role);
  const invalidateStudents = useStudentStore((state) => state.invalidate);

  const recordId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.id || '');
  }, []);

  const [record, setRecord] = useState<LessonRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [showRevokeSheet, setShowRevokeSheet] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadRecord = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNotFound(false);

    if (!recordId) {
      setRecord(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const data = await lessonRecordService.getById(recordId);
      if (!data) {
        setRecord(null);
        setNotFound(true);
        return;
      }

      setRecord(data);
    } catch (err) {
      logError('load record', err);
      setRecord(null);
      setLoadError('消课详情加载失败，请稍后重试');
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
      url: `/package-course/pages/lesson-form/index?recordId=${encodeURIComponent(recordId)}&mode=edit`,
    });
  }, [recordId]);

  // 删除（二次确认）
  const handleDelete = useCallback(async () => {
    if (deleting) return;

    const { confirm } = await Taro.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除这条消课记录吗？',
      confirmColor: '#ef4444',
    });
    if (!confirm) return;

    setDeleting(true);
    try {
      await lessonRecordService.remove(recordId);
      if (profile?.id) invalidateStudents(profile.id);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1000);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [deleting, recordId, profile, invalidateStudents]);

  // 撤销消课
  const handleRevoke = useCallback(async () => {
    if (!revokeReason.trim()) {
      Taro.showToast({ title: '请填写撤销原因', icon: 'none' });
      return;
    }
    setRevoking(true);
    try {
      await lessonRecordService.revoke(recordId, profile?.id || '', revokeReason.trim());
      if (profile?.id) invalidateStudents(profile.id);
      Taro.showToast({ title: '已撤销', icon: 'success' });
      setShowRevokeSheet(false);
      setRevokeReason('');
      // 刷新记录
      await loadRecord();
    } catch (err) {
      logError('revoke lesson record', err);
      Taro.showToast({ title: '撤销失败', icon: 'none' });
    } finally {
      setRevoking(false);
    }
  }, [recordId, profile, revokeReason, invalidateStudents, loadRecord]);

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-50">
          <Loading text="加载消课详情中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle px-8 flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={loadRecord}
          />
        </View>
      </PageContainer>
    );
  }

  if (notFound || !record) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle px-8 flex items-center justify-center">
          <Empty
            icon="mdi-clipboard-text"
            description="记录不存在或已被删除"
            actionText="返回上一页"
            onAction={() => Taro.navigateBack()}
          />
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

          {/* 跨科目提示 */}
          {record.is_cross_subject && (
            <View className="bg-warning/10 rounded-3xl p-7 shadow-soft border border-warning/30">
              <View className="flex items-center gap-4 mb-3">
                <View className="w-18 h-18 rounded-2xl bg-warning/20 flex items-center justify-center flex-shrink-0">
                  <Icon name="mdi-swap-horizontal" size="sm" color="warning" />
                </View>
                <Text className="text-lg font-medium text-warning">跨科目消课</Text>
              </View>
              <Text className="text-base text-muted-foreground leading-relaxed">
                本次消课为跨科目消课（班级：{record.class_subject || '通用'}，课包：
                {record.package_subject || '通用'}）
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
            {/* 撤销状态 */}
            {record.revoke_status === 'revoked' && (
              <>
                <View className="flex items-center justify-between py-2">
                  <Text className="text-base text-muted-foreground">状态</Text>
                  <Text className="text-base font-semibold text-danger">已撤销</Text>
                </View>
                {record.revoke_reason && (
                  <View className="flex items-center justify-between py-2">
                    <Text className="text-base text-muted-foreground">撤销原因</Text>
                    <Text className="text-base font-medium text-foreground">
                      {record.revoke_reason}
                    </Text>
                  </View>
                )}
                {record.revoked_at && (
                  <View className="flex items-center justify-between py-2">
                    <Text className="text-base text-muted-foreground">撤销时间</Text>
                    <Text className="text-base font-medium text-foreground">
                      {record.revoked_at}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* ====== 3. 操作按钮（教师视图） ====== */}
        {isTeacher && record.revoke_status !== 'revoked' && (
          <View className="px-8 flex gap-5">
            <View
              className="flex-1 py-6 rounded-3xl bg-gradient-primary shadow-elegant flex items-center justify-center transition"
              onClick={handleEdit}
            >
              <Text className="text-white text-lg font-semibold">编辑记录</Text>
            </View>
            <View
              className="flex-1 py-6 rounded-3xl bg-white border border-destructive flex items-center justify-center transition"
              onClick={!deleting ? handleDelete : undefined}
            >
              <Text className="text-destructive text-lg font-semibold">
                {deleting ? '删除中...' : '删除记录'}
              </Text>
            </View>
          </View>
        )}

        {/* 撤销按钮 */}
        {isTeacher &&
          record.revoke_status !== 'revoked' &&
          (() => {
            const revokeCheck = canRevoke(record, profile?.currentContext?.role);
            return (
              <View className="px-8 mt-5">
                <View
                  className={`py-6 rounded-3xl flex items-center justify-center transition ${
                    revokeCheck.allowed ? 'bg-warning/10 border border-warning' : 'bg-border-light'
                  }`}
                  onClick={() => {
                    if (revokeCheck.allowed) {
                      setShowRevokeSheet(true);
                    } else {
                      Taro.showToast({ title: revokeCheck.reason || '不可撤销', icon: 'none' });
                    }
                  }}
                >
                  <Text
                    className={`text-lg font-semibold ${
                      revokeCheck.allowed ? 'text-warning' : 'text-muted'
                    }`}
                  >
                    {revokeCheck.allowed ? '撤销消课' : '已超过撤销时限'}
                  </Text>
                </View>
              </View>
            );
          })()}

        {/* 撤销确认弹窗 */}
        <BottomSheet
          visible={showRevokeSheet}
          title="撤销消课"
          onClose={() => setShowRevokeSheet(false)}
        >
          <View className="px-6 py-4">
            <Text className="text-base text-muted-foreground leading-relaxed">
              撤销后将恢复课包余额（购买{record.purchased_deduct || 0}课时 + 赠送
              {record.bonus_deduct || 0}课时），该操作不可逆。
            </Text>
            <View className="mt-4">
              <Text className="text-sm text-muted-foreground mb-2 block">撤销原因 *</Text>
              <View className="bg-border-light/50 rounded-2xl p-4">
                <Input
                  className="text-base text-foreground"
                  placeholder="请填写撤销原因"
                  value={revokeReason}
                  onInput={(e) => setRevokeReason(e.detail.value)}
                  maxlength={200}
                />
              </View>
            </View>
            <View className="flex gap-3 mt-6">
              <View
                className="flex-1 py-3 rounded-xl bg-border-light items-center"
                onClick={() => setShowRevokeSheet(false)}
              >
                <Text className="text-[30rpx] text-foreground">取消</Text>
              </View>
              <View
                className={`flex-1 py-3 rounded-xl items-center ${
                  revokeReason.trim() ? 'bg-warning' : 'bg-border-light'
                }`}
                onClick={revokeReason.trim() && !revoking ? handleRevoke : undefined}
              >
                <Text
                  className={`text-[30rpx] font-semibold ${
                    revokeReason.trim() ? 'text-white' : 'text-muted'
                  }`}
                >
                  {revoking ? '撤销中...' : '确认撤销'}
                </Text>
              </View>
            </View>
          </View>
        </BottomSheet>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(LessonDetail);
