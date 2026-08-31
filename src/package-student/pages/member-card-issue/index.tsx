import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import MemberCardIssueForm from '@/components/member-card/MemberCardIssueForm';
import PageContainer from '@/components/PageContainer';
import StudentAvatar from '@/components/student/StudentAvatar';
import { studentService } from '@/services';
import type { Student } from '@/types/student';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

const MemberCardIssuePage: React.FC = () => {
  const studentId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.studentId || '');
  }, []);

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(async () => {
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
