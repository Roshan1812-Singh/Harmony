/**
 * Resolves the API base URL from the environment, tolerating common misconfigs.
 *
 * Deployments serve the API under the `/api/v1` global prefix. Operators often
 * set `NEXT_PUBLIC_API_URL` to just the origin (e.g. `https://x.onrender.com`)
 * or leave a trailing slash. We normalise both so login/register never 404 due
 * to a missing prefix.
 */
function resolveApiUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? '').trim();
  let base = raw || 'http://localhost:4001/api/v1';
  base = base.replace(/\/+$/, '');
  if (!/\/api\/v\d+$/.test(base)) {
    base = `${base}/api/v1`;
  }
  return base;
}

export const API_URL = resolveApiUrl();
