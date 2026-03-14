import React, { useState, useEffect } from 'react';
import { facturationFournisseurApi, ArborescenceMenages } from '@/services/facturationFournisseurApi';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

export const ValidationMenagesDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ArborescenceMenages>({});
  const [selectedReservations, setSelectedReservations] = useState<{ [fournisseurId: string]: string[] }>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedFournisseurs, setExpandedFournisseurs] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await facturationFournisseurApi.getMenagesEnAttente();
      setData(result);
      setSelectedReservations({});
    } catch (error) {
      console.error('Erreur lors du chargement des ménages:', error);
      toast.error('Impossible de charger les ménages en attente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleSelection = (fournisseurId: string, reservationId: string) => {
    setSelectedReservations(prev => {
      const current = prev[fournisseurId] || [];
      const next = current.includes(reservationId)
        ? current.filter(id => id !== reservationId)
        : [...current, reservationId];
      return { ...prev, [fournisseurId]: next };
    });
  };

  const toggleExpanded = (fournisseurId: string) => {
    setExpandedFournisseurs(prev => 
      prev.includes(fournisseurId) 
        ? prev.filter(id => id !== fournisseurId) 
        : [...prev, fournisseurId]
    );
  };

  const calculateTotal = (fournisseurId: string) => {
    const selectedIds = selectedReservations[fournisseurId] || [];
    let total = 0;
    const fData = data[fournisseurId];
    if (!fData) return 0;

    Object.values(fData.proprietaires).forEach((proprio: any) => {
      proprio.logements.forEach((logement: any) => {
        logement.reservations.forEach((res: any) => {
          if (selectedIds.includes(res.id)) {
            total += res.montant_menage;
          }
        });
      });
    });
    return total;
  };

  const handleValidate = async (fournisseurId: string) => {
    const selectedIds = selectedReservations[fournisseurId] || [];
    if (selectedIds.length === 0) return;

    const total = calculateTotal(fournisseurId);
    setProcessing(fournisseurId);

    try {
      await facturationFournisseurApi.creerFactureGoupee(fournisseurId, selectedIds, total);
      toast.success(`Facture de ${total.toFixed(2)}€ créée pour ${data[fournisseurId].nom}`);
      await fetchData();
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      toast.error('Erreur lors de la création de la facture.');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const fournisseurIds = Object.keys(data);

  if (fournisseurIds.length === 0) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Tous les ménages sont déjà facturés !</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Synthèse des ménages à payer</h2>
        <Button variant="outline" onClick={fetchData}>Rafraîchir</Button>
      </div>

      <div className="space-y-4">
        {fournisseurIds.map(fId => {
          const fData = data[fId];
          const isExpanded = expandedFournisseurs.includes(fId);
          const selectedCount = selectedReservations[fId]?.length || 0;
          const totalSelected = calculateTotal(fId);

          return (
            <div key={fId} className="border rounded-lg bg-card shadow-sm overflow-hidden">
              <button 
                onClick={() => toggleExpanded(fId)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-start">
                    <span className="text-lg font-semibold">{fData.nom}</span>
                    <span className="text-sm text-muted-foreground">
                      {Object.keys(fData.proprietaires).length} propriétaires en attente
                    </span>
                  </div>
                  {selectedCount > 0 && (
                    <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                      {selectedCount} séjours sélectionnés • {totalSelected.toFixed(2)}€
                    </div>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>

              {isExpanded && (
                <div className="p-4 border-t bg-muted/5 space-y-6">
                  {Object.entries(fData.proprietaires).map(([pId, pData]: [string, any]) => (
                    <div key={pId} className="space-y-3">
                      <h4 className="font-medium text-muted-foreground border-b pb-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary/40" />
                        Propriétaire : {pData.nom}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pData.logements.map((logement: any) => (
                          <Card key={logement.id} className="bg-background border shadow-sm">
                            <CardHeader className="py-3 px-4">
                              <CardTitle className="text-sm font-semibold">{logement.nom}</CardTitle>
                            </CardHeader>
                            <CardContent className="py-0 px-4 pb-3 space-y-2">
                              {logement.reservations.map((res: any) => (
                                <div key={res.id} className="flex items-center justify-between gap-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="checkbox"
                                      id={res.id} 
                                      checked={selectedReservations[fId]?.includes(res.id)}
                                      onChange={() => toggleSelection(fId, res.id)}
                                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor={res.id} className="cursor-pointer select-none">
                                      <span className="font-medium">{res.confirmation_code}</span>
                                      <span className="text-xs text-muted-foreground block">
                                        Check-in: {new Date(res.check_in).toLocaleDateString()}
                                      </span>
                                    </label>
                                  </div>
                                  <span className="font-semibold">{res.montant_menage.toFixed(2)}€</span>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      disabled={selectedCount === 0 || processing === fId}
                      onClick={() => handleValidate(fId)}
                      className="gap-2"
                    >
                      {processing === fId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Valider la facture de {totalSelected.toFixed(2)}€ pour {fData.nom}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
