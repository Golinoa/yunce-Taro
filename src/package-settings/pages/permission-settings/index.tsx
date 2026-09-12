/**
 * 角色权限列表页 package-settings/pages/permission-settings/index
 *
 * 使用场景：系统设置 → 角色权限（仅管理员可操作）
 * 功能说明：
 * - 列出预制系统角色（管理员只读；校长/老师/前台可点击进入编辑）
 * - 列出自定义角色（点击进入编辑/删除）
 * - 底部"新建角色"按钮 → 进入 form（创建模式）
 * 设计语言参考 package-course/pages/course-form（Card + FormRow）。
 */
import { Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { usePermissionStore } from '@/stores/permission';
import { useRoleGlossaryStore } from '@/stores/role-glossary';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import { isAdmin, useAuth } from '@/utils/auth';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const PermissionSettings: React.FC = () => {
  useCardNavigationBar();
  const { currentRole } = useAuth();
  const { activeTheme } = useThemeStore();
  const titles = useRoleGlossaryStore((s) => s.titles);
  const loadTitles = useRoleGlossaryStore((s) => s.load);
  const config = usePermissionStore((s) => s.config);
  const removeCustomRole = usePermissionStore((s) => s.removeCustomRole);
  const save = usePermissionStore((s) => s.save);

  useDidShow(() => {
    void usePermissionStore.getState().load();
    void loadTitles();
  });

  const ROLE_LABELS: Record<string, string> = {
    admin: '管理员',
    principal: titles.manager,
    teacher: titles.teacher,
    assistant: '前台',
  };

  const ROLE_DESC: Record<string, string> = {
    admin: '拥有全部权限，可分配权限',
    principal: '默认查看校区全部数据，可开关授权',
    teacher: '默认仅本人名下学员数据，可开关授权',
    assistant: '默认仅本人名下数据（无薪资），可开关授权',
  };

  const goForm = useCallback((mode: 'create' | 'edit', key: string) => {
    Taro.navigateTo({
      url: `/package-settings/pages/permission-form/index?mode=${mode}&key=${encodeURIComponent(key)}`,
    });
  }, []);

  const handleNew = useCallback(() => goForm('create', ''), [goForm]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      Taro.showModal({
        title: '删除角色',
        content: `确定删除自定义角色「${name}」吗？`,
        confirmColor: getThemeHexColors(activeTheme).primary,
        success: (res) => {
          if (res.confirm) {
            removeCustomRole(id);
            void save().catch((err) => {
              // 版本冲突：刷新缓存并如实提示，禁止静默覆盖
              if (Number((err as { code?: number })?.code) === 409) {
                void usePermissionStore.getState().load();
                Taro.showToast({ title: '权限已被他人修改，已刷新', icon: 'none' });
              } else {
                Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
              }
            });
          }
        },
      });
    },
    [removeCustomRole, save, activeTheme],
  );

  if (!isAdmin(currentRole)) {
    Taro.switchTab({ url: '/pages/home/index' });
    return null;
  }

  const renderSystemRow = (key: string) => {
    const isAdminRow = key === 'admin';
    const grant = config.grants[key];
    const moduleCount = grant?.modules?.length ?? 0;
    return (
      <View
        key={key}
        className="flex flex-row items-center justify-between px-[28rpx] py-[28rpx] active:opacity-70 press-bg"
        onClick={() => !isAdminRow && goForm('edit', key)}
      >
        <View className="flex-1 mr-[16rpx]">
          <View className="flex flex-row items-center">
            <Text className="text-[30rpx] font-medium text-foreground">{ROLE_LABELS[key]}</Text>
            {isAdminRow && (
              <View className="ml-[12rpx] px-[12rpx] py-[2rpx] rounded-full bg-primary-bg">
                <Text className="text-[20rpx] text-primary">全量权限</Text>
              </View>
            )}
          </View>
          <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
            {ROLE_DESC[key]}
          </Text>
          {!isAdminRow && (
            <Text className="mt-[4rpx] block text-[22rpx] text-muted-foreground">
              当前 {moduleCount} 个模块可见
            </Text>
          )}
        </View>
        {!isAdminRow && <Icon name="mdi-chevron-right" size={28} color="mutedForeground" />}
      </View>
    );
  };

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[32rpx] pb-[160rpx]">
        <Text className="text-[32rpx] font-semibold text-foreground">角色权限</Text>
        <Text className="mt-[8rpx] block text-[26rpx] text-muted-foreground">点选角色编辑授权</Text>

        {/* 系统角色 */}
        <View className="bg-card rounded-[28rpx] shadow-soft overflow-hidden mt-[32rpx]">
          <View className="px-[28rpx] py-[24rpx]">
            <Text className="text-[28rpx] font-medium text-foreground">系统角色</Text>
            <Text className="mt-[4rpx] block text-[24rpx] text-muted-foreground">
              预置角色，权限可由管理员调整
            </Text>
          </View>
          {['admin', 'principal', 'teacher', 'assistant'].map((k, i, arr) => (
            <View key={k} className={cn(i < arr.length - 1 && 'border-t border-border')}>
              {renderSystemRow(k)}
            </View>
          ))}
        </View>

        {/* 自定义角色 */}
        <View className="bg-card rounded-[28rpx] shadow-soft overflow-hidden mt-[32rpx]">
          <View className="px-[28rpx] py-[24rpx] flex flex-row items-center justify-between">
            <View>
              <Text className="text-[28rpx] font-medium text-foreground">自定义角色</Text>
              <Text className="mt-[4rpx] block text-[24rpx] text-muted-foreground">
                机构专属岗位（教学主管/财务/市场等）
              </Text>
            </View>
            <View
              className="px-[28rpx] py-[14rpx] bg-primary text-primary-foreground rounded-full"
              onClick={handleNew}
            >
              <Text className="text-[26rpx]">新建角色</Text>
            </View>
          </View>
          {config.customRoles.length === 0 ? (
            <View className="px-[28rpx] py-[40rpx] text-center border-t border-border">
              <Text className="text-[26rpx] text-muted-foreground">
                暂无自定义角色，点击右上角新建
              </Text>
            </View>
          ) : (
            config.customRoles.map((role, i, arr) => (
              <View key={role.id} className={cn(i < arr.length - 1 && 'border-t border-border')}>
                <View className="flex flex-row items-center px-[28rpx] py-[28rpx] active:opacity-70 press-bg">
                  <View className="flex-1 mr-[16rpx]" onClick={() => goForm('edit', role.id)}>
                    <Text className="text-[30rpx] font-medium text-foreground">{role.name}</Text>
                    <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                      基准：{ROLE_LABELS[role.baseRole]} · 可见{' '}
                      {(config.grants[role.id]?.modules ?? []).length} 个模块
                    </Text>
                  </View>
                  <View
                    className="mr-[24rpx] px-[20rpx] py-[8rpx] rounded-full bg-destructive text-destructive-foreground"
                    onClick={() => handleDelete(role.id, role.name)}
                  >
                    <Text className="text-[22rpx]">删除</Text>
                  </View>
                  <Icon
                    name="mdi-chevron-right"
                    size={28}
                    color="mutedForeground"
                    onClick={() => goForm('edit', role.id)}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </PageContainer>
  );
};

export default PermissionSettings;
