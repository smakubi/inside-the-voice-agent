import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

// Use the deployment API: the CLI also requests account/team metadata that a
// project-scoped token cannot access (vercel/vercel#17506).
export function deploymentFiles(paths, read = readFileSync) {
  const files = paths
    .filter(path => !path.startsWith('.github/') && !path.startsWith('.vercel/'))
    .filter(path => !path.split('/').some(part => part === '.env' || part.startsWith('.env.')))
    .map(file => ({ file, data: read(file).toString('base64'), encoding: 'base64' }));
  if (Buffer.byteLength(JSON.stringify(files)) > 4 * 1024 * 1024) {
    throw new Error('Source exceeds the inline upload limit; use Vercel file uploads.');
  }
  return files;
}

export async function deploy(config, {
  fetchImpl = fetch, sleep = setTimeout, log = console.log, maxPolls = 120,
} = {}) {
  for (const key of ['token', 'teamId', 'projectId', 'hostname', 'repository', 'sha']) {
    if (!config[key]) throw new Error(`Missing ${key}`);
  }
  if (!config.files?.length) throw new Error('No source files to deploy');

  async function request(path, body) {
    const url = new URL(path, 'https://api.vercel.com');
    url.searchParams.set('teamId', config.teamId);
    const response = await fetchImpl(url, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Vercel API returned HTTP ${response.status} for ${path}`);
    return response.json();
  }

  const [owner, repository] = config.repository.split('/');
  let deployment = await request('/v13/deployments', {
    name: 'voice-ai', project: config.projectId, target: 'production',
    files: config.files,
    meta: {
      githubOrg: owner, githubRepo: repository,
      githubCommitRef: 'main', githubCommitSha: config.sha,
    },
  });
  const id = deployment.id ?? deployment.uid;
  if (!id) throw new Error('Vercel did not return a deployment ID');
  log(`Deployment ${id} created for ${config.sha}`);
  for (let attempt = 0; attempt < maxPolls; attempt++) {
    const state = deployment.readyState ?? deployment.state;
    if (state === 'ERROR' || state === 'CANCELED' || deployment.aliasError) {
      throw new Error(`Deployment ${id} failed (${state ?? 'alias error'})`);
    }
    if (state === 'READY' && deployment.aliasAssigned && deployment.alias?.includes(config.hostname)) {
      log(`Production READY: https://${config.hostname}`);
      return deployment;
    }
    log(`Deployment ${state ?? 'QUEUED'}; waiting for production alias`);
    await sleep(5000);
    deployment = await request(`/v13/deployments/${encodeURIComponent(id)}`);
  }
  throw new Error(`Deployment ${id} timed out; inspect it in Vercel before retrying`);
}

async function main() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  if (git('status', '--porcelain')) throw new Error('Deploy from a clean checkout');
  const sha = git('rev-parse', 'HEAD');
  if (process.env.GITHUB_SHA !== sha || process.env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Production deploy must run for the checked-out main commit');
  }
  await deploy({
    token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_ORG_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
    hostname: 'voice-ai-topaz.vercel.app',
    repository: process.env.GITHUB_REPOSITORY, sha,
    files: deploymentFiles(git('ls-files', '-z').split('\0').filter(Boolean)),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const message = String(error.message).split(process.env.VERCEL_TOKEN || '\0').join('[REDACTED]');
    console.error(message);
    process.exitCode = 1;
  });
}
