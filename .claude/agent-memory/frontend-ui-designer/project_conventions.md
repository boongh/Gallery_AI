---
name: Gallery AI frontend conventions
description: UI patterns, styling approach, component APIs, and file structure for the Gallery AI Next.js app
type: project
---

Dark theme baseline: `background: '#0d0d0d'` on page root. Sticky top bar uses `rgba(13,13,13,0.85)` + `backdropFilter: blur(12px)` + `borderBottom: '1px solid rgba(255,255,255,0.08)'`.

Styling: inline styles only — no CSS modules, no Tailwind. Mantine components (ActionIcon, Badge, Box, Button, Center, Group, Loader, Stack, Text, TextInput) from `@mantine/core`. Hooks from `@mantine/hooks`.

Image grid: CSS grid with `gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(120px, 20vw, 180px), 1fr))'`, gap 6px mobile / 8px desktop. Tiles are square (`aspectRatio: '1'`), borderRadius 8, scale(1.03) + shadow on hover.

`ImageData` type lives in `next/components/Lightbox.tsx` (exported). Fields: id, format, filepath, thumbnail_filepath, status, createdAt (Date), uploadedAt (Date), metaData (object).

Lightbox props: `image: ImageData | null`, `onClose: () => void`, `initialImageIndex: Map<string, ImageData>`.

Mobile breakpoint: `useMediaQuery('(max-width: 768px)')`. Mobile top bar left padding is 52px to clear the hamburger.

SidebarNav: order is Gallery ("/") → Search ("/search") → Collections ("/collection"). Icons are 15x15 inline SVGs.

Package manager: `pnpm` (not npm — `npm install` errors with "Cannot read properties of null").

`lucide-react` is installed (v1.8.0). Used icons: `Pencil`, `Share2` (collection page), `Sun`, `Moon` (profile sidebar).

`useIntersection` from `@mantine/hooks`: returns `{ ref, entry }`. Attach `ref` to the element to observe. `entry?.isIntersecting ?? true` gives a safe default (visible) before first observation.

Collection contents page pattern: `CollectionInfo` interface with uuid/name/description/thumbnail_url/created_at. Banner (non-sticky) below top bar holds collection thumbnail + name + description. Top bar shows collection name only when banner has scrolled out of view (opacity transition via `useIntersection`). Edit modal uses `Modal` from Mantine with `styles={{ content/header: { background: 'var(--mantine-color-dark-7)' } }}`.

Theme toggle: `useMantineColorScheme()` from `@mantine/core`. `colorScheme === 'dark'` → show Sun icon + label "Light mode". `colorScheme === 'light'` → show Moon icon + label "Dark mode".

`ImageData` fields (corrected): id, original_url, thumbnail_url, preview_url, format, status, createdAt (Date), uploadedAt (Date), metaData (object).

**Why:** These conventions were observed from page.tsx, SidebarNav.tsx, Lightbox.tsx, ProfileSidebar.tsx, and layout.tsx.
**How to apply:** Match all new pages and components exactly to this baseline — same colors, same grid, same component library.
