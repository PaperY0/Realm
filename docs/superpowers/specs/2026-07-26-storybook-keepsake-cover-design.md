# Storybook Keepsake Cover Design

## Goal

Turn the completed-story screen into a colorful Dreambook Realm V3.3 fairy-tale keepsake: a real story title appears on the closed cover, the controls echo the watercolor entry background, and the completion copy gives the seven-chapter journey a quiet ending.

## Visual contract

- The closed book is a CSS-native V3.3 cover, rather than an external raster asset: layered watercolor fields use lavender, coral-apricot, gold, leaf green, and blue-violet at slightly elevated but still controlled saturation.
- A single small golden story-seed is the only magical focal point. Rounded watercolor border motifs and warm-brown contour lines frame the title; there are no text-like marks inside the decorative layer.
- The visible title is DOM text sourced from the current story package. The cover also carries a small `藏梦书境 · 七章绘本` imprint.
- Primary navigation controls use a restrained multicolor watercolor gradient with readable light text. The chapter-progress rail and its items use a pale purple treatment.
- Remove the `本机纪念页` eyebrow. Replace the completion title and supporting paragraph with the approved project-language copy; retain the reopen action.

## Data and behavior

- `renderStoryChapter` already resolves a `bookTitle` from the story package. It also assigns that same resolved string to a new closed-cover title element each time the reader renders, including restored snapshots.
- No API, storage, story structure, or reader navigation behavior changes.

## Acceptance criteria

- On the final chapter, closing the book shows the generated/fallback book title on the cover, not the fixed string `藏梦书境`.
- The cover is visibly multi-hued and storybook-like while preserving legible HTML title text and no generated-text artifact risk.
- Enabled primary controls share the rainbow watercolor family; disabled controls remain clearly disabled.
- The chapter index is pale purple and the active chapter remains distinguishable.
- The completion page contains neither `本机纪念页` nor the old completion copy.
