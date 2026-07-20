/**
 * Questo è l'unico file da modificare per cambiare il meter.
 * Non inserire MAI chiavi Stripe o Supabase segrete: il repository è pubblico.
 */
window.STRESS_CONFIG = {
  ownerName: "Gaetano",
  initialStress: 100,
  message: "Esami, lavoro e caldo: ogni aiuto abbassa ufficialmente il livello di panico.",

  // 1 significa: ogni €1 ricevuto elimina 1 punto percentuale di stress.
  eurosPerStressPoint: 1,

  // Cambia questo ID per iniziare una nuova campagna con totale separato.
  campaignId: "stress-estate-2026",

  currency: "EUR",
  presetAmounts: [1, 5, 10, 25],
  minimumDonation: 1,
  maximumDonation: 1000,

  functionsBaseUrl: "https://rlllqvrwbcjpjphashth.supabase.co/functions/v1",

  paymentsEnabled: true,

  // Serve per vedere subito il design prima del collegamento reale.
  // Viene ignorato quando paymentsEnabled è true.
  demoTotalEuros: 10,
  demoDonationCount: 1,

  refreshSeconds: 30
};
