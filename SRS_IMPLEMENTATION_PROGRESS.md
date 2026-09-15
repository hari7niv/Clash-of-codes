# SRS Implementation Progress

This document tracks the progress of implementing the AlgoClash SRS requirements. It is intended to be maintained by agents across sessions.

## 🔴 Missing / Not Implemented
These are the remaining gaps from the SRS.

### 1. OAuth & Integrations (P2)
- [ ] Add Google OAuth sign-in flow (`FR-1.2`)
- [ ] Add GitHub OAuth sign-in flow (`FR-1.2`)
- [ ] Allow users to link/unlink OAuth providers to one account (`FR-1.8`)

### 2. Advanced Matchmaking & Bots (P3, P5)
- [ ] Add topic filters for ranked matchmaking (`FR-2.1`)
- [ ] Build Bot opponents logic for practice battles (`FR-11.2`)
- [ ] Build Spectator mode for live matches (`FR-2.10`)

### 3. Tournaments & Events (P5)
- [ ] Implement `tournaments` schema and tournament API (`FR-10.1 - 10.5`)

### 4. Notifications (P2, P5)
- [ ] Integrate a transactional email service for verification, reset, weekly recaps (`FR-13.2`)
  - Requires external provider (e.g. Resend / SendGrid). Schema and API layer are done.
- [ ] Wire real-time WebSocket notification delivery from match-server to connected clients (`FR-13.1`)
  - REST notification API is done; real-time push from match-server is the remaining piece.

### 5. Admin & Frontend (P5)
- [ ] Build a Moderation/Trust-Ops dashboard in the frontend (`FR-14.1`, `FR-14.2`)

### 6. Per-topic Sub-ratings (P4)
- [ ] Implement Per-topic sub-ratings logic and leaderboard (`FR-6.2`)

## 🟢 Implemented (Completed)

### Auth & Identity
- ✅ Standard Email/Password Registration (`FR-1.1`)
- ✅ Password Reset functionality (`FR-1.3`)
- ✅ Data Export & GDPR Account Deletion (`FR-1.5`, `FR-1.6`)

### Matchmaking & Battle
- ✅ Ranked queues matched based on Glicko-2 rating (`FR-2.2`)
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

### Notifications
- ✅ In-app notification schema + REST API (CRUD + mark read) (`FR-13.1`)
  - Endpoints: `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `DELETE /api/notifications/:id`

### Admin & Problem Management
- ✅ `isDraft` flag for problems — published vs staged (`FR-5.6`)
- ✅ Admin Problem CRUD API (`POST`, `PUT /api/admin/problems`) (`FR-5.1`)
- ✅ Role-based access control: `user` vs `admin` (`FR-14.1`)

### Anti-Cheat & Integrity
- ✅ Paste event logging endpoint (`POST /api/matches/:matchId/paste-events`) (`FR-15.2`)
  - Logs pasted text, language, timestamp, user, match for post-hoc review
