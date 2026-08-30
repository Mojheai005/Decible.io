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
