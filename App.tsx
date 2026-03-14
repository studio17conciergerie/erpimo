/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import Dashboard from '@/pages/Dashboard';
import Owners from '@/pages/Owners';
import OwnerDetail from '@/features/owners/components/OwnerDetail';
import Properties from '@/pages/Properties';
import PropertyDetail from '@/features/properties/components/PropertyDetail';
import Reservations from '@/pages/Reservations';
import ReservationDetail from '@/features/reservations/components/ReservationDetail';
import Tenants from '@/pages/Tenants';
import LocataireDetail from '@/features/travelers/components/LocataireDetail';
import Suppliers from '@/pages/Suppliers';
import FournisseurDetail from '@/features/suppliers/components/FournisseurDetail';
import Bank from '@/pages/Bank';
import Interventions from '@/pages/Interventions';
import InterventionDetail from '@/features/interventions/components/InterventionDetail';
import Accounting from '@/pages/Accounting';
import SaisieEcritureComptable from '@/features/accounting/components/SaisieEcritureComptable';
import ConfigurationTiers from '@/pages/ConfigurationTiers';
import AgenceConfig from '@/features/configuration/components/AgenceConfig';
import OtaMapping from '@/features/configuration/components/OtaMapping';
import Reconciliation from '@/pages/Reconciliation';
import MtrList from '@/features/mtr/components/MtrList';
import MtrDetail from '@/features/mtr/components/MtrDetail';
import PieceComptableDetail from '@/features/accounting/components/PieceComptableDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="owners" element={<Owners />} />
          <Route path="owners/:id" element={<OwnerDetail />} />
          <Route path="properties" element={<Properties />} />
          <Route path="properties/:id" element={<PropertyDetail />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="reservations/:id" element={<ReservationDetail />} />
          <Route path="tenants" element={<Tenants />} />
          <Route path="tenants/:id" element={<LocataireDetail />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<FournisseurDetail />} />
          <Route path="bank" element={<Bank />} />
          <Route path="interventions" element={<Interventions />} />
          <Route path="interventions/:id" element={<InterventionDetail />} />
          <Route path="accounting" element={<Navigate to="/accounting/mandant" replace />} />
          <Route path="accounting/mandant" element={<Accounting tab="mandant" />} />
          <Route path="accounting/agence" element={<Accounting tab="agence" />} />
          <Route path="accounting/grand-livre" element={<Accounting tab="grand-livre" />} />
          <Route path="accounting/balance" element={<Accounting tab="balance" />} />
          <Route path="accounting/journaux" element={<Accounting tab="journaux" />} />
          <Route path="accounting/od" element={<Accounting tab="od" />} />
          <Route path="accounting/transfert-honoraires" element={<Accounting tab="transfert-honoraires" />} />
          <Route path="accounting/od/nouvelle" element={<SaisieEcritureComptable />} />
          <Route path="accounting/od/:id" element={<SaisieEcritureComptable />} />
          <Route path="accounting/piece/edit/:id" element={<SaisieEcritureComptable />} />
          <Route path="accounting/piece/:id" element={<PieceComptableDetail />} />
          <Route path="mtr" element={<MtrList />} />
          <Route path="mtr/:id" element={<MtrDetail />} />
          <Route path="reconciliation" element={<Reconciliation />} />
          <Route path="configuration/tiers" element={<ConfigurationTiers />} />
          <Route path="configuration/agence" element={<AgenceConfig />} />
          <Route path="configuration/ota" element={<OtaMapping />} />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

