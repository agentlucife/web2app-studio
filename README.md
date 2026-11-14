# Web2App Studio

Turn a website into a real native Android/iOS app. The platform generates a genuine **Capacitor** project, pushes it to the customer's GitHub repository and compiles it with **GitHub Actions**. Artifacts are downloaded, verified and stored in private object storage; customers get short-lived download links.

This repository contains the complete Next.js application, database migrations and the generator templates used for every build. It does not contain prebuilt APK/IPA files and it does not fake build progress.

---

## Stack

| Layer | Technology |
| --- | --- |
| Web app | Next.js 16 (App Router, TypeScript, Turbopack), Tailwind CSS 4 |
| Auth & database | Supabase Auth (GitHub OAuth) + Postgres with Row Level Security |
| GitHub | REST API, Git Data API, Actions workflow dispatch |
| Mobile builds | Capacitor 8, Gradle/Android SDK, Xcode/macOS runners |
| Artifacts | Supabase Storage private buckets + signed URLs |
| Scheduling | Vercel Cron (`/api/cron/poll-builds`) + GitHub webhooks |
| Rate limiting | In-memory by default; optional Upstash Redis REST |

---

## What is implemented

- GitHub OAuth sign-in and optional encrypted personal access tokens
- Project CRUD, duplication, configuration history and source download
- Builder with real Capacitor settings: icon, splash, colours, permissions, deep links, offline page
- GitHub repository creation/linking and source sync
- Android `debug`, signed `release-apk` and signed `release-aab` builds
- iOS unsigned `.xcarchive` builds and signed `.ipa` builds when Apple signing secrets are configured
- Live build status, logs, cancellation, retry, artifacts and ownership checks
- Build artifact verification server-side (the callback alone never marks a build complete)
- Dashboard: overview, projects, builder, builds, downloads, GitHub, billing/usage, support, settings
- Admin dashboard: platform settings, users/roles/suspension/plans, support inbox, statistics
- Private upload and artifact buckets, signed URLs, upload validation and image normalisation
- Zod validation, same-origin/CSRF checks, rate limiting, SSRF protection (including DNS resolution checks)
- HMAC-verified GitHub webhooks and build-scoped expiring callback tokens

## Deliberate limitations

These are real constraints, not placeholders:

- **iOS signing requires Apple credentials.** Without them the pipeline produces an unsigned `.xcarchive` that cannot be installed on a device. The UI labels it clearly.
- **Android release builds require a keystore.** Without the repository secrets the workflow fails with an explicit error instead of producing an unsigned "release" file.
- **Billing is plan/metadata only.** There is no payment provider integration. Upgrades are requested through support and applied by an admin.
- **Push notifications** install the Capacitor plugin and permissions, but delivery requires your own Firebase project/APNs credentials and entitlements.
- **Universal Links** require an Apple team, Associated Domains capability and an `apple-app-site-association` file on your domain.
- **No pull-to-refresh plugin** is shipped. Adding an untested native plugin would risk every build.
- **Build execution happens on GitHub**, not on Vercel. This deployment must be publicly reachable for callbacks and webhooks.
- Migrations must be applied to your Supabase project; the app cannot create its own schema at runtime.

---

## 1. Prerequisites

- Node.js 20+ and npm
- A Supabase project
- A GitHub account (OAuth app and/or PAT)
- A Vercel account (or another Node host that supports long-running API routes and cron)
- Android signing keystore and/or Apple Developer credentials for signed mobile builds

---

## 2. Install

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` (see the comments in `.env.example`). The minimum runtime set is:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
GITHUB_WEBHOOK_SECRET
CRON_SECRET
NEXT_PUBLIC_APP_URL
```

`ENCRYPTION_KEY` must be **64 hex characters** (`openssl rand -hex 32`). Keep it stable: rotating it makes existing GitHub tokens unreadable until users reconnect.

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `CRON_SECRET` or webhook secrets to the browser.

---

## 3. Database migrations

Migrations live in `supabase/migrations/`:

| File | Purpose |
| --- | --- |
| `001_init.sql` | Complete schema for a fresh project, RLS policies, triggers, grants |
| `002_upgrade.sql` | Idempotent upgrade for the original skeleton (`build_jobs` → `builds`) |
| `003_storage.sql` | Private `uploads`/`artifacts` buckets and storage policies |

### Option A — migration runner

Copy the **session pooler** connection string from Supabase → Project Settings → Database, then:

```bash
SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres' npm run db:migrate
```

The runner records applied files in `schema_migrations` and wraps each file in a transaction.

### Option B — SQL editor

For a fresh project, run `001_init.sql` then `003_storage.sql`. For an existing installation created from the old skeleton, run `002_upgrade.sql` then `003_storage.sql`. Both paths are idempotent where possible.

After migrating, verify:

```bash
curl https://your-domain/api/health
```

The response reports `database: "ok"` only when the server can query `admin_settings`.

---

## 4. Supabase Auth and GitHub OAuth

1. In Supabase → Authentication → Providers → GitHub, enable the provider.
2. Create a GitHub OAuth app (GitHub → Settings → Developer settings → OAuth Apps).
   - **Homepage URL:** your app URL
   - **Authorization callback URL:** `https://<project-ref>.supabase.co/auth/v1/callback`
3. Put the OAuth client ID/secret into the Supabase provider settings (not necessarily into Vercel).
4. In Supabase → Authentication → URL Configuration:
   - **Site URL:** `https://your-domain`
   - **Redirect URLs:** `https://your-domain/auth/callback` (plus `http://localhost:3000/auth/callback` for development)
5. Sign in once. GitHub OAuth requests `read:user user:email repo workflow`; the app stores the provider token encrypted so it can push source and dispatch workflows.
6. Set `ADMIN_EMAILS` to your email (comma-separated) before the first admin sign-in, or promote the user later from the database/admin UI.

If GitHub OAuth is unavailable, users can sign in through OAuth once and connect a PAT in **Dashboard → GitHub**. PATs are validated against the GitHub API before being stored.

### Required GitHub token access

| Token type | Required access |
| --- | --- |
| Classic PAT | `repo`, `workflow`, `read:user` (`public_repo` for public-only use) |
| Fine-grained PAT | Repository access + Contents: read/write + Actions: read/write + Workflows: write + Metadata: read |

Generated repositories contain `.github/workflows/*.yml`, so the `workflow` scope (classic) or Workflows write permission (fine-grained) is mandatory. The app surfaces GitHub's error when this is missing.

---

## 5. Deploy to Vercel

1. Import the repository into Vercel.
2. Add every required environment variable for Production (and Preview if needed).
3. Set `NEXT_PUBLIC_APP_URL` to the final public URL. Callback and OAuth URLs depend on it.
4. Deploy. `vercel.json` registers the cron job:

```json
{ "path": "/api/cron/poll-builds", "schedule": "*/2 * * * *" }
```

5. Ensure `CRON_SECRET` is set. Vercel automatically sends it as a Bearer token; requests without it return `401`.
6. Make sure the deployment is reachable from GitHub Actions. Build callbacks (`/api/webhooks/build`) are sent by the generated workflows.

Vercel Hobby cron frequency/limits may differ; adjust the schedule if necessary. The app also syncs a build when its detail page is opened, so status is not dependent solely on cron.

---

## 6. GitHub webhooks (recommended)

The app can poll builds, but webhooks make status updates immediate:

1. Repository → Settings → Webhooks → Add webhook.
2. Payload URL: `https://your-domain/api/webhooks/github`
3. Content type: `application/json`
4. Secret: the same value as `GITHUB_WEBHOOK_SECRET`
5. Events: **Workflow runs** (and **Ping**).

The endpoint verifies `X-Hub-Signature-256` over the raw body, rejects unsigned requests, and only syncs builds whose repository matches the project. Invalid signatures are rejected; valid non-build events are acknowledged without side effects.

---

## 7. Mobile signing secrets

Each generated repository receives its own workflows. Add repository secrets in **Settings → Secrets and variables → Actions**.

### Android

| Secret | Description |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 of the keystore: `base64 -w 0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key password |

```bash
keytool -genkeypair -v -keystore release.keystore -alias release \
  -keyalg RSA -keysize 2048 -validity 10000
```

Debug APKs use the Android debug key and are for testing, not store distribution.

### iOS

| Secret | Description |
| --- | --- |
| `IOS_BUILD_CERTIFICATE_BASE64` | Base64 of a `.p12` distribution certificate |
| `IOS_BUILD_CERTIFICATE_PASSWORD` | `.p12` password |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64 of a `.mobileprovision` profile |
| `IOS_TEAM_ID` | Apple Developer Team ID |
| `IOS_EXPORT_METHOD` | `app-store`, `ad-hoc`, `development` or `enterprise` |

With those secrets, the app requests `ios-ipa`. Without them, it requests `ios-archive` and stores an unsigned `.xcarchive.zip`. That archive is for inspection and cannot be installed on a device. The build detail page states this explicitly.

---

## 8. Artifact storage and security

- `uploads` is private. Objects live under `<user-id>/...`; storage policies restrict browser access to the owner's folder.
- Icons are normalised to 1024×1024 PNG, splash images to 2732×2732 PNG, with MIME/size validation and a maximum upload size.
- `artifacts` is private and has **no browser policies**. The server checks build ownership, then creates a signed URL that expires after one hour.
- Build completion requires the server to download the GitHub artifact zip, extract the APK/AAB/IPA (or archive), upload it, hash it and insert the artifact row. A workflow callback by itself only moves a build to `uploading`.
- GitHub tokens are encrypted with AES-256-GCM. They are never returned by an API route or written to logs.
- Website URLs are checked against private/loopback/link-local/metadata ranges, including DNS resolution, to prevent SSRF.
- State-changing API routes require a same-origin request and authenticated session; sensitive routes are rate limited.
- RLS is enabled on all user tables. The service-role key is only used server-side with explicit ownership checks. Browser grants on `github_connections` are column-level so `encrypted_token` cannot be selected.

---

## 9. Local development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # node:test via tsx
npm run build       # production build
npm run db:migrate  # requires SUPABASE_DB_URL
```

The test suite covers configuration validation, SSRF blocking, AES-GCM encryption/tamper detection, HMAC webhook verification, build callback tokens and generator output.

### Local limitations

- GitHub Actions runs in the cloud; a local dev server must be publicly reachable for build callbacks. Use a tunnel or rely on cron/manual polling.
- Android SDK/Java and Xcode are not required to run the web app. They are required only inside GitHub Actions runners (provided by `ubuntu-latest` and `macos-latest`).
- No native APK/IPA is produced by `npm run build`; builds are executed by GitHub Actions.

---

## 10. Operational checklist

- [ ] Migrations applied and `/api/health` returns `database: "ok"`
- [ ] GitHub OAuth provider enabled with the Supabase callback URL and correct app redirect URLs
- [ ] `NEXT_PUBLIC_APP_URL` is the public HTTPS URL
- [ ] `ENCRYPTION_KEY`, `CRON_SECRET`, `GITHUB_WEBHOOK_SECRET` set to unique random values
- [ ] `ADMIN_EMAILS` set (or first admin promoted manually)
- [ ] Vercel cron enabled and `CRON_SECRET` configured
- [ ] Repository webhook configured with the same secret
- [ ] Android/iOS signing secrets added to repositories that need signed outputs
- [ ] Storage buckets `uploads` and `artifacts` exist and are private
- [ ] Test a debug Android build end-to-end before selling builds

## 11. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `database: "unavailable"` on `/api/health` | Migrations not applied, wrong Supabase URL/key, or service key missing |
| OAuth redirects to an error page | GitHub callback URL/Supabase redirect URLs do not match the deployment URL |
| Build fails with a workflow error | Token lacks `workflow` scope (classic) or Workflows write (fine-grained) |
| Release build fails immediately | Android keystore secrets missing or malformed |
| iOS produces `.xcarchive` only | Apple signing secrets are not configured; this is expected |
| Build stuck in `queued` | Workflow dispatch rejected, Actions disabled, or cron/webhook unavailable |
| Artifact download returns 403/404 | You do not own the artifact, the signed URL expired, or the artifact row was removed |

## License

No license file is included. Treat this code as private unless you add one.
