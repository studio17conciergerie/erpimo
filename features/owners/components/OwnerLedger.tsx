import React, { useEffect, useState } from 'react';
import { LedgerEntry, ownerService } from '../ownerService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface OwnerLedgerProps {
  ownerId: string;
  codeAuxiliaire: string | null;
}

function OwnerLedgerContent({ ownerId, codeAuxiliaire }: OwnerLedgerProps) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ownerId && codeAuxiliaire) {
      fetchLedger();
    } else {
      setLoading(false);
    }
  }, [ownerId, codeAuxiliaire]);

  const fetchLedger = async () => {
    try {
      const data = await ownerService.getOwnerLedger(ownerId, codeAuxiliaire!);
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : 'Date invalide';
  };

  // Calculate progressive balance
  let runningBalance = 0;
  const entriesWithBalance = entries.map(entry => {
    const isCredit = entry.compte_credit === codeAuxiliaire;
    const isDebit = entry.compte_debit === codeAuxiliaire;
    
    // Ensure montant is a number
    const montant = typeof entry.montant === 'string' ? parseFloat(entry.montant) : (entry.montant || 0);
    
    if (isCredit) {
      runningBalance += montant;
    } else if (isDebit) {
      runningBalance -= montant;
    }
    
    return { ...entry, montant, balance: runningBalance, isCredit, isDebit };
  });

  if (!codeAuxiliaire) {
    return <div className="p-8 text-center text-slate-500">Code auxiliaire manquant pour ce propriétaire.</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span>Grand Livre - {codeAuxiliaire}</span>
            <Link 
              to={`/accounting/grand-livre?compte=${codeAuxiliaire}&title=${encodeURIComponent(codeAuxiliaire)}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Voir dans le Grand Livre Général
            </Link>
          </div>
          <span className="text-sm font-normal text-slate-500">Solde actuel: <span className="font-bold text-slate-900">{formatCurrency(runningBalance)}</span></span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Libellé</th>
                <th className="px-4 py-3">Pièce</th>
                <th className="px-4 py-3 text-right">Débit</th>
                <th className="px-4 py-3 text-right">Crédit</th>
                <th className="px-4 py-3 text-right">Solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Chargement...</td>
                </tr>
              ) : entriesWithBalance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Aucune écriture comptable trouvée.</td>
                </tr>
              ) : (
                entriesWithBalance.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {formatDate(entry.date_ecriture)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{entry.libelle}</div>
                      {entry.lettrage && (
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          Lettrage: {entry.lettrage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {entry.numero_piece || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {entry.isDebit ? formatCurrency(entry.montant) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {entry.isCredit ? formatCurrency(entry.montant) : '-'}
                    </td>
                    <td className={cn(
                      "px-4 py-3 text-right font-medium",
                      entry.balance >= 0 ? "text-emerald-700" : "text-red-700"
                    )}>
                      {formatCurrency(entry.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function OwnerLedger(props: OwnerLedgerProps) {
  return (
    <ErrorBoundary>
      <OwnerLedgerContent {...props} />
    </ErrorBoundary>
  );
}
