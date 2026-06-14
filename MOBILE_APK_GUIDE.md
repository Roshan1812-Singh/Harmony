# Harmony → Android APK Guide

This turns the Harmony web app into an installable Android `.apk` using
**Capacitor** (a native WebView wrapper). Because the frontend is a
server-rendered Next.js app, the APK **loads your deployed site over the
network** — so you deploy the backend + frontend first, then build the APK that
points at them.

```
[ Android APK (Capacitor WebView) ]
            │  loads
            ▼
[ Next.js frontend  (Vercel, HTTPS) ]
            │  fetch() with cookies
            ▼
[ NestJS API  (Railway/Render, HTTPS) ] ── Postgres + Redis
```

What's already set up in this repo:

- `apps/web/android/` — the native Android Studio project (generated).
- `apps/web/capacitor.config.ts` — reads `HARMONY_MOBILE_URL` for the site URL.
- Cross-site auth cookies (`SameSite=None; Secure`) + configurable CORS — so
  login works when the app and API are on different domains.
- `Dockerfile` + `apps/api/scripts/deploy-start.sh` — to deploy the API.
- `.env.production.example` files for both apps.

---

## Phase 1 — Deploy the backend API

Recommended host: **Railway** (gives you Postgres + Redis + a Docker build in
one project). Render or Fly.io work too.

1. Push this repo to GitHub.
2. Create a Railway project → **Deploy from GitHub repo**. Railway detects the
   root `Dockerfile`.
3. Add plugins: **PostgreSQL** and **Redis**. Railway sets `DATABASE_URL` and
   `REDIS_URL` automatically (verify the names match).
4. Add the environment variables from `apps/api/.env.production.example`.
   The critical ones for mobile/login:
   - `WEB_ORIGIN` = your frontend URL (fill after Phase 2, then redeploy)
   - `CORS_ORIGINS` = same frontend URL
   - `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, `COOKIE_DOMAIN=` (empty)
5. Deploy. The boot script runs `prisma db push` + applies `prisma/sql/*.sql`
   (FTS, indexes, join tables) automatically.
6. Note the public API URL, e.g. `https://harmony-api.up.railway.app`.

### Move your catalog data to the cloud DB

Your locally-imported songs live in your local Postgres. Copy them up:

```powershell
# Dump local DB (run locally)
pg_dump "postgresql://harmony:harmony@localhost:5432/harmony" --no-owner --no-privileges -Fc -f harmony.dump

# Restore into the managed DB (use Railway's DATABASE_URL)
pg_restore --no-owner --no-privileges -d "<RAILWAY_DATABASE_URL>" harmony.dump
```

(Or re-run `pnpm --filter @harmony/api saavn:import` against the cloud
`DATABASE_URL` to re-import.)

---

## Phase 2 — Deploy the frontend (Vercel)

1. Vercel → **New Project** → import the repo.
2. Set **Root Directory** to `apps/web`.
3. Framework preset: **Next.js**. Vercel handles the monorepo build.
4. Add env var `NEXT_PUBLIC_API_URL = https://<your-api>/api/v1`
   (from `apps/web/.env.production.example`).
5. Deploy → note the URL, e.g. `https://harmony.vercel.app`.
6. Go back to the API host and set `WEB_ORIGIN` and `CORS_ORIGINS` to this
   Vercel URL, then redeploy the API.

Verify in a desktop browser that login/signup works on the Vercel URL before
building the APK.

---

## Phase 3 — Build the APK

Prereqs (you already have the Android SDK at
`%LOCALAPPDATA%\Android\Sdk`). Make sure these env vars are set (PowerShell,
permanent):

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx ANDROID_SDK_ROOT "$env:LOCALAPPDATA\Android\Sdk"
# Restart the terminal afterwards.
```

If Android Studio isn't installed yet, get it from
<https://developer.android.com/studio>, open it once, and let it install the
**Android SDK Platform** + **Build-Tools** (SDK Manager).

> **JDK note:** your system `java` is **22**, but the Android Gradle Plugin
> needs **JDK 17**. Android Studio ships its own bundled JDK (JBR) and uses it
> automatically, so **building via Android Studio just works**. Only if you
> build from the command line (Option B) do you need JDK 17 on `JAVA_HOME`
> (Android Studio bundles one at `…\Android Studio\jbr`).

### Point the app at your deployed site and sync

```powershell
cd apps/web
$env:HARMONY_MOBILE_URL = "https://harmony.vercel.app"   # your Vercel URL
pnpm cap:sync
```

### Option A — Build in Android Studio (recommended)

```powershell
pnpm cap:open    # opens apps/web/android in Android Studio
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
When done, click **locate** — the file is at:

```
apps/web/android/app/build/outputs/apk/debug/app-debug.apk
```

### Option B — Build from the command line

```powershell
cd apps/web
pnpm cap:apk
# → apps/web/android/app/build/outputs/apk/debug/app-debug.apk
```

### Install on your phone

- Email/transfer the `app-debug.apk` to your phone and tap to install
  (enable “Install unknown apps”), **or**
- Plug in via USB with developer mode on and run:
  `apps\web\android\gradlew.bat installDebug`

A **debug** APK is fine for personal use. For a shareable/release build you'd
generate a signed release APK (Build → Generate Signed Bundle/APK) — ask if you
want that set up.

---

## Updating the app later

- **Web/content changes**: just redeploy Vercel/Railway — the APK loads the
  latest site automatically (no rebuild needed).
- **App icon / name / native config**: edit, then `pnpm cap:sync` and rebuild.

## Quick LAN test (no deploy)

To sanity-check the wrapper before deploying, run the stack locally and point
the app at your PC's LAN IP (phone on same Wi-Fi):

```powershell
cd apps/web
$env:HARMONY_MOBILE_URL = "http://192.168.1.20:3000"   # your PC's IPv4
pnpm cap:sync; pnpm cap:open
```

For this to work you'd also set the API's `CORS_ORIGINS` to that LAN origin and
run the API/web bound to `0.0.0.0` (the API already binds to `0.0.0.0`).
Cleartext HTTP is auto-enabled for `http://` URLs in `capacitor.config.ts`.
Note: cross-site cookies over plain HTTP are unreliable, so prefer the deployed
HTTPS setup for real login.
