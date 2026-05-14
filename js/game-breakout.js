/**
 * game-breakout.js
 * ─────────────────────────────────────────────
 * Neon Breakout — Cyberpunk Arkanoid Clone
 *
 * A fully featured canvas game featuring:
 *   - Multi-ball mechanics
 *   - 6 power-up types (wide paddle, multi-ball,
 *     fireball, laser, slow-mo, shield)
 *   - 5 procedural level patterns
 *   - 6 brick types (normal/medium/hard/explode/
 *     indestructible/power)
 *   - Combo multiplier system with decay timer
 *   - Particle explosion FX
 *   - Floating score popups
 *   - Mouse, touch, and keyboard controls
 *   - Hi-score persistence via localStorage
 *
 * Runs entirely in an IIFE — no globals exposed
 * except brkStart() which is called from HTML.
 * ─────────────────────────────────────────────
 */

/* ════════════════════════════════════════════════
   NEON BREAKOUT — Cyberpunk Arkanoid
   Full-featured: multi-ball, power-ups, levels,
   laser walls, combo system, particles, shields
════════════════════════════════════════════════ */
(function() {

// ── Canvas setup ─────────────────────────────────
const canvas = document.getElementById('brk-canvas');
const ctx    = canvas.getContext('2d');

const LOGICAL_W = 480;
const LOGICAL_H = 560;
canvas.width  = LOGICAL_W;
canvas.height = LOGICAL_H;

// ── Colour constants ──────────────────────────────
const CC = '#00ffe7', CM = '#ff003c', CY = '#ffe000',
      CP = '#7b5ea7', CB = '#00bfff', CO = '#ff8c00',
      CBG = '#05070f', CGRID = 'rgba(0,255,231,0.03)';

// ── Game constants ────────────────────────────────
const PAD_H = 10, PAD_SPEED = 8;
const BALL_R = 6;
const BRICK_ROWS = 7, BRICK_COLS = 10;
const BRICK_W = Math.floor((LOGICAL_W - 20) / BRICK_COLS);
const BRICK_H = 18, BRICK_PAD = 3;
const BRICK_TOP = 60;

// ── State ─────────────────────────────────────────
let balls, paddle, bricks, particles, lasers, powerDrops;
let score = 0, hiScore = parseInt(localStorage.getItem('brk_hi')||'0');
let lives, level, combo, comboTimer;
let running, paused, gameOver;
let activePower, powerTimer, powerDuration;
let shield, shieldTimer;
let animId, lastTs;

// ── HUD elements ─────────────────────────────────
const scoreEl   = document.getElementById('brk-score-el');
const hiEl      = document.getElementById('brk-hi-el');
const livesEl   = document.getElementById('brk-lives-el');
const levelEl   = document.getElementById('brk-level-el');
const comboEl   = document.getElementById('brk-combo-el');
const comboBar  = document.getElementById('brk-combo-bar');
const powerEl   = document.getElementById('brk-power-el');
const powerBar  = document.getElementById('brk-power-bar');

// ── Brick type definitions ────────────────────────
const BRICK_TYPES = {
    normal:   { hp:1, col:'#1a2a4a', edge:CC, pts:10,  glow:CC },
    medium:   { hp:2, col:'#2a1a3a', edge:CP, pts:20,  glow:CP },
    hard:     { hp:3, col:'#3a2a0a', edge:CY, pts:30,  glow:CY },
    explode:  { hp:1, col:'#3a0a0a', edge:CM, pts:50,  glow:CM, special:'explode' },
    indestr:  { hp:99,col:'#1a1a1a', edge:'#444',pts:0, glow:'#444' },
    power:    { hp:1, col:'#0a2a2a', edge:CB, pts:25,  glow:CB, special:'power' },
};

// ── Power-up types ────────────────────────────────
const POWERS = ['wide','multi','fire','laser','slow','shield'];
const POWER_COLORS = { wide:CC, multi:CY, fire:CM, laser:CP, slow:CB, shield:CO };
const POWER_LABELS = { wide:'WIDE PAD', multi:'MULTI-BALL', fire:'FIREBALL', laser:'LASER', slow:'SLOW-MO', shield:'SHIELD' };
const POWER_DUR = { wide:600, multi:0, fire:400, laser:500, slow:400, shield:500 };

// ── Level patterns (7 rows x 10 cols) ─────────────
function getLevelBricks(lvl) {
    const bricks = [];
    // generate varied patterns based on level
    const patterns = [
        // Level 1: simple stripes
        (r,c) => r < 3 ? 'normal' : null,
        // Level 2: checkerboard + medium
        (r,c) => r < 5 ? ((r+c)%2===0 ? 'normal' : 'medium') : null,
        // Level 3: diamond with hard center
        (r,c) => {
            const dc = Math.abs(c - 4.5), dr = r;
            if (dr===0 && dc<3) return 'hard';
            if (dr<2 && dc<4) return 'medium';
            if (dr<4 && dc<5) return 'normal';
            return null;
        },
        // Level 4: fortress with indestructibles
        (r,c) => {
            if (c===0||c===9) return 'indestr';
            if (r===0) return 'hard';
            if (r<3) return 'medium';
            if (r<5) return 'normal';
            return null;
        },
        // Level 5+: full grid with explodes
        (r,c) => {
            if ((r+c)%7===0) return 'explode';
            if ((r+c)%5===0) return 'power';
            if (r%3===0) return 'hard';
            return r<6 ? 'medium' : 'normal';
        },
    ];
    const pat = patterns[Math.min(lvl-1, patterns.length-1)];
    for (let r=0; r<BRICK_ROWS; r++) {
        for (let c=0; c<BRICK_COLS; c++) {
            const type = pat(r, c);
            if (!type) continue;
            const def = BRICK_TYPES[type];
            // extra power bricks scattered
            const isPower = type==='power' || (type!=='indestr' && Math.random()<0.07);
            bricks.push({
                x: 10 + c * BRICK_W,
                y: BRICK_TOP + r * (BRICK_H + BRICK_PAD),
                w: BRICK_W - BRICK_PAD, h: BRICK_H,
                type, hp: def.hp, maxHp: def.hp,
                pts: def.pts, col: def.col, edge: def.edge,
                glow: def.glow, special: def.special || null,
                isPower, flash: 0,
                col2: def.col // for flash
            });
        }
    }
    return bricks;
}

// ── Init ─────────────────────────────────────────
function init() {
    const padW = 70 + (activePower==='wide' ? 35 : 0);
    paddle = { x: LOGICAL_W/2 - padW/2, y: LOGICAL_H - 40, w: padW, h: PAD_H, targetX: LOGICAL_W/2 - padW/2 };
    balls = [newBall()];
    bricks = getLevelBricks(level);
    particles = [];
    lasers = [];
    powerDrops = [];
    combo = 1; comboTimer = 0;
    activePower = null; powerTimer = 0; powerDuration = 0;
    shield = false; shieldTimer = 0;
    running = true; paused = false; gameOver = false;
    updateHUD();
}

function newBall(fromX, fromY, vx, vy) {
    const speed = 4 + level * 0.25;
    const angle = vx && vy ? Math.atan2(vy, vx) : (-Math.PI/2 + (Math.random()-.5)*0.8);
    return {
        x: fromX || LOGICAL_W/2,
        y: fromY || paddle.y - BALL_R - 2,
        vx: vx || Math.cos(angle) * speed,
        vy: vy || Math.sin(angle) * speed,
        fire: activePower==='fire',
        trail: [],
    };
}

// ── HUD ──────────────────────────────────────────
function updateHUD() {
    scoreEl.textContent = score;
    if (score > hiScore) { hiScore = score; hiEl.textContent = hiScore; }
    const hearts = '◈'.repeat(Math.max(0,lives));
    livesEl.textContent = hearts || '—';
    livesEl.style.color = lives > 1 ? CM : '#ff0000';
    levelEl.textContent = level;
    comboEl.textContent = 'x'+combo;
    comboEl.style.color = combo > 3 ? CM : combo > 1 ? CY : 'var(--muted)';
    comboBar.style.width = Math.max(0, comboTimer/90*100)+'%';
    comboBar.style.background = combo>3 ? CM : combo>1 ? CY : CM;
    if (activePower) {
        powerEl.textContent = POWER_LABELS[activePower];
        powerEl.style.color = POWER_COLORS[activePower];
        powerBar.style.width = (powerTimer/powerDuration*100)+'%';
        powerBar.style.background = POWER_COLORS[activePower];
    } else {
        powerEl.textContent = '—';
        powerEl.style.color = 'var(--muted)';
        powerBar.style.width = '0%';
    }
}

// ── Particles ────────────────────────────────────
function spawnParticles(x, y, col, n, speed) {
    for (let i=0; i<n; i++) {
        const a = Math.random()*Math.PI*2;
        const s = (speed||2) + Math.random()*3;
        particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:1,
            decay:0.02+Math.random()*0.03, size:1.5+Math.random()*3, col });
    }
}

function spawnExplosion(x, y, col) {
    spawnParticles(x, y, col, 28, 4);
    // shockwave ring
    particles.push({ type:'ring', x, y, r:0, maxR:50, life:1, decay:0.04, col });
}

// ── Score floater ─────────────────────────────────
let floaters = [];
function spawnFloater(x, y, text, col) {
    floaters.push({ x, y, text, col, life:1, vy:-1.1 });
}

// ── Power drop ───────────────────────────────────
function spawnPowerDrop(x, y) {
    const type = POWERS[Math.floor(Math.random()*POWERS.length)];
    powerDrops.push({ x, y, type, vy:1.5+Math.random(), pulse:0, w:24, h:14 });
}

// ── Laser ─────────────────────────────────────────
function fireLaser() {
    const cx = paddle.x + paddle.w/2;
    lasers.push({ x:cx-2, y:paddle.y, w:4, h:16, vy:-10, life:1 });
    lasers.push({ x:cx+10, y:paddle.y, w:4, h:16, vy:-10, life:1 });
}

// ── AABB ball-rect collision ──────────────────────
function ballBrick(ball, brick) {
    // expanded rect by BALL_R
    const bx = brick.x - BALL_R, by = brick.y - BALL_R;
    const bw = brick.w + BALL_R*2, bh = brick.h + BALL_R*2;
    if (ball.x < bx || ball.x > bx+bw || ball.y < by || ball.y > by+bh) return null;
    // which face?
    const dx1 = (ball.x - brick.x), dx2 = (brick.x+brick.w - ball.x);
    const dy1 = (ball.y - brick.y), dy2 = (brick.y+brick.h - ball.y);
    const minX = Math.min(dx1, dx2), minY = Math.min(dy1, dy2);
    return minX < minY ? 'x' : 'y';
}

// ── Tick ──────────────────────────────────────────
function tick(dt) {
    // Keyboard input — direct, no lerp (instant response)
    applyKeyboardInput();

    // Mouse lerp — only when keyboard isn't driving
    const keyDriving = keysHeld.has('ArrowLeft')||keysHeld.has('ArrowRight')||keysHeld.has('a')||keysHeld.has('A')||keysHeld.has('d')||keysHeld.has('D');
    if (!keyDriving) {
        const lerpSpeed = 0.22;
        paddle.x += (paddle.targetX - paddle.x) * lerpSpeed;
        paddle.x = Math.max(0, Math.min(LOGICAL_W - paddle.w, paddle.x));
    }

    // Power timers
    if (activePower && activePower !== 'shield') {
        powerTimer--;
        if (powerTimer <= 0) {
            activePower = null;
            balls.forEach(b => b.fire = false);
            // restore paddle width
            const nw = 70; paddle.w = nw;
        }
    }
    if (shield) { shieldTimer--; if (shieldTimer<=0) shield=false; }
    if (comboTimer > 0) { comboTimer--; if (comboTimer===0) combo=1; }

    // Laser fire (auto-fire)
    if (activePower==='laser' && powerTimer%18===0) fireLaser();

    // Balls
    for (let bi = balls.length-1; bi >= 0; bi--) {
        const ball = balls[bi];
        const spd = activePower==='slow' ? 0.5 : 1;

        // Trail
        ball.trail.push({x:ball.x, y:ball.y});
        if (ball.trail.length > 8) ball.trail.shift();

        ball.x += ball.vx * spd;
        ball.y += ball.vy * spd;

        // Walls
        if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); spawnParticles(ball.x, ball.y, CC, 4); sndWallBounce(); }
        if (ball.x + BALL_R > LOGICAL_W) { ball.x = LOGICAL_W-BALL_R; ball.vx = -Math.abs(ball.vx); spawnParticles(ball.x, ball.y, CC, 4); sndWallBounce(); }
        if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); spawnParticles(ball.x, ball.y, CC, 4); sndWallBounce(); }

        // Bottom — lose life or shield
        if (ball.y + BALL_R > LOGICAL_H) {
            if (shield) {
                ball.y = LOGICAL_H - BALL_R - 1;
                ball.vy = -Math.abs(ball.vy);
                spawnParticles(ball.x, ball.y, CO, 10);
            } else {
                balls.splice(bi, 1);
                if (balls.length === 0) {
                    loseLife();
                    return;
                }
            }
            continue;
        }

        // Paddle collision
        if (ball.vy > 0 &&
            ball.y + BALL_R >= paddle.y &&
            ball.y - BALL_R <= paddle.y + PAD_H &&
            ball.x >= paddle.x - 4 &&
            ball.x <= paddle.x + paddle.w + 4) {

            ball.y = paddle.y - BALL_R;
            // angle based on hit position
            const hitPos = (ball.x - paddle.x) / paddle.w; // 0..1
            const maxAngle = 65 * Math.PI/180;
            const angle = -Math.PI/2 + (hitPos - 0.5) * 2 * maxAngle;
            const speed = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
            ball.vx = Math.cos(angle) * speed;
            ball.vy = Math.sin(angle) * speed;
            // ensure upward
            if (ball.vy > 0) ball.vy = -ball.vy;
            spawnParticles(ball.x, paddle.y, CC, 6);
            sndPaddleHit();
        }

        // Brick collisions
        for (let i = bricks.length-1; i >= 0; i--) {
            const br = bricks[i];
            const face = ballBrick(ball, br);
            if (!face) continue;

            // indestructible: just bounce
            if (br.type === 'indestr') {
                if (face==='x') ball.vx = -ball.vx;
                else ball.vy = -ball.vy;
                spawnParticles(br.x+br.w/2, br.y+br.h/2, '#444', 5);
                continue;
            }

            // hit brick
            if (!ball.fire) {
                if (face==='x') ball.vx = -ball.vx;
                else ball.vy = -ball.vy;
            }
            br.flash = 8;
            br.hp--;
            if (br.hp > 0) sndBrickHit();
            if (br.hp <= 0) {
                sndBrickPop();
                // destroyed
                const pts = br.pts * combo;
                score += pts;
                combo = Math.min(combo+1, 10);
                comboTimer = 90;
                spawnParticles(br.x+br.w/2, br.y+br.h/2, br.glow, 14);
                if (pts > 30) spawnFloater(br.x+br.w/2, br.y, '+'+pts, br.glow);

                // specials
                if (br.special==='explode') {
                    spawnExplosion(br.x+br.w/2, br.y+br.h/2, CM);
                    // destroy neighbours
                    bricks.forEach(nb => {
                        if (nb===br || nb.hp<=0) return;
                        const dx=Math.abs((nb.x+nb.w/2)-(br.x+br.w/2));
                        const dy=Math.abs((nb.y+nb.h/2)-(br.y+br.h/2));
                        if (dx<BRICK_W*2 && dy<BRICK_H*3) { nb.hp=0; score+=nb.pts; spawnParticles(nb.x+nb.w/2,nb.y+nb.h/2,CM,8); }
                    });
                }
                if (br.isPower || br.special==='power') spawnPowerDrop(br.x+br.w/2, br.y+br.h);
                bricks.splice(i, 1);
            }
            updateHUD();
            break; // one brick per frame per ball
        }
    }

    // Lasers
    for (let i=lasers.length-1; i>=0; i--) {
        const las = lasers[i];
        las.y += las.vy;
        if (las.y < 0) { lasers.splice(i,1); continue; }
        // brick collision
        let hit = false;
        for (let j=bricks.length-1; j>=0; j--) {
            const br = bricks[j];
            if (las.x < br.x+br.w && las.x+las.w > br.x && las.y < br.y+br.h && las.y+las.h > br.y) {
                if (br.type!=='indestr') {
                    br.hp--; br.flash=6;
                    if (br.hp<=0) { spawnParticles(br.x+br.w/2,br.y+br.h/2,br.glow,10); bricks.splice(j,1); score+=br.pts; updateHUD(); }
                }
                lasers.splice(i,1); hit=true; break;
            }
        }
    }

    // Power drops
    for (let i=powerDrops.length-1; i>=0; i--) {
        const pd = powerDrops[i];
        pd.y += pd.vy;
        pd.pulse += 0.1;
        if (pd.y > LOGICAL_H) { powerDrops.splice(i,1); continue; }
        // paddle catch
        if (pd.y+pd.h >= paddle.y && pd.y <= paddle.y+PAD_H &&
            pd.x+pd.w >= paddle.x && pd.x <= paddle.x+paddle.w) {
            applyPower(pd.type);
            spawnParticles(pd.x+pd.w/2, pd.y, POWER_COLORS[pd.type], 16);
            sndPowerUp();
            powerDrops.splice(i,1);
        }
    }

    // Particles
    for (let i=particles.length-1; i>=0; i--) {
        const p = particles[i];
        p.life -= p.decay;
        if (p.life<=0) { particles.splice(i,1); continue; }
        if (p.type==='ring') { p.r += 3; continue; }
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.07;
    }

    // Floaters
    for (let i=floaters.length-1; i>=0; i--) {
        floaters[i].y += floaters[i].vy;
        floaters[i].life -= 0.02;
        if (floaters[i].life<=0) floaters.splice(i,1);
    }

    // Brick flash
    bricks.forEach(br => { if (br.flash>0) br.flash--; });

    // Level complete?
    const remaining = bricks.filter(b=>b.type!=='indestr');
    if (remaining.length===0) {
        levelUp();
    }
}

// ── Power-up activation ───────────────────────────
function applyPower(type) {
    if (type==='shield') { shield=true; shieldTimer=POWER_DUR.shield; }
    else if (type==='multi') {
        // spawn extra balls
        const extra = Math.min(balls.length, 2);
        for (let i=0; i<extra; i++) {
            const b = balls[i];
            balls.push(newBall(b.x, b.y, -b.vx+0.5, b.vy));
            balls.push(newBall(b.x, b.y, b.vx-0.5, -b.vy));
        }
    } else {
        activePower = type;
        powerDuration = POWER_DUR[type];
        powerTimer = powerDuration;
        if (type==='wide') { paddle.w = 105; paddle.x = Math.min(LOGICAL_W-105, paddle.x); }
        if (type==='fire') balls.forEach(b => b.fire=true);
    }
    updateHUD();
}

// ── Level up ─────────────────────────────────────
function levelUp() {
    level++;
    sndLevelUp();
    spawnExplosion(LOGICAL_W/2, LOGICAL_H/2, CC);
    setTimeout(() => {
        if (!running) return;
        balls = [newBall()];
        paddle.w = 70; paddle.x = LOGICAL_W/2-35;
        bricks = getLevelBricks(level);
        activePower=null; powerTimer=0;
        updateHUD();
    }, 600);
}

// ── Lose life ─────────────────────────────────────
function loseLife() {
    lives--;
    sndLoseLife();
    updateHUD();
    spawnExplosion(paddle.x+paddle.w/2, paddle.y, CM);
    if (lives <= 0) {
        endGame();
    } else {
        setTimeout(() => {
            if (gameOver) return;
            paddle.x = LOGICAL_W/2 - 35; paddle.w = 70;
            balls = [newBall()];
            activePower=null; powerTimer=0;
        }, 500);
    }
}

// ── End game ──────────────────────────────────────
function endGame() {
    running = false; gameOver = true;
    cancelAnimationFrame(animId);
    const hi = Math.max(score, parseInt(localStorage.getItem('brk_hi')||'0'));
    localStorage.setItem('brk_hi', hi);
    hiEl.textContent = hi;

    const overlay = document.getElementById('brk-overlay');
    const title   = document.getElementById('brk-overlay-title');
    const sub     = document.getElementById('brk-overlay-sub');
    const scEl    = document.getElementById('brk-overlay-score');
    const hiOvEl  = document.getElementById('brk-overlay-hi');
    const btn     = document.getElementById('brk-start-btn');
    title.textContent = 'SYSTEM FAILURE';
    title.style.color = CM; title.style.textShadow = `0 0 30px ${CM}`;
    sub.textContent = 'GRID DESTROYED — NEURAL LINK LOST';
    scEl.style.display='block'; scEl.textContent = 'SCORE: '+score;
    hiOvEl.style.display='block'; hiOvEl.textContent = 'ALL-TIME BEST: '+hi;
    btn.textContent='REBOOT'; btn.style.background=CM;
    overlay.style.display='flex';

    // Canvas shake
    canvas.style.animation = 'brkShake 0.5s ease';
    setTimeout(()=>{canvas.style.animation='';}, 500);
}

// ── Draw ──────────────────────────────────────────
function draw() {
    ctx.clearRect(0,0,LOGICAL_W,LOGICAL_H);
    ctx.fillStyle = CBG;
    ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);

    // Grid
    ctx.strokeStyle = CGRID; ctx.lineWidth=0.5;
    for (let x=0; x<=LOGICAL_W; x+=30) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,LOGICAL_H);ctx.stroke(); }
    for (let y=0; y<=LOGICAL_H; y+=30) { ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(LOGICAL_W,y);ctx.stroke(); }

    // Bricks
    bricks.forEach(br => {
        const flash = br.flash > 0;
        const hpFrac = br.hp / br.maxHp;
        const alpha = br.type==='indestr' ? 0.5 : 0.35+hpFrac*0.65;

        ctx.shadowColor = br.glow;
        ctx.shadowBlur  = flash ? 20 : 6;

        // fill
        ctx.fillStyle = flash ? br.glow : br.col;
        ctx.globalAlpha = alpha;
        ctx.fillRect(br.x+1, br.y+1, br.w-2, br.h-2);
        ctx.globalAlpha = 1;

        // edge
        ctx.strokeStyle = flash ? '#fff' : br.edge;
        ctx.lineWidth = flash ? 2 : 1;
        ctx.strokeRect(br.x+0.5, br.y+0.5, br.w-1, br.h-1);

        // hp bar on multi-hp bricks
        if (br.maxHp > 1 && br.type!=='indestr') {
            ctx.fillStyle = br.edge;
            ctx.globalAlpha=0.5;
            ctx.fillRect(br.x+2, br.y+br.h-3, (br.w-4)*hpFrac, 2);
            ctx.globalAlpha=1;
        }

        // special indicator
        if (br.special==='explode') {
            ctx.fillStyle=CM; ctx.font=`bold 9px monospace`;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('✕', br.x+br.w/2, br.y+br.h/2);
        }
        if (br.isPower||br.special==='power') {
            ctx.fillStyle=CB; ctx.font=`bold 8px monospace`;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('P', br.x+br.w/2, br.y+br.h/2);
        }
    });
    ctx.shadowBlur=0;

    // Shield line
    if (shield) {
        const frac = shieldTimer/POWER_DUR.shield;
        ctx.strokeStyle=CO; ctx.lineWidth=3; ctx.shadowColor=CO; ctx.shadowBlur=12;
        ctx.globalAlpha=0.7*frac;
        ctx.beginPath(); ctx.moveTo(0,LOGICAL_H-2); ctx.lineTo(LOGICAL_W*(frac),LOGICAL_H-2); ctx.stroke();
        ctx.globalAlpha=1; ctx.shadowBlur=0;
    }

    // Paddle
    const padGlow = activePower ? POWER_COLORS[activePower] : CC;
    ctx.shadowColor=padGlow; ctx.shadowBlur=16;
    const pg = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y+PAD_H);
    pg.addColorStop(0, padGlow);
    pg.addColorStop(1, 'rgba(0,255,231,0.1)');
    ctx.fillStyle=pg;
    roundRect(ctx, paddle.x, paddle.y, paddle.w, PAD_H, 3);
    ctx.fill();
    ctx.strokeStyle=padGlow; ctx.lineWidth=1.5;
    roundRect(ctx, paddle.x, paddle.y, paddle.w, PAD_H, 3);
    ctx.stroke();
    // center nub
    ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.fillRect(paddle.x+paddle.w/2-8, paddle.y+2, 16, 2);
    ctx.shadowBlur=0;

    // Balls
    balls.forEach(ball => {
        // trail
        ball.trail.forEach((t,i)=>{
            const a=(i/ball.trail.length)*0.25;
            ctx.beginPath();
            ctx.arc(t.x, t.y, BALL_R*(i/ball.trail.length)*0.7, 0, Math.PI*2);
            ctx.fillStyle=`rgba(${ball.fire?'255,0,60':'0,255,231'},${a})`;
            ctx.fill();
        });
        // ball
        const bcol = ball.fire ? CM : CC;
        ctx.shadowColor=bcol; ctx.shadowBlur=ball.fire?20:14;
        const bg = ctx.createRadialGradient(ball.x-1, ball.y-1, 1, ball.x, ball.y, BALL_R);
        bg.addColorStop(0, '#fff');
        bg.addColorStop(0.3, bcol);
        bg.addColorStop(1, 'rgba(0,200,180,0.1)');
        ctx.fillStyle=bg;
        ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
    });

    // Power drops
    powerDrops.forEach(pd => {
        const col = POWER_COLORS[pd.type];
        const pulse = Math.sin(pd.pulse)*0.3+0.7;
        ctx.shadowColor=col; ctx.shadowBlur=12*pulse;
        ctx.fillStyle=col; ctx.globalAlpha=0.9;
        roundRect(ctx, pd.x-pd.w/2, pd.y, pd.w, pd.h, 3); ctx.fill();
        ctx.strokeStyle='#fff'; ctx.lineWidth=0.5; ctx.globalAlpha=0.5;
        roundRect(ctx, pd.x-pd.w/2, pd.y, pd.w, pd.h, 3); ctx.stroke();
        ctx.globalAlpha=1;
        ctx.fillStyle='#fff'; ctx.font=`bold 7px "Share Tech Mono",monospace`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowBlur=0;
        ctx.fillText(pd.type.toUpperCase(), pd.x, pd.y+pd.h/2);
    });

    // Lasers
    lasers.forEach(l => {
        ctx.shadowColor=CP; ctx.shadowBlur=10;
        ctx.fillStyle=CP;
        ctx.fillRect(l.x, l.y, l.w, l.h);
        ctx.shadowBlur=0;
    });

    // Particles
    particles.forEach(p => {
        if (p.type==='ring') {
            ctx.strokeStyle=p.col; ctx.lineWidth=2; ctx.globalAlpha=p.life*0.5;
            ctx.shadowColor=p.col; ctx.shadowBlur=10;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.stroke();
            ctx.globalAlpha=1; ctx.shadowBlur=0;
            return;
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size*p.life, 0, Math.PI*2);
        ctx.fillStyle=p.col; ctx.globalAlpha=p.life;
        ctx.shadowColor=p.col; ctx.shadowBlur=6;
        ctx.fill();
        ctx.globalAlpha=1; ctx.shadowBlur=0;
    });

    // Floaters
    floaters.forEach(f => {
        ctx.globalAlpha=f.life; ctx.fillStyle=f.col;
        ctx.shadowColor=f.col; ctx.shadowBlur=8;
        ctx.font=`bold 13px "Orbitron",monospace`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha=1; ctx.shadowBlur=0;
    });

    // Pause overlay
    if (paused) {
        ctx.fillStyle='rgba(5,7,15,0.65)'; ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);
        ctx.fillStyle=CC; ctx.shadowColor=CC; ctx.shadowBlur=20;
        ctx.font=`bold 28px "Orbitron",monospace`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('PAUSED', LOGICAL_W/2, LOGICAL_H/2);
        ctx.shadowBlur=0;
    }

    // Level display (top)
    ctx.font=`11px "Share Tech Mono",monospace`;
    ctx.textAlign='left'; ctx.fillStyle='rgba(0,255,231,0.25)';
    ctx.fillText(`LEVEL ${level}`, 14, 20);
    ctx.textAlign='right';
    ctx.fillText(`BLOCKS: ${bricks.filter(b=>b.type!=='indestr').length}`, LOGICAL_W-14, 20);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
    ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
    ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
    ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

// ── Web Audio — tiny beep engine ─────────────────
const _ac = (function() {
    try { return new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
})();

function beep(freq, type, duration, vol, freqEnd) {
    if (!_ac) return;
    try {
        const osc = _ac.createOscillator();
        const gain = _ac.createGain();
        osc.connect(gain); gain.connect(_ac.destination);
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, _ac.currentTime);
        if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, _ac.currentTime + duration);
        gain.gain.setValueAtTime(vol || 0.08, _ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, _ac.currentTime + duration);
        osc.start(_ac.currentTime);
        osc.stop(_ac.currentTime + duration);
    } catch(e) {}
}

function sndBrickHit()   { beep(440, 'square',   0.04, 0.06, 220); }
function sndPaddleHit()  { beep(280, 'triangle', 0.06, 0.07, 320); }
function sndBrickPop()   { beep(660, 'square',   0.08, 0.07, 880); }
function sndLoseLife()   { beep(200, 'sawtooth', 0.4,  0.10, 80);  }
function sndLevelUp()    {
    [523,659,784,1047].forEach((f,i) => setTimeout(()=>beep(f,'triangle',0.15,0.08), i*80));
}
function sndPowerUp()    { beep(880, 'sine',     0.2,  0.08, 1320); }
function sndWallBounce() { beep(180, 'square',   0.03, 0.04); }

// Resume AudioContext on first user gesture (browser autoplay policy)
function resumeAudio() { if (_ac && _ac.state === 'suspended') _ac.resume(); }
document.addEventListener('keydown', resumeAudio, { once: false });
canvas.addEventListener('click', resumeAudio, { once: false });
canvas.addEventListener('touchstart', resumeAudio, { once: false });

// ── Game loop ─────────────────────────────────────
function loop(ts) {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    if (!paused) tick(ts - (lastTs||ts));
    lastTs = ts;
    draw();
}

// ── Public API ────────────────────────────────────
window.brkStart = function() {
    score=0; lives=3; level=1; combo=1; comboTimer=0;
    hiScore = parseInt(localStorage.getItem('brk_hi')||'0');
    hiEl.textContent = hiScore;

    document.getElementById('brk-overlay').style.display='none';
    document.getElementById('brk-start-btn').textContent='BOOT GAME';
    document.getElementById('brk-start-btn').style.background='';
    document.getElementById('brk-overlay-title').textContent='NEON BREAKOUT';
    document.getElementById('brk-overlay-title').style.color=CC;
    document.getElementById('brk-overlay-title').style.textShadow=`0 0 30px ${CC}`;
    document.getElementById('brk-overlay-score').style.display='none';
    document.getElementById('brk-overlay-hi').style.display='none';

    // Always show controls strip — touch users get swipe, keyboard users see WASD hint
    document.getElementById('brk-touch-strip').style.display='block';

    cancelAnimationFrame(animId);
    init();
    lastTs = performance.now();
    animId = requestAnimationFrame(loop);
};

/* Pause / resume — called by mobile button */
window.brkPause = function() {
    if (!running || gameOver) return;
    paused = !paused;
    if (!paused) lastTs = performance.now();
    const btn = document.getElementById('brk-pause-btn');
    if (btn) btn.textContent = paused ? '▶ Resume' : '⏸ Pause';
};

/* Restart — called by mobile button */
window.brkRestart = function() {
    window.brkStart();
};

/* Inject mobile control buttons below the HUD strip — no HTML edit needed */
(function() {
    const layout = document.querySelector('.brk-layout');
    if (!layout) return;
    const controls = document.createElement('div');
    controls.className = 'brk-mobile-controls';
    controls.innerHTML =
        '<button id="brk-pause-btn"   class="btn btn-ghost brk-mobile-btn" onclick="brkPause()">⏸ Pause</button>' +
        '<button id="brk-restart-btn" class="btn btn-ghost brk-mobile-btn" onclick="brkRestart()">↺ Restart</button>';
    layout.parentNode.insertAfter
        ? layout.parentNode.insertAfter(controls, layout)
        : layout.after(controls);
})();

// ── Mouse / pointer input ─────────────────────────
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    paddle.targetX = mx - paddle.w/2;
});

// Touch on canvas (direct swipe)
let touchX = null;
canvas.addEventListener('touchstart', e => {
    touchX = e.touches[0].clientX;
    e.preventDefault();
}, {passive:false});
canvas.addEventListener('touchmove', e => {
    if (touchX===null) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_W / rect.width;
    const mx = (e.touches[0].clientX - rect.left) * scaleX;
    paddle.targetX = mx - paddle.w/2;
    // Update touch strip indicator
    const strip = document.getElementById('brk-touch-strip');
    if (strip) {
        const ind = document.getElementById('brk-touch-indicator');
        const frac = Math.max(0, Math.min(1, mx/LOGICAL_W));
        ind.style.left = (frac*100)+'%';
    }
    e.preventDefault();
}, {passive:false});
canvas.addEventListener('touchend', e => { touchX=null; }, {passive:false});

// Touch on the bottom strip
const strip = document.getElementById('brk-touch-strip');
if (strip) {
    strip.addEventListener('touchmove', e => {
        const rect = strip.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
        paddle.targetX = frac * (LOGICAL_W - paddle.w);
        const ind = document.getElementById('brk-touch-indicator');
        ind.style.left = (frac*100)+'%';
        e.preventDefault();
    }, {passive:false});
}

// ── Keyboard — held-key state (no OS repeat lag) ──
const keysHeld = new Set();
document.addEventListener('keydown', e => {
    // Never intercept keys when user is typing in an input or textarea
    const tag = document.activeElement && document.activeElement.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';

    keysHeld.add(e.key);
    if (e.key===' ') {
        if (!isTyping) {
            if (running && activePower==='laser') fireLaser();
            e.preventDefault();
        }
    }
    if (!isTyping && (e.key==='p'||e.key==='P') && running) {
        paused = !paused;
        if (!paused) lastTs = performance.now();
    }
    if ((e.key==='r'||e.key==='R') && gameOver) window.brkStart();
});
document.addEventListener('keyup', e => { keysHeld.delete(e.key); });

// called every tick — smooth, frame-rate-based paddle movement
function applyKeyboardInput() {
    if (!running || paused) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return; // don't move paddle while typing
    const speed = PAD_SPEED * 1.12; // 1.6 * 0.7 ≈ 1.12
    const left  = keysHeld.has('ArrowLeft')  || keysHeld.has('a') || keysHeld.has('A');
    const right = keysHeld.has('ArrowRight') || keysHeld.has('d') || keysHeld.has('D');
    if (left)  paddle.x = Math.max(0, paddle.x - speed);
    if (right) paddle.x = Math.min(LOGICAL_W - paddle.w, paddle.x + speed);
    // keep targetX in sync so mouse lerp doesn't fight keyboard
    if (left || right) paddle.targetX = paddle.x;
}

// ── Initial idle draw ─────────────────────────────
ctx.fillStyle=CBG; ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);
ctx.strokeStyle=CGRID; ctx.lineWidth=0.5;
for (let x=0;x<=LOGICAL_W;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,LOGICAL_H);ctx.stroke();}
for (let y=0;y<=LOGICAL_H;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(LOGICAL_W,y);ctx.stroke();}
hiEl.textContent = localStorage.getItem('brk_hi')||'0';

})(); // end IIFE
