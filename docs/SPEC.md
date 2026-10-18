# Arnav Portfolio — Final Design Spec

Oct 18, 2026 · @Arnavv

## North star

The site has two layers: a fast 2D website that answers a recruiter in 30 seconds, and an optional 3D workshop that makes people remember Arnav. The 2D layer is the product; the 3D layer is the reward.

- **Who it's for:** AI/ML hiring managers in Singapore and Australia, freelance clients wanting AI automation or data science, and peers who want to play.
- **The one feeling:** walking into an engineer's workshop at night in Mumbai, where every object is something he built or loves.
- **Inspiration, never imitation:** Iron Man's workshop, TVA retro-tech and the Miss Minutes guide are moods only. No Marvel names, logos, suits or characters in visuals, scenes or UI copy; no photos or likeness of Virat Kohli. Factual mentions in Arnav's bio and EDITH's answers about him are fine.

**Design principles**

1. Everything is Arnav-specific: if a prop could sit in anyone's portfolio, replace it.
2. Content before chrome: every number on screen comes from a real repo or role.
3. One signature moment per layer: the photo-to-brain dive (2D) and the Earth-to-Mumbai holotable (3D). Everything else stays calm.
4. The 3D never gates information: anything shown in 3D also exists in the 2D site.
5. Colour carries meaning: cyan = hologram, tungsten = time and history, red = action.

## Site map and user flows

Recruiters get everything from the landing page in one click; explorers dive through the brain into the workshop, where the holotable is the hub for every world.

&#91;embedded content: Site map · 2D site, workshop, holotable, worlds\]

Three paths: **recruiter** (landing → resume, LinkedIn, projects), **client** (landing or neon sign → freelance form), **explorer** (landing → brain → workshop → holotable → worlds). Esc always steps back one level; the nav's "Back to site" leaves 3D entirely.

## Design system

Two themes, Night and Day, share one token set: each accent belongs to one layer, so colour tells the visitor where they are. Contrast is measured against each theme's background (WCAG 2.x). The table below is Night; Day overrides follow it.

**Colour tokens**

| Token | Hex | Role | Contrast on bg |
| --- | --- | --- | --- |
| `--bg` Graphite | `#0E1013` | Page and room shadow | — |
| `--surface` Gunmetal | `#171A1F` | Cards, panels, nav | — |
| `--line` Steel line | `#2A2F37` | Borders, dividers | — |
| `--text` Chalk | `#EDEFF2` | Primary text | 16.5:1 |
| `--text-2` Steel | `#8A93A0` | Secondary text, captions | 6.1:1 |
| `--holo` Arc Cyan | `#4FD8FF` | Hologram layer only (holotable, EDITH, HUD) | 11.4:1 |
| `--action` Signal Red | `#FF4B3E` | Primary buttons, links, armor accents | 5.7:1 |
| `--time` Tungsten | `#F2A33A` | Retro TV, timeline, "open to freelance" | 9.1:1 |
| `--board` Board Green | `#1F3B2D` | Chalkboard surface (chalk on it 10.6:1) | — |
| `--ok` Live Green | `#3DDC84` | Live dot, GitHub "online" | — |

Rules: one accent per screen region; never cyan and tungsten in the same panel; no purple-pink "AI gradient".

**Day theme overrides** (same token names; everything not listed is shared)

| Token | Night | Day | Day contrast on `#F6F4EF` |
| --- | --- | --- | --- |
| `--bg` | `#0E1013` | `#F6F4EF` paper | — |
| `--surface` | `#171A1F` | `#FFFFFF` | — |
| `--line` | `#2A2F37` | `#DAD7D0` | — |
| `--text` | `#EDEFF2` | `#14161A` | 16.5:1 |
| `--text-2` | `#8A93A0` | `#565C66` | 6.1:1 |
| `--holo` | `#4FD8FF` | `#00739E` | 4.8:1 |
| `--action` | `#FF4B3E` | `#C8281C` | 5.1:1 |
| `--time` | `#F2A33A` | `#8F5300` | 5.6:1 |

**Theme switching**

- Modes: Auto (default: follows Mumbai time for the 3D room and the OS setting for the 2D site), Day, Night.
- Keyboard: **D** toggles Day/Night anywhere, except while typing in a field. In free-roam walking, D is movement, so the toggle there is **Shift+D**.
- **Settings panel** (gear icon in the nav and in the workshop HUD): Theme (Auto / Day / Night), Sound (on/off), Motion (full / reduced), 3D quality (high / low / auto), Hologram colour. Saved in localStorage, wrapped in try/catch.
- A 600 ms colour cross-fade on the 2D site; a 1.2 s light cross-fade in 3D.

**Typography** (all free, self-hosted woff2, subset to Latin)

| Role | Face | Size / line-height | Notes |
| --- | --- | --- | --- |
| Display XL | Unbounded 700 | clamp(56px, 9vw, 128px) / 0.95 | Hero name only, tracking -0.02em |
| Display | Unbounded 600 | clamp(36px, 5vw, 64px) / 1.05 | Section titles |
| Heading | Geist 600 | 24px / 1.25 | Card titles |
| Body | Geist 400 | 17px / 1.6 | Max 68 characters per line |
| Small | Geist 400 | 14px / 1.5 | Captions, meta |
| HUD label | JetBrains Mono 500 | 12px / 1.2, uppercase, +0.08em | Boot lines, stats, chips |
| Era title | Fraunces 600 italic | 40px / 1.1 | Retro TV corner only |

**Spacing, shape, texture**

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Section gaps 128 desktop, 64 mobile.
- Radii: 6 chips, 12 cards, 999 pills. No drop shadows; depth comes from 1px `--line` borders and light.
- Film grain overlay at 4% opacity on the 2D site; scanlines only inside hologram surfaces.

**Motion tokens**

| Token | Value | Used for |
| --- | --- | --- |
| `--ease-out` | cubic-bezier(0.16, 1, 0.3, 1) | Reveals, text, cards (600–800 ms) |
| `--ease-cam` | cubic-bezier(0.65, 0, 0.35, 1) | 3D camera moves (1.4–2.2 s) |
| `--dur-hover` | 180 ms | Hover, focus, magnetic buttons |
| `--stagger` | 60 ms | List and word reveals |

With `prefers-reduced-motion`, reveals become fades, camera moves become cuts, and the boot sequence is skipped.

**Iconography:** Lucide line icons at 1.5px stroke for UI; 3D props are the icons inside the workshop.

## Landing page (the 2D website)

One long page that holds everything a recruiter or client needs: resume, LinkedIn, projects, experience, freelance, contact. The 3D workshop is entered from the hero and the nav, never required.

**Section order**

| # | Section | What it holds | Motion |
| --- | --- | --- | --- |
| 0 | ARNAV-OS boot | \~2.5 s of terminal lines (`[ OK ] rag.sys`, `[ OK ] agents.drv`, `[ !! ] chai.sys … low`), then the page. Once per session, skip on any key | Typewriter lines, CRT wipe out |
| 1 | Sticky nav | AR monogram · Work · Experience · About · Contact · **Open to freelance** pill · Resume button · **Enter workshop** button | Hides on scroll down, returns on scroll up |
| 2 | Hero | Right: ARNAV in Display XL, "AI engineer · RAG and agents · Mumbai", live chips (Currently: AI developer at Credit Intelligence · Building: EDITH). Left: portrait (Arnav faces right, toward the text; never mirrored) with depth parallax and a pulsing "click here" hotspot by the brain. Icon row: Resume, LinkedIn, GitHub, Instagram | Name splits in by letter; portrait reacts to cursor |
| 3 | Proof strip | Real numbers from repos: 0.971 F0.5 · 95.75% fire recall · ECE −93.5% · +8.28 dB SNR · 2.2M entities | Slow marquee, pauses on hover |
| 4 | Selected work | Top 5 as a sticky split: big project names on the left, a media pane on the right swapping clip, stat, stack and links (GitHub, demo, "See it in 3D") | Pane crossfades as each name crosses centre |
| 5 | All projects | Filterable index table: Shipped / Building / Coming soon, year, stack, links | Rows stagger in |
| 6 | Experience | Vertical tungsten rail: Credit Intelligence, Ticker Ltd, Datamatics, Wingreens World, plus hackathons (SIH, Amazon ML, Paytm). Role, dates, 2–3 impact lines each. Followed by the 75 Hard reel section (see 75 Hard) | Rail draws as you scroll |
| 7 | Skills | Grouped by layer, not logo soup: LLM / RAG / agents · ML and DL · data engineering · infra and deploy. A Parinaz-style dock of the stack sits under it | Dock icons magnify on hover |
| 8 | Open to freelance | Card with services and a "Start a project" form (see Open to freelance) | Tungsten glow pulse on the status dot |
| 9 | GitHub live | Contribution heatmap + 4 latest repos, from the cached API | Squares fill in order |
| 10 | Beyond code | Cricket teaser tile and a link to the 75 Hard section, both leading into the 3D room | Tile tilt on hover |
| 11 | Contact | Form (Turnstile) + email + socials | Magnetic send button |
| 12 | Footer | Socials, resume, "Built on Cloudflare", last-deployed date, workshop link | — |

**EDITH-lite assistant (2D page)**

- Floating button bottom-right (cyan ring, 56 px); opens a 380 px panel, full-screen sheet on mobile.
- Same agent and knowledge base as the 3D EDITH, without the avatar.
- Answers questions about Arnav (experience, projects, skills, availability) with source chips that link to the matching section.
- Navigates the page through tool calls: `scrollTo(section)`, `openResume()`, `openProject(id)`, `enterWorkshop()`, `startFreelanceForm()`.
- Opening chips: "What does Arnav build?", "Show me FireWatch", "Is he available for freelance?", "Take me to the 3D workshop".
- Rate-limited per visitor; says plainly when it doesn't know and offers the contact form.

**Responsive:** below 768 px the split sections stack, the portrait sits above the name, the marquee becomes a 2-column grid, and the workshop button opens a short "best on desktop" note with a "try anyway" option.

## The Workshop (3D room)

One room, entered from the brain dive, where every object opens a part of Arnav's story. Everything is built in code with React Three Fiber; no Blender (see Asset pipeline below).

**Entry sequence:** click the hotspot by the brain → the photo dissolves into a wireframe tech brain of particles (1.5 s) → click the brain → the camera dives through it and lands at the workshop door → a slow push-in to the overview shot.

**Zones and hotspots**

| Zone | Where | Opens | Interaction |
| --- | --- | --- | --- |
| Holotable | Room centre | Holotable OS (projects, EDITH, passion, about, resume, GitHub, freelance, contact) | Earth-to-Mumbai intro, then the holographic desktop |
| Mumbai window | Back wall | Live Mumbai time and weather; rain on the glass when it rains in Mumbai | Look only |
| Armor wall | Left wall | Four original suits, Mark I–IV, one per skill era: data (SQL, Power BI) → ML → deep learning → agents and RAG | Click a suit: it lights up, its plaque lists the stack of that era |
| Experience whiteboard | Right wall | Every role so far, drawn as a marker-pen timeline | Click: camera faces it; each role card expands (see Retro TV and whiteboard) |
| Retro TV | Front-left corner | Tungsten clock loader, then life timeline by channel | Turn the dial |
| Transformer installation | Back-left corner | 3D transformer that answers "what can Arnav do?" with skills | Type a question |
| Study table + notebook | Back-right corner | Private message to Arnav's inbox | Write on the page |
| Chalkboard | Right of the door | Public sticky-note reviews (moderated) | Pin a note |
| Server rack | Beside the holotable | LEDs blink with live GitHub contributions | Click: opens GitHub panel |
| Cricket shelf | Near the window | Arnav's own bat, ball and match photos | Click |
| Freelance neon sign | Above the door | "OPEN FOR FREELANCE" in tungsten neon | Click: freelance form |

Also on the right wall: the **discipline wall** (75 Hard calendar + three reel screens), beside the whiteboard. See 75 Hard.

**Camera and navigation**

- Default is hotspot navigation: click an object and the camera flies to its framed shot (`--ease-cam`, 1.6 s). Works the same on mouse, touch and keyboard.
- Esc or the back chip returns to the overview. A HUD zone list (bottom-left) lists every hotspot for keyboard and screen-reader users.
- Optional free-roam toggle on desktop: WASD to walk, mouse to look, E to interact.
- Hover gives a cyan outline glow and a mono label (`[ E ] OPEN HOLOTABLE`).

**Look: day and night.** The room follows the time of day in Mumbai (Auto), or the visitor's choice in Settings.

|  | Day (06:00–18:00 Mumbai) | Night (18:00–06:00 Mumbai) |
| --- | --- | --- |
| Key light | Warm natural sunlight through the window, soft long shadows across the floor | Cool moonlight through the window, rain when it rains in Mumbai |
| Practicals | Lamps off, monitors dimmer | Warm tungsten desk and wall lamps on, cyan hologram glow |
| Sky outside | Blue sky, skyline in haze | Night skyline with lit windows, moon |
| Hologram | Higher opacity so it reads in daylight | Full glow, scanlines visible |
| Mood | Clean studio | The signature "workshop at night" |

The switch is a 1.2 s cross-fade of lights and environment (no reload). Stylised realism, not low-poly. Ambient sound bed (rain or birds, server hum), muted by default with a sound toggle.

**Posters on the walls:** original illustrated posters only. Retro sci-fi "workshop" posters inspired by superhero-film mood (no Marvel names, logos, suits or characters) and cricket posters (stadiums, bat and ball, Mumbai skyline; no team logos or player likenesses). Generated as images, framed as textures.

**Asset pipeline: code-only, no Blender**

| Asset type | How it's made | Tool |
| --- | --- | --- |
| Room shell, table, shelves, scaffolding, server rack, monitors, portals | Procedural geometry written in code | React Three Fiber + drei |
| Holograms, Earth, brain, waveforms, smoke, sparks, rain on glass | Shaders and particle systems in code | GLSL via drei `shaderMaterial`, three.js points |
| Everyday props (chair, lamp, books, phone, camera) | Free CC0 / CC-BY models | Poly Haven, Kenney, Quaternius, Poly Pizza |
| Hero props (original Mark suits, ESP32-CAM, retro TV, notebook) | Text- or image-to-3D | Meshy or Tripo (web) |
| Arnav's avatar | Photos → 3D → auto-rig → Mixamo animations | Meshy/Tripo + Mixamo (web) |
| Lighting | Real-time lights + environment map + baked contact shadows at load | drei `Environment`, `Lightformer`, `AccumulativeShadows` |
| Compression | Draco meshes, KTX2 textures | gltf-transform CLI |

Trade-off, stated plainly: without Blender's baked lighting the room won't match Graffico's photoreal softness. We lean into a stylised, clean holo-tech look instead, which code does well and loads faster. A Blender bake can be added later by anyone, without changing the code.

## Holotable OS

The holotable is Arnav's desktop, projected in cyan over a flat glass table: Parinaz's layout (object icons, widgets, dock, honors rail) rebuilt as a hologram with his own objects.

**Intro (about 6 s, skippable):** a wireframe Earth rises from the table and rotates → slows and stops on India → zooms to Mumbai with a pin and coordinate readout (`19.07° N, 72.87° E`) → the pin expands into the desktop.

**Desktop icons** (holographic 3D objects, 2 rows of 4)

| Icon | Opens |
| --- | --- |
| Blueprint folder | Projects → Project World |
| Arc-ring headset | EDITH (avatar chat) |
| Bat and ball | Passion → Cricket World |
| ID badge | About (short bio, photo, location) |
| Paper stack | Resume (inline PDF viewer + download) |
| Server tower | GitHub (activity, repos) |
| Neon "open" sign | Open to freelance: services and the project form |
| Notebook | Contact (jumps to the study table) |

**Widgets (right column)**

- Hologram colour picker: cyan (default), tungsten, white.
- Mumbai weather and time + the visitor's local time.
- Now playing from Arnav's Spotify (last played when idle).
- "Currently building" card, read live from KV.

**Edges**

- Bottom dock: the stack (PyTorch, MLX, scikit-learn, FastAPI, PostgreSQL, Cloudflare, AWS, Docker), magnify on hover.
- Left honors rail: SIH 2026, Amazon ML Challenge 2026, Paytm Build for India.
- Bottom-right: round portrait + one-line bio, like Parinaz's profile blurb.

**Windows:** tabs open as floating holo-windows with a title bar (close, minimise), draggable on desktop, full-screen sheets on mobile. Opening a world (Projects, Passion) leaves the room through a camera transition instead of a window.

## Project World

A night-time hangar with one walkable path: five hero worlds, one construction site for EDITH, and a monitor wall for everything else. Each world loads only when entered.

**Hub:** the visitor arrives on a raised walkway. Six glowing portals line the path (5 heroes + EDITH), each with its name, one stat and a district colour stripe. At the far end, a curved wall of monitors lists the rest. Click a portal → camera flies through it into that world; Esc returns to the hub.

**Hero worlds (top 5)**

| Project | World | Key beats | On-screen stats |
| --- | --- | --- | --- |
| FireWatch | Dark storeroom at night | Smoke curls up → ESP32-CAM scans → bounding box locks as `p_fire` climbs past 0.30 → gas board buzzer flashes → fusion verdict → a phone lights with the alert while an "internet: OFF" badge shows | 95.75% fire recall · \~23 ms local inference · 11/12 live trials |
| SIH26052 speech enhancement | Night battlefield | Muzzle flashes; the voice is a 3D waveform tangled in noise → passes through a floating iPhone → comes out clean. Visitor toggles noisy / clean audio | +8.28 dB SNR · \~54 ms on device · 18.9M params |
| Amazon ML Challenge | Data foundry | Business cards from 3 vendors pour into blocking funnels → candidate pairs → glowing match threads ("Pvt Ltd" ↔ "Private Limited") → France arrives as unseen data | 0.971 macro F0.5 · 2.2M S1 entities · ≤45 candidates |
| MARL LLM Router | Server farm | Towers of fast-expensive and slow-cheap LLM servers; request packets fly in; each tower's agent accepts, forwards or defers; a cost-latency curve draws itself above | Agents, servers, goodput (from repo results) |
| StatCalib | Radiology lightbox room | Chest X-ray on a lightbox; the model claims "87% sure"; reliability bars sit off the diagonal → calibration snaps them into line | ECE 0.169 → 0.011 · AUC unchanged 0.784 |

Every hero world ends with a small holo-panel: problem, approach, stack, and buttons to GitHub, demo and the 2D case study.

**EDITH: under construction (special world)**

- Arnav's flagship, shown as a construction site: scaffolding around a half-built holographic core, caution tape in tungsten, sparks from a welding arm, a "COMING SOON" banner.
- Blueprint panels on the scaffolding show the planned architecture in words: wake word, MCP dispatch, sub-agents, undo, watcher. No dates, no promises.
- A progress gauge reads from `projects.json` ("phase 1 of 4"), so Arnav updates it without code.

**Monitor wall (everything else)**

| Column | Projects |
| --- | --- |
| Shipped | Hospital Ops (English → SQL), Options Engine, FX-vol GARCH, Grafana Reporter, tools (CSV uploader, KOL mapper, TaskFlow) |
| Coming soon | TrustLens, AgentGate, Mark-3000, Women-safety AI app, RBAC-based RAG automation, Health AI app, Historic world simulation |

Each monitor shows a looping title card; click it to open a holo-panel (one line, stack, status, link if shipped). Kohli-100 lives in the Cricket World instead.

**Template rule:** non-hero projects all use one diorama template driven by data, so any of them can be promoted later without a custom scene.

## EDITH tab (3D avatar + agent)

A real-time hologram of Arnav stands on the holotable and answers questions about him, with Wassim's chat layout around it.

**Layout**

- Top-left: "Currently building: …" pill (live from KV).
- Top-right: Experience · Resume · LinkedIn links.
- Centre-right: the avatar, life-size-ish, the workshop dimmed behind.
- Bottom: wide chat bar ("Ask about my experience, projects, or skills…") with a red send button; three chips under it: "What are you building?", "Tell me about FireWatch", "Are you open to freelance?".
- Answers stream into a glass panel left of the avatar, each with source chips (e.g. "Experience · Credit Intelligence").

**Avatar pipeline**

1. 4–5 photos of Arnav (front, 45°, side, full body in A-pose).
2. Photo-to-3D in Meshy or Tripo (web apps), with their built-in auto-rig → under 25k triangles.
3. Animations from Mixamo (upload in the browser, download as FBX/GLB): idle, wave on entry, thinking, talking gesture, nod.
4. Compress with the gltf-transform CLI (Draco + KTX2), target ≤ 4 MB. One terminal command, run by Claude Code.
5. Hologram shader: cyan fresnel rim, scanlines, slight flicker, point-cloud assemble on entry (1.2 s).

**States:** idle → (user typing) looks at the chat bar → thinking (while waiting for the first token) → talking gesture (while streaming) → idle. Wave plays once per session.

**Agent (shared with EDITH-lite on the 2D page)**

- Knowledge base: `profile.md`, `experience.json`, `projects.json`, short summaries of each README, `freelance.json`. Chunked and embedded into Cloudflare Vectorize.
- Generation: a Workers AI instruct model, streamed via SSE from a Worker.
- Tools the agent can call: `scrollTo`, `openProject`, `openResume`, `enterWorkshop`, `startFreelanceForm`.
- Guardrails: answers only about Arnav and the site; refuses instructions hidden in user input; never gives phone, address or private details; says "I don't know" and offers the contact form when retrieval is empty.
- Limits: per-IP rate limit (e.g. 20 messages/hour) and a daily cap that falls back to a friendly "EDITH is resting, use the contact form" message.

## Cricket World

A floodlit stadium at night, entered from the bat-and-ball icon: Arnav's love for cricket told through his own photos, his own data projects, and a game visitors can play.

**Stops around the ground** (camera orbits; click a stop to fly there)

| Stop | What's there |
| --- | --- |
| Pavilion | "Why cricket" in Arnav's words: playing, watching, and why Virat Kohli is his favourite player (text only, no Kohli images) |
| Big screen | Arnav's own clips and photos: playing, watching matches. Muted autoplay, tap for sound |
| Scoreboard | Kohli-100 project: the scoreboard ticks 85 → 100 centuries and shows the result of Arnav's binomial hypothesis test, with a GitHub link |
| Poster gallery | Original illustrated cricket posters (no team logos or player likenesses) |
| The crease | Mini game |

**Mini game: "One Over"**

- 6 balls. A bowler (stylised, original) runs in; the visitor times a click, tap or Space to swing.
- Timing window sets the shot: early → leg side, perfect → straight six, late → off side, miss → bowled.
- Ball flight is parametric arcs, not a physics engine, so it runs smoothly on phones.
- Score → optional name → leaderboard (top 10, D1), names passed through a profanity filter and Turnstile.
- Share card: "I scored 22 off one over in Arnav's workshop" with a link back.

**Exit:** a "back to the workshop" gate behind the pavilion returns to the holotable.

## 75 Hard (reels)

Arnav completed 75 Hard; the site shows it through his own selected reels, in a 2D section modelled on Gallery Play's floating-card hero and on a discipline wall in the 3D room.

**2D section (landing, after Experience)**

- Pinned headline in Unbounded 700, centred: **75 DAYS. ZERO DAYS OFF.** Sub-line in Arnav's words.
- 5 vertical reel cards (9:16 posters) float around the headline in 3D perspective, each tilted differently, at different depths. Caption on each card in mono: "Day 23 · 5:00 am".
- Background: a faint grid of 75 squares (Arnav's motif, instead of Gallery Play's map), all crossed out.
- A soft tungsten-to-red heat glow follows the cursor behind the cards.
- Scroll: the headline stays pinned while cards drift past at different speeds (parallax by depth).
- Hover a card: it straightens, scales up 4% and plays its muted loop. Click: full-screen reel player with sound, swipe or arrows for next.
- Mobile: cards become a horizontal swipe strip under the headline.
- Day theme: paper background, cards keep their colour, glow softens.

**3D room: discipline wall (beside the experience whiteboard)**

- A wall calendar with all 75 days crossed out in red marker; click to flip pages showing the rules followed and a "what it taught me" note.
- Three small framed screens loop selected reels (muted). Click a screen to open the same reel player.
- EDITH knows the story, so "what's Arnav like outside work?" gets a real answer.

**Media rules:** Arnav's own reels only, downloaded and hosted as MP4 (H.264, 720p, under 25 MiB each) with a poster image and captions. No Instagram embeds (heavy, third-party tracking). Content lives in `discipline.json`. Before/after photos are optional.

## Retro TV timeline and experience whiteboard

Two objects split the story: the retro TV tells Arnav's life by era; the whiteboard lists his industry experience role by role. Both read from data files.

**Retro TV (front-left corner)**

- A tungsten-lit 1970s-style TV on a side table, with a channel dial and two buttons (Hart Studio's interaction).
- Loader, "time authority" mood with original designs only:
  1. Static hiss → the screen warms to sepia.
  2. A wall clock with several hands spins backwards.
  3. **Ghadi**, an original rubber-hose cartoon clock mascot (Hindi for clock), pops up and says "Let's rewind Arnav's timeline" in a speech bubble.
  4. Title card in Fraunces italic: ARNAV · A TIMELINE.
- Each channel = one era: title card, years, 2–3 lines, one photo. Turn the dial (drag, scroll or arrow keys) to change channel, with static between.
- Content comes from `timeline.json`; Arnav supplies the eras at build time.

**Experience whiteboard (right wall)**

- A large office whiteboard with marker-pen drawing: a timeline arrow left to right, one sticky card per role.
- Click the board: the camera faces it, cards pop forward one by one with a marker-squeak sound (muted by default).
- Each card: company, role, dates, 2–3 impact lines, stack chips. Click a card for detail and links.

| Role (newest first) | Focus |
| --- | --- |
| Credit Intelligence (UAE), AI developer, Oct 2026– | RAG development and AI agents |
| Ticker Ltd, intern | ML, data engineering, internal tooling |
| Datamatics, intern | Shipped a production Ollama semantic model |
| Wingreens World, intern | Chatbots, time-series analysis |

Dates and impact lines are confirmed by Arnav in `experience.json`. Hackathons (SIH, Amazon ML, Paytm) appear as small magnets in the board's corner.

## Transformer corner, notebook, chalkboard

Three interactive props: one that shows how Arnav thinks (transformer), one private (notebook), one public (chalkboard).

**Transformer installation (back-left corner)**

- A floor-to-ceiling 3D transformer: token cubes at the base, an embedding layer, 4 stacked attention blocks, an output head at the top.
- The visitor types a question ("Can he build RAG systems?"). Tokens rise; attention lines light between them; the output head emits 2–3 skill cards (skill, level, evidence project).
- Behind it, the Worker matches the question against `skills.json` by embedding similarity, with an LLM writing the one-line answer.
- A small label says "Illustration: animation is not real model internals", so it stays honest.

**Study table + notebook (back-right corner)**

- Desk lamp, a closed leather notebook with a pen. Click: it opens with a page-flip, the camera tilts down.
- Fields are written on the page in a handwriting font (Caveat): name, email, "what's this about?" (Freelance / Job / Collab / Hello), message.
- Send: the page folds into a paper plane that flies out of the Mumbai window. The message reaches Arnav's inbox by email.
- Turnstile, length limits, and an honest confirmation ("Sent. Arnav replies within a few days").
- Kyoosang's notebook wasn't visible to my fetcher; this is an original design. A screenshot of the part you liked can still refine it.

**Chalkboard (right of the door)**

- Green board; visitors pin a sticky note (4 colours, max 200 characters, optional name).
- New notes go to a pending queue in D1; Arnav approves them on a private `/admin` page behind Cloudflare Access. Only approved notes show.
- Notes sway slightly when hovered; the newest 24 show, older ones in an "archive" drawer.

**Other room props:** Mumbai window (live time, weather, rain), server rack (live GitHub LEDs), cricket shelf, freelance neon sign. All listed in The Workshop table.

## Open to freelance

One status, shown in six places, all driven by one switch in `freelance.json` (`open: true/false`, optional note).

**Where it appears**

| Place | Form |
| --- | --- |
| Nav (2D) | Pill with a pulsing tungsten dot: "Open to freelance" |
| Hero (2D) | Chip under the role line |
| Landing section 8 | Full freelance card + form |
| Workshop | Tungsten neon sign above the door, flickers on |
| Holotable | Neon "open" sign icon |
| EDITH / EDITH-lite | Answers "Are you available?" and opens the form |

When `open` is false, every instance turns grey and reads "Currently booked" (plus the note, e.g. a date).

**Services listed**

- AI automation: agents and workflow automation for repetitive business tasks.
- RAG assistants: chatbots over a company's own documents, with access control.
- Data science: analysis, forecasting, dashboards.
- ML models: training, evaluation and deployment of custom models.

**Form fields:** name, email, company (optional), service (dropdown of the four), timeline (ASAP / 1–3 months / later), budget range (optional), project description. Turnstile protected. Submissions are emailed to Arnav and stored in D1 so nothing is lost.

No rates are shown on the site; Arnav quotes per project.

## Integrations

GitHub, weather, Spotify and email are live; LinkedIn and Instagram are links, because their APIs don't let a personal site read a profile.

| Service | How it connects | Refresh | Shown where |
| --- | --- | --- | --- |
| GitHub | Worker cron calls the GitHub API with a read-only fine-grained token (REST for repos, GraphQL for the contribution calendar), caches JSON in KV | Every 6 h | Landing "GitHub live", holotable GitHub window, server-rack LEDs, project stars |
| LinkedIn | Profile link + "View on LinkedIn" buttons. Experience is typed once into `experience.json` | Manual | Nav, hero, footer, EDITH header, whiteboard cards |
| Instagram | Profile link only | — | Hero icon row, footer |
| Resume | `resume.pdf` in static assets, versioned filename | On deploy | Nav button, holotable, EDITH, footer |
| Weather (Mumbai) | Open-Meteo API (free, no key), cached in KV | Every 30 min | Holotable widget, window rain |
| Spotify now playing | Spotify Web API with Arnav's refresh token stored as a Worker secret | Every 60 s while open, cached | Holotable widget |
| Email | Cloudflare Email Routing "send email" binding to Arnav's verified address | Per message | Notebook, freelance form, contact form |
| Bot protection | Cloudflare Turnstile on every form and on EDITH's first message | — | All inputs |
| Analytics | Cloudflare Web Analytics (cookie-free) + custom events into D1 (workshop entered, world opened, game played) | — | Private `/admin` page |

**Email limit to know:** on the free plan a Worker can only send to verified addresses in Arnav's account. Messages to his own inbox are free; an automatic reply to the visitor would need Workers Paid, so the site shows an on-screen confirmation instead.

Sources: [Email sending](https://developers.cloudflare.com/email-routing/email-sending/)

## Architecture and Cloudflare deployment

The whole site runs on Cloudflare's free plan, on Arnav's own domain: one Worker serves the static site and the API, with D1, KV, Vectorize and Workers AI behind it.

**Stack**

- **Frontend:** Astro (static, fast, good SEO for the 2D landing) with React islands; the workshop is a separate `/workshop` route that lazy-loads React Three Fiber, drei, postprocessing, GSAP and Lenis.
- **API:** Hono running in the same Worker (`/api/*`).
- **Data:** D1 (notes, messages, leaderboard, events), KV (GitHub, weather, Spotify caches, "currently building", freelance flag), Vectorize (EDITH knowledge base), Workers AI (chat + embeddings).
- **Media:** clips encoded to stay under 25 MiB per file so they ship as free static assets.

&#91;embedded content: Architecture · one Worker, five bindings\]

The browser only ever talks to one origin; the Worker reaches every Cloudflare service through bindings and calls outside APIs only from cron.

**Free-plan limits we design around**

| Service | Free allowance | Our use |
| --- | --- | --- |
| Workers requests | 100,000/day, 10 ms CPU per request | API only; waiting on AI/fetch doesn't burn CPU |
| Static assets | Free and unlimited requests; 25 MiB per file, 20,000 files | Whole site, models, clips |
| Workers KV | 100,000 reads, 1,000 writes per day, 1 GB | Caches written by cron, read by pages |
| D1 | 5M rows read, 100,000 written per day, 5 GB | Forms, notes, leaderboard, events |
| Vectorize | 30M queried, 5M stored vector dimensions per month | A few hundred chunks |
| Workers AI | 10,000 Neurons per day, reset 00:00 UTC | EDITH chat + embeddings, with a daily cap and fallback |
| Email sending | Free to verified addresses | Forms → Arnav's inbox |

**Custom domain setup (one time)**

1. Add the domain to a free Cloudflare account and switch the registrar's nameservers to Cloudflare. Email Routing and Worker custom domains need Cloudflare DNS.
2. Create the Worker and attach the apex domain and `www` as custom domains (HTTPS is automatic).
3. Enable Email Routing and verify Arnav's inbox as a destination address.
4. Create a Turnstile widget for the domain; store keys as Worker secrets.
5. Enable Web Analytics for the domain.
6. Protect `/admin` with Cloudflare Access (Arnav's email only).

**Deploy flow:** GitHub repo → Workers Builds on every push to `main` → preview URL per branch. Secrets (GitHub token, Spotify refresh token, Turnstile secret) live in Wrangler secrets, never in the repo.

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits) · [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/) · [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

## Loading states and alerts

Every wait shows real progress and says something about Arnav's work; nothing is a generic spinner. All loaders show a true percentage where one exists, finish in under 300 ms once loaded, and collapse to a plain progress bar with reduced motion.

**Loaders by place**

| Where | Loader | Copy (mono HUD) |
| --- | --- | --- |
| First visit | ARNAV-OS boot: typewriter system lines, CRT wipe out | `[ OK ] rag.sys` · `[ OK ] agents.drv` · `[ !! ] chai.sys … low` |
| 2D page transitions | Thin `--action` pill bar across the top + a 250 ms curtain wipe in `--surface` | — |
| Images and cards | Skeleton blocks with a slow scanline sweep, not grey pulses | — |
| Workshop entry | Photo dissolves to particles that assemble into the wireframe brain as assets load | `loading neural pathways · 64%` |
| Holotable | Wireframe Earth draws its graticule line by line, then spins to Mumbai | `locking coordinates · 19.07° N` |
| Project World | Portal ring spins up; a fake build log prints lines from the real stack | `compiling world · pytorch · esp32-cam · 81%` |
| FireWatch world | Smoke clears as a detection box sweeps the frame | `p_fire 0.12 → loading scene` |
| SIH world | A noisy waveform cleans itself left to right as the bar fills | `denoising · +8.28 dB` |
| Amazon world | Business cards shuffle into sorted stacks | `blocking candidates · 2.2M` |
| MARL world | Packets route between three server towers | `routing requests · agents online 3/3` |
| StatCalib world | Reliability bars slide onto the diagonal | `calibrating · ECE 0.169 → 0.011` |
| EDITH | Point cloud assembles into the avatar; ring pulses on each chunk | `establishing link · EDITH` |
| Cricket World | Floodlights switch on one tower at a time | `floodlights 3/4` |
| Retro TV | Static snow, then Ghadi's clock hands spin back | `rewinding timeline` |
| 75 Hard | Calendar days tick from 1 to 75 with the load | `day 42 / 75` |
| Chat thinking | Three dots that become streaming tokens | `thinking…` |

**Alerts and toasts**

- HUD-style toasts, bottom-centre (top on mobile): pill shape, 1px `--line` border, mono label, icon, auto-dismiss in 4 s, pausable on hover, announced via `aria-live`.
- Success (`--ok`): "Message sent. Arnav replies within a few days." with the paper-plane animation.
- Warning (`--time`): "EDITH is resting for today. Use the contact form." (daily AI cap).
- Error (`--action`): what went wrong and what to do ("Couldn't send. Check your connection and try again."), never a raw error code.
- Offline banner when the network drops; forms keep their text.
- Low-power notice the first time quality is lowered: "Switched to lighter 3D for this device." (change in Settings).

**Error pages:** 404 is a one-ball cricket moment: a bowler delivers, the stumps fly, "BOWLED. This page doesn't exist." with buttons back to the site and the workshop. 500 shows the ARNAV-OS screen with `[ !! ] something broke · retrying` and a reload button.

## Performance, accessibility, mobile

The 2D site must feel instant; the 3D loads only on request and scales itself down on weak devices.

**Budgets**

| Area | Target |
| --- | --- |
| Landing LCP | < 2.0 s on mid-range phone, 4G |
| Landing JS | < 120 KB gzipped before interaction (chat widget lazy-loaded on click) |
| Layout shift (CLS) | < 0.05 |
| Workshop first load | ≤ 8 MB total (room, props, avatar loads later) |
| Each world (projects, cricket) | ≤ 6 MB, loaded on entry |
| Frame rate | 60 fps desktop, 30 fps floor on phones |
| Draw calls | < 150 per frame in the room |

**Techniques:** code-split per world; Draco + KTX2; instanced meshes for repeats (monitors, cards, particles); drei `PerformanceMonitor` lowers DPR, shadows and post-processing when fps drops; textures ≤ 2K; preload the next likely world while the visitor reads.

**Loading screens:** themed per area (ARNAV-OS boot for the site, brain particles for the workshop, Earth for the holotable, static TV snow for the timeline), each with a real progress percentage.

**Accessibility**

- Everything in 3D also exists in the 2D site; the workshop HUD zone list makes every hotspot reachable by keyboard and screen reader.
- Visible focus rings (2 px `--holo`), skip links, logical tab order.
- EDITH answers announced via `aria-live="polite"`.
- Captions on clips; alt text on every image; text contrast ≥ 4.5:1 in both themes.
- Reduced motion: no boot sequence, fades instead of flies, no camera shake, no flicker.

**Mobile:** hotspot navigation by tap (no free-roam), quality starts at low and climbs if the device keeps up, windows become full-screen sheets. No WebGL or very low memory → the workshop button opens a still-image tour with the same content.

## Content model: how Arnav updates the site

All content lives in a `content/` folder of plain files; the 2D site, the 3D worlds and EDITH's knowledge base all read from them. Change a file, push, and the site redeploys.

| File | Holds |
| --- | --- |
| `site.json` | Name, role line, location, socials (LinkedIn, GitHub, Instagram, email), resume filename |
| `profile.md` | Long bio in Arnav's words (EDITH's main source) |
| `experience.json` | Roles: company, title, dates, impact lines, stack |
| `projects.json` | Every project (schema below) |
| `skills.json` | Skills by layer, level, evidence project |
| `timeline.json` | Retro TV eras: title, years, lines, photo |
| `cricket.json` | Cricket story text, clips, poster list |
| `freelance.json` | `open`, note, services |

**One project entry**

```json
{
  "id": "firewatch",
  "name": "FireWatch",
  "oneLiner": "IoT fire and gas detection with edge inference and agentic alerts",
  "status": "shipped",
  "tier": "hero",
  "heroScene": "firewatch",
  "order": 1,
  "stats": ["95.75% fire recall", "~23 ms local inference"],
  "stack": ["PyTorch", "MobileNetV3", "ESP32-CAM", "AWS Lambda"],
  "links": { "github": "https://github.com/Arnav-3012/fire-detection-model-dl", "demo": null },
  "progress": null
}
```

- `tier`: `hero` (custom 3D world), `diorama` (shared template), `wall` (monitor wall only).
- `status`: `shipped`, `building`, `coming-soon`. `progress` (e.g. "phase 1 of 4") drives EDITH's under-construction gauge.
- Swapping a hero: change `tier`. A project with no custom scene automatically falls back to the diorama template.

**Live values without a deploy:** "Currently building" and the freelance switch are also editable on the private `/admin` page (written to KV), alongside note moderation and the message inbox.

**EDITH re-index:** `npm run kb:build` chunks `content/` + README summaries and re-embeds them into Vectorize; it runs automatically on deploy.

**Also in `content/`:** `discipline.json` (75 Hard: headline, sub-line, reels with file, poster, day, caption, featured flag), and an optional `sound` object on projects and room objects (`{ "src": "/audio/fire.mp3", "positional": true, "radius": 6 }`) used from Phase 5.

## Assets needed from Arnav

Everything below is supplied at build time; the build starts with placeholders so nothing blocks Phase 1.

**Photos and video**

- [ ] Landing portrait: done: side profile facing right, grey background, black tee. Still needed: upscale to at least 2400 × 3000 px; try a remove.bg cutout, and if the flyaway hair looks jagged, keep the grey background and fade it into the page colour
- [x] 4–5 avatar photos: front, 45°, side, full body in A-pose, even light, plain background: 6 in `assets/incoming/avatar/` (01–04 views, 05 face close-up, 06 A-pose)
- [x] 3–5 cricket photos or clips of you playing or watching (each clip under 25 MiB): 2 photos + 3 clips in `assets/incoming/cricket/`
- [x] One photo per timeline era: `assets/incoming/timeline/01`–`07`

* [x] 5 selected 75 Hard reels (MP4, under 25 MiB each) with a one-line caption for each: `assets/incoming/75hard/` (day numbers 01–05 are placeholders, not real days)
* [ ] Rules you followed and a "what it taught me" note for the calendar

**Text and data**

- [x] `experience.json`: dates and 2–3 impact lines per role (Credit Intelligence, Ticker, Datamatics, Wingreens World, plus Absolute Wear), taken from the Oct 2026 resume
- [x] `timeline.json`: the eras of your life for the Retro TV
- [x] `profile.md`: a long bio in your words for EDITH
- [x] One line each for the RBAC-based RAG automation (generic description if it's company work) and the women-safety AI app
  - RBAC-based RAG automation: "RAG with role-based access control, so every answer only draws on documents the asker's role is allowed to see"
  - Women-safety AI app: "Smart, AI-powered women's safety app, built end to end"
- [ ] "Why cricket" paragraph
- [x] Resume PDF: `assets/incoming/resume/arnav-resume-2026-10.pdf`

**Accounts and keys**

- [ ] Custom domain name + registrar login (to point nameservers to Cloudflare)
- [ ] Cloudflare account (free)
- [ ] GitHub fine-grained token, read-only on public repos
- [ ] Spotify developer app + refresh token (optional; widget hides without it)
- [ ] Meshy or Tripo account for the avatar and hero props; Mixamo (free Adobe account) for animations

**Optional refinements**

- [ ] Screenshot or screen recording of the Kyoosang notebook part you liked

## Build phases

Phase 1 ships a complete, recruiter-ready site on the custom domain; each later phase adds 3D on top without blocking it.

&#91;embedded content: Build roadmap · 4 phases, 4 gates\]

**Acceptance per phase**

- [ ] Phase 1: every landing section filled from `content/`, both themes pass contrast, forms reach the inbox, EDITH-lite answers from the knowledge base, deployed on the domain with HTTPS.
- [ ] Phase 2: brain dive works on desktop and phone, day/night follows Mumbai time and the D key, every hotspot reachable from the HUD list, holotable intro skippable.
- [ ] Phase 3: FireWatch and Amazon worlds first, then SIH, MARL, StatCalib; EDITH site and monitor wall read from `projects.json`; avatar chat streams with states.
- [ ] Phase 4: every room object live, chalkboard moderation via `/admin`, game leaderboard, reduced-motion and keyboard paths verified.

**Phase 5 · Media and sound (after launch)**

- [ ] More reels across the site (75 Hard, cricket, project demos), self-hosted MP4.
- [ ] Proximity audio with three.js positional audio: FireWatch fire crackle grows as the camera nears, server-rack hum, rain louder near the window, crowd noise in the Cricket World, waveform audio in the SIH world.
- [ ] Background music: royalty-free tracks or Arnav's own only (no copyrighted songs), with a now-playing chip and per-area tracks.
- [ ] UI sounds: hover ticks, marker squeak, paper plane, TV static.

**Built now so Phase 5 is drop-in:** one `AudioManager` (single AudioContext, master/music/sfx volumes, muted by default, respects the Settings sound toggle and pauses when the tab is hidden), and an optional `sound` field on every project and room object in `content/`. Phases 1–4 call it with no files attached.

Next step: turn this spec into the Claude Code build prompt, starting with Phase 1.
