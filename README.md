# Aion 2 Character Sheet

A local sheet for an Aion 2 roster. Search a public profile, pin a main and the alts, and keep the day's work on this device.

This program is free software under the GNU General Public License version 3. The game-message framer in `electron/capture/decode.cjs` is our own code. Its layout is informed by the published DBAion2 DPS source, also GPL-3.0, commit `55931aa`.

The public character page supplies the portrait, class, faction, level, title, gear score, combat power, equipment, skills, Daevanion boards, and cosmetics. Gear names use the same grade colors as the game. A visible roster refreshes about every 20 minutes, one character at a time.

You type the Odyle reading. The sheet then adds 15 every 3 hours and stops at the cap: 560, or 840 with Special Quai Membership. Opening a cube subtracts 40. Goals ranks what is due. Pet souls and the next-level total can be typed on the same side of the sheet.

Checklist marks, banks, and goals stay on this device. The sheet does not log into Aion 2, change a character, or mark a task in the game. It does not attach to the client, read game memory, or ask for a PlayNC password. Refresh only reads the public profile. Export is the backup.

## Live Sync (Windows, experimental)

The Windows app can optionally watch your own game traffic with [Npcap](https://npcap.com/). Live Sync follows the account: when a roster character's name shows up in packets, kills and Odyle write to that character and the sheet switches to them.

Install Npcap yourself. If it is missing, the button stays on “Npcap missing” and Odyle plus pet progress stay manual. Turn Live Sync on, enter the game, and run Find Adapter while you move or attack. It listens on every real adapter at once and keeps the one that sees game packets. Another listener such as NotMeter can stay open. The Pets screen lists obtainable pets. Open a portrait to count kills from any mob toward that pet, and to see what you are hitting. An Odyle total is read when it sits beside the 560 or 840 cap. Live Sync does not modify the client, send game commands, or replace the public-profile refresh. Checklist marks stay local.

The first launch walks through the roster, tools, profile, tasks, and goals. With an empty roster that tour uses an example character, and the example is not saved. Clearing the roster starts the tour again.

## Roster

Six slots on a server: four free, and two gold slots for characters bought with premium currency. An empty slot opens search. An exact name is ranked ahead of a fuzzy match, and each hit shows its class icon.

The profile row puts the portrait first, then the name and title, then Gear Score and Combat Power, then the mount and wings. Class, faction, and level sit on the bottom of the card.

## What you track

Dailies, weeklies, and a seasonal tab. A task shared by the server is one row for that server. Each character keeps a color, so a tick on one shows on the others.

Clocks use Asia/Manila. The daily reset is 15:00. The weekly reset is Wednesday at 15:00.

- Nightmare adds 2 a day and holds 14. It is spent only on a clear.
- Dimension keys add 1 a day and hold 7. Shugo Festival keys add 3 a day and hold 12, or 21 with membership.
- Transcendence adds one charge every 12 hours and holds 14. It is on the main from item level 1,600.
- Spacetime Rift follows about a 3 hour cycle.
- The Abyss is 7 hours a week on the main once item level reaches 1,400. Membership does not add hours.
- Wind Breeze Odyle is 20 per character for members during the server transfer.
- Daily Dungeon is 14 entries for the server this week and does not carry past Wednesday.
- Open world Qina is marked when that character has reached 1 million.

Under item level 1,400, raid rows stay hidden and field bosses sit with the lowest character who is still gearing. Krao Cave and Urugugu Canyon are for those gearing characters. Ascension Trial, Abyss Corridor, and subjugation tickets are weekly and do not bank past Wednesday.

Seasonal rows follow the current events. Halloween tasks and the pumpkin shop run through the November 4 maintenance. The Halloween chest is once per server for the whole event and does not reset on Wednesday. Conquerors rift stones are 7 per character per week, at 50,000 Kina each, through the October 28 maintenance. A later update can remove a finished seasonal task. That only hides the row. The rest of the save stays.

## Windows

Install Aion 2 Progress from the [latest release](https://github.com/eiruuru/aion2-char-sheet/releases). The window title and the top bar show the installed version. Opening the app checks GitHub. When a newer release exists, a card shows that release's notes, with a choice to stay on the current version or install the new one. The check button in the top bar runs the same check again.

The roster and the "keep this window above the game" setting are saved in `%APPDATA%\Aion 2 Progress`. An update replaces the program and leaves that folder alone. If an older copy left `aion2-tracker.json` or `aion2-window.json` beside the exe, the first launch copies them into that folder.

Export writes a dated backup. Import replaces the roster on this device.

## Develop

```bash
npm install
npm test
npm run dev
```

The browser app is at http://localhost:5173. Browser saves stay in local storage under `aion2-tracker-v1`. The finished-tour flag is a separate key, `aion2-onboarding-v1`, so clearing it is not the same as clearing characters.

`npm run dist:windows` builds the Windows installer into `release/`. Publishing a `v*` tag on GitHub runs the Windows release workflow.
