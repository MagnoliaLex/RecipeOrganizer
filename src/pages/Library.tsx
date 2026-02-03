import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { listRecipes } from '../lib/db/queries';
import type { Recipe, SearchFilters } from '../types';

export default function Library() {
  const [searchParams] = useSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SearchFilters>({});

  const query = searchParams.get('q') || '';

  useEffect(() => {
    loadRecipes();
  }, [query, filters]);

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const results = await listRecipes({ ...filters, query: query || undefined });
      setRecipes(results);
    } catch (err) {
      console.error('Failed to load recipes:', err);
    } finally {
      setLoading(false);
    }
  };

  const cuisineTypes = ['Italian', 'Mexican', 'Asian', 'American', 'Mediterranean', 'Indian', 'French'];
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipe Library</h1>
        <Link
          to="/import"
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          + Import Recipes
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.cuisineType || ''}
            onChange={(e) => setFilters({ ...filters, cuisineType: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Cuisines</option>
            {cuisineTypes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filters.difficulty || ''}
            onChange={(e) => setFilters({ ...filters, difficulty: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Difficulties</option>
            {difficulties.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={filters.mealType || ''}
            onChange={(e) => setFilters({ ...filters, mealType: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Meal Types</option>
            {mealTypes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={filters.maxTime || ''}
            onChange={(e) => setFilters({ ...filters, maxTime: e.target.value ? parseInt(e.target.value) : undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Any Time</option>
            <option value="15">15 min or less</option>
            <option value="30">30 min or less</option>
            <option value="45">45 min or less</option>
            <option value="60">1 hour or less</option>
          </select>

          {(filters.cuisineType || filters.difficulty || filters.mealType || filters.maxTime) && (
            <button
              onClick={() => setFilters({})}
              className="px-3 py-2 text-gray-600 hover:text-gray-900"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recipes yet</h3>
          <p className="text-gray-500 mb-4">Import some recipes to get started</p>
          <Link
            to="/import"
            className="inline-flex px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Import Recipes
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}

      {/* Count */}
      {recipes.length > 0 && (
        <p className="text-sm text-gray-500 mt-6">
          Showing {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Image */}
      <div className="aspect-video bg-gray-100 relative">
        {recipe.imageUri ? (
          <img
            src={recipe.imageUri}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {recipe.eitansPick && (
          <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-medium px-2 py-1 rounded">
            Eitan's Pick
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{recipe.title}</h3>

        <div className="flex flex-wrap gap-2 mb-3">
          {recipe.cuisineType && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {recipe.cuisineType}
            </span>
          )}
          {recipe.difficulty && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {recipe.difficulty}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          {recipe.totalTime && (
            <span className="flex items-center gap-1">
              <ClockIcon className="w-4 h-4" />
              {recipe.totalTime} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <UsersIcon className="w-4 h-4" />
              {recipe.servings}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
