# HdQaz Frontend Architecture

Frontend бірінші кезеңде Next.js App Router негізінде құрылады. Қазіргі scaffold mock data-мен жұмыс істейді, бірақ әр қабат кейін Supabase/API-ға оңай ауысатындай бөлінді.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- HLS.js
- lucide-react

## Routes

```txt
src/app/
  page.tsx                 # Басты бет: banner, каталогтар, Spotlight
  login/page.tsx           # Google-only login
  profile/page.tsx         # User profile and logout
  auth/callback/route.ts   # Supabase OAuth callback
  admin/page.tsx           # Уақытша ашық admin panel
  catalog/page.tsx         # Кино каталогы
  movie/[slug]/page.tsx    # Кино detail page
  watch/[slug]/page.tsx    # HLS player page
  requests/page.tsx        # Кино сұраныстары
  premium/page.tsx         # Premium тарифтері
```

## Components

```txt
src/components/
  layout/
    desktop-nav.tsx        # Notebook/Desktop floating glass navbar
    mobile-nav.tsx         # Mobile side drawer
    site-shell.tsx         # Global shell

  home/
    hero-banner.tsx        # Басты banner
    category-rail.tsx      # Горизонталь категория chips
    continue-watching.tsx  # Жалғастырып көру
    ai-recommendations.tsx # AI recommendation rail
    top-ten-row.tsx        # Weekly Top 10
    section-frame.tsx      # Section wrapper

  movie/
    movie-card.tsx         # Poster card + genre/catalog metadata
    movie-row.tsx          # Горизонталь каталог/жанр row
    movie-badge.tsx        # Қазақша дыбыстама/субтитр badges

  spotlight/
    spotlight-picker.tsx   # Постерлер айналып random кино таңдау

  motion/
    reveal.tsx             # Reveal-on-scroll animation primitive

  player/
    hls-player.tsx         # HLS.js video player shell

  glass/
    glass-panel.tsx        # Reusable glassmorphism panel

  auth/
    google-sign-in-button.tsx

  admin/
    manual-movie-admin.tsx # Қолмен кино қосу, жанр және каталог таңдау
```

## Data Layer

```txt
src/features/movies/
  data.ts                  # Mock movie data
  queries.ts               # UI қолданатын query functions

src/lib/
  movie-taxonomy.ts        # Ортақ жанрлар және каталогтар
  tmdb.ts                  # TMDB API adapter, env: TMDB_ACCESS_TOKEN
  supabase/
    config.ts              # Supabase env helpers
    client.ts              # Browser client
    server.ts              # Server client
    middleware.ts          # Session refresh middleware
```

Кейін Supabase қосылғанда UI компоненттерін өзгертпей, тек `queries.ts` ішін API/Supabase query-ға ауыстырамыз.

## Taxonomy

Кино дерегінде екі бөлек бөліну бар:

- `genres`: нақты жанрлар, мысалы `Фантастика`, `Драма`, `Анимация`.
- `catalogs`: өнімдік каталогтар, мысалы `Premium`, `1080p`, `Қазақша дыбыстама`, `Қазақша субтитр`, `Жаңа релиздер`, `Top 10`, `AI ұсыныстар`.

Барлық UI бірдей source of truth қолданады: `src/lib/movie-taxonomy.ts`.

## Design Rules

- Brand name: тек `HdQaz`.
- Auth: Google OAuth only. Telegram login қолданылмайды.
- Негізгі стиль: dark cinematic + glassmorphism.
- Desktop: navbar жоғарыда floating glass.
- Mobile: қысқа header + оң жақтан ашылатын glass drawer.
- Басты бет: banner + каталог chips + Spotlight + movie rows.
- Каталог беті: каталог және жанр chips арқылы фильтрленеді.
- Admin panel: кино қосқанда бірнеше жанр және бірнеше каталог таңдалады.
- Premium homepage flow: hero + category rail + continue watching + Spotlight + AI recommendations + trending + Top 10.
- Контент badges:
  - `Қазақша дыбыстама`
  - `Қазақша субтитрмен`
  - `AI қазақша субтитр`
  - `Дыбыстама күтілуде`

## Next Frontend Steps

1. Admin save action-ды Supabase movies table-ға қосу.
2. Search overlay.
3. Жанр/каталог бойынша URL state-ті search overlay-мен біріктіру.
4. Real HLS signed playback endpoint.
5. Watch progress UI.
6. Login/paywall modal.
