import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Reservation, reservationsService } from '../reservationsService';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { ArrowLeft, Calendar, User, Home, FileText, CreditCard, ExternalLink, Edit2, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function ReservationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingPayout, setIsEditingPayout] = useState(false);
  const [editedPayout, setEditedPayout] = useState<string>('');
  const [savingPayout, setSavingPayout] = useState(false);

  useEffect(() => {
    if (id) fetchData(id);
  }, [id]);

  const fetchData = async (resId: string) => {
    try {
      const resData = await reservationsService.getReservationById(resId);
      setReservation(resData);
      
      const ledgerData = await reservationsService.getReservationLedger(resId);
      setLedger(ledgerData || []);
    } catch (error) {
      console.error('Error fetching reservation details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  const handleStartEditPayout = () => {
    if (reservation) {
      setEditedPayout(reservation.payout_net.toString());
      setIsEditingPayout(true);
    }
  };

  const handleSavePayout = async () => {
    if (!reservation || !id) return;
    
    const newPayout = parseFloat(editedPayout);
    if (isNaN(newPayout)) {
      alert("Veuillez entrer un montant valide.");
      return;
    }

    setSavingPayout(true);
    try {
      const updated = await reservationsService.updateReservation(id, { payout_net: newPayout });
      setReservation(updated);
      setIsEditingPayout(false);
    } catch (error) {
      console.error('Error updating payout:', error);
      alert("Erreur lors de la mise à jour du payout.");
    } finally {
      setSavingPayout(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (!reservation) return <div className="p-8 text-center">Réservation introuvable.</div>;

  const isReadOnly = reservation.statut_workflow === 'REDDITION';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reservations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Réservation {reservation.confirmation_code}
            </h1>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border",
              reservation.statut_workflow === 'BROUILLON' && "bg-slate-100 text-slate-500 border-slate-200",
              reservation.statut_workflow === 'ATTENTE_PAIEMENT' && "bg-amber-50 text-amber-700 border-amber-200",
              reservation.statut_workflow === 'ENCAISSE' && "bg-emerald-50 text-emerald-700 border-emerald-200",
              reservation.statut_workflow === 'REDDITION' && "bg-slate-900 text-white border-slate-900",
            )}>
              {reservation.statut_workflow}
            </span>
            {isReadOnly && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <FileText className="w-3 h-3" />
                Dossier Verrouillé (Lecture Seule)
              </span>
            )}
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded border",
              reservation.source.toLowerCase().includes('airbnb') ? "bg-rose-50 text-rose-600 border-rose-100" :
              reservation.source.toLowerCase().includes('booking') ? "bg-blue-50 text-blue-600 border-blue-100" :
              "bg-slate-50 text-slate-600 border-slate-200"
            )}>
              {reservation.source}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Créée le {format(new Date(reservation.created_at), 'dd/MM/yyyy HH:mm')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info & Financials */}
        <div className="lg:col-span-2 space-y-6">
          {/* Infos Séjour */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-500" />
                Infos Séjour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase">Dates</label>
                    <div className="font-medium text-slate-900">
                      {formatDate(reservation.check_in)} → {formatDate(reservation.check_out)}
                    </div>
                    <div className="text-sm text-slate-500">{reservation.nb_nuits} nuits</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase">Voyageur</label>
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      {reservation.voyageur_id ? (
                        <Link 
                          to={`/tenants/${reservation.voyageur_id}`}
                          className="text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          {reservation.guest_name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        reservation.guest_name
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase">Logement</label>
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      <Home className="h-4 w-4 text-slate-400" />
                      {reservation.logement?.nom || 'Inconnu'}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-1">ID: {reservation.listing_id}</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase">Propriétaire</label>
                    <div className="font-medium text-slate-900">
                      {reservation.logement?.proprietaire?.nom || '-'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ventilation Financière */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-slate-500" />
                Ventilation Financière
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Top Level: Payout */}
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-medium text-slate-700">Payout Net (Reçu)</span>
                  <div className="flex items-center gap-2">
                    {isEditingPayout ? (
                      <div className="flex items-center gap-1">
                        <Input 
                          type="number" 
                          step="0.01"
                          value={editedPayout}
                          onChange={(e) => setEditedPayout(e.target.value)}
                          className="w-24 h-8 text-right font-bold"
                          autoFocus
                        />
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-emerald-600"
                          onClick={handleSavePayout}
                          disabled={savingPayout}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-red-600"
                          onClick={() => setIsEditingPayout(false)}
                          disabled={savingPayout}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-lg text-slate-900">{formatCurrency(reservation.payout_net)}</span>
                        {reservation.statut_workflow === 'BROUILLON' && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-slate-400 hover:text-slate-600"
                            onClick={handleStartEditPayout}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-2 pl-4 border-l-2 border-slate-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Commission OTA (Info)</span>
                    <span className="text-slate-400">{formatCurrency(reservation.commission_ota)}</span>
                  </div>
                  
                  <div className="h-px bg-slate-100 my-2"></div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                      Ménage
                    </span>
                    <span className="font-mono text-red-600">- {formatCurrency(reservation.montant_menage || 0)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                      Assurance
                    </span>
                    <span className="font-mono text-red-600">- {formatCurrency(reservation.montant_assurance || 0)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                      Honoraires Agence
                    </span>
                    <span className="font-mono text-red-600">- {formatCurrency(reservation.montant_commission_agence || 0)}</span>
                  </div>
                </div>

                {/* Bottom Line: Net Owner */}
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100 mt-4">
                  <span className="font-medium text-emerald-800">Loyer Net Propriétaire</span>
                  <span className="font-bold text-lg text-emerald-700">{formatCurrency(reservation.loyer_net_proprietaire || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Accounting Ledger */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-500" />
                Écritures Comptables
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ledger.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Aucune écriture générée.
                  {reservation.statut_workflow === 'BROUILLON' && (
                    <p className="mt-2 text-xs">La comptabilité sera générée lors de la validation.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {ledger.map((entry) => (
                    <div key={entry.id} className="p-3 border border-slate-100 rounded-md bg-slate-50/50 text-sm hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono text-xs text-slate-500">{format(new Date(entry.date_ecriture), 'dd/MM')}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(entry.montant)}</span>
                      </div>
                      <div className="text-slate-700 font-medium mb-1">{entry.libelle}</div>
                      <div className="flex justify-between text-xs font-mono text-slate-500">
                        <span>D: {entry.compte_debit}</span>
                        <span>C: {entry.compte_credit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
