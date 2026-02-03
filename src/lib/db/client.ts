import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

const MIGRATIONS = [
  `-- Initial database schema for InstaPlate Recipe Manager

CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    creator TEXT,
    sourceUrl TEXT,
    sourcePlatform TEXT,
    imageUri TEXT,
    description TEXT,
    prepTime INTEGER,
    cookTime INTEGER,
    totalTime INTEGER,
    servings INTEGER,
    difficulty TEXT,
    cuisineType TEXT,
    mealType_json TEXT NOT NULL DEFAULT '[]',
    dietaryTags_json TEXT NOT NULL DEFAULT '[]',
    ingredients_json TEXT NOT NULL DEFAULT '[]',
    steps_json TEXT NOT NULL DEFAULT '[]',
    tips TEXT,
    isStarterPack INTEGER NOT NULL DEFAULT 0,
    eitansPick INTEGER NOT NULL DEFAULT 0,
    text_blob TEXT NOT NULL DEFAULT '',
    fingerprint_hash TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_images (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    path TEXT NOT NULL,
    kind TEXT DEFAULT 'hero',
    created_at TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS packs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    creator TEXT,
    creatorHandle TEXT,
    version TEXT DEFAULT '1.0.0',
    lastUpdated TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pack_recipes (
    pack_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (pack_id, recipe_id),
    FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    type TEXT NOT NULL,
    ref_id TEXT,
    where_text TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS similarity_cache (
    recipe_id TEXT NOT NULL,
    other_recipe_id TEXT NOT NULL,
    score REAL NOT NULL,
    explain_json TEXT,
    PRIMARY KEY (recipe_id, other_recipe_id),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (other_recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisineType);
CREATE INDEX IF NOT EXISTS idx_recipes_difficulty ON recipes(difficulty);
CREATE INDEX IF NOT EXISTS idx_recipes_fingerprint ON recipes(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_recipes_created ON recipes(created_at);
CREATE INDEX IF NOT EXISTS idx_recipe_images_recipe ON recipe_images(recipe_id);
CREATE INDEX IF NOT EXISTS idx_pack_recipes_pack ON pack_recipes(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_recipes_recipe ON pack_recipes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_recipe ON usage_events(recipe_id);
CREATE INDEX IF NOT EXISTS idx_similarity_cache_recipe ON similarity_cache(recipe_id);`,
];

export async function initDatabase(): Promise<void> {
  if (db) return;

  db = await Database.load('sqlite:recipes.db');

  // Run migrations
  for (const migration of MIGRATIONS) {
    const statements = migration
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      await db.execute(statement);
    }
  }
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    await initDatabase();
  }
  return db!;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const database = await getDatabase();
  return database.select<T[]>(sql, params);
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ rowsAffected: number; lastInsertId: number }> {
  const database = await getDatabase();
  return database.execute(sql, params);
}

export function nowISO(): string {
  return new Date().toISOString();
}
