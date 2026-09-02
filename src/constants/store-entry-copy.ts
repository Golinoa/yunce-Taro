/**
 * 身份文案常量 — 门店入驻 / 管理员 / 绑定机构（与产品真源对齐）
 */
export const STORE_ENTRY_IDENTITY_COPY = {
  optionTitle: '门店入驻',
  optionDesc: '我是管理员，申请开通自己的机构（需运营审核）',
  bindOrgTitle: '绑定机构',
  bindOrgDesc: '弹出输入框填写邀请码；系统自动识别学员或员工',
  footerHint: '未完成「门店入驻」或「绑定机构」前将停留在选择身份；入驻须运营审核',
  formTitle: '门店入驻',
  formSubtitle: '请填写资料，提交后将进入审核进度页（通常 1–3 个工作日）',
  aboutCta: '申请门店入驻',
  aboutShareSlogan: '机构管理系统 · 管理员门店入驻需运营审核开通',
} as const;

/** 审核进度中间页（store-entry/pending）文案 */
export const STORE_ENTRY_PENDING_COPY = {
  navTitlePending: '申请已提交',
  titlePending: '提交成功，等待审核中',
  descPending:
    '我们已收到您的入驻申请，将在 1–3 个工作日内完成审核。通过后您将成为机构管理员，自有门店正式开通。',
  btnDemo: '先体验演示门店',
  btnDemoHint: '审核期间可先熟悉系统功能',
  btnExpedite: '联系客服催办',
  btnExpediteHint: '加急审核请添加客服微信',
  demoToast: '当前为演示环境，审核通过后开通自有门店',
  expediteSheetTitle: '加急审核 · 联系客服',
  expediteSheetDesc: '请添加客服微信，备注您的门店名称，我们将优先处理。',
  expediteQrHint: '长按识别二维码 · 工作时间 9:00–18:00',
  titleApproved: '入驻成功',
  descApprovedPrefix: '门店入驻成功',
  btnEnterOrg: '进入我的机构',
  titleRejected: '申请未通过',
  descRejected: '很抱歉，您的入驻申请未通过运营审核，可修改资料后重新提交。',
  btnResubmit: '修改资料重新提交',
  loading: '查询申请状态中...',
  loadFailed: '暂时无法获取申请状态，请下拉重试',
} as const;
