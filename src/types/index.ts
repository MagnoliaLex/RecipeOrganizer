// Core Recipe Types - matches InstaPlate format exactly

export interface Ingredient {
  quantity: string;
  unit: string;
  item: string;
  notes?: string;
  category?: string;
}

export interface Recipe {
  id: string;
  title: string;
  creator?: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  imageUri?: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  servings?: number;
  difficulty?: string;
  cuisineType?: string;
  mealType: string[];
  dietaryTags: string[];
  ingredients: Ingredient[];
  steps: string[];
  tips?: string;
  isStarterPack: boolean;
  eitansPick: boolean;
  text_blob: string;
  fingerprint_hash: string;
  created_at: string;
  updated_at: string;
}

export interface RecipeImage {
  id: string;
  recipe_id: string;
  path: string;
  kind: 'hero' | 'step' | 'gallery';
  created_at: string;
}

export interface Pack {
  id: string;
  name: string;
  description?: string;
  creator?: string;
  creatorHandle?: string;
  version: string;
  lastUpdated?: string;
  created_at: string;
  updated_at: string;
}

export interface PackRecipe {
  pack_id: string;
  recipe_id: string;
  order_index: number;
}

export interface UsageEvent {
  id: string;
  recipe_id: string;
  type: 'exported_pack' | 'featured' | 'collection' | 'campaign' | 'other';
  ref_id?: string;
  where_text?: string;
  created_at: string;
}

export interface SimilarityCache {
  recipe_id: string;
  other_recipe_id: string;
  score: number;
  explain_json: string;
}

// InstaPlate Pack Format
export interface InstaPlateStarterPack {
  version: string;
  creator: string;
  creatorHandle?: string;
  description: string;
  totalRecipes: number;
  lastUpdated: string;
}

export interface InstaPlateMetadata {
  cuisineBreakdown: Record<string, number>;
  difficultyBreakdown: Record<string, number>;
  mealTypeBreakdown: Record<string, number>;
  timeBuckets: {
    quick15min: number;
    quick30min: number;
    medium45min: number;
    longer60plusMin: number;
  };
}

export interface InstaPlatePackExport {
  starterPack: InstaPlateStarterPack;
  recipes: Recipe[];
  metadata: InstaPlateMetadata;
}

// UI State Types
export interface SearchFilters {
  query?: string;
  cuisineType?: string;
  mealType?: string;
  difficulty?: string;
  dietaryTag?: string;
  maxTime?: number;
}

export interface SimilarRecipe {
  recipe: Recipe;
  score: number;
  explanation: {
    ingredientScore: number;
    textScore: number;
    metadataScore: number;
  };
}

export interface PackSuggestion {
  name: string;
  description: string;
  recipes: Recipe[];
  diversityScore: number;
  reasons: string[];
}
