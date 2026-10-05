# HdQaz

A live video processing and streaming platform with automated processing and a workflow from video ingestion to content publication.

[Explore the live platform](https://hdqaz.online)

## My work

- Developed the Next.js frontend and Supabase database/backend logic.
- Integrated Cloudflare R2 media storage.
- Automated video processing with Python and FFmpeg.
- Worked on HLS conversion for adaptive streaming and a worker-based processing architecture.
- Configured a processing queue with status tracking, retries, and error handling.
- Deployed a Python worker on Ubuntu using Docker.
- Structured Supabase data for movies, series, seasons, and episodes.
- Built the admin/content publishing workflow and automated the process from ingestion to publication.
- Configured deployment using Vercel and Cloudflare, including DNS and domain configuration.

## Technology stack

| Area | Technologies |
| --- | --- |
| Web frontend | Next.js |
| Database and backend logic | Supabase |
| Media processing | Python, FFmpeg |
| Adaptive streaming | HLS |
| Media storage | Cloudflare R2 |
| Deployment | Ubuntu, Docker, Vercel, Cloudflare |

## Processing workflow

The conceptual processing flow is:

```text
Video ingestion → Python/FFmpeg workers → HLS conversion → Content publication
```

Cloudflare R2 stores media. Supabase supports the database and backend logic. The Next.js frontend presents the platform, with an admin workflow for publishing content.

## Documentation

- [Backend documentation](BACKEND.md)
- [Frontend architecture](FRONTEND_ARCHITECTURE.md)

## Author

[Bekzat Turginbay](https://github.com/turginbay-dev) — Software Engineering student at Satbayev University, focused on backend development.

[LinkedIn](https://www.linkedin.com/in/bekzat-turginbay-75b5a4355/)
