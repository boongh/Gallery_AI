# Gallery AI

A self-hosted Google Photos alternative with semantic search. Because building one yourself is cooler than using Immich.

## What it does

- Upload photos and browse them in a gallery
- Search your library using natural language (e.g. "sunset at the beach", "portrait of a woman")
- Browse and organise photos into collections
- Find visually similar images to any photo in your library

## How it works

Photos you upload get processed by a background worker: thumbnails are generated for fast display, and an embedding model (CLIP) turns each image into a vector. Those vectors are stored in Qdrant. When you search with text, the same model encodes your query and Qdrant finds the closest matching images.

## Stack

| Component | Role |
|---|---|
| Next.js | Frontend UI |
| Go (Gin) | Media API server |
| Python (FastAPI + supervisord) | Thumbnail worker, embedding worker, embedding API |
| PostgreSQL | Image index, collections metadata |
| Qdrant | Vector database for semantic search |
| RabbitMQ | Job queue between API and workers |
| Nginx | Reverse proxy |

## Running it

```bash
docker compose up --build
```

The app is available at `http://localhost:8000`.

## Getting started

**Prerequisites:** Docker and Docker Compose.

1. Clone the repo
2. From the project root, run `docker compose up --build`
3. Open `http://localhost:8000`
4. Sign up at `/signup`, then log in at `/login`
5. Start uploading photos

That's it. No config files to edit, no API keys to set up.

## Frontend features

Everything you need is in the browser. Here's what each page does.

### Gallery (`/`)

The home page. All your photos, grouped by year, month, and day. Click any photo to open the lightbox — it shows the full image and a row of visually similar photos pulled from the same library. From the lightbox you can also add the photo to a collection.

### Semantic Search (`/search`)

Type a plain-English description of what you're looking for — "sunset at the beach", "dog in the snow", whatever — and hit search. Results are ranked by how closely the image matches your query. Click any result to open the lightbox.

### Collections (`/collection`)

A grid of all your collections. Hit "New Collection" to create one (name required, description optional). Click a collection card to browse its contents, or use the trash icon to delete it.

### Collection Contents (`/collection/[id]/contents`)

Photos inside a specific collection, grouped by date in the same year/month/day layout as the main gallery. Click any photo to open the lightbox.

### Profile

Accessible via the person icon in the top-right corner of any page. Shows your username and the date you joined. Log out from here too.

## Planned features

- Face detection and recognition
- Real-time system metrics dashboard
- Query result caching
- Image deduplication on upload
- Per-collection thumbnails
