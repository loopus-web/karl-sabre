# Saber Wars: Pixel Duel — Design Document

## Overview
2D sidescroller lightsaber combat game with pixel art graphics (64x64 sprites).
Single player vs AI, arcade mode with waves of increasingly difficult enemies.

## Tech Stack
- HTML5 Canvas + vanilla JavaScript
- PixelLab MCP for sprite generation
- No external dependencies — runs directly in Chrome

## File Structure
```
index.html          — Entry point, canvas setup
game.js             — Game loop, input, rendering, game logic
assets/             — Sprite sheets from PixelLab
```

## Characters (64x64, PixelLab)
- **Jedi Hero**: idle, walk, attack (3-frame combo), block, dodge, force push, death
- **Sith Enemy**: same animation set with visual variations

## Tileset
- Sidescroller tileset: metallic floor, space background, platforms

## Controls
- Arrow keys: move left/right
- Up arrow: jump
- Z: attack (chain for combos)
- X: block/parry
- C: dodge (dash back)
- A: Force Push (cooldown 5s)
- S: Force Lightning (consumes Force bar)

## Resource Bars
- **HP** (red) — health points
- **Stamina** (yellow) — auto-recharges, consumed by block/dodge
- **Force** (blue) — slow recharge, consumed by Force powers

## Combat Mechanics
- 3-hit combo: light → medium → heavy (chain Z presses within timing window)
- Block: hold X, absorbs damage but drains stamina
- Dodge: dash backward with brief invincibility
- Force Push: knockback, 5s cooldown
- Force Lightning: ranged damage, drains Force bar

## Arcade Mode
- Waves 1→N, increasing enemy count and difficulty
- Enemies get faster, more aggressive, more HP per wave
- Score displayed during play, best score saved to localStorage
- Flow: Title Screen → Combat → Game Over → Retry

## Visual Effects
- Lightsaber glow trails (canvas glow/shadow)
- Impact particles on hit
- Screen shake on heavy attacks
- White flash on successful parry

## AI Behavior
- Basic state machine: idle → approach → attack → retreat
- Difficulty scaling: reaction time decreases, combo frequency increases
- Occasional block and dodge to feel fair
