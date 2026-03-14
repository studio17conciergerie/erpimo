import { supabase } from '@/lib/supabaseClient';
import { accountingEngine } from '@/features/accounting/accountingEngine';
import { resolvePayeurBatch } from '@/features/accounting/payeurResolver';

export type Reservation = {
  id: string;
  logement_id: string | null;
  listing_id: string;
  source: string;
  confirmation_code: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  nb_nuits: number;
  payout_net: number;
  commission_ota: number;
  frais_traitement_ota: number;
  montant_brut: number;
  montant_menage: number;
  montant_assurance: number;
  montant_commission_agence: number;
  loyer_net_proprietaire: number;
  voyageur_id: string | null;
  statut_workflow: 'BROUILLON' | 'ATTENTE_PAIEMENT' | 'ENCAISSE' | 'REDDITION';
  nickname: string | null;
  created_at: string;
  logement?: { 
    id: string;
    nom: string;
    proprietaire?: { id: string; nom: string }
  };
};

export const reservationsService = {
  async getReservations(filters?: { logementId?: string; startDate?: string; endDate?: string }) {
    let query = supabase
      .from('reservations')
      .select('*, logement:logements(id, nom, proprietaire:proprietaire_id(id, nom))')
      .order('check_in', { ascending: false });

    if (filters?.logementId) {
      query = query.eq('logement_id', filters.logementId);
    }

    if (filters?.startDate) {
      query = query.gte('check_in', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('check_in', filters.endDate);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data as Reservation[];
  },

  async getReservationById(id: string) {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, logement:logements(id, nom, proprietaire:proprietaire_id(id, nom))')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Reservation;
  },

  async getReservationLedger(reservationId: string) {
    const { data, error } = await supabase
      .from('journal_ecritures')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('date_ecriture', { ascending: true });
      
    if (error) throw error;
    return data;
  },

  async updateReservation(id: string, updates: Partial<Reservation>) {
    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    return data as Reservation;
  },

  async getProperties() {
    const { data, error } = await supabase
      .from('logements')
      .select('id, nom')
      .order('nom');
      
    if (error) throw error;
    return data;
  },

  async generateAccountingForReservations(reservationIds: string[]) {
    // 1. Fetch reservations
    const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .in('id', reservationIds)
        .eq('statut_workflow', 'BROUILLON'); // Only process drafts

    if (resError || !reservations || reservations.length === 0) {
      throw new Error("Aucune réservation 'BROUILLON' trouvée dans la sélection.");
    }

    // 1.5 Filter by check_in date (only process if check_in <= today)
    const today = new Date().toISOString().split('T')[0];
    const comptabilisables = reservations.filter(r => {
      if (r.check_in > today) {
        console.warn(`Réservation ${r.confirmation_code} ignorée : check-in futur (${r.check_in})`);
        return false;
      }
      return true;
    });

    if (comptabilisables.length === 0) {
      throw new Error("Aucune des réservations sélectionnées n'est comptabilisable (check-in futur).");
    }

    // 2. Fetch Context (Logements, Rules, Tiers)
    const logementIds = [...new Set(comptabilisables.map(r => r.logement_id).filter(Boolean))];
    const { data: contextData, error: contextError } = await supabase
      .from('logements')
      .select(`
        id, 
        nom, 
        owner:proprietaire_id (id, nom, code_auxiliaire),
        rules:regles_financieres_logement (
          *,
          fournisseur:fournisseur_menage_id (id, nom, code_auxiliaire)
        )
      `)
      .in('id', logementIds);

    if (contextError) throw contextError;
    const contextMap = new Map(contextData?.map(c => [c.id, c]));

    // 2.5 Resolve Payeurs in batch
    const payeurMap = await resolvePayeurBatch(comptabilisables.map(r => ({ 
      source: r.source, 
      voyageur_id: r.voyageur_id 
    })));

    // 3. Process
    let successCount = 0;
    for (const res of comptabilisables) {
        const context = contextMap.get(res.logement_id) as any;
        if (!context) continue;

        const payeurKey = `${res.source}_${res.voyageur_id || 'null'}`;
        const payeur = payeurMap.get(payeurKey);
        
        if (!payeur) {
            console.error(`Impossible de résoudre le payeur pour la réservation ${res.confirmation_code}`);
            continue;
        }

        // Handle rules being an array or single object
        const rawRules = context.rules;
        const rules = Array.isArray(rawRules) ? rawRules[0] : rawRules;
        
        const owner = context.owner;
        // The supplier is now nested within the rules
        const supplierMenage = rules?.fournisseur;

        const { entries, ventilation } = await accountingEngine.genererEcrituresComptables(
            res, context, rules, owner, supplierMenage, payeur
        );

        if (entries.length > 0) {
            try {
                await accountingEngine.createPieceAndEntries(
                    'JR',
                    new Date(res.check_in).toISOString().split('T')[0],
                    `Réservation ${res.confirmation_code} - ${res.guest_name}`,
                    'RESERVATION',
                    res.id,
                    entries
                );
                
                await supabase.from('reservations').update({
                    montant_menage: ventilation.forfaitMenage,
                    montant_assurance: ventilation.forfaitAssurance,
                    montant_commission_agence: ventilation.montantCommission,
                    loyer_net_proprietaire: ventilation.loyerNetProprietaire,
                    payeur_tiers_id: payeur.tiers_id,
                    statut_workflow: 'ATTENTE_PAIEMENT'
                }).eq('id', res.id);
                
                successCount++;
            } catch (err) {
                console.error(`Erreur lors de la création de la pièce pour ${res.confirmation_code}:`, err);
            }
        }
    }
    return successCount;
  }
};
