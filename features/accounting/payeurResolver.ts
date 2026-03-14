import { supabase } from '@/lib/supabaseClient';

export type PayeurResolution = {
  tiers_id: string;
  code_auxiliaire: string;
  type: 'OTA' | 'VOYAGEUR';
  nom: string;
};

/**
 * Résout le payeur (OTA ou Voyageur) pour une réservation donnée.
 * Suit la logique de traçabilité Loi Hoguet pour Primo-ERP.
 */
export async function resolvePayeur(source: string, voyageurId: string | null): Promise<PayeurResolution> {
  // 1. Recherche dans le mapping OTA
  const { data: mapping, error: mappingError } = await supabase
    .from('ota_source_mapping')
    .select(`
      plateforme_tiers_id,
      tiers:plateforme_tiers_id (
        id,
        nom,
        code_auxiliaire,
        sous_type
      )
    `)
    .eq('label_csv', source)
    .maybeSingle();

  if (mappingError) {
    console.error('Erreur lors de la résolution du payeur (mapping):', mappingError);
  }

  // Si trouvé et c'est une vraie plateforme (pas DIRECT)
  if (mapping && mapping.tiers && (mapping.tiers as any).sous_type !== 'DIRECT') {
    const ota = mapping.tiers as any;
    return {
      tiers_id: ota.id,
      code_auxiliaire: ota.code_auxiliaire,
      type: 'OTA',
      nom: ota.nom,
    };
  }

  // 2. Fallback Voyageur (si non trouvé ou si DIRECT)
  if (!mapping) {
    console.warn(`Source non mappée : "${source}". Fallback sur le voyageur.`);
  }

  if (!voyageurId) {
    throw new Error(`Impossible de résoudre le payeur : la source "${source}" nécessite un voyageur mais aucun n'est renseigné.`);
  }

  const { data: voyageur, error: voyageurError } = await supabase
    .from('tiers')
    .select('id, nom, code_auxiliaire')
    .eq('id', voyageurId)
    .single();

  if (voyageurError || !voyageur) {
    throw new Error(`Erreur lors de la récupération du voyageur (${voyageurId}) : ${voyageurError?.message || 'non trouvé'}`);
  }

  if (!voyageur.code_auxiliaire) {
    throw new Error(`Le voyageur "${voyageur.nom}" (ID: ${voyageurId}) n'a pas de code auxiliaire comptable. Action requise.`);
  }

  return {
    tiers_id: voyageur.id,
    code_auxiliaire: voyageur.code_auxiliaire,
    type: 'VOYAGEUR',
    nom: voyageur.nom,
  };
}

/**
 * Résout en masse les payeurs pour une liste de réservations.
 * Optimise les performances en groupant les requêtes.
 */
export async function resolvePayeurBatch(
  reservations: Array<{ source: string; voyageur_id: string | null }>
): Promise<Map<string, PayeurResolution>> {
  const resultMap = new Map<string, PayeurResolution>();
  const uniqueSources = Array.from(new Set(reservations.map(r => r.source)));

  // 1. Une seule requête pour tous les mappings OTA concernés
  const { data: mappings, error: mappingError } = await supabase
    .from('ota_source_mapping')
    .select(`
      label_csv,
      plateforme_tiers_id,
      tiers:plateforme_tiers_id (
        id,
        nom,
        code_auxiliaire,
        sous_type
      )
    `)
    .in('label_csv', uniqueSources);

  if (mappingError) {
    console.error('Erreur resolvePayeurBatch (mapping):', mappingError);
  }

  const mappingLookup = new Map<string, any>();
  mappings?.forEach(m => mappingLookup.set(m.label_csv, m.tiers));

  // Identifier les réservations qui ont besoin d'un lookup voyageur
  const voyageurIdsToFetch = new Set<string>();
  const resNeedingVoyageur: Array<{ index: number; voyageur_id: string; source: string }> = [];

  reservations.forEach((res, index) => {
    const otaTiers = mappingLookup.get(res.source);
    
    if (otaTiers && otaTiers.sous_type !== 'DIRECT') {
      resultMap.set(`${res.source}_${res.voyageur_id || 'null'}`, {
        tiers_id: otaTiers.id,
        code_auxiliaire: otaTiers.code_auxiliaire,
        type: 'OTA',
        nom: otaTiers.nom,
      });
    } else {
      if (res.voyageur_id) {
        voyageurIdsToFetch.add(res.voyageur_id);
        resNeedingVoyageur.push({ index, voyageur_id: res.voyageur_id, source: res.source });
      } else {
        // On ne peut pas encore remplir resultMap ici car on va throw plus tard ou gérer l'erreur
      }
    }
  });

  // 2. Une seule requête pour tous les voyageurs nécessaires
  if (voyageurIdsToFetch.size > 0) {
    const { data: voyageurs, error: voyageurError } = await supabase
      .from('tiers')
      .select('id, nom, code_auxiliaire')
      .in('id', Array.from(voyageurIdsToFetch));

    if (voyageurError) {
      console.error('Erreur resolvePayeurBatch (voyageurs):', voyageurError);
    }

    const voyageurLookup = new Map<string, any>();
    voyageurs?.forEach(v => voyageurLookup.set(v.id, v));

    resNeedingVoyageur.forEach(item => {
      const v = voyageurLookup.get(item.voyageur_id);
      if (!v) return; // Sera géré par l'absence dans le map final si besoin

      if (!v.code_auxiliaire) {
        console.error(`Le voyageur "${v.nom}" n'a pas de code auxiliaire.`);
        return;
      }

      resultMap.set(`${item.source}_${item.voyageur_id}`, {
        tiers_id: v.id,
        code_auxiliaire: v.code_auxiliaire,
        type: 'VOYAGEUR',
        nom: v.nom,
      });
    });
  }

  return resultMap;
}
