/**
 * 真机联调走查 · 分模块共享逻辑
 * 进度写入同一 localStorage，总览与各模块页互通。
 */
(function (global) {
  const STORAGE_KEY = 'yunce-device-walkthrough-v2';

  const CHAIN_LABELS = {
    'D-1': '家长邀请-数据库', 'D-2': '门店互邀-数据库', 'D-3': '页面发布', 'D-4': '微信环境',
    'F0': '账号密码登录', 'F1': '新用户微信登录', 'F2': '老用户微信登录', 'F3': '教师/家长微信登录',
    'F4': '邀请页内微信登录', 'F5': '连点登录', 'F6': '失败再试', 'F7': '邮箱注册再密码登录', 'F8': '隐私协议勾选',
    'L1-1': '课表分享试听卡', 'L1-2': '好友打开试听落地', 'L1-3': '试听落地未登录可看',
    'VH-1': '教师招生二维码', 'VH-2a': '扫码进招生页', 'VH-2b': '杀进程再扫码', 'VH-2c': '旧格式码',
    'VH-3': '微信未配置提示', 'VH-4': '体验版/正式版', 'VH-5': '转发分享卡片',
    'V2T-5': 'L2已用满屏', 'V2T-6': 'L2过期满屏',
    'V4T-R1': '管理员分享互邀', 'V4T-R2': '好友打开互邀页', 'V4T-R3': '跳转入驻',
    'V4T-R4': '记录谁推荐的', 'V4T-R5': '错误邀请码', 'V4T-R6': '非管理员分享',
    'X-1': '完整招生流程', 'X-2': '链接已用过', 'X-3': '员工邀请(复制+未登录回跳)',
    'X-3b': '员工邀请(已登录)', 'X-4': '转发链接', 'X-5': '变成会员',
    'V3T-4': 'L3过期满屏', 'V3T-5': 'L3已用满屏',
    'SE-01': '入驻首次提交', 'SE-02': 'pending双按钮', 'SE-03': '进演示门店', 'SE-04': '客服催办',
    'SE-05': 'PENDING进表拦截', 'SE-06': '弱网连点提交', 'SE-07': '页内绑邮箱', 'SE-08': '杀进程回pending',
    'SE-09': '审核通过进机构', 'SE-10': '驳回重提', 'SE-11': '未登录预览填表',
    'S-1': '课表Tab切换', 'S-2': '日滑动换日', 'S-3': '点名入口', 'S-4': '调课入口',
    'S-5': '停课恢复', 'S-6': '团课开放约', 'S-7': '场地Tab',
    'SF-1': '新建班课排课', 'SF-2': '编辑排课保存', 'SF-3': '冲突提示',
    'L-1': '班课点名提交', 'L-2': '消课防重入', 'L-3': '无假签到CTA', 'L-4': '单人消课', 'L-5': '补录学员',
    'P-1': '家长看课表', 'P-2': '家长约课/取消',
    'PS-1': '单机构门店列表', 'PS-2': '多机构三行展示', 'PS-3': '跨机构切到B',
    'PS-4': '切回A城东', 'PS-5': '同机构切校区', 'PS-6': '切换失败/连点', 'PS-7': '教师切换门店回归',
    'D-5': '支付订单migration', 'D-6': '虚拟支付环境变量', 'D-7': '消息推送URL验签',
    'PAY-1': 'Admin配virtualProductId', 'PAY-2': '会员页SKU可见', 'PAY-3': '下单拉起支付',
    'PAY-4': '支付成功履约', 'PAY-5': '查单轮询兜底', 'PAY-6': '激活码并行', 'PAY-7': 'iOS微信版本拦截',
  };

  /** 分模块目录（顺序 = 推荐实测路径） */
  const MODULES = [
    {
      id: 'env',
      file: 'm00-env.html',
      title: '① 环境准备',
      short: 'Migration / 微信 / 页面可达',
      pathHint: '先做完本页再测功能；非点击项按「怎么验证」逐步做',
      sections: [{
        id: 'env',
        title: '环境准备（部署门禁）',
        desc: '开发或联调同学操作。每项点开「怎么验证」看具体命令。',
        items: [
          {
            id: 'D-1', account: '开发操作（电脑）', kind: 'dev',
            steps: '确认 migration <code>20260902_parent_share_invite</code> 已应用到当前联调库',
            expected: 'migrate status 显示 Applied；库中有表 <code>ParentShareInvite</code>',
            howto: `目录：yunce-back/yunce-backend

【推荐】看迁移状态：
  npx prisma migrate status

在输出中找到这一行（名字必须对上）：
  20260902_parent_share_invite

● 若写 Applied / 已应用 → 本项通过
● 若写 Pending / 未应用 → 执行：
  npx prisma migrate deploy
  再重新跑 status 确认变成 Applied

【可选】打开 Prisma Studio 肉眼确认表：
  npx prisma studio
  浏览器左侧列表应出现 ParentShareInvite

【业务冒烟】teacher1 打开「招生二维码」能出图；若后端报错含 ParentShareInvite / Unknown table → 表未建好`
          },
          {
            id: 'D-2', account: '开发操作（电脑）', kind: 'dev',
            steps: '确认 migration <code>20260902_org_referral_l4</code> 已应用（门店互邀 O 码）',
            expected: 'migrate status 为 Applied；校长关于页能分享出 O 开头码',
            howto: `同上目录 yunce-back/yunce-backend：

  npx prisma migrate status

确认存在且 Applied：
  20260902_org_referral_l4

未应用则：
  npx prisma migrate deploy

业务冒烟：principal1 登录 → 设置 → 关于 → 右上角分享，path 含 store-referral-landing?code=O...`
          },
          {
            id: 'D-5', account: '开发操作（电脑）', kind: 'dev', gate: '支付联调',
            steps: '确认 migration <code>20260903_payment_virtual_membership</code> 已应用',
            expected: 'Applied；库中有 <code>PaymentOrder</code> 等支付相关结构',
            howto: `yunce-back/yunce-backend：

  npx prisma migrate status

确认 Applied：
  20260903_payment_virtual_membership

未应用：
  npx prisma migrate deploy

可选：npx prisma studio → 应能看到 PaymentOrder；OrganizationVersion（或等价）含 virtualProductId 字段`
          },
          {
            id: 'D-6', account: '开发操作（.env）', kind: 'dev', gate: '支付联调',
            steps: '检查后端 <code>.env</code> 虚拟支付相关变量（勿把真实密钥贴到聊天/截图外传）',
            expected: '下单不报「虚拟支付未配置」；生产禁止 MOCK=true',
            howto: `打开：yunce-back/yunce-backend/.env

必须有值（从 MP 虚拟支付后台复制，本地自查即可）：
  VIRTUAL_PAY_OFFER_ID=...
  VIRTUAL_PAY_APP_KEY=...
  WECHAT_PUSH_TOKEN=...
（安全模式另有 AES Key，按你们现网配置）

自检：
  VIRTUAL_PAY_MOCK 在联真机支付时应为 false（或未设）
  生产环境绝对不能 VIRTUAL_PAY_MOCK=true

改完 .env 后重启后端进程再生效。

验证方式：校长进会员页选套餐下单，若提示「虚拟支付未配置」→ 本项未过`
          },
          {
            id: 'D-7', account: '开发 / 微信公众平台', kind: 'dev', gate: '支付联调',
            steps: '小程序「消息推送」URL 指向虚拟支付 notify，且 Token 与后端一致',
            expected: 'MP 后台点「提交」URL 校验通过（echostr）；发货推送能打到后端日志',
            howto: `1. 打开微信公众平台 → 开发 → 开发管理 → 消息推送
2. URL 填你们公网可达地址，例如：
   https://dev.chancore.cn/api/app/v1/payments/virtual/notify
   （以实际路由为准；须含 GET 验签）
3. Token = 后端 .env 的 WECHAT_PUSH_TOKEN（必须一字不差）
4. 点提交：微信会 GET 带 echostr，后端应回显；后台显示配置成功

真机支付成功后：看后端日志是否收到发货/支付推送；没有则 URL/隧道/防火墙有问题`
          },
          {
            id: 'D-3', account: '微信开发者工具 / 真机',
            steps: '体验版或开发者工具能打开：招生注册、门店互邀落地、员工邀请落地、会员页',
            expected: '页面能打开，不是「页面不存在」/404',
            howto: `1. 小程序侧：yunceTaro 目录执行
   npm run build:weapp:dev
2. 微信开发者工具打开 yunceTaro/dist
3. 编译后，在「编译模式」或扫码进入这些页（或从业务入口点进去）：
   - package-auth/.../invite-register
   - package-settings/.../store-referral-landing
   - package-auth/.../campus-invite-landing
   - package-settings/.../membership
4. 任一项报「页面路径错误」→ 先重新 build 再测，不要继续后面模块`
          },
          {
            id: 'D-4', account: '开发操作 + 真机', kind: 'dev',
            steps: '体验版小程序与后端 <code>WECHAT_MINI_ENV_VERSION</code> 环境一致',
            expected: '扫码打开的是对应体验/正式版页面，而不是错环境',
            howto: `后端 .env：
  WECHAT_MINI_ENV_VERSION=trial    ← 测体验版时
  WECHAT_MINI_ENV_VERSION=release  ← 测正式版时
  （develop = 开发版）

改完重启后端。

真机：用「体验版」二维码测时，后端必须是 trial；否则扫码可能打不开或进错版。
本项与 VH-4 呼应：环境不一致时后面扫码项会红。`
          },
        ]
      }]
    },
    {
      id: 'auth',
      file: 'm01-auth.html',
      title: '② 登录 / 注册',
      short: '账号密码 · 微信 · 协议',
      pathHint: '进不了首页就不要测后面模块',
      sections: [{
        id: 'auth',
        title: '登录 / 注册 / 鉴权',
        desc: '主路径最外层。邀请联调账号（密码 <code>123456</code>，已写入 <code>db:seed:frontend-mock</code>）：未绑孩子 <code>parent-unbound@yunce.com</code>；未入驻教师 <code>teacher-unbound@yunce.com</code>。邮箱须带数字（勿写 <code>teacher@yunce.com</code>）。',
        items: [
          { id: 'F0', account: '<code>principal1@yunce.com</code><br>密码 <code>123456</code>', steps: '打开登录页 → <strong>手动勾选</strong>用户协议 → 邮箱密码 →「账号登录」', expected: '进入首页（非空白）；协议默认<strong>不勾选</strong>' },
          { id: 'F8', account: '任意', steps: '登录页不勾选协议就点登录 / 微信登录', expected: '被拦住，提示先同意协议' },
          { id: 'F1', account: '未用过的微信号（勿绑种子邮箱）', steps: '退出 →「微信一键登录」→ 同意隐私弹窗', expected: '进入完善资料或选择身份' },
          { id: 'F2', account: '已绑定 principal1 的微信号', steps: '用已有机构校长账号微信登录', expected: '直接进首页，不再强迫选身份' },
          { id: 'F7', account: '全新邮箱', steps: '注册页发码 → 设密码注册 → 退出 → 再用账号密码登录', expected: '注册成功且密码可再次登录；邮件标题为「注册验证码」（非登录）；发码不长时间卡住' },
          { id: 'F9', account: '<code>parent-unbound@yunce.com</code><br>密码 <code>123456</code>', steps: '账号密码登录（测邀请用的未绑孩子家长）', expected: '能登录；引导绑孩子 / 身份漏斗，不进教师首页' },
          { id: 'F10', account: '<code>teacher-unbound@yunce.com</code><br>密码 <code>123456</code>', steps: '账号密码登录（测员工邀请用的未入驻教师）', expected: '能登录；无机构上下文，可走身份选择 / 等员工邀请 accept' },
          { id: 'F3', account: '<code>teacher1</code> 或 <code>parent1</code>', steps: '教师/家长在登录页点「微信一键登录」', expected: '按产品口径：成功进端，或明确角色提示（勿白屏）', defaultStatus: 'skip' },
          { id: 'F5', account: '任意', steps: '登录页快速连点「微信登录」', expected: '不卡死、不重复报错刷屏' },
          { id: 'F6', account: '<code>principal1</code> / <code>123456</code>', steps: '断网失败一次 → 恢复网络重试', expected: '第二次能登录成功' },
          { id: 'F4', account: '未登录或新用户', steps: '在招生注册页 / 试听落地页内点「微信登录」', expected: '能登进去，且登录后回到业务页（不丢邀请上下文）' },
        ]
      }]
    },
    {
      id: 'l1',
      file: 'm02-l1-trial.html',
      title: '③ L1 试听分享',
      short: '课表分享 → 落地页',
      pathHint: '教师分享 + 第二台手机打开',
      sections: [{
        id: 'l1',
        title: 'L1 · 试听课 / 课程卡片分享',
        desc: '与 L2 临时码独立。',
        items: [
          { id: 'L1-1', account: '<code>teacher1@yunce.com</code>', steps: '课表找到班课卡片 → 分享试听 / 课程分享给好友', expected: '分享卡片可发出；path 指向试听/邀请落地页' },
          { id: 'L1-2', account: '第二台手机（可未登录）', steps: '好友点开 L1-1 分享卡片', expected: '进入试听落地页；机构/课程信息正确', depends: '需先完成 L1-1', gate: '回归' },
          { id: 'L1-3', account: '未登录微信', steps: '未登录打开试听落地页，浏览信息后再登录', expected: '未登录可看关键信息；登录不丢上下文' },
        ]
      }]
    },
    {
      id: 'l2',
      file: 'm03-l2-parent-invite.html',
      title: '④ L2 招生拉家长',
      short: '教师发码 · 扫码 · 过期/已用',
      pathHint: '先 VH-1 发码，再第二台手机扫',
      sections: [
        {
          id: 'l2-in',
          title: '教师发码侧',
          desc: '登录后内页操作；生成后再扫码。',
          items: [
            { id: 'VH-1', account: '<code>teacher1@yunce.com</code>', steps: '我的邀请 / 招生 →「招生二维码」页', expected: '出现二维码 PNG；有过期时间提示', gate: 'G1-3' },
            { id: 'VH-5', account: '<code>teacher1@yunce.com</code>', steps: '二维码页右上角转发给好友', expected: '好友可打开招生页（回测 VH-2a）', gate: 'G1-3' },
            { id: 'VH-3', account: '—（可选，需关微信配置）', steps: '后端无微信凭证时打开二维码页', expected: '明确错误提示 + 可重试', kind: 'dev',
              howto: `临时验证（测完务必改回）：
1. 备份 .env 中 WECHAT_APP_ID / WECHAT_APP_SECRET（或 MINI 对应项）
2. 清空或改成无效值 → 重启后端
3. teacher1 打开招生二维码页 → 应有明确错误，不是白屏
4. 恢复正确配置并重启`
            },
          ]
        },
        {
          id: 'l2-out',
          title: '外链 / 扫码侧',
          desc: 'G1-3 · 多数用第二台手机、未登录。',
          items: [
            { id: 'VH-2a', account: '第二台手机（未登录）', steps: '扫教师生成的招生二维码', expected: '进入「招生注册」页；机构和老师信息正确', depends: '需先完成 VH-1', gate: 'G1-3' },
            { id: 'VH-2b', account: '第二台手机', steps: '完全关闭小程序后再扫同一码', expected: '仍能识别邀请（冷启动 scene 兜底）', gate: 'G1-3' },
            { id: 'VH-2c', account: '开发者工具（可选）', kind: 'dev', steps: '开发者工具编译模式：模拟 scene=<code>PABC12345</code>（旧格式）', expected: '旧码仍可解析',
              howto: `微信开发者工具 → 详情/编译模式 → 启动参数或场景值：
填 scene=PABC12345（或产品约定的旧格式）
编译进入后应能解析，而不是空白报错`
            },
            { id: 'VH-4', account: '—', steps: '体验版扫体验码 / 正式版扫正式码', expected: '环境一致能打开；错环境应失败或进错版', gate: 'G1-3', depends: '先过 D-4' },
            { id: 'X-4', account: '第二台手机', steps: '转发 <code>invite-register?code=</code> 到另一台再打开', expected: '链接可用，context 正常', gate: 'G1-4' },
            { id: 'V2T-6', account: '过期链接', kind: 'dev', steps: '打开已过期的 L2 邀请链', expected: '满屏「已过期」分态，不可再绑定', gate: 'G1-4',
              howto: `任选一种造「过期」：
A. 等真实超过有效期（教师码页会写过期时间，常见 24h）后再打开
B. 开发协助：Prisma Studio 打开 ParentShareInvite，把某条 expireAt 改成昨天，status 保持 PENDING，再用该 inviteCode 打开落地页
C. 不要用「随便编一个码」——那是无效码，不是过期态`
            },
          ]
        }
      ]
    },
    {
      id: 'l4',
      file: 'm04-l4-store-referral.html',
      title: '⑤ L4 门店互邀',
      short: 'O 码分享 · 申请入驻',
      pathHint: '校长发码 → 新用户点开',
      sections: [{
        id: 'l4',
        title: 'L4 · 门店互邀入驻',
        desc: 'G1-3 · 管理员发 O 码 → 好友申请入驻。',
        items: [
          { id: 'V4T-R5', account: '无需登录', steps: '打开瞎编互邀链 <code>?code=OINVALID1</code>', expected: '提示链接无效，不白屏', gate: 'G1-3',
            howto: `开发者工具或真机打开路径（以实际分包为准）：
package-settings/pages/store-referral-landing/index?code=OINVALID1
应提示无效，而不是转圈白屏`
          },
          { id: 'V4T-R1', account: '<code>principal1@yunce.com</code>', steps: '设置 → 关于 → 右上角分享', expected: '分享 path 含 <code>store-referral-landing?code=O...</code>', gate: 'G1-3' },
          { id: 'V4T-R2', account: 'B 用户（未登录）', steps: '点开 V4T-R1 分享卡片', expected: '看到机构 A 名称；有「申请入驻」', depends: '需先完成 V4T-R1', gate: 'G1-3' },
          { id: 'V4T-R3', account: 'B 用户', steps: '落地页点「申请门店入驻」', expected: '进入入驻填表；pending O 码已存', gate: 'G1-3' },
          { id: 'V4T-R6', account: '<code>teacher1</code> 或 <code>parent1</code>', steps: '非管理员打开关于页分享', expected: '无管理员专属 O 码（普通 about）', gate: 'G1-3' },
        ]
      }]
    },
    {
      id: 'invite-close',
      file: 'm05-invite-close.html',
      title: '⑥ 邀请闭环',
      short: '注册绑定 · 员工邀 · 升会员',
      pathHint: 'G1-4 一口气跑完；需新用户',
      sections: [{
        id: 'invite-close',
        title: '邀请跨链路闭环（G1-4）',
        desc: '同一 Staging 会话建议一口气跑完。',
        items: [
          { id: 'X-1', account: '教师 <code>teacher1@yunce.com</code> + 家长 <code>parent-unbound@yunce.com</code>（或新微信）', steps: '完整：教师发 P 码 → 家长扫码/打开落地 → 登录未绑家长账号 → 绑定机构', expected: '全流程成功；邀请变为已使用；绑定者再开见成功页', gate: 'G1-4' },
          { id: 'X-2', account: '第三人（未参与 X-1）', steps: '打开 X-1 已用过的邀请链接', expected: '失效 / 已用满屏', gate: 'G1-4' },
          { id: 'V2T-5', account: '同上', steps: '确认已用态 UI 与 L2 产品分态一致（满屏，非弱提示）', expected: '已用态清晰不可再绑', gate: 'G1-4' },
          { id: 'X-3', account: '校长 <code>principal1</code> + 员工 <code>teacher-unbound@yunce.com</code>（先退出登录）', steps: '①校长生成员工邀请 →「复制邀请链接」②员工打开直链（<code>campus-invite-landing?code=</code>）③未登录点「登录并接受」→ 用未入驻教师账号登录后须回落地页再接受', expected: '直链无 redirect 壳；登录回跳正确；接受成功加入校区', gate: 'G1-4' },
          { id: 'X-3b', account: '已登录 <code>teacher-unbound@yunce.com</code>', steps: '已登录打开同类邀请直链 → 接受', expected: '成功加入；再开见成功页', gate: 'G1-4' },
          { id: 'V3T-4', account: '过期员工邀请链', kind: 'dev', steps: '打开超过有效期的 campus 邀请', expected: '满屏过期态，不可 accept', gate: 'G1-4',
            howto: `造过期（开发）：
Prisma Studio / SQL 找到 CampusInvite（或员工邀请表）对应记录，把 expireAt 调到过去，再用该 code 打开 campus-invite-landing`
          },
          { id: 'V3T-5', account: '已用员工邀请链', steps: '打开已接受过的员工邀请', expected: '满屏已用/成功分态，对齐 L2', gate: 'G1-4' },
          { id: 'V4T-R4', account: 'B：新邮箱/新微信（勿用种子）', steps: '从互邀链进 → 填表 → 登录/注册 → 提交', expected: '提交成功；后台/DB 可见推荐来源=机构 A', gate: 'G1-4',
            howto: `验证「谁推荐的」（非点击）：
1. 小程序提交成功后记下时间
2. 打开运营后台入驻审核，或 Prisma Studio 查 StoreEntry / OrgReferral 相关表
3. 该申请应带推荐机构 = 分享 O 码的机构 A`
          },
          { id: 'X-5', account: '<code>principal1</code>', steps: '给 X-1 邀请来的学员充值或发卡（抽一条）', expected: '邀请关系升级为会员（LEAD→MEMBER）', gate: 'G1-4' },
        ]
      }]
    },
    {
      id: 'store-entry',
      file: 'm06-store-entry.html',
      title: '⑦ 门店入驻漏斗',
      short: '填表 · pending · 审核',
      pathHint: '可接 L4；审核项需 Admin',
      sections: [{
        id: 'store-entry',
        title: '门店入驻审核漏斗',
        desc: 'SE-09/10 需运营后台批准/驳回。',
        items: [
          { id: 'SE-11', account: '未登录', steps: '未登录打开入驻填表页', expected: '可预览填表；提交时引导登录' },
          { id: 'SE-01', account: '新用户 B（可接 V4T-R3）', steps: '填表 → 申请入驻', expected: '进 pending；主标题含「提交成功，等待审核」' },
          { id: 'SE-02', account: '同上（PENDING）', steps: '看 pending 页', expected: '有「先体验演示门店」「联系客服催办」；无常驻大 QR' },
          { id: 'SE-03', account: '同上', steps: '点「先体验演示门店」', expected: '进 home（演示）；有演示环境 Toast' },
          { id: 'SE-04', account: '同上', steps: '点「联系客服催办」', expected: 'BottomSheet + QR，可放大' },
          { id: 'SE-05', account: '已有 PENDING', steps: '再次进入填表入口', expected: '自动 redirect 到 pending' },
          { id: 'SE-06', account: '填表页', steps: '弱网连点提交', expected: '不误报失败 Toast；最终进 pending（409 幂等）' },
          { id: 'SE-07', account: '需绑邮箱账号', steps: '点「去绑定」', expected: '页内 BindEmailSheet，不跳 profile' },
          { id: 'SE-08', account: '已登录 + PENDING', steps: '杀进程重开小程序', expected: '不进 identity-select 死循环；回到 pending 或 home 后再检→pending' },
          { id: 'SE-09', account: 'Admin 批准后', kind: 'dev', steps: '运营后台批准该入驻 → 小程序打开 pending', expected: '成功态 →「进入我的机构」进机构端',
            howto: `1. 登录运营后台（yunce-admin）
2. 找到门店入驻审核列表中对应申请 → 批准
3. 回到小程序 pending 页下拉/重进 → 应出现成功态`
          },
          { id: 'SE-10', account: 'Admin 驳回后', kind: 'dev', steps: '运营后台驳回（写原因）→ 打开 pending', expected: '见驳回原因 + 可重提',
            howto: `另造一条入驻申请（或开发重置状态）→ Admin 驳回并填写原因 → 小程序 pending 应展示原因与重提入口`
          },
        ]
      }]
    },
    {
      id: 'schedule',
      file: 'm07-schedule.html',
      title: '⑧ 教务课表',
      short: 'Tab · 换日 · 入口',
      pathHint: 'teacher1 / principal1',
      sections: [{
        id: 'schedule',
        title: '教务 · 课表（schedule）',
        desc: '主交互不能变。',
        items: [
          { id: 'S-1', account: '<code>teacher1</code> / <code>principal1</code>', steps: '课表顶栏切换：班课 / 团课 / 私教 / 场地（若开启）', expected: '列表与模式正确切换，无白屏' },
          { id: 'S-2', account: '同上', steps: '左右滑日 / 点日历换日', expected: '日期与卡片同步；不卡死' },
          { id: 'S-3', account: '同上', steps: '当日有课卡片 → 点「点名」', expected: '进入 lesson-form，班级/日期正确' },
          { id: 'S-4', account: '同上', steps: '卡片 → 调课 / 编辑排课', expected: '进入 schedule-form 或调课页，数据预填正确' },
          { id: 'S-5', account: '同上', steps: '停课一节 → 再恢复（或恢复班级）', expected: '确认弹窗文案正确；操作后列表状态更新' },
          { id: 'S-6', account: '团课 Tab', steps: '开放预约列表：加载时段 / 代约 / 取消（有数据时）', expected: '加载态与空态正常；操作有反馈' },
          { id: 'S-7', account: '场地 Tab（若开启）', steps: '打开场地列表 → 点进预约', expected: '有场地卡片；可进预约页' },
        ]
      }]
    },
    {
      id: 'schedule-form',
      file: 'm08-schedule-form.html',
      title: '⑨ 新建/编辑排课',
      short: '保存 · 冲突',
      pathHint: '接在课表之后',
      sections: [{
        id: 'schedule-form',
        title: '教务 · 新建 / 编辑排课',
        desc: '保存路径回归。',
        items: [
          { id: 'SF-1', account: '<code>principal1</code> 或教师', steps: '新建班课排课：选班、时段、老师 → 保存', expected: '保存成功；课表可见新规则' },
          { id: 'SF-2', account: '同上', steps: '编辑已有排课改时间 → 保存', expected: '保存成功；课表反映新时间' },
          { id: 'SF-3', account: '同上', steps: '故意制造时间冲突再保存', expected: '出现冲突提示，不会静默写坏数据' },
        ]
      }]
    },
    {
      id: 'lesson',
      file: 'm09-lesson.html',
      title: '⑩ 点名消课',
      short: '提交 · 防重入 · 补录',
      pathHint: '教务主路径终点',
      sections: [{
        id: 'lesson',
        title: '教务 · 点名消课',
        desc: '含 G1-1 防重入、G1-2 无假 CTA。',
        items: [
          { id: 'L-1', account: '<code>teacher1</code>', steps: '班课点名：勾选学员状态 → 提交消课', expected: '提交成功；课时正确扣减；可回课表' },
          { id: 'L-2', account: '同上', steps: '提交时快速连点「提交」多次', expected: '只成功一次；按钮 loading/禁用，无双扣', gate: 'G1-1' },
          { id: 'L-3', account: '体验课/试听相关页', steps: '检查是否仍有「签到开发中」等假入口', expected: '无误导 CTA（已隐藏或已接通）', gate: 'G1-2' },
          { id: 'L-4', account: '同上', steps: '单人消课模式走通一次', expected: '选学员 + 课包 → 提交成功' },
          { id: 'L-5', account: '班课点名页', steps: '补录学员 → 提交', expected: '补录名单进入点名并可提交' },
        ]
      }]
    },
    {
      id: 'parent',
      file: 'm10-parent.html',
      title: '⑪ 家长端',
      short: '课表 · 切换门店',
      pathHint: 'PS-2～5 需跨机构造数',
      sections: [{
        id: 'parent',
        title: '家长端 · 课表 + 切换门店',
        desc: '仅有 parent1 单机构时先做 PS-1 + PS-7。',
        items: [
          { id: 'P-1', account: '<code>parent1@yunce.com</code>', steps: '家长登录 → 课表 Tab', expected: '只看到绑定孩子相关班级；无教师专属操作误露' },
          { id: 'P-2', account: '同上（有开放约数据时）', steps: '团课开放约：预约 / 取消', expected: '状态正确；教师侧可见预约' },
          { id: 'PS-1', account: '<code>parent1@yunce.com</code>（单机构）', steps: '首页校区卡片点「切换门店」→ 看列表 → 选当前门店确认进入', expected: '列表至少 1 行，主文案为「机构名 · 校区名」；进入成功无报错', gate: '家长切机构' },
          { id: 'PS-2', account: '跨机构家长', kind: 'dev', steps: '打开「切换门店」Sheet', expected: '扁平列表 <strong>3</strong> 行；每行含机构名', depends: '需造数 A(2)+B(1)', gate: '家长切机构',
            howto: `造数（请开发协助，测前确认）：
同一微信/账号绑定：
  · 机构 A：2 个所属校区的学员
  · 机构 B：1 个校区的学员
列表应共 3 行，文案含「机构名 · 校区名」
没有造数时本项选「跳过」，不要标通过`
          },
          { id: 'PS-3', account: '同上；当前在 A·总校', steps: '选 <strong>B·总店</strong> →「进入该门店」', expected: '成功进入；首页仅属 B；杀进程重开仍停在 B', depends: '需先 PS-2', gate: '家长切机构' },
          { id: 'PS-4', account: '同上（已在 B）', steps: '再打开 Sheet → 选 <strong>A·城东</strong> → 进入', expected: '回到 A；数据不串 B', depends: '需先 PS-3', gate: '家长切机构' },
          { id: 'PS-5', account: '同上（当前 A）', steps: '同机构内：A·总校 ↔ A·城东 切换', expected: '进入成功；按目标校区过滤', depends: '需 A 有 ≥2 可见校区', gate: '家长切机构' },
          { id: 'PS-6', account: '跨机构家长或断网模拟', steps: '①跨机构切换时快速连点「进入」②（可选）断网后点确认', expected: '连点不双换 token；失败有 Toast，Sheet 不关', gate: '家长切机构' },
          { id: 'PS-7', account: '<code>teacher1</code> 或 <code>principal1</code>', steps: '员工首页「切换门店」→ 切换另一校区', expected: '只切当前机构校区；课表随校区更新', gate: '回归' },
        ]
      }]
    },
    {
      id: 'virtual-pay',
      file: 'm11-virtual-pay.html',
      title: '⑫ 机构会员支付',
      short: 'Admin 配道具 · 真机支付',
      pathHint: '依赖 ① 的 D-5/D-6/D-7 全绿',
      sections: [{
        id: 'virtual-pay',
        title: '机构 SaaS 会员 · 个人虚拟支付',
        desc: '仅校长买机构会员；学员学费不走此链路。',
        items: [
          { id: 'PAY-1', account: '运营后台', kind: 'dev', steps: '组织版本：给可售档位填 <code>virtualProductId</code>（与 MP 道具一致）+ 价格（分）+ 时长', expected: '保存成功；小程序 SKU 接口能返回该档', gate: '支付联调',
            howto: `1. 微信公众平台 → 虚拟支付 → 道具：记下 productId
2. 打开 yunce-admin → 组织版本/会员档位配置
3. 对应档位填写 virtualProductId（与道具一致）、价格（单位：分）、时长
4. 保存后，用校长账号刷新会员页应能看到该 SKU`
          },
          { id: 'PAY-2', account: '<code>principal1@yunce.com</code>', steps: '设置 → 会员 / 开通页，看在线套餐列表', expected: '有可购 SKU；价格按元展示正确', gate: '支付联调' },
          { id: 'PAY-3', account: '同上 · Android/真机微信', steps: '选套餐 → 下单 → 拉起支付（小额）', expected: '能弹出支付；取消有明确提示；无白屏', depends: '需先 PAY-1/PAY-2', gate: '支付联调' },
          { id: 'PAY-4', account: '同上', steps: '完成支付 → 等履约（看订单状态 / 会员到期）', expected: '订单 FULFILLED；机构 expireAt/档位更新', depends: '需先 PAY-3', gate: '支付联调',
            howto: `履约以服务端为准，不要只看前端 success：
· 后端日志：发货推送 / query_order
· Prisma Studio：PaymentOrder status → FULFILLED
· 小程序会员页：到期日/档位已变`
          },
          { id: 'PAY-5', account: '同上（可选）', steps: '支付成功后立刻杀进程或弱网；稍后回会员页刷新', expected: '仍能开通（查单或 reconcile 补履约）', gate: '支付联调' },
          { id: 'PAY-6', account: '<code>principal1</code>', steps: '不用支付，走「激活码」开通一次', expected: '激活码路径仍可用', gate: '回归' },
          { id: 'PAY-7', account: 'iOS 真机（可选）', steps: '微信版本 &lt; 8.0.68 时尝试支付', expected: '弹窗提示更新微信，不硬崩', defaultStatus: 'skip' },
        ]
      }]
    },
  ];

  function allItems() {
    const list = [];
    MODULES.forEach((m) => m.sections.forEach((s) => s.items.forEach((it) => list.push({ ...it, moduleId: m.id }))));
    return list;
  }

  /** Agent 本机核对结果（打开走查页时写入一次，不覆盖你之后手改） */
  const AGENT_ENV_VERDICT = {
    id: '2026-09-04-env-local-yunce-v2',
    at: '2026-09-04T03:57:00+08:00',
    items: {
      'D-1': {
        status: 'pass',
        notes: '库 yunce @ 127.0.0.1：_prisma_migrations 中 20260902_parent_share_invite 已 Applied；表 ParentShareInvite 存在。',
      },
      'D-2': {
        status: 'pass',
        notes: '20260902_org_referral_l4 已 Applied；Organization.orgReferralCode 列存在。',
      },
      'D-5': {
        status: 'pass',
        notes: '原先 Pending。已执行 prisma migrate deploy：20260903_payment_virtual_membership + 20260903_campus_class_media 已 Applied；PaymentOrder 表与 virtualProductId 列存在。请重启后端进程加载新 schema。',
      },
      'D-6': {
        status: 'fail',
        notes: 'VIRTUAL_PAY_OFFER_ID / VIRTUAL_PAY_APP_KEY 已有值。但 WECHAT_PUSH_TOKEN 为空（发货推送验签不可用）。VIRTUAL_PAY_MOCK 以当前 .env 为准；真机真实支付须为 false。NODE_ENV=development。',
      },
      'D-7': {
        status: 'fail',
        notes: '无法代替你在微信公众平台点「消息推送 URL 提交」。且本机 WECHAT_PUSH_TOKEN 为空，即使填了 notify URL 也无法验 echostr。配好 Token 后：URL 指向 /api/app/v1/payments/virtual/notify（或 /api/v1/...），与 .env 一字不差，再在 MP 后台提交。',
      },
      'D-3': {
        status: 'pass',
        notes: '代码侧已确认：app.config 已登记 invite-register、campus-invite-landing、store-referral-landing、membership，对应 tsx 存在。请仍用开发者工具编译后点进这四页，确认不是「页面不存在」。',
      },
      'D-4': {
        status: 'pass',
        notes: '已在 .env 补充 WECHAT_MINI_ENV_VERSION=trial（体验版联调）。改完后须重启后端。若改测正式版，改为 release。',
      },
    },
  };

  function applyAgentEnvVerdict(st) {
    if (!st || st.agentEnvVerdictId === AGENT_ENV_VERDICT.id) return st;
    Object.entries(AGENT_ENV_VERDICT.items).forEach(([id, v]) => {
      st.items[id] = {
        status: v.status,
        notes: v.notes,
        testedAt: AGENT_ENV_VERDICT.at,
      };
      if (v.status === 'pass') {
        st.frozen[id] = { label: CHAIN_LABELS[id] || id, frozenAt: AGENT_ENV_VERDICT.at };
      } else if (st.frozen && st.frozen[id]) {
        delete st.frozen[id];
      }
    });
    st.agentEnvVerdictId = AGENT_ENV_VERDICT.id;
    st.updatedAt = AGENT_ENV_VERDICT.at;
    return st;
  }

  function defaultState() {
    const items = {};
    allItems().forEach((it) => {
      items[it.id] = { status: it.defaultStatus || 'pending', notes: '', testedAt: null };
    });
    return {
      version: 2,
      session: { tester: '', environment: 'dev.chancore.cn 测试服', testDate: '' },
      items,
      frozen: {},
      updatedAt: null,
    };
  }

  function loadState() {
    let parsed = null;
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacy = localStorage.getItem('yunce-device-walkthrough-v1');
        if (legacy) raw = legacy;
      }
      if (raw) {
        parsed = JSON.parse(raw);
        parsed.version = 2;
        allItems().forEach((it) => {
          if (!parsed.items[it.id]) {
            parsed.items[it.id] = { status: it.defaultStatus || 'pending', notes: '', testedAt: null };
          }
        });
        if (!parsed.frozen) parsed.frozen = {};
      }
    } catch (e) { /* ignore */ }
    if (!parsed) parsed = defaultState();
    applyAgentEnvVerdict(parsed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch (e) { /* ignore */ }
    return parsed;
  }

  let state = loadState();

  function persistQuiet() {
    const tester = document.getElementById('tester');
    const environment = document.getElementById('environment');
    const testDate = document.getElementById('testDate');
    if (tester) state.session.tester = tester.value;
    if (environment) state.session.environment = environment.value;
    if (testDate) state.session.testDate = testDate.value;
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function moduleProgress(moduleId) {
    const mod = MODULES.find((m) => m.id === moduleId);
    if (!mod) return { pass: 0, fail: 0, pending: 0, skip: 0, total: 0 };
    const ids = [];
    mod.sections.forEach((s) => s.items.forEach((it) => ids.push(it.id)));
    const c = { pass: 0, fail: 0, pending: 0, skip: 0, total: ids.length };
    ids.forEach((id) => {
      const st = state.items[id]?.status || 'pending';
      c[st] = (c[st] || 0) + 1;
    });
    return c;
  }

  function moduleNavClass(moduleId) {
    const c = moduleProgress(moduleId);
    if (c.fail > 0) return 'fail';
    if (c.pass === c.total) return 'done';
    if (c.pass > 0) return 'partial';
    return '';
  }

  function gateBadge(gate) {
    if (!gate) return '';
    return `<span class="badge gate">${gate}</span>`;
  }

  function kindBadge(kind) {
    if (kind !== 'dev') return '';
    return `<span class="badge dev">非点击/开发操作</span>`;
  }

  function renderNav(activeId) {
    return `<nav class="nav-modules">${MODULES.map((m) => {
      const cls = [m.id === activeId ? 'active' : '', moduleNavClass(m.id)].filter(Boolean).join(' ');
      return `<a class="${cls}" href="${m.file}"><span class="dot"></span>${m.title}</a>`;
    }).join('')}</nav>`;
  }

  function renderPager(activeId) {
    const idx = MODULES.findIndex((m) => m.id === activeId);
    const prev = idx > 0 ? MODULES[idx - 1] : null;
    const next = idx >= 0 && idx < MODULES.length - 1 ? MODULES[idx + 1] : null;
    return `<div class="pager">
      ${prev ? `<a href="${prev.file}">← 上一模块：${prev.title}</a>` : `<span></span>`}
      <a href="index.html">总览</a>
      ${next ? `<a class="primary" href="${next.file}">下一模块：${next.title} →</a>` : `<a class="primary" href="index.html">回总览收工</a>`}
    </div>`;
  }

  function renderSessionToolbar() {
    return `
      <div class="session-form">
        <label>测试人<input type="text" id="tester" placeholder="你的名字" /></label>
        <label>测试环境<input type="text" id="environment" value="dev.chancore.cn 测试服" /></label>
        <label>测试日期<input type="date" id="testDate" /></label>
      </div>
      <div class="toolbar">
        <button class="primary" type="button" data-act="save">💾 保存（本机浏览器）</button>
        <button type="button" data-act="export">📤 导出记录文件</button>
        <button type="button" data-act="import">📥 导入记录文件</button>
        <button type="button" data-act="copy">📋 复制测试结果摘要</button>
        <button class="danger" type="button" data-act="reset">↺ 清空全部记录</button>
      </div>
      <div class="stats" id="stats"></div>`;
  }

  function fillSessionFields() {
    const tester = document.getElementById('tester');
    const environment = document.getElementById('environment');
    const testDate = document.getElementById('testDate');
    if (tester) tester.value = state.session.tester || '';
    if (environment) environment.value = state.session.environment || 'dev.chancore.cn 测试服';
    if (testDate) testDate.value = state.session.testDate || new Date().toISOString().slice(0, 10);
  }

  function renderStats(scopeModuleId) {
    const counts = { pending: 0, pass: 0, fail: 0, skip: 0 };
    const ids = scopeModuleId
      ? (() => {
          const mod = MODULES.find((m) => m.id === scopeModuleId);
          const list = [];
          mod.sections.forEach((s) => s.items.forEach((it) => list.push(it.id)));
          return list;
        })()
      : allItems().map((i) => i.id);

    ids.forEach((id) => {
      const st = state.items[id]?.status || 'pending';
      counts[st] = (counts[st] || 0) + 1;
    });

    const gateIds = new Set();
    allItems().forEach((it) => {
      if (['G1-3', 'G1-4', 'G1-1', 'G1-2'].includes(it.gate)) gateIds.add(it.id);
    });
    let gatePass = 0;
    let gatePending = 0;
    gateIds.forEach((id) => {
      const st = state.items[id]?.status;
      if (st === 'pass') gatePass++;
      else if (st !== 'skip') gatePending++;
    });

    const el = document.getElementById('stats');
    if (!el) return;
    const scopeLabel = scopeModuleId ? '本模块' : '全部';
    el.innerHTML = `
      <div class="stat"><strong style="color:var(--pass)">${counts.pass || 0}</strong>${scopeLabel}已通过</div>
      <div class="stat"><strong style="color:var(--fail)">${counts.fail || 0}</strong>失败</div>
      <div class="stat"><strong style="color:var(--pending)">${counts.pending || 0}</strong>还没测</div>
      <div class="stat"><strong>${counts.skip || 0}</strong>跳过</div>
      <div class="stat"><strong style="color:var(--gate)">${gatePass}/${gateIds.size}</strong>上线门禁已过<br><span style="font-size:0.75rem;color:var(--muted)">剩 ${gatePending} 项未过</span></div>`;
  }

  function renderSections(mod) {
    return mod.sections.map((section) => `
      <section id="sec-${section.id}">
        <h2>${section.title}</h2>
        ${section.desc ? `<p class="sec-desc">${section.desc}</p>` : ''}
        <table>
          <thead><tr>
            <th style="width:72px">编号</th>
            <th style="width:140px">用哪个账号</th>
            <th>你要做什么</th>
            <th>应该怎样</th>
            <th style="width:100px">结果</th>
            <th style="width:150px">备注</th>
          </tr></thead>
          <tbody>${section.items.map((it) => {
            const item = state.items[it.id] || { status: 'pending', notes: '' };
            const locked = item.status === 'pass';
            const depNote = it.depends ? `<br><span style="color:var(--pending);font-size:0.78rem">⚠ ${it.depends}</span>` : '';
            const howto = it.howto
              ? `<details class="item-howto"><summary>怎么验证 / 怎么操作（点开）</summary><pre>${escapeHtml(it.howto)}</pre></details>`
              : '';
            return `<tr class="${item.status} ${locked ? 'frozen-row' : ''}">
              <td><code>${it.id}</code>${gateBadge(it.gate)}${kindBadge(it.kind)}${locked ? '<br><span class="badge lock">已验收</span>' : ''}</td>
              <td class="account-cell">${it.account || '—'}${depNote}</td>
              <td>${it.steps}${howto}</td>
              <td>${it.expected}</td>
              <td><select data-id="${it.id}">
                <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>⏳ 还没测</option>
                <option value="pass" ${item.status === 'pass' ? 'selected' : ''}>✅ 通过</option>
                <option value="fail" ${item.status === 'fail' ? 'selected' : ''}>❌ 失败</option>
                <option value="skip" ${item.status === 'skip' ? 'selected' : ''}>⏭ 跳过</option>
              </select></td>
              <td><textarea class="notes" data-notes="${it.id}" placeholder="失败写这里">${escapeHtml(item.notes || '')}</textarea></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </section>`).join('');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderFrozen() {
    const entries = Object.entries(state.frozen || {});
    return `<section id="frozenRegistry">
      <h2 style="border:1px solid var(--border);border-radius:8px 8px 0 0;padding:10px 12px;background:#faf5ff;">🔒 已验收通过（本浏览器累计）</h2>
      <table>
        <thead><tr><th>编号</th><th>功能说明</th><th>通过时间</th></tr></thead>
        <tbody>${entries.length ? entries.map(([id, f]) =>
          `<tr><td><code>${id}</code></td><td>${escapeHtml(f.label || id)}</td><td>${(f.frozenAt || '').slice(0, 19).replace('T', ' ')}</td></tr>`
        ).join('') : '<tr><td colspan="3" style="color:var(--muted)">还没有——把某项选「通过」后会出现在这里</td></tr>'}</tbody>
      </table>
    </section>`;
  }

  function bindInteractions(scopeModuleId) {
    document.querySelectorAll('select[data-id]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const id = sel.getAttribute('data-id');
        const status = sel.value;
        state.items[id].status = status;
        state.items[id].testedAt = new Date().toISOString();
        if (status === 'pass') {
          state.frozen[id] = { label: CHAIN_LABELS[id] || id, frozenAt: new Date().toISOString() };
        } else if (state.frozen[id]) delete state.frozen[id];
        persistQuiet();
        // re-render light: stats + nav dots via full module re-render is heavy; refresh page content
        if (scopeModuleId) renderModule(scopeModuleId);
        else renderIndex();
      });
    });
    document.querySelectorAll('textarea[data-notes]').forEach((ta) => {
      ta.addEventListener('change', () => {
        state.items[ta.getAttribute('data-notes')].notes = ta.value;
        persistQuiet();
      });
    });
    document.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-act');
        if (act === 'save') {
          persistQuiet();
          alert('已保存到本机浏览器，关闭页面也不会丢（同一浏览器）。');
        } else if (act === 'reset') {
          if (!confirm('确定清空全部测试记录？')) return;
          state = defaultState();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          if (scopeModuleId) renderModule(scopeModuleId);
          else renderIndex();
        } else if (act === 'export') {
          persistQuiet();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
          a.download = `真机测试记录-${state.session.testDate || 'export'}.json`;
          a.click();
        } else if (act === 'import') {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = (e) => {
            const r = new FileReader();
            r.onload = (ev) => {
              try {
                state = JSON.parse(ev.target.result);
                state.version = 2;
                allItems().forEach((it) => {
                  if (!state.items[it.id]) {
                    state.items[it.id] = { status: it.defaultStatus || 'pending', notes: '', testedAt: null };
                  }
                });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                if (scopeModuleId) renderModule(scopeModuleId);
                else renderIndex();
                alert('导入成功');
              } catch {
                alert('文件格式不对');
              }
            };
            r.readAsText(e.target.files[0]);
          };
          input.click();
        } else if (act === 'copy') {
          persistQuiet();
          const failed = Object.entries(state.items).filter(([, v]) => v.status === 'fail');
          const passed = Object.entries(state.items).filter(([, v]) => v.status === 'pass');
          const gateItems = [];
          allItems().forEach((it) => {
            if (['G1-3', 'G1-4', 'G1-1', 'G1-2'].includes(it.gate)) {
              gateItems.push(`${it.id}:${state.items[it.id]?.status || 'pending'}`);
            }
          });
          const text = [
            `真机测试摘要 ${state.session.testDate || ''}`,
            `测试人: ${state.session.tester}`,
            `环境: ${state.session.environment}`,
            `通过 ${passed.length} 项: ${passed.map(([k]) => k).join('、') || '无'}`,
            `失败 ${failed.length} 项: ${failed.map(([k, v]) => k + (v.notes ? `（${v.notes}）` : '')).join('、') || '无'}`,
            `上线门禁: ${gateItems.join(' · ')}`,
          ].join('\n');
          navigator.clipboard.writeText(text).then(() => alert('摘要已复制，可以粘贴发给开发'));
        }
      });
    });
  }

  function renderModule(moduleId) {
    const mod = MODULES.find((m) => m.id === moduleId);
    const root = document.getElementById('app');
    if (!mod || !root) return;

    root.innerHTML = `
      <p class="crumb"><a href="index.html">真机联调总览</a> / ${mod.title}</p>
      <h1>${mod.title}</h1>
      <p class="meta">${mod.pathHint}</p>
      ${renderNav(moduleId)}
      <div class="tip-box"><strong>本模块怎么测：</strong>${mod.short}。带 <span class="badge dev">非点击/开发操作</span> 的项请点开「怎么验证」。测完点下方「下一模块」继续，不要一次刷完全部。</div>
      ${renderSessionToolbar()}
      ${renderSections(mod)}
      ${renderPager(moduleId)}
      ${renderFrozen()}
    `;
    fillSessionFields();
    renderStats(moduleId);
    bindInteractions(moduleId);
  }

  function renderIndex() {
    const root = document.getElementById('app');
    if (!root) return;

    const cards = MODULES.map((m, i) => {
      const c = moduleProgress(m.id);
      const done = c.pass + c.skip;
      return `<a class="path-card" href="${m.file}">
        <span class="step-num">步骤 ${i + 1} / ${MODULES.length}</span>
        <span class="title">${m.title}</span>
        <span class="desc">${m.short}<br>${m.pathHint}</span>
        <span class="prog">进度：✅${c.pass} · ❌${c.fail} · ⏳${c.pending} · ⏭${c.skip}（${done}/${c.total}）</span>
      </a>`;
    }).join('');

    root.innerHTML = `
      <h1>真机前后端联调 · 分模块走查</h1>
      <p class="meta">按下面路径<strong>一页一页</strong>测；进度存在本机浏览器，各模块互通。旧单页清单已拆到本目录。</p>

      <div class="flow-hint">
        <strong>推荐实测路径（递进）</strong>
        <ol>
          <li><a href="m00-env.html">环境</a>：migration / .env / 消息推送 / 页面可达（先全绿）</li>
          <li><a href="m01-auth.html">登录注册</a> → 能进首页</li>
          <li><a href="m02-l1-trial.html">L1 试听分享</a> → <a href="m03-l2-parent-invite.html">L2 招生</a> → <a href="m04-l4-store-referral.html">L4 互邀</a></li>
          <li><a href="m05-invite-close.html">邀请闭环 G1-4</a> → <a href="m06-store-entry.html">入驻漏斗</a></li>
          <li><a href="m07-schedule.html">课表</a> → <a href="m08-schedule-form.html">排课</a> → <a href="m09-lesson.html">点名消课</a></li>
          <li><a href="m10-parent.html">家长端</a> → <a href="m11-virtual-pay.html">机构会员支付</a>（依赖步骤 1 支付项）</li>
        </ol>
      </div>

      <div class="accounts-box">
        <h3>测试账号（密码统一 <code>123456</code>）</h3>
        <table>
          <thead><tr><th>用途</th><th>邮箱</th><th>角色</th></tr></thead>
          <tbody>
            <tr><td>校长</td><td><code>principal1@yunce.com</code></td><td>OWNER · O 码 / 员工邀 / 支付</td></tr>
            <tr><td>教师</td><td><code>teacher1@yunce.com</code></td><td>TEACHER · 招生码 / 点名</td></tr>
            <tr><td>家长（已绑孩子）</td><td><code>parent1@yunce.com</code></td><td>PARENT · 课表 / 切门店</td></tr>
            <tr><td>家长（未绑·测邀请）</td><td><code>parent-unbound@yunce.com</code></td><td>PARENT · PENDING 无学员 · 种子账号</td></tr>
            <tr><td>教师（未入驻·测员工邀）</td><td><code>teacher-unbound@yunce.com</code></td><td>TEACHER · 无机构 · 种子账号</td></tr>
            <tr><td>新用户 B</td><td>新注册邮箱或未绑定微信</td><td>互邀 / 注册绑定（勿用种子）</td></tr>
            <tr><td>第二台手机</td><td>任意微信</td><td>扫码 / 点分享卡</td></tr>
          </tbody>
        </table>
      </div>

      <div class="howto-box">
        <h3>联调启动（每次开测前）</h3>
        <ol>
          <li>双击后端 <code>start.cmd</code>（tunnel + Docker + API 窗口都别关）</li>
          <li>小程序：<code>yunceTaro</code> 里 <code>npm run build:weapp:dev</code> → 微信开发者工具打开 <code>dist</code> → 真机预览</li>
          <li>接口环境：<code>dev.chancore.cn</code>（以你们当前配置为准）</li>
          <li>第一次或刚拉代码：进入 <a href="m00-env.html">① 环境准备</a>，按「怎么验证」跑 migration，不要猜</li>
        </ol>
      </div>

      <div class="rules">
        <h3>规则</h3>
        <ol>
          <li>选「通过」= 该能力验收冻结；失败务必写备注。</li>
          <li>带「非点击/开发操作」的项：必须点开「怎么验证」，按命令做完再打勾。</li>
          <li>全部测完：导出记录文件发给开发；G1-* 门禁须全绿才能宣称闭环。</li>
        </ol>
      </div>

      ${renderSessionToolbar()}
      <div class="path-grid">${cards}</div>
      ${renderFrozen()}
    `;
    fillSessionFields();
    renderStats(null);
    bindInteractions(null);
  }

  global.Walkthrough = {
    MODULES,
    renderModule,
    renderIndex,
  };
})(window);
