import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Parcours métier complet, dans de vrais navigateurs :
 * gérant (bureau), client (mobile), serveur (mobile puis tablette).
 */
const stamp = Date.now();
const OWNER = { email: `gerant-${stamp}@example.test`, password: 'Motdepasse-gerant-1' };
const WAITER = { email: `serveur-${stamp}@example.test`, initial: 'Initial-serveur-1', password: 'Motdepasse-serveur-2' };
const MOBILE = { width: 390, height: 844 };

test.describe.configure({ mode: 'serial' });

let owner: Page;
let guest: Page;
let waiter: Page;
let qrUrl: string;

async function newPage(browser: Browser, viewport = { width: 1366, height: 900 }): Promise<Page> {
  const context = await browser.newContext({ viewport, locale: 'fr-FR' });
  const page = await context.newPage();
  // Toute erreur JavaScript non gérée fait échouer le test.
  page.on('pageerror', (error) => {
    throw error;
  });
  return page;
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.beforeAll(async ({ browser }) => {
  owner = await newPage(browser);
  guest = await newPage(browser, MOBILE);
  waiter = await newPage(browser, MOBILE);
});

test('la page d’accueil mène à l’inscription et à la connexion', async () => {
  await owner.goto('/');
  await expect(owner.getByRole('heading', { level: 1 })).toContainText('Plus aucune demande oubliée');
  await expect(owner.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  await owner.getByRole('link', { name: 'Créer mon établissement' }).first().click();
  await expect(owner).toHaveURL(/\/inscription/);
});

test('un espace protégé renvoie vers la connexion', async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto('/app/dashboard');
  // /login renvoie à l'accueil, qui porte le formulaire ; la destination est conservée.
  await expect(page).toHaveURL(/\/\?next=%2Fapp%2Fdashboard/);
  await page.getByLabel('Adresse e-mail').fill('inconnu@example.test');
  await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('E-mail ou mot de passe incorrect.')).toBeVisible();
  await page.context().close();
});

test('le gérant crée son établissement', async () => {
  await owner.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(owner.getByText('Nom de l\'entreprise requis.')).toBeVisible();

  await owner.getByLabel('Entreprise').fill('Maquis du Plateau SARL');
  await owner.getByLabel('Nom de l’établissement').fill('Maquis du Plateau');
  await owner.getByLabel('Prénom').fill('Awa');
  await owner.getByLabel('Nom', { exact: true }).fill('Koné');
  await owner.getByLabel('Adresse e-mail').fill(OWNER.email);
  await owner.getByLabel('Mot de passe').fill('court');
  await owner.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(owner.getByText('Au moins 10 caractères.')).toBeVisible();
  await owner.getByLabel('Mot de passe').fill(OWNER.password);
  await owner.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(owner).toHaveURL(/\/app\/tables/);
  await expect(owner.getByText('Commencez par créer une zone')).toBeVisible();
  await expect(owner.getByRole('status').filter({ hasText: 'En direct' })).toBeVisible();
});

test('le gérant crée une zone, une table et récupère le QR code', async () => {
  await owner.getByRole('button', { name: 'Créer une zone' }).click();
  await owner.getByLabel('Nom de la zone').fill('Terrasse');
  await owner.getByRole('button', { name: 'Créer la zone' }).click();
  await expect(owner.getByText('Ajoutez vos tables')).toBeVisible();

  await owner.getByRole('button', { name: 'Nouvelle table' }).click();
  await owner.getByLabel('Nom ou numéro').fill('12');
  await owner.getByLabel('Couverts').fill('4');
  await owner.getByRole('button', { name: 'Créer la table' }).click();
  await expect(owner.getByText('4 couverts')).toBeVisible();

  // Un doublon est refusé par l'API et l'erreur est affichée.
  await owner.getByRole('button', { name: 'Nouvelle table' }).click();
  await owner.getByLabel('Nom ou numéro').fill('12');
  await owner.getByRole('button', { name: 'Créer la table' }).click();
  await expect(owner.getByRole('alert').filter({ hasText: 'Une table porte déjà ce nom' })).toBeVisible();
  await owner.getByRole('button', { name: 'Annuler' }).click();

  await owner.getByRole('button', { name: /^Table 12,/ }).click();
  await owner.getByRole('button', { name: 'QR code' }).click();
  await expect(owner.getByRole('img', { name: 'QR code de la table 12' })).toBeVisible();
  qrUrl = (await owner.getByText(/\/t\/[\w-]+$/).textContent()) ?? '';
  expect(qrUrl).toMatch(/^http:\/\/localhost:3004\/t\/[\w-]{20,}$/);

  const download = owner.waitForEvent('download');
  await owner.getByRole('button', { name: 'PNG' }).click();
  expect((await download).suggestedFilename()).toBe('tabilo-table-12.png');
  await owner.keyboard.press('Escape');

  await owner.getByRole('link', { name: 'Imprimer les QR codes' }).click();
  await expect(owner.getByText('Scannez pour appeler le service')).toBeVisible();
  await owner.getByRole('link', { name: 'Retour aux tables' }).click();
});

test('le gérant ajoute un serveur', async () => {
  await owner.getByRole('link', { name: 'Employés' }).click();
  await owner.getByRole('button', { name: 'Ajouter un membre' }).click();
  await owner.getByLabel('Prénom').fill('Koffi');
  await owner.getByLabel('Nom', { exact: true }).fill('Yao');
  await owner.getByLabel('Adresse e-mail').fill(WAITER.email);
  await owner.getByLabel('Rôle').selectOption({ label: 'Serveur' });
  await owner.getByLabel('Mot de passe initial').fill(WAITER.initial);
  await owner.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(owner.getByText('Koffi Yao')).toBeVisible();
  await expect(owner.getByText('Mot de passe à changer')).toBeVisible();

  await owner.getByRole('tab', { name: 'Rôles' }).click();
  await expect(owner.getByRole('columnheader', { name: /Gérant/ })).toBeVisible();
  await expect(owner.getByRole('rowheader', { name: 'Consulter le journal d\'audit' })).toBeVisible();
});

test('le serveur se connecte, change son mot de passe et n’accède pas à l’administration', async () => {
  await waiter.goto('/login');
  await waiter.getByLabel('Adresse e-mail').fill(WAITER.email);
  await waiter.getByLabel('Mot de passe').fill(WAITER.initial);
  await waiter.getByRole('button', { name: 'Se connecter' }).click();

  await expect(waiter).toHaveURL(/\/app\/compte/);
  await expect(waiter.getByText('Votre mot de passe a été défini par un responsable')).toBeVisible();
  await waiter.getByLabel('Mot de passe actuel').fill(WAITER.initial);
  await waiter.getByLabel('Nouveau mot de passe').fill(WAITER.password);
  await waiter.getByRole('button', { name: 'Enregistrer' }).click();

  // Premier écran autorisé du menu : « Commandes » pour un serveur.
  await expect(waiter).toHaveURL(/\/app\/commandes/);
  await waiter.getByRole('link', { name: 'Service' }).click();
  await expect(waiter).toHaveURL(/\/app\/service/);
  await expect(waiter.getByText('Rien à prendre pour l’instant')).toBeVisible();
  await expect(waiter.getByRole('link', { name: 'Employés' })).toHaveCount(0);
  await expectNoHorizontalScroll(waiter);

  await waiter.goto('/app/equipe');
  await expect(waiter.getByText('Accès réservé')).toBeVisible();
  await waiter.goto('/app/service');
  await expect(waiter.getByText('Rien à prendre pour l’instant')).toBeVisible();
});

test('le client scanne le QR et envoie une demande', async () => {
  await guest.goto(qrUrl);
  await expect(guest.getByRole('heading', { level: 1 })).toContainText('Table 12');
  await expect(guest.getByText('Maquis du Plateau')).toBeVisible();
  await expectNoHorizontalScroll(guest);

  await guest.getByRole('button', { name: 'De l\'eau' }).click();
  // Demande d'eau (spec 005) : la bouteille et la quantité, sans précision à écrire.
  await expect(guest.getByLabel('Une précision ? (facultatif)')).toHaveCount(0);
  await guest.getByRole('button', { name: 'Une bouteille de plus' }).click();
  await guest.getByRole('button', { name: 'Envoyer la demande' }).click();

  const tracking = guest.getByRole('region', { name: 'Vos demandes en cours' });
  await expect(tracking.getByText('Votre demande est bien reçue')).toBeVisible();
  // Tant que le serveur n'a pas confirmé, rien n'indique une prise en charge.
  await expect(tracking.getByText('s’en occupe')).toHaveCount(0);
  await expect(guest.getByRole('button', { name: /De l'eau.*Déjà demandé/ })).toBeDisabled();

  // Un rechargement conserve la session et le suivi.
  await guest.reload();
  await expect(guest.getByRole('region', { name: 'Vos demandes en cours' }).getByText('Votre demande est bien reçue')).toBeVisible();
});

test('le serveur reçoit la demande en temps réel et la traite ; le client suit chaque étape', async () => {
  // Reçue sans rechargement de page.
  const card = waiter.getByRole('article', { name: /Table 12, De l'eau/ });
  await expect(card).toBeVisible();
  await expect(card.getByText('× 2')).toBeVisible();
  await expect(card.getByText('Personne ne s’en occupe encore')).toBeVisible();

  await card.getByRole('button', { name: 'Accepter' }).click();
  await expect(guest.getByText('Koffi s’en occupe.')).toBeVisible();

  await waiter.getByRole('tab', { name: /Les miennes/ }).click();
  await waiter.getByRole('article', { name: /Table 12/ }).getByRole('button', { name: 'Commencer' }).click();
  await expect(guest.getByText('Koffi est en train de traiter votre demande.')).toBeVisible();

  await waiter.getByRole('article', { name: /Table 12/ }).getByRole('button', { name: 'Terminer' }).click();
  await expect(waiter.getByText('Vous n’avez aucune demande en cours')).toBeVisible();
  await expect(guest.getByText('Traitée')).toBeVisible();
  await expect(guest.getByRole('button', { name: 'De l\'eau' })).toBeEnabled();
});

test('le serveur saisit une demande pour un client sans smartphone', async () => {
  await waiter.getByRole('button', { name: 'Nouvelle demande' }).click();
  await waiter.getByLabel('Table', { exact: true }).selectOption({ label: 'Table 12' });
  await waiter.getByLabel('Demande', { exact: true }).selectOption({ label: 'L\'addition' });
  await waiter.getByRole('button', { name: 'Créer la demande' }).click();
  const card = waiter.getByRole('article', { name: /Table 12, L'addition, Acceptée/ });
  await expect(card).toBeVisible();
  // Le client voit aussi la demande faite pour sa table.
  await expect(guest.getByRole('region', { name: 'Vos demandes en cours' }).getByText('L\'addition')).toBeVisible();

  await card.getByRole('button', { name: 'Détail' }).click();
  await expect(waiter.getByText('Par le personnel')).toBeVisible();
  await expect(waiter.getByRole('dialog').getByText('Demande créée')).toBeVisible();
  await waiter.keyboard.press('Escape');
});

test('le gérant supervise : tableau de bord, réaffectation, historique, statistiques, journal', async () => {
  await owner.getByRole('link', { name: 'Tableau de bord' }).click();
  await expect(owner.getByRole('heading', { name: 'Plan de salle' })).toBeVisible();
  await expect(owner.getByText('Aucune demande en retard ni escaladée.')).toBeVisible();
  await expect(owner.getByText(/Koffi Yao/).first()).toBeVisible();

  await owner.getByRole('button', { name: /Table 12, 1 demande en cours/ }).click();
  const card = owner.getByRole('article', { name: /Table 12, L'addition/ });
  await card.getByRole('button', { name: 'Commencer' }).click();
  await expect(owner.getByRole('article', { name: /L'addition, En cours/ })).toBeVisible();
  await owner.getByRole('article', { name: /L'addition/ }).getByRole('button', { name: 'Autres actions' }).click();
  await owner.getByRole('menuitem', { name: 'Réaffecter…' }).click();
  await owner.getByLabel('Confier à').selectOption({ index: 1 });
  await owner.getByRole('button', { name: 'Confirmer' }).click();
  await expect(owner.getByRole('alert').filter({ hasText: 'Indiquez un motif' })).toBeVisible();
  await owner.getByLabel('Motif', { exact: true }).fill('Koffi est en pause');
  await owner.getByRole('button', { name: 'Confirmer' }).click();
  await expect(owner.getByRole('article', { name: /L'addition, Affectée/ })).toBeVisible();
  // L'ancien responsable voit la demande lui échapper sans recharger.
  await expect(waiter.getByRole('article', { name: /L'addition/ })).toHaveCount(0);
  await owner.keyboard.press('Escape');

  await owner.getByRole('link', { name: 'Historique' }).click();
  await expect(owner.getByRole('row', { name: /De l'eau.*Résolue.*Koffi Yao/ })).toBeVisible();
  await owner.getByLabel('Statut').selectOption({ label: 'Annulée' });
  await expect(owner.getByText('Aucune demande ne correspond à ces filtres.')).toBeVisible();
  await owner.getByLabel('Statut').selectOption({ label: 'Résolue' });
  // Toute la ligne ouvre le détail (tableaux refaits) : plus de bouton dans la cellule.
  await owner.getByRole('row', { name: /De l'eau.*Résolue/ }).first().click();
  for (const step of ['Demande créée', 'Affectée', 'Acceptée', 'Traitement commencé', 'Résolue']) {
    await expect(owner.getByRole('listitem').filter({ hasText: step }).first()).toBeVisible();
  }
  await expect(owner.getByRole('dialog').getByText(/De l'eau × 2/)).toBeVisible();
  await owner.keyboard.press('Escape');

  await owner.getByRole('link', { name: 'Rapport' }).click();
  await expect(owner.getByText('Prise en charge médiane')).toBeVisible();
  await expect(owner.getByRole('rowheader', { name: /De l'eau/ })).toBeVisible();
  await expect(owner.getByRole('rowheader', { name: /Koffi Yao/ })).toBeVisible();

  await owner.getByRole('link', { name: 'Journal' }).click();
  await expect(owner.getByText('Membre ajouté')).toBeVisible();
  await expect(owner.getByText('Table créée')).toBeVisible();
});

test('le gérant configure types de demande et règles d’escalade', async () => {
  await owner.getByRole('link', { name: 'Paramètres' }).click();
  await owner.getByLabel('Délai entre deux demandes (secondes)').fill('0');
  await owner.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(owner.getByText('Paramètres enregistrés')).toBeVisible();

  await owner.getByRole('tab', { name: 'Types de demande' }).click();
  await owner.getByRole('button', { name: 'Ajouter' }).click();
  await owner.getByLabel('Libellé').fill('Un café');
  await owner.getByRole('button', { name: 'Café', exact: true }).click();
  await owner.getByRole('button', { name: 'Ajouter', exact: true }).last().click();
  await expect(owner.getByText('Un café')).toBeVisible();

  await owner.getByRole('tab', { name: 'Escalade' }).click();
  await expect(owner.getByText('Non prise en charge après 5 min')).toBeVisible();
  await owner.getByRole('button', { name: 'Ajouter' }).click();
  await owner.getByLabel('Nom', { exact: true }).fill('Addition lente');
  await owner.getByLabel('Après (minutes)').fill('2');
  await owner.getByRole('button', { name: 'Ajouter', exact: true }).last().click();
  await expect(owner.getByText('Addition lente')).toBeVisible();

  // Le nouveau type est proposé au client après actualisation.
  await guest.reload();
  await expect(guest.getByRole('button', { name: 'Un café' })).toBeVisible();
});

test('la fermeture de session par le personnel coupe le téléphone du client', async () => {
  // Spec 006, R12 : « Salle » est retirée, la fenêtre de la table dans « Tables » ferme les sessions.
  await owner.getByRole('link', { name: 'Tables' }).click();
  await owner.getByRole('button', { name: /^Table 12,/ }).click();
  await owner.getByRole('button', { name: 'Fermer les sessions' }).click();
  await expect(owner.getByText(/sessions? fermées?/)).toBeVisible();
  await expect(guest.getByRole('heading', { name: 'Session terminée' })).toBeVisible();

  await guest.getByRole('button', { name: 'Rouvrir une session' }).click();
  await expect(guest.getByRole('heading', { level: 1 })).toContainText('Table 12');
});

test('un QR inconnu est refusé proprement', async ({ browser }) => {
  const page = await newPage(browser, MOBILE);
  await page.goto('/t/AAAAAAAAAAAAAAAAAAAAAAAA');
  await expect(page.getByRole('heading', { name: 'QR code non valide' })).toBeVisible();
  await page.context().close();
});

test('l’espace de service reste utilisable sur tablette, et la déconnexion ferme l’accès', async () => {
  await waiter.setViewportSize({ width: 820, height: 1180 });
  await waiter.goto('/app/service');
  await expect(waiter.getByRole('heading', { name: 'Service' })).toBeVisible();
  await expectNoHorizontalScroll(waiter);
  await owner.setViewportSize(MOBILE);
  await owner.goto('/app/dashboard');
  await expect(owner.getByRole('heading', { name: 'Plan de salle' })).toBeVisible();
  await expectNoHorizontalScroll(owner);

  await waiter.getByRole('button', { name: 'Mon compte' }).click();
  await waiter.getByRole('menuitem', { name: 'Se déconnecter' }).click();
  await expect(waiter).toHaveURL((url) => url.pathname === '/');
  await waiter.goto('/app/service');
  await expect(waiter).toHaveURL(/\/\?next=%2Fapp%2Fservice/);
});
