import { supabase } from '@/lib/supabaseClient';

export type VoyageurMatch = {
  id: string;
  nom: string;
  isNew: boolean;
};

export const voyageurMatcher = {
  /**
   * Matches guest names from CSV with existing travelers or creates new ones.
   * Returns a map of guest names to traveler IDs.
   */
  async matchOrCreateVoyageurs(guestNames: string[], createIfMissing: boolean = true): Promise<Map<string, VoyageurMatch>> {
    const uniqueNames = [...new Set(guestNames.map(n => n.trim()).filter(Boolean))];
    if (uniqueNames.length === 0) return new Map();

    // 1. Fetch existing travelers
    // To handle case-insensitivity properly in a batch, we fetch all VOYAGEUR tiers.
    // In a real-world large-scale app, we'd use a postgres function or a search index.
    const { data: existing, error } = await supabase
      .from('tiers')
      .select('id, nom')
      .eq('type_tiers', 'VOYAGEUR');

    if (error) throw error;

    const resultMap = new Map<string, VoyageurMatch>();
    const existingMap = new Map<string, string>(); // name.toLowerCase().trim() -> id
    
    existing?.forEach(t => {
      existingMap.set(t.nom.toLowerCase().trim(), t.id);
    });

    const toCreate: string[] = [];

    uniqueNames.forEach(name => {
      const normalized = name.toLowerCase().trim();
      const existingId = existingMap.get(normalized);
      
      if (existingId) {
        resultMap.set(name, { id: existingId, nom: name, isNew: false });
      } else {
        toCreate.push(name);
      }
    });

    // 2. Create new travelers in batch if requested
    if (createIfMissing && toCreate.length > 0) {
      const newTiers = toCreate.map(name => ({
        nom: name,
        type_tiers: 'VOYAGEUR'
      }));

      const { data: created, error: createError } = await supabase
        .from('tiers')
        .insert(newTiers)
        .select('id, nom');

      if (createError) throw createError;

      created?.forEach(t => {
        // Find the original name from toCreate to maintain mapping
        const originalName = toCreate.find(n => n.toLowerCase().trim() === t.nom.toLowerCase().trim()) || t.nom;
        resultMap.set(originalName, { id: t.id, nom: originalName, isNew: true });
      });
    } else {
      // For preview mode, mark those not found as new (but don't create)
      toCreate.forEach(name => {
        resultMap.set(name, { id: '', nom: name, isNew: true });
      });
    }

    return resultMap;
  }
};
