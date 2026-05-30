// ==================== SEARCH.JS ====================

let searchTimeout = null;

// ================================================================
// Recherche principale — BUG CORRIGÉ (condition === remplacée)
// ================================================================
function handleSearch() {
  clearTimeout(searchTimeout);
  const query = document.getElementById('searchInput').value.trim();

  if (query.length < 2) {
    // CORRIGÉ: était "=== 'block' &&" — mauvaise syntaxe
    if (document.getElementById('searchResultsPage').style.display === 'block') {
      showPage('homePage');
    }
    return;
  }

  searchTimeout = setTimeout(() => performSearch(query), 400);
}

// ================================================================
// Effectuer la recherche
// ================================================================
async function performSearch(query) {
  showPage('searchResultsPage');
  document.getElementById('searchResultsTitle').innerText = `Résultats pour "${query}"`;
  document.getElementById('searchResults').innerHTML =
    '<div class="loading">Recherche en cours...</div>';

  const q = query.toLowerCase().trim();

  // Mots-clés → catégories
  const categoryKeywords = {
    'cosmétique': 'c3', 'cosmetique': 'c3', 'beaute': 'c3', 'beauté': 'c3',
    'basket': 'c1', 'chaussure': 'c1',
    'téléphone': 'c2', 'telephone': 'c2', 'accessoire': 'c2',
    'vêtement': 'c4', 'vetement': 'c4', 'robe': 'c4',
    'sac': 'c6', 'mode': 'c6',
    'maison': 'c7', 'décoration': 'c7', 'decoration': 'c7',
    'savon': 'c8', 'naturel': 'c8',
    'parfum': 'c9', 'soin': 'c9',
    'bébé': 'c10', 'bebe': 'c10', 'enfant': 'c10',
    'perruque': 'c11', 'mèche': 'c11', 'meche': 'c11',
    'lingerie': 'c12', 'rideau': 'c12',
    'santé': 'c13', 'sante': 'c13',
    'friperie': 'c14',
    'tissu': 'c15', 'pagne': 'c15',
    'occasion': 'c16',
    'pâtisserie': 'c17', 'patisserie': 'c17',
    'électronique': 'c20', 'electronique': 'c20', 'télé': 'c20', 'tele': 'c20',
    'immobilier': 'immo',
    'coiffure': 'coiffure',
    'hôtel': 'hotel', 'hotel': 'hotel',
    'mariage': 'deco-mariage',
    'ménage': 'menage', 'menage': 'menage',
    'grossiste': 'ig', 'importateur': 'ig'
  };

  let results = { sellers: [], products: [] };

  try {
    // 1. Produit + prix (ex: "robe 15000")
    const priceMatch = q.match(/(.+?)\s+(\d+)\s*(?:fcfa|f)?$/i);

    if (priceMatch) {
      const productName = priceMatch[1].trim();
      const targetPrice = Number(priceMatch[2]);
      const min = targetPrice * 0.95;
      const max = targetPrice * 1.05;

      const { data: products, error } = await db.from(TABLES.PRODUCTS)
        .select('*, sellers!inner(full_name, phone, quartier, ville, is_blocked)')
        .ilike('name', `%${productName}%`)
        .gte('price', min)
        .lte('price', max)
        .eq('is_active', true)
        .eq('sellers.is_blocked', false);

      if (error) console.error('search price error:', JSON.stringify(error));

      results.products = products || [];
      renderSearchResults(
        results,
        `Produits "${productName}" autour de ${formatPrice(targetPrice)} FCFA (±5%)`
      );
      return;
    }

    // 2. Quartier + catégorie (ex: "moungali basket")
    let detectedCat      = null;
    let detectedQuartier = null;

    for (const [keyword, catId] of Object.entries(categoryKeywords)) {
      if (q.includes(keyword)) {
        detectedCat      = catId;
        detectedQuartier = q.replace(keyword, '').trim();
        break;
      }
    }

    if (detectedCat && detectedQuartier) {
      const { data: sellers, error } = await db.from(TABLES.SELLERS)
        .select('*')
        .eq('category',   detectedCat)
        .ilike('quartier', `%${detectedQuartier}%`)
        .eq('is_blocked', false)
        .eq('is_active',  true);

      if (error) console.error('search cat+quartier error:', JSON.stringify(error));

      results.sellers = sellers || [];
      renderSearchResults(
        results,
        `Vendeurs de ${ALL_CATEGORIES[detectedCat]} à ${detectedQuartier}`
      );
      return;
    }

    // 3. Recherches parallèles
    const [
      { data: sellersByQuartier },
      { data: sellersByVille    },
      { data: sellersByName     },
      { data: productsByName    }
    ] = await Promise.all([
      db.from(TABLES.SELLERS).select('*')
        .ilike('quartier',   `%${q}%`)
        .eq('is_blocked', false)
        .eq('is_active',  true),

      db.from(TABLES.SELLERS).select('*')
        .ilike('ville',      `%${q}%`)
        .eq('is_blocked', false)
        .eq('is_active',  true),

      db.from(TABLES.SELLERS).select('*')
        .ilike('full_name',  `%${q}%`)
        .eq('is_blocked', false)
        .eq('is_active',  true),

      db.from(TABLES.PRODUCTS)
        .select('*, sellers!inner(full_name, phone, quartier, ville, is_blocked)')
        .ilike('name', `%${q}%`)
        .eq('is_active', true)
        .eq('sellers.is_blocked', false)
    ]);

    // Fusionner vendeurs sans doublons
    const allSellers    = [
      ...(sellersByQuartier || []),
      ...(sellersByVille    || []),
      ...(sellersByName     || [])
    ];
    const uniqueSellers = allSellers.filter(
      (s, i, arr) => arr.findIndex(x => x.id === s.id) === i
    );

    results.sellers  = uniqueSellers;
    results.products = productsByName || [];

    renderSearchResults(results, `Résultats pour "${query}"`);

  } catch (e) {
    console.error('performSearch exception:', e);
    document.getElementById('searchResults').innerHTML =
      '<p style="text-align:center;padding:30px;color:#888;">Erreur de recherche. Réessayez.</p>';
  }
}

// ================================================================
// Afficher résultats
// ================================================================
function renderSearchResults(results, title) {
  document.getElementById('searchResultsTitle').innerText = title;
  const container = document.getElementById('searchResults');

  if (results.sellers.length === 0 && results.products.length === 0) {
    container.innerHTML =
      '<p style="text-align:center;padding:30px;color:#888;">Aucun résultat trouvé.<br>Essayez un autre mot-clé.</p>';
    return;
  }

  let html = '';

  if (results.sellers.length > 0) {
    html += `<h3 style="padding:10px 0;font-size:16px;color:#1677FF;">
               Vendeurs (${results.sellers.length})
             </h3>`;
    html += results.sellers.map(s => `
      <div class="seller-card" style="margin-bottom:12px;">
        <img src="${s.photo || 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'}"
             class="seller-image"
             onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'">
        <div class="seller-info">
          <h3>${s.full_name}</h3>
          <p class="seller-location">📍 ${s.quartier}, ${s.ville}</p>
          <p class="seller-desc">${s.description || ''}</p>
          <div class="seller-actions">
            <button class="view-btn"
              onclick="openSellerProductsFromSearch('${s.id}')">
              Voir publications
            </button>
            <a href="https://wa.me/${s.phone}" target="_blank" class="contact-btn">
              Contacter
            </a>
          </div>
        </div>
      </div>
    `).join('');
  }

  if (results.products.length > 0) {
    html += `<h3 style="padding:10px 0;font-size:16px;color:#1677FF;">
               Produits (${results.products.length})
             </h3>`;
    html += results.products.map(p => `
      <div class="product-card" style="margin-bottom:12px;">
        <img src="${p.image}"
          onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=600'">
        <div class="product-content">
          <h3>${p.name}</h3>
          <p style="color:#888;font-size:13px;">
            Par: ${p.sellers?.full_name || p.seller_name}
          </p>
          <p class="product-price">${formatPrice(p.price)} FCFA</p>
          <a href="https://wa.me/${p.sellers?.phone || p.seller_phone}"
             target="_blank" class="contact-btn-product">
            Contacter le vendeur
          </a>
        </div>
      </div>
    `).join('');
  }

  container.innerHTML = html;
}

// ================================================================
// Ouvrir publications depuis recherche
// ================================================================
async function openSellerProductsFromSearch(sellerId) {
  try {
    const { data: seller, error } = await db.from(TABLES.SELLERS)
      .select('*').eq('id', sellerId).single();

    if (error || !seller) {
      console.error('openSellerProductsFromSearch error:', JSON.stringify(error));
      showToast('Impossible de charger ce vendeur', 'error');
      return;
    }

    window.currentViewedSeller = seller;
    const type = Object.keys(CATEGORIES_A).includes(seller.category) ? 'A' : 'B';
    currentCategoryType = type;
    await openSellerProducts(sellerId, type);

  } catch (e) {
    console.error('openSellerProductsFromSearch exception:', e);
  }
}
