# S5: Deploy + DECISIONS.md

**Time budget:** ~15min
**Depends on:** S4
**Ships:** Live URL, curl example, DECISIONS.md, AGENTS.md

## Done When

- [ ] Deployed to Railway
- [ ] Sample `curl` command works against live URL
- [ ] DECISIONS.md written
- [ ] AGENTS.md / CLAUDE.md committed
- [ ] Full commit history preserved (no squash)

## Railway Deploy

1. Push to GitHub
2. Connect repo to Railway (hobby plan, always-on)
3. Build command: `npm run build`
4. Start command: `npm run start:prod`
5. Environment: Node 20

## Sample curl

```bash
curl -X POST https://<app>.onrender.com/api/handover/generate \
  -H "Content-Type: application/json" \
  -d @data/sample-request.json
```

## DECISIONS.md Outline

1. **What I built and what I skipped** — stateless service, no DB, no LLM, no frontend
2. **Reconciliation approach** — thread key (room+type), walk historical shifts, classify status
3. **Grounding strategy** — source citations on every item, validator cross-checks, contradiction flags, prompt injection detection
4. **Where AI helped / got in the way** — Claude Code for scaffold + patterns, manual for domain logic
5. **Hours 3-6** — LLM for text parsing, database persistence, multi-hotel, frontend dashboard
6. **One surprise** — (fill in after building)
