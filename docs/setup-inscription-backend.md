# Setup du backend pré-inscription (Google Sheets)

Ce guide explique comment brancher le formulaire de pré-inscription
(`inscription.html`) à un Google Sheets pour que **toutes les
inscriptions arrivent automatiquement dans un tableur**, exportable
en CSV en 1 clic.

**Coût total : 0 €**. **Temps de setup : 10-15 minutes**.

---

## 🎯 Vue d'ensemble

```
Visiteur remplit le formulaire
        │
        │ POST JSON
        ▼
Google Apps Script (script qu'on déploie)
        │
        │ ajoute une ligne
        ▼
Google Sheets "Inscriptions BCCO"
        │
        │ (optionnel) email à l'admin
        ▼
   Boîte mail du club
```

L'admin du club ouvre simplement le Google Sheets pour voir toutes
les inscriptions, ou télécharge un CSV depuis `Fichier → Télécharger
→ Valeurs séparées par des virgules (.csv)`.

---

## 📋 Procédure pas à pas

### Étape 1 — Créer le Google Sheets

1. Va sur [sheets.google.com](https://sheets.google.com) avec un
   compte Gmail du club (idéalement un compte partagé type
   `bcco.club@gmail.com` plutôt qu'un compte personnel).
2. Clique **+ Vide** pour créer un nouveau Sheets.
3. Renomme-le `Inscriptions BCCO 2025-2026` (ou ce que tu veux).
4. **Note l'ID du Sheets** : c'est la longue chaîne entre `/d/` et
   `/edit` dans l'URL. Exemple :

   ```
   https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit
                                          └────────────┬────────────┘
                                                  C'est ça l'ID
   ```

### Étape 2 — Ouvrir Apps Script

1. Dans le Google Sheets, menu **Extensions → Apps Script**.
2. Une nouvelle fenêtre s'ouvre avec un éditeur de code.
3. Renomme le projet (en haut à gauche, là où c'est écrit
   "Projet sans titre") en `Backend pré-inscription BCCO`.

### Étape 3 — Coller le code

1. **Supprime** tout le contenu par défaut (`function myFunction()...`).
2. **Copie tout** le contenu du fichier
   [`scripts/google-apps-script/inscription-backend.gs`](../scripts/google-apps-script/inscription-backend.gs)
   et colle-le dans l'éditeur.
3. **Modifie 2 lignes en haut du code** :

   ```javascript
   const SHEET_ID = 'REPLACE_AVEC_VOTRE_SHEET_ID';
   //               └ Remplace par l'ID copié à l'étape 1

   const NOTIFY_EMAIL = '';
   //                   └ Optionnel : si tu veux recevoir un email
   //                     à chaque inscription, mets une adresse ici.
   //                     Sinon laisse vide.
   ```

4. **Sauvegarde** : Cmd+S (Mac) ou Ctrl+S (Windows).

### Étape 4 — Tester en local

1. Dans la barre d'outils du haut, sélectionne la fonction
   **`ensureSheetReady`** dans le menu déroulant.
2. Clique sur **▶ Exécuter**.
3. Google demande l'autorisation d'accéder à ton Sheets — accepte
   (clique **"Vérifier les autorisations"** → choisis ton compte
   → **"Avancé"** → **"Accéder à Backend pré-inscription BCCO"**
   → **"Autoriser"**).
4. Retourne dans le Sheets : tu dois voir un onglet `Inscriptions`
   créé automatiquement avec les en-têtes en bleu marine.

### Étape 5 — Déployer en tant qu'application Web

1. Dans Apps Script, en haut à droite, clique **Déployer →
   Nouveau déploiement**.
2. Engrenage à gauche → choisir **Application Web**.
3. Remplis :
   - **Description** : `Backend pré-inscription BCCO v1`
   - **Exécuter en tant que** : *Moi (ton-email@gmail.com)*
   - **Qui peut accéder** : ⚠️ **Tout le monde** ⚠️

   > Cette option est cruciale. Sans ça, le formulaire ne pourra
   > pas POST sans authentification Google.

4. Clique **Déployer**.
5. **Copie l'URL d'application Web** affichée. Elle ressemble à :

   ```
   https://script.google.com/macros/s/AKfycby...trèslong.../exec
   ```

### Étape 6 — Brancher l'URL dans le site

1. Ouvre `inscription.html` (à la racine du repo).
2. Cherche cette ligne (vers le haut du fichier, après le CSP) :

   ```html
   <meta name="ins-webhook" content="REPLACE_AVEC_VOTRE_URL_APPS_SCRIPT" />
   ```

3. Remplace `REPLACE_AVEC_VOTRE_URL_APPS_SCRIPT` par l'URL copiée à
   l'étape 5.
4. Sauvegarde, commit, push.

### Étape 7 — Tester

1. Va sur ta page `inscription.html` en ligne (preview Cloudflare ou prod).
2. Remplis le formulaire avec des données bidons (Test Test, test@test.fr…).
3. Clique **Envoyer ma pré-inscription**.
4. Retourne dans le Google Sheets : la ligne doit apparaître quelques
   secondes après. ✅

> Si rien n'arrive : ouvre la console du navigateur (`Cmd+Option+I`)
> et regarde les erreurs. Voir la section **Dépannage** plus bas.

---

## 🔄 Quand tu modifies le code Apps Script

Apps Script ne redéploie **pas automatiquement** quand tu modifies
le code. Il faut :

1. Sauvegarder (`Cmd+S`).
2. **Déployer → Gérer les déploiements**.
3. Crayon ✏️ à droite de ta version → choisir
   **Version → Nouvelle version**.
4. Cliquer **Déployer**.

L'URL **ne change pas** entre les versions, donc inutile de
modifier le `<meta>` à chaque fois.

---

## 📊 Voir et exporter les inscriptions

### Voir
Ouvre simplement le Google Sheets. Chaque ligne = une pré-inscription.

### Exporter en CSV
Dans le Sheets : **Fichier → Télécharger → Valeurs séparées par des
virgules (.csv)**. Tu obtiens un fichier que tu peux ouvrir dans
Excel/Numbers ou importer dans n'importe quel outil.

### Trier / filtrer
Sélectionne la première ligne, puis menu **Données → Créer un filtre**.
Tu peux maintenant trier par catégorie, par date, par tarif, etc.

---

## 🔐 Sécurité & RGPD

- Le formulaire **ne stocke aucune donnée côté navigateur** — tout
  va directement dans le Sheets.
- Le Sheets est **uniquement accessible** aux personnes que tu
  partages explicitement (Bouton **Partager** en haut à droite).
- Le code Apps Script tourne dans ton compte Google → c'est toi qui
  vois les données, personne d'autre.
- Le formulaire demande explicitement le **consentement RGPD** avant
  l'envoi (case obligatoire).
- Pour respecter le RGPD : au bout d'un an sans suite, supprime les
  lignes du Sheets correspondantes (ou archive-les).

---

## 🛠 Dépannage

### Le bouton "Envoyer" simule mais rien n'arrive dans le Sheets

→ Le `<meta name="ins-webhook">` contient encore le placeholder
`REPLACE_AVEC_VOTRE_URL_APPS_SCRIPT`. Mets la vraie URL à l'étape 6.

### Erreur CORS dans la console du navigateur

→ Vérifier l'**étape 5** : "Qui peut accéder" doit être
**Tout le monde**, pas "Tout le monde dans XYZ".

### Erreur 401 ou 403

→ Le déploiement est en mode "Privé". Refais l'étape 5 en passant
sur **Tout le monde**.

### Erreur 500 / "Erreur côté serveur"

→ Ouvre Apps Script → menu **Exécutions** : tu verras la stack
trace de l'erreur. Probablement le `SHEET_ID` qui est faux ou
l'onglet `Inscriptions` qui a été renommé.

### Je veux changer le mail de notification

→ Dans Apps Script, modifie la variable `NOTIFY_EMAIL`, sauvegarde,
puis **redéploie** (voir section "Quand tu modifies le code").

---

## 🚀 Évolutions possibles

- **Anti-spam** : ajouter un champ honeypot caché dans le formulaire
  + vérifier côté Apps Script qu'il est vide
- **Email de confirmation au demandeur** : dans `doPost`, ajouter
  `MailApp.sendEmail(data.email, '...', '...')`
- **Statut de traitement** : ajouter une colonne "Statut" dans le
  Sheets (À contacter / Contacté / Validé / Refusé) que l'admin
  remplit à la main
- **Synchro Poona** : si Poona expose une API, on peut auto-créer
  la fiche FFBaD
- **Migration Supabase** : si le volume devient gros, on bascule
  vers une vraie DB
