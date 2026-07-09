# adam-audio

Audio verzie článkov z [hechtberger.com](https://www.hechtberger.com/blog) — číta Adam,
AI asistent Petra Hechtbergera (Edge-TTS sk-SK-LukasNeural).

- `manifest.json` — slug → { mp3, marks, title, duration }
- `<slug>.mp3` — audio (intro + článok + outro)
- `<slug>.marks.json` — časové značky viet pre zvýrazňovanie textu
- `adam-player.js` — prehrávač (načítava ho footer na hechtberger.com)

Publikovanie nového článku = pridať MP3 + marks + záznam v manifeste a `git push`.
