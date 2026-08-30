# CI/CD — Brewline

Eight workflows in `.eas/workflows/`. The interesting one is `pr-e2e.yml`; the rest exist
to make it safe.

| Workflow             | Trigger                        | What it does                                           | Cost                  |
| -------------------- | ------------------------------ | ------------------------------------------------------ | --------------------- |
| `pr-checks.yml`      | every PR push                  | typecheck ∥ lint ∥ jest ∥ workflow validation          | ~2 min                |
| `pr-e2e.yml`         | `e2e` label, or manual         | fingerprint → reuse-or-build → Maestro, both platforms | ~5 min warm, ~25 cold |
| `main.yml`           | merge to `main`                | jest → reuse-or-build → smoke → publish preview update | ~6 min                |
| `release.yml`        | tag `v*`                       | OTA **or** native build → smoke → approval → store     | ~30 min               |
| `rollout.yml`        | manual                         | ramp / roll back a production OTA                      | seconds               |
| `nightly.yml`        | 03:00 GMT                      | unconditional cold build + full E2E + audit            | ~40 min               |
| `store-events.yml`   | App Store Connect state change | announce; flag rejections                              | —                     |
| `branch-cleanup.yml` | branch deleted                 | delete the matching EAS Update branch                  | —                     |

---

## The idea: don't rebuild native for a JavaScript change

Most pull requests touch only JavaScript. Rebuilding the native app for those is twenty
minutes of nothing. So every lane except the release lane does this:

```
fingerprint            hash the native layer
   ↓
get-build              is there already a build with this hash?
   ├── match  → repack    swap in the new JS bundle. No Gradle, no Xcode.
   └── miss   → build     a real native build
   ↓
resolve                collapse the fork back to one build id
   ↓
maestro                run the E2E flows against whichever artifact appeared
```

Expo's published figures for this shape are 23 min → 5 min.

The whole thing rests on `runtimeVersion: { "policy": "fingerprint" }` in `app.json`. EAS
Update delivers by runtime version, not by fingerprint hash; without the fingerprint policy
those two disagree and an OTA can reach a binary whose native layer has drifted. **That app
config change is a prerequisite, not a detail.**

`type: fingerprint` also only works on CNG projects. If `android/` or `ios/` are ever
committed to this repo, the entire pipeline stops working.

---

## Two invariants

### 1. A matched build is a native shell, never a testable artifact

In this repo the `e2e` and `preview` profiles differ only in `EXPO_PUBLIC_*` env and their
channel — both of which live in the JS bundle, not the native layer. **They produce the same
fingerprint hash.**

So matching on the hash alone can hand the E2E lane a `preview` binary pointed at the real
API, and the suite would pass while testing entirely the wrong thing. Two defences, both
mandatory:

```yaml
params:
  fingerprint_hash: ${{ needs.fingerprint.outputs.android_fingerprint_hash }}
  profile: e2e # ← and these four, without which the hash is ambiguous
  channel: e2e
  distribution: internal
  simulator: true # iOS only
```

and then **always repack a match** rather than testing it directly, so the bundle and its
environment are re-baked for the target profile. Never wire a `maestro` job straight to a
`get-build` result.

### 2. Never repack on the store lane

`production` uses `appVersionSource: remote` with `autoIncrement`. Repack does not mint a new
build number, so a repacked artifact carries a duplicate `versionCode` / `CFBundleVersion`
that Play and App Store Connect reject outright — and repacking a distribution build
invalidates its signing.

Repack belongs to the PR and preview lanes. The store lane always builds fresh. This is a
deliberate boundary, not an omission.

---

## The join problem

One fork, two branches, and **exactly one of them is always skipped**. `needs:` requires
success, and a skipped job never succeeds, so the obvious `needs: [repack, build]` on the
Maestro job deadlocks by construction. `after:` is the only edge that survives a skipped
upstream.

Rather than scatter coalescing expressions across every downstream job, one tiny custom job
collapses the fork:

```yaml
resolve_android:
  after: [get_android, repack_android, build_android]
  outputs:
    build_id: ${{ steps.pick.outputs.build_id }}
  env:
    REPACKED_BUILD_ID: ${{ after.repack_android.outputs.build_id }}
    NATIVE_BUILD_ID: ${{ after.build_android.outputs.build_id }}
  steps:
    - id: pick
      run: |
        if [ -n "$REPACKED_BUILD_ID" ]; then set-output build_id "$REPACKED_BUILD_ID"
        elif [ -n "$NATIVE_BUILD_ID" ]; then set-output build_id "$NATIVE_BUILD_ID"
        else echo "No artifact produced." >&2; exit 1; fi

maestro_android:
  needs: [resolve_android] # ← an ordinary hard success gate
```

Three things this buys:

1. Everything downstream uses a normal `needs:` edge instead of inheriting the fork.
2. A fork that produced nothing **fails loudly here**, instead of dispatching Maestro with
   `build_id: ""`.
3. The coalesce happens in `run:` — phase two, on the worker — which is where EAS's
   two-phase interpolation says runtime logic belongs.

One honest caveat: Expo's own blog example declares `after:` and then reads `needs.*`. One of
those is a documentation slip and the docs don't settle which. Funnelling both platforms
through a single resolver job means that if `after.*` turns out to be empty on the first real
run, the fix is two lines in one place. The fallback design — duplicating the Maestro job,
one `needs: [repack]` and one `needs: [build]` — is fully deterministic but needs four
Maestro declarations for two platforms.

Related hardening: `repack` depends via `needs: [get_build]`, but the fallback native build
depends via **`after: [get_build]`**, so a hard `get-build` failure still produces a build
instead of stalling the graph.

---

## Where the human gate goes

`require-approval` sits **after the build and the release smoke run, before submission** —
and, on the OTA path, before the update is published at all.

- A human approving with no artifact and no test results is rubber-stamping. Before the
  build, their information set is "someone pushed a tag". After it, it is "here is a signed
  binary that passed the critical flows." Same human, strictly better decision.
- Put the gate at the **one-way door**. Being wrong before a build costs twenty build-minutes;
  being wrong after submission costs a store review cycle you cannot recall.
- **Internal TestFlight is deliberately not gated.** It is reversible with a small blast
  radius, and gating it destroys the "get it to QA fast" property. External beta and Play
  production are the steps that need a person.
- The least obvious placement, and the one most worth defending: **the production OTA path
  needs the gate more than the native path does.** It reaches 100% of users in minutes, has
  no store review acting as an accidental safety net, and it is the path with the _least_
  testing — the build was skipped precisely because nothing native changed, so the release
  smoke run was skipped too.

---

## Why `nightly.yml` exists

Two blind spots that no amount of YAML fixes:

**Stale shells.** `get-build` has no max-age parameter, so a three-week-old match — different
builder image, different Xcode/NDK — cannot be filtered out declaratively. An unconditional
cold build every night keeps the newest match under ~24 hours old. That is the closest thing
to a max-age the platform allows.

**Fingerprint blind spots.** The PR lane trades native-build coverage for cycle time: when
the fingerprint matches, Gradle and Xcode never run, so a break in native config resolution,
R8/ProGuard, or a transitive native dependency would go unnoticed. The nightly buys that
coverage back somewhere latency doesn't matter.

Stated as a trade rather than a win: _native-build coverage was traded for PR cycle time, and
bought back on a schedule._

---

## Known gaps

These are in the design on purpose, and are better said out loud than discovered.

- **A native release cannot be rolled back.** You can halt a Play staged rollout; you cannot
  recall an App Store binary. The pipeline's safety property is not "we can undo" — it is
  _every native release ships behind a staged rollout with an OTA kill switch attached_.
- **No cross-workflow state.** `rollout.yml` needs an `update_group_id` that `release.yml`
  cannot hand it, so it arrives by human copy-paste from the Slack announcement. A real
  organisation would persist it somewhere durable.
- **No job timeouts and no `continue_on_error`.** A wedged Maestro emulator has no ceiling.
  The only levers are `retries` and `retry_failed_only`, and both are used.
- **`type: maestro` is still alpha.** If it blocks a release, `maestro-cloud` runs the same
  flows.
- **Custom concurrency groups don't work.** `group:` is a documented forward-compatibility
  placeholder; only `cancel_in_progress` has any effect today.

## Things EAS Workflows does not have

Worth knowing before reaching for them: matrix strategy, reusable/callable workflows
(`workflow_call`), `continue_on_error`, job or step timeouts, a `${{ secrets.* }}` context
(secrets are EAS environment variables read through `${{ env.* }}`), and `cancelled()`.

There is also no `type: slack` — that one is worth singling out because it appears in
material that reads like documentation. Parallelism is sibling jobs with no `needs:`. Reuse is custom functions
(`.eas/functions/<name>/function.yml`) — which run as steps _inside one job_, so
`.eas/functions/setup` covers checkout/cache/install only. Folding typecheck, lint and Jest
in there would serialise three checks that currently run in parallel. Fast feedback beats DRY.

---

## How EAS finds these files

There is no "publish workflows" step, and nothing about them is stored on EAS. The files
live in this repo, and EAS learns they exist in exactly two ways:

1. **A GitHub event fires** — needs the repo on GitHub _and_ Expo's GitHub App connected to
   the project. This is the only way `pull_request`, `push` and `ref_delete` can ever
   trigger, because otherwise EAS never hears about your commits.
2. **`eas workflow:run <file>`** — packages the local project directory, uploads it, and runs
   it immediately. Works with no GitHub connection at all.

The dashboard's Workflows tab lists _runs_, not workflow definitions. On a fresh project with
neither of the above, it is empty — which looks like "EAS can't find my workflows" but is
just an empty run history.

```bash
eas workflow:run .eas/workflows/pr-checks.yml   # populate it in ~2 minutes
eas workflow:runs                                # list runs
eas workflow:logs <job-id>                       # per-step logs
```

---

## What the real validator changed

Every file here was written from the documentation and then validated against the live EAS
schema. Seven of the eight failed on the first run. The corrections are worth recording,
because each one contradicts something the docs imply:

| Assumption from the docs                            | What the schema actually says                                                                                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type: slack` is a job type                         | **It is not.** Slack is a _step_ — `eas/send_slack_message` inside a custom job.                                                                                                                                      |
| Custom function inputs take a `description`         | **Rejected.** Only `name`, `type`, `default_value`, `allowed_values`, `required`.                                                                                                                                     |
| `rollout_percentage` can come from a dispatch input | **It cannot.** Number-typed params are validated _before_ interpolation, so any `${{ }}` expression fails — with a `number` input and a `choice` input alike. Hence the one-job-per-literal fan-out in `rollout.yml`. |
| `workflow_dispatch:` may be empty                   | Must be an object: `workflow_dispatch: {}`.                                                                                                                                                                           |

The lesson is the same one that produced the invalid `on.pull_request.labels` key earlier:
**documentation is not a schema.** The offline validator in `scripts/` encodes what the real
validator taught, so those four mistakes cannot come back.

### One thing that is not a syntax error

`type: maestro` jobs validate, but then fail an entitlement check:

> Running maestro_test jobs requires a paid plan.

That gate applies to `pr-e2e.yml`, `main.yml`, `release.yml` and `nightly.yml`. The rest of
each of those files is schema-clean — verified by re-validating them with the Maestro jobs
stripped out. On a free account, comment those jobs out or move the flows to `maestro-cloud`.

This distinction matters in CI: the `Schema` step in `pr-checks.yml` treats "requires a paid
plan" as a pass and everything else as a failure. A billing state should not read as a broken
workflow — but a genuine schema error still fails the job.

---

## Validating changes

```bash
npm run validate:workflows      # offline: structure, references, size
```

`scripts/validate-workflows.mjs` catches dangling job references, invented job types and
params, invalid trigger keys, `env` on non-VM job types, and files over the 16 KiB limit. It
exists because an earlier version of these files shipped `on.pull_request.labels`, which does
not exist — YAML-valid, schema-invalid, and it would simply never have fired. It also catches
the dangling `needs.get_ios_update` in Expo's own published "Deploy to production" example.

The authoritative check needs a linked EAS project:

```bash
npx eas-cli init
npx eas-cli workflow:validate .eas/workflows/pr-e2e.yml
```

## Open questions for the first real run

Designed around rather than guessed at:

1. Is `after.x.outputs.*` or `needs.x.outputs.*` populated for a job declared under `after:`?
   (The resolver job is a two-line fix either way.)
2. Does `get-build` fail, or succeed with empty outputs, when **nothing** matches? The docs
   only cover matched-but-failed.
3. Does an expression referencing a **skipped** job's output interpolate to empty, or error at
   dispatch? This decides resolver-job vs duplicated-Maestro.
4. Does `repack` increment the iOS build number and preserve the profile's channel? This
   decides whether invariant 2 is a hard constraint or a stylistic one.
