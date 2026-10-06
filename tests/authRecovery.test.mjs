import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

async function loadModule(path, transform = source => source) {
  const source = transform(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

let response = { error: null };
const requests = [];
let authListener;
globalThis.authRecoveryTestClient = { auth: {
  resetPasswordForEmail: async (...args) => { requests.push(args); return response; },
  updateUser: async payload => { requests.push(payload); return response; },
  signUp: async payload => { requests.push(payload); return { data: { user: { id: 'test-user' }, session: null }, error: null }; },
  onAuthStateChange: callback => { authListener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
} };
globalThis.window = { location: { hostname: 'localhost', origin: 'http://localhost:5173' } };
const auth = await loadModule('../src/authService.ts', source => source
  .replace("import { supabase } from './supabaseClient';", 'const supabase = globalThis.authRecoveryTestClient;')
  .replace('import.meta.env.VITE_APP_URL', 'undefined'));
const recovery = await loadModule('../src/authRecovery.ts');

test('la récupération depuis localhost redirige vers la production avec le marqueur recovery', async () => {
  requests.length = 0;
  response = { error: null };
  window.location = { hostname: 'localhost', origin: 'http://localhost:5173' };
  assert.equal((await auth.requestPasswordReset(' alice@example.test ')).success, true);
  assert.deepEqual(requests[0], ['alice@example.test', { redirectTo: 'https://www.my-gym-tracker.app/?auth=recovery' }]);
});

test('une inscription locale utilise le domaine officiel pour la confirmation', async () => {
  requests.length = 0;
  window.location = { hostname: '127.0.0.1', origin: 'http://127.0.0.1:5173' };
  await auth.signUp('alice@example.test', 'sample password');
  assert.equal(requests[0].options.emailRedirectTo, 'https://www.my-gym-tracker.app');
});

test('la configuration VITE_APP_URL reste prioritaire depuis localhost', async () => {
  const configuredAuth = await loadModule('../src/authService.ts', source => source
    .replace("import { supabase } from './supabaseClient';", 'const supabase = globalThis.authRecoveryTestClient;')
    .replace('import.meta.env.VITE_APP_URL', "'https://configured.example.test'"));
  requests.length = 0;
  window.location = { hostname: 'localhost', origin: 'http://localhost:5173' };
  await configuredAuth.requestPasswordReset('alice@example.test');
  assert.equal(requests[0][1].redirectTo, 'https://configured.example.test/?auth=recovery');
});

test('un domaine de production conserve son origine dans le lien', async () => {
  requests.length = 0;
  window.location = { hostname: 'app.example.test', origin: 'https://app.example.test' };
  await auth.requestPasswordReset('alice@example.test');
  assert.equal(requests[0][1].redirectTo, 'https://app.example.test/?auth=recovery');
});

test('les erreurs de récupération ne révèlent pas les détails du compte', async () => {
  response = { error: new Error('Private account information') };
  const result = await auth.requestPasswordReset('alice@example.test');
  assert.equal(result.success, false);
  assert.equal(result.error, 'Envoi impossible pour le moment. Réessaie plus tard.');
});

test('un mot de passe trop court ne déclenche aucune mise à jour', async () => {
  requests.length = 0;
  assert.equal((await auth.updatePassword('short')).success, false);
  assert.equal(requests.length, 0);
});

test('le mot de passe conserve ses espaces et un refus ne compte pas comme un succès', async () => {
  requests.length = 0;
  response = { error: null };
  assert.equal((await auth.updatePassword(' sample password ')).success, true);
  assert.deepEqual(requests[0], { password: ' sample password ' });
  response = { error: new Error('Expired token') };
  assert.equal((await auth.updatePassword('sample password')).success, false);
});

test('une inscription sans session attend la confirmation et PASSWORD_RECOVERY est transmis', async () => {
  assert.equal((await auth.signUp('alice@example.test', 'sample password')).session, null);
  let received;
  auth.onAuthStateChange((user, event) => { received = { user, event }; });
  authListener('PASSWORD_RECOVERY', { user: { id: 'test-user', email: 'alice@example.test' } });
  assert.equal(received.event, 'PASSWORD_RECOVERY');
  assert.equal(received.user.id, 'test-user');
});

test('les URLs de récupération et les liens expirés sont reconnus', () => {
  assert.equal(recovery.isRecoveryLocation('https://app.example.test/?auth=recovery'), true);
  assert.equal(recovery.isRecoveryLocation('https://app.example.test/#type=recovery&access_token=demo'), true);
  assert.equal(recovery.isRecoveryLocation('https://app.example.test/'), false);
  assert.equal(recovery.hasRecoveryErrorLocation('https://app.example.test/?auth=recovery#error_code=otp_expired'), true);
  assert.equal(recovery.hasRecoveryErrorLocation('https://app.example.test/?error=access_denied'), true);
  assert.equal(recovery.hasRecoveryErrorLocation('https://app.example.test/?auth=recovery'), false);
});

test('quitter la récupération enlève le marqueur et le fragment sans perdre les autres paramètres', () => {
  window.location.href = 'https://app.example.test/?auth=recovery&lang=fr#type=recovery';
  let nextUrl;
  window.history = { replaceState: (_state, _title, url) => { nextUrl = url; } };
  recovery.clearRecoveryLocation();
  assert.equal(nextUrl, '/?lang=fr');
});
