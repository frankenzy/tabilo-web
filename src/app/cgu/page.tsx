import type { Metadata } from 'next';
import { LegalPage } from '@/components/pages/legal/legal-page';
import { LEGAL_CONTACT } from '@/constants/legal';

export const metadata: Metadata = { title: 'Conditions d’utilisation' };

/** Spec 041, R1 : conditions d'utilisation. Brouillon rédigé par l'équipe produit, à faire relire par un juriste. */
export default function Page() {
  return (
    <LegalPage title="Conditions générales d’utilisation">
      <p>
        Les présentes conditions régissent l’utilisation du service TABILO (« le service ») par l’établissement qui ouvre un compte (« le client »). TABILO est
        édité par TABILO (« l’éditeur »), joignable par WhatsApp au {LEGAL_CONTACT}.
      </p>
      <h2>1. Le service</h2>
      <p>
        TABILO permet à un établissement de restauration de présenter sa carte à ses clients par un QR code posé sur les tables, de recevoir leurs commandes et
        leurs demandes, de les suivre avec son équipe et d’en consulter les chiffres. Le paiement des commandes se fait auprès de l’établissement ; TABILO
        n’encaisse aucune somme pour le compte du client.
      </p>
      <h2>2. Compte et accès</h2>
      <ul>
        <li>Le client désigne un propriétaire, responsable du compte, des membres de l’équipe qu’il invite et de leurs droits.</li>
        <li>Les identifiants sont personnels ; le client prévient l’éditeur sans délai de toute utilisation non autorisée.</li>
        <li>Le client garantit l’exactitude de sa carte, de ses prix et des informations affichées à ses clients.</li>
      </ul>
      <h2>3. Formules, essai et paiement</h2>
      <ul>
        <li>Le service est proposé selon les formules Essentiel, Pro et Premium, dont le contenu et le prix sont affichés dans la page « Abonnement ».</li>
        <li>Un essai gratuit de 7 jours en formule Pro est ouvert à l’inscription.</li>
        <li>
          L’abonnement se paie d’avance, pour 1, 3, 6 ou 12 mois, auprès de l’éditeur (espèces, Mobile Money ou virement) ; un reçu est remis pour chaque
          paiement.
        </li>
        <li>
          Sans paiement à l’échéance, le service continue pendant un délai de grâce de 7 jours, puis il est suspendu. Aucune donnée n’est effacée du fait de la
          suspension ; le service reprend dès le paiement.
        </li>
      </ul>
      <h2>4. Disponibilité</h2>
      <p>
        L’éditeur met en œuvre des moyens raisonnables pour assurer la disponibilité du service, sans garantie d’absence d’interruption, notamment en cas de
        maintenance, de panne d’un prestataire d’hébergement ou de coupure du réseau internet.
      </p>
      <h2>5. Données</h2>
      <p>
        Le client reste propriétaire des données qu’il saisit (carte, photos, tables, équipe, commandes). Il peut les télécharger à tout moment depuis la page
        « Abonnement ». Le traitement des données personnelles est décrit dans la politique de confidentialité.
      </p>
      <h2>6. Résiliation</h2>
      <p>
        Le client peut demander la fermeture de son compte à l’éditeur. Le compte est fermé aussitôt, puis ses données sont effacées à la fin d’un délai
        convenu (7 jours par défaut), pendant lequel il peut être rétabli. Les paiements d’abonnement restent conservés sous forme anonyme pour la
        comptabilité de l’éditeur.
      </p>
      <h2>7. Responsabilité</h2>
      <p>
        L’éditeur n’est pas responsable des relations entre le client et ses propres clients (qualité des plats, prix, encaissement). Sa responsabilité, si elle
        était engagée, est limitée au montant des sommes versées par le client au cours des trois derniers mois.
      </p>
      <h2>8. Modification et droit applicable</h2>
      <p>
        L’éditeur peut faire évoluer ces conditions ; la nouvelle version est présentée au propriétaire, qui l’accepte pour continuer à utiliser le service.
        Les présentes conditions sont soumises au droit ivoirien.
      </p>
    </LegalPage>
  );
}
