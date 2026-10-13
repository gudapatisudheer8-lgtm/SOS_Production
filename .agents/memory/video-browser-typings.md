---
name: Video browser typings
description: Browser-type failures in the video artifact when inherited TypeScript libraries exclude DOM.
---

When video typechecking reports many missing browser globals alongside animation type errors, check the inherited library set before changing animation logic. Protected video configuration and playback scaffold must remain unchanged.

**Why:** The film inherited a library set without DOM types. A large set of pre-existing errors disappeared when the permitted source bootstrap included browser libraries; rewriting animation code or protected configuration was unnecessary.

**How to apply:** Have the video design worker inspect the exact errors. Source-level TypeScript reference directives for DOM and DOM.Iterable in a permitted bootstrap can provide browser types while respecting scaffold protection. Re-run typechecking and recording-wiring validation afterward.
