import type { Ingredient } from '../../types';
import { stem } from './tokenize';

/**
 * Calculate Jaccard similarity between two sets
 * J(A, B) = |A ∩ B| / |A ∪ B|
 */
export function jaccardSimilarity<T>(setA: Set<T>, setB: Set<T>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Normalize ingredient item for comparison
 */
function normalizeIngredientItem(item: string): string {
  return item
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .map(stem)
    .filter((w) => w.length > 2)
    .sort()
    .join(' ');
}

/**
 * Calculate Jaccard similarity between two ingredient lists
 */
export function ingredientJaccard(a: Ingredient[], b: Ingredient[]): number {
  const setA = new Set(a.map((i) => normalizeIngredientItem(i.item)).filter(Boolean));
  const setB = new Set(b.map((i) => normalizeIngredientItem(i.item)).filter(Boolean));

  return jaccardSimilarity(setA, setB);
}

/**
 * Calculate weighted Jaccard similarity
 * Items can have weights/importance
 */
export function weightedJaccardSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  const allKeys = new Set([...a.keys(), ...b.keys()]);

  if (allKeys.size === 0) return 1;

  let minSum = 0;
  let maxSum = 0;

  for (const key of allKeys) {
    const valA = a.get(key) || 0;
    const valB = b.get(key) || 0;
    minSum += Math.min(valA, valB);
    maxSum += Math.max(valA, valB);
  }

  return maxSum > 0 ? minSum / maxSum : 0;
}

/**
 * Get ingredient importance weights
 * Main ingredients get higher weights
 */
export function getIngredientWeights(ingredients: Ingredient[]): Map<string, number> {
  const weights = new Map<string, number>();

  // Main protein/base ingredients get higher weights
  const mainIngredients = ['chicken', 'beef', 'pork', 'fish', 'tofu', 'rice', 'pasta', 'bread'];

  for (const ing of ingredients) {
    const normalized = normalizeIngredientItem(ing.item);
    if (!normalized) continue;

    let weight = 1;

    // Increase weight for main ingredients
    if (mainIngredients.some((main) => normalized.includes(main))) {
      weight = 2;
    }

    // Increase weight if quantity suggests main ingredient
    const qty = parseFloat(ing.quantity) || 0;
    if (qty > 1 || ing.unit?.match(/lb|pound|cup/i)) {
      weight += 0.5;
    }

    weights.set(normalized, weight);
  }

  return weights;
}

/**
 * Calculate ingredient overlap details
 */
export interface IngredientOverlap {
  score: number;
  commonIngredients: string[];
  uniqueToA: string[];
  uniqueToB: string[];
}

export function getIngredientOverlap(a: Ingredient[], b: Ingredient[]): IngredientOverlap {
  const setA = new Set(a.map((i) => normalizeIngredientItem(i.item)).filter(Boolean));
  const setB = new Set(b.map((i) => normalizeIngredientItem(i.item)).filter(Boolean));

  const common: string[] = [];
  const uniqueToA: string[] = [];
  const uniqueToB: string[] = [];

  for (const item of setA) {
    if (setB.has(item)) {
      common.push(item);
    } else {
      uniqueToA.push(item);
    }
  }

  for (const item of setB) {
    if (!setA.has(item)) {
      uniqueToB.push(item);
    }
  }

  return {
    score: jaccardSimilarity(setA, setB),
    commonIngredients: common,
    uniqueToA,
    uniqueToB,
  };
}
