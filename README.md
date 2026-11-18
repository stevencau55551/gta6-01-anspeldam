# Azure Bay — An Open-World Crime Story

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/stevencau55551/gta6-01-anspeldam/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/stevencau55551/gta6-01-anspeldam/reward.svg)](https://make.fun/c/gta6-01)

A complete open-world crime game that runs offline in a desktop browser, built
for make.fun's **gta6-01** bounty ("Make GTA 6"). Everything is original: the
city of Azure Bay, its characters, vehicles, story, art and sounds. No Rockstar
names, maps, characters or assets.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/index.html` plus its ES modules, all static.

## The game

You are **Rook**, a wheelman new to Azure Bay. **Mara Voss**, the fixer at
Mara's Garage, has four jobs for you — steal a car, run a dockside pickup,
lose a three-star heat, and pull the Azure Job at the national bank. After
the story, the whole bay stays open as free roam.

- **A living city** — five districts (Marina Beach, Downtown, Old Town,
  Industrial, Southside), a road grid with traffic, pedestrians on the
  sidewalks, palms, parks and the bay itself.
- **On foot and by car** — walk, run, steal any car on the street (the owner
  bails out and runs), drive with arcade handling, handbrake and car damage.
- **Wanted level 0–5** — crimes raise the heat; ABPD cruisers chase and ram
  you, foot cops try to arrest you, armed cops open fire at three stars and
  up. Break line of sight and stay clean to cool off.
- **Missions + story** — four sequential jobs with objective markers, a
  countdown, dialogue from Mara and cash rewards.
- **Combat** — punch up close, pistol with ammo and reload, pickups for
  health, ammo and cash.
- **HUD + minimap** — health, cash, ammo, wanted stars, objective banner,
  live minimap with mission and police blips, speedometer while driving.
- **Start screen, pause menu, save/load** — progress autosaves to
  localStorage; continue from the title screen.
- **Sound** — engine hum, two-tone sirens, gunshots, crashes and a bassline,
  all synthesized with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Run |
| E | Enter or exit a car / interact |
| F | Punch |
| Click | Shoot (aim with the mouse) |
| R | Reload |
| Space | Handbrake (while driving) |
| Esc / P | Pause |
| M | Mute |

## Layout

- `game/` — the playable game (static files only).
  - `game/index.html` — the page.
  - `game/src/config.js` — tuning, city layout, the story data.
  - `game/src/random.js` — seeded RNG.
  - `game/src/city.js` — city generation + collision.
  - `game/src/input.js` — keyboard + mouse.
  - `game/src/audio.js` — synthesized WebAudio sound.
  - `game/src/vehicles.js` — car physics + traffic AI.
  - `game/src/people.js` — pedestrians + foot cops.
  - `game/src/police.js` — the wanted system + police chases.
  - `game/src/missions.js` — the story state machine.
  - `game/src/combat.js` — punch, pistol, bullets, pickups.
  - `game/src/world.js` — the world state + one-step rules.
  - `game/src/render.js` — canvas drawing + minimap.
  - `game/src/hud.js` — HUD, menus, overlays.
  - `game/src/save.js` — localStorage save/load.
  - `game/src/shots.js` — the four screenshot scenes (`?shot=`).
  - `game/src/main.js` — boot + game loop.
- `main.ts` — the entrypoint: copies `game/` + `screenshots/` to `/output`
  and writes `dossier.json`.
- `screenshots/` — four real renders of the game in a browser.
- `shots.json` — the screenshot scenes.

## License

MIT — see `LICENSE`.
