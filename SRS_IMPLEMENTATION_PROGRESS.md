# SRS Implementation Progress

This document tracks the progress of implementing the AlgoClash SRS requirements. Maintained across sessions.

## 🔴 Requires External Configuration (Not Auto-completable)

These items need external API keys or infrastructure that must be configured manually:

### Email Service (FR-13.2)
- The email service is **fully implemented** (`services/api/src/services/email.service.ts`).
- Set `EMAIL_PROVIDER=resend` (or `sendgrid`) and add the corresponding API key in `.env` to enable real email sending.
- Default mode `console` logs emails to stdout — works for dev without any config.

### OAuth Login (FR-1.2, FR-1.8)
- OAuth routes are **fully implemented** for GitHub and Google.
- Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `.env` to enable.
- Frontend callback page (`/oauth/callback`) already handles the token redirect.
- Create OAuth Apps at: https://github.com/settings/developers (GitHub) and https://console.cloud.google.com/apis/credentials (Google).

## 🟢 Fully Implemented

### Auth & Identity
- ✅ Standard Email/Password Registration (`FR-1.1`)
- ✅ Password Reset functionality + transactional email (`FR-1.3`, `FR-13.2`)
- ✅ Welcome email on signup (`FR-13.2`)
- ✅ Data Export & GDPR Account Deletion (`FR-1.5`, `FR-1.6`)
- ✅ GitHub OAuth backend routes + frontend callback (`FR-1.2`)
- ✅ Google OAuth backend routes + frontend callback (`FR-1.2`)
- ✅ OAuth provider status endpoint — `GET /api/auth/oauth/providers` (`FR-1.8`)

### Matchmaking & Battle
- ✅ Ranked queues matched based on Glicko-2 rating (`FR-2.2`)
- ✅ Topic-filtered queue support — `GET /api/matchmaking/status?topic=...` (`FR-2.1`)
- ✅ Live WebSocket battle engine with timer sync (`FR-2.4`, `FR-2.7`)
- ✅ Private rooms with shareable room codes (`FR-2.9`)
- ✅ Disconnect grace period + forfeit (`FR-2.8`)

### Code Execution
- ✅ Judge0 Sandbox execution via BullMQ consumer (`FR-4.1` - `FR-4.3`)
- ✅ Async verdict delivery via Redis Pub/Sub to match-server (`FR-4.4`)

### Rating & Progression
- ✅ Glicko-2 calculations with rank tiers (`FR-6.1`, `FR-6.3`)
- ✅ Rating history API endpoint (`GET /api/users/me/rating-history`) (`FR-6.6`)
- ✅ XP, levels, and streak tracking (`FR-7.1`, `FR-7.2`)
- ✅ Daily quests with rotation, progress tracking, and XP claim (`FR-7.3`)

### Social
- ✅ Friend requests and rival stats (`FR-9.1`, `FR-9.3`)
- ✅ Direct challenge rooms (`FR-9.2`)

### Tournaments
- ✅ Tournament schema: `tournaments`, `tournament_participants`, `tournament_matches` (`FR-10.1`)
- ✅ List and view tournaments with bracket (`FR-10.1`)
- ✅ Player registration and withdrawal (`FR-10.2`)
- ✅ Admin tournament creation and status management (`FR-10.3`, `FR-10.4`)

### Notifications
- ✅ In-app notification schema + REST API (`FR-13.1`)
- ✅ Email service module — provider-agnostic (Resend/SendGrid/console) (`FR-13.2`)

### Admin & Problem Management
- ✅ `isDraft` flag for problems — published vs staged (`FR-5.6`)
- ✅ Admin Problem CRUD API (`FR-5.1`)
- ✅ Role-based access control: `user` vs `admin` (`FR-14.1`)
- ✅ Admin Dashboard frontend (`/admin`) — problem publishing + tournament management (`FR-14.1`, `FR-14.2`)

### Anti-Cheat & Integrity
- ✅ Paste event logging — `POST /api/matches/:matchId/paste-events` (`FR-15.2`)

## ⏳ Deferred / Out of Scope for Current Phase

- **Bot opponents** (`FR-11.2`) — requires significant game AI/logic engineering
- **Spectator mode** (`FR-2.10`) — needs additional match-server WebSocket room management
- **Per-topic sub-ratings** (`FR-6.2`) — needs a separate ratings table per topic (schema + cron)
- **Code-similarity checks** (`FR-15.3`) — needs an AST/fingerprint comparison engine
- **Real-time WebSocket notification push from match-server** (`FR-13.1`) — REST API exists; push delivery requires match-server integration
