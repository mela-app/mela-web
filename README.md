# Mela web player

What a share link opens in a browser. The API (mela-backend) serves the page
itself, `https://<api domain>/live/<id>`, and while the live is on, that page
loads this player from `/web/player.js`, `/web/player.css` and
`/web/assets/*`: the live's video, the host, the viewer count, chat, and the
paused/away/ended states. Phones are offered the app; computers can sign in
and chat, like and follow. React + Vite + TypeScript; the Agora and LiveKit
web SDKs load only for the live's own provider.

| Repository | What it is |
| --- | --- |
| mela-backend | The API, which serves the share page, and the dev and production stacks |
| mela-mobile | The Flutter app |
| **mela-web** (this one) | The web player |
| mela-admin-web | The staff admin console, plus the project docs (`docs/`) and the brand source (`branding/`) |

The design is in mela-admin-web: `docs/features/share.md`.

## Settings (.env)

Every address the player uses in development comes from `.env` - the code
has none built in, and the dev server refuses to start while one is
missing. `.env` is gitignored; `.env.example` is the template, with the
values for this machine:

```
cp .env.example .env        # Windows: copy .env.example .env
```

| Variable | Used by | What it is |
| --- | --- | --- |
| `WEB_API_ORIGIN` | `npm run dev`, `npm run preview` | The API that `/v1` and `/socket.io` are proxied to (mela-backend, `http://localhost:3000` locally) |
| `VITE_APP_URL_SCHEME` | the development page | The app's link scheme - the backend's `APP_URL_SCHEME` |
| `VITE_ANDROID_APP_PACKAGE_NAME` | the development page | The Android app's package - the backend's `ANDROID_APP_PACKAGE_NAME` |

Production builds need none of these: on a real share page the backend
embeds the app's settings, and the player refuses to run if any is
missing. `npm run build` and `npm test` work without a `.env` (CI has none).

## Run it locally

With the API running (mela-backend's README) and `.env` in place:

```
npm ci
npm run dev
```

Then open `http://localhost:5174/web/?stream=<live id>`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5174 |
| `npm run build` | Type-checks (`tsc -b`) and builds `dist/player.js`, `dist/player.css` and hashed `dist/assets/*` |
| `npm run lint` | oxlint |
| `npm test` | Vitest |

The page loads the two fixed file names, so they must stay `player.js` and
`player.css`; everything else is content-hashed.

## Deploying

The `Dockerfile` builds the production image: `dist/` behind unprivileged
nginx under `/web/`, the fixed names revalidated on every load and the
hashed assets cached for a year. On the server it runs in
`/usr/src/apps/mela/web`, next to the API, behind
`https://<api domain>/web/*` (mela-admin-web's `docs/deployment.md`).

To run that same image here, with `CONTAINER_NAME`, `PORT_OUT` and
`PORT_IN` set in `.env` (the compose file joins the external
`system-net` network, so create it first with
`docker network create system-net`):

```
docker compose up -d
```

Then open `http://localhost:<PORT_OUT>/web/?stream=<live id>`.

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) lints, tests and
builds every pull request. CD ([.github/workflows/cd.yml](.github/workflows/cd.yml))
builds `ghcr.io/<owner>/mela-web` on `main`, then, over SSH, restarts just
the player. Its secrets (repository or organization): `SERVER_HOST`,
`SERVER_USER`, `SERVER_PASSWORD`, `DEPLOY_PATH`.
