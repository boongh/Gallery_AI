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

## Planned features

- Face detection and recognition
- Real-time system metrics dashboard
- Query result caching
- Image deduplication on upload
- Per-collection thumbnails
