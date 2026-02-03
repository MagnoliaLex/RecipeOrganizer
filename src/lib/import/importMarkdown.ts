import type { Recipe, Ingredient } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { normalizeIngredient, generateTextBlob } from './normalize';
import { generateFingerprint } from './fingerprint';
import { upsertRecipe } from '../db/queries';

interface ParsedMarkdownRecipe {
  title: string;
  description?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
}

/**
 * Import recipes from markdown content
 *
 * Supports common markdown recipe formats:
 * - # Title
 * - ## Ingredients (bullet list)
 * - ## Instructions/Directions/Steps (numbered or bullet list)
 * - Metadata like "Servings: 4" or "Prep Time: 15 minutes"
 */
export async function importMarkdown(
  content: string,
  previewOnly: boolean = false
): Promise<Recipe[]> {
  const recipes = parseMarkdownRecipes(content);

  if (recipes.length === 0) {
    throw new Error('No valid recipes found in markdown');
  }

  const now = new Date().toISOString();
  const result: Recipe[] = [];

  for (const parsed of recipes) {
    const recipe: Recipe = {
      id: uuidv4(),
      title: parsed.title,
      description: parsed.description,
      servings: parsed.servings,
      prepTime: parsed.prepTime,
      cookTime: parsed.cookTime,
      totalTime: parsed.totalTime || calculateTotal(parsed.prepTime, parsed.cookTime),
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      tips: parsed.notes,
      mealType: [],
      dietaryTags: [],
      isStarterPack: false,
      eitansPick: false,
      text_blob: '',
      fingerprint_hash: '',
      created_at: now,
      updated_at: now,
    };

    recipe.text_blob = generateTextBlob(recipe);
    recipe.fingerprint_hash = generateFingerprint(recipe);

    result.push(recipe);
  }

  // If preview only, return without saving
  if (previewOnly) {
    return result;
  }

  // Save recipes to database
  for (const recipe of result) {
    await upsertRecipe(recipe);
  }

  return result;
}

function calculateTotal(prep?: number, cook?: number): number | undefined {
  if (prep !== undefined && cook !== undefined) return prep + cook;
  return prep || cook;
}

/**
 * Parse markdown content into recipe objects
 */
function parseMarkdownRecipes(content: string): ParsedMarkdownRecipe[] {
  const recipes: ParsedMarkdownRecipe[] = [];

  // Split by h1 headers (# Title) to separate multiple recipes
  const recipeBlocks = content.split(/^#\s+/m).filter(Boolean);

  for (const block of recipeBlocks) {
    const recipe = parseRecipeBlock(block);
    if (recipe) {
      recipes.push(recipe);
    }
  }

  // If no recipes found, try parsing the whole content as a single recipe
  if (recipes.length === 0) {
    const recipe = parseRecipeBlock(content);
    if (recipe) {
      recipes.push(recipe);
    }
  }

  return recipes;
}

function parseRecipeBlock(block: string): ParsedMarkdownRecipe | null {
  const lines = block.split('\n');

  // Extract title from first line (or h1)
  let title = lines[0]?.trim();
  if (!title) return null;

  // Remove markdown formatting
  title = title.replace(/^#+\s*/, '').trim();
  if (!title) return null;

  const result: ParsedMarkdownRecipe = {
    title,
    ingredients: [],
    steps: [],
  };

  // Parse sections
  let currentSection = '';
  let sectionContent: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Check for section headers
    const headerMatch = line.match(/^##\s*(.+)/);
    if (headerMatch) {
      // Process previous section
      processSection(result, currentSection, sectionContent);
      currentSection = headerMatch[1].toLowerCase().trim();
      sectionContent = [];
      continue;
    }

    // Check for metadata (key: value format)
    const metaMatch = line.match(/^\*?\*?([^:]+):\*?\*?\s*(.+)/i);
    if (metaMatch && !currentSection) {
      const key = metaMatch[1].toLowerCase().trim();
      const value = metaMatch[2].trim();
      parseMetadata(result, key, value);
      continue;
    }

    sectionContent.push(line);
  }

  // Process final section
  processSection(result, currentSection, sectionContent);

  // Validate we have essential content
  if (result.ingredients.length === 0 && result.steps.length === 0) {
    // Try to extract ingredients and steps from unstructured content
    extractFromUnstructured(result, block);
  }

  return result.title ? result : null;
}

function processSection(
  recipe: ParsedMarkdownRecipe,
  section: string,
  content: string[]
): void {
  if (!section) return;

  const text = content.join('\n').trim();

  if (section.includes('ingredient')) {
    recipe.ingredients = parseIngredientList(content);
  } else if (
    section.includes('instruction') ||
    section.includes('direction') ||
    section.includes('step') ||
    section.includes('method')
  ) {
    recipe.steps = parseStepList(content);
  } else if (section.includes('description') || section.includes('intro')) {
    recipe.description = text;
  } else if (section.includes('note') || section.includes('tip')) {
    recipe.notes = text;
  }
}

function parseIngredientList(lines: string[]): Ingredient[] {
  const ingredients: Ingredient[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and headers
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Remove bullet points and list markers
    const cleaned = trimmed.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    if (!cleaned) continue;

    ingredients.push(normalizeIngredient(cleaned));
  }

  return ingredients;
}

function parseStepList(lines: string[]): string[] {
  const steps: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and headers
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Remove bullet points and numbered markers
    const cleaned = trimmed.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    if (!cleaned) continue;

    steps.push(cleaned);
  }

  return steps;
}

function parseMetadata(recipe: ParsedMarkdownRecipe, key: string, value: string): void {
  const numValue = parseInt(value.replace(/\D/g, ''), 10);

  if (key.includes('serving') || key.includes('yield')) {
    recipe.servings = numValue || undefined;
  } else if (key.includes('prep')) {
    recipe.prepTime = numValue || undefined;
  } else if (key.includes('cook')) {
    recipe.cookTime = numValue || undefined;
  } else if (key.includes('total') && key.includes('time')) {
    recipe.totalTime = numValue || undefined;
  }
}

function extractFromUnstructured(recipe: ParsedMarkdownRecipe, content: string): void {
  const lines = content.split('\n');
  let inIngredients = false;
  let inSteps = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect ingredient section by common patterns
    if (/ingredient/i.test(trimmed)) {
      inIngredients = true;
      inSteps = false;
      continue;
    }

    // Detect steps section
    if (/instruction|direction|step|method/i.test(trimmed)) {
      inIngredients = false;
      inSteps = true;
      continue;
    }

    // Parse based on current section
    if (inIngredients && /^[-*•]/.test(trimmed)) {
      const cleaned = trimmed.replace(/^[-*•]\s*/, '').trim();
      if (cleaned) {
        recipe.ingredients.push(normalizeIngredient(cleaned));
      }
    } else if (inSteps && /^(\d+\.|[-*•])/.test(trimmed)) {
      const cleaned = trimmed.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (cleaned) {
        recipe.steps.push(cleaned);
      }
    }
  }
}
