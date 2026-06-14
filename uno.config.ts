import { defineConfig, presetIcons } from 'unocss'
import { presetApplet, presetRemRpx, transformerAttributify } from 'unocss-applet'

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
  transformers: [
    transformerAttributify({ ignoreAttributes: ['block'] }),
  ],
  theme: {
    colors: {
      primary: 'hsl(var(--primary))',
      'primary-foreground': 'hsl(var(--primary-foreground))',
      'primary-glow': 'hsl(var(--primary-glow))',
      secondary: 'hsl(var(--secondary))',
      'secondary-foreground': 'hsl(var(--secondary-foreground))',
      accent: 'hsl(var(--accent))',
      'accent-foreground': 'hsl(var(--accent-foreground))',
      'accent-glow': 'hsl(var(--accent-glow))',
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      card: 'hsl(var(--card))',
      'card-foreground': 'hsl(var(--card-foreground))',
      muted: 'hsl(var(--muted))',
      'muted-foreground': 'hsl(var(--muted-foreground))',
      destructive: 'hsl(var(--destructive))',
      'destructive-foreground': 'hsl(var(--destructive-foreground))',
      border: 'hsl(var(--border))',
      input: 'hsl(var(--input))',
      ring: 'hsl(var(--ring))',
      'input-border': 'hsl(var(--input-border))',
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
      soft: '0 8rpx 40rpx -8rpx rgba(54, 73, 67, 0.1)',
      card: '0 2rpx 12rpx rgba(0, 0, 0, 0.08)',
      float: '0 4rpx 16rpx rgba(0, 0, 0, 0.1)',
    },
    animation: {
      keyframes: {
        float: '{0%, 100% { transform: translateY(0) } 50% { transform: translateY(-12rpx) }}',
      },
      durations: {
        float: '3s',
      },
      timingFns: {
        float: 'ease-in-out',
      },
      counts: {
        float: 'infinite',
      },
    },
  },
  rules: [
    // ===== 渐变背景 =====
    ['bg-gradient-primary', { background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))' }],
    ['bg-gradient-primary-dark', { background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-dark)))' }],
    ['bg-gradient-accent', { background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent-glow)))' }],
    ['bg-gradient-subtle', { background: 'linear-gradient(180deg, #f5faf8, #e3f2ef)' }],

    // ===== 进度条渐变 =====
    ['bg-progress-primary', { background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary-glow)))' }],
    ['bg-progress-primary-track', { background: 'hsl(var(--primary) / 0.15)' }],
    ['bg-progress-purple', { background: 'linear-gradient(90deg, #9b7ed8, #bda4e8)' }],
    ['bg-progress-purple-track', { background: 'rgba(155, 126, 216, 0.15)' }],

    // ===== 快捷入口图标渐变 =====
    ['bg-purple-soft', { background: 'linear-gradient(135deg, hsl(260 45% 82%), hsl(260 45% 90%))' }],
    ['bg-purple-vivid', { background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }],
    ['bg-orange-soft', { background: 'linear-gradient(135deg, hsl(15 65% 78%), hsl(15 65% 88%))' }],
    ['bg-info-soft', { background: 'linear-gradient(135deg, hsl(195 45% 78%), hsl(195 45% 88%))' }],
    ['bg-teal-soft', { background: 'linear-gradient(135deg, hsl(160 45% 72%), hsl(160 45% 85%))' }],
    ['bg-rose-soft', { background: 'linear-gradient(135deg, hsl(350 60% 78%), hsl(350 60% 88%))' }],

    // ===== 阴影 =====
    ['shadow-elegant', { 'box-shadow': '0 20rpx 60rpx -20rpx hsl(var(--primary) / 0.3)' }],
    ['shadow-soft', { 'box-shadow': '0 8rpx 40rpx -8rpx rgba(54, 73, 67, 0.1)' }],
    ['shadow-card', { 'box-shadow': '0 2rpx 12rpx rgba(0, 0, 0, 0.08)' }],
    ['shadow-float', { 'box-shadow': '0 4rpx 16rpx rgba(0, 0, 0, 0.1)' }],

    // ===== 动画 =====
    ['animate-float', { animation: 'float 3s ease-in-out infinite' }],

    // ===== 渐变文字 =====
    ['gradient-text', {
      'background-clip': 'text',
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
      'background-image': 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
    }],

    // ===== 徽章颜色 =====
    ['bg-badge', { background: 'hsl(340 70% 55%)' }],

    // ===== 组件级圆角 =====
    ['rounded-b-60rpx', { 'border-radius': '0 0 60rpx 60rpx' }],   // 渐变头部底部
    ['rounded-t-32rpx', { 'border-radius': '32rpx 32rpx 0 0' }],   // 底部弹窗顶部

    // ===== 半透明背景（CSS 变量颜色无法直接用 /opacity 语法） =====
    ['bg-primary-5', { background: 'hsl(var(--primary) / 0.05)' }],
    ['bg-primary-10', { background: 'hsl(var(--primary) / 0.1)' }],
    ['bg-primary-15', { background: 'hsl(var(--primary) / 0.15)' }],
    ['bg-primary-50', { background: 'hsl(var(--primary) / 0.5)' }],
    ['bg-destructive-5', { background: 'hsl(var(--destructive) / 0.05)' }],
    ['bg-destructive-10', { background: 'hsl(var(--destructive) / 0.1)' }],
    ['bg-destructive-20', { background: 'hsl(var(--destructive) / 0.2)' }],
    ['bg-black-3', { background: 'rgba(0, 0, 0, 0.03)' }],
    ['border-destructive-20', { 'border-color': 'rgba(217, 64, 64, 0.2)' }],
    ['border-destructive-30', { 'border-color': 'rgba(217, 64, 64, 0.3)' }],
    ['border-primary/30', { 'border-color': 'hsl(var(--primary) / 0.3)' }],
    ['border-destructive/50', { 'border-color': 'hsl(var(--destructive) / 0.5)' }],

    // ===== 状态背景色 =====
    ['bg-amber-500/15', { background: 'rgba(245, 158, 11, 0.15)' }],
    ['text-amber-500', { color: '#f59e0b' }],

    // ===== 班级颜色主题 =====
    ['bg-class-primary', { background: 'linear-gradient(135deg, #5EC8A8, #7dd8bc)' }],
    ['bg-class-accent', { background: 'linear-gradient(135deg, #e88aaa, #f0b3c7)' }],
    ['bg-class-amber', { background: 'linear-gradient(135deg, #d4a24e, #e8c47a)' }],
    ['bg-gradient-amber', { background: 'linear-gradient(135deg, #D4A24E, #c4922e)', 'box-shadow': '0 3px 10px rgba(212,162,78,0.35)' }],
    ['bg-class-info', { background: 'linear-gradient(135deg, #6ba3d6, #93c5e8)' }],
    ['bg-class-purple', { background: 'linear-gradient(135deg, #9b7ed8, #bda4e8)' }],
    ['text-purple', { color: '#9b7ed8' }],
    ['bg-purple-10', { background: 'rgba(155, 126, 216, 0.1)' }],
    ['bg-purple-50', { background: 'rgba(155, 126, 216, 0.5)' }],
    ['border-purple', { 'border-color': '#9b7ed8' }],
    ['text-amber', { color: '#d4a24e' }],
    ['bg-amber-10', { background: 'rgba(212, 162, 78, 0.1)' }],
    ['border-amber', { 'border-color': '#d4a24e' }],
    ['bg-primary-bg', { background: '#f0faf5' }],
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
    ['bg-purple-bg', { background: 'rgba(155, 126, 216, 0.08)' }],

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
    ['h-18px', { height: '36rpx' }],
    ['text-10px', { 'font-size': '20rpx' }],
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
    ['pt-safe', { 'padding-top': 'var(--safe-top)' }],
    ['pb-safe-bottom', { 'padding-bottom': 'calc(var(--safe-bottom) + 144rpx)' }],
    ['pb-safe-bar', { 'padding-bottom': 'calc(24rpx + env(safe-area-inset-bottom))' }],
    ['px-page-padding', { 'padding-left': 'var(--page-padding)', 'padding-right': 'var(--page-padding)' }],

    // ===== z-index =====
    ['z-100', { 'z-index': '100' }],
    ['z-200', { 'z-index': '200' }],

    // ===== 边框 =====
    ['border-t', { 'border-top-width': '2rpx', 'border-top-style': 'solid' }],
    ['border-2', { 'border-width': '4rpx', 'border-style': 'solid' }],

    // ===== 圆角补充 =====
    ['rounded-md', { 'border-radius': '12rpx' }],

    // ===== 滚动条隐藏 =====
    ['scrollbar-hide', { '-webkit-overflow-scrolling': 'touch', 'overflow': '-webkit-scrollbars-none' }],

    // ===== 文本截断 =====
    ['line-clamp-2', { display: '-webkit-box', '-webkit-line-clamp': '2', '-webkit-box-orient': 'vertical', overflow: 'hidden' }],

    // ===== 毛玻璃效果（渐变头部内使用） =====
    ['bg-glass-25', { background: 'rgba(255,255,255,0.25)', 'backdrop-filter': 'blur(4px)' }],
    ['bg-glass-15', { background: 'rgba(255,255,255,0.15)', 'backdrop-filter': 'blur(4px)' }],
  ],
  shortcuts: {
    'center': 'flex items-center justify-center',
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
    'tag': 'rounded px-2 py-0_d5 text-xs font-medium inline-flex items-center whitespace-nowrap',
    'tag-primary': 'tag bg-primary/10 text-primary',
    'tag-purple': 'tag bg-purple-10 text-purple',
    'tag-amber': 'tag bg-amber-10 text-amber',
    'tag-white': 'tag bg-white/25 text-white',

    // ===== 全局统计卡片规范 =====
    'stat-card': 'rounded-xl p-3 text-center',
    'stat-value': 'text-lg font-bold block',
    'stat-label': 'text-sm text-muted-foreground block mt-1',

    // ===== 表单输入框规范（对齐设计稿） =====
    'form-input-wrap': 'w-full py-[22rpx] px-[28rpx] rounded-2xl border-[2rpx] border-solid border-border bg-background',
    'form-input-focus': 'focus:border-primary focus:bg-white',

    // ===== 分段控制器规范 =====
    'segment-wrap': 'flex flex-row bg-muted rounded-2xl p-[6rpx] gap-[6rpx]',
    'segment-item': 'flex-1 py-[16rpx] rounded-xl text-center text-base font-medium',
    'segment-active': 'bg-white text-primary font-semibold shadow-card',
    'segment-inactive': 'text-muted-foreground',

    // ===== Chip 选择器规范 =====
    'chip': 'py-[8rpx] px-[28rpx] rounded-[16rpx] border-[2rpx] border-solid text-sm font-medium',
    'chip-active': 'border-primary bg-primary-bg text-primary font-semibold',
    'chip-inactive': 'border-border bg-background text-muted-foreground',

    // ===== 性别选择器规范 =====
    'gender-opt': 'flex-1 py-[20rpx] rounded-2xl border-[2rpx] border-solid text-center text-base font-medium',
    'gender-active': 'border-primary bg-primary-bg text-primary font-semibold',
    'gender-inactive': 'border-border bg-background text-muted-foreground',

    // ===== 联系人卡片规范 =====
    'contact-card': 'bg-background rounded-2xl p-[24rpx] border-[2rpx] border-solid border-border',

    // ===== 分期摘要卡片规范 =====
    'inst-summary-item': 'flex-1 py-[20rpx] rounded-[20rpx] text-center',

    // ===== 教师管理模块规范 =====
    // 渐变头部内毛玻璃按钮
    'header-glass-btn': 'h-[64rpx] px-[24rpx] rounded-[32rpx] bg-white/22 text-white text-[26rpx] font-medium flex items-center justify-center press-scale',
    // 统计Chip（渐变头部内）
    'stat-chip': 'flex-1 text-center py-[16rpx] px-[8rpx] bg-white/20 rounded-[20rpx]',
    // 胶囊Tab
    'capsule-tab': 'flex-1 flex items-center justify-center gap-[12rpx] py-[20rpx] rounded-[20rpx] text-[26rpx] font-medium text-white/75 press-scale',
    'capsule-tab-active': 'text-white font-bold bg-white/25 shadow-float',
    // 子Tab下划线指示器
    'sub-tab-indicator': 'absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rpx] h-[6rpx] rounded-[4rpx] bg-primary',
    // 发薪提醒卡片
    'reminder-card': 'bg-amber-10 rounded-xl py-[24rpx] px-[28rpx] mb-[28rpx] flex items-center gap-[20rpx]',
    // 快捷发薪卡片
    'quick-pay-card': 'bg-class-amber rounded-[28rpx] p-[28rpx] mb-[28rpx] text-white relative overflow-hidden',
    // 薪资汇总卡片
    'salary-summary': 'flex bg-card rounded-[32rpx] p-[32rpx] mb-[28rpx] shadow-soft border-t-[6rpx] border-amber',
    // 批量操作栏
    'batch-bar': 'flex items-center justify-between bg-card rounded-xl py-[20rpx] px-[32rpx] mb-[24rpx] shadow-card',
    // 工资模型卡片
    'salary-model-card': 'bg-card rounded-xl p-[28rpx] shadow-card mb-[16rpx] border-l-[6rpx] border-amber press-scale',
    // 状态流转步骤
    'flow-dot': 'w-[64rpx] h-[64rpx] rounded-full bg-muted flex items-center justify-center transition',
    'flow-dot-done': 'bg-primary',
    'flow-dot-current': 'bg-primary shadow-[0_0_0_8rpx_rgba(94,200,168,0.2)]',
    // 底部操作按钮
    'action-btn-primary': 'flex-1 py-[28rpx] rounded-[28rpx] text-center text-[30rpx] font-semibold bg-class-amber text-white shadow-float press-scale',
    'action-btn-secondary': 'flex-1 py-[28rpx] rounded-[28rpx] text-center text-[30rpx] font-semibold bg-amber-10 text-amber press-scale',
    'action-btn-danger': 'flex-1 py-[28rpx] rounded-[28rpx] text-center text-[30rpx] font-semibold bg-muted text-destructive press-scale',
  },
})
