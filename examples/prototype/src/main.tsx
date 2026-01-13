import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import FilterBuilderDemo from './FilterBuilderDemo.tsx'

// Check if URL parameter specifies which demo to show
const urlParams = new URLSearchParams(window.location.search);
const demo = urlParams.get('demo');

const DemoApp = demo === 'filter-builder' ? FilterBuilderDemo : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
)
