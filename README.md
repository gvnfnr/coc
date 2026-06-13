# Clash of Canvas

A complete, playable **Clash of Clans–style** strategy game built entirely with
**HTML5 Canvas** and vanilla JavaScript — no frameworks, no build step, and no
external art assets. All graphics are drawn as cartoonish 2.5D isometric vector
shapes on a single canvas.

## Play it

Just open `index.html` in any modern browser — that's it.

Or serve it locally (recommended):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Progress is saved automatically to your browser's `localStorage`, so your
village, resources, and building levels survive reloads. Use the **Reset**
button to start a brand-new village.

## How to play

### Your Village (Home mode)
- **Collect resources** — Gold Mines and Elixir Collectors fill up over time.
  Click a resource building (or the **Collect** button) to bank the loot into
  your storages.
- **Build** (`B`) — open the build menu and pick a structure. Drag to position
  the green ghost, then click to place it. Right-click or `Esc` cancels.
- **Upgrade** — click any building to open its panel. Upgrades cost resources
  and take in-game time (with a live countdown). You can rush a timer with Gems.
- **Move** — select a building and hit *Move* to relocate it.
- **Train troops** (`A`) — open the Army menu to queue Barbarians, Archers, and
  Giants (unlocked by upgrading your Barracks). Troops are housed in Army Camps.

### Battle mode
- Hit **Attack!** to raid a procedurally generated enemy base.
- Pick a troop from the bottom tray, then click the map to **deploy** it.
- Troops auto-path to the nearest building and attack; **Giants** prioritize
  defenses. **Cannons** and **Archer Towers** fire back at your troops.
- Destroy buildings to grab **loot** (Gold/Elixir) and earn **stars**:
  - ★ for ≥50% destruction
  - ★ for destroying the Town Hall
  - ★ for 100% destruction
- The battle ends on total destruction, when your army is wiped, or when the
  timer runs out. The **Battle Result** screen shows your stars, destruction %,
  and loot. **Return Home** banks your winnings.

### Controls
| Input | Action |
|-------|--------|
| Mouse drag | Pan the camera |
| Mouse wheel | Zoom in/out |
| Click | Select building / collect / place / deploy |
| `B` | Build menu |
| `A` | Army menu |
| `Esc` | Deselect / cancel placement |

## Architecture

Plain ordered `<script>` tags, everything namespaced under a global `COC` object.

```
index.html              # Canvas + DOM UI overlay
css/styles.css          # Cartoon UI styling
js/
  config.js             # Balance data: buildings, troops, level tables, costs
  iso.js                # Isometric grid <-> screen coordinate math
  save.js               # localStorage persistence
  state.js              # Central game state, derived caps/capacity, init
  economy.js            # Resource generation, collection, training queue
  buildings.js          # Building creation, placement, upgrade timers
  troops.js             # Battle troop entities: targeting, pathing, attacking
  combat.js             # Defensive buildings + projectile simulation
  battle.js             # Enemy base generation, deployment, scoring, loot
  render.js             # All canvas drawing (grid, buildings, troops, FX, bars)
  ui.js                 # DOM UI: top bar, menus, upgrade popup, battle HUD, result
  input.js              # Mouse + keyboard handling
  game.js               # Mode manager, game loop, camera, user actions
  main.js               # Bootstrap
```

## Buildings
Town Hall · Gold Mine · Elixir Collector · Gold/Elixir Storage · Cannon ·
Archer Tower · Barracks · Army Camp · Walls

## Troops
Barbarian (cheap melee) · Archer (ranged) · Giant (tanky, targets defenses)
