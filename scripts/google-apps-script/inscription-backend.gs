/**
 * Backend Google Apps Script pour le formulaire de pré-inscription du BCCO.
 *
 * Reçoit les données POST depuis inscription.html et les ajoute au Google
 * Sheets configuré ci-dessous. Aucune base de données : tout vit dans le
 * Sheets, exportable en CSV en 1 clic depuis Google Sheets.
 *
 * Voir docs/setup-inscription-backend.md pour le tutoriel de déploiement.
 */

// =====================================================================
// CONFIGURATION — à remplir une fois
// =====================================================================

// ID du Google Sheets (la longue chaîne entre /d/ et /edit dans l'URL)
const SHEET_ID = 'REPLACE_AVEC_VOTRE_SHEET_ID';

// Nom de l'onglet où écrire les inscriptions (sera créé si absent)
const SHEET_NAME = 'Inscriptions';

// (Optionnel) Email à notifier à chaque nouvelle inscription. Mets '' pour désactiver.
const NOTIFY_EMAIL = '';

// =====================================================================

const HEADERS = [
  'Date soumission',
  'Prénom',
  'Nom',
  'Email',
  'Téléphone',
  'Date de naissance',
  'Adresse',
  'Catégorie FFBaD',
  'Année de naissance',
  'Formule jeune',
  'Type adulte',
  'Déjà licencié FFBaD',
  'N° licence',
  'Club précédent',
  'Créneaux choisis',
  'Tarif calculé (€)',
  'Origine',
  'Message',
  'Consentement RGPD',
  'User Agent',
];

/**
 * Ajoute les en-têtes si l'onglet est vide.
 */
function ensureSheetReady() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    // Mise en forme : ligne d'en-tête en gras + couleur de fond
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0A1988');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Transforme le payload reçu en ligne de Sheets (ordre des HEADERS).
 */
function payloadToRow(data) {
  const submittedAt = data.submitted_at ? new Date(data.submitted_at) : new Date();
  const creneaux = (data.creneaux_choisis || [])
    .map(function (s) { return s.jour + ' ' + s.heure + ' (' + s.label + ')'; })
    .join(' | ');
  const birthYear = data.date_naissance
    ? Number(String(data.date_naissance).slice(0, 4))
    : '';

  return [
    submittedAt,
    data.prenom || '',
    data.nom || '',
    data.email || '',
    data.telephone || '',
    data.date_naissance || '',
    data.adresse || '',
    data.categorie_label || data.categorie_ffbad || '',
    birthYear,
    data.formule_jeune || '',
    data.type_adulte || '',
    data.deja_licencie || '',
    data.numero_licence || '',
    data.club_precedent || '',
    creneaux,
    data.tarif_calcule || '',
    data.origine || '',
    data.message || '',
    data.rgpd ? 'Oui' : 'Non',
    data.user_agent || '',
  ];
}

/**
 * (Optionnel) Notification email au club à chaque nouvelle inscription.
 */
function notifyByEmail(data) {
  if (!NOTIFY_EMAIL) return;
  const subject = 'Nouvelle pré-inscription BCCO — ' + (data.prenom || '') + ' ' + (data.nom || '');
  const body =
    'Nouvelle pré-inscription reçue :\n\n' +
    'Nom         : ' + (data.prenom || '') + ' ' + (data.nom || '') + '\n' +
    'Email       : ' + (data.email || '') + '\n' +
    'Téléphone   : ' + (data.telephone || '') + '\n' +
    'Naissance   : ' + (data.date_naissance || '') + '\n' +
    'Catégorie   : ' + (data.categorie_label || '') + '\n' +
    'Tarif       : ' + (data.tarif_calcule || '') + ' €\n\n' +
    'Détails complets dans le Google Sheets.\n';
  try {
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  } catch (err) {
    console.warn('Impossible d\'envoyer la notification email :', err.message);
  }
}

/**
 * Endpoint principal — reçoit le POST depuis inscription.html.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'Aucune donnée reçue' });
    }
    const data = JSON.parse(e.postData.contents);

    // Validation minimale côté serveur
    if (!data.prenom || !data.nom || !data.email) {
      return jsonResponse({ ok: false, error: 'Champs requis manquants' });
    }
    if (!data.rgpd) {
      return jsonResponse({ ok: false, error: 'Consentement RGPD requis' });
    }

    const sheet = ensureSheetReady();
    sheet.appendRow(payloadToRow(data));

    notifyByEmail(data);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

/**
 * Endpoint GET — utile pour vérifier que le déploiement fonctionne.
 */
function doGet() {
  return ContentService
    .createTextOutput('OK — Endpoint pré-inscription BCCO actif.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
