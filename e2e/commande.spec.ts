import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Spec 001 — carte et commande, dans de vrais navigateurs :
 * le gérant construit sa carte (bureau), le client commande (mobile), le service la traite,
 * et le montant apparaît dans les statistiques.
 */
const stamp = Date.now();
const OWNER = { email: `carte-${stamp}@example.test`, password: 'Motdepasse-gerant-1' };
const MOBILE = { width: 360, height: 780 }; // CA-002-13 : petit téléphone
const SHOTS = process.env.SCREENSHOT_DIR;

test.describe.configure({ mode: 'serial' });

let owner: Page;
let guest: Page;
let qrUrl: string;

async function newPage(browser: Browser, viewport = { width: 1366, height: 900 }): Promise<Page> {
  const context = await browser.newContext({ viewport, locale: 'fr-FR' });
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    throw error;
  });
  return page;
}

async function shot(page: Page, name: string, fullPage = true) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** Image PNG de 8 × 8 px, rouge, valide. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC',
  'base64',
);

/** Les montants formatés par Intl contiennent des espaces insécables. */
const money = (text: string) => new RegExp(text.replace(/ /g, '[\\s\\u00a0\\u202f]'));

test.beforeAll(async ({ browser }) => {
  owner = await newPage(browser);
  guest = await newPage(browser, MOBILE);
});

test('le gérant ouvre son établissement et une table', async () => {
  await owner.goto('/inscription');
  await owner.getByLabel('Entreprise').fill('Chez Tantie SARL');
  await owner.getByLabel('Nom de l’établissement').fill('Chez Tantie');
  await owner.getByLabel('Prénom').fill('Awa');
  await owner.getByLabel('Nom', { exact: true }).fill('Koné');
  await owner.getByLabel('Adresse e-mail').fill(OWNER.email);
  await owner.getByLabel('Mot de passe').fill(OWNER.password);
  await owner.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(owner).toHaveURL(/\/app\/tables/);

  await owner.getByRole('button', { name: 'Créer une zone' }).click();
  await owner.getByLabel('Nom de la zone').fill('Salle');
  await owner.getByRole('button', { name: 'Créer la zone' }).click();
  await owner.getByRole('button', { name: 'Nouvelle table' }).click();
  await owner.getByLabel('Nom ou numéro').fill('7');
  await owner.getByRole('button', { name: 'Créer la table' }).click();
  await owner.getByRole('button', { name: /^Table 7,/ }).click();
  await owner.getByRole('button', { name: 'QR code' }).click();
  qrUrl = (await owner.getByText(/\/t\/[\w-]+$/).textContent()) ?? '';
  expect(qrUrl).toMatch(/\/t\/[\w-]{20,}$/);
  await owner.keyboard.press('Escape');

  // Le test enchaîne commande et appel depuis le même téléphone : pas de délai entre deux demandes.
  await owner.getByRole('link', { name: 'Paramètres' }).click();
  await owner.getByLabel('Délai entre deux demandes (secondes)').fill('0');
  await owner.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(owner.getByText('Paramètres enregistrés')).toBeVisible();
});

test('CA-001-01, 03, 05, 07, 27 — le gérant construit sa carte', async () => {
  await owner.getByRole('link', { name: 'Menus' }).click();
  await expect(owner.getByText('Votre carte est vide')).toBeVisible();

  // CA-003-02 : chaque rubrique reçoit un pictogramme.
  for (const [name, pictogram] of [['Boissons', 'Boisson, soda'], ['Plats', 'Plats'], ['Desserts', 'Glace']]) {
    await owner.getByRole('button', { name: /Créer une rubrique|Nouvelle rubrique/ }).click();
    await owner.getByLabel('Nom').fill(name);
    await owner.getByRole('dialog').getByRole('button', { name: pictogram, exact: true }).click();
    await expect(owner.getByRole('dialog').getByRole('button', { name: pictogram, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await owner.getByRole('button', { name: 'Créer', exact: true }).click();
    await expect(owner.getByRole('heading', { name: new RegExp(`^${name}`) })).toBeVisible();
  }

  const addItem = async (category: string, name: string, price: string) => {
    const card = owner.locator('section').filter({ has: owner.getByRole('heading', { name: new RegExp(`^${category}`) }) });
    await card.getByRole('button', { name: 'Ajouter un article' }).click();
    const dialog = owner.getByRole('dialog');
    await dialog.getByLabel('Nom').fill(name);
    await dialog.getByLabel(/Prix/).fill(price);
    await dialog.getByRole('button', { name: 'Ajouter' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card.getByText(name, { exact: true })).toBeVisible();
  };
  await addItem('Plats', 'Garba', '1500');
  await addItem('Plats', 'Alloco', '1000');
  await addItem('Boissons', 'Bissap', '500');
  await addItem('Desserts', 'Dêguê', '1000');

  // Un prix invalide est refusé avant l'envoi.
  await owner.getByRole('button', { name: 'Ajouter un article' }).first().click();
  await owner.getByRole('dialog').getByLabel('Nom').fill('Erreur');
  await owner.getByRole('dialog').getByLabel(/Prix/).fill('12,5');
  await owner.getByRole('dialog').getByRole('button', { name: 'Ajouter' }).click();
  await expect(owner.getByRole('dialog').getByText('Prix invalide.')).toBeVisible();
  await owner.keyboard.press('Escape');

  // CA-001-07 : photo choisie dans le navigateur, réduite, envoyée (PUT) puis affichée.
  await owner.locator('li').filter({ hasText: 'Garba' }).getByRole('button', { name: 'Modifier' }).click();
  await owner.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'garba.png', mimeType: 'image/png', buffer: PNG });
  await expect(owner.getByRole('dialog').getByRole('img', { name: 'Aperçu' })).toBeVisible();
  await owner.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(owner.getByRole('dialog')).toHaveCount(0);
  await expect(owner.getByRole('img', { name: 'Garba' })).toBeVisible();
  await expect.poll(() => owner.getByRole('img', { name: 'Garba' }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // Plats passe avant Boissons.
  await owner.getByRole('button', { name: 'Monter la rubrique Plats' }).click();
  await expect(owner.getByRole('heading', { level: 2 }).first()).toContainText('Plats');

  // Rupture d'Alloco.
  const alloco = owner.locator('li').filter({ hasText: 'Alloco' }).getByLabel('Disponible');
  await alloco.click();
  await expect(alloco).not.toBeChecked();
  await expect(owner.locator('li').filter({ hasText: 'Alloco' }).getByText('Épuisé')).toBeVisible();
  await shot(owner, '01-carte-gerant');
});

test('CA-001-12, 05, 14 et CA-002-01 à 09, 12, 13 — le client choisit par l’image et commande depuis son téléphone', async () => {
  await guest.goto(qrUrl);
  await expect(guest.getByRole('heading', { level: 1 })).toContainText('Table 7');
  // CA-004-01 : page unique, la carte est visible dès l'ouverture, sans onglet.
  await expect(guest.getByRole('tab')).toHaveCount(0);

  // Grille photo : Garba a une photo, les autres une initiale ; Alloco est épuisé, sans « + ».
  await expect(guest.getByRole('heading', { name: 'Plats' })).toBeVisible();
  await expect(guest.getByRole('img', { name: 'Garba' })).toBeVisible();
  // Image réellement chargée (une image bloquée par la CSP reste « visible » par son texte alternatif).
  await expect.poll(() => guest.getByRole('img', { name: 'Garba' }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(guest.getByRole('button', { name: /^Alloco, .*épuisé/ })).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Ajouter Alloco' })).toHaveCount(0);
  await expectNoHorizontalScroll(guest);

  // Rubriques fixes, en images (CA-003-01) : un appui amène à la rubrique et la met en évidence.
  const chips = guest.getByRole('navigation', { name: 'Rubriques de la carte' });
  for (const name of ['Plats', 'Boissons', 'Desserts']) {
    await expect(chips.getByRole('button', { name }).locator('svg')).toBeVisible();
  }
  // CA-003-05 : les actions portent une icône.
  await expect(guest.getByRole('button', { name: 'Serveur', exact: true }).locator('svg')).toBeVisible();
  await chips.getByRole('button', { name: 'Desserts' }).click();
  await expect(chips.getByRole('button', { name: 'Desserts' })).toHaveAttribute('aria-current', 'true');
  await expect(guest.getByRole('heading', { name: 'Desserts' })).toBeInViewport();
  await chips.getByRole('button', { name: 'Plats' }).click();

  // CA-005-02 : recherche sans accents ; aucun résultat ; la croix rétablit la carte.
  const search = guest.getByRole('searchbox', { name: 'Rechercher dans la carte' });
  await search.fill('degue');
  await expect(guest.getByRole('button', { name: /^Dêguê,/ })).toBeVisible();
  await expect(guest.getByRole('button', { name: /^Garba,/ })).toHaveCount(0);
  await search.fill('zzz');
  await expect(guest.getByText('Aucun plat trouvé')).toBeVisible();
  await guest.getByRole('button', { name: 'Effacer la recherche' }).first().click();
  await expect(guest.getByRole('button', { name: /^Garba,/ })).toBeVisible();

  // CA-005-01, 04 : en bas de page, recherche, cloche et tuiles restent visibles.
  await guest.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(search).toBeInViewport();
  await expect(guest.getByRole('button', { name: 'Serveur', exact: true })).toBeInViewport();
  await expect(chips).toBeInViewport();
  // CA-005-07 : le bouton flottant « Serveur » reste en bas à droite et ouvre la fenêtre d'appel.
  const floating = guest.getByRole('button', { name: 'Appeler le serveur', exact: true });
  await expect(floating).toBeInViewport();
  await floating.click();
  await expect(guest.getByRole('dialog', { name: 'De quoi avez-vous besoin ?' })).toBeVisible();
  await guest.keyboard.press('Escape');
  await guest.evaluate(() => window.scrollTo(0, 0));

  // « + » sur la photo, puis la fiche pour passer à 2.
  await guest.getByRole('button', { name: 'Ajouter Garba' }).click();
  await guest.getByRole('button', { name: '1 Garba dans la commande, modifier' }).click();
  const itemSheet = guest.getByRole('dialog', { name: 'Garba' });
  await itemSheet.getByRole('button', { name: 'Ajouter un Garba' }).click();
  await itemSheet.getByRole('button', { name: /Mettre à jour/ }).click();
  // CA-003-09 : crochets verts, un par unité.
  await expect(guest.getByRole('img', { name: '2 sélectionnés' }).locator('svg')).toHaveCount(2);
  await guest.getByRole('button', { name: 'Ajouter Bissap' }).click();
  await expect(guest.getByRole('img', { name: '1 sélectionné' }).locator('svg')).toHaveCount(1);

  const bar = guest.getByRole('button', { name: /Voir la commande/ });
  await expect(bar).toContainText('3');
  await expect(bar).toContainText(money('3 500 F CFA'));
  await expectNoHorizontalScroll(guest);
  await guest.evaluate(() => window.scrollTo(0, 0));
  await guest.waitForTimeout(300);
  await shot(guest, '02-carte-client', false);

  // La commande survit à un rechargement.
  await guest.reload();
  await guest.getByRole('button', { name: /Voir la commande/ }).click();
  const screen = guest.getByRole('dialog', { name: 'Votre commande' });
  await expect(screen.getByText('Total de la commande')).toBeVisible();
  await expect(screen.getByRole('button', { name: 'Commander' }).locator('svg')).toBeVisible();
  await expect(screen.getByText(money('3 500 F CFA'))).toBeVisible();
  // Suggestion : sans historique, un article d'une rubrique absente de la commande.
  await expect(screen.getByRole('region', { name: 'Souvent commandés avec' }).getByRole('button', { name: 'Ajouter Dêguê' })).toBeVisible();
  await screen.getByLabel('Une précision ? (facultatif)').fill('Sans piment');
  await guest.waitForTimeout(400); // fin de l'animation d'ouverture
  await shot(guest, '03-votre-commande', false);

  // « Ajouter d’autres articles » ramène à la carte sans rien perdre.
  await screen.getByRole('button', { name: 'Ajouter d’autres articles' }).click();
  await expect(guest.getByRole('button', { name: /Voir la commande/ })).toContainText(money('3 500 F CFA'));
  await guest.getByRole('button', { name: /Voir la commande/ }).click();
  await guest.getByRole('dialog', { name: 'Votre commande' }).getByLabel('Une précision ? (facultatif)').fill('Sans piment');
  await guest.getByRole('dialog', { name: 'Votre commande' }).getByRole('button', { name: 'Commander' }).click();

  const tracking = guest.getByRole('region', { name: 'Vos demandes en cours' });
  await expect(tracking.getByText('Votre commande est bien reçue')).toBeVisible();
  // CA-003-06 : quatre étapes en pictogrammes, la première atteinte.
  await expect(tracking.getByRole('list', { name: 'Avancement' }).locator('svg')).toHaveCount(4);
  await expect(tracking.getByText('Garba')).toBeVisible();
  await expect(tracking.getByText(money('3 500 F CFA'))).toBeVisible();
  await expect(guest.getByRole('button', { name: /Voir la commande/ })).toHaveCount(0);
  // CA-004-04 : le suivi est au-dessus de la carte, en haut de page.
  await expect(tracking).toBeInViewport();
  await shot(guest, '04-suivi-client', false);

  // CA-005-05 : la tuile bleue « Eau » appelle directement la demande d'eau.
  await guest.getByRole('button', { name: 'De l’eau, appeler le serveur' }).click();
  const water = guest.getByRole('dialog', { name: 'De l\'eau' });
  // CA-005-06 : la bouteille, la quantité, le bouton ; pas de précision à écrire.
  await expect(water.getByRole('img', { name: 'Bouteille d’eau' })).toBeVisible();
  await expect(water.getByLabel('Une précision ? (facultatif)')).toHaveCount(0);
  await water.getByRole('button', { name: 'Une bouteille de plus' }).click();
  await expect(water.getByLabel('2 bouteilles')).toBeVisible();
  await guest.waitForTimeout(300);
  await shot(guest, '06-eau', false);
  await water.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(tracking.getByText('De l\'eau')).toBeVisible();
  await expect(tracking.getByText('× 2')).toBeVisible();
  await expect(guest.getByRole('button', { name: 'De l’eau, déjà demandé' })).toBeDisabled();

  // CA-004-02 : « Serveur » ouvre les demandes, puis la confirmation habituelle.
  await guest.getByRole('button', { name: 'Serveur', exact: true }).click();
  const needs = guest.getByRole('dialog', { name: 'De quoi avez-vous besoin ?' });
  await expect(needs.getByRole('button', { name: 'Appeler un serveur' })).toBeVisible();
  await guest.waitForTimeout(400);
  await shot(guest, '05-serveur', false);
  await guest.keyboard.press('Escape');
  // CA-004-03 : déjà demandé.
  await guest.getByRole('button', { name: 'Serveur', exact: true }).click();
  await expect(guest.getByRole('dialog', { name: 'De quoi avez-vous besoin ?' }).getByRole('button', { name: /De l'eau.*Déjà demandé/ })).toBeDisabled();
  await guest.keyboard.press('Escape');
});

test('CA-001-22, 23 — le service reçoit la commande avec son contenu et la traite', async () => {
  await owner.getByRole('link', { name: 'Service' }).click();
  const card = owner.getByRole('article', { name: /Table 7, Commande/ });
  await expect(card).toBeVisible();
  await expect(card.getByText('Garba')).toBeVisible();
  await expect(card.getByText(money('3 500 F CFA'))).toBeVisible();
  await expect(card.getByText('« Sans piment »')).toBeVisible();
  await shot(owner, '05-service');

  await card.getByRole('button', { name: 'Accepter' }).click();
  await expect(guest.getByText('Awa s’en occupe.')).toBeVisible();
  await owner.getByRole('tab', { name: /Les miennes/ }).click();
  await owner.getByRole('article', { name: /Table 7/ }).getByRole('button', { name: 'Commencer' }).click();
  await owner.getByRole('article', { name: /Table 7/ }).getByRole('button', { name: 'Terminer' }).click();
  await expect(guest.getByText('Traitée')).toBeVisible();
});

test('CA-001-13, R14 — commande suspendue : la carte reste consultable, sans panier', async () => {
  await owner.getByRole('link', { name: 'Paramètres' }).click();
  await owner.getByRole('tab', { name: 'Types de demande' }).click();
  const row = owner.locator('li').filter({ hasText: 'Commandes de la carte' });
  await expect(row.getByRole('button', { name: 'Supprimer' })).toHaveCount(0);
  await row.getByRole('button', { name: 'Modifier' }).click();
  await owner.getByLabel('Commande en ligne ouverte').uncheck();
  await owner.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(owner.getByText('Type modifié')).toBeVisible();

  await guest.reload();
  await expect(guest.getByText('La commande en ligne est suspendue.')).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Ajouter Garba' })).toHaveCount(0);

  await row.getByRole('button', { name: 'Modifier' }).click();
  await owner.getByLabel('Commande en ligne ouverte').check();
  await owner.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(owner.getByText('Type modifié')).toBeVisible();
});

test('CA-001-29, 30 — le montant servi apparaît dans les statistiques', async () => {
  await owner.getByRole('link', { name: 'Rapport' }).click();
  // Contre `next dev`, la première visite compile la page : on laisse le temps d'arriver.
  await expect(owner.getByRole('heading', { name: 'Rapport', level: 1 })).toBeVisible({ timeout: 60_000 });
  const sales = owner.getByRole('region', { name: 'Ventes' });
  await expect(sales.getByText('Montant des commandes servies')).toBeVisible();
  await expect(sales.getByText(money('3 500 F CFA')).first()).toBeVisible();
  await expect(sales.getByRole('rowheader', { name: 'Garba' })).toBeVisible();
  await expect(owner.getByRole('columnheader', { name: 'Montant' }).first()).toBeVisible();
  await shot(owner, '06-statistiques');
});
