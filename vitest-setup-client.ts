import '@testing-library/jest-dom/vitest';

// Components load the PDF engine with a dynamic import in onMount. A test file
// can finish before that import resolves, and Vitest then fails the run with
// "EnvironmentTeardownError" while loading the engine's worker URL. Loading the
// engine module up front makes those later imports resolve from the cache.
await import('./src/lib/engines/pdf/index.js');
