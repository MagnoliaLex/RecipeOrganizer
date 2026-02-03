import type { Recipe } from '../../types';
import { calculateSimilarity, calculatePackDiversity } from '../similarity/score';

export interface PackValidation {
  isValid: boolean;
  warnings: string[];
  similarityWarnings: SimilarityWarning[];
  diversityScore: number;
  cuisineBreakdown: Record<string, number>;
  mealTypeBreakdown: Record<string, number>;
}

export interface SimilarityWarning {
  recipeA: { id: string; title: string };
  recipeB: { id: string; title: string };
  similarity: number;
}

const SIMILARITY_THRESHOLD = 0.80;
const MAX_SAME_CUISINE_PERCENT = 0.5;
const MAX_SAME_MEALTYPE_PERCENT = 0.6;

/**
 * Validate a pack of recipes
 * - Warns if any recipe pair has similarity > 0.80
 * - Warns if too many same cuisine or mealType
 */
export function validatePack(recipes: Recipe[]): PackValidation {
  const warnings: string[] = [];
  const similarityWarnings: SimilarityWarning[] = [];

  if (recipes.length === 0) {
    return {
      isValid: false,
      warnings: ['Pack has no recipes'],
      similarityWarnings: [],
      diversityScore: 0,
      cuisineBreakdown: {},
      mealTypeBreakdown: {},
    };
  }

  // Check similarity between all pairs
  for (let i = 0; i < recipes.length; i++) {
    for (let j = i + 1; j < recipes.length; j++) {
      const similarity = calculateSimilarity(recipes[i], recipes[j]);

      if (similarity.totalScore >= SIMILARITY_THRESHOLD) {
        similarityWarnings.push({
          recipeA: { id: recipes[i].id, title: recipes[i].title },
          recipeB: { id: recipes[j].id, title: recipes[j].title },
          similarity: similarity.totalScore,
        });

        warnings.push(
          `"${recipes[i].title}" and "${recipes[j].title}" are ${Math.round(
            similarity.totalScore * 100
          )}% similar`
        );
      }
    }
  }

  // Calculate cuisine breakdown
  const cuisineBreakdown: Record<string, number> = {};
  for (const recipe of recipes) {
    const cuisine = recipe.cuisineType || 'Unknown';
    cuisineBreakdown[cuisine] = (cuisineBreakdown[cuisine] || 0) + 1;
  }

  // Check for cuisine dominance
  for (const [cuisine, count] of Object.entries(cuisineBreakdown)) {
    const percent = count / recipes.length;
    if (percent > MAX_SAME_CUISINE_PERCENT && recipes.length > 2) {
      warnings.push(
        `${Math.round(percent * 100)}% of recipes are ${cuisine} cuisine`
      );
    }
  }

  // Calculate meal type breakdown
  const mealTypeBreakdown: Record<string, number> = {};
  for (const recipe of recipes) {
    for (const mealType of recipe.mealType) {
      mealTypeBreakdown[mealType] = (mealTypeBreakdown[mealType] || 0) + 1;
    }
  }

  // Check for meal type dominance
  for (const [mealType, count] of Object.entries(mealTypeBreakdown)) {
    const percent = count / recipes.length;
    if (percent > MAX_SAME_MEALTYPE_PERCENT && recipes.length > 2) {
      warnings.push(
        `${Math.round(percent * 100)}% of recipes are ${mealType}`
      );
    }
  }

  // Calculate diversity score
  const diversityScore = calculatePackDiversity(recipes);

  if (diversityScore < 0.4 && recipes.length > 3) {
    warnings.push(`Pack diversity is low (${Math.round(diversityScore * 100)}%)`);
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    similarityWarnings,
    diversityScore,
    cuisineBreakdown,
    mealTypeBreakdown,
  };
}

/**
 * Get suggestions to improve pack diversity
 */
export function getDiversitySuggestions(
  validation: PackValidation
): string[] {
  const suggestions: string[] = [];

  if (validation.similarityWarnings.length > 0) {
    suggestions.push('Consider removing one recipe from similar pairs');
  }

  const cuisines = Object.entries(validation.cuisineBreakdown);
  if (cuisines.length === 1) {
    suggestions.push('Add recipes from different cuisines for variety');
  }

  const mealTypes = Object.entries(validation.mealTypeBreakdown);
  if (mealTypes.length === 1) {
    suggestions.push('Add recipes for different meal types');
  }

  if (validation.diversityScore < 0.5) {
    suggestions.push('Mix recipes with different cooking techniques');
    suggestions.push('Include recipes with varying difficulty levels');
  }

  return suggestions;
}
