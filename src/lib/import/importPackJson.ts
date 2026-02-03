import type { Recipe, InstaPlatePackExport } from '../../types';
import { normalizeRecipe } from './normalize';
import { generateFingerprint } from './fingerprint';
import { upsertRecipe, createPack, addRecipeToPack } from '../db/queries';

export interface ImportResult {
  recipes: Recipe[];
  packId?: string;
}

/**
 * Import an InstaPlate Pack JSON file
 *
 * Expected format:
 * {
 *   starterPack: { version, creator, creatorHandle, description, totalRecipes, lastUpdated },
 *   recipes: [...],
 *   metadata: { cuisineBreakdown, difficultyBreakdown, ... }
 * }
 */
export async function importPackJson(
  jsonContent: string,
  previewOnly: boolean = false,
  packName?: string
): Promise<ImportResult> {
  const data = JSON.parse(jsonContent) as InstaPlatePackExport;

  if (!data.recipes || !Array.isArray(data.recipes)) {
    throw new Error('Invalid pack format: missing recipes array');
  }

  const now = new Date().toISOString();
  const recipes: Recipe[] = [];

  // Process each recipe
  for (const rawRecipe of data.recipes) {
    const normalized = normalizeRecipe(rawRecipe as Record<string, unknown>);
    normalized.fingerprint_hash = generateFingerprint(normalized);

    const recipe: Recipe = {
      ...normalized,
      created_at: now,
      updated_at: now,
    };

    recipes.push(recipe);
  }

  // If preview only, return without saving
  if (previewOnly) {
    return { recipes };
  }

  // Save recipes to database
  for (const recipe of recipes) {
    await upsertRecipe(recipe);
  }

  // Create pack if requested
  let packId: string | undefined;
  if (packName || data.starterPack) {
    packId = await createPack({
      name: packName || data.starterPack?.description || 'Imported Pack',
      description: data.starterPack?.description,
      creator: data.starterPack?.creator,
      creatorHandle: data.starterPack?.creatorHandle,
      version: data.starterPack?.version || '1.0.0',
      lastUpdated: data.starterPack?.lastUpdated || now,
    });

    // Link recipes to pack in order
    for (let i = 0; i < recipes.length; i++) {
      await addRecipeToPack(packId, recipes[i].id, i);
    }
  }

  return { recipes, packId };
}

/**
 * Validate that JSON is a valid InstaPlate pack format
 */
export function isValidPackFormat(jsonContent: string): boolean {
  try {
    const data = JSON.parse(jsonContent);
    return (
      data.starterPack &&
      typeof data.starterPack === 'object' &&
      Array.isArray(data.recipes)
    );
  } catch {
    return false;
  }
}
