// Smoke test: the CMA tool must mount without throwing in both its empty state
// and (indirectly) confirm the analysis engine + format helpers are wired right.
// Server-rendered so it needs no DOM env or testing-library — it only proves the
// component's render paths don't crash.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import CmaTool from './CmaTool.jsx';

describe('CmaTool — render smoke', () => {
  it('mounts the empty state seeded from a transaction', () => {
    const tx = { id: 'tx-1', address: '14030 Budworth Cir', year_built: 2005, list_price: 615000 };
    const html = renderToStaticMarkup(React.createElement(CmaTool, { tx, token: '' }));
    expect(html).toContain('Import MLS comp data');
    expect(html).toContain('cma-root'); // scoped wrapper present
    // seeded address should appear nowhere yet (subject form only shows once comps load),
    // but the component must not have thrown to get here.
    expect(html.length).toBeGreaterThan(500);
  });

  it('mounts with a missing/empty tx without crashing', () => {
    const html = renderToStaticMarkup(React.createElement(CmaTool, { tx: null, token: '' }));
    expect(html).toContain('Import MLS comp data');
  });
});
