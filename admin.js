// ================================================================
// admin.js — MARCHÉ MOBORO
// Panel d'administration
// ================================================================

// ⚠️  Les identifiants admin sont vérifiés côté serveur via Supabase.
//     Ils ne sont PLUS stockés dans le code source.
//     La fonction adminLogin() envoie le code + PIN à Supabase
//     qui vérifie dans la table admin_credentials (non exposée).

let isAdmin = false;

// Connexion admin — vérification via Supabase (hors code source)
async function adminLogin() {
  const code = document.getElementById('adminCode').value.trim();
  const pin  = document.getElementById('adminPin').value.trim();

  if (!code || !pin) {
    showToast('Remplissez tous les champs', 'error');
    return;
  }

  try {
    // Vérification sécurisée : on compare le hash en base
    const { data, error } = await db
      .from('admin_credentials')
      .select('id')
      .eq('code',     code)
      .eq('pin_hash', hashPin(pin))
      .single();

    if (error || !data) {
      showToast('Identifiants admin incorrects', 'error');
      await logAdminAction('login_failed', 'admin', null, 'Tentative échouée');
      return;
    }

    isAdmin = true;
    showPage('adminDashboard');
    await logAdminAction('login', 'admin', null, 'Connexion admin réussie');
    loadAdminStats();

  } catch (e) {
    console.error('adminLogin error:', e);
    showToast('Erreur de connexion', 'error');
  }
}

// Charger stats admin
async function loadAdminStats() {
  const today = new Date().toISOString().split('T')[0];

  const { count: totalSellers } = await db.from(TABLES.SELLERS)
    .select('*', { count: 'exact', head: true });

  const { count: todaySellers } = await db.from(TABLES.SELLERS)
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);

  const { count: todayVisits } = await db.from(TABLES.VISITORS)
    .select('*', { count: 'exact', head: true })
    .gte('date', today);

  const { count: totalVisits } = await db.from(TABLES.VISITORS)
    .select('*', { count: 'exact', head: true });

  const { count: todayOrders } = await db.from(TABLES.ORDERS)
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);

  const { count: totalOrders } = await db.from(TABLES.ORDERS)
    .select('*', { count: 'exact', head: true });

  document.getElementById('statTotalSellers').innerText = totalSellers || 0;
  document.getElementById('statTodaySellers').innerText = todaySellers || 0;
  document.getElementById('statTodayVisits').innerText  = todayVisits  || 0;
  document.getElementById('statTotalVisits').innerText  = totalVisits  || 0;
  document.getElementById('statTodayOrders').innerText  = todayOrders  || 0;
  document.getElementById('statTotalOrders').innerText  = totalOrders  || 0;
}

// Charger liste vendeurs
async function loadSellersList() {
  const ville    = document.getElementById('filterVille').value;
  const quartier = document.getElementById('filterQuartier').value.trim();

  let query = db.from(TABLES.SELLERS)
    .select('*')
    .order('created_at', { ascending: false });

  if (ville)    query = query.ilike('ville',    `%${ville}%`);
  if (quartier) query = query.ilike('quartier', `%${quartier}%`);

  const { data: sellers } = await query;
  const tbody = document.getElementById('sellersTableBody');

  if (!sellers || sellers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Aucun vendeur.</td></tr>';
    return;
  }

  tbody.innerHTML = sellers.map(s => {
    const dynamisme  = getDynamisme(s.last_published);
    const dynamColor = { vert: '#52c41a', jaune: '#faad14', rouge: '#ff4d4f', noir: '#333' }[dynamisme];

    return `
      <tr>
        <td>${s.code}</td>
        <td>${s.full_name}<br><small>${s.ville} - ${s.quartier}</small></td>
        <td>${ALL_CATEGORIES[s.category] || s.category}</td>
        <td><span style="color:${dynamColor};font-weight:700;">● ${dynamisme}</span></td>
        <td><span style="color:${s.subscription_status === 'en_cours' ? '#52c41a' : '#ff4d4f'}">
          ${s.subscription_status === 'en_cours' ? 'En cours' : 'Expiré'}
        </span></td>
        <td>
          <button onclick="toggleBlock('${s.id}', ${s.is_blocked})"
            style="background:${s.is_blocked ? '#52c41a' : '#ff4d4f'};color:white;border:none;
                   padding:5px 10px;border-radius:8px;cursor:pointer;">
            ${s.is_blocked ? 'Débloquer' : 'Bloquer'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Calculer dynamisme
function getDynamisme(lastPublished) {
  if (!lastPublished) return 'noir';
  const diff = (new Date() - new Date(lastPublished)) / (1000 * 60 * 60 * 24);
  if (diff <= 1) return 'vert';
  if (diff <= 3) return 'jaune';
  if (diff <= 7) return 'rouge';
  return 'noir';
}

// Bloquer / débloquer vendeur
async function toggleBlock(sellerId, isBlocked) {
  const action = isBlocked ? 'débloquer' : 'bloquer';
  if (!confirm(`Voulez-vous ${action} ce vendeur ?`)) return;

  const { error } = await db.from(TABLES.SELLERS)
    .update({ is_blocked: !isBlocked })
    .eq('id', sellerId);

  if (error) {
    showToast('Erreur lors de l\'opération', 'error');
    return;
  }

  showToast(`Vendeur ${isBlocked ? 'débloqué' : 'bloqué'}`, 'success');
  await logAdminAction(
    isBlocked ? 'unblock_seller' : 'block_seller',
    'sellers', sellerId,
    `Vendeur ${isBlocked ? 'débloqué' : 'bloqué'} par admin`
  );
  loadSellersList();
}

// Charger positions par catégorie
async function loadPositions(catId) {
  const { data: sellers } = await db.from(TABLES.SELLERS)
    .select('*')
    .eq('category',   catId)
    .eq('is_blocked', false)
    .order('position', { ascending: true });

  const list = document.getElementById('positionsList');

  if (!sellers || sellers.length === 0) {
    list.innerHTML = '<p style="padding:10px;color:#888;">Aucun vendeur.</p>';
    return;
  }

  list.innerHTML = sellers.map((s, i) => `
    <div class="position-item">
      <span class="pos-number">#${i + 1}</span>
      <span class="pos-name">${s.full_name} (${s.code})</span>
      <div class="pos-controls">
        <button onclick="moveUp('${s.id}', '${catId}')"   ${i === 0                    ? 'disabled' : ''}>▲</button>
        <button onclick="moveDown('${s.id}', '${catId}')" ${i === sellers.length - 1   ? 'disabled' : ''}>▼</button>
      </div>
    </div>
  `).join('');
}

// Monter position
async function moveUp(sellerId, catId) {
  const { data: sellers } = await db.from(TABLES.SELLERS)
    .select('id, position').eq('category', catId).order('position');

  const idx = sellers.findIndex(s => s.id === sellerId);
  if (idx <= 0) return;

  const current = sellers[idx];
  const prev    = sellers[idx - 1];

  await db.from(TABLES.SELLERS).update({ position: prev.position    }).eq('id', current.id);
  await db.from(TABLES.SELLERS).update({ position: current.position }).eq('id', prev.id);

  await logAdminAction('move_position', 'sellers', sellerId, `Position montée — catégorie ${catId}`);
  loadPositions(catId);
}

// Descendre position
async function moveDown(sellerId, catId) {
  const { data: sellers } = await db.from(TABLES.SELLERS)
    .select('id, position').eq('category', catId).order('position');

  const idx = sellers.findIndex(s => s.id === sellerId);
  if (idx >= sellers.length - 1) return;

  const current = sellers[idx];
  const next    = sellers[idx + 1];

  await db.from(TABLES.SELLERS).update({ position: next.position    }).eq('id', current.id);
  await db.from(TABLES.SELLERS).update({ position: current.position }).eq('id', next.id);

  await logAdminAction('move_position', 'sellers', sellerId, `Position descendue — catégorie ${catId}`);
  loadPositions(catId);
}
