import { View, Text, Picker, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ActionButton from '@/components/ActionButton';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { studentService, leaveService } from '@/services';
import type { LeaveRequest, LeaveType, LeaveStatus } from '@/types/leave-request';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 状态标签配置 */
const STATUS_MAP: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: '待审批', cls: 'bg-amber-500/15 text-amber-500' },
  approved: { label: '已同意', cls: 'bg-primary-10 text-primary' },
  rejected: { label: '已拒绝', cls: 'bg-destructive-10 text-destructive' },
};

/** 类型标签 */
const TYPE_MAP: Record<LeaveType, { label: string; cls: string }> = {
  leave: { label: '请假', cls: 'bg-destructive-10 text-destructive' },
  reschedule: { label: '调课', cls: 'bg-primary-10 text-primary' },
};

const LeaveRequestPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const userRole = profile?.role || 'teacher';
  const isTeacher = userRole === 'teacher';
  // 从路由获取可选的 requestId
  const requestId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.requestId || '');
  }, []);

  // ====== 教师视图状态 ======
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // ====== 家长视图状态 ======
  const [children, setChildren] = useState<any[]>([]);
  const [studentId, setStudentId] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 加载数据
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (isTeacher) {
          const list = await leaveService.getByTeacher(currentUserId);
          setLeaves(list);
        } else {
          // 家长：获取孩子列表
          const kids = await studentService.getByParent(currentUserId);
          setChildren(kids);
          if (kids.length > 0) setStudentId(kids[0].id);
        }
      } catch (err) {
        logError('load leave data', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isTeacher]);

  // 如果有 requestId，教师查看单条详情
  const detailLeave = useMemo(() => {
    if (isTeacher && requestId) {
      return leaves.find((l) => l.id === requestId) || null;
    }
    return null;
  }, [isTeacher, requestId, leaves]);

  // 教师审批
  const handleApprove = useCallback(async (id: string) => {
    const { confirm } = await Taro.showModal({
      title: '确认同意',
      content: '确认同意该请假申请？',
    });
    if (!confirm) return;
    try {
      await leaveService.updateStatus(id, 'approved');
      setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status: 'approved' } : l)));
      Taro.showToast({ title: '已同意', icon: 'success' });
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, []);

  const handleReject = useCallback(async (id: string) => {
    const { confirm } = await Taro.showModal({
      title: '确认拒绝',
      content: '确认拒绝该请假申请？',
      confirmColor: '#ef4444',
    });
    if (!confirm) return;
    try {
      await leaveService.updateStatus(id, 'rejected');
      setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status: 'rejected' } : l)));
      Taro.showToast({ title: '已拒绝', icon: 'success' });
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, []);

  // 家长提交请假
  const handleSubmit = useCallback(async () => {
    if (!studentId) {
      Taro.showToast({ title: '请选择学生', icon: 'none' });
      return;
    }
    if (!startDate) {
      Taro.showToast({ title: '请选择开始日期', icon: 'none' });
      return;
    }
    if (!reason.trim()) {
      Taro.showToast({ title: '请输入原因', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await leaveService.create({
        parent_id: currentUserId,
        student_id: studentId,
        teacher_id: currentUserId,
        type: leaveType,
        original_date: startDate,
        new_date: leaveType === 'reschedule' && newDate ? newDate : undefined,
        reason: reason.trim(),
        status: 'pending',
      });
      Taro.showToast({ title: '提交成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch {
      Taro.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [studentId, leaveType, startDate, newDate, reason]);

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  };

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-50">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  // ====== 教师单条详情视图 ======
  if (detailLeave) {
    const typeInfo = TYPE_MAP[detailLeave.type];
    const statusInfo = STATUS_MAP[detailLeave.status];
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen bg-gradient-subtle pb-50">
          <View className="px-8 pt-8 pb-4">
            <Text className="text-2xl font-bold text-foreground">处理申请</Text>
          </View>
          <View className="mx-8 bg-white rounded-3xl p-8 shadow-soft">
            <View className="flex items-center gap-5 mb-6">
              <View className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <Text className="text-white text-2xl font-bold">
                  {detailLeave.student?.name?.[0] || '学'}
                </Text>
              </View>
              <View className="flex items-center gap-3">
                <Text className="text-xl font-medium text-foreground">
                  {detailLeave.student?.name || '学生'}
                </Text>
                <View className={`py-1 px-4 rounded-2xl inline-flex items-center ${typeInfo.cls}`}>
                  <Text className="text-xs font-medium">{typeInfo.label}</Text>
                </View>
              </View>
            </View>
            <View className="flex items-center justify-between py-4 border-b border-input">
              <Text className="text-base text-muted-foreground">日期</Text>
              <Text className="text-lg text-foreground">
                {formatDate(detailLeave.original_date)}
              </Text>
            </View>
            {detailLeave.new_date && (
              <View className="flex items-center justify-between py-4 border-b border-input">
                <Text className="text-base text-muted-foreground">调整至</Text>
                <Text className="text-lg text-foreground">{formatDate(detailLeave.new_date)}</Text>
              </View>
            )}
            <View className="flex items-center justify-between py-4 border-b border-input">
              <Text className="text-base text-muted-foreground">原因</Text>
              <Text className="text-lg text-foreground">{detailLeave.reason || '无'}</Text>
            </View>
            <View className="flex items-center justify-between py-4">
              <Text className="text-base text-muted-foreground">状态</Text>
              <View className={`py-1 px-4 rounded-2xl inline-flex items-center ${statusInfo.cls}`}>
                <Text className="text-xs font-medium">{statusInfo.label}</Text>
              </View>
            </View>
          </View>
          {detailLeave.status === 'pending' && (
            <View className="flex gap-4 px-8">
              <View
                className="flex-1 py-7 rounded-3xl bg-gradient-primary shadow-elegant flex items-center justify-center"
                onClick={() => handleApprove(detailLeave.id)}
              >
                <Text className="text-white text-xl font-semibold">同意</Text>
              </View>
              <View
                className="flex-1 py-7 rounded-3xl bg-white border border-destructive shadow-soft flex items-center justify-center"
                onClick={() => handleReject(detailLeave.id)}
              >
                <Text className="text-destructive text-xl font-semibold">拒绝</Text>
              </View>
            </View>
          )}
        </View>
      </PageContainer>
    );
  }

  // ====== 教师列表视图 ======
  if (isTeacher) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle pb-50">
          <View className="px-8 pt-8 pb-4">
            <Text className="text-2xl font-bold text-foreground">请假/调课申请</Text>
          </View>
          {leaves.length === 0 ? (
            <Empty icon="mdi-clipboard-text" description="暂无请假申请" />
          ) : (
            <View className="px-8 flex flex-col gap-4">
              {leaves.map((leave) => {
                const typeInfo = TYPE_MAP[leave.type];
                const statusInfo = STATUS_MAP[leave.status];
                return (
                  <View key={leave.id} className="bg-white rounded-3xl p-6 shadow-soft">
                    <View className="flex items-center justify-between mb-2">
                      <Text className="text-lg font-medium text-foreground">
                        {leave.student?.name || '学生'}
                      </Text>
                      <View
                        className={`py-1 px-4 rounded-2xl inline-flex items-center ${typeInfo.cls}`}
                      >
                        <Text className="text-xs font-medium">{typeInfo.label}</Text>
                      </View>
                    </View>
                    <Text className="text-base text-muted-foreground block mb-1">
                      {leave.reason || '无原因'}
                    </Text>
                    <Text className="text-sm text-muted-foreground block mb-3">
                      {formatDate(leave.original_date)}
                    </Text>
                    <View className="flex items-center justify-between">
                      <View
                        className={`py-1 px-4 rounded-2xl inline-flex items-center ${statusInfo.cls}`}
                      >
                        <Text className="text-xs font-medium">{statusInfo.label}</Text>
                      </View>
                      {leave.status === 'pending' && (
                        <View className="flex gap-3">
                          <View
                            className="py-3 px-6 rounded-2xl bg-gradient-primary"
                            onClick={() => handleApprove(leave.id)}
                          >
                            <Text className="text-white text-sm font-medium">同意</Text>
                          </View>
                          <View
                            className="py-3 px-6 rounded-2xl border border-destructive bg-white"
                            onClick={() => handleReject(leave.id)}
                          >
                            <Text className="text-destructive text-sm font-medium">拒绝</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </PageContainer>
    );
  }

  // ====== 家长提交视图 ======
  const childNames = children.map((c: any) => c.name);
  const selectedChildIdx = children.findIndex((c: any) => c.id === studentId);

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-gradient-subtle pb-50">
        <View className="px-8 pt-8 pb-4">
          <Text className="text-2xl font-bold text-foreground">请假/调课</Text>
        </View>

        <View className="px-8">
          {/* 选择学生 */}
          {children.length > 1 && (
            <View className="mb-7">
              <Text className="text-lg text-foreground font-medium block mb-3">选择孩子</Text>
              <Picker
                mode="selector"
                range={childNames}
                value={selectedChildIdx >= 0 ? selectedChildIdx : 0}
                onChange={(e) => {
                  const idx = Number(e.detail.value);
                  if (children[idx]) setStudentId(children[idx].id);
                }}
              >
                <View className="flex items-center justify-between py-6 px-7 rounded-3xl border border-input bg-white shadow-soft">
                  <Text className="text-lg text-foreground">
                    {selectedChildIdx >= 0 ? children[selectedChildIdx].name : '请选择'}
                  </Text>
                  <Text className="text-base text-muted-foreground">▼</Text>
                </View>
              </Picker>
            </View>
          )}

          {/* 类型选择 */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">申请类型</Text>
            <View className="flex gap-4">
              <View
                className={`flex-1 py-6 rounded-3xl border-2 border-input bg-white flex items-center justify-center transition shadow-soft ${leaveType === 'leave' ? 'border-primary bg-gradient-primary shadow-elegant' : ''}`}
                onClick={() => setLeaveType('leave')}
              >
                <Text
                  className={`text-lg font-medium ${leaveType === 'leave' ? 'text-white' : 'text-muted-foreground'}`}
                >
                  请假
                </Text>
              </View>
              <View
                className={`flex-1 py-6 rounded-3xl border-2 border-input bg-white flex items-center justify-center transition shadow-soft ${leaveType === 'reschedule' ? 'border-primary bg-gradient-primary shadow-elegant' : ''}`}
                onClick={() => setLeaveType('reschedule')}
              >
                <Text
                  className={`text-lg font-medium ${leaveType === 'reschedule' ? 'text-white' : 'text-muted-foreground'}`}
                >
                  调课
                </Text>
              </View>
            </View>
          </View>

          {/* 开始日期 */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">开始日期</Text>
            <Picker mode="date" value={startDate} onChange={(e) => setStartDate(e.detail.value)}>
              <View className="flex items-center justify-between py-6 px-7 rounded-3xl border border-input bg-white shadow-soft">
                <Text className="text-lg text-foreground">{startDate || '请选择日期'}</Text>
                <Icon name="mdi-calendar" size="sm" color="muted" />
              </View>
            </Picker>
          </View>

          {/* 结束日期 */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">结束日期</Text>
            <Picker mode="date" value={endDate} onChange={(e) => setEndDate(e.detail.value)}>
              <View className="flex items-center justify-between py-6 px-7 rounded-3xl border border-input bg-white shadow-soft">
                <Text className="text-lg text-foreground">{endDate || '请选择日期（可选）'}</Text>
                <Icon name="mdi-calendar" size="sm" color="muted" />
              </View>
            </Picker>
          </View>

          {/* 调课新日期 */}
          {leaveType === 'reschedule' && (
            <View className="mb-7">
              <Text className="text-lg text-foreground font-medium block mb-3">期望调整至</Text>
              <Picker mode="date" value={newDate} onChange={(e) => setNewDate(e.detail.value)}>
                <View className="flex items-center justify-between py-6 px-7 rounded-3xl border border-input bg-white shadow-soft">
                  <Text className="text-lg text-foreground">{newDate || '请选择新日期'}</Text>
                  <Icon name="mdi-calendar" size="sm" color="muted" />
                </View>
              </Picker>
            </View>
          )}

          {/* 请假原因 */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">请假原因</Text>
            <View className="border border-input rounded-3xl py-5 px-7 bg-white shadow-soft">
              <Textarea
                className="w-full text-lg text-foreground leading-relaxed min-h-40"
                placeholder="请输入请假原因"
                value={reason}
                onInput={(e) => setReason(e.detail.value || '')}
                maxlength={200}
              />
            </View>
          </View>
        </View>

        {/* 底部提交按钮 */}
        <View className="fixed bottom-0 left-0 right-0 py-6 px-8 bg-white/95 backdrop-blur-sm border-t border-input">
          <ActionButton
            text={submitting ? '提交中...' : '提交申请'}
            onClick={handleSubmit}
            disabled={submitting}
          />
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(LeaveRequestPage);
