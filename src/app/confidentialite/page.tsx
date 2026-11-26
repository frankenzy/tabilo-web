import type { Metadata } from 'next';
import { LegalPage } from '@/components/pages/legal/legal-page';
import { LEGAL_CONTACT } from '@/constants/legal';

export const metadata: Metadata = { title: 'Confidentialité' };

/** Spec 041, R1 : politique de confidentialité. Brouillon rédigé par l'équipe produit, à faire relire par un juriste. */
export default function Page() {
  return (
    <LegalPage title="Politique de confidentialité">
      <p>
        Cette politique explique quelles données personnelles TABILO traite, pourquoi, combien de temps, et comment exercer vos droits, conformément à la loi
        ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel. Contact pour toute question ou demande : WhatsApp{' '}
        {LEGAL_CONTACT}.
      </p>
      <h2>1. Qui est responsable ?</h2>
      <p>
        Pour les comptes des restaurants et de leurs équipes, le responsable de traitement est l’éditeur, TABILO. Pour les commandes passées par les clients à
        table, l’établissement est responsable de traitement et TABILO agit pour son compte.
      </p>
      <h2>2. Quelles données ?</h2>
      <ul>
        <li>Équipe des établissements : nom, prénom, adresse e-mail, rôle, historique des connexions et des actions (journal).</li>
        <li>Clients à table : aucun compte ni nom. Une session anonyme liée à la table, les commandes et demandes passées, et, si l’établissement l’a activé, une distance approximative à l’établissement au moment de commander (jamais la position elle-même).</li>
        <li>Données techniques : adresse IP et type d’appareil, pour la sécurité.</li>
      </ul>
      <h2>3. Pourquoi ?</h2>
      <ul>
        <li>Fournir le service : transmettre les commandes, les suivre, calculer l’addition et les chiffres de l’établissement.</li>
        <li>Sécuriser les comptes : limiter les tentatives de connexion, tracer les actions sensibles.</li>
        <li>Gérer l’abonnement : formule, échéance, paiements et reçus.</li>
      </ul>
      <h2>4. Combien de temps ?</h2>
      <ul>
        <li>Adresses IP du journal : 12 mois.</li>
        <li>Distance approximative d’une commande : 90 jours.</li>
        <li>Compte d’un membre d’équipe désactivé : anonymisé au bout de 24 mois.</li>
        <li>Compte fermé : effacé à la fin du délai convenu (7 jours par défaut) ; seuls les paiements d’abonnement restent, sous forme anonyme.</li>
      </ul>
      <h2>5. Où sont les données ?</h2>
      <p>
        Le service est hébergé chez des prestataires d’hébergement en nuage, dont les serveurs peuvent se trouver hors de Côte d’Ivoire. Les données y sont
        protégées par chiffrement des échanges et par un contrôle strict des accès ; chaque établissement n’accède qu’à ses propres données.
      </p>
      <h2>6. Cookies</h2>
      <p>
        TABILO n’utilise ni publicité ni mesure d’audience. Les seuls cookies sont ceux qui maintiennent votre connexion ; sur la page des clients à table, la
        session est conservée dans le navigateur le temps du repas.
      </p>
      <h2>7. Vos droits</h2>
      <p>
        Vous pouvez demander l’accès à vos données, leur rectification, leur effacement ou vous opposer à un traitement, en écrivant par WhatsApp au{' '}
        {LEGAL_CONTACT}. Le propriétaire d’un établissement peut aussi télécharger toutes les données de son compte depuis la page « Abonnement ». Vous pouvez
        saisir l’Autorité de Régulation des Télécommunications/TIC de Côte d’Ivoire (ARTCI).
      </p>
    </LegalPage>
  );
}
