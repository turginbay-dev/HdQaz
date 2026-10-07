# Viewer surgical recovery — 2026-10-07

Checkpoint before edits: `7fc48bc`; previous application HEAD `df7b002`.
Production rollback deployment: `HNwswPeUq16kHdumNrqJRjz9QTwF` (Ready / Current before deployment), https://hd-o31zecwjv-turginbay-devs-projects.vercel.app . Restore its production alias through Vercel Instant Rollback if the new release fails smoke checks.

Regression source: `7e633e2` replaced SiteLogo with plain text and removed detail artwork. Last pre-regression viewer baseline: `772d9a4`. Restored the existing SiteLogo / Logo.PNG, not the old hero or drawer. Homepage already had real nonduplicated categories and no giant hero/fake rankings, preserved unchanged.

Changes: 2:3 poster left and information right on desktop, compact mobile poster/title, synopsis before player, episode controls before player, explicit stat labels, compact loading spinners, search grid minimum-width correction, and non-overlapping player initialization/error controls. Empty series cannot fall back to a movie stream. Related empty section hidden. Backend, content, media, search ranking, progress identity and player recovery algorithms untouched.

Validation before deploy: eight focused viewer tests, TypeScript, production build and diff check passed. Chrome inspected home/movie/series/search screenshots. DOM geometry checked 320/360/375/390/430 and 1366/1440/1920 (no horizontal overflow); 300x450 desktop and 112x168 mobile posters. Screenshot evidence in `recovery/`. Real production pre-deployment series manifest loads (49:58 duration); local origin cannot play production HLS and correctly exercises bounded friendly failure, with usable retry at 320px. Loading spinner/message inspected at 320px. Browser Safari stayed on skeleton; connected Chrome rendered correctly.

Deployment and production smoke results: pending, append after deployment.
