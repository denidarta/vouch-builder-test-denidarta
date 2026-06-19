# Agents

## AI Usage in This Project

This project was built with Claude Code (Claude Sonnet 4.6) as a pair programming partner.

### How AI was used

- **Planning:** AI helped design the 5-stage pipeline architecture and identify the data traps in the sample data before writing code.
- **Scaffolding:** NestJS project setup, middleware wiring, module registration — boilerplate that benefits from speed over creativity.
- **Pattern generation:** Regex patterns for night log parsing (room extraction, type classification, language detection, status inference).
- **Test writing:** Test fixtures and assertions for all pipeline services.
- **Debugging:** Traced pipeline issues like night log events not joining threads (null timestamp → shift grouper dropped them).

### Where AI helped most

- NestJS boilerplate and module wiring
- Structured logging patterns with correlation IDs
- Regex patterns for multi-format text extraction
- Test scaffolding and fixture generation
- Identifying edge cases in the data traps

### Where AI got in the way

- Generated overly conservative regex that missed non-Western room number formats (e.g., `312 那个`)
- Named the data quality service "GroundingValidatorService" — technically correct but vague. Renamed after reflection.
- Initial shift grouper silently dropped night log events (null timestamps). The generated code was correct for its narrow spec but wrong for the full pipeline.

### Grounding strategy

Every handover statement traces to source event IDs. The DataQualityService cross-checks all citations against input events. Prompt injection detection catches guest-submitted text mimicking system commands. Contradictions are flagged, never resolved. No LLM is used — the service cannot generate text that isn't in the input.
