import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Label } from '@/components/Label';
import { Select } from '@/components/Select';
import { FinancialRules, propertyService } from '../propertyService';
import { AlertCircle } from 'lucide-react';

const financialRulesSchema = z.object({
  taux_commission_agence: z.number().min(0).max(100).optional().nullable(),
  fournisseur_menage_id: z.string().optional().nullable(),
  forfait_menage: z.number().min(0).optional().nullable(),
  forfait_assurance: z.number().min(0).optional().nullable(),
  taxe_sejour_par_nuit: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FinancialRulesFormValues = z.infer<typeof financialRulesSchema>;

interface FinancialRulesFormProps {
  logementId: string;
  rules?: FinancialRules;
  suppliers: { id: string; nom: string }[];
  onSuccess: () => void;
}

export function FinancialRulesForm({ logementId, rules, suppliers, onSuccess }: FinancialRulesFormProps) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FinancialRulesFormValues>({
    resolver: zodResolver(financialRulesSchema),
    defaultValues: {
      taux_commission_agence: rules?.taux_commission_agence ?? 20,
      fournisseur_menage_id: rules?.fournisseur_menage_id || '',
      forfait_menage: rules?.forfait_menage,
      forfait_assurance: rules?.forfait_assurance,
      taxe_sejour_par_nuit: rules?.taxe_sejour_par_nuit,
      notes: rules?.notes || '',
    },
  });

  const fournisseurMenageId = watch('fournisseur_menage_id');
  const forfaitMenage = watch('forfait_menage');

  const showMenageWarning = !!fournisseurMenageId && (forfaitMenage === null || forfaitMenage === undefined || forfaitMenage === 0);

  const onSubmit = async (data: FinancialRulesFormValues) => {
    try {
      // Convert empty strings to null for nullable fields if necessary, though react-hook-form handles number inputs well usually.
      // However, select inputs might return empty string.
      const cleanData = {
        ...data,
        fournisseur_menage_id: data.fournisseur_menage_id || null,
        logement_id: logementId,
      };
      
      await propertyService.upsertFinancialRules(cleanData);
      onSuccess();
    } catch (error) {
      console.error('Error saving financial rules:', error);
      alert('Erreur lors de la sauvegarde du Business Model');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Commission */}
        <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
          <h3 className="font-semibold text-slate-900">Commission Agence</h3>
          <div className="space-y-2">
            <Label htmlFor="taux_commission_agence">Taux de commission (%)</Label>
            <div className="flex items-center gap-4">
              <input 
                type="range" 
                min="0" 
                max="50" 
                step="0.5"
                className="w-full"
                {...register('taux_commission_agence', { valueAsNumber: true })}
              />
              <Input 
                id="taux_commission_agence" 
                type="number" 
                step="0.1"
                className="w-20 text-right"
                {...register('taux_commission_agence', { valueAsNumber: true })} 
              />
            </div>
          </div>
        </div>

        {/* Ménage */}
        <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
          <h3 className="font-semibold text-slate-900">Ménage</h3>
          <div className="space-y-2">
            <Label htmlFor="fournisseur_menage_id">Prestataire de ménage</Label>
            <Select id="fournisseur_menage_id" {...register('fournisseur_menage_id')}>
              <option value="">Aucun prestataire sélectionné</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="forfait_menage">Forfait Ménage (€)</Label>
            <Input 
              id="forfait_menage" 
              type="number" 
              step="0.01"
              {...register('forfait_menage', { valueAsNumber: true })} 
            />
          </div>
          {showMenageWarning && (
            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              <span>Attention : Prestataire sélectionné sans forfait associé.</span>
            </div>
          )}
        </div>

        {/* Autres Frais */}
        <div className="space-y-4 p-4 border rounded-lg bg-slate-50 md:col-span-2">
          <h3 className="font-semibold text-slate-900">Autres Paramètres</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="forfait_assurance">Forfait Assurance (€)</Label>
              <Input 
                id="forfait_assurance" 
                type="number" 
                step="0.01"
                {...register('forfait_assurance', { valueAsNumber: true })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxe_sejour_par_nuit">Taxe de séjour / nuit (€)</Label>
              <Input 
                id="taxe_sejour_par_nuit" 
                type="number" 
                step="0.01"
                {...register('taxe_sejour_par_nuit', { valueAsNumber: true })} 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes internes</Label>
            <textarea 
              id="notes"
              className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register('notes')}
            />
          </div>
        </div>

      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder le Business Model'}
        </Button>
      </div>
    </form>
  );
}
