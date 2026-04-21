---
name: CSS variable theming system
description: gb- prefixed CSS custom properties in globals.css that switch between dark/light via data-mantine-color-scheme attribute
type: project
---

`app/globals.css` defines design tokens under `:root, [data-mantine-color-scheme="dark"]` and `[data-mantine-color-scheme="light"]`. All custom component colors must use these variables — never hardcode dark values.

Token groups: `--gb-bg`, `--gb-header-bg`, `--gb-panel-bg`, `--gb-sidebar-bg`, `--gb-inset-bg/border`, `--gb-border`, `--gb-border-mid`, `--gb-border-strong`, `--gb-hover-bg`, `--gb-card-bg`, `--gb-card-bg-raised`, `--gb-modal-bg`, `--gb-drag-handle`, `--gb-drag-pip`, `--gb-text-primary/secondary/tertiary/muted/dimmed`, `--gb-shadow`, `--gb-shadow-panel`, `--gb-backdrop`.

**Exceptions — keep hardcoded:**
- `background: '#000'` on the mobile Lightbox modal body (pure-black photo viewer backdrop)
- `background: 'rgba(0,0,0,0.5)'` on selected-image overlays (always over a photo)
- `border: '2px solid rgba(255,255,255,0.6)'` and `background: 'rgba(0,0,0,0.3)'` on unselected checkboxes (image overlays)
- `outline: '2px solid var(--mantine-color-blue-5)'` selection outline (Mantine's own variable)

**Why:** Mantine's color scheme toggle only affects Mantine components. Custom inline styles needed their own token layer to respond to `data-mantine-color-scheme` on `<html>`.

**How to apply:** Any new custom color in an inline style should reference a `--gb-*` variable. For hover handlers that set `e.currentTarget.style.*`, use the variable string form e.g. `'var(--gb-hover-bg)'`.
