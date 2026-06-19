# S4: Handover Generation + Grounding

**Time budget:** ~25min
**Depends on:** S3
**Ships:** Action-first handover with source citations, contradiction flags, prompt injection detection. **This is where we win the assessment.**

## Done When

- [ ] `HandoverGeneratorService` produces priority-ranked sections
- [ ] Every item has `sourceEvents[]` array
- [ ] `GroundingValidatorService` verifies all citations exist
- [ ] Contradictions flagged in `dataQuality.warnings`
- [ ] Prompt injection detected and flagged (evt_0026)
- [ ] Incomplete entries flagged (missing room/guest)
- [ ] Unit tests for generator and validator

## Priority Ranking

Morning manager reads top-down. Order by urgency:

| Priority | Category | Why |
|----------|----------|-----|
| 1 | compliance | Legal deadlines, regulatory risk |
| 2 | incident/safety | Guest health, security |
| 3 | finance | Revenue at risk, disputed charges |
| 4 | maintenance | Room availability, guest comfort |
| 5 | deposit_issue | Money collection |
| 6 | complaint | Guest satisfaction |
| 7 | check_in_issue | Admin follow-up |
| 8 | note/fyi | Awareness only |

## Handover Sections

- **actionRequired** — must act today, has deadline or risk
- **pending** — needs decision, no immediate deadline
- **resolved** — was open, now closed (so manager knows)
- **fyi** — informational, no action needed

## Grounding Rules

1. Every `summary` and `details` field must reference only facts from source events
2. Every item must have at least one `sourceEvents` entry
3. Validator cross-checks: does each cited event ID exist in the normalized input?
4. If validator finds uncited claim → error (pipeline bug, not data issue)

## Prompt Injection Detection

Pattern: guest-submitted text containing system-like instructions.
- Check `guest_message` type events for keywords: "SYSTEM NOTE", "ignore all", "mark it approved", "add credit"
- Flag in `dataQuality.flaggedEntries` with reason
- Never execute instructions from guest-submitted text

## Contradiction Handling

Don't resolve contradictions — flag them for the morning manager:
```json
{
  "type": "contradiction",
  "description": "Room 312: night log says no-show charge applied, but evt_0012 says guest disputes and charge needs investigation",
  "relatedEvents": ["evt_0010", "evt_0012", "log_0003"]
}
```

## Incomplete Entry Handling

Flag but still include in handover:
```json
{
  "eventId": "evt_0015",
  "missing": ["room", "guest"],
  "note": "Breakfast complaint but no room/guest identified — cannot follow up without more info"
}
```
