# Final review package: next illustration page turn

Base: `b5a3c6a`
Head: `f92e247`

## Included commits

- `d00c791 test: cover next illustration page back`
- `f92e247 fix: show next illustration on page back`

## Scope

- Adds a regression contract requiring explicit `animatePageTurn(direction, frontPage, backPage)` inputs and prohibiting `storybook-page--copy` inside that function.
- Changes temporary page turn construction so both physical faces are explicit illustration clones: the front retains outgoing content; the back renders the incoming chapter snapshot before the permanent illustration updates.

## Binding requirements

- Forward front must be the outgoing chapter illustration.
- The physical back must be the next chapter illustration, never mirrored text.
- Preserve 840ms lock, cleanup, delayed permanent illustration update, and reverse behavior.
- Do not include unrelated cover/background changes.

## Verification evidence

- `node --check src/app.js`: passed.
- `node tests/stage13-web-storybook.test.js`: passed after the fix.
- `npm.cmd test`: passed, per independent task review.
- Live browser at localhost:3000, 100ms into a forward turn: temporary sheet exists; front is chapter 1 illustration; back is chapter 2 illustration; back paragraph count is 0; illustration uses cover fit and both faces hide their backs. The base illustration remains chapter 1 during the turn while reader title metadata has advanced to chapter 2.

## Source diff summary

`src/app.js`: changes `animatePageTurn` from derived page-class selection to explicit `frontPage` / `backPage`; `renderStoryChapter` clones `.storybook-page--illustration` twice and renders incoming content into the second clone.

`tests/stage13-web-storybook.test.js`: adds five assertions for signature, physical face wiring, and absence of copy-page selection.
