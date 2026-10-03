import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import MemberCardIssueForm from '@/components/member-card/MemberCardIssueForm';
import PageContainer from '@/components/PageContainer';
import StudentAvatar from '@/components/student/StudentAvatar';
import StudentPickerSheet from '@/components/student/StudentPickerSheet';
import { studentService } from '@/services';
import type { Student } from '@/types/student';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/**
 * 发卡 / 课时充值页。
 *
 * 两种进入方式：
 * 1. 带 `studentId`（学员列表、学员详情的「去充值」）⇒ 直接进发卡表单；
 * 2. 不带参数（首页「课时充值」快捷入口）⇒ 页内先选学员，选好再进表单。
 */
const MemberCardIssuePage: React.FC = () => {
  const initialStudentId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.studentId || '');
  }, []);

  /** 页内选学员后会改写，所以是 state 而不是常量 */
  const [studentId, setStudentId] = useState(initialStudentId);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(Boolean(initialStudentId));
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(async () => {
    if (!studentId) {
      setStudent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const stu = await studentService.getById(studentId);
      if (!stu) {
        setStudent(null);
        Taro.showToast({ title: '未找到学员信息', icon: 'none' });
        return;
      }
      setStudent(stu);
    } catch (error) {
      logError('MemberCardIssuePage loadData', error);
      setLoadError('页面加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background flex items-center justify-center">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  // 没指定学员（从首页入口进来）：先选人，选好再发卡
  if (!studentId) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background px-[32rpx] pt-[32rpx]">
          <View
            className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft flex items-center gap-[20rpx] active:opacity-80"
            onClick={() => setPickerVisible(true)}
          >
            <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary-bg flex items-center justify-center">
              <Icon name="mdi-account-search" size={44} color="primary" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[30rpx] font-semibold text-foreground block">选择学员</Text>
              <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
                选好学员后为 TA 发卡、充值课时
              </Text>
            </View>
          </View>
        </View>
        <StudentPickerSheet
          visible={pickerVisible}
          title="选择学员"
          onClose={() => setPickerVisible(false)}
          onSelect={(picked) => {
            setPickerVisible(false);
            if (picked) {
              setLoading(true);
              setStudentId(picked.id);
            }
          }}
        />
      </PageContainer>
    );
  }

  if (loadError || !student) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-background px-[32rpx] flex items-center justify-center">
          <Empty
            description={loadError || '未找到学员信息'}
            actionText="重新加载"
            onAction={() => void loadData()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="min-h-screen bg-background px-[32rpx] pt-[32rpx]">
        <View className="bg-white rounded-[24rpx] p-[28rpx] shadow-soft flex items-center gap-[20rpx] mb-[20rpx]">
          <StudentAvatar name={student.name} src={student.avatar_url} size="lg" />
          <View className="flex-1 min-w-0">
            <Text className="text-[34rpx] font-bold text-foreground block">{student.name}</Text>
            <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
              {student.phone || '暂无手机号'}
            </Text>
          </View>
        </View>
        <MemberCardIssueForm student={student} />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(MemberCardIssuePage);
