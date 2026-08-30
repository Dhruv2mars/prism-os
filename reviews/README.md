# Reviews

## What lives here

- `<id>/round-N.json` — critic verdicts. **The durable record.** Every score,
  winner-per-criterion, and named biggest gap is in here.
- `coherence.md`, `coherence-wave2.md` — between-wave integration passes.
- `probe-*/report.json` — raw probe audit output for a given run.

## What does not live here

Screenshots. Probe PNGs run ~800KB each and reached 328MB across 411 files.
They are gitignored and were swept. Regenerate any of them on demand:

```
python3 -m http.server 4310          # serve the repo
bun tools/probe.mjs http://localhost:4310/components/<id>/index.html reviews/probe-<id>-<round>
```

A few verdict JSONs cite probe dirs that held only PNGs and are therefore gone.
The citation is kept as a record of what was probed; rerun the command above to
reproduce the evidence.

## Naming

Name probe output dirs for the piece and round — `probe-03-wm-round1`, not a
timestamp. Bare `probe-<timestamp>/` dirs are gitignored as scratch.
