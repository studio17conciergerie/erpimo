import React from 'react';
import DecaissementDashboard from '@/features/reddition/components/DecaissementDashboard';
import JournalVentesAgence from '@/features/accounting/components/JournalVentesAgence';
import GrandLivre from '@/features/accounting/components/GrandLivre';
import BalanceComptable from '@/features/accounting/components/BalanceComptable';
import JournauxComptables from '@/features/accounting/components/JournauxComptables';
import OperationsDiversesList from '@/features/accounting/components/OperationsDiversesList';
import { TransfertHonorairesDashboard } from '@/features/accounting/components/TransfertHonorairesDashboard';

interface AccountingProps {
  tab: 'mandant' | 'agence' | 'grand-livre' | 'balance' | 'journaux' | 'od' | 'transfert-honoraires';
}

export default function Accounting({ tab }: AccountingProps) {
  return (
    <div className="space-y-6">
      {tab === 'mandant' && <DecaissementDashboard />}
      {tab === 'agence' && <JournalVentesAgence />}
      {tab === 'grand-livre' && <GrandLivre />}
      {tab === 'balance' && <BalanceComptable />}
      {tab === 'journaux' && <JournauxComptables />}
      {tab === 'od' && <OperationsDiversesList />}
      {tab === 'transfert-honoraires' && <TransfertHonorairesDashboard />}
    </div>
  );
}
