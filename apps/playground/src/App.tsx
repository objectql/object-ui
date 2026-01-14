import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
        <Route path="/:id" element={<Studio />} />
      </Routes>
    </Router>
  );
}
