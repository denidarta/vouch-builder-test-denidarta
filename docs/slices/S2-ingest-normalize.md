# S2: Ingest + Normalize Events

**Time budget:** ~25min
**Depends on:** S1
**Ships:** Endpoint now parses both JSON events and free-text night logs into unified normalized event list

## Done When

- [ ] `EventNormalizerService` parses structured JSON events
- [ ] `EventNormalizerService` extracts structured events from free-text night logs
- [ ] Non-English entries tagged with `language` field
- [ ] Synthetic IDs assigned to text-extracted events (`log_NNNN`)
- [ ] Low-confidence extractions flagged
- [ ] Unit tests for normalizer

## Normalized Event Interface

```typescript
interface NormalizedEvent {
  id: string;                           // evt_XXXX or log_XXXX
  source: 'system' | 'night_log';
  timestamp: string | null;
  type: string;
  room: string | null;
  guest: string | null;
  description: string;
  status: 'resolved' | 'unresolved' | 'pending';
  rawText?: string;
  language?: string;
  confidence: 'high' | 'low';
}
```

## Night Log Parsing Strategy

Rule-based extraction (no LLM):
1. Split text by line breaks and bullet points
2. Match room numbers: `/room\s*(\d{3})/i`
3. Match guest names: `/mr\.?\s+(\w+)|ms\.?\s+(\w+)/i` or context-based
4. Classify type by keywords: "aircon"→maintenance, "deposit"→deposit_issue, "leak"→facilities, etc.
5. Detect language: check for CJK character ranges → tag as `language: "zh"`
6. Entries that don't parse cleanly → `confidence: "low"`, keep raw text

## Key Edge Cases

- Chinese text entries (lines 19, 27 in night-logs.md)
- Entries referencing previous events ("the no-show from last night")
- Entries with no room number ("wifi complaint, couldn't catch room")
- Casual/incomplete entries ("coffee machine acting up")
