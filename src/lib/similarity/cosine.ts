import type { TfidfVector } from './tfidf';

/**
 * Calculate cosine similarity between two vectors
 * cos(θ) = (A · B) / (||A|| × ||B||)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  if (a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}

/**
 * Calculate cosine similarity between two TF-IDF vectors
 */
export function tfidfCosineSimilarity(a: TfidfVector, b: TfidfVector): number {
  // Build combined term set
  const allTerms = new Set([...a.terms, ...b.terms]);
  const termsList = [...allTerms];

  // Create aligned vectors
  const vectorA: number[] = [];
  const vectorB: number[] = [];

  for (const term of termsList) {
    const idxA = a.terms.indexOf(term);
    const idxB = b.terms.indexOf(term);

    vectorA.push(idxA >= 0 ? a.values[idxA] : 0);
    vectorB.push(idxB >= 0 ? b.values[idxB] : 0);
  }

  return cosineSimilarity(vectorA, vectorB);
}

/**
 * Calculate cosine similarity from word frequency maps
 */
export function frequencyCosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  const allTerms = new Set([...a.keys(), ...b.keys()]);

  const vectorA: number[] = [];
  const vectorB: number[] = [];

  for (const term of allTerms) {
    vectorA.push(a.get(term) || 0);
    vectorB.push(b.get(term) || 0);
  }

  return cosineSimilarity(vectorA, vectorB);
}

/**
 * Euclidean distance between vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Convert Euclidean distance to similarity (0-1)
 */
export function euclideanToSimilarity(distance: number): number {
  return 1 / (1 + distance);
}
