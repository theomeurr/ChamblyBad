# JavaScript externe

Fichiers extraits depuis les `<script>` inline des pages HTML
(refactor 2026-04 — voir branche `refactor/external-js`).

## Convention de nommage

`{page}-{N}.js` — où `N` correspond à la position du `<script>` dans
la page d'origine. L'ordre d'exécution est préservé.

| Fichier | Origine | Rôle (résumé) |
|---|---|---|
| `index-1.js` | index.html | Header / nav / menu |
| `index-2.js` | index.html | Animations & scroll |
| `index-3.js` | index.html | Chargement des actualités (Sheets/CSV) |
| `index-4.js` | index.html | Chargement des rencontres (Sheets/CSV) |
| `index-5.js` | index.html | Init final |
| `reservations-1.js` | reservations.html | Init early |
| `reservations-2.js` | reservations.html | Système de réservation complet |
| `admin-1.js` | admin-bcco-*.html | Toute la logique admin |
| `classement-1.js` | classement.html | Init |
| `classement-2.js` | classement.html | Helpers |
| `classement-3.js` | classement.html | Logique de chargement & rendu |
| `classement-4.js` | classement.html | Init final |
| `equipes-1.js` | equipes.html | Logique des effectifs |
| `galerie-1.js` | galerie.html | Header (bouton plus, retour en haut) |
| `galerie-2.js` | galerie.html | Logique galerie |

## Pourquoi externe ?

- **Cache navigateur** : les fichiers ne sont pas re-téléchargés à
  chaque navigation entre pages
- **Maintenance** : éditer 200 lignes dans un .js dédié est plus
  simple que de naviguer dans 2000 lignes de HTML
- **Diff Git lisibles** : modifier le JS ne pollue plus les diffs HTML
- **Build** : permet la minification ciblée (Terser, etc.)

## Évolutions possibles (non faites ici)

- Mutualiser le code commun (ex : parser CSV, fetch Google Sheets)
  dans un `js/common.js`
- Convertir en modules ES6 (`type="module"`)
- Durcir le `Content-Security-Policy` en retirant `'unsafe-inline'`
  de `script-src` une fois sûr qu'il n'y a plus d'inline event handlers
