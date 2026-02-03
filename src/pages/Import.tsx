import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { importPackJson, ImportResult } from '../lib/import/importPackJson';
import { importRecipeJson } from '../lib/import/importRecipeJson';
import { importMarkdown } from '../lib/import/importMarkdown';
import { findDuplicates, DuplicateWarning } from '../lib/import/fingerprint';
import type { Recipe } from '../types';

type ImportType = 'pack' | 'recipe' | 'markdown' | null;

export default function Import() {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [importType, setImportType] = useState<ImportType>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRecipes, setParsedRecipes] = useState<Recipe[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [createPack, setCreatePack] = useState(false);
  const [packName, setPackName] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setFileName(file.name);
    const content = await file.text();
    setFileContent(content);

    const ext = file.name.toLowerCase().split('.').pop();

    try {
      if (ext === 'json') {
        const json = JSON.parse(content);

        if (json.starterPack && json.recipes) {
          setImportType('pack');
          const result = await importPackJson(content, true);
          setParsedRecipes(result.recipes);
          setPackName(json.starterPack.description || 'Imported Pack');
          setCreatePack(true);
        } else if (Array.isArray(json)) {
          setImportType('recipe');
          const result = await importRecipeJson(content, true);
          setParsedRecipes(result);
        } else if (json.id || json.title) {
          setImportType('recipe');
          const result = await importRecipeJson(content, true);
          setParsedRecipes(result);
        } else {
          throw new Error('Unrecognized JSON format');
        }
      } else if (ext === 'md' || ext === 'txt') {
        setImportType('markdown');
        const result = await importMarkdown(content, true);
        setParsedRecipes(result);
      } else {
        throw new Error('Unsupported file type. Please use .json or .md files.');
      }

      const warnings = await findDuplicates(parsedRecipes);
      setDuplicateWarnings(warnings);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);

    try {
      let result: ImportResult;

      if (importType === 'pack') {
        result = await importPackJson(fileContent, false, createPack ? packName : undefined);
      } else if (importType === 'recipe') {
        const recipes = await importRecipeJson(fileContent, false);
        result = { recipes, packId: undefined };
      } else if (importType === 'markdown') {
        const recipes = await importMarkdown(fileContent, false);
        result = { recipes, packId: undefined };
      } else {
        throw new Error('No import type selected');
      }

      setImportResult(result);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setImportType(null);
    setFileContent('');
    setFileName('');
    setParsedRecipes([]);
    setDuplicateWarnings([]);
    setCreatePack(false);
    setPackName('');
    setError(null);
    setImportResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Import Recipes</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {step === 'upload' && (
        <>
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`drop-zone ${isDragging ? 'active' : ''} cursor-pointer`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".json,.md,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="text-gray-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium mb-2">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-gray-400 text-sm">
              Supports: InstaPlate Pack JSON, Recipe JSON, Markdown
            </p>
          </div>

          {/* Import Types */}
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">InstaPlate Pack</h3>
              <p className="text-sm text-gray-500">
                Import a complete recipe pack with metadata, recipes, and pack info.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Recipe JSON</h3>
              <p className="text-sm text-gray-500">
                Import single recipe or array of recipes in InstaPlate format.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Markdown</h3>
              <p className="text-sm text-gray-500">
                Import recipes from markdown files with common formats.
              </p>
            </div>
          </div>
        </>
      )}

      {step === 'preview' && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Preview Import</h2>
                <p className="text-sm text-gray-500">
                  {fileName} - {parsedRecipes.length} recipe{parsedRecipes.length !== 1 ? 's' : ''}
                </p>
              </div>
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm capitalize">
                {importType}
              </span>
            </div>

            {/* Pack options */}
            {importType === 'pack' && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={createPack}
                    onChange={(e) => setCreatePack(e.target.checked)}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Create pack and link recipes</span>
                </label>
                {createPack && (
                  <input
                    type="text"
                    value={packName}
                    onChange={(e) => setPackName(e.target.value)}
                    placeholder="Pack name"
                    className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
              </div>
            )}

            {/* Duplicate warnings */}
            {duplicateWarnings.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-medium text-yellow-800 mb-2">
                  Potential Duplicates Detected
                </h3>
                <ul className="space-y-2">
                  {duplicateWarnings.map((warning, idx) => (
                    <li key={idx} className="text-sm text-yellow-700">
                      "{warning.newRecipe.title}" is {Math.round(warning.similarity * 100)}% similar to existing "{warning.existingRecipe.title}"
                      <span className="text-yellow-600 ml-2">({warning.reason})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recipe list */}
            <div className="max-h-96 overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Title</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Cuisine</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Difficulty</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Ingredients</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedRecipes.map((recipe, idx) => (
                    <tr key={recipe.id || idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{recipe.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{recipe.cuisineType || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{recipe.difficulty || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{recipe.ingredients.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={reset}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${parsedRecipes.length} Recipe${parsedRecipes.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}

      {step === 'complete' && importResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-green-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Import Complete!</h2>
          <p className="text-gray-500 mb-6">
            Successfully imported {importResult.recipes.length} recipe{importResult.recipes.length !== 1 ? 's' : ''}
            {importResult.packId && ' and created pack'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Import More
            </button>
            <button
              onClick={() => navigate('/library')}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              View Library
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
