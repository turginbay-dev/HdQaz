import type { Movie } from "@/types/movie";

export const movies: Movie[] = [
  {
    id: "interstellar",
    slug: "interstellar",
    title: "Интерстеллар",
    originalTitle: "Interstellar",
    year: 2014,
    runtime: "2 сағ 49 мин",
    rating: "8.7",
    description:
      "Адамзаттың болашағы үшін ғарышқа шыққан топ уақыт, сағыныш және үміт шегінде шешім қабылдайды.",
    posterUrl: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
    badges: ["Қазақша дыбыстама"],
    genres: ["Фантастика", "Драма"],
    catalogs: ["premium", "full-hd", "kazakh-dubbed", "top-10"],
    isPremium: true,
    isNewRelease: false,
    streams: {
      master: "/demo/interstellar/master.m3u8"
    }
  },
  {
    id: "dune-part-two",
    slug: "dune-part-two",
    title: "Дюна: Екінші бөлім",
    originalTitle: "Dune: Part Two",
    year: 2024,
    runtime: "2 сағ 46 мин",
    rating: "8.5",
    description:
      "Пол Атрейдес тағдырын қабылдап, Арракистің болашағы үшін күреске шығады.",
    posterUrl: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
    badges: ["Қазақша субтитрмен", "Дыбыстама күтілуде"],
    genres: ["Фантастика", "Шытырман"],
    catalogs: ["premium", "full-hd", "kazakh-subtitles", "new-releases", "top-10"],
    isPremium: true,
    isNewRelease: true,
    streams: {
      master: "/demo/dune-part-two/master.m3u8"
    }
  },
  {
    id: "oppenheimer",
    slug: "oppenheimer",
    title: "Оппенгеймер",
    originalTitle: "Oppenheimer",
    year: 2023,
    runtime: "3 сағ",
    rating: "8.1",
    description:
      "Ғылым, билік және жауапкершілік түйіскен жерде бір адамның таңдауы әлемді өзгертеді.",
    posterUrl: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/original/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg",
    badges: ["Қазақша дыбыстама"],
    genres: ["Драма", "Биография"],
    catalogs: ["full-hd", "kazakh-dubbed", "top-10"],
    isPremium: false,
    isNewRelease: false,
    streams: {
      master: "/demo/oppenheimer/master.m3u8"
    }
  },
  {
    id: "inside-out-2",
    slug: "inside-out-2",
    title: "Ойжұмбақ 2",
    originalTitle: "Inside Out 2",
    year: 2024,
    runtime: "1 сағ 36 мин",
    rating: "7.6",
    description:
      "Райли есейген сайын эмоциялар орталығында жаңа сезімдер пайда болып, бәрі қайта реттеледі.",
    posterUrl: "https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/original/p5ozvmdgsmbWe0H8Xk7Rc8SCwAB.jpg",
    badges: ["AI қазақша субтитр"],
    genres: ["Анимация", "Отбасы"],
    catalogs: ["full-hd", "kazakh-subtitles", "new-releases", "ai-picks"],
    isPremium: false,
    isNewRelease: true,
    streams: {
      master: "/demo/inside-out-2/master.m3u8"
    }
  },
  {
    id: "the-batman",
    slug: "the-batman",
    title: "Бэтмен",
    originalTitle: "The Batman",
    year: 2022,
    runtime: "2 сағ 57 мин",
    rating: "7.7",
    description:
      "Готэмнің қараңғы көшелерінде әділет іздеген Бэтмен жұмбақ қылмыскердің ізіне түседі.",
    posterUrl: "https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/original/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg",
    badges: ["Қазақша субтитрмен"],
    genres: ["Экшн", "Драма"],
    catalogs: ["premium", "full-hd", "kazakh-subtitles", "top-10"],
    isPremium: true,
    isNewRelease: false,
    streams: {
      master: "/demo/the-batman/master.m3u8"
    }
  },
  {
    id: "avatar-way-of-water",
    slug: "avatar-way-of-water",
    title: "Аватар: Су жолы",
    originalTitle: "Avatar: The Way of Water",
    year: 2022,
    runtime: "3 сағ 12 мин",
    rating: "7.6",
    description:
      "Салли отбасы Пандораның теңіз әлеміне көшіп, жаңа қауіппен бетпе-бет келеді.",
    posterUrl: "https://image.tmdb.org/t/p/w500/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/original/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg",
    badges: ["Қазақша дыбыстама"],
    genres: ["Фантастика", "Шытырман"],
    catalogs: ["full-hd", "kazakh-dubbed", "top-10"],
    isPremium: false,
    isNewRelease: false,
    streams: {
      master: "/demo/avatar-way-of-water/master.m3u8"
    }
  }
];
