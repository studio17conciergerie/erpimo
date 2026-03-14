import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Label } from '@/components/Label';
import { Select } from '@/components/Select';
import { Tiers, tiersService } from '../tiersService';

const tiersSchema = z.object({
  type_tiers: z.enum(['PROPRIETAIRE', 'LOCATAIRE', 'FOURNISSEUR', 'SYSTEME']),
  sous_type: z.enum(['OTA', 'MENAGE', 'MAINTENANCE', 'ASSURANCE', 'AUTRE']).optional().nullable(),
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal('')),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  code_postal: z.string().optional(),
  ville: z.string().optional(),
  code_auxiliaire: z.string().optional(), // Can be auto-generated or manual
  notes: z.string().optional(),
});

type TiersFormValues = z.infer<typeof tiersSchema>;

interface TiersFormProps {
  tiers?: Tiers;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TiersForm({ tiers, onSuccess, onCancel }: TiersFormProps) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<TiersFormValues>({
    resolver: zodResolver(tiersSchema),
    defaultValues: {
      type_tiers: tiers?.type_tiers || 'FOURNISSEUR',
      sous_type: tiers?.sous_type || 'AUTRE',
      nom: tiers?.nom || '',
      prenom: tiers?.prenom || '',
      email: tiers?.email || '',
      telephone: tiers?.telephone || '',
      adresse: tiers?.adresse || '',
      code_postal: tiers?.code_postal || '',
      ville: tiers?.ville || '',
      code_auxiliaire: tiers?.code_auxiliaire || '',
      notes: tiers?.notes || '',
    },
  });

  const typeTiers = watch('type_tiers');

  const onSubmit = async (data: TiersFormValues) => {
    try {
      // Clean up empty strings for optional fields
      const cleanData = {
        ...data,
        sous_type: data.sous_type || null,
        email: data.email || null,
      };

      if (tiers) {
        await tiersService.updateTiers(tiers.id, cleanData);
      } else {
        await tiersService.createTiers(cleanData);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving tiers:', error);
      alert('Erreur lors de la sauvegarde du tiers');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type_tiers">Type *</Label>
          <Select id="type_tiers" {...register('type_tiers')}>
            <option value="FOURNISSEUR">Fournisseur</option>
            <option value="PROPRIETAIRE">Propriétaire</option>
            <option value="LOCATAIRE">Locataire</option>
            <option value="SYSTEME">Système (Interne)</option>
          </Select>
        </div>

        {typeTiers === 'FOURNISSEUR' && (
          <div className="space-y-2">
            <Label htmlFor="sous_type">Sous-type</Label>
            <Select id="sous_type" {...register('sous_type')}>
              <option value="AUTRE">Autre</option>
              <option value="MENAGE">Ménage</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="ASSURANCE">Assurance</option>
              <option value="OTA">OTA (Airbnb, Booking...)</option>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="nom">Nom / Raison Sociale *</Label>
          <Input id="nom" {...register('nom')} placeholder="Ex: Entreprise Nettoyage" />
          {errors.nom && <p className="text-sm text-red-500">{errors.nom.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" {...register('prenom')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="telephone">Téléphone</Label>
          <Input id="telephone" {...register('telephone')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="code_auxiliaire">Code Auxiliaire (Optionnel)</Label>
          <Input id="code_auxiliaire" {...register('code_auxiliaire')} placeholder="Laisser vide pour auto-générer" />
          <p className="text-xs text-slate-500">Ex: 401NETT01. Si vide, sera généré automatiquement.</p>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-100">
        <Label htmlFor="adresse">Adresse</Label>
        <Input id="adresse" {...register('adresse')} />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Input id="code_postal" {...register('code_postal')} placeholder="Code Postal" />
          <Input id="ville" {...register('ville')} placeholder="Ville" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>
    </form>
  );
}
