/**
 * Algo Grid — builds the algorithm selection grid from the registry.
 * Groups algorithms by category with cat-label divs.
 */

/**
 * @param {HTMLElement} container  - the .algo-grid element
 * @param {object} registry        - the algorithm registry (has getAllMetadata())
 * @param {Function} onSelect      - called with algoId when user clicks
 */
export function buildAlgoGrid(container, registry, onSelect) {
  // Clear existing static HTML (it was placeholder)
  container.innerHTML = '';

  const all = registry.getAllMetadata();

  // Group by category preserving insertion order
  const categories = new Map();
  all.forEach(meta => {
    if (!categories.has(meta.cat)) categories.set(meta.cat, []);
    categories.get(meta.cat).push(meta);
  });

  const btnMap = new Map(); // id → button element

  categories.forEach((metas, cat) => {
    const catLabel = document.createElement('span');
    catLabel.className = 'cat-label';
    catLabel.textContent = cat;
    container.appendChild(catLabel);

    metas.forEach(meta => {
      const btn = document.createElement('button');
      btn.className = 'algo-btn';
      btn.dataset.algo = meta.id;
      btn.textContent = meta.name;

      btn.addEventListener('click', () => {
        // Clear all active
        btnMap.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onSelect(meta.id);
      });

      btnMap.set(meta.id, btn);
      container.appendChild(btn);
    });
  });

  // Return helper to set active programmatically
  return {
    setActive(id) {
      btnMap.forEach(b => b.classList.remove('active'));
      if (btnMap.has(id)) btnMap.get(id).classList.add('active');
    }
  };
}
