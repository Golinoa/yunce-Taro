/**
 * 使用帮助页 package-settings/pages/help/index（教师端）
 *
 * 参考 UI 设计稿风格重构：
 *   头部：Hi~ 问候 + 副标题 + 装饰图标
 *   功能入口：3 个分类卡片横排（点击切换当前展示模块）
 *   内容区：手风琴式问答列表（点击展开/收起答案）
 *   底部：电话客服 + 在线咨询 双入口（轻量统一风格）
 * 保留原生导航栏，标题「使用帮助」。全部使用 UnoCSS Token，随主题色联动。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import SupportQrDialog from '@/components/SupportQrDialog';
import { useThemeStore } from '@/stores/theme';

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
  icon: string;
  subgroups: FAQSubGroup[];
}

const FAQ_MODULES: FAQModule[] = [
  {
    id: 'student-family',
    title: '学员与家庭',
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
              '松果排课采用分角色权限管理，教师只能查看自己校区和班级的学员数据，家长只能查看自己绑定的子女信息。敏感操作如充值、请假等均需身份校验，确保数据安全。',
          },
        ],
      },
    ],
  },
];

/** 主题 key → CSS 类名映射 */
const THEME_CLASS_MAP: Record<string, string> = {
  orange: 'theme-orange',
  coral: 'theme-coral',
  blue: '',
};

/** 将模块的所有子分组问答扁平化为编号列表 */
function flattenModuleItems(module: FAQModule): { item: FAQItem; subgroupTitle: string }[] {
  const result: { item: FAQItem; subgroupTitle: string }[] = [];
  module.subgroups.forEach((sg) => {
    sg.items.forEach((item) => {
      result.push({ item, subgroupTitle: sg.title });
    });
  });
  return result;
}

const Help: React.FC = () => {
  const { activeTheme } = useThemeStore();
  const themeClass = THEME_CLASS_MAP[activeTheme] || '';

  // 默认选中第一个模块
  const [activeModuleId, setActiveModuleId] = useState<string>(FAQ_MODULES[0].id);

  // 手风琴：当前展开的问答 ID 集合（支持多开或单开，这里用单开更符合常见交互）
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 展开全部 / 收起全部
  const [expandAll, setExpandAll] = useState(false);

  const [qrVisible, setQrVisible] = useState(false);

  const activeModule = useMemo(
    () => FAQ_MODULES.find((m) => m.id === activeModuleId) ?? FAQ_MODULES[0],
    [activeModuleId],
  );

  const flatItems = useMemo(() => flattenModuleItems(activeModule), [activeModule]);

  const handleFeedback = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/feedback/index' });
  }, []);

  /** 手风琴切换：点击同一项收起，点击不同项展开 */
  const handleToggleItem = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setExpandAll(false);
  }, []);

  /** 展开全部 / 收起全部 */
  const handleToggleAll = useCallback(() => {
    setExpandAll((prev) => {
      if (prev) {
        setExpandedId(null);
        return false;
      }
      setExpandedId('__all__');
      return true;
    });
  }, []);

  const isExpanded = useCallback(
    (id: string) => expandAll || expandedId === id,
    [expandAll, expandedId],
  );

  return (
    <View className={cn('min-h-screen bg-background flex flex-col', themeClass)}>
      {/* ====== 头部（Hi~ 问候 + 副标题 + 装饰图标） ====== */}
      <View className="bg-background px-[32rpx] pt-[48rpx] pb-[20rpx]">
        <View className="flex items-start justify-between">
          <View className="flex-1 pr-[16rpx]">
            <Text className="text-[44rpx] font-bold text-foreground leading-tight">
              Hi~，有什么可以帮您！
            </Text>
            <Text className="mt-[12rpx] text-[26rpx] text-muted-foreground leading-relaxed block">
              常见问题一站式查询，快速上手松果排课
            </Text>
          </View>
          {/* 装饰图标 */}
          <View className="w-[100rpx] h-[100rpx] rounded-[28rpx] bg-primary/10 center flex-shrink-0 mt-[8rpx]">
            <Icon name="mdi-headset" size={48} color="primary" />
          </View>
        </View>
      </View>

      {/* ====== 功能入口：3 个分类卡片横排 ====== */}
      <View className="px-[32rpx] pt-[16rpx] pb-[4rpx]">
        <View className="flex gap-[20rpx]">
          {FAQ_MODULES.map((module) => {
            const isActive = module.id === activeModuleId;
            return (
              <View
                key={module.id}
                className={cn(
                  'flex-1 flex flex-col items-center py-[24rpx] rounded-[20rpx] press-scale transition-colors duration-200',
                  isActive ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-card shadow-card',
                )}
                onClick={() => setActiveModuleId(module.id)}
              >
                <View
                  className={cn(
                    'w-[80rpx] h-[80rpx] rounded-[18rpx] center mb-[12rpx]',
                    isActive ? 'bg-primary' : 'bg-primary/10',
                  )}
                >
                  <Icon name={module.icon} size={36} color={isActive ? '#ffffff' : 'primary'} />
                </View>
                <Text
                  className={cn(
                    'text-[24rpx] font-medium leading-tight text-center',
                    isActive ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {module.title}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ====== 内容区：手风琴式问答列表 ====== */}
      <ScrollView scrollY className="flex-1 mt-[24rpx]" showScrollbar={false}>
        <View className="px-[32rpx] pt-[8rpx] pb-[24rpx]">
          {/* 模块标题 */}
          <View className="flex items-center justify-between mb-[24rpx]">
            <Text className="text-[30rpx] font-bold text-foreground">常见问题</Text>
            <Text className="text-[24rpx] text-muted-foreground">{activeModule.title}</Text>
          </View>

          {/* 手风琴列表 */}
          <View className="bg-card rounded-[24rpx] shadow-card overflow-hidden">
            {flatItems.map(({ item, subgroupTitle }, idx) => {
              const open = isExpanded(item.id);
              return (
                <View key={item.id} className="border-b border-border/40 last:border-b-0">
                  {/* 问题行（点击展开/收起） */}
                  <View
                    className="flex items-center px-[32rpx] py-[32rpx] press-scale"
                    onClick={() => handleToggleItem(item.id)}
                  >
                    <Text className="w-[44rpx] text-[28rpx] font-bold flex-shrink-0 text-primary text-center">
                      {idx + 1}
                    </Text>
                    <View className="flex-1 min-w-0 ml-[16rpx]">
                      <Text
                        className={cn(
                          'text-[28rpx] leading-relaxed',
                          open ? 'font-semibold text-primary' : 'text-foreground',
                        )}
                      >
                        {item.question}
                      </Text>
                      {!open && (
                        <Text className="mt-[6rpx] text-[24rpx] text-muted-foreground line-clamp-1">
                          {subgroupTitle}
                        </Text>
                      )}
                    </View>
                    <Icon
                      name={open ? 'mdi-chevron-up' : 'mdi-chevron-right'}
                      size={28}
                      color={open ? 'primary' : 'mutedForeground'}
                      className="ml-[12rpx] flex-shrink-0 transition-transform duration-200"
                    />
                  </View>

                  {/* 答案展开区 */}
                  {open && (
                    <View className="px-[32rpx] pb-[32rpx] ml-[60rpx]">
                      <View className="border-l-[3rpx] border-primary/30 pl-[24rpx]">
                        <Text className="text-[27rpx] text-foreground/85 leading-[1.75]">
                          {item.answer}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* 展开 / 收起 全部 */}
          {flatItems.length > 4 && (
            <View
              className="mt-[28rpx] flex items-center justify-center gap-[6rpx] press-scale py-[8rpx]"
              onClick={handleToggleAll}
            >
              <Text className="text-[26rpx] text-muted-foreground">
                {expandAll ? '收起全部' : '展开全部'}
              </Text>
              <Icon
                name={expandAll ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                size={24}
                color="mutedForeground"
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* ====== 底部：联系客服 + 在线咨询 ====== */}
      <View className="px-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))] pt-[20rpx] border-t border-border/40 bg-background">
        <View className="flex gap-[24rpx]">
          <View
            className="flex-1 h-[88rpx] rounded-[24rpx] border border-border/60 bg-card center flex items-center justify-center gap-[10rpx] press-scale"
            onClick={() => setQrVisible(true)}
          >
            <Icon name="mdi-headset" size={28} color="foreground" />
            <Text className="text-[28rpx] font-medium text-foreground">联系客服</Text>
          </View>
          <View
            className="flex-1 h-[88rpx] rounded-[24rpx] border border-border/60 bg-card center flex items-center justify-center gap-[10rpx] press-scale"
            onClick={handleFeedback}
          >
            <Icon name="mdi-chat-processing-outline" size={28} color="foreground" />
            <Text className="text-[28rpx] font-medium text-foreground">在线咨询</Text>
          </View>
        </View>
      </View>

      <SupportQrDialog visible={qrVisible} onClose={() => setQrVisible(false)} />
    </View>
  );
};

export default Help;
