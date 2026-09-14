# SRS Implementation Progress

This document tracks the progress of implementing the AlgoClash SRS requirements. It is intended to be maintained by agents across sessions.

## 🔴 Missing / Not Implemented
These are the remaining gaps from the SRS.

### 1. OAuth & Integrations (P2)
- [ ] Add Google OAuth sign-in flow (`FR-1.2`)
- [ ] Add GitHub OAuth sign-in flow (`FR-1.2`)
- [ ] Allow users to link/unlink OAuth providers to one account (`FR-1.8`)

### 2. Gamification & Progression (P4, P5)
- [ ] Implement Rotating Daily Quests via cron/bullmq (`FR-7.3`)
- [ ] Implement Per-topic sub-ratings logic (`FR-6.2`)
- [ ] Expose Rating history graph API endpoint (`FR-6.6`)

### 3. Advanced Matchmaking & Bots (P3, P5)
- [ ] Add topic filters for ranked matchmaking (`FR-2.1`)
- [ ] Build Bot opponents logic for practice battles (`FR-11.2`)
- [ ] Build Spectator mode for live matches (`FR-2.10`)

### 4. Tournaments & Events (P5)
- [ ] Implement `tournaments` schema and tournament API (`FR-10.1 - 10.5`)

### 5. Notifications (P2, P5)
- [ ] Integrate a transactional email service (verification, reset, recaps) (`FR-13.2`)
- [ ] Build an in-app notifications schema and socket alerts (`FR-13.1`)

### 6. Anti-Cheat & Integrity (P3, P5)
- [ ] Log editor paste events to database for post-hoc review (`FR-15.2`)
- [ ] Build code-similarity check between players' final submissions (`FR-15.3`)

## 🟡 Partially Implemented / Work In Progress

### Admin & Problem Management (P2, P5)
- [ ] Create `isDraft` logic for problems (`FR-5.6`)
- [ ] Create `/admin/problems` API routes for CRUD operations (`FR-5.1`)
- [ ] Add `role` to users table (`FR-14.1`)
- [ ] Build a Moderation/Trust-Ops dashboard in the frontend (`FR-14.1`, `FR-14.2`)

## 🟢 Implemented (Completed)
- ✅ Standard Email/Password Registration (`FR-1.1`)
- ✅ Password Reset functionality (`FR-1.3`)
- ✅ Data Export & GDPR Account Deletion (`FR-1.5`, `FR-1.6`)
- ✅ Ranked queues, matched based on rating (`FR-2.2`)
- ✅ Glicko-2 calculations and rank tiers (`FR-6.1`, `FR-6.3`)
- ✅ Judge0 Sandbox execution via BullMQ (`FR-4.1` - `FR-4.3`)
- ✅ Social friend requests and rival stats (`FR-9.1`, `FR-9.3`)
