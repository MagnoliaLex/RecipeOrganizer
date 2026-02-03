/**
 * Text tokenization utilities for similarity scoring
 */

// Common stop words to remove
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'also', 'now', 'add', 'put', 'use', 'get', 'make', 'let',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'it', 'its', 'this',
  'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our',
  'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
  'who', 'whom', 'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'minute',
  'minutes', 'hour', 'hours', 'degrees', 'inch', 'inches',
]);

/**
 * Tokenize text into normalized words
 */
export function tokenize(text: string): string[] {
  if (!text) return [];

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Tokenize and deduplicate
 */
export function tokenizeUnique(text: string): string[] {
  return [...new Set(tokenize(text))];
}

/**
 * Get word frequency map
 */
export function getWordFrequency(text: string): Map<string, number> {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();

  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  return freq;
}

/**
 * Stem a word (simple suffix removal)
 */
export function stem(word: string): string {
  // Simple stemming - remove common suffixes
  return word
    .replace(/ing$/, '')
    .replace(/ed$/, '')
    .replace(/es$/, '')
    .replace(/s$/, '')
    .replace(/ly$/, '')
    .replace(/ness$/, '')
    .replace(/ment$/, '')
    .replace(/tion$/, '');
}

/**
 * Tokenize with stemming
 */
export function tokenizeStemmed(text: string): string[] {
  return tokenize(text).map(stem);
}

/**
 * Create n-grams from tokens
 */
export function ngrams(tokens: string[], n: number = 2): string[] {
  if (tokens.length < n) return [];

  const result: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    result.push(tokens.slice(i, i + n).join(' '));
  }

  return result;
}
