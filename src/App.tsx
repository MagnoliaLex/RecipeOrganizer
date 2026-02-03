import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Library from './pages/Library';
import RecipeDetail from './pages/RecipeDetail';
import Import from './pages/Import';
import CrawlEngine from './pages/CrawlEngine';
import Packs from './pages/Packs';
import Suggest from './pages/Suggest';
import { initDatabase } from './lib/db/client';

function App() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        setDbReady(true);
      } catch (err) {
        console.error('Failed to initialize database:', err);
        setError(err instanceof Error ? err.message : 'Database initialization failed');
      }
    };
    init();
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Database Error</h1>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing database...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/library" replace />} />
        <Route path="/library" element={<Library />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/import" element={<Import />} />
        <Route path="/crawl" element={<CrawlEngine />} />
        <Route path="/packs" element={<Packs />} />
        <Route path="/suggest" element={<Suggest />} />
      </Routes>
    </Layout>
  );
}

export default App;
