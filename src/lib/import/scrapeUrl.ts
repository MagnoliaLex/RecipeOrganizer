import type { Recipe, Ingredient } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { normalizeIngredient, normalizeSteps, generateTextBlob } from './normalize';
import { generateFingerprint } from './fingerprint';
import { upsertRecipe } from '../db/queries';

interface JsonLdRecipe {
  '@type'?: string;
  name?: string;
  description?: string;
  author?: { name?: string } | string;
  image?: string | string[] | { url?: string };
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number;
  recipeIngredient?: string[];
  recipeInstructions?: (string | { text?: string })[];
  recipeCuisine?: string | string[];
  recipeCategory?: string | string[];
  keywords?: string;
  nutrition?: { calories?: string };
}

/**
 * Parse ISO 8601 duration to minutes
 * e.g., "PT30M" -> 30, "PT1H30M" -> 90
 */
function parseDuration(duration?: string): number | undefined {
  if (!duration) return undefined;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return undefined;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);

  return hours * 60 + minutes || undefined;
}

/**
 * Extract JSON-LD Recipe data from HTML
 */
function extractJsonLd(html: string): JsonLdRecipe | null {
  // Find all JSON-LD scripts
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      // Handle array of items
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // Direct recipe
        if (item['@type'] === 'Recipe') {
          return item;
        }

        // Recipe in @graph
        if (item['@graph']) {
          const recipe = item['@graph'].find(
            (g: { '@type'?: string }) => g['@type'] === 'Recipe'
          );
          if (recipe) return recipe;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Extract image URL from JSON-LD image field
 */
function extractImageUrl(image: JsonLdRecipe['image']): string | undefined {
  if (!image) return undefined;

  if (typeof image === 'string') {
    return image;
  }

  if (Array.isArray(image)) {
    return typeof image[0] === 'string' ? image[0] : image[0]?.url;
  }

  if (typeof image === 'object' && image.url) {
    return image.url;
  }

  return undefined;
}

/**
 * Extract author name from JSON-LD author field
 */
function extractAuthor(author: JsonLdRecipe['author']): string | undefined {
  if (!author) return undefined;

  if (typeof author === 'string') {
    return author;
  }

  if (typeof author === 'object' && author.name) {
    return author.name;
  }

  return undefined;
}

/**
 * Extract servings from recipeYield
 */
function extractServings(recipeYield?: string | number): number | undefined {
  if (typeof recipeYield === 'number') {
    return recipeYield;
  }

  if (typeof recipeYield === 'string') {
    const match = recipeYield.match(/\d+/);
    return match ? parseInt(match[0], 10) : undefined;
  }

  return undefined;
}

/**
 * Parse instructions from JSON-LD format
 */
function parseInstructions(
  instructions?: (string | { text?: string })[]
): string[] {
  if (!instructions) return [];

  return instructions
    .map((inst) => {
      if (typeof inst === 'string') return inst;
      if (typeof inst === 'object' && inst.text) return inst.text;
      return '';
    })
    .filter(Boolean);
}

/**
 * Extract platform name from URL
 */
function getPlatformFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace('www.', '').split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return 'Web';
  }
}

/**
 * Scrape a recipe from a URL
 */
export async function scrapeRecipeFromUrl(
  url: string,
  previewOnly: boolean = false
): Promise<Recipe> {
  // Fetch the HTML
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.statusText}`);
  }

  const html = await response.text();

  // Try to extract JSON-LD recipe data
  const jsonLd = extractJsonLd(html);

  if (!jsonLd) {
    throw new Error(
      'No schema.org Recipe found on this page. The site may not support recipe extraction.'
    );
  }

  const now = new Date().toISOString();

  // Parse ingredients
  const ingredients: Ingredient[] = (jsonLd.recipeIngredient || []).map(
    normalizeIngredient
  );

  // Parse instructions
  const steps = parseInstructions(jsonLd.recipeInstructions);

  // Parse meal types from category
  const mealType: string[] = [];
  if (jsonLd.recipeCategory) {
    const categories = Array.isArray(jsonLd.recipeCategory)
      ? jsonLd.recipeCategory
      : [jsonLd.recipeCategory];
    mealType.push(...categories);
  }

  // Parse dietary tags from keywords
  const dietaryTags: string[] = [];
  if (jsonLd.keywords) {
    const keywords = jsonLd.keywords.split(',').map((k) => k.trim());
    const dietaryKeywords = [
      'vegetarian',
      'vegan',
      'gluten-free',
      'dairy-free',
      'keto',
      'low-carb',
      'paleo',
    ];
    for (const keyword of keywords) {
      if (dietaryKeywords.some((d) => keyword.toLowerCase().includes(d))) {
        dietaryTags.push(keyword);
      }
    }
  }

  // Build recipe object
  const recipe: Recipe = {
    id: uuidv4(),
    title: jsonLd.name || 'Untitled Recipe',
    creator: extractAuthor(jsonLd.author),
    sourceUrl: url,
    sourcePlatform: getPlatformFromUrl(url),
    imageUri: extractImageUrl(jsonLd.image),
    description: jsonLd.description,
    prepTime: parseDuration(jsonLd.prepTime),
    cookTime: parseDuration(jsonLd.cookTime),
    totalTime: parseDuration(jsonLd.totalTime),
    servings: extractServings(jsonLd.recipeYield),
    difficulty: undefined, // Not typically in JSON-LD
    cuisineType: Array.isArray(jsonLd.recipeCuisine)
      ? jsonLd.recipeCuisine[0]
      : jsonLd.recipeCuisine,
    mealType,
    dietaryTags,
    ingredients,
    steps,
    tips: undefined,
    isStarterPack: false,
    eitansPick: false,
    text_blob: '',
    fingerprint_hash: '',
    created_at: now,
    updated_at: now,
  };

  // Generate text blob and fingerprint
  recipe.text_blob = generateTextBlob(recipe);
  recipe.fingerprint_hash = generateFingerprint(recipe);

  // Save to database if not preview only
  if (!previewOnly) {
    await upsertRecipe(recipe);
  }

  return recipe;
}

/**
 * Check if a URL is likely to contain a recipe
 */
export function isRecipeUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Check for common recipe site patterns
    const recipePatterns = [
      /recipe/i,
      /cooking/i,
      /food/i,
      /allrecipes/i,
      /epicurious/i,
      /seriouseats/i,
      /bonappetit/i,
      /foodnetwork/i,
      /delish/i,
      /tasty/i,
      /yummly/i,
    ];

    const fullUrl = parsedUrl.hostname + parsedUrl.pathname;
    return recipePatterns.some((pattern) => pattern.test(fullUrl));
  } catch {
    return false;
  }
}
