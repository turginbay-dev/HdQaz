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
