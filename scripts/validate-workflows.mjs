/**
 * Offline validator for .eas/workflows/*.yml.
 *
 * `eas workflow:validate` is the real check, but it needs a linked EAS project.
 * Until then this catches the two classes of mistake that have already bitten
 * this repo once: a job reference that points at nothing (the bug in Expo's own
 * published "Deploy to production" example), and an invented job type or
 * parameter key.
 *
 * The inventory below is transcribed from docs.expo.dev — if EAS adds a job
 * type, add it here too rather than loosening the check.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { load as parseYaml } from 'js-yaml';

const DIR = '.eas/workflows';
const MAX_BYTES = 16 * 1024;

const JOB_TYPES = new Set([
  'build',
  'deploy',
  'fingerprint',
  'get-build',
  'submit',
  'testflight',
  'update',
  'update-rollout',
  'branch-delete',
  'maestro',
  'maestro-cloud',
  'slack',
  'github-comment',
  'apple-device-registration-request',
  'require-approval',
  'doc',
  'repack',
]);

const PARAMS = {
  build: ['platform', 'profile', 'message', 'refresh_ad_hoc_provisioning_profile'],
  'get-build': [
    'platform',
    'profile',
    'distribution',
    'channel',
    'app_identifier',
    'app_build_version',
    'app_version',
    'git_commit_hash',
    'fingerprint_hash',
    'sdk_version',
    'runtime_version',
    'simulator',
    'wait_for_in_progress',
  ],
  repack: [
    'build_id',
    'profile',
    'embed_bundle_assets',
    'js_bundle_only',
    'ios_signing_use_source_app_entitlements',
    'ios_signing_app_entitlements_path',
    'message',
    'repack_version',
    'repack_package',
  ],
  submit: ['build_id', 'profile', 'groups'],
  testflight: [
    'build_id',
    'profile',
    'wait_processing_timeout_seconds',
    'asc_build_id',
    'internal_groups',
    'external_groups',
    'changelog',
    'submit_beta_review',
  ],
  update: [
    'message',
    'platform',
    'branch',
    'channel',
    'rollout_percentage',
    'private_key_path',
    'upload_sentry_sourcemaps',
  ],
  'update-rollout': ['update_group_id', 'rollout_percentage'],
  'branch-delete': ['branch_name', 'fail_on_missing'],
  maestro: [
    'build_id',
    'flow_path',
    'shards',
    'retries',
    'retry_failed_only',
    'record_screen',
    'include_tags',
    'exclude_tags',
    'maestro_version',
    'android_system_image_package',
    'device_identifier',
    'output_format',
    'skip_build_check',
  ],
  'github-comment': ['message', 'build_ids', 'update_group_ids', 'deployment_ids', 'payload'],
  doc: ['md'],
  fingerprint: [],
  'require-approval': [],
};

// Job types that do not run in a VM cannot carry `env`.
// Params typed as numbers are validated BEFORE interpolation, so an expression
// can never satisfy them. Confirmed for update-rollout.rollout_percentage.
const LITERAL_NUMBER_PARAMS = { 'update-rollout': ['rollout_percentage'] };

const NO_ENV = new Set([
  'apple-device-registration-request',
  'branch-delete',
  'doc',
  'get-build',
  'github-comment',
  'require-approval',
  'slack',
  'update-rollout',
]);

// Trigger sub-keys matter as much as the trigger names: the original version of
// these files used `on.pull_request.labels`, which does not exist (labels are
// their own trigger). YAML-valid, schema-invalid, and silently never fires.
const TRIGGERS = {
  push: ['branches', 'tags', 'paths'],
  ref_delete: ['branches', 'tags'],
  pull_request: ['branches', 'types', 'paths'],
  pull_request_labeled: ['labels'],
  app_store_connect: ['app_version', 'build_upload', 'external_beta', 'beta_feedback'],
  schedule: null, // a list, not a map
  workflow_dispatch: ['inputs'],
};

const PR_TYPES = new Set([
  'opened',
  'edited',
  'base_ref_changed',
  'ready_for_review',
  'reopened',
  'synchronize',
  'labeled',
]);

const errors = [];
const note = (file, msg) => errors.push(`${file}: ${msg}`);

for (const file of readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f))) {
  const path = join(DIR, file);
  const raw = readFileSync(path);

  if (raw.byteLength > MAX_BYTES) {
    note(file, `exceeds the 16 KiB workflow file limit (${raw.byteLength} bytes)`);
  }

  let doc;
  try {
    doc = parseYaml(raw.toString());
  } catch (e) {
    note(file, `is not valid YAML: ${e.message}`);
    continue;
  }

  for (const [key, value] of Object.entries(doc.on ?? {})) {
    if (!(key in TRIGGERS)) {
      note(file, `unknown trigger "${key}"`);
      continue;
    }
    const allowed = TRIGGERS[key];
    if (!allowed || value == null || Array.isArray(value)) continue;
    for (const sub of Object.keys(value)) {
      if (!allowed.includes(sub)) {
        note(file, `trigger "${key}" has unknown key "${sub}" (allowed: ${allowed.join(', ')})`);
      }
    }
    if (key === 'pull_request') {
      for (const t of value.types ?? []) {
        if (!PR_TYPES.has(t)) note(file, `pull_request has unknown type "${t}"`);
      }
    }
  }

  const jobs = doc.jobs ?? {};
  const jobIds = new Set(Object.keys(jobs));

  for (const [id, job] of Object.entries(jobs)) {
    const type = job.type;

    if (type && !JOB_TYPES.has(type)) {
      note(file, `job "${id}" has unknown type "${type}"`);
    }
    if (type && PARAMS[type]) {
      for (const p of Object.keys(job.params ?? {})) {
        if (!PARAMS[type].includes(p)) {
          note(file, `job "${id}" (${type}) has unknown param "${p}"`);
        }
      }
    }
    if (type && NO_ENV.has(type) && job.env) {
      note(file, `job "${id}" (${type}) sets env, but this job type does not run in a VM`);
    }
    if (job.steps && type && type !== 'build') {
      note(file, `job "${id}" (${type}) declares steps; only custom and build jobs may`);
    }

    for (const p of LITERAL_NUMBER_PARAMS[type] ?? []) {
      const v = job.params?.[p];
      if (typeof v === 'string' && v.includes('${{')) {
        note(file, `job "${id}" sets ${p} from an expression; it must be a literal number`);
      }
    }

    for (const dep of [...(job.needs ?? []), ...(job.after ?? [])]) {
      if (!jobIds.has(dep)) note(file, `job "${id}" depends on missing job "${dep}"`);
    }

    // The class of bug in Expo's own published example: an expression naming a
    // job that does not exist. Also flags reading a context the job never
    // declared a dependency on, which silently resolves to nothing.
    const text = JSON.stringify(job);
    for (const [, ctx, ref] of text.matchAll(/\$\{\{\s*!?\s*(needs|after)\.([A-Za-z0-9_]+)\./g)) {
      if (!jobIds.has(ref)) {
        note(file, `job "${id}" references ${ctx}.${ref}, which is not a job in this file`);
      } else if (!(job[ctx] ?? []).includes(ref)) {
        note(file, `job "${id}" reads ${ctx}.${ref} but does not list it under \`${ctx}:\``);
      }
    }
  }
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`✓ ${readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)).length} workflow files OK`);
