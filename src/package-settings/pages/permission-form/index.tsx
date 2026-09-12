/**
 * 角色权限表单页 package-settings/pages/permission-form/index
 *
 * 使用场景：角色权限列表 → 新建角色 / 编辑角色（仅管理员可操作）
 * 功能说明：
 * - 创建：输入角色名称（继承"老师"默认权限），配置数据范围与模块开关，保存
 * - 编辑：读取已有授权配置（系统角色/自定义角色），调整范围与模块，保存
 * 设计语言参考 package-course/pages/course-form（Card + FormRow）。
 */
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import FormRow from '@/components/FormRow';
import PageContainer from '@/components/PageContainer';
import { auditLogService } from '@/services/audit-log';
import { usePermissionStore } from '@/stores/permission';
import {
  ALL_DATA_MODULES,
  defaultRoleGrant,
  type DataModule,
  type DataScope,
} from '@/types/permission';
import { isAdmin, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const MODULE_LABELS: Record<DataModule, string> = {
  salary: '薪资',
  students: '学员',
  classes: '班级/课程',
  leads: '线索/试听',
  finance: '经营数据',
  staff: '员工管理',
  settings: '系统设置',
};

const SCOPE_LABELS: Record<DataScope, string> = {
  own: '仅本人数据',
  campus: '本校区数据',
  all: '机构全部数据',
};

const SCOPES: DataScope[] = ['own', 'campus', 'all'];

const ROLE_DESC: Record<string, string> = {
  admin: '拥有全部权限，可分配权限',
  principal: '默认查看校区全部数据，可由管理员开关授权',
  teacher: '默认仅本人名下学员数据，可由管理员/校长开关授权',
  assistant: '默认仅本人名下数据（无薪资），可由管理员/校长开关授权',
};

const PermissionForm: React.FC = () => {
  useCardNavigationBar();
  const router = useRouter();
  const params = router?.params || {};
  const mode = (params.mode as 'create' | 'edit') || 'edit';
  const roleKey = (params.key as string) || '';

  const { currentRole, profile } = useAuth();
  const config = usePermissionStore((s) => s.config);
  const updateGrant = usePermissionStore((s) => s.updateGrant);
  const addCustomRole = usePermissionStore((s) => s.addCustomRole);
  const updateCustomRole = usePermissionStore((s) => s.updateCustomRole);
  const save = usePermissionStore((s) => s.save);

  // 编辑既有角色（系统角色 or 自定义）；创建时为老师基准
  const isSystemRole = ['principal', 'teacher', 'assistant'].includes(roleKey);
  const customRole = !isSystemRole ? config.customRoles.find((r) => r.id === roleKey) : undefined;

  const initialGrant = (() => {
    if (mode === 'create') return defaultRoleGrant('teacher');
    if (isSystemRole) return config.grants[roleKey] ?? defaultRoleGrant(roleKey as 'teacher');
    if (customRole)
      return (
        config.grants[customRole.id] ?? {
          scope: customRole.scope,
          modules: [...customRole.modules],
        }
      );
    return defaultRoleGrant('teacher');
  })();

  const [name, setName] = useState<string>(
    customRole?.name || (mode === 'create' ? '' : ROLE_DESC[roleKey] ? '' : ''),
  );
  const [scope, setScope] = useState<DataScope>(initialGrant.scope);
  const [modules, setModules] = useState<DataModule[]>(initialGrant.modules);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isAdmin(currentRole)) {
      Taro.switchTab({ url: '/pages/home/index' });
    }
  }, [currentRole]);

  const toggleModule = useCallback((m: DataModule) => {
    setModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }, []);

  const handleSave = useCallback(async () => {
    if (mode === 'create') {
      const trimmed = name.trim();
      if (!trimmed) {
        setError('请输入角色名称');
        return;
      }
      const role = addCustomRole(trimmed, 'teacher');
      updateGrant(role.id, { scope, modules });
      try {
        await save();
        // 审计日志（用户口径 2026-08-22）：权限配置变更属高权限操作
        void auditLogService
          .record({
            action: 'permission.save',
            operatorId: profile?.id || '',
            operatorName: profile?.name || '未知',
            operatorRole: profile?.currentContext?.role || 'unknown',
            targetType: 'permission',
            detail: `保存权限配置：新建自定义角色「${trimmed}」（${modules.length} 个模块）`,
            meta: { mode: 'create', roleName: trimmed, scope, moduleCount: modules.length },
          })
          .catch((e) => logError('audit permission.save', e));
        Taro.showToast({ title: '已创建', icon: 'success' });
        setTimeout(() => Taro.navigateBack(), 600);
      } catch (err) {
        // 版本冲突：刷新缓存并如实提示，禁止静默覆盖
        if (Number((err as { code?: number })?.code) === 409) {
          void usePermissionStore.getState().load();
          Taro.showToast({ title: '权限已被他人修改，已刷新', icon: 'none' });
        } else {
          Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
        }
      }
      return;
    }
    // 编辑：系统角色直接写 grant；自定义角色同步 name
    if (customRole) {
      const trimmed = name.trim();
      if (!trimmed) {
        setError('角色名称不能为空');
        return;
      }
      updateCustomRole(customRole.id, { name: trimmed });
    }
    const key = isSystemRole ? roleKey : customRole?.id || roleKey;
    updateGrant(key, { scope, modules });
    try {
      await save();
      // 审计日志（用户口径 2026-08-22）：权限配置变更属高权限操作
      void auditLogService
        .record({
          action: 'permission.save',
          operatorId: profile?.id || '',
          operatorName: profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'permission',
          detail: `保存权限配置：「${name}」（${modules.length} 个模块，${SCOPE_LABELS[scope]}）`,
          meta: { mode: 'edit', roleKey: key, scope, moduleCount: modules.length },
        })
        .catch((e) => logError('audit permission.save', e));
      Taro.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 600);
    } catch (err) {
      // 版本冲突：刷新缓存并如实提示，禁止静默覆盖
      if (Number((err as { code?: number })?.code) === 409) {
        void usePermissionStore.getState().load();
        Taro.showToast({ title: '权限已被他人修改，已刷新', icon: 'none' });
      } else {
        Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    }
  }, [
    mode,
    name,
    scope,
    modules,
    customRole,
    isSystemRole,
    roleKey,
    addCustomRole,
    updateCustomRole,
    updateGrant,
    save,
    profile,
  ]);

  if (!isAdmin(currentRole)) return null;

  const isNameEditable = mode === 'create' || !!customRole;
  const headerTitle =
    mode === 'create'
      ? '新建角色'
      : isSystemRole
        ? `编辑：${ROLE_DESC[roleKey] ? roleKey : roleKey}`
        : customRole?.name || '编辑角色';

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[32rpx] pb-[160rpx]">
        <Text className="text-[32rpx] font-semibold text-foreground">{headerTitle}</Text>
        <Text className="mt-[8rpx] block text-[26rpx] text-muted-foreground">
          {mode === 'create'
            ? '新建后默认继承「老师」权限，可再调整'
            : isSystemRole
              ? `系统角色（${roleKey}）：仅修改模块与范围`
              : '自定义角色'}
        </Text>

        {/* 基础信息 */}
        <View className="mt-[32rpx]">
          <Card className="p-[32rpx]">
            <FormRow label="角色名称" required>
              <View className="flex-1">
                <FormInput
                  placeholder="请输入角色名称"
                  value={name}
                  onInput={(e) => {
                    setName(e.detail.value);
                    if (error) setError(undefined);
                  }}
                  disabled={!isNameEditable}
                  variant="ghost"
                  error={error}
                />
              </View>
            </FormRow>
            {!isNameEditable && (
              <View className="px-[8rpx] pt-[8rpx]">
                <Text className="text-[24rpx] text-muted-foreground">系统角色名称不可修改</Text>
              </View>
            )}
          </Card>
        </View>

        {/* 数据范围 */}
        <View className="mt-[32rpx]">
          <Card className="p-[32rpx]">
            <Text className="text-[28rpx] font-medium text-foreground mb-[24rpx]">数据范围</Text>
            <View className="flex flex-row">
              {SCOPES.map((s) => (
                <View
                  key={s}
                  className={cn(
                    'px-[24rpx] py-[16rpx] mr-[16rpx] rounded-full text-[26rpx]',
                    scope === s
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground',
                  )}
                  onClick={() => setScope(s)}
                >
                  <Text>{SCOPE_LABELS[s]}</Text>
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* 数据模块 */}
        <View className="mt-[32rpx]">
          <Card className="p-[32rpx]">
            <Text className="text-[28rpx] font-medium text-foreground mb-[24rpx]">
              可见数据模块
            </Text>
            {ALL_DATA_MODULES.map((m) => {
              const on = modules.includes(m);
              return (
                <FormRow key={m} label={MODULE_LABELS[m]} onClick={() => toggleModule(m)}>
                  <View
                    className={cn(
                      'w-[88rpx] h-[48rpx] rounded-full flex items-center px-[6rpx]',
                      on ? 'bg-primary justify-end' : 'bg-muted justify-start',
                    )}
                  >
                    <View className="w-[36rpx] h-[36rpx] rounded-full bg-white" />
                  </View>
                </FormRow>
              );
            })}
          </Card>
        </View>

        <View
          className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-primary text-primary-foreground rounded-full py-[28rpx] flex items-center justify-center"
          onClick={handleSave}
        >
          <Text className="text-[30rpx] font-medium">保存</Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default PermissionForm;
