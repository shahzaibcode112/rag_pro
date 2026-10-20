-- Run this once in the Supabase SQL Editor.

-- 1. Turn on vector support
create extension if not exists vector;

-- 2. One row per uploaded document (pasted text or file)
create table if not exists documents (
  id bigint generated always as identity primary key,
  owner_id text not null,
  filename text,
  created_at timestamptz not null default now()
);

-- 3. One row per chunk of text, with its embedding (1536 numbers)
create table if not exists chunks (
  id bigint generated always as identity primary key,
  document_id bigint not null references documents(id) on delete cascade,
  owner_id text not null,
  content text not null,
  embedding vector(1536) not null
);

create index if not exists chunks_owner_idx on chunks (owner_id);

-- 4. Security: block Supabase's public web API from reading these tables.
--    (Our app connects directly with the database password, which is not affected.)
alter table documents enable row level security;
alter table chunks enable row level security;
