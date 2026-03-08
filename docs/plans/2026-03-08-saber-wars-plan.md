# Saber Wars: Pixel Duel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 2D sidescroller lightsaber combat game with PixelLab pixel art, playable in Chrome.

**Architecture:** Single-page HTML5 Canvas game. Vanilla JS with a game loop (requestAnimationFrame). Entity-component pattern for player/enemies. State machine for AI. All assets generated via PixelLab MCP and downloaded to `assets/`.

**Tech Stack:** HTML5 Canvas, vanilla JavaScript, PixelLab MCP for sprites/tilesets, Chrome for testing.

---

### Task 1: Generate Jedi Hero Character

**Step 1: Create the Jedi character via PixelLab**

Call `mcp__pixellab__create_character` with:
- description: "Jedi knight with brown robes, blue lightsaber, hood down, determined expression"
- name: "Jedi Hero"
- size: 64
- view: "side"
- n_directions: 4
- detail: "high detail"
- shading: "detailed shading"
- outline: "single color black outline"
- proportions: '{"type": "preset", "name": "heroic"}'

**Step 2: Wait for character generation (~3 min), then call `get_character` to check status**

**Step 3: Queue all animations for the Jedi**

Queue these animations (one call each to `animate_character`):
1. `breathing-idle` — idle stance
2. `walking` — walk cycle
3. `lead-jab` with action_description "swinging a lightsaber horizontally" — light attack
4. `cross-punch` with action_description "overhead lightsaber slash" — medium attack
5. `high-kick` with action_description "powerful spinning lightsaber strike" — heavy attack
6. `crouching` with action_description "blocking with lightsaber raised defensively" — block
7. `backflip` — dodge
8. `pushing` with action_description "using the Force to push enemies away" — Force push
9. `fireball` with action_description "shooting Force lightning from hand" — Force lightning
10. `falling-back-death` — death
11. `taking-punch` with action_description "getting hit and staggering back" — hurt
12. `fight-stance-idle-8-frames` — combat idle

**Step 4: Call `get_character` to get download ZIP URL, download all sprites to `assets/jedi/`**

---

### Task 2: Generate Sith Enemy Character

**Step 1: Create the Sith character via PixelLab**

Call `mcp__pixellab__create_character` with:
- description: "Sith warrior with dark black armor and cape, red lightsaber, menacing red eyes, horned helmet"
- name: "Sith Enemy"
- size: 64
- view: "side"
- n_directions: 4
- detail: "high detail"
- shading: "detailed shading"
- outline: "single color black outline"
- proportions: '{"type": "preset", "name": "heroic"}'

**Step 2: Wait for generation, check status with `get_character`**

**Step 3: Queue same animation set as Jedi (all 12 animations)**

Replace action descriptions to fit Sith theme:
- lead-jab: "aggressive horizontal red lightsaber slash"
- cross-punch: "overhead red lightsaber slam"
- high-kick: "vicious spinning red lightsaber attack"
- crouching: "blocking with red lightsaber"
- pushing: "using dark Force push"
- fireball: "shooting red Force lightning"

**Step 4: Download all sprites to `assets/sith/`**

---

### Task 3: Generate Sidescroller Tileset

**Step 1: Create metallic spaceship tileset**

Call `mcp__pixellab__create_sidescroller_tileset` with:
- lower_description: "dark metal spaceship hull panels with rivets and pipes"
- transition_description: "glowing blue energy lines and metallic grating"
- transition_size: 0.25
- tile_size: {"width": 32, "height": 32}
- detail: "highly detailed"
- shading: "detailed shading"
- outline: "selective outline"

**Step 2: Wait ~100s, call `get_sidescroller_tileset` to check status and get download URL**

**Step 3: Download tileset PNG + metadata to `assets/tileset/`**

---

### Task 4: Project Setup & HTML Structure

**Files:**
- Create: `index.html`

**Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Saber Wars: Pixel Duel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
        canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
    </style>
</head>
<body>
    <canvas id="gameCanvas"></canvas>
    <script src="game.js"></script>
</body>
</html>
```

**Step 2: Open in Chrome to verify blank black screen**

---

### Task 5: Core Game Engine

**Files:**
- Create: `game.js`

**Step 1: Write the game engine foundation**

Implement in `game.js`:
- Canvas setup (960x540, scaled 2x for pixel art)
- Game loop with `requestAnimationFrame`, delta time
- Input handler (keyboard state map)
- Sprite loader (load images, parse sprite sheets)
- SpriteAnimator class (frame cycling, directional sprites)
- Camera class (follows player, parallax background)
- Constants: GRAVITY, GROUND_Y, GAME_WIDTH, GAME_HEIGHT

**Step 2: Open in Chrome, verify canvas renders with a colored background**

---

### Task 6: Player Character Implementation

**Files:**
- Modify: `game.js`

**Step 1: Implement Player class**

- State machine: IDLE, WALK, ATTACK_1, ATTACK_2, ATTACK_3, BLOCK, DODGE, FORCE_PUSH, FORCE_LIGHTNING, HURT, DEAD
- Movement: left/right with velocity, gravity, ground collision
- Jump: upward velocity, gravity pulls back down
- HP bar (100), Stamina bar (100, recharges 20/s), Force bar (100, recharges 5/s)
- Hitbox for collision detection
- Combo system: track last attack time, if Z pressed within 400ms window → chain to next attack
- Block: hold X, drains stamina 15/s, reduces damage by 80%
- Dodge: press C, dash backward 200px, 300ms invincibility, costs 25 stamina
- Force Push: press A, knockback enemies 300px, 5s cooldown
- Force Lightning: press S, ranged damage 2/tick for 1s, costs 40 Force
- Hurt state: brief stagger, knockback
- Death state: play death anim, trigger game over

**Step 2: Test in Chrome — player should move, jump, and animate**

---

### Task 7: Enemy AI Implementation

**Files:**
- Modify: `game.js`

**Step 1: Implement Enemy class**

- Same base stats as player (HP, hitbox, animations)
- AI State machine: IDLE, APPROACH, ATTACK, RETREAT, BLOCK, HURT, DEAD
- Decision logic per frame:
  - If far from player → APPROACH (walk toward)
  - If in attack range → 70% ATTACK, 20% BLOCK, 10% wait
  - After attacking → RETREAT briefly
  - Random block chance when player attacks (scales with difficulty)
- Attack patterns: uses same 3-hit combo as player
- Difficulty scaling per wave: reaction_time decreases (800ms→200ms), block_chance increases (10%→40%), damage increases

**Step 2: Test in Chrome — enemy should approach and fight the player**

---

### Task 8: Combat System & Collision Detection

**Files:**
- Modify: `game.js`

**Step 1: Implement combat resolution**

- Hitbox collision detection (AABB)
- Attack hitboxes: active only during attack animation frames
- Damage calculation: base_damage * combo_multiplier * (blocked ? 0.2 : 1.0)
- Knockback on hit
- Parry system: if block starts within 100ms of incoming attack → perfect parry (no stamina cost, stagger attacker)
- Force Push: applies large knockback, ignores block
- Force Lightning: continuous damage while active, blockable

**Step 2: Test in Chrome — hits should register, HP bars decrease, knockback works**

---

### Task 9: Visual Effects

**Files:**
- Modify: `game.js`

**Step 1: Implement VFX system**

- Lightsaber glow: `ctx.shadowColor` + `ctx.shadowBlur` on saber sprite area
- Particle system: small colored particles on hit (white/blue for Jedi, red for Sith)
- Screen shake: offset canvas on heavy hits (intensity + duration, dampened)
- Parry flash: white overlay for 100ms on perfect parry
- Force lightning: jagged line rendering between player and target
- Death effect: character sprite fades + particles burst

**Step 2: Test in Chrome — visual feedback on all combat actions**

---

### Task 10: HUD & UI

**Files:**
- Modify: `game.js`

**Step 1: Implement HUD**

- Player HP/Stamina/Force bars (top-left, colored rectangles with borders)
- Enemy HP bar (above enemy head)
- Wave counter (top-center, "WAVE 3")
- Score display (top-right)
- Combo counter (center screen, fades out, "3 HIT COMBO!")

**Step 2: Implement game screens**

- Title screen: "SABER WARS" title, "Press ENTER to start", animated background
- Game Over screen: "GAME OVER", final score, "Press ENTER to retry"
- Wave transition: "WAVE X" text fades in/out between waves
- Pause: press Escape to pause/unpause

**Step 3: Test in Chrome — full game flow from title to game over**

---

### Task 11: Arcade Wave System

**Files:**
- Modify: `game.js`

**Step 1: Implement WaveManager**

- Wave 1: 1 enemy, base stats
- Each wave: +1 enemy (max 3 on screen), stats scale up
- Brief pause between waves for "WAVE X" display
- Score: 100 per kill * wave_number * combo_multiplier
- Best score saved to localStorage
- Small HP recovery between waves (20%)

**Step 2: Test full arcade loop — multiple waves, increasing difficulty, score tracking**

---

### Task 12: Audio & Polish (Canvas-based sound effects)

**Files:**
- Modify: `game.js`

**Step 1: Implement Web Audio API sound effects**

- Lightsaber hum (oscillator, low frequency)
- Saber clash (noise burst on hit)
- Force push whoosh (filtered noise sweep)
- Force lightning crackle (modulated noise)
- Background ambient (low drone)

**Step 2: Add background parallax**

- Star field background layer (slow scroll)
- Spaceship interior mid-ground (medium scroll)
- Floor tiles foreground (camera-locked)

**Step 3: Final Chrome test — complete game with all features**

---

### Task 13: Final Integration & Testing in Chrome

**Step 1: Open game in Chrome, play through multiple waves**
**Step 2: Fix any bugs, adjust balance (damage values, AI timing, etc.)**
**Step 3: Verify all visual effects, sounds, UI elements work correctly**
