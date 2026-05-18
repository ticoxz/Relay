## Summary

<!-- What does this PR change? -->

## Relay handoff

- [ ] I ran `relay sync --handoff` (or the pre-commit hook updated it)
- [ ] `.ai-memory/HANDOFF.md` is committed if session context changed
- [ ] `.ai-memory/HANDOFF.json` is committed for agent/CI consumers (optional but recommended)

If this PR does not change AI session context, you can skip handoff updates.

## Test plan

- [ ] `relay doctor` passes (or only expected warnings)
- [ ] ...
