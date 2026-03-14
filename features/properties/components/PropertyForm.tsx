import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Label } from '@/components/Label';
import { Select } from '@/components/Select';
import { Property, propertyService } from '../propertyService';

const propertySchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  proprietaire_id: z.string().min(1, "Le propriétaire est requis"),
  adresse: z.string().optional(),
  ville: z.string().optional(),
  code_postal: z.string().optional(),
  listing_id: z.string().optional(),
  nickname: z.string().optional(),
  type_bien: z.string().optional(),
  surface_m2: z.number().optional().nullable(),
  nb_chambres: z.number().int().optional().nullable(),
  statut: z.enum(['ACTIF', 'INACTIF', 'MAINTENANCE']),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

interface PropertyFormProps {
  property?: Property;
  owners: { id: string; nom: string; prenom: string | null }[];
  onSuccess: () => void;
}

export function PropertyForm({ property, owners, onSuccess }: PropertyFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      nom: property?.nom || '',
      proprietaire_id: property?.proprietaire_id || '',
      adresse: property?.adresse || '',
      ville: property?.ville || '',
      code_postal: property?.code_postal || '',
      listing_id: property?.listing_id || '',
      nickname: property?.nickname || '',
      type_bien: property?.type_bien || '',
      surface_m2: property?.surface_m2,
      nb_chambres: property?.nb_chambres,
      statut: property?.statut || 'ACTIF',
    },
  });

  const onSubmit = async (data: PropertyFormValues) => {
    try {
      if (property) {
        await propertyService.updateProperty(property.id, data);
      } else {
        await propertyService.createProperty(data);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving property:', error);
      alert('Erreur lors de la sauvegarde du logement');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nom">Nom du logement *</Label>
          <Input id="nom" {...register('nom')} placeholder="Ex: Appartement Tour Eiffel" />
          {errors.nom && <p className="text-sm text-red-500">{errors.nom.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nickname">Surnom (Interne)</Label>
          <Input id="nickname" {...register('nickname')} placeholder="Ex: T2-EIFFEL" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="proprietaire_id">Propriétaire *</Label>
          <Select id="proprietaire_id" {...register('proprietaire_id')}>
            <option value="">Sélectionner un propriétaire</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.nom} {owner.prenom}
              </option>
            ))}
          </Select>
          {errors.proprietaire_id && <p className="text-sm text-red-500">{errors.proprietaire_id.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="listing_id">Listing ID (Plateforme)</Label>
          <Input id="listing_id" {...register('listing_id')} placeholder="Ex: 12345678" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="adresse">Adresse</Label>
          <Input id="adresse" {...register('adresse')} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="code_postal">Code Postal</Label>
            <Input id="code_postal" {...register('code_postal')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ville">Ville</Label>
            <Input id="ville" {...register('ville')} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2">
            <Label htmlFor="type_bien">Type</Label>
            <Input id="type_bien" {...register('type_bien')} placeholder="Appartement" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="surface_m2">Surface (m²)</Label>
            <Input 
              id="surface_m2" 
              type="number" 
              step="0.01" 
              {...register('surface_m2', { valueAsNumber: true })} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nb_chambres">Chambres</Label>
            <Input 
              id="nb_chambres" 
              type="number" 
              {...register('nb_chambres', { valueAsNumber: true })} 
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="statut">Statut</Label>
          <Select id="statut" {...register('statut')}>
            <option value="ACTIF">Actif</option>
            <option value="INACTIF">Inactif</option>
            <option value="MAINTENANCE">Maintenance</option>
          </Select>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>
    </form>
  );
}
