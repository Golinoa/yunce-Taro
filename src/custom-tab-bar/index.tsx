/**
 * 自定义 TabBar — 仅 admin/principal 渲染「数据」Tab
 *
 * 使用 View + Icon（非 CoverImage）：微信 CoverImage 对 class 尺寸几乎无效，
 * 本地 png 路径也常在自定义 tabBar 里加载失败导致「图标不显示」。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Component } from 'react';
import Icon, { type IconName } from '@/components/Icon';
import type { UserRole } from '@/types/profile';
import { isFinanceTabRole } from '@/utils/tab-bar';
import './index.scss';

export interface TabBarItem {
  pagePath: string;
  text: string;
  icon: IconName;
  iconActive: IconName;
}

const HOME_TAB: TabBarItem = {
  pagePath: '/pages/home/index',
  text: '首页',
  icon: 'mdi-home-outline',
  iconActive: 'mdi-home',
};

const SCHEDULE_TAB: TabBarItem = {
  pagePath: '/pages/schedule/index',
  text: '课表',
  icon: 'mdi-calendar-outline',
  iconActive: 'mdi-calendar',
};

const STATISTICS_TAB: TabBarItem = {
  pagePath: '/pages/statistics/index',
  text: '数据',
  icon: 'mdi-chart-bar',
  iconActive: 'mdi-chart-bar',
};

const PROFILE_TAB: TabBarItem = {
  pagePath: '/pages/profile/index',
  text: '我的',
  icon: 'mdi-account-outline',
  iconActive: 'mdi-account',
};

function buildTabList(role?: UserRole | null): TabBarItem[] {
  if (isFinanceTabRole(role)) {
    return [HOME_TAB, SCHEDULE_TAB, STATISTICS_TAB, PROFILE_TAB];
  }
  return [HOME_TAB, SCHEDULE_TAB, PROFILE_TAB];
}

function readStoredRole(): UserRole | null {
  try {
    const role = Taro.getStorageSync('userRole') as UserRole | '';
    return role || null;
  } catch {
    return null;
  }
}

interface CustomTabBarState {
  selectedPath: string;
  color: string;
  selectedColor: string;
  backgroundColor: string;
  list: TabBarItem[];
  /** 全屏弹层（BottomSheet）打开期间为 true；为 true 时整个 tabBar 不渲染 */
  hidden: boolean;
}

export default class CustomTabBar extends Component<object, CustomTabBarState> {
  // Taro 约定 static options 置于类顶部，绕过 react/sort-comp 默认排序
  // eslint-disable-next-line react/sort-comp
  static options = {
    addGlobalClass: true,
  };

  state: CustomTabBarState = {
    selectedPath: '/pages/home/index',
    color: '#999999',
    selectedColor: '#3B6EF5',
    backgroundColor: '#ffffff',
    list: buildTabList(readStoredRole()),
    hidden: false,
  };

  setSelectedByPath = (pagePath: string) => {
    const normalized = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
    this.setState({ selectedPath: normalized });
  };

  refreshByRole = (role?: UserRole | null) => {
    const nextRole = role === undefined ? readStoredRole() : role;
    const list = buildTabList(nextRole);
    this.setState((prev) => {
      const stillExists = list.some((item) => item.pagePath === prev.selectedPath);
      return {
        list,
        selectedPath: stillExists ? prev.selectedPath : list[0]?.pagePath || prev.selectedPath,
      };
    });
  };

  setColors = (colors: { color: string; selectedColor: string; backgroundColor: string }) => {
    this.setState({
      color: colors.color,
      selectedColor: colors.selectedColor,
      backgroundColor: colors.backgroundColor,
    });
  };

  /**
   * 让 tabBar 让位给全屏弹层（BottomSheet）。
   *
   * 为什么必须由组件自己退出、而不能靠弹层盖住：
   * 本项目 tabBar 是自定义模式（`app.config.ts` 的 `tabBar.custom = true`），
   * 页面内容无法可靠地覆盖它（2026-09-28 截图实测：批量处理弹层底部被 tabBar 压住），
   * `Taro.hideTabBar()` 对它同样无效。让组件自身不渲染是最可靠的方式。
   *
   * 调用方：`src/utils/tab-bar.ts` 的 `acquireTabBarHidden()`（带引用计数），
   * 实例通过 `Taro.getTabBar(page)` 取得。
   */
  setHidden = (hidden: boolean) => {
    if (this.state.hidden !== hidden) {
      this.setState({ hidden });
    }
  };

  handleSwitch = (item: TabBarItem) => {
    this.setState({ selectedPath: item.pagePath });
    void Taro.switchTab({ url: item.pagePath });
  };

  componentDidMount() {
    this.refreshByRole(readStoredRole());
  }

  render() {
    const { list, selectedPath, color, selectedColor, backgroundColor, hidden } = this.state;

    // 全屏弹层打开期间整个 tabBar 让位（不渲染）——
    // 它的层级无法被弹层可靠覆盖，只能由自己退出。
    if (hidden) {
      return null;
    }

    return (
      <View className="custom-tab-bar" style={{ backgroundColor }}>
        {list.map((item) => {
          const selected = item.pagePath === selectedPath;
          const tint = selected ? selectedColor : color;
          return (
            <View
              key={item.pagePath}
              className="custom-tab-bar__item"
              onClick={() => this.handleSwitch(item)}
            >
              <Icon name={selected ? item.iconActive : item.icon} size={44} color={tint} />
              <Text className="custom-tab-bar__text" style={{ color: tint }}>
                {item.text}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }
}
