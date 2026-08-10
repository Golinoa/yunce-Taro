import { defineConfig, presetIcons } from 'unocss';
import { presetApplet, presetRemRpx, transformerAttributify } from 'unocss-applet';

export default defineConfig({
  presets: [
    presetApplet(),
    presetRemRpx({
      baseFontSize: 14,
      screenWidth: 375,
    }),
    presetIcons({
      scale: 1.2,
      warn: true,
      cdn: 'https://esm.sh/',
    }),
  ],
  transformers: [transformerAttributify({ ignoreAttributes: ['block'] })],
  theme: {
    colors: {
      primary: 'hsl(var(--primary))',
      'primary-foreground': 'hsl(var(--primary-foreground))',
      'primary-glow': 'hsl(var(--primary-glow))',
      'primary-dark': 'hsl(var(--primary-dark))',
      secondary: 'hsl(var(--secondary))',
      'secondary-foreground': 'hsl(var(--secondary-foreground))',
      accent: 'hsl(var(--accent))',
      'accent-foreground': 'hsl(var(--accent-foreground))',
      'accent-glow': 'hsl(var(--accent-glow))',
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      'foreground-secondary': 'hsl(var(--foreground-secondary))',
      card: 'hsl(var(--card))',
      'card-foreground': 'hsl(var(--card-foreground))',
      muted: 'hsl(var(--muted))',
      'muted-foreground': 'hsl(var(--muted-foreground))',
      destructive: 'hsl(var(--destructive))',
      'destructive-foreground': 'hsl(var(--destructive-foreground))',
      border: 'hsl(var(--border))',
      'border-light': 'hsl(var(--border-light))',
      input: 'hsl(var(--input))',
      ring: 'hsl(var(--ring))',
      'input-border': 'hsl(var(--input-border))',
      // 状态色
      success: 'hsl(var(--success))',
      warning: 'hsl(var(--warning))',
      error: 'hsl(var(--error))',
      info: 'hsl(var(--info))',
      // 薄荷绿（课程/消课详情头部卡片）
      mint: 'hsl(var(--mint))',
      'mint-foreground': 'hsl(var(--mint-foreground))',
      'mint-border': 'hsl(var(--mint-border))',
      // 花瓣五色（对齐设计稿 petal 配色）
      'petal-blue': 'hsl(var(--petal-blue))',
      'petal-purple': 'hsl(var(--petal-purple))',
      'petal-orange': 'hsl(var(--petal-orange))',
      'petal-red': 'hsl(var(--petal-red))',
      'petal-cyan': 'hsl(var(--petal-cyan))',
      // 微信品牌色（登录页一键登录按钮）
      wechat: '#22C55E',
      'wechat-dark': '#16A34A',
      // 身份角色色
      'role-principal': 'hsl(var(--role-principal))',
      'role-principal-glow': 'hsl(var(--role-principal-glow))',
      'role-principal-dark': 'hsl(var(--role-principal-dark))',
      'role-teacher': 'hsl(var(--role-teacher))',
      'role-teacher-glow': 'hsl(var(--role-teacher-glow))',
      'role-teacher-dark': 'hsl(var(--role-teacher-dark))',
      'role-parent': 'hsl(var(--role-parent))',
      'role-parent-glow': 'hsl(var(--role-parent-glow))',
      'role-parent-dark': 'hsl(var(--role-parent-dark))',
    },
    borderRadius: {
      DEFAULT: '30rpx',
      xs: '4rpx',
      sm: '8rpx',
      md: '12rpx',
      lg: '16rpx',
      xl: '20rpx',
      '2xl': '24rpx',
      '3xl': '30rpx',
      '4xl': '40rpx',
      button: '48rpx',
      round: '999rpx',
    },
    boxShadow: {
      elegant: '0 20rpx 60rpx -20rpx hsl(var(--primary) / 0.3)',
      soft: '0 8rpx 40rpx -8rpx hsl(var(--primary) / 0.08)',
      card: '0 2rpx 12rpx hsl(var(--primary) / 0.06)',
      float: '0 4rpx 16rpx hsl(var(--primary) / 0.08)',
    },
    animation: {
      keyframes: {
        float: '{0%, 100% { transform: translateY(0) } 50% { transform: translateY(-12rpx) }}',
        'pulse-ring':
          '{0% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.35) } 70% { box-shadow: 0 0 0 20rpx hsl(var(--primary) / 0) } 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0) }}',
        'radar-orange':
          '{0% { box-shadow: 0 0 0 0 rgba(255,160,108,0.5) } 70% { box-shadow: 0 0 0 24rpx rgba(255,160,108,0) } 100% { box-shadow: 0 0 0 0 rgba(255,160,108,0) }}',
        'radar-scale':
          '{0% { transform: scale(1); opacity: 0.6 } 70% { transform: scale(2.2); opacity: 0 } 100% { transform: scale(2.2); opacity: 0 }}',
        'badge-scale':
          '{0%, 100% { transform: scale(1) } 50% { transform: scale(1.12) }}',
        'radar-ring':
          '{0% { transform: scale(1); opacity: 0 } 20% { opacity: 0.45 } 100% { transform: scale(2.4); opacity: 0 }}',
        'popover-in':
          '{0% { opacity: 0; transform: translateY(-8rpx) scale(0.96) } 100% { opacity: 1; transform: translateY(0) scale(1) }}',
      },
      durations: {
        float: '3s',
        'badge-scale': '2s',
        'radar-ring': '2s',
        'popover-in': '200ms',
      },
      timingFns: {
        float: 'ease-in-out',
        'badge-scale': 'ease-in-out',
        'radar-ring': 'ease-out',
        'popover-in': 'ease-out',
      },
      counts: {
        float: 'infinite',
        'badge-scale': 'infinite',
        'radar-ring': 'infinite',
      },
    },
  },
  rules: [
    // ===== 渐变背景（使用 CSS 变量） =====
    [
      'bg-gradient-primary',
      {
        background:
          'linear-gradient(135deg, hsl(var(--primary-glow)) 0%, hsl(var(--primary)) 50%, hsl(var(--primary-dark)) 100%)',
      },
    ],
    [
      'bg-gradient-primary-soft',
      {
        background:
          'linear-gradient(135deg, hsl(var(--primary-glow) / 0.82) 0%, hsl(var(--primary) / 0.78) 50%, hsl(var(--primary-dark) / 0.85) 100%)',
      },
    ],
    [
      'bg-gradient-diffuse',
      {
        background:
          'radial-gradient(ellipse 170% 150% at 24% -16%, hsl(var(--primary-glow)) 0%, hsl(var(--primary)) 40%, hsl(var(--primary-dark)) 88%)',
      },
    ],
    [
      'bg-gradient-primary-dark',
      { background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-dark)))' },
    ],
    [
      'bg-gradient-accent',
      { background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent-glow)))' },
    ],
    [
      'bg-gradient-subtle',
      { background: 'linear-gradient(180deg, hsl(var(--primary)/0.06), hsl(var(--background)))' },
    ],
    ['bg-gradient-wechat', { background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' }],
    ['shadow-wechat', { 'box-shadow': '0 16rpx 40rpx -12rpx rgba(34, 197, 94, 0.35)' }],

    // ===== 花瓣渐变背景（对齐设计稿 KPI 卡片渐变） =====
    [
      'bg-petal-blue',
      { background: 'linear-gradient(160deg, #C5D8F5 0%, #D8E5F8 40%, #E8F0FC 100%)' },
    ],
    [
      'bg-petal-purple',
      { background: 'linear-gradient(160deg, #D8D5F0 0%, #E5E2F7 50%, #F0EEFB 100%)' },
    ],
    [
      'bg-petal-orange',
      { background: 'linear-gradient(160deg, #F0E0C0 0%, #F5ECD5 50%, #FDF6E8 100%)' },
    ],
    [
      'bg-petal-red',
      { background: 'linear-gradient(160deg, #F0D0D0 0%, #F5E0E0 50%, #FDF0F0 100%)' },
    ],
    [
      'bg-petal-cyan',
      { background: 'linear-gradient(160deg, #C0E8E8 0%, #D5F0F0 50%, #E8F8F8 100%)' },
    ],

    // ===== KPI 深色渐变（对齐设计稿 scheme-bc-fusion-v3.html） =====
    [
      'bg-kpi-green',
      { background: 'linear-gradient(160deg, #34d399 0%, #10b981 50%, #059669 100%)' },
    ],
    [
      'bg-kpi-orange',
      { background: 'linear-gradient(160deg, #fb923c 0%, #f97316 50%, #ea580c 100%)' },
    ],
    [
      'bg-kpi-blue',
      { background: 'linear-gradient(160deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)' },
    ],
    [
      'bg-kpi-purple',
      { background: 'linear-gradient(160deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%)' },
    ],
    [
      'bg-kpi-amber',
      { background: 'linear-gradient(160deg, #fcd34d 0%, #fbbf24 50%, #f59e0b 100%)' },
    ],

    // ===== 财务大卡片深色背景 =====
    [
      'bg-finance-dark',
      { background: 'linear-gradient(160deg, #2a2a2a 0%, #1a1a1a 50%, #0f0f0f 100%)' },
    ],

    // ===== 卡种管理会员卡橙色卡片背景 =====
    [
      'bg-card-orange',
      { background: 'linear-gradient(135deg, #FCA45C 0%, #FF8A2A 50%, #F57C00 100%)' },
    ],

    // ===== 会员卡灰色背景（暂停卡） =====
    [
      'bg-card-gray',
      { background: 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 50%, #4B5563 100%)' },
    ],

    // ===== 个人中心橙色主题（对齐参考设计稿，高亮橙渐变） =====
    [
      'bg-profile-orange',
      { background: 'linear-gradient(135deg, #FF8A2A 0%, #FF8A2A 100%)' },
    ],
    ['text-profile-orange', { color: '#FCA45C' }],
    ['text-profile-orange-soft', { color: '#FCA45C' }],
    ['bg-profile-orange-soft', { background: 'rgba(255, 138, 76, 0.10)' }],
    ['bg-profile-orange-solid', { background: '#FF8A2A' }],
    ['bg-profile-follow', { background: 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)' }],
    ['text-profile-follow-muted', { color: 'rgba(255, 255, 255, 0.65)' }],
    ['rounded-b-48rpx', { 'border-radius': '0 0 48rpx 48rpx' }],
    ['shadow-profile-stats', { 'box-shadow': '0 12rpx 40rpx -16rpx rgba(255, 112, 67, 0.18)' }],
    ['rotate-n12', { transform: 'rotate(-12deg)' }],
    // 个人中心头像双层实线边框外层色值
    ['border-profile-avatar-outer', { 'border-color': '#D8D2C7' }],

    // ===== 进度条渐变（使用 CSS 变量） =====
    [
      'bg-progress-primary',
      { background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary-glow)))' },
    ],
    ['bg-progress-primary-track', { background: 'hsl(var(--primary) / 0.15)' }],
    [
      'bg-progress-purple',
      { background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent-glow)))' },
    ],
    ['bg-progress-purple-track', { background: 'hsl(var(--accent) / 0.15)' }],

    // ===== 店铺管理 onboarding 橙色进度条 =====
    [
      'bg-progress-orange',
      { background: 'linear-gradient(90deg, #FF8A2A 0%, #FCA45C 100%)' },
    ],
    ['bg-progress-orange-track', { background: 'rgba(255, 138, 42, 0.15)' }],

    // ===== 进度条 6 等分宽度兜底（确保微信小程序生成） =====
    ['w-1/6', { width: '16.666667%' }],
    ['w-2/6', { width: '33.333333%' }],
    ['w-3/6', { width: '50%' }],
    ['w-4/6', { width: '66.666667%' }],
    ['w-5/6', { width: '83.333333%' }],

    // ===== 快捷入口图标渐变（使用 CSS 变量） =====
    [
      'bg-purple-soft',
      {
        background: 'linear-gradient(135deg, hsl(var(--accent-glow)), hsl(var(--accent-glow)/0.7))',
      },
    ],
    [
      'bg-purple-vivid',
      { background: 'linear-gradient(135deg, hsl(var(--accent-glow)), hsl(var(--accent)))' },
    ],
    [
      'bg-orange-soft',
      { background: 'linear-gradient(135deg, hsl(var(--warning)), hsl(var(--warning)/0.7))' },
    ],
    [
      'bg-info-soft',
      { background: 'linear-gradient(135deg, hsl(var(--info)), hsl(var(--info)/0.7))' },
    ],
    [
      'bg-teal-soft',
      { background: 'linear-gradient(135deg, hsl(var(--petal-cyan)), hsl(var(--petal-cyan)/0.7))' },
    ],
    [
      'bg-rose-soft',
      {
        background: 'linear-gradient(135deg, hsl(var(--destructive)), hsl(var(--destructive)/0.7))',
      },
    ],

    // ===== 阴影（使用 CSS 变量） =====
    ['shadow-elegant', { 'box-shadow': '0 20rpx 60rpx -20rpx hsl(var(--primary) / 0.3)' }],
    ['shadow-soft', { 'box-shadow': '0 8rpx 40rpx -8rpx hsl(var(--primary) / 0.08)' }],
    ['shadow-card', { 'box-shadow': '0 2rpx 12rpx hsl(var(--primary) / 0.06)' }],
    ['shadow-float', { 'box-shadow': '0 4rpx 16rpx hsl(var(--primary) / 0.08)' }],
    ['shadow-top', { 'box-shadow': '0 -4rpx 20rpx hsl(var(--foreground) / 0.06)' }],
    ['shadow-top-soft', { 'box-shadow': '0 -4rpx 20rpx hsl(var(--foreground) / 0.08)' }],

    // ===== 动画 =====
    ['animate-float', { animation: 'float 3s ease-in-out infinite' }],

    // ===== 渐变文字（使用 CSS 变量） =====
    [
      'gradient-text',
      {
        'background-clip': 'text',
        '-webkit-background-clip': 'text',
        '-webkit-text-fill-color': 'transparent',
        'background-image':
          'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
      },
    ],

    // ===== 徽章颜色（使用 CSS 变量） =====
    ['bg-badge', { background: 'hsl(var(--accent))' }],

    // ===== 组件级圆角 =====
    ['rounded-b-60rpx', { 'border-radius': '0 0 60rpx 60rpx' }], // 渐变头部底部
    ['rounded-t-32rpx', { 'border-radius': '32rpx 32rpx 0 0' }], // 底部弹窗顶部

    [
      'bg-kpi-red',
      { background: 'linear-gradient(160deg, #f87171 0%, #ef4444 50%, #dc2626 100%)' },
    ],

    // ===== 半透明背景（CSS 变量颜色无法直接用 /opacity 语法） =====
    ['bg-primary-5', { background: 'hsl(var(--primary) / 0.05)' }],
    ['bg-primary-10', { background: 'hsl(var(--primary) / 0.1)' }],
    ['bg-primary-15', { background: 'hsl(var(--primary) / 0.15)' }],
    ['bg-primary-50', { background: 'hsl(var(--primary) / 0.5)' }],
    ['bg-destructive-5', { background: 'hsl(var(--destructive) / 0.05)' }],
    ['bg-destructive-10', { background: 'hsl(var(--destructive) / 0.1)' }],
    ['bg-destructive-20', { background: 'hsl(var(--destructive) / 0.2)' }],
    ['bg-black-3', { background: 'hsl(var(--foreground) / 0.03)' }],
    ['border-destructive-20', { 'border-color': 'hsl(var(--destructive) / 0.2)' }],
    ['border-destructive-30', { 'border-color': 'hsl(var(--destructive) / 0.3)' }],
    ['border-primary/30', { 'border-color': 'hsl(var(--primary) / 0.3)' }],
    ['border-destructive/50', { 'border-color': 'hsl(var(--destructive) / 0.5)' }],

    // ===== 标题两侧渐变分隔线（卡片课程名居中装饰） =====
    [
      'title-divider-left',
      {
        height: '2rpx',
        flex: '1',
        background: 'linear-gradient(90deg, transparent 0%, hsl(var(--border)) 100%)',
      },
    ],
    [
      'title-divider-right',
      {
        height: '2rpx',
        flex: '1',
        background: 'linear-gradient(90deg, hsl(var(--border)) 0%, transparent 100%)',
      },
    ],

    // ===== 状态背景色（使用 CSS 变量） =====
    ['bg-amber-500/15', { background: 'hsl(var(--warning) / 0.15)' }],
    ['text-amber-500', { color: 'hsl(var(--warning))' }],

    // ===== 班级颜色主题（使用 CSS 变量） =====
    [
      'bg-class-primary',
      { background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))' },
    ],
    [
      'bg-class-red',
      { background: 'linear-gradient(135deg, hsl(var(--destructive)), hsl(var(--destructive)/0.7))' },
    ],
    [
      'bg-class-amber',
      { background: 'linear-gradient(135deg, hsl(var(--warning)), hsl(var(--warning)/0.7))' },
    ],
    [
      'bg-gradient-amber',
      {
        background: 'linear-gradient(135deg, hsl(var(--warning)), hsl(var(--warning)/0.7))',
        'box-shadow': '0 3px 10px hsl(var(--warning)/0.35)',
      },
    ],
    [
      'bg-class-purple',
      { background: 'linear-gradient(135deg, hsl(var(--petal-purple)), hsl(var(--petal-purple)/0.7))' },
    ],
    [
      'bg-class-info',
      { background: 'linear-gradient(135deg, hsl(var(--info)), hsl(var(--info)/0.7))' },
    ],
    [
      'bg-class-teal',
      { background: 'linear-gradient(135deg, hsl(var(--petal-cyan)), hsl(var(--petal-cyan)/0.7))' },
    ],
    ['text-purple', { color: 'hsl(var(--accent))' }],
    ['bg-purple-10', { background: 'hsl(var(--accent) / 0.1)' }],
    ['bg-purple-50', { background: 'hsl(var(--accent) / 0.5)' }],
    ['border-purple', { 'border-color': 'hsl(var(--accent))' }],
    ['text-amber', { color: 'hsl(var(--warning))' }],
    ['bg-amber-10', { background: 'hsl(var(--warning) / 0.1)' }],
    ['border-amber', { 'border-color': 'hsl(var(--warning))' }],
    ['bg-primary-bg', { background: 'hsl(var(--primary) / 0.06)' }],
    ['bg-primary-bg-alt', { background: 'hsl(var(--primary) / 0.08)' }],
    ['bg-info-bg', { background: 'hsl(var(--info) / 0.08)' }],
    ['bg-warning-bg', { background: 'hsl(var(--warning) / 0.08)' }],
    ['bg-success-bg', { background: 'hsl(var(--success) / 0.08)' }],
    ['bg-accent-bg', { background: 'hsl(var(--accent) / 0.08)' }],
    ['text-info', { color: 'hsl(var(--info))' }],
    ['text-warning', { color: 'hsl(var(--warning))' }],
    ['text-success', { color: 'hsl(var(--success))' }],
    ['text-accent', { color: 'hsl(var(--accent))' }],
    ['bg-info', { background: 'hsl(var(--info))' }],
    ['bg-warning', { background: 'hsl(var(--warning))' }],
    ['bg-success', { background: 'hsl(var(--success))' }],
    ['bg-accent', { background: 'hsl(var(--accent))' }],
    ['bg-purple-bg', { background: 'hsl(var(--accent) / 0.08)' }],

    // ===== 身份角色色工具类（对齐注册流程设计稿） =====
    [
      'bg-gradient-principal',
      {
        background:
          'linear-gradient(135deg, hsl(var(--role-principal-glow)) 0%, hsl(var(--role-principal)) 50%, hsl(var(--role-principal-dark)) 100%)',
      },
    ],
    [
      'bg-gradient-teacher',
      {
        background:
          'linear-gradient(135deg, hsl(var(--role-teacher-glow)) 0%, hsl(var(--role-teacher)) 50%, hsl(var(--role-teacher-dark)) 100%)',
      },
    ],
    [
      'bg-gradient-parent',
      {
        background:
          'linear-gradient(135deg, hsl(var(--role-parent-glow)) 0%, hsl(var(--role-parent)) 50%, hsl(var(--role-parent-dark)) 100%)',
      },
    ],
    ['bg-principal', { background: 'hsl(var(--role-principal))' }],
    ['bg-principal-10', { background: 'hsl(var(--role-principal) / 0.1)' }],
    ['bg-principal-15', { background: 'hsl(var(--role-principal) / 0.15)' }],
    ['text-principal', { color: 'hsl(var(--role-principal))' }],
    ['border-principal', { 'border-color': 'hsl(var(--role-principal))' }],
    ['bg-teacher', { background: 'hsl(var(--role-teacher))' }],
    ['bg-teacher-10', { background: 'hsl(var(--role-teacher) / 0.1)' }],
    ['bg-teacher-15', { background: 'hsl(var(--role-teacher) / 0.15)' }],
    ['text-teacher', { color: 'hsl(var(--role-teacher))' }],
    ['border-teacher', { 'border-color': 'hsl(var(--role-teacher))' }],
    ['bg-parent', { background: 'hsl(var(--role-parent))' }],
    ['bg-parent-10', { background: 'hsl(var(--role-parent) / 0.1)' }],
    ['bg-parent-15', { background: 'hsl(var(--role-parent) / 0.15)' }],
    ['text-parent', { color: 'hsl(var(--role-parent))' }],
    ['border-parent', { 'border-color': 'hsl(var(--role-parent))' }],

    // ===== 间距：_d5 系列（.5 步进，rpx 换算） =====
    ['gap-1_d5', { gap: '9rpx' }],
    ['gap-2_d5', { gap: '15rpx' }],
    ['p-1_d5', { padding: '9rpx' }],
    ['py-1_d5', { 'padding-top': '9rpx', 'padding-bottom': '9rpx' }],
    ['py-0_d5', { 'padding-top': '3rpx', 'padding-bottom': '3rpx' }],
    ['py-2_d5', { 'padding-top': '15rpx', 'padding-bottom': '15rpx' }],
    ['py-3_d5', { 'padding-top': '21rpx', 'padding-bottom': '21rpx' }],
    ['ml-0_d5', { 'margin-left': '3rpx' }],
    ['mb-0_d5', { 'margin-bottom': '3rpx' }],
    ['mb-3_d5', { 'margin-bottom': '21rpx' }],
    ['mt-0_5', { 'margin-top': '2rpx' }],
    ['mt-1_d5', { 'margin-top': '9rpx' }],
    ['mt-2_d5', { 'margin-top': '15rpx' }],
    ['pt-1_d5', { 'padding-top': '9rpx' }],

    // ===== 特殊尺寸 =====
    ['min-w-18px', { 'min-width': '36rpx' }],
    ['w-18', { width: '108rpx' }],
    ['h-18', { height: '108rpx' }],
    ['w-22', { width: '132rpx' }],
    ['h-22', { height: '132rpx' }],
    ['w-32', { width: '192rpx' }],
    ['h-32', { height: '192rpx' }],
    ['w-7_d5', { width: '60rpx' }],
    ['h-7_d5', { height: '60rpx' }],
    ['w-px', { width: '1px' }],
    ['w-0_d5', { width: '2rpx' }],
    ['h-1_d5', { height: '6rpx' }],
    ['w-1_d5', { width: '6rpx' }],
    ['w-dot', { width: '12rpx' }],
    ['h-dot', { height: '12rpx' }],
    ['w-5', { width: '30rpx' }],
    ['h-6', { height: '36rpx' }],
    ['min-h-30', { 'min-height': '45rpx' }],
    ['max-w-12', { 'max-width': '72rpx' }],

    // ===== 安全区 =====
    // pt-safe：仅状态栏；pt-nav-safe：状态栏 + 小程序胶囊栏（88rpx）
    ['pt-safe', { 'padding-top': 'env(safe-area-inset-top)' }],
    ['pt-nav-safe', { 'padding-top': 'calc(env(safe-area-inset-top) + 44px)' }],
    ['pb-safe-bottom', { 'padding-bottom': 'calc(var(--safe-bottom) + 144rpx)' }],
    ['pb-safe-bar', { 'padding-bottom': 'calc(24rpx + env(safe-area-inset-bottom))' }],
    [
      'px-page-padding',
      { 'padding-left': 'var(--page-padding)', 'padding-right': 'var(--page-padding)' },
    ],

    // ===== z-index =====
    ['z-100', { 'z-index': '100' }],
    ['z-200', { 'z-index': '200' }],

    // ===== 阴影 =====
    ['shadow-popup', { 'box-shadow': '0 8rpx 32rpx rgba(0, 0, 0, 0.12)' }],

    // ===== 弹窗入场动画 =====
    [
      'popover-in',
      {
        animation: 'popover-in 200ms ease-out forwards',
      },
    ],

    // ===== 边框 =====
    ['border-t', { 'border-top-width': '2rpx', 'border-top-style': 'solid' }],
    ['border-2', { 'border-width': '4rpx', 'border-style': 'solid' }],

    // ===== 圆角补充 =====
    ['rounded-md', { 'border-radius': '12rpx' }],

    // ===== 滚动条隐藏 =====
    [
      'scrollbar-hide',
      { '-webkit-overflow-scrolling': 'touch', overflow: '-webkit-scrollbars-none' },
    ],

    // ===== 文本截断 =====
    [
      'line-clamp-2',
      {
        display: '-webkit-box',
        '-webkit-line-clamp': '2',
        '-webkit-box-orient': 'vertical',
        overflow: 'hidden',
      },
    ],

    // ===== 毛玻璃效果（渐变头部内使用） =====
    ['bg-glass-25', { background: 'rgba(255,255,255,0.25)', 'backdrop-filter': 'blur(4px)' }],
    ['bg-glass-15', { background: 'rgba(255,255,255,0.15)', 'backdrop-filter': 'blur(4px)' }],

    // ===== 快捷入口图标毛玻璃风格（设计稿 homepages） =====
    [
      'icon-glass',
      {
        background: 'rgba(255, 255, 255, 0.3)',
        'backdrop-filter': 'blur(12px) saturate(180%)',
        '-webkit-backdrop-filter': 'blur(12px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        'box-shadow': 'inset 0 1px 1px rgba(255, 255, 255, 0.6), 0 2px 8px rgba(0, 0, 0, 0.06)',
      },
    ],
    [
      'icon-glass-purple',
      { background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(167, 139, 250, 0.2))' },
    ],
    [
      'icon-glass-orange',
      { background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(251, 146, 60, 0.2))' },
    ],
    [
      'icon-glass-red',
      { background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(248, 113, 113, 0.2))' },
    ],
    [
      'icon-glass-blue',
      { background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(96, 165, 250, 0.2))' },
    ],
    [
      'icon-glass-violet',
      { background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(192, 132, 252, 0.2))' },
    ],
    [
      'icon-glass-teal',
      { background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(45, 212, 191, 0.2))' },
    ],
    [
      'icon-glass-rose',
      { background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(251, 113, 133, 0.2))' },
    ],
    [
      'icon-glass-amber',
      { background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(252, 191, 36, 0.2))' },
    ],

    // ===== 统计卡片毛玻璃白底 =====
    ['bg-white/92', { background: 'rgba(255, 255, 255, 0.92)' }],

    // ===== 渐变头部白色半透明装饰（个人中心） =====
    ['bg-white/8', { background: 'rgba(255, 255, 255, 0.08)' }],
    ['bg-white/10', { background: 'rgba(255, 255, 255, 0.10)' }],
    ['bg-white/15', { background: 'rgba(255, 255, 255, 0.15)' }],
    ['bg-white/20', { background: 'rgba(255, 255, 255, 0.20)' }],
    ['bg-white/25', { background: 'rgba(255, 255, 255, 0.25)' }],
    ['bg-white/70', { background: 'rgba(255, 255, 255, 0.70)' }],
    ['text-white/80', { color: 'rgba(255, 255, 255, 0.80)' }],
    ['text-white/90', { color: 'rgba(255, 255, 255, 0.90)' }],

    // ===== 渐变头部圆角（设计稿 homepages 大圆角） =====
    ['rounded-b-80rpx', { 'border-radius': '0 0 80rpx 80rpx' }],

    // ===== 今日排课卡片（对齐项目蓝色主题） =====
    // 课程类型 — 左侧时间区配色（统一蓝色配色，使用 theme token）
    [
      'course-type-normal-bg',
      {
        background:
          'linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(var(--primary)/0.15))',
      },
    ],
    ['course-type-normal-text', { color: 'hsl(var(--primary))' }],
    ['course-type-normal-border', { 'border-color': 'hsl(var(--primary)/0.3)' }],
    ['course-type-art-bg', { background: 'rgba(236, 72, 153, 0.08)' }],
    ['course-type-art-text', { color: '#ec4899' }],
    ['course-type-art-border', { 'border-color': 'rgba(236, 72, 153, 0.12)' }],
    ['course-type-music-bg', { background: 'rgba(139, 92, 246, 0.08)' }],
    ['course-type-music-text', { color: '#8B5CF6' }],
    ['course-type-music-border', { 'border-color': 'rgba(139, 92, 246, 0.12)' }],
    ['course-type-dance-bg', { background: 'rgba(244, 63, 94, 0.08)' }],
    ['course-type-dance-text', { color: '#f43f5e' }],
    ['course-type-dance-border', { 'border-color': 'rgba(244, 63, 94, 0.12)' }],
    ['course-type-tech-bg', { background: 'rgba(14, 165, 233, 0.08)' }],
    ['course-type-tech-text', { color: '#0EA5E9' }],
    ['course-type-tech-border', { 'border-color': 'rgba(14, 165, 233, 0.12)' }],
    ['course-type-english-bg', { background: 'rgba(99, 102, 241, 0.08)' }],
    ['course-type-english-text', { color: '#6366f1' }],
    ['course-type-english-border', { 'border-color': 'rgba(99, 102, 241, 0.12)' }],

    // 课程状态 — 卡片边框（urgent 用 warning，使用 theme token）
    [
      'course-status-urgent-border',
      {
        border: '2rpx solid hsl(var(--warning))',
        'box-shadow': '0 2rpx 12rpx hsl(var(--warning)/0.12)',
      },
    ],
    ['course-status-done-border', { border: '2rpx solid hsl(var(--border))' }],
    ['course-status-ended-border', { border: '2rpx solid hsl(var(--border))' }],

    // 课程状态 — 左侧时间区背景（使用 theme token）
    [
      'course-time-urgent',
      {
        background: 'linear-gradient(135deg, hsl(var(--warning)), hsl(var(--warning)/0.7))',
        'border-right-color': 'hsl(var(--warning))',
      },
    ],
    [
      'course-time-ended',
      { background: 'hsl(var(--muted))', 'border-right-color': 'hsl(var(--border))' },
    ],
    [
      'course-time-done',
      { background: 'hsl(var(--success)/0.08)', 'border-right-color': 'hsl(var(--success)/0.2)' },
    ],

    // 课程状态 — 按钮（使用 theme token）
    [
      'course-btn-urgent',
      {
        background: 'linear-gradient(135deg, hsl(var(--warning)/0.7), hsl(var(--warning)))',
        'box-shadow': '0 2rpx 8rpx hsl(var(--warning)/0.3)',
        color: 'white',
      },
    ],
    [
      'course-btn-normal',
      {
        background: 'linear-gradient(135deg, hsl(var(--primary-glow)), hsl(var(--primary)))',
        color: 'white',
      },
    ],
    ['course-btn-view', { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }],

    // 课程状态 — 标签（使用 theme token）
    [
      'course-tag-booking',
      { background: 'hsl(var(--primary)/0.1)', color: 'hsl(var(--primary))' },
    ],
    ['course-tag-done', { background: 'hsl(var(--success)/0.1)', color: 'hsl(var(--success))' }],
    [
      'course-tag-ended',
      { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' },
    ],

    // 课程状态 — 进度条（使用 theme token）
    [
      'course-progress-active',
      {
        background: 'linear-gradient(90deg, hsl(var(--primary-glow)), hsl(var(--primary)))',
      },
    ],
    ['course-progress-done', { background: 'hsl(var(--success))' }],
    ['course-progress-ended', { background: 'hsl(var(--border))' }],

    // 课程卡片 — 语义色（对齐项目蓝色主题）
    ['course-name-active', { color: 'hsl(var(--foreground))' }],
    ['course-name-done', { color: 'hsl(var(--muted-foreground))' }],
    ['course-name-ended', { color: 'hsl(var(--border))' }],
    ['course-meta-text', { color: 'hsl(var(--muted-foreground))' }],
    ['course-meta-ended', { color: 'hsl(var(--border))' }],
    ['course-checkin-active', { color: 'hsl(var(--foreground))' }],
    ['course-checkin-done', { color: 'hsl(var(--success))' }],
    ['course-checkin-ended', { color: 'hsl(var(--muted-foreground))' }],
    ['course-progress-track', { background: 'hsl(var(--muted))' }],
    ['course-urgent-hint', { color: 'hsl(var(--warning))' }],

    // 统计卡片 — 语义色（使用 theme token）
    ['stats-number', { color: 'hsl(var(--foreground))' }],
    ['stats-label', { color: 'hsl(var(--muted-foreground))' }],
    [
      'stats-tab-inactive',
      { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' },
    ],

    // 脉冲动画（urgent 状态按钮）
    ['animate-pulse-ring', { animation: 'pulse-ring 2s infinite' }],
    ['animate-radar-orange', { animation: 'radar-orange 2s infinite' }],
    ['animate-radar-scale', { animation: 'radar-scale 1.6s infinite' }],
    ['animate-badge-scale', { animation: 'badge-scale 2s ease-in-out infinite' }],
    ['animate-radar-ring', { animation: 'radar-ring 2s ease-out infinite' }],
  ],
  shortcuts: {
    center: 'flex items-center justify-center',
    'center-col': 'flex flex-col items-center justify-center',

    // ===== 统一交互反馈 =====
    // 可点击元素：按下时轻微缩小 + 透明度降低
    'press-scale': 'transition active:scale-98 active:opacity-90',
    // 可点击元素：按下时背景变灰
    'press-bg': 'transition active:bg-gray-50',
    // 禁用态：统一透明度 + 禁止点击
    'state-disabled': 'opacity-40 pointer-events-none',
    // 加载态：统一透明度 + 禁止点击
    'state-loading': 'opacity-50 pointer-events-none',

    // ===== 全局按钮规范 =====
    // 主按钮（确认/提交）：h-[96rpx] + 圆角
    'btn-primary': 'h-[96rpx] rounded-2xl flex items-center justify-center press-scale',
    // 次按钮（选择/更换）：h-[88rpx] + 圆角
    'btn-secondary': 'h-[88rpx] rounded-2xl flex items-center justify-center press-scale',

    // ===== 全局标签规范 =====
    // 状态标签：已统一 padding + font-size，防止文字溢出
    tag: 'rounded px-2 py-0_d5 text-xs font-medium inline-flex items-center whitespace-nowrap',
    'tag-primary': 'tag bg-primary/10 text-primary',
    'tag-purple': 'tag bg-purple-10 text-purple',
    'tag-amber': 'tag bg-amber-10 text-amber',
    'tag-white': 'tag bg-white/25 text-white',

    // ===== 全局统计卡片规范 =====
    'stat-card': 'rounded-xl p-3 text-center',
    'stat-value': 'text-lg font-bold block',
    'stat-label': 'text-sm text-muted-foreground block mt-1',

    // ===== 表单输入框规范（对齐设计稿） =====
    'form-input-wrap':
      'w-full py-[22rpx] px-[28rpx] rounded-2xl border-[2rpx] border-solid border-border bg-background',
    'form-input-focus': 'focus:border-primary focus:bg-white',

    // ===== 分段控制器规范 =====
    'segment-wrap': 'flex flex-row bg-muted rounded-2xl p-[6rpx] gap-[6rpx]',
    'segment-item': 'flex-1 py-[16rpx] rounded-xl text-center text-base font-medium',
    'segment-active': 'bg-white text-primary font-semibold shadow-card',
    'segment-inactive': 'text-muted-foreground',

    // ===== Chip 选择器规范 =====
    chip: 'py-[8rpx] px-[28rpx] rounded-[16rpx] border-[2rpx] border-solid text-sm font-medium',
    'chip-active': 'border-primary bg-primary-bg text-primary font-semibold',
    'chip-inactive': 'border-border bg-background text-muted-foreground',

    // ===== 性别选择器规范 =====
    'gender-opt':
      'flex-1 py-[20rpx] rounded-2xl border-[2rpx] border-solid text-center text-base font-medium',
    'gender-active': 'border-primary bg-primary-bg text-primary font-semibold',
    'gender-inactive': 'border-border bg-background text-muted-foreground',

    // ===== 联系人卡片规范 =====
    'contact-card': 'bg-background rounded-2xl p-[24rpx] border-[2rpx] border-solid border-border',

    // ===== 分期摘要卡片规范 =====
    'inst-summary-item': 'flex-1 py-[20rpx] rounded-[20rpx] text-center',

    // ===== 教师管理模块规范 =====
    // 渐变头部内毛玻璃按钮
    'header-glass-btn':
      'h-[64rpx] px-[24rpx] rounded-[32rpx] bg-white/22 text-white text-[26rpx] font-medium flex items-center justify-center press-scale',
    // 统计Chip（渐变头部内）
    'stat-chip': 'flex-1 text-center py-[16rpx] px-[8rpx] bg-white/20 rounded-[20rpx]',
    // 胶囊Tab
    'capsule-tab':
      'flex-1 flex items-center justify-center gap-[12rpx] py-[20rpx] rounded-[20rpx] text-[26rpx] font-medium text-white/75 press-scale',
    'capsule-tab-active': 'text-white font-bold bg-white/25 shadow-float',
    // 子Tab下划线指示器
    'sub-tab-indicator':
      'absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rpx] h-[6rpx] rounded-[4rpx] bg-primary',
    // 发薪提醒卡片
    'reminder-card':
      'bg-amber-10 rounded-xl py-[24rpx] px-[28rpx] mb-[28rpx] flex items-center gap-[20rpx]',
    // 快捷发薪卡片
    'quick-pay-card':
      'bg-class-amber rounded-[28rpx] p-[28rpx] mb-[28rpx] text-white relative overflow-hidden',
    // 薪资汇总卡片
    'salary-summary':
      'flex bg-card rounded-[32rpx] p-[32rpx] mb-[28rpx] shadow-soft border-t-[6rpx] border-amber',
    // 批量操作栏
    'batch-bar':
      'flex items-center justify-between bg-card rounded-xl py-[20rpx] px-[32rpx] mb-[24rpx] shadow-card',
    // 工资模型卡片
    'salary-model-card':
      'bg-card rounded-xl p-[28rpx] shadow-card mb-[16rpx] border-l-[6rpx] border-amber press-scale',
    // 状态流转步骤
    'flow-dot':
      'w-[64rpx] h-[64rpx] rounded-full bg-muted flex items-center justify-center transition',
    'flow-dot-done': 'bg-primary',
    'flow-dot-current': 'bg-primary shadow-[0_0_0_8rpx_rgba(59,110,245,0.2)]',
    // 底部操作按钮
    'action-btn-primary':
      'flex-1 py-[28rpx] rounded-[28rpx] text-center text-[30rpx] font-semibold bg-class-amber text-white shadow-float press-scale',
    'action-btn-secondary':
      'flex-1 py-[28rpx] rounded-[28rpx] text-center text-[30rpx] font-semibold bg-amber-10 text-amber press-scale',
    'action-btn-danger':
      'flex-1 py-[28rpx] rounded-[28rpx] text-center text-[30rpx] font-semibold bg-muted text-destructive press-scale',

    // ===== 全局文字尺寸规范（Tailwind 类名 → rpx 映射） =====
    'text-md': { 'font-size': '28rpx' },

    // ===== 内联 style 迁移：常用颜色 =====
    'bg-campus-card': { background: '#f8fbf9' },
    'border-campus-card': { 'border-color': '#eef4f0' },
    'text-gold': { color: '#ffe082' },
    'text-gold-soft': { color: 'rgba(255,224,130,0.95)' },
    'text-pink-soft': { color: '#ffc1cc' },
    'text-pink-light': { color: 'rgba(255,193,204,0.95)' },
    'bg-transparent': { background: 'transparent' },
    'bg-f5faf8': { background: '#F5F8FC' },
    'bg-f0faf5': { background: '#F0F5FC' },

    // ===== 内联 style 迁移：常用尺寸 =====
    'p-header': { padding: '48rpx 32rpx 64rpx' },
    'p-section': { padding: '32rpx' },
    'h-calc-content': { height: 'calc(100vh - 500rpx)' },
    'h-calc-nav': { height: 'calc(100vh - 96rpx)' },
    'max-h-75vh': { 'max-height': '75vh' },
    'max-h-60vh': { 'max-height': '60vh' },
    'max-h-50vh': { 'max-height': '50vh' },

    // ===== 内联 style 迁移：常用背景色 =====
    'bg-white': { background: '#ffffff' },
    'bg-d5e8e0': { background: '#D5E2F5' },
    'border-b-d5e8e0': { 'border-bottom': '2rpx solid #D5E2F5' },
    'border-b-e8e8e8': { 'border-bottom': '2rpx solid #e8e8e8' },
    'border-t-d5e8e0': { 'border-top': '2rpx solid #D5E2F5' },
    'border-d5e8e0': { border: '2rpx solid #D5E2F5' },

    // ===== 内联 style 迁移：装饰效果 =====
    'blur-40rpx': { filter: 'blur(40rpx)' },
    'blur-32rpx': { filter: 'blur(32rpx)' },
    'border-dashed-d5e8e0': { background: '#FAFBFD', border: '4rpx dashed #D5E2F5' },
    'bg-primary-20': { background: 'rgba(59, 110, 245, 0.2)' },
    'transition-transform-250': { transition: 'transform 0.25s ease' },

    // ===== 内联 style 迁移：class-form =====
    'bg-f5faf8-border-d5e8e0': { background: '#F5F8FC', border: '3rpx solid #D5E2F5' },
    'bg-gradient-primary-dark2': { background: 'linear-gradient(135deg, #3B6EF5, #2563EB)' },

    // ===== 登录页装饰效果 =====
    'bg-login-gradient': {
      background: 'linear-gradient(180deg, #F0F4FF 0%, #F5F8FF 35%, #FFFFFF 100%)',
    },
    'bg-login-glow': {
      background: 'radial-gradient(circle, rgba(59,110,245,0.12) 0%, rgba(59,110,245,0.03) 55%, transparent 70%)',
      filter: 'blur(12rpx)',
    },
    'bg-login-orb': {
      'background-color': 'rgba(255,255,255,0.55)',
      'backdrop-filter': 'blur(24rpx)',
      border: '2rpx solid rgba(255,255,255,0.7)',
      'box-shadow': 'inset 0 0 60rpx rgba(255,255,255,0.9), 0 32rpx 80rpx -28rpx rgba(59,110,245,0.18)',
    },
    'shadow-login-btn': { 'box-shadow': '0 16rpx 44rpx rgba(59,110,245,0.25)' },
    'shadow-wechat-btn': { 'box-shadow': '0 16rpx 44rpx rgba(7,193,96,0.25)' },

    // ===== 品牌色 =====
    'text-wechat': { color: '#07C160' },

    // ===== 课表页复刻（设计图 bb7aaae86d5b28251be2140a59b943e.jpg） =====
    'bg-schedule-page': { background: '#f5f5f5' },
    'bg-schedule-header': { background: '#f97768' },
    'text-schedule-header': { color: '#f97768' },
    'border-schedule-header': { 'border-color': '#f4a396' },
    'bg-schedule-selected-date': { background: '#59cfc6' },
    'text-schedule-selected-date': { color: '#59cfc6' },
    'bg-schedule-dot': { background: '#f0988b' },
    'bg-schedule-attend': { background: '#f97768' },
    'bg-schedule-adjust': { background: '#47c1b6' },
    'bg-schedule-edit': { background: '#ffb000' },
    'bg-schedule-delete': { background: '#9da0a8' },
    'bg-schedule-cancel': { background: '#6f92ce' },
    'text-schedule-link': { color: '#4a74ff' },
    'shadow-schedule-fab': { 'box-shadow': '0 12rpx 30rpx rgba(249, 119, 104, 0.3)' },
    'border-schedule-soft': { 'border-color': '#ececec' },

    // ===== 注册页装饰效果 =====
    'bg-register-deco': {
      background: 'linear-gradient(180deg, rgba(59,110,245,0.08) 0%, transparent 100%)',
    },
    'bg-register-circle': { 'background-color': 'rgba(59,110,245,0.06)' },
    'bg-register-hint-blue': { 'background-color': 'rgba(59,110,245,0.08)' },
    'bg-register-hint-purple': { 'background-color': 'rgba(139,92,246,0.08)' },
    'bg-gradient-principal': { background: 'linear-gradient(135deg, #FBBF24, #F59E0B)' },
    'bg-gradient-teacher': { background: 'linear-gradient(135deg, #6B95F5, #3B6EF5)' },
    'bg-gradient-parent': { background: 'linear-gradient(135deg, #A78BFA, #8B5CF6)' },
  },
});
