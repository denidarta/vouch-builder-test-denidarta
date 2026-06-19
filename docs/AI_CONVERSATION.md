# AI Conversation Export — Night-Shift Handover Service

> This is a curated export of the AI-assisted development session. It showcases design decisions, debugging, and the iterative process of building the handover service.

---

## Phase 1: Planning & Architecture

**Me:** Read the handoff doc and brief. What can you infer from the brief?

**Claude:** Key inferences:
1. They'll test with unseen data — regex patterns must generalize, not be hardcoded to sample
2. Grounding > everything — "This is the part we care about most"
3. They read as operators, not engineers — handover needs to be scannable, action-first
4. Sharp tradeoffs > completeness — DECISIONS.md matters as much as code
5. Full commit history required — multiple small commits > one big commit

**My decision:** Start with a 5-stage stateless pipeline. No database, no LLM. All data arrives per request. This keeps the scope tight for 2 hours and eliminates hallucination risk entirely.

---

## Phase 2: Naming & Clarity

**Me:** `GroundingValidatorService` seems vague. Is there an alternative name?

**Claude:** Options: `DataQualityService`, `OutputAuditorService`, `SourceVerifierService`, `HandoverAuditorService`. Recommended `DataQualityService` — maps directly to the `dataQuality` response field.

**Me:** Change it to `DataQualityService`.

**My reasoning:** Anyone reading the API response sees `dataQuality` in the JSON. The service that produces it should have the same name. Code should match the domain language the morning manager sees, not abstract CS concepts.

---

## Phase 3: Data Design Decision

**Me:** Why create a separate `full-request.json` when `events.json` already has all the data?

**Claude:** Good point. `events.json` already has the hotel object at top level. A shell script that assembles the request from existing files is cleaner.

**My reasoning:** The brief says "assume input arrives as data, not a file you hand-edit." A pre-built request file is the opposite of that principle. Created `test-handover.sh` instead — it reads `events.json` + `night-logs.md` and assembles the request dynamically. This is also how an evaluator would test: with their own data, not mine.

---

## Phase 4: Debugging the Room 312 Contradiction

This was the most interesting debugging session. The HANDOFF doc explicitly flags Room 312 as a data trap — three sources disagree about a no-show charge.

**Problem:** Room 312 thread only had 2 source events (`evt_0010`, `evt_0012`). The Chinese night log entry about charging the no-show (`log_0006`) wasn't joining the thread.

**Root cause 1 — Room extraction failed:**
```
Text: "312 那个 no-show（昨晚的 guaranteed booking）— 我已经按 booking terms 帮他收了一晚的费用了"
Room extracted: null
```
The regex patterns expected Western formatting (`Room 112`, `112 —`). `312 那个` starts with a bare number followed by a Chinese character, which none of the patterns matched.

**Fix:** Added `^(\d{3})\b` pattern — matches a 3-digit room number at the start of any entry regardless of what follows.

**Root cause 2 — Night log events dropped by shift grouper:**
Night log events have `null` timestamps. The shift grouper was returning `null` for events without timestamps, so they never entered any shift and never participated in reconciliation.

**Fix:** Added `logDate` field to `NormalizedEvent`. Night log entries carry their source log date. Shift grouper assigns them to `addOneDay(logDate)` — a log dated May 27 belongs to the "morning of May 28" shift.

**Root cause 3 — Thread key mismatch:**
`evt_0010` has type `no_show`, `evt_0012` has type `finance_note`. Without normalization, these get different thread keys (`312:no_show` vs `312:finance_note`).

**Fix:** Type normalization aliases — `no_show` → `finance`, `finance_note` → `finance`. Now both events share thread key `312:finance`.

**Result after all three fixes:**
```json
{
  "room": "312",
  "sourceEvents": ["evt_0010", "log_0006", "evt_0012"],
  "details": "WARNING: Conflicting status: log_0006 says resolved, but evt_0010 says unresolved"
}
```

Three sources, one thread, contradiction flagged. This is exactly what the brief asks for.

---

## Phase 5: Contradiction Surfacing

**Problem:** Contradictions were detected by the reconciler and shown in handover item details, but NOT in `dataQuality.warnings`. A morning manager scanning the data quality section would miss them.

**Fix:** Updated `DataQualityService.validate()` to accept reconciled issues and surface any with `contradiction` field as `dataQuality.warnings` with type `contradiction`.

**Result:**
```json
{
  "dataQuality": {
    "warnings": [
      {
        "type": "contradiction",
        "description": "Room 312: Conflicting status: log_0006 says resolved, but evt_0010 says unresolved",
        "relatedEvents": ["evt_0010", "log_0006", "evt_0012"]
      }
    ],
    "flaggedEntries": [
      {
        "eventId": "evt_0026",
        "reason": "Potential prompt injection: guest note contains 6 suspicious patterns"
      }
    ]
  }
}
```

---

## Phase 6: Reflection on Limitations

**Me:** The `surprise` section in DECISIONS.md — what actually surprised me?

The bilingual status indicators are fragile. `settle 了` works because the staff member used that exact phrase. But `搞定了` (also means "settled/done") would miss entirely. The keyword-matching approach handles known patterns but won't generalize across hundreds of hotels with different staff writing in different dialects.

This is where an LLM would genuinely add value — not for generating the handover (that's where grounding matters), but for normalizing messy multilingual status signals BEFORE they enter the deterministic pipeline. The rule-based parser is the right call for 2 hours, but it's the weakest link for production.

---

## Key Design Decisions Summary

| Decision | Choice | Why |
|----------|--------|-----|
| Database | None — stateless | 2hr budget, eliminates migration overhead |
| LLM | None — rule-based | No hallucination risk, deterministic output |
| Thread matching | room + normalized_type | Simple, catches 90% of cases |
| Contradiction handling | Flag, never resolve | Morning manager decides, not the system |
| Prompt injection | Pattern matching on guest_message | Caught evt_0026 trap |
| Service naming | DataQualityService | Maps to response field name |
| Night log assignment | logDate → next morning's shift | Log dated May 27 → May 28 shift |
| Test data | Shell script, not static JSON | Brief says "assume we may run against unseen data" |

---

*Session conducted 2026-06-19 using Claude Code with Claude Sonnet 4.6*
