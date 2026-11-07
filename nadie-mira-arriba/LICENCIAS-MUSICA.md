# Nadie Mira Arriba — music licenses

These six loops are the music stems from `nadie-mira-arriba-ingame-audio.zip`.
Short game cues (shot, jump, pickup, and the rest) stay synthesized at runtime
and were not copied from that pack. OGG is the file to play. MP3 is the
fallback when a browser cannot play Vorbis.

## Files

| File | Where it plays | Loop |
| --- | --- | --- |
| `music_title.ogg` / `.mp3` | Title | yes, whole file |
| `music_feria.ogg` / `.mp3` | Act I, La Feria | yes, whole file |
| `music_cocina.ogg` / `.mp3` | Act II, La Cocina | yes, whole file |
| `music_casino.ogg` / `.mp3` | Act III, La Casa | yes, whole file |
| `music_servidor.ogg` / `.mp3` | Act IV, La Sala | yes, whole file |
| `music_el_cielo.ogg` / `.mp3` | Ending, after the last look-up | no — stop when it ends |

Loop start is sample 0 and the loop end is the decoded buffer, so a player
that loops the whole file matches the pack. The ending stem is not a loop.

## Rights

Original procedural synthesis. No samples, soundfonts, field recordings,
voices, downloaded scores, or third-party melodies. The arrangements and
rendered audio are supplied under MIT, to the extent rights exist. Commercial
use, editing, and sale inside this game are permitted. Keep this notice with
the files. This is not a warranty that machine-generated audio is copyrightable.

```
MIT License

Copyright (c) 2026 Gringo — lotee procedural soundtrack source

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Tools that made the files (not bundled)

| Tool | License | Why it is safe to ship the audio |
| --- | --- | --- |
| CPython 3.13 | PSF License v2 | Interpreter was not embedded in the audio. |
| NumPy 2.5 | BSD-3-Clause | Used as numbers, not as a sampled library. Not redistributed. |
| FFmpeg 7.1 | LGPL-2.1, this build also GPL | Encoder is not bundled. Its license does not cover the audio. |
| libvorbis 1.3.7 / libogg 1.3.5 | BSD-style | Only the encoded OGG ships, not the library. |
| LAME 3.100 | LGPL | Only the encoded MP3 ships, not the library. |

No tool binary ships with the game. Runtime playback needs only these files.
