import { Calendar, FileEdit, Landmark, RotateCcw, Send } from 'lucide-react';

export interface JournalDefinition {
  code: string;
  nom: string;
  description: string;
  filtre: (ecriture: any) => boolean;
  icone: any;
  couleur: string;
}

export const JOURNAUX: JournalDefinition[] = [
  {
    code: 'JR',
    nom: 'Journal des Réservations',
    description: 'Écritures générées automatiquement par le moteur comptable lors de l\'import CSV',
    filtre: (ecriture) => ecriture.reservation_id !== null,
    icone: Calendar,
    couleur: '#2E86C1'
  },
  {
    code: 'OD',
    nom: 'Journal des Opérations Diverses',
    description: 'Écritures saisies manuellement (maintenance, équipement, régularisations)',
    filtre: (ecriture) => ecriture.operation_diverse_id !== null,
    icone: FileEdit,
    couleur: '#E67E22'
  },
  {
    code: 'BQ',
    nom: 'Journal de Banque',
    description: 'Écritures de rapprochement bancaire et décaissements (comptes 512000)',
    filtre: (ecriture) => ecriture.compte_debit.startsWith('512000') || ecriture.compte_credit.startsWith('512000'),
    icone: Landmark,
    couleur: '#27AE60'
  },
  {
    code: 'AN',
    nom: 'Journal des À-Nouveaux',
    description: 'Écritures de report d\'ouverture d\'exercice',
    filtre: (ecriture) => ecriture.numero_piece?.startsWith('AN-'),
    icone: RotateCcw,
    couleur: '#8E44AD'
  },
  {
    code: 'EX',
    nom: 'Journal des Extérieurs / Redditions',
    description: 'Écritures de décaissement propriétaire (virements de reddition)',
    filtre: (ecriture) => ecriture.numero_piece?.startsWith('RED-'),
    icone: Send,
    couleur: '#C0392B'
  },
  {
    code: 'VT',
    nom: 'Journal des Ventes Agence',
    description: 'Écritures de facturation des honoraires et frais de ménage',
    filtre: (ecriture) => ecriture.numero_piece?.startsWith('FAC-'),
    icone: FileEdit,
    couleur: '#F39C12'
  }
];

export const getJournalByCode = (code: string) => JOURNAUX.find(j => j.code === code);
