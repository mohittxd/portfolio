/* ==========================================================================
   Futuristic digital matrix transition — cyan / violet data rain
   --------------------------------------------------------------------------
   Full-screen canvas overlay that covers the current section with a dark
   data-rain veil, swaps the section, then reveals the new one with a second
   pass of rain. Vanilla JS, one reused canvas, requestAnimationFrame only.

   Public API
   ----------
     await transitionTo('projects')      -> Promise
     MatrixTransition.coverPhase()       -> Promise
     MatrixTransition.revealPhase()      -> Promise
     MatrixTransition.setTarget(name)    -> retarget a running transition
     MatrixTransition.active             -> boolean

   Hooks supplied by script.js
   ---------------------------
     window.__matrixCurrentSection()      -> current route name
     window.__matrixSwitchSection(name)   -> perform the section switch
   ========================================================================== */
(function () {
    'use strict';

    /* ------------------------------------------------------------------
       Configuration — everything easy to tweak in one place
    ------------------------------------------------------------------ */
    const MATRIX_CONFIG = {
        fontSize: 18,
        mobileFontSize: 15,
        mobileBreakpoint: 600,
        mobileDurationScale: 0.85,

        tailLength: 16,
        tailLengthMin: 12,

        coverDuration: 850,
        revealDuration: 850,

        minSpeed: 0.8,
        maxSpeed: 2.2,

        colors: {
            cyan: '#22d3ee',
            purple: '#a78bfa',
            white: '#ffffff',
            background: '#03040a'
        }
    };

    /* Technical / binary glyph pools — deliberately not a green Matrix set. */
    const GLYPH_SETS = [
        '01',
        '01010101<>',
        '01<>/*|+-=[]{}()#:.=$',
        'ABCDEF0123456789<>',
        '01▒░·:=+*%$',
        'ｱｲｳｴｵｶｷｸｹｺ01'
    ];
    const HEAD_COLORS = ['#ffffff', '#ffffff', '#ffffff', '#22d3ee', '#ddd6fe'];
    const HEAD_GLOWS = ['#22d3ee', '#22d3ee', '#22d3ee', '#a78bfa'];
    const PALETTE_KEYS = ['cyan', 'neutral', 'neutral', 'neutral', 'purple'];
    const PALETTE_STEPS = 24;

    /* Tail ramp: white/cyan -> cyan -> blue-cyan -> purple (alpha fades out
       separately through globalAlpha, so the last stop stays on-hue). */
    const PALETTE_STOPS = {
        cyan: [
            [0, 255, 255, 255],
            [0.10, 207, 250, 254],
            [0.30, 34, 211, 238],
            [0.52, 56, 189, 248],
            [0.74, 99, 102, 241],
            [1, 167, 139, 250]
        ],
        neutral: [
            [0, 255, 255, 255],
            [0.14, 186, 230, 253],
            [0.36, 34, 211, 238],
            [0.60, 79, 170, 237],
            [0.82, 167, 139, 250],
            [1, 139, 124, 246]
        ],
        purple: [
            [0, 255, 255, 255],
            [0.14, 233, 213, 255],
            [0.36, 196, 181, 253],
            [0.62, 167, 139, 250],
            [0.84, 129, 140, 248],
            [1, 129, 140, 248]
        ]
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* ------------------------------------------------------------------
       Canvas (created once, reused forever)
    ------------------------------------------------------------------ */
    const CANVAS_ID = 'matrix-transition';
    let canvas = null;
    let ctx = null;
    let viewW = 0;
    let viewH = 0;
    let dpr = 1;

    let columns = [];
    let fontSize = 18;
    let lineH = 22;
    let fontStr = '';
    let glowEnabled = true;
    let mobile = false;
    let perfMode = false;
    let glowCache = null;

    let rafId = null;
    let isTransitioning = false;
    let pendingTarget = null;
    let activeRun = null;

    const PALETTES = {};

    function pick(arr) {
        return arr[(Math.random() * arr.length) | 0];
    }

    function clamp(v, lo, hi) {
        return v < lo ? lo : v > hi ? hi : v;
    }

    function smoothstep(t) {
        return t * t * (3 - 2 * t);
    }

    function normalizeSection(id) {
        return String(id || '').replace(/^#\/?/, '').split('?')[0].trim();
    }

    function durationFor(ms) {
        return window.innerWidth < MATRIX_CONFIG.mobileBreakpoint
            ? Math.round(ms * MATRIX_CONFIG.mobileDurationScale)
            : ms;
    }

    /* ------------------------------------------------------------------
       Colour palettes (built once, then only indexed per glyph)
    ------------------------------------------------------------------ */
    function buildPalette(key) {
        const stops = PALETTE_STOPS[key];
        const out = new Array(PALETTE_STEPS + 1);
        for (let i = 0; i <= PALETTE_STEPS; i++) {
            const t = i / PALETTE_STEPS;
            let a = stops[0];
            let b = stops[stops.length - 1];
            for (let s = 0; s < stops.length - 1; s++) {
                if (t >= stops[s][0] && t <= stops[s + 1][0]) {
                    a = stops[s];
                    b = stops[s + 1];
                    break;
                }
            }
            const span = b[0] - a[0];
            const f = span > 0 ? (t - a[0]) / span : 0;
            const r = Math.round(a[1] + (b[1] - a[1]) * f);
            const g = Math.round(a[2] + (b[2] - a[2]) * f);
            const bl = Math.round(a[3] + (b[3] - a[3]) * f);
            out[i] = 'rgb(' + r + ',' + g + ',' + bl + ')';
        }
        return out;
    }

    function palette(key) {
        if (!PALETTES[key]) PALETTES[key] = buildPalette(key);
        return PALETTES[key];
    }

    /* ------------------------------------------------------------------
       Setup / teardown
    ------------------------------------------------------------------ */
    function ensureCanvas() {
        if (canvas && ctx) return true;
        canvas = document.getElementById(CANVAS_ID);
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = CANVAS_ID;
            canvas.setAttribute('aria-hidden', 'true');
            (document.body || document.documentElement).appendChild(canvas);
        }
        canvas.setAttribute('aria-hidden', 'true');
        ctx = canvas.getContext && canvas.getContext('2d');
        if (!ctx) { canvas = null; ctx = null; return false; }
        return true;
    }

    function resizeCanvas() {
        if (!canvas || !ctx) return;
        /* clientWidth/clientHeight exclude the scrollbar, which is exactly the
           box a `position: fixed; inset: 0; width/height: 100%` canvas gets —
           keeps the backing store pixel-aligned with the rendered box. */
        viewW = Math.max(1, document.documentElement.clientWidth || window.innerWidth);
        viewH = Math.max(1, document.documentElement.clientHeight || window.innerHeight);
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(viewW * dpr);
        canvas.height = Math.round(viewH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        glowCache = null;
    }

    function endTransition() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (ctx) ctx.clearRect(0, 0, viewW, viewH);
        if (canvas) canvas.style.display = 'none';
        columns = [];
        isTransitioning = false;
        pendingTarget = null;
        activeRun = null;
    }

    /* ------------------------------------------------------------------
       Columns — every one is deliberately a little different
    ------------------------------------------------------------------ */
    function refreshGlyphs(col) {
        const n = col.tail + 1;
        if (col.glyphs.length !== n) col.glyphs = new Array(n);
        const set = col.set;
        for (let i = 0; i < n; i++) {
            col.glyphs[i] = set.charAt((Math.random() * set.length) | 0);
        }
    }

    function flicker(col) {
        const set = col.set;
        const n = col.tail + 1;
        for (let k = 0; k < 3; k++) {
            const i = (Math.random() * n) | 0;
            col.glyphs[i] = set.charAt((Math.random() * set.length) | 0);
        }
    }

    function buildColumns(phase) {
        mobile = viewW < MATRIX_CONFIG.mobileBreakpoint;
        fontSize = mobile ? MATRIX_CONFIG.mobileFontSize : MATRIX_CONFIG.fontSize;
        lineH = Math.round(fontSize * 1.2);
        glowEnabled = !mobile && !perfMode;
        fontStr = fontSize + 'px "JetBrains Mono", "SFMono-Regular", Consolas, monospace';

        const spacingX = Math.max(fontSize + 2, Math.round(fontSize * (mobile ? 1.3 : 1.05)));
        const count = Math.max(4, Math.floor(viewW / spacingX));
        const duration = durationFor(
            phase === 'cover' ? MATRIX_CONFIG.coverDuration : MATRIX_CONFIG.revealDuration
        );

        const tailMin = MATRIX_CONFIG.tailLengthMin;
        const tailMax = MATRIX_CONFIG.tailLength;
        const now = performance.now();

        columns = new Array(count);
        for (let i = 0; i < count; i++) {
            const tail = tailMin + ((Math.random() * (tailMax - tailMin + 1)) | 0);
            const startY = -(0.05 + Math.random() * 0.55) * viewH - tail * lineH;
            const distance = viewH + tail * lineH - startY;
            const speed = clamp(
                (distance / duration) * (0.85 + Math.random() * 0.35),
                MATRIX_CONFIG.minSpeed,
                MATRIX_CONFIG.maxSpeed
            );
            const col = {
                x: spacingX * (i + 0.5) + (Math.random() - 0.5) * spacingX * 0.4,
                y: startY,
                speed: speed,
                tail: tail,
                lineH: lineH * (0.92 + Math.random() * 0.16),
                alpha: 0.5 + Math.random() * 0.5,
                glyphs: [],
                set: pick(GLYPH_SETS),
                palette: palette(pick(PALETTE_KEYS)),
                headColor: pick(HEAD_COLORS),
                headGlow: pick(HEAD_GLOWS),
                flipEvery: 70 + Math.random() * 90,
                flipAt: now + Math.random() * 220
            };
            refreshGlyphs(col);
            columns[i] = col;
        }
    }

    function updateColumns(now, dt) {
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            col.y += col.speed * dt;
            if (now >= col.flipAt) {
                flicker(col);
                col.flipAt = now + col.flipEvery;
            }
        }
    }

    /* ------------------------------------------------------------------
       Painting
    ------------------------------------------------------------------ */
    function glowGradients() {
        const w = viewW;
        const h = viewH;
        if (glowCache && glowCache.w === w && glowCache.h === h) return glowCache;

        const r = Math.max(w, h) * 0.6;
        const cyan = ctx.createRadialGradient(w * 0.24, h * 0.16, 0, w * 0.24, h * 0.16, r);
        cyan.addColorStop(0, 'rgba(34, 211, 238, 0.12)');
        cyan.addColorStop(1, 'rgba(34, 211, 238, 0)');

        const violet = ctx.createRadialGradient(w * 0.78, h * 0.86, 0, w * 0.78, h * 0.86, r);
        violet.addColorStop(0, 'rgba(167, 139, 250, 0.11)');
        violet.addColorStop(1, 'rgba(167, 139, 250, 0)');

        glowCache = { w: w, h: h, cyan: cyan, violet: violet };
        return glowCache;
    }

    function drawDarkGlow(strength) {
        const g = glowGradients();
        ctx.globalAlpha = strength;
        ctx.fillStyle = g.cyan;
        ctx.fillRect(0, 0, viewW, viewH);
        ctx.fillStyle = g.violet;
        ctx.fillRect(0, 0, viewW, viewH);
        ctx.globalAlpha = 1;
    }

    function drawRain(fade) {
        if (fade <= 0.01 || !columns.length) return;

        const w = viewW;
        const h = viewH;
        const lh = lineH;
        const steps = PALETTE_STEPS;

        ctx.font = fontStr;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        /* Pass 1 — fading tails (no glow: cheap) */
        for (let c = 0; c < columns.length; c++) {
            const col = columns[c];
            const pal = col.palette;
            const tail = col.tail;
            const base = col.alpha * fade;
            const lastChar = perfMode ? Math.ceil(tail * 0.6) : tail;

            for (let i = 1; i <= lastChar; i++) {
                const y = col.y - i * col.lineH;
                if (y < -lh || y > h + lh) continue;
                const t = i / tail;
                const a = base * Math.pow(1 - t, 1.25);
                if (a < 0.045) continue;
                ctx.globalAlpha = a > 1 ? 1 : a;
                ctx.fillStyle = pal[Math.min(steps, (t * steps) | 0)];
                ctx.fillText(col.glyphs[i], col.x, y);
            }
        }

        /* Pass 2 — bright heads with a subtle glow */
        if (glowEnabled) {
            ctx.shadowBlur = 12;
        }
        for (let c = 0; c < columns.length; c++) {
            const col = columns[c];
            const y = col.y;
            if (y < -lh || y > h + lh) continue;
            ctx.shadowColor = col.headGlow;
            ctx.globalAlpha = Math.min(1, col.alpha * fade * 1.15);
            ctx.fillStyle = col.headColor;
            ctx.fillText(col.glyphs[0], col.x, y);
        }

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = 1;
    }

    function drawCover(p) {
        const w = viewW;
        const h = viewH;
        ctx.clearRect(0, 0, w, h);

        const dark = Math.min(1, smoothstep(p) * 1.1);
        ctx.fillStyle = 'rgba(3, 4, 10, ' + dark.toFixed(4) + ')';
        ctx.fillRect(0, 0, w, h);

        if (dark > 0.03) drawDarkGlow(dark);
        drawRain(1);
    }

    function drawReveal(p) {
        const w = viewW;
        const h = viewH;
        ctx.clearRect(0, 0, w, h);

        const edge = smoothstep(p) * h;

        if (edge < h) {
            ctx.fillStyle = MATRIX_CONFIG.colors.background;
            ctx.fillRect(0, edge, w, h - edge);
        }

        /* Soft shoulder so the cover does not cut off with a hard line */
        if (edge > 2) {
            const band = Math.min(120, edge);
            const g = ctx.createLinearGradient(0, edge - band, 0, edge);
            g.addColorStop(0, 'rgba(3, 4, 10, 0)');
            g.addColorStop(1, 'rgba(3, 4, 10, 1)');
            ctx.fillStyle = g;
            ctx.fillRect(0, edge - band, w, band);
            drawDarkGlow(0.55);
        }

        /* Cyan / violet scan glow riding the reveal edge */
        if (edge > 1 && edge < h - 1) {
            const span = 90;
            const top = Math.max(0, edge - span);
            const bot = Math.min(h, edge + span * 0.6);
            const g = ctx.createLinearGradient(0, top, 0, bot);
            const mid = clamp((edge - top) / Math.max(1, bot - top), 0.05, 0.95);
            g.addColorStop(0, 'rgba(34, 211, 238, 0)');
            g.addColorStop(Math.max(0, mid - 0.18), 'rgba(34, 211, 238, 0.10)');
            g.addColorStop(mid, 'rgba(255, 255, 255, 0.14)');
            g.addColorStop(Math.min(1, mid + 0.16), 'rgba(167, 139, 250, 0.10)');
            g.addColorStop(1, 'rgba(167, 139, 250, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, top, w, bot - top);
        }

        const fade = p > 0.82 ? Math.max(0, 1 - (p - 0.82) / 0.18) : 1;
        drawRain(fade);
    }

    /* ------------------------------------------------------------------
       Phase runner — one rAF loop, cancelled as soon as it resolves
    ------------------------------------------------------------------ */
    function runPhase(kind, duration) {
        return new Promise(function (resolve) {
            const start = performance.now();
            let last = start;
            let samples = 0;
            let sampled = 0;

            function frame(now) {
                const raw = now - last;
                const dt = Math.min(64, raw);
                last = now;
                const p = Math.min(1, (now - start) / duration);

                /* Drop the tail glow + trim tails if the device cannot keep up.
                   Samples start after a couple of frames so a one-off hitch
                   right at the start cannot trigger it by itself. */
                if (!perfMode) {
                    samples++;
                    if (samples > 2 && samples <= 12) {
                        sampled += raw;
                        if (samples === 12 && sampled / 10 > 45) {
                            perfMode = true;
                            glowEnabled = false;
                        }
                    }
                }

                updateColumns(now, dt);
                if (kind === 'cover') drawCover(p);
                else drawReveal(p);

                if (p < 1) {
                    rafId = requestAnimationFrame(frame);
                } else {
                    rafId = null;
                    resolve();
                }
            }

            rafId = requestAnimationFrame(frame);
        });
    }

    function coverPhase() {
        if (!ensureCanvas()) return Promise.resolve();
        if (!columns.length) {
            resizeCanvas();
            buildColumns('cover');
            canvas.style.display = 'block';
        }
        return runPhase('cover', durationFor(MATRIX_CONFIG.coverDuration));
    }

    function revealPhase() {
        if (!ensureCanvas()) return Promise.resolve();
        if (!columns.length) {
            resizeCanvas();
            buildColumns('reveal');
            canvas.style.display = 'block';
        }
        return runPhase('reveal', durationFor(MATRIX_CONFIG.revealDuration));
    }

    /* ------------------------------------------------------------------
       Section switch (delegated to the site router)
    ------------------------------------------------------------------ */
    function currentSection() {
        if (typeof window.__matrixCurrentSection === 'function') {
            return window.__matrixCurrentSection();
        }
        return normalizeSection(location.hash);
    }

    function switchSection(name) {
        if (typeof window.__matrixSwitchSection === 'function') {
            window.__matrixSwitchSection(name);
            return;
        }
        /* Fallback: minimal page swap if the router hook is unavailable */
        document.querySelectorAll('.page').forEach(function (p) {
            p.classList.toggle('active', p.id === 'page-' + name);
        });
        document.documentElement.setAttribute('data-page', name);
        window.scrollTo(0, 0);
    }

    /* ------------------------------------------------------------------
       Public API
    ------------------------------------------------------------------ */
    function setTarget(sectionId) {
        const target = normalizeSection(sectionId);
        if (!target || !isTransitioning) return;
        pendingTarget = target;
    }

    function transitionTo(sectionId) {
        const target = normalizeSection(sectionId);
        if (!target) return Promise.resolve();

        /* Already running: never start a second one, just retarget it. */
        if (isTransitioning) {
            if (target !== pendingTarget) pendingTarget = target;
            return activeRun || Promise.resolve();
        }

        /* Same section → nothing to do. */
        if (target === normalizeSection(currentSection())) return Promise.resolve();

        /* Reduced motion → instant switch, no animation, keyboard nav intact. */
        if (reduceMotion.matches || !ensureCanvas()) {
            switchSection(target);
            return Promise.resolve();
        }

        isTransitioning = true;
        pendingTarget = target;

        activeRun = (async function () {
            let destination = target;
            try {
                /* cover → switch → reveal. If a new destination arrives while
                   the reveal is still running, the cycle simply repeats, so a
                   navigation can never be dropped mid-transition. */
                for (;;) {
                    resizeCanvas();
                    buildColumns('cover');
                    canvas.style.display = 'block';
                    await coverPhase();

                    if (pendingTarget) destination = pendingTarget;
                    pendingTarget = null;
                    switchSection(destination);

                    buildColumns('reveal');
                    await revealPhase();

                    if (!pendingTarget || pendingTarget === normalizeSection(currentSection())) break;
                    destination = pendingTarget;
                }
            } catch (err) {
                if (window.console) console.error('[matrix-transition]', err);
            } finally {
                endTransition();
            }
        })();

        return activeRun;
    }

    window.MATRIX_CONFIG = MATRIX_CONFIG;
    window.MatrixTransition = {
        config: MATRIX_CONFIG,
        transitionTo: transitionTo,
        coverPhase: coverPhase,
        revealPhase: revealPhase,
        setTarget: setTarget,
        get active() { return isTransitioning; }
    };
    window.transitionTo = transitionTo;
})();
