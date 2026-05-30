// ================================================================
// CONFIGURATION SUPABASE — MARCHÉ MOBORO
// Projet : https://frvzrorqndozglxczatv.supabase.co
// ================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://frvzrorqndozglxczatv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydnpyb3JxbmRvemdseGN6YXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTc0NTEsImV4cCI6MjA5NTQ3MzQ1MX0.g3ETfxBw_i0keZYDrnGYudnbs4m23AJ_dFoxXV0ZJEE';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================================================================
// NUMÉRO WHATSAPP ADMIN
// ================================================================

const ADMIN_PHONE = '242050672009';

// ================================================================
// TABLES
// ================================================================

const TABLES = {
  SELLERS:        'sellers',
  PRODUCTS:       'products',
  ORDERS:         'orders',
  PROMOS:         'promos',
  VISITORS:       'visitors',
  BLOCKED_PHONES: 'blocked_phones',
  ADMIN_LOGS:     'admin_logs'
};

// ================================================================
// CATÉGORIES A (Importateurs & Grossistes)
// ================================================================

const CATEGORIES_A = {
  'ig':          'Meilleur Importateurs & Grossistes',
  'immo':        'Immobilier',
  'coiffure':    'Grand Salon de Coiffure',
  'hotel':       'Hôtel, Jardin & Lieu Touristique',
  'deco-mariage':'Décoration Mariage & Autres',
  'menage':      'Service de Ménage',
  'oeufs':       'Grossiste Œufs'
};

// ================================================================
// CATÉGORIES B (Vendeurs individuels)
// ================================================================

const CATEGORIES_B = {
  'c1':  'Chaussures & Basket',
  'c2':  'Accessoires Téléphone',
  'c3':  'Beauté & Cosmétiques',
  'c4':  'Vêtements Femme',
  'c5':  'Chaussures Femme',
  'c6':  'Sacs & Accessoires Mode',
  'c7':  'Maison & Décoration',
  'c8':  'Savon Artisanal & Naturel',
  'c9':  'Parfums & Soins Luxe',
  'c10': 'Bébé & Enfants',
  'c11': 'Perruques & Mèches',
  'c12': 'Lingerie, Nuit, Rideau & Tenue',
  'c13': 'Santé & Bien-être Femme',
  'c14': 'Friperie Premium',
  'c15': 'Tissus & Pagnes',
  'c16': "Occasion d'Europe",
  'c17': 'Pâtisserie',
  'c18': 'Veste & Chaussures de Luxe',
  'c19': 'Plastique',
  'c20': 'Électronique'
};

// Toutes les catégories
const ALL_CATEGORIES = { ...CATEGORIES_A, ...CATEGORIES_B };

// ================================================================
// UTILITAIRES
// ================================================================

// Générer code vendeur unique
function generateSellerCode(count) {
  const number = String(count + 1).padStart(4, '0');
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];
  return 'MBR' + number + randomLetter;
}

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.className = 'toast', 3000);
}

// Hasher PIN
function hashPin(pin) {
  return btoa(pin + '_mbr_salt_2024');
}

// Formater prix
function formatPrice(price) {
  if (!price || isNaN(Number(price))) return '0';
  return Number(price).toLocaleString('fr-FR');
}

// Enregistrer visite
async function recordVisit() {
  try {
    const today = new Date().toISOString().split('T')[0];
    await db.from(TABLES.VISITORS).insert({ date: today, type: 'visit' });
  } catch (e) {
    console.error('recordVisit error:', e);
  }
}

// Logger action admin
async function logAdminAction(action, targetTable, targetId = null, details = '', oldValue = null, newValue = null) {
  try {
    await db.from(TABLES.ADMIN_LOGS).insert({
      action,
      target_table: targetTable,
      target_id:    targetId,
      details,
      old_value:    oldValue  ? oldValue  : null,
      new_value:    newValue  ? newValue  : null,
      created_at:   new Date().toISOString()
    });
  } catch (e) {
    console.error('logAdminAction error:', e);
  }
}