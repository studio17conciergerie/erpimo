import React, { useState, useEffect } from 'react';
import { facturationFournisseurApi } from '@/services/facturationFournisseurApi';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Loader2, ChevronDown, ChevronUp, Trash2, FileText, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Facture {
  id: string;
  fournisseur_id: string;
  reference: string;
  date_creation: string;
  montant_total: number;
  statut: 'A_PAYER' | 'PAYEE';
  fournisseur: {
    id: string;
    nom: string;
  };
}

interface Ecriture {
  id: string;
  date_ecriture: string;
  libelle: string;
  montant: number;
  compte_credit: string;
  lettrage: string | null;
}

export const ListeFacturesFournisseurs: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [expandedFacture, setExpandedFacture] = useState<string | null>(null);
  const [details, setDetails] = useState<{ [factureId: string]: Ecriture[] }>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  const fetchFactures = async () => {
    setLoading(true);
    try {
      const data = await facturationFournisseurApi.getFacturesFournisseurs();
      setFactures(data as any);
    } catch (error) {
      console.error('Erreur lors du chargement des factures:', error);
      toast.error('Impossible de charger l\'historique des factures.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFactures();
  }, []);

  const toggleExpand = async (factureId: string) => {
    if (expandedFacture === factureId) {
      setExpandedFacture(null);
      return;
    }

    setExpandedFacture(factureId);
    
    if (!details[factureId]) {
      setLoadingDetails(factureId);
      try {
        const data = await facturationFournisseurApi.getFactureDetails(factureId);
        setDetails(prev => ({ ...prev, [factureId]: data as any }));
      } catch (error) {
        console.error('Erreur lors du chargement des détails:', error);
        toast.error('Impossible de charger les détails de la facture.');
      } finally {
        setLoadingDetails(null);
      }
    }
  };

  const handleRetirerEcriture = async (ecriture: Ecriture, factureId: string) => {
    try {
      await facturationFournisseurApi.retirerEcritureDeFacture(ecriture.id, factureId, ecriture.montant);
      toast.success('Écriture retirée du lot avec succès.');
      
      // Mettre à jour localement les détails
      setDetails(prev => ({
        ...prev,
        [factureId]: prev[factureId].filter(e => e.id !== ecriture.id)
      }));
      
      // Mettre à jour localement le montant de la facture
      setFactures(prev => prev.map(f => 
        f.id === factureId 
          ? { ...f, montant_total: f.montant_total - ecriture.montant } 
          : f
      ));
    } catch (error) {
      console.error('Erreur lors du retrait de l\'écriture:', error);
      toast.error('Erreur lors du retrait de l\'écriture.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Historique des Factures Fournisseurs</h2>
        <Button variant="outline" onClick={fetchFactures}>Rafraîchir</Button>
      </div>

      <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3 text-right">Montant Total</th>
              <th className="px-4 py-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {factures.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Aucune facture trouvée.
                </td>
              </tr>
            ) : (
              factures.map(facture => (
                <React.Fragment key={facture.id}>
                  <tr 
                    className={cn(
                      "hover:bg-muted/30 transition-colors cursor-pointer",
                      expandedFacture === facture.id && "bg-muted/20"
                    )}
                    onClick={() => toggleExpand(facture.id)}
                  >
                    <td className="px-4 py-3 text-center">
                      {expandedFacture === facture.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{facture.fournisseur.nom}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(facture.date_creation), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{facture.reference}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {Number(facture.montant_total).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                        facture.statut === 'PAYEE' 
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                          : "bg-amber-100 text-amber-700 border border-amber-200"
                      )}>
                        {facture.statut === 'PAYEE' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {facture.statut === 'PAYEE' ? 'PAYÉE' : 'À PAYER'}
                      </span>
                    </td>
                  </tr>
                  {expandedFacture === facture.id && (
                    <tr>
                      <td colSpan={6} className="px-8 py-4 bg-muted/5 border-t border-b">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            <FileText className="w-3 h-3" />
                            Détail des écritures liées
                          </div>
                          
                          {loadingDetails === facture.id ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="border rounded-md bg-background shadow-sm overflow-hidden">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-muted/30 text-muted-foreground font-medium border-b">
                                  <tr>
                                    <th className="px-3 py-2">Date</th>
                                    <th className="px-3 py-2">Libellé</th>
                                    <th className="px-3 py-2 text-right">Montant (Crédit)</th>
                                    <th className="px-3 py-2 text-center">Lettrage</th>
                                    {facture.statut === 'A_PAYER' && (
                                      <th className="px-3 py-2 text-center">Action</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {details[facture.id]?.length === 0 ? (
                                    <tr>
                                      <td colSpan={facture.statut === 'A_PAYER' ? 5 : 4} className="px-3 py-4 text-center text-muted-foreground italic">
                                        Aucune écriture liée à cette facture.
                                      </td>
                                    </tr>
                                  ) : (
                                    details[facture.id]?.map(ecriture => (
                                      <tr key={ecriture.id} className="hover:bg-muted/10">
                                        <td className="px-3 py-2 text-muted-foreground">
                                          {format(new Date(ecriture.date_ecriture), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-3 py-2">{ecriture.libelle}</td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          {Number(ecriture.montant).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          {ecriture.lettrage ? (
                                            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-mono">
                                              {ecriture.lettrage}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground italic">Non lettré</span>
                                          )}
                                        </td>
                                        {facture.statut === 'A_PAYER' && (
                                          <td className="px-3 py-2 text-center">
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRetirerEcriture(ecriture, facture.id);
                                              }}
                                              title="Retirer du lot"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                          </td>
                                        )}
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
