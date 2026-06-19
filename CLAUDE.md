# Vouch Night-Shift Handover Service

## Goal

Automated night-shift handover generator for hotel front desks. Ingest messy data (JSON events + free-text logs), reconcile issues across nights, produce action-first morning report with full source grounding.

**Assessment goal:** Get the job offer. Vouch scores grounding (trustworthy output) and product thinking (smart tradeoffs) highest.

## Tech Stack

- NestJS 10, Node.js 20+
- nestjs-pino (structured logging)
- helmet, compression (security + performance middleware)
- @nestjs/swagger (API docs)
- class-validator + class-transformer (DTO validation)
- Jest (testing)
- Railway hobby plan (deployment, always-on)

## Architecture

Stateless — no database, no LLM. All data in request. Loose coupling via NestJS middleware stack.

**Pipeline:** Normalize → Group by shift → Reconcile threads → Generate handover → Validate grounding

## Delivery Slices

Each slice is independently shippable. See `docs/slices/` for detailed specs.

| Slice | Focus | Time |
|-------|-------|------|
| S1 | Scaffold + API + Swagger | ~25min |
| S2 | Ingest + Normalize events | ~25min |
| S3 | Reconcile across nights | ~25min |
| S4 | Handover generation + Grounding | ~25min |
| S5 | Deploy + DECISIONS.md | ~15min |

## Commands

```bash
npm run start:dev    # dev with hot reload
npm run build        # production build
npm run start:prod   # run production
npm run test         # unit tests
npm run lint         # ESLint
```

## Conventions

- NestJS DI everywhere, no manual instantiation
- DTOs with class-validator for all request/response
- Structured logs: `{ hotelId, shiftDate, step, correlationId }`
- No comments unless explaining non-obvious "why"
- Early returns over deep nesting
- Test files co-located: `*.spec.ts`
