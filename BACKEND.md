# HdQaz Backend

This project uses Next.js App Router route handlers as the backend layer. Public reads work from seed data when Supabase admin credentials are missing. Writes require Supabase and admin/auth configuration.

## Environment

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ADMIN_EMAILS=admin@example.com
BACKEND_ADMIN_TOKEN=

TMDB_ACCESS_TOKEN=
```

`ADMIN_EMAILS` is used for browser admin actions with Supabase Auth cookies. `BACKEND_ADMIN_TOKEN` is for server-to-server admin calls using `Authorization: Bearer <token>` or `x-admin-token`.

## Database

Run `supabase/schema.sql` in Supabase SQL editor. It creates:

- `profiles`
- `movies`
- `content_requests`
- `request_votes`
- `watchlist_items`
- `watch_progress`

RLS is enabled for user-owned data. The Next.js backend uses `SUPABASE_SERVICE_ROLE_KEY` for trusted writes and guarded admin operations.

## Endpoints

Public:

- `GET /api/health`
- `POST /api/auth/signup` with `{ "email": "user@example.com", "password": "strong-password" }`
- `GET /api/movies?catalog=&genre=&filter=&q=&limit=&offset=`
- `GET /api/movies/:slug`
- `GET /api/requests?q=&status=`
- `GET /api/tmdb/search?q=interstellar`

Authenticated user:

- `GET /api/me`
- `PATCH /api/me`
- `GET /api/watchlist`
- `POST /api/watchlist` with `{ "movieSlug": "interstellar" }`
- `DELETE /api/watchlist/:movieSlug`
- `GET /api/watch-progress?movieSlug=`
- `POST /api/watch-progress` with `{ "movieSlug": "...", "positionSeconds": 120, "durationSeconds": 7200 }`
- `POST /api/requests`
- `POST /api/requests/:id/vote`
- `DELETE /api/requests/:id/vote`

Admin:

- `GET /api/admin/stats`
- `GET /api/movies?includeDrafts=true`
- `POST /api/movies`
- `PATCH /api/movies/:slug`
- `DELETE /api/movies/:slug`

## Signup Security

`POST /api/auth/signup` is the only email/password signup path. Browser code posts email and password to the Next.js route, and the route calls `supabase.auth.signUp()` server-side with `emailRedirectTo` set to `/auth/callback`.

The route rate limits signup attempts by IP before parsing JSON or calling Supabase Auth:

- 3 signup requests per minute per IP.
- Uses `cf-connecting-ip` first, then the first value in `x-forwarded-for`.
- Returns `429` with `Retry-After` when exceeded.
- Does not return Supabase access or refresh tokens.

This reduces SMTP abuse and signup spam because repeated attempts are rejected before Supabase sends confirmation emails. Keep Supabase email confirmation enabled, and consider adding CAPTCHA or bot protection for higher-risk deployments.

In Vercel, put environment variables in **Project Settings -> Environment Variables** and assign them to the needed environments:

- `NEXT_PUBLIC_SITE_URL`: canonical site URL, for example `https://your-domain.com`.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key. It is public, but signup still goes through the backend route.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service role key. Never expose this with a `NEXT_PUBLIC_` prefix.

The current limiter uses an in-memory `Map`. That is acceptable for local development, but not enough for production serverless because each function instance, cold start, region, or concurrent deployment can have separate memory. Limits can reset or diverge between invocations.

For production, replace the in-memory limiter with Upstash Redis:

1. Add `@upstash/redis` and `@upstash/ratelimit`.
2. Store `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as server-only Vercel environment variables.
3. Use a shared limiter such as `Ratelimit.slidingWindow(3, "1 m")`.
4. Key it by the same detected IP, for example `signup:${clientIp}`.

Movie payload:

```json
{
  "slug": "interstellar",
  "title": "Интерстеллар",
  "originalTitle": "Interstellar",
  "year": 2014,
  "runtime": "2 сағ 49 мин",
  "rating": "8.7",
  "description": "Қазақша сипаттама",
  "posterUrl": "https://image.tmdb.org/t/p/w500/...",
  "backdropUrl": "https://image.tmdb.org/t/p/original/...",
  "badges": ["Қазақша дыбыстама"],
  "genres": ["Фантастика", "Драма"],
  "catalogs": ["full-hd", "kazakh-dubbed"],
  "isPremium": false,
  "isNewRelease": false,
  "streams": {
    "master": "/demo/interstellar/master.m3u8"
  },
  "quality": "1080p",
  "published": true
}
```
