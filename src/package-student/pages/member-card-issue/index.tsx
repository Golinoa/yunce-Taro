import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import MemberCardIssueForm from '@/components/member-card/MemberCardIssueForm';
import MemberCardRechargeForm from '@/components/member-card/MemberCardRechargeForm';
import PageContainer from '@/components/PageContainer';
import StudentAvatar from '@/components/student/StudentAvatar';
import StudentPickerSheet from '@/components/student/StudentPickerSheet';
import { studentService } from '@/services';
import type { Student } from '@/types/student';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 会员卡操作：发新卡 / 给已有次卡追加次数 */
type CardOperation = 'issue' | 'recharge';

const OPERATION_TABS: { key: CardOperation; label: string }[] = [
  { key: 'issue', label: '发会员卡' },
  { key: 'recharge', label: '追加次数' },
];

/**
 * 会员卡操作页（课时充值入口）。
 *
 * 两种进入方式：
 * 1. 带 `studentId`（学员列表、学员详情的「去充值」）⇒ 直接进操作；
 * 2. 不带参数（首页「课时充值」快捷入口）⇒ 页内先选学员，选好再操作。
 * 选好学员后可切换「发会员卡 / 追加次数」两种方式。
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
  const [operation, setOperation] = useState<CardOperation>('issue');

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

  // 没指定学员（从首页入口进来）：先选人，选好再操作
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
                选好学员后可发会员卡或追加次数
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

        {/* 操作方式：发会员卡 | 追加次数 */}
        <View className="mb-[20rpx] bg-white rounded-[20rpx] shadow-sm overflow-hidden">
          <View className="flex">
            {OPERATION_TABS.map((tabItem) => (
              <View
                key={tabItem.key}
                className="flex-1 flex items-center justify-center py-[28rpx] relative"
                onClick={() => setOperation(tabItem.key)}
              >
                <Text
                  className={cn(
                    'text-[28rpx] font-medium',
                    operation === tabItem.key ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {tabItem.label}
                </Text>
                {operation === tabItem.key ? (
                  <View className="absolute bottom-0 left-0 right-0 h-[4rpx] bg-primary" />
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {operation === 'issue' ? (
          <MemberCardIssueForm student={student} />
        ) : (
          <MemberCardRechargeForm student={student} />
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(MemberCardIssuePage);
