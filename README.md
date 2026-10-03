# Mohit Verma — Developer Portfolio

An interactive, anime-inspired developer portfolio built with **pure HTML, CSS and vanilla JavaScript** — no frameworks, no build step.

## Features

- **Multi-page experience** — 8 routes (`Home / About / Skills / Experience / Projects / Education / Services / Contact`) powered by a hash-based router (`#/about`, `#/projects`, …) with browser back/forward support
- **Cinematic scene transitions** — each navigation is an "entering a new scene" moment: the current page dims, a dark glass layer rises from the bottom, a portal opens with ambient light, drifting particles, floating code fragments, blurred city lights and the destination name flickering in (~850ms, instantly interactive after)
- **Loading screen** — name + role reveal on first visit (skipped under reduced motion)
- **Custom cursor** — trailing ring + glowing dot with contextual states (VIEW / EXPLORE / OPEN / SKILL / GITHUB / nav shrink), plus a subtle particle trail. Desktop only; disabled on touch devices
- **Mouse-reactive UI** — global spotlight, magnetic buttons, parallax hero scene, cursor-following light on cards, 3D tilt on skill/service cards
- **Project case files** — clicking any project opens a full-screen detail overlay (mission-file style: case number, visual, tech stack, repository status, GitHub/Live buttons). Closes via ×, backdrop, or Escape with the reverse animation
- **Project filters** — ALL / WEB / FULL-STACK / AI / CYBERSECURITY / JAVA-DSA with animated show/hide
- **Scroll animations** — IntersectionObserver reveals with stagger; Experience and Education timelines have glowing progress lines with igniting nodes and card light-sweeps
- **Per-page ambience** — each route has its own subtle atmospheric background while staying one cohesive site
- **Homepage cinematic background** — home-only layered animation: slow cyan/blue light trails, violet aurora glows, drifting particles, and rotating wireframe crystals behind existing hero content (static under reduced motion)
- **Accessibility** — semantic HTML, keyboard navigation, focus states, skip link, focus-trap-friendly overlay, `prefers-reduced-motion` fully respected (transitions, tilt, trails and parallax all switch off)
- **Performance** — zero dependencies, `requestAnimationFrame` for mouse work, transform/opacity/clip-path-only animations, passive listeners

## Structure

```
portfolio/
├── index.html   # All 8 route pages + loader/scene-transition/cursor/overlay shells
├── style.css    # Design system, pages, scenes (pure-CSS anime art), FX
├── script.js    # Router, scene transitions, cursor, magnetics, filters, case-file overlay
└── images/
```

## Content

All content is factual: real GitHub links only, private repositories shown as **Private Repository** without fake URLs, no invented experience or achievements.

- **Featured project:** Forensic AI — https://github.com/mohittxd/ai-powered-email
- **Contact:** Gmail compose (new tab) — no `mailto:` links

## Run locally

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Deploy by pushing to GitHub Pages (already configured via the `mohittxd.github.io/portfolio` canonical URL).
