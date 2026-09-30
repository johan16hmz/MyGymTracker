# Emails MyGymTracker — modèles validés

Design et textes validés par Johan le 30 septembre 2026.

Ces modèles ne sont pas encore appliqués au projet Supabase : le tableau de
bord exige un SMTP personnalisé avant de modifier les sujets et contenus.
Le SMTP personnalisé est actuellement désactivé. Les emails restent donc ceux
par défaut de Supabase, et les vrais envois n'ont pas été testés.

| Modèle Supabase | Sujet proposé | Fichier HTML |
| --- | --- | --- |
| Confirm sign up | Confirme ton inscription à MyGymTracker | `confirm-signup.html` |
| Reset password | Réinitialise ton mot de passe MyGymTracker | `reset-password.html` |

Nom d'expéditeur validé : **MyGymTracker**. L'adresse de départ reste à choisir avec
le fournisseur SMTP et le futur domaine, par exemple `no-reply@votre-domaine`.

Les modèles utilisent la variable native Supabase `{{ .ConfirmationURL }}`
pour les liens à usage unique et `{{ .SiteURL }}` pour le logo PNG existant.
Pas de JavaScript, pas de police externe ni de pixels de suivi. Structure en
tables et styles en ligne pour les clients email ; l'aperçu navigateur ne
remplace pas une vérification dans Gmail, Outlook et Apple Mail.

Ouvrir `/design/emails/preview.html` sur le serveur Vite local pour visualiser
les mêmes fichiers avec des liens fictifs, en format ordinateur ou téléphone.

Pour activer les modèles validés :

1. Choisir/configurer le SMTP dans Supabase, avec le domaine de l'expéditeur
   vérifié (SPF/DKIM et DMARC adaptés au fournisseur).
2. Copier chaque sujet et son HTML dans Authentication > Emails > Templates.
3. Le parcours « Mot de passe oublié » est intégré dans l'application ; vérifier
   que le dernier commit est déployé avant les tests réels.
4. Autoriser l'URL de retour `https://votre-domaine/?auth=recovery` dans Supabase.
   Le domaine Vercel actuel autorise déjà ses chemins via `/**`.
5. Tester une inscription et une récupération avec un compte de test, sur un
   ordinateur et sur téléphone. Aucun email réel n'a été envoyé pour l'aperçu.

Le lien de récupération revient à la racine de l'application avec
`?auth=recovery`, puis Supabase établit la session de récupération. L'écran
affiche une erreur si le lien est expiré ou invalide. Une demande de récupération
renvoie un message générique pour éviter d'indiquer si un compte existe.

Référence : [modèles email Supabase](https://supabase.com/docs/guides/auth/auth-email-templates).

Attention : sans SMTP personnalisé, le service par défaut est destiné aux
tests et restreint les destinataires aux membres de l'organisation du projet.
Ne pas désactiver la confirmation des emails pour contourner cette limitation.
Référence : [SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp).
