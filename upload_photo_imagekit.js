// ================================================================
// upload_photo.js — Marché Moboro
// Service : ImageKit.io
// Compression JS intégrée (Canvas) → max 100ko
// ================================================================

const IMAGEKIT_URL      = 'https://ik.imagekit.io/smkdohkm8';
const IMAGEKIT_PUBLIC_KEY = 'public_pJNeKaHWN8mcFS49bpw1Rn3mysI=';
const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

// ================================================================
// Compression image (Canvas) — max 100ko
// ================================================================
async function compressImage(file, maxKB = 100) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;

        // Redimensionner si largeur > 800px
        if (w > 800) { h = Math.round(h * 800 / w); w = 800; }

        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

        // Compression itérative jusqu'à maxKB
        let quality = 0.8;
        let result;
        do {
          result  = canvas.toDataURL('image/jpeg', quality);
          quality -= 0.05;
        } while (result.length > maxKB * 1024 * 1.37 && quality > 0.1);

        // Convertir dataURL en File
        const arr   = result.split(',');
        const bstr  = atob(arr[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }

        const compressed = new File([u8arr], file.name, { type: 'image/jpeg' });
        console.log(`Compression: ${(file.size/1024).toFixed(0)}ko → ${(compressed.size/1024).toFixed(0)}ko`);
        resolve(compressed);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ================================================================
// Obtenir token d'authentification ImageKit
// Utilise le endpoint public (sans signature serveur)
// ================================================================
async function getImageKitAuth() {
  // Pour upload non signé on utilise juste la clé publique
  return {
    token:     '',
    expire:    0,
    signature: ''
  };
}

// ================================================================
// Upload vers ImageKit.io
// ================================================================
async function uploadPhoto(file, folder = 'sellers') {
  if (!file) return null;

  // Vérifications type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('Format non supporté. JPG, PNG ou WEBP uniquement.', 'error');
    return null;
  }

  // Vérification taille avant compression
  if (file.size > 10 * 1024 * 1024) {
    showToast('Image trop lourde (max 10 MB)', 'error');
    return null;
  }

  try {
    showToast('Compression en cours...', 'info');

    // Compression selon le type de dossier
    const maxKB = folder === 'sellers' ? 80 : 100;
    const compressed = await compressImage(file, maxKB);

    showToast('Upload en cours...', 'info');

    // Préparer FormData pour ImageKit
    const fileName = folder + '_' + Date.now() + '_' +
                     Math.random().toString(36).slice(2) + '.jpg';

    const formData = new FormData();
    formData.append('file',      compressed);
    formData.append('fileName',  fileName);
    formData.append('folder',    '/moboro/' + folder);
    formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);

    const res = await fetch(IMAGEKIT_UPLOAD_URL, {
      method: 'POST',
      body:   formData
    });

    const data = await res.json();

    if (data.message && !data.url) {
      console.error('ImageKit upload error:', data.message);
      showToast('Erreur upload: ' + data.message, 'error');
      return null;
    }

    // URL optimisée avec transformations ImageKit
    const optimizedUrl = getOptimizedUrl(data.url, folder);
    return optimizedUrl;

  } catch (e) {
    console.error('uploadPhoto exception:', e);
    showToast('Erreur réseau lors de l\'upload', 'error');
    return null;
  }
}

// ================================================================
// URL optimisée selon le type
// ================================================================
function getOptimizedUrl(url, folder) {
  if (!url) return url;

  const transforms = {
    sellers:  'tr:w-400,h-400,c-maintain_ratio,q-80,f-auto',
    products: 'tr:w-800,h-800,c-maintain_ratio,q-80,f-auto',
    promos:   'tr:w-800,h-600,c-maintain_ratio,q-80,f-auto'
  };

  const transform = transforms[folder] || transforms.products;

  // Insérer la transformation dans l'URL ImageKit
  return url.replace(
    'https://ik.imagekit.io/smkdohkm8/',
    `https://ik.imagekit.io/smkdohkm8/${transform}/`
  );
}

// ================================================================
// Prévisualiser une image avant upload
// ================================================================
function previewImage(inputId, previewId) {
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src           = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });
}

// ================================================================
// Supprimer une photo ImageKit
// (nécessite backend — ignoré en frontend pur)
// ================================================================
async function deleteOldPhoto(photoUrl) {
  // La suppression ImageKit nécessite la clé privée (côté serveur)
  // En frontend on ne supprime pas — ImageKit nettoie automatiquement
  console.log('deleteOldPhoto: suppression ignorée (frontend only)');
}
// ================================================================
// Nettoyage images orphelines ImageKit
// À appeler depuis admin.html
// ================================================================
async function cleanOrphanImages() {
  try {
    // Récupérer toutes les URLs d'images utilisées
    const { data: products } = await db.from('products')
      .select('images').eq('is_active', true);
    const { data: promos } = await db.from('promos')
      .select('image').eq('is_active', true);
    const { data: sellers } = await db.from('sellers')
      .select('photo').eq('is_active', true);

    // Construire liste des URLs actives
    const activeUrls = new Set();

    products?.forEach(p => {
      if (Array.isArray(p.images)) {
        p.images.forEach(url => url && activeUrls.add(url));
      }
    });
    promos?.forEach(p => p.image && activeUrls.add(p.image));
    sellers?.forEach(s => s.photo && activeUrls.add(s.photo));

    console.log('Images actives:', activeUrls.size);
    // Note: suppression ImageKit nécessite clé privée côté serveur
    // Les URLs orphelines dans Supabase sont nettoyées par le cron SQL

    return activeUrls.size;
  } catch(e) {
    console.error('cleanOrphanImages error:', e);
  }
}