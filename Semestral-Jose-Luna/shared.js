// --- MÓDULO PRINCIPAL (CORE) ---
const App = (() => {
    // Configuración
    const API = 'https://pokeapi.co/api/v2';
    const CACHE_KEY = 'poke_cache_';
    // TTL: 5 MINUTOS
    const CACHE_TTL = 5 * 60 * 1000; 
    // TABLA DE TIPOS
    // Valores: 0 (Inmune), 0.5 (Poco eficaz), 2 (Súper eficaz)
    const TYPE_CHART = {
        normal: { rock: 0.5, ghost: 0, steel: 0.5 },
        fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
        water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
        grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
        electric: { water: 2, grass: 0.5, electric: 0.5, ground: 0, flying: 2, dragon: 0.5 },
        ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
        fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
        poison: { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
        ground: { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
        flying: { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
        psychic: { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
        bug: { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
        rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
        ghost: { psychic: 2, ghost: 2, dark: 0.5 },
        dragon: { dragon: 2, steel: 0.5, fairy: 0 },
        steel: { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
        dark: { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
        fairy: { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 }
    };

    // Cambiar tema 
    const toggleTheme = (toggle) => {
        document.body.classList.toggle('dark-mode');
        const current = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        try { localStorage.setItem('theme', current); } catch(e) {}
        toggle.textContent = current === 'dark' ? '☀️' : '🌙';
    };
    // Inicializar tema al cargar
    function initTheme() {
        const toggle = document.getElementById('theme-toggle');
        const isDark = localStorage.getItem('theme') === 'dark';
        if (isDark) document.body.classList.add('dark-mode');
        
        if (toggle) {
            toggle.textContent = isDark ? '☀️' : '🌙';
            toggle.onclick = () => toggleTheme(toggle);
        }
    }
    // FUNCIÓN DE LIMPIEZA DE CACHE
    function manageQuota() {
        console.warn("⚠️ Memoria llena. Ejecutando limpieza de emergencia...");
        const items = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_KEY)) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    items.push({ key, timestamp: item.timestamp });
                } catch (e) {
                    items.push({ key, timestamp: 0 }); 
                }
            }
        }

        // Ordenar por antigüedad
        items.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = Math.max(1, Math.floor(items.length * 0.5));
        for (let i = 0; i < toDelete; i++) {
            localStorage.removeItem(items[i].key);
        }
        console.log(`🧹 Se eliminaron ${toDelete} elementos antiguos.`);
    }
    // SISTEMA DE FETCH CON CACHÉ 
    async function getData(endpoint, keySuffix) {
        const key = CACHE_KEY + keySuffix;
        const cached = localStorage.getItem(key);
        // Verificar si existe en caché y no ha caducado
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TTL) {
                return { data, source: 'CACHE' };
            }
            // Si caducó, lo borramos
            try { localStorage.removeItem(key); } catch(e){}
        }
        // Si no está en caché, pedimos a la API
        const url = `${API}/${encodeURI(endpoint)}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error('404');
        }
        const data = await res.json();
        // Guardar en localStorage con manejo de errores de cuota
        try {
            localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                manageQuota(); // Llamar al recolector de basura
                try {
                    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
                } catch (e2) {
                    console.warn("❌ Espacio insuficiente. Mostrando sin guardar.");
                }
            }
        }

        return { data, source: 'API' };
    }
    // GUARDAR HISTORIAL DE BÚSQUEDAS
    function saveHistory(pokemon) {
        let history = JSON.parse(localStorage.getItem('poke_history') || '[]');
        history = history.filter(p => p.id !== pokemon.id).slice(0, 49);
        history.unshift({
            id: pokemon.id, name: pokemon.name, 
            sprite: pokemon.sprites.front_default,
            types: pokemon.types, 
            stats: pokemon.stats 
        });
        try {
            localStorage.setItem('poke_history', JSON.stringify(history));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                manageQuota();
                try { localStorage.setItem('poke_history', JSON.stringify(history)); } catch(e2){}
            }
        }
    }
    // TOGGLE FAVORITOS
    function toggleFav(pokemon) {
        let favs = JSON.parse(localStorage.getItem('poke_favs') || '[]');
        const idx = favs.findIndex(p => p.id === pokemon.id);
        let added = false;

        if (idx > -1) {
            favs.splice(idx, 1); 
        } else {
            // Manejar fallback de imagen
            const imageUrl = pokemon.sprite || (pokemon.sprites ? pokemon.sprites.front_default : 'img/fallback.png');
            favs.push({
                id: pokemon.id, 
                name: pokemon.name, 
                sprite: imageUrl, 
                types: pokemon.types, 
                stats: pokemon.stats 
            });
            added = true;
        }
        try {
            localStorage.setItem('poke_favs', JSON.stringify(favs));
        } catch (e) {
             if (e.name === 'QuotaExceededError') {
                alert('⚠️ Memoria llena. Limpiando espacio...');
                manageQuota();
                return false; 
            }
        }
        return added;
    }
    // VERIFICAR SI ES FAVORITO
    function isFav(id) {
        return JSON.parse(localStorage.getItem('poke_favs') || '[]').some(p => p.id === id);
    }
    // REPRODUCIR SONIDO
    function playSound(url) {
        if (url) new Audio(url).play().catch(() => {});
    }

    // Lógica de Batalla ---
    function calculateAdvantage(attacker, defender) {
        let maxMultiplier = 0;
        let explanation = "Daño normal";
        
        // Comparar todos los tipos del atacante contra los del defensor
        attacker.types.forEach(a => {
            const typeA = a.type.name;
            let currentTypeMultiplier = 1;
            
            defender.types.forEach(d => {
                const typeD = d.type.name;
                const chartRow = TYPE_CHART[typeA];
                if (chartRow) {
                    const mult = chartRow[typeD] !== undefined ? chartRow[typeD] : 1;
                    currentTypeMultiplier *= mult;
                }
            });

            // Guardar el multiplicador más alto 
            if (currentTypeMultiplier > maxMultiplier || (maxMultiplier === 0 && currentTypeMultiplier === 0)) {
                maxMultiplier = currentTypeMultiplier;
                
                if (maxMultiplier > 1) explanation = `${typeA} es súper efectivo contra ${defender.types[0].type.name}`;
                else if (maxMultiplier === 0) explanation = `${typeA} no tiene efecto en ${defender.types[0].type.name}`;
                else if (maxMultiplier < 1) explanation = `${typeA} es poco efectivo contra ${defender.types[0].type.name}`;
                else explanation = "Daño neutral entre tipos";
            }
        });
        if (maxMultiplier === 0 && explanation === "Daño normal") maxMultiplier = 1;
        return { multiplier: maxMultiplier, text: explanation };
    }
    // Exponer métodos públicos
    return { initTheme, getData, saveHistory, toggleFav, isFav, playSound, calculateAdvantage };
})();


((globalApp) => {

    // Helper: Crear tarjeta de evolución
    const createEvoCard = (poke, currentName) => {
        const isCurrent = (poke.name === currentName);
        return `
            <div class="evo-card ${isCurrent ? 'current' : ''}" 
                 onclick="localStorage.setItem('temp_search','${poke.name}'); location.reload();">
                <img src="${poke.img}" width="50" loading="lazy">
                <div class="evo-name">${poke.name}</div>
            </div>
        `;
    };
    // --- RENDERIZADO DE POKÉMON (Página de Búsqueda) ---
    function renderPokemon(p, src, evoData) {
        const fav = globalApp.isFav(p.id);
        const container = document.getElementById('resultContainer');
        let isBranching = false; 
        // Algoritmo recursivo para la cadena evolutiva
        function traverseEvolution(node, level, result) {
            if (!node) return;
            if (!result[level]) result[level] = [];
            const id = node.species.url.split('/').slice(-2, -1)[0];
            result[level].push({ name: node.species.name, id: id, img: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png` });
            if (node.evolves_to && node.evolves_to.length > 0) {
                if (node.evolves_to.length > 1) isBranching = true;
                node.evolves_to.forEach(child => traverseEvolution(child, level + 1, result));
            }
        }
        const evoTiers = [];
        traverseEvolution(evoData.chain, 0, evoTiers);
        let finalEvoHtml = '';
        if (isBranching) {
            finalEvoHtml = evoTiers.map((tier, index) => {
                const tierCards = tier.map(poke => createEvoCard(poke, p.name)).join('');
                let html = `<div class="evo-tier">${tierCards}</div>`;
                if (index < evoTiers.length - 1) html += `<div class="evo-separator-red"></div>`;
                return html;
            }).join('');
        } else {
            const flatList = evoTiers.flat();
            finalEvoHtml = flatList.map((poke, index) => {
                let html = createEvoCard(poke, p.name);
                if (index < flatList.length - 1) html += `<span class="evo-arrow">→</span>`;
                return html;
            }).join('');
        }
        const containerStyle = isBranching ? '' : 'display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:10px;';
        // Barras de estadísticas
        const statsHtml = p.stats.map(s => `
            <div class="stat-row">
                <div>${s.stat.name.substring(0,3).toUpperCase()}</div>
                <div class="stat-track">
                    <div class="stat-fill" style="width:${Math.min((s.base_stat/255)*100, 100)}%;"></div>
                </div>
            </div>
        `).join('');
        const typesHtml = p.types.map(t => `<span class="type-box">${t.type.name}</span>`).join('');
        const abilitiesHtml = p.abilities.map((a, index) => {
            const colorClass = index === 0 ? 'ability-primary' : 'ability-secondary';
            return `<span class="ability-box ${colorClass}">${a.ability.name}</span>`;
        }).join('');
        container.innerHTML = `
            <div class="result-card-container">
                <div class="card-label">POKEMON_DATA</div>
                <div class="result-card">
                    <div class="badge ${src==='API'?'bg-api':'bg-cache'}">SOURCE: ${src}</div>
                    <div class="pokemon-image-box">
                        <img src="${(p.sprites?.other?.['official-artwork']?.front_default) || p.sprites?.front_default || 'fallback.png'}" width="250" loading="lazy">
                    </div>
                    <div class="pokemon-name">
                        <span class="pokemon-id">#${p.id}</span> ${p.name}
                    </div>
                    <hr class="separator-line">
                    <div style="font-weight:bold; margin-bottom:5px; color:var(--text-main);">TIPOS</div>
                    <div class="tags-row">${typesHtml}</div>
                    <div style="font-weight:bold; margin-bottom:5px; color:var(--text-main);">HABILIDADES</div>
                    <div class="tags-row">${abilitiesHtml}</div>
                    <div style="margin-top:15px;">${statsHtml}</div>

                    <div class="fav-container">
                        <button id="btnFavAction" class="btn-fav-square ${fav ? 'fav-active' : ''}">♥</button>
                    </div>

                    <hr class="dashed-line">
                    <div class="evo-title">CADENA DE EVOLUCIÓN</div>
                    <div class="evo-container" style="${containerStyle}">${finalEvoHtml}</div>
                </div>
            </div>
        `;
        document.getElementById('btnFavAction').onclick = () => {
            const added = globalApp.toggleFav(p);
            const btn = document.getElementById('btnFavAction');
            if (added) btn.classList.add('fav-active');
            else btn.classList.remove('fav-active');
        };
    }
    // ---HABILIDAD
    function renderAbility(a, src) {
        const container = document.getElementById('resultContainer');
        const id = a.id;
        const nameObj = a.names.find(n => n.language.name === 'es');
        const displayName = nameObj ? nameObj.name : a.name.replace(/-/g, ' '); 
        let description = "Descripción no disponible.";
        const flavorEs = a.flavor_text_entries.find(e => e.language.name === 'es');
        const effectEs = a.effect_entries.find(e => e.language.name === 'es');
        const effectEn = a.effect_entries.find(e => e.language.name === 'en'); 
        if (flavorEs) {
            description = flavorEs.flavor_text;
        } else if (effectEs) {
            description = effectEs.effect;
        } else if (effectEn) {
            description = "(Inglés) " + effectEn.effect;
        }
        const pokeList = a.pokemon;
        const count = pokeList.length;
        const gridHtml = pokeList.map(item => {
            const pokeName = item.pokemon.name;
            const pokeId = item.pokemon.url.split('/').slice(-2, -1)[0];
            const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeId}.png`;
            return `
                <div class="mini-poke-card" onclick="localStorage.setItem('temp_search','${pokeName}'); location.reload();">
                    <img src="${spriteUrl}" width="60" loading="lazy" alt="${pokeName}">
                    <div class="mini-poke-name">${pokeName}</div>
                </div>
            `;
        }).join('');
        container.innerHTML = `
            <div class="result-card-container">
                <div class="card-label" style="background:var(--color-accent); color:black;">ABILITY_DATA</div>
                <div class="result-card">
                    <div class="badge ${src==='API'?'bg-api':'bg-cache'}">SOURCE: ${src}</div>
                    <div class="ability-header">
                        <div class="ability-title">✨ ${displayName.toUpperCase()}</div>
                        <div class="ability-id-box">#${id}</div>
                    </div>
                    <hr class="separator-line">
                    <div class="effect-box">
                        <div class="effect-label">EFECTO</div>
                        <div>${description}</div>
                    </div>
                    <div class="ability-poke-header">POKÉMON CON ESTA HABILIDAD (${count})</div>
                    <div class="scrollable-poke-list">${gridHtml}</div>
                </div>
            </div>
        `;
    }
    // --- INICIALIZACIÓN DE PÁGINA DE BÚSQUEDA ---
    async function initSearchPage() {
        const input = document.getElementById('searchInput');
        const btn = document.getElementById('btnSearch');
        const container = document.getElementById('resultContainer');
        const autoBox = document.getElementById('autocomplete-list');
        let allNames = [];
        try {
            const { data } = await globalApp.getData('pokemon?limit=1000', 'all_names');
            allNames = data.results.map(p => p.name);
        } catch(e) {}
        input.addEventListener('input', () => {
            const val = input.value.toLowerCase();
            autoBox.innerHTML = '';
            if (!val) { autoBox.classList.add('hidden'); return; }
            const matches = allNames.filter(n => n.startsWith(val)).slice(0, 6);
            if (matches.length > 0) {
                autoBox.classList.remove('hidden');
                matches.forEach(name => {
                    const div = document.createElement('div');
                    div.className = 'autocomplete-item';
                    div.innerHTML = `<span>${name}</span>`; 
                    div.onclick = () => {
                        input.value = name;
                        autoBox.classList.add('hidden');
                        doSearch();
                    };
                    autoBox.appendChild(div);
                });
            } else {
                autoBox.classList.add('hidden');
            }
        });
        document.addEventListener('click', (e) => {
            if (e.target !== input && !autoBox.contains(e.target)) {
                autoBox.classList.add('hidden');
            }
        });
        async function doSearch() {
            let query = input.value.toLowerCase().trim();
            const typeEl = document.getElementById('searchType');
            const radioEl = document.querySelector('input[name="sType"]:checked');
            const type = typeEl ? typeEl.value : (radioEl || {}).value;
            if (!query || !type) {
                container.innerHTML = '';
                return;
            }
            if (type === 'pokemon') {
                const numericId = parseInt(query, 10);
                if (!isNaN(numericId) && isFinite(numericId)) {
                    if (numericId > 0) {
                        query = String(numericId);
                    } else {
                        container.innerHTML = '<div class="card" style="color:var(--color-secondary)">❌ ID inválido.</div>';
                        return;
                    }
                }
            }
            container.innerHTML = '<div class="card">⌛ Buscando...</div>';
            autoBox.classList.add('hidden');
            try {
                if (type === 'pokemon') {
                    const { data: p, source } = await globalApp.getData(`pokemon/${query}`, `pk_${query}`);
                    if (p.cries && p.cries.latest) {
                        globalApp.playSound(p.cries.latest);
                    }
                    globalApp.saveHistory(p);

                    const { data: spec } = await globalApp.getData(`pokemon-species/${p.id}`, `sp_${p.id}`);
                    const evoUrl = spec.evolution_chain.url;
                    const evoId = evoUrl.split('/').slice(-2, -1)[0];
                    const { data: evo } = await globalApp.getData(`evolution-chain/${evoId}`, `evo_${evoId}`);

                    renderPokemon(p, source, evo);
                } else if (type === 'ability') {
                    const { data: a, source } = await globalApp.getData(`ability/${query}`, `ab_${query}`);
                    renderAbility(a, source);
                }
            } catch (e) {
                console.error("Error búsqueda:", e);
                container.innerHTML = '<div class="card" style="color:var(--color-secondary)">❌ No encontrado (o error de red).</div>';
            }
        }
        const temp = localStorage.getItem('temp_search');
        if (temp) {
            input.value = temp;
            localStorage.removeItem('temp_search');
            doSearch();
        }
        btn.onclick = doSearch;
    }
    //Tarjetas pequeñas
    function renderMiniBattleCard(p, source, targetColId) {
        const target = document.getElementById(targetColId);
        const fav = globalApp.isFav(p.id);
        const sourceHtml = source === 'API' 
            ? '<span class="badge bg-api" style="position: absolute; top: -10px; right: -10px; z-index: 10; font-size: 0.7em; padding: 5px 8px;">API</span>' 
            : '<span class="badge bg-cache" style="position: absolute; top: -10px; right: -10px; z-index: 10; font-size: 0.7em; padding: 5px 8px;">CACHÉ</span>';
        const typesHtml = p.types.map(t => `<span class="type-box">${t.type.name.toUpperCase()}</span>`).join('');
        target.innerHTML = `
            <div class="mini-battle-card">
                <div style="position: relative;">
                    ${sourceHtml}
                    <div style="margin: 10px auto; display: inline-block;">
                        <img src="${p.sprites.front_default}" width="100" loading="lazy" alt="${p.name}" style="filter: drop-shadow(3px 3px 0 rgba(0,0,0,0.1));">
                    </div>
                    <div style="font-weight: 900; margin-bottom: 10px; font-size: 1.2em; text-transform: uppercase;">
                        #${p.id} ${p.name}
                    </div>
                    <div class="tags-row" style="display: flex; justify-content: center; gap: 5px; margin-bottom: 15px;">
                        ${typesHtml}
                    </div>
                    <button id="miniFavBtn_${p.id}_${targetColId}" 
                            class="btn-fav-square ${fav ? 'fav-active' : ''}" 
                            style="width: 45px; height: 45px; margin: 0 auto; font-size: 1.5rem;">
                        ♥
                    </button>
                </div>
            </div>
        `;
        document.getElementById(`miniFavBtn_${p.id}_${targetColId}`).onclick = (e) => {
            e.stopPropagation();
            const added = globalApp.toggleFav(p);
            e.currentTarget.classList.toggle('fav-active', added);
        };
        target.dataset.pokemon = JSON.stringify({
            id: p.id, name: p.name, sprite: p.sprites.front_default, types: p.types, stats: p.stats 
        });
    }
    // --- BATALLA ---
    function initVsPage() {
        const pageVsContainer = document.getElementById('page-vs');
        let dynamicContentContainer = document.getElementById('vs-dynamic-content');
        if (!dynamicContentContainer) {
             const oldContentWrapper = document.querySelector('main#page-vs > div:nth-child(3)');
             if (oldContentWrapper && oldContentWrapper.querySelector('input')) {
                 const parent = oldContentWrapper.parentNode;
                 dynamicContentContainer = document.createElement('div');
                 dynamicContentContainer.id = 'vs-dynamic-content';
                 dynamicContentContainer.style.width = '100%'; 
                 dynamicContentContainer.style.maxWidth = '800px'; 
                 dynamicContentContainer.style.paddingTop = '20px';
                 parent.insertBefore(dynamicContentContainer, oldContentWrapper);
                 oldContentWrapper.remove();
                 const oldH1 = document.querySelector('main#page-vs > h1'); if (oldH1) oldH1.remove();
                 const oldArena = document.getElementById('battle-arena'); if (oldArena) oldArena.remove();
                 const oldWinnerMsg = document.getElementById('winner-msg'); if (oldWinnerMsg) oldWinnerMsg.remove();
             } else {
                 dynamicContentContainer = pageVsContainer;
             }
        }
        dynamicContentContainer.innerHTML = `
            <div class="vs-main-controls">
                <div class="vs-inputs-row" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                    <div class="vs-player-group" style="display: flex; gap: 15px; align-items: center;">
                        <input type="text" id="p1" class="search-input" style="width: 150px; flex-grow: 0;" placeholder="Pokémon 1">
                        <button id="btnP1Search" class="search-btn btn-brutalist bg-secondary">BUSCAR</button>
                    </div>
                    <div class="vs-separator" style="color: var(--color-secondary); font-weight: bold; font-size: 1.5em; text-shadow: 2px 2px black;">VS</div>
                    <div class="vs-player-group" style="display: flex; gap: 15px; align-items: center;">
                        <input type="text" id="p2" class="search-input" style="width: 150px; flex-grow: 0;" placeholder="Pokémon 2">
                        <button id="btnP2Search" class="search-btn btn-brutalist bg-secondary">BUSCAR</button>
                    </div>
                </div>
                <div style="text-align: center; margin-bottom: 30px;">
                    <button id="btnFight" class="btn-brutalist bg-secondary" style="width: 300px; padding: 15px 10px; font-size: 1.5em;">
                        ⚔️ ¡Batallar!
                    </button>
                </div>
                
                <div id="battle-display-area">
                    <div id="battle-arena" style="display: flex; justify-content: space-around; gap: 20px;">
                        <div id="col1" style="flex: 1; min-height: 250px;"></div>
                        <div id="col2" style="flex: 1; min-height: 250px;"></div>
                    </div>
                </div>
                <div id="winner-msg" class="hidden" style="text-align: center; margin-top: 15px; font-weight: bold; color: var(--color-secondary);"></div>
            </div>
        `;
        const input1 = document.getElementById('p1');
        const input2 = document.getElementById('p2');
        const btnP1Search = document.getElementById('btnP1Search');
        const btnP2Search = document.getElementById('btnP2Search');
        const handleSearch = async (inputEl, targetColId) => {
            let query = inputEl.value.toLowerCase().trim();
            const target = document.getElementById(targetColId);
            if (!query) { target.innerHTML = ''; return; }
            target.innerHTML = '<div class="card">⌛ Buscando...</div>';
            
            const numericId = parseInt(query, 10);
            if (!isNaN(numericId) && isFinite(numericId) && numericId > 0) {
                query = String(numericId);
            }

            try {
                const { data: p, source } = await globalApp.getData(`pokemon/${query}`, `pk_${query}`);
                globalApp.saveHistory(p); 
                renderMiniBattleCard(p, source, targetColId);
            } catch (e) {
                target.innerHTML = '<div class="card" style="color:var(--color-secondary)">❌ No encontrado.</div>';
            }
        };
        btnP1Search.onclick = () => handleSearch(input1, 'col1');
        btnP2Search.onclick = () => handleSearch(input2, 'col2');
        const btn = document.getElementById('btnFight');
        btn.onclick = async () => {
            const col1 = document.getElementById('col1');
            const col2 = document.getElementById('col2');
            const winnerMsg = document.getElementById('winner-msg');

            // Validación
            if (!col1.dataset.pokemon || !col2.dataset.pokemon) {
                winnerMsg.classList.remove('hidden');
                winnerMsg.textContent = "⚠️ Busca dos Pokémon antes de iniciar la batalla.";
                return;
            }
            const p1 = JSON.parse(col1.dataset.pokemon);
            const p2 = JSON.parse(col2.dataset.pokemon);
            // LIMPIAR ÁREA DE BATALLA Y MOSTRAR RESULTADO FINAL
            const displayArea = document.getElementById('battle-display-area');
            displayArea.innerHTML = ''; 
            renderBattleResult(p1, p2, displayArea);
        };
        // Tarjeta Gigante de Resultado + ANÁLISIS
        function renderBattleResult(p1, p2, container) {
            const score1 = p1.stats.reduce((a,b) => a + b.base_stat, 0);
            const score2 = p2.stats.reduce((a,b) => a + b.base_stat, 0);
            let wId = null;
            if (score1 > score2) wId = p1.id;
            else if (score2 > score1) wId = p2.id;
            // Crea tarjeta Ganador/Perdedor
            const createFighterCard = (p, score, isWinner, isDraw) => {
                const fav = globalApp.isFav(p.id);
                const typesHtml = p.types.map(t => `<span class="type-box" style="font-size:0.7em; padding:4px 8px;">${t.type.name.toUpperCase()}</span>`).join('');
                let statusClass = '';
                let winnerBadgeHtml = '';

                if (!isDraw) {
                    if (isWinner) {
                        statusClass = 'fighter-winner';
                        winnerBadgeHtml = `<div class="winner-indicator">🏆 GANADOR</div>`;
                    } else {
                        statusClass = 'fighter-loser';
                    }
                }
                return `
                    <div class="battle-fighter-card ${statusClass}">
                        ${winnerBadgeHtml}
                        <div style="margin-bottom:10px; margin-top: 15px;">
                            <img src="${p.sprite}" width="120" loading="lazy" alt="${p.name}">
                        </div>
                        <div style="font-weight:900; font-size:1.2rem; text-transform:uppercase; margin-bottom:5px; color:#000;">
                            ${p.name}
                        </div>
                        <div class="tags-row" style="justify-content:center; margin-bottom:15px;">
                            ${typesHtml}
                        </div>
                        <hr class="dashed-line" style="margin: 15px 0; border-color: #000; border-width: 2px;">
                        <div class="battle-score">${score} PTS</div>
                        <button id="resFav_${p.id}" class="btn-fav-square ${fav ? 'fav-active' : ''}" style="width:50px; height:50px; font-size:1.8rem; margin: 0 auto;">♥</button>
                    </div>
                `;
            };
            const card1 = createFighterCard(p1, score1, wId === p1.id, wId === null);
            const card2 = createFighterCard(p2, score2, wId === p2.id, wId === null);
            //VENTAJAS DE TIPO
            const p1Advantage = globalApp.calculateAdvantage(p1, p2);
            const p2Advantage = globalApp.calculateAdvantage(p2, p1);
            const getBoxClass = (multiplier) => {
                if (multiplier > 1) return 'analysis-success'; 
                if (multiplier < 1) return 'analysis-danger';  
                return 'analysis-neutral'; 
            };
            const advHtml1 = `
                <div class="matchup-card ${getBoxClass(p1Advantage.multiplier)}">
                    <div class="matchup-text">${p1.name} VS ${p2.name}: x${p1Advantage.multiplier.toFixed(2)}</div>
                    <div class="matchup-desc">${p1Advantage.text}</div>
                </div>
            `;
            const advHtml2 = `
                <div class="matchup-card ${getBoxClass(p2Advantage.multiplier)}">
                    <div class="matchup-text">${p2.name} VS ${p1.name}: x${p2Advantage.multiplier.toFixed(2)}</div>
                    <div class="matchup-desc">${p2Advantage.text}</div>
                </div>
            `;
            // COMPARACIÓN DE STATS
            const statLabels = {
                'hp': 'HP', 'attack': 'ATK', 'defense': 'DEF', 
                'special-attack': 'SPA', 'special-defense': 'SPD', 'speed': 'SPE'
            };
            
            let statsComparisonHtml = '<div class="stat-comparison-container">';
            
            p1.stats.forEach((s, index) => {
                const statName = s.stat.name;
                const label = statLabels[statName] || '???';
                const val1 = s.base_stat;
                const val2 = p2.stats[index].base_stat;
                
                const color1 = val1 > val2 ? 'text-winner' : 'text-loser';
                const color2 = val2 > val1 ? 'text-winner' : 'text-loser';
                
                const w1 = Math.min((val1 / 200) * 100, 100);
                const w2 = Math.min((val2 / 200) * 100, 100);
                statsComparisonHtml += `
                    <div class="stat-row">
                        <div class="stat-col-left">
                            <span class="stat-val-text ${color1}">${val1}</span>
                            <div class="stat-bar-wrapper">
                                <div class="stat-fill-bar" style="width: ${w1}%;"></div>
                            </div>
                        </div>
                        <div class="stat-label-center">${label}</div>
                        <div class="stat-col-right">
                            <div class="stat-bar-wrapper">
                                <div class="stat-fill-bar" style="width: ${w2}%;"></div>
                            </div>
                            <span class="stat-val-text ${color2}">${val2}</span>
                        </div>
                    </div>
                `;
            });
            statsComparisonHtml += '</div>';
            // Tarjeta + Análisis
            container.innerHTML = `
                <div class="result-card" style="margin-top:30px; padding: 30px;">
                    <div class="battle-title-text" style="font-size: 1.8rem;">
                        ⚔️ RESULTADO DE LA BATALLA ⚔️
                    </div>
                    
                    <hr class="dashed-line" style="border-width: 3px;">
                    
                    <div class="battle-fighters-row">
                        ${card1}
                        ${card2}
                    </div>
                    
                    <div class="analysis-container">
                        <div class="dashed-line" style="border-color: #000; opacity: 0.3; margin: 20px 0;"></div>
                        
                        <div class="analysis-title-main">📊 ANÁLISIS DE LA BATALLA</div>
                        
                        <div class="analysis-box">
                            <div class="analysis-box-title">
                                ⚡ VENTAJAS DE TIPO
                            </div>
                            <hr class="solid-line">
                            <div class="type-matchups">
                                ${advHtml1}
                                ${advHtml2}
                            </div>
                        </div>

                        <div class="dashed-line" style="border-color: #000; opacity: 0.3; margin: 20px 0;"></div>
                        <div class="analysis-title-main">📈 COMPARACIÓN DE STATS</div>
                        
                        <div class="analysis-box" style="padding: 10px;">
                            ${statsComparisonHtml}
                        </div>
                    </div>

                    <div style="text-align:center; margin-top:30px;">
                        <button class="poke-btn" onclick="location.reload()" style="margin:0 auto; background:var(--color-accent); font-size: 1.1rem;">
                            🔄 NUEVA BATALLA
                        </button>
                    </div>
                </div>
            `;
            // Eventos Favoritos (Tarjeta final)
            document.getElementById(`resFav_${p1.id}`).onclick = (e) => {
                const added = globalApp.toggleFav(p1);
                e.currentTarget.classList.toggle('fav-active', added);
            };
            document.getElementById(`resFav_${p2.id}`).onclick = (e) => {
                const added = globalApp.toggleFav(p2);
                e.currentTarget.classList.toggle('fav-active', added);
            };
        }
    }
    // Helper global para botón VS
    window.addFavFromVs = (id, name, sprite) => {
        globalApp.toggleFav({id, name, sprites:{front_default:sprite}});
        alert('Lista de favoritos actualizada');
    };
    // --- PÁGINAS DE LISTADO (Historial y Favoritos) ---
    function initListPage(type) {
        const container = document.getElementById('grid-container');
        const isHistory = type === 'history';
        const key = isHistory ? 'poke_history' : 'poke_favs';
        
        function render() {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            container.innerHTML = '';
            if (list.length === 0) {
                const typeLabel = isHistory ? 'POKÉMONES EN EL HISTÓRICO' : 'FAVORITOS GUARDADOS';
                const subtitleText = isHistory
                ? 'Busca un Pokémon para agregarlo aquí': 'Busca un Pokémon y márcalo como favorito';
                const iconSrc = isHistory 
                    ? "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u1f4dc.png"
                    : "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u2764.png";
                const iconAlt = isHistory ? "Pergamino" : "Corazón";

                container.innerHTML = `
                    <div class="empty-state-card">
                        <img src="${iconSrc}" alt="${iconAlt}" class="empty-state-icon">
                        <h2 class="empty-state-title">NO HAY ${typeLabel}</h2>
                        <p class="empty-state-subtitle">${subtitleText}</p>
                    </div>
                `;
                return;
            }
            list.forEach(p => {
                const div = document.createElement('div');
                div.style.cursor = 'pointer';
                div.className = 'fav-card';
                const isCurrentlyFav = globalApp.isFav(p.id);
                const types = p.types || []; 
                const typesHtml = types.map(t => `<span class="type-box">${t.type.name}</span>`).join('');
                
                const favButtonHtml = isHistory 
                    ? `<button class="btn-fav-square hist-fav-btn ${isCurrentlyFav ? 'fav-active' : ''}" 
                               data-id="${p.id}"
                               style="z-index: 10; background: var(--color-accent); width: 50px; height: 50px;">
                           ♥
                       </button>`
                    : '';
                
                div.innerHTML = `
                    <div class="fav-img-box">
                        <img src="${p.sprite}" width="65" loading="lazy" alt="${p.name}">
                    </div>
                    <div class="fav-info-group">
                        <div class="fav-id-name">
                            <span class="fav-id">#${p.id}</span>
                            <span class="fav-name">${p.name.toUpperCase()}</span>
                        </div>
                        <div class="fav-types-row tags-row">
                            ${typesHtml}
                        </div>
                    </div>
                    <div class="fav-action-buttons" style="display: flex; align-items: center; gap: 8px;">
                        ${favButtonHtml}
                        <button class="fav-delete-btn del-btn">🗑️</button>
                    </div>
                `;
                if (isHistory) {
                    const favBtn = div.querySelector('.hist-fav-btn');
                    if (favBtn) {
                        favBtn.addEventListener('click', (e) => {
                            e.stopPropagation(); 
                            const added = globalApp.toggleFav(p);
                            e.currentTarget.classList.toggle('fav-active', added);
                        });
                    }
                }
                const deleteBtn = div.querySelector('.del-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); 
                        const newList = list.filter(x => x.id !== p.id);
                        try { localStorage.setItem(key, JSON.stringify(newList)); } catch(e){}
                        render(); 
                    });
                }
                div.addEventListener('click', () => {
                    localStorage.setItem('temp_search', p.name);
                    window.location.href = 'index.html';
                });
                container.appendChild(div);
            });
            
            if (list.length > 0) {
                const btnContainer = document.createElement('div');
                btnContainer.style.width = '100%';
                btnContainer.style.display = 'flex';
                btnContainer.style.justifyContent = 'center';
                btnContainer.style.padding = '20px 0';
                const btnClear = document.createElement('button');
                btnClear.className = 'search-btn'; 
                btnClear.style.backgroundColor = 'var(--color-secondary)'; 
                btnClear.style.minWidth = '200px';
                btnClear.innerHTML = isHistory ? '🗑️ BORRAR HISTORIAL' : '🗑️ ELIMINAR TODO';
                btnClear.onclick = () => {
                    if(confirm(`¿Estás seguro de que quieres borrar todos los ${isHistory ? 'elementos del historial' : 'favoritos'}?`)) {
                        localStorage.removeItem(key);
                        if(isHistory) localStorage.removeItem('poke_cache_'); 
                        render();
                    }
                };
                btnContainer.appendChild(btnClear);
                container.appendChild(btnContainer);
            }
        }
        render();
    }
    // --- INICIALIZACIÓN GENERAL ---
    document.addEventListener('DOMContentLoaded', () => {
        globalApp.initTheme();
        if (document.getElementById('page-search')) initSearchPage();
        if (document.getElementById('page-vs')) initVsPage();
        if (document.getElementById('page-history')) initListPage('history');
        if (document.getElementById('page-favs')) initListPage('favs');
    });

})(App);