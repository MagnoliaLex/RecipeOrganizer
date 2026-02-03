import type { Recipe } from '../../types';
import { scrapeRecipeFromUrl } from '../import/scrapeUrl';

export interface CrawlOptions {
  query: string;
  maxResults: number;
  onProgress?: (progress: CrawlProgress) => void;
  onRecipeFound?: (recipe: Recipe) => void;
  signal?: AbortSignal;
}

export interface CrawlProgress {
  status: 'searching' | 'scraping' | 'complete' | 'cancelled' | 'error';
  currentUrl?: string;
  urlsFound: number;
  urlsProcessed: number;
  recipesFound: number;
  estimatedTimeRemaining?: number;
  startTime: number;
  errors: CrawlError[];
}

export interface CrawlError {
  url: string;
  message: string;
}

export interface CrawlResult {
  recipes: Recipe[];
  errors: CrawlError[];
  totalUrlsProcessed: number;
  totalTime: number;
  cancelled: boolean;
}

// Recipe website patterns for targeted crawling
const RECIPE_SITES = [
  { domain: 'allrecipes.com', searchUrl: 'https://www.allrecipes.com/search?q=' },
  { domain: 'epicurious.com', searchUrl: 'https://www.epicurious.com/search?q=' },
  { domain: 'food.com', searchUrl: 'https://www.food.com/search/' },
  { domain: 'foodnetwork.com', searchUrl: 'https://www.foodnetwork.com/search/' },
  { domain: 'simplyrecipes.com', searchUrl: 'https://www.simplyrecipes.com/?s=' },
  { domain: 'seriouseats.com', searchUrl: 'https://www.seriouseats.com/search?q=' },
  { domain: 'bonappetit.com', searchUrl: 'https://www.bonappetit.com/search?q=' },
  { domain: 'delish.com', searchUrl: 'https://www.delish.com/search/?q=' },
  { domain: 'tasty.co', searchUrl: 'https://tasty.co/search?q=' },
  { domain: 'cookinglight.com', searchUrl: 'https://www.cookinglight.com/search?q=' },
];

/**
 * Extract recipe URLs from HTML search results
 */
function extractRecipeUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();

  const getAbsoluteUrl = (path: string): string | null => {
    if (path.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        return `${base.protocol}//${base.host}${path}`;
      } catch {
        return null;
      }
    }
    return path;
  };

  // Match href attributes that look like recipe URLs
  const hrefRegex = /href=["']([^"']+(?:recipe|recipes)[^"']*)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const url = getAbsoluteUrl(match[1]);
    if (!url) continue;

    try {
      new URL(url);
      if (isValidRecipeUrl(url)) {
        urls.add(url);
      }
    } catch {
      continue;
    }
  }

  // Also try to find other potential recipe links
  const genericLinkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = genericLinkRegex.exec(html)) !== null) {
    const url = getAbsoluteUrl(match[1]);
    if (!url || urls.has(url)) continue;

    try {
      const parsed = new URL(url);
      // Include URLs that contain recipe-like path segments
      if (
        parsed.pathname.includes('/recipe') ||
        parsed.pathname.includes('/recipes/') ||
        parsed.pathname.match(/\/\d{4,}/) || // numeric IDs often indicate recipes
        parsed.pathname.match(/\/[a-z]+-[a-z]+-[a-z]+/) // slug patterns
      ) {
        urls.add(url);
      }
    } catch {
      continue;
    }
  }

  return Array.from(urls);
}

/**
 * Check if a URL is likely a valid recipe page (not a search/category page)
 */
function isValidRecipeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    // Exclude search/category/list pages
    const excludePatterns = [
      '/search',
      '/category',
      '/categories',
      '/tag/',
      '/tags/',
      '/collection',
      '/browse',
      '/index',
      '/page/',
      '/author/',
      '/about',
      '/contact',
      '/login',
      '/register',
      '/privacy',
      '/terms',
    ];

    if (excludePatterns.some(pattern => path.includes(pattern))) {
      return false;
    }

    // Must have some path (not just homepage)
    if (path === '/' || path === '') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Search for recipe URLs using a search engine or site-specific search
 */
async function searchForRecipeUrls(
  query: string,
  maxUrls: number,
  signal?: AbortSignal
): Promise<string[]> {
  const allUrls: string[] = [];
  const seenUrls = new Set<string>();

  // Try each recipe site's search
  for (const site of RECIPE_SITES) {
    if (signal?.aborted) break;
    if (allUrls.length >= maxUrls) break;

    try {
      const searchUrl = site.searchUrl + encodeURIComponent(query);

      const response = await fetch(searchUrl, {
        signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RecipeOrganizer/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) continue;

      const html = await response.text();
      const urls = extractRecipeUrls(html, searchUrl);

      for (const url of urls) {
        if (!seenUrls.has(url) && allUrls.length < maxUrls) {
          seenUrls.add(url);
          allUrls.push(url);
        }
      }

      // Small delay between sites to be polite
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      // Site search failed, continue to next
      if (e instanceof Error && e.name === 'AbortError') {
        break;
      }
      continue;
    }
  }

  return allUrls;
}

/**
 * Calculate estimated time remaining based on progress
 */
function calculateETA(
  startTime: number,
  processed: number,
  total: number
): number | undefined {
  if (processed === 0) return undefined;

  const elapsed = Date.now() - startTime;
  const avgTimePerItem = elapsed / processed;
  const remaining = total - processed;

  return Math.ceil(avgTimePerItem * remaining / 1000); // Return seconds
}

/**
 * Main crawl engine function
 */
export async function crawlForRecipes(options: CrawlOptions): Promise<CrawlResult> {
  const { query, maxResults, onProgress, onRecipeFound, signal } = options;

  const startTime = Date.now();
  const recipes: Recipe[] = [];
  const errors: CrawlError[] = [];
  let cancelled = false;

  const progress: CrawlProgress = {
    status: 'searching',
    urlsFound: 0,
    urlsProcessed: 0,
    recipesFound: 0,
    startTime,
    errors: [],
  };

  // Notify initial progress
  onProgress?.(progress);

  // Check for cancellation
  if (signal?.aborted) {
    return {
      recipes,
      errors,
      totalUrlsProcessed: 0,
      totalTime: Date.now() - startTime,
      cancelled: true,
    };
  }

  // Search for recipe URLs
  const urlsToProcess = await searchForRecipeUrls(
    query,
    maxResults * 3, // Get extra URLs since some will fail
    signal
  );

  progress.urlsFound = urlsToProcess.length;
  progress.status = 'scraping';
  onProgress?.(progress);

  // Process each URL
  for (const url of urlsToProcess) {
    // Check for cancellation
    if (signal?.aborted) {
      cancelled = true;
      break;
    }

    // Stop if we have enough recipes
    if (recipes.length >= maxResults) {
      break;
    }

    progress.currentUrl = url;
    onProgress?.(progress);

    try {
      const recipe = await scrapeRecipeFromUrl(url, true);
      recipes.push(recipe);
      progress.recipesFound = recipes.length;

      // Notify about found recipe
      onRecipeFound?.(recipe);
    } catch (e) {
      const error: CrawlError = {
        url,
        message: e instanceof Error ? e.message : 'Unknown error',
      };
      errors.push(error);
      progress.errors.push(error);
    }

    progress.urlsProcessed++;
    progress.estimatedTimeRemaining = calculateETA(
      startTime,
      progress.urlsProcessed,
      Math.min(urlsToProcess.length, maxResults * 2)
    );
    onProgress?.(progress);

    // Small delay between requests to be polite
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Final progress update
  progress.status = cancelled ? 'cancelled' : 'complete';
  progress.currentUrl = undefined;
  progress.estimatedTimeRemaining = 0;
  onProgress?.(progress);

  return {
    recipes,
    errors,
    totalUrlsProcessed: progress.urlsProcessed,
    totalTime: Date.now() - startTime,
    cancelled,
  };
}

/**
 * Create an AbortController for cancellable crawling
 */
export function createCrawlController(): AbortController {
  return new AbortController();
}
