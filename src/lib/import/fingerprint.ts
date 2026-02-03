import type { Recipe, Ingredient } from '../../types';
import { getAllRecipes, getRecipeByFingerprint } from '../db/queries';

/**
 * Generates a stable fingerprint hash for a recipe based on:
 * - Title nouns (lowercase, sorted)
 * - Ingredient items (lowercase, sorted)
 */
export function generateFingerprint(recipe: Partial<Recipe>): string {
  const parts: string[] = [];

  // Extract nouns from title (simplified: just use lowercase words > 3 chars)
  if (recipe.title) {
    const titleWords = recipe.title
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
      .sort();
    parts.push(...titleWords);
  }

  // Extract ingredient items
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    const ingredientItems = recipe.ingredients
      .map((ing) => normalizeIngredientItem(ing.item))
      .filter(Boolean)
      .sort();
    parts.push(...ingredientItems);
  }

  // Create hash from sorted parts
  const combined = parts.join('|');
  return simpleHash(combined);
}

/**
 * Normalize ingredient item for fingerprinting
 */
function normalizeIngredientItem(item: string): string {
  return item
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .sort()
    .join(' ');
}

/**
 * Simple string hash function (djb2)
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Calculate Jaccard similarity between two ingredient sets
 */
export function ingredientJaccard(a: Ingredient[], b: Ingredient[]): number {
  const setA = new Set(a.map((i) => normalizeIngredientItem(i.item)));
  const setB = new Set(b.map((i) => normalizeIngredientItem(i.item)));

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export interface DuplicateWarning {
  newRecipe: Pick<Recipe, 'id' | 'title'>;
  existingRecipe: Pick<Recipe, 'id' | 'title'>;
  similarity: number;
  reason: 'exact_id' | 'fingerprint_match' | 'ingredient_similarity';
}

/**
 * Find potential duplicates for a list of recipes
 */
export async function findDuplicates(
  recipes: Recipe[],
  threshold: number = 0.7
): Promise<DuplicateWarning[]> {
  const warnings: DuplicateWarning[] = [];
  const existingRecipes = await getAllRecipes();

  for (const newRecipe of recipes) {
    // Check exact ID match
    const idMatch = existingRecipes.find((r) => r.id === newRecipe.id);
    if (idMatch) {
      warnings.push({
        newRecipe: { id: newRecipe.id, title: newRecipe.title },
        existingRecipe: { id: idMatch.id, title: idMatch.title },
        similarity: 1,
        reason: 'exact_id',
      });
      continue;
    }

    // Check fingerprint match
    if (newRecipe.fingerprint_hash) {
      const fingerprintMatch = existingRecipes.find(
        (r) => r.fingerprint_hash === newRecipe.fingerprint_hash
      );
      if (fingerprintMatch) {
        warnings.push({
          newRecipe: { id: newRecipe.id, title: newRecipe.title },
          existingRecipe: { id: fingerprintMatch.id, title: fingerprintMatch.title },
          similarity: 0.95,
          reason: 'fingerprint_match',
        });
        continue;
      }
    }

    // Check ingredient similarity
    for (const existing of existingRecipes) {
      const similarity = ingredientJaccard(newRecipe.ingredients, existing.ingredients);
      if (similarity >= threshold) {
        warnings.push({
          newRecipe: { id: newRecipe.id, title: newRecipe.title },
          existingRecipe: { id: existing.id, title: existing.title },
          similarity,
          reason: 'ingredient_similarity',
        });
        break; // Only report first match
      }
    }
  }

  return warnings;
}

/**
 * Check if a single recipe is a duplicate
 */
export async function checkDuplicate(
  recipe: Recipe,
  threshold: number = 0.7
): Promise<DuplicateWarning | null> {
  const warnings = await findDuplicates([recipe], threshold);
  return warnings.length > 0 ? warnings[0] : null;
}
