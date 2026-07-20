# Stressometro di Gaetano

Sito statico per GitHub Pages con pagamenti reali tramite Stripe Checkout e aggiornamento automatico del meter tramite Supabase Edge Functions.

## Regola del meter

Con la configurazione predefinita:

- stress iniziale: `100%`
- `1 €` ricevuto: `-1 punto`
- `10 €` ricevuti: da `100%` a `90%`
- il valore non scende mai sotto `0%`

La formula è:

```text
stress attuale = max(0, stress iniziale - euro ricevuti / euroPerStressPoint)
```

## Cosa contiene

- frontend senza framework, pronto per GitHub Pages
- `config.js` come unico file per impostare livello, messaggio e campagna
- importi rapidi e importo personalizzato
- Stripe Checkout: il sito non gestisce direttamente i dati della carta
- webhook Stripe con verifica della firma
- protezione dai webhook duplicati tramite `session_id`
- database Supabase con Row Level Security attiva e nessuna lettura pubblica diretta
- endpoint pubblico di sola lettura per il totale
- workflow GitHub Actions per il deploy

## 1. Anteprima locale

Da PowerShell nella cartella del progetto:

```powershell
python -m http.server 8080
```

Apri `http://localhost:8080`. All'inizio il sito è in modalità demo.

## 2. Crea il repository GitHub

Crea un repository pubblico, per esempio `stressometro`, e carica tutti i file di questa cartella.

Poi vai in:

```text
Repository → Settings → Pages → Source → GitHub Actions
```

Il workflow `.github/workflows/pages.yml` pubblicherà il sito a ogni push su `main`.

L'indirizzo sarà simile a:

```text
https://TUO-USERNAME.github.io/stressometro/
```

## 3. Crea il progetto Supabase

1. Crea un progetto su Supabase.
2. Installa la Supabase CLI.
3. Accedi con `supabase login`.
4. Dalla cartella del progetto esegui:

```powershell
supabase link --project-ref TUO_PROJECT_REF
supabase db push
```

Questo crea:

- `stress_campaigns`: totale e numero di contributi
- `stripe_donations`: ricevute tecniche usate per evitare doppi conteggi
- `record_stripe_donation`: funzione atomica per registrare il pagamento

## 4. Configura Stripe

1. Crea o apri il tuo account Stripe.
2. Completa verifica identità e conto bancario per ricevere gli accrediti.
3. Copia la chiave segreta di test `sk_test_...`.
4. In Stripe Workbench/Webhooks crea un endpoint:

```text
https://TUO_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

5. Seleziona gli eventi:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
```

6. Copia il signing secret `whsec_...`.

## 5. Inserisci i segreti Supabase

```powershell
supabase secrets set `
  STRIPE_SECRET_KEY=sk_test_... `
  STRIPE_WEBHOOK_SECRET=whsec_... `
  ALLOWED_ORIGINS=https://TUO-USERNAME.github.io `
  DONATION_CURRENCY=eur `
  MIN_DONATION_CENTS=100 `
  MAX_DONATION_CENTS=100000
```

`ALLOWED_ORIGINS` contiene solo l'origine, senza il percorso del repository. Puoi aggiungere più valori separati da virgola.

## 6. Pubblica le Edge Functions

```powershell
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy stats
```

In alternativa usa lo script:

```powershell
.\scripts\configure.ps1 `
  -ProjectRef "TUO_PROJECT_REF" `
  -StripeSecretKey "sk_test_..." `
  -StripeWebhookSecret "whsec_..." `
  -GitHubPagesOrigin "https://TUO-USERNAME.github.io"
```

## 7. Attiva il sito reale

In `config.js` modifica:

```js
functionsBaseUrl: "https://TUO_PROJECT_REF.supabase.co/functions/v1",
paymentsEnabled: true,
```

Poi fai commit e push.

## 8. Passa dalla modalità test alla modalità live

Quando i test funzionano:

1. attiva la modalità live di Stripe;
2. usa la chiave `sk_live_...` nei segreti Supabase;
3. crea un nuovo webhook in modalità live;
4. sostituisci `STRIPE_WEBHOOK_SECRET` con il relativo `whsec_...`;
5. effettua un piccolo pagamento reale e controlla il totale.

Non mettere mai `sk_test_`, `sk_live_`, `whsec_` o chiavi Supabase segrete nel repository o in `config.js`.

## Cambiare il livello manualmente

Modifica solo `config.js`:

```js
initialStress: 85,
message: "Settimana complicata.",
eurosPerStressPoint: 1
```

## Iniziare una nuova campagna

Cambia:

```js
campaignId: "stress-sessione-settembre-2026"
```

Il nuovo ID parte da zero senza cancellare lo storico della campagna precedente.

## Note importanti

- Il repository pubblico rende visibile il contenuto di `config.js`, ma soltanto chi ha permessi di scrittura può cambiare il sito pubblicato.
- I testi di Privacy e Condizioni sono modelli iniziali: vanno completati con contatti e politica di rimborso.
- Un contributo personale può avere implicazioni fiscali. Verifica con un professionista come dichiararlo nella tua situazione.
- Prima di accettare pagamenti reali, completa la verifica Stripe e prova tutto in modalità test.
