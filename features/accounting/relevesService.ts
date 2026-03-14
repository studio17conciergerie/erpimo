import { supabase } from '@/lib/supabaseClient';

export type OwnerSummary = {
  id: string;
  nom: string;
  code_auxiliaire: string;
  nb_reservations: number;
  total_loyer_net: number;
  reservation_ids: string[];
};

export type ReleveGestion = {
  id: string;
  proprietaire_id: string;
  periode: string;
  date_generation: string;
  montant_total: number;
  nb_reservations: number;
  fichier_url?: string;
};

export const relevesService = {
  async getOwnersWithEncaisseReservations(): Promise<OwnerSummary[]> {
    // Fetch reservations with ENCAISSE status and their associated property/owner
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        loyer_net_proprietaire,
        logements (
          proprietaire_id,
          tiers:proprietaire_id (
            id,
            nom,
            code_auxiliaire
          )
        )
      `)
      .eq('statut_workflow', 'ENCAISSE');

    if (error) throw error;

    // Group by owner
    const ownersMap = new Map<string, OwnerSummary>();

    data?.forEach((res: any) => {
      const owner = res.logements?.tiers;
      if (!owner) return;

      if (!ownersMap.has(owner.id)) {
        ownersMap.set(owner.id, {
          id: owner.id,
          nom: owner.nom,
          code_auxiliaire: owner.code_auxiliaire,
          nb_reservations: 0,
          total_loyer_net: 0,
          reservation_ids: []
        });
      }

      const summary = ownersMap.get(owner.id)!;
      summary.nb_reservations += 1;
      summary.total_loyer_net += Number(res.loyer_net_proprietaire || 0);
      summary.reservation_ids.push(res.id);
    });

    return Array.from(ownersMap.values());
  },

  async validerDecaissementProprietaire(
    proprietaireId: string,
    reservationsIds: string[],
    montantTotal: number,
    codeAuxiliaire: string
  ): Promise<string> {
    const periode = new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    const dateEcriture = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase.rpc('validate_disbursement', {
      p_proprietaire_id: proprietaireId,
      p_reservation_ids: reservationsIds,
      p_montant_total: montantTotal,
      p_periode: periode,
      p_date_ecriture: dateEcriture,
      p_code_auxiliaire_proprio: codeAuxiliaire
    });

    if (error) throw error;
    return data; // Returns the releve_id
  },

  async getRelevesHistorique(): Promise<ReleveGestion[]> {
    const { data, error } = await supabase
      .from('releves_gestion')
      .select(`
        *,
        tiers:proprietaire_id (nom)
      `)
      .order('date_generation', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getReleveDataForPdf(releveId: string): Promise<any> {
    // Fetch releve info
    const { data: releve, error: releveError } = await supabase
      .from('releves_gestion')
      .select(`
        *,
        proprietaire:proprietaire_id (*)
      `)
      .eq('id', releveId)
      .single();

    if (releveError) throw releveError;

    // Fetch reservations associated with this releve
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select(`
        *,
        logements (
          nom
        )
      `)
      .eq('releve_gestion_id', releveId);

    if (resError) throw resError;

    // Format for CRGPdfTemplate
    return {
      agence: {
        nom: "PRIMO CONCIERGERIE",
        adresse: "123 Avenue des Champs-Élysées, 75008 Paris",
        siret: "888 777 666 00011",
      },
      proprietaire: {
        nom: `${releve.proprietaire.nom} ${releve.proprietaire.prenom || ''}`,
        adresse: `${releve.proprietaire.adresse || ''}, ${releve.proprietaire.ville || ''}`,
        ibanMasque: releve.proprietaire.iban ? `**** **** **** ${releve.proprietaire.iban.slice(-4)}` : 'Non renseigné',
      },
      periode: releve.periode,
      synthese: {
        loyerBrut: reservations.reduce((sum, r) => sum + Number(r.montant_brut || 0), 0),
        commissionsOta: reservations.reduce((sum, r) => sum + Number(r.commission_ota || 0) + Number(r.frais_traitement_ota || 0), 0),
        fraisMenage: reservations.reduce((sum, r) => sum + Number(r.montant_menage || 0), 0),
        honorairesAgence: reservations.reduce((sum, r) => sum + Number(r.montant_commission_agence || 0), 0),
        loyerNet: Number(releve.montant_total),
      },
      reservations: reservations.map(r => ({
        dates: `${new Date(r.check_in).toLocaleDateString('fr-FR')} - ${new Date(r.check_out).toLocaleDateString('fr-FR')}`,
        voyageur: r.guest_name || 'Client',
        nomLogement: r.logements?.nom || 'Logement',
        brut: Number(r.montant_brut || 0),
        ota: Number(r.commission_ota || 0) + Number(r.frais_traitement_ota || 0),
        menage: Number(r.montant_menage || 0),
        honoraires: Number(r.montant_commission_agence || 0),
        net: Number(r.loyer_net_proprietaire || 0),
      }))
    };
  }
};
