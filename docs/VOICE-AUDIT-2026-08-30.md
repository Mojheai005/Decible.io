# Voice engine audit — 2026-08-30

Method: scripts/voice-audit.py sends a 4,888-char script with 32 numbered
checkpoints, then TRANSCRIBES the returned audio (faster-whisper) and counts
how many checkpoints were actually spoken. Ground truth, not a duration guess.

## Gemini (Kie.ai, google/gemini-3-1-flash-tts) — 21 of 30 TRUNCATED

| voice | checkpoints | coverage |
|---|---|---|
| zubenelgenubi | 3/32 | 9.4% |
| aoede | 7/32 | 21.9% |
| orus | 7/32 | 21.9% |
| puck | 7/32 | 21.9% |
| alnilam | 8/32 | 25.0% |
| sadachbia | 8/32 | 25.0% |
| callirrhoe | 12/32 | 37.5% |
| autonoe | 13/32 | 40.6% |
| gacrux | 13/32 | 40.6% |
| pulcherrima | 14/32 | 43.8% |
| fenrir | 15/32 | 46.9% |
| kore | 15/32 | 46.9% |
| zephyr | 15/32 | 46.9% |
| despina | 16/32 | 50.0% |
| charon | 17/32 | 53.1% |
| schedar | 18/32 | 56.2% |
| erinome | 19/32 | 59.4% |
| achird | 20/32 | 62.5% |
| umbriel | 26/32 | 81.2% |
| iapetus | 29/32 | 90.6% |
| laomedeia | 29/32 | 90.6% |
| achernar | 31/32 | 96.9% |
| enceladus | 31/32 | 96.9% |
| rasalgethi | 31/32 | 96.9% |
| algenib | 32/32 | 100.0% |
| algieba | 32/32 | 100.0% |
| leda | 32/32 | 100.0% |
| sadaltager | 32/32 | 100.0% |
| sulafat | 32/32 | 100.0% |
| vindemiatrix | 32/32 | 100.0% |

## Fish Audio (s2.1-pro) — 8 of 8 PERFECT

| voice | checkpoints | coverage |
|---|---|---|
| fish-katya | 32/32 | 100.0% |
| fish-sarah | 32/32 | 100.0% |
| fish-ellie | 32/32 | 100.0% |
| fish-laila | 32/32 | 100.0% |
| fish-evan | 32/32 | 100.0% |
| fish-adrian | 32/32 | 100.0% |
| fish-mateo | 32/32 | 100.0% |
| fish-verity | 32/32 | 100.0% |

Run stopped at 8/80 by request once the pattern was unambiguous.

## Non-determinism (the decisive finding)

Same voice, same 939-char text, four consecutive runs:

```
Charon:  100%,  71.4%, 100%,  100%
Orus:    100%, 100%,  100%,   57.1%
```

Truncation is random, not length-based. No character ceiling makes Gemini
safe, and duration-based detection cannot catch mild cases: an 85.7%
truncation measured 15.7 chars/sec, healthy speech measures 15.4.

## Re-audit, 7 September 2026 — same voices, same script, one week apart

Run twice to test whether the per-voice figures were stable. They are not.

| | 30 Aug | 7 Sep |
|---|---|---|
| voices scoring 100%/OK | 9/30 | 8/30 |

- **9 of 30 voices (30%) flipped verdict** between the two runs
- **mean swing 28.1 percentage points**
- largest swing **enceladus: 78.1 points**
- only **4 of 30 voices** passed both runs

### What this means

The AGGREGATE is reproducible: roughly two-thirds of Gemini voices truncate on
any given run (21/30, then 22/30). That conclusion is solid.

The PER-VOICE numbers are not. They are single samples of a random process, so
a table naming the 'worst' voices is misleading — `sadaltager` scored 100% then
34.4%; `enceladus` 96.9% then 18.8%. No Gemini voice can be called safe.

| voice | 30 Aug | 7 Sep | swing |
|---|---|---|---|
| `enceladus` | 96.9% | 18.8% | -78.1 |
| `aoede` | 21.9% | 90.6% | +68.7 |
| `sadaltager` | 100.0% | 34.4% | -65.6 |
| `autonoe` | 40.6% | 96.9% | +56.3 |
| `fenrir` | 46.9% | 100.0% | +53.1 |
| `sulafat` | 100.0% | 46.9% | -53.1 |
| `orus` | 21.9% | 75.0% | +53.1 |
| `erinome` | 59.4% | 18.8% | -40.6 |
| `algieba` | 100.0% | 62.5% | -37.5 |
| `callirrhoe` | 37.5% | 75.0% | +37.5 |
| `charon` | 53.1% | 87.5% | +34.4 |
| `umbriel` | 81.2% | 46.9% | -34.3 |
| `puck` | 21.9% | 53.1% | +31.2 |
| `sadachbia` | 25.0% | 56.2% | +31.2 |
| `gacrux` | 40.6% | 15.6% | -25.0 |
| `pulcherrima` | 43.8% | 21.9% | -21.9 |
| `despina` | 50.0% | 68.8% | +18.8 |
| `achird` | 62.5% | 81.2% | +18.7 |
| `zubenelgenubi` | 9.4% | 28.1% | +18.7 |
| `schedar` | 56.2% | 37.5% | -18.7 |
| `algenib` | 100.0% | 84.4% | -15.6 |
| `iapetus` | 90.6% | 100.0% | +9.4 |
| `laomedeia` | 90.6% | 100.0% | +9.4 |
| `zephyr` | 46.9% | 50.0% | +3.1 |
| `rasalgethi` | 96.9% | 100.0% | +3.1 |
| `leda` | 100.0% | 96.9% | -3.1 |
| `vindemiatrix` | 100.0% | 96.9% | -3.1 |
| `achernar` | 96.9% | 96.9% | +0.0 |
| `alnilam` | 25.0% | 25.0% | +0.0 |
| `kore` | 46.9% | 46.9% | +0.0 |
