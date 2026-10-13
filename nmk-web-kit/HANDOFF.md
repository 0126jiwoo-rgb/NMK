# NMK mobile web: handoff for Claude Code

Build the National Museum of Korea (국립중앙박물관) landing page and its linked screens as a real mobile website, matching the Figma wireframes.

## Source of truth

- Figma file key: `pItMcEJ9oNULYzrlzXyEUY` (file "Wireframes", page "Wireframes", id `2:51`)
- Use the Figma MCP (`get_design_context`, `get_screenshot`, `download_assets`) on the node IDs below. Match the screenshots.

| Screen / asset | Node ID | Size |
|---|---|---|
| Landing page | `145:25` | 402 × 7900 |
| Menu overlay | `146:106` | 402 × 874 |
| Language sheet overlay | `176:363` | 402 × 874 |
| Search · suggestions ("wheel") | `159:196` | 402 × 874 |
| Search · results ("wheelchair") | `159:264` | 402 × 1000 |
| Search · no results ("bring my dog") | `159:330` | 402 × 874 |
| Tickets & Reservations | `160:231` | 402 × 1145 |
| Buy Tickets · The Korean Table | `160:332` | 402 × 874 |
| Ticket Confirmed | `160:406` | 402 × 874 |
| History & Significance | `161:308` | 402 × 1613 |
| Header (component) | `146:48` | |
| Button set (Primary / Gold / Outline × Default / Pressed) | `147:141` | |
| Chip set (Neutral / Accent) | `147:132` | |
| Link row set | `147:150` | |
| Service tile | `148:154` | |
| Exhibition card | `148:199` | |
| Exhibition carousel (2 slides) | `150:225` | |
| Hero slideshow (5 slides) | `107:72` | |
| Live dot (pulse) | `202:371` | |
| Official NMK logo | `121:25` (also inside Header) | |

## Rules

- The official NMK logo is government identity. Use the exported SVG as is. Never redraw or recolor it.
- No em dashes in any copy. Small labels and eyebrows in sentence case, never ALL CAPS.
- Purple `#4F00A4` is the accent. Use it sparingly: primary CTAs, links, the live dot, small highlights.
- No green anywhere. Status and badges use ink or purple.
- Real copy only, no lorem ipsum. Keep the English copy from Figma.
- Mobile first. The design is 402 px wide (iPhone 17, 402 × 874). Content side margin is 30 px. It should still look right from 360 px up to tablet width (cap the content column, for example `max-width: 480px; margin-inline: auto`).

## Design tokens (from Figma)

Colors
- Ink `#16161A`, gray text `#6E6E75`, light gray text `#9999A2`
- Page `#FFFFFF`, section gray `#F6F6F8`, line `#ECECF0`
- Accent purple `#4F00A4`, purple tint `#F2ECFB`, light purple halo `#E2CAFB`
- Primary button gradient `#6B1FD1` to `#4F00A4`
- Shop section background `#0E0E10`
- Gold: `#E2C992`, `#C9A86A`, `#A88548` (MU:DS wordmark gradient). Gold button gradient `#F0D8A4` to `#C99843`, label `#1A140A`

Type
- Display: Noto Serif KR (Light 300, Regular 400, SemiBold 600, Bold 700)
- UI and body: Inter (Regular 400, Medium 500, Semi Bold 600)
- Scale: 34 hero, 28 section title (Bold line + Light gray second line), 22 sub-title, 17 card title, 15 to 16 buttons and rows, 14 body (line height 155%), 13 meta, 12 eyebrow, 11 fine print. MU:DS wordmark 76.

Shape and spacing
- Cards: white, radius 24, two soft shadows (copy from Figma). Service tiles radius 20 on `#F6F6F8`.
- Buttons: height 56, radius 28. Chips: height 26, radius 13, 11 px Medium text.
- Section padding: 72 top, 96 bottom. Card padding 24. Gap between cards 16.

## Landing page order (`145:25`)

Section labels (Plan your visit, What's on, Museum shop, Programs & events, At the museum) carry no "No. 0x" numbers: the sections are not a sequence, and numbers implied an order the menu didn't follow. Each label is Inter Medium 12, ink (white on the shop section), above a 1 px rule.

1. Fixed header: logo, search icon, EN, menu. White, 112 high in Figma (includes iOS status bar; on web drop the fake status bar).
2. Notice bar: purple dot + "Partial gallery closures until Jan 28, 2027" + dismiss.
3. Hero slideshow, 5 photos, vertical "국립중앙박물관", "Est. 1945", "Korea's story, / in one place.", progress bars and caption "01 / 05 Main building".
4. Today card overlapping the hero: date, live dot + "Open", hours, last entry; Admission "Free" for permanent galleries.
5. Search: "What do you need to know?", field "Hours, tickets, exhibitions...", popular searches (2 columns × 3 rows, ranked).
6. Plan your visit (gray section): opening hours card with weekly bar chart (today highlighted, Wed and Sat taller for late opening), hours rows, "What needs a ticket?" admission cards (Free / Reservation required / Ticket required), Getting here card with map, Ichon Station line chips, Get Directions.
7. What's on: "On view now" exhibition carousel with progress bar, "Don't miss" list (2F Room of Quiet Contemplation, 1F Silla Gold Crown) with thumbnails, See All Exhibitions.
8. Museum shop (dark): MU:DS gold gradient wordmark, "From the gallery / to your shelf", full-bleed best seller photo with scrims, "More to discover" 2 items, gold "Shop MU:DS Online" button, "Find the shop in the museum" underlined link.
9. Programs & events (gray): guided tours card ("Two tours every weekday", 10:30 | 13:00, language chips, meeting point), programs list card.
10. At the museum: 2 × 2 service tiles with purple icons, "View Accessibility Guide" outline button.
11. Footer: official logo, address and phone, links, "Est. 1945 · Seoul".

## Interactions

- Header stays fixed on scroll.
- Menu icon opens the full-screen menu overlay. Items, in page order: Plan Your Visit, Tickets & Reservations, Exhibitions, Highlights, Shop, Programs & Events, At the Museum, History & Significance. Section items close the menu and scroll to that section (offset by the header height). Tickets & Reservations and History & Significance open their pages.
- EN opens the language bottom sheet (English selected, 한국어, 日本語, 中文). Tap an option, the scrim or the close icon to dismiss.
- Hero: auto-advances every 3.5 s with a horizontal slide, swipeable, progress bars fill per slide.
- Exhibition carousel: horizontal scroll with snap so the second poster is fully visible; the progress bar follows the scroll position.
- Live dot next to "Open": pulsing ring that expands and fades, about 1.4 s loop. Respect `prefers-reduced-motion`.
- Search field or header search icon opens Search. Typing shows suggestions; "wheelchair" shows results with a quick answer, content-type filters (All 4, Visitor info 2, Guides 1, Directions 1) and ranked results; an unmatched query shows the no-results state with alternatives. Popular searches on the landing scroll to the matching section.
- Buttons and link rows have a pressed state.
- Ticket flow: Tickets & Reservations, Buy Tickets (date chips, quantity steppers that update the total), Pay, Ticket Confirmed, Back to Home.
- Page transitions: simple cross-fade, no slide.
- Routing: hash routes are fine (for example `#/search`, `#/tickets`, `#/buy`, `#/confirmed`, `#/history`).

## Assets in this kit

- `img/hero1.jpg` to `img/hero5.jpg` (804 × 1120, 2x of 402 × 560)
- `img/poster1.jpg` The Korean Table, `img/poster2.jpg` Evergreen Bamboo (2x of 272 × 290)
- `img/thumb-room.jpg`, `img/thumb-crown.jpg` (3x of 72 × 72)
- `img/shop-feature.jpg` (2x of 402 × 477), `img/shop-keyring.jpg`, `img/shop-porcelain.jpg` (2x of 163 × 210)
- `img/map.jpg` (2x of 342 × 168). Add the purple pin on top in code.
- `icons/*.svg`: search, menu, close, check, and the four service icons
- Logo: export it from Figma with `download_assets` on the Header's "NMK logo · header" layer or node `121:25` (SVG). Do not redraw it.

## Facts to verify before publishing

- Wed and Sat closing time (shown as 21:00). Weekday hours 9:30 to 17:30 are confirmed (changed Mar 16, 2026).
- The Korean Table prices (adults ₩5,000, youth and children ₩3,000) come from one blog post. Age ranges for "youth and children" are unknown.
- Free / Paid badges on exhibitions.
- Language list in the language sheet.
- Booking number "2610-1302" on the confirmation screen is sample data.
