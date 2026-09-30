import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

let authResult;
let calls = 0;
globalThis.securityTestClient = () => ({ auth: { signInWithPassword: async () => { calls++; return authResult; } } });
process.env.MYGYMTRACKER_SUPABASE_URL = 'https://example.supabase.co';
process.env.MYGYMTRACKER_SUPABASE_ANON_KEY = 'test-public-key';
const source = readFileSync(new URL('../api/mcp-login.ts', import.meta.url), 'utf8')
  .replace("import { createClient } from '@supabase/supabase-js';", 'const createClient = globalThis.securityTestClient;');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const request = body => new Request('https://example.com/api/mcp-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('invalid credentials payloads never reach authentication', async () => {
  calls = 0;
  for (const body of [null, {}, { email: 'a'.repeat(255), password: 'password' }, { email: 'test@example.com', password: '' }, { email: 'test@example.com', password: 'a'.repeat(4097) }]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal(calls, 0);
});

test('authentication failures do not disclose the upstream account error', async () => {
  authResult = { data: {}, error: { status: 400, message: 'private account state' } };
  const response = await POST(request({ email: 'test@example.com', password: 'password' }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.ok(!(await response.text()).includes('private account state'));
});

test('Supabase rate limiting is preserved', async () => {
  authResult = { data: {}, error: { status: 429 } };
  assert.equal((await POST(request({ email: 'test@example.com', password: 'password' }))).status, 429);
});

test('successful token responses cannot be cached and do not expose refresh tokens', async () => {
  authResult = { error: null, data: { session: { access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_in: 3600 }, user: { id: 'test-user', email: 'test@example.com' } } };
  const response = await POST(request({ email: 'test@example.com', password: 'password' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.equal(body.access_token, 'test-access-token');
  assert.equal(body.refresh_token, undefined);
});
