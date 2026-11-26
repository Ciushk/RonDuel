# RonTown UI icons

Pixel-art icons for the RonTown “Meniu oraș” sheet and the official **RonCoin**, cut from magenta-keyed Gemini sheets with the same HD pipeline as the map tiles (flood-fill magenta key, 2px defringe, premultiplied Lanczos, post-resize despill).

Pushing this folder does **not** change production by itself. Copy the PNGs into `apps/web/public/rontown/ui/` (keep the file names) and wire them in the app.

Raw URL:

`https://raw.githubusercontent.com/Ciushk/RonDuel/main/elements-rontown/ui/<name>.png`

## Menu icons

Each icon ships at **128×128** (`name.png`) and **256×256** (`name@2x.png`). They are already padded to a square with ~8% inset. Display at **40px on mobile / 48px on desktop**, with `image-rendering: auto` (smooth — these are hi-res downscales, not 16-color pixel tiles). Set `width` and `height` to avoid CLS. `alt=""` is fine when the button already has a visible text label.

| 1× file | 2× file | Menu button (ro / en) | Art |
|---|---|---|---|
| `icon-orders.png` | `icon-orders@2x.png` | Comenzi / Orders | Sealed parchment scroll with a red wax seal |
| `icon-inventory.png` | `icon-inventory@2x.png` | Inventar / Inventory | Brown adventurer backpack |
| `icon-villagers.png` | `icon-villagers@2x.png` | Săteni / Villagers | Two villager busts (straw-hat boy, bun girl) |
| `icon-coins.png` | `icon-coins@2x.png` | Monede / Coins | Stack of gold coins, front coin stamped with **R** |
| `icon-send-coins.png` | `icon-send-coins@2x.png` | Trimite RonCoins / Send RonCoins | Cream gift box, red ribbon, a small gold coin on the bow |
| `icon-help.png` | `icon-help@2x.png` | Ajutor / Help | Blue “?” sign on a wooden post |

In the current app these live in `apps/web/components/rontown/TownSheets.tsx` (`activeSheet === 'menu'`, title `t('town.toolbar.more')`). Map: `orders` → orders, `inventory` → inventory, `stats` → villagers, `coins` → coins, `transfer` → send-coins, `help` → help. Keep the `coinsPurchaseEnabled` / `coinsTransferEnabled` feature flags.

## RonCoin

The official coin is a gold piece with an embossed **R** and a volt-green sparkle (`#C6FF3D`). Use the **single** coin as the default currency glyph. The **stack** is for “many coins” (wallet total, a reward pile) — do not use it as a generic prefix next to a number.

Sizes: **16, 24, 32, 48, 64, 128, 256** px, already padded to a square.

| File pattern | Size | Typical use |
|---|---|---|
| `roncoin-16.png` | 16 | Tight inline. Reads as a coin; the **R** is soft. Prefer 24 when there is room. |
| `roncoin-24.png` | 24 | HUD balance chip, default inline |
| `roncoin-32.png` | 32 | Medium (sheet headers, transfer) |
| `roncoin-48.png` | 48 | 24@2× source |
| `roncoin-64.png` | 64 | Large (shop / confirmation) |
| `roncoin-128.png` | 128 | Hero / empty states |
| `roncoin-256.png` | 256 | 128@2× source |
| `roncoin-stack-<size>.png` | same set | Piles, rewards, “you have many” |

Recommended `srcset` pairs (every 2× file exists):

- size 16 → `roncoin-16.png` 1× / `roncoin-32.png` 2×
- size 24 → `roncoin-24.png` 1× / `roncoin-48.png` 2×
- size 32 → `roncoin-32.png` 1× / `roncoin-64.png` 2×
- size 64 → `roncoin-64.png` 1× / `roncoin-128.png` 2×
- size 128 → `roncoin-128.png` 1× / `roncoin-256.png` 2×

Existing `RonCoinIcon` call sites also pass 14, 18, 20 and 22. Snap to the next source at or above the requested CSS size (14–16 → 16/32, 18–24 → 24/48, etc.) and set `width`/`height` to the requested size so layout does not change.

## Notes

- `icon-send-coins` includes a coin on the bow, but it is a **generic** gold disc with a bar mark, not the official R-stamped RonCoin.
- `roncoin-stack-16` reads as a small gold cluster, not a clear stack or R. Use 24px or larger for the stack.
- The orders scroll is wide and short, so it sits optically smaller than the backpack or gift in a square frame. That is the source art, not a crop error.
- Palette (Split Court): red `#FF5A4E`, blue `#3D7BFF`, volt `#C6FF3D`, cream `#FFF7EC`, ink `#0E0D15`.
