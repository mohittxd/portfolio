/* ==========================================================================
   Mohit Verma — Portfolio
   Hash router + interactive FX (vanilla JS)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const doc = document.documentElement;
    const body = document.body;
    const header = document.querySelector('header');
    const navLinks = document.querySelectorAll('.nav-link');
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.getElementById('nav-menu');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const isDesktop = () => finePointer.matches && !reduceMotion.matches;

    /* ------------------------------------------------------------------
       Router
    ------------------------------------------------------------------ */
    const PAGES = ['home', 'about', 'skills', 'experience', 'projects', 'education', 'services', 'contact'];
    const TITLES = {
        home: 'Mohit Verma | Full-Stack Developer',
        about: 'About | Mohit Verma',
        skills: 'Skills | Mohit Verma',
        experience: 'Experience | Mohit Verma',
        projects: 'Projects | Mohit Verma',
        education: 'Education | Mohit Verma',
        services: 'Services | Mohit Verma',
        contact: 'Contact | Mohit Verma'
    };

    const pageEl = (name) => document.getElementById('page-' + name);
    let current = null;

    function parseRoute() {
        const h = location.hash.replace(/^#\/?/, '').split('?')[0];
        return PAGES.includes(h) ? h : 'home';
    }

    function setActiveNav(name) {
        navLinks.forEach(link => {
            const on = link.dataset.route === name;
            link.classList.toggle('active', on);
            if (on) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }

    function showPageInstant(name) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const el = pageEl(name);
        if (el) el.classList.add('active');
        doc.setAttribute('data-page', name);
        document.title = TITLES[name] || TITLES.home;
        setActiveNav(name);
        window.scrollTo(0, 0);
        current = name;
        if (name === 'services' && typeof window.__measureServicesCarousel === 'function') {
            window.__measureServicesCarousel();
        }
    }

    function navigate(name) {
        // Futuristic matrix data-rain transition (matrix-transition.js).
        // A running transition is never restarted — it is only retargeted,
        // so the hash and the visible section can never drift apart.
        const matrix = window.MatrixTransition;
        if (matrix && matrix.active) {
            matrix.setTarget(name);
            return;
        }
        if (name === current) return;
        if (matrix && !reduceMotion.matches) {
            matrix.transitionTo(name);
            return;
        }
        showPageInstant(name);
    }

    // Hooks consumed by the matrix transition module.
    window.__matrixCurrentSection = () => current;
    window.__matrixSwitchSection = (name) => {
        if (name) showPageInstant(name);
    };

    function handleHashChange() {
        if (navMenu && navMenu.classList.contains('active')) toggleMobileMenu();
        if (window.__closeProjectOverlay) window.__closeProjectOverlay();
        navigate(parseRoute());
    }

    /* ------------------------------------------------------------------
       Loading screen
    ------------------------------------------------------------------ */
    function runLoader() {
        const done = () => {
            body.classList.remove('preboot');
            body.classList.add('booted');
        };
        if (reduceMotion.matches) {
            done();
            return;
        }
        setTimeout(done, 950); // loader fill runs ~900ms in CSS
    }

    /* ------------------------------------------------------------------
       Reveal-on-scroll (IntersectionObserver, staggered)
    ------------------------------------------------------------------ */
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    function setupReveals() {
        document.querySelectorAll('.reveal').forEach(el => {
            if (reduceMotion.matches) { el.classList.add('visible'); return; }
            const parent = el.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(c => c.classList.contains('reveal'));
                const idx = siblings.indexOf(el);
                if (idx > 0) el.style.setProperty('--reveal-delay', `${Math.min(idx * 0.07, 0.42)}s`);
            }
            revealObserver.observe(el);
        });
    }

    /* ------------------------------------------------------------------
       Experience & Education timeline — glowing progress line + node ignition
    ------------------------------------------------------------------ */
    function setupTimelineProgress() {
        const wrappers = [
            document.getElementById('exp-timeline'),
            document.querySelector('.edu-timeline')
        ].filter(Boolean);
        if (!wrappers.length) return;

        // One shared scroll/resize listener for every timeline instead of one pair each.
        const tracks = [];
        wrappers.forEach(wrap => {
            let bar = wrap.querySelector('.exp-progress, .tl-progress');
            if (!bar) {
                bar = document.createElement('span');
                bar.className = 'tl-progress';
                bar.setAttribute('aria-hidden', 'true');
                wrap.appendChild(bar);
            }
            if (reduceMotion.matches) { bar.style.height = '100%'; return; }
            // `.page` never changes for a given wrapper — resolve it once, not per scroll.
            tracks.push({ wrap, bar, page: wrap.closest('.page'), ticking: false });
        });
        if (!tracks.length) return;

        const update = (t) => {
            t.ticking = false;
            if (t.page && !t.page.classList.contains('active')) return;
            const rect = t.wrap.getBoundingClientRect();
            if (!rect.height) return;
            const focus = window.innerHeight * 0.55;
            const progress = Math.min(1, Math.max(0, (focus - rect.top) / rect.height));
            t.bar.style.height = (progress * 100).toFixed(1) + '%';
        };
        window.addEventListener('scroll', () => {
            tracks.forEach(t => {
                if (!t.ticking) { t.ticking = true; requestAnimationFrame(() => update(t)); }
            });
        }, { passive: true });
        window.addEventListener('resize', () => tracks.forEach(update), { passive: true });
        tracks.forEach(update);
    }

    function setupNodeIgnition() {
        const items = document.querySelectorAll('.exp-item');
        if (!items.length) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add('lit'); io.unobserve(e.target); }
            });
        }, { threshold: 0.3 });
        items.forEach(i => io.observe(i));
    }

    /* ------------------------------------------------------------------
       Custom cursor + trail + click burst (fine pointers only)
       Dot follows the pointer immediately, ring lerps behind it and the
       loop sleeps as soon as every layer has settled.
    ------------------------------------------------------------------ */
    const RING_LERP = 0.16;   // ring easing factor
    const SPOT_LERP = 0.08;   // background spotlight easing (existing behaviour)
    const TRAIL_LERP = 0.32;  // trail easing (existing behaviour)
    const PARTICLES = 10;     // particles per click burst

    function setupCursor() {
        if (!finePointer.matches) return;

        const ring = document.getElementById('cursor-ring');
        const dot = document.getElementById('cursor-dot');
        const label = document.getElementById('cursor-label');
        const fx = document.getElementById('cursor-fx');
        const spot = document.querySelector('.fx-spotlight');
        if (!ring || !dot) return;

        const motionOK = () => !reduceMotion.matches;

        let mx = -100, my = -100;       // real mouse
        let rx = -100, ry = -100;       // ring (lagged)
        let sx = -100, sy = -100;       // spotlight (more lag)
        let seen = false;
        let rafId = 0;

        // Build trail — decorative, skipped when motion is reduced
        const trail = [];
        function buildTrail() {
            trail.forEach(t => t.el.remove());
            trail.length = 0;
            for (let i = 0; i < 6; i++) {
                const t = document.createElement('span');
                t.className = 'cursor-trail';
                t.style.opacity = String(0.28 - i * 0.04);
                body.appendChild(t);
                trail.push({ el: t, x: seen ? mx : -100, y: seen ? my : -100 });
            }
        }
        if (motionOK()) buildTrail();

        function wake() {
            if (!rafId) rafId = requestAnimationFrame(loop);
        }

        function sleep() {
            if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        }

        // Master RAF loop: ring + spotlight + trail. Writes only, never reads layout.
        function loop() {
            rafId = 0;
            // Reduced motion → the ring tracks the pointer with no lag
            const k = motionOK() ? RING_LERP : 1;
            rx += (mx - rx) * k;
            ry += (my - ry) * k;
            sx += (mx - sx) * SPOT_LERP;
            sy += (my - sy) * SPOT_LERP;

            ring.style.transform = `translate3d(${rx.toFixed(2)}px, ${ry.toFixed(2)}px, 0) translate(-50%, -50%)`;

            // The spotlight layer is class-gated (it is only visible with body.has-spotlight).
            // Write its coordinates on the layer itself, never on :root — root-level custom
            // properties re-style the whole document on every frame.
            if (spot && body.classList.contains('has-spotlight')) {
                spot.style.setProperty('--spot-x', sx.toFixed(1) + 'px');
                spot.style.setProperty('--spot-y', sy.toFixed(1) + 'px');
            }

            let moving = Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1
                || Math.abs(mx - sx) > 0.1 || Math.abs(my - sy) > 0.1;

            let px = mx, py = my;
            trail.forEach(t => {
                const nx = t.x + (px - t.x) * TRAIL_LERP;
                const ny = t.y + (py - t.y) * TRAIL_LERP;
                if (Math.abs(nx - t.x) > 0.05 || Math.abs(ny - t.y) > 0.05) moving = true;
                t.x = nx;
                t.y = ny;
                t.el.style.transform = `translate3d(${nx.toFixed(2)}px, ${ny.toFixed(2)}px, 0) translate(-50%, -50%)`;
                px = nx;
                py = ny;
            });

            // Nothing left to chase — sleep until the next pointermove
            if (moving) wake();
        }

        window.addEventListener('pointermove', (e) => {
            if (e.pointerType && e.pointerType !== 'mouse') return;
            mx = e.clientX;
            my = e.clientY;
            // Dot is immediate — written here, outside the interpolation loop
            dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
            if (!seen) {
                seen = true;
                rx = mx; ry = my; sx = mx; sy = my;
                trail.forEach(t => { t.x = mx; t.y = my; });
                body.classList.add('cursor-on');
            }
            wake();
        }, { passive: true });

        /* ---- Click burst: 10 short-lived particles, removed after 600ms ---- */
        const timers = new Set();
        const later = (fn, ms) => {
            const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
            timers.add(id);
        };

        function clearFx() {
            timers.forEach(id => clearTimeout(id));
            timers.clear();
            if (fx) fx.replaceChildren();
        }

        function burst(x, y) {
            if (!motionOK() || !seen || !fx) return;
            const frag = document.createDocumentFragment();
            for (let i = 0; i < PARTICLES; i++) {
                const p = document.createElement('i');
                p.className = 'cursor-particle' + (i % 2 ? ' p-purple' : '');
                const angle = (Math.PI * 2 * i) / PARTICLES + (Math.random() - 0.5) * 0.6;
                const dist = 40 + Math.random() * 30;
                p.style.setProperty('--bx', x.toFixed(1) + 'px');
                p.style.setProperty('--by', y.toFixed(1) + 'px');
                p.style.setProperty('--tx', (x + Math.cos(angle) * dist).toFixed(1) + 'px');
                p.style.setProperty('--ty', (y + Math.sin(angle) * dist).toFixed(1) + 'px');
                frag.appendChild(p);
                later(() => p.remove(), 620);
            }
            fx.appendChild(frag);
        }

        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType && e.pointerType !== 'mouse') return;
            if (e.button) return;                 // primary button only
            burst(e.clientX, e.clientY);
        }, { passive: true });

        /* ---- Cursor states via delegation ---- */
        const setState = (state, text) => {
            ring.dataset.state = state;
            label.textContent = text || '';
        };

        document.addEventListener('pointerover', (e) => {
            const t = e.target;
            if (!(t instanceof Element)) return;

            // Never promise an action on a disabled control
            if (t.closest('[disabled], [aria-disabled="true"]')) { setState(''); return; }

            const navHit = t.closest('.nav-link, .cta-btn, .hamburger');
            const ghHit = t.closest('a[href*="github.com"]');
            const imgHit = t.closest('[data-cursor="img"], .po-visual');
            const viewHit = t.closest('.project-card, .project-featured, .timeline-card, .exp-card, .info-card, .highlight-card, .service-card, .skill-category, .building-card, [data-cursor="view"]');
            const skillHit = t.closest('.skill-badge, .tech-chip');
            const btnHit = t.closest('button, .btn, [data-magnetic]');
            const openHit = t.closest('a');
            const kbHit = t.closest('summary, [role="button"], [tabindex]:not([tabindex="-1"])');

            if (navHit) setState('nav');
            else if (ghHit) setState('github', 'GITHUB');
            else if (imgHit) setState('explore', 'EXPLORE');
            else if (viewHit) setState('view', 'VIEW');
            else if (skillHit) setState('skill', 'SKILL');
            else if (btnHit) setState('btn');
            else if (openHit) setState('open', 'OPEN');
            else if (kbHit) setState('interactive');
            else setState('');
        });

        // Pointer leaving the viewport (or the tab) → hide cursor, drop particles
        const hide = () => {
            body.classList.remove('cursor-on');
            sleep();
            clearFx();
        };
        document.addEventListener('mouseleave', hide);
        document.addEventListener('mouseenter', () => { if (seen) { body.classList.add('cursor-on'); wake(); } });
        window.addEventListener('blur', hide);
        document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });

        // Reduced motion toggled mid-session: drop the lag, the trail and the burst
        const onMotionChange = () => {
            body.classList.toggle('reduce-fx', reduceMotion.matches);
            if (reduceMotion.matches) {
                clearFx();
                trail.forEach(t => t.el.remove());
                trail.length = 0;
                rx = mx; ry = my;
            } else if (!trail.length) {
                buildTrail();
            }
            wake();
        };
        if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionChange);
        body.classList.toggle('reduce-fx', reduceMotion.matches);
    }

    /* ------------------------------------------------------------------
       Cached geometry for pointer-driven effects
       Rects are read once per hover and dropped again on scroll/resize, so
       high-frequency pointermove handlers never force a layout read.
    ------------------------------------------------------------------ */
    const rectCache = [];
    function cachedRect(el) {
        const slot = { el, rect: null };
        rectCache.push(slot);
        return () => (slot.rect || (slot.rect = el.getBoundingClientRect()));
    }
    function dropRects() { rectCache.forEach(s => { s.rect = null; }); }
    window.addEventListener('scroll', dropRects, { passive: true });
    window.addEventListener('resize', dropRects, { passive: true });

    /* ------------------------------------------------------------------
       Magnetic buttons (desktop only)
    ------------------------------------------------------------------ */
    function setupMagnetics() {
        if (!isDesktop()) return;
        document.querySelectorAll('[data-magnetic], [data-magnetic-soft]').forEach(el => {
            const strength = el.hasAttribute('data-magnetic-soft') ? 0.1 : 0.22;
            const max = el.hasAttribute('data-magnetic-soft') ? 5 : 8;
            const rectOf = cachedRect(el);
            el.addEventListener('pointerenter', () => { rectOf(); });
            el.addEventListener('pointermove', (e) => {
                const r = rectOf();
                const dx = e.clientX - (r.left + r.width / 2);
                const dy = e.clientY - (r.top + r.height / 2);
                const x = Math.max(-max, Math.min(max, dx * strength));
                const y = Math.max(-max, Math.min(max, dy * strength));
                el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
            });
            el.addEventListener('pointerleave', () => { el.style.transform = ''; });
        });
    }

    /* ------------------------------------------------------------------
       3D tilt + cursor-following light on cards (desktop only)
    ------------------------------------------------------------------ */
    function setupTiltCards() {
        if (!isDesktop()) return;

        document.querySelectorAll('[data-tilt]').forEach(card => {
            const rectOf = cachedRect(card);
            card.addEventListener('pointerenter', () => { rectOf(); });
            card.addEventListener('pointermove', (e) => {
                const r = rectOf();
                const dx = (e.clientX - r.left) / r.width - 0.5;
                const dy = (e.clientY - r.top) / r.height - 0.5;
                card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                card.style.setProperty('--my', (e.clientY - r.top) + 'px');
                card.style.transform =
                    `perspective(900px) rotateX(${(-dy * 10).toFixed(2)}deg) rotateY(${(dx * 10).toFixed(2)}deg)`;
            });
            card.addEventListener('pointerleave', () => { card.style.transform = ''; });
        });

        // Softer glow + micro-tilt for the remaining cards
        // (project cards are handled by setupProjectCardFX — no duplicate listeners)
        const softCards = document.querySelectorAll('.info-card, .highlight-card, .timeline-card');
        softCards.forEach(card => {
            card.classList.add('glow-card');
            const rectOf = cachedRect(card);
            card.addEventListener('pointerenter', () => { rectOf(); });
            card.addEventListener('pointermove', (e) => {
                const r = rectOf();
                card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                card.style.setProperty('--my', (e.clientY - r.top) + 'px');
                const dx = (e.clientX - r.left) / r.width - 0.5;
                const dy = (e.clientY - r.top) / r.height - 0.5;
                card.style.setProperty('--tilt-x', `${(-dy * 4).toFixed(2)}deg`);
                card.style.setProperty('--tilt-y', `${(dx * 4).toFixed(2)}deg`);
            });
            card.addEventListener('pointerleave', () => {
                card.style.setProperty('--tilt-x', '0deg');
                card.style.setProperty('--tilt-y', '0deg');
            });
        });
    }

    /* ------------------------------------------------------------------
       Projects page cards — cursor border glow + inner shine + 3D tilt
       Geometry is measured on pointerenter (and on scroll while hovering)
       and cached, so no layout read happens inside the frame loop.
       All transforms keep flowing through the existing --tilt-x / --tilt-y
       vars, so the current hover lift and reveal animation stay intact.
    ------------------------------------------------------------------ */
    function setupProjectCardFX() {
        if (!finePointer.matches) return;

        const section = document.getElementById('page-projects');
        if (!section) return;

        const cards = Array.from(section.querySelectorAll('.project-card, .project-featured, .project-wide'));
        if (!cards.length) return;

        const MAX_TILT = 10;            // degrees per axis
        const CLEAR = ['--tilt-x', '--tilt-y', '--cx', '--cy'];
        const motionOK = () => !reduceMotion.matches;

        let active = null;             // { card, rect, x, y, raf }
        let geomRaf = 0;

        /* Untransformed card box. getBoundingClientRect() includes the tilt
           transform, so measuring a live card would skew the pointer mapping by
           up to ~5% of its width. Pinning the tilt vars is not enough on its own
           — the 0.35s transform transition would still report the interpolated
           rotated box — hence the transition-killing .fx-measuring class, which
           is added and removed within a single task. */
        function measure(card) {
            const tiltX = card.style.getPropertyValue('--tilt-x');
            const tiltY = card.style.getPropertyValue('--tilt-y');
            const live = tiltX !== '' || tiltY !== '';
            if (!live) return card.getBoundingClientRect();

            card.classList.add('fx-measuring');
            card.style.setProperty('--tilt-x', '0deg');
            card.style.setProperty('--tilt-y', '0deg');
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--tilt-x', tiltX);
            card.style.setProperty('--tilt-y', tiltY);
            card.classList.remove('fx-measuring');
            return rect;
        }

        function write() {
            const a = active;
            if (!a) return;
            a.raf = 0;
            const { card, rect } = a;
            if (!rect.width || !rect.height) return;   // card hidden (page swap / filter)

            const px = a.x - rect.left;
            const py = a.y - rect.top;
            card.style.setProperty('--cx', px.toFixed(1) + 'px');
            card.style.setProperty('--cy', py.toFixed(1) + 'px');

            if (!motionOK()) return;                   // reduced motion: glow only

            const nx = Math.max(-1, Math.min(1, (px / rect.width - 0.5) * 2));
            const ny = Math.max(-1, Math.min(1, (py / rect.height - 0.5) * 2));
            card.style.setProperty('--tilt-x', (-ny * MAX_TILT).toFixed(2) + 'deg');
            card.style.setProperty('--tilt-y', (nx * MAX_TILT).toFixed(2) + 'deg');
        }

        function schedule() {
            const a = active;
            if (a && !a.raf) a.raf = requestAnimationFrame(write);
        }

        function reset(card) {
            card.classList.remove('is-fx-active');
            CLEAR.forEach(p => card.style.removeProperty(p));
        }

        cards.forEach(card => {
            card.classList.add('glow-card', 'project-card-fx');

            // Border-glow ring (masked to a 1px border) — one inert node per card
            if (!card.querySelector(':scope > .project-fx')) {
                const ring = document.createElement('span');
                ring.className = 'project-fx';
                ring.setAttribute('aria-hidden', 'true');
                card.appendChild(ring);
            }

            card.addEventListener('pointerenter', (e) => {
                if (e.pointerType && e.pointerType !== 'mouse') return;
                if (active && active.card !== card && active.raf) cancelAnimationFrame(active.raf);
                active = { card, x: e.clientX, y: e.clientY, rect: measure(card), raf: 0 };
                card.classList.add('is-fx-active');
                write();
            });

            card.addEventListener('pointermove', (e) => {
                if (e.pointerType && e.pointerType !== 'mouse') return;
                if (!active || active.card !== card) {
                    active = { card, x: e.clientX, y: e.clientY, rect: measure(card), raf: 0 };
                    card.classList.add('is-fx-active');
                    write();
                    return;
                }
                active.x = e.clientX;
                active.y = e.clientY;
                schedule();
            });

            card.addEventListener('pointerleave', () => {
                if (active && active.card === card) {
                    if (active.raf) cancelAnimationFrame(active.raf);
                    active = null;
                }
                reset(card);
            });
        });

        // Cached geometry only goes stale while the page scrolls under the pointer
        const refreshGeom = () => {
            geomRaf = 0;
            if (!active) return;
            active.rect = measure(active.card);
            write();
        };
        window.addEventListener('scroll', () => {
            if (!geomRaf) geomRaf = requestAnimationFrame(refreshGeom);
        }, { passive: true });
        window.addEventListener('resize', () => {
            if (geomRaf) cancelAnimationFrame(geomRaf);
            geomRaf = requestAnimationFrame(refreshGeom);
        }, { passive: true });

        // Reduced motion switched on mid-session → drop any live tilt
        const onMotionChange = () => {
            body.classList.toggle('reduce-fx', reduceMotion.matches);
            if (reduceMotion.matches) cards.forEach(reset);
        };
        if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionChange);
        body.classList.toggle('reduce-fx', reduceMotion.matches);
    }

    /* ------------------------------------------------------------------
       Services carousel — 3 cards desktop / 2 tablet / 1 mobile
    ------------------------------------------------------------------ */
    function setupServicesCarousel() {
        const root = document.querySelector('[data-services-carousel]');
        if (!root) return;

        const track = root.querySelector('[data-services-track]');
        const prevBtn = root.querySelector('[data-services-prev]');
        const nextBtn = root.querySelector('[data-services-next]');
        const dotsWrap = root.querySelector('[data-services-dots]');
        const live = root.querySelector('[data-services-live]');
        const cards = track ? Array.from(track.querySelectorAll('.service-card')) : [];
        if (!track || !cards.length) return;

        let index = 0;
        let perView = 3;
        let maxIndex = 0;
        let slideWidth = 0;

        const servicesSection = root.closest('.services');

        function readPerView() {
            const raw = getComputedStyle(servicesSection || root)
                .getPropertyValue('--svc-per-view')
                .trim();
            const n = parseInt(raw, 10);
            return Number.isFinite(n) && n > 0 ? n : 3;
        }

        function measure() {
            perView = readPerView();
            maxIndex = Math.max(0, cards.length - perView);
            const gap = parseFloat(getComputedStyle(track).gap) || 20;
            const cardWidth = cards[0].getBoundingClientRect().width;
            slideWidth = cardWidth + gap;
            if (index > maxIndex) index = maxIndex;
            buildDots();
            apply(false);
        }

        function buildDots() {
            if (!dotsWrap) return;
            dotsWrap.innerHTML = '';
            const pages = maxIndex + 1;
            for (let i = 0; i < pages; i++) {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'carousel-dot' + (i === index ? ' is-active' : '');
                dot.setAttribute('role', 'tab');
                dot.setAttribute('aria-label', 'Show services group ' + (i + 1));
                dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
                dot.addEventListener('click', () => goTo(i, true));
                dotsWrap.appendChild(dot);
            }
        }

        function updateDots() {
            if (!dotsWrap) return;
            const dots = dotsWrap.querySelectorAll('.carousel-dot');
            dots.forEach((dot, i) => {
                const on = i === index;
                dot.classList.toggle('is-active', on);
                dot.setAttribute('aria-selected', on ? 'true' : 'false');
            });
        }

        function updateButtons() {
            if (prevBtn) prevBtn.disabled = index <= 0;
            if (nextBtn) nextBtn.disabled = index >= maxIndex;
        }

        function announce() {
            if (!live) return;
            const start = index * perView + 1;
            const end = Math.min(cards.length, (index + 1) * perView);
            live.textContent = 'Showing services ' + start + ' to ' + end + ' of ' + cards.length;
        }

        function apply(animate) {
            if (!animate) track.style.transition = 'none';
            track.style.transform = 'translateX(' + (-index * slideWidth) + 'px)';
            if (!animate) {
                // force reflow then restore transition
                void track.offsetWidth;
                track.style.transition = '';
            }
            updateDots();
            updateButtons();
            announce();
        }

        function goTo(next, animate) {
            index = Math.max(0, Math.min(maxIndex, next));
            apply(animate !== false);
        }

        if (prevBtn) prevBtn.addEventListener('click', () => goTo(index - 1, true));
        if (nextBtn) nextBtn.addEventListener('click', () => goTo(index + 1, true));

        root.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goTo(index - 1, true);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                goTo(index + 1, true);
            }
        });

        // Pointer drag / swipe
        let dragging = false;
        let startX = 0;
        let deltaX = 0;

        track.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            dragging = true;
            startX = e.clientX;
            deltaX = 0;
            track.setPointerCapture(e.pointerId);
        }, { passive: true });

        track.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            deltaX = e.clientX - startX;
        }, { passive: true });

        const endDrag = (e) => {
            if (!dragging) return;
            dragging = false;
            try { track.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
            if (Math.abs(deltaX) > 48) {
                goTo(deltaX < 0 ? index + 1 : index - 1, true);
            }
            deltaX = 0;
        };

        track.addEventListener('pointerup', endDrag);
        track.addEventListener('pointercancel', endDrag);

        // Hover glow coords on service cards
        cards.forEach(card => {
            const rectOf = cachedRect(card);
            card.addEventListener('pointerenter', () => { rectOf(); });
            card.addEventListener('pointermove', (e) => {
                const r = rectOf();
                card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                card.style.setProperty('--my', (e.clientY - r.top) + 'px');
            });
        });

        let resizeTimer = null;
        window.addEventListener('resize', () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(measure, 120);
        }, { passive: true });

        // Rebuild dots when maxIndex may change with breakpoint
        const mq = window.matchMedia('(max-width: 1024px)');
        const onMq = () => measure();
        if (mq.addEventListener) mq.addEventListener('change', onMq);
        else if (mq.addListener) mq.addListener(onMq);

        // Re-measure when the services page becomes visible (display:none on boot)
        window.__measureServicesCarousel = measure;
        if ('ResizeObserver' in window) {
            const ro = new ResizeObserver(() => measure());
            ro.observe(root);
        }

        measure();
        apply(false);
    }

    /* ------------------------------------------------------------------
       Decorative background — constellation canvas + pointer parallax
       At most two rAF loops (one for the canvas, one for the parallax
       lerp) and both of them sleep whenever there is nothing left to
       animate: hidden tab, reduced motion, or parallax that has settled.
       No listener below ever reads layout, and no array/object is built
       per frame — the buffers are allocated once.
    ------------------------------------------------------------------ */
    function setupBg() {
        const bg = document.querySelector('.bg');
        if (!bg) return;

        const canvas = bg.querySelector('.bg-canvas');
        const ctx = canvas ? canvas.getContext('2d') : null;

        /* ----- Constellation ------------------------------------------ */
        const LINK = 140, LINK2 = LINK * LINK;           // link distance
        const ATTRACT = 200, ATTRACT2 = ATTRACT * ATTRACT; // pointer pull
        const IMPULSE = 260, IMPULSE2 = IMPULSE * IMPULSE; // click push
        const MAX_DOTS = 110, DPR_CAP = 2, TAU = Math.PI * 2;
        // Five loose spatial clusters → occasional polygon constellations
        const CLUSTERS = [
            [0.18, 0.26], [0.76, 0.22], [0.52, 0.54], [0.26, 0.80], [0.80, 0.74]
        ];

        const theme = { node: '34, 211, 238', hot: '167, 139, 250', line: '', dot: '', cursor: '' };
        const dots = [];
        // Resolved (pointer-attracted) positions — one reusable buffer
        const pos = new Float32Array(MAX_DOTS * 2);
        // Spatial-hash scratch space (cell = link distance, one pass per frame)
        const OFF_X = [0, 1, -1, 0, 1];
        const OFF_Y = [0, 0, 1, 1, 1];
        let gCols = 0, gRows = 0;
        let gHead = new Int32Array(0);
        const gNext = new Int32Array(MAX_DOTS);

        let W = 0, H = 0;
        let rafId = 0, lastT = 0;
        let ptrX = -9999, ptrY = -9999, ptrOn = false;

        function readTheme() {
            const cs = getComputedStyle(bg);
            const n = (cs.getPropertyValue('--node') || '').trim();
            const h = (cs.getPropertyValue('--hot') || '').trim();
            if (n) theme.node = n;
            if (h) theme.hot = h;
            theme.line = 'rgba(' + theme.node + ', 0.3)';
            theme.dot = 'rgb(' + theme.node + ')';
            theme.cursor = 'rgb(' + theme.hot + ')';
        }

        // ≈1 dot per 10,000px², capped at 110 (fewer on tablet and phone)
        function targetCount() {
            const cap = W <= 640 ? 40 : (W <= 1024 ? 70 : MAX_DOTS);
            return Math.max(14, Math.min(cap, Math.round((W * H) / 10000), MAX_DOTS));
        }

        function makeDot(i) {
            const c = CLUSTERS[i % CLUSTERS.length];
            const a = Math.random() * TAU;
            const rr = Math.pow(Math.random(), 0.65);
            return {
                x: (c[0] + Math.cos(a) * rr * 0.17) * W,
                y: (c[1] + Math.sin(a) * rr * 0.17) * H,
                vx: (Math.random() - 0.5) * 0.22,
                vy: (Math.random() - 0.5) * 0.22,
                ix: 0, iy: 0,                     // click impulse, decays in step()
                r: 1.1 + Math.random() * 1.2,
                ph: Math.random() * TAU           // drift phase
            };
        }

        function syncDots() {
            const n = targetCount();
            while (dots.length < n) dots.push(makeDot(dots.length));
            if (dots.length > n) dots.length = n;
        }

        function resize() {
            W = bg.clientWidth || window.innerWidth;
            H = bg.clientHeight || window.innerHeight;
            if (!W || !H) return;
            layoutGrid();
            if (!ctx) return;
            const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
            canvas.width = Math.max(1, Math.round(W * dpr));
            canvas.height = Math.max(1, Math.round(H * dpr));
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            readTheme();
            syncDots();
            if (!rafId) renderOnce();   // keep a valid frame while the loop sleeps
        }

        // Only reallocated when the viewport actually changes shape
        function layoutGrid() {
            const cols = Math.max(1, Math.ceil(W / LINK));
            const rows = Math.max(1, Math.ceil(H / LINK));
            if (cols === gCols && rows === gRows && gHead.length === cols * rows) return;
            gCols = cols;
            gRows = rows;
            gHead = new Int32Array(cols * rows);
        }

        // One static frame — used for the initial paint and for reduced motion
        function renderOnce() {
            step(0, 1);
            draw();
        }

        function step(dt, now) {
            const k = Math.min(3, dt / 16.667);
            for (let i = 0; i < dots.length; i++) {
                const d = dots[i];
                const w = Math.sin(now * 0.0006 + d.ph);
                d.x += (d.vx + d.ix + w * 0.03) * k;
                d.y += (d.vy + d.iy - w * 0.02) * k;
                if (d.ix || d.iy) {
                    d.ix *= 0.94;
                    d.iy *= 0.94;
                    if (d.ix * d.ix < 0.0004) d.ix = 0;
                    if (d.iy * d.iy < 0.0004) d.iy = 0;
                }
                // wrap around the viewport edges
                if (d.x < -24) d.x += W + 48; else if (d.x > W + 24) d.x -= W + 48;
                if (d.y < -24) d.y += H + 48; else if (d.y > H + 24) d.y -= H + 48;
            }
        }

        function draw() {
            if (!ctx) return;
            const n = dots.length;
            const live = ptrOn && !reduceMotion.matches;

            // Resolve the pointer attraction into the reused buffer so the
            // lines and the dots share exactly the same coordinates.
            for (let i = 0; i < n; i++) {
                const d = dots[i];
                let x = d.x, y = d.y;
                if (live) {
                    const dx = ptrX - x, dy = ptrY - y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < ATTRACT2 && d2 > 4) {
                        // drawn offset only — the simulation is never pulled
                        // into a collapse toward the pointer
                        const f = (1 - Math.sqrt(d2) / ATTRACT) * 0.18;
                        x += dx * f;
                        y += dy * f;
                    }
                }
                pos[i * 2] = x;
                pos[i * 2 + 1] = y;
            }

            ctx.clearRect(0, 0, W, H);
            ctx.lineWidth = 1;
            ctx.strokeStyle = theme.line;

            // Uniform spatial hash with cells the size of the link distance,
            // rebuilt once per frame out of preallocated typed arrays. Only
            // dots that could actually be connected are ever compared, and
            // the 5-cell stencil visits every candidate pair exactly once.
            for (let c = 0; c < gHead.length; c++) gHead[c] = -1;
            for (let i = 0; i < n; i++) {
                let cx = (pos[i * 2] / LINK) | 0;
                let cy = (pos[i * 2 + 1] / LINK) | 0;
                if (cx < 0) cx = 0; else if (cx >= gCols) cx = gCols - 1;
                if (cy < 0) cy = 0; else if (cy >= gRows) cy = gRows - 1;
                const cell = cy * gCols + cx;
                gNext[i] = gHead[cell];
                gHead[cell] = i;
            }

            // Four fixed alpha buckets: distance-faded links with zero
            // string/object allocation and no per-segment stroke() calls.
            for (let b = 0; b < 4; b++) {
                ctx.beginPath();
                let any = false;
                for (let cy = 0; cy < gRows; cy++) {
                    for (let cx = 0; cx < gCols; cx++) {
                        const cell = cy * gCols + cx;
                        if (gHead[cell] === -1) continue;
                        for (let o = 0; o < 5; o++) {
                            const nx = cx + OFF_X[o], ny = cy + OFF_Y[o];
                            if (nx < 0 || nx >= gCols || ny >= gRows) continue;
                            const other = ny * gCols + nx;
                            for (let i = gHead[cell]; i !== -1; i = gNext[i]) {
                                const xi = pos[i * 2], yi = pos[i * 2 + 1];
                                // same cell → only the dots after it; the four
                                // forward neighbours → every dot (each pair is
                                // therefore only ever considered once)
                                for (let j = (o === 0 ? gNext[i] : gHead[other]); j !== -1; j = gNext[j]) {
                                    const dx = pos[j * 2] - xi, dy = pos[j * 2 + 1] - yi;
                                    const d2 = dx * dx + dy * dy;
                                    if (d2 > LINK2) continue;
                                    let bb = ((1 - Math.sqrt(d2) / LINK) * 4) | 0;
                                    if (bb > 3) bb = 3;
                                    if (bb !== b) continue;
                                    ctx.moveTo(xi, yi);
                                    ctx.lineTo(pos[j * 2], pos[j * 2 + 1]);
                                    any = true;
                                }
                            }
                        }
                    }
                }
                if (any) {
                    ctx.globalAlpha = (b + 0.5) * 0.085;
                    ctx.stroke();
                }
            }

            // Brighter purple links from the pointer to nearby dots
            if (live) {
                ctx.strokeStyle = theme.cursor;
                for (let i = 0; i < n; i++) {
                    const xi = pos[i * 2], yi = pos[i * 2 + 1];
                    const dx = ptrX - xi, dy = ptrY - yi;
                    const d2 = dx * dx + dy * dy;
                    if (d2 > ATTRACT2) continue;
                    ctx.globalAlpha = (1 - Math.sqrt(d2) / ATTRACT) * 0.65;
                    ctx.beginPath();
                    ctx.moveTo(ptrX, ptrY);
                    ctx.lineTo(xi, yi);
                    ctx.stroke();
                }
            }

            // Dots — one path, one fill
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = theme.dot;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const r = dots[i].r;
                const x = pos[i * 2], y = pos[i * 2 + 1];
                ctx.moveTo(x + r, y);
                ctx.arc(x, y, r, 0, TAU);
            }
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        function frame(now) {
            rafId = requestAnimationFrame(frame);
            const dt = lastT ? Math.min(64, now - lastT) : 16.7;
            lastT = now;
            step(dt, now || 1);
            draw();
        }

        function startLoop() {
            if (rafId || !ctx || reduceMotion.matches || document.hidden) return;
            lastT = 0;
            rafId = requestAnimationFrame(frame);
        }

        function stopLoop() {
            if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
            lastT = 0;
        }

        // Single switch for both exit paths: hidden tab and reduced motion.
        function syncLoop() {
            if (!reduceMotion.matches && !document.hidden) {
                startLoop();
            } else {
                stopLoop();
                if (reduceMotion.matches) {
                    // reduced motion still shows a static constellation
                    ptrOn = false;
                    renderOnce();
                }
            }
        }

        function impulse(x, y) {
            if (reduceMotion.matches) return;
            for (let i = 0; i < dots.length; i++) {
                const d = dots[i];
                const dx = d.x - x, dy = d.y - y;
                const d2 = dx * dx + dy * dy;
                if (d2 > IMPULSE2 || d2 < 4) continue;
                const dist = Math.sqrt(d2);
                const f = (1 - dist / IMPULSE) * 3;
                d.ix += (dx / dist) * f;
                d.iy += (dy / dist) * f;
            }
        }

        /* ----- Pointer parallax (data-depth layers) -------------------- */
        const layers = Array.from(bg.querySelectorAll('[data-depth]'))
            .map(el => ({ el, d: parseFloat(el.dataset.depth) || 10 }));
        let tgX = 0, tgY = 0, curX = 0, curY = 0, parRaf = 0;

        function parFrame() {
            parRaf = 0;
            curX += (tgX - curX) * 0.06;
            curY += (tgY - curY) * 0.06;
            for (let i = 0; i < layers.length; i++) {
                const l = layers[i];
                l.el.style.setProperty('--bg-tx', (-curX * l.d).toFixed(2) + 'px');
                l.el.style.setProperty('--bg-ty', (-curY * l.d).toFixed(2) + 'px');
            }
            if (Math.abs(tgX - curX) > 0.0004 || Math.abs(tgY - curY) > 0.0004) {
                parRaf = requestAnimationFrame(parFrame);
            }
        }

        function parWake() {
            if (!layers.length || parRaf || reduceMotion.matches) return;
            parRaf = requestAnimationFrame(parFrame);
        }

        function parTarget(x, y, scale) {
            // opposite direction, normalised to −0.5 … 0.5
            tgX = Math.max(-0.5, Math.min(0.5, x / window.innerWidth - 0.5)) * scale;
            tgY = Math.max(-0.5, Math.min(0.5, y / window.innerHeight - 0.5)) * scale;
            parWake();
        }

        function parReset() {
            tgX = tgY = curX = curY = 0;
            if (parRaf) { cancelAnimationFrame(parRaf); parRaf = 0; }
            for (let i = 0; i < layers.length; i++) {
                layers[i].el.style.setProperty('--bg-tx', '0px');
                layers[i].el.style.setProperty('--bg-ty', '0px');
            }
        }

        /* ----- Wiring -------------------------------------------------- */
        window.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'touch') return;   // touch handled below
            ptrX = e.clientX;
            ptrY = e.clientY;
            ptrOn = true;
            parTarget(ptrX, ptrY, 1);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            if (!t) return;
            parTarget(t.clientX, t.clientY, 0.5);    // gentler on touch
        }, { passive: true });

        window.addEventListener('touchend', () => { tgX = 0; tgY = 0; parWake(); }, { passive: true });

        // Click impulse — decorative only, never blocks the real target
        window.addEventListener('pointerdown', (e) => impulse(e.clientX, e.clientY), { passive: true });

        document.addEventListener('pointerout', (e) => {
            if (e.relatedTarget) return;
            ptrOn = false;
            tgX = 0; tgY = 0;
            parWake();
        }, { passive: true });

        // Resize work is batched into one rAF and never touches the pointer path
        let resizeRaf = 0;
        window.addEventListener('resize', () => {
            if (resizeRaf) return;
            resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; resize(); });
        }, { passive: true });

        document.addEventListener('visibilitychange', syncLoop);
        if (reduceMotion.addEventListener) {
            reduceMotion.addEventListener('change', () => {
                body.classList.toggle('reduce-fx', reduceMotion.matches);
                if (reduceMotion.matches) parReset();
                syncLoop();
            });
        }
        // Set once here too: the two pre-existing toggles live behind a
        // fine-pointer guard, so touch devices with reduced motion enabled
        // would otherwise never get the hook this layer's CSS uses.
        body.classList.toggle('reduce-fx', reduceMotion.matches);

        readTheme();
        resize();
        syncLoop();
    }

    /* ------------------------------------------------------------------
       Hero parallax — layered anime scene follows the mouse
    ------------------------------------------------------------------ */
    function setupParallax() {
        if (!isDesktop()) return;
        const scene = document.getElementById('hero-scene');
        if (!scene) return;

        // Depth factors parsed once instead of on every frame for every layer
        const layers = Array.from(scene.querySelectorAll('[data-depth]'))
            .map(el => ({ el, d: parseFloat(el.dataset.depth) || 1 }));
        let raf = null, nx = 0, ny = 0;

        const apply = () => {
            raf = null;
            for (let i = 0; i < layers.length; i++) {
                const l = layers[i];
                l.el.style.setProperty('--px', (nx * 12 * l.d).toFixed(1) + 'px');
                l.el.style.setProperty('--py', (ny * 9 * l.d).toFixed(1) + 'px');
            }
        };

        const host = scene.closest('.hero-visual') || scene;
        const rectOf = cachedRect(host);
        host.addEventListener('pointerenter', () => { rectOf(); });
        host.addEventListener('pointermove', (e) => {
            const r = rectOf();
            nx = (e.clientX - r.left) / r.width - 0.5;
            ny = (e.clientY - r.top) / r.height - 0.5;
            if (!raf) raf = requestAnimationFrame(apply);
        }, { passive: true });
        host.addEventListener('pointerleave', () => {
            nx = 0; ny = 0;
            if (!raf) raf = requestAnimationFrame(apply);
        });
    }

    /* ------------------------------------------------------------------
       Project filters
    ------------------------------------------------------------------ */
    function setupFilters() {
        const btns = document.querySelectorAll('.filter-btn');
        if (!btns.length) return;
        const cards = document.querySelectorAll('[data-cats]');

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('active')) return;
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const cat = btn.dataset.filter;

                cards.forEach(card => {
                    const match = cat === 'all' || (card.dataset.cats || '').split(' ').includes(cat);
                    if (match) {
                        card.hidden = false;
                        requestAnimationFrame(() => requestAnimationFrame(() => card.classList.remove('filter-out')));
                    } else {
                        card.classList.add('filter-out');
                        setTimeout(() => {
                            if (card.classList.contains('filter-out')) card.hidden = true;
                        }, 280);
                    }
                });
            });
        });
    }

    /* ------------------------------------------------------------------
       Project detail overlay — opens like a case/mission file
    ------------------------------------------------------------------ */
    function setupProjectOverlay() {
        const overlay = document.getElementById('project-overlay');
        if (!overlay) return;
        const els = {
            file: document.getElementById('po-file-id'),
            visual: document.getElementById('po-visual'),
            icon: document.getElementById('po-icon'),
            label: document.getElementById('po-visual-label'),
            category: document.getElementById('po-category'),
            title: document.getElementById('po-title'),
            desc: document.getElementById('po-desc'),
            tech: document.getElementById('po-tech'),
            status: document.getElementById('po-status'),
            privateNote: document.getElementById('po-private-note'),
            actions: document.getElementById('po-actions')
        };
        let lastFocus = null;

        const close = () => {
            if (!overlay.classList.contains('open')) return;
            overlay.classList.remove('open');
            setTimeout(() => { overlay.hidden = true; }, 340);
            body.style.overflow = '';
            if (lastFocus) { lastFocus.focus(); lastFocus = null; }
        };

        const open = (card) => {
            const d = card.dataset;
            if (!d.poTitle) return;
            lastFocus = document.activeElement;

            els.file.textContent = d.poId || 'PRJ';
            els.icon.className = d.poIcon || 'fas fa-rocket';
            els.label.textContent = d.poVisualLabel || '';
            els.category.textContent = d.poCategory || '';
            els.title.textContent = d.poTitle;
            els.desc.textContent = d.poDesc || '';
            els.visual.dataset.variant = d.poVisual || 'default';

            els.tech.innerHTML = '';
            (d.poTech || '').split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
                const s = document.createElement('span');
                s.textContent = t;
                els.tech.appendChild(s);
            });

            const isPrivate = card.classList.contains('private');
            els.status.className = 'project-status ' + (isPrivate ? 'private' : 'public');
            els.status.innerHTML = isPrivate
                ? '<i class="fas fa-lock" aria-hidden="true"></i> Private Repository'
                : '<i class="fas fa-lock-open" aria-hidden="true"></i> Public';
            els.privateNote.hidden = !isPrivate;

            els.actions.innerHTML = '';
            const mk = (href, cls, html) => {
                const a = document.createElement('a');
                a.href = href;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.className = cls;
                a.innerHTML = html;
                els.actions.appendChild(a);
            };
            if (d.poGithub) {
                mk(d.poGithub, 'btn btn-primary btn-sm',
                    '<i class="fab fa-github" aria-hidden="true"></i><span>View on GitHub</span><i class="fas fa-arrow-right proj-arrow" aria-hidden="true"></i>');
            }
            if (d.poLive) {
                mk(d.poLive, 'btn btn-ghost btn-sm',
                    '<i class="fas fa-external-link-alt" aria-hidden="true"></i><span>Live Demo</span>');
            }

            overlay.hidden = false;
            requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));
            body.style.overflow = 'hidden';
            const closeBtn = overlay.querySelector('.po-close');
            if (closeBtn) closeBtn.focus();
        };

        document.querySelectorAll('[data-po]').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('a, button')) return;
                open(card);
            });
        });

        overlay.querySelectorAll('[data-po-close]').forEach(el => el.addEventListener('click', close));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) close();
        });

        // Router hook: navigating to another scene closes the overlay
        window.__closeProjectOverlay = close;
    }

    /* ------------------------------------------------------------------
       Mobile menu
    ------------------------------------------------------------------ */
    function toggleMobileMenu() {
        const isActive = navMenu.classList.contains('active');
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
        body.style.overflow = isActive ? 'auto' : 'hidden';
        hamburger.setAttribute('aria-expanded', String(!isActive));
    }

    /* ------------------------------------------------------------------
       Header scroll state
    ------------------------------------------------------------------ */
    function setupHeaderScroll() {
        let ticking = false;
        const update = () => {
            ticking = false;
            header.classList.toggle('scrolled', window.scrollY > 50);
        };
        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    /* ------------------------------------------------------------------
       Contact form → Gmail compose (new tab)
    ------------------------------------------------------------------ */
    function setupContactForm() {
        const form = document.getElementById('contactForm');
        if (!form) return;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(form));
            if (!data.name || !data.email || !data.subject || !data.message) {
                showNotification('Please fill in all fields', 'error');
                return;
            }
            const url = 'https://mail.google.com/mail/?view=cm&fs=1&to=mohitwish2@gmail.com'
                + '&su=' + encodeURIComponent(`Portfolio contact: ${data.subject}`)
                + '&body=' + encodeURIComponent(`Name: ${data.name}\nEmail: ${data.email}\n\n${data.message}`);
            window.open(url, '_blank', 'noopener');
            showNotification('Opening Gmail compose…', 'info');
        });
    }

    function showNotification(message, type = 'info') {
        const n = document.createElement('div');
        n.className = `notification notification-${type}`;
        n.setAttribute('role', 'status');
        n.textContent = message;
        Object.assign(n.style, {
            position: 'fixed', top: '20px', right: '20px', zIndex: '4000',
            background: type === 'error' ? '#ef4444' : 'rgba(10, 12, 24, 0.95)',
            border: '1px solid rgba(129, 140, 248, 0.4)',
            color: '#fff', padding: '0.9rem 1.3rem', borderRadius: '12px',
            font: '500 0.88rem Inter, sans-serif',
            transform: 'translateY(-80px)', transition: 'transform 0.3s ease',
            boxShadow: '0 12px 34px rgba(0,0,0,0.45)'
        });
        body.appendChild(n);
        setTimeout(() => { n.style.transform = 'translateY(0)'; }, 60);
        setTimeout(() => {
            n.style.transform = 'translateY(-80px)';
            setTimeout(() => n.remove(), 320);
        }, 2600);
    }

    /* ------------------------------------------------------------------
       Keyboard accessibility for the mobile menu
    ------------------------------------------------------------------ */
    function handleKeyboard(event) {
        if (event.key === 'Escape' && navMenu.classList.contains('active')) {
            toggleMobileMenu();
            hamburger.focus();
        }
        if (navMenu.classList.contains('active') && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            const arr = Array.from(navLinks);
            const active = document.querySelector('.nav-link:focus') || document.querySelector('.nav-link.active');
            const i = arr.indexOf(active);
            const next = event.key === 'ArrowDown' ? (i + 1) % arr.length : (i <= 0 ? arr.length - 1 : i - 1);
            arr[next].focus();
        }
    }

    /* ------------------------------------------------------------------
       Boot
    ------------------------------------------------------------------ */
    function init() {
        showPageInstant(parseRoute());
        runLoader();
        setupReveals();
        setupTimelineProgress();
        setupNodeIgnition();
        setupCursor();
        setupMagnetics();
        setupTiltCards();
        setupProjectCardFX();
        setupParallax();
        setupBg();
        setupFilters();
        setupProjectOverlay();
        setupServicesCarousel();
        setupHeaderScroll();
        setupContactForm();

        hamburger.addEventListener('click', toggleMobileMenu);
        window.addEventListener('hashchange', handleHashChange);
        document.addEventListener('keydown', handleKeyboard);
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 769 && navMenu.classList.contains('active')) toggleMobileMenu();
        }, { passive: true });

        document.addEventListener('click', (event) => {
            if (navMenu.classList.contains('active') &&
                !navMenu.contains(event.target) &&
                !hamburger.contains(event.target)) {
                toggleMobileMenu();
            }
        });
    }

    init();
});
