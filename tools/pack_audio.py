#!/usr/bin/env python3
"""Pack every sound (assets/audio/voice/*.mp3 and assets/audio/sfx/*.mp3) into one file.

    python3 tools/pack_audio.py OUT_PREFIX      (writes OUT_PREFIX.mp3 (the mp3 files one after another) and OUT_PREFIX.json (where each one starts))

The game loads the pack instead of the single files when the page sets
window.AUDIO_PACK = 'OUT_PREFIX' (relative to the page) before src/main.js runs.
Used for hosts that limit the number of files (the claude.ai preview); the repo itself
keeps the single files.
"""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = sys.argv[1]
    idx, off = {}, 0
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out + '.mp3', 'wb') as b:
        for group in ('voice', 'sfx'):
            d = os.path.join(ROOT, 'assets', 'audio', group)
            for name in sorted(os.listdir(d)):
                if not name.endswith('.mp3'):
                    continue
                data = open(os.path.join(d, name), 'rb').read()
                b.write(data)
                idx[group + '/' + name[:-4]] = [off, len(data)]
                off += len(data)
    with open(out + '.json', 'w') as f:
        json.dump(idx, f, separators=(',', ':'))
    print(f'{len(idx)} sounds, {off / 1e6:.1f} MB -> {out}.mp3 / {out}.json')


if __name__ == '__main__':
    main()
