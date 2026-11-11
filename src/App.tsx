import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProjectsPage } from './components/ProjectsPage';
import { ProjectDetailPage } from './components/ProjectDetailPage';
import { KeywordMapPage } from './components/KeywordMapPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects/:id/keywords/:keywordId/map" element={<KeywordMapPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
