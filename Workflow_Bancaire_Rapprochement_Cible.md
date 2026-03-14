# Workflow Bancaire, Encaissements & Rapprochement
## Analyse de l'existant et Architecture Cible pour Primo-ERP

---

## 1. Diagnostic du Workflow Actuel

### 1.1 Le flux actuel en 3 étapes

```
ÉTAPE 1 — Import CSV Banque (fn_import_and_post_bank_movements)
┌──────────────────────────────────────────────────────────┐
│  Pour chaque ligne du relevé bancaire :                  │
│                                                          │
│  Encaissement (+) :  Débit 512  / Crédit 471             │
│  Décaissement (-) :  Débit 471  / Crédit 512             │
│                                                          │
│  → Crée 1 pièce BQ + 1 écriture par mouvement           │
│  → Le mouvement bancaire est stocké (est_rapproche=false)│
└──────────────────────────────────────────────────────────┘
                          ↓
ÉTAPE 2 — Rapprochement Manuel (RapprochementBancaire.tsx)
┌──────────────────────────────────────────────────────────┐
│  L'utilisateur sélectionne :                             │
│   • 1 mouvement bancaire (colonne gauche)                │
│   • N réservations OU N factures (colonne droite)        │
│                                                          │
│  Contrainte : onglet actif = réservations OU factures    │
│  → On ne peut PAS mixer les deux dans un rapprochement   │
│  → Écart doit être < 0.01€ pour valider                  │
└──────────────────────────────────────────────────────────┘
                          ↓
ÉTAPE 3 — Validation (validate_bank_reconciliation RPC)
┌──────────────────────────────────────────────────────────┐
│  Pour les réservations :                                 │
│    Débit 471 / Crédit 411  (solde l'attente)             │
│    + lettrage croisé avec l'écriture de vente initiale   │
│    + reservation.statut_workflow = 'ENCAISSE'            │
│                                                          │
│  Pour les factures :                                     │
│    Débit 401 / Crédit 471  (solde l'attente)             │
│    + lettrage de l'écriture fournisseur initiale         │
│                                                          │
│  Puis : mouvement_bancaire.est_rapproche = true          │
│  Et : lettrage de l'écriture 512/471 de l'import         │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Les 7 types de mouvements bancaires non couverts

Le rapprochement ne gère aujourd'hui que 2 cas sur 9 possibles sur le compte séquestre :

| # | Type de mouvement | Sens | Couvert ? | Problème |
|---|-------------------|------|-----------|----------|
| 1 | Encaissement payout OTA (Airbnb, Booking) | + | ✅ Oui | Via onglet "Réservations" |
| 2 | Paiement fournisseur (ménage, maintenance) | − | ✅ Partiel | Via onglet "Factures" (seulement 401) |
| 3 | **Virement reddition propriétaire** | − | ❌ Non | Le `validate_disbursement` crée `Débit 404 / Crédit 512` mais ce décaissement n'est jamais rapprochable depuis l'interface |
| 4 | **Transfert honoraires séquestre → fonctionnement** | − | ❌ Non | `markAsTransferred` dans agencyRevenueService insère directement dans journal_ecritures sans pièce comptable et sans lien mouvement bancaire |
| 5 | **Encaissement caution locataire** | + | ❌ Non | `mtrService.recordCautionAccounting` crée `Débit 512000 / Crédit 419000` mais sans mouvement bancaire associé |
| 6 | **Restitution caution locataire** | − | ❌ Non | `recordCautionAccounting('RESTITUTION')` crée `Débit 419000 / Crédit 512000` sans rapprochement |
| 7 | **Frais bancaires** | − | ❌ Non | Aucun mécanisme |
| 8 | **Encaissement direct (hors OTA)** | + | ❌ Non | Pas de flux de paiement direct voyageur |
| 9 | **Régularisation / écart** | ± | ❌ Non | Pas de mécanisme d'écart de rapprochement |

### 1.3 Pourquoi le workflow actuel ne fonctionne pas

**Le problème fondamental** : le système traite l'import bancaire et la comptabilité comme deux mondes séparés qui se rejoignent uniquement au rapprochement. Mais en réalité :

1. La reddition crée une écriture `Débit 404 / Crédit 512` **au moment de la validation du décaissement**, pas au moment où la banque débite réellement le compte. Le mouvement bancaire correspondant arrivera plus tard dans l'import CSV, et il n'y a aucun moyen de le relier.

2. Les cautions créent des écritures `512000 ↔ 419000` instantanément lors du clic utilisateur, mais le mouvement bancaire réel (réception ou émission du virement) n'est jamais importé ni rapproché.

3. Le transfert d'honoraires `512000 → 512100` est une écriture "fantôme" sans pièce comptable et sans mouvement bancaire.

**En résumé** : il y a des écritures comptables qui touchent le 512 sans mouvement bancaire en face, et des mouvements bancaires qui n'ont pas de contrepartie comptable correcte. Le solde comptable du 512 et le solde bancaire réel divergent inévitablement, et rien ne permet de les réconcilier.

---

## 2. Architecture Cible : Le Workflow Idéal

### 2.1 Principe directeur

> **Règle d'or** : Aucune écriture ne doit toucher un compte 512 en dehors du journal de banque (BQ), et toute écriture du journal BQ doit être rapprochable avec un mouvement bancaire réel.

Cela signifie :

- L'import bancaire ne génère **plus** d'écritures comptables automatiques
- Les écritures 512 sont créées **uniquement** au moment du rapprochement
- Les opérations internes (reddition, caution, honoraires) créent des **écritures d'engagement** sur des comptes de tiers, et c'est le rapprochement bancaire qui crée l'écriture 512

### 2.2 Nouvelle table `mouvements_bancaires`

```sql
CREATE TABLE mouvements_bancaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Identification
    compte_banque TEXT NOT NULL DEFAULT '512000',  -- NOUVEAU : 512000 ou 512100
    date_operation DATE NOT NULL,
    date_valeur DATE,                               -- NOUVEAU : date de valeur
    libelle_banque TEXT NOT NULL,
    reference_banque TEXT,                           -- NOUVEAU : ref du relevé
    montant NUMERIC(12,2) NOT NULL,
    hash_unique TEXT UNIQUE,
    
    -- Rapprochement
    est_rapproche BOOLEAN DEFAULT FALSE,
    type_rapprochement TEXT,                         -- NOUVEAU : voir 2.3
    date_rapprochement TIMESTAMP,                    -- NOUVEAU
    piece_comptable_id UUID REFERENCES pieces_comptables(id), -- NOUVEAU : lien direct
    
    -- Métadonnées
    import_batch_id UUID,                            -- NOUVEAU : traçabilité import
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.3 Les 7 types de rapprochement

Le nouveau champ `type_rapprochement` catégorise chaque pointage :

```
┌─────────────────────────────────────────────────────────────┐
│              TYPES DE RAPPROCHEMENT                         │
├──────────────────┬──────────────────────────────────────────┤
│ ENCAISSEMENT_OTA │ Payout Airbnb/Booking → Réservation(s)  │
│ ENCAISSEMENT_DIR │ Paiement direct voyageur → Réservation  │
│ PAIEMENT_FOURNR  │ Paiement fournisseur → Facture(s) 401   │
│ REDDITION_PROPRIO│ Virement propriétaire → Relevé gestion  │
│ TRANSFERT_HONOR  │ Séquestre → Fonctionnement (honoraires) │
│ CAUTION_ENCAISS  │ Réception caution → Bail/MTR 419        │
│ CAUTION_RESTIT   │ Restitution caution → Bail/MTR 419      │
│ FRAIS_BANCAIRES  │ Frais/agios → Compte 627                │
│ DIVERS           │ Mouvement non catégorisé → OD/471       │
└──────────────────┴──────────────────────────────────────────┘
```

### 2.4 Le nouveau workflow en 2 phases

```
═══════════════════════════════════════════════════════════════
  PHASE 1 — IMPORT (Stockage pur, aucune écriture comptable)
═══════════════════════════════════════════════════════════════

  CSV Banque → Parser → mouvements_bancaires
  
  • Sélecteur de compte : "512000 Séquestre" ou "512100 Fonctionnement"
  • Dédoublonnage par hash_unique
  • Aucune écriture comptable générée
  • Calcul du solde bancaire importé (pour contrôle)


═══════════════════════════════════════════════════════════════
  PHASE 2 — RAPPROCHEMENT (Génère les écritures 512)
═══════════════════════════════════════════════════════════════

  L'interface affiche les mouvements non rapprochés à gauche,
  et à droite, TOUS les éléments comptables pointables,
  organisés par catégorie :
  
  ┌──────────────────────┐    ┌────────────────────────────┐
  │  BANQUE (gauche)     │    │  COMPTA (droite)           │
  │                      │    │                            │
  │  [+] 1 250.00 €      │    │  ▸ Réservations (411)     │
  │  AIRBNB PAYOUT       │◄──►│  ▸ Redditions (404)       │
  │  15/02/2026          │    │  ▸ Fournisseurs (401)     │
  │                      │    │  ▸ Cautions (419)         │
  │  [-] 850.00 €        │    │  ▸ Transferts Honoraires  │
  │  VIREMENT DUPONT     │    │  ▸ Frais & Divers         │
  │  16/02/2026          │    │                            │
  │                      │    │  [Sélection multiple]      │
  │  [-] 45.00 €         │    │  [Tous types mixables]     │
  │  FRAIS TENUE CPTE    │    │                            │
  └──────────────────────┘    └────────────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  BARRE DE CONTRÔLE  │
         │                     │
         │  Banque : -850.00€  │
         │  Compta :  850.00€  │
         │  Écart  :    0.00€  │
         │                     │
         │  [VALIDER]          │
         └─────────────────────┘
```

---

## 3. Écritures Générées par Type de Rapprochement

### 3.1 Encaissement Payout OTA

Mouvement bancaire : `+1 250.00` (AIRBNB PAYOUT)
Rapproché avec : Réservation #ABC123 (payout_net = 1 250.00)

```
Journal BQ — Pièce BQ-2602-0042
────────────────────────────────────────────────────────────
Encaissement Airbnb ABC123 - Jean Dupont
  Débit  512000  Banque Séquestre      1 250.00
  Crédit 411     Client/OTA            1 250.00
────────────────────────────────────────────────────────────
Lettrage : LET-20260215-001
→ Lettre aussi l'écriture de vente initiale (JR) Débit 411
→ reservation.statut_workflow = 'ENCAISSE'
```

### 3.2 Virement Reddition Propriétaire

Mouvement bancaire : `-3 200.00` (VIREMENT MARTIN LOYERS)
Rapproché avec : Relevé de gestion #RG-2602 du propriétaire Martin

```
Journal BQ — Pièce BQ-2602-0043
────────────────────────────────────────────────────────────
Virement Reddition Martin - Février 2026
  Débit  404MAR01  Propriétaire Martin  3 200.00
  Crédit 512000    Banque Séquestre     3 200.00
────────────────────────────────────────────────────────────
Lettrage : LET-20260218-002
→ Lettre l'écriture d'engagement de reddition (journal EX)
→ releve_gestion.est_rapproche = true
```

**Changement clé** : Aujourd'hui `validate_disbursement` crée l'écriture `Débit 404 / Crédit 512` au moment de la validation. Demain, elle ne créera qu'une écriture d'**engagement** `Débit 404 / Crédit 467` (créditeurs divers), et c'est le rapprochement bancaire qui la transforme en écriture de banque.

**Alternative pragmatique** : Si on veut garder l'écriture directe au 512 lors de la reddition (car c'est le moment où on initie le virement SEPA), alors le rapprochement ne crée pas de nouvelle écriture mais vient **pointer** l'écriture existante. C'est plus simple mais moins pur comptablement. Voir section 4 pour la recommandation.

### 3.3 Transfert Honoraires Agence (Séquestre → Fonctionnement)

Mouvement sur le compte séquestre : `-2 500.00` (VIR INTERNE)
Mouvement miroir sur le compte fonctionnement : `+2 500.00` (VIR INTERNE)

```
Journal BQ — Pièce BQ-2602-0044
────────────────────────────────────────────────────────────
Transfert Honoraires Février 2026
  Débit  512100  Banque Fonctionnement  2 500.00
  Crédit 512000  Banque Séquestre       2 500.00
────────────────────────────────────────────────────────────
→ Rapproche les 2 mouvements (un sur chaque compte)
→ Les deux mouvements sont marqués est_rapproche = true
```

**Changement clé** : Aujourd'hui `markAsTransferred` insère directement dans `journal_ecritures` sans pièce comptable (cassé). Demain, c'est le rapprochement bancaire qui crée cette pièce proprement.

### 3.4 Encaissement Caution Locataire

Mouvement bancaire : `+1 200.00` (VIREMENT LEROY CAUTION)
Rapproché avec : Bail MTR #B-042 (montant_caution = 1 200.00)

```
Journal BQ — Pièce BQ-2602-0045
────────────────────────────────────────────────────────────
Encaissement Caution Leroy - Apt Montmartre
  Débit  512000  Banque Séquestre      1 200.00
  Crédit 419000  Cautions Reçues       1 200.00
────────────────────────────────────────────────────────────
→ bail.statut_caution = 'ENCAISSEE'
→ bail.date_encaissement_caution = date_operation
```

**Changement clé** : Aujourd'hui `recordCautionAccounting('ENCAISSEMENT')` crée l'écriture `Débit 512000 / Crédit 419000` au clic de l'utilisateur. Demain, le clic utilisateur crée une **écriture d'attente** (ou change simplement le statut), et c'est le rapprochement qui confirme l'encaissement réel.

### 3.5 Restitution Caution Locataire

Mouvement bancaire : `-1 000.00` (VIR LEROY RESTIT CAUTION)
Rapproché avec : Bail MTR #B-042 (restitution partielle, 200€ retenus)

```
Journal BQ — Pièce BQ-2602-0046
────────────────────────────────────────────────────────────
Restitution Caution Leroy (partielle)
  Débit  419000  Cautions Reçues       1 000.00
  Crédit 512000  Banque Séquestre      1 000.00
────────────────────────────────────────────────────────────

Journal OD — Pièce OD-2602-0012 (si retenue)
────────────────────────────────────────────────────────────
Retenue Caution Leroy - Dégâts salle de bain
  Débit  419000  Cautions Reçues         200.00
  Crédit 404xxx  Propriétaire              200.00
────────────────────────────────────────────────────────────
```

### 3.6 Paiement Fournisseur

Mouvement bancaire : `-350.00` (CLEAN & CO MENAGE)
Rapproché avec : Facture fournisseur #F-2602-003

```
Journal BQ — Pièce BQ-2602-0047
────────────────────────────────────────────────────────────
Paiement Clean & Co - Ménage Février
  Débit  401CLE01  Fournisseur Clean    350.00
  Crédit 512000    Banque Séquestre     350.00
────────────────────────────────────────────────────────────
Lettrage : LET-20260220-003
→ Lettre l'écriture de charge initiale (JR ou OD)
```

### 3.7 Frais Bancaires

Mouvement bancaire : `-12.50` (FRAIS TENUE DE COMPTE)
Rapproché avec : rien (saisie directe)

```
Journal BQ — Pièce BQ-2602-0048
────────────────────────────────────────────────────────────
Frais bancaires Février 2026
  Débit  627000  Frais bancaires        12.50
  Crédit 512000  Banque Séquestre       12.50
────────────────────────────────────────────────────────────
→ Pas de lettrage (charge directe)
```

---

## 4. Architecture Technique Recommandée

### 4.1 Choix d'architecture : Pointage vs Double écriture

Deux approches sont possibles pour les redditions et cautions :

**Option A — "Engagement puis pointage"** (recommandée)

```
Moment de la reddition :
  Débit 404-[Proprio] / Crédit 467  (engagement, dette à payer)
  
Moment du rapprochement bancaire :
  Débit 467 / Crédit 512000          (solde l'engagement)
  + lettrage croisé des deux écritures
```

Avantages : pur comptablement, le 512 n'est mouvementé que par la banque réelle, le 467 sert de pont entre la décision et le flux bancaire.

**Option B — "Écriture directe + pointage"** (pragmatique)

```
Moment de la reddition :
  Débit 404-[Proprio] / Crédit 512000  (comme aujourd'hui)
  
Moment du rapprochement bancaire :
  Pas de nouvelle écriture, on "pointe" l'écriture existante
  mouvement_bancaire.piece_comptable_id = pièce de reddition
  mouvement_bancaire.est_rapproche = true
```

Avantages : plus simple, moins d'écritures, le solde 512 est correct en temps réel.

**Recommandation** : **Option B** pour les redditions (le SEPA est initié par l'agence donc le timing est maîtrisé), **Option A** pour les cautions (le timing du virement locataire n'est pas maîtrisé).

### 4.2 Nouveau `fn_import_bank_movements` (simplifié)

```sql
CREATE OR REPLACE FUNCTION fn_import_bank_movements(
    p_movements JSONB,
    p_compte_banque TEXT DEFAULT '512000'  -- NOUVEAU
) RETURNS INTEGER AS $$
DECLARE
    v_mov RECORD;
    v_count INTEGER := 0;
    v_batch_id UUID := uuid_generate_v4();
BEGIN
    FOR v_mov IN SELECT * FROM jsonb_to_recordset(p_movements) AS x(
        date_operation DATE,
        date_valeur DATE,
        libelle_banque TEXT,
        montant NUMERIC,
        hash_unique TEXT,
        reference_banque TEXT
    ) LOOP
        INSERT INTO mouvements_bancaires (
            compte_banque,
            date_operation,
            date_valeur,
            libelle_banque,
            reference_banque,
            montant,
            hash_unique,
            est_rapproche,
            import_batch_id
        ) VALUES (
            p_compte_banque,
            v_mov.date_operation,
            v_mov.date_valeur,
            v_mov.libelle_banque,
            v_mov.reference_banque,
            v_mov.montant,
            v_mov.hash_unique,
            FALSE,
            v_batch_id
        )
        ON CONFLICT (hash_unique) DO NOTHING;
        
        -- PAS d'écriture comptable ici
        
        IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 Nouveau `validate_bank_reconciliation` (multi-types)

```sql
CREATE OR REPLACE FUNCTION validate_bank_reconciliation_v2(
    p_movement_id UUID,
    p_type_rapprochement TEXT,
    
    -- Sources comptables (selon le type)
    p_reservation_ids UUID[] DEFAULT NULL,
    p_invoice_ids UUID[] DEFAULT NULL,
    p_reddition_piece_id UUID DEFAULT NULL,
    p_bail_id UUID DEFAULT NULL,
    p_caution_amount NUMERIC DEFAULT NULL,
    
    -- Pour frais/divers : saisie directe
    p_compte_contrepartie TEXT DEFAULT NULL,
    p_libelle_manuel TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_movement RECORD;
    v_piece_id UUID;
    v_numero_piece TEXT;
    v_lettrage TEXT;
    v_compte_banque TEXT;
    v_montant_abs NUMERIC;
BEGIN
    -- 1. Récupérer le mouvement bancaire
    SELECT * INTO v_movement FROM mouvements_bancaires WHERE id = p_movement_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Mouvement introuvable'; END IF;
    IF v_movement.est_rapproche THEN RAISE EXCEPTION 'Mouvement déjà rapproché'; END IF;
    
    v_compte_banque := v_movement.compte_banque;
    v_montant_abs := ABS(v_movement.montant);
    v_lettrage := 'LET-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') 
                  || '-' || SUBSTRING(p_movement_id::TEXT FROM 1 FOR 4);
    
    -- 2. Générer la pièce comptable BQ
    SELECT fn_generate_numero_piece('BQ', v_movement.date_operation) 
      INTO v_numero_piece;
    
    INSERT INTO pieces_comptables (
        numero_piece, journal_code, date_piece, libelle_piece, 
        source_type, source_id
    ) VALUES (
        v_numero_piece, 'BQ', v_movement.date_operation,
        'Rapprochement: ' || v_movement.libelle_banque,
        'RAPPROCHEMENT', p_movement_id
    ) RETURNING id INTO v_piece_id;
    
    -- 3. Générer les écritures selon le type
    
    -- ═══════════════════════════════════════════
    -- ENCAISSEMENT OTA / DIRECT (Réservations)
    -- ═══════════════════════════════════════════
    IF p_type_rapprochement IN ('ENCAISSEMENT_OTA', 'ENCAISSEMENT_DIR') THEN
        -- Vérification de l'équilibre
        PERFORM validate_reconciliation_balance(
            v_montant_abs,
            (SELECT SUM(payout_net) FROM reservations 
             WHERE id = ANY(p_reservation_ids))
        );
        
        -- Écriture : Débit 512000 / Crédit 411
        PERFORM create_reconciliation_entries_for_reservations(
            v_piece_id, p_reservation_ids, v_compte_banque,
            v_movement.date_operation, v_lettrage
        );
    
    -- ═══════════════════════════════════════════
    -- PAIEMENT FOURNISSEUR
    -- ═══════════════════════════════════════════
    ELSIF p_type_rapprochement = 'PAIEMENT_FOURNR' THEN
        PERFORM create_reconciliation_entries_for_invoices(
            v_piece_id, p_invoice_ids, v_compte_banque,
            v_movement.date_operation, v_lettrage
        );
    
    -- ═══════════════════════════════════════════
    -- REDDITION PROPRIÉTAIRE (Pointage Option B)
    -- ═══════════════════════════════════════════
    ELSIF p_type_rapprochement = 'REDDITION_PROPRIO' THEN
        -- On ne crée PAS de nouvelle écriture
        -- On pointe l'écriture existante de la reddition
        UPDATE journal_ecritures 
        SET lettrage = v_lettrage
        WHERE piece_comptable_id = p_reddition_piece_id
          AND compte_credit = v_compte_banque
          AND lettrage IS NULL;
        
        -- Le mouvement bancaire pointe vers la pièce de reddition
        v_piece_id := p_reddition_piece_id;
    
    -- ═══════════════════════════════════════════
    -- TRANSFERT HONORAIRES (512000 → 512100)
    -- ═══════════════════════════════════════════
    ELSIF p_type_rapprochement = 'TRANSFERT_HONOR' THEN
        INSERT INTO journal_ecritures (
            piece_comptable_id, date_ecriture, libelle,
            compte_debit, compte_credit, montant
        ) VALUES (
            v_piece_id, v_movement.date_operation,
            'Transfert Honoraires ' || v_movement.libelle_banque,
            '512100', '512000', v_montant_abs
        );
    
    -- ═══════════════════════════════════════════
    -- CAUTION ENCAISSÉE
    -- ═══════════════════════════════════════════
    ELSIF p_type_rapprochement = 'CAUTION_ENCAISS' THEN
        INSERT INTO journal_ecritures (
            piece_comptable_id, date_ecriture, libelle,
            compte_debit, compte_credit, montant, tiers_id
        ) 
        SELECT 
            v_piece_id, v_movement.date_operation,
            'Encaissement Caution ' || loc.nom,
            v_compte_banque, '419000', v_montant_abs,
            b.locataire_id
        FROM baux_mtr b
        JOIN tiers loc ON loc.id = b.locataire_id
        WHERE b.id = p_bail_id;
        
        -- Mettre à jour le statut du bail
        UPDATE baux_mtr SET 
            statut_caution = 'ENCAISSEE',
            date_encaissement_caution = v_movement.date_operation
        WHERE id = p_bail_id;
    
    -- ═══════════════════════════════════════════
    -- CAUTION RESTITUÉE
    -- ═══════════════════════════════════════════
    ELSIF p_type_rapprochement = 'CAUTION_RESTIT' THEN
        INSERT INTO journal_ecritures (
            piece_comptable_id, date_ecriture, libelle,
            compte_debit, compte_credit, montant, tiers_id
        )
        SELECT
            v_piece_id, v_movement.date_operation,
            'Restitution Caution ' || loc.nom,
            '419000', v_compte_banque, v_montant_abs,
            b.locataire_id
        FROM baux_mtr b
        JOIN tiers loc ON loc.id = b.locataire_id
        WHERE b.id = p_bail_id;
        
        UPDATE baux_mtr SET
            statut_caution = 'RESTITUEE',
            date_restitution_caution = v_movement.date_operation
        WHERE id = p_bail_id;
    
    -- ═══════════════════════════════════════════
    -- FRAIS BANCAIRES
    -- ═══════════════════════════════════════════
    ELSIF p_type_rapprochement = 'FRAIS_BANCAIRES' THEN
        INSERT INTO journal_ecritures (
            piece_comptable_id, date_ecriture, libelle,
            compte_debit, compte_credit, montant
        ) VALUES (
            v_piece_id, v_movement.date_operation,
            COALESCE(p_libelle_manuel, v_movement.libelle_banque),
            COALESCE(p_compte_contrepartie, '627000'),
            v_compte_banque, v_montant_abs
        );
    
    -- ═══════════════════════════════════════════
    -- DIVERS (mouvement non catégorisé)
    -- ═══════════════════════════════════════════
    ELSIF p_type_rapprochement = 'DIVERS' THEN
        IF p_compte_contrepartie IS NULL THEN
            RAISE EXCEPTION 'Compte de contrepartie requis pour un rapprochement divers';
        END IF;
        
        INSERT INTO journal_ecritures (
            piece_comptable_id, date_ecriture, libelle,
            compte_debit, compte_credit, montant
        ) VALUES (
            v_piece_id, v_movement.date_operation,
            COALESCE(p_libelle_manuel, v_movement.libelle_banque),
            CASE WHEN v_movement.montant > 0 
                 THEN v_compte_banque ELSE p_compte_contrepartie END,
            CASE WHEN v_movement.montant > 0 
                 THEN p_compte_contrepartie ELSE v_compte_banque END,
            v_montant_abs
        );
    
    ELSE
        RAISE EXCEPTION 'Type de rapprochement inconnu: %', p_type_rapprochement;
    END IF;
    
    -- 4. Marquer le mouvement comme rapproché
    UPDATE mouvements_bancaires SET 
        est_rapproche = TRUE,
        type_rapprochement = p_type_rapprochement,
        date_rapprochement = NOW(),
        piece_comptable_id = v_piece_id
    WHERE id = p_movement_id;
    
    RETURN v_piece_id;
END;
$$ LANGUAGE plpgsql;
```

### 4.4 Nouveau `rapprochementService.ts`

```typescript
export type ReconciliationType = 
  | 'ENCAISSEMENT_OTA' 
  | 'ENCAISSEMENT_DIR'
  | 'PAIEMENT_FOURNR'
  | 'REDDITION_PROPRIO'
  | 'TRANSFERT_HONOR'
  | 'CAUTION_ENCAISS'
  | 'CAUTION_RESTIT'
  | 'FRAIS_BANCAIRES'
  | 'DIVERS';

// Éléments pointables côté comptabilité
export type PointableItem = {
  id: string;
  type: ReconciliationType;
  libelle: string;
  montant: number;
  date: string;
  tiers_nom?: string;
  compte?: string;
  // Référence source
  reservation_id?: string;
  invoice_id?: string;
  piece_id?: string;
  bail_id?: string;
};

export const rapprochementService = {
  // Récupère TOUS les éléments pointables, toutes catégories
  async getAllPointableItems(): Promise<PointableItem[]> {
    const items: PointableItem[] = [];
    
    // 1. Réservations en attente de paiement
    const reservations = await this.getPendingReservations();
    items.push(...reservations.map(r => ({
      id: r.id,
      type: 'ENCAISSEMENT_OTA' as ReconciliationType,
      libelle: `${r.guest_name} - ${r.confirmation_code} (${r.source})`,
      montant: r.payout_net,
      date: r.check_in,
      reservation_id: r.id
    })));
    
    // 2. Factures fournisseurs non lettrées
    const invoices = await this.getPendingInvoices();
    items.push(...invoices.map(i => ({
      id: i.id,
      type: 'PAIEMENT_FOURNR' as ReconciliationType,
      libelle: i.libelle,
      montant: i.montant,
      date: i.date_ecriture,
      compte: i.compte_credit,
      invoice_id: i.id
    })));
    
    // 3. Redditions non pointées
    const redditions = await this.getPendingRedditions();
    items.push(...redditions.map(r => ({
      id: r.piece_id,
      type: 'REDDITION_PROPRIO' as ReconciliationType,
      libelle: `Reddition ${r.periode} - ${r.proprietaire_nom}`,
      montant: r.montant_total,
      date: r.date_generation,
      tiers_nom: r.proprietaire_nom,
      piece_id: r.piece_id
    })));
    
    // 4. Cautions en attente d'encaissement
    const cautions = await this.getPendingCautions();
    items.push(...cautions.map(c => ({
      id: c.bail_id,
      type: 'CAUTION_ENCAISS' as ReconciliationType,
      libelle: `Caution ${c.locataire_nom} - ${c.logement_nom}`,
      montant: c.montant_caution,
      date: c.date_debut,
      tiers_nom: c.locataire_nom,
      bail_id: c.bail_id
    })));
    
    // 5. Cautions en attente de restitution
    const restitutions = await this.getPendingRestitutions();
    items.push(...restitutions.map(c => ({
      id: c.bail_id,
      type: 'CAUTION_RESTIT' as ReconciliationType,
      libelle: `Restitution Caution ${c.locataire_nom}`,
      montant: c.montant_caution,
      date: c.date_fin,
      tiers_nom: c.locataire_nom,
      bail_id: c.bail_id
    })));
    
    return items;
  },

  // Nouvelles requêtes pour les redditions et cautions
  async getPendingRedditions() {
    // Pièces de reddition (journal EX) non encore pointées
    const { data, error } = await supabase
      .from('pieces_comptables')
      .select(`
        id,
        date_piece,
        libelle_piece,
        journal_ecritures (montant, compte_credit, tiers_id, lettrage)
      `)
      .eq('journal_code', 'EX')
      .eq('source_type', 'REDDITION')
      // Filtre : au moins une écriture sans lettrage sur le 512
      .is('journal_ecritures.lettrage', null);
      
    // ... transformation
  },

  async getPendingCautions() {
    const { data, error } = await supabase
      .from('baux_mtr')
      .select('*, locataire:locataire_id(nom), logement:logement_id(nom)')
      .eq('statut_caution', 'NON_VERSEE')
      .gt('montant_caution', 0);
      
    return data || [];
  },

  async getPendingRestitutions() {
    const { data, error } = await supabase
      .from('baux_mtr')
      .select('*, locataire:locataire_id(nom)')
      .eq('statut_caution', 'ENCAISSEE')
      .not('date_fin', 'is', null)
      .lte('date_fin', new Date().toISOString().split('T')[0]);
      
    return data || [];
  },

  // Validation unifiée
  async validateReconciliation(
    movementId: string,
    type: ReconciliationType,
    selectedItems: PointableItem[]
  ): Promise<void> {
    const { error } = await supabase.rpc(
      'validate_bank_reconciliation_v2', 
      {
        p_movement_id: movementId,
        p_type_rapprochement: type,
        p_reservation_ids: selectedItems
          .filter(i => i.reservation_id)
          .map(i => i.reservation_id),
        p_invoice_ids: selectedItems
          .filter(i => i.invoice_id)
          .map(i => i.invoice_id),
        p_reddition_piece_id: selectedItems
          .find(i => i.piece_id)?.piece_id || null,
        p_bail_id: selectedItems
          .find(i => i.bail_id)?.bail_id || null,
      }
    );

    if (error) throw new Error(error.message);
  }
};
```

---

## 5. Nouvelle Interface de Rapprochement

### 5.1 Structure des onglets côté droit

Remplacer le système actuel à 2 onglets (Réservations | Fournisseurs) par une liste unifiée filtrable :

```
┌─────────────────────────────────────────────────────────┐
│  Filtres rapides :                                      │
│  [Tout] [Encaissements] [Décaissements] [Cautions]     │
│                                                         │
│  🔍 Rechercher un libellé, un nom, un code...          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ── ENCAISSEMENTS ATTENDUS ──────────────────────       │
│  ☐ Airbnb HM3X7K - Jean Dupont     +1 250.00 €  OTA   │
│  ☐ Booking 42891  - Marie Leroy    +  890.00 €  OTA   │
│                                                         │
│  ── DÉCAISSEMENTS ATTENDUS ──────────────────────       │
│  ☐ Reddition Fév. - Martin         -3 200.00 €  REDD  │
│  ☐ Reddition Fév. - Dubois         -1 850.00 €  REDD  │
│  ☐ Clean & Co - Ménage Mars        -  350.00 €  FOURN │
│  ☐ Transfert Honoraires Fév.       -2 500.00 €  HONOR │
│                                                         │
│  ── CAUTIONS ────────────────────────────────────       │
│  ☐ Caution Leroy - Montmartre      +1 200.00 €  CAUT↓ │
│  ☐ Restit. Caution Bernard         -  800.00 €  CAUT↑ │
│                                                         │
│  ── SAISIE MANUELLE ─────────────────────────────       │
│  [+ Frais bancaires]  [+ Mouvement divers]              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Auto-suggestion de rapprochement

L'interface peut proposer automatiquement des correspondances :

```typescript
function suggestMatches(
  movement: BankMovement, 
  items: PointableItem[]
): PointableItem[] {
  const suggestions: PointableItem[] = [];
  const amt = Math.abs(movement.montant);
  const libelle = movement.libelle_banque.toLowerCase();
  
  // 1. Match exact sur montant
  const exactMatches = items.filter(
    i => Math.abs(Math.abs(i.montant) - amt) < 0.01
  );
  if (exactMatches.length === 1) return exactMatches;
  
  // 2. Match par libellé (code confirmation, nom)
  for (const item of items) {
    if (item.tiers_nom && libelle.includes(
      item.tiers_nom.toLowerCase()
    )) {
      suggestions.push(item);
    }
  }
  
  // 3. Match par somme de N éléments (groupement OTA)
  // Airbnb envoie souvent un virement groupé pour N réservations
  if (movement.montant > 0) {
    const otas = items.filter(i => i.type === 'ENCAISSEMENT_OTA');
    const combo = findSubsetSum(otas, amt, 0.01);
    if (combo) suggestions.push(...combo);
  }
  
  return suggestions;
}
```

---

## 6. État de Rapprochement Bancaire

### 6.1 Nouveau composant : `EtatRapprochement.tsx`

Ce document essentiel affiche la justification du solde bancaire à une date donnée :

```
╔═══════════════════════════════════════════════════════════╗
║  ÉTAT DE RAPPROCHEMENT BANCAIRE                          ║
║  Compte : 512000 - Banque Séquestre                      ║
║  Période : Février 2026                                   ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Solde comptable au 28/02/2026              18 450.00 €  ║
║  (Σ débits - Σ crédits sur le compte 512000)             ║
║                                                           ║
║  Solde relevé bancaire au 28/02/2026        19 700.00 €  ║
║  (Dernier solde importé)                                  ║
║                                                           ║
║  ─── ÉCART À JUSTIFIER ─────────────────    1 250.00 €  ║
║                                                           ║
║  Détail de l'écart :                                      ║
║                                                           ║
║  Mouvements banque non rapprochés :                       ║
║    + 1 250.00  AIRBNB PAYOUT 27/02      (en transit)     ║
║                                                           ║
║  Écritures comptables sans mvt bancaire :                 ║
║    (aucune)                                               ║
║                                                           ║
║  ─── ÉCART RÉSIDUEL ────────────────────        0.00 €  ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║  Contrôle de cohérence Loi Hoguet :                      ║
║                                                           ║
║  Σ Soldes 404 (dettes mandants)             12 800.00 €  ║
║  Σ Soldes 401 (dettes fournisseurs)          2 100.00 €  ║
║  Σ Soldes 419 (cautions reçues)              3 600.00 €  ║
║  Σ Solde 471 (attente)                           0.00 €  ║
║  ──────────────────────────────────────                   ║
║  TOTAL DETTES TIERS                         18 500.00 €  ║
║                                                           ║
║  Solde comptable 512000                     18 450.00 €  ║
║  Écart (honoraires à transférer)               -50.00 €  ║
║                                                           ║
║  ✅ Écart justifié par honoraires non transférés          ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 7. Plan de Migration

### Phase 1 — Préparer (sans casser l'existant)

1. Ajouter les colonnes `compte_banque`, `type_rapprochement`, `piece_comptable_id` à `mouvements_bancaires`
2. Ajouter le compte `627000` (Frais bancaires) et `467` (Créditeurs divers) au plan comptable
3. Migrer les mouvements existants : `UPDATE mouvements_bancaires SET compte_banque = '512000'`

### Phase 2 — Modifier l'import

4. Modifier `fn_import_bank_movements` : supprimer la génération auto d'écritures 512/471
5. Ajouter le sélecteur de compte banque dans `ImportBanqueCSV.tsx`

### Phase 3 — Nouveau rapprochement

6. Créer `validate_bank_reconciliation_v2` (RPC multi-types)
7. Refaire `rapprochementService.ts` avec `getAllPointableItems()`
8. Refaire `RapprochementBancaire.tsx` avec la liste unifiée

### Phase 4 — Adapter les modules existants

9. Modifier `redditionApi.ts` : ne plus toucher directement le 512, ou ajouter un flag `est_pointe`
10. Modifier `mtrService.recordCautionAccounting` : ne plus créer d'écriture 512, juste changer le statut
11. Supprimer `agencyRevenueService.markAsTransferred` (remplacé par le rapprochement)

### Phase 5 — Contrôles

12. Créer `EtatRapprochement.tsx`
13. Créer le contrôle de cohérence séquestre sur le dashboard
14. Ajouter les alertes (solde 471 ≠ 0, écart séquestre/tiers)
