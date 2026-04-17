# Module Overview

A description of each module in the Gallery AI system, what it is responsible for, and how it fits into the whole.

_Last updated: 2026-04-17. Reflects the `auth` branch._

---

## nginx

Reverse proxy sitting in front of everything. All traffic from the user enters here on port 8000.

- Requests to `/gms/*` are forwarded to the Go media server (the prefix is stripped before hitting Go routing).
- Requests to `/media/*` (static file paths) are served directly from the `/data` volume on disk — this is how thumbnail, preview, and original images are delivered to the browser without going through any application code.
- Everything else is forwarded to the Next.js frontend.

---

## next (Frontend)

Next.js application. The UI the user interacts with.

- **Gallery page (`/`)** — shows all uploaded images in a responsive grid. Supports inline semantic search (posts to `POST /gms/media/query`) and file upload (one file at a time to `POST /gms/media/:collectionId`). Pagination uses the `next` cursor returned by each API response. When search is active it uses the `next` body from `POST /gms/media/query` — which carries the pre-computed point vectors — to paginate without re-encoding.
- **Search page (`/search`)** — dedicated full-page semantic search. Sends natural-language queries to `POST /gms/media/query`, displays ranked results with a result count badge, and supports load-more pagination via the `next` body. Has a collapsible filter panel (date range, format, collection, sort) — currently rendered as placeholders, not yet wired to the backend.
- **Collections page (`/collection`)** — lists and manages named collections of images.
- **Lightbox** — full-screen image viewer with related image suggestions loaded from Qdrant.

The frontend communicates exclusively through the Nginx proxy. It never talks to the media server, worker, or databases directly.

---

## MediaServer (Go)

The backend API. Written in Go using the Gin framework. Runs on port 8080 internally. All routes below are prefixed with `/gms/` by Nginx before they reach the Go router (Go itself registers them without the prefix, as seen in `main.go`).

**Authentication** is required on all routes except `/signup`, `/login`, and `/ping`. The `AuthMiddleware` function (`auth/auth.go`) validates the `auth_token` HttpOnly cookie (JWT, HS256, signed with `JWT_SECRET_KEY`). On success it sets `userUUID` in the Gin context so downstream handlers can scope queries to the authenticated user.

**Auth endpoints** (no `/gms/` prefix — registered directly on the root router):

| Method | Path | Auth required | What it does |
|---|---|---|---|
| POST | `/signup` | No | Register a new user. Accepts `{ username, password }`. Hashes the password with bcrypt (cost 12) and a UUID salt. Creates the user row in `users.credentials` and a default collection in `collections.collection_data` atomically. Returns 201. |
| POST | `/login` | No | Authenticate a user. Accepts `{ username, password }`. On success sets an HttpOnly `auth_token` cookie (JWT, 7-day expiry) and returns `{ userid: "<uuid>" }`. |
| GET | `/auth/me` | Yes | Returns `{ uuid, username, created_at }` for the authenticated user. |

**Media endpoints** (Nginx strips `/gms`, Go registers under `/media`):

| Method | Path | Auth required | What it does |
|---|---|---|---|
| POST | `/media/:collection_id` | Yes | Upload images. Accepts `multipart/form-data` with field `files` (multiple). Validates the collection belongs to the authenticated user. Saves originals to disk, inserts rows into `galleryindex.images` and `collections.collection_images`, then publishes one job per image to three RabbitMQ queues: `thumbnail_generation_queue`, `preview_generation_queue`, and `vector_generation_queue`. Returns 201. |
| GET | `/media` | Yes | Paginated list of images for the authenticated user. Query params: `offset` (int), `limit` (int), `want` (dash-separated list of field names from `ValidMediaAttributes`). Returns `{ content: [...], next: "<url>" }`. |
| GET | `/media/:type/:id` | Yes | Serve a single media file by UUID. `:type` is one of `thumbnails`, `previews`, or `originals`. Verifies the authenticated user owns the image, then responds with an `X-Accel-Redirect` header for Nginx to serve the file directly from disk. Returns 403 if ownership check fails. |
| DELETE | `/media` | Yes | Delete images by UUID. Accepts `{ delete_id: ["<uuid>", ...] }`. Deletes rows from `galleryindex.images` where the UUID is in the list AND `owner_uuid` matches the authenticated user. Returns 204. Note: does not currently remove files from disk or vectors from Qdrant. |
| POST | `/media/query` | Yes | Semantic search. Accepts a JSON body with either `text_query` (string) or `point_query` (array of float32 vectors). Text queries are forwarded to the Python embedding API at `http://python-worker:8001/embed/text`. Results are filtered in Qdrant to the authenticated user's `collection_id`. Returns `{ content: [...], next: <body-for-next-page> }` — the `next` field carries pre-computed vectors so the client can paginate without re-encoding. |
| GET | `/media/suggestions` | Yes | Given a media UUID (`?uuid=`), finds visually similar images by querying Qdrant using that image's existing vector. Applies a score threshold of 0.5 and returns up to 20 results. Filters to the authenticated user's collection. |

**Collection endpoints** (Nginx strips `/gms`, Go registers under `/collection`):

| Method | Path | Auth required | What it does |
|---|---|---|---|
| GET | `/collection` | Yes | List collections available to the authenticated user. Query params: `want`, `offset`, `limit`. |
| POST | `/collection` | Yes | Create a new named collection. Accepts `{ name, description }`. |

Connects to: PostgreSQL (image metadata, user credentials, collections), Qdrant (vector queries), RabbitMQ (publishing upload jobs), Python worker (embedding API calls at `http://python-worker:8001`).

---

## Auth module (`MediaServer/auth/`)

Handles all authentication and session logic for the media server.

- **`auth.go`** — implements five functions:
  - `Auth_Post_Signup_Handler` — user registration with bcrypt password hashing.
  - `Auth_Post_Login_Handler` — credential verification and JWT cookie issuance.
  - `Auth_Get_Me_Handler` — returns profile data for the authenticated user.
  - `Auth_Get_Validate_Handler` — parses and validates the `auth_token` JWT cookie, sets `userUUID` in the Gin context.
  - `AuthMiddleware` — a Gin middleware that wraps `Auth_Get_Validate_Handler`. On failure it redirects to `/login` and aborts the request chain.
- **`interface.go`** — defines `IDPostgresQuerrier` (used by `Auth_Get_Me_Handler`) to allow dependency injection and testing.
- JWT algorithm: HS256. Secret read from `JWT_SECRET_KEY` env var. Cookie is `HttpOnly`; `Secure` flag is set only when `PRODUCTION=true`.
- On signup, a default `collections.collection_data` row is created for the new user. If that insert fails, the `users.credentials` row is rolled back to prevent orphaned accounts.

---

## Worker (Python)

A single Docker container running four processes managed by supervisord. Handles everything that is too slow or resource-heavy to do synchronously in the API.

### Thumbnail Worker (`thumbnail_worker.py`) — `worker-thumbnails`
Consumes jobs from `thumbnail_generation_queue`. For each uploaded image, generates a thumbnail using Pillow, corrects orientation from EXIF data, and saves it to the `/data` volume. Updates `preview_filepath` in `galleryindex.images` in Postgres.

### Preview Worker (`preview_worker.py`) — `worker-preview`
Consumes jobs from `preview_generation_queue`. For each uploaded image, generates a medium-resolution preview (max 1024×1024) in AVIF format using Pillow, with EXIF orientation correction. Saves to `/data/media/previews/` and updates `preview_filepath` in `galleryindex.images`. This is a new worker added alongside the `preview_url`/`preview_filepath` columns in the schema.

### Embedding Worker (`async_embedding_worker.py`) — `worker-vectorgeneration`
Consumes jobs from `vector_generation_queue`. For each uploaded image, runs it through the CLIP image encoder to produce a vector embedding. Stores the vector in Qdrant under the image's UUID.

### Embedding API (`sync_embedding_api.py` via uvicorn) — `worker-vector-api`
A FastAPI service listening on port 8001. Accepts text queries and returns their CLIP vector embeddings. Used by the media server at query time (`POST /embed/text`) to convert a user's search string into a vector before querying Qdrant.

All four processes are configured with `autostart=true` and `autorestart=true` in `supervisord.conf`. Logs go to stdout/stderr (Docker captures them).

---

## PostgreSQL

Relational database. Stores structured metadata. Schema is initialized by `db/init.sql`. The database user is `gallery`. There are five schemas:

- **`users`**
  - `credentials` — one row per user: UUID (PK), username (unique), bcrypt salt, password hash, created_at.
- **`galleryindex`**
  - `images` — one row per uploaded image: UUID (PK), `owner_uuid` (FK → `users.credentials`), format, `original_filepath`, `original_url`, `thumbnail_filepath`, `thumbnail_url`, `preview_filepath`, `preview_url`, status, `created_at`, `uploaded_at`, metadata (JSONB). The `preview_filepath` and `preview_url` columns are new and correspond to the AVIF previews generated by the preview worker.
- **`collections`**
  - `collection_data` — one row per collection: UUID (PK), `owner_uuid` (FK), name, description, `thumbnail_filepath`, metadata (JSONB).
  - `collection_images` — many-to-many join between collections and images; composite PK `(collection_uuid, image_uuid)`.
- **`cache`**
  - `textsqueries` — caches text embedding results keyed by query string.
  - `imagesqueries` — caches image lookup results keyed by a byte hash.
- **`system`**
  - `metrics` — single-row table tracking aggregate counters (embeddings generated, queries served, images stored, median latency, memory usage). Not yet wired to any write path in the current codebase.

---

## Qdrant

Vector database. Stores and searches image embeddings.

- **`media` collection** — one point per image, keyed by UUID. The vector is the CLIP image embedding. Each point's payload includes `collection_id` (set to the owner's user UUID), which is used as a mandatory filter on every query to scope results to the requesting user. Used for semantic search (`POST /media/query`) and similarity lookup (`GET /media/suggestions`).
- Planned: a separate collection for face embeddings to support face recognition.

---

## RabbitMQ

Message queue. Decouples the upload path from the heavy processing work.

When an image is uploaded, the media server publishes the same job message to three durable queues: `thumbnail_generation_queue`, `preview_generation_queue`, and `vector_generation_queue`. Each worker consumes from its own queue independently. This means uploads return immediately (201) to the user while thumbnail generation, preview generation, and vector embedding all proceed in the background.

The message payload is JSON with fields: `uuid`, `fileurlpath`, `savepath`, `thumbnailsavepath`, `thumbnailurlpath`, `previewpath`, `previewurl`, `collection_id`.

---

## Data volume (`./data`)

Shared filesystem volume mounted by Nginx, the media server, and the worker.

- `data/media/originals/` — full-resolution uploaded images
- `data/media/thumbnails/` — generated thumbnails
- `data/media/previews/` — generated AVIF previews (added with preview worker)
- `data/qdrant/` — Qdrant storage
- `data/postgres/` — PostgreSQL data files
