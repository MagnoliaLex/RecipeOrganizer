import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

// Migration definitions with version tracking
interface Migration {
  version: number;
  name: string;
  sql: string;
}

// Migrations are defined here with their version numbers
// Each migration is executed only once, tracked by the schema_migrations table
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial',
    sql: `-- Initial database schema for InstaPlate Recipe Manager

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
  },
];

/**
 * Parse SQL content into individual statements, handling:
 * - Single-line comments (--)
 * - Multi-line comments
 * - String literals containing semicolons
 * - Empty statements
 */
function parseSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';

    // Handle line comments
    if (!inString && !inBlockComment && char === '-' && nextChar === '-') {
      inLineComment = true;
      i++; // Skip the second dash
      continue;
    }

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        current += ' '; // Replace comment with space
      }
      continue;
    }

    // Handle block comments
    if (!inString && !inBlockComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++; // Skip the asterisk
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // Skip the slash
        current += ' '; // Replace comment with space
      }
      continue;
    }

    // Handle string literals
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (inString) {
      current += char;
      // Handle escaped quotes (doubled quotes in SQL)
      if (char === stringChar && nextChar === stringChar) {
        current += nextChar;
        i++; // Skip the escaped quote
        continue;
      }
      if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    // Handle statement terminator
    if (char === ';') {
      const statement = current.trim();
      if (statement.length > 0) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  // Handle final statement without semicolon
  const finalStatement = current.trim();
  if (finalStatement.length > 0) {
    statements.push(finalStatement);
  }

  return statements;
}

/**
 * Initialize the schema migrations table
 */
async function initMigrationsTable(database: Database): Promise<void> {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

/**
 * Get the list of applied migration versions
 */
async function getAppliedMigrations(database: Database): Promise<Set<number>> {
  const rows = await database.select<{ version: number }[]>(
    'SELECT version FROM schema_migrations'
  );
  return new Set(rows.map((row) => row.version));
}

/**
 * Record a migration as applied
 */
async function recordMigration(
  database: Database,
  version: number,
  name: string
): Promise<void> {
  await database.execute(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
    [version, name, new Date().toISOString()]
  );
}

/**
 * Run pending migrations
 */
async function runMigrations(database: Database): Promise<void> {
  await initMigrationsTable(database);
  const appliedMigrations = await getAppliedMigrations(database);

  for (const migration of MIGRATIONS) {
    if (appliedMigrations.has(migration.version)) {
      continue; // Skip already applied migrations
    }

    console.info(`Running migration ${migration.version}: ${migration.name}`);

    const statements = parseSqlStatements(migration.sql);

    for (const statement of statements) {
      await database.execute(statement);
    }

    await recordMigration(database, migration.version, migration.name);
    console.info(`Migration ${migration.version} completed`);
  }
}

export async function initDatabase(): Promise<void> {
  if (db) return;

  db = await Database.load('sqlite:recipes.db');

  // Run migrations
  await runMigrations(db);
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
  const result = await database.execute(sql, params);
  return {
    rowsAffected: result.rowsAffected,
    lastInsertId: result.lastInsertId ?? 0,
  };
}

export function nowISO(): string {
  return new Date().toISOString();
}
