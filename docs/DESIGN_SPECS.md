# Night-Shift Handover Service — Design Spec

## Problem

Vouch runs hotel front desks overnight. Morning managers need to know what happened and what to act on first. Current handovers are assembled manually with inconsistent quality. This service automates it.

## Scope

2-hour assessment slice. Build the core pipeline: ingest → reconcile → generate → ground. No database, no LLM, no frontend.

## Architecture

Stateless NestJS service. All data arrives per request. Loosely coupled via NestJS middleware stack for cross-cutting concerns.

### Infrastructure Layer (Middleware Stack)

All infrastructure concerns are separated from business logic:

**Middleware (applied in `main.ts` and `AppModule`):**
- `helmet` — security HTTP headers (X-Frame-Options, CSP, HSTS, etc.)
- `compression` — gzip response compression
- `correlation-id.middleware.ts` — generates/propagates `X-Request-ID` header, attaches to Pino logger context so all pipeline logs for a single request share one trace ID
- `nestjs-pino` — HTTP access logging (method, URL, status, duration) + request-scoped injectable `PinoLogger`

**Interceptor:**
- `logging.interceptor.ts` — wraps each request with timing, logs pipeline step durations and outcome

**Global Pipe:**
- `ValidationPipe` — validates all incoming DTOs via class-validator decorators, rejects malformed requests with 400

**Global Filter:**
- `http-exception.filter.ts` — catches all exceptions, returns consistent JSON error shape with correlation ID

### Processing Pipeline

Five-stage pipeline:

### Stage 1: EventNormalizer

**Input:** Raw JSON events array + free-text night log strings
**Output:** Unified `NormalizedEvent[]`

Responsibilities:
- Validate and pass through structured JSON events
- Parse free-text night logs into structured events using pattern matching
- Assign synthetic IDs to text-extracted events (`log_NNNN`)
- Tag language for non-English entries
- Flag entries that couldn't be fully parsed (partial extraction with `confidence: "low"`)

Normalized event shape:
```typescript
interface NormalizedEvent {
  id: string;
  source: 'system' | 'night_log';
  timestamp: string | null;
  type: string;
  room: string | null;
  guest: string | null;
  description: string;
  status: 'resolved' | 'unresolved' | 'pending';
  rawText?: string;         // original text for night log entries
  language?: string;        // if non-English detected
  confidence: 'high' | 'low';
}
```

### Stage 2: ShiftGrouper

**Input:** `NormalizedEvent[]` + target date + hotel timezone
**Output:** `ShiftGroup` containing current shift events + historical context

Responsibilities:
- Define shift window: 23:00 on (targetDate - 1) to 07:00 on targetDate
- Group all events by their shift window
- Return current shift + all prior shifts for reconciliation
- Handle timezone offset in timestamp parsing

### Stage 3: IssueReconciler

**Input:** Current shift `NormalizedEvent[]` + historical shifts
**Output:** `ReconciledIssue[]` with thread status

Responsibilities:
- Build thread key from `room + type` (or description similarity for room-less events)
- Walk historical shifts to build issue timeline
- Classify each issue:
  - `still_open` — appeared in prior shift, no resolution event found
  - `newly_resolved` — was open, resolution event found in current shift
  - `new_tonight` — first appearance is in current shift
- Detect contradictions: events that claim opposite states for same issue
- Track how many nights an issue has been open

Reconciled issue shape:
```typescript
interface ReconciledIssue {
  threadKey: string;
  status: 'still_open' | 'newly_resolved' | 'new_tonight';
  category: string;
  room: string | null;
  guest: string | null;
  summary: string;
  nightsOpen: number;
  sourceEvents: string[];   // event IDs
  contradiction?: string;   // if conflicting info detected
  timeline: { date: string; eventId: string; summary: string }[];
}
```

### Stage 4: HandoverGenerator

**Input:** `ReconciledIssue[]`
**Output:** Structured handover sections

Responsibilities:
- Sort issues into sections: `actionRequired`, `pending`, `resolved`, `fyi`
- Rank by priority: compliance > safety/health > finance > maintenance > guest complaints > informational
- Write action-oriented summaries (what to DO, not what happened)
- Include source event IDs on every item

Priority constants:
```typescript
const PRIORITY_ORDER = {
  compliance: 1,
  incident: 2,
  finance: 3,
  maintenance: 4,
  deposit_issue: 5,
  complaint: 6,
  check_in_issue: 7,
  note: 8,
};
```

### Stage 5: GroundingValidator

**Input:** Generated handover + original normalized events
**Output:** Validated handover + data quality warnings

Responsibilities:
- Verify every `sourceEvents` ID exists in the input
- Detect prompt injection patterns (guest notes claiming to be system instructions)
- Flag incomplete entries (missing room, guest, or timestamp)
- Flag timestamp anomalies (event timestamp outside its claimed shift)
- Flag contradictory events (same issue, opposite statuses)
- Add `dataQuality` section to response

## API Contract

### POST /api/handover/generate

Request:
```json
{
  "hotel": {
    "id": "lumen-sg",
    "name": "Lumen Boutique Hotel",
    "rooms": 40,
    "timezone": "+08:00"
  },
  "events": [ /* structured events from events.json */ ],
  "nightLogs": [
    {
      "date": "2026-05-27",
      "content": "Hi all, covering tonight..."
    }
  ],
  "targetDate": "2026-05-30"
}
```

Response:
```json
{
  "hotel": { "id": "lumen-sg", "name": "Lumen Boutique Hotel" },
  "generatedAt": "2026-05-30T07:00:00+08:00",
  "shiftDate": "2026-05-30",
  "shiftWindow": {
    "start": "2026-05-29T23:00:00+08:00",
    "end": "2026-05-30T07:00:00+08:00"
  },
  "handover": {
    "actionRequired": [
      {
        "priority": 1,
        "category": "compliance",
        "summary": "4 passports still unscanned (rooms 204, 207, 210, 211) — scanner now online, 48hr deadline approaching",
        "details": "Immigration scanner back online. Backlog of 4 passports from earlier this week never scanned. Reporting deadline is 48 hours from check-in.",
        "room": null,
        "guest": null,
        "sourceEvents": ["evt_0019", "evt_0009", "evt_0003"],
        "nightsOpen": 4,
        "threadStatus": "still_open"
      }
    ],
    "pending": [],
    "resolved": [],
    "fyi": []
  },
  "dataQuality": {
    "warnings": [
      {
        "type": "contradiction",
        "description": "Room 312 no-show: night log claims charge was applied, but evt_0012 says guest disputes and needs investigation",
        "relatedEvents": ["evt_0010", "evt_0012", "log_0003"]
      }
    ],
    "flaggedEntries": [
      {
        "eventId": "evt_0026",
        "reason": "Prompt injection attempt: guest note contains instructions targeting the handover system",
        "action": "Logged verbatim, not processed as system instruction"
      }
    ],
    "incompleteEntries": [
      {
        "eventId": "evt_0015",
        "missing": ["room", "guest"],
        "note": "Complaint about breakfast but no room or guest identified"
      }
    ]
  }
}
```

## Structured Logging

Every pipeline step emits structured JSON:

```json
{
  "level": "info",
  "hotelId": "lumen-sg",
  "shiftDate": "2026-05-30",
  "step": "event-normalizer",
  "message": "Parsed 7 events from night log text",
  "context": { "nightLogDate": "2026-05-27", "extractedCount": 7 }
}
```

Log levels:
- `info` — normal pipeline progress
- `warn` — data quality issues (contradictions, incomplete entries, anomalies)
- `error` — pipeline failures, unparseable input

## Known Limitations (No-LLM Tradeoffs)

1. **Chinese text:** Entries in Chinese are passed through with `language: "zh"` tag. Extraction is best-effort using basic patterns. Full translation requires LLM.
2. **Free-text parsing:** Regex-based extraction will miss edge cases in unseen night log formats. LLM would generalize better.
3. **Summary generation:** Template-based, not natural language generation. Functional but not polished prose.

## Testing Strategy

- Unit test each pipeline service independently
- Integration test: full pipeline with sample data, verify handover output structure
- Edge cases: empty events, night log only, contradictory events, prompt injection detection

## Out of Scope (Hours 3-6)

- LLM integration for text parsing and summary generation
- Database persistence for historical event tracking
- Multi-hotel support with hotel-specific configurations
- Frontend dashboard
- Webhook/Slack/email delivery
- Rate limiting and authentication
