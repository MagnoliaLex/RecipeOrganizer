import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listPacks,
  createPack,
  updatePack,
  deletePack,
  listPackRecipes,
  addRecipeToPack,
  removeRecipeFromPack,
  reorderPackRecipes,
  listRecipes,
} from '../lib/db/queries';
import { exportPack, exportPackWithImages } from '../lib/export/exportPack';
import { validatePack, PackValidation } from '../lib/export/validatePack';
import type { Pack, Recipe } from '../types';

export default function Packs() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    setLoading(true);
    try {
      const data = await listPacks();
      setPacks(data);
    } catch (err) {
      console.error('Failed to load packs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePack = async (pack: Omit<Pack, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await createPack(pack);
      await loadPacks();
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create pack:', err);
    }
  };

  const handleDeletePack = async (packId: string) => {
    if (!confirm('Are you sure you want to delete this pack?')) return;
    try {
      await deletePack(packId);
      await loadPacks();
    } catch (err) {
      console.error('Failed to delete pack:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipe Packs</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          + Create Pack
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : packs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No packs yet</h3>
          <p className="text-gray-500 mb-4">Create a pack to start organizing recipes for export</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Create Pack
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packs.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              onEdit={() => setSelectedPack(pack)}
              onDelete={() => handleDeletePack(pack.id)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <PackModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreatePack}
        />
      )}

      {/* Edit Modal */}
      {selectedPack && (
        <PackEditor
          pack={selectedPack}
          onClose={() => {
            setSelectedPack(null);
            loadPacks();
          }}
        />
      )}
    </div>
  );
}

interface PackCardProps {
  pack: Pack;
  onEdit: () => void;
  onDelete: () => void;
}

function PackCard({ pack, onEdit, onDelete }: PackCardProps) {
  const [recipeCount, setRecipeCount] = useState(0);

  useEffect(() => {
    listPackRecipes(pack.id).then((recipes) => setRecipeCount(recipes.length));
  }, [pack.id]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6">
        <h3 className="font-semibold text-gray-900 mb-2">{pack.name}</h3>
        {pack.description && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">{pack.description}</p>
        )}

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span>{recipeCount} recipes</span>
          <span>v{pack.version}</span>
        </div>

        {pack.creator && (
          <p className="text-xs text-gray-400">by {pack.creator}</p>
        )}
      </div>

      <div className="border-t border-gray-100 px-6 py-3 bg-gray-50 flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

interface PackModalProps {
  pack?: Pack;
  onClose: () => void;
  onSave: (pack: Omit<Pack, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

function PackModal({ pack, onClose, onSave }: PackModalProps) {
  const [name, setName] = useState(pack?.name || '');
  const [description, setDescription] = useState(pack?.description || '');
  const [creator, setCreator] = useState(pack?.creator || '');
  const [creatorHandle, setCreatorHandle] = useState(pack?.creatorHandle || '');
  const [version, setVersion] = useState(pack?.version || '1.0.0');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        creator: creator.trim() || undefined,
        creatorHandle: creatorHandle.trim() || undefined,
        version,
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">
          {pack ? 'Edit Pack' : 'Create Pack'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Creator</label>
                <input
                  type="text"
                  value={creator}
                  onChange={(e) => setCreator(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Handle</label>
                <input
                  type="text"
                  value={creatorHandle}
                  onChange={(e) => setCreatorHandle(e.target.value)}
                  placeholder="@handle"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
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
              disabled={saving || !name.trim()}
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

interface PackEditorProps {
  pack: Pack;
  onClose: () => void;
}

function PackEditor({ pack, onClose }: PackEditorProps) {
  const [packRecipes, setPackRecipes] = useState<Recipe[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [validation, setValidation] = useState<PackValidation | null>(null);
  const [showAddRecipes, setShowAddRecipes] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);

  useEffect(() => {
    loadData();
  }, [pack.id]);

  const loadData = async () => {
    const [recipes, all] = await Promise.all([
      listPackRecipes(pack.id),
      listRecipes({}),
    ]);
    setPackRecipes(recipes);
    setAllRecipes(all);

    if (recipes.length > 0) {
      const valid = await validatePack(recipes);
      setValidation(valid);
    }
  };

  const handleAddRecipe = async (recipeId: string) => {
    await addRecipeToPack(pack.id, recipeId, packRecipes.length);
    await loadData();
  };

  const handleRemoveRecipe = async (recipeId: string) => {
    await removeRecipeFromPack(pack.id, recipeId);
    await loadData();
  };

  const handleReorder = async (fromIdx: number, toIdx: number) => {
    const newOrder = [...packRecipes];
    const [removed] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, removed);

    const orderUpdates = newOrder.map((r, idx) => ({ recipeId: r.id, orderIndex: idx }));
    await reorderPackRecipes(pack.id, orderUpdates);
    await loadData();
  };

  const handleExport = async (withImages: boolean) => {
    setExporting(true);
    try {
      if (withImages) {
        await exportPackWithImages(pack, packRecipes);
      } else {
        await exportPack(pack, packRecipes);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleUpdateMeta = async (updates: Partial<Pack>) => {
    await updatePack(pack.id, updates);
    setEditingMeta(false);
  };

  const availableRecipes = allRecipes.filter(
    (r) => !packRecipes.some((pr) => pr.id === r.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{pack.name}</h2>
            <p className="text-sm text-gray-500">{packRecipes.length} recipes</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingMeta(true)}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Edit Info
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Validation Warnings */}
          {validation && validation.warnings.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-medium text-yellow-800 mb-2">Pack Warnings</h3>
              <ul className="space-y-1">
                {validation.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-yellow-700">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recipe List */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Pack Recipes</h3>
            <button
              onClick={() => setShowAddRecipes(true)}
              className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              + Add Recipes
            </button>
          </div>

          {packRecipes.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No recipes in this pack yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {packRecipes.map((recipe, idx) => (
                <div
                  key={recipe.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm text-gray-400 w-6">{idx + 1}</span>
                  <div className="flex-1">
                    <Link
                      to={`/recipe/${recipe.id}`}
                      className="font-medium text-gray-900 hover:text-primary-600"
                      onClick={onClose}
                    >
                      {recipe.title}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {recipe.cuisineType} • {recipe.difficulty}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleReorder(idx, Math.max(0, idx - 1))}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleReorder(idx, Math.min(packRecipes.length - 1, idx + 1))}
                      disabled={idx === packRecipes.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRemoveRecipe(recipe.id)}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={() => handleExport(false)}
            disabled={exporting || packRecipes.length === 0}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Export JSON
          </button>
          <button
            onClick={() => handleExport(true)}
            disabled={exporting || packRecipes.length === 0}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export with Images'}
          </button>
        </div>

        {/* Add Recipes Modal */}
        {showAddRecipes && (
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Recipes to Pack</h3>
              <button
                onClick={() => setShowAddRecipes(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {availableRecipes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  All recipes are already in this pack
                </p>
              ) : (
                <div className="space-y-2">
                  {availableRecipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{recipe.title}</p>
                        <p className="text-sm text-gray-500">
                          {recipe.cuisineType} • {recipe.difficulty}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddRecipe(recipe.id)}
                        className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit Meta Modal */}
        {editingMeta && (
          <PackModal
            pack={pack}
            onClose={() => setEditingMeta(false)}
            onSave={handleUpdateMeta}
          />
        )}
      </div>
    </div>
  );
}
