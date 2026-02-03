import type { Recipe } from '../../types';
import { normalizeRecipe } from './normalize';
import { generateFingerprint } from './fingerprint';
import { upsertRecipe } from '../db/queries';

/**
 * Import single recipe or array of recipes from JSON
 *
 * Accepts:
 * - Single recipe object
 * - Array of recipe objects
 */
export async function importRecipeJson(
  jsonContent: string,
  previewOnly: boolean = false
): Promise<Recipe[]> {
  const data = JSON.parse(jsonContent);

  const rawRecipes: Record<string, unknown>[] = Array.isArray(data) ? data : [data];
  const now = new Date().toISOString();
  const recipes: Recipe[] = [];

  for (const rawRecipe of rawRecipes) {
    // Skip if clearly not a recipe object
    if (!rawRecipe || typeof rawRecipe !== 'object') continue;
    if (!rawRecipe.title && !rawRecipe.name) continue;

    const normalized = normalizeRecipe(rawRecipe);
    normalized.fingerprint_hash = generateFingerprint(normalized);

    const recipe: Recipe = {
      ...normalized,
      created_at: now,
      updated_at: now,
    };

    recipes.push(recipe);
  }

  if (recipes.length === 0) {
    throw new Error('No valid recipes found in JSON');
  }

  // If preview only, return without saving
  if (previewOnly) {
    return recipes;
  }

  // Save recipes to database
  for (const recipe of recipes) {
    await upsertRecipe(recipe);
  }

  return recipes;
}

/**
 * Check if JSON content looks like a recipe or array of recipes
 */
export function isRecipeJson(jsonContent: string): boolean {
  try {
    const data = JSON.parse(jsonContent);

    if (Array.isArray(data)) {
      return data.length > 0 && (data[0].title || data[0].name || data[0].ingredients);
    }

    return Boolean(data.title || data.name || data.ingredients);
  } catch {
    return false;
  }
}
