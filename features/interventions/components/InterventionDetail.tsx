import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { interventionsApi, Intervention, ImputationCible } from '../interventionsApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { 
  ArrowLeft, 
  Wrench, 
  Calendar, 
  CheckCircle2, 
  FileText, 
  CreditCard,
  Building2,
  MapPin,
  Loader2,
  AlertCircle,
  Save,
  User,
  ShieldCheck,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function InterventionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [montant, setMontant] = useState<string>('');
  const [imputation, setImputation] = useState<ImputationCible>('PROPRIETAIRE');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await interventionsApi.getInterventionById(id);
      setIntervention(data);
      if (data.montant_ttc) setMontant(data.montant_ttc.toString());
      if (data.imputation_cible) setImputation(data.imputation_cible);
    } catch (error) {
      console.error('Error loading intervention:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleValiderFacture = async () => {
    if (!id || !montant || parseFloat(montant) <= 0) return;
    
    setProcessing(true);
    try {
      await interventionsApi.validerFactureIntervention(id, parseFloat(montant), imputation);
      await loadData();
      alert('Facture validée et écritures comptables générées');
    } catch (error: any) {
      console.error('Error validating invoice:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateStatus = async (newStatus: any) => {
    if (!id) return;
    try {
      await interventionsApi.updateIntervention(id, { statut: newStatus });
      await loadData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500">Chargement de l'intervention...</p>
      </div>
    );
  }

  if (!intervention) return <div>Intervention non trouvée</div>;

  const isFinancial = intervention.statut === 'FACTURE_VALIDEE' || intervention.statut === 'PAYE';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/interventions')} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{intervention.titre}</h1>
          <p className="text-slate-500 text-sm">Ticket #{intervention.id.substring(0, 8)}</p>
        </div>
        <div className={cn(
          "ml-auto px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
          isFinancial ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-blue-100 text-blue-700 border-blue-200"
        )}>
          {intervention.statut}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                Informations Opérationnelles
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logement</p>
                  <div className="flex items-center gap-2 text-slate-900 font-medium">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {intervention.logement?.nom}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prestataire</p>
                  <div className="flex items-center gap-2 text-slate-900 font-medium">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {intervention.fournisseur?.nom || 'Non assigné'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</p>
                <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  {intervention.description || 'Aucune description fournie.'}
                </p>
              </div>

              {intervention.statut === 'PLANIFIE' && (
                <div className="pt-4 flex justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => handleUpdateStatus('REALISE')}
                    className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marquer comme Réalisé
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing Section */}
          {(intervention.statut === 'REALISE' || isFinancial) && (
            <Card className={cn(
              "border-slate-200 shadow-sm transition-all",
              isFinancial ? "bg-emerald-50/30 border-emerald-100" : "bg-white"
            )}>
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className={cn("w-5 h-5", isFinancial ? "text-emerald-600" : "text-slate-600")} />
                  Section Facturation & Imputation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {isFinancial ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Montant TTC</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(intervention.montant_ttc || 0)}
                        </p>
                      </div>
                      <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Imputé à</p>
                        <p className="text-lg font-bold text-emerald-700 flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5" />
                          {intervention.imputation_cible}
                        </p>
                      </div>
                      <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Statut Comptable</p>
                        <p className="text-sm font-bold text-slate-600 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Écriture générée
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Montant TTC de la facture</label>
                        <div className="relative">
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={montant} 
                            onChange={(e) => setMontant(e.target.value)}
                            placeholder="0.00"
                            className="pl-8"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">À la charge de</label>
                        <select 
                          value={imputation}
                          onChange={(e) => setImputation(e.target.value as ImputationCible)}
                          className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="PROPRIETAIRE">Propriétaire (404)</option>
                          <option value="AGENCE">Agence (615)</option>
                          <option value="LOCATAIRE">Locataire (411/419)</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
                      <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-900 mb-1">Impact Comptable (Double Écriture) :</p>
                        <p>La validation générera deux écritures au <b>Journal des OD</b> :</p>
                        <div className="mt-2 space-y-2">
                          <div>
                            <p className="font-medium text-slate-700">1. Enregistrement de la facture :</p>
                            <p>• Crédit du fournisseur <b>{intervention.fournisseur?.code_auxiliaire}</b></p>
                            <p>• Débit du compte <b>{imputation === 'PROPRIETAIRE' ? '404 (Propriétaire)' : imputation === 'AGENCE' ? '615 (Entretien)' : '411 (Locataire)'}</b></p>
                          </div>
                          <div>
                            <p className="font-medium text-slate-700">2. Mise en attente règlement :</p>
                            <p>• Débit du fournisseur <b>{intervention.fournisseur?.code_auxiliaire}</b></p>
                            <p>• Crédit du compte <b>467000 (Attente Paiement Ménage)</b></p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        onClick={handleValiderFacture}
                        disabled={!montant || parseFloat(montant) <= 0 || processing}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Valider et Générer l'Écriture
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Status */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                <div className="relative pl-8">
                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
                  <p className="text-xs font-bold text-slate-900">Création du ticket</p>
                  <p className="text-[10px] text-slate-500">{format(new Date(intervention.created_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                
                {intervention.statut !== 'PLANIFIE' && (
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
                    <p className="text-xs font-bold text-slate-900">Intervention réalisée</p>
                    <p className="text-[10px] text-slate-500">Confirmé par le prestataire</p>
                  </div>
                )}

                {isFinancial && (
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
                    <p className="text-xs font-bold text-slate-900">Facture validée</p>
                    <p className="text-[10px] text-slate-500">Imputation : {intervention.imputation_cible}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-blue-50/30">
            <CardHeader className="p-4 border-b border-blue-100">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-blue-600">Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 text-xs h-9">
                <FileText className="w-4 h-4" />
                Télécharger le bon d'intervention
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-xs h-9">
                <User className="w-4 h-4" />
                Contacter le prestataire
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
