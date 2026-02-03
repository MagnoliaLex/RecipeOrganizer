import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  crawlForRecipes,
  createCrawlController,
  CrawlProgress,
} from '../lib/crawl';
import { upsertRecipe } from '../lib/db/queries';
import type { Recipe } from '../types';

interface FoundRecipe extends Recipe {
  selected: boolean;
}

export default function CrawlEngine() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(10);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState<CrawlProgress | null>(null);
  const [foundRecipes, setFoundRecipes] = useState<FoundRecipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchComplete, setSearchComplete] = useState(false);
  const [saving, setSaving] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRecipeFound = useCallback((recipe: Recipe) => {
    setFoundRecipes(prev => [...prev, { ...recipe, selected: true }]);
  }, []);

  const handleProgressUpdate = useCallback((p: CrawlProgress) => {
    setProgress(p);
  }, []);

  const startSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search term');
      return;
    }

    setError(null);
    setIsSearching(true);
    setSearchComplete(false);
    setFoundRecipes([]);
    setProgress(null);

    abortControllerRef.current = createCrawlController();

    try {
      const result = await crawlForRecipes({
        query: query.trim(),
        maxResults,
        onProgress: handleProgressUpdate,
        onRecipeFound: handleRecipeFound,
        signal: abortControllerRef.current.signal,
      });

      setSearchComplete(true);

      if (result.errors.length > 0 && result.recipes.length === 0) {
        setError(`Search completed with ${result.errors.length} error(s). No recipes found.`);
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message);
      }
    } finally {
      setIsSearching(false);
      abortControllerRef.current = null;
    }
  };

  const cancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const toggleRecipeSelection = (id: string) => {
    setFoundRecipes(prev =>
      prev.map(r =>
        r.id === id ? { ...r, selected: !r.selected } : r
      )
    );
  };

  const selectAll = () => {
    setFoundRecipes(prev => prev.map(r => ({ ...r, selected: true })));
  };

  const deselectAll = () => {
    setFoundRecipes(prev => prev.map(r => ({ ...r, selected: false })));
  };

  const deleteSelected = () => {
    setFoundRecipes(prev => prev.filter(r => !r.selected));
  };

  const deleteRecipe = (id: string) => {
    setFoundRecipes(prev => prev.filter(r => r.id !== id));
  };

  const saveSelectedRecipes = async () => {
    const recipesToSave = foundRecipes.filter(r => r.selected);
    if (recipesToSave.length === 0) {
      setError('No recipes selected to save');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      for (const recipe of recipesToSave) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { selected, ...recipeData } = recipe;
        await upsertRecipe(recipeData);
      }

      // Remove saved recipes from the list
      setFoundRecipes(prev => prev.filter(r => !r.selected));

      // If all recipes were saved, show success
      if (foundRecipes.filter(r => r.selected).length === foundRecipes.length) {
        navigate('/library');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save recipes');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getProgressPercentage = (): number => {
    if (!progress || progress.urlsFound === 0) return 0;
    return Math.round((progress.urlsProcessed / progress.urlsFound) * 100);
  };

  const selectedCount = foundRecipes.filter(r => r.selected).length;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Recipe Crawl Engine</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Search for Recipes</h2>

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-1">
              What are you looking for?
            </label>
            <input
              id="query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., chicken tikka masala, vegan pasta, chocolate cake"
              disabled={isSearching}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
              onKeyDown={(e) => e.key === 'Enter' && !isSearching && startSearch()}
            />
          </div>
          <div>
            <label htmlFor="maxResults" className="block text-sm font-medium text-gray-700 mb-1">
              Number of recipes
            </label>
            <input
              id="maxResults"
              type="number"
              min={1}
              max={50}
              value={maxResults}
              onChange={(e) => setMaxResults(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
              disabled={isSearching}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
            />
          </div>
        </div>

        <div className="flex gap-3">
          {!isSearching ? (
            <button
              onClick={startSearch}
              disabled={!query.trim()}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-2">
                <SearchIcon className="w-5 h-5" />
                Start Search
              </span>
            </button>
          ) : (
            <button
              onClick={cancelSearch}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              <span className="flex items-center gap-2">
                <StopIcon className="w-5 h-5" />
                Cancel Search
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      {progress && (isSearching || progress.status !== 'complete') && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {progress.status === 'searching' && 'Searching for recipes...'}
              {progress.status === 'scraping' && 'Extracting recipes...'}
              {progress.status === 'cancelled' && 'Search cancelled'}
              {progress.status === 'error' && 'Search encountered errors'}
            </h3>
            {progress.estimatedTimeRemaining !== undefined && progress.estimatedTimeRemaining > 0 && (
              <span className="text-sm text-gray-500">
                ~{formatTime(progress.estimatedTimeRemaining)} remaining
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-primary-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary-600">{progress.urlsFound}</div>
              <div className="text-xs text-gray-500">URLs Found</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{progress.urlsProcessed}</div>
              <div className="text-xs text-gray-500">Processed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{progress.recipesFound}</div>
              <div className="text-xs text-gray-500">Recipes Found</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{progress.errors.length}</div>
              <div className="text-xs text-gray-500">Errors</div>
            </div>
          </div>

          {/* Current URL */}
          {progress.currentUrl && (
            <div className="mt-4 text-sm text-gray-500 truncate">
              Processing: {progress.currentUrl}
            </div>
          )}

          {/* Loading Animation */}
          {isSearching && (
            <div className="flex justify-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {foundRecipes.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Found Recipes ({foundRecipes.length})
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {selectedCount} selected
              </span>
              <button
                onClick={selectAll}
                className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded"
              >
                Deselect All
              </button>
              {selectedCount > 0 && (
                <button
                  onClick={deleteSelected}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Delete Selected
                </button>
              )}
            </div>
          </div>

          {/* Recipe Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
            {foundRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className={`relative border rounded-lg overflow-hidden transition-all ${
                  recipe.selected
                    ? 'border-primary-500 ring-2 ring-primary-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Selection Checkbox */}
                <div className="absolute top-2 left-2 z-10">
                  <input
                    type="checkbox"
                    checked={recipe.selected}
                    onChange={() => toggleRecipeSelection(recipe.id)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => deleteRecipe(recipe.id)}
                  className="absolute top-2 right-2 z-10 p-1 bg-white rounded-full shadow hover:bg-red-50 text-gray-500 hover:text-red-500"
                  title="Remove from results"
                >
                  <XIcon className="w-4 h-4" />
                </button>

                {/* Image */}
                {recipe.imageUri ? (
                  <img
                    src={recipe.imageUri}
                    alt={recipe.title}
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text fill="%239ca3af" font-size="12" x="50" y="50" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>';
                    }}
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400">
                    <span className="text-sm">No Image</span>
                  </div>
                )}

                {/* Content */}
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 line-clamp-2 mb-2">
                    {recipe.title}
                  </h4>

                  {/* Meta Info */}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    {recipe.cuisineType && (
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {recipe.cuisineType}
                      </span>
                    )}
                    {recipe.totalTime && (
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {recipe.totalTime} min
                      </span>
                    )}
                    {recipe.servings && (
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {recipe.servings} servings
                      </span>
                    )}
                  </div>

                  {/* Source */}
                  <div className="mt-2 text-xs text-gray-400 truncate">
                    From: {recipe.sourcePlatform || 'Unknown'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Save Actions */}
          {(searchComplete || foundRecipes.length > 0) && !isSearching && (
            <div className="mt-6 flex gap-3 justify-end border-t border-gray-200 pt-4">
              <button
                onClick={() => navigate('/library')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={saveSelectedRecipes}
                disabled={selectedCount === 0 || saving}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? 'Saving...'
                  : `Save ${selectedCount} Recipe${selectedCount !== 1 ? 's' : ''} to Library`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isSearching && foundRecipes.length === 0 && searchComplete && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <SearchIcon className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Recipes Found</h3>
          <p className="text-gray-500 mb-4">
            Try adjusting your search terms or increasing the number of results.
          </p>
          <button
            onClick={() => setSearchComplete(false)}
            className="px-4 py-2 text-primary-600 hover:text-primary-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Help Text */}
      {!isSearching && foundRecipes.length === 0 && !searchComplete && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-medium text-blue-900 mb-2">Tips for Better Results</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>- Be specific with your search terms (e.g., "spicy thai basil chicken" instead of just "chicken")</li>
            <li>- Include cuisine types or cooking methods for more relevant results</li>
            <li>- The crawl engine searches popular recipe websites for JSON-LD structured data</li>
            <li>- You can cancel the search at any time without losing already found recipes</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
