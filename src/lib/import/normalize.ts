import type { Ingredient, Recipe } from '../../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Normalizes ingredient data to standard format:
 * { quantity, unit, item, notes, category }
 */
export function normalizeIngredient(input: unknown): Ingredient {
  if (typeof input === 'string') {
    return parseIngredientString(input);
  }

  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    return {
      quantity: String(obj.quantity || obj.amount || ''),
      unit: String(obj.unit || ''),
      item: String(obj.item || obj.name || obj.ingredient || ''),
      notes: obj.notes ? String(obj.notes) : undefined,
      category: obj.category ? String(obj.category) : undefined,
    };
  }

  return { quantity: '', unit: '', item: String(input) };
}

/**
 * Parse a string ingredient like "2 cups flour, sifted"
 */
function parseIngredientString(str: string): Ingredient {
  const trimmed = str.trim();

  // Try to match patterns like "2 cups flour" or "1/2 tsp salt"
  const match = trimmed.match(
    /^([\d\s\/\-\.]+)?\s*(cups?|tbsp?|tsp?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|l|cloves?|pieces?|slices?|cans?|packages?|pkgs?|bunches?|heads?|stalks?)?\s*(.+?)(?:,\s*(.+))?$/i
  );

  if (match) {
    return {
      quantity: (match[1] || '').trim(),
      unit: (match[2] || '').trim(),
      item: (match[3] || '').trim(),
      notes: match[4] ? match[4].trim() : undefined,
    };
  }

  return { quantity: '', unit: '', item: trimmed };
}

/**
 * Normalizes steps to array of strings
 */
export function normalizeSteps(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((step) => {
      if (typeof step === 'string') return step.trim();
      if (typeof step === 'object' && step !== null) {
        const obj = step as Record<string, unknown>;
        return String(obj.text || obj.instruction || obj.description || obj.step || step);
      }
      return String(step);
    }).filter(Boolean);
  }

  if (typeof input === 'string') {
    // Split by numbered steps or newlines
    return input
      .split(/\n+|\d+\.\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Normalizes mealType to array
 */
export function normalizeMealType(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map(String).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Normalizes dietaryTags to array
 */
export function normalizeDietaryTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map(String).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Generates text blob for full-text search
 */
export function generateTextBlob(recipe: Partial<Recipe>): string {
  const parts: string[] = [];

  if (recipe.title) parts.push(recipe.title);
  if (recipe.description) parts.push(recipe.description);
  if (recipe.cuisineType) parts.push(recipe.cuisineType);
  if (recipe.difficulty) parts.push(recipe.difficulty);

  if (recipe.mealType) {
    parts.push(...recipe.mealType);
  }

  if (recipe.dietaryTags) {
    parts.push(...recipe.dietaryTags);
  }

  if (recipe.ingredients) {
    for (const ing of recipe.ingredients) {
      parts.push(ing.item);
      if (ing.category) parts.push(ing.category);
    }
  }

  if (recipe.steps) {
    parts.push(...recipe.steps);
  }

  if (recipe.tips) parts.push(recipe.tips);

  return parts.join(' ').toLowerCase();
}

/**
 * Normalizes a raw recipe object to standard Recipe format
 */
export function normalizeRecipe(input: Record<string, unknown>): Omit<Recipe, 'created_at' | 'updated_at'> {
  const ingredients = Array.isArray(input.ingredients)
    ? input.ingredients.map(normalizeIngredient)
    : [];

  const steps = normalizeSteps(input.steps || input.instructions || input.directions);
  const mealType = normalizeMealType(input.mealType || input.meal_type || input.mealTypes);
  const dietaryTags = normalizeDietaryTags(input.dietaryTags || input.dietary_tags || input.tags);

  const recipe: Omit<Recipe, 'created_at' | 'updated_at'> = {
    id: String(input.id || uuidv4()),
    title: String(input.title || input.name || 'Untitled Recipe'),
    creator: input.creator ? String(input.creator) : undefined,
    sourceUrl: input.sourceUrl ? String(input.sourceUrl) : undefined,
    sourcePlatform: input.sourcePlatform ? String(input.sourcePlatform) : undefined,
    imageUri: input.imageUri ? String(input.imageUri) : undefined,
    description: input.description ? String(input.description) : undefined,
    prepTime: typeof input.prepTime === 'number' ? input.prepTime : undefined,
    cookTime: typeof input.cookTime === 'number' ? input.cookTime : undefined,
    totalTime: typeof input.totalTime === 'number' ? input.totalTime : undefined,
    servings: typeof input.servings === 'number' ? input.servings : undefined,
    difficulty: input.difficulty ? String(input.difficulty) : undefined,
    cuisineType: input.cuisineType ? String(input.cuisineType) : undefined,
    mealType,
    dietaryTags,
    ingredients,
    steps,
    tips: input.tips ? String(input.tips) : undefined,
    isStarterPack: Boolean(input.isStarterPack),
    eitansPick: Boolean(input.eitansPick),
    text_blob: '',
    fingerprint_hash: '',
  };

  // Generate text blob after recipe is complete
  recipe.text_blob = generateTextBlob(recipe);

  return recipe;
}

/**
 * Calculate total time from prep and cook time
 */
export function calculateTotalTime(prepTime?: number, cookTime?: number): number | undefined {
  if (prepTime !== undefined && cookTime !== undefined) {
    return prepTime + cookTime;
  }
  return prepTime || cookTime;
}
