# Aion 2 progress

A local tracker for an Aion 2 roster. It shows what is worth doing today, then keeps a checklist, gear, skills, Daevanion boards, and cosmetics for each character.

Character names, item level, combat power, equipment, skills, Daevanion nodes, and cosmetics come from the public character pages. The app refreshes a visible roster about every 20 minutes, one character at a time.

Odyle, Qina, and the other wallet numbers are typed in. After you set a reading, the app counts forward on that clock:

- Odyle refills on its 3 hour timer, and pauses at the cap.
- Nightmare, Shugo, and Dimension keys gain at the 15:00 Asia/Manila reset, up to their caps.
- Conquest charges gain every 8 hours, and Transcendence points every 12 hours.
- Daily tasks reset at 15:00 Asia/Manila. Weekly tasks reset Wednesday at 15:00.

The window can stay above the game. It does not attach to the Aion 2 client, read game memory, or ask for a PlayNC password.

## Windows download

Unzip [download/Aion2-Progress-windows.zip](download/Aion2-Progress-windows.zip) and run `Aion2Progress.exe`. The folder also contains the runtime files the exe needs. Keep those files together.

The save is `aion2-tracker.json` in the same folder as the exe. Export and import are still in the window if you want a dated backup.

“Keep this window above the game” is stored in `aion2-window.json` beside the exe.

## What the checklist covers

Today groups the open tasks, with a portrait for each character who still needs that task. Under item level 1400, raid and Transcendence rows stay hidden. Field bosses sit with the lowest character who is still under 1400. Transcendence is on the main once item level reaches 1600.

Shared runs keep a color for each character, so a tick on one character shows on the others. Nightmare, Shugo, and Dimension show one box for each entry still in the bank. Daily Dungeon shows the week’s 14 entries.

## Develop

```bash
npm install
npm test
npm run dev
```

The browser app is at http://localhost:5173. Browser saves stay in local storage under `aion2-tracker-v1`.

`npm run dist:windows` rebuilds the Windows zip. That command is meant to be run from this project, and it writes `release/` plus a copy at `download/Aion2-Progress-windows.zip`.
