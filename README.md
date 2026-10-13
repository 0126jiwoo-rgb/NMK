# NMK mobile web

A mobile website concept for the National Museum of Korea (국립중앙박물관), built from Figma wireframes. Plain HTML, CSS and JavaScript with no build step.

> Unofficial design concept. Not affiliated with or endorsed by the National Museum of Korea. The museum's name, logo and photos belong to their respective owners.

## About this project

- **Course:** UX 360: Information Architecture
- **Timeline:** 2-week assignment
- **Scope:** Built around the landing page, with the key screens it links to (search, tickets, history)
- **Approach:** Referenced the museum's current website ([museum.go.kr](https://www.museum.go.kr)) and designed on the basis of information architecture and research

## Run locally

```bash
python3 -m http.server 5178 --directory nmk-web-kit
```

Then open http://localhost:5178. To view on a phone on the same network, use your computer's local IP instead of `localhost`.

## What's inside

- `nmk-web-kit/index.html`: all screens (home, tickets, buy, confirmation, history) plus the search, menu and language overlays
- `nmk-web-kit/css/style.css`: design tokens and layout taken from Figma
- `nmk-web-kit/js/app.js`: hash router (`#/`, `#/search`, `#/tickets`, `#/buy`, `#/confirmed`, `#/history`), hero slideshow, search, soft section snapping, ticket flow
- `nmk-web-kit/HANDOFF.md`: design handoff notes (Figma node IDs, tokens, interactions, facts to verify)
