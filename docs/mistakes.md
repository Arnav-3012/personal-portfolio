# Mistakes and wrong turns

Newest first. Read before every task. A repeat is marked REPEAT and strengthens the earlier rule.

---

## 2026-10-19 · 2.3 (entry sequence) · Smaller wrong turns (caught by tests and screenshots)
- **Public file nearly over the HTML budget:** adding Arnav's resume made the Resume links render in four places and pushed the landing HTML to 14,292 B (budget 14,200). Fix: the long `file-text` icon, unique and repeated, was replaced by the small arrow icon the page already uses (14,197 B). **Rule:** a file that switches on markup (the resume) must be added with a build, not assumed neutral; the budget has about 3 bytes left, so any new landing markup must be built in JavaScript.
- **Test races, three times:** pressing Escape before the overlay had loaded, and pressing the skull right after "back" before the hotspot had re-initialised. The product was fine; the tests now wait for `.ent` and for the brain link. **Rule:** after any navigation or click that starts lazy work, wait for the thing the next step needs.
- **Day globe too faded:** the first Day render used the Night alpha values, so thin dots on paper looked washed out. Day now has a tinted sphere body, a dark limb, bolder dots and a stronger graticule. **Rule:** check every colour-dependent drawing in both themes by screenshot before saying it works.
- **Label on busy dots:** the Mumbai label and readout sat directly on white dots; both got a translucent plate.
- **Generated file reformatted:** re-running the bake script rewrote `land-mask.ts` unformatted and failed `format:check`; it is now in `.prettierignore`.
- **Third-party asset sources:** SVG Repo answered with a bot check (HTTP 429). I did not work around it; Wikimedia Commons' API gave licence metadata per file, so the brain comes from there (CC0).
- **Files:** `src/lib/enter-sequence.ts`, `tests/e2e/enter.spec.ts`, `src/components/landing/Hero.astro`, `src/components/landing/Nav.astro`, `.prettierignore`

## 2026-10-19 · 2.1+2.2 (motion pass, workshop entry) · Smaller wrong turns (caught by targeted tests and screenshots)
- **Unit tests used the real token:** the Worker tests load `.dev.vars`, so after I added the self-fill to `/api/github` an "empty cache" test made a real GitHub call with Arnav's token. The data tests now stub `fetch` and clear the retry markers first. **Rule:** any test that can reach the network must stub it, because the test environment holds real secrets.
- **`hidden` beaten by `display`:** the "Try anyway" button stayed visible after being hidden because `.button` sets `display`. The page now scopes `[hidden] { display: none }`.
- **Reduced motion and animation delay:** staggered list items sat at opacity 0 during their delay even with reduced motion, because only the duration was shortened. Reduced motion now sets `animation: none`.
- **Selector starting with a digit:** `#75-hard` is not a valid selector; tests use `[id="75-hard"]`.
- **macOS `sed -i`:** it needs an empty suffix argument, and the failed call silently left a test unchanged. Edits go through Python.
- **Rows clipped on entry:** rows sliding in from the left lost their first letters to the scroll box. They slide in from the right.
- **Local production commands:** `wrangler deploy` is blocked from this session, and a command that would handle Arnav's token was declined. The deploy and the token steps are Arnav's commands, given as a copy-paste block.
- **Files:** `worker/data.ts`, `tests/unit/worker/data.test.ts`, `src/pages/workshop.astro`, `tests/e2e/workshop.spec.ts`, `src/styles/dynamic.css`, `src/lib/dynamic.ts`

## 2026-10-18 · 1.8+1.9 · REPEAT: Unicode escapes written as raw line separators (again)
- **What happened:** `tsc` failed on `worker/guard.ts` ("Unterminated regular expression literal"). The control-character regex I wrote through the file tool contained the real U+2028/U+2029 characters.
- **Root cause:** the earlier rule said to write them as escapes, but I wrote the regex the same way again and relied on the typecheck to catch it. The rule did not say what to write instead.
- **Fix:** replaced them with escapes, then removed the regex altogether: `cleanText()` in `worker/guard.ts` filters by char code, so no invisible character appears in source and ESLint's `no-control-regex` has nothing to flag.
- **Prevention rule:** Never put control or separator characters in a regex literal; filter by char code in a small helper, and `grep -P '\x{2028}|\x{2029}'` after writing any file that mentions them. (Strengthens the 1.6+1.7 rule.)
- **Files:** `worker/guard.ts`, `worker/admin.ts`

## 2026-10-18 · 1.8+1.9 · A random branch crashed the request it was meant to tidy up after
- **What happened:** a chat test failed one run in about fifty ("expected 'Here it is.', received ''"), and passed when rerun.
- **Root cause:** I pruned old `chat_events` rows on 2% of requests with `c.executionCtx.waitUntil(...)`. Outside a real Worker there is no execution context, so Hono throws; the throw sat inside the "limits unavailable" `try`, which answers 503. Production has a context, so only tests saw it, and only 2% of the time.
- **Fix:** `pruneInBackground()` wraps the access, the delete's own failure is swallowed, the odds are the exported `PRUNE_ODDS`, and tests cover the prune SQL directly plus a run with `Math.random` forced to 0. The suite ran 8 times clean.
- **Prevention rule:** Code behind `Math.random()` gets a test that forces the branch, and optional background work (`waitUntil`) must never be able to fail the request it follows.
- **Files:** `worker/chat.ts`, `tests/unit/worker/chat.test.ts`

## 2026-10-18 · 1.8+1.9 · Panel CSS pulled into the landing HTML (15,307 B against a 14,200 B budget)
- **What happened:** `pnpm build` failed the HTML budget right after adding the chat panel.
- **Root cause:** I put the panel styles in a CSS file imported by the lazily loaded module. Astro treats CSS reachable from a page script as page CSS and inlined 3.7 KB of it into `index.html`, although the JS itself stayed a separate chunk.
- **Fix:** `import panelCss from '../styles/edith.css?inline'` and inject a `<style>` when the panel first opens. HTML is 14,099 B again.
- **Prevention rule:** Styles for anything loaded on interaction go in through `?inline` (or are built in JS); after adding any import to a landing script, run `pnpm build` before writing tests.
- **Files:** `src/lib/edith-ui.ts`, `src/styles/edith.css`

## 2026-10-18 · 1.8+1.9 · Retrieval threshold chosen before measuring scores
- **What happened:** I had planned `MIN_SCORE = 0.5` as the off-topic gate. A live probe showed bge scores are compressed: relevant questions scored 0.53 to 0.75 and off-topic ones up to 0.58, so no threshold separates them. Broad questions ("where has he worked?") also missed the role chunks.
- **Root cause:** I assumed cosine scores spread the way they do in textbooks and did not measure first.
- **Fix:** the threshold is only a floor (0.45) that saves Neurons; refusing off-topic questions is the system prompt's job (scripted refusal, checked live). Chunks are embedded with their source label, and overview chunks (all roles, all projects by status, core skills) answer broad questions.
- **Prevention rule:** Probe a retrieval index with a dozen real and off-topic questions and read the scores before picking any constant that depends on them; test broad questions, not only single-fact ones.
- **Files:** `worker/chat.ts`, `src/lib/kb-chunks.ts`, `scripts/kb-build.ts`

## 2026-10-18 · 1.8+1.9 · Source chips chosen by retrieval score cited unrelated chunks
- **What happened:** live, "where has Arnav worked?" cited "Freelance" and "Contact", and the France refusal cited "How I got here".
- **Root cause:** I treated "retrieved" as "used". Chips came from the top matches, not from what the answer said.
- **Fix:** `usedSources()` keeps chunks that share at least three distinctive words with the final answer (best first, at most two).
- **Prevention rule:** Cite a source only if the answer demonstrably draws on it; check the chips on a broad question and a refusal.
- **Files:** `worker/guard.ts`, `worker/chat.ts`

## 2026-10-18 · 1.8+1.9 · Entrance fade made axe read the wrong colours
- **What happened:** axe reported 2.5:1 contrast on the "Ask EDITH" launcher and on the panel, in two older landing axe tests that were passing before.
- **Root cause:** the launcher faded in from `opacity: 0`, and axe measured while it was mid-fade. The text colours were fine; the scan ran at the wrong moment.
- **Fix:** the launcher's entrance is transform-only, so contrast is correct from the first frame; the panel specs wait for finite animations to end before scanning.
- **Prevention rule:** Entrance animations on text use transform only, never opacity from 0; axe scans wait for finite animations.
- **Files:** `src/styles/global.css`, `tests/e2e/edith.spec.ts`

## 2026-10-18 · 1.8+1.9 · Smaller wrong turns (caught before review)
- **Output filter after streaming:** the first stream sent raw tokens and filtered only the final text, so a phone number would have been visible live. Fixed in design: tokens leave one filtered sentence at a time.
- **Focus stolen:** after a send the panel refocused its own input, undoing "take me to the freelance form". It now refocuses only if nothing else took focus.
- **`<header>` inside the dialog** counted as a second banner landmark (axe `landmark-no-duplicate-banner`); it is a `div`.
- **Dialog `max-width`:** the browser default clamped the phone sheet to 360 of 375 px; `max-width: none`.
- **Phone tool calls:** the sheet closed to show the scrolled page and the reply vanished; a toast now says how to return and the conversation is kept.
- **Stale cache after admin edits:** `/api/live` stored its edge-cache entry in `waitUntil`, which could land after the admin's cache delete and bring the old state back (a flaky e2e in the next spec). The put is awaited.
- **Generated types:** `wrangler types` read secret names from my local `.dev.vars` and made them required; reverted to what CI would generate (only `ADMIN_EMAILS` added).
- **Token handling:** I tried to print the Cloudflare OAuth token to read its scopes; the permission check blocked it, rightly. `kb:build` uses Wrangler's own bindings (`getPlatformProxy`) so no token passes through me.
- **Contrast of system colours:** `GrayText` on white is 3.94:1; muted admin text is `CanvasText` mixed with `Canvas`.
- **Prevention rules:** one repeated pattern, "run the check that would have caught it before writing the next thing", applied: typecheck after the first guard file, build after the first landing import, a live probe before constants.
- **Files:** `worker/chat.ts`, `worker/live.ts`, `src/lib/edith-ui.ts`, `worker-configuration.d.ts`, `worker/admin-page.ts`

## 2026-10-18 · 1.6+1.7 · REPEAT: a count typed from memory (365 cells, not 371)
- **What happened:** the new "real endpoint feeds the section" e2e test expected 371 heatmap cells; the fixture it loads has 365. Caught when I counted the fixture, before the run, not by a failure.
- **Root cause:** same as the 1.5cd entry: I wrote the number I "knew" (53 weeks × 7) instead of reading it. The last week holds one day, so 53 × 7 is wrong.
- **Fix:** the test reads `tests/e2e/fixtures/github.json` and compares with `weeks.flat().length` and the repo names from the file.
- **Prevention rule:** When a test loads a fixture, compute every expected count and name from that fixture. (Strengthens the rule under "expected values written from my head".)
- **Files:** `tests/e2e/github-live.spec.ts`

## 2026-10-18 · 1.6+1.7 · Two e2e tests relied on an endpoint that did not exist yet
- **What happened:** after the Worker gained `/api/github`, two GitHub tests (fallback and axe) failed: they expected the unmocked real endpoint to 404, and it now answers 200 from the seeded KV.
- **Root cause:** in 1.5cd I wrote "No route: the real Worker answers with its JSON 404" and labelled the test "before task 1.7". The test's premise was the missing backend, so building the backend was bound to break it.
- **Fix:** the fallback tests stub the 404 the Worker sends while KV is empty (`notReady`); a new test covers the real endpoint with nothing mocked.
- **Prevention rule:** Never let a test depend on an endpoint being absent. Stub the absent or empty case explicitly, and grep tests for "before task" / "No route" when a task builds a backend.
- **Files:** `tests/e2e/github-live.spec.ts`, `tests/e2e/freelance-contact.spec.ts`

## 2026-10-18 · 1.6+1.7 · A JSON round trip reformatted unrelated lines
- **What happened:** adding `turnstileSiteKey` to `content/site.json` with a Python `json.dump` also expanded the `boot.tokens` array and changed 19 lines. Seen in `git diff --stat` right after.
- **Root cause:** I treated the file as data to re-serialise instead of text to edit; the dump ignores the hand-chosen layout (same family as "Prettier rewrote hand-written docs").
- **Fix:** `git checkout content/site.json`, then one inserted line via a text replace (1 line changed).
- **Prevention rule:** Edit hand-formatted JSON and Markdown as text (insert or replace a line); never parse and re-dump them. Check `git diff --stat` after any scripted edit.
- **Files:** `content/site.json`

## 2026-10-18 · 1.6+1.7 · Unicode escapes written as raw line separators
- **What happened:** `worker/email.ts` failed to parse ("Unterminated regular expression") and took down every Worker test, including the old health tests.
- **Root cause:** I wrote `\u2028` and `\u2029` in a regex through the file tool, which stored the actual U+2028/U+2029 characters. JavaScript treats those as line terminators, so the regex literal ended early.
- **Fix:** replaced them with the six-character escapes; `grep -P` for U+2028/2029 across `worker src tests` is now empty.
- **Prevention rule:** Write invisible or special characters (U+2028/2029, zero-width, bidi) only as escapes, and run the test file that imports the module straight after creating it.
- **Files:** `worker/email.ts`

## 2026-10-18 · 1.6+1.7 · Idle Turnstile slot added a stray grid gap
- **What happened:** the first 375 px form screenshot showed a taller gap above the submit button than between fields. No test failed; only the screenshot showed it.
- **Root cause:** the empty `[data-turnstile]` div became a grid item in `.form`, and the grid `gap` applies to it even at zero height.
- **Fix:** `.form [data-turnstile] { display: contents; }` plus an e2e assertion on the computed display; re-screenshotted at 375, 768 and 1440 in both themes.
- **Prevention rule:** An empty placeholder inside a grid or flex container still costs a gap: give it `display: contents` (or no box) and look at the screenshot before moving on.
- **Files:** `src/styles/global.css`, `tests/e2e/freelance-contact.spec.ts`

## 2026-10-18 · 1.6+1.7 · GitHub skeleton 320 px, loaded block up to 652 px (layout shift, flaky tilt test)
- **What happened:** one early e2e run failed 1 of 270 and I logged it as "unexplained"; you then hit `beyond.spec.ts › tilts toward the pointer and settles back`. Repeating that test 40 times with 4 workers reproduced it (`--ry` set, `--rx` empty a moment later).
- **Root cause:** the GitHub section sits right above the Beyond tiles. Its skeleton was a flat 320 px, but the loaded block is 652 px below 768 px, about 420 px up to 1099 px and about 358 px above. When data arrived the tiles jumped 332 / 99 / 38 px and left the stationary pointer. The shift existed since 1.5d but stayed hidden while the endpoint 404'd (the section shrank instead of growing); the seeded real endpoint exposed it. I should have chased the first unexplained failure instead of logging it and moving on.
- **Fix:** skeleton heights 640 / 420 / 350 px at the existing 768 and 1100 px breakpoints; a regression test at 375 / 768 / 1440 px (the section below moves < 30 px; it fails on the old skeleton with 332 / 99 / 38); the tilt test waits for `#github` to settle before measuring. 40 repeats with 4 workers now pass, and the full suite passed 273 of 273.
- **Prevention rule:** A skeleton must be sized to the loaded block at every breakpoint, and any failure with no captured name gets reproduced (`--repeat-each` under load) before the task is called done, never logged as "unexplained". When a backend lands, rerun the whole e2e suite twice, since a real response can expose layout shifts that an error state hid.
- **Known gap:** on a failed fetch the section still shrinks from the skeleton to the one-line fallback (rare path, accepted).
- **Files:** `src/components/landing/GithubLive.astro`, `tests/e2e/github-live.spec.ts`, `tests/e2e/beyond.spec.ts`

## 2026-10-18 · 1.6+1.7 · Smaller wrong turns (caught before review)
- **Test race:** asserted the Turnstile reset count right after the request arrived, but the reset runs after the response. Fix: `expect.poll`. Rule: assert on effects that happen after a response with a polling expectation.
- **Console spy:** `vi.spyOn(console, 'warn')` then `expect(console.warn)` failed in workerd ("not a spy"). Fix: keep the spy reference and assert on it.
- **Unformatted fixture:** `github.json` written minified failed `format:check`. Fix: `prettier --write` the generated file.
- **zsh quirk:** an unquoted `=====` in `echo` is parsed as command expansion. Quote echo labels.

## 2026-10-18 · 1.5cd (footer redesign) · An oversized child stretched the whole grid
- **What happened:** the first footer screenshot had the "Based in" column, the "Back to top" link and the end of the bottom line cut off at the right edge, at every width; the giant ARNAV wordmark itself was also clipped.
- **Root cause:** `.foot__inner` was a one-column grid with an implicit `auto` track, and the wordmark's own width (24vw × 5 letters, wider than the screen) stretched that track past the container, so every sibling was laid out on a wider canvas and clipped by `overflow: hidden`.
- **Fix:** `grid-template-columns: minmax(0, 1fr)` on the footer grid, wordmark sized to fit (`min(19vw, 300px)`), `white-space: nowrap; overflow: hidden` on the wordmark.
- **Prevention rule:** In a CSS grid or flex column, give the track `minmax(0, 1fr)` whenever any child can be wider than the container (huge type, long strings, images), and screenshot the footer at 375, 768 and 1440 px before reading any other detail.
- **Files:** `src/components/landing/Footer.astro`

## 2026-10-18 · 1.5cd · The landing HTML crossed Lighthouse's first-flight cliff (LCP 1956 → 2107 ms)
- **What happened:** after the batch, e2e (240/240), axe and the link check all passed, but `pnpm lhci` failed: LCP 2107 ms against the 2000 ms budget, and accessibility 97 (evidence links 14 px tall). The LCP element (the hero portrait) was untouched.
- **Root cause:** three separate things.
  1. I set the About quote in Fraunces (the era font). Browsers fetch a font as soon as any text uses it, even offscreen, so a 23 KB download competed with the hero image. Fixed by using the loaded body font; the era font is now opt-in per page (`era` prop on `Base.astro`), which also removes its `@font-face` block from the landing HTML.
  2. The compressed HTML went from 13.9 KB to 15.4 KB. Lighthouse's mobile model sends about 14.6 KB in the first round trip, and any more costs another ~150 ms (one RTT): bisecting showed every variant at or under 14.4 KB gave 1956–1959 ms, the full page 2107 ms. Only a section-by-section bisect found it, because the e2e and axe suites don't measure bytes.
  3. Evidence links were 14 px tall (WCAG 2.2 target size); they now have a 24 px hit area, and only core skills show evidence.
- **What did not work (reverted, no measured benefit):** deferring the new `init*` calls to idle time, and `content-visibility: auto` on the new sections, both left LCP at 2107 ms. `scopedStyleStrategy: 'class'` saved 138 B, not worth the churn. I added speculative performance changes before measuring what drove the number.
- **Fix:** the reel player dialog (1.5b) is now built by `playerMarkup()` in `src/lib/reels.ts` at load, not server-rendered (−580 B; Arnav approved this deviation); new sections use global BEM-prefixed styles so their elements carry no scope attribute; the `<noscript>` style tags became a `data-js` flag; `scripts/check-html-budget.ts` runs after every build and fails above 14,200 B gzipped. Result: HTML 13.9 KB, LCP 1958 ms, Lighthouse 99/100/100/100.
- **Prevention rule:** Keep the landing HTML under 14.2 KB gzipped (the build checks it); build interaction-only markup in JavaScript instead of server-rendering it; bisect a performance regression by removing sections before trying fixes; never ship text in a font the page did not already load.
- **Files:** `scripts/check-html-budget.ts`, `package.json`, `src/lib/reels.ts`, `src/lib/icons.ts`, `src/components/landing/ReelPlayer.astro`, `src/components/Icon.astro`, `src/layouts/Base.astro`, `src/pages/design.astro`, `src/components/landing/{Skills,Freelance,GithubLive,BeyondCode,Contact,Footer}.astro`, `src/styles/global.css`

## 2026-10-18 · 1.5cd · Background wait loops that waited on themselves
- **What happened:** I wrote `until ! pgrep -f bisect.py` as a wait loop; the loop's own command line contains "bisect.py", so `pgrep` always found it and five waiters hung until I killed them (the "failed, exit 144" notices).
- **Root cause:** `pgrep -f` matches the full command line of the waiting shell too.
- **Fix:** wait on the output file's contents or a known final line instead.
- **Prevention rule:** Wait for a background job on its output (a line or a file), never with `pgrep -f` on a string that appears in the waiting command.
- **Files:** none

## 2026-10-18 · 1.5cd · Visual problems only the screenshots showed (six in one batch)
- **What happened:** the first full set of screenshots showed: the cricket photo cropped to trees and brick with the batter cut off; the two Beyond code titles at different heights (the grid stretched the image row); the contact email breaking mid-word ("gmai / l.com") at 768 px and ("gmail.co / m") at 375 px; the philosophy quote 7 lines tall in a squeezed column at 768 px; the GitHub heatmap filling only 60% of the width at fixed 12 px cells; and a month label dropped (Nov) while a partial first month (Oct) was kept.
- **Root cause:** I set `object-position`, column splits and font sizes from imagination instead of from the source image and the real text widths. Every e2e assertion passed (92/92), because none of them measure how something looks.
- **Fix:** a `position` focal point in `cricket.json` (content, not CSS); `grid-template-rows: auto 1fr` with a bottom-pinned link; a smaller email size at each breakpoint; the intro splits into two columns only from 1024 px; a fluid heatmap grid (`minmax(0,1fr)` columns, square cells, 15 px minimum so a phone scrolls); crowded month labels keep the later month.
- **Prevention rule:** Open the source photo before choosing a crop and store the focal point in content; test every long unbreakable string (email, URL) at 375 and 768 px; never call a visual task done before reading the screenshots.
- **Files:** `content/cricket.json`, `src/lib/content.ts`, `src/lib/landing.ts`, `src/lib/github.ts`, `src/components/landing/{BeyondCode,Contact,Skills,GithubLive}.astro`

## 2026-10-18 · 1.5cd · REPEAT: expected values written from my head (five times, see 1.6+1.7)
- **What happened:** four tests failed on values I had guessed: `(-0).toFixed(2)` is `"0.00"` so the expected `-0` was wrong; `Intl` `en-GB` prints September as "Sept", not "Sep"; a dock neighbour at 110 px scaled to 1.097, not "above 1.1"; my month-label fixture put Oct one column after Sep, which the crowding rule drops by design.
- **Root cause:** I wrote the expectation from the intended behaviour and never evaluated it first (same cause as the 1.5b entry "Several of my own assertions checked the wrong thing"). The `Intl` one is also environment-dependent: ICU versions disagree on short month names.
- **Fix:** corrected each expectation after printing the real value; month names come from a fixed table (`src/lib/dates.ts`), not `Intl`.
- **Prevention rule:** Evaluate an expected number or string once (node REPL or a throwaway test) before committing it to a test; use fixed tables, not `Intl`, for any text a test compares. Derive counts from the fixture file the test loads, never type them. _(Repeated in 1.6+1.7: see that entry.)_
- **Files:** `tests/unit/lib/{dock,github}.test.ts`, `src/lib/{dates,github,landing}.ts`

## 2026-10-18 · 1.5cd · Dock designed without measuring its tiles
- **What happened:** the first dock had a 120 px magnify radius. The e2e check "the neighbouring tile also grows" failed: neighbouring pills sit about 110 px apart, so the second tile barely moved and only one tile ever swelled, which is not a dock.
- **Root cause:** I picked the radius and the gap as round numbers before measuring the real tile widths.
- **Fix:** radius 170 px, peak 1.35, gap 24 px so a grown tile and its neighbour don't collide; the unit test pins that a neighbour at 110 px grows.
- **Prevention rule:** Derive a distance-based effect's radius from the measured spacing of the real elements, and test the neighbour, not only the target.
- **Files:** `src/lib/dock.ts`, `src/components/landing/Skills.astro`, `tests/unit/lib/dock.test.ts`

## 2026-10-18 · 1.5cd · Locators that matched the wrong thing
- **What happened:** `page.locator('#75-hard')` threw "not a valid selector" (a CSS id cannot start with a digit); and `locator('.skill', { hasText: 'Speech enhancement' })` matched PyTorch's row, because `hasText` is a case-insensitive substring and PyTorch's evidence link is "SIH… speech enhancement".
- **Root cause:** I treated a hash like a CSS selector and a text filter like an exact match.
- **Fix:** `[id="75-hard"]` for any hash target; the layer test now asserts every row by index against the expected stable-sorted order, which is also stricter.
- **Prevention rule:** Select by `[id="…"]` when the id may start with a digit; assert lists by position, not by `hasText`.
- **Files:** `tests/e2e/{skills,beyond,landing}.spec.ts`

## 2026-10-18 · 1.5cd · Plan assumed the dock list did not exist
- **What happened:** the approved plan said the dock would be derived from `skills.json` (core + working, capped at 12). While reading the code, `site.json` already had a curated `dock` list of 8 stack names, with a schema and tests.
- **Root cause:** I read `site.json` only up to the `proof` key while planning, and never saw the rest.
- **Fix:** the dock renders `site.dock`; told Arnav in the report.
- **Prevention rule:** Read the whole of every content file and its schema in `content.ts` before proposing a derived list in a plan.
- **Files:** `src/components/landing/Skills.astro`

## 2026-10-18 · 1.5cd · Smaller wrong turns (caught before review)
- `FormField` took `label`, `required` and `maxlength` from its callers while `RULES` in `forms.ts` already held them; typecheck failed under `exactOptionalPropertyTypes`. It now reads `RULES`, so the form and validator cannot drift apart.
- Duplicated the `SKILL_LEVELS` constant that `content.ts` already exports; removed.
- Ran Prettier over `src/` before editing and then edited from stale text; re-read before each edit after a format.
- A `cd` into a subfolder moved the shell's working directory; use absolute paths from the project root.

## 2026-10-18 · 1.5b revision (orbit) · An aborted `play()` was treated as "autoplay blocked"
- **What happened:** after the orbit change one e2e run failed (tap to pause left the button on "Pause"; the earlier run had passed). Pausing, or skipping to the next reel, while `play()` was still pending rejects that promise with `AbortError`. My catch handler took every rejection as "autoplay with sound refused", muted the clip and restarted it, so a user's pause was undone and a fast skip played muted.
- **Root cause:** I wrote one catch-all for a promise that rejects for several reasons and only imagined the autoplay case.
- **Fix:** fall back to muted playback only for `NotAllowedError`; a regression test pauses immediately and skips three reels quickly (it ran 4× repeat with no failures).
- **Prevention rule:** Check `error.name` before reacting to a rejected `play()`; treat a one-off e2e failure as a possible real race and find the cause before re-running.
- **Files:** `src/lib/reels.ts`, `tests/e2e/hard75.spec.ts`

## 2026-10-18 · 1.5b revision (orbit) · Ring first cut covered the sub-line
- **What happened:** in the first ring screenshot the front card sat across the sub-line and part of the headline.
- **Root cause:** I sized the ring's height (22% of the stage) without measuring where the headline block ends.
- **Fix:** taller ring (31% of the stage, capped at 280 px) so the front arc passes below the sub-line; one extreme frame still touches the first letters by a few pixels.
- **Prevention rule:** Place an orbit relative to the measured headline block, and screenshot a frame at the front of the ring, not only the spread state.
- **Files:** `src/lib/reels.ts`

## 2026-10-18 · 1.5b · The 3D card list swallowed every click
- **What happened:** the first e2e run showed the reel player never opened and hover never played. `elementFromPoint` at a card's centre returned the `<ul class="hard__cards">`, not the card.
- **Root cause:** I made the cards a `preserve-3d` layer with negative `translateZ` depths. The full-stage list sits at z = 0, in front of cards behind it, so it takes the hit test. I wrote the visuals and the click handlers but never tried a click until the e2e run.
- **Fix:** `pointer-events: none` on the list and `auto` on each slot, in the floating layout only.
- **Prevention rule:** In a 3D-transformed layer, make every full-size wrapper click-through and re-enable pointer events on the children; try a real click on each depth before writing handlers.
- **Files:** `src/components/landing/Hard75.astro`

## 2026-10-18 · 1.5b · Several of my own assertions checked the wrong thing
- **What happened:** the hackathon test found rows by their result text ("Participated" is not unique); the card-overlap test measured the title element's box (14ch wide) instead of its text, so it flagged a card that visibly cleared the headline; the audio probe took the max of all gain writes, so the master gain's 1 read as the bed's level; player tests expected a relative `src` but the player sets the absolute `href`.
- **Root cause:** I wrote the assertions from the intended behaviour without checking what the DOM and fakes actually return. The unit test for `loadingDay` had the same flaw (0.56 × 75 is 42.000…01 in floating point).
- **Fix:** match rows by position, measure a `Range` over the title text, record only writes after the element is attached, match `src` by file suffix, use 0.55 in the unit test.
- **Prevention rule:** Before asserting on a DOM or fake value, print it once; measure text with a Range, not the element box; avoid float values that land on a boundary in unit tests.
- **Files:** `tests/e2e/experience.spec.ts`, `tests/e2e/hard75.spec.ts`, `tests/unit/lib/reels.test.ts`

## 2026-10-18 · 1.5b · `wrangler dev --local` ignores Range, so the player stalled about 15 s
- **What happened:** a real reel stayed on "loading" for ~15 s in e2e (readyState 0, then it loaded at once on Chromium's retry). curl showed the server answers in 10 ms, but returns 200 with the whole file and no `Accept-Ranges` for any `Range` request.
- **Root cause:** Chromium asks for `bytes=0-` on video; the local asset server doesn't speak ranges. I suspected my player code first and added tracing before checking the server with curl.
- **Fix:** none in the app. The e2e specs serve the MP4s through a Playwright route that returns real 206 slices, so tests are fast and deterministic. **Open item for 1.10:** confirm production Workers assets honour Range; if not, the Worker must serve `/media/*` with ranges.
- **Prevention rule:** When media misbehaves, curl the server with and without a `Range` header before touching player code.
- **Files:** `tests/e2e/hard75.spec.ts`

## 2026-10-18 · 1.5b · Mobile player box was not 9:16
- **What happened:** the 375 px screenshot showed grey bands above and below the clip.
- **Root cause:** `height: 100%` plus `max-width: 100%` and `aspect-ratio`: when the width clamps, an explicit height wins and the ratio is dropped. Only the screenshot showed it.
- **Fix:** width = `min(100%, (100dvh − 140px) × 9/16)`, `aspect-ratio: 9/16`, `max-height: 100%`.
- **Prevention rule:** Size an aspect-ratio box from one definite dimension; never give it both a height and a clamped width.
- **Files:** `src/components/landing/ReelPlayer.astro`

## 2026-10-18 · 1.5b · Smaller wrong turns (caught before review)
- The fifth card sat at `top: 70%` and its caption ran off the 900 px viewport; moved to 64% after the 1440 screenshot.
- Wrote a debug log to `/tmp` instead of the session scratchpad; use the scratchpad for every temp file.
- Linted late: `no-non-null-assertion` flagged `CARD_LAYOUTS[0]!` and the test `ranges` helper; replaced with a named fallback and `?.`.

## 2026-10-18 · 1.5a · Sticky pane made every project's links unreachable by keyboard
- **What happened:** I first rendered all five desktop panes `inert` + `aria-hidden`; the mobile inline cards are `display: none` on desktop, so keyboard users could never reach a project's GitHub link. Caught while writing the markup, before any run.
- **Root cause:** treated the panes as decoration to hide from assistive tech, forgetting they are the only desktop copy of the links.
- **Fix:** server-render pane 0 as active and focusable; `setActive` in `src/lib/work.ts` toggles `inert` so only the visible pane is reachable. e2e asserts 4 inert panes and one active.
- **Prevention rule:** When content is duplicated per breakpoint, check that each breakpoint has exactly one reachable copy of every link before hiding the other.
- **Files:** `src/components/landing/SelectedWork.astro`, `src/lib/work.ts`

## 2026-10-18 · 1.5a · Scripted line-delete left a broken test (REPEAT)
- **What happened:** `sed -i` failed on macOS (BSD sed needs `-i ''`), then my Python line filter removed only the middle line of a Prettier-wrapped `toContainText(...)` call, leaving `toContainText()` and a lint error.
- **Root cause:** deleted by line match instead of replacing the whole statement; assumed Prettier had not wrapped it. Repeats the "scripted edits" entry below.
- **Fix:** replaced it with `toContainText(p.oneLiner)` via an exact-string replace.
- **Prevention rule (strengthened):** Use the Edit tool for any removal in a file Prettier has formatted; never delete by single-line grep, and never use `sed -i` on macOS.
- **Files:** `tests/e2e/work.spec.ts`

## 2026-10-18 · 1.5a · Screenshots caught the pane mid-crossfade, and a test assumed item 0 was pinned
- **What happened:** the first screenshots showed overlapping pane text (an element screenshot scrolls while the 700 ms crossfade runs), and the "pane stays pinned" test failed by 168 px because item 0 sits above the pin point.
- **Root cause:** shot without waiting for the transition to settle (same family as the 1.4 "name mid-reveal" entry); assumed the pin starts at the first item.
- **Fix:** park the third project centred, wait 1.2 s, then take a viewport screenshot; compare items 1 and 3 for the pin test.
- **Prevention rule:** Park the scroll position, wait out the longest transition, then screenshot; test sticky behaviour between two mid-list items.
- **Files:** `tests/e2e/work.spec.ts`

## 2026-10-18 · 1.5a revision · Pane too big, switched too fast, plain
- **What happened:** Arnav's review: the pane was too big, the next project's info swapped in too quickly, and the content wasn't engaging. A first card redesign then clipped its own chips and GitHub button at 1440 and 768 px, and my "≤ 400 px" test cap was set before the content was measured.
- **Root cause:** I built the pane to the SPEC's "crossfade as each name crosses centre" literally, sized it to fill the column, and listed stats as plain text. I never checked how long a viewer actually lingers on one project (50vh rows, no hysteresis), and sized a fixed-height card from a guess.
- **Fix:** compact card (≤ 400 px wide, 460 px tall) with a progress rail, stats split into big amber figures and mono labels (`splitStat`), 80vh rows, a 12%-of-viewport hysteresis band, and a staggered build-in after a 250 ms fade-out.
- **Prevention rule:** For scroll-driven UI, set dwell time (row height) and a switch threshold up front, and size fixed-height cards from the longest real content at the narrowest split width, not from a guess.
- **Files:** `src/components/landing/SelectedWork.astro`, `ProjectDetail.astro`, `src/lib/work.ts`, `tests/e2e/work.spec.ts`

## 2026-10-18 · 1.5a revision 2 · Glow halo made the page scroll sideways
- **What happened:** after adding the background (dot grid, spine, ghost numerals, glow), the existing hero layout test failed at 768 and 1440 px: `scrollWidth` 1468 > 1440. A throwaway screenshot spec also failed first because I put it outside `tests/e2e` (the configured `testDir`).
- **Root cause:** the glow is `inset: -140px` around the card, which sits 112 px from the right edge, so it overhung the viewport. I checked the new section visually but only ran its own tests, not the whole suite, before the screenshot.
- **Fix:** `overflow-x: clip` on `.work` (clip, not hidden, so the sticky card keeps working).
- **Prevention rule:** Any decoration that extends past its box (glows, halos, ghost text) gets clipped at its section, and the full `pnpm e2e`, not just the new spec, runs before a visual change is reported. Put throwaway specs under `tests/e2e`.
- **Files:** `src/components/landing/SelectedWork.astro`

## 2026-10-18 · 1.5a · Stale dev server on port 8787 blocked e2e
- **What happened:** `pnpm e2e` failed with "http://localhost:8787/api/health is already used".
- **Root cause:** an earlier backgrounded Playwright run left its `wrangler dev` server alive.
- **Fix:** killed the process on 8787 and re-ran.
- **Prevention rule:** Before starting e2e after a backgrounded run, free port 8787 (`lsof -ti tcp:8787 | xargs -r kill`).
- **Files:** none

## 2026-10-18 · 1.5a · Project names overflowed their column at 1440 px
- **What happened:** "enhancement" in the 80 px display size touched the pane edge. Found only by opening the screenshot.
- **Root cause:** sized the name for the headline scale without checking the longest real word in `projects.json`.
- **Fix:** `clamp(32px, 4vw, 64px)` with `overflow-wrap: anywhere`; pane stats drop to body size below 1024 px.
- **Prevention rule:** Size display text against the longest word in the content, and open the screenshot at every width.
- **Files:** `src/components/landing/SelectedWork.astro`, `src/components/landing/ProjectDetail.astro`

## 2026-10-18 · 1.4 revision 3 · Day still a flat blob; hover felt mechanical
- **What happened:** after revision 2, Arnav still found Day "weird" (a tan figure where hair and skin shared one tone) and our circle lens "weird" next to the reference site's hover.
- **Root cause:** every figure cell was drawn and only its colour varied, so the shape came from hue, which collapses on paper. For the hover I guessed at an effect instead of studying how the reference actually works.
- **Fix:** read the reference's public bundles for the *technique* (ordered dither, pointer push, fluid trail reveal); rebuilt the portrait as a 4×4 Bayer dither with a contrast stretch (Day inks the dark, Night lights the bright), with push + a fading trail field revealing the photo.
- **Prevention rule:** When matching a reference interaction, inspect how it is built before designing; for image effects, carry form with density or size, not hue alone.
- **Files:** `src/lib/dotmatrix.ts`, `src/lib/hero.ts`, `src/components/landing/Hero.astro`

## 2026-10-18 · 1.4 revision 2 · Day dot-matrix looked muddy; edge fade darkened instead of fading
- **What happened:** Arnav found Day "a bit weird": a grey blob of dimmed shirt dots behind ARNAV, a hard dark strip under it, and heavy near-black hair. After the first fix, dark speckle remained at the bottom of the figure in Day.
- **Root cause:** (1) I tuned the dot-matrix in Night, where low values sink into the background. In Day the same values are dark ink, so dimmed and faded dots turned grey or dark. (2) `edgeFade` scaled luminance, not opacity, so faded dots moved toward the dark end of the Day ramp.
- **Fix:** fade drives opacity (`Dot.a`); the torso fades from 64% to 88% of the height; warm umber Day ramp (no black); Day squares at 70% of the cell; Day clear zone at 12%.
- **Prevention rule:** Any effect that fades or dims must work on opacity, never on the colour value; review every visual effect in Day and Night side by side before showing it.
- **Files:** `src/lib/dotmatrix.ts`, `tests/unit/lib/dotmatrix.test.ts`

## 2026-10-18 · 1.4 revision · Dimmed amber text failed Day contrast
- **What happened:** axe flagged the nav's 01–04 numbers at 3.2:1 in Day; `contrast.test.ts` had passed.
- **Root cause:** I added `opacity: 0.7` to amber text for a softer look. The token test checks raw token pairs, not the composited colour, so it couldn't see it.
- **Fix:** removed the opacity; the text uses `--time` at full strength (5.9:1 in Day).
- **Prevention rule:** Never put `opacity` on text; use a token whose contrast is tested.
- **Files:** `src/components/landing/Nav.astro`

## 2026-10-18 · 1.4 revision · Text over the dot-matrix was unreadable
- **What happened:** in Day the middle of ARNAV vanished into the dark shirt dots, and the role line sat on the neck; on mobile the role line ran off both edges.
- **Root cause:** I designed the overlap from the Night look only, where parchment on dim amber still reads.
- **Fix:** dots behind the name and role line dim to 20%, feathered over 28 px (`clearAlpha`); the role line wraps on narrow screens.
- **Prevention rule:** For text over imagery, check both themes and 375 px before showing it; give the text a clear zone, not just a colour.
- **Files:** `src/lib/dotmatrix.ts`, `src/lib/hero.ts`, `src/components/landing/Hero.astro`

## 2026-10-18 · 1.4 revision · Two-resolution dot grid left a seam
- **What happened:** a light ring outlined the face; letting the grids overlap turned it into a dark ring.
- **Root cause:** a finer face grid and a coarse body grid meet on an ellipse; cells on the boundary either leave a gap or double up, and squares make either visible.
- **Fix:** one uniform 4 px grid (5 px on phones); the face stays legible and there is no boundary.
- **Prevention rule:** Don't stitch two sampling resolutions without blending; try the single finer grid first and measure its cost.
- **Files:** `src/lib/dotmatrix.ts`, `tests/unit/lib/dotmatrix.test.ts`

## 2026-10-18 · 1.4 revision · Scripted edits: regex ate an import, and a stray line aborted a multi-file update (REPEAT) — REPEATED AGAIN in revision 3
- **What happened:** (1) A regex meant to rewrite the dotmatrix import also swallowed the `vitest` import above it, which broke typecheck. (2) A doc-update script had a leftover throwaway replacement at the end. It threw after SPEC.md and CLAUDE.md were written but before plan.md was.
- **Root cause:** the non-greedy `import \{[\s\S]*?\}` started at the first `import {` in the file. The script wrote each file as it went, so a late failure left a partial update. This repeats the 1.2 "regex bulk edit corrupted a test" entry.
- **Fix:** restored the import; redid plan.md alone; checked `git diff --stat` for all four docs.
- **Repeated again in 1.5a** (line-delete left a broken test); see that entry.
- **Prevention rule (strengthened):** Anchor regex edits to the exact line (or use Edit), and in a multi-file script validate every replacement before writing any file. After a scripted edit, diff the result before running anything.
- **Revision 3 repeat:** a three-file script wrote dotmatrix.ts and hero.ts, then threw on Hero.astro, whose markup Prettier had re-wrapped. **Rule now:** one file per script, or run every check first and only then write; prefer the Edit tool for Astro/HTML, which Prettier reflows.
- **Files:** `tests/unit/lib/dotmatrix.test.ts`, `docs/plan.md`

## 2026-10-18 · 1.4 · Boot e2e tests raced the real clock
- **What happened:** 1 of 5 full e2e runs failed on `toHaveAttribute('data-boot', 'on')`; the other runs passed.
- **Root cause:** the tests asserted a state that only lasts ~2.6 s, on real timers. With 3 workers under load, page load sometimes outlasted the boot, so the state was gone before the first assertion. The screenshot test also waited on the 400 ms `out` state. Passing locally made the timing look safe.
- **Fix:** boot, skip, failsafe and axe-during-boot tests use `page.clock.install()` + `runFor`; the screenshot test waits for `data-boot !== 'on'`. Verified 35/35 with `--repeat-each=5`.
- **Prevention rule:** Assert time-limited UI states on Playwright's fake clock, and stress any timer test with `--repeat-each=5` before trusting it.
- **Files:** `tests/e2e/landing.spec.ts`

## 2026-10-18 · 1.4 · At-rest screenshots caught the name mid-reveal
- **What happened:** the 1440 home screenshot showed only a half-faded "A" of ARNAV, which looked like a broken hero.
- **Root cause:** the screenshot loop waited only for fonts; the new letter reveal was still running. The 1.2 rule covered the opposite case (capture animations mid-run on purpose).
- **Fix:** the loop waits until every finite animation has finished (infinite loops like the marquee keep running).
- **Prevention rule:** Before an at-rest screenshot, wait for `document.getAnimations()` to settle; capture mid-animation only in dedicated frame tests.
- **Files:** `tests/e2e/design-system.spec.ts`

## 2026-10-18 · 1.4 · Nav bar inherited an inset from the base rule
- **What happened:** the sticky nav's bottom border stopped 16 px short of the right edge at every width.
- **Root cause:** `.shell-bar--nav` set `top` and `left` but kept `.shell-bar`'s `right: var(--space-4)`, which was meant for the floating gear. I didn't look at the page edges in the first screenshots.
- **Fix:** `right: 0` on the nav variant; checked in a crop of the 1440 shot.
- **Prevention rule:** When a modifier repurposes a fixed element, set all its insets explicitly, and check full-bleed edges in the screenshots.
- **REPEAT (1.4 revision):** the hero quadrants list kept its base `width: 100%` when it became `position: absolute` with insets, so the right-hand quadrants ran off screen. **Strengthened rule:** when an element switches to absolute/fixed with insets, reset `width`/`height` to `auto` in the same rule, and check every edge of every breakpoint in the screenshots.
- **Files:** `src/layouts/Base.astro`, `src/components/landing/Hero.astro`

## 2026-10-18 · 1.4 · Smaller wrong turns (caught before review)
- Portrait mask ellipse too large: the grey backdrop kept hard corners. Fixed to `ellipse 50% 50% at 50% 50%`. Check a mask against both themes before signing off.
- Boot timing constants guessed (3.2 s vs SPEC ~2.5 s); a unit test on the real `site.boot` caught it. Derive durations from content and test them against the SPEC number.
- Marquee hover test timed out: Playwright waits for a moving element to be stable. Hover the static container that owns the `:hover` rule.
- **Files:** `src/components/landing/Hero.astro`, `src/lib/boot.ts`, `tests/e2e/landing.spec.ts`

## 2026-10-18 · 1.3 · Mutation check "passed" because the mutation never applied
- **What happened:** after breaking `projects.json` for the mutation check, build and tests both passed.
- **Root cause:** I used `sed -i '' '0,/re/s//…/'`. `0,/re/` is GNU sed syntax; macOS BSD sed silently matched nothing, so the file was never changed. The green result looked like a real finding.
- **Fix:** mutated with a `node -e` JSON edit, checked the bad value was actually in the file (`grep -c` = 1), then saw the build fail with `content/projects.json is invalid … at [0].status`; restored from a backup and confirmed the value was gone.
- **Prevention rule:** In a mutation check, first prove the mutation landed (grep for it) before trusting a pass; on macOS make structured edits with `node -e`, not GNU-only sed syntax.
- **Files:** none (temporary edit to `content/projects.json`, restored)

## 2026-10-18 · 1.3 · Plan claimed build-time validation nothing triggered
- **What happened:** the approved plan said "parsing at import means `astro build` fails on invalid content", but no page imported `src/lib/content.ts`, so the build would never have run the parser.
- **Root cause:** I reasoned about the module in isolation and didn't trace which entry point would import it.
- **Fix:** `Base.astro` now builds its default description from `site.json` (also removing the last hardcoded bio string in a component), so every page build parses all content.
- **Prevention rule:** When a check is meant to run at build, name the entry point that imports it and prove it with a failing build.
- **Files:** `src/layouts/Base.astro`

## 2026-10-18 · 1.2 follow-up · Skeleton sweep invisible, shell UI too plain
- **What happened:** after closing 1.2, Arnav couldn't see the skeleton loading sweep and found toasts and the progress bar bland.
- **Root cause:** the sweep was a 10% tint over 40% of the block, so it was barely visible. I signed it off from full-page static screenshots, which can't show whether an animation reads, and I never captured the progress bar mid-run.
- **Fix:** bright scanline with a fading trail (transform-based); progress bar with a fading tail, a glowing head and a fade-out; toasts with a tinted icon chip, stacked HUD label and message, kind-tinted border and glow, a 4 s countdown line that pauses with the timer, and an exit animation.
- **Prevention rule:** For anything animated, capture element screenshots mid-animation (2–3 frames) and review those, not just the page at rest.
- **Files:** `src/styles/global.css`, `src/lib/toast.ts`

## 2026-10-18 · 1.2 · e2e ran against a stale build
- **What happened:** an axe failure persisted after the fix; the HTML still had the old `<header>`.
- **Root cause:** the first `pnpm e2e` left an orphaned `workerd` on :8787, and `reuseExistingServer: true` silently reused it, skipping `pnpm build`. It looked safe because Playwright normally stops the server it starts.
- **Fix:** killed the process; set `reuseExistingServer: false` so a busy port fails loudly.
- **Prevention rule:** Never let e2e reuse a running server; if a fix "doesn't take", check `lsof -iTCP:8787` before debugging the code.
- **Files:** `playwright.config.ts`

## 2026-10-18 · 1.2 · Regex bulk edit corrupted a test
- **What happened:** `night['text']!` became `nightok(t, 'text')`, a type error.
- **Root cause:** the generic `t\['…'\]!` pattern also matched the tail of `night[...]`; I ran the narrower pattern second.
- **Fix:** corrected the line by hand.
- **Prevention rule:** Anchor regex rewrites on a word boundary, apply the most specific pattern first, and grep the result before running anything.
- **Files:** `tests/unit/lib/contrast.test.ts`

## 2026-10-18 · 1.2 · Worker tsconfig swallowed all unit tests
- **What happened:** `pnpm typecheck` failed on `Storage`/implicit `any` in the new Node-side tests.
- **Root cause:** 1.1 set `worker/tsconfig.json` to include `tests/unit/**` (no DOM lib), assuming only Worker tests would live there.
- **Fix:** split into `tests/unit/worker` (worker tsconfig + Workers pool) and `tests/unit/lib` (root tsconfig + Node project).
- **Prevention rule:** Put tests for each runtime in its own folder, covered by the tsconfig and vitest project for that runtime.
- **Files:** `tsconfig.json`, `worker/tsconfig.json`, `vitest.config.ts`

## 2026-10-18 · 1.2 · Nested landmark in the settings dialog
- **What happened:** axe `landmark-banner-is-top-level`: the dialog's `<header>` sat inside the page `<header>` banner.
- **Root cause:** used `<header>` as a styling wrapper inside a component that renders inside the shell header.
- **Fix:** `<div class="settings__header">`.
- **Prevention rule:** Use landmark elements (`header`, `nav`, `main`, `footer`) only for page-level landmarks, never as component wrappers.
- **Files:** `src/components/SettingsPanel.astro`

## 2026-10-18 · 1.2 · Screenshot under a fake clock and a mobile overlap
- **What happened:** toast screenshots taken in the `page.clock` test showed half-faded toasts; the real-clock shot then showed mobile toasts covering the settings gear.
- **Root cause:** reused the timing test for visuals; set the toast `top` without checking what else is fixed at the top.
- **Fix:** separate real-clock screenshot tests; mobile toasts start below the 44 px top bar.
- **Prevention rule:** Take visual screenshots only in tests with a real clock, and check every fixed element against the others at 375 px.
- **Files:** `tests/e2e/design-system.spec.ts`, `src/styles/global.css`

## 2026-10-18 · 1.2 · pnpm not on PATH (environment)
- **What happened:** `pnpm: command not found` in the agent shell.
- **Root cause:** Node 24 lives in `~/.local/share/node-v24.22.0-darwin-arm64/bin`, which the non-interactive shell doesn't load.
- **Fix:** prefix `PATH` per command.
- **Prevention rule:** In agent shells, export `PATH=~/.local/share/node-v24.22.0-darwin-arm64/bin:$PATH` before any pnpm command.
- **Files:** none

## 2026-10-18 · 1.1 · Prettier rewrote hand-written docs
- **What happened:** `pnpm format` reformatted `CLAUDE.md`, `docs/plan.md` and `docs/phase_completion.md`.
- **Root cause:** `.prettierignore` only listed `docs/SPEC.md`; I assumed the rest of the Markdown was already Prettier-clean.
- **Fix:** reverted with `git checkout`, added `*.md` to `.prettierignore`.
- **Prevention rule:** Run a formatter over the whole repo only after `.prettierignore` excludes hand-written docs; check `git diff --stat` right after.
- **Files:** `.prettierignore`

## 2026-10-18 · 1.1 · ESLint config written from memory
- **What happened:** `eslint .` crashed with "Cannot read properties of undefined (reading 'recommended')".
- **Root cause:** I used the `flatConfigs` key from `eslint-plugin-jsx-a11y`; the `-x` fork exposes `configs.recommended`, and react-hooks 7 moved flat configs to `configs.flat`.
- **Fix:** printed each plugin's exports with `node -e`, rewrote the config with `eslint/config`'s `defineConfig` + `extends`.
- **Prevention rule:** Inspect a plugin's actual exports before writing its config; never assume key names from another package or major version.
- **Files:** `eslint.config.js`

## 2026-10-18 · 1.1 · linkinator flagged an API route as broken
- **What happened:** `[404] dist/api/health`.
- **Root cause:** linkinator scans `./dist` as files, so the skip regex `^/api/` never matched the rewritten path.
- **Fix:** skip patterns `/api/` and `/admin` without anchors.
- **Prevention rule:** Skip Worker routes in linkinator with unanchored patterns; they never exist in `dist/`.
- **Files:** `.linkinator.config.json`

## 2026-10-18 · 1.1 · Toolchain installs (environment, not code)
- **What happened:** `brew install node@24` failed on a formula lock and tried to upgrade unrelated formulae; corepack 0.36 couldn't launch pnpm 12 (native binary layout).
- **Root cause:** assumed Homebrew and corepack were the low-friction paths.
- **Fix:** official nodejs.org tarball (SHA-256 verified) in `~/.local/share`, then `npm i -g pnpm@12.14.0`.
- **Prevention rule:** For a pinned Node version without sudo, use the checksum-verified nodejs.org tarball; install pnpm ≥ 12 with npm, not corepack.
- **Files:** none in the repo

## 2026-10-19 · boot redesign · HTML budget used up by scoped-style markers, and a test that read a mid-fade value
- **What happened:** after the Beyond code redesign `dist/index.html` was 14,200 B gzipped, a 1 byte margin on a 14,200 limit. Separately, the "first visit is untouched" hero test read the photo's opacity once and got 0.83 (then 0 once the dot portrait replaced it under the boot).
- **Root cause:** Astro adds a `data-astro-cid-*` attribute to every element of a component with a scoped `<style>`: 849 B gzipped across the landing, 268 attributes on the projects table alone. The test asserted a computed value that an animation (or the boot) legitimately changes.
- **Fix:** AllProjects' `<style>` is `is:global` (every selector is a prefixed class), back to 14,021 B. The test now asserts the hold is absent (`animationName` is not `hero-failsafe`) instead of reading opacity.
- **Prevention rule:** Before adding markup or styles to the landing, check `check-html-budget`; a component with many elements and class-only selectors belongs in `is:global`. Never assert a computed opacity that an animation can be changing; assert the cause (animation name, attribute).
- **Files:** `src/components/landing/AllProjects.astro`, `tests/e2e/hero-hold.spec.ts`

## 2026-10-19 · scroll/cursor · early JS request cost LCP, and a custom-domain route broke the local admin bypass
- **What happened:** (1) Lighthouse LCP rose to 2.1 s after the boot scene became a lazy chunk fetched at start. (2) After the `arnavc.in` route was added, every /admin e2e test got 503.
- **Root cause:** (1) Lighthouse's pessimistic graph counts requests that start before the observed LCP; the boot chunk was one. (2) `wrangler dev` reports the route's host as the request host, so the `hostname === 'localhost'` check in `verifyAccess` never matched.
- **Fix:** (1) request the boot chunk only after the portrait has decoded and painted: 1962 ms. (2) `--local-upstream localhost:8787` in the Playwright web server command.
- **Prevention rule:** Bisect an LCP regression by disabling one change at a time (boot-disabled control run) instead of guessing. After adding a `routes` entry, run the admin e2e specs: local dev no longer sees `localhost`.
- **Files:** `src/lib/boot.ts`, `playwright.config.ts`

## 2026-10-19 · reactor depth · gradients throw on NaN, and a 0-size canvas divided by zero
- **What happened:** after the depth pass the boot hand-off test failed with `createLinearGradient: non-finite`. Separately, the contact axe test failed twice: it analysed the forms right after a click, mid fade-in.
- **Root cause:** the canvas was measured at 0 × 0 before the overlay had a size, so a shadow length divided by `w * 0.3` gave NaN; `arc` silently ignores NaN but gradients throw. The axe test never waited for the 700 ms section reveal and only passed when analysis happened to be slow.
- **Fix:** divide by `Math.max(1, w)`, re-measure the canvas on a frame while it is 0, fall back to `performance.now()` for a missing frame stamp; the axe test waits 1.2 s after submitting.
- **Prevention rule:** every value that reaches a canvas gradient must be finite: guard divisions by a measured size. Never read colours with axe right after something scrolls into view; wait out the reveal.
- **Files:** `src/lib/reactor.ts`, `tests/e2e/freelance-contact.spec.ts`

## 2026-10-19 · toasts · 1.5 KB of toast CSS in the render-blocking stylesheet cost 150 ms of LCP
- **What happened:** after the toast restyle Lighthouse LCP went from 1,960 ms to 2,108 ms (budget 2,000).
- **Root cause:** the toast rules lived in `global.css`, which blocks first paint, and the restyle grew them.
- **Fix:** the rules moved to `src/styles/toast.css`, imported `?inline` by `toast.ts` and injected with the first toast: LCP 1,956–1,969 ms.
- **Prevention rule:** UI that only appears on interaction (toasts, dialogs, decorations) gets its CSS injected by its script, never added to `global.css`; re-run `pnpm lhci` after any change to the stylesheet.
- **Files:** `src/styles/global.css`, `src/styles/toast.css`, `src/lib/toast.ts`

## 2026-10-19 · boot · a restyle that ignored the site's own language, and an element added in its end state
- **What happened:** (1) the boot's "reactor" was made 3D with glossy cyan glass, bevels, rays and reflections; Arnav called it cartoonish and off-theme. (2) The pencil note and the projects table both felt abrupt.
- **Root cause:** (1) I pushed depth by adding effects from other design references instead of reading the site's tokens and hero first (graphite, one amber, dots and hairlines). (2) The note is created after the pointer is already near, so the browser drew it in its final state with no transition; the table was excluded from the smooth-scroll library, so its wheel input was handled twice.
- **Fix:** (1) redrew every part in dots, hairlines and amber. (2) insert the note, force a frame, then add the class that plays it; remove the table from the native-scroll list.
- **Prevention rule:** before a visual pass, list the site's own materials and use only those; "depth" there means light and spacing, not glass. An element inserted already matching its "on" selector will not animate: render it in its resting state, wait a frame, then switch it on. Anything on the page that scrolls only sideways must not intercept wheel input.
- **Files:** `src/lib/reactor.ts`, `src/lib/workshop-entry.ts`, `src/lib/smooth.ts`

## 2026-10-19 · boot · an entrance animation that restarts when its blocking attribute is removed
- **What happened:** after the boot the hero name appeared, vanished and played its entrance again.
- **Root cause:** `.hero__letter` had `animation: none` only while `data-boot` was `on` or `out`. Removing the attribute at the end brought the entrance animation rule back, and a changed `animation-name` restarts it from the first keyframe.
- **Fix:** a persistent `data-booted` attribute (set when a full boot ends) keeps the letters still, and the hand-off cross-fades the letters in over the fading particles instead of cutting.
- **Prevention rule:** never gate an animation by an attribute that is later removed; mark the end state with an attribute that stays. Also: `document.fonts.check` on a whole font stack is false when any size-adjusted fallback face is unloaded; check the first family.
- **Files:** `src/components/landing/Hero.astro`, `src/lib/boot.ts`, `src/lib/reactor.ts`

## 2026-10-19 · email · mail sent to an address that was never verified as a destination
- **What happened:** four messages from the site were saved in D1 but none was emailed (`emailed = 0`).
- **Root cause:** Email Routing was enabled on `arnavc.in`, but the only verified destination was `arnavc.work@gmail.com`; the Worker was sending to `arnavworkmail3012@gmail.com`, which Cloudflare refuses.
- **Fix:** `send_email.destination_address` and `MAIL_TO` now use the verified `arnavc.work@gmail.com`.
- **Prevention rule:** before claiming mail is set up, read the destination list from the Email Routing API and compare it with `MAIL_TO`. The Worker swallows send errors and still tells the visitor "sent", so `emailed = 0` in D1 is the only signal.
- **Files:** `wrangler.jsonc`

## 2026-10-19 · launcher / forms · early JavaScript flips LCP between 1.96 s and 2.1 s
- **What happened:** Lighthouse LCP jumped to 2,107 ms after the sending panel was statically imported into the forms script, and then flipped between 1,955 and 2,109 ms run to run after the EDITH launcher's new code landed in the first script.
- **Root cause:** the page sits on an edge in Lighthouse's model: roughly a kilobyte of extra early JavaScript is enough to add a ~150 ms step, and near the edge it flips randomly.
- **Fix:** the sending panel loads on first focus of a form; the orb, ripple and nudge live in `edith-presence.ts` and load after the launcher mounts. LCP back to 1,957 ms (one cold first run after a build read 2,031).
- **Prevention rule:** any new behaviour that is not needed for first paint goes in its own dynamically imported chunk; re-run `pnpm lhci` three times after touching the first script, and read a flip as "on the edge", not noise.
- **Files:** `src/lib/forms.ts`, `src/lib/edith.ts`, `src/lib/edith-presence.ts`

## 2026-10-19 · admin PIN · the login refused the browser's own form (Origin: null)
- **What happened:** entering the right PIN at https://arnavc.in/admin/login answered "Not allowed."
- **Root cause:** `/admin` pages send `Referrer-Policy: no-referrer`; under it a browser sends `Origin: null` for a same-site form POST, and the login required `Origin` to equal the site's origin. The unit tests set `Origin` by hand, so they never saw a real browser's header.
- **Fix:** accept `Sec-Fetch-Site: same-origin` (a page cannot forge it) or a matching `Origin`; test the exact headers a browser sends.
- **Prevention rule:** for same-origin checks use `Sec-Fetch-Site` first. Test auth flows with the headers a real browser sends under the page's own Referrer-Policy, not hand-made ones.
- **Files:** `worker/admin.ts`, `tests/unit/worker/pin.test.ts`

## 2026-10-19 · admin PIN · a strict origin check still refused a real browser
- **What happened:** after the first fix the login still answered "Not allowed." in Arnav's browser, though a curl with a standard browser's headers (`Origin: null`, `Sec-Fetch-Site: same-origin`) got through on the live site.
- **Root cause:** not found from here; the likely cause is a header-stripping browser setting or extension. The check refused a request for lacking proof of origin instead of for showing evidence of another site.
- **Fix:** the login refuses only a request that says it came from another site (`Sec-Fetch-Site: cross-site`, or a different non-null `Origin`); silence is allowed, since a forged login gains nothing without the PIN and the session cookie is SameSite=Strict. The refusal now prints the headers it saw.
- **Prevention rule:** probe the live site with curl before assuming the deploy or the fix is wrong; make a gate refuse on evidence of attack, not on absence of proof, when the attack it guards against has no impact; make refusals say what they saw.
- **Files:** `worker/admin.ts`, `tests/unit/worker/pin.test.ts`

## 2026-10-19 · deploy · adding `routes` silently switched workers.dev off
- **What happened:** https://arnav-portfolio.arnav-3012.workers.dev answered 404; the dashboard showed workers.dev "Disabled". Arnav submits with that link.
- **Root cause:** with `routes` in `wrangler.jsonc` and no `workers_dev`, Wrangler defaults it to false and turns the address off on deploy.
- **Fix:** `"workers_dev": true` in `wrangler.jsonc`.
- **Prevention rule:** after any change to `routes` or domains, probe every public address (workers.dev, apex, www) with curl before saying the deploy is fine.
- **Files:** `wrangler.jsonc`

## 2026-10-19 · 2.4 (3D room) · The look was wrong three times before it was right
- **What happened:** the first room (graphite loft, steel beams, a red toolbox, a pegboard, industrial lamps, a cement-tile rug) was judged "too bad" and "too much"; the second (warm student workshop) still read as a mechanical workshop. Arnav wanted a minimal beige-and-black room, soft light, a fur rug and tech things (MacBook, Mac mini), nothing rusty.
- **Root cause:** I took "Iron Man workshop plus student room" literally and filled it with props, instead of asking for the mood and then building the quietest version of it. I also designed from the SPEC's tokens and my own reading, and looked at references only after the first screenshot was rejected.
- **Fix:** web research on minimal and Japandi rooms plus the Claude and Apple design references, then a warm-minimal palette in tokens (oat, pale oak, matte black, cream fur), two paper pendants, an arc floor lamp, and a tech desk. Props were cut to what is relevant to Arnav.
- **Prevention rule:** for any new look, research references and show one screenshot of the direction before adding detail; fewer, better-lit objects beat more objects.
- **Files:** `src/styles/tokens.css`, `src/components/workshop/*`

## 2026-10-19 · 2.4 · Faces in the same plane (z-fighting) on the door and window frames, and a door leaf inside the wall
- **What happened:** Arnav's screenshot showed jagged stair-steps on the door frame and leaf, and a bare white doorway.
- **Root cause:** frame boxes were built flush with the wall opening (same plane as the plaster's faces), the open leaf's hinge was placed inside the 30 cm wall, and nothing existed behind the door but the sky.
- **Fix:** frames reach 12 mm into the opening, the leaf hinges on the wall's outer face, and a short lit corridor sits behind the door.
- **Prevention rule:** never place two surfaces in the same plane; overlap by a few millimetres or inset. Check every camera shot, not only the overview, before showing a room.
- **Files:** `src/components/workshop/Shell.tsx`

## 2026-10-19 · 2.4 · Leaf-only plant models floated and sorted badly
- **What happened:** the CC0 plant models (fern, anthurium, calathea) came as cut-out leaves without stems or pots, so they hung in mid-air with alpha sorting artefacts.
- **Root cause:** I picked models by name and size without opening them.
- **Fix:** plants are drawn in code (stems, merged curved leaves, plain pots); only the chair and vase remain from Poly Haven.
- **Prevention rule:** look at a downloaded model in the scene before keeping it; botany-category assets are not potted plants.
- **Files:** `src/components/workshop/Plants.tsx`, `scripts/room-assets.ts`

## 2026-10-19 · 2.4b · A third-person walker when Arnav wanted first person; and walking tied to frame rate
- **What happened:** the approved plan had a visible character and a follow camera; Arnav said "no need to see the character, first person, just hands and legs a bit". Separately, the movement step was capped at 50 ms per frame, so on a slow device a held key covered almost no distance (an e2e test moved 0.11 m in 2.5 s).
- **Root cause:** I read "walkable character" as a visible avatar. The cap was meant to stop tunnelling but made speed depend on frame rate.
- **Fix:** eye-height camera with mouse look, hands in the view, legs and trainers visible when looking down; slow frames are split into 1/30 s sub-steps.
- **Prevention rule:** when the user says "character", ask or state first-person vs third-person in the plan's first line; never cap dt without sub-stepping.
- **Files:** `src/components/workshop/Walker.tsx`, `Hands.tsx`, `Avatar.tsx`, `Rig.tsx`

## 2026-10-19 · 2.4 · Smaller wrong turns (caught by tests and screenshots)
- macOS `sed -i` needs an empty suffix argument; inside an `&&` chain its failure silently skipped the next command (twice). Use Python for edits.
- A translucent light-shaft wedge from the window read as a flat triangle: removed.
- Hotspot rings were hard-edged: now feathered shader glows at about a third of the strength until hovered.
- A vertical-only drag did not count as a drag (only x was measured), so looking down never triggered: the distance now uses both axes.
- ESLint linted the vendor Draco wrapper in `public/draco/`: ignored. Landing HTML grew 153 B when the Mumbai-time script was in `Base.astro`: moved to a workshop-only component.
- The room had 173 GL draw calls per frame (over the 150 budget): small pieces no longer cast shadows and bloom uses fewer levels.

## 2026-10-19 · 2.4 · Flashes and judder while moving
- **What went wrong:** the auto quality drop changed pixel ratio, post stack, tone mapping and the key light together, so the picture jumped; a point light over glossy glass made a moving white hotspot; the camera was updated a frame before the walker; the shadow pass ran every frame for a room that never moves.
- **Root cause:** I treated "lower quality" as one switch and checked looks only in still screenshots, never in motion.
- **Fix:** resolution-only steps first, tier swap last; static shadows; walker before camera; softer glass and metal; eased stride shared by camera, legs and arms.
- **Prevention rule:** any runtime quality change must keep the image identical apart from sharpness; judge lights from a frame sequence while moving (sample brightness per frame), not one screenshot; never put a point light close above a glossy surface.
- **Files:** `Room.tsx`, `Lighting.tsx`, `Walker.tsx`, `Rig.tsx`, `Hands.tsx`, `Shell.tsx`, `quality.ts`

## 2026-10-20 · 2.4 · White flashes while walking (third attempt)
- **What went wrong:** Arnav reported the flashes three times; I fixed plausible causes (quality tier jump, a glossy-glass hotspot, hotspot glow) by reasoning and screenshots, and the flash was still there.
- **Root cause:** the lights re-rendered whenever the room component did, and drei's Environment redrew its map each time (a 2-frame brighter picture). Nothing I tried by reasoning pointed at it.
- **Fix:** memoised the static scene parts, built the environment once, isolated the effects stack.
- **Prevention rule:** for a visual glitch that happens in motion, measure it before fixing: record per-frame brightness while doing the action, keep the pixels of the bad frames, log React renders and match them by timestamp, then switch suspects off one at a time. Never ship a "fix" for a flicker that was not reproduced as a number first. Components that take no props and belong to a canvas scene should be memoised when their parent holds changing state.
- **Files:** `Room.tsx`, `Lighting.tsx`, `Markers.tsx`

## 2026-10-20 · 2.4 · The room's imports slowed the landing page
- **What went wrong:** the landing page's LCP went from 1,959 to 2,104 ms (budget 2,000) with no change to the landing page itself.
- **Root cause:** the lazy room imported `lib/theme` and `lib/workshop/mumbai-time`, which the landing's first script also uses, so the bundler made them shared files the landing had to fetch before its first script ran. Two extra requests were worth about 150 ms.
- **Fix:** room-only copies of the two tiny helpers, with a test that the copy matches.
- **Prevention rule:** a lazy chunk must not import modules that the landing's critical scripts also import. After any change that touches shared libs, compare the `from"./..."` imports of `dist/_astro/Base...js` and `index...js` with the previous build, and run Lighthouse on `/` before closing a task, not only the room.
- **Files:** `src/lib/workshop/typing.ts`, `room-clock.ts`, `Room.tsx`, `Walker.tsx`, `Shell.tsx`
