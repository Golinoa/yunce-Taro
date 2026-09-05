/**
 * 使用 miniprogram-ci 上传微信小程序（开发版本，可在公众平台设为体验版）
 *
 * 环境变量：
 * - WECHAT_PRIVATE_KEY  必填：上传密钥全文（或 WECHAT_PRIVATE_KEY_PATH / WECHAT_PRIVATE_KEY_BASE64）
 * - WECHAT_APPID        可选：默认读 project.config.json 的 appid
 * - WECHAT_UPLOAD_VERSION 必填：版本号，如 1.2.0
 * - WECHAT_UPLOAD_DESC  可选：版本描述
 * - WECHAT_CI_ROBOT     可选：CI 机器人编号 1–30，默认 1
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { normalizeWechatPrivateKey } from './upload-weapp-normalize.mjs';

const require = createRequire(import.meta.url);
const ci = require('miniprogram-ci');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readAppId() {
  const fromEnv = (process.env.WECHAT_APPID || '').trim();
  if (fromEnv) return fromEnv;
  const cfgPath = path.join(root, 'project.config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  if (!cfg.appid) {
    throw new Error('project.config.json 缺少 appid，且未设置 WECHAT_APPID');
  }
  return String(cfg.appid);
}

function assertPemLooksValid(pem) {
  const hasBegin = /-----BEGIN [\w\s]+PRIVATE KEY-----/.test(pem);
  const hasEnd = /-----END [\w\s]+PRIVATE KEY-----/.test(pem);
  if (!hasBegin || !hasEnd) {
    throw new Error(
      'WECHAT_PRIVATE_KEY 不是合法 PEM（缺少 BEGIN/END PRIVATE KEY）。请从微信公众平台重新下载「代码上传密钥」，' +
        '全文粘贴到 GitHub Secret（含 -----BEGIN…----- 行），或改用 WECHAT_PRIVATE_KEY_BASE64（密钥文件 base64）。',
    );
  }
  const lines = pem.split('\n').filter(Boolean);
  console.log(
    `[upload:weapp] private key ok: lines=${lines.length} bytes=${Buffer.byteLength(pem, 'utf8')} begin=${lines[0]}`,
  );
}

function resolvePrivateKeyPath() {
  const keyPath = (process.env.WECHAT_PRIVATE_KEY_PATH || '').trim();
  if (keyPath) {
    if (!fs.existsSync(keyPath)) {
      throw new Error(`WECHAT_PRIVATE_KEY_PATH 不存在: ${keyPath}`);
    }
    const pem = normalizeWechatPrivateKey(fs.readFileSync(keyPath, 'utf8'));
    assertPemLooksValid(pem);
    const tmp = path.join(os.tmpdir(), `yunce-weapp-private-${process.pid}.key`);
    fs.writeFileSync(tmp, pem, { encoding: 'utf8', mode: 0o600 });
    return {
      keyPath: tmp,
      cleanup: () => {
        try {
          fs.unlinkSync(tmp);
        } catch {
          // ignore
        }
      },
    };
  }

  const b64 = (process.env.WECHAT_PRIVATE_KEY_BASE64 || '').trim();
  let keyBody = '';
  if (b64) {
    keyBody = Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8');
  } else {
    keyBody = process.env.WECHAT_PRIVATE_KEY || '';
  }
  if (!String(keyBody).trim()) {
    throw new Error(
      '请设置 WECHAT_PRIVATE_KEY（密钥全文）、WECHAT_PRIVATE_KEY_BASE64，或 WECHAT_PRIVATE_KEY_PATH',
    );
  }

  const pem = normalizeWechatPrivateKey(keyBody);
  assertPemLooksValid(pem);

  const tmp = path.join(os.tmpdir(), `yunce-weapp-private-${process.pid}.key`);
  fs.writeFileSync(tmp, pem, { encoding: 'utf8', mode: 0o600 });
  return {
    keyPath: tmp,
    cleanup: () => {
      try {
        fs.unlinkSync(tmp);
      } catch {
        // ignore
      }
    },
  };
}

async function main() {
  const version = (process.env.WECHAT_UPLOAD_VERSION || '').trim();
  if (!version) {
    throw new Error('请设置 WECHAT_UPLOAD_VERSION（如 1.2.0）');
  }

  const desc =
    (process.env.WECHAT_UPLOAD_DESC || '').trim() ||
    `upload ${version} @ ${new Date().toISOString()}`;
  const robot = Number(process.env.WECHAT_CI_ROBOT || '1') || 1;
  const appid = readAppId();

  const distDir = path.join(root, 'dist');
  if (!fs.existsSync(path.join(distDir, 'app.json'))) {
    throw new Error('dist/app.json 不存在，请先执行 npm run build:weapp:prod');
  }

  const { keyPath, cleanup } = resolvePrivateKeyPath();

  try {
    const project = new ci.Project({
      appid,
      type: 'miniProgram',
      projectPath: root,
      privateKeyPath: keyPath,
      ignores: ['node_modules/**/*', 'src/**/*', 'docs/**/*', 'coverage/**/*', '.git/**/*'],
    });

    console.log(
      `[upload:weapp] appid=${appid} version=${version} robot=${robot} projectPath=${root}`,
    );

    const result = await ci.upload({
      project,
      version,
      desc,
      robot,
      setting: {
        es6: false,
        es7: false,
        minify: true,
        codeProtect: false,
        minifyWXSS: true,
        minifyWXML: true,
        autoPrefixWXSS: false,
      },
      onProgressUpdate: (info) => {
        if (typeof info === 'string') {
          console.log(`[upload:weapp] ${info}`);
          return;
        }
        if (info && typeof info === 'object' && 'message' in info) {
          console.log(`[upload:weapp] ${info.message}`);
        }
      },
    });

    console.log('[upload:weapp] upload ok', JSON.stringify(result || {}, null, 2));
    console.log(
      '[upload:weapp] 已上传为微信「开发版本」。请到 mp.weixin.qq.com → 版本管理 → 选为体验版。',
    );
  } finally {
    cleanup?.();
  }
}

main().catch((error) => {
  console.error('[upload:weapp]', error?.message || error);
  process.exit(1);
});
