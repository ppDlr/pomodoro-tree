# AGENTS.md

## Overview
- Project: `pomodoro-tree`
- Repository status: Newly initialized repository.

## Setup & Development
- When adding dependencies, build tooling, or test frameworks, keep this file updated with exact build, test, and verification commands.

## Build / Run / Verify
- No build step, no dependencies: the site is plain HTML/CSS/JS.
- Run: open `index.html` directly in a browser (double-click, no server needed).
- Verify JS syntax (if a JS engine is available): `node --check app.js`.
- Persistent state lives in `localStorage` (keys: `studySessions`, `pomodoroIdleDays` [debug only]); clear site data to reset.
- `TODO.md` holds the internal pending-items list; it is gitignored and not part of the shipped site.
