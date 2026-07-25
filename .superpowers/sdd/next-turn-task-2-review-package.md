# Review package: Task 2

Base: `d00c791`
Head: `f92e247`

## Commit

`f92e247 fix: show next illustration on page back`

## Diff summary

`src/app.js | 11 insertions, 14 deletions`

## Changed behavior

- `animatePageTurn` now takes `(direction, frontPage, backPage)` and requires both faces.
- It appends the supplied pages directly to the front and back turn faces.
- `renderStoryChapter` clones the current illustration page twice before permanent content changes: one outgoing front clone and one clone populated with the new snapshot/card illustration for the incoming back.
- The old forward `storybook-page--copy` selection is removed.
