# Partials HTML

Fichiers fragments HTML partagés entre les pages publiques pour
éviter la duplication.

## `head-common.html`

Contient les balises `<head>` qui sont **identiques** dans toutes
les pages publiques :

- `meta charset` + `viewport`
- icônes (`icon`, `apple-touch-icon`)
- PWA (`manifest`, `theme-color`, `apple-mobile-web-app-*`)
- preconnect aux Google Fonts
- `<link rel="stylesheet" href="styles.css">`

## Comment l'utiliser

Chaque page HTML publique contient deux marqueurs :

```html
<head>
  <!-- ...stuff spécifique à la page (CSP, title, description, og:*, fonts)... -->
  <!-- HEAD:COMMON-START -->
  <!-- contenu copié depuis partials/head-common.html par scripts/sync-head.py -->
  <!-- HEAD:COMMON-END -->
  <!-- ...autres stuff spécifiques (Schema.org, <style> inline)... -->
</head>
```

## Workflow

1. Tu modifies `partials/head-common.html` (ex : ajouter un `<meta>`,
   changer une URL d'icône)
2. Tu lances : `python3 scripts/sync-head.py`
3. Le script propage le contenu dans toutes les pages publiques
   entre les marqueurs `HEAD:COMMON-START` et `HEAD:COMMON-END`
4. Tu commit ces changements

Le script peut aussi être exécuté en CI pour garantir la cohérence
(échec si une page diverge).

## Pages exclues

- `admin-bcco-*.html` — intentionnellement différente (CSP plus stricte,
  pas de PWA, no-referrer policy). Ne pas y ajouter les marqueurs.
