import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePackSuggestions, PackSuggestionOptions } from '../lib/suggest/suggestPacks';
import { createPack, addRecipeToPack } from '../lib/db/queries';
import { exportPack } from '../lib/export/exportPack';
import type { PackSuggestion, Pack, Recipe } from '../types';

export default function Suggest() {
  const navigate = useNavigate();
  const [options, setOptions] = useState<PackSuggestionOptions>({
    packSize: 10,
    preferUnused: true,
    maximizeDiversity: true,
  });
  const [suggestions, setSuggestions] = useState<PackSuggestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PackSuggestion | null>(null);

  const cuisineTypes = ['Italian', 'Mexican', 'Asian', 'American', 'Mediterranean', 'Indian', 'French'];
  const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];
  const dietaryTags = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Low-Carb'];

  const handleGenerate = async () => {
    setGenerating(true);
    setSuggestions([]);
    try {
      const results = await generatePackSuggestions(options);
      setSuggestions(results);
    } catch (err) {
      console.error('Failed to generate suggestions:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePack = async (suggestion: PackSuggestion) => {
    try {
      const packId = await createPack({
        name: suggestion.name,
        description: suggestion.description,
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
      });

      for (let i = 0; i < suggestion.recipes.length; i++) {
        await addRecipeToPack(packId, suggestion.recipes[i].id, i);
      }

      navigate('/packs');
    } catch (err) {
      console.error('Failed to save pack:', err);
    }
  };

  const handleExportPack = async (suggestion: PackSuggestion) => {
    try {
      const pack: Pack = {
        id: 'temp',
        name: suggestion.name,
        description: suggestion.description,
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await exportPack(pack, suggestion.recipes);
    } catch (err) {
      console.error('Failed to export pack:', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pack Suggestions</h1>

      {/* Options Panel */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Generation Options</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Pack Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pack Size
            </label>
            <select
              value={options.packSize}
              onChange={(e) => setOptions({ ...options, packSize: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={5}>5 recipes</option>
              <option value={10}>10 recipes</option>
              <option value={15}>15 recipes</option>
              <option value={20}>20 recipes</option>
              <option value={25}>25 recipes</option>
            </select>
          </div>

          {/* Cuisine Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cuisine Type
            </label>
            <select
              value={options.cuisineType || ''}
              onChange={(e) => setOptions({ ...options, cuisineType: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Any Cuisine</option>
              {cuisineTypes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Meal Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meal Type
            </label>
            <select
              value={options.mealType || ''}
              onChange={(e) => setOptions({ ...options, mealType: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Any Meal</option>
              {mealTypes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Dietary Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dietary Requirement
            </label>
            <select
              value={options.dietaryTag || ''}
              onChange={(e) => setOptions({ ...options, dietaryTag: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">No Restriction</option>
              {dietaryTags.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Max Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Cook Time
            </label>
            <select
              value={options.maxTime || ''}
              onChange={(e) => setOptions({ ...options, maxTime: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Any Time</option>
              <option value="15">15 min or less</option>
              <option value="30">30 min or less</option>
              <option value="45">45 min or less</option>
              <option value="60">1 hour or less</option>
            </select>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.preferUnused}
                onChange={(e) => setOptions({ ...options, preferUnused: e.target.checked })}
                className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Prefer unused recipes</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.maximizeDiversity}
                onChange={(e) => setOptions({ ...options, maximizeDiversity: e.target.checked })}
                className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Maximize diversity</span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Pack Suggestions'}
          </button>
        </div>
      </div>

      {/* Results */}
      {generating && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing recipes and generating suggestions...</p>
          </div>
        </div>
      )}

      {!generating && suggestions.length > 0 && (
        <div className="space-y-6">
          <h2 className="font-semibold text-gray-900">
            Generated {suggestions.length} Pack Suggestion{suggestions.length !== 1 ? 's' : ''}
          </h2>

          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{suggestion.name}</h3>
                    <p className="text-gray-500">{suggestion.description}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    {Math.round(suggestion.diversityScore * 100)}% diverse
                  </span>
                </div>

                {/* Reasons */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Why this pack?</p>
                  <ul className="space-y-1">
                    {suggestion.reasons.map((reason, rIdx) => (
                      <li key={rIdx} className="text-sm text-gray-500 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recipe Preview */}
                <div className="mb-4">
                  <button
                    onClick={() => setSelectedSuggestion(selectedSuggestion?.name === suggestion.name ? null : suggestion)}
                    className="text-sm text-primary-500 hover:text-primary-600"
                  >
                    {selectedSuggestion?.name === suggestion.name ? 'Hide' : 'Show'} {suggestion.recipes.length} recipes
                  </button>

                  {selectedSuggestion?.name === suggestion.name && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {suggestion.recipes.map((recipe) => (
                        <div key={recipe.id} className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium text-sm text-gray-900 line-clamp-2">{recipe.title}</p>
                          <p className="text-xs text-gray-500">{recipe.cuisineType}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 px-6 py-3 bg-gray-50 flex gap-3 justify-end">
                <button
                  onClick={() => handleExportPack(suggestion)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Export JSON
                </button>
                <button
                  onClick={() => handleSavePack(suggestion)}
                  className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  Save as Pack
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!generating && suggestions.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Generate</h3>
          <p className="text-gray-500 mb-4">
            Configure your options above and click generate to get pack suggestions
          </p>
        </div>
      )}
    </div>
  );
}
