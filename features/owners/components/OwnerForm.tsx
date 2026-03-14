import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Label } from '@/components/Label';
import { Owner, ownerService } from '../ownerService';

const ownerSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal('')),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  code_postal: z.string().optional(),
  ville: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  notes: z.string().optional(),
});

type OwnerFormValues = z.infer<typeof ownerSchema>;

interface OwnerFormProps {
  owner?: Owner;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function OwnerForm({ owner, onSuccess, onCancel }: OwnerFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OwnerFormValues>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
      nom: owner?.nom || '',
      prenom: owner?.prenom || '',
      email: owner?.email || '',
      telephone: owner?.telephone || '',
      adresse: owner?.adresse || '',
      code_postal: owner?.code_postal || '',
      ville: owner?.ville || '',
      iban: owner?.iban || '',
      bic: owner?.bic || '',
      notes: owner?.notes || '',
    },
  });

  const onSubmit = async (data: OwnerFormValues) => {
    try {
      if (owner) {
        await ownerService.updateOwner(owner.id, data);
      } else {
        await ownerService.createOwner(data);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving owner:', error);
      alert('Erreur lors de la sauvegarde du propriétaire');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nom">Nom *</Label>
          <Input id="nom" {...register('nom')} placeholder="DUPONT" />
          {errors.nom && <p className="text-sm text-red-500">{errors.nom.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" {...register('prenom')} placeholder="Jean" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} placeholder="jean.dupont@email.com" />
          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="telephone">Téléphone</Label>
          <Input id="telephone" {...register('telephone')} placeholder="06 12 34 56 78" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="adresse">Adresse</Label>
          <Input id="adresse" {...register('adresse')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="code_postal">Code Postal</Label>
          <Input id="code_postal" {...register('code_postal')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ville">Ville</Label>
          <Input id="ville" {...register('ville')} />
        </div>

        <div className="space-y-2 md:col-span-2 pt-4 border-t border-slate-100">
          <h3 className="font-medium text-slate-900 mb-2">Coordonnées Bancaires</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input id="iban" {...register('iban')} placeholder="FR76 ..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bic">BIC</Label>
              <Input id="bic" {...register('bic')} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>
    </form>
  );
}
