"""Read selected mono PCM from stdin. No media URLs, user paths or credentials."""
import importlib.metadata
import json
import math
import sys

import numpy as np
import srt
import webrtcvad
from ffsubsync.ffsubsync import make_parser, run

VERSION = "0.5.1"
if importlib.metadata.version("ffsubsync") != VERSION:
    raise RuntimeError("Unsupported engine version")
if "--probe" in sys.argv:
    print(VERSION)
    sys.exit(0)


def uncertain(stage="uncertain"):
    print(json.dumps({"stage": stage}), flush=True)
    sys.exit(0)


def align():
    from pathlib import Path
    cues = list(srt.parse(Path("source.srt").read_text(encoding="utf-8-sig")))
    limit = int(sys.argv[1]) * 100
    if len(cues) < 5 or len(cues) > 60000 or any(
        c.start.total_seconds() < 0 or c.end <= c.start
        or c.end.total_seconds() > limit / 100 + 180 for c in cues
    ):
        print('{"stage":"skip-input"}', flush=True)
        uncertain()
    # Apply a per-file hard limit where supported, including any engine output.
    if sys.platform != "win32":
        import resource
        maximum = int(sys.argv[2]) * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_FSIZE, (maximum, maximum))
    vad = webrtcvad.Vad(2)
    speech = bytearray()
    while True:
        frame = sys.stdin.buffer.read(320)  # 10 ms of mono 16-bit PCM at 16 kHz
        if len(frame) < 320:
            break
        if len(speech) >= limit:
            raise ValueError("Audio duration limit")
        speech.append(vad.is_speech(frame, 16000))
        if len(speech) % 3000 == 0:
            print(json.dumps({"stage":"analyzing","seconds":len(speech)//100}), flush=True)
    signal = np.frombuffer(speech, dtype=np.uint8)
    if not len(signal) or not 0.015 < signal.mean() < 0.92:
        uncertain()
    np.save("speech.npy", signal.astype(np.float32))
    print('{"stage":"aligning"}', flush=True)
    args = make_parser().parse_args(["speech.npy", "-i", "source.srt", "-o", "aligned.srt",
        "--max-offset-seconds", "180", "--parallel-workers", "1",
        "--skip-infer-framerate-ratio", "--encoding", "utf-8"])
    result = run(args)
    if not result.get("sync_was_successful"):
        uncertain()
    scale = result["framerate_scale_factor"]
    shift = result["offset_seconds"]
    if not math.isfinite(scale) or not 0.94 <= scale <= 1.06 or not math.isfinite(shift) or abs(shift) > 180:
        uncertain()
    print('{"stage":"validating"}', flush=True)
    # Compare local speech overlap against nearby alternate timings in distinct
    # dialogue regions. A global match with inconsistent local lags can be a cut.
    mask = np.zeros(len(signal), dtype=bool)
    for cue in cues:
        a, b = [round((t.total_seconds() * scale + shift) * 100)
                for t in (cue.start, cue.end)]
        if b > 0 and a < len(mask):
            mask[max(0,a):min(len(mask),b)] = True
    active = np.flatnonzero(mask)
    if len(active) < 200:
        uncertain()
    supported = 0
    for samples in np.array_split(active, 4):
        a, b = int(samples[0]), int(samples[-1])+1
        start, end = max(0,a-250), min(len(mask),b+250)
        sub = mask[start:end].astype(float)
        if sub.std() < .12:
            continue
        def score(lag):
            left, right = max(start, -lag), min(end,len(signal)-lag)
            if right-left < 100:
                return -1.
            x = mask[left:right].astype(float)
            y = signal[left+lag:right+lag]
            if x.std() < .05 or y.std() < .05:
                return -1.
            return float(np.mean((x-x.mean())*(y-y.mean()))/(x.std()*y.std()))
        near = max(score(lag) for lag in range(-40,41,10))
        far = max(score(lag) for lag in range(-1500,1501,25))
        if far > near + .12:
            uncertain("possible-cut")
        if near > .12:
            supported += 1
    if supported < 3:
        uncertain()
    print(json.dumps({"stage":"ready","scale":scale,"shiftMs":round(shift*1000)}), flush=True)


if __name__ == "__main__":
    align()
