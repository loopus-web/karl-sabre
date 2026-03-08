// ============================================================
// SABER WARS: PIXEL DUEL
// 2D Sidescroller Lightsaber Combat — Arcade Mode
// ============================================================

// --- CONSTANTS ---
const GAME_W = 960;
const GAME_H = 540;
const SCALE = 1;
const GRAVITY = 1800;
const GROUND_Y = 440;
const PLAYER_SPEED = 280;
const JUMP_FORCE = -620;
const DODGE_SPEED = 500;
const DODGE_DURATION = 0.25;
const DODGE_COST = 25;
const BLOCK_DRAIN = 20; // stamina/s
const STAMINA_REGEN = 25; // per second
const FORCE_REGEN = 8;
const FORCE_PUSH_COST = 0;
const FORCE_PUSH_COOLDOWN = 5;
const FORCE_PUSH_KNOCKBACK = 400;
const FORCE_LIGHTNING_COST = 40;
const FORCE_LIGHTNING_DPS = 60;
const COMBO_WINDOW = 0.5; // seconds to chain next attack
const HITSTOP_DURATION = 0.06;
const PARRY_WINDOW = 0.15;

// --- Dash Attack ---
const DASH_SPEED = 600;
const DASH_DURATION = 0.22;
const DASH_DAMAGE = 25;
const DASH_KNOCKBACK = 300;
const DASH_COST = 15;

// --- Air Attack ---
const AIR_ATTACK_DAMAGE = 18;
const AIR_ATTACK_KNOCKBACK = 200;
const AIR_JUGGLE_VY = -350;

// --- Fury System ---
const FURY_MAX = 100;
const FURY_PER_HIT = 8;
const FURY_PER_KILL = 15;
const FURY_PER_PARRY = 25;
const FURY_ULTIMATE_DAMAGE = 50;
const FURY_ULTIMATE_RANGE = 200;

// --- Power-ups ---
const POWERUP_DROP_CHANCE = 0.3;
const POWERUP_LIFETIME = 8;
const POWERUP_EFFECT_DURATION = 5;
const DOUBLE_TAP_WINDOW = 0.25;

// Attack data: each attack has distinct saber arc for visual variety
const ATTACKS = [
    { name: 'light',  damage: 12, knockback: 180, duration: 0.28, hitStart: 0.06, hitEnd: 0.16,
      arcStart: -1.8, arcEnd: 0.6, saberLen: 42 },   // fast horizontal slash
    { name: 'medium', damage: 20, knockback: 240, duration: 0.35, hitStart: 0.08, hitEnd: 0.22,
      arcStart: -2.4, arcEnd: 0.3, saberLen: 46 },   // overhead diagonal
    { name: 'heavy',  damage: 35, knockback: 350, duration: 0.50, hitStart: 0.12, hitEnd: 0.32,
      arcStart: 0.8, arcEnd: -2.2, saberLen: 50 },    // upswing (reverse arc)
];

// --- CANVAS SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = GAME_W;
canvas.height = GAME_H;
ctx.imageSmoothingEnabled = false;

// Scale canvas to fit screen
function resizeCanvas() {
    const scaleX = window.innerWidth / GAME_W;
    const scaleY = window.innerHeight / GAME_H;
    const s = Math.min(scaleX, scaleY);
    canvas.style.width = (GAME_W * s) + 'px';
    canvas.style.height = (GAME_H * s) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- SPRITE & ANIMATION LOADING ---
const SPRITE_SCALE = 2.2; // scale 64px sprites up

// Animation definitions: game state → PixelLab folder name, frame count, FPS, loop?
const ANIM_DEFS = {
    idle:             { folder: 'breathing-idle',              frames: 4,  fps: 6,  loop: true },
    walk:             { folder: 'walking',                     frames: 6,  fps: 10, loop: true },
    attack1:          { folder: 'lead-jab',                    frames: 3,  fps: 10, loop: false },
    attack2:          { folder: 'cross-punch',                 frames: 6,  fps: 14, loop: false },
    attack3:          { folder: 'high-kick',                   frames: 7,  fps: 12, loop: false },
    block:            { folder: 'crouching',                   frames: 5,  fps: 8,  loop: false },
    dodge:            { folder: 'backflip',                    frames: 10, fps: 20, loop: false },
    force_push:       { folder: 'pushing',                     frames: 6,  fps: 12, loop: false },
    force_lightning:  { folder: 'fireball',                    frames: 6,  fps: 10, loop: true },
    dead:             { folder: 'falling-back-death',          frames: 7,  fps: 8,  loop: false },
    hurt:             { folder: 'taking-punch',                frames: 6,  fps: 15, loop: false },
    combat_idle:      { folder: 'fight-stance-idle-8-frames',  frames: 8,  fps: 8,  loop: true },
    dash_attack:      { folder: 'lead-jab',                    frames: 3,  fps: 15, loop: false },
    air_attack:       { folder: 'high-kick',                   frames: 7,  fps: 18, loop: false },
    fury_ultimate:    { folder: 'cross-punch',                 frames: 6,  fps: 10, loop: true },
};

// Sprite storage: sprites.jedi.idle.east[0..3], sprites.jedi.attack1.east[0..2], etc.
// Also keep static fallback: sprites.jedi.static.east
const sprites = { jedi: { static: {} }, sith: { static: {} } };
let spritesLoaded = false;
let totalFramesToLoad = 0;
let framesLoaded = 0;

function loadImg(path) {
    const img = new Image();
    img.src = path;
    totalFramesToLoad++;
    return new Promise(resolve => {
        img.onload = () => { framesLoaded++; resolve(img); };
        img.onerror = () => { framesLoaded++; resolve(null); };
    });
}

async function loadAllSprites() {
    const characters = [
        { key: 'jedi', basePath: 'assets/jedi/sprites/animations' },
        { key: 'sith', basePath: 'assets/sith/sprites/animations' },
    ];

    const promises = [];

    for (const char of characters) {
        // Load static fallback sprites
        promises.push(loadImg(`assets/${char.key}/east.png`).then(img => { sprites[char.key].static.east = img; }));
        promises.push(loadImg(`assets/${char.key}/west.png`).then(img => { sprites[char.key].static.west = img; }));

        // Load all animation frames
        for (const [state, def] of Object.entries(ANIM_DEFS)) {
            sprites[char.key][state] = { east: [], west: [] };
            for (let i = 0; i < def.frames; i++) {
                const frameNum = String(i).padStart(3, '0');
                for (const dir of ['east', 'west']) {
                    const path = `${char.basePath}/${def.folder}/${dir}/frame_${frameNum}.png`;
                    promises.push(loadImg(path).then(img => {
                        sprites[char.key][state][dir][i] = img;
                    }));
                }
            }
        }
    }

    await Promise.all(promises);
    spritesLoaded = true;
}

// Get the current animation frame for a given state
// Returns { img, isAnimated } — isAnimated=true means real animation frame (saber included)
function getAnimFrame(spriteKey, state, stateTime, facing) {
    const dir = facing === 1 ? 'east' : 'west';
    const def = ANIM_DEFS[state];
    const animData = sprites[spriteKey] ? sprites[spriteKey][state] : null;

    if (def && animData && animData[dir] && animData[dir].length > 0) {
        const totalFrames = def.frames;
        let frameIdx;
        if (def.loop) {
            frameIdx = Math.floor(stateTime * def.fps) % totalFrames;
        } else {
            frameIdx = Math.min(Math.floor(stateTime * def.fps), totalFrames - 1);
        }
        const img = animData[dir][frameIdx];
        if (img && img.complete && img.naturalWidth > 0) return { img, isAnimated: true };
    }

    // Fallback to static sprite (no saber animation — show procedural saber)
    const staticSprite = sprites[spriteKey] ? sprites[spriteKey].static : null;
    const fallback = staticSprite ? staticSprite[dir] : null;
    if (fallback && fallback.complete && fallback.naturalWidth > 0) return { img: fallback, isAnimated: false };
    return null;
}

loadAllSprites();

// --- INPUT ---
const keys = {};
const justPressed = {};
let keysThisFrame = {};
window.addEventListener('keydown', e => {
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function isPressed(code) { return !!keys[code]; }
function wasJustPressed(code) { return !!keysThisFrame[code]; }

// --- AUDIO (Web Audio API) ---
let audioCtx = null;
function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    switch (type) {
        case 'saber_swing': {
            // Whooshy saber swing — layered for richness
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.2);
            // Noise whoosh layer
            const nbuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
            const nd = nbuf.getChannelData(0);
            for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);
            const ns = audioCtx.createBufferSource();
            const ng = audioCtx.createGain();
            const nf = audioCtx.createBiquadFilter();
            nf.type = 'bandpass'; nf.frequency.value = 800; nf.Q.value = 1;
            ns.buffer = nbuf;
            ng.gain.setValueAtTime(0.12, now);
            ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            ns.connect(nf).connect(ng).connect(audioCtx.destination);
            ns.start(now);
            break;
        }
        case 'saber_hit': {
            // Crunchy electric impact
            const bufferSize = audioCtx.sampleRate * 0.15;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const env = Math.pow(1 - i / bufferSize, 0.5);
                data[i] = (Math.random() * 2 - 1) * env + Math.sin(i * 0.1) * env * 0.3;
            }
            const src = audioCtx.createBufferSource();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = 3;
            src.buffer = buffer;
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            src.connect(filter).connect(gain).connect(audioCtx.destination);
            src.start(now);
            // Low thump
            const thump = audioCtx.createOscillator();
            const tg = audioCtx.createGain();
            thump.type = 'sine';
            thump.frequency.setValueAtTime(80, now);
            thump.frequency.exponentialRampToValueAtTime(30, now + 0.1);
            tg.gain.setValueAtTime(0.25, now);
            tg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            thump.connect(tg).connect(audioCtx.destination);
            thump.start(now); thump.stop(now + 0.1);
            break;
        }
        case 'parry': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1600, now + 0.05);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.2);
            break;
        }
        case 'force_push': {
            const bufferSize = audioCtx.sampleRate * 0.4;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
            const src = audioCtx.createBufferSource();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.setValueAtTime(3000, now);
            filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);
            src.buffer = buffer;
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            src.connect(filter).connect(gain).connect(audioCtx.destination);
            src.start(now);
            break;
        }
        case 'lightning': {
            const osc = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth'; osc.frequency.value = 80;
            osc2.type = 'square'; osc2.frequency.value = 120;
            gain.gain.setValueAtTime(0.1, now);
            osc.connect(gain); osc2.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now); osc2.start(now);
            osc.stop(now + 0.5); osc2.stop(now + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            break;
        }
        case 'dash_attack': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.15);
            const nbuf2 = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
            const nd2 = nbuf2.getChannelData(0);
            for (let i = 0; i < nd2.length; i++) nd2[i] = (Math.random() * 2 - 1) * (1 - i / nd2.length);
            const ns2 = audioCtx.createBufferSource();
            const ng2 = audioCtx.createGain();
            ns2.buffer = nbuf2;
            ng2.gain.setValueAtTime(0.2, now);
            ng2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            ns2.connect(ng2).connect(audioCtx.destination);
            ns2.start(now);
            break;
        }
        case 'fury_activate': {
            [0, 0.08, 0.16].forEach((delay, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.value = [330, 440, 660][i];
                gain.gain.setValueAtTime(0.15, now + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);
                osc.connect(gain).connect(audioCtx.destination);
                osc.start(now + delay); osc.stop(now + delay + 0.5);
            });
            const sub = audioCtx.createOscillator();
            const sg = audioCtx.createGain();
            sub.type = 'sine'; sub.frequency.value = 55;
            sg.gain.setValueAtTime(0.3, now);
            sg.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            sub.connect(sg).connect(audioCtx.destination);
            sub.start(now); sub.stop(now + 0.8);
            break;
        }
        case 'powerup_collect': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.15);
            break;
        }
        case 'air_hit': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.15);
            break;
        }
        case 'death': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.8);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.8);
            break;
        }
        case 'wave_start': {
            [0, 0.1, 0.2].forEach((delay, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.value = [440, 554, 659][i];
                gain.gain.setValueAtTime(0.1, now + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
                osc.connect(gain).connect(audioCtx.destination);
                osc.start(now + delay); osc.stop(now + delay + 0.2);
            });
            break;
        }
    }
}

// Ambient saber hum
let humOsc = null;
let humGain = null;
function startSaberHum() {
    if (!audioCtx || humOsc) return;
    humOsc = audioCtx.createOscillator();
    humGain = audioCtx.createGain();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 55;
    humGain.gain.value = 0.03;
    humOsc.connect(humGain).connect(audioCtx.destination);
    humOsc.start();
}

// --- TIME SCALE (slow-motion) ---
let timeScale = 1;
let timeScaleTarget = 1;
let timeScaleTimer = 0;
let timeScaleDuration = 0;
let rawDt = 0;

function triggerSlowMo(scale, duration) {
    timeScaleTarget = scale;
    timeScaleDuration = duration;
    timeScaleTimer = 0;
}

function updateTimeScale(rdt) {
    if (timeScaleDuration > 0) {
        timeScaleTimer += rdt;
        const t = timeScaleTimer / timeScaleDuration;
        if (t < 0.3) {
            timeScale += (timeScaleTarget - timeScale) * 10 * rdt;
        } else {
            timeScale += (1 - timeScale) * 3 * rdt;
        }
        if (t >= 1) { timeScaleDuration = 0; timeScale = 1; }
    } else {
        timeScale += (1 - timeScale) * 8 * rdt;
    }
}

// --- CAMERA ZOOM ---
let cameraZoom = 1;
let cameraZoomTarget = 1;
let cameraZoomTimer = 0;
let cameraZoomDuration = 0;
let cameraFocusX = GAME_W / 2;
let cameraFocusY = GAME_H / 2;

function triggerZoom(zoom, focusX, focusY, duration) {
    cameraZoomTarget = zoom;
    cameraFocusX = focusX;
    cameraFocusY = focusY;
    cameraZoomDuration = duration;
    cameraZoomTimer = 0;
}

function updateZoom(rdt) {
    if (cameraZoomDuration <= 0) {
        cameraZoom += (1 - cameraZoom) * 5 * rdt;
        return;
    }
    cameraZoomTimer += rdt;
    const t = cameraZoomTimer / cameraZoomDuration;
    if (t < 0.2) {
        cameraZoom += (cameraZoomTarget - cameraZoom) * 10 * rdt;
    } else {
        cameraZoom += (1 - cameraZoom) * 3 * rdt;
    }
    if (t >= 1) { cameraZoomDuration = 0; cameraZoom = 1; }
}

// --- CHROMATIC ABERRATION ---
let chromaIntensity = 0;

function triggerChroma(intensity) {
    chromaIntensity = Math.min(1, chromaIntensity + intensity);
}

// --- SPEED LINES ---
const speedLines = [];

function spawnSpeedLines(x, y, dirX, count) {
    for (let i = 0; i < count; i++) {
        speedLines.push({
            x: x + (Math.random() - 0.5) * 100,
            y: y + (Math.random() - 0.5) * 80,
            len: 20 + Math.random() * 40,
            vx: dirX * (300 + Math.random() * 400),
            life: 0.15 + Math.random() * 0.15,
            maxLife: 0.3,
            width: 1 + Math.random() * 2,
        });
    }
}

function updateSpeedLines(dt) {
    for (let i = speedLines.length - 1; i >= 0; i--) {
        const l = speedLines[i];
        l.x += l.vx * dt;
        l.life -= dt;
        if (l.life <= 0) speedLines.splice(i, 1);
    }
}

function drawSpeedLines() {
    for (const l of speedLines) {
        const alpha = l.life / l.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha * 0.6;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = l.width;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x - l.vx * 0.03, l.y);
        ctx.stroke();
        ctx.restore();
    }
}

// --- POWER-UP SYSTEM ---
const POWERUP_TYPES = [
    { type: 'heal',  color: '#44ff44', glowColor: '#00ff00', label: '+HP' },
    { type: 'speed', color: '#ffff44', glowColor: '#ffff00', label: 'SPD' },
    { type: 'power', color: '#ff4444', glowColor: '#ff0000', label: 'PWR' },
    { type: 'force', color: '#4488ff', glowColor: '#0044ff', label: 'FRC' },
];

const powerups = [];

function applyPowerup(player, type) {
    switch (type.type) {
        case 'heal':  player.hp = Math.min(player.maxHp, player.hp + 30); break;
        case 'speed': player.speedBoost = POWERUP_EFFECT_DURATION; break;
        case 'power': player.powerBoost = POWERUP_EFFECT_DURATION; break;
        case 'force': player.force = player.maxForce; break;
    }
}

function spawnPowerup(x) {
    if (Math.random() >= POWERUP_DROP_CHANCE) return;
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({ x, y: GROUND_Y, type, lifetime: POWERUP_LIFETIME, time: 0 });
}

function updatePowerups(dt, player) {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.time += dt;
        p.lifetime -= dt;
        if (p.lifetime <= 0) { powerups.splice(i, 1); continue; }
        if (Math.abs(player.x - p.x) < 30 && player.state !== 'dead') {
            applyPowerup(player, p.type);
            playSound('powerup_collect');
            spawnParticles(p.x, p.y - 15, p.type.color, 10, 150, 0.4);
            powerups.splice(i, 1);
        }
    }
}

function drawPowerups() {
    for (const p of powerups) {
        const bob = Math.sin(p.time * 4) * 6;
        const pulse = 0.7 + 0.3 * Math.sin(p.time * 6);
        const fadeOut = p.lifetime < 2 ? p.lifetime / 2 : 1;
        ctx.save();
        ctx.globalAlpha = fadeOut;
        ctx.shadowColor = p.type.glowColor;
        ctx.shadowBlur = 15 * pulse;
        ctx.fillStyle = p.type.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 15 + bob, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = fadeOut * 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 15 + bob, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fadeOut;
        ctx.fillStyle = p.type.color;
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.type.label, p.x, p.y - 30 + bob);
        ctx.textAlign = 'left';
        ctx.restore();
    }
}

// --- DOUBLE TAP ---
let lastTapDir = 0;
let doubleTapTimer = 0;

// --- PARTICLE SYSTEM ---
const particles = [];

function spawnParticles(x, y, color, count, speed, life) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = speed * (0.5 + Math.random() * 0.5);
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 100,
            life: life * (0.5 + Math.random() * 0.5),
            maxLife: life,
            color,
            size: 2 + Math.random() * 3,
        });
    }
}

function spawnSaberSparks(x, y, isRed) {
    const colors = isRed
        ? ['#ff0000', '#ff4444', '#ff8888', '#ffaaaa', '#ffffff']
        : ['#0088ff', '#44aaff', '#88ccff', '#aaddff', '#ffffff'];
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 100 + Math.random() * 250;
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 50,
            life: 0.2 + Math.random() * 0.3,
            maxLife: 0.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 1 + Math.random() * 3,
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 400 * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), Math.round(p.size), Math.round(p.size));
    }
    ctx.globalAlpha = 1;
}

// --- SCREEN SHAKE ---
let shakeIntensity = 0;
let shakeDuration = 0;
let shakeTimer = 0;

function triggerShake(intensity, duration) {
    shakeIntensity = Math.max(shakeIntensity, intensity);
    shakeDuration = Math.max(shakeDuration, duration);
    shakeTimer = 0;
}

function updateShake(dt) {
    if (shakeDuration <= 0) return;
    shakeTimer += dt;
    if (shakeTimer >= shakeDuration) {
        shakeDuration = 0;
        shakeIntensity = 0;
        return;
    }
    const progress = shakeTimer / shakeDuration;
    const intensity = shakeIntensity * (1 - progress);
    ctx.translate(
        (Math.random() - 0.5) * intensity * 2,
        (Math.random() - 0.5) * intensity * 2
    );
}

// --- HITSTOP ---
let hitstopTimer = 0;

function triggerHitstop(duration) {
    hitstopTimer = Math.max(hitstopTimer, duration);
}

// --- FLASH OVERLAY ---
let flashAlpha = 0;
let flashColor = '#ffffff';

function triggerFlash(color, alpha) {
    flashColor = color;
    flashAlpha = alpha;
}

// --- SABER CLASH RING EFFECT ---
const saberClashes = [];

function updateSaberClashes(dt) {
    for (let i = saberClashes.length - 1; i >= 0; i--) {
        saberClashes[i].time += dt;
        if (saberClashes[i].time >= saberClashes[i].maxTime) saberClashes.splice(i, 1);
    }
}

function drawSaberClashes() {
    for (const c of saberClashes) {
        const t = c.time / c.maxTime;
        const radius = t * 60;
        const alpha = (1 - t) * 0.9;
        ctx.save();
        ctx.globalAlpha = alpha;
        // Outer ring
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = '#88ccff';
        ctx.shadowBlur = 20;
        ctx.lineWidth = 4 * (1 - t);
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        // Inner flash
        if (t < 0.3) {
            ctx.globalAlpha = (1 - t / 0.3) * 0.7;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(c.x, c.y, 8 * (1 - t), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// --- BACKGROUND RENDERER ---
const stars = [];
for (let i = 0; i < 120; i++) {
    stars.push({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H * 0.7,
        size: Math.random() < 0.3 ? 2 : 1,
        brightness: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 1 + Math.random() * 3,
    });
}

function drawBackground(time) {
    // Deep space gradient
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_H);
    grad.addColorStop(0, '#05050f');
    grad.addColorStop(0.5, '#0a0a1a');
    grad.addColorStop(1, '#111128');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Stars
    for (const star of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.x);
        ctx.globalAlpha = star.brightness * twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
    }
    ctx.globalAlpha = 1;

    // Distant nebula glow
    ctx.globalAlpha = 0.08;
    const nebGrad = ctx.createRadialGradient(GAME_W * 0.7, GAME_H * 0.3, 0, GAME_W * 0.7, GAME_H * 0.3, 200);
    nebGrad.addColorStop(0, '#4400ff');
    nebGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = nebGrad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalAlpha = 1;

    // Spaceship corridor walls
    drawCorridorBackground(time);
}

function drawCorridorBackground(time) {
    // Back wall
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 100, GAME_W, GROUND_Y - 100);

    // Wall panels
    for (let x = 0; x < GAME_W; x += 80) {
        ctx.strokeStyle = '#2a2a4a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, 110, 76, GROUND_Y - 120);

        // Panel details
        ctx.fillStyle = '#222240';
        ctx.fillRect(x + 8, 120, 64, 30);

        // Glowing accent lines
        const pulse = 0.4 + 0.3 * Math.sin(time * 2 + x * 0.05);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#0066cc';
        ctx.fillRect(x + 8, 155, 64, 2);
        ctx.globalAlpha = 1;
    }

    // Ceiling lights
    for (let x = 40; x < GAME_W; x += 160) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 1.5 + x * 0.02);
        ctx.globalAlpha = pulse * 0.3;
        const lgGrad = ctx.createRadialGradient(x, 105, 0, x, 105, 80);
        lgGrad.addColorStop(0, '#88aaff');
        lgGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lgGrad;
        ctx.fillRect(x - 80, 60, 160, 100);
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#aaccff';
        ctx.fillRect(x - 15, 100, 30, 4);
    }

    // Floor
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(0, GROUND_Y, GAME_W, GAME_H - GROUND_Y);

    // Floor tiles
    for (let x = 0; x < GAME_W; x += 64) {
        ctx.strokeStyle = '#3a3a5e';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, GROUND_Y, 64, GAME_H - GROUND_Y);

        // Floor glow strips
        const pulse = 0.3 + 0.2 * Math.sin(time * 1.2 + x * 0.03);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#003366';
        ctx.fillRect(x + 28, GROUND_Y + 2, 8, GAME_H - GROUND_Y - 4);
        ctx.globalAlpha = 1;
    }

    // Floor reflection line
    ctx.fillStyle = '#334466';
    ctx.fillRect(0, GROUND_Y, GAME_W, 2);
}

// --- DYNAMIC SABER LIGHTING ---
function drawDynamicLighting(playerFighter, enemies) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const fighters = [playerFighter, ...enemies];
    for (const f of fighters) {
        if (!f || f.state === 'dead') continue;
        const isAtk = f.state.startsWith('attack') || f.state === 'dash_attack' || f.state === 'air_attack' || f.state === 'fury_ultimate';
        const intensity = isAtk ? 0.15 : 0.06;
        const color = f.isPlayer ? '#44aaff' : '#ff4444';
        const radius = isAtk ? 150 : 80;
        const grad = ctx.createRadialGradient(f.x, f.y - 30, 0, f.x, f.y - 30, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.globalAlpha = intensity;
        ctx.fillStyle = grad;
        ctx.fillRect(f.x - radius, f.y - 30 - radius, radius * 2, radius * 2);
        const floorGrad = ctx.createRadialGradient(f.x, GROUND_Y, 0, f.x, GROUND_Y, radius * 0.7);
        floorGrad.addColorStop(0, color);
        floorGrad.addColorStop(1, 'transparent');
        ctx.globalAlpha = intensity * 0.5;
        ctx.fillStyle = floorGrad;
        ctx.fillRect(f.x - radius, GROUND_Y, radius * 2, 50);
    }
    ctx.restore();
}

// --- SABER ARC TRAIL SYSTEM ---
// Stores recent saber tip positions to draw filled arc trails
const ARC_TRAIL_MAX = 12;
const arcTrailsBlue = []; // {x, y, age}
const arcTrailsRed = [];

function pushArcTrail(arr, x, y) {
    arr.unshift({ x, y, age: 0 });
    if (arr.length > ARC_TRAIL_MAX) arr.pop();
}
function clearArcTrails(arr) { arr.length = 0; }

function ageArcTrails(arr, dt) {
    for (let i = arr.length - 1; i >= 0; i--) {
        arr[i].age += dt;
        if (arr[i].age > 0.12) arr.splice(i, 1);
    }
}

function drawArcTrail(arr, color, glowColor, pivotX, pivotY) {
    if (arr.length < 3) return;
    ctx.save();
    // Filled crescent shape between pivot and tip positions
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 25;
    for (let i = 0; i < arr.length - 1; i++) {
        const a = 1 - i / arr.length;
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = (ARC_TRAIL_MAX - i) * 0.8;
        ctx.beginPath();
        ctx.moveTo(arr[i].x, arr[i].y);
        ctx.lineTo(arr[i + 1].x, arr[i + 1].y);
        ctx.stroke();
    }
    // Bright core trail (first few points)
    const coreLen = Math.min(4, arr.length - 1);
    for (let i = 0; i < coreLen; i++) {
        ctx.globalAlpha = (1 - i / coreLen) * 0.7;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = (coreLen - i) * 1.2;
        ctx.beginPath();
        ctx.moveTo(arr[i].x, arr[i].y);
        ctx.lineTo(arr[i + 1].x, arr[i + 1].y);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
}

// --- ATTACK SWING CURVE ---
// Each attack: windup phase → explosive snap → follow-through
// Returns 0..1 mapped through a snappy ease curve
function attackEase(t) {
    // Windup: 0-0.25 (slow pullback feel)
    // Strike: 0.25-0.55 (FAST snap)
    // Follow-through: 0.55-1.0 (decelerate)
    if (t < 0.2) return t * 0.15 / 0.2;                              // slow: 0→0.15
    if (t < 0.5) return 0.15 + ((t - 0.2) / 0.3) * 0.75;            // FAST: 0.15→0.90
    return 0.90 + ((t - 0.5) / 0.5) * 0.10;                          // slow: 0.90→1.0
}

// Per-attack full pose data:
// windupAngle, strikeAngle, windupLean, strikeLean, lungeForward, pivotShift
const ATTACK_POSES = [
    // Light: fast horizontal slash — pull back slightly, snap forward
    { windupAngle: 0.8, strikeAngle: -2.0, windupLean: -6, strikeLean: 14, lunge: 20, pivotY: 0 },
    // Medium: overhead diagonal — raise high, slam down
    { windupAngle: -2.6, strikeAngle: 1.0, windupLean: -4, strikeLean: 16, lunge: 24, pivotY: -6 },
    // Heavy: huge upswing → down — crouch then explode up
    { windupAngle: 1.5, strikeAngle: -2.8, windupLean: -8, strikeLean: 20, lunge: 30, pivotY: -4 },
];

function getSaberParams(state, stateTime) {
    let angle = -0.6;
    let len = 40;
    let pivotX = 14;
    let pivotY = 2;
    let swinging = false;
    let lunge = 0;
    let bodyLean = 0;
    let phase = 'idle'; // 'windup', 'strike', 'followthrough'
    let crouch = 0;

    if (state === 'attack1' || state === 'attack2' || state === 'attack3') {
        const idx = parseInt(state.slice(-1)) - 1;
        const atk = ATTACKS[idx];
        const pose = ATTACK_POSES[idx];
        const t = Math.min(1, stateTime / atk.duration);
        const e = attackEase(t);

        angle = pose.windupAngle + (pose.strikeAngle - pose.windupAngle) * e;
        len = atk.saberLen;
        lunge = pose.lunge * Math.sin(t * Math.PI); // forward then back
        bodyLean = pose.windupLean + (pose.strikeLean - pose.windupLean) * e;
        pivotY = pose.pivotY;
        swinging = t > 0.15 && t < 0.7;
        phase = t < 0.2 ? 'windup' : (t < 0.55 ? 'strike' : 'followthrough');
        crouch = idx === 2 ? Math.sin(t * Math.PI) * 6 : 0; // heavy: crouch then rise
    } else if (state === 'block') {
        angle = -1.2;
        pivotX = 8;
        pivotY = -10;
        len = 42;
    } else if (state === 'dodge') {
        angle = 2.2;
        len = 34;
    } else if (state === 'force_push') {
        angle = 2.0;
        pivotX = -5;
        len = 34;
    } else if (state === 'force_lightning') {
        angle = 2.4;
        pivotX = -8;
        len = 30;
    } else if (state === 'dash_attack') {
        angle = -1.5;
        len = 48;
        swinging = stateTime > 0.05 && stateTime < 0.18;
        phase = stateTime < 0.05 ? 'windup' : (stateTime < 0.15 ? 'strike' : 'followthrough');
    } else if (state === 'air_attack') {
        const t = Math.min(1, stateTime / 0.35);
        angle = -2.0 + t * 3.5;
        len = 46;
        swinging = t > 0.1 && t < 0.8;
        phase = t < 0.15 ? 'windup' : (t < 0.6 ? 'strike' : 'followthrough');
    } else if (state === 'fury_ultimate') {
        angle = stateTime * 8;
        len = 50;
        swinging = true;
        phase = 'strike';
    } else if (state === 'hurt') {
        angle = 1.8 + stateTime * 3;
        len = 34;
    } else if (state === 'walk') {
        angle = -0.6 + Math.sin(stateTime * 10) * 0.2;
    } else {
        // Idle: combat ready sway
        angle = -0.6 + Math.sin(stateTime * 2.5) * 0.1;
    }

    return { angle, len, pivotX, pivotY, swinging, lunge, bodyLean, phase, crouch };
}

function drawSaber(cx, bodyY, saberParams, bladeColor, glowColor, facing, worldX, trailArr, skipBlade) {
    const { angle, len, pivotX, pivotY, swinging, phase } = saberParams;
    const sx = cx + pivotX;
    const sy = bodyY + pivotY;

    // Compute blade tip in world-space for trail
    const cosA = Math.cos(angle - Math.PI / 2);
    const sinA = Math.sin(angle - Math.PI / 2);
    const localTipX = sx + cosA * len;
    const localTipY = sy + sinA * len;
    const worldTipX = facing === -1 ? 2 * worldX - localTipX : localTipX;
    const worldTipY = localTipY;

    if (swinging && trailArr) {
        pushArcTrail(trailArr, worldTipX, worldTipY);
    }

    // If sprite already has a saber, only draw trails — skip the blade itself
    if (skipBlade) return;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);

    const isStriking = phase === 'strike';
    const glowSize = isStriking ? 40 : 18;

    // Hilt
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(-3, -2, 6, 15);
    ctx.fillStyle = '#777777';
    ctx.fillRect(-2, 1, 4, 10);
    ctx.fillStyle = '#555555';
    ctx.fillRect(-2, 5, 4, 3);

    // Blade outer glow
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowSize;
    ctx.fillStyle = bladeColor;
    ctx.fillRect(-3, -len, 6, len);

    // Blade bright layer
    ctx.shadowBlur = glowSize * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-2, -len + 1, 4, len - 2);

    // Blade core
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -len + 2, 2, len - 4);

    // Tip
    ctx.beginPath();
    ctx.arc(0, -len, isStriking ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = bladeColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isStriking ? 20 : 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
}

// --- CHARACTER DRAWING (Procedural Pixel Art) ---
function getCharAlpha(state, stateTime) {
    if (state === 'hurt') return 0.4 + 0.6 * Math.abs(Math.sin(stateTime * 40));
    if (state === 'dead') return Math.max(0, 1 - stateTime * 1.5);
    if (state === 'dodge') return 0.4 + 0.3 * Math.sin(stateTime * 30);
    return 1;
}

// Shared body drawing — takes a config object for colors/details
function drawFighterBody(cx, cy, facing, state, stateTime, cfg) {
    ctx.save();

    const sp = getSaberParams(state, stateTime);
    const lean = sp.bodyLean || 0;
    const lunge = sp.lunge || 0;
    const crouch = sp.crouch || 0;
    const alpha = getCharAlpha(state, stateTime);

    const bob = state === 'walk' ? Math.sin(stateTime * 14) * 3
              : state === 'idle' ? Math.sin(stateTime * 2) * 1.5 : 0;

    const bx = cx + (lean + lunge) * (facing === 1 ? 1 : -1);

    // Shadow
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(bx, cy + 2, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;

    // --- Draw the sprite (animated) ---
    const spriteResult = cfg.spriteKey ? getAnimFrame(cfg.spriteKey, state, stateTime, facing) : null;
    const spriteImg = spriteResult ? spriteResult.img : null;
    const hasSprite = !!spriteImg;
    const hasAnimatedSprite = spriteResult ? spriteResult.isAnimated : false;

    if (hasSprite) {
        const sw = spriteImg.naturalWidth;
        const sh = spriteImg.naturalHeight;
        const dw = sw * SPRITE_SCALE;
        const dh = sh * SPRITE_SCALE;
        const dx = bx - dw / 2;
        const dy = cy - dh + 6 + bob + crouch;

        ctx.save();

        // Hurt flash: tint red
        if (state === 'hurt') {
            ctx.filter = `brightness(${1.5 + Math.sin(stateTime * 40) * 0.5}) saturate(2)`;
        }

        ctx.drawImage(spriteImg, dx, dy, dw, dh);
        ctx.filter = 'none';
        ctx.restore();
    } else {
        // Fallback: procedural rectangles
        const bodyY = cy - 54 + bob + crouch;
        ctx.save();
        if (facing === -1) {
            ctx.translate(cx, 0);
            ctx.scale(-1, 1);
            ctx.translate(-cx, 0);
        }
        const fbx = cx + lean + lunge;
        // Simplified body
        if (cfg.cape) {
            ctx.fillStyle = '#111';
            ctx.fillRect(fbx - 16, bodyY - 6, 32, 48);
        }
        ctx.fillStyle = cfg.bodyColor;
        ctx.fillRect(fbx - 13, bodyY, 26, 30);
        ctx.fillStyle = cfg.beltColor;
        ctx.fillRect(fbx - 13, bodyY + 20, 26, 5);
        ctx.fillStyle = cfg.legColor;
        const la = state === 'walk' ? Math.sin(stateTime * 14) * 8 : 0;
        ctx.fillRect(fbx - 9 + la, bodyY + 34, 9, 18);
        ctx.fillRect(fbx + 1 - la, bodyY + 34, 9, 18);
        ctx.fillStyle = cfg.headColor;
        ctx.fillRect(fbx - 10, bodyY - 20, 20, 20);
        if (cfg.drawHead) cfg.drawHead(ctx, fbx, bodyY);
        ctx.restore();
    }

    // --- SABER drawn on top of sprite ---
    // Compute saber pivot in world space
    const saberOffX = facing === 1 ? 18 : -18;
    const saberPivotX = bx + saberOffX;
    const saberPivotY = cy - 40 + bob + crouch;

    // For saber drawing, we need to handle facing
    ctx.save();
    if (facing === -1) {
        ctx.translate(saberPivotX, 0);
        ctx.scale(-1, 1);
        ctx.translate(-saberPivotX, 0);
    }
    // Animated sprites already contain the saber — hide procedural blade
    // Show procedural saber only when using static fallback or no sprite
    const hideBlade = hasAnimatedSprite;
    drawSaber(saberPivotX, saberPivotY, sp, cfg.bladeColor, cfg.glowColor, facing, cx, cfg.trailArr, hideBlade);
    ctx.restore();

    // Force push rings
    if (state === 'force_push' && stateTime < 0.45) {
        const pushDir = facing;
        for (let ring = 0; ring < 4; ring++) {
            const rt = stateTime - ring * 0.05;
            if (rt < 0 || rt > 0.4) continue;
            const radius = rt * 400;
            const a = 0.6 * (1 - rt / 0.4);
            ctx.globalAlpha = a;
            ctx.strokeStyle = cfg.bladeColor;
            ctx.shadowColor = cfg.glowColor;
            ctx.shadowBlur = 12;
            ctx.lineWidth = 4 - ring;
            ctx.beginPath();
            ctx.arc(bx + pushDir * 50, cy - 30, radius, pushDir === 1 ? -0.7 : Math.PI - 0.7, pushDir === 1 ? 0.7 : Math.PI + 0.7);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}

// --- CHARACTER CONFIGS ---
const jediCfg = {
    spriteKey: 'jedi',
    bodyColor: '#8B7355', beltColor: '#4A3520', legColor: '#7A6345',
    headColor: '#E8C090', cape: false,
    bladeColor: '#88ccff', glowColor: '#44aaff',
    trailArr: arcTrailsBlue,
    drawHead: (ctx, bx, bodyY) => {
        ctx.fillStyle = '#5A3A1A';
        ctx.fillRect(bx - 11, bodyY - 22, 22, 8);
        ctx.fillStyle = '#2A5020';
        ctx.fillRect(bx + 2, bodyY - 14, 3, 3);
    },
};

const sithCfg = {
    spriteKey: 'sith',
    bodyColor: '#2a2a2a', beltColor: '#1a1a1a', legColor: '#1a1a1a',
    headColor: '#1a1a1a', cape: true,
    bladeColor: '#ff4444', glowColor: '#ff0000',
    trailArr: arcTrailsRed,
    drawHead: (ctx, bx, bodyY) => {
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 8;
        ctx.fillRect(bx - 5, bodyY - 14, 4, 3);
        ctx.fillRect(bx + 2, bodyY - 14, 4, 3);
        ctx.shadowBlur = 0;
    },
};

function drawJedi(x, y, facing, state, stateTime) {
    drawFighterBody(x, y, facing, state, stateTime, jediCfg);
}

function drawSith(x, y, facing, state, stateTime) {
    drawFighterBody(x, y, facing, state, stateTime, sithCfg);
}

// --- FIGHTER CLASS ---
class Fighter {
    constructor(x, y, isPlayer) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.facing = isPlayer ? 1 : -1;
        this.isPlayer = isPlayer;

        this.hp = 100;
        this.maxHp = 100;
        this.stamina = 100;
        this.maxStamina = 100;
        this.force = 100;
        this.maxForce = 100;

        this.state = 'idle';
        this.stateTime = 0;
        this.comboStep = 0;
        this.comboTimer = 0;
        this.canCombo = false;

        this.blockTime = 0; // time since block started (for parry)
        this.dodgeTimer = 0;
        this.invincible = false;
        this.forcePushCooldown = 0;
        this.lightningActive = false;
        this.lightningTarget = null;

        this.hitApplied = false;
        this.grounded = true;

        this.fury = 0;
        this.speedBoost = 0;
        this.powerBoost = 0;
        this.dashCooldown = 0;
        this.furySlashCount = 0;

        this.width = 24;
        this.height = 50;
    }

    get hitbox() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height,
            w: this.width,
            h: this.height,
        };
    }

    get attackHitbox() {
        const range = 65;
        return {
            x: this.facing === 1 ? this.x - 5 : this.x - range + 5,
            y: this.y - 55,
            w: range,
            h: 50,
        };
    }

    takeDamage(damage, knockbackDir, knockback) {
        if (this.invincible) return;
        if (this.state === 'dead') return;

        // Parry check (perfect timing = devastating counter)
        if (this.state === 'block' && this.blockTime < PARRY_WINDOW) {
            playSound('parry');
            triggerFlash('#ffffff', 0.8);
            triggerShake(12, 0.2);
            triggerHitstop(0.15); // long freeze on parry — feels powerful
            // Big spark burst at clash point
            const clashX = this.x + this.facing * 25;
            const clashY = this.y - 35;
            spawnSaberSparks(clashX, clashY, !this.isPlayer);
            spawnSaberSparks(clashX, clashY, this.isPlayer);
            spawnParticles(clashX, clashY, '#ffffff', 10, 300, 0.4);
            // Saber clash ring effect
            saberClashes.push({ x: clashX, y: clashY, time: 0, maxTime: 0.35 });
            this.fury = Math.min(FURY_MAX, this.fury + FURY_PER_PARRY);
            return 'parried';
        }

        // Block check (absorbs most damage, sparks fly)
        if (this.state === 'block' && this.stamina > 0) {
            damage *= 0.15;
            knockback *= 0.25;
            this.stamina -= 15;
            const clashX = this.x + this.facing * 25;
            const clashY = this.y - 30;
            spawnSaberSparks(clashX, clashY, !this.isPlayer);
            playSound('saber_hit');
            triggerHitstop(0.04);
            triggerShake(3, 0.08);
            return 'blocked';
        }

        this.hp -= damage;
        this.vx = knockbackDir * knockback;
        this.vy = -150;

        playSound('saber_hit');
        spawnSaberSparks(this.x + knockbackDir * -10, this.y - 30, !this.isPlayer);
        spawnParticles(this.x, this.y - 25, '#ff8844', 6, 150, 0.3);
        triggerShake(damage > 20 ? 10 : 5, damage > 20 ? 0.2 : 0.12);
        triggerHitstop(damage > 20 ? 0.1 : HITSTOP_DURATION);
        if (damage > 20) triggerChroma(0.3);

        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'dead';
            this.stateTime = 0;
            playSound('death');
            spawnParticles(this.x, this.y - 25, this.isPlayer ? '#8B7355' : '#ff4444', 20, 200, 0.8);
            return 'killed';
        }

        this.state = 'hurt';
        this.stateTime = 0;
        return 'hit';
    }

    update(dt, target) {
        this.stateTime += dt;
        this.comboTimer -= dt;
        this.forcePushCooldown -= dt;
        this.dashCooldown -= dt;
        if (this.speedBoost > 0) this.speedBoost -= dt;
        if (this.powerBoost > 0) this.powerBoost -= dt;

        // Regen
        if (this.state !== 'block') {
            this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA_REGEN * dt);
        }
        this.force = Math.min(this.maxForce, this.force + FORCE_REGEN * dt);

        // State logic
        switch (this.state) {
            case 'hurt':
                if (this.stateTime > 0.3) {
                    this.state = 'idle';
                    this.stateTime = 0;
                }
                break;
            case 'attack1': case 'attack2': case 'attack3': {
                const idx = parseInt(this.state.slice(-1)) - 1;
                const atk = ATTACKS[idx];
                const atkT = this.stateTime / atk.duration;
                // Forward lunge during strike phase (0.2-0.5)
                if (atkT > 0.15 && atkT < 0.55) {
                    this.vx = this.facing * (120 + idx * 60); // heavier = more lunge
                }
                // Hit window
                if (!this.hitApplied && this.stateTime >= atk.hitStart && this.stateTime <= atk.hitEnd) {
                    if (target && aabbOverlap(this.attackHitbox, target.hitbox)) {
                        const dmg = this.powerBoost > 0 ? atk.damage * 2 : atk.damage;
                        const result = target.takeDamage(dmg, this.facing, atk.knockback);
                        this.hitApplied = true;
                        if (result === 'parried') {
                            this.state = 'hurt';
                            this.stateTime = 0;
                            this.vx = -this.facing * 350;
                            this.vy = -80;
                        } else if (result === 'hit' || result === 'killed') {
                            this.fury = Math.min(FURY_MAX, this.fury + FURY_PER_HIT);
                            if (result === 'killed') this.fury = Math.min(FURY_MAX, this.fury + FURY_PER_KILL);
                            if (idx === 2) {
                                triggerZoom(1.05, (this.x + target.x) / 2, (this.y + target.y) / 2 - 20, 0.3);
                                triggerChroma(0.4);
                            }
                        }
                    }
                }
                // End of attack
                if (this.stateTime >= atk.duration) {
                    if (this.canCombo && this.comboStep < 3) {
                        this.state = 'attack' + (this.comboStep + 1);
                        this.stateTime = 0;
                        this.hitApplied = false;
                        this.canCombo = false;
                        playSound('saber_swing');
                    } else {
                        this.state = 'idle';
                        this.stateTime = 0;
                        this.comboStep = 0;
                    }
                }
                break;
            }
            case 'dodge':
                if (this.stateTime > DODGE_DURATION) {
                    this.state = 'idle';
                    this.stateTime = 0;
                    this.invincible = false;
                }
                break;
            case 'force_push':
                if (this.stateTime > 0.4) {
                    this.state = 'idle';
                    this.stateTime = 0;
                }
                // Apply push at frame 0.1
                if (!this.hitApplied && this.stateTime >= 0.1) {
                    this.hitApplied = true;
                    if (target && Math.abs(target.x - this.x) < 250) {
                        target.vx = this.facing * FORCE_PUSH_KNOCKBACK;
                        target.vy = -150;
                        target.state = 'hurt';
                        target.stateTime = 0;
                        spawnParticles(target.x, target.y - 25, '#88ccff', 15, 200, 0.5);
                    }
                }
                break;
            case 'force_lightning':
                this.force -= FORCE_LIGHTNING_COST * dt;
                if (this.force <= 0 || this.stateTime > 1.0) {
                    this.force = Math.max(0, this.force);
                    this.state = 'idle';
                    this.stateTime = 0;
                    this.lightningActive = false;
                } else {
                    this.lightningActive = true;
                    if (target && Math.abs(target.x - this.x) < 300) {
                        target.takeDamage(FORCE_LIGHTNING_DPS * dt, this.facing, 20);
                        this.lightningTarget = { x: target.x, y: target.y - 60 };
                    }
                }
                break;
            case 'block':
                this.stamina -= BLOCK_DRAIN * dt;
                this.blockTime += dt;
                if (this.stamina <= 0) {
                    this.stamina = 0;
                    this.state = 'idle';
                    this.stateTime = 0;
                }
                break;
            case 'dash_attack': {
                const dashT = this.stateTime / DASH_DURATION;
                if (dashT < 0.7) {
                    this.vx = this.facing * DASH_SPEED;
                    if (Math.random() < 0.4) spawnSpeedLines(this.x - this.facing * 30, this.y - 25, -this.facing, 2);
                }
                if (!this.hitApplied && this.stateTime >= 0.05 && this.stateTime <= 0.18) {
                    if (target && aabbOverlap(this.attackHitbox, target.hitbox)) {
                        const dmg = this.powerBoost > 0 ? DASH_DAMAGE * 2 : DASH_DAMAGE;
                        const result = target.takeDamage(dmg, this.facing, DASH_KNOCKBACK);
                        this.hitApplied = true;
                        if (result === 'hit' || result === 'killed') {
                            this.fury = Math.min(FURY_MAX, this.fury + FURY_PER_HIT);
                            triggerZoom(1.03, (this.x + target.x) / 2, (this.y + target.y) / 2 - 20, 0.3);
                        }
                    }
                }
                if (this.stateTime >= DASH_DURATION) {
                    this.state = 'idle'; this.stateTime = 0; this.invincible = false;
                }
                break;
            }
            case 'air_attack': {
                if (!this.hitApplied && this.stateTime >= 0.05 && this.stateTime <= 0.25) {
                    if (target && aabbOverlap(this.attackHitbox, target.hitbox)) {
                        const dmg = this.powerBoost > 0 ? AIR_ATTACK_DAMAGE * 2 : AIR_ATTACK_DAMAGE;
                        const result = target.takeDamage(dmg, this.facing, AIR_ATTACK_KNOCKBACK);
                        this.hitApplied = true;
                        if (result === 'hit') target.vy = AIR_JUGGLE_VY;
                        if (result === 'hit' || result === 'killed') {
                            this.fury = Math.min(FURY_MAX, this.fury + FURY_PER_HIT);
                            playSound('air_hit');
                            triggerZoom(1.03, target.x, target.y - 20, 0.3);
                        }
                    }
                }
                if (this.grounded || this.stateTime > 0.5) {
                    this.state = 'idle'; this.stateTime = 0;
                }
                break;
            }
            case 'fury_ultimate': {
                if (this.stateTime > 1.5) {
                    this.state = 'idle'; this.stateTime = 0;
                    this.invincible = false; this.furySlashCount = 0;
                }
                break;
            }
            case 'dead':
                // Stay dead
                break;
        }

        // Physics
        this.x += this.vx * dt;
        this.vy += GRAVITY * dt;
        this.y += this.vy * dt;

        // Ground
        if (this.y >= GROUND_Y) {
            this.y = GROUND_Y;
            this.vy = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }

        // Friction
        this.vx *= (1 - 8 * dt);

        // Boundaries
        this.x = Math.max(30, Math.min(GAME_W - 30, this.x));

        // Face target
        if (target && this.state !== 'dodge' && this.state !== 'hurt' && this.state !== 'dead') {
            this.facing = target.x > this.x ? 1 : -1;
        }
    }

    startAttack() {
        if (this.state === 'dead' || this.state === 'hurt' || this.state === 'dodge' ||
            this.state === 'dash_attack' || this.state === 'air_attack' || this.state === 'fury_ultimate') return;
        if (this.state === 'attack1' || this.state === 'attack2' || this.state === 'attack3') {
            // Queue combo
            this.canCombo = true;
            this.comboStep++;
            return;
        }
        this.state = 'attack1';
        this.stateTime = 0;
        this.hitApplied = false;
        this.comboStep = 1;
        this.canCombo = false;
        playSound('saber_swing');
    }

    startBlock() {
        if (this.state === 'dead' || this.state === 'hurt') return;
        if (this.state === 'attack1' || this.state === 'attack2' || this.state === 'attack3') return;
        if (this.stamina < 5) return;
        this.state = 'block';
        this.stateTime = 0;
        this.blockTime = 0;
    }

    stopBlock() {
        if (this.state === 'block') {
            this.state = 'idle';
            this.stateTime = 0;
        }
    }

    startDodge() {
        if (this.state === 'dead' || this.state === 'dodge') return;
        if (this.stamina < DODGE_COST) return;
        this.stamina -= DODGE_COST;
        this.state = 'dodge';
        this.stateTime = 0;
        this.invincible = true;
        this.vx = -this.facing * DODGE_SPEED;
    }

    startForcePush() {
        if (this.state === 'dead' || this.state === 'hurt') return;
        if (this.forcePushCooldown > 0) return;
        this.state = 'force_push';
        this.stateTime = 0;
        this.hitApplied = false;
        this.forcePushCooldown = FORCE_PUSH_COOLDOWN;
        playSound('force_push');
    }

    startLightning() {
        if (this.state === 'dead' || this.state === 'hurt') return;
        if (this.force < 20) return;
        this.state = 'force_lightning';
        this.stateTime = 0;
        this.lightningActive = true;
        playSound('lightning');
    }

    startDashAttack() {
        if (this.state === 'dead' || this.state === 'hurt' || this.state === 'dodge' ||
            this.state === 'dash_attack' || this.state === 'fury_ultimate') return;
        if (this.stamina < DASH_COST || this.dashCooldown > 0) return;
        this.stamina -= DASH_COST;
        this.state = 'dash_attack';
        this.stateTime = 0;
        this.hitApplied = false;
        this.dashCooldown = 0.5;
        this.invincible = true;
        playSound('dash_attack');
        spawnSpeedLines(this.x, this.y - 25, -this.facing, 8);
    }

    startAirAttack() {
        if (this.state === 'dead' || this.state === 'hurt' || this.state === 'air_attack' ||
            this.state === 'fury_ultimate') return;
        if (this.grounded) return;
        this.state = 'air_attack';
        this.stateTime = 0;
        this.hitApplied = false;
        this.vy = 200;
        playSound('saber_swing');
    }

    activateFury() {
        if (this.fury < FURY_MAX) return;
        if (this.state === 'dead' || this.state === 'fury_ultimate') return;
        this.fury = 0;
        this.state = 'fury_ultimate';
        this.stateTime = 0;
        this.furySlashCount = 0;
        this.invincible = true;
        playSound('fury_activate');
        triggerSlowMo(0.2, 1.5);
        triggerZoom(1.15, this.x, this.y - 30, 1.5);
        triggerFlash('#ff44ff', 0.6);
        triggerShake(15, 0.3);
        triggerChroma(1);
    }

    draw(time) {
        if (this.isPlayer) {
            drawJedi(this.x, this.y, this.facing, this.state, this.stateTime, this.hp, this.maxHp);
        } else {
            drawSith(this.x, this.y, this.facing, this.state, this.stateTime, this.hp, this.maxHp);
        }

        // Lightning visual
        if (this.lightningActive && this.lightningTarget) {
            drawLightning(
                this.x + this.facing * 40,
                this.y - 75,
                this.lightningTarget.x,
                this.lightningTarget.y,
                time
            );
        }
    }
}

function drawLightningBolt(x1, y1, x2, y2, width, jitter) {
    const segments = 10;
    const points = [{ x: x1, y: y1 }];
    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        points.push({
            x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter,
            y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter * 0.5,
        });
    }
    points.push({ x: x2, y: y2 });

    // Outer glow
    ctx.strokeStyle = '#6666ff';
    ctx.lineWidth = width + 4;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    // Main bolt
    ctx.strokeStyle = '#aaaaff';
    ctx.lineWidth = width + 1;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    // Bright core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    return points;
}

function drawLightning(x1, y1, x2, y2, time) {
    ctx.save();
    ctx.shadowColor = '#4444ff';
    ctx.shadowBlur = 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Main bolt (thick, strong)
    const mainPoints = drawLightningBolt(x1, y1, x2, y2, 2, 35);

    // Secondary bolts (thinner, more erratic)
    ctx.globalAlpha = 0.6;
    drawLightningBolt(x1, y1, x2, y2, 1, 50);

    // Branches from main bolt
    ctx.globalAlpha = 0.4;
    for (let b = 0; b < 3; b++) {
        const branchIdx = 2 + Math.floor(Math.random() * 5);
        if (branchIdx >= mainPoints.length) continue;
        const bp = mainPoints[branchIdx];
        const branchEnd = {
            x: bp.x + (Math.random() - 0.5) * 60,
            y: bp.y + (Math.random() - 0.3) * 40,
        };
        const bSegs = 4;
        ctx.strokeStyle = '#8888ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bp.x, bp.y);
        for (let i = 1; i < bSegs; i++) {
            const t = i / bSegs;
            ctx.lineTo(
                bp.x + (branchEnd.x - bp.x) * t + (Math.random() - 0.5) * 15,
                bp.y + (branchEnd.y - bp.y) * t + (Math.random() - 0.5) * 10
            );
        }
        ctx.lineTo(branchEnd.x, branchEnd.y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Hand glow (origin)
    const handGrad = ctx.createRadialGradient(x1, y1, 0, x1, y1, 25);
    handGrad.addColorStop(0, 'rgba(150, 150, 255, 0.6)');
    handGrad.addColorStop(0.5, 'rgba(100, 100, 255, 0.2)');
    handGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = handGrad;
    ctx.fillRect(x1 - 25, y1 - 25, 50, 50);

    // Flickering hand sparks
    for (let i = 0; i < 3; i++) {
        const sx = x1 + (Math.random() - 0.5) * 14;
        const sy = y1 + (Math.random() - 0.5) * 14;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.fillRect(sx, sy, 2, 2);
    }

    // Impact glow (target)
    const impactGrad = ctx.createRadialGradient(x2, y2, 0, x2, y2, 35);
    impactGrad.addColorStop(0, 'rgba(180, 150, 255, 0.5)');
    impactGrad.addColorStop(0.4, 'rgba(100, 80, 255, 0.2)');
    impactGrad.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.7 + Math.sin(time * 30) * 0.3;
    ctx.fillStyle = impactGrad;
    ctx.fillRect(x2 - 35, y2 - 35, 70, 70);

    // Impact sparks
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 15;
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#aaaaff';
        ctx.fillRect(x2 + Math.cos(angle) * dist, y2 + Math.sin(angle) * dist, 2, 2);
    }

    ctx.shadowBlur = 0;
    ctx.restore();
}

// --- AABB COLLISION ---
function aabbOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// --- ENEMY AI ---
class EnemyAI {
    constructor(fighter, difficulty) {
        this.fighter = fighter;
        this.difficulty = difficulty; // 0-1
        this.thinkTimer = 0;
        this.action = 'approach';
        this.reactionTime = 0.8 - difficulty * 0.6; // 0.8s → 0.2s
        this.blockChance = 0.1 + difficulty * 0.3;
        this.attackChance = 0.6 + difficulty * 0.2;
        this.retreatTimer = 0;
    }

    update(dt, target) {
        if (this.fighter.state === 'dead' || this.fighter.state === 'hurt') return;

        this.thinkTimer -= dt;
        this.retreatTimer -= dt;

        if (this.thinkTimer > 0) return;

        const dist = Math.abs(target.x - this.fighter.x);
        const isAttacking = target.state.startsWith('attack');

        // React to player attacks
        if (isAttacking && dist < 80) {
            const roll = Math.random();
            if (roll < this.blockChance) {
                this.fighter.startBlock();
                this.thinkTimer = this.reactionTime;
                return;
            } else if (roll < this.blockChance + 0.15) {
                this.fighter.startDodge();
                this.thinkTimer = this.reactionTime * 1.5;
                return;
            }
        }

        // Release block after a while
        if (this.fighter.state === 'block' && this.fighter.stateTime > 0.5) {
            this.fighter.stopBlock();
        }

        if (this.retreatTimer > 0) {
            // Move away
            this.fighter.vx = -this.fighter.facing * PLAYER_SPEED * 0.6;
            this.fighter.state = this.fighter.state === 'block' ? 'block' : 'walk';
            if (this.fighter.state === 'walk') this.fighter.stateTime += dt;
            return;
        }

        // Decision based on distance
        if (dist > 200) {
            // Approach
            this.fighter.vx = this.fighter.facing * PLAYER_SPEED * 0.7;
            if (this.fighter.state === 'idle' || this.fighter.state === 'walk') {
                this.fighter.state = 'walk';
            }
            this.thinkTimer = 0.1;
        } else if (dist < 70) {
            // In attack range
            const roll = Math.random();
            if (roll < this.attackChance) {
                this.fighter.startAttack();
                this.thinkTimer = this.reactionTime;
                // Combo chance
                if (this.difficulty > 0.3 && Math.random() < this.difficulty * 0.5) {
                    setTimeout(() => {
                        if (this.fighter.state.startsWith('attack')) {
                            this.fighter.startAttack(); // queue combo
                        }
                    }, 300);
                }
            } else {
                this.retreatTimer = 0.5 + Math.random() * 0.5;
            }
            this.thinkTimer = this.reactionTime;
        } else {
            // Mid range — approach or use Force
            if (Math.random() < 0.1 * this.difficulty && this.fighter.forcePushCooldown <= 0) {
                this.fighter.startForcePush();
                this.thinkTimer = 1;
            } else {
                this.fighter.vx = this.fighter.facing * PLAYER_SPEED * 0.5;
                if (this.fighter.state === 'idle' || this.fighter.state === 'walk') {
                    this.fighter.state = 'walk';
                }
                this.thinkTimer = 0.15;
            }
        }
    }
}

// --- WAVE MANAGER ---
class WaveManager {
    constructor() {
        this.wave = 0;
        this.enemies = [];
        this.ais = [];
        this.spawnQueue = 0;
        this.spawnTimer = 0;
        this.waveCleared = false;
    }

    startWave(waveNum) {
        this.wave = waveNum;
        this.enemies = [];
        this.ais = [];
        this.spawnQueue = Math.min(waveNum, 4); // max 4 enemies
        this.spawnTimer = 0.5;
        this.waveCleared = false;
    }

    update(dt, player) {
        // Spawn enemies
        if (this.spawnQueue > 0) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnEnemy(player);
                this.spawnQueue--;
                this.spawnTimer = 1.0;
            }
        }

        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const ai = this.ais[i];

            ai.update(dt, player);
            enemy.update(dt, player);

            // Remove dead enemies after animation
            if (enemy.state === 'dead' && enemy.stateTime > 2) {
                this.enemies.splice(i, 1);
                this.ais.splice(i, 1);
            }
        }

        // Check wave cleared
        if (this.spawnQueue <= 0 && this.enemies.every(e => e.state === 'dead')) {
            this.waveCleared = true;
        }
    }

    spawnEnemy(player) {
        const side = Math.random() > 0.5 ? GAME_W - 60 : 60;
        const enemy = new Fighter(side, GROUND_Y, false);

        // Scale with wave
        const difficulty = Math.min(1, (this.wave - 1) / 10);
        enemy.maxHp = 60 + this.wave * 15;
        enemy.hp = enemy.maxHp;

        const ai = new EnemyAI(enemy, difficulty);
        this.enemies.push(enemy);
        this.ais.push(ai);
    }

    draw(time) {
        for (const enemy of this.enemies) {
            enemy.draw(time);
        }
    }

    getAliveCount() {
        return this.enemies.filter(e => e.state !== 'dead').length + this.spawnQueue;
    }
}

// --- HUD ---
function drawHUD(player, waveManager, score, bestScore, comboCount, comboTimer) {
    // Player HP bar
    drawBar(20, 20, 200, 16, player.hp, player.maxHp, '#cc2222', '#440000', 'HP');

    // Stamina bar
    drawBar(20, 42, 160, 12, player.stamina, player.maxStamina, '#ccaa22', '#443300', 'STA');

    // Force bar
    drawBar(20, 58, 160, 12, player.force, player.maxForce, '#2244cc', '#001144', 'FRC');

    // Fury bar
    drawBar(20, 74, 160, 12, player.fury, FURY_MAX, '#ff44ff', '#440044', 'FURY');
    if (player.fury >= FURY_MAX) {
        const fp = 0.5 + 0.5 * Math.sin(gameTime * 6);
        ctx.globalAlpha = fp;
        ctx.fillStyle = '#ff44ff';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillText('SPC: FURY!', 190, 84);
        ctx.globalAlpha = 1;
    }

    // Active effects & cooldowns
    let effectY = 95;
    if (player.forcePushCooldown > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillText(`PUSH: ${player.forcePushCooldown.toFixed(1)}s`, 20, effectY);
        effectY += 14;
    }
    if (player.speedBoost > 0) {
        ctx.fillStyle = '#ffff44';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillText(`SPD x1.5 ${player.speedBoost.toFixed(1)}s`, 20, effectY);
        effectY += 14;
    }
    if (player.powerBoost > 0) {
        ctx.fillStyle = '#ff4444';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillText(`PWR x2 ${player.powerBoost.toFixed(1)}s`, 20, effectY);
        effectY += 14;
    }

    // Enemy HP bars (above heads)
    for (const enemy of waveManager.enemies) {
        if (enemy.state !== 'dead') {
            drawBar(enemy.x - 25, enemy.y - 65, 50, 6, enemy.hp, enemy.maxHp, '#cc2222', '#440000', '');
        }
    }

    // Wave counter
    ctx.fillStyle = '#aaaacc';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${waveManager.wave}`, GAME_W / 2, 30);
    ctx.textAlign = 'left';

    // Enemies remaining
    const remaining = waveManager.getAliveCount();
    ctx.fillStyle = '#888899';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ENEMIES: ${remaining}`, GAME_W / 2, 48);
    ctx.textAlign = 'left';

    // Score
    ctx.fillStyle = '#ffcc00';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${score}`, GAME_W - 20, 30);
    ctx.fillStyle = '#888888';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText(`BEST: ${bestScore}`, GAME_W - 20, 45);
    ctx.textAlign = 'left';

    // Combo display
    if (comboCount >= 2 && comboTimer > 0) {
        const scale = 1 + Math.sin(comboTimer * 10) * 0.1;
        ctx.save();
        ctx.translate(GAME_W / 2, GAME_H / 2 - 60);
        ctx.scale(scale, scale);
        ctx.fillStyle = comboCount >= 5 ? '#ff4444' : (comboCount >= 3 ? '#ffaa00' : '#ffffff');
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, comboTimer * 2);
        ctx.fillText(`${comboCount} HIT COMBO!`, 0, 0);
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.textAlign = 'left';
    }

    // Controls hint
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#aaaacc';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('←→ MOVE  ↑ JUMP  CTRL ATK  SHIFT BLOCK  ↓ DODGE  DEL PUSH  PGDN LTNG  ←← DASH  SPC FURY', 20, GAME_H - 12);
    ctx.globalAlpha = 1;
}

function drawBar(x, y, w, h, val, max, color, bgColor, label) {
    const pct = Math.max(0, val / max);

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);

    // Fill
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * pct, h);

    // Border
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Label
    if (label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(8, h - 4)}px "Press Start 2P", monospace`;
        ctx.fillText(label, x + 4, y + h - 3);
    }
}

// --- GAME SCREENS ---
function drawTitleScreen(time) {
    drawBackground(time);

    // Title glow
    const pulse = 0.7 + 0.3 * Math.sin(time * 2);

    ctx.save();
    ctx.textAlign = 'center';

    // Title shadow
    ctx.fillStyle = '#000000';
    ctx.font = '36px "Press Start 2P", monospace';
    ctx.fillText('SABER WARS', GAME_W / 2 + 3, 180 + 3);

    // Title
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 20 * pulse;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SABER WARS', GAME_W / 2, 180);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10 * pulse;
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillText('PIXEL DUEL', GAME_W / 2, 220);
    ctx.shadowBlur = 0;

    // Decorative sabers
    // Blue saber (left)
    ctx.save();
    ctx.translate(GAME_W / 2 - 180, 195);
    ctx.rotate(-0.3);
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#88ccff';
    ctx.fillRect(-2, -40, 4, 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -39, 2, 38);
    ctx.fillStyle = '#888';
    ctx.fillRect(-3, 0, 6, 12);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Red saber (right)
    ctx.save();
    ctx.translate(GAME_W / 2 + 180, 195);
    ctx.rotate(0.3);
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(-2, -40, 4, 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -39, 2, 38);
    ctx.fillStyle = '#888';
    ctx.fillRect(-3, 0, 6, 12);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Start prompt
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#aaccff';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText('PRESS ENTER TO START', GAME_W / 2, 340);
    ctx.globalAlpha = 1;

    // Credits
    ctx.fillStyle = '#555566';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('A long time ago, in a pixel far far away...', GAME_W / 2, 420);

    ctx.restore();
}

function drawGameOverScreen(time, score, bestScore, wave) {
    // Darken
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.save();
    ctx.textAlign = 'center';

    // Game Over
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20;
    ctx.font = '32px "Press Start 2P", monospace';
    ctx.fillText('GAME OVER', GAME_W / 2, 180);
    ctx.shadowBlur = 0;

    // Stats
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillText(`WAVE REACHED: ${wave}`, GAME_W / 2, 240);

    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`SCORE: ${score}`, GAME_W / 2, 270);

    if (score >= bestScore) {
        ctx.fillStyle = '#44ff44';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillText('NEW HIGH SCORE!', GAME_W / 2, 295);
    } else {
        ctx.fillStyle = '#888888';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillText(`BEST: ${bestScore}`, GAME_W / 2, 295);
    }

    // Retry prompt
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#aaccff';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText('PRESS ENTER TO RETRY', GAME_W / 2, 360);
    ctx.globalAlpha = 1;

    ctx.restore();
}

function drawWaveTransition(waveNum, time, duration) {
    const progress = time / duration;
    const fadeIn = Math.min(1, progress * 3);
    const fadeOut = Math.max(0, 1 - (progress - 0.6) * 2.5);
    const alpha = Math.min(fadeIn, fadeOut);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 20;
    ctx.font = '28px "Press Start 2P", monospace';
    ctx.fillText(`WAVE ${waveNum}`, GAME_W / 2, GAME_H / 2 - 10);
    ctx.shadowBlur = 0;

    if (waveNum > 1) {
        ctx.fillStyle = '#44ff44';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillText('GET READY!', GAME_W / 2, GAME_H / 2 + 25);
    }

    ctx.restore();
}

function drawPauseScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.fillText('PAUSED', GAME_W / 2, GAME_H / 2 - 20);
    ctx.fillStyle = '#aaaacc';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText('PRESS ESC TO RESUME', GAME_W / 2, GAME_H / 2 + 20);
    ctx.restore();
}

// --- MAIN GAME STATE ---
const GameState = {
    TITLE: 'title',
    WAVE_INTRO: 'wave_intro',
    PLAYING: 'playing',
    GAME_OVER: 'game_over',
    PAUSED: 'paused',
};

let gameState = GameState.TITLE;
let player = null;
let waveManager = null;
let score = 0;
let bestScore = parseInt(localStorage.getItem('saberWars_bestScore')) || 0;
let comboCount = 0;
let comboTimer = 0;
let lastKillTime = 0;
let waveIntroTimer = 0;
const WAVE_INTRO_DURATION = 2.0;
let gameTime = 0;
let prevGameState = null;

function startGame() {
    initAudio();
    startSaberHum();
    player = new Fighter(200, GROUND_Y, true);
    waveManager = new WaveManager();
    score = 0;
    comboCount = 0;
    comboTimer = 0;
    powerups.length = 0;
    speedLines.length = 0;
    timeScale = 1;
    timeScaleDuration = 0;
    cameraZoom = 1;
    cameraZoomDuration = 0;
    chromaIntensity = 0;
    startWave(1);
}

function startWave(num) {
    waveManager.startWave(num);
    gameState = GameState.WAVE_INTRO;
    waveIntroTimer = 0;
    playSound('wave_start');

    // Heal player between waves
    if (num > 1) {
        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.2);
        player.stamina = player.maxStamina;
        player.force = player.maxForce;
    }
}

// --- PLAYER INPUT ---
// Remapped for right-hand play: arrows + nearby keys
function handlePlayerInput(dt) {
    if (!player || player.state === 'dead') return;

    const canMove = player.state === 'idle' || player.state === 'walk';
    const moveSpeed = player.speedBoost > 0 ? PLAYER_SPEED * 1.5 : PLAYER_SPEED;

    // Double-tap dash detection
    doubleTapTimer -= dt;
    if (wasJustPressed('ArrowRight')) {
        if (lastTapDir === 1 && doubleTapTimer > 0 && canMove) {
            player.facing = 1;
            player.startDashAttack();
            lastTapDir = 0; doubleTapTimer = 0;
        } else { lastTapDir = 1; doubleTapTimer = DOUBLE_TAP_WINDOW; }
    }
    if (wasJustPressed('ArrowLeft')) {
        if (lastTapDir === -1 && doubleTapTimer > 0 && canMove) {
            player.facing = -1;
            player.startDashAttack();
            lastTapDir = 0; doubleTapTimer = 0;
        } else { lastTapDir = -1; doubleTapTimer = DOUBLE_TAP_WINDOW; }
    }

    if (canMove) {
        if (isPressed('ArrowLeft')) {
            player.vx = -moveSpeed;
            player.state = 'walk';
        } else if (isPressed('ArrowRight')) {
            player.vx = moveSpeed;
            player.state = 'walk';
        } else if (player.state === 'walk') {
            player.state = 'idle';
            player.stateTime = 0;
        }
    }

    // Jump — Up arrow
    if (wasJustPressed('ArrowUp') && player.grounded && canMove) {
        player.vy = JUMP_FORCE;
        player.grounded = false;
    }

    // Attack — Air attack if airborne, else normal attack
    if (wasJustPressed('ControlRight') || wasJustPressed('Numpad0') || wasJustPressed('ControlLeft')) {
        if (!player.grounded) {
            player.startAirAttack();
        } else {
            player.startAttack();
        }
    }

    // Fury Ultimate — Space
    if (wasJustPressed('Space')) {
        player.activateFury();
    }

    // Block — Right Shift (hold)
    if (isPressed('ShiftRight') || isPressed('Numpad1')) {
        if (player.state !== 'block') player.startBlock();
    } else {
        player.stopBlock();
    }

    // Dodge — ArrowDown or Numpad 2
    if (wasJustPressed('ArrowDown') || wasJustPressed('Numpad2')) {
        player.startDodge();
    }

    // Force Push — Numpad 4 or Delete (near arrows)
    if (wasJustPressed('Numpad4') || wasJustPressed('Delete') || wasJustPressed('End')) {
        player.startForcePush();
    }

    // Force Lightning — Numpad 5 or PageDown
    if (wasJustPressed('Numpad5') || wasJustPressed('PageDown') || wasJustPressed('Numpad6')) {
        player.startLightning();
    }
}

// --- MAIN LOOP ---
let lastTime = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    rawDt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    updateTimeScale(rawDt);
    const dt = rawDt * timeScale;
    gameTime += dt;

    // Capture justPressed for this frame
    keysThisFrame = { ...justPressed };
    for (const k in justPressed) justPressed[k] = false;

    // Hitstop
    if (hitstopTimer > 0) {
        hitstopTimer -= dt;
        // Still draw but don't update
        draw(gameTime);
        return;
    }

    // State machine
    switch (gameState) {
        case GameState.TITLE:
            if (wasJustPressed('Enter') || wasJustPressed('NumpadEnter')) {
                startGame();
            }
            break;

        case GameState.WAVE_INTRO:
            waveIntroTimer += dt;
            // Update player idle animation
            if (player) player.stateTime += dt;
            if (waveIntroTimer >= WAVE_INTRO_DURATION) {
                gameState = GameState.PLAYING;
            }
            break;

        case GameState.PLAYING:
            // Pause
            if (wasJustPressed('Escape')) {
                prevGameState = GameState.PLAYING;
                gameState = GameState.PAUSED;
                break;
            }

            handlePlayerInput(dt);

            // Find closest enemy as target for player
            let closestEnemy = null;
            let closestDist = Infinity;
            for (const e of waveManager.enemies) {
                if (e.state === 'dead') continue;
                const d = Math.abs(e.x - player.x);
                if (d < closestDist) { closestDist = d; closestEnemy = e; }
            }

            player.update(dt, closestEnemy);
            waveManager.update(dt, player);

            // Fury ultimate multi-hit
            if (player.state === 'fury_ultimate') {
                const ft = player.stateTime;
                const slashTimes = [0.3, 0.6, 0.9];
                for (let i = 0; i < slashTimes.length; i++) {
                    if (ft >= slashTimes[i] && player.furySlashCount <= i) {
                        player.furySlashCount = i + 1;
                        playSound('saber_swing');
                        triggerShake(10, 0.15);
                        spawnSpeedLines(player.x, player.y - 25, i % 2 === 0 ? player.facing : -player.facing, 12);
                        triggerChroma(0.5);
                        for (const enemy of waveManager.enemies) {
                            if (enemy.state === 'dead') continue;
                            if (Math.abs(enemy.x - player.x) < FURY_ULTIMATE_RANGE) {
                                const dmg = player.powerBoost > 0 ? FURY_ULTIMATE_DAMAGE * 2 : FURY_ULTIMATE_DAMAGE;
                                enemy.takeDamage(dmg, player.facing, 250);
                                spawnParticles(enemy.x, enemy.y - 25, '#ff44ff', 15, 250, 0.5);
                            }
                        }
                    }
                }
            }

            // Update power-ups
            updatePowerups(dt, player);

            // Check kills for score/combo
            for (const enemy of waveManager.enemies) {
                if (enemy.state === 'dead' && enemy.stateTime < dt * 2) {
                    // Just died this frame
                    const now = gameTime;
                    if (now - lastKillTime < 3) {
                        comboCount++;
                    } else {
                        comboCount = 1;
                    }
                    comboTimer = 2;
                    lastKillTime = now;
                    score += 100 * waveManager.wave * comboCount;
                    spawnPowerup(enemy.x);
                    if (comboCount === 5) triggerSlowMo(0.5, 0.5);
                }
            }

            comboTimer -= dt;
            if (comboTimer <= 0) comboCount = 0;

            // Player death
            if (player.state === 'dead' && player.stateTime > 1.5) {
                if (score > bestScore) {
                    bestScore = score;
                    localStorage.setItem('saberWars_bestScore', bestScore);
                }
                gameState = GameState.GAME_OVER;
            }

            // Wave cleared
            if (waveManager.waveCleared) {
                triggerSlowMo(0.3, 1.0);
                triggerZoom(1.05, player.x, player.y - 30, 1.0);
                startWave(waveManager.wave + 1);
            }

            updateParticles(dt);
            updateSpeedLines(dt);
            ageArcTrails(arcTrailsBlue, dt);
            ageArcTrails(arcTrailsRed, dt);
            updateSaberClashes(dt);
            if (chromaIntensity > 0) { chromaIntensity -= rawDt * 4; if (chromaIntensity < 0) chromaIntensity = 0; }
            break;

        case GameState.PAUSED:
            if (wasJustPressed('Escape')) {
                gameState = prevGameState || GameState.PLAYING;
            }
            break;

        case GameState.GAME_OVER:
            if (wasJustPressed('Enter') || wasJustPressed('NumpadEnter')) {
                gameState = GameState.TITLE;
            }
            updateParticles(dt);
            ageArcTrails(arcTrailsBlue, dt);
            ageArcTrails(arcTrailsRed, dt);
            updateSaberClashes(dt);
            break;
    }

    // Flash decay
    if (flashAlpha > 0) flashAlpha -= dt * 5;

    draw(gameTime);
}

function draw(time) {
    ctx.imageSmoothingEnabled = false;
    ctx.save();

    // Camera zoom
    updateZoom(rawDt || 1/60);
    if (cameraZoom !== 1) {
        ctx.translate(cameraFocusX, cameraFocusY);
        ctx.scale(cameraZoom, cameraZoom);
        ctx.translate(-cameraFocusX, -cameraFocusY);
    }

    // Screen shake
    updateShake(1 / 60);

    switch (gameState) {
        case GameState.TITLE:
            drawTitleScreen(time);
            break;

        case GameState.WAVE_INTRO:
            drawBackground(time);
            if (player) player.draw(time);
            drawHUD(player, waveManager, score, bestScore, comboCount, comboTimer);
            drawWaveTransition(waveManager.wave, waveIntroTimer, WAVE_INTRO_DURATION);
            break;

        case GameState.PLAYING:
            drawBackground(time);
            if (player) drawDynamicLighting(player, waveManager.enemies);
            drawSpeedLines();
            drawArcTrail(arcTrailsBlue, '#88ccff', '#44aaff');
            drawArcTrail(arcTrailsRed, '#ff4444', '#ff0000');
            waveManager.draw(time);
            if (player) player.draw(time);
            drawParticles();
            drawSaberClashes();
            drawPowerups();
            drawHUD(player, waveManager, score, bestScore, comboCount, comboTimer);
            break;

        case GameState.PAUSED:
            drawBackground(time);
            if (player) drawDynamicLighting(player, waveManager.enemies);
            drawSpeedLines();
            drawArcTrail(arcTrailsBlue, '#88ccff', '#44aaff');
            drawArcTrail(arcTrailsRed, '#ff4444', '#ff0000');
            waveManager.draw(time);
            if (player) player.draw(time);
            drawParticles();
            drawSaberClashes();
            drawPowerups();
            drawHUD(player, waveManager, score, bestScore, comboCount, comboTimer);
            drawPauseScreen();
            break;

        case GameState.GAME_OVER:
            drawBackground(time);
            if (player) drawDynamicLighting(player, waveManager.enemies);
            drawArcTrail(arcTrailsBlue, '#88ccff', '#44aaff');
            drawArcTrail(arcTrailsRed, '#ff4444', '#ff0000');
            waveManager.draw(time);
            if (player) player.draw(time);
            drawParticles();
            drawSaberClashes();
            drawPowerups();
            drawGameOverScreen(time, score, bestScore, waveManager.wave);
            break;
    }

    // Flash overlay
    if (flashAlpha > 0) {
        ctx.globalAlpha = flashAlpha;
        ctx.fillStyle = flashColor;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Chromatic aberration (post-process, outside transform)
    if (chromaIntensity > 0.01) {
        const off = Math.ceil(chromaIntensity * 3);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.07 * chromaIntensity;
        ctx.drawImage(canvas, -off, 0);
        ctx.drawImage(canvas, off, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}

// --- START ---
requestAnimationFrame(gameLoop);
