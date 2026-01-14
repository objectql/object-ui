import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Studio } from './pages/Studio';
import '@object-ui/components';

// Import lazy-loaded plugins
import '@object-ui/plugin-editor';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-markdown';
import '@object-ui/plugin-kanban';

// Import core styles
import './index.css';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/studio/:id" element={<Studio />} />
        {/* Default redirect to first example if typed manually specifically */}
        <Route path="/studio" element={<Navigate to="/studio/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
