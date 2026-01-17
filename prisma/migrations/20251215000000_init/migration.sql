CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY,
  "name" text NOT NULL,
  "role" text NOT NULL DEFAULT 'user',
  "banned" boolean NOT NULL DEFAULT false,
  "avatar_url" text,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL
);

CREATE INDEX "profiles_role_idx" ON "profiles" ("role");

CREATE TABLE "rate_limit" (
  "key" text NOT NULL,
  "count" integer NOT NULL,
  "lastRequest" integer NOT NULL,
  CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("key")
);
