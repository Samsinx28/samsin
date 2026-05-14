/**
 * background.js
 * ─────────────────────────────────────────────
 * Ambient visual effects — loaded last so they
 * never block page content:
 *
 *   1. Particle System — 120 floating dots with
 *      mouse-repulsion and canvas line connections
 *   2. Hex Rain Columns — random glyphs that fall
 *      down the page (CSS animation driven)
 *   3. Cursor Trail — 8-dot fading trail that
 *      follows the mouse pointer
 * ─────────────────────────────────────────────
 * All three run in isolated IIFEs so they share
 * no global state with the rest of the site.
 */

/* ══════════════════════════════════════
   1. PARTICLE SYSTEM
   Canvas-based. 120 particles drift across the
   viewport and draw connection lines when close.
   Pauses when the tab is hidden (visibilitychange).
══════════════════════════════════════ */
(function () {
    const canvas = document.getElementById('particle-canvas');
    const ctx    = canvas.getContext('2d');
    let W, H;
    let particles = [];
    const mouse = { x: -9999, y: -9999 };

    const PARTICLE_COUNT  = 120;
    const CONNECTION_DIST = 120;  // px — max distance to draw a connecting line
    const MOUSE_DIST      = 180;  // px — radius of mouse repulsion
    const CYAN    = [0, 255, 231];
    const MAGENTA = [255, 0, 60];

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function rand(a, b) { return a + Math.random() * (b - a); }

    function createParticle() {
        const isCyan = Math.random() > 0.25; // 75% cyan, 25% magenta
        return {
            x: rand(0, W), y: rand(0, H),
            vx: rand(-0.25, 0.25), vy: rand(-0.25, 0.25),
            r: rand(0.5, 2),
            alpha: rand(0.15, 0.55),
            col: isCyan ? CYAN : MAGENTA,
            flicker:    rand(0.005, 0.02),
            flickerDir: 1,
        };
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(createParticle());

    document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

    // Pause animation when tab is not visible to save CPU
    let _rafPaused = false;
    document.addEventListener('visibilitychange', () => { _rafPaused = document.hidden; });

    function draw() {
        if (!_rafPaused) {
            ctx.clearRect(0, 0, W, H);

            // Update + draw each particle
            particles.forEach(p => {
                // Flicker alpha
                p.alpha += p.flicker * p.flickerDir;
                if (p.alpha > 0.6 || p.alpha < 0.05) p.flickerDir *= -1;

                // Mouse repulsion
                const dx   = p.x - mouse.x, dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MOUSE_DIST) {
                    const force = (MOUSE_DIST - dist) / MOUSE_DIST * 0.012;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }

                // Speed cap
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                if (speed > 0.8) { p.vx = (p.vx / speed) * 0.8; p.vy = (p.vy / speed) * 0.8; }

                p.x += p.vx;
                p.y += p.vy;

                // Wrap around edges
                if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
                if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.col.join(',')},${p.alpha})`;
                ctx.fill();
            });

            // Draw connection lines between nearby particles
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const a = particles[i], b = particles[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const d  = Math.sqrt(dx * dx + dy * dy);
                    if (d < CONNECTION_DIST) {
                        const alpha = (1 - d / CONNECTION_DIST) * 0.12;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = `rgba(0,255,231,${alpha})`;
                        ctx.lineWidth   = 0.5;
                        ctx.stroke();
                    }
                }
            }
        }
        requestAnimationFrame(draw);
    }
    draw();
})();

/* ══════════════════════════════════════
   2. HEX RAIN COLUMNS
   Spawns 20 absolutely-positioned <span> elements
   that fall via CSS keyframe animation, each
   periodically randomising its glyph content.
══════════════════════════════════════ */
(function () {
    const container = document.getElementById('hex-rain');
    const GLYPHS    = '0123456789ABCDEF⬡⬢◈▸▹◂◃⬟⬠▣◉⬤'.split('');
    const COUNT     = 20;

    for (let i = 0; i < COUNT; i++) {
        const span    = document.createElement('span');
        span.className = 'hex-glyph';

        const leftPct  = Math.random() * 100;
        const duration = 8 + Math.random() * 18;  // 8–26 s fall duration
        const delay    = -Math.random() * duration; // stagger: start mid-fall

        span.style.cssText = `left:${leftPct}%;animation-duration:${duration}s;animation-delay:${delay}s;`;

        // Refresh glyph content every few seconds for a "streaming data" feel
        function refreshGlyph(el) {
            let txt = '';
            const len = 1 + Math.floor(Math.random() * 3);
            for (let k = 0; k < len; k++) txt += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            el.textContent = txt;
            setTimeout(() => refreshGlyph(el), 3000 + Math.random() * 4000);
        }
        refreshGlyph(span);
        container.appendChild(span);
    }
})();

/* ══════════════════════════════════════
   3. CURSOR TRAIL
   8 small dots that trail behind the mouse,
   fading in opacity and shrinking in size.
══════════════════════════════════════ */
(function () {
    const TRAIL_LEN = 8;
    const trail     = [];

    for (let i = 0; i < TRAIL_LEN; i++) {
        const t = document.createElement('div');
        t.style.cssText = [
            'position:fixed',
            'width:4px',
            'height:4px',
            'border-radius:50%',
            'background:var(--c)',
            'pointer-events:none',
            'z-index:9997',
            'transform:translate(-50%,-50%)',
            'transition:opacity 0.1s',
            'mix-blend-mode:screen',
            'opacity:0',
        ].join(';');
        document.body.appendChild(t);
        trail.push({ el: t, x: 0, y: 0 });
    }

    let mx = 0, my = 0;
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

    let frame = 0;
    function updateTrail() {
        // Update positions every other frame to create the lag effect
        if (frame % 2 === 0) {
            for (let i = TRAIL_LEN - 1; i > 0; i--) {
                trail[i].x = trail[i - 1].x;
                trail[i].y = trail[i - 1].y;
            }
            trail[0].x = mx;
            trail[0].y = my;
        }

        trail.forEach((t, i) => {
            t.el.style.left      = t.x + 'px';
            t.el.style.top       = t.y + 'px';
            t.el.style.opacity   = ((1 - i / TRAIL_LEN) * 0.35).toString();
            const scale          = 1 - i / TRAIL_LEN * 0.6;
            t.el.style.transform = `translate(-50%,-50%) scale(${scale})`;
        });

        frame++;
        requestAnimationFrame(updateTrail);
    }
    updateTrail();
})();
