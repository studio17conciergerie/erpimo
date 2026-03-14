import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { travelerService, Traveler } from '../travelerService';
import { Button } from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  CreditCard, 
  ShieldAlert, 
  Save, 
  History, 
  FileText, 
  ExternalLink,
  AlertTriangle,
  Mail,
  Phone,
  Globe,
  StickyNote
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type TabType = 'profil' | 'historique' | 'compta';

export default function LocataireDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [traveler, setTraveler] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('profil');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Traveler>>({});

  useEffect(() => {
    if (id) fetchData(id);
  }, [id]);

  const fetchData = async (travelerId: string) => {
    try {
      const data = await travelerService.getTravelerById(travelerId);
      setTraveler(data);
      setFormData(data);
      
      if (data.code_auxiliaire) {
        const ledgerData = await travelerService.getTravelerLedger(data.code_auxiliaire);
        setLedger(ledgerData || []);
      }
    } catch (error) {
      console.error('Error fetching traveler details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      await travelerService.updateTraveler(id, formData);
      await fetchData(id);
    } catch (error) {
      console.error('Error saving traveler:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (!traveler) return <div className="p-8 text-center">Locataire introuvable.</div>;

  const totalPayout = traveler.reservations?.reduce((acc: number, res: any) => acc + (res.payout_net || 0), 0) || 0;
  const balance = ledger.reduce((acc, curr) => acc + (curr.compte_debit === (traveler.code_auxiliaire || '411-LOC') ? curr.montant : -curr.montant), 0);

  return (
    <div className="space-y-6">
      {/* Blacklist Warning */}
      {formData.is_blacklisted && (
        <div className="bg-red-600 text-white p-4 rounded-lg flex items-center gap-4 shadow-lg animate-pulse">
          <ShieldAlert className="h-8 w-8" />
          <div>
            <h3 className="font-bold text-lg uppercase tracking-wider">Attention : Voyageur Blacklisté</h3>
            <p className="text-red-100 text-sm">Ce voyageur est marqué comme indésirable. Ne pas accepter de nouvelles réservations.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tenants')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {traveler.prenom} {traveler.nom}
            </h1>
            <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-600">
              {traveler.code_auxiliaire}
            </code>
            {traveler.is_blacklisted && (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-red-200">
                Blacklisté
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Client depuis le {format(new Date(traveler.created_at), 'dd/MM/yyyy')} • {traveler.reservations?.length || 0} séjours
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('profil')}
          className={cn(
            "px-6 py-3 text-sm font-medium transition-colors relative",
            activeTab === 'profil' ? "text-emerald-600" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" /> Profil
          </div>
          {activeTab === 'profil' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />}
        </button>
        <button
          onClick={() => setActiveTab('historique')}
          className={cn(
            "px-6 py-3 text-sm font-medium transition-colors relative",
            activeTab === 'historique' ? "text-emerald-600" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4" /> Historique des Séjours
          </div>
          {activeTab === 'historique' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />}
        </button>
        <button
          onClick={() => setActiveTab('compta')}
          className={cn(
            "px-6 py-3 text-sm font-medium transition-colors relative",
            activeTab === 'compta' ? "text-emerald-600" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Cautions & Compta
          </div>
          {activeTab === 'compta' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />}
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'profil' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informations Personnelles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Prénom</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                        value={formData.prenom || ''}
                        onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Nom</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                        value={formData.nom || ''}
                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <Mail className="h-3 w-3" /> Email
                      </label>
                      <input
                        type="email"
                        className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <Phone className="h-3 w-3" /> Téléphone
                      </label>
                      <input
                        type="tel"
                        className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                        value={formData.telephone || ''}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <Globe className="h-3 w-3" /> Nationalité
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                      value={formData.nationalite || ''}
                      onChange={(e) => setFormData({ ...formData, nationalite: e.target.value })}
                      placeholder="Ex: Française, Américaine..."
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <StickyNote className="h-5 w-5 text-slate-400" /> Notes Internes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <textarea
                    className="w-full h-32 px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none"
                    placeholder="Notes sur le comportement, préférences, incidents..."
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className={cn("border-2", formData.is_blacklisted ? "border-red-500 bg-red-50" : "border-slate-200")}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldAlert className={cn("h-5 w-5", formData.is_blacklisted ? "text-red-600" : "text-slate-400")} />
                    Sécurité & Blacklist
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">Blacklister ce voyageur</span>
                      <span className="text-xs text-slate-500">Empêche toute nouvelle réservation</span>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, is_blacklisted: !formData.is_blacklisted })}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        formData.is_blacklisted ? "bg-red-600" : "bg-slate-200"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          formData.is_blacklisted ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                  
                  {formData.is_blacklisted && (
                    <div className="flex items-start gap-2 p-3 bg-red-100 text-red-700 rounded-md text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Une alerte sera affichée sur toutes les réservations liées à ce voyageur.</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Résumé Activité</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-500 text-sm">Total Séjours</span>
                    <span className="font-bold text-slate-900">{traveler.reservations?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-500 text-sm">Volume d'Affaires</span>
                    <span className="font-bold text-slate-900">{formatCurrency(totalPayout)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500 text-sm">Solde Comptable</span>
                    <span className={cn("font-bold", balance > 0 ? "text-red-600" : "text-emerald-600")}>
                      {formatCurrency(balance)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'historique' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-slate-400" />
                Historique des Réservations ({traveler.reservations?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Logement</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Payout Net</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {traveler.reservations?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Aucun séjour enregistré.</td>
                      </tr>
                    ) : (
                      traveler.reservations.map((res: any) => (
                        <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            {format(new Date(res.check_in), 'dd/MM/yyyy')} → {format(new Date(res.check_out), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-4 py-3">{res.logement?.nom || 'Inconnu'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded border bg-slate-50">{res.source}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(res.payout_net)}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                              res.statut_workflow === 'REDDITION' ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                            )}>
                              {res.statut_workflow}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link to={`/reservations/${res.id}`}>
                              <Button variant="ghost" size="sm" className="text-emerald-600 h-8">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </Link>
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

        {activeTab === 'compta' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-slate-400" />
                  Gestion des Cautions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-bold">Intégration Swikly (Bientôt)</p>
                    <p>La gestion automatisée des cautions via Swikly sera bientôt disponible ici.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm">Noter une caution retenue</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Montant</label>
                      <input type="number" className="w-full px-3 py-2 border border-slate-200 rounded-md" placeholder="0.00 €" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                      <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-md" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Motif de la retenue</label>
                    <textarea className="w-full h-20 px-3 py-2 border border-slate-200 rounded-md outline-none resize-none" placeholder="Ex: Dégradation canapé, ménage supplémentaire..." />
                  </div>
                  <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
                    Enregistrer la retenue
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-slate-400" />
                  Comptabilité Locataire
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase">Solde Actuel</div>
                    <div className={cn("text-2xl font-bold", balance > 0 ? "text-red-600" : "text-emerald-600")}>
                      {formatCurrency(balance)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-500 uppercase">Compte</div>
                    <div className="font-mono text-slate-900">{traveler.code_auxiliaire || '411-LOC'}</div>
                  </div>
                </div>

                  <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm">Dernières écritures</h4>
                    <Link 
                      to={`/accounting/grand-livre?compte=${traveler.code_auxiliaire}&title=${encodeURIComponent(traveler.prenom + ' ' + traveler.nom)}`}
                      className="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      Grand Livre Général
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {ledger.length === 0 ? (
                      <p className="text-center py-4 text-slate-500 text-xs">Aucune écriture comptable.</p>
                    ) : (
                      ledger.slice(-5).reverse().map((entry: any) => (
                        <div key={entry.id} className="flex justify-between items-center p-2 text-xs border-b border-slate-50">
                          <div>
                            <div className="font-medium text-slate-900">{entry.libelle}</div>
                            <div className="text-slate-400">{format(new Date(entry.date_ecriture), 'dd/MM/yyyy')}</div>
                          </div>
                          <div className={cn(
                            "font-bold",
                            entry.compte_debit === (traveler.code_auxiliaire || '411-LOC') ? "text-red-600" : "text-emerald-600"
                          )}>
                            {entry.compte_debit === (traveler.code_auxiliaire || '411-LOC') ? '+' : '-'} {formatCurrency(entry.montant)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <Button variant="ghost" className="w-full text-xs text-slate-500">Voir tout le grand livre</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
