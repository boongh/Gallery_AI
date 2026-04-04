# Module Overview

A description of each module in the Gallery AI system, what it is responsible for, and how it fits into the whole.

---

## nginx

Reverse proxy sitting in front of everything. All traffic from the user enters here on port 8000.

- Requests to `/gms/*` are forwarded to the Go media server (the prefix is stripped).
- Requests to `/media/*` (static file paths) are served directly from the `/data` volume on disk — this is how thumbnail and original images are delivered to the browser without going through any application code.
- Everything else is forwarded to the Next.js frontend.

---

## next (Frontend)

Next.js application. The UI the user interacts with.

- **Gallery page (`/`)** — shows all uploaded images in a grid, paginated. Supports file name filtering and image upload.
- **Search page (`/search`)** — semantic search using natural language. Sends a query to the media server, displays ranked results. Pagination reuses the embedding returned by the first query to avoid re-encoding on subsequent pages.
- **Collections page (`/collection`)** — lists and manages named collections of images.
- **Lightbox** — full-screen image viewer with related image suggestions loaded from Qdrant.

The frontend communicates exclusively through the Nginx proxy. It never talks to the media server, worker, or databases directly.

---

## MediaServer (Go)

The backend API. Written in Go using the Gin framework. Exposes all application logic as HTTP endpoints under `/gms/`.

**Endpoints:**

| Method | Path | What it does |
|---|---|---|
| POST | `/media` | Upload images. Saves to disk, writes to Postgres, publishes a job to RabbitMQ for async processing. |
| GET | `/media` | Paginated list of images from Postgres. |
| POST | `/media/query` | Semantic search. Sends text to the embedding API, queries Qdrant by vector similarity. Returns results with the embedding so the client can paginate without re-embedding. |
| GET | `/media/suggestions` | Given a media UUID, finds visually similar images by querying Qdrant using that image's existing vector. |
| GET | `/collection` | List all collections. |
| POST | `/collection` | Create a new collection. |

Connects to: PostgreSQL (image metadata), Qdrant (vector queries), RabbitMQ (publishing upload jobs), Python worker (embedding API calls).

---

## Worker (Python)

A single Docker container running multiple processes managed by supervisord. Handles everything that is too slow or resource-heavy to do synchronously in the API.

### Thumbnail Worker (`thumbnail_worker.py`)
Consumes jobs from RabbitMQ. For each uploaded image, generates a thumbnail and saves it to the `/data` volume. Updates the image record in Postgres to record the thumbnail path.

### Embedding Worker (`sync_embedding_worker.py`)
Consumes jobs from RabbitMQ. For each uploaded image, runs it through the CLIP image encoder to produce a vector embedding. Stores the vector in Qdrant under the image's UUID.

### Embedding API (`sync_embedding_api.py` via uvicorn)
A small FastAPI service listening on port 8001. Accepts text queries and returns their CLIP vector embeddings. Used by the media server at query time to convert a user's search string into a vector before querying Qdrant.

---

## PostgreSQL

Relational database. Stores structured metadata.

- **`galleryindex.images`** — one row per uploaded image: UUID, filepath, thumbnail path, format, upload timestamp, EXIF metadata, processing status.
- **Collections tables** — collection names/descriptions and the many-to-many association between collections and image UUIDs.

---

## Qdrant

Vector database. Stores and searches image embeddings.

- **`media` collection** — one point per image, keyed by UUID. The vector is the CLIP image embedding. Used for semantic search (`/media/query`) and similarity lookup (`/media/suggestions`).
- Planned: a separate collection for face embeddings to support face recognition.

---

## RabbitMQ

Message queue. Decouples the upload path from the heavy processing work.

When an image is uploaded, the media server publishes a job message. The thumbnail worker and embedding worker both consume from this queue independently. This means uploads return immediately to the user while processing happens in the background.

---

## Data volume (`./data`)

Shared filesystem volume mounted by Nginx, the media server, and the worker.

- `data/originals/` — full-resolution uploaded images
- `data/thumbnails/` — generated thumbnails
- `data/qdrant/` — Qdrant storage
- `data/postgres/` — PostgreSQL data files
