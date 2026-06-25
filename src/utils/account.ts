export const ACCOUNT_MIN_LENGTH = 6;
export const ACCOUNT_MAX_LENGTH = 16;
export const ACCOUNT_PATTERN = new RegExp(
  `^[a-zA-Z0-9_]{${ACCOUNT_MIN_LENGTH},${ACCOUNT_MAX_LENGTH}}$`,
);
export const ACCOUNT_RULE_TEXT = `${ACCOUNT_MIN_LENGTH}-${ACCOUNT_MAX_LENGTH}位字母、数字、下划线`;

export function sanitizeAccountInput(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, ACCOUNT_MAX_LENGTH);
}

export function isAccountFormatValid(value: string): boolean {
  return ACCOUNT_PATTERN.test(value.trim());
}
