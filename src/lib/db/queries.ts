import { v4 as uuidv4 } from 'uuid';
import { query, execute, nowISO } from './client';
import type {
  Recipe,
  RecipeImage,
  Pack,
  PackRecipe,
  UsageEvent,
  SimilarityCache,
  SearchFilters,
  Ingredient,
} from '../../types';

// Database row types (with JSON strings instead of arrays)
interface RecipeRow {
  id: string;
  title: string;
  creator: string | null;
  sourceUrl: string | null;
  sourcePlatform: string | null;
  imageUri: string | null;
  description: string | null;
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  servings: number | null;
  difficulty: string | null;
  cuisineType: string | null;
  mealType_json: string;
  dietaryTags_json: string;
  ingredients_json: string;
  steps_json: string;
  tips: string | null;
  isStarterPack: number;
  eitansPick: number;
  text_blob: string;
  fingerprint_hash: string;
  created_at: string;
  updated_at: string;
}

// Convert database row to Recipe type
function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    creator: row.creator || undefined,
    sourceUrl: row.sourceUrl || undefined,
    sourcePlatform: row.sourcePlatform || undefined,
    imageUri: row.imageUri || undefined,
    description: row.description || undefined,
    prepTime: row.prepTime || undefined,
    cookTime: row.cookTime || undefined,
    totalTime: row.totalTime || undefined,
    servings: row.servings || undefined,
    difficulty: row.difficulty || undefined,
    cuisineType: row.cuisineType || undefined,
    mealType: JSON.parse(row.mealType_json),
    dietaryTags: JSON.parse(row.dietaryTags_json),
    ingredients: JSON.parse(row.ingredients_json),
    steps: JSON.parse(row.steps_json),
    tips: row.tips || undefined,
    isStarterPack: row.isStarterPack === 1,
    eitansPick: row.eitansPick === 1,
    text_blob: row.text_blob,
    fingerprint_hash: row.fingerprint_hash,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ==================== RECIPE CRUD ====================

export async function createRecipe(recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
  const id = uuidv4();
  const now = nowISO();

  await execute(
    `INSERT INTO recipes (
      id, title, creator, sourceUrl, sourcePlatform, imageUri, description,
      prepTime, cookTime, totalTime, servings, difficulty, cuisineType,
      mealType_json, dietaryTags_json, ingredients_json, steps_json,
      tips, isStarterPack, eitansPick, text_blob, fingerprint_hash,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      recipe.title,
      recipe.creator || null,
      recipe.sourceUrl || null,
      recipe.sourcePlatform || null,
      recipe.imageUri || null,
      recipe.description || null,
      recipe.prepTime || null,
      recipe.cookTime || null,
      recipe.totalTime || null,
      recipe.servings || null,
      recipe.difficulty || null,
      recipe.cuisineType || null,
      JSON.stringify(recipe.mealType || []),
      JSON.stringify(recipe.dietaryTags || []),
      JSON.stringify(recipe.ingredients || []),
      JSON.stringify(recipe.steps || []),
      recipe.tips || null,
      recipe.isStarterPack ? 1 : 0,
      recipe.eitansPick ? 1 : 0,
      recipe.text_blob || '',
      recipe.fingerprint_hash || '',
      now,
      now,
    ]
  );

  return id;
}

export async function upsertRecipe(recipe: Recipe): Promise<void> {
  const now = nowISO();

  await execute(
    `INSERT OR REPLACE INTO recipes (
      id, title, creator, sourceUrl, sourcePlatform, imageUri, description,
      prepTime, cookTime, totalTime, servings, difficulty, cuisineType,
      mealType_json, dietaryTags_json, ingredients_json, steps_json,
      tips, isStarterPack, eitansPick, text_blob, fingerprint_hash,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recipe.id,
      recipe.title,
      recipe.creator || null,
      recipe.sourceUrl || null,
      recipe.sourcePlatform || null,
      recipe.imageUri || null,
      recipe.description || null,
      recipe.prepTime || null,
      recipe.cookTime || null,
      recipe.totalTime || null,
      recipe.servings || null,
      recipe.difficulty || null,
      recipe.cuisineType || null,
      JSON.stringify(recipe.mealType || []),
      JSON.stringify(recipe.dietaryTags || []),
      JSON.stringify(recipe.ingredients || []),
      JSON.stringify(recipe.steps || []),
      recipe.tips || null,
      recipe.isStarterPack ? 1 : 0,
      recipe.eitansPick ? 1 : 0,
      recipe.text_blob || '',
      recipe.fingerprint_hash || '',
      recipe.created_at || now,
      now,
    ]
  );
}

export async function updateRecipe(id: string, updates: Partial<Recipe>): Promise<void> {
  const recipe = await getRecipeById(id);
  if (!recipe) throw new Error(`Recipe ${id} not found`);

  const updated = { ...recipe, ...updates, updated_at: nowISO() };
  await upsertRecipe(updated);
}

export async function deleteRecipe(id: string): Promise<void> {
  await execute('DELETE FROM recipes WHERE id = ?', [id]);
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const rows = await query<RecipeRow>('SELECT * FROM recipes WHERE id = ?', [id]);
  return rows.length > 0 ? rowToRecipe(rows[0]) : null;
}

export async function getRecipeByFingerprint(fingerprint: string): Promise<Recipe | null> {
  const rows = await query<RecipeRow>(
    'SELECT * FROM recipes WHERE fingerprint_hash = ?',
    [fingerprint]
  );
  return rows.length > 0 ? rowToRecipe(rows[0]) : null;
}

export async function listRecipes(filters: SearchFilters): Promise<Recipe[]> {
  let sql = 'SELECT * FROM recipes WHERE 1=1';
  const params: unknown[] = [];

  if (filters.query) {
    sql += ' AND (title LIKE ? OR text_blob LIKE ?)';
    const searchTerm = `%${filters.query}%`;
    params.push(searchTerm, searchTerm);
  }

  if (filters.cuisineType) {
    sql += ' AND cuisineType = ?';
    params.push(filters.cuisineType);
  }

  if (filters.difficulty) {
    sql += ' AND difficulty = ?';
    params.push(filters.difficulty);
  }

  if (filters.mealType) {
    sql += ' AND mealType_json LIKE ?';
    params.push(`%"${filters.mealType}"%`);
  }

  if (filters.dietaryTag) {
    sql += ' AND dietaryTags_json LIKE ?';
    params.push(`%"${filters.dietaryTag}"%`);
  }

  if (filters.maxTime) {
    sql += ' AND totalTime <= ?';
    params.push(filters.maxTime);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = await query<RecipeRow>(sql, params);
  return rows.map(rowToRecipe);
}

export async function getAllRecipes(): Promise<Recipe[]> {
  const rows = await query<RecipeRow>('SELECT * FROM recipes ORDER BY created_at DESC');
  return rows.map(rowToRecipe);
}

// ==================== RECIPE IMAGES ====================

export async function addRecipeImage(
  recipeId: string,
  path: string,
  kind: 'hero' | 'step' | 'gallery' = 'hero'
): Promise<string> {
  const id = uuidv4();
  await execute(
    'INSERT INTO recipe_images (id, recipe_id, path, kind, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, recipeId, path, kind, nowISO()]
  );
  return id;
}

export async function getRecipeImages(recipeId: string): Promise<RecipeImage[]> {
  return query<RecipeImage>(
    'SELECT * FROM recipe_images WHERE recipe_id = ? ORDER BY created_at',
    [recipeId]
  );
}

export async function deleteRecipeImage(id: string): Promise<void> {
  await execute('DELETE FROM recipe_images WHERE id = ?', [id]);
}

// ==================== USAGE EVENTS ====================

export async function addUsageEvent(
  event: Omit<UsageEvent, 'id' | 'created_at'>
): Promise<string> {
  const id = uuidv4();
  await execute(
    'INSERT INTO usage_events (id, recipe_id, type, ref_id, where_text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, event.recipe_id, event.type, event.ref_id || null, event.where_text || null, nowISO()]
  );
  return id;
}

export async function listUsageByRecipe(recipeId: string): Promise<UsageEvent[]> {
  return query<UsageEvent>(
    'SELECT * FROM usage_events WHERE recipe_id = ? ORDER BY created_at DESC',
    [recipeId]
  );
}

export async function getRecipeUsageCount(recipeId: string): Promise<number> {
  const result = await query<{ count: number }>(
    'SELECT COUNT(*) as count FROM usage_events WHERE recipe_id = ?',
    [recipeId]
  );
  return result[0]?.count || 0;
}

export async function getUnusedRecipes(): Promise<Recipe[]> {
  const rows = await query<RecipeRow>(
    `SELECT r.* FROM recipes r
     LEFT JOIN usage_events u ON r.id = u.recipe_id
     WHERE u.id IS NULL
     ORDER BY r.created_at DESC`
  );
  return rows.map(rowToRecipe);
}

// ==================== PACKS ====================

export async function createPack(
  pack: Omit<Pack, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  const id = uuidv4();
  const now = nowISO();

  await execute(
    `INSERT INTO packs (id, name, description, creator, creatorHandle, version, lastUpdated, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      pack.name,
      pack.description || null,
      pack.creator || null,
      pack.creatorHandle || null,
      pack.version || '1.0.0',
      pack.lastUpdated || now,
      now,
      now,
    ]
  );

  return id;
}

export async function updatePack(id: string, updates: Partial<Pack>): Promise<void> {
  const pack = await getPackById(id);
  if (!pack) throw new Error(`Pack ${id} not found`);

  await execute(
    `UPDATE packs SET
      name = ?, description = ?, creator = ?, creatorHandle = ?,
      version = ?, lastUpdated = ?, updated_at = ?
     WHERE id = ?`,
    [
      updates.name ?? pack.name,
      updates.description ?? pack.description ?? null,
      updates.creator ?? pack.creator ?? null,
      updates.creatorHandle ?? pack.creatorHandle ?? null,
      updates.version ?? pack.version,
      updates.lastUpdated ?? nowISO(),
      nowISO(),
      id,
    ]
  );
}

export async function deletePack(id: string): Promise<void> {
  await execute('DELETE FROM pack_recipes WHERE pack_id = ?', [id]);
  await execute('DELETE FROM packs WHERE id = ?', [id]);
}

export async function getPackById(id: string): Promise<Pack | null> {
  const rows = await query<Pack>('SELECT * FROM packs WHERE id = ?', [id]);
  return rows.length > 0 ? rows[0] : null;
}

export async function listPacks(): Promise<Pack[]> {
  return query<Pack>('SELECT * FROM packs ORDER BY created_at DESC');
}

// ==================== PACK RECIPES ====================

export async function addRecipeToPack(
  packId: string,
  recipeId: string,
  orderIndex: number
): Promise<void> {
  await execute(
    'INSERT OR REPLACE INTO pack_recipes (pack_id, recipe_id, order_index) VALUES (?, ?, ?)',
    [packId, recipeId, orderIndex]
  );
}

export async function removeRecipeFromPack(packId: string, recipeId: string): Promise<void> {
  await execute('DELETE FROM pack_recipes WHERE pack_id = ? AND recipe_id = ?', [packId, recipeId]);
}

export async function reorderPackRecipes(
  packId: string,
  orders: { recipeId: string; orderIndex: number }[]
): Promise<void> {
  for (const { recipeId, orderIndex } of orders) {
    await execute(
      'UPDATE pack_recipes SET order_index = ? WHERE pack_id = ? AND recipe_id = ?',
      [orderIndex, packId, recipeId]
    );
  }
}

export async function listPackRecipes(packId: string): Promise<Recipe[]> {
  const rows = await query<RecipeRow>(
    `SELECT r.* FROM recipes r
     INNER JOIN pack_recipes pr ON r.id = pr.recipe_id
     WHERE pr.pack_id = ?
     ORDER BY pr.order_index`,
    [packId]
  );
  return rows.map(rowToRecipe);
}

export async function getPackRecipeIds(packId: string): Promise<string[]> {
  const rows = await query<{ recipe_id: string }>(
    'SELECT recipe_id FROM pack_recipes WHERE pack_id = ? ORDER BY order_index',
    [packId]
  );
  return rows.map((r) => r.recipe_id);
}

// ==================== SIMILARITY CACHE ====================

export async function saveSimilarityCache(
  recipeId: string,
  otherId: string,
  score: number,
  explanation: object
): Promise<void> {
  await execute(
    'INSERT OR REPLACE INTO similarity_cache (recipe_id, other_recipe_id, score, explain_json) VALUES (?, ?, ?, ?)',
    [recipeId, otherId, score, JSON.stringify(explanation)]
  );
}

export async function getSimilarityForRecipe(
  recipeId: string
): Promise<SimilarityCache[]> {
  return query<SimilarityCache>(
    'SELECT * FROM similarity_cache WHERE recipe_id = ? ORDER BY score DESC',
    [recipeId]
  );
}

export async function clearSimilarityCache(recipeId?: string): Promise<void> {
  if (recipeId) {
    await execute(
      'DELETE FROM similarity_cache WHERE recipe_id = ? OR other_recipe_id = ?',
      [recipeId, recipeId]
    );
  } else {
    await execute('DELETE FROM similarity_cache');
  }
}
