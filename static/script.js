document.addEventListener('DOMContentLoaded', () => {
  let planets = [];
  let suggestionNodes = [];
  let selectedIndex = -1;
  const MAX_SUG = 20;

  async function safeFetch(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('fetch failed ' + url);
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) throw new Error('not json');
    return await r.json();
  }

  function getHab(p) {
    if (!p) return null;
    if (p.habitability_percent_norm !== undefined && p.habitability_percent_norm !== null) return Number(p.habitability_percent_norm);
    if (p.habitability_percent !== undefined && p.habitability_percent !== null) {
      const n = Number(p.habitability_percent);
      return Number.isNaN(n) ? null : n;
    }
    if (p.composite_habitability !== undefined && p.composite_habitability !== null) {
      const n = Number(p.composite_habitability) * 100;
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  async function loadPlanets() {
    try {
      planets = await safeFetch('/api/all');
    } catch (e) {
      console.error('Failed to load planets:', e);
      planets = [];
    }
    loadLeaderboards();
  }

  async function loadLeaderboards() {
    try {
      const categories = [
        { id: 'most-habitable', cat: 'most_habitable', limit: 5, isTemp: false },
        { id: 'most-hot', cat: 'most_hot', limit: 5, isTemp: true },
        { id: 'most-mass', cat: 'most_mass', limit: 5, isMass: true },
        { id: 'largest-radius', cat: 'largest_radius', limit: 5, isRadius: true },
        { id: 'coldest', cat: 'coldest', limit: 5, isColdest: true },
        { id: 'most-dense', cat: 'most_dense', limit: 5, isDensity: true },
        { id: 'highest-gravity', cat: 'highest_gravity', limit: 5, isGravity: true },
        { id: 'lowest-gravity', cat: 'lowest_gravity', limit: 5, isGravity: true },
        { id: 'longest-orbital-period', cat: 'longest_orbital_period', limit: 5, isOrbitalPeriod: true },
        { id: 'shortest-orbital-period', cat: 'shortest_orbital_period', limit: 5, isOrbitalPeriod: true }
      ];

      for (const category of categories) {
        try {
          const data = await safeFetch(`/api/top?cat=${category.cat}&limit=${category.limit}`);
          renderLeaderboard(category.id, data, category);
        } catch (e) {
          console.error(`Failed to load ${category.cat}:`, e);
        }
      }
    } catch (e) {
      console.error('Error loading leaderboards:', e);
    }
  }

  function renderLeaderboard(id, arr, options) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';

    arr.forEach((p, index) => {
      const name = p.name || 'Unknown';
      let value = '—';

      if (options.isTemp && p.avg_temp_C_norm !== undefined) {
        value = Math.round(p.avg_temp_C_norm) + '°C';
      } else if (options.isColdest && p.avg_temp_C_norm !== undefined) {
        value = Math.round(p.avg_temp_C_norm) + '°C';
      } else if (options.isMass && p.mass !== undefined) {
        value = Number(p.mass).toFixed(2) + ' M⊕';
      } else if (options.isRadius && p.radius !== undefined) {
        value = Number(p.radius).toFixed(2) + ' R⊕';
      } else if (options.isDensity && (p.density_rel || p.density)) {
        const d = p.density_rel || p.density;
        value = Number(d).toFixed(2) + ' ρ⊕';
      } else if (options.isGravity && p.surface_gravity !== undefined) {
        value = Number(p.surface_gravity).toFixed(2) + ' g⊕';
      } else if (options.isOrbitalPeriod && p.orbital_period_days !== undefined) {
        value = Number(p.orbital_period_days).toFixed(2) + ' days';
      } else if (options.isGasGiant) {
        value = p.radius ? Number(p.radius).toFixed(2) + ' R⊕' : 'Gas Giant';
      } else if (!options.isTemp) {
        const hab = getHab(p);
        value = hab !== null ? Math.round(hab * 100) / 100 + '%' : '—';
      }

      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.innerHTML = `
        <div>
          <strong>${index + 1}.</strong>
          <a href="/planet?name=${encodeURIComponent(name)}">${name}</a>
        </div>
        <span class="leaderboard-value">${value}</span>
      `;
      el.appendChild(li);
    });
  }

  const input = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');
  const toggle = document.getElementById('dropdown-toggle');

  function clearSelection() {
    suggestionNodes.forEach(n => n.classList.remove('active-suggestion'));
    selectedIndex = -1;
  }

  function highlightSuggestion(index) {
    clearSelection();
    if (index >= 0 && index < suggestionNodes.length) {
      suggestionNodes[index].classList.add('active-suggestion');
      selectedIndex = index;
      suggestionNodes[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function showDropdown() {
    if (dropdown) dropdown.style.display = 'block';
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  function hideDropdown() {
    if (dropdown) dropdown.style.display = 'none';
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    clearSelection();
  }

  function renderSuggestions(list) {
    if (!dropdown) return;
    dropdown.innerHTML = '';
    suggestionNodes = [];

    if (!list || list.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'dropdown-item';
      emptyDiv.textContent = 'No results found';
      emptyDiv.style.cursor = 'default';
      dropdown.appendChild(emptyDiv);
      showDropdown();
      return;
    }

    list = list.map(r => (r && r.item ? r.item : r));

    list = list.map(p => Object.assign({}, p, { __hab: getHab(p) }));

    list.sort((a, b) => {
      const A = a.__hab === null ? -Infinity : a.__hab;
      const B = b.__hab === null ? -Infinity : b.__hab;
      if (B !== A) return B - A;
      return (a.name || '').localeCompare(b.name || '');
    });

    list.slice(0, MAX_SUG).forEach((p, idx) => {
      const name = p.name || 'Unknown';
      const hab = p.__hab;
      const pct = hab !== null ? (Math.round(hab * 100) / 100) + '%' : '';
      
      const pctClass = hab !== null 
        ? (hab > 50 ? 'pct-green' : hab > 20 ? 'pct-yellow' : 'pct-red')
        : '';

      const a = document.createElement('a');
      a.className = 'dropdown-item';
      a.href = '/planet?name=' + encodeURIComponent(name);
      a.innerHTML = `
        <div class="name">${name}</div>
        <div><span class="pct-label ${pctClass}">${pct}</span></div>
      `;

      a.addEventListener('mouseenter', () => highlightSuggestion(idx));
      a.addEventListener('mouseleave', clearSelection);
      a.addEventListener('click', () => hideDropdown());

      dropdown.appendChild(a);
      suggestionNodes.push(a);
    });

    showDropdown();
  }

  function normalizeString(str) {
    return str.toLowerCase().replace(/[\s\-]/g, '');
  }

  if (input) {
    input.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim();
      if (!q) {
        hideDropdown();
        return;
      }

      const ql = q.toLowerCase();
      const qNorm = normalizeString(q);

      const exact = planets.find(p => p.name && normalizeString(p.name) === qNorm);
      if (exact) {
        renderSuggestions([{ item: exact }]);
        return;
      }

      const prefix = planets.filter(p => p.name && normalizeString(p.name).startsWith(qNorm));
      if (prefix.length > 0) {
        renderSuggestions(prefix.map(p => ({ item: p })));
        return;
      }

      const contains = planets.filter(p => p.name && normalizeString(p.name).includes(qNorm));
      renderSuggestions(contains.map(p => ({ item: p })));
    });

    input.addEventListener('keydown', (e) => {
      if (!dropdown || dropdown.style.display !== 'block' || suggestionNodes.length === 0) {
        if (e.key === 'Enter') {
          e.preventDefault();
          safeFetch('/api/search?q=' + encodeURIComponent(input.value.trim()) + '&limit=1')
            .then(arr => {
              if (arr && arr.length > 0) {
                window.location.href = '/planet?name=' + encodeURIComponent(arr[0].name);
              }
            })
            .catch(err => console.error('Search error:', err));
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = selectedIndex + 1;
        if (nextIndex < suggestionNodes.length) {
          highlightSuggestion(nextIndex);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = selectedIndex - 1;
        if (prevIndex >= 0) {
          highlightSuggestion(prevIndex);
        } else {
          clearSelection();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && suggestionNodes[selectedIndex]) {
          const href = suggestionNodes[selectedIndex].getAttribute('href');
          if (href) {
            window.location.href = href;
          }
        } else {
          safeFetch('/api/search?q=' + encodeURIComponent(input.value.trim()) + '&limit=1')
            .then(arr => {
              if (arr && arr.length > 0) {
                window.location.href = '/planet?name=' + encodeURIComponent(arr[0].name);
              }
            })
            .catch(err => console.error('Search error:', err));
        }
      } else if (e.key === 'Escape') {
        hideDropdown();
      }
    });
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      if (!dropdown) return;
      if (dropdown.style.display === 'block') {
        hideDropdown();
      } else {
        renderSuggestions(planets.slice(0, MAX_SUG).map(p => ({ item: p })));
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!input || !dropdown || !toggle) return;
    if (!input.contains(e.target) && !dropdown.contains(e.target) && !toggle.contains(e.target)) {
      hideDropdown();
    }
  });

  const surpriseBtn = document.getElementById('surprise-btn');
  if (surpriseBtn) {
    surpriseBtn.addEventListener('click', async () => {
      try {
        const planet = await safeFetch('/api/random');
        if (planet && planet.name) {
          window.location.href = '/planet?name=' + encodeURIComponent(planet.name);
        }
      } catch (e) {
        console.error('Surprise me failed:', e);
        alert('Could not load a random planet. Please try again.');
      }
    });
  }

  loadPlanets();
});

// this file was enhanced and debugged with the help of AI
