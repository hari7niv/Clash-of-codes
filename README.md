# ClashOfCode — Backend

Three independently deployable services sharing one types/schema package, because
they scale, fail, and deploy differently (Architecture §3.4 and §8):

| Service              | Kind                         | Tech                              |
| -------------------- | ---------------------------- | --------------------------------- |
| `services/api`       | Stateless REST               | Node.js + Fastify + Postgres      |
| `services/match-server` | Stateful (1 conn per battle) | Socket.io + Redis                 |
| `services/judge-worker` | Isolated code runner         | BullMQ consumer -> Judge0         |
| `packages/shared`    | Types + Zod + Glicko-2       | Imported by all three             |

## Prerequisites

- Node.js >= 20 (tested on 22)
- pnpm >= 9 (`corepack enable pnpm`)
- Docker (for Postgres, Redis, and Judge0)

## Quick start

```bash
pnpm install
cp .env.example .env            # (PowerShell: Copy-Item .env.example .env)

pnpm docker:up                  # Postgres + Redis
pnpm migrate                    # apply infra/migrations/*.sql
pnpm seed                       # seed problems + dev users

pnpm judge0:up                  # start the isolated Judge0 stack

# each service in its own terminal
pnpm dev:api                    # http://localhost:4000
pnpm dev:judge
pnpm dev:match                  # ws://localhost:4100
```

`pnpm build:shared` runs automatically before each `dev:*` script because the other
services import the compiled `@clashofcode/shared` package.

## Layout

```
packages/shared      types first, so api & match-server never drift on the WS contract
services/api         auth, problems, leaderboard, rooms, practice-mode judging
services/judge-worker Judge0 in isolation — the only thing that runs untrusted code
services/match-server matchmaking + rooms + live battle lifecycle
infra                migrations (schema source of truth), seed scripts, Judge0 compose
```

## Build order (mirrors the SRS phased roadmap P2 -> P3)

1. `packages/shared` — the WS/type contract
2. `services/api` — REST + practice judging
3. `services/judge-worker` — prove the Judge0 pipeline standalone
4. `services/match-server` — wire matchmaking + rooms on top of the proven pipeline
5. `infra` — CI, seeds, compose

## The one boundary that matters

The judge never talks to the client. It talks only to Postgres and hands a verdict back
to `match-server`, which is the single source of truth for what each player sees
(Architecture §2.1).
