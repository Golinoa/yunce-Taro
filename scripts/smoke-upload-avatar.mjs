#!/usr/bin/env node
/**
 * 实际上传烟测（本机 API）：登录 → upload/token → 直传七牛 → HEAD CDN
 *
 * Usage (WSL/Node):
 *   node scripts/smoke-upload-avatar.mjs
 *   API_ROOT=http://127.0.0.1:3000 EMAIL=principal1@yunce.com PASSWORD=123456 node scripts/smoke-upload-avatar.mjs
 */
import { createWriteStream, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:https';
import { request as plainRequest } from 'node:http';

const API_ROOT = (process.env.API_ROOT || 'http://127.0.0.1:3000').replace(/\/$/, '');
const EMAIL = process.env.EMAIL || 'principal1@yunce.com';
const PASSWORD = process.env.PASSWORD || '123456';

function log(step, msg, extra) {
  const line = `[smoke-upload] ${step}: ${msg}`;
  if (extra !== undefined) {
    console.log(line, typeof extra === 'string' ? extra : JSON.stringify(extra, null, 2));
  } else {
    console.log(line);
  }
}

function requestJson(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? httpRequest : plainRequest;
    const payload = body ? JSON.stringify(body) : undefined;
    const req = lib(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
        timeout: 20000,
        rejectUnauthorized: true,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { raw: text };
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, json, text });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

/** 1x1 JPEG */
function tinyJpegBuffer() {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z',
    'base64',
  );
}

function uploadMultipart(uploadUrl, fields, filePath, filename) {
  return new Promise((resolve, reject) => {
    const boundary = `----yunceSmoke${Date.now()}`;
    const fileBuf = readFileSync(filePath);
    const parts = [];
    for (const [k, v] of Object.entries(fields)) {
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
      );
    }
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`,
    );
    const head = Buffer.from(parts.join(''), 'utf8');
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const body = Buffer.concat([head, fileBuf, tail]);

    const u = new URL(uploadUrl);
    const req = httpRequest(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: 30000,
        rejectUnauthorized: true,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('upload timeout')));
    req.write(body);
    req.end();
  });
}

function headUrl(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = httpRequest(
      {
        method: 'HEAD',
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        timeout: 15000,
        rejectUnauthorized: true,
        servername: u.hostname,
      },
      (res) => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          authorized: true,
        });
        res.resume();
      },
    );
    req.on('error', (err) => {
      resolve({ status: 0, error: err.message, code: err.code, authorized: false });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, error: 'timeout', authorized: false });
    });
    req.end();
  });
}

function tlsProbe(hostname) {
  return new Promise((resolve) => {
    const req = httpRequest(
      {
        method: 'GET',
        hostname,
        path: '/',
        timeout: 10000,
        rejectUnauthorized: true,
        servername: hostname,
      },
      (res) => {
        const cert = res.socket.getPeerCertificate?.();
        resolve({
          ok: true,
          status: res.statusCode,
          subject: cert?.subject?.CN || cert?.subject?.O,
          valid_to: cert?.valid_to,
          issuer: cert?.issuer?.O || cert?.issuer?.CN,
        });
        res.resume();
      },
    );
    req.on('error', (err) => {
      resolve({ ok: false, error: err.message, code: err.code });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    req.end();
  });
}

async function main() {
  const report = { ok: false, steps: [] };
  const fail = (step, msg, extra) => {
    log(step, `FAIL — ${msg}`, extra);
    report.steps.push({ step, ok: false, msg, extra });
    report.ok = false;
    console.log('\nRESULT:', JSON.stringify(report, null, 2));
    process.exit(1);
  };

  log('0', `API_ROOT=${API_ROOT} EMAIL=${EMAIL}`);

  // TLS probes (match WeChat uploadFile targets)
  for (const host of ['upload.qiniup.com', 'upload-z1.qiniup.com', 'upload-z2.qiniup.com']) {
    const tls = await tlsProbe(host);
    log('tls', host, tls);
    report.steps.push({ step: `tls:${host}`, ok: Boolean(tls.ok), extra: tls });
  }

  const login = await requestJson(`${API_ROOT}/api/app/v1/auth/password-login`, {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  if (login.status !== 200 || !(login.json?.code === 0 || login.json?.code === 200)) {
    fail('login', `password-login status=${login.status}`, login.json || login.text);
  }
  const token = login.json?.data?.token;
  if (!token) fail('login', 'missing token', login.json);
  log('login', 'OK');

  const tokenRes = await requestJson(`${API_ROOT}/api/app/v1/upload/token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { type: 'avatar', filename: 'smoke-avatar.jpg' },
  });
  if (tokenRes.status !== 200 || !(tokenRes.json?.code === 0 || tokenRes.json?.code === 200)) {
    fail('token', `upload/token status=${tokenRes.status}`, tokenRes.json || tokenRes.text);
  }
  const payload = tokenRes.json.data;
  log('token', 'OK', {
    uploadUrl: payload.uploadUrl,
    domain: payload.domain,
    key: payload.key,
    url: payload.url,
  });
  report.steps.push({
    step: 'token',
    ok: true,
    extra: { uploadUrl: payload.uploadUrl, domain: payload.domain, url: payload.url },
  });

  // CDN domain TLS
  try {
    const cdnHost = new URL(payload.domain).hostname;
    const cdnTls = await tlsProbe(cdnHost);
    log('tls', cdnHost, cdnTls);
    report.steps.push({ step: `tls:${cdnHost}`, ok: Boolean(cdnTls.ok), extra: cdnTls });
    if (!cdnTls.ok) {
      log('tls', `WARN CDN cert issue — matches WeChat ERR_CERT_COMMON risk`, cdnTls);
    }
  } catch (e) {
    log('tls', 'WARN parse domain failed', String(e));
  }

  const tmp = join(tmpdir(), `yunce-smoke-avatar-${Date.now()}.jpg`);
  writeFileSync(tmp, tinyJpegBuffer());
  try {
    const up = await uploadMultipart(
      payload.uploadUrl,
      { token: payload.token, key: payload.key },
      tmp,
      'smoke-avatar.jpg',
    );
    log('upload', `status=${up.status}`, up.text.slice(0, 400));
    report.steps.push({ step: 'upload', ok: up.status >= 200 && up.status < 300, extra: { status: up.status, body: up.text.slice(0, 400) } });
    if (up.status < 200 || up.status >= 300) {
      fail('upload', `qiniu rejected status=${up.status}`, up.text);
    }
  } catch (e) {
    fail('upload', e instanceof Error ? e.message : String(e));
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }

  const head = await headUrl(payload.url);
  log('cdn-head', payload.url, head);
  report.steps.push({ step: 'cdn-head', ok: head.status >= 200 && head.status < 400, extra: head });
  if (!(head.status >= 200 && head.status < 400)) {
    fail('cdn-head', `cannot fetch uploaded object status=${head.status}`, head);
  }

  report.ok = true;
  console.log('\nRESULT: PASS — avatar upload + CDN readable');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('[smoke-upload] FATAL', err);
  process.exit(1);
});
