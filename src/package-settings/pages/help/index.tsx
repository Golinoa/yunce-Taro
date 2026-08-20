/**
 * 使用帮助页 package-settings/pages/help/index
 *
 * 信息采用三级分层结构：
 *   一级 功能模块（学员与家庭 / 课程与出勤 / 门店与经营）——卡片入口，带图标、副标题与问题数
 *   二级 子分组（如「学员档案」「家庭协作」）——进入模块后按主题归并，带强调色小标题
 *   三级 单个问答——手风琴展开
 * 全部使用 UnoCSS Token，随主题色联动。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { usePrimaryNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQSubGroup {
  id: string;
  title: string;
  items: FAQItem[];
}

interface FAQModule {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  subgroups: FAQSubGroup[];
}

const FAQ_MODULES: FAQModule[] = [
  {
    id: 'student-family',
    title: '学员与家庭',
    subtitle: '学员档案、家庭协作一目了然',
    icon: 'mdi-account-group-outline',
    subgroups: [
      {
        id: 'student-profile',
        title: '学员档案',
        items: [
          {
            id: 'add-student',
            question: '教师如何添加新学员？',
            answer:
              '进入「学员」页面，点击右下角「+」按钮，填写学员姓名、性别、生日、联系方式等基本信息后保存。新增学员会自动生成唯一邀请码，可用于邀请家长绑定。',
          },
          {
            id: 'add-child',
            question: '家长如何添加子女？',
            answer:
              '在「我的」页面点击「我的资料」，切换到「子女资料」Tab，点击「添加子女」按钮，填写子女昵称、关系、性别、生日等信息即可。也可通过教师分享的邀请码自动绑定。',
          },
        ],
      },
      {
        id: 'family-collab',
        title: '家庭协作',
        items: [
          {
            id: 'invite-guardian',
            question: '如何邀请家人一起管理孩子？',
            answer:
              '家长端进入子女详情页，在「邀请监护人」Tab 中点击「邀请家人」按钮，复制邀请码分享给家人。对方在「家长绑定」页面输入邀请码后即可绑定，共同查看课程、卡包和出勤记录。',
          },
          {
            id: 'role-switch',
            question: '如何在教师和家长身份之间切换？',
            answer:
              '在「我的」页面顶部点击当前身份卡片，或进入「角色切换」页面，即可在教师、家长等多个身份之间一键切换。切换后首页和功能菜单会自动适配对应身份。',
          },
        ],
      },
    ],
  },
  {
    id: 'course-attendance',
    title: '课程与出勤',
    subtitle: '排课、消课、请假全覆盖',
    icon: 'mdi-calendar-check-outline',
    subgroups: [
      {
        id: 'pre-class',
        title: '课前准备',
        items: [
          {
            id: 'recharge-package',
            question: '如何给学员充值课包？',
            answer:
              '在教师端进入学员详情页，点击「充值」按钮，选择课包模板或自定义课包类型，填写课时数、有效期、收费方式等信息后提交。充值成功后可在学员「卡包」中查看。',
          },
        ],
      },
      {
        id: 'in-class',
        title: '课中管理',
        items: [
          {
            id: 'record-attendance',
            question: '如何记录学员出勤和消课？',
            answer:
              '在「课表」页面找到对应课程，点击进入课程详情，选择需要签到的学员，标记出勤状态并填写消耗课时。系统会自动从学员卡包中扣除相应课时。',
          },
          {
            id: 'schedule-leave',
            question: '学员如何请假？',
            answer:
              '教师可在课程详情中为学员提交请假申请，选择请假日期和原因后提交审批。审批通过后该课程不会扣减课时，学员可在「出勤」记录中查看请假状态。',
          },
        ],
      },
    ],
  },
  {
    id: 'store-operation',
    title: '门店与经营',
    subtitle: '从开店配置到经营看板',
    icon: 'mdi-cog-outline',
    subgroups: [
      {
        id: 'basic-config',
        title: '基础配置',
        items: [
          {
            id: 'campus-config',
            question: '如何配置校区和教室？',
            answer:
              '在教师端进入「场馆设置」，可添加校区、教室、班级容量等基础信息。配置完成后，排课和预约时会自动关联对应校区和教室资源。',
          },
          {
            id: 'booking-rule',
            question: '如何设置预约规则？',
            answer:
              '进入「预约规则设置」，可配置是否允许取消预约、取消截止时间、是否开启候补排队等规则。规则设置后会同步影响家长端「我的课程」中的操作权限。',
          },
          {
            id: 'theme',
            question: '如何修改主题颜色？',
            answer:
              '进入「我的」页面，点击「主题颜色设置」，可在蓝色、珊瑚橙、活力橙等多套主题间切换。切换后导航栏、按钮、标签等全局元素会实时更新为对应主题色。',
          },
        ],
      },
      {
        id: 'operation-security',
        title: '经营与安全',
        items: [
          {
            id: 'statistics',
            question: '如何查看校区经营数据？',
            answer:
              '在底部 Tab 切换到「数据」页面，可按日、周、月查看会员数、课时消耗、收入、课消趋势等核心指标。支持切换不同校区和数据维度，方便管理者掌握经营情况。',
          },
          {
            id: 'data-security',
            question: '学员和家长数据安全吗？',
            answer:
              '云策教务采用分角色权限管理，教师只能查看自己校区和班级的学员数据，家长只能查看自己绑定的子女信息。敏感操作如充值、请假等均需身份校验，确保数据安全。',
          },
        ],
      },
    ],
  },
];

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <View className="flex flex-col gap-[16rpx]">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <View
            key={item.id}
            className="bg-card rounded-[24rpx] shadow-card overflow-hidden press-scale"
            onClick={() => handleToggle(item.id)}
          >
            <View className="flex items-center justify-between p-[28rpx]">
              <Text className="flex-1 text-[28rpx] font-semibold text-foreground leading-relaxed pr-[16rpx]">
                {item.question}
              </Text>
              <View
                className={cn(
                  'w-[44rpx] h-[44rpx] rounded-full bg-primary/10 center flex-shrink-0 transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
              >
                <Icon name="mdi-chevron-down" size={24} color="primary" />
              </View>
            </View>
            {isOpen && (
              <View className="px-[28rpx] pb-[28rpx] pt-[4rpx]">
                <View className="h-[1rpx] bg-border/60 mb-[20rpx]" />
                <Text className="text-[26rpx] text-muted-foreground leading-relaxed">
                  {item.answer}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function SubGroupSection({ subgroup }: { subgroup: FAQSubGroup }) {
  return (
    <View className="mt-[32rpx] first:mt-[8rpx]">
      <View className="flex items-center gap-[12rpx] mb-[16rpx]">
        <View className="w-[6rpx] h-[24rpx] rounded-[3rpx] bg-primary" />
        <Text className="text-[28rpx] font-bold text-foreground">{subgroup.title}</Text>
      </View>
      <FAQAccordion items={subgroup.items} />
    </View>
  );
}

const Help: React.FC = () => {
  usePrimaryNavigationBar();

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const activeModule = useMemo(
    () => FAQ_MODULES.find((m) => m.id === activeModuleId) ?? null,
    [activeModuleId],
  );

  const handleModuleClick = useCallback((id: string) => {
    setActiveModuleId(id);
  }, []);

  const handleBack = useCallback(() => {
    setActiveModuleId(null);
  }, []);

  const handleFeedback = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/feedback/index' });
  }, []);

  return (
    <View className="min-h-screen bg-background flex flex-col">
      {/* ====== 顶部标题区 ====== */}
      <View className="bg-background px-[32rpx] pt-[32rpx] pb-[24rpx]">
        {activeModule ? (
          <View className="relative h-[56rpx] flex items-center">
            <View
              className="absolute left-0 flex items-center justify-center w-[56rpx] h-[56rpx] rounded-full bg-muted press-scale"
              onClick={handleBack}
            >
              <Icon name="mdi-chevron-left" size={36} color="foreground" />
            </View>
            <Text className="w-full text-center text-[34rpx] font-bold text-foreground">
              {activeModule.title}
            </Text>
          </View>
        ) : (
          <View className="relative h-[56rpx] flex items-center justify-center">
            <Text className="text-[34rpx] font-bold text-foreground">使用帮助</Text>
          </View>
        )}

        {!activeModule && (
          <View className="mt-[48rpx]">
            <Text className="text-[48rpx] font-bold text-foreground leading-tight">
              你好，需要什么帮助？
            </Text>
            <Text className="mt-[16rpx] text-[28rpx] text-muted-foreground leading-relaxed">
              从了解功能到开店配置，这里都能找到答案
            </Text>
          </View>
        )}
      </View>

      {/* ====== 内容区 ====== */}
      <ScrollView scrollY className="flex-1" showScrollbar={false}>
        <View className="px-[32rpx] pt-[16rpx] pb-[48rpx]">
          {activeModule ? (
            <View>
              {activeModule.subgroups.map((subgroup) => (
                <SubGroupSection key={subgroup.id} subgroup={subgroup} />
              ))}
            </View>
          ) : (
            <View className="flex flex-col gap-[24rpx]">
              {FAQ_MODULES.map((module) => {
                const count = module.subgroups.reduce((sum, sg) => sum + sg.items.length, 0);
                return (
                  <View
                    key={module.id}
                    className="bg-card rounded-[24rpx] p-[28rpx] shadow-card flex items-center gap-[24rpx] press-scale"
                    onClick={() => handleModuleClick(module.id)}
                  >
                    <View className="w-[96rpx] h-[96rpx] rounded-[24rpx] bg-primary/10 center flex-shrink-0">
                      <Icon name={module.icon} size={48} color="primary" />
                    </View>
                    <View className="flex-1 min-w-0 flex flex-col gap-[8rpx]">
                      <Text className="text-[32rpx] font-bold text-foreground leading-tight">
                        {module.title}
                      </Text>
                      <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
                        {module.subtitle}
                      </Text>
                    </View>
                    <View className="flex flex-col items-end gap-[8rpx] flex-shrink-0">
                      <Text className="text-[22rpx] text-primary font-medium">{count} 个问题</Text>
                      <Icon name="mdi-chevron-right" size={32} color="mutedForeground" />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* 底部提示 */}
          <View className="mt-[48rpx] text-center">
            <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
              还有疑问？可联系你的门店，或到「我的 → 学员信箱」留言反馈
            </Text>
            <Text
              className="mt-[16rpx] inline-block text-[26rpx] font-medium text-primary press-scale"
              onClick={handleFeedback}
            >
              去反馈
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default withRouteGuard(Help);
