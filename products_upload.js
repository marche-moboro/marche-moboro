// ================================================================
// products.js — MARCHÉ MOBORO (avec upload photo)
// ================================================================

// ================================================================
// Dashboard vendeur
// ================================================================
async function openSellerDashboard() {
  if (!currentSeller) { showPage('loginPage'); return; }

  const { data: seller } = await db.from(TABLES.SELLERS)
    .select('*').eq('id', currentSeller.id).single();
  if (seller) currentSeller = seller;

  document.getElementById('dashSellerName').innerText     = currentSeller.full_name;
  document.getElementById('dashSellerCode').innerText     = currentSeller.code;
  document.getElementById('dashSellerCategory').innerText =
    ALL_CATEGORIES[currentSeller.category] || currentSeller.category;

  if (currentSeller.photo) {
    document.getElementById('dashPhoto').src = currentSeller.photo;
  }

  showPage('dashboardPage');
  updateProfileIcon();
}

// ================================================================
// Profil vendeur
// ================================================================
function openProfile() {
  if (!currentSeller) { showPage('loginPage'); return; }

  document.getElementById('profileName').innerText     = currentSeller.full_name;
  document.getElementById('profileCode').innerText     = currentSeller.code;
  document.getElementById('profilePhone').innerText    = currentSeller.phone;
  document.getElementById('profileQuartier').innerText = currentSeller.quartier;
  document.getElementById('profileVille').innerText    = currentSeller.ville;
  document.getElementById('profileCategory').innerText =
    ALL_CATEGORIES[currentSeller.category] || currentSeller.category;

  if (currentSeller.photo) {
    document.getElementById('profilePhoto').src = currentSeller.photo;
  }

  // Init prévisualisation photo profil
  previewImage('profilePhotoFile', 'profilePhotoPreview');
  showPage('profilePage');
}

// Mettre à jour photo profil via upload
async function updatePhoto() {
  const photoFile = document.getElementById('profilePhotoFile')?.files[0];
  const photoUrl  = document.getElementById('photoUrl')?.value.trim();

  let newUrl = '';

  if (photoFile) {
    showToast('Upload en cours...', 'info');
    // Supprimer ancienne photo si elle existe
    if (currentSeller.photo) await deleteOldPhoto(currentSeller.photo);
    newUrl = await uploadPhoto(photoFile, 'sellers');
    if (!newUrl) return;
  } else if (photoUrl) {
    newUrl = photoUrl;
  } else {
    showToast('Choisissez une photo ou entrez une URL', 'error');
    return;
  }

  const { error } = await db.from(TABLES.SELLERS)
    .update({ photo: newUrl }).eq('id', currentSeller.id);

  if (error) {
    showToast('Erreur mise à jour photo', 'error');
    return;
  }

  currentSeller.photo = newUrl;
  updateProfileIcon();
  showToast('Photo mise à jour ✓', 'success');
}

// ================================================================
// Publier un produit — avec upload photo
// ================================================================
function openPublishProduct() {
  previewImage('pubPhotoFile', 'pubPhotoPreview');
  showPage('publishPage');
}

async function publishProduct() {
  if (!currentSeller) return;

  const name        = document.getElementById('pubName').value.trim();
  const price       = document.getElementById('pubPrice').value.trim();
  const description = document.getElementById('pubDescription').value.trim();
  const photoFile   = document.getElementById('pubPhotoFile')?.files[0];
  const photoUrl    = document.getElementById('pubImage')?.value.trim();

  if (!name || !price) {
    showToast('Nom et prix sont obligatoires', 'error');
    return;
  }

  if (isNaN(Number(price)) || Number(price) <= 0) {
    showToast('Prix invalide', 'error');
    return;
  }

  if (!photoFile && !photoUrl) {
    showToast('Ajoutez une photo (fichier ou URL)', 'error');
    return;
  }

  // Upload photo ou utiliser URL
  let image = photoUrl;
  if (photoFile) {
    showToast('Upload photo en cours...', 'info');
    image = await uploadPhoto(photoFile, 'products');
    if (!image) return;
  }

  const { error } = await db.from(TABLES.PRODUCTS).insert({
    seller_id:       currentSeller.id,
    seller_name:     currentSeller.full_name,
    seller_phone:    currentSeller.phone,
    seller_category: currentSeller.category,
    name,
    price:           Number(price),
    description,
    image,
    is_active:       true,
    created_at:      new Date().toISOString()
  });

  if (error) {
    console.error('publishProduct error:', JSON.stringify(error));
    showToast('Erreur lors de la publication', 'error');
    return;
  }

  // Mettre à jour dynamisme
  await db.from(TABLES.SELLERS)
    .update({ last_published: new Date().toISOString() })
    .eq('id', currentSeller.id);

  showToast('Publication ajoutée ✓', 'success');

  ['pubName','pubPrice','pubDescription','pubImage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const preview = document.getElementById('pubPhotoPreview');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
}

// ================================================================
// Mes publications
// ================================================================
async function viewMyProducts() {
  if (!currentSeller) return;

  const { data: products, error } = await db.from(TABLES.PRODUCTS)
    .select('*')
    .eq('seller_id', currentSeller.id)
    .eq('is_active',  true)
    .order('created_at', { ascending: false });

  if (error) console.error('viewMyProducts error:', JSON.stringify(error));

  const list = document.getElementById('myProductsList');

  if (!products || products.length === 0) {
    list.innerHTML =
      '<p style="text-align:center;padding:20px;color:#888;">Aucune publication.</p>';
  } else {
    list.innerHTML = products.map(p => `
      <div class="my-product-card">
        <img src="${p.image}"
          onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'">
        <div class="my-product-info">
          <strong>${p.name}</strong>
          <span>${formatPrice(p.price)} FCFA</span>
          <button class="delete-btn" onclick="deleteProduct('${p.id}', '${p.image}')">
            🗑 Supprimer
          </button>
        </div>
      </div>
    `).join('');
  }

  showPage('myProductsPage');
}

// Supprimer publication
async function deleteProduct(productId, imageUrl = '') {
  showConfirmDialog('Voulez-vous supprimer ce produit ?', async () => {
    const { error } = await db.from(TABLES.PRODUCTS)
      .update({ is_active: false }).eq('id', productId);

    if (error) {
      console.error('deleteProduct error:', JSON.stringify(error));
      showToast('Erreur lors de la suppression', 'error');
      return;
    }

    // Supprimer photo du storage si uploadée
    if (imageUrl && imageUrl.includes('/photos/')) {
      await deleteOldPhoto(imageUrl);
    }

    showToast('Publication supprimée ✓', 'success');
    viewMyProducts();
  });
}

// ================================================================
// Envoyer en promo
// ================================================================
async function openSendToPromo() {
  if (!currentSeller) return;

  const { data: products } = await db.from(TABLES.PRODUCTS)
    .select('*').eq('seller_id', currentSeller.id).eq('is_active', true);

  const list = document.getElementById('promoSelectList');

  if (!products || products.length === 0) {
    list.innerHTML =
      '<p style="text-align:center;padding:20px;color:#888;">Aucune publication à promouvoir.</p>';
  } else {
    list.innerHTML = products.map(p => `
      <div class="promo-select-card">
        <img src="${p.image}"
          onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'">
        <div class="promo-select-info">
          <strong>${p.name}</strong>
          <div class="promo-prices">
            <div class="price-input-group">
              <label>Prix avant :</label>
              <input type="number" id="origPrice_${p.id}" value="${p.price}" min="0">
            </div>
            <div class="price-input-group">
              <label>Prix promo :</label>
              <input type="number" id="promoPrice_${p.id}" placeholder="Nouveau prix" min="0">
            </div>
          </div>
          <button class="promo-transfer-btn"
            onclick="transferToPromo('${p.id}','${p.name.replace(/'/g,"\\'")}','${p.image}')">
            Transférer en promo ➜
          </button>
        </div>
      </div>
    `).join('');
  }

  showPage('sendToPromoPage');
}

// Transférer en promo
async function transferToPromo(productId, name, image) {
  const originalPrice = document.getElementById('origPrice_'  + productId)?.value;
  const promoPrice    = document.getElementById('promoPrice_' + productId)?.value;

  if (!promoPrice || Number(promoPrice) >= Number(originalPrice)) {
    showToast('Le prix promo doit être inférieur au prix original', 'error');
    return;
  }

  const type = Object.keys(CATEGORIES_A).includes(currentSeller.category) ? 'A' : 'B';

  const { error } = await db.from(TABLES.PROMOS).insert({
    seller_id:       currentSeller.id,
    seller_name:     currentSeller.full_name,
    seller_phone:    currentSeller.phone,
    seller_category: currentSeller.category,
    promo_type:      type,
    product_id:      productId,
    name,
    image,
    original_price:  Number(originalPrice),
    promo_price:     Number(promoPrice),
    is_active:       true,
    created_at:      new Date().toISOString()
  });

  if (error) {
    console.error('transferToPromo error:', JSON.stringify(error));
    showToast('Erreur lors du transfert', 'error');
    return;
  }

  showToast('Produit transféré en promotion ✓', 'success');
}

// ================================================================
// Mes promos
// ================================================================
async function viewMyPromos() {
  if (!currentSeller) return;

  const { data: promos, error } = await db.from(TABLES.PROMOS)
    .select('*').eq('seller_id', currentSeller.id).eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) console.error('viewMyPromos error:', JSON.stringify(error));

  const list = document.getElementById('myPromosList');

  if (!promos || promos.length === 0) {
    list.innerHTML =
      '<p style="text-align:center;padding:20px;color:#888;">Aucune promotion.</p>';
  } else {
    list.innerHTML = promos.map(p => `
      <div class="my-product-card">
        <img src="${p.image}"
          onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'">
        <div class="my-product-info">
          <strong>${p.name}</strong>
          <span style="text-decoration:line-through;color:#999;">
            ${formatPrice(p.original_price)} FCFA
          </span>
          <span style="color:#ff4d4f;font-weight:700;">
            ${formatPrice(p.promo_price)} FCFA
          </span>
          <button class="delete-btn" onclick="deletePromo('${p.id}')">
            🗑 Supprimer
          </button>
        </div>
      </div>
    `).join('');
  }

  showPage('myPromosPage');
}

// Supprimer promo
async function deletePromo(promoId) {
  showConfirmDialog('Voulez-vous supprimer cette promotion ?', async () => {
    const { error } = await db.from(TABLES.PROMOS)
      .update({ is_active: false }).eq('id', promoId);

    if (error) {
      console.error('deletePromo error:', JSON.stringify(error));
      showToast('Erreur lors de la suppression', 'error');
      return;
    }

    showToast('Promotion supprimée ✓', 'success');
    viewMyPromos();
  });
}

// ================================================================
// Promos publiques
// ================================================================
async function loadPromos(type) {
  document.getElementById('promosTitle').innerText =
    type === 'A' ? 'Promos Catégorie A' : 'Promos Catégorie B';
  showPage('promosPage');

  const { data: promos, error } = await db.from(TABLES.PROMOS)
    .select('*').eq('promo_type', type).eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) console.error('loadPromos error:', JSON.stringify(error));

  const list = document.getElementById('promosList');

  if (!promos || promos.length === 0) {
    list.innerHTML =
      '<p style="text-align:center;padding:20px;color:#888;">Aucune promotion.</p>';
    return;
  }

  list.innerHTML = promos.map(p => `
    <div class="promo-card">
      <img src="${p.image}"
        onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=600'">
      <div class="promo-content">
        <h3>${p.name}</h3>
        <p class="promo-seller">Vendeur: ${p.seller_name}</p>
        <div class="promo-prices-display">
          <span class="old-price">${formatPrice(p.original_price)} FCFA</span>
          <span class="new-price">${formatPrice(p.promo_price)} FCFA</span>
          <span class="discount">
            -${Math.round((1 - p.promo_price / p.original_price) * 100)}%
          </span>
        </div>
        <a href="https://wa.me/${p.seller_phone}?text=Bonjour, je suis intéressé(e) par: ${encodeURIComponent(p.name)}"
           target="_blank" class="whatsapp-promo-btn">
          Commander via WhatsApp
        </a>
      </div>
    </div>
  `).join('');
}
