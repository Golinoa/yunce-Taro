/**
 * 联调契约占位（A11 口径）：真实接口未接通时显式报错，禁止猜测后端路径。
 *
 * 使用场景：VITE_USE_MOCK=false（联调/生产）但真实接口尚未按后端 OpenAPI 契约接入时，
 * 对应的 service 真实分支调用本函数，抛出明确错误而非请求猜测的 URL（避免 404 迷惑）。
 *
 * 接入方式：拿到后端契约后，将对应 service 的真实分支替换为 get/post/put/del 调用即可。
 */
export function notWired(apiName: string): never {
  throw new Error(
    `[接口未接通] ${apiName} 的真实后端路径待 OpenAPI 契约后接入（VITE_USE_MOCK=false 下不可用）`,
  );
}
