import { supabase } from './supabaseClient';

export const PLAN_COMPTABLE_INITIAL = [
  { numero: '401', libelle: 'Fournisseurs', classe: 4, type_compte: 'CREDIT', is_auxiliaire: true },
  { numero: '404', libelle: 'Propriétaires mandants', classe: 4, type_compte: 'CREDIT', is_auxiliaire: true },
  { numero: '411', libelle: 'Clients / Voyageurs', classe: 4, type_compte: 'DEBIT', is_auxiliaire: true },
  { numero: '419', libelle: 'Cautions locataires reçues', classe: 4, type_compte: 'CREDIT', is_auxiliaire: false },
  { numero: '512000', libelle: 'Banque Séquestre', classe: 5, type_compte: 'DEBIT', is_auxiliaire: false },
  { numero: '512100', libelle: 'Banque Fonctionnement Agence', classe: 5, type_compte: 'DEBIT', is_auxiliaire: false },
  { numero: '615', libelle: 'Entretien et réparations', classe: 6, type_compte: 'DEBIT', is_auxiliaire: false },
  { numero: '616', libelle: 'Assurances', classe: 6, type_compte: 'DEBIT', is_auxiliaire: false },
  { numero: '622', libelle: 'Commissions et courtages (OTA)', classe: 6, type_compte: 'DEBIT', is_auxiliaire: false },
  { numero: '706100', libelle: 'Honoraires de gestion locative', classe: 7, type_compte: 'CREDIT', is_auxiliaire: false },
  { numero: '706200', libelle: 'Commissions sur assurances', classe: 7, type_compte: 'CREDIT', is_auxiliaire: false },
  { numero: '706300', libelle: 'Marges sur interventions', classe: 7, type_compte: 'CREDIT', is_auxiliaire: false },
];

export const CATEGORIES_FOURNISSEURS_INITIAL = [
  { code: 'MENAGE', label: 'Ménage', compte_racine: '401', tva_defaut: 20.00 },
  { code: 'MAINTENANCE', label: 'Maintenance', compte_racine: '401', tva_defaut: 10.00 },
  { code: 'ASSURANCE', label: 'Assurance', compte_racine: '401', tva_defaut: 0.00 },
  { code: 'CONCIERGERIE', label: 'Conciergerie', compte_racine: '401', tva_defaut: 20.00 },
  { code: 'COMPTABLE', label: 'Expert-Comptable', compte_racine: '401', tva_defaut: 20.00 },
  { code: 'AUTRE', label: 'Autre', compte_racine: '401', tva_defaut: 20.00 },
];

export const TIERS_SYSTEME_INITIAL = [
  {
    type_tiers: 'PLATEFORME_OTA',
    sous_type: 'AIRBNB',
    nom: 'Airbnb',
    code_auxiliaire: 'OTA-AIRBNB',
    compte_comptable_racine: '622',
    taux_commission_defaut: 3.00,
    is_systeme: true,
    url_plateforme: 'https://www.airbnb.com'
  },
  {
    type_tiers: 'PLATEFORME_OTA',
    sous_type: 'BOOKING',
    nom: 'Booking.com',
    code_auxiliaire: 'OTA-BOOKING',
    compte_comptable_racine: '622',
    taux_commission_defaut: 15.00,
    is_systeme: true,
    url_plateforme: 'https://www.booking.com'
  },
  {
    type_tiers: 'PLATEFORME_OTA',
    sous_type: 'VRBO',
    nom: 'Abritel / VRBO',
    code_auxiliaire: 'OTA-VRBO',
    compte_comptable_racine: '622',
    taux_commission_defaut: 8.00,
    is_systeme: true,
    url_plateforme: 'https://www.abritel.fr'
  },
  {
    type_tiers: 'PLATEFORME_OTA',
    sous_type: 'DIRECT',
    nom: 'Réservation Directe',
    code_auxiliaire: 'OTA-DIRECT',
    compte_comptable_racine: '411',
    taux_commission_defaut: 0.00,
    is_systeme: true,
    url_plateforme: ''
  },
];

export async function initTiersSysteme() {
  console.log('Starting system tiers initialization...');

  // 1. Seed Plan Comptable
  const { error: errorPlan } = await supabase
    .from('plan_comptable')
    .upsert(PLAN_COMPTABLE_INITIAL, { onConflict: 'numero' });
  
  if (errorPlan) console.error('Error seeding plan comptable:', errorPlan);
  else console.log('Plan comptable seeded.');

  // 2. Seed Categories Fournisseurs
  const { error: errorCats } = await supabase
    .from('categories_fournisseurs')
    .upsert(CATEGORIES_FOURNISSEURS_INITIAL, { onConflict: 'code' });

  if (errorCats) console.error('Error seeding supplier categories:', errorCats);
  else console.log('Supplier categories seeded.');

  // 3. Seed Tiers Systeme (OTAs)
  const { error: errorTiers } = await supabase
    .from('tiers')
    .upsert(TIERS_SYSTEME_INITIAL, { onConflict: 'code_auxiliaire' });

  if (errorTiers) console.error('Error seeding system tiers:', errorTiers);
  else console.log('System tiers seeded.');
  
  // 4. Seed Default OTA Mappings
  // We need to get IDs first
  const { data: tiers } = await supabase.from('tiers').select('id, code_auxiliaire').in('code_auxiliaire', ['OTA-AIRBNB', 'OTA-BOOKING']);
  
  if (tiers) {
    const airbnbId = tiers.find(t => t.code_auxiliaire === 'OTA-AIRBNB')?.id;
    const bookingId = tiers.find(t => t.code_auxiliaire === 'OTA-BOOKING')?.id;
    
    const mappings = [];
    if (airbnbId) {
      mappings.push({ plateforme_tiers_id: airbnbId, label_csv: 'airbnb' });
      mappings.push({ plateforme_tiers_id: airbnbId, label_csv: 'Airbnb' });
      mappings.push({ plateforme_tiers_id: airbnbId, label_csv: 'airbnb2' });
    }
    if (bookingId) {
      mappings.push({ plateforme_tiers_id: bookingId, label_csv: 'booking' });
      mappings.push({ plateforme_tiers_id: bookingId, label_csv: 'Booking.com' });
    }

    if (mappings.length > 0) {
      const { error: errorMapping } = await supabase
        .from('ota_source_mapping')
        .upsert(mappings, { onConflict: 'label_csv' });
        
      if (errorMapping) console.error('Error seeding OTA mappings:', errorMapping);
      else console.log('OTA mappings seeded.');
    }
  }
}

export const seedTiersSysteme = initTiersSysteme;
