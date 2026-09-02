/**
 * 学员详情 · 资料 Tab
 *
 * 使用场景：基础信息卡 + 家长绑定列表。
 * 功能说明：展示字段与邀请绑定入口，不改写学员数据。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';
import type { Student, StudentParent } from '@/types/student';
import { formatDateCN } from '@/utils/format';

export interface ProfilePanelProps {
  student: Student;
  parents: StudentParent[];
  onInviteParent: () => void;
}

const ProfilePanel: React.FC<ProfilePanelProps> = ({ student, parents, onInviteParent }) => {
  return (
    <ScrollView scrollY className="h-full">
      <View className="px-[32rpx] pt-[32rpx] pb-[200rpx] flex flex-col gap-[24rpx]">
        <View className="bg-card rounded-[28rpx] p-[32rpx] shadow-soft">
          <View className="flex items-center gap-[12rpx] mb-[28rpx]">
            <Icon name="mdi-account-outline" size={28} color="primary" />
            <Text className="text-[30rpx] font-bold text-foreground">基础信息</Text>
          </View>
          <View className="flex flex-col gap-[24rpx]">
            <View className="flex items-center justify-between">
              <Text className="text-[26rpx] text-muted-foreground">昵称</Text>
              <Text className="text-[28rpx] text-foreground font-medium">
                {student.nickname || '未填写'}
              </Text>
            </View>
            <View className="h-[2rpx] bg-muted" />
            <View className="flex items-center justify-between">
              <Text className="text-[26rpx] text-muted-foreground">性别</Text>
              <Text className="text-[28rpx] text-foreground font-medium">
                {student.gender === 'male' ? '男' : student.gender === 'female' ? '女' : '未填写'}
              </Text>
            </View>
            <View className="h-[2rpx] bg-muted" />
            <View className="flex items-center justify-between">
              <Text className="text-[26rpx] text-muted-foreground">出生日期</Text>
              <Text className="text-[28rpx] text-foreground font-medium">
                {student.birthday ? formatDateCN(student.birthday) : '未填写'}
              </Text>
            </View>
            <View className="h-[2rpx] bg-muted" />
            <View className="flex items-center justify-between">
              <Text className="text-[26rpx] text-muted-foreground">手机号</Text>
              <Text className="text-[28rpx] text-foreground font-medium">
                {student.phone || '未填写'}
              </Text>
            </View>
            <View className="h-[2rpx] bg-muted" />
            <View className="flex items-center justify-between">
              <Text className="text-[26rpx] text-muted-foreground">家庭地址</Text>
              <Text className="text-[28rpx] text-foreground font-medium text-right max-w-[60%]">
                {student.address || '未填写'}
              </Text>
            </View>
            <View className="h-[2rpx] bg-muted" />
            <View className="flex items-start justify-between gap-[24rpx]">
              <Text className="text-[26rpx] text-muted-foreground flex-shrink-0">备注</Text>
              <Text className="text-[28rpx] text-foreground font-medium text-right flex-1">
                {student.note || '未填写'}
              </Text>
            </View>
          </View>
        </View>

        <View className="bg-card rounded-[28rpx] p-[32rpx] shadow-soft">
          <View className="flex items-center justify-between mb-[28rpx]">
            <View className="flex items-center gap-[12rpx]">
              <Icon name="mdi-account-group" size={28} color="primary" />
              <Text className="text-[30rpx] font-bold text-foreground">家长绑定</Text>
            </View>
            <View
              className="flex items-center gap-[8rpx] rounded-[40rpx] bg-gradient-primary px-[28rpx] py-[12rpx] press-scale"
              onClick={onInviteParent}
            >
              <Icon name="mdi-link-plus" size={24} color="hsl(var(--primary-foreground))" />
              <Text className="text-[24rpx] text-primary-foreground font-medium">邀请绑定</Text>
            </View>
          </View>

          {parents.length > 0 ? (
            <View className="flex flex-col gap-[20rpx]">
              {parents.map((parent) => (
                <View
                  key={parent.id}
                  className="flex items-center gap-[20rpx] py-[20rpx] px-[24rpx] bg-muted rounded-[20rpx]"
                >
                  <View className="w-[72rpx] h-[72rpx] rounded-full bg-gradient-primary center flex-shrink-0">
                    <Icon name="mdi-account" size={32} color="hsl(var(--primary-foreground))" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[28rpx] font-medium text-foreground block">
                      {parent.parent?.name || '家长'}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground mt-[4rpx] block">
                      {parent.parent?.phone || '未绑定手机号'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="py-[40rpx] center-col gap-[16rpx]">
              <Icon name="mdi-account-plus" size={56} color="hsl(var(--muted-foreground))" />
              <Text className="text-[26rpx] text-muted-foreground">
                暂无家长绑定，点击「邀请绑定」分享给家长
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default ProfilePanel;
