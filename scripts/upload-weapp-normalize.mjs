/**
 * 规范化微信代码上传私钥 PEM（无 miniprogram-ci 依赖，可供单测）。
 * GitHub Secrets 常见问题：字面量 \n、CRLF、首尾引号、BOM、整段被压成一行。
 */
export function normalizeWechatPrivateKey(raw) {
  let text = String(raw ?? '');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  if (text.includes('\\n')) {
    text = text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  }
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!text.includes('\n') && /-----BEGIN[\w\s]+PRIVATE KEY-----/.test(text)) {
    const m = text.match(
      /^(-----BEGIN [\w\s]+PRIVATE KEY-----)(.+?)(-----END [\w\s]+PRIVATE KEY-----)$/,
    );
    if (m) {
      const body = m[2].replace(/\s+/g, '');
      const lines = body.match(/.{1,64}/g) || [];
      text = `${m[1]}\n${lines.join('\n')}\n${m[3]}\n`;
    }
  }

  if (!text.endsWith('\n')) text += '\n';
  return text;
}
