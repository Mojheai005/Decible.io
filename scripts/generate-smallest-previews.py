"""Generate a ~6 second MP3 preview for every Smallest.ai Lightning v3.1 Pro voice.

Their API ships no preview audio (verified: zero audio URLs in get_voices), so
previews have to be produced once and committed, same as the Fish voices.

Identical script for every voice on purpose — it lets a user A/B two voices on
the same words instead of guessing across different sentences.

  python3 scripts/generate-smallest-previews.py [--force]
"""
import json, os, ssl, sys, threading, time, urllib.request, urllib.error
from queue import Queue

ROOT = "/Users/mohitjethani/Downloads/NMM VO APP"
OUT  = f"{ROOT}/public/previews-smallest"
ctx  = ssl.create_default_context()
FORCE = "--force" in sys.argv
WORKERS = 4          # modest: enough to be quick, gentle on their rate limits

KEY = None
for line in open(f"{ROOT}/.env.local"):
    if line.startswith("SMALLEST_API_KEY="):
        KEY = line.split("=", 1)[1].strip().strip('"').strip("'")

os.makedirs(OUT, exist_ok=True)
voices = json.load(open("/tmp/smallest_pro_voices.json"))

def preview_text(name):
    # ~90 chars lands around 6 seconds at a natural pace.
    return (f"Hi, I'm {name}. This is how I sound. "
            f"Clear, natural, and ready for your next voiceover.")

def synth(voice_id, text):
    body = {"text": text, "voice_id": voice_id, "model": "lightning_v3.1_pro",
            "output_format": "mp3", "sample_rate": 24000, "speed": 1.0, "language": "en"}
    req = urllib.request.Request(f"https://api.smallest.ai/waves/v1/tts",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=180, context=ctx).read()

q = Queue()
for v in voices:
    q.put(v)

lock = threading.Lock()
done = {"ok": 0, "skip": 0, "fail": 0, "bytes": 0}
failures = []

def worker():
    while True:
        try:
            v = q.get_nowait()
        except Exception:
            return
        vid = v["voiceId"]
        path = f"{OUT}/sm-{vid}.mp3"
        try:
            if os.path.exists(path) and os.path.getsize(path) > 1000 and not FORCE:
                with lock: done["skip"] += 1
                continue
            audio = None
            for attempt in range(3):
                try:
                    audio = synth(vid, preview_text(v.get("displayName") or vid))
                    break
                except urllib.error.HTTPError as e:
                    if e.code in (429, 500, 502, 503) and attempt < 2:
                        time.sleep(2 * (attempt + 1)); continue
                    raise
            if not audio or len(audio) < 1000:
                raise RuntimeError("empty audio")
            open(path, "wb").write(audio)
            with lock:
                done["ok"] += 1; done["bytes"] += len(audio)
                n = done["ok"] + done["skip"] + done["fail"]
                if n % 20 == 0:
                    print(f"  {n}/{len(voices)}  ok={done['ok']} skip={done['skip']} fail={done['fail']}", flush=True)
        except Exception as e:
            with lock:
                done["fail"] += 1; failures.append((vid, str(e)[:120]))
        finally:
            q.task_done()

print(f"generating previews for {len(voices)} Lightning v3.1 Pro voices -> {OUT}", flush=True)
t0 = time.time()
threads = [threading.Thread(target=worker, daemon=True) for _ in range(WORKERS)]
for t in threads: t.start()
for t in threads: t.join()

print(f"\nok {done['ok']} | skipped {done['skip']} | failed {done['fail']} "
      f"| {done['bytes']/1024/1024:.1f} MB | {time.time()-t0:.0f}s")
if failures:
    print("\nfailures:")
    for vid, err in failures[:25]:
        print(f"   {vid:<22} {err}")
    json.dump(failures, open("/tmp/smallest_preview_failures.json", "w"))
