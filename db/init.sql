CREATE SCHEMA galleryindex AUTHORIZATION gallery;
CREATE SCHEMA cache AUTHORIZATION gallery;
CREATE SCHEMA collections AUTHORIZATION gallery;
CREATE SCHEMA users AUTHORIZATION gallery;
CREATE SCHEMA system AUTHORIZATION gallery;

CREATE TABLE users.credentials (
    uuid UUID PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE galleryindex.images (
    uuid UUID PRIMARY KEY,
    owner_uuid UUID REFERENCES users.credentials(uuid) ON DELETE SET NULL,
    format TEXT NOT NULL,
    original_filepath TEXT NOT NULL,
    original_url TEXT NOT NULL,
    thumbnail_filepath TEXT,
    thumbnail_url TEXT NOT NULL,
    preview_filepath TEXT NOT NULL,
    preview_url TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    uploaded_at TIMESTAMP DEFAULT now(),
    metadata JSONB
);

CREATE TABLE cache.textsqueries (
    query TEXT PRIMARY KEY,
    embedding_version TEXT NOT NULL,
    embedding JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    last_accessed TIMESTAMP DEFAULT now()
);

CREATE TABLE cache.imagesqueries (
    bytehash BIGINT PRIMARY KEY,
    uuid UUID REFERENCES galleryindex.images(uuid) ON DELETE CASCADE,
    hash_version TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    last_accessed TIMESTAMP DEFAULT now()
);

CREATE TABLE collections.collection_data (
    uuid UUID PRIMARY KEY,
    owner_uuid UUID REFERENCES users.credentials(uuid) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT now(),
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_image_uuid UUID,
    metadata JSONB
);

CREATE TABLE collections.collection_images (
    collection_uuid UUID REFERENCES collections.collection_data(uuid) ON DELETE CASCADE,
    image_uuid UUID REFERENCES galleryindex.images(uuid) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT now(),
    PRIMARY KEY (collection_uuid, image_uuid)
);

CREATE TABLE collections.collection_userperms (
    collection_uuid UUID REFERENCES collections.collection_data(uuid) ON DELETE CASCADE,
    user_uuid UUID REFERENCES users.credentials(uuid) ON DELETE CASCADE,
    permission SMALLINT,
    PRIMARY KEY (collection_uuid, user_uuid)
);

CREATE TABLE system.metrics(
  embeddings_generated BIGINT DEFAULT 0,
  queries_served BIGINT DEFAULT 0,
  images_stored BIGINT DEFAULT 0,
  median_latency_ms DOUBLE PRECISION DEFAULT 0,
  memory_usage_mb DOUBLE PRECISION DEFAULT 0
);