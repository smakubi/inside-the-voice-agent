import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentFiles, deploy } from '../.github/scripts/deploy-vercel.mjs';

test('uploads source files and excludes environment files and local deployment state', () => {
  const files = deploymentFiles(['app/page.tsx', 'public/icon.png', '.env', '.env.production', '.vercel/project.json', '.github/workflows/deploy-production.yml'], () => Buffer.from('source'));
  assert.deepEqual(files.map(({ file }) => file), ['app/page.tsx', 'public/icon.png']);
  assert.equal(Buffer.from(files[0].data, 'base64').toString(), 'source');
});

const config = {
  token: 'test-secret', teamId: 'team_test', projectId: 'prj_test',
  hostname: 'voice-ai-topaz.vercel.app', repository: 'smakubi/inside-the-voice-agent',
  sha: 'abc123', files: [{ file: 'package.json', data: 'e30=', encoding: 'base64' }],
};

test('uses project deployment endpoints and waits for the production alias', async () => {
  const calls = [];
  const states = [
    { id: 'dpl_test', url: 'voice-test.vercel.app', readyState: 'BUILDING' },
    { id: 'dpl_test', readyState: 'READY', alias: [] },
    { id: 'dpl_test', readyState: 'READY', alias: [config.hostname], aliasAssigned: false },
    { id: 'dpl_test', url: 'voice-test.vercel.app', readyState: 'READY', alias: [config.hostname], aliasAssigned: true },
  ];
  const result = await deploy(config, {
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return Response.json(states.shift());
    }, sleep: async () => {}, log: () => {},
  });
  assert.equal(calls.length, 4);
  assert.ok(calls.every(({ url }) => url.startsWith('https://api.vercel.com/v13/deployments')));
  assert.ok(calls.every(({ url }) => url.includes('teamId=team_test')));
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-secret');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.project, 'prj_test');
  assert.equal(body.target, 'production');
  assert.equal(body.meta.githubCommitSha, 'abc123');
  assert.equal(result.alias[0], config.hostname);
});

test('stops on a failed build without reporting success', async () => {
  await assert.rejects(deploy(config, {
    fetchImpl: async () => Response.json({ id: 'dpl_test', readyState: 'ERROR' }),
    log: () => {},
  }), /ERROR/);
});

test('does not print API response bodies or the token on HTTP failure', async () => {
  await assert.rejects(deploy(config, {
    fetchImpl: async () => new Response('test-secret should never appear', { status: 403 }),
    log: () => {},
  }), error => error.message.includes('403') && !error.message.includes('test-secret'));
});

test('fails when deployment does not become ready within the poll limit', async () => {
  await assert.rejects(deploy(config, {
    fetchImpl: async () => Response.json({ id: 'dpl_test', readyState: 'BUILDING' }),
    sleep: async () => {}, log: () => {}, maxPolls: 2,
  }), /timed out/i);
});

test('rejects missing credentials before making a request', async () => {
  await assert.rejects(deploy({ ...config, token: '' }, {
    fetchImpl: async () => { throw new Error('must not request'); },
  }), /Missing token/);
});
