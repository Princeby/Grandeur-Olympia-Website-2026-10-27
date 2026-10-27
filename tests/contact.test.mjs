import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/contact.mjs';

const valid = { name: 'Website form test', email: 'visitor@example.com', service: 'mep', message: 'Please discuss building services for this property.', website: '' };
function request(data = valid, options = {}) {
  return new Request('https://grandeurolympiaglobal.com/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://grandeurolympiaglobal.com', 'CF-Connecting-IP': '192.0.2.1', ...options.headers },
    body: JSON.stringify(data), ...options
  });
}
function setup() {
  const sent = [];
  const env = {
    CONTACT_EMAIL: { async send(message) { sent.push(message); return { messageId: 'test-only' }; } },
    CONTACT_RATE_LIMITER: { async limit() { return { success: true }; } },
    ASSETS: { async fetch() { return new Response('existing website'); } }
  };
  return { sent, env };
}

test('send exactly one email to the fixed company inbox; visitor is Reply-To', async () => {
  const { env, sent } = setup();
  const response = await worker.fetch(request({ ...valid, to: 'attacker@example.com', from: 'attacker@example.com' }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'grandeurolympiaglobal@gmail.com');
  assert.equal(sent[0].from.email, 'website@grandeurolympiaglobal.com');
  assert.equal(sent[0].replyTo, valid.email);
  assert.match(sent[0].text, /Technical & MEP services/);
  assert.match(sent[0].text, /Please discuss building services/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('do not report success before the email service accepts the message', async () => {
  const { env } = setup();
  let release;
  env.CONTACT_EMAIL.send = () => new Promise(resolve => { release = resolve; });
  let settled = false;
  const pending = worker.fetch(request(), env).then(response => { settled = true; return response; });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  release({ messageId: 'test-only' });
  assert.equal((await pending).status, 200);
});

test('validate fields, service allowlist, email headers, and maximum lengths before sending', async () => {
  const cases = [
    { ...valid, name: ' ' }, { ...valid, email: 'not-an-email' },
    { ...valid, email: 'visitor@example.com\r\nBcc: attacker@example.com' },
    { ...valid, name: 'Visitor\nBcc: attacker@example.com' },
    { ...valid, message: 'x'.repeat(2501) }, { ...valid, service: 'toString' },
    { ...valid, service: '__proto__' }, { ...valid, message: '\u0000' },
    { ...valid, email: { value: 'visitor@example.com' } }, [], null
  ];
  for (const data of cases) {
    const { env, sent } = setup();
    assert.equal((await worker.fetch(request(data), env)).status, 400);
    assert.equal(sent.length, 0);
  }
});

test('honeypot submissions do not send mail', async () => {
  const { env, sent } = setup();
  const response = await worker.fetch(request({ ...valid, website: 'spam.example' }), env);
  assert.equal(response.status, 200);
  assert.equal(sent.length, 0);
});

test('reject cross-site and non-JSON form requests', async () => {
  const { env, sent } = setup();
  assert.equal((await worker.fetch(request(valid, { headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' } }), env)).status, 403);
  assert.equal((await worker.fetch(request(valid, { headers: { 'Content-Type': 'text/plain' } }), env)).status, 415);
  assert.equal(sent.length, 0);
});

test('reject oversized and malformed bodies even without a Content-Length', async () => {
  const { env, sent } = setup();
  const headers = { 'Content-Type': 'application/json' };
  const large = new Request('https://grandeurolympiaglobal.com/api/contact', { method: 'POST', headers, body: JSON.stringify({ message: 'x'.repeat(17000) }) });
  assert.equal((await worker.fetch(large, env)).status, 413);
  const malformed = new Request('https://grandeurolympiaglobal.com/api/contact', { method: 'POST', headers, body: '{bad json' });
  assert.equal((await worker.fetch(malformed, env)).status, 400);
  assert.equal(sent.length, 0);
});

test('throttle repeated submissions without sending an email', async () => {
  const { env, sent } = setup();
  env.CONTACT_RATE_LIMITER.limit = async () => ({ success: false });
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(sent.length, 0);
});

test('missing setup returns a clear failure rather than a false success', async () => {
  const { env, sent } = setup();
  delete env.CONTACT_EMAIL;
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
  assert.equal(sent.length, 0);
});

test('email-service failures return an error without leaking provider details', async () => {
  const { env } = setup();
  env.CONTACT_EMAIL.send = async () => { throw Object.assign(new Error('provider-private-detail'), { code: 'E_SENDER_NOT_VERIFIED' }); };
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 502);
  const result = await response.json();
  assert.equal(result.ok, false);
  assert.doesNotMatch(result.error, /provider-private-detail|E_SENDER_NOT_VERIFIED/);
});

test('existing website routes still use the static assets binding', async () => {
  const { env } = setup();
  assert.equal(await (await worker.fetch(new Request('https://grandeurolympiaglobal.com/contact'), env)).text(), 'existing website');
  assert.equal((await worker.fetch(new Request('https://grandeurolympiaglobal.com/api/contact'), env)).status, 405);
  assert.equal((await worker.fetch(new Request('https://grandeurolympiaglobal.com/api/unknown'), env)).status, 404);
});
