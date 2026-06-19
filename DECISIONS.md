# Decisions

## 1. What I built and what I deliberately skipped

**Built:**
- Stateless NestJS service with a 5-stage pipeline: Normalize → Group by shift → Reconcile threads → Generate handover → Validate data quality
- Ingests both structured JSON events and free-text night logs (including Chinese)
- Cross-night issue reconciliation with thread tracking (still_open / newly_resolved / new_tonight)
- Action-first handover output ranked by operational priority (compliance > incidents > finance > maintenance > complaints > FYI)
- Data quality layer: citation verification, contradiction detection, prompt injection detection, incomplete entry flagging
- Structured logging with correlation IDs on every pipeline step
- Swagger UI for API exploration

**Deliberately skipped:**
- **Database** — stateless design. All data arrives per request. For a 2-hour build, this eliminates migration/ORM overhead and keeps the service simple to deploy. Tradeoff: caller must send full event history each time.
- **LLM integration** — rule-based parsing only. No hallucination risk, deterministic output, zero external dependencies. Tradeoff: night log parsing is regex-based and will miss edge cases in unseen formats. This is the single biggest limitation.
- **Frontend** — JSON output via Swagger UI. Utility over polish.
- **Authentication/rate limiting** — not needed for assessment. Would add in production.

## 2. How I handle reconciliation across nights

Thread key = `room + normalized_type`. Events with the same room and category (e.g., `312:finance`) are grouped into a single issue thread.

Type normalization collapses related categories: `no_show` and `finance_note` both map to `finance`, `deposit_issue` maps to `deposit`, etc. This lets the reconciler track an issue that starts as a no-show (evt_0010) and continues as a finance dispute (evt_0012).

For each thread:
- If the thread key exists in prior shifts AND the latest event is unresolved → `still_open` (with `nightsOpen` count)
- If the thread key exists in prior shifts AND the latest event is resolved → `newly_resolved`
- If the thread key only appears in the current shift → `new_tonight`

Night log events (which lack timestamps) are assigned to the shift following their log date — a log dated May 27 belongs to the "morning of May 28" shift.

## 3. How I keep every statement grounded

**Citation chain:** Every handover item carries a `sourceEvents[]` array linking back to input event IDs (structured or synthetic `log_NNNN`). The DataQualityService cross-checks every cited ID against the normalized event pool — if a handover item references an event that doesn't exist in the input, it's flagged as an anomaly.

**Contradiction detection:** The reconciler detects when events in the same thread have conflicting statuses (e.g., one says resolved, another says unresolved). These are surfaced in `dataQuality.warnings` with type `contradiction` — never silently resolved.

**Prompt injection detection:** Guest-submitted text (`guest_message` type) is scanned for patterns that mimic system instructions: "SYSTEM NOTE", "ignore all", "mark approved", "add credit", etc. If 2+ patterns match, the event is flagged in `dataQuality.flaggedEntries`. The content is logged verbatim but never treated as a system instruction. This caught evt_0026 — a guest note attempting to override the handover.

**Incomplete entry flagging:** Actionable events (complaints, maintenance, compliance, etc.) missing room, guest, or timestamp are flagged in `dataQuality.incompleteEntries` with a list of what's missing.

**No LLM = no invention.** Every summary is either the original event description or a direct extraction from the night log. The service cannot generate text that isn't in the input.

## 4. Where AI helped most, and where it got in the way

**Helped most:**
- Scaffolding the NestJS project structure and middleware wiring — boilerplate that's easy to get wrong
- Regex patterns for night log parsing — especially CJK character detection and room number extraction patterns
- Test scaffolding — generating test fixtures and assertion patterns
- Planning the pipeline architecture — the 5-stage design came from an AI-assisted planning session

**Got in the way:**
- Initial regex patterns were too conservative — missed room numbers like `312 那个` that don't follow Western formatting conventions. Had to debug and add `^(\d{3})\b` pattern manually.
- Night log events weren't joining issue threads because the shift grouper dropped null-timestamp events. AI generated the initial code but didn't catch this gap — had to trace through the full pipeline to find it.
- The GroundingValidatorService name was vague. Renamed to DataQualityService after reflecting on what it actually does — the AI-generated name described the concept but not the function.

## 5. What I'd do in hours 3–6

1. **LLM for night log parsing** — Replace regex with a structured extraction prompt (Claude/GPT). Feed raw text, get back `{ room, guest, type, status, summary }`. Keep the rule-based parser as fallback. Validate LLM output against the same grounding rules.
2. **Smarter thread matching** — Use description similarity (TF-IDF or embedding distance) for room-less events instead of just type matching.
3. **Ghost occupancy detection** — Room 205 (Daniel Chen checked in but bed not slept in) needs cross-referencing check-in records with night log observations. Currently these land in separate threads.
4. **Database persistence** — Store event history per hotel. API becomes `POST /handover/generate { hotelId, targetDate }` instead of sending all events each time.
5. **Multi-language support** — LLM-based translation/extraction for Chinese entries instead of pass-through with language tag.
6. **Webhook delivery** — Push handovers to Slack/email at 07:00 automatically.

## 6. One thing that surprised me

The bilingual status indicators are more fragile than they look. `settle 了` works because staff happened to use that exact phrase — but a different staff member writing `搞定了` (also means "settled") would miss the match entirely. The keyword approach handles known patterns but won't generalize to unseen phrasing across hundreds of hotels with different staff. This is where an LLM would genuinely help: not for generating the handover, but for normalizing messy multilingual status signals before they enter the deterministic pipeline.
