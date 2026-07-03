# 🎬 HdQaz - Қазақ Кино Платформасы

HdQaz — қазақ фильмдеріне арналған заманауи видео стриминг платформасы. Қазақша дыбыстама, субтитр, және AI-негіздегі ұсынылар бар сіңдіктілік тәжірибе ұсынамыз.

🌐 **Веб-сайты:** [https://hd-qaz.vercel.app](https://hd-qaz.vercel.app)

---

## ✨ Ерекшеліктері

- 🎥 **HLS жүргізуші** - Сапалы видео ойнату
- 🔐 **Google OAuth** - Қауіпсіз аутентификация
- 🌙 **Темный тематикасы** - Glassmorphism дизайн
- 📱 **Толық адаптивтік** - Desktop және мобильде жасалған
- 🤖 **AI ұсынулар** - Персоналды фильм ұсынулары
- ⭐ **Premium плана** - Қосымша ойындарға доступ
- 🎬 **Қазақша контент** - Дыбыстама, субтитр, AI субтитр
- 📝 **Контент сұрау** - Пайдаланушылар сұра аларады

---

## 🛠️ Технология Құрылымы

### Frontend
- **Next.js** 15.5 (App Router + TypeScript)
- **React** 19.2
- **Tailwind CSS** 4.3 - Дизайн стилі
- **Framer Motion** 12.38 - Анимациялар
- **HLS.js** 1.6 - Видео ойнату
- **lucide-react** - Иконкалар

### Backend
- **Next.js API Routes** - REST API
- **Supabase** - БД және аутентификация
- **TMDB API** - Фильм мақұлаты

### Орналастыру
- **Vercel** - Frontend хостинг
- **Supabase** - БД хостинг

---

## 📋 Негізгі Функциялар

| Функция | Сипаттамасы |
|---------|----------|
| **Каталог** | Жанр және каталогтар бойынша қайта іздеу |
| **Fильм деталі** | Толық мақұлат және рейтинг |
| **Ойнату** | HLS плеері сақтық прогресс арқылы |
| **Профиль** | Сәндік ме тіс тіс |
| **Қазысты көру** | Аяқталмаған фильмдерді жалғастырыңыз |
| **Top 10** | Апталық өнімді фильмдер |
| **Сұрау системасы** | Өндіктеу ұсынулар |

---

## 🚀 Баста Жүгіну

### Талапты Орманты

- **Node.js** 18+
- **npm** немесе **yarn**
- **Supabase** аккаунты
- **TMDB API** кілті (опциялық)

### Орнату

```bash
# Репозиторийді құ
git clone https://github.com/turginbay-dev/HdQaz.git
cd HdQaz

# Ағымдарды орнату
npm install

# `.env.example` файлын `.env.local` пен көшіру
cp .env.example .env.local

# Қоршеген айнымалыларын толтыру
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# TMDB_ACCESS_TOKEN (опциялық)
```

### Жергілік Құрылып Жүгіну

```bash
# Құрылыптау сервері

npm run dev
```

Браузерде ашыңыз: `http://localhost:3000`

### Құрылыптау және Орналастыру

```bash
# Құрылыптау
npm run build

# Құрылыптау өнімінің сервері
npm start
```

---

## 📁 Қайнар Құрылымы

```
src/
├── app/                    # Next.js App Router беттері
│   ├── page.tsx           # Басты бет
│   ├── login/             # Логин беті
│   ├── profile/           # Профиль беті
│   ├── catalog/           # Каталог беті
│   ├── movie/[slug]/      # Фільм деталі
│   ├── watch/[slug]/      # Плеер бет
│   ├── admin/             # Админ панель
│   ├── premium/           # Premium плана
│   ├── requests/          # Сұрау система
│   └── api/               # REST API маршруттары
│
├── components/            # React компоненттер
│   ├── layout/           # Макет компоненттер
│   ├── home/             # Басты бет компоненттер
│   ├── movie/            # Фільм компоненттер
│   ├── player/           # Плеер компоненттер
│   └── auth/             # Аутентификация компоненттер
│
├── features/
│   └── movies/
│       ├── data.ts       # Mock деректер
│       └── queries.ts    # Query функциялар
│
└── lib/
    ├── movie-taxonomy.ts # Жанрлар және каталогтар
    ├── tmdb.ts          # TMDB адаптері
    └── supabase/        # Supabase конфигурасы
```

---

## 🔌 API Қараңғысы

### Ашық Endpoint-тер

```bash
# Фільмдерді ала
GET /api/movies?catalog=&genre=&filter=&q=&limit=30&offset=0

# Фільм деталі
GET /api/movies/:slug

# Сұрау сізге болады
GET /api/requests?q=&status=

# TMDB іздеу
GET /api/tmdb/search?q=interstellar
```

### Аутентификацияланған Endpoint-тер

```bash
# Өндіктеу профиль
GET /api/me
PATCH /api/me

# Қызмет тіс
GET /api/watchlist
POST /api/watchlist
DELETE /api/watchlist/:movieSlug

# Ойнату прогресі
GET /api/watch-progress?movieSlug=
POST /api/watch-progress
```

### Админ Endpoint-тер

```bash
# Статистика
GET /api/admin/stats

# Фільм өндіктеу
POST /api/movies
PATCH /api/movies/:slug
DELETE /api/movies/:slug
```

---

## 🔐 Конфигурация Айнымалыларыз

`.env.local` файлында қажетті айнымалыларды орнату:

```bash
# Сайт URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase конфигурасы
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Админ конфигурасы
ADMIN_EMAILS=admin@example.com
BACKEND_ADMIN_TOKEN=your-secret-token

# TMDB API (опциялық)
TMDB_ACCESS_TOKEN=your-tmdb-token
```

---

## 📊 Дерекке базасының Схемасы

Суpabase схемасы `supabase/schema.sql` файлында:

- **profiles** - Пайдаланушы профильдер
- **movies** - Фільм дерегі
- **content_requests** - Фільм сұрау
- **request_votes** - Сұрау дауыстар
- **watchlist_items** - Сәндік тіс
- **watch_progress** - Ойнату прогресі

---

## 🔄 Жүргілік Ағымы

### 1. Фронтенд Құрылыптау ✅
- Next.js App Router архитектурасы
- TypeScript, Tailwind CSS
- Mock деректер қолданып тест жасау

### 2. Бэкенд Интеграциясы 🔄
- Supabase аутентификацион
- API маршруттарын қамтамасыз ету
- Google OAuth конфигурасы

### 3. Суpabase Деректер Базасы
- Schema миграция
- RLS құнауы
- Пайдаланушы деректер құрылымы

### 4. Орналастыру
- Vercel-де орналастыру
- Өндіктеу айнымалыларын орнату
- CDN оңтайлау

---

## 📚 Құжаттама

- [`FRONTEND_ARCHITECTURE.md`](./FRONTEND_ARCHITECTURE.md) - Фронтенд arquitect
- [`BACKEND.md`](./BACKEND.md) - Бэкенд API құрылымы
- [`HDQAZ_Privacy_Policy_Professional.docx`](./HDQAZ_Privacy_Policy_Professional.docx) - Құпиялылық саясаты
- [`HDQAZ_Terms_of_Service_Professional.docx`](./HDQAZ_Terms_of_Service_Professional.docx) - Қызмет шарттары

---

## 🤝 Ынамдастыру

Басқалар ынамдастыру үшін PR жіберіңіз. Ірі өзгерістер үшін алдымен issue құрыңыз.

```bash
1. Репозиторийді fork пұл
2. Branch құрыңыз (`git checkout -b feature/amazing-feature`)
3. Өзгерістерді жіберіңіз (`git commit -m 'Add amazing feature'`)
4. Branch-ты пұштыңыз (`git push origin feature/amazing-feature`)
5. Pull Request ашыңыз
```

---

## 📄 Лицензия

Осы жобалар лицензияланған. Толық деректер үшін [`HDQAZ_Copyright_Policy_Professional.docx`](./HDQAZ_DMCA_Copyright_Policy_Professional.docx) қараңыз.

---

## 📞 Байланыс

- 🌐 Веб-сайты: [hd-qaz.vercel.app](https://hd-qaz.vercel.app)
- 👨‍💻 GitHub: [@turginbay-dev](https://github.com/turginbay-dev)

---

## 🙏 Төлеген

- **Next.js** - React фреймворк
- **Supabase** - Firebase балама
- **Tailwind CSS** - Utility-first CSS
- **TMDB** - Фільм API

---

**Құрылмасын арқасы! 🎉**

Бұл платформа **қазақ кино** индустриясын дамыту үшін құрылған. Егер сез сэтемеңіз болса, ⭐ GitHub-та төмен!
