import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { suppliersApi, Supplier, PendingInvoice } from '../suppliersApi';
import { grandLivreApi } from '@/features/accounting/grandLivreApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { 
  ArrowLeft, 
  Building2, 
  CreditCard, 
  History, 
  Settings, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Save,
  Wallet,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

export default function FournisseurDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pay' | 'ledger' | 'info'>('pay');
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [savingInfo, setSavingInfo] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nom: '',
    siret: '',
    email: '',
    telephone: '',
    iban: '',
    bic: ''
  });

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    try {
      const { data: sData, error: sError } = await supabase.from('tiers').select('*').eq('id', id).single();
      if (sError) throw sError;

      const [iData, lData] = await Promise.all([
        suppliersApi.getFacturesEnAttente(id),
        grandLivreApi.getGrandLivre({ 
          compteCentralisateur: sData.code_auxiliaire, 
          dateDebut: '2000-01-01', 
          dateFin: '2099-12-31' 
        })
      ]);

      setSupplier({ ...sData, solde: lData.soldeCloture });
      setFormData({
        nom: sData.nom || '',
        siret: sData.siret || '',
        email: sData.email || '',
        telephone: sData.telephone || '',
        iban: sData.iban || '',
        bic: sData.bic || ''
      });
      setPendingInvoices(iData);
      setLedger(lData.entries);
    } catch (error) {
      console.error('Error loading supplier detail:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSavingInfo(true);
    try {
      await suppliersApi.updateFournisseur(id, formData);
      setSupplier(prev => prev ? { ...prev, ...formData } : null);
      alert('Informations mises à jour avec succès');
    } catch (error) {
      console.error('Error updating supplier info:', error);
      alert('Erreur lors de la mise à jour des informations');
    } finally {
      setSavingInfo(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500">Chargement du fournisseur...</p>
      </div>
    );
  }

  if (!supplier) return <div>Fournisseur non trouvé</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/suppliers')} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{supplier.nom} {supplier.prenom}</h1>
          <p className="text-slate-500 text-sm font-mono">{supplier.code_auxiliaire}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Solde Actuel</p>
                <p className={cn(
                  "text-2xl font-bold",
                  supplier.solde > 0 ? "text-rose-600" : "text-emerald-600"
                )}>
                  {formatCurrency(supplier.solde)}
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Statut IBAN</p>
                {supplier.iban ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Renseigné
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-rose-500 text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Manquant
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('pay')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all",
                activeTab === 'pay' ? "bg-slate-900 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Wallet className="w-4 h-4" />
              À Payer
              {pendingInvoices.length > 0 && (
                <span className={cn(
                  "ml-auto px-2 py-0.5 rounded-full text-[10px]",
                  activeTab === 'pay' ? "bg-white/20 text-white" : "bg-rose-100 text-rose-600"
                )}>
                  {pendingInvoices.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all",
                activeTab === 'ledger' ? "bg-slate-900 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <History className="w-4 h-4" />
              Grand Livre
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all",
                activeTab === 'info' ? "bg-slate-900 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Settings className="w-4 h-4" />
              Coordonnées
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'pay' && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100">
                <CardTitle className="text-lg">Factures en attente de règlement</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-3 bg-blue-50 border-b border-blue-100 flex items-start gap-3 text-blue-700 text-[11px] leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>
                    <b>Information :</b> Le règlement des factures s'effectue désormais via le module de rapprochement bancaire.
                  </p>
                </div>
                {!supplier.iban && (
                  <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center gap-3 text-rose-700 text-sm">
                    <AlertCircle className="w-5 h-5" />
                    <p><b>IBAN manquant :</b> N'oubliez pas de renseigner les coordonnées bancaires du fournisseur pour faciliter le rapprochement.</p>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Libellé</th>
                        <th className="px-4 py-3 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-20 text-center text-slate-400 italic">
                            Aucune facture en attente.
                          </td>
                        </tr>
                      ) : (
                        pendingInvoices.map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-500">{format(new Date(invoice.date_ecriture), 'dd/MM/yyyy')}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{invoice.libelle}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(invoice.montant)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'ledger' && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-lg">Grand Livre Fournisseur</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Libellé</th>
                        <th className="px-4 py-3">Pièce</th>
                        <th className="px-4 py-3 text-right">Débit</th>
                        <th className="px-4 py-3 text-right">Crédit</th>
                        <th className="px-4 py-3 text-right">Solde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-20 text-center text-slate-400 italic">
                            Aucun mouvement comptable.
                          </td>
                        </tr>
                      ) : (
                        ledger.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-500">{format(new Date(entry.date_ecriture), 'dd/MM/yyyy')}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-900">{entry.libelle}</span>
                                {entry.lettrage && (
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                    Lettrage: {entry.lettrage}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">
                              {entry.numero_piece || '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(entry.debit)}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(entry.credit)}</td>
                            <td className={cn(
                              "px-4 py-3 text-right font-bold",
                              entry.solde_progressif > 0 ? "text-rose-600" : "text-emerald-600"
                            )}>
                              {formatCurrency(entry.solde_progressif)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'info' && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-lg">Coordonnées et Informations Bancaires</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form className="space-y-6" onSubmit={handleUpdateInfo}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Nom / Raison Sociale</label>
                      <Input 
                        value={formData.nom} 
                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })} 
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">SIRET</label>
                      <Input 
                        value={formData.siret} 
                        onChange={(e) => setFormData({ ...formData, siret: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                      <Input 
                        type="email"
                        value={formData.email} 
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Téléphone</label>
                      <Input 
                        value={formData.telephone} 
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 space-y-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Informations Bancaires
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">IBAN</label>
                        <Input 
                          value={formData.iban} 
                          onChange={(e) => setFormData({ ...formData, iban: e.target.value })} 
                          placeholder="FR76..." 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">BIC</label>
                        <Input 
                          value={formData.bic} 
                          onChange={(e) => setFormData({ ...formData, bic: e.target.value })} 
                          placeholder="XXXXFRXX" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" className="gap-2 bg-slate-900" disabled={savingInfo}>
                      {savingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Enregistrer les modifications
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
