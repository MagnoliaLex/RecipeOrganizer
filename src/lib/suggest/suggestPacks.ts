import type { Recipe, PackSuggestion } from '../../types';
import { listRecipes, getUnusedRecipes, getRecipeUsageCount } from '../db/queries';
import { calculateSimilarity, calculatePackDiversity } from '../similarity/score';

export interface PackSuggestionOptions {
  packSize: number;
  cuisineType?: string;
  mealType?: string;
  dietaryTag?: string;
  maxTime?: number;
  preferUnused?: boolean;
  maximizeDiversity?: boolean;
}

/**
 * Generate pack suggestions based on criteria
 */
export async function generatePackSuggestions(
  options: PackSuggestionOptions
): Promise<PackSuggestion[]> {
  const {
    packSize = 10,
    cuisineType,
    mealType,
    dietaryTag,
    maxTime,
    preferUnused = true,
    maximizeDiversity = true,
  } = options;

  // Get candidate recipes
  let candidates = await listRecipes({
    cuisineType,
    mealType,
    dietaryTag,
    maxTime,
  });

  if (candidates.length < packSize) {
    // Not enough recipes matching filters, relax constraints
    candidates = await listRecipes({});
  }

  if (candidates.length < packSize) {
    return [];
  }

  // Score recipes for inclusion
  const scoredRecipes = await scoreRecipes(candidates, preferUnused);

  // Generate multiple pack variations
  const suggestions: PackSuggestion[] = [];

  // Strategy 1: Highest scored recipes with diversity
  const diversePack = await buildDiversePack(scoredRecipes, packSize, maximizeDiversity);
  if (diversePack.recipes.length >= packSize) {
    suggestions.push({
      ...diversePack,
      name: generatePackName(diversePack.recipes, 'Diverse'),
      description: generatePackDescription(diversePack.recipes),
    });
  }

  // Strategy 2: Cuisine-focused pack
  if (cuisineType) {
    const cuisinePack = buildCuisinePack(scoredRecipes, packSize, cuisineType);
    if (cuisinePack.recipes.length >= Math.min(packSize, 5)) {
      suggestions.push({
        ...cuisinePack,
        name: `${cuisineType} Favorites`,
        description: `A collection of ${cuisineType} recipes`,
      });
    }
  }

  // Strategy 3: Quick meals pack
  const quickRecipes = scoredRecipes.filter(
    (r) => r.recipe.totalTime && r.recipe.totalTime <= 30
  );
  if (quickRecipes.length >= 5) {
    const quickPack = await buildDiversePack(quickRecipes, Math.min(packSize, quickRecipes.length), true);
    suggestions.push({
      ...quickPack,
      name: 'Quick & Easy',
      description: 'Recipes ready in 30 minutes or less',
      reasons: [...quickPack.reasons, 'All recipes take 30 minutes or less'],
    });
  }

  // Strategy 4: Unused recipes pack
  if (preferUnused) {
    const unusedRecipes = scoredRecipes.filter((r) => r.usageCount === 0);
    if (unusedRecipes.length >= 5) {
      const unusedPack = await buildDiversePack(
        unusedRecipes,
        Math.min(packSize, unusedRecipes.length),
        true
      );
      suggestions.push({
        ...unusedPack,
        name: 'Fresh Picks',
        description: 'Recipes that haven\'t been used yet',
        reasons: [...unusedPack.reasons, 'All recipes are unused'],
      });
    }
  }

  // Remove duplicates and sort by diversity
  const uniqueSuggestions = deduplicateSuggestions(suggestions);

  return uniqueSuggestions.sort((a, b) => b.diversityScore - a.diversityScore);
}

interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  usageCount: number;
}

async function scoreRecipes(
  recipes: Recipe[],
  preferUnused: boolean
): Promise<ScoredRecipe[]> {
  const scored: ScoredRecipe[] = [];

  for (const recipe of recipes) {
    const usageCount = await getRecipeUsageCount(recipe.id);

    let score = 1;

    // Prefer unused recipes
    if (preferUnused && usageCount === 0) {
      score += 0.5;
    }

    // Prefer recipes with complete data
    if (recipe.imageUri) score += 0.1;
    if (recipe.description) score += 0.1;
    if (recipe.totalTime) score += 0.1;
    if (recipe.servings) score += 0.1;

    // Prefer Eitan's picks
    if (recipe.eitansPick) score += 0.3;

    scored.push({ recipe, score, usageCount });
  }

  return scored.sort((a, b) => b.score - a.score);
}

async function buildDiversePack(
  scoredRecipes: ScoredRecipe[],
  size: number,
  maximizeDiversity: boolean
): Promise<Omit<PackSuggestion, 'name' | 'description'>> {
  const selected: Recipe[] = [];
  const reasons: string[] = [];
  const used = new Set<string>();

  // Add first recipe (highest scored)
  if (scoredRecipes.length > 0) {
    selected.push(scoredRecipes[0].recipe);
    used.add(scoredRecipes[0].recipe.id);
  }

  // Greedily add recipes that maximize diversity
  while (selected.length < size && selected.length < scoredRecipes.length) {
    let bestCandidate: ScoredRecipe | null = null;
    let bestDiversity = -1;

    for (const candidate of scoredRecipes) {
      if (used.has(candidate.recipe.id)) continue;

      if (maximizeDiversity) {
        // Calculate how diverse this candidate is from selected
        const testSet = [...selected, candidate.recipe];
        const diversity = calculatePackDiversity(testSet);

        // Also factor in the recipe's score
        const combinedScore = diversity * 0.7 + candidate.score * 0.3;

        if (combinedScore > bestDiversity) {
          bestDiversity = combinedScore;
          bestCandidate = candidate;
        }
      } else {
        // Just use the next highest scored recipe
        bestCandidate = candidate;
        break;
      }
    }

    if (bestCandidate) {
      selected.push(bestCandidate.recipe);
      used.add(bestCandidate.recipe.id);
    } else {
      break;
    }
  }

  // Generate reasons
  const cuisines = new Set(selected.map((r) => r.cuisineType).filter(Boolean));
  if (cuisines.size > 1) {
    reasons.push(`Includes ${cuisines.size} different cuisines`);
  }

  const difficulties = new Set(selected.map((r) => r.difficulty).filter(Boolean));
  if (difficulties.size > 1) {
    reasons.push('Mix of difficulty levels');
  }

  const unusedCount = selected.filter((r) => {
    const scored = scoredRecipes.find((s) => s.recipe.id === r.id);
    return scored && scored.usageCount === 0;
  }).length;
  if (unusedCount > selected.length / 2) {
    reasons.push(`${unusedCount} fresh/unused recipes`);
  }

  return {
    recipes: selected,
    diversityScore: calculatePackDiversity(selected),
    reasons,
  };
}

function buildCuisinePack(
  scoredRecipes: ScoredRecipe[],
  size: number,
  cuisineType: string
): Omit<PackSuggestion, 'name' | 'description'> {
  const cuisineRecipes = scoredRecipes.filter(
    (r) => r.recipe.cuisineType === cuisineType
  );

  const selected = cuisineRecipes.slice(0, size).map((r) => r.recipe);

  return {
    recipes: selected,
    diversityScore: calculatePackDiversity(selected),
    reasons: [`All ${cuisineType} cuisine`, `${selected.length} recipes`],
  };
}

function generatePackName(recipes: Recipe[], prefix: string): string {
  // Find most common cuisine
  const cuisineCounts: Record<string, number> = {};
  for (const recipe of recipes) {
    if (recipe.cuisineType) {
      cuisineCounts[recipe.cuisineType] = (cuisineCounts[recipe.cuisineType] || 0) + 1;
    }
  }

  const topCuisine = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])[0];

  if (topCuisine && topCuisine[1] > recipes.length / 3) {
    return `${prefix} ${topCuisine[0]} Collection`;
  }

  return `${prefix} Recipe Collection`;
}

function generatePackDescription(recipes: Recipe[]): string {
  const cuisines = [...new Set(recipes.map((r) => r.cuisineType).filter(Boolean))];
  const mealTypes = [...new Set(recipes.flatMap((r) => r.mealType))];

  let desc = `A curated collection of ${recipes.length} recipes`;

  if (cuisines.length > 0) {
    desc += ` featuring ${cuisines.slice(0, 3).join(', ')}`;
    if (cuisines.length > 3) desc += ' and more';
    desc += ' cuisines';
  }

  return desc;
}

function deduplicateSuggestions(suggestions: PackSuggestion[]): PackSuggestion[] {
  const seen = new Set<string>();
  const unique: PackSuggestion[] = [];

  for (const suggestion of suggestions) {
    const key = suggestion.recipes.map((r) => r.id).sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(suggestion);
    }
  }

  return unique;
}

/**
 * Generate a themed pack based on specific criteria
 */
export async function generateThemedPack(
  theme: 'weeknight' | 'healthy' | 'comfort' | 'party' | 'budget',
  size: number = 10
): Promise<PackSuggestion | null> {
  let recipes: Recipe[];

  switch (theme) {
    case 'weeknight':
      recipes = await listRecipes({ maxTime: 30 });
      break;
    case 'healthy':
      recipes = await listRecipes({ dietaryTag: 'Healthy' });
      if (recipes.length < size) {
        const lowCarb = await listRecipes({ dietaryTag: 'Low-Carb' });
        recipes = [...recipes, ...lowCarb];
      }
      break;
    case 'comfort':
      // Comfort food tends to be American, Italian
      recipes = await listRecipes({ cuisineType: 'American' });
      const italian = await listRecipes({ cuisineType: 'Italian' });
      recipes = [...recipes, ...italian];
      break;
    case 'party':
      recipes = await listRecipes({ mealType: 'Snack' });
      const appetizers = await listRecipes({ mealType: 'Appetizer' });
      recipes = [...recipes, ...appetizers];
      break;
    case 'budget':
      // Can't filter by cost directly, so use all recipes
      recipes = await listRecipes({});
      break;
    default:
      recipes = await listRecipes({});
  }

  if (recipes.length < 3) return null;

  const scored = await scoreRecipes(recipes, true);
  const pack = await buildDiversePack(scored, Math.min(size, recipes.length), true);

  const themeNames: Record<string, string> = {
    weeknight: 'Weeknight Winners',
    healthy: 'Healthy Eats',
    comfort: 'Comfort Classics',
    party: 'Party Pleasers',
    budget: 'Budget Friendly',
  };

  return {
    ...pack,
    name: themeNames[theme],
    description: `Perfect for ${theme} cooking`,
  };
}
