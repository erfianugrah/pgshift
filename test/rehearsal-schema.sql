-- Minimal example-app-shaped schema for the scale rehearsal. Loaded on BOTH the
-- source and the target (logical replication does not create tables on the
-- subscriber). Mirrors the columns in migrate.config.example.yaml, including the
-- search_vector GENERATED column that the subscriber must regenerate and that
-- reconcile must exclude from its hash.

CREATE TABLE IF NOT EXISTS public.documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid,
  content             text,
  title               text,
  language            text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz,
  updated_at          timestamptz,
  visibility          text,
  archived  boolean,
  read_count          integer,
  is_encrypted        boolean,
  view_limit          integer,
  version             integer,
  ref_token        text,
  search_vector       tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content, ''))) STORED
);

CREATE TABLE IF NOT EXISTS public.aliases (
  alias        text PRIMARY KEY,
  document_id    uuid,
  expires_at  timestamptz
);
