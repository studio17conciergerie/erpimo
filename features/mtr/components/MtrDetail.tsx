import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { mtrService, BailMtr, StatutBailMtr, StatutCautionMtr } from '../mtrService';
import { Button } from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { EcheancierBail } from './EcheancierBail';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Home, 
  FileText, 
  CreditCard, 
  ExternalLink, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Download,
  Edit3,
  Trash2,
  Info
} from 'lucide-react';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function MtrDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bail, setBail] = useState<BailMtr | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showCautionModal, setShowCautionModal] = useState(false);
  const [showRestitutionModal, setShowRestitutionModal] = useState(false);
  const [showRetenueModal, setShowRetenueModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Retenue form
  const [retenueAmount, setRetenueAmount] = useState(0);
  const [retenueMotif, setRetenueMotif] = useState('');

  useEffect(() => {
    if (id) fetchData(id);
  }, [id]);

  const fetchData = async (bailId: string) => {
    try {
      const data = await mtrService.getBailById(bailId);
      setBail(data);
    } catch (error) {
      console.error('Error fetching bail details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: StatutBailMtr) => {
    if (!bail) return;
    if (!confirm(`Confirmer le passage du bail au statut ${newStatus} ?`)) return;

    try {
      setProcessing(true);
      const updates: Partial<BailMtr> = { statut: newStatus };
      if (newStatus === 'ACTIF' && !bail.date_signature) {
        updates.date_signature = new Date().toISOString().split('T')[0];
      }
      await mtrService.updateBail(bail.id, updates);
      fetchData(bail.id);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erreur lors du changement de statut');
    } finally {
      setProcessing(false);
    }
  };

  const handleCautionEncaissement = async () => {
    if (!bail) return;
    setProcessing(true);
    try {
      await mtrService.recordCautionAccounting(bail, 'ENCAISSEMENT', bail.montant_caution);
      await mtrService.updateBail(bail.id, { 
        statut_caution: 'ENCAISSEE',
        date_encaissement_caution: new Date().toISOString().split('T')[0]
      });
      setShowCautionModal(false);
      fetchData(bail.id);
    } catch (error) {
      console.error('Error recording caution:', error);
      alert('Erreur lors de l\'encaissement de la caution');
    } finally {
      setProcessing(false);
    }
  };

  const handleCautionRestitution = async () => {
    if (!bail) return;
    setProcessing(true);
    try {
      await mtrService.recordCautionAccounting(bail, 'RESTITUTION', bail.montant_caution);
      await mtrService.updateBail(bail.id, { 
        statut_caution: 'RESTITUEE',
        date_restitution_caution: new Date().toISOString().split('T')[0]
      });
      setShowRestitutionModal(false);
      fetchData(bail.id);
    } catch (error) {
      console.error('Error restituting caution:', error);
      alert('Erreur lors de la restitution de la caution');
    } finally {
      setProcessing(false);
    }
  };

  const handleCautionRetenue = async () => {
    if (!bail) return;
    if (retenueAmount > bail.montant_caution) {
        alert("Le montant retenu ne peut excéder le montant de la caution.");
        return;
    }
    setProcessing(true);
    try {
      await mtrService.recordCautionAccounting(bail, 'RETENUE', bail.montant_caution, {
        retenueAmount,
        motif: retenueMotif
      });
      await mtrService.updateBail(bail.id, { 
        statut_caution: 'RETENUE_PARTIELLE',
        montant_retenue_caution: retenueAmount,
        motif_retenue_caution: retenueMotif,
        date_restitution_caution: new Date().toISOString().split('T')[0]
      });
      setShowRetenueModal(false);
      fetchData(bail.id);
    } catch (error) {
      console.error('Error recording retenue:', error);
      alert('Erreur lors de la retenue sur caution');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (!bail) return <div className="p-8 text-center">Bail introuvable.</div>;

  const isReadOnly = bail.statut === 'TERMINE' || bail.statut === 'RESILIE';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/mtr')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Bail {bail.numero_bail}
              </h1>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                bail.statut === 'BROUILLON' && "bg-slate-100 text-slate-500 border-slate-200",
                bail.statut === 'ACTIF' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                bail.statut === 'TERMINE' && "bg-blue-50 text-blue-700 border-blue-200",
                bail.statut === 'RESILIE' && "bg-rose-50 text-rose-700 border-rose-200",
              )}>
                {bail.statut}
              </span>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                bail.type_bail === 'MOBILITE' && "bg-amber-50 text-amber-700 border-amber-200",
                bail.type_bail === 'ETUDIANT' && "bg-blue-50 text-blue-700 border-blue-200",
                bail.type_bail === 'CIVIL' && "bg-purple-50 text-purple-700 border-purple-200",
              )}>
                {bail.type_bail}
              </span>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                bail.source === 'DIRECT' && "bg-slate-900 text-white border-slate-900",
                bail.source === 'AIRBNB' && "bg-rose-500 text-white border-rose-500",
              )}>
                {bail.source}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Créé le {format(new Date(bail.created_at), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {bail.statut === 'BROUILLON' && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleStatusChange('ACTIF')}>
              Activer le bail
            </Button>
          )}
          {bail.statut === 'ACTIF' && (
            <>
              <Button variant="outline" onClick={() => handleStatusChange('TERMINE')}>
                Clôturer le bail
              </Button>
              <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => handleStatusChange('RESILIE')}>
                Résilier
              </Button>
            </>
          )}
          {!isReadOnly && (
            <Button variant="ghost" size="icon">
              <Edit3 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {bail.source === 'AIRBNB' && (
        <div className="flex items-center gap-2 p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 text-sm">
          <Info className="w-5 h-5 shrink-0" />
          Bail géré via Airbnb — Encaissements mensuels via Payouts OTA. Les avis d'échéance et quittances ne sont pas générés.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Infos Bail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-500" />
                Informations du Bail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase">Période</label>
                    <div className="font-bold text-slate-900">
                      {formatDate(bail.date_debut)} → {formatDate(bail.date_fin)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Durée : {differenceInMonths(new Date(bail.date_fin), new Date(bail.date_debut))} mois
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase">Locataire</label>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <Link to={`/tenants/${bail.locataire_id}`} className="text-blue-600 hover:underline">
                        {bail.locataire?.nom} {bail.locataire?.prenom}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">{bail.locataire?.code_auxiliaire}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase">Logement</label>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <Home className="h-4 w-4 text-slate-400" />
                      <Link to={`/properties/${bail.logement_id}`} className="text-blue-600 hover:underline">
                        {bail.logement?.nom}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500">Propriétaire: {bail.logement?.proprietaire?.nom}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase">Signature</label>
                      <div className="text-sm font-medium">{formatDate(bail.date_signature)}</div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase">Exigibilité</label>
                      <div className="text-sm font-medium">{bail.jour_exigibilite} du mois</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conditions Financières */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-slate-500" />
                Conditions Financières
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loyer HC</p>
                    <p className="font-bold text-slate-900">{formatCurrency(bail.loyer_hc)}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Charges</p>
                    <p className="font-bold text-slate-900">{formatCurrency(bail.provision_charges)}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Loyer CC</p>
                    <p className="font-bold text-blue-900">{formatCurrency(bail.loyer_cc)}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Caution</p>
                    <p className="font-bold text-emerald-900">{formatCurrency(bail.montant_caution)}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-slate-900 text-white rounded-xl">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total à la signature</p>
                    <p className="text-2xl font-black">
                        {formatCurrency(bail.loyer_cc + bail.montant_caution + bail.frais_agence_locataire)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Honoraires Locataire</p>
                    <p className="font-bold">{formatCurrency(bail.frais_agence_locataire)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Caution Section */}
          {bail.statut_caution !== 'NON_APPLICABLE' && (
            <Card className={cn(
                "border-2",
                bail.statut_caution === 'NON_VERSEE' && "border-amber-200 bg-amber-50/30",
                bail.statut_caution === 'ENCAISSEE' && "border-emerald-200 bg-emerald-50/30",
                bail.statut_caution === 'RESTITUEE' && "border-slate-200 bg-slate-50/30",
                bail.statut_caution === 'RETENUE_PARTIELLE' && "border-amber-200 bg-amber-50/30",
            )}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={cn(
                        "h-5 w-5",
                        bail.statut_caution === 'NON_VERSEE' && "text-amber-500",
                        bail.statut_caution === 'ENCAISSEE' && "text-emerald-500",
                        bail.statut_caution === 'RESTITUEE' && "text-slate-500",
                    )} />
                    Caution / Dépôt de Garantie
                  </div>
                  <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                      bail.statut_caution === 'NON_VERSEE' && "bg-amber-100 text-amber-700 border-amber-200",
                      bail.statut_caution === 'ENCAISSEE' && "bg-emerald-100 text-emerald-700 border-emerald-200",
                      bail.statut_caution === 'RESTITUEE' && "bg-slate-100 text-slate-700 border-slate-200",
                      bail.statut_caution === 'RETENUE_PARTIELLE' && "bg-amber-100 text-amber-700 border-amber-200",
                  )}>
                    {bail.statut_caution}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bail.statut_caution === 'NON_VERSEE' && (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-8 h-8 text-amber-500 opacity-50" />
                      <div>
                        <p className="font-bold text-amber-900">Caution non encaissée : {formatCurrency(bail.montant_caution)}</p>
                        <p className="text-xs text-amber-700">Le virement n'a pas encore été confirmé sur le compte séquestre.</p>
                      </div>
                    </div>
                    <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setShowCautionModal(true)}>
                      Confirmer l'encaissement
                    </Button>
                  </div>
                )}

                {bail.statut_caution === 'ENCAISSEE' && (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
                      <div>
                        <p className="font-bold text-emerald-900">Caution encaissée le {formatDate(bail.date_encaissement_caution)}</p>
                        <p className="text-xs text-emerald-700">Montant : {formatCurrency(bail.montant_caution)}</p>
                      </div>
                    </div>
                    {isReadOnly && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowRestitutionModal(true)}>
                          Restituer intégralement
                        </Button>
                        <Button variant="outline" size="sm" className="text-amber-600 border-amber-200" onClick={() => setShowRetenueModal(true)}>
                          Retenue partielle
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {bail.statut_caution === 'RESTITUEE' && (
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-slate-400" />
                    <div>
                      <p className="font-bold text-slate-900">Caution restituée le {formatDate(bail.date_restitution_caution)}</p>
                      <p className="text-xs text-slate-500">Montant total : {formatCurrency(bail.montant_caution)}</p>
                    </div>
                  </div>
                )}

                {bail.statut_caution === 'RETENUE_PARTIELLE' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                      <div>
                        <p className="font-bold text-amber-900">
                          Caution : {formatCurrency(bail.montant_retenue_caution)} retenus sur {formatCurrency(bail.montant_caution)}
                        </p>
                        <p className="text-xs text-amber-700">Restituée le {formatDate(bail.date_restitution_caution)}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-amber-100 text-sm italic text-slate-600">
                      Motif : {bail.motif_retenue_caution}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Échéancier Section */}
          <EcheancierBail bail={bail} />

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-500" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">Contrat de bail</span>
                </div>
                {bail.contrat_bail_url ? (
                  <Button variant="ghost" size="sm" className="text-blue-600">
                    <Download className="w-4 h-4" />
                  </Button>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Bientôt disponible</span>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">État des lieux d'entrée</label>
                <div className="flex items-center justify-between p-3 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  {bail.etat_lieux_entree_url ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-emerald-600 font-medium">Uploadé</span>
                      <Button variant="ghost" size="sm"><Download className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full py-2 text-slate-400 cursor-pointer hover:text-slate-600">
                      <Upload className="w-4 h-4 mr-2" />
                      <span className="text-xs">Uploader EDL Entrée</span>
                    </div>
                  )}
                </div>
              </div>

              {isReadOnly && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">État des lieux de sortie</label>
                  <div className="flex items-center justify-between p-3 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                    <div className="flex items-center justify-center w-full py-2 text-slate-400 cursor-pointer hover:text-slate-600">
                      <Upload className="w-4 h-4 mr-2" />
                      <span className="text-xs">Uploader EDL Sortie</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={showCautionModal}
        onClose={() => setShowCautionModal(false)}
        title="Encaissement de Caution"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCautionModal(false)}>Annuler</Button>
            <Button className="bg-emerald-600 text-white" onClick={handleCautionEncaissement} disabled={processing}>
              {processing ? 'Traitement...' : 'Confirmer l\'encaissement'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-center py-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <p className="text-slate-600">
            Confirmez-vous que la caution de <strong>{formatCurrency(bail.montant_caution)}</strong> a été reçue sur le compte séquestre ?
          </p>
          <p className="text-xs text-slate-400">
            Cette action générera une écriture comptable (Débit 512000 / Crédit 419).
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={showRestitutionModal}
        onClose={() => setShowRestitutionModal(false)}
        title="Restitution de Caution"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRestitutionModal(false)}>Annuler</Button>
            <Button className="bg-blue-600 text-white" onClick={handleCautionRestitution} disabled={processing}>
              {processing ? 'Traitement...' : 'Confirmer la restitution'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-center py-4">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <p className="text-slate-600">
            Confirmez-vous la restitution intégrale de la caution de <strong>{formatCurrency(bail.montant_caution)}</strong> au locataire ?
          </p>
          <p className="text-xs text-slate-400">
            Cette action générera une écriture comptable (Débit 419 / Crédit 512000).
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={showRetenueModal}
        onClose={() => setShowRetenueModal(false)}
        title="Retenue sur Caution"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRetenueModal(false)}>Annuler</Button>
            <Button className="bg-amber-600 text-white" onClick={handleCautionRetenue} disabled={processing}>
              {processing ? 'Traitement...' : 'Valider la retenue'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-sm">
            Caution totale : <strong>{formatCurrency(bail.montant_caution)}</strong>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Montant retenu (€)</label>
            <Input 
              type="number" 
              value={isNaN(retenueAmount) ? '' : retenueAmount} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setRetenueAmount(isNaN(val) ? 0 : val);
              }}
              max={bail.montant_caution}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Motif de la retenue</label>
            <textarea 
              className="w-full rounded-lg border-slate-200 text-sm p-3 h-24"
              placeholder="Description des dégâts ou impayés..."
              value={retenueMotif}
              onChange={(e) => setRetenueMotif(e.target.value)}
            />
          </div>
          <div className="p-3 bg-slate-900 text-white rounded-lg text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Montant restitué au locataire</p>
            <p className="text-xl font-black">{formatCurrency(bail.montant_caution - retenueAmount)}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
