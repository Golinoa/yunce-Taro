# 首页设计稿迁移规范

> 设计稿源文件：`homepages.html`
> 目标页面：`src/pages/home/index.tsx`
> 迁移原则：**1:1 像素级还原**，除 icon 和快捷入口名称外，所有视觉参数严格对齐设计稿

---

## 一、设计系统 Token（从设计稿 CSS 提取）

### 1. 颜色体系

#### 主色（橙色主题 - 设计稿默认方案）
| Token | 设计稿值 | 用途 |
|-------|---------|------|
| `--primary` | `#ff7a45` | Tab激活、时间文字、点名按钮、标签 |
| `--primary-dark` | `#ff5a2e` | 渐变终点色 |
| `--primary-light` | `#ffa070` | 渐变起点色 |

#### 渐变背景
| Token | 设计稿值 |
|-------|---------|
| `--gradient-header` | `linear-gradient(135deg, #ffa070 0%, #ff8a55 25%, #ff6b35 50%, #ff5a2e 75%, #ff4a1e 100%)` |
| `--gradient-btn-rollcall` | `linear-gradient(135deg, #ff7a45 0%, #ff5a2e 100%)` |

#### 文字颜色
| Token | 设计稿值 | 用途 |
|-------|---------|------|
| `--text-primary` | `#333` | 标题、数字、课程名 |
| `--text-secondary` | `#666` | 已点名文字 |
| `--text-muted` | `#999` | 标签文字、分隔点、授课老师 |
| `--text-white` | `#fff` | 渐变区域文字 |
| `--text-white-90` | `rgba(255,255,255,0.9)` | 校区名 |
| `--text-white-80` | `rgba(255,255,255,0.8)` | 问候语副标题 |

#### 背景色
| Token | 设计稿值 | 用途 |
|-------|---------|------|
| `--bg-page` | `#f5f5f5` | 页面背景 |
| `--bg-card` | `#fff` | 白色卡片 |
| `--bg-stats-card` | `rgba(255,255,255,0.92)` | 统计卡片毛玻璃 |
| `--bg-tab-inactive` | `#f5f5f5` | 未激活Tab |
| `--bg-tag` | `#fff2e8` | 约课标签背景 |
| `--bg-divider` | `#f0f0f0` | 分隔线 |

#### 阴影
| Token | 设计稿值 | 用途 |
|-------|---------|------|
| `--shadow-stats` | `0 4px 20px rgba(0,0,0,0.08)` | 统计卡片 |
| `--shadow-rollcall` | `0 2px 8px rgba(255,90,46,0.3)` | 点名按钮 |
| `--shadow-icon-glass` | `inset 0 1px 1px rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.06)` | 毛玻璃图标 |

### 2. 尺寸体系（设计稿 px → rpx 换算：1px = 2rpx）

#### 顶部渐变区域
| 属性 | 设计稿值 | rpx值 |
|------|---------|-------|
| header padding | `20px 16px 28px` | `40rpx 32rpx 56rpx` |
| 问候语字号 | `24px` | `48rpx` |
| 问候语字重 | `600` | `font-semibold` |
| 问候语下边距 | `8px` | `16rpx` |
| 校区字号 | `14px` | `28rpx` |
| 校区颜色 | `rgba(255,255,255,0.9)` | `text-white/90` |
| 校区箭头间距 | `4px` | `8rpx` |
| 圆点图案位置 | `top:80px right:30px` | `top-40 right-15` |
| 圆点图案尺寸 | `140px × 140px` | `280rpx × 280rpx` |
| 圆点图案透明度 | `0.1` | `opacity-10` |
| 渐变区域高度 | `50vh min 340px` | `min-h-[680rpx]` |

#### 统计卡片
| 属性 | 设计稿值 | rpx值 |
|------|---------|-------|
| 圆角 | `16px` | `32rpx` |
| 外边距 | `0 16px` | `mx-8` |
| 内边距 | `16px` | `p-8` |
| 上边距 | `-8px` | `-mt-4` |
| 阴影 | `0 4px 20px rgba(0,0,0,0.08)` | `shadow-card` |
| Tab间距 | `8px` | `gap-4` |
| Tab下边距 | `20px` | `mb-10` |
| Tab内边距 | `6px 16px` | `py-3 px-8` |
| Tab圆角 | `16px` | `rounded-4xl` |
| Tab字号 | `13px` | `26rpx` |
| Tab激活背景 | `#ff7a45` | `bg-primary` |
| Tab未激活背景 | `#f5f5f5` | `bg-[#f5f5f5]` |
| Tab未激活颜色 | `#666` | `text-muted-foreground` |
| 数字字号 | `28px` | `56rpx` |
| 数字字重 | `700` | `font-bold` |
| 数字颜色 | `#333` | `text-foreground` |
| 数字下边距 | `4px` | `mb-2` |
| 标签字号 | `12px` | `24rpx` |
| 标签颜色 | `#999` | `text-muted-foreground` |

#### 快捷入口
| 属性 | 设计稿值 | rpx值 |
|------|---------|-------|
| 卡片圆角 | `16px` | `32rpx` |
| 卡片外边距 | `20px 16px` | `my-10 mx-8` |
| 卡片内边距 | `20px 16px` | `py-10 px-8` |
| 网格间距 | `20px 8px` | `gap-y-10 gap-x-4` |
| 图标容器尺寸 | `52px × 52px` | `104rpx × 104rpx` |
| 图标容器圆角 | `14px` | `28rpx` |
| 图标字号 | `22px` | `44rpx` |
| 图标-标签间距 | `8px` | `gap-4` |
| 标签字号 | `13px` | `26rpx` |
| 标签颜色 | `#333` | `text-foreground` |

#### 图标渐变色（设计稿 nth-child 顺序）
| 序号 | 渐变背景 | 图标颜色 |
|------|---------|---------|
| 1 | `linear-gradient(135deg, rgba(139,92,246,0.15), rgba(167,139,250,0.2))` | `#8b5cf6` 紫 |
| 2 | `linear-gradient(135deg, rgba(249,115,22,0.15), rgba(251,146,60,0.2))` | `#f97316` 橙 |
| 3 | `linear-gradient(135deg, rgba(239,68,68,0.15), rgba(248,113,113,0.2))` | `#ef4444` 红 |
| 4 | `linear-gradient(135deg, rgba(59,130,246,0.15), rgba(96,165,250,0.2))` | `#3b82f6` 蓝 |
| 5 | `linear-gradient(135deg, rgba(59,130,246,0.15), rgba(96,165,250,0.2))` | `#3b82f6` 蓝 |
| 6 | `linear-gradient(135deg, rgba(239,68,68,0.15), rgba(248,113,113,0.2))` | `#ef4444` 红 |
| 7 | `linear-gradient(135deg, rgba(139,92,246,0.15), rgba(167,139,250,0.2))` | `#8b5cf6` 紫 |
| 8 | `linear-gradient(135deg, rgba(168,85,247,0.15), rgba(192,132,252,0.2))` | `#a855f7` 紫2 |

#### 今日课表
| 属性 | 设计稿值 | rpx值 |
|------|---------|-------|
| 卡片圆角 | `16px` | `32rpx` |
| 卡片外边距 | `0 16px 80px` | `mx-8 mb-40` |
| 卡片内边距 | `20px 16px` | `py-10 px-8` |
| 标题字号 | `18px` | `36rpx` |
| 标题字重 | `600` | `font-semibold` |
| 标题颜色 | `#333` | `text-foreground` |
| 标题下边距 | `16px` | `mb-8` |
| 列表项内边距 | `16px 0` | `py-8` |
| 分隔线 | `1px solid #f0f0f0` | `border-b border-b-[#f0f0f0]` |
| 时间行间距 | `8px` | `gap-4` |
| 时间行下边距 | `6px` | `mb-3` |
| 时间字号 | `18px` | `36rpx` |
| 时间字重 | `600` | `font-semibold` |
| 时间颜色 | `#ff7a45` → `--primary` | `text-primary` |
| 分隔点字号 | `14px` | `28rpx` |
| 分隔点颜色 | `#999` | `text-muted-foreground` |
| 课程名字号 | `16px` | `32rpx` |
| 课程名字重 | `600` | `font-semibold` |
| 课程名颜色 | `#333` | `text-foreground` |
| 标签内边距 | `2px 8px` | `py-1 px-4` |
| 标签背景 | `#fff2e8` | `bg-primary/10` |
| 标签颜色 | `#ff7a45` | `text-primary` |
| 标签字号 | `11px` | `22rpx` |
| 标签圆角 | `4px` | `8rpx` |
| 标签左边距 | `4px` | `ml-2` |
| 老师字号 | `14px` | `28rpx` |
| 老师颜色 | `#999` | `text-muted-foreground` |
| 老师下边距 | `12px` | `mb-6` |
| 已点名字号 | `14px` | `28rpx` |
| 已点名颜色 | `#666` | `text-secondary` |
| 已点名数字颜色 | `#333` | `text-foreground` |
| 已点名数字字重 | `600` | `font-semibold` |
| 点名按钮内边距 | `8px 24px` | `py-4 px-12` |
| 点名按钮圆角 | `20px` | `40rpx` |
| 点名按钮字号 | `14px` | `28rpx` |
| 点名按钮渐变 | `linear-gradient(135deg, #ff7a45, #ff5a2e)` | `bg-gradient-primary` |
| 点名按钮阴影 | `0 2px 8px rgba(255,90,46,0.3)` | `shadow-rollcall` |

### 3. 设计稿中不存在的元素（需删除）
- 最近核销/最近消课区块
- 家长端的所有区块（设计稿只有教师端）

### 4. 设计稿中存在但需保留项目自定义的
- 快捷入口8个名称和icon：课时消课/添加学生/课时充值/学员管理/班级管理/课包管理/教师管理/校区设置
- 图标使用项目 Icon 组件而非 emoji

---

## 二、迁移差异清单

| # | 区域 | 设计稿 | 当前实现 | 差异 |
|---|------|--------|---------|------|
| 1 | 渐变背景 | 5色渐变 `#ffa070→#ff8a55→#ff6b35→#ff5a2e→#ff4a1e` | 2色渐变 `hsl(primary)→hsl(primaryGlow)` | 需改为5色 |
| 2 | 丝绸飘带 | SVG 3条路径 + feGaussianBlur | 3个模糊椭圆 | 需改为更接近SVG的椭圆 |
| 3 | 圆点图案 | SVG pattern, top:80px right:30px, 140×140, opacity:0.1 | 位置/尺寸/透明度不对 | 需修正 |
| 4 | 底部融合过渡 | 10层渐变180px | 无 | 需新增 |
| 5 | 问候语字号 | 24px/48rpx | 48rpx | ✅ |
| 6 | 问候语下边距 | 8px/16rpx | 无 | 需修正 |
| 7 | 校区颜色 | rgba(255,255,255,0.9) | text-white/90 | ✅ |
| 8 | 统计卡片圆角 | 16px/32rpx | 32rpx | ✅ |
| 9 | 统计卡片内边距 | 16px/32rpx | 32rpx | ✅ |
| 10 | Tab内边距 | 6px 16px | py-3 px-8 | ✅ |
| 11 | Tab间距 | 8px/16rpx | 8rpx | 需修正为16rpx |
| 12 | Tab下边距 | 20px/40rpx | 32rpx | 需修正 |
| 13 | 数字字号 | 28px/56rpx | 56rpx | ✅ |
| 14 | 数字下边距 | 4px/8rpx | 8rpx | ✅ |
| 15 | 标签字号 | 12px/24rpx | 24rpx | ✅ |
| 16 | 快捷入口卡片间距 | 20px 16px | my-10 mx-8 | ✅ |
| 17 | 图标容器尺寸 | 52px/104rpx | 104rpx | ✅ |
| 18 | 图标容器圆角 | 14px/28rpx | 28rpx | ✅ |
| 19 | 网格行间距 | 20px/40rpx | 20rpx | 需修正为40rpx |
| 20 | 网格列间距 | 8px/16rpx | 8rpx | 需修正为16rpx |
| 21 | 图标-标签间距 | 8px/16rpx | 8rpx | 需修正为16rpx |
| 22 | 课表卡片外边距 | 0 16px 80px | mx-8 mb-40 | ✅ |
| 23 | 课表标题下边距 | 16px/32rpx | 32rpx | ✅ |
| 24 | 列表项内边距 | 16px/32rpx | 32rpx | ✅ |
| 25 | 时间行间距 | 8px/16rpx | 16rpx | ✅ |
| 26 | 时间行下边距 | 6px/12rpx | 6rpx | 需修正为12rpx |
| 27 | 标签内边距 | 2px 8px | py-1 px-4 | ✅ |
| 28 | 老师下边距 | 12px/24rpx | 24rpx | ✅ |
| 29 | 点名按钮内边距 | 8px 24px | py-4 px-12 | ✅ |
| 30 | 点名按钮圆角 | 20px/40rpx | 40rpx | ✅ |
| 31 | 最近核销区块 | 不存在 | 存在 | 需删除 |
| 32 | 页面背景 | #f5f5f5 | bg-[#f5f5f5] | ✅ |
