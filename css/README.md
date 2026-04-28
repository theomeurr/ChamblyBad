# CSS modulaire

Le fichier `styles.css` à la racine du repo était auparavant un seul
bloc de **1721 lignes**. Il a été découpé en **11 modules thématiques**
pour faciliter la maintenance.

## Comment ça marche

`styles.css` (à la racine) sert d'**entry point** et fait `@import`
des fichiers ci-dessous **dans l'ordre**. Les pages HTML continuent
de référencer uniquement `styles.css` — rien à changer côté HTML.

## Modules

| Fichier | Rôle |
|---|---|
| `_base.css` | Variables CSS racine (`--bg`, `--text`...), reset, body, typographie, lien de saut a11y |
| `_layout.css` | Background décor, navigation top, hero, stats strip, sections globales |
| `_home-sections.css` | Composants de la home : club, équipes, programmes, horaires, documents, galerie, fitness, réservation, contact, sponsors, inscription, footer |
| `_salle.css` | Salle immersive (ancien design), actualités, responsive de base |
| `_salle-editorial.css` | Nouveau design éditorial de la salle, buvette & restauration |
| `_flamme-paralympique.css` | Cadre Flamme Paralympique |
| `_legacy.css` | Ancien `salle-showcase` (conservé mais inutilisé) |
| `_actualites-roster.css` | Actualités, Roster Top 12 & Staff, animation flame-flicker |
| `_responsive.css` | Media queries complémentaires + correctifs overflow mobile |
| `_bottom-nav.css` | Bottom nav bar mobile + bouton retour en haut |
| `_planning-mobile.css` | Sélecteur de jour mobile pour le planning |

## Ordre des `@import`

L'ordre **est important** : il reproduit l'ordre du fichier d'origine
pour préserver la cascade CSS et la spécificité. Ne pas réordonner
sans tester chaque page.

## Build (production)

Le script `scripts/build.js` (voir branche `build/minification`)
utilise `clean-css` qui inline automatiquement les `@import` au build.
Donc en production, le navigateur ne voit qu'un seul `styles.css`
minifié — pas de pénalité de performance.

## Évolutions possibles

- Découper `_home-sections.css` (366 lignes) en sous-modules par section
- Identifier le CSS mort (notamment dans `_legacy.css`) et le supprimer
- Convertir en CSS modules / scoped si on passe à un framework un jour
