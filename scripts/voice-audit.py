"""
Decible voice audit — TRANSCRIPTION-BASED truth test.

Sends a checkpointed script to every voice, transcribes what actually comes
back, and reports how much of the input was really spoken. No duration
heuristics: the transcript is the evidence.

  TARGET_CHARS=5000 ONLY_ENGINE=fish LIMIT=5 python voice-audit.py

Env: KIEAI_API_KEY, FISH_AUDIO_API_KEY (read from .env.local)
Output: /tmp/decible-voice-audit/results.csv  (appended, resumable)
"""
import csv, json, os, re, ssl, sys, time, urllib.request

ROOT = "/Users/mohitjethani/Downloads/NMM VO APP"
WORK = "/tmp/decible-voice-audit"
ctx  = ssl.create_default_context()
os.makedirs(WORK, exist_ok=True)

def env(k):
    for line in open(f"{ROOT}/.env.local"):
        if line.startswith(k + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None

KIE, FISH = env("KIEAI_API_KEY"), env("FISH_AUDIO_API_KEY")

NUMS = ["one","two","three","four","five","six","seven","eight","nine","ten",
        "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen",
        "eighteen","nineteen","twenty","twentyone","twentytwo","twentythree",
        "twentyfour","twentyfive","twentysix","twentyseven","twentyeight",
        "twentynine","thirty","thirtyone","thirtytwo","thirtythree","thirtyfour",
        "thirtyfive","thirtysix","thirtyseven","thirtyeight","thirtynine","forty",
        "fortyone","fortytwo","fortythree","fortyfour","fortyfive","fortysix",
        "fortyseven","fortyeight","fortynine","fifty"]
FILLER = ("The morning light moved across the quiet valley while the river carried "
          "small boats toward the harbour and the market slowly came alive. ")

def build_text(target):
    parts, i = [], 0
    while len("".join(parts)) < target and i < len(NUMS):
        parts.append(f"Checkpoint {NUMS[i]}. {FILLER}")
        i += 1
    t = "".join(parts)[:target]
    return (t[:t.rfind(".")+1] if "." in t else t)

WORD2NUM = {w: i + 1 for i, w in enumerate(NUMS)}
# ASR renders "Checkpoint twentyone" as "Check Point 21" (split words, digits),
# so accept a digit OR a spelled-out word, with or without the internal space.
CKPT_RE = re.compile(r"check\s*point\s+(\d{1,2}|[a-z]+(?:\s+[a-z]+)?)")

def markers_in(text):
    low = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text.lower()))
    found = set()
    for m in CKPT_RE.finditer(low):
        tok = m.group(1).strip()
        if tok.isdigit():
            n = int(tok)
            if 1 <= n <= len(NUMS):
                found.add(n)
            continue
        parts = tok.split()
        # "twenty one" -> twentyone ; else fall back to the first word ("one")
        joined = "".join(parts[:2])
        if len(parts) >= 2 and joined in WORD2NUM:
            found.add(WORD2NUM[joined])
        elif parts and parts[0] in WORD2NUM:
            found.add(WORD2NUM[parts[0]])
    return sorted(found)

def gen_gemini(text, voice_name, poll_s=420):
    body = {"model":"google/gemini-3-1-flash-tts","input":{
        "speakers":[{"speaker_id":"Speaker 1","voice_name":voice_name,"pace":"Natural"}],
        "dialogue_turns":[{"speaker_id":"Speaker 1","text":text}]}}
    req = urllib.request.Request("https://api.kie.ai/api/v1/jobs/createTask",
        data=json.dumps(body).encode(),
        headers={"Authorization":f"Bearer {KIE}","Content-Type":"application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=60, context=ctx))
    if r.get("code") != 200:
        raise RuntimeError(f"create: {r.get('msg')}")
    tid = r["data"]["taskId"]
    deadline = time.time() + poll_s
    while time.time() < deadline:
        time.sleep(3)
        s = json.load(urllib.request.urlopen(urllib.request.Request(
            f"https://api.kie.ai/api/v1/jobs/recordInfo?taskId={tid}",
            headers={"Authorization":f"Bearer {KIE}"}), timeout=60, context=ctx))
        st = s.get("data", {}).get("state")
        if st == "success":
            url = json.loads(s["data"]["resultJson"])["resultUrls"][0]
            return urllib.request.urlopen(urllib.request.Request(
                url, headers={"User-Agent":"Mozilla/5.0"}), timeout=300, context=ctx).read()
        if st == "fail":
            raise RuntimeError(f"{s['data'].get('failCode')}: {s['data'].get('failMsg')}")
    raise RuntimeError(f"timeout after {poll_s}s")

def gen_fish(text, ref_id):
    if not FISH:
        raise RuntimeError("FISH_AUDIO_API_KEY not set")
    body = {"text":text,"reference_id":ref_id,"format":"wav","sample_rate":44100,
            "latency":"normal","prosody":{"speed":1.0,"volume":0}}
    req = urllib.request.Request("https://api.fish.audio/v1/tts",
        data=json.dumps(body).encode(),
        headers={"Authorization":f"Bearer {FISH}","Content-Type":"application/json",
                 "model":os.environ.get("FISH_TTS_MODEL","s2.1-pro-free")})
    return urllib.request.urlopen(req, timeout=900, context=ctx).read()

_model = None
def transcribe(path):
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel("base", device="cpu", compute_type="int8")
    segs, _ = _model.transcribe(path, beam_size=1, vad_filter=False)
    return " ".join(s.text for s in segs).strip()

def load_voices():
    src = open(f"{ROOT}/src/lib/voices-data.ts").read()
    g0, g1 = src.index("export const GEMINI_VOICES"), src.index("// FISH AUDIO")
    f0, f1 = src.index("export const FISH_VOICES"),   src.index("// The full catalog")
    out = []
    for blk, eng in ((src[g0:g1], "gemini"), (src[f0:f1], "fish")):
        for line in blk.splitlines():
            m = re.search(r"id:\s*'([^']+)'.*?voiceName:\s*'([^']+)'", line)
            if not m:
                continue
            ref  = re.search(r"fishReferenceId:\s*'([^']+)'", line)
            lang = re.search(r"language:\s*'([^']+)'", line)
            out.append({"id":m.group(1), "voiceName":m.group(2), "engine":eng,
                        "ref":ref.group(1) if ref else None,
                        "language":lang.group(1) if lang else "English"})
    return out

def main():
    target = int(os.environ.get("TARGET_CHARS", "5000"))
    only   = os.environ.get("ONLY_ENGINE")
    limit  = int(os.environ.get("LIMIT", "0"))
    voices = load_voices()
    if only:  voices = [v for v in voices if v["engine"] == only]
    if limit: voices = voices[:limit]

    text = build_text(target)
    sent = markers_in(text)
    total = max(sent) if sent else 0
    print(f"# text {len(text)} chars, {total} checkpoints | {len(voices)} voices", flush=True)

    path = os.environ.get("RESULTS_FILE", f"{WORK}/results.csv")
    done = set()
    if os.path.exists(path):
        for row in csv.DictReader(open(path)):
            done.add((row["voice_id"], row["sent_chars"]))
    new = not os.path.exists(path)
    fh = open(path, "a", newline=""); w = csv.writer(fh)
    if new:
        w.writerow(["voice_id","engine","language","sent_chars","transcript_chars",
                    "last_checkpoint","total_checkpoints","coverage_pct","secs","status","detail"])
        fh.flush()

    for i, v in enumerate(voices, 1):
        if (v["id"], str(len(text))) in done:
            print(f"[{i}/{len(voices)}] {v['id']:<22} skip (already done)", flush=True); continue
        t0 = time.time()
        try:
            audio, last_err = None, None
            for attempt in range(3):
                try:
                    audio = gen_gemini(text, v["voiceName"]) if v["engine"] == "gemini" \
                            else gen_fish(text, v["ref"])
                    break
                except Exception as e:
                    last_err = e
                    if "insufficient" in str(e).lower():
                        raise
                    time.sleep(5 * (attempt + 1))
            if audio is None:
                raise last_err
            wav = f"{WORK}/_a_{v['engine']}.wav"
            open(wav, "wb").write(audio)
            tr = transcribe(wav)
            open(f"{WORK}/tx_{v['id']}.txt", "w").write(tr)
            got = markers_in(tr)
            last = max(got) if got else 0
            cov  = round(100.0 * last / total, 1) if total else 0
            status = "OK" if cov >= 95 else ("TRUNCATED" if cov > 0 else "NO_SPEECH")
            w.writerow([v["id"],v["engine"],v["language"],len(text),len(tr),last,total,
                        cov,round(time.time()-t0,1),status,""])
            print(f"[{i}/{len(voices)}] {v['id']:<22} {v['engine']:<7} "
                  f"got={len(tr):<6} ckpt={last}/{total} cov={cov}% {status}", flush=True)
        except Exception as e:
            w.writerow([v["id"],v["engine"],v["language"],len(text),0,0,total,0,
                        round(time.time()-t0,1),"FAILED",str(e)[:200]])
            print(f"[{i}/{len(voices)}] {v['id']:<22} {v['engine']:<7} FAILED — {str(e)[:110]}", flush=True)
        fh.flush()
    fh.close()
    print("\ndone ->", path, flush=True)

if __name__ == "__main__":
    main()
