param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$StripeSecretKey,
  [Parameter(Mandatory=$true)][string]$StripeWebhookSecret,
  [Parameter(Mandatory=$true)][string]$GitHubPagesOrigin
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI non trovato. Installalo prima di eseguire lo script."
}

supabase link --project-ref $ProjectRef
supabase db push
supabase secrets set `
  STRIPE_SECRET_KEY=$StripeSecretKey `
  STRIPE_WEBHOOK_SECRET=$StripeWebhookSecret `
  ALLOWED_ORIGINS=$GitHubPagesOrigin `
  DONATION_CURRENCY=eur `
  MIN_DONATION_CENTS=100 `
  MAX_DONATION_CENTS=100000
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy stats

Write-Host "Backend pubblicato. Inserisci nel config.js:"
Write-Host "functionsBaseUrl: https://$ProjectRef.supabase.co/functions/v1"
Write-Host "paymentsEnabled: true"
