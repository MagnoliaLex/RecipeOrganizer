import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getRecipeById, deleteRecipe, listUsageByRecipe, addUsageEvent } from '../lib/db/queries';
import { getSimilarRecipes } from '../lib/similarity/score';
import type { Recipe, UsageEvent, SimilarRecipe } from '../types';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [usageHistory, setUsageHistory] = useState<UsageEvent[]>([]);
  const [similarRecipes, setSimilarRecipes] = useState<SimilarRecipe[]>([]);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      loadRecipe(id);
    }
  }, [id]);

  const loadRecipe = async (recipeId: string) => {
    setLoading(true);
    try {
      const data = await getRecipeById(recipeId);
      setRecipe(data);

      if (data) {
        const [usage, similar] = await Promise.all([
          listUsageByRecipe(recipeId),
          getSimilarRecipes(recipeId, 10),
        ]);
        setUsageHistory(usage);
        setSimilarRecipes(similar);
      }
    } catch (err) {
      console.error('Failed to load recipe:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!recipe) return;
    try {
      await deleteRecipe(recipe.id);
      navigate('/library');
    } catch (err) {
      console.error('Failed to delete recipe:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium text-gray-900 mb-2">Recipe not found</h2>
        <Link to="/library" className="text-primary-500 hover:text-primary-600">
          Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back button */}
      <Link
        to="/library"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Library
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="md:flex">
          {/* Image */}
          <div className="md:w-1/3 aspect-video md:aspect-square bg-gray-100">
            {recipe.imageUri ? (
              <img
                src={recipe.imageUri}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="md:w-2/3 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{recipe.title}</h1>
                {recipe.creator && (
                  <p className="text-gray-500">by {recipe.creator}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUsageModal(true)}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Mark Used
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>

            {recipe.description && (
              <p className="text-gray-600 mb-4">{recipe.description}</p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {recipe.cuisineType && (
                <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm">
                  {recipe.cuisineType}
                </span>
              )}
              {recipe.difficulty && (
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {recipe.difficulty}
                </span>
              )}
              {recipe.mealType.map((type) => (
                <span key={type} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  {type}
                </span>
              ))}
              {recipe.dietaryTags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                  {tag}
                </span>
              ))}
              {recipe.eitansPick && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  Eitan's Pick
                </span>
              )}
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {recipe.prepTime !== undefined && (
                <div>
                  <span className="text-gray-500">Prep Time</span>
                  <p className="font-medium">{recipe.prepTime} min</p>
                </div>
              )}
              {recipe.cookTime !== undefined && (
                <div>
                  <span className="text-gray-500">Cook Time</span>
                  <p className="font-medium">{recipe.cookTime} min</p>
                </div>
              )}
              {recipe.totalTime !== undefined && (
                <div>
                  <span className="text-gray-500">Total Time</span>
                  <p className="font-medium">{recipe.totalTime} min</p>
                </div>
              )}
              {recipe.servings !== undefined && (
                <div>
                  <span className="text-gray-500">Servings</span>
                  <p className="font-medium">{recipe.servings}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Ingredients */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ingredients</h2>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="w-2 h-2 mt-2 bg-primary-400 rounded-full flex-shrink-0"></span>
                  <span>
                    {ing.quantity && <strong>{ing.quantity} </strong>}
                    {ing.unit && <span>{ing.unit} </span>}
                    <span>{ing.item}</span>
                    {ing.notes && <span className="text-gray-500"> ({ing.notes})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Steps */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Instructions</h2>
            <ol className="space-y-4">
              {recipe.steps.map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-medium">
                    {idx + 1}
                  </span>
                  <p className="pt-1">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Tips */}
          {recipe.tips && (
            <section className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
              <h2 className="text-lg font-semibold text-yellow-800 mb-2">Tips</h2>
              <p className="text-yellow-700">{recipe.tips}</p>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Usage History */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Used Where</h2>
            {usageHistory.length === 0 ? (
              <p className="text-gray-500 text-sm">No usage history yet</p>
            ) : (
              <ul className="space-y-3">
                {usageHistory.map((usage) => (
                  <li key={usage.id} className="text-sm">
                    <span className="font-medium capitalize">{usage.type.replace('_', ' ')}</span>
                    {usage.where_text && (
                      <span className="text-gray-500"> - {usage.where_text}</span>
                    )}
                    <p className="text-gray-400 text-xs">
                      {new Date(usage.created_at).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Similar Recipes */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Similar Recipes</h2>
            {similarRecipes.length === 0 ? (
              <p className="text-gray-500 text-sm">No similar recipes found</p>
            ) : (
              <ul className="space-y-3">
                {similarRecipes.slice(0, 5).map(({ recipe: sim, score }) => (
                  <li key={sim.id}>
                    <Link
                      to={`/recipe/${sim.id}`}
                      className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
                    >
                      <span className="font-medium text-sm">{sim.title}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {Math.round(score * 100)}% similar
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Source */}
          {recipe.sourceUrl && (
            <section className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Source</h2>
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:text-primary-600 text-sm break-all"
              >
                {recipe.sourcePlatform || recipe.sourceUrl}
              </a>
            </section>
          )}
        </div>
      </div>

      {/* Usage Modal */}
      {showUsageModal && (
        <UsageModal
          recipeId={recipe.id}
          onClose={() => setShowUsageModal(false)}
          onSave={async (event) => {
            await addUsageEvent(event);
            const usage = await listUsageByRecipe(recipe.id);
            setUsageHistory(usage);
            setShowUsageModal(false);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Recipe?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{recipe.title}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface UsageModalProps {
  recipeId: string;
  onClose: () => void;
  onSave: (event: Omit<UsageEvent, 'id' | 'created_at'>) => Promise<void>;
}

function UsageModal({ recipeId, onClose, onSave }: UsageModalProps) {
  const [type, setType] = useState<UsageEvent['type']>('exported_pack');
  const [whereText, setWhereText] = useState('');
  const [refId, setRefId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        recipe_id: recipeId,
        type,
        where_text: whereText || undefined,
        ref_id: refId || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Mark Recipe as Used</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usage Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as UsageEvent['type'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="exported_pack">Exported Pack</option>
                <option value="featured">Featured</option>
                <option value="collection">Collection</option>
                <option value="campaign">Campaign</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={whereText}
                onChange={(e) => setWhereText(e.target.value)}
                placeholder="e.g., Starter Pack v1, Home hero carousel"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference ID (optional)
              </label>
              <input
                type="text"
                value={refId}
                onChange={(e) => setRefId(e.target.value)}
                placeholder="Pack ID or campaign ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
