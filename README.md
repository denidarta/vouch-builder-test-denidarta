# Vouch Night-Shift Handover

Project Start: 10.00 AM - GMT + 7
Project Deployed: 11.20 AM - GMT + 7
Project End: 11.26 PM - GMT + 7 (Final Commit)

Auto-generate action-first morning handover from messy night-shift data. No LLM, no DB — pure deterministic pipeline.

## Live

- **API**: https://web-production-2a700.up.railway.app/
- **Swagger**: https://web-production-2a700.up.railway.app/api/docs
- **Health**: https://web-production-2a700.up.railway.app/api/health

## Quick Test

```bash
# Use test script (needs jq)
./data/test-handover.sh https://web-production-2a700.up.railway.app

# Or curl direct
curl -X POST https://web-production-2a700.up.railway.app/api/handover/generate \
  -H "Content-Type: application/json" \
  -d '{
    "hotel": { "id": "lumen-sg", "name": "Lumen Boutique Hotel", "rooms": 40, "timezone": "+08:00" },
    "events": [{ "id": "evt_0001", "timestamp": "2026-05-25T23:14:00+08:00", "type": "check_in", "room": "204", "guest": "Tan Wei Ming", "description": "Late check-in, smooth.", "status": "resolved" }],
    "nightLogs": [{ "date": "2026-05-27", "content": "Room 112 aircon still broken." }],
    "targetDate": "2026-05-30"
  }'
```

## Pipeline

```
Input → Normalize → Group by Shift → Reconcile Threads → Generate Handover → Validate Grounding
```

5-stage stateless pipeline. All data in request, structured output out.

## Run Local

```bash
npm install
npm run start:dev    # dev + hot reload
npm run test         # unit tests
npm run lint         # ESLint
```

## Stack

NestJS 10 · Node 20+ · nestjs-pino · Swagger · class-validator · Railway

## Docs

- `DECISIONS.md` — tradeoffs, grounding, AI usage
- `AGENTS.md` / `CLAUDE.md` — AI assistant instructions
- `docs/HANDOFF.md` — deploy + testing guide
- `docs/AI_CONVERSATION.md` — exported AI planning/debugging session
