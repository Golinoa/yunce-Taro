/**
 * 认证 Service 层（薄 re-export 门面）
 * 所有认证相关请求统一通过此处，真实 API 联调时只改分模块即可
 */
export { resolveLoginEmailInput } from '@/services/auth-email';

export {
  AUTH_ENDPOINTS,
  AUTH_TOKEN_KEY,
  USER_PROFILE_KEY,
  REGISTER_DRAFT_STORAGE_KEY,
  authCapabilities,
  clearStoredAuth,
  getErrorMessage,
  type TestAccount,
} from '@/services/auth-shared';

export {
  mapBackendProfile,
  mergeBackendProfileDetail,
  mapBackendRole,
  mapUserRoleToBackend,
  mapBackendAuthPayload,
  mapBackendSession,
  type BackendRole,
  type BackendUserInfo,
  type BackendAuthPayload,
  type BackendProfileDetailPayload,
  type AuthPayload,
} from '@/services/auth-profile-map';

export {
  PASSWORD_RESET_SUCCESS,
  checkEmailRegistered,
  sendPasswordResetCode,
  sendRegisterEmailCode,
  login,
  wechatLogin,
  sendBindEmailCode,
  bindAccountEmail,
  bindWechatCredentials,
  sendSmsCode,
  phoneLogin,
  checkLoginAccount,
  prepareEmailLogin,
  prepareEmailRegister,
  loginByEmailCode,
  prepareAccountRecovery,
  recoverAccountByEmailCode,
  preparePasswordReset,
  resetPasswordByEmailCode,
  type EmailOtpSendResult,
  type LoginAccountCheckResult,
  type EmailLoginPrepareResult,
  type AccountRecoveryPrepareResult,
  type AccountRecoveryResult,
  type PasswordResetPrepareResult,
  type LoginResult,
  type WechatLoginOptions,
} from '@/services/auth-login';

export {
  registerStep1,
  registerStep1ByEmail,
  registerStep1ByPhone,
  registerStep2,
  registerStep3,
  registerWithEmailPassword,
  verifyCampusCode,
  verifyStudentCode,
  validateInviteCode,
  signUp,
  type RegisterStep1Result,
  type RegisterDraft,
} from '@/services/auth-register';

export {
  getSession,
  switchIdentity,
  updateProfile,
  getProfileExtra,
  addIdentity,
  restoreRegisterDrafts,
  logout,
  refreshSessionForTenant,
  listParentStorefronts,
  switchAuthContext,
  testAccounts,
  testPassword,
  getTestAccounts,
  getTestPassword,
} from '@/services/auth-session';
