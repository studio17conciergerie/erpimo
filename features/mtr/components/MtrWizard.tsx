import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { mtrService, TypeBailMtr, SourceBailMtr, MotifBailMtr } from '../mtrService';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Modal } from '@/components/Modal';
import { 
  Home, 
  User, 
  Calendar, 
  Euro, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  AlertTriangle, 
  Info, 
  Plus,
  AlertCircle
} from 'lucide-react';
import { format, differenceInDays, differenceInMonths, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const bailSchema = z.object({
  logement_id: z.string().min(1, "Logement requis"),
  locataire_id: z.string().min(1, "Locataire requis"),
  type_bail: z.enum(['MOBILITE', 'ETUDIANT', 'CIVIL']),
  source: z.enum(['DIRECT', 'AIRBNB']),
  motif_bail: z.string().nullable().optional(),
  motif_bail_detail: z.string().nullable().optional(),
  date_debut: z.string().min(1, "Date de début requise"),
  date_fin: z.string().min(1, "Date de fin requise"),
  jour_exigibilite: z.number().min(1).max(28),
  loyer_hc: z.number().min(1, "Loyer requis"),
  provision_charges: z.number().default(0),
  montant_caution: z.number().default(0),
  frais_agence_locataire: z.number().default(0),
  meuble: z.boolean().default(true),
  notes: z.string().nullable().optional(),
}).refine((data) => {
  if (data.type_bail === 'MOBILITE' && !data.motif_bail) return false;
  return true;
}, { message: "Motif requis pour un bail mobilité", path: ["motif_bail"] })
.refine((data) => {
    if (data.type_bail === 'MOBILITE' && data.montant_caution > 0) return false;
    return true;
}, { message: "Pas de caution pour un bail mobilité", path: ["montant_caution"] });

interface MtrWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MtrWizard({ onSuccess, onCancel }: MtrWizardProps) {
  const [step, setStep] = useState(1);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const { control, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm({
    resolver: zodResolver(bailSchema),
    defaultValues: {
      type_bail: 'MOBILITE' as TypeBailMtr,
      source: 'DIRECT' as SourceBailMtr,
      jour_exigibilite: 1,
      loyer_hc: 0,
      provision_charges: 0,
      montant_caution: 0,
      frais_agence_locataire: 0,
      meuble: true
    }
  });

  const watchedValues = watch();
  const typeBail = watch('type_bail');
  const source = watch('source');
  const dateDebut = watch('date_debut');
  const dateFin = watch('date_fin');
  const logementId = watch('logement_id');
  const locataireId = watch('locataire_id');
  const loyerHc = watch('loyer_hc');
  const provisionCharges = watch('provision_charges');

  useEffect(() => {
    loadInitialData();
  }, []);

  // Update caution suggestion when rent or type changes
  useEffect(() => {
    if (typeBail === 'MOBILITE') {
      setValue('montant_caution', 0);
    } else if (loyerHc > 0) {
      setValue('montant_caution', loyerHc + provisionCharges);
    }
  }, [typeBail, loyerHc, provisionCharges]);

  // Check conflicts when dates or property changes
  useEffect(() => {
    if (logementId && dateDebut && dateFin) {
      checkOverlaps();
    }
  }, [logementId, dateDebut, dateFin]);

  const loadInitialData = async () => {
    try {
      const [p, t] = await Promise.all([
        mtrService.getActiveProperties(),
        mtrService.getTenants()
      ]);
      setProperties(p);
      setTenants(t);
    } catch (error) {
      console.error('Error loading wizard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkOverlaps = async () => {
    setCheckingConflicts(true);
    try {
      const overlaps = await mtrService.checkConflicts(logementId, dateDebut, dateFin);
      setConflicts(overlaps);
    } catch (error) {
      console.error('Error checking overlaps:', error);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) fieldsToValidate = ['logement_id', 'locataire_id'];
    if (step === 2) fieldsToValidate = ['type_bail', 'source', 'date_debut', 'date_fin', 'motif_bail'];
    if (step === 3) fieldsToValidate = ['loyer_hc', 'provision_charges', 'montant_caution'];

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
        if (step === 2 && typeBail === 'MOBILITE') {
            const start = new Date(dateDebut);
            const end = new Date(dateFin);
            const months = differenceInMonths(end, start);
            if (months > 10) {
                alert("Un bail mobilité ne peut pas excéder 10 mois.");
                return;
            }
        }
        setStep(step + 1);
    }
  };

  const prevStep = () => setStep(step - 1);

  const onSubmit = async (data: any, status: 'BROUILLON' | 'ACTIF') => {
    try {
      setLoading(true);
      const payload = {
        ...data,
        statut: status,
        date_signature: status === 'ACTIF' ? new Date().toISOString().split('T')[0] : null,
        statut_caution: data.type_bail === 'MOBILITE' ? 'NON_APPLICABLE' : 'NON_VERSEE'
      };
      await mtrService.createBail(payload);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating bail:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = () => {
    if (!dateDebut || !dateFin) return null;
    const start = new Date(dateDebut);
    const end = new Date(dateFin);
    const days = differenceInDays(end, start);
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return `${months} mois et ${remainingDays} jours`;
  };

  const selectedLogement = properties.find(p => p.id === logementId);
  const selectedLocataire = tenants.find(t => t.id === locataireId);

  if (loading && step === 1) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 px-4">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors",
              step === s ? "bg-slate-900 text-white" : 
              step > s ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
            )}>
              {step > s ? <CheckCircle2 className="w-6 h-6" /> : s}
            </div>
            {s < 4 && (
              <div className={cn(
                "h-1 flex-1 mx-2 rounded",
                step > s ? "bg-emerald-500" : "bg-slate-100"
              )} />
            )}
          </div>
        ))}
      </div>

      <Card className="border-slate-200 shadow-xl overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100">
          <CardTitle className="text-xl flex items-center gap-2">
            {step === 1 && <><Home className="w-5 h-5" /> Logement & Locataire</>}
            {step === 2 && <><Calendar className="w-5 h-5" /> Type & Modalités</>}
            {step === 3 && <><Euro className="w-5 h-5" /> Conditions Financières</>}
            {step === 4 && <><CheckCircle2 className="w-5 h-5" /> Récapitulatif & Validation</>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          
          {/* STEP 1: LOGEMENT & LOCATAIRE */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Logement</label>
                <Controller
                  name="logement_id"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} value={field.value ?? ''}>
                      <option value="">Sélectionner un logement...</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.nom} (Proprio: {p.proprietaire?.nom})</option>
                      ))}
                    </Select>
                  )}
                />
                {errors.logement_id && <p className="text-xs text-red-500">{errors.logement_id.message as string}</p>}
                
                {logementId && !selectedLogement?.mandat_id && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg text-xs border border-amber-100">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Aucun mandat de gestion actif pour ce logement. Le bail peut être créé mais la commission ne sera pas calculée.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700">Locataire</label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="text-blue-600 h-7 px-2"
                    onClick={() => setShowTenantModal(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Créer un locataire
                  </Button>
                </div>
                <Controller
                  name="locataire_id"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} value={field.value ?? ''}>
                      <option value="">Sélectionner un locataire...</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.nom} {t.prenom} ({t.code_auxiliaire})</option>
                      ))}
                    </Select>
                  )}
                />
                {errors.locataire_id && <p className="text-xs text-red-500">{errors.locataire_id.message as string}</p>}

                {selectedLocataire?.is_blacklisted && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-100">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Ce locataire est blacklisté !
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: TYPE & MODALITÉS */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'MOBILITE', label: 'MOBILITÉ', desc: '10 mois max, sans caution, meublé obligatoire' },
                  { id: 'ETUDIANT', label: 'ÉTUDIANT', desc: '9 mois, rentrée universitaire' },
                  { id: 'CIVIL', label: 'CIVIL', desc: '1 an renouvelable' }
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setValue('type_bail', type.id as TypeBailMtr)}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      typeBail === type.id ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className="font-bold text-slate-900">{type.label}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{type.desc}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-bold text-slate-700">Source</label>
                  <div className="flex gap-2">
                    {['DIRECT', 'AIRBNB'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setValue('source', s as SourceBailMtr)}
                        className={cn(
                          "flex-1 py-2 rounded-lg border font-medium text-sm",
                          source === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {source === 'AIRBNB' && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded-lg text-[10px] border border-blue-100">
                      <Info className="w-3 h-3" />
                      Les encaissements seront gérés via les payouts Airbnb.
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Jour d'exigibilité</label>
                  <Controller
                    name="jour_exigibilite"
                    control={control}
                    render={({ field }) => (
                      <Select 
                        {...field} 
                        value={field.value ?? 1}
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          field.onChange(isNaN(val) ? 1 : val);
                        }}
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date de début</label>
                  <Controller
                    name="date_debut"
                    control={control}
                    render={({ field }) => <Input type="date" {...field} value={field.value ?? ''} />}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date de fin</label>
                  <Controller
                    name="date_fin"
                    control={control}
                    render={({ field }) => <Input type="date" {...field} value={field.value ?? ''} />}
                  />
                </div>
              </div>

              {dateDebut && dateFin && (
                <div className="p-3 bg-slate-50 rounded-lg text-center font-medium text-slate-700 border border-slate-100">
                  Durée : {calculateDuration()}
                </div>
              )}

              {typeBail !== 'CIVIL' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Motif du bail</label>
                  <Controller
                    name="motif_bail"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} value={field.value || ''}>
                        <option value="">Sélectionner un motif...</option>
                        <option value="FORMATION_PROFESSIONNELLE">Formation Professionnelle</option>
                        <option value="ETUDES_SUPERIEURES">Études Supérieures</option>
                        <option value="STAGE">Stage</option>
                        <option value="MUTATION_PROFESSIONNELLE">Mutation Professionnelle</option>
                        <option value="MISSION_TEMPORAIRE">Mission Temporaire</option>
                        <option value="SERVICE_CIVIQUE">Service Civique</option>
                        <option value="AUTRE">Autre</option>
                      </Select>
                    )}
                  />
                  {errors.motif_bail && <p className="text-xs text-red-500">{errors.motif_bail.message as string}</p>}
                </div>
              )}

              {conflicts.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Conflits détectés avec des réservations courtes durées
                  </div>
                  <ul className="text-xs text-red-600 list-disc pl-5">
                    {conflicts.map(c => (
                      <li key={c.id}>{c.guest_name} ({format(new Date(c.check_in), 'dd/MM')} au {format(new Date(c.check_out), 'dd/MM')})</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: CONDITIONS FINANCIÈRES */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Loyer Hors Charges (€)</label>
                  <Controller
                    name="loyer_hc"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        type="number" 
                        {...field} 
                        value={isNaN(field.value) ? '' : field.value}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          field.onChange(isNaN(val) ? 0 : val);
                        }} 
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Provision sur Charges (€)</label>
                  <Controller
                    name="provision_charges"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        type="number" 
                        {...field} 
                        value={isNaN(field.value) ? '' : field.value}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          field.onChange(isNaN(val) ? 0 : val);
                        }} 
                      />
                    )}
                  />
                </div>
              </div>

              <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-2xl text-center">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Loyer Charges Comprises</p>
                <p className="text-4xl font-black text-blue-900">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(loyerHc + provisionCharges)}
                  <span className="text-sm font-normal text-blue-500 ml-2">/ mois</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Dépôt de Garantie (Caution) (€)</label>
                  <Controller
                    name="montant_caution"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        type="number" 
                        {...field} 
                        value={isNaN(field.value) ? '' : field.value}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          field.onChange(isNaN(val) ? 0 : val);
                        }}
                        disabled={typeBail === 'MOBILITE'}
                        placeholder={typeBail === 'MOBILITE' ? 'Non applicable' : ''}
                      />
                    )}
                  />
                  {typeBail === 'MOBILITE' && <p className="text-[10px] text-slate-400 italic">(Non applicable pour un bail mobilité)</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Honoraires Locataire (€)</label>
                  <Controller
                    name="frais_agence_locataire"
                    control={control}
                    render={({ field }) => (
                      <Input 
                        type="number" 
                        {...field} 
                        value={isNaN(field.value) ? '' : field.value}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          field.onChange(isNaN(val) ? 0 : val);
                        }} 
                      />
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: RÉCAPITULATIF */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-2">Récapitulatif du Bail</h4>
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <span className="text-slate-500">Logement :</span>
                  <span className="font-bold text-slate-900">{selectedLogement?.nom} (Proprio: {selectedLogement?.proprietaire?.nom})</span>
                  
                  <span className="text-slate-500">Locataire :</span>
                  <span className="font-bold text-slate-900">{selectedLocataire?.nom} {selectedLocataire?.prenom} ({selectedLocataire?.code_auxiliaire})</span>
                  
                  <span className="text-slate-500">Type :</span>
                  <span className="font-bold text-slate-900">{typeBail} | Source: {source}</span>
                  
                  <span className="text-slate-500">Période :</span>
                  <span className="font-bold text-slate-900">
                    {format(new Date(dateDebut), 'dd/MM/yyyy')} au {format(new Date(dateFin), 'dd/MM/yyyy')} ({calculateDuration()})
                  </span>
                  
                  <span className="text-slate-500">Exigibilité :</span>
                  <span className="font-bold text-slate-900">{watchedValues.jour_exigibilite} du mois</span>
                </div>
              </div>

              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                <h4 className="font-bold text-blue-900 border-b border-blue-200 pb-2">Détail Financier</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Loyer HC :</span>
                    <span className="font-mono font-bold">{loyerHc.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Charges :</span>
                    <span className="font-mono font-bold">{provisionCharges.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-lg font-black border-t border-blue-200 pt-2">
                    <span className="text-blue-900">Loyer CC :</span>
                    <span className="text-blue-900">{(loyerHc + provisionCharges).toFixed(2)} € / mois</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2">
                    <span className="text-blue-700">Caution :</span>
                    <span className="font-mono font-bold">{watchedValues.montant_caution.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Honoraires :</span>
                    <span className="font-mono font-bold">{watchedValues.frais_agence_locataire.toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Total à la signature</p>
                  <p className="text-2xl font-black text-emerald-700">
                    {(loyerHc + provisionCharges + watchedValues.montant_caution + watchedValues.frais_agence_locataire).toFixed(2)} €
                  </p>
                </div>
                <div className="p-4 bg-slate-900 text-white rounded-xl text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loyer Mensuel Récurrent</p>
                  <p className="text-2xl font-black text-white">
                    {(loyerHc + provisionCharges).toFixed(2)} €
                  </p>
                </div>
              </div>
            </div>
          )}

        </CardContent>
        <CardFooter className="bg-slate-50 border-t border-slate-100 p-4 flex justify-between">
          <Button variant="ghost" onClick={step === 1 ? onCancel : prevStep}>
            {step === 1 ? 'Annuler' : <><ChevronLeft className="w-4 h-4 mr-2" /> Précédent</>}
          </Button>
          
          {step < 4 ? (
            <Button onClick={nextStep}>
              Suivant <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSubmit((d) => onSubmit(d, 'BROUILLON'))} disabled={loading}>
                Créer en brouillon
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmit((d) => onSubmit(d, 'ACTIF'))} disabled={loading}>
                Créer et activer
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Quick Tenant Modal */}
      <Modal
        isOpen={showTenantModal}
        onClose={() => setShowTenantModal(false)}
        title="Nouveau Locataire"
        maxWidth="max-w-md"
      >
        <QuickTenantForm 
          onSuccess={(newTenant) => {
            setTenants([...tenants, newTenant]);
            setValue('locataire_id', newTenant.id);
            setShowTenantModal(false);
          }} 
        />
      </Modal>
    </div>
  );
}

function QuickTenantForm({ onSuccess }: { onSuccess: (t: any) => void }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const newTenant = await mtrService.createQuickTenant(data);
      onSuccess(newTenant);
    } catch (error) {
      console.error('Error creating tenant:', error);
      alert('Erreur lors de la création du locataire');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Nom</label>
          <Input {...register('nom', { required: true })} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Prénom</label>
          <Input {...register('prenom', { required: true })} />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">Email</label>
        <Input type="email" {...register('email', { required: true })} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">Téléphone</label>
        <Input {...register('telephone', { required: true })} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Création...' : 'Créer le locataire'}
      </Button>
    </form>
  );
}

function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-6 pt-0", className)}>{children}</div>;
}
