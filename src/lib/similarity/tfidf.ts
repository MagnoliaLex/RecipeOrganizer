import { tokenize, tokenizeStemmed } from './tokenize';

/**
 * Term Frequency - how often a term appears in a document
 * TF(t, d) = count(t in d) / total terms in d
 */
export function termFrequency(term: string, document: string[]): number {
  if (document.length === 0) return 0;

  const count = document.filter((t) => t === term).length;
  return count / document.length;
}

/**
 * Inverse Document Frequency - how rare a term is across documents
 * IDF(t, D) = log(N / (1 + df(t)))
 * where N = total documents, df(t) = documents containing term t
 */
export function inverseDocumentFrequency(
  term: string,
  documents: string[][]
): number {
  const docCount = documents.filter((doc) => doc.includes(term)).length;
  return Math.log(documents.length / (1 + docCount));
}

/**
 * TF-IDF score for a term in a document
 */
export function tfidf(
  term: string,
  document: string[],
  documents: string[][]
): number {
  return termFrequency(term, document) * inverseDocumentFrequency(term, documents);
}

/**
 * Calculate TF-IDF vectors for documents
 */
export interface TfidfVector {
  terms: string[];
  values: number[];
}

export function calculateTfidfVectors(texts: string[]): TfidfVector[] {
  // Tokenize all documents
  const documents = texts.map((text) => tokenizeStemmed(text));

  // Get all unique terms
  const allTerms = new Set<string>();
  for (const doc of documents) {
    for (const term of doc) {
      allTerms.add(term);
    }
  }

  const termsList = [...allTerms];

  // Calculate TF-IDF vector for each document
  return documents.map((doc) => {
    const values = termsList.map((term) => tfidf(term, doc, documents));
    return { terms: termsList, values };
  });
}

/**
 * Calculate TF-IDF vector for a single document given a corpus
 */
export function calculateTfidfVector(
  text: string,
  corpus: string[]
): TfidfVector {
  const document = tokenizeStemmed(text);
  const documents = corpus.map((t) => tokenizeStemmed(t));

  // Get all unique terms from corpus + document
  const allTerms = new Set<string>();
  for (const doc of [...documents, document]) {
    for (const term of doc) {
      allTerms.add(term);
    }
  }

  const termsList = [...allTerms];
  const allDocuments = [...documents, document];

  const values = termsList.map((term) =>
    tfidf(term, document, allDocuments)
  );

  return { terms: termsList, values };
}

/**
 * Get top N terms by TF-IDF score
 */
export function getTopTerms(
  text: string,
  corpus: string[],
  n: number = 10
): { term: string; score: number }[] {
  const vector = calculateTfidfVector(text, corpus);

  const scored = vector.terms.map((term, i) => ({
    term,
    score: vector.values[i],
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
