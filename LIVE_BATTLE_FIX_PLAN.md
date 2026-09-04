# Live Battle Flow - Comprehensive Fix Plan

## Root Causes Confirmed

### P0 BUG 1: Match ID ≠ Room ID
- **Location:** `Battle.tsx:150`, `matches.routes.ts`
- **Issue:** API doesn't return roomId, fallback uses matchId as roomId
- **Impact:** submit_code fails with ROOM_NOT_FOUND
- **Fix:** Redis mapping + API endpoint

### P0 BUG 2: Incomplete Submit Payload  
- **Location:** `Battle.tsx:135`
- **Issue:** Missing `matchId` field in submit_code event
- **Impact:** Server can't validate match membership
- **Fix:** Add matchId to client payload

### P0 BUG 3: No Reconnect Flow
- **Location:** `Battle.tsx`, `useMatchSocket.ts`
- **Issue:** Battle never emits request_reconnect
- **Impact:** Refresh causes forfeit after 60s
- **Fix:** Emit reconnect on mount/socket reconnect

### P0 BUG 4: Socket Unregister Race
- **Location:** `match-handler.ts:170`, `index.ts:450`
- **Issue:** Old socket can delete new socket mapping
- **Impact:** New socket becomes unreachable
- **Fix:** Only unregister if socketId matches

### P0 BUG 5: Dual Winner Calculation
- **Location:** `index.ts:460`, `match-completion.ts`, `rating-calculator.ts`
- **Issue:** Forfeit sets winner, then generic completion recalculates
- **Impact:** Inconsistent winner, duplicate rating updates
- **Fix:** Single authoritative completion with reason parameter

### P0 BUG 6: Match-Server vs API Rating Disagreement
- **Location:** `match-completion.ts`, `rating-calculator.ts`
- **Issue:** Two separate implementations determine winner differently
- **Fix:** Shared winner determination logic

### P0 BUG 7: Dual Submission Paths
- **Location:** REST `/api/matches/:matchId/submissions`, Socket `submit_code`
- **Issue:** Two independent submission flows
- **Fix:** Make match-server canonical for live battles

### P0 BUG 8: Run vs Submit Not Implemented
- **Location:** `processor.ts:100`
- **Issue:** Always fetches all tests regardless of action
- **Fix:** Filter by is_sample for "run" action

### P1: Friend Search SQL Error
- **Location:** `social.routes.ts`
- **Issue:** `ANY($1::uuid[])` syntax with Drizzle
- **Fix:** Use `inArray` helper

### P1: Room Members Insert Failure
- **Location:** `room.repo.ts`
- **Issue:** Schema mismatch or FK violation
- **Fix:** Verify migrations applied

## Implementation Order (Priority)

### Phase 1: Critical Path Enablement
1. **Fix P0 BUG 1**: Implement match→room mapping (enables submissions)
2. **Fix P0 BUG 2**: Complete submit_code payload
3. **Fix P0 BUG 8**: Implement run vs submit test filtering
4. **Fix P0 BUG 4**: Safe socket unregister

### Phase 2: Reconnection & Robustness  
5. **Fix P0 BUG 3**: Implement reconnect flow in Battle
6. **Fix P0 BUG 5 & 6**: Unified match completion
7. **Fix P0 BUG 7**: Consolidate submission paths

### Phase 3: Validation & Polish
8. Add comprehensive error handling
9. Add observability/logging
10. Fix P1 issues (friends, rooms)

## Files to Modify

### Backend - Match Server
- `services/match-server/src/index.ts` (submit_code, disconnect, reconnect)
- `services/match-server/src/services/match-handler.ts` (socket management, Redis mapping)
- `services/match-server/src/services/matchmaking-loop.ts` (store mapping on match creation)
- `services/match-server/src/services/match-completion.ts` (unified completion)

### Backend - Judge Worker
- `services/judge-worker/src/processor.ts` (test filtering)

### Backend - API
- `services/api/src/routes/matches/matches.routes.ts` (add roomId lookup endpoint)
- `services/api/src/services/rating-calculator.ts` (align with match-server)

### Frontend
- `clashofcode-frontend/client/src/pages/Battle.tsx` (reconnect, correct payloads)
- `clashofcode-frontend/client/src/hooks/useBattleData.ts` (fetch roomId)
- `clashofcode-frontend/client/src/hooks/useMatchSocket.ts` (reconnect handling)

### Shared
- `packages/shared/src/types/socket-events.ts` (add match_completion types if needed)

## Testing Strategy

### Unit Tests Required
- Match→room mapping CRUD
- Socket register/unregister with race conditions
- Winner determination logic
- Test filtering (sample vs full)

### Integration Tests Required  
- Full submission flow: Battle → Socket → DB → BullMQ → Judge → Result
- Reconnect flow: Disconnect → Reconnect → Grace timer cancelled
- Forfeit flow: Disconnect → 60s → Forfeit → Rating update
- Dual submission prevention

### Manual Test Scenarios
1. Two users join matchmaking → match found → both navigate to battle → submit code → see results
2. One user refreshes during active match → reconnects → no forfeit → can continue
3. One user disconnects and doesn't return → 60s → opponent wins
4. Click "Run" → only sample tests execute
5. Click "Submit" → full test suite executes

## Verification Checklist

- [ ] Build passes: `pnpm build:shared && pnpm --filter @clashofcode/match-server build`
- [ ] TypeScript: `pnpm --filter @clashofcode/match-server typecheck`
- [ ] Match server starts without errors
- [ ] Judge worker connects to Judge0
- [ ] API endpoints return correct data
- [ ] Battle page loads and displays match info
- [ ] Submit code creates submission in DB
- [ ] Judge worker processes submission
- [ ] Result delivered to Battle page
- [ ] Reconnect cancels grace timer
- [ ] Forfeit completes match correctly
- [ ] Ratings update once and correctly

## Success Criteria

A complete flow must work:
```
1. User A & B join ranked queue
2. Match found → both see match_found event
3. Navigate to /battle/:matchId
4. Battle resolves matchId → roomId
5. Both join Socket.IO room
6. Timer syncs
7. User A clicks "Submit"
8. submit_code event with roomId + matchId
9. Server validates, creates submission, enqueues job
10. Judge worker picks up job
11. Judge worker filters to full test suite
12. Judge0 executes (if available) or mock
13. Verdict persisted to DB
14. Match-server receives completion event
15. submission_result sent to User A
16. opponent_progress sent to User B  
17. User B refreshes page
18. Battle emits request_reconnect
19. Server cancels grace timer
20. User B rejoins, sees updated state
21. Match completes on time expiry or accept
22. Ratings calculated once
23. match_result sent to both
24. Result page displays correct winner
```

## Risk Assessment

### High Risk Changes
- Unified match completion (touches rating calculation)
- Socket unregister logic (affects all reconnections)
- Redis mapping (new data flow)

### Medium Risk Changes
- Submit code payload (contract change)
- Test filtering (affects verdict correctness)
- Reconnect flow (new client behavior)

### Low Risk Changes
- Error handling improvements
- Logging additions
- Friend search fix

## Rollback Plan

All changes are backwards-compatible if:
1. Redis mapping is optional (falls back to DB lookup)
2. Submit payload accepts old format (validate presence of matchId, don't require)
3. Match completion checks for in-progress flag before executing

## Timeline Estimate

- Phase 1 (Critical Path): 4-6 hours
- Phase 2 (Reconnection): 3-4 hours  
- Phase 3 (Polish): 2-3 hours
- Testing & Verification: 2-3 hours

**Total: 11-16 hours of focused development**

## Notes

- Judge0 status 13 issue is infrastructure, not code
- Mock Judge0 server can be used for development
- Migrations are up to date (verified earlier)
- Database schema is correct
- Focus on match-server as source of truth for live battles
