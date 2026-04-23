# ChamblyBad — Site du BCCO

Site vitrine du **Badminton Club Chambly Oise** (BCCO), 8× Champion de France Top 12.
Site statique (HTML + CSS + JS inline), sans backend, données pilotées depuis Google Sheets.

---

## Pages du site

| Page | Rôle |
|------|------|
| `index.html` | Page d'accueil : présentation du club, salle, équipes, actualités, horaires, contact |
| `classement.html` | Classement Top 12 en direct (mis à jour depuis Google Sheets) |
| `admin-bcco-*.html` | Interface admin (URL privée, voir section Admin) |

---

## Fonctionnement

Le site est **100 % statique** — aucun serveur, aucune base de données. Les contenus dynamiques (actualités, rencontres, classement) sont tirés d'un **Google Sheets publié en CSV** et lus par le JavaScript côté client.

### Sources de données

| Contenu | Onglet Sheets (gid) | Fallback local |
|---------|---------------------|----------------|
| Actualités | `820796484` | `data/actualites.csv` |
| Rencontres Top 12 & N2 | `1314308939` | `data/rencontres.csv` |
| Classement Top 12 | onglet par défaut | `data/top12.csv` |

Classeur : [1f3KhbeuCzbdkCwYRB-LiGEvyMNr1zzRzj2R0ZSmAnLU](https://docs.google.com/spreadsheets/d/1f3KhbeuCzbdkCwYRB-LiGEvyMNr1zzRzj2R0ZSmAnLU/edit)

Si le Google Sheets est inaccessible, le site bascule automatiquement sur les CSV locaux de `data/` pour ne jamais afficher de page vide.

### Styles & dépendances

- [`styles.css`](styles.css) — feuille de style globale (partagée avec `classement.html`)
- Fonts : **Inter** + **Space Grotesk** via Google Fonts
- Icônes : SVG inline (aucune librairie d'icônes externe)

---

## Partie admin

L'interface admin permet de **piloter le contenu du site** sans toucher au code.

### Accès

- **URL** : `admin-bcco-*.html` (slug privé — contacter l'admin pour l'obtenir)
- **Mot de passe** : non documenté ici — contacter l'admin
- Protection : hash SHA-256 en dur dans la page + blocage 30 min après 5 tentatives ratées

### Fonctionnalités

- **Actualités** — preview en lecture seule + bouton "Modifier dans Google Sheets" (ouvre l'onglet `actualites` en édition)
- **Rencontres Top 12 & N2** — preview des prochains matchs + bouton d'édition
- **Classement Top 12** — raccourci vers le Google Sheets (pas de preview)

L'édition se fait **toujours dans Google Sheets**, jamais dans l'interface admin. Après modification, cliquer sur "Recharger" pour voir l'aperçu mis à jour (le site public se met à jour automatiquement au prochain chargement, avec un cache de quelques minutes côté Google).

### Niveau de sécurité

Le mot de passe n'empêche pas grand-chose en réalité :

- Un utilisateur lambda, non-technique, qui taperait l'URL par curiosité → **bloqué**
- Une personne qui sait ouvrir les devtools → **non bloquée** (la vérification étant côté client, elle est contournable en une ligne de console)

**Mais est-ce que ça suffit ?** Oui, pour ce cas précis, parce que derrière la porte il n'y a **aucune donnée sensible** :

- Pas de données clients
- Pas de moyens de paiement
- Pas de contenu éditable depuis la page
- Uniquement des **liens vers Google Sheets** — et Google Sheets a sa propre auth Google qui, elle, est solide

Même si quelqu'un bypass le login admin, il clique sur "Modifier dans Google Sheets", Google lui demande de se connecter avec un compte autorisé → accès refusé. **La vraie sécurité est chez Google.**

**Résumé :** le slug secret bloque 99 % des curieux. Le mot de passe bloque les 0,9 % restants non-techniques. Les 0,1 % qui savent bypasser ne trouveront rien d'exploitable derrière. Proportionné au risque réel, mais pas "sécurisé" au sens strict.

Le jour où l'admin contiendrait des données sensibles, passer par une vraie auth serveur (Cloudflare Access, Supabase Auth, etc.).

### Durcissement appliqué

- **Hash admin** : `PBKDF2(SHA-256(mot_de_passe), salt, 200 000 itérations)` au lieu d'un simple SHA-256. Un brute-force par dictionnaire coûte ~200 000× plus cher. Le mot de passe n'a pas changé.
- **CSP** (`Content-Security-Policy` via meta) sur toutes les pages : bloque les scripts externes non autorisés et limite les sources d'images/fonts.
- **Referrer-Policy** `strict-origin-when-cross-origin` (public) / `no-referrer` (admin) : évite la fuite du slug admin via les liens sortants.

### ⚠️ Données licenciés — RGPD

Le fichier [`data/reservations/licencies.csv`](data/reservations/licencies.csv) est **servi statiquement et accessible publiquement** à toute personne qui tape l'URL. Il ne contient actuellement que des données de démonstration (DUPONT, MARTIN).

**À faire avant d'y mettre des vraies données :**

1. **Sortir le fichier du site public** — ne pas y mettre de vraies données tant que ça reste accessible à `/data/reservations/licencies.csv`.
2. Passer par un **backend authentifié** (Cloud Function + auth, Supabase Row-Level Security, Google Apps Script avec vérification d'origine…).
3. Côté client, envoyer uniquement un hash du numéro de licence + email (lookup côté serveur) plutôt que télécharger la liste entière.
4. Ajouter le traitement au **registre RGPD** de l'association (voir `politique-confidentialite.html`).

Le `robots.txt` bloque déjà `/data/` des moteurs de recherche, mais ça n'empêche pas l'accès direct — ce n'est pas une mesure de sécurité.

---

## Lancer le site en local

### Option 1 — Ouvrir directement les fichiers

Double-cliquer sur les fichiers HTML depuis le Finder. Les URLs seront de la forme :

```
file:///Users/tmeurier/Documents/GitHub/ChamblyBad/index.html
file:///Users/tmeurier/Documents/GitHub/ChamblyBad/classement.html
```

**Limite** : le chargement des CSV locaux (`data/*.csv`) peut être bloqué par les règles CORS des navigateurs en mode `file://`. Dans ce cas, le site bascule sur les URLs Google Sheets publiées — ce qui fonctionne. Pour tester les fallbacks locaux, utiliser l'option 2.

### Option 2 — Lancer un serveur HTTP local (recommandé)

Depuis le dossier du projet :

```bash
cd "/Users/tmeurier/Documents/GitHub/ChamblyBad"
python3 -m http.server 8000
```

Puis ouvrir dans le navigateur :

- Accueil : [http://localhost:8000/](http://localhost:8000/)
- Classement : [http://localhost:8000/classement.html](http://localhost:8000/classement.html)
- Admin : `http://localhost:8000/admin-bcco-*.html` (slug privé)

Alternatives au serveur Python : `npx serve`, `php -S localhost:8000`, extension Live Server de VS Code.

---

## Structure du dépôt

```
ChamblyBad/
├── index.html                       # Page d'accueil
├── classement.html                  # Classement Top 12
├── admin-bcco-*.html                # Interface admin (slug privé)
├── styles.css                       # Styles globaux
├── data/
│   ├── actualites.csv               # Fallback actualités
│   ├── rencontres.csv               # Fallback rencontres
│   └── top12.csv                    # Fallback classement
└── README.md
```
