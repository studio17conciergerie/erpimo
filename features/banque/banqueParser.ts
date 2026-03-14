import { BankMovement } from './banqueService';

/**
 * Generates a unique hash for a bank movement to prevent duplicates.
 * Hash is based on date, label, and amount.
 */
export function generateHash(date: string, libelle: string, montant: number): string {
  // Normalize string for consistent hashing
  const normalizedLibelle = libelle.trim().toLowerCase();
  const normalizedAmount = Number(montant).toFixed(2);
  const str = `${date}|${normalizedLibelle}|${normalizedAmount}`;
  
  // Simple hash function (Fowler-Noll-Vo or similar)
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(36);
}

/**
 * Cleans a row from a CSV and converts it to a BankMovement object.
 * Handles French number formats (comma, spaces) and various date formats.
 */
export function nettoyerLigneBancaire(
  row: any, 
  mapping: { date: string, libelle: string, montant: string }
): BankMovement | null {
  const rawDate = row[mapping.date];
  const rawLibelle = row[mapping.libelle];
  const rawMontant = row[mapping.montant];

  if (!rawDate || !rawLibelle || !rawMontant) return null;

  // 1. Dates: Convert JJ/MM/AAAA or AAAA-MM-JJ to ISO (YYYY-MM-DD)
  let date_operation = '';
  const dateStr = String(rawDate).trim();
  
  // Try DD/MM/YYYY
  const dmYMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmYMatch) {
    date_operation = `${dmYMatch[3]}-${dmYMatch[2].padStart(2, '0')}-${dmYMatch[1].padStart(2, '0')}`;
  } else {
    // Try YYYY-MM-DD
    const YmdMatch = dateStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (YmdMatch) {
      date_operation = `${YmdMatch[1]}-${YmdMatch[2].padStart(2, '0')}-${YmdMatch[3].padStart(2, '0')}`;
    }
  }

  // 2. Montants: Convert "1 250,50" or "- 45,00" to float
  let montant = 0;
  if (typeof rawMontant === 'string') {
    // Remove spaces, replace comma with dot, remove currency symbols
    const cleanMontant = rawMontant
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[€$£]/g, '');
    montant = parseFloat(cleanMontant);
  } else {
    montant = Number(rawMontant);
  }

  if (isNaN(montant) || !date_operation) return null;

  const libelle_banque = String(rawLibelle).trim();
  const hash_unique = generateHash(date_operation, libelle_banque, montant);

  return {
    date_operation,
    libelle_banque,
    montant,
    est_rapproche: false,
    hash_unique
  };
}
