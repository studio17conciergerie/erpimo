import React, { useState, useEffect } from 'react';
import { transfertHonorairesApi, HonoraireDisponible, TransfertHonoraire } from '@/services/transfertHonorairesApi';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Loader2, CheckCircle2, History, ArrowRightLeft, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export const TransfertHonorairesDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [disponibles, setDisponibles] = useState<HonoraireDisponible[]>([]);
  const [historique, setHistorique] = useState<TransfertHonoraire[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [activeView, setActiveView] = useState<'pending' | 'history'>('pending');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [disp, hist] = await Promise.all([
        transfertHonorairesApi.getHonorairesDisponibles(),
        transfertHonorairesApi.getHistoriqueTransferts()
      ]);
      setDisponibles(disp);
      setHistorique(hist);
      setSelectedIds([]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      toast.error('Impossible de charger les honoraires.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === disponibles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(disponibles.map(d => d.id));
    }
  };

  const calculateTotal = () => {
    return disponibles
      .filter(d => selectedIds.includes(d.id))
      .reduce((sum, d) => sum + Number(d.montant_commission_agence), 0);
  };

  const handleCreerTransfert = async () => {
    if (selectedIds.length === 0) return;
    
    setProcessing(true);
    try {
      const total = calculateTotal();
      await transfertHonorairesApi.creerLotTransfert(selectedIds, total);
      toast.success(`Lot de transfert de ${total.toFixed(2)}€ créé avec succès.`);
      await fetchData();
      setActiveView('history');
    } catch (error) {
      console.error('Erreur lors de la création du transfert:', error);
      toast.error('Erreur lors de la création du lot de transfert.');
    } finally {
      setProcessing(false);
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
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Transfert des Honoraires Agence</h2>
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setActiveView('pending')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                activeView === 'pending' ? "bg-background shadow-sm" : "hover:text-primary"
              )}
            >
              <ListChecks className="w-4 h-4" />
              À transférer ({disponibles.length})
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                activeView === 'history' ? "bg-background shadow-sm" : "hover:text-primary"
              )}
            >
              <History className="w-4 h-4" />
              Historique
            </button>
          </div>
        </div>
        <Button variant="outline" onClick={fetchData}>Rafraîchir</Button>
      </div>

      {activeView === 'pending' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Honoraires disponibles (Redditions effectuées)</CardTitle>
                {disponibles.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedIds.length === disponibles.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {disponibles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Aucun honoraire en attente de transfert.</p>
                  <p className="text-sm">Les honoraires apparaissent ici après la reddition au propriétaire.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                        <tr>
                          <th className="px-4 py-3 w-10"></th>
                          <th className="px-4 py-3">Logement</th>
                          <th className="px-4 py-3">Date Check-in</th>
                          <th className="px-4 py-3">Référence</th>
                          <th className="px-4 py-3 text-right">Commission</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {disponibles.map(d => (
                          <tr 
                            key={d.id} 
                            className={cn(
                              "hover:bg-muted/30 transition-colors cursor-pointer",
                              selectedIds.includes(d.id) && "bg-primary/5"
                            )}
                            onClick={() => toggleSelection(d.id)}
                          >
                            <td className="px-4 py-3">
                              <input 
                                type="checkbox" 
                                checked={selectedIds.includes(d.id)}
                                onChange={() => {}} // Handled by tr click
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium">{d.logement.nom}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {format(new Date(d.check_in), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{d.confirmation_code}</td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {Number(d.montant_commission_agence).toFixed(2)}€
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">{selectedIds.length} réservation(s) sélectionnée(s)</span>
                      <span className="text-2xl font-bold text-primary">{calculateTotal().toFixed(2)}€</span>
                    </div>
                    <Button 
                      disabled={selectedIds.length === 0 || processing}
                      onClick={handleCreerTransfert}
                      className="gap-2"
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                      Créer le lot de transfert
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historique des transferts</CardTitle>
          </CardHeader>
          <CardContent>
            {historique.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Aucun historique de transfert.</p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Référence</th>
                      <th className="px-4 py-3 text-right">Montant Total</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historique.map(h => (
                      <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          {format(new Date(h.date_creation), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{h.reference}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {Number(h.montant_total).toFixed(2)}€
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                            h.statut === 'RAPPROCHE' 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-amber-100 text-amber-700"
                          )}>
                            {h.statut === 'RAPPROCHE' ? 'RAPPROCHÉ' : 'ATTENTE BANQUE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
