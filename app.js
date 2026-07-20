(() => {
  "use strict";

  const config = window.STRESS_CONFIG ?? {};
  const state = {
    selectedAmount: Number(config.presetAmounts?.[1] ?? config.minimumDonation ?? 1),
    totalCents: 0,
    donationCount: 0,
    currency: String(config.currency ?? "EUR").toUpperCase(),
    loadingCheckout: false
  };

  const $ = (id) => document.getElementById(id);
  const elements = {
    ownerName: $("owner-name"), footerOwner: $("footer-owner"), message: $("message"),
    stressValue: $("stress-value"), stressLabel: $("stress-label"), meterFill: $("meter-fill"),
    meterTrack: document.querySelector(".meter-track"), totalDonated: $("total-donated"),
    donationCount: $("donation-count"), stressRemoved: $("stress-removed"), goalCopy: $("goal-copy"),
    goalFill: $("goal-fill"), lastUpdated: $("last-updated"), ratioCopy: $("ratio-copy"),
    presetButtons: $("preset-buttons"), customAmount: $("custom-amount"), donateButton: $("donate-button"),
    donateButtonLabel: $("donate-button-label"), paymentStatus: $("payment-status"), toast: $("toast")
  };

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function formatCurrency(cents) {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: state.currency }).format(cents / 100);
  }
  function formatNumber(value, digits = 0) {
    return new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  }
  function backendReady() {
    return Boolean(config.paymentsEnabled && String(config.functionsBaseUrl ?? "").startsWith("https://"));
  }
  function functionsUrl(path) {
    return `${String(config.functionsBaseUrl).replace(/\/$/, "")}/${path}`;
  }
  function stressStatus(stress) {
    if (stress <= 0) return "Pace interiore raggiunta";
    if (stress <= 25) return "Quasi zen";
    if (stress <= 50) return "Sotto controllo";
    if (stress <= 75) return "Stress importante";
    if (stress < 100) return "Zona critica";
    return "Allarme massimo";
  }
  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    window.setTimeout(() => { elements.toast.hidden = true; }, 6500);
  }

  function calculate() {
    const initialStress = clamp(Number(config.initialStress ?? 100), 0, 100);
    const eurosPerPoint = Math.max(Number(config.eurosPerStressPoint ?? 1), 0.01);
    const donatedEuros = state.totalCents / 100;
    const removedPoints = donatedEuros / eurosPerPoint;
    const currentStress = clamp(initialStress - removedPoints, 0, 100);
    const goalEuros = initialStress * eurosPerPoint;
    const goalCents = Math.round(goalEuros * 100);
    const goalProgress = goalCents > 0 ? clamp((state.totalCents / goalCents) * 100, 0, 100) : 100;
    return { initialStress, eurosPerPoint, removedPoints, currentStress, goalCents, goalProgress };
  }

  function renderMeter() {
    const calc = calculate();
    const displayStress = Math.round(calc.currentStress * 10) / 10;
    elements.stressValue.textContent = formatNumber(displayStress, Number.isInteger(displayStress) ? 0 : 1);
    elements.stressLabel.textContent = stressStatus(calc.currentStress);
    elements.meterFill.style.width = `${calc.currentStress}%`;
    elements.meterTrack.setAttribute("aria-valuenow", String(Math.round(calc.currentStress)));
    elements.totalDonated.textContent = formatCurrency(state.totalCents);
    elements.donationCount.textContent = new Intl.NumberFormat("it-IT").format(state.donationCount);
    elements.stressRemoved.textContent = `${formatNumber(Math.min(calc.removedPoints, calc.initialStress), 1)}%`;
    elements.goalCopy.textContent = `${formatCurrency(state.totalCents)} di ${formatCurrency(calc.goalCents)} per riportarlo allo 0%`;
    elements.goalFill.style.width = `${calc.goalProgress}%`;
    elements.ratioCopy.textContent = calc.eurosPerPoint === 1 ? "1 €" : `${formatNumber(calc.eurosPerPoint, 2)} €`;
  }

  function renderIdentity() {
    const owner = String(config.ownerName ?? "Gaetano");
    elements.ownerName.textContent = owner;
    elements.footerOwner.textContent = owner;
    elements.message.textContent = String(config.message ?? "Situazione sotto osservazione.");
    document.title = `Stressometro di ${owner}`;
  }

  function selectAmount(amount, source = "preset") {
    const min = Number(config.minimumDonation ?? 1);
    const max = Number(config.maximumDonation ?? 1000);
    const normalized = clamp(Number(amount || min), min, max);
    state.selectedAmount = Math.round(normalized * 100) / 100;
    document.querySelectorAll(".amount-button").forEach((button) => {
      button.classList.toggle("active", source === "preset" && Number(button.dataset.amount) === state.selectedAmount);
    });
    if (source === "preset") elements.customAmount.value = "";
    updateDonateButton();
  }

  function renderAmountButtons() {
    const amounts = Array.isArray(config.presetAmounts) ? config.presetAmounts : [1, 5, 10, 25];
    elements.presetButtons.innerHTML = "";
    amounts.forEach((amount) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "amount-button";
      button.dataset.amount = String(amount);
      button.textContent = formatCurrency(Number(amount) * 100).replace(",00", "");
      button.addEventListener("click", () => selectAmount(Number(amount), "preset"));
      elements.presetButtons.appendChild(button);
    });
    selectAmount(state.selectedAmount, "preset");
  }

  function updateDonateButton() {
    const valid = Number.isFinite(state.selectedAmount) && state.selectedAmount >= Number(config.minimumDonation ?? 1) && state.selectedAmount <= Number(config.maximumDonation ?? 1000);
    elements.donateButton.disabled = !backendReady() || !valid || state.loadingCheckout;
    elements.donateButtonLabel.textContent = state.loadingCheckout
      ? "Apro Stripe…"
      : `Riduci di ${formatNumber(state.selectedAmount / Math.max(Number(config.eurosPerStressPoint ?? 1), .01), 1)} punti · ${formatCurrency(state.selectedAmount * 100)}`;

    if (!backendReady()) {
      elements.paymentStatus.textContent = "Modalità demo: collega Stripe e Supabase nel config per attivare i pagamenti reali.";
    } else if (!valid) {
      elements.paymentStatus.textContent = `Inserisci un importo tra ${formatCurrency(Number(config.minimumDonation ?? 1) * 100)} e ${formatCurrency(Number(config.maximumDonation ?? 1000) * 100)}.`;
    } else {
      elements.paymentStatus.textContent = "Sarai reindirizzato al Checkout sicuro di Stripe.";
    }
  }

  async function fetchStats({ silent = false } = {}) {
    if (!backendReady()) {
      state.totalCents = Math.max(0, Math.round(Number(config.demoTotalEuros ?? 0) * 100));
      state.donationCount = Math.max(0, Math.floor(Number(config.demoDonationCount ?? 0)));
      elements.lastUpdated.textContent = "Anteprima demo";
      renderMeter();
      return;
    }

    try {
      const url = new URL(functionsUrl("stats"));
      url.searchParams.set("campaign", String(config.campaignId));
      const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Stats HTTP ${response.status}`);
      const data = await response.json();
      state.totalCents = Math.max(0, Number(data.totalCents ?? 0));
      state.donationCount = Math.max(0, Number(data.donationCount ?? 0));
      state.currency = String(data.currency ?? config.currency ?? "EUR").toUpperCase();
      const date = data.updatedAt ? new Date(data.updatedAt) : new Date();
      elements.lastUpdated.textContent = `Aggiornato ${new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(date)}`;
      renderMeter();
    } catch (error) {
      console.error(error);
      elements.lastUpdated.textContent = "Dati temporaneamente non disponibili";
      if (!silent) showToast("Non riesco a leggere il totale in questo momento. Riproverò automaticamente.");
    }
  }

  async function startCheckout() {
    if (!backendReady() || state.loadingCheckout) return;
    state.loadingCheckout = true;
    updateDonateButton();
    try {
      const response = await fetch(functionsUrl("create-checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(state.selectedAmount * 100),
          campaignId: String(config.campaignId),
          returnUrl: `${window.location.origin}${window.location.pathname}`
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error ?? `Checkout HTTP ${response.status}`);
      window.location.assign(data.url);
    } catch (error) {
      console.error(error);
      showToast("Non sono riuscito ad aprire Stripe. Controlla la configurazione e riprova.");
      state.loadingCheckout = false;
      updateDonateButton();
    }
  }

  function handleReturnFromStripe() {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (!payment) return;
    if (payment === "success") {
      showToast("Pagamento ricevuto. Il meter si aggiornerà appena Stripe invia la conferma.");
      let attempts = 0;
      const poll = window.setInterval(async () => {
        attempts += 1;
        await fetchStats({ silent: true });
        if (attempts >= 8) window.clearInterval(poll);
      }, 2500);
    } else if (payment === "cancelled") {
      showToast("Pagamento annullato: nessun addebito è stato registrato.");
    }
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  }

  function init() {
    renderIdentity();
    renderAmountButtons();
    elements.customAmount.min = String(config.minimumDonation ?? 1);
    elements.customAmount.max = String(config.maximumDonation ?? 1000);
    elements.customAmount.addEventListener("input", (event) => selectAmount(Number(event.target.value), "custom"));
    elements.donateButton.addEventListener("click", startCheckout);
    handleReturnFromStripe();
    fetchStats();
    const seconds = Math.max(10, Number(config.refreshSeconds ?? 30));
    window.setInterval(() => fetchStats({ silent: true }), seconds * 1000);
  }

  init();
})();
