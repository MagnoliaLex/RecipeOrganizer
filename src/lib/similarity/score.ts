import type { Recipe, SimilarRecipe } from '../../types';
import { ingredientJaccard, getIngredientOverlap } from './jaccard';
import { calculateTfidfVector, type TfidfVector } from './tfidf';
import { tfidfCosineSimilarity, frequencyCosineSimilarity } from './cosine';
import { getWordFrequency } from './tokenize';
import { getAllRecipes, getRecipeById, saveSimilarityCache, getSimilarityForRecipe } from '../db/queries';

// Scoring weights
const WEIGHTS = {
  ingredient: 0.55,
  textBlob: 0.35,
  metadata: 0.10,
};

export interface SimilarityExplanation {
  ingredientScore: number;
  textScore: number;
  metadataScore: number;
  commonIngredients: string[];
  totalScore: number;
}

/**
 * Calculate metadata similarity between two recipes
 * Compares: cuisine, difficulty, time bucket, mealType
 */
function metadataSimilarity(a: Recipe, b: Recipe): number {
  let matches = 0;
  let total = 0;

  // Cuisine type
  if (a.cuisineType || b.cuisineType) {
    total++;
    if (a.cuisineType === b.cuisineType) matches++;
  }

  // Difficulty
  if (a.difficulty || b.difficulty) {
    total++;
    if (a.difficulty === b.difficulty) matches++;
  }

  // Time bucket
  const timeBucketA = getTimeBucket(a.totalTime);
  const timeBucketB = getTimeBucket(b.totalTime);
  if (timeBucketA || timeBucketB) {
    total++;
    if (timeBucketA === timeBucketB) matches++;
  }

  // Meal type overlap
  if (a.mealType.length > 0 || b.mealType.length > 0) {
    total++;
    const mealOverlap = a.mealType.filter((m) => b.mealType.includes(m));
    if (mealOverlap.length > 0) {
      matches += mealOverlap.length / Math.max(a.mealType.length, b.mealType.length);
    }
  }

  return total > 0 ? matches / total : 0;
}

function getTimeBucket(time?: number): string | null {
  if (!time) return null;
  if (time <= 15) return 'quick15';
  if (time <= 30) return 'quick30';
  if (time <= 45) return 'medium45';
  return 'longer60';
}

/**
 * Calculate overall similarity score between two recipes
 */
export function calculateSimilarity(a: Recipe, b: Recipe): SimilarityExplanation {
  // 1. Ingredient Jaccard similarity (55%)
  const ingredientOverlap = getIngredientOverlap(a.ingredients, b.ingredients);
  const ingredientScore = ingredientOverlap.score;

  // 2. TF-IDF cosine similarity on text_blob (35%)
  const freqA = getWordFrequency(a.text_blob);
  const freqB = getWordFrequency(b.text_blob);
  const textScore = frequencyCosineSimilarity(freqA, freqB);

  // 3. Metadata similarity (10%)
  const metadataScore = metadataSimilarity(a, b);

  // Weighted total
  const totalScore =
    ingredientScore * WEIGHTS.ingredient +
    textScore * WEIGHTS.textBlob +
    metadataScore * WEIGHTS.metadata;

  return {
    ingredientScore,
    textScore,
    metadataScore,
    commonIngredients: ingredientOverlap.commonIngredients,
    totalScore,
  };
}

/**
 * Get similar recipes for a given recipe ID
 * Uses cache when available, calculates and caches otherwise
 */
export async function getSimilarRecipes(
  recipeId: string,
  limit: number = 10
): Promise<SimilarRecipe[]> {
  const targetRecipe = await getRecipeById(recipeId);
  if (!targetRecipe) return [];

  // Check cache first
  const cached = await getSimilarityForRecipe(recipeId);
  if (cached.length > 0) {
    const results: SimilarRecipe[] = [];

    for (const cache of cached.slice(0, limit)) {
      const recipe = await getRecipeById(cache.other_recipe_id);
      if (recipe) {
        const explanation = JSON.parse(cache.explain_json || '{}');
        results.push({
          recipe,
          score: cache.score,
          explanation: {
            ingredientScore: explanation.ingredientScore || 0,
            textScore: explanation.textScore || 0,
            metadataScore: explanation.metadataScore || 0,
          },
        });
      }
    }

    return results;
  }

  // Calculate similarities for all recipes
  const allRecipes = await getAllRecipes();
  const similarities: SimilarRecipe[] = [];

  for (const recipe of allRecipes) {
    if (recipe.id === recipeId) continue;

    const explanation = calculateSimilarity(targetRecipe, recipe);

    similarities.push({
      recipe,
      score: explanation.totalScore,
      explanation: {
        ingredientScore: explanation.ingredientScore,
        textScore: explanation.textScore,
        metadataScore: explanation.metadataScore,
      },
    });

    // Cache the result
    await saveSimilarityCache(recipeId, recipe.id, explanation.totalScore, explanation);
  }

  // Sort by score descending and return top N
  return similarities
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Find recipes similar to a given recipe without caching
 * Useful for pack suggestions where we don't want to cache
 */
export async function findSimilarRecipes(
  targetRecipe: Recipe,
  candidates: Recipe[],
  limit: number = 10
): Promise<SimilarRecipe[]> {
  const similarities: SimilarRecipe[] = [];

  for (const recipe of candidates) {
    if (recipe.id === targetRecipe.id) continue;

    const explanation = calculateSimilarity(targetRecipe, recipe);

    similarities.push({
      recipe,
      score: explanation.totalScore,
      explanation: {
        ingredientScore: explanation.ingredientScore,
        textScore: explanation.textScore,
        metadataScore: explanation.metadataScore,
      },
    });
  }

  return similarities
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Check if two recipes are too similar (for pack validation)
 */
export function areTooSimilar(a: Recipe, b: Recipe, threshold: number = 0.80): boolean {
  const similarity = calculateSimilarity(a, b);
  return similarity.totalScore >= threshold;
}

/**
 * Calculate average similarity within a set of recipes
 * Lower is better for pack diversity
 */
export function calculatePackDiversity(recipes: Recipe[]): number {
  if (recipes.length < 2) return 1;

  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < recipes.length; i++) {
    for (let j = i + 1; j < recipes.length; j++) {
      const similarity = calculateSimilarity(recipes[i], recipes[j]);
      totalSimilarity += similarity.totalScore;
      comparisons++;
    }
  }

  const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;

  // Diversity is inverse of average similarity
  return 1 - avgSimilarity;
}
