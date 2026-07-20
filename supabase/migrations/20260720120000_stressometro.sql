create table if not exists public.stress_campaigns (
  id text primary key,
  total_cents bigint not null default 0 check (total_cents >= 0),
  donation_count integer not null default 0 check (donation_count >= 0),
  currency text not null default 'eur',
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_donations (
  session_id text primary key,
  event_id text not null unique,
  campaign_id text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null,
  created_at timestamptz not null default now()
);

create index if not exists stripe_donations_campaign_idx
  on public.stripe_donations (campaign_id, created_at desc);

alter table public.stress_campaigns enable row level security;
alter table public.stripe_donations enable row level security;

-- Nessuna policy pubblica: i dati vengono letti/scritti esclusivamente dalle Edge Functions.

create or replace function public.record_stripe_donation(
  p_session_id text,
  p_event_id text,
  p_campaign_id text,
  p_amount_cents bigint,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  was_inserted boolean := false;
  result_row public.stress_campaigns%rowtype;
begin
  if p_amount_cents <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.stripe_donations (
    session_id, event_id, campaign_id, amount_cents, currency
  ) values (
    p_session_id, p_event_id, p_campaign_id, p_amount_cents, lower(p_currency)
  )
  on conflict (session_id) do nothing;

  was_inserted := found;

  if was_inserted then
    insert into public.stress_campaigns (id, total_cents, donation_count, currency, updated_at)
    values (p_campaign_id, p_amount_cents, 1, lower(p_currency), now())
    on conflict (id) do update set
      total_cents = public.stress_campaigns.total_cents + excluded.total_cents,
      donation_count = public.stress_campaigns.donation_count + 1,
      currency = excluded.currency,
      updated_at = now();
  end if;

  select * into result_row from public.stress_campaigns where id = p_campaign_id;

  return jsonb_build_object(
    'inserted', was_inserted,
    'campaignId', p_campaign_id,
    'totalCents', coalesce(result_row.total_cents, 0),
    'donationCount', coalesce(result_row.donation_count, 0),
    'currency', coalesce(result_row.currency, lower(p_currency)),
    'updatedAt', coalesce(result_row.updated_at, now())
  );
end;
$$;

revoke all on function public.record_stripe_donation(text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_stripe_donation(text, text, text, bigint, text) to service_role;
