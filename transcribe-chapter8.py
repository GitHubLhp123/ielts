import os
import json
import sys
import time
import whisper

ROOT = "/Users/lhp/Desktop/codeProject/ielts-dev/listening-word/chapter8"
SUMMARY_FILE = os.path.join(ROOT, "transcripts.json")
LANGUAGE = "en"
MODEL_NAME = "large"
DEVICE = "cpu"


def collect_mp3s(root):
    items = []
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            if f.lower().endswith(".mp3"):
                items.append(os.path.join(dirpath, f))
    items.sort()
    return items


def load_summary(path):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_summary(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    mp3_files = collect_mp3s(ROOT)
    print(f"共发现 {len(mp3_files)} 个 mp3")

    summary = load_summary(SUMMARY_FILE)
    pending = []
    for p in mp3_files:
        txt_path = os.path.splitext(p)[0] + ".txt"
        rel = os.path.relpath(p, ROOT)
        if os.path.exists(txt_path) and rel in summary:
            continue
        pending.append(p)

    print(f"待转写 {len(pending)} 个 (已完成 {len(mp3_files) - len(pending)})")
    if not pending:
        print("无需处理")
        return

    print(f"加载 whisper 模型: {MODEL_NAME} on {DEVICE} ...")
    t0 = time.time()
    model = whisper.load_model(MODEL_NAME, device=DEVICE)
    print(f"模型加载完成 ({time.time() - t0:.1f}s)")

    for idx, mp3 in enumerate(pending, 1):
        rel = os.path.relpath(mp3, ROOT)
        txt_path = os.path.splitext(mp3)[0] + ".txt"
        print(f"[{idx}/{len(pending)}] {rel}", flush=True)

        t0 = time.time()
        try:
            result = model.transcribe(mp3, language=LANGUAGE, fp16=False)
        except Exception as e:
            print(f"  失败: {e}", file=sys.stderr)
            continue

        text = result.get("text", "").strip()
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text + "\n")

        summary[rel] = {
            "text": text,
            "segments": [
                {"start": s.get("start"), "end": s.get("end"), "text": s.get("text", "").strip()}
                for s in result.get("segments", [])
            ],
            "duration_sec": round(time.time() - t0, 2),
        }
        save_summary(SUMMARY_FILE, summary)
        print(f"  用时 {summary[rel]['duration_sec']}s, 字数 {len(text)}")

    print(f"全部完成,汇总: {SUMMARY_FILE}")


if __name__ == "__main__":
    main()
