import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile, mkdir, copyFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import type { Recipe, Pack, InstaPlatePackExport, InstaPlateMetadata, InstaPlateStarterPack } from '../../types';

/**
 * Generate InstaPlate metadata from recipes
 */
function generateMetadata(recipes: Recipe[]): InstaPlateMetadata {
  const cuisineBreakdown: Record<string, number> = {};
  const difficultyBreakdown: Record<string, number> = {};
  const mealTypeBreakdown: Record<string, number> = {};
  const timeBuckets = {
    quick15min: 0,
    quick30min: 0,
    medium45min: 0,
    longer60plusMin: 0,
  };

  for (const recipe of recipes) {
    // Cuisine breakdown
    if (recipe.cuisineType) {
      cuisineBreakdown[recipe.cuisineType] = (cuisineBreakdown[recipe.cuisineType] || 0) + 1;
    }

    // Difficulty breakdown
    if (recipe.difficulty) {
      difficultyBreakdown[recipe.difficulty] = (difficultyBreakdown[recipe.difficulty] || 0) + 1;
    }

    // Meal type breakdown
    for (const mealType of recipe.mealType) {
      mealTypeBreakdown[mealType] = (mealTypeBreakdown[mealType] || 0) + 1;
    }

    // Time buckets
    const time = recipe.totalTime || 0;
    if (time > 0) {
      if (time <= 15) timeBuckets.quick15min++;
      else if (time <= 30) timeBuckets.quick30min++;
      else if (time <= 45) timeBuckets.medium45min++;
      else timeBuckets.longer60plusMin++;
    }
  }

  return {
    cuisineBreakdown,
    difficultyBreakdown,
    mealTypeBreakdown,
    timeBuckets,
  };
}

/**
 * Convert Recipe to export format (clean version)
 */
function recipeToExportFormat(recipe: Recipe): Record<string, unknown> {
  return {
    id: recipe.id,
    title: recipe.title,
    creator: recipe.creator,
    sourceUrl: recipe.sourceUrl,
    sourcePlatform: recipe.sourcePlatform,
    imageUri: recipe.imageUri,
    description: recipe.description,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    cuisineType: recipe.cuisineType,
    mealType: recipe.mealType,
    dietaryTags: recipe.dietaryTags,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    tips: recipe.tips,
    isStarterPack: recipe.isStarterPack,
    eitansPick: recipe.eitansPick,
  };
}

/**
 * Create InstaPlate pack export object
 */
function createPackExport(pack: Pack, recipes: Recipe[]): InstaPlatePackExport {
  const starterPack: InstaPlateStarterPack = {
    version: pack.version || '1.0.0',
    creator: pack.creator || 'InstaPlate Recipe Manager',
    creatorHandle: pack.creatorHandle,
    description: pack.description || pack.name,
    totalRecipes: recipes.length,
    lastUpdated: pack.lastUpdated || new Date().toISOString(),
  };

  const metadata = generateMetadata(recipes);

  return {
    starterPack,
    recipes: recipes.map((r) => recipeToExportFormat(r)) as Recipe[],
    metadata,
  };
}

/**
 * Export pack as single JSON file
 */
export async function exportPack(pack: Pack, recipes: Recipe[]): Promise<void> {
  const exportData = createPackExport(pack, recipes);
  const json = JSON.stringify(exportData, null, 2);

  const filePath = await save({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    defaultPath: `${pack.name.replace(/\s+/g, '_')}_pack.json`,
  });

  if (filePath) {
    await writeTextFile(filePath, json);
  }
}

/**
 * Export pack with images as a folder
 * Creates:
 *   /pack.json
 *   /images/
 */
export async function exportPackWithImages(
  pack: Pack,
  recipes: Recipe[]
): Promise<void> {
  // Ask user for folder location
  const folderPath = await save({
    filters: [],
    defaultPath: `${pack.name.replace(/\s+/g, '_')}_pack`,
  });

  if (!folderPath) return;

  // Create directory structure
  const imagesDir = `${folderPath}/images`;

  try {
    await mkdir(folderPath, { recursive: true });
    await mkdir(imagesDir, { recursive: true });
  } catch {
    // Directories may already exist
  }

  // Process recipes and copy images
  const processedRecipes: Recipe[] = [];

  for (const recipe of recipes) {
    const processed = { ...recipe };

    // If recipe has an image, copy it to images folder
    if (recipe.imageUri && recipe.imageUri.startsWith('appdata://')) {
      try {
        const imagePath = recipe.imageUri.replace('appdata://', '');
        const ext = imagePath.split('.').pop() || 'jpg';
        const newFilename = `${recipe.id}.${ext}`;

        // Copy image file
        await copyFile(imagePath, `${imagesDir}/${newFilename}`, {
          fromPathBaseDir: BaseDirectory.AppData,
        });

        // Update imageUri to relative path
        processed.imageUri = `images/${newFilename}`;
      } catch (err) {
        console.error(`Failed to copy image for ${recipe.title}:`, err);
      }
    }

    processedRecipes.push(processed);
  }

  // Create export data with updated image paths
  const exportData = createPackExport(pack, processedRecipes);
  const json = JSON.stringify(exportData, null, 2);

  // Write pack.json
  await writeTextFile(`${folderPath}/pack.json`, json);
}

/**
 * Export single recipe as JSON
 */
export async function exportRecipe(recipe: Recipe): Promise<void> {
  const exportData = recipeToExportFormat(recipe);
  const json = JSON.stringify(exportData, null, 2);

  const filePath = await save({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    defaultPath: `${recipe.title.replace(/\s+/g, '_')}.json`,
  });

  if (filePath) {
    await writeTextFile(filePath, json);
  }
}

/**
 * Export multiple recipes as JSON array
 */
export async function exportRecipes(recipes: Recipe[], filename: string = 'recipes'): Promise<void> {
  const exportData = recipes.map(recipeToExportFormat);
  const json = JSON.stringify(exportData, null, 2);

  const filePath = await save({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    defaultPath: `${filename}.json`,
  });

  if (filePath) {
    await writeTextFile(filePath, json);
  }
}
