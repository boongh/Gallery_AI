# Module Overview

A description of each module in the Gallery AI system, what it is responsible for, and how it fits into the whole.

_Last updated: 2026-04-25. Reflects the `m_pipeline` branch._

---

## nginx

Reverse proxy sitting in front of everything. All traffic from the user enters here on port 8000.

- Requests to `/gms/*` are forwarded to the Go media server (the prefix is stripped before hitting Go routing).
- Everything else is forwarded to the Next.js frontend.

Media files are **not** served from disk by Nginx. Images are stored in SeaweedFS (S3-compatible object storage). The media server generates short-lived presigned GET URLs and returns them to the client; the client then fetches the image directly from storage.

---

## next (Frontend)

Next.js application. The UI the user interacts with.

- **Gallery page (`/`)** — shows all uploaded images in a responsive grid. Upload uses the presigned init/verify flow (see MediaServer upload endpoints below). Images are displayed by fetching presigned GET URLs via `GET /media/{type}/{uuid}`. Pagination uses the `next` cursor returned by each API response. Supports inline semantic search via `POST /gms/media/query`.
- **Search page (`/search`)** — dedicated full-page semantic search. Sends queries to `POST /gms/media/query`, displays ranked results. Paginate without re-encoding using the `next` body (carries pre-computed point vectors).
- **Collections page (`/collection`)** — lists collections, shows collection thumbnails fetched via presigned URLs using the `thumbnail_uuid` field.
- **Collection contents page (`/collection/:id/contents`)** — paginated image grid for a single collection.
- **Lightbox** — full-screen image viewer with related image suggestions loaded from Qdrant.

The frontend communicates exclusively through the Nginx proxy. It never talks to the media server, worker, or databases directly.

---

## MediaServer (Go)

The backend API. Written in Go using the Gin framework. Runs on port 8080 internally. All routes below are prefixed with `/gms/` by Nginx before they reach the Go router (Go itself registers them without the prefix, as seen in `main.go`).

**Authentication** is required on all routes except `/signup`, `/login`, and `/ping`. The `AuthMiddleware` function (`auth/auth.go`) validates the `auth_token` HttpOnly cookie (JWT, HS256, signed with `JWT_SECRET_KEY`). On success it sets `userUUID` in the Gin context so downstream handlers can scope queries to the authenticated user.

**Auth endpoints** (registered directly on root router, no `/gms/` prefix):

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/signup` | No | Register a new user. Accepts `{ username, password }`. Bcrypt hash (cost 12) + UUID salt. Creates `users.credentials` row and a default `collections.collection_data` row atomically. Returns 201. |
| POST | `/login` | No | Authenticate. Accepts `{ username, password }`. Sets HttpOnly `auth_token` cookie (JWT, 7-day expiry). Returns `{ userid: "<uuid>" }`. |
| GET | `/auth/me` | Yes | Returns `{ uuid, username, created_at }` for the authenticated user. |

**Upload endpoints** (registered under `/upload`):

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/upload/init` | Yes | Initialize a presigned upload session. Query param: `count` (int, default 1, max 1000). Returns `{ upload_id, presigned_urls: [], expiration: "15m0s" }`. Also pre-populates N rows in `galleryindex.images` with `status = 'pending upload'` and inserts a session record in `s3.uploadstats`. Presigned PUT URLs expire in **15 minutes**. |
| PUT | `/upload/verify/:upload_id` | Yes | Verify that files have landed in S3. Lists objects under the upload prefix, promotes matched images from `'pending upload'` to `'pending processing'`. Processing starts within 5 minutes via the `StorageDBSyncJob` goroutine. Returns 200. Returns 404 if the session is not found or expired. |

**Media endpoints** (registered under `/media`):

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/media` | Yes | Paginated list of media for the authenticated user. Query params: `offset`, `limit`, `want` (dash-separated fields). Valid `want` fields: `uuid`, `format`, `created_at`, `uploaded_at`, `metadata`. Responses do **not** include URLs — use `GET /media/{type}/{uuid}` per item. |
| GET | `/media/:type/:id` | Yes | Returns a short-lived presigned S3 GET URL for the media item (plain text). Valid `:type` values: `thumbnails`, `previews`, `originals`. Verifies ownership; returns 403 on mismatch, 404 on unknown type. Presigned URL expires in **5 minutes**. |
| POST | `/media/delete` | Yes | Delete images by UUID. Accepts `{ delete_id: ["<uuid>", ...] }`. Deletes rows where UUID is in list AND `owner_uuid` matches. Returns 204. Does not currently remove objects from S3 or vectors from Qdrant. |
| POST | `/media/query` | Yes | Semantic search. Accepts `{ text_query?: string, point_query?: float32[][] }`. Text queries are forwarded to the Python embedding API at `http://python-worker:8001/embed/text`. Results filtered in Qdrant to the authenticated user. Returns `{ content: [...], next: <body-for-next-page> }`. |
| GET | `/media/suggestions` | Yes | Similar image lookup. `?uuid=` param. Queries Qdrant using the image's existing vector. Score threshold 0.5, up to 20 results, filtered to authenticated user. |

**Collection endpoints** (registered under `/collection`):

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/collection` | Yes | List collections the user has any access to. Returns `{ uuid, created_at, name, description, thumbnail_uuid }`. Use `GET /media/thumbnails/{thumbnail_uuid}` to fetch the thumbnail image. |
| POST | `/collection` | Yes | Create a new collection. Accepts `{ name, description, thumbnail_image_uuid? }`. Returns 201 with the new collection UUID. |
| GET | `/collection/:id` | Yes | Full metadata for a single collection. Requires at least basic-viewer permission. |
| DELETE | `/collection/:id` | Yes | Permanently delete a collection. Requires owner permission. Returns 204. |
| POST | `/collection/:id` | Yes | Add images to a collection. Accepts `{ image_uuids: [] }`. Requires content-editor permission. Returns 201. |
| GET | `/collection/:id/contents` | Yes | Paginated image list for the collection. `want` param supports fields from both `galleryindex.images` and `collections.collection_images` (e.g. `uuid-format-created_at-added_at`). Requires content-viewer permission. |

**Background goroutines** (started in `main.go`):

- **`StorageDBSyncJob`** — polls every 5 minutes. (1) Deletes expired `s3.uploadstats` rows older than 24 hours. (2) For each `galleryindex.images` row with `status = 'pending upload'`, calls S3 `HeadObject`; if the object exists and has content, updates status to `'pending processing'` and publishes to all three RabbitMQ queues. (3) Deletes `'pending upload'` image rows older than 24 hours.
- **`StartThumbnailWorker`** — long-running goroutine consuming `thumbnail_preview_generation_queue`. Downloads the original from S3 to a temp file, generates a 256×256 webp thumbnail and a 1024×1024 webp preview using libvips, uploads both back to S3, then updates `status = 'active'`.

**Image lifecycle:**

```
'pending upload'  →(StorageDBSyncJob, ≤5 min)→  'pending processing'  →(ThumbnailWorker)→  'active'
```

Only `'active'` images are returned by `GET /media` and `GET /media/:type/:id`.

---

## Auth module (`MediaServer/auth/`)

Handles all authentication and session logic for the media server.

- JWT algorithm: HS256. Secret from `JWT_SECRET_KEY` env var. Cookie is `HttpOnly`; `Secure` flag set only when `PRODUCTION=true`.
- On signup, a default `collections.collection_data` row is created for the new user; if that insert fails, the `users.credentials` row is rolled back.

---

## Worker (Python)

A single Docker container running processes managed by supervisord. Handles resource-heavy asynchronous processing.

**Active workers:**

### Embedding Worker (`async_embedding_worker.py`)
Consumes `vector_generation_queue`. Downloads the original image from S3 using `get_image_from_s3`, runs it through the CLIP image encoder, and upserts the vector into Qdrant with payload `{ owner_uuid, thumbnail_key, preview_key, original_key }`.

### Metadata Worker (`metadata_worker.py`)
Consumes `metadata_generation_queue`. Downloads the original from S3, extracts EXIF metadata using Pillow, updates `galleryindex.images.metadata` and `created_at` in Postgres, and updates the Qdrant point payload with `created_at` and `metadata`.

### Embedding API (`sync_embedding_api.py` via uvicorn)
FastAPI service on port 8001. Accepts text queries at `POST /embed/text` and returns CLIP vector embeddings. Used by the media server at search time.

**Inactive workers (replaced by Go thumbnail worker):**

- `thumbnail_worker.py` — consumes `thumbnail_generation_queue` (no producer; inactive in supervisord)
- `preview_worker.py` — consumes `preview_generation_queue` (no producer; inactive in supervisord)

---

## PostgreSQL

Relational database. Schema is applied by Go migrations at startup (`db/migrations/`). Database user: `gallery`.

### `users` schema
- `credentials` — uuid (PK), username (unique), salt, password_hash, created_at

### `galleryindex` schema
- `images` — uuid (PK), owner_uuid (FK → users.credentials), format, **original_key** (S3 object key), **thumbnail_key**, **preview_key**, status, created_at, uploaded_at, metadata (JSONB)

### `collections` schema
- `collection_data` — uuid (PK), owner_uuid (FK), created_at, name, description, **thumbnail_image_uuid** (FK → galleryindex.images, nullable), metadata (JSONB)
- `collection_images` — collection_uuid + image_uuid (composite PK), added_at
- `collection_userperms` — collection_uuid + user_uuid (composite PK), permission (SMALLINT)

### `s3` schema
- `uploadstats` — uuid (PK), user_uuid (FK → users.credentials), upload_uuids (UUID[]), expires_at, created_at. One row per upload session created by `GET /upload/init`. Rows are pruned after 24 hours by `StorageDBSyncJob`.

### `cache` schema
- `textsqueries` — caches text embedding results by query string
- `imagesqueries` — caches image lookup results by byte hash

### `system` schema
- `metrics` — aggregate counters (not yet wired to any write path)

---

## Qdrant

Vector database. Stores and searches image embeddings.

- **`media` collection** — one point per image, keyed by UUID. Vector is the CLIP image embedding (512-dim). Payload: `owner_uuid`, `thumbnail_key`, `preview_key`, `original_key`, `created_at`, `metadata`. The `owner_uuid` field is used as a mandatory filter on every query to scope results to the authenticated user.

---

## RabbitMQ

Message queue. Decouples `StorageDBSyncJob` (producer) from the three processing workers (consumers).

**Queues:**

| Queue | Producer | Consumer |
|---|---|---|
| `thumbnail_preview_generation_queue` | StorageDBSyncJob (Go) | StartThumbnailWorker (Go, libvips) |
| `vector_generation_queue` | StorageDBSyncJob (Go) | async_embedding_worker (Python, CLIP) |
| `metadata_generation_queue` | StorageDBSyncJob (Go) | metadata_worker (Python, Pillow EXIF) |

**Message payload** (JSON, all queues share the same shape):

```json
{
  "uuid": "<image-uuid>",
  "owner_uuid": "<user-uuid>",
  "collection_uuid": "<collection-uuid>",
  "original_url": "<s3-original-key>",
  "thumbnail_url": "<s3-thumbnail-key>",
  "preview_url": "<s3-preview-key>"
}
```

---

## Object Storage (SeaweedFS / S3-compatible)

All media files are stored in SeaweedFS, accessed via the S3-compatible API. Bucket: `mediafiles-uploads`.

**S3 key structure:**
- Originals: `/originals/{upload_id}{user_uuid}/{item_uuid}`
- Thumbnails: `/thumbnails/{upload_id}{user_uuid}/{item_uuid}`
- Previews: `/previews/{upload_id}{user_uuid}/{item_uuid}`

**Presigned URL TTLs:**
- PUT (upload): 15 minutes
- GET (fetch): 5 minutes

---

## Data volume (`./data`)

- `data/qdrant/` — Qdrant storage
- `data/postgres/` — PostgreSQL data files

Media files are stored in SeaweedFS (object storage), not on this volume.
