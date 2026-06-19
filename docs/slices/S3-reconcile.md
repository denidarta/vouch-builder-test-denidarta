# S3: Reconcile Across Nights

**Time budget:** ~25min
**Depends on:** S2
**Ships:** Issues tracked across shifts with status: still_open / newly_resolved / new_tonight

## Done When

- [ ] `ShiftGrouperService` groups events by night shift window (23:00–07:00)
- [ ] `IssueReconcilerService` builds issue threads by room+type
- [ ] Each issue classified: `still_open`, `newly_resolved`, `new_tonight`
- [ ] Contradictions detected and flagged
- [ ] `nightsOpen` count tracked per issue
- [ ] Unit tests for grouper and reconciler

## Shift Window Logic

```
Shift for "morning of May 30" =
  Start: 2026-05-29T23:00:00+08:00
  End:   2026-05-30T07:00:00+08:00
```

All prior shifts are loaded for reconciliation context.

## Thread Key Strategy

Build thread key from `room + type`:
- `112:maintenance` → aircon issue thread
- `309:deposit_issue` → deposit thread
- `null:compliance` → immigration scanner thread

For room-less events, use `type` + key description words.

## Reconciliation Logic

```
for each issue in currentShift:
  if issue.threadKey exists in priorShifts:
    if latestStatus == 'resolved': → newly_resolved
    else: → still_open (increment nightsOpen)
  else:
    → new_tonight
```

## Contradiction Detection

Flag when same thread has conflicting info:
- Room 312: night log says "charged", evt_0012 says "guest disputes, needs investigation"
- Any thread where status flips without clear resolution event

## Known Issue Threads in Sample Data

| Thread | First seen | Current state |
|--------|-----------|---------------|
| 112:maintenance (aircon) | May 26 | still_open — part arrived, repair Sat |
| 309:deposit_issue | May 27 | still_open — never collected |
| compliance:scanner | May 26 | still_open — 4 passports backlogged |
| 312:no_show | May 27 | contradiction — charged vs disputed |
| 215:facilities (leak) | May 27 | resolved May 29 |
| 205:occupancy | May 28 (log) | new — possible ghost checkout |
