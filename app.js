const APP_VERSION = "0.25.1";
const APP_VERSION_DATE = "2026-06-17";

// ─── Locale / currency config ─────────────────────────────────────────────────
// To add a new market: add an entry to LOCALE_CONFIGS and add the corresponding
// Stripe price ID variables to index.html. Never hardcode currency symbols in UI.
//
// Detection uses navigator.language (full tag, e.g. "de-CH" vs "de-DE").
// - Swiss users: de-CH, fr-CH, it-CH, rm-CH  -> CHF
// - Polish users: pl, pl-PL                  -> PLN
// - German/Austrian: de, de-DE, de-AT        -> EUR
// - Everything else                          -> CHF (default)
//
// Prices set at purchasing power parity with CHF 9.90 (~0.14% of median salary):
//   Poland:          PLN 19/mo, PLN 169/yr
//   Germany/Austria: EUR 7.90/mo, EUR 69/yr
//   Switzerland:     CHF 9.90/mo, CHF 89/yr
const LOCALE_CONFIGS = {
  pl:  { currency: "PLN", symbol: "PLN", monthlyPrice: "PLN 19",   annualPrice: "PLN 169",
         stripeMonthlyKey: "STRIPE_MONTHLY_PRICE_ID_PLN", stripeAnnualKey: "STRIPE_ANNUAL_PRICE_ID_PLN" },
  eur: { currency: "EUR", symbol: "EUR", monthlyPrice: "EUR 7.90", annualPrice: "EUR 69",
         stripeMonthlyKey: "STRIPE_MONTHLY_PRICE_ID_EUR", stripeAnnualKey: "STRIPE_ANNUAL_PRICE_ID_EUR" },
  chf: { currency: "CHF", symbol: "CHF", monthlyPrice: "CHF 9.90", annualPrice: "CHF 89",
         stripeMonthlyKey: "STRIPE_MONTHLY_PRICE_ID",     stripeAnnualKey: "STRIPE_ANNUAL_PRICE_ID" },
};

// Currency preference is now independent of language.
// Users can override via Settings > Currency. Stored as "do-do-currency" = "PLN" | "EUR" | "CHF".
function getCurrencyPreference() {
  try { return localStorage.getItem("do-do-currency") || null; } catch { return null; }
}
function setCurrencyPreference(currencyKey) {
  try { localStorage.setItem("do-do-currency", currencyKey); } catch {}
}
window.getCurrencyPreference = getCurrencyPreference;
window.setCurrencyPreference = setCurrencyPreference;
// Expose so features.js can read currency symbol without importing app.js internals
window.LOCALE_CONFIG = null; // will be set after LOCALE_CONFIG is initialised below

function _detectLocaleFromBrowser() {
  const full = (navigator.language || "").toLowerCase();
  const lang = full.split("-")[0];
  const region = full.split("-")[1] || "";
  if (lang === "pl") return LOCALE_CONFIGS.pl;
  if (lang === "de" || lang === "fr" || lang === "it" || lang === "rm") {
    if (region === "ch") return LOCALE_CONFIGS.chf;
    return LOCALE_CONFIGS.eur;
  }
  return LOCALE_CONFIGS.chf;
}

// Build LOCALE_CONFIG: saved currency wins, then browser language, then default CHF.
// Language no longer influences currency - they are independent settings.
const LOCALE_CONFIG = (() => {
  const saved = getCurrencyPreference();
  if (saved === "PLN") return LOCALE_CONFIGS.pl;
  if (saved === "EUR") return LOCALE_CONFIGS.eur;
  if (saved === "CHF") return LOCALE_CONFIGS.chf;
  return _detectLocaleFromBrowser();
})();
window.LOCALE_CONFIG = LOCALE_CONFIG; // expose to features.js

// Returns the correct Stripe price ID for the current locale and billing period.
function getLocalePriceId(period = "monthly") {
  const key = period === "annual" ? LOCALE_CONFIG.stripeAnnualKey : LOCALE_CONFIG.stripeMonthlyKey;
  return window[key] || window.STRIPE_MONTHLY_PRICE_ID || "";
}

const statusColumns = ["Important", "Waiting", "To Do", "Done"]; // kept for DB mapping
// kanbanColumns is computed at render time so labels respond to language changes
function getKanbanColumns() {
  const _t = window.t || ((k, fb) => fb || k);
  return [
    { id: "today",     label: _t("board.col.today",   "Today")     },
    { id: "mine",      label: _t("board.col.mine",    "Mine")      },
    { id: "to-decide", label: _t("board.col.decide",  "To decide") },
    { id: "not-mine",  label: _t("board.col.notmine", "Not mine")  },
  ];
}
// Assign a card to exactly one column using priority order:
// 1. Today  - due today (any status)
// 2. Archive - Done and not today
// 3. Not mine - assigned exclusively to co-parent, not Done
// 4. To decide - Important / Waiting / Disputed, not above
// 5. Mine - everything else
function assignCardToColumn(card) {
  const setup = getOnboardingState() || {};
  const coParent = setup.parents?.coparent || "Parent B";
  if (isToday(card.due)) return "today";
  if (card.status === "Done") return "archive";
  if (card.assignee === coParent) return "not-mine";
  if (["Important", "Waiting", "Disputed"].includes(card.status)) return "to-decide";
  return "mine";
}
// Keep a static fallback for any code that imported the constant directly
const kanbanColumns = getKanbanColumns();
const topics = ["Schedule", "School", "Medical", "Expenses", "General"];
const cardSchemaVersion = "2026-05-19-card-ui-v2";
const onboardingStorageKey = "ido-you-do-onboarding-v1";
const activeFamilyStorageKey = "do-do-active-family-v1";
const automationSettingsStorageKey = "kinship-automation-settings-v2";
const themeStorageKey = "do-do-theme-v1";
const supabaseUrl = "https://vkafktcrhrmehruiqjni.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrYWZrdGNyaHJtZWhydWlxam5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NDg0MjUsImV4cCI6MjA5NTUyNDQyNX0.B_xG0H4j51XnG7LIIqcEU22HP-mfDws-kdjkt7qg8KA";
const supabaseClient = window.supabase?.createClient?.(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
}) || null;
let currentAuthSession = null;

// SEG-14: auth header helper for calls to our own /api endpoints.
// Returns { Authorization: "Bearer <jwt>" } or {} when signed out.
async function getAuthHeader() {
  try {
    const token = (await supabaseClient?.auth?.getSession())?.data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
window.getAuthHeader = getAuthHeader;
const defaultAutomationSettings = {
  automateReminders: false,
  syncFamilyCalendar: false,
  familyCalendarProvider: "google",
  syncWorkCalendar: false,
  workCalendarProvider: "google",
  workCalendarVisibility: "busy-only",
  workCalendarConnections: [],
  syncGoogleCalendar: false,
  defaultReminderPreset: "60",
  reminderDelivery: "calendar-and-app",
  everyoneCanEdit: true,
  importCalendarId: null,
  importCalendarName: null,
  importCalendarDaysAhead: 30,
  importCalendarSyncMode: null,
};
window.appStorage = window.appStorage || createStorage();
const storage = window.appStorage;

function getThemePreference() {
  return storage.getItem(themeStorageKey) || "system";
}

function resolveTheme(preference = getThemePreference()) {
  if (preference === "dark" || preference === "light") return preference;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(preference = getThemePreference()) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", resolved === "dark" ? "#171d1c" : "#ffffff");
  return resolved;
}

function updateThemePreference(preference) {
  const next = ["system", "light", "dark"].includes(preference) ? preference : "system";
  storage.setItem(themeStorageKey, next);
  applyTheme(next);
}

function initializeTheme() {
  applyTheme();
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", () => {
    if (getThemePreference() === "system") applyTheme("system");
  });
}

initializeTheme();

const seedCards = [
  {
    id: makeId(),
    title: "Swap Friday pickup",
    topic: "Schedule",
    type: "Request",
    status: "Important",
    assignee: "Parent B",
    child: "Ava",
    due: daysFromNow(0, 15, 10),
    amount: "",
    details: "School called about early dismissal. Can you take pickup at 15:10 instead of 17:30? Please confirm before 13:00.",
    comments: [{ author: "Parent A", text: "Need confirmation before 13:00.", time: "Today 09:12" }],
    acknowledged: false,
    reminder: null,
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: makeId(),
    title: "Parent-teacher meeting",
    topic: "School",
    type: "Event",
    status: "Waiting",
    assignee: "Both parents",
    child: "Ava",
    due: daysFromNow(2, 16, 0),
    amount: "",
    details: "Mrs. Keller confirmed room B12. Please acknowledge if you can attend.",
    comments: [{ author: "Parent B", text: "I can join for the first half.", time: "Yesterday 18:40" }],
    acknowledged: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: makeId(),
    title: "Dentist invoice reimbursement",
    topic: "Expenses",
    type: "Expense",
    status: "Waiting",
    assignee: "Parent A",
    child: "Leo",
    due: daysFromNow(4, 12, 0),
    amount: "CHF 86.50",
    details: "Routine cleaning. Receipt attached in the original email thread.",
    comments: [],
    acknowledged: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 30,
  },
  {
    id: makeId(),
    title: "Allergy medication update",
    topic: "Medical",
    type: "Info",
    status: "Info Only",
    assignee: "Both parents",
    child: "Ava",
    due: daysFromNow(1, 8, 0),
    amount: "",
    details: "New dosage is 5ml after breakfast for seven days. Pharmacy label says start tomorrow.",
    comments: [],
    acknowledged: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 9,
  },
  {
    id: makeId(),
    title: "Sign camp permission form",
    topic: "School",
    type: "Task",
    status: "To Do",
    assignee: "Parent A",
    child: "Leo",
    due: daysFromNow(3, 9, 0),
    amount: "",
    details: "Form is due Monday morning. Needs both emergency contacts checked.",
    comments: [],
    acknowledged: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 16,
  },
  {
    id: makeId(),
    title: "Winter jacket at your place",
    topic: "General",
    type: "Info",
    status: "Done",
    assignee: "Parent B",
    child: "Ava",
    due: "",
    amount: "",
    details: "Jacket was packed in the blue backpack this morning.",
    comments: [{ author: "Parent B", text: "Got it.", time: "Today 08:02" }],
    acknowledged: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 7,
  },
];

const FREE_CARD_LIMIT = 10;

const state = {
  cards: loadCards(),
  automationSettings: loadAutomationSettings(),
  topic: "All",
  view: "board",
  search: "",
  tagFilter: "",
  actionFilter: "",
  personFilter: "",
  cardDialogEditMode: false,
  subscriptionStatus: "free",
  subscriptionPeriodEnd: null,
};

// Sync subscription state when Supabase loads it
window.addEventListener("subscriptionLoaded", (e) => {
  state.subscriptionStatus = e.detail.status || "free";
  state.subscriptionPeriodEnd = e.detail.periodEnd || null;
});

// Board week-calendar state (must be declared before render() is called)
// mode: "week" = 7 cols, "3day" = 3 cols, "2day" = 2 cols (mobile default)
const _boardCal = { weekStart: _boardCalGetWeekStart(new Date()), mode: "week" };

// ─── Calendar time-grid settings ─────────────────────────────────────────────
const _calSettingsKey = "do-do-cal-settings-v1";
const BCAL_SLOT_H = 64; // px per hour (fixed)

function _calSettings() {
  try { return JSON.parse(storage.getItem(_calSettingsKey) || "{}"); } catch { return {}; }
}
function getCalStartHour() { return Number(_calSettings().startHour ?? 6); }
function getCalEndHour()   { return Number(_calSettings().endHour   ?? 22); }
function saveCalSettings(startHour, endHour) {
  storage.setItem(_calSettingsKey, JSON.stringify({ startHour: Number(startHour), endHour: Number(endHour) }));
}

// Subscription helpers
function isPaidUser() {
  return ["active", "trialing"].includes(state.subscriptionStatus);
}

function freeCardCount() {
  return state.cards.filter((c) => c.status !== "Done").length;
}

function showUpgradePrompt(reason) {
  document.getElementById("upgradeModal")?.remove();
  const modal = document.createElement("dialog");
  modal.id = "upgradeModal";
  modal.className = "card-dialog upgrade-modal";
  const reasonHtml = reason ? `<p class="upgrade-reason">${escapeHtml(reason)}</p>` : "";
  modal.innerHTML = `
    <div class="dialog-content">
      <div class="dialog-header">
        <div>
          <p class="eyebrow">Do-Do Standard</p>
          <h2>Upgrade to unlock all features</h2>
        </div>
        <div class="dialog-header-actions">
          <button class="icon-button" id="upgradeModalClose" aria-label="Close" title="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      ${reasonHtml}
      <ul class="upgrade-feature-list">
        <li>Both parents, unlimited Dos</li>
        <li>Google &amp; Apple Calendar sync</li>
        <li>AI field extraction and reminders</li>
        <li>Co-parent collaboration</li>
        <li>14-day free trial - no card required</li>
      </ul>
      <div class="upgrade-pricing">
        <strong>${LOCALE_CONFIG.monthlyPrice}</strong>/month &nbsp; or &nbsp; <strong>${LOCALE_CONFIG.annualPrice}</strong>/year
      </div>
      <div class="dialog-actions">
        <button class="ghost-button" id="upgradeModalCancel">Maybe later</button>
        <button class="primary-button" id="upgradeModalMonthly">Start free trial</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.showModal();
  modal.querySelector("#upgradeModalClose")?.addEventListener("click", () => modal.close());
  modal.querySelector("#upgradeModalCancel")?.addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
  modal.querySelector("#upgradeModalMonthly")?.addEventListener("click", async () => {
    const btn = modal.querySelector("#upgradeModalMonthly");
    btn.textContent = "Redirecting...";
    btn.disabled = true;
    try {
      const priceId = getLocalePriceId("monthly");
      if (!priceId) { showToast("Stripe not configured yet"); modal.close(); return; }
      const res = await fetch("/api/stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({
          action: "create",
          priceId,
          successUrl: location.origin + "/#board?checkout=success",
          cancelUrl: location.origin + "/#settings",
        }),
      });
      const data = await res.json();
      if (data.url) { location.href = data.url; }
      else { showToast("Could not start checkout: " + (data.error || "unknown error")); modal.close(); }
    } catch (err) { showToast("Checkout failed: " + err.message); modal.close(); }
  });
}

window.showUpgradePrompt = showUpgradePrompt;
window.isPaidUser = isPaidUser;

applyAutomationSettingsToCards();

const mobileVoice = {
  timer: null,
  recognition: null,
  active: false,
  suppressClick: false,
};

const elements = {
  topics: document.querySelectorAll(".topic"),
  authScreen: document.querySelector("#authScreen"),
  authProviderList: document.querySelector("#authProviderList"),
  authProviderButtons: document.querySelectorAll("[data-auth-provider]"),
  authConfirm: document.querySelector("#authConfirm"),
  authProviderLabel: document.querySelector("#authProviderLabel"),
  authContinueButton: document.querySelector("#authContinueButton"),
  authSwitchButton: document.querySelector("#authSwitchButton"),
  authPasswordForm: document.querySelector("#authPasswordForm"),
  authEmailInput: document.querySelector("#authEmailInput"),
  authPasswordInput: document.querySelector("#authPasswordInput"),
  authSignUpButton: document.querySelector("#authSignUpButton"),
  authError: document.querySelector("#authError"),
  inviteScreen: document.querySelector("#inviteScreen"),
  inviteHero: document.querySelector("#inviteHero"),
  inviteProviderList: document.querySelector("#inviteProviderList"),
  inviteProviderButtons: document.querySelectorAll("[data-invite-provider]"),
  inviteEmailForm: document.querySelector("#inviteEmailForm"),
  inviteEmailInput: document.querySelector("#inviteEmailInput"),
  invitePasswordInput: document.querySelector("#invitePasswordInput"),
  inviteError: document.querySelector("#inviteError"),
  invitePreviewBtn: document.querySelector("#invitePreviewBtn"),
  guestPreviewScreen: document.querySelector("#guestPreviewScreen"),
  guestHero: document.querySelector("#guestHero"),
  guestCardList: document.querySelector("#guestCardList"),
  guestJoinBtn: document.querySelector("#guestJoinBtn"),
  guestBackBtn: document.querySelector("#guestBackBtn"),
  guestError: document.querySelector("#guestError"),
  verifyEmailScreen: document.querySelector("#verifyEmailScreen"),
  verifyEmailHint: document.querySelector("#verifyEmailHint"),
  verifyResendButton: document.querySelector("#verifyResendButton"),
  verifySignOutButton: document.querySelector("#verifySignOutButton"),
  verifyError: document.querySelector("#verifyError"),
  onboardingForm: document.querySelector("#onboardingForm"),
  onboardingParentA: document.querySelector("#onboardingParentA"),
  onboardingParentB: document.querySelector("#onboardingParentB"),
  onboardingInvite: document.querySelector("#onboardingInvite"),
  onboardingChildName: document.querySelector("#onboardingChildName"),
  onboardingPetName: document.querySelector("#onboardingPetName"),
  onboardingFamilyCalendar: document.querySelector("#onboardingFamilyCalendar"),
  onboardingFamilyCalendarProvider: document.querySelector("#onboardingFamilyCalendarProvider"),
  onboardingWorkCalendar: document.querySelector("#onboardingWorkCalendar"),
  onboardingWorkCalendarProvider: document.querySelector("#onboardingWorkCalendarProvider"),
  onboardingImportCalendar: document.querySelector("#onboardingImportCalendar"),
  onboardingAutomateReminders: document.querySelector("#onboardingAutomateReminders"),
  onboardingReminderPreset: document.querySelector("#onboardingReminderPreset"),
  onboardingAddChild: document.querySelector("#onboardingAddChild"),
  onboardingSkipPet: document.querySelector("#onboardingSkipPet"),
  boardView: document.querySelector("#boardView"),
  listView: document.querySelector("#listView"),
  attentionStrip: document.querySelector("#attentionStrip"),
  inlineCaptureHost: document.querySelector("#inlineCaptureHost"),
  dailySummary: document.querySelector("#dailySummary"),
  dailySummaryText: document.querySelector("#dailySummaryText"),
  dailySummaryMeta: document.querySelector("#dailySummaryMeta"),
  searchInput: document.querySelector("#searchInput"),
  needsShortcut: document.querySelector("#needsShortcut"),
  waitingShortcut: document.querySelector("#waitingShortcut"),
  todoShortcut: document.querySelector("#todoShortcut"),
  expensesShortcut: document.querySelector("#expensesShortcut"),
  summaryAddButton: document.querySelector("#summaryAddButton"),
  newCardButton: document.querySelector("#newCardButton"),
  mobileNewCardButton: document.querySelector("#mobileNewCardButton"),
  mobileModuleButtons: document.querySelectorAll("[data-mobile-module]"),
  exportButton: document.querySelector("#exportButton"),
  cardDialog: document.querySelector("#cardDialog"),
  cardForm: document.querySelector("#cardForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogMode: document.querySelector("#dialogMode"),
  cardId: document.querySelector("#cardId"),
  dialogCardMeta: document.querySelector("#dialogCardMeta"),
  dialogCardPeople: document.querySelector("#dialogCardPeople"),
  dialogQuickActions: document.querySelector("#dialogQuickActions"),
  dialogCompleteButton: document.querySelector("#dialogCompleteButton"),
  dialogDoButton: document.querySelector("#dialogDoButton"),
  dialogPleaseButton: document.querySelector("#dialogPleaseButton"),
  dialogCannotButton: document.querySelector("#dialogCannotButton"),
  llmCardChat: document.querySelector("#llmCardChat"),
  llmCardPromptInput: document.querySelector("#llmCardPromptInput"),
  llmInterpretation: document.querySelector("#llmInterpretation"),
  llmInterpretButton: document.querySelector("#llmInterpretButton"),
  llmVoiceButton: document.querySelector("#llmVoiceButton"),
  derivedTags: document.querySelector("#derivedTags"),
  titleInput: document.querySelector("#titleInput"),
  topicInput: document.querySelector("#topicInput"),
  typeInput: document.querySelector("#typeInput"),
  statusInput: document.querySelector("#statusInput"),
  assigneeInput: document.querySelector("#assigneeInput"),
  childInput: document.querySelector("#childInput"),
  dueInput: document.querySelector("#dueInput"),
  cardDateInput: document.querySelector("#cardDateInput"),
  cardTimeInput: document.querySelector("#cardTimeInput"),
  cardDueClear: document.querySelector("#cardDueClear"),
  amountInput: document.querySelector("#amountInput"),
  lockAssigneeInput: document.querySelector("#lockAssigneeInput"),
  detailsInput: document.querySelector("#detailsInput"),
  commentPanel: document.querySelector("#commentPanel"),
  commentList: document.querySelector("#commentList"),
  commentInput: document.querySelector("#commentInput"),
  commentMicButton: document.querySelector("#commentMicButton"),
  voiceButton: document.querySelector("#voiceButton"),
  voiceStatus: document.querySelector("#voiceStatus"),
  voiceTranscriptInput: document.querySelector("#voiceTranscriptInput"),
  autofillButton: document.querySelector("#autofillButton"),
  deleteButton: document.querySelector("#deleteButton"),
  ackButton: document.querySelector("#ackButton"),
  cardSaveButton: document.querySelector("#cardSaveButton"),
  cardCancelButton: document.querySelector("#cardCancelButton"),
  cardReminderCustomLabel: document.querySelector("#cardReminderCustomLabel"),
  editCardMenuButton: document.querySelector("#editCardMenuButton"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  sendCardMessageButton: document.querySelector("#sendCardMessageButton"),
  activityPanel: document.querySelector("#activityPanel"),
  activityList: document.querySelector("#activityList"),
  cardReminderPanel: document.querySelector("#cardReminderPanel"),
  cardReminderPresetInput: document.querySelector("#cardReminderPresetInput"),
  cardReminderTimeInput: document.querySelector("#cardReminderTimeInput"),
  clearCardReminderButton: document.querySelector("#clearCardReminderButton"),
  saveCardReminderButton: document.querySelector("#saveCardReminderButton"),
  messageDialog: document.querySelector("#messageDialog"),
  messageForm: document.querySelector("#messageForm"),
  messageTitle: document.querySelector("#messageTitle"),
  messageCardId: document.querySelector("#messageCardId"),
  messageCardContext: document.querySelector("#messageCardContext"),
  cardMessageInput: document.querySelector("#cardMessageInput"),
  cardMessageMicButton: document.querySelector("#cardMessageMicButton"),
  closeMessageButton: document.querySelector("#closeMessageButton"),
  cancelMessageButton: document.querySelector("#cancelMessageButton"),
  reminderDialog: document.querySelector("#reminderDialog"),
  reminderForm: document.querySelector("#reminderForm"),
  reminderTitle: document.querySelector("#reminderTitle"),
  reminderCardId: document.querySelector("#reminderCardId"),
  reminderPresetInput: document.querySelector("#reminderPresetInput"),
  reminderTimeInput: document.querySelector("#reminderTimeInput"),
  closeReminderButton: document.querySelector("#closeReminderButton"),
  clearReminderButton: document.querySelector("#clearReminderButton"),
  toast: document.querySelector("#toast"),
};

trackVisit();
bindEvents();
registerServiceWorker();
initVersionBadge();
handleAuthCallback();
window.applySidebarTopic = (topic) => {
  if (topic === "All") {
    switchTopic("All");
  } else {
    applyTagFilter(topic, topic);
  }
  setMobileActive(topic);
  document.body.classList.remove("show-mobile-menu");
};

window.applyCardTagFilter = (tag) => {
  window.switchModule?.("board");
  applyTagFilter(tag, topics.includes(tag) ? tag : "All");
};
// Mobile: default to 2-day view (today + tomorrow)
if (window.innerWidth < 640) {
  _boardCal.mode = "2day";
  const _mobileToday = new Date();
  _mobileToday.setHours(0, 0, 0, 0);
  _boardCal.weekStart = _mobileToday;
}
render();

function bindEvents() {
  initVerifyEmailScreen();
  elements.authProviderButtons.forEach((button) => {
    button.addEventListener("click", () => chooseAuthProvider(button.dataset.authProvider));
  });
  elements.authSwitchButton?.addEventListener("click", resetAuthChoice);
  elements.authPasswordForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const mode = elements.authPasswordForm?.dataset.mode || "signin";
    if (mode === "signup") {
      signUp(elements.authEmailInput?.value.trim(), elements.authPasswordInput?.value);
    } else {
      signInWithPassword(elements.authEmailInput?.value.trim(), elements.authPasswordInput?.value);
    }
  });
  // Mode toggle (Sign in / Create account)
  document.querySelectorAll("[data-auth-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.authMode;
      elements.authPasswordForm.dataset.mode = mode;
      document.querySelectorAll("[data-auth-mode]").forEach((b) => b.classList.toggle("active", b === btn));
      const submitBtn = document.querySelector("#authSubmitButton");
      if (submitBtn) submitBtn.textContent = mode === "signup" ? "Create account" : "Sign in";
      // SEG-20.1: show consent checkbox only on signup
      const consentRow = document.getElementById("authConsentRow");
      if (consentRow) consentRow.hidden = mode !== "signup";
      const consentBox = document.getElementById("authConsentCheckbox");
      if (consentBox && mode !== "signup") consentBox.checked = false;
      clearAuthError();
    });
  });
  document.querySelectorAll("[data-auth-sign-out]").forEach((button) => {
    button.addEventListener("click", signOut);
  });
  elements.inviteProviderButtons.forEach((button) => {
    button.addEventListener("click", () => chooseInviteProvider(button.dataset.inviteProvider));
  });
  elements.inviteEmailForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    acceptInviteWithPassword(elements.inviteEmailInput?.value.trim(), elements.invitePasswordInput?.value);
  });
  elements.invitePreviewBtn?.addEventListener("click", showGuestPreview);
  elements.guestJoinBtn?.addEventListener("click", exitGuestPreview);
  elements.guestBackBtn?.addEventListener("click", exitGuestPreview);
  elements.onboardingForm?.addEventListener("submit", completeOnboarding);
  elements.onboardingAddChild?.addEventListener("click", () => showToast("Another child can be added from Settings"));
  elements.onboardingSkipPet?.addEventListener("click", () => {
    if (elements.onboardingPetName) elements.onboardingPetName.value = "";
    showToast("Pets skipped for setup");
  });

  elements.topics.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.topic === "All") {
        switchTopic("All");
      } else {
        applyTagFilter(button.dataset.topic, button.dataset.topic);
      }
      setMobileActive(button.dataset.topic);
      document.body.classList.remove("show-mobile-menu");
    });
  });

  document.querySelectorAll(".segmented-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      document.querySelectorAll(".segmented-button").forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.toLowerCase().trim();
    state.tagFilter = "";
    state.actionFilter = "";
    state.personFilter = "";
    render();
  });

  elements.expensesShortcut?.addEventListener("click", () => window.switchModule?.("expenses"));
  elements.needsShortcut?.addEventListener("click", () => applyActionFilter("needs", "Needs response"));
  elements.waitingShortcut?.addEventListener("click", () => applyActionFilter("waiting", "Waiting"));
  elements.todoShortcut?.addEventListener("click", () => applyActionFilter("todo", "To do"));
  document.addEventListener("click", (event) => {
    const personButton = event.target.closest("[data-person-filter]");
    if (personButton) {
      event.preventDefault();
      event.stopPropagation();
      applyPersonFilter(personButton.dataset.personFilter);
      return;
    }

    const tagButton = event.target.closest("[data-tag-filter]");
    if (tagButton) {
      event.preventDefault();
      event.stopPropagation();
      applyTagFilter(tagButton.dataset.tagFilter, tagButton.classList.contains("topic") ? tagButton.dataset.topic : "All");
      return;
    }

    const moduleButton = event.target.closest("[data-module]");
    if (!moduleButton) return;
    window.switchModule?.(moduleButton.dataset.module);
    document.body.classList.remove("show-mobile-menu");
  });
  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const personButton = event.target.closest?.("[data-person-filter]");
    if (!personButton) return;
    event.preventDefault();
    applyPersonFilter(personButton.dataset.personFilter);
  });
  elements.newCardButton?.addEventListener("click", () => openCardDialog());
  elements.summaryAddButton?.addEventListener("click", () => openCardDialog());
  bindMobileVoiceButton();
  elements.mobileModuleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      window.switchModule?.(button.dataset.mobileModule);
      setMobileActive(button.dataset.mobileModule);
    });
  });
  elements.exportButton?.addEventListener("click", exportCards);
  elements.cardForm.addEventListener("submit", saveCard);
  _bindCardDueRow(); // visible date + time inputs in card popup
  elements.voiceButton?.addEventListener("click", startVoiceCapture);
  elements.llmVoiceButton?.addEventListener("click", startVoiceCapture);
  elements.llmInterpretButton?.addEventListener("click", () => syncLlmCardPrompt({ announce: true }));
  elements.llmCardPromptInput?.addEventListener("input", () => syncLlmCardPrompt({ announce: false }));
  elements.autofillButton?.addEventListener("click", () => autofillFromVoice(elements.voiceTranscriptInput?.value));
  elements.deleteButton?.addEventListener("click", deleteCurrentCard);
  elements.ackButton?.addEventListener("click", acknowledgeCurrentCard);
  elements.editCardMenuButton?.addEventListener("click", () => setCardDialogEditMode(true));
  elements.sendCardMessageButton?.addEventListener("click", addCardDialogMessage);
  elements.commentMicButton?.addEventListener("click", () => startDictationForField(elements.commentInput, {
    button: elements.commentMicButton,
    success: "Message dictated",
    fallback: "Voice dictation is not available here. Type the short message instead.",
  }));
  elements.cardReminderPresetInput?.addEventListener("change", () => {
    updateCardDialogReminderTime();
    updateReminderCustomVisibility();
  });
  elements.saveCardReminderButton?.addEventListener("click", saveCardDialogReminder);
  elements.clearCardReminderButton?.addEventListener("click", clearCardDialogReminder);

  // SEG-06: Receipt upload button
  document.querySelector("#receiptUploadButton")?.addEventListener("click", () => {
    document.querySelector("#receiptFileInput")?.click();
  });
  document.querySelector("#receiptFileInput")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    const cardId = elements.cardId?.value;
    if (file && cardId) uploadReceipt(file, cardId);
    e.target.value = ""; // reset so same file can be re-uploaded
  });
  elements.detailsInput?.addEventListener("input", () => {
    deriveFieldsFromShortInfo(elements.detailsInput.value, { silent: true });
    scheduleAutosave();
  });
  elements.detailsInput?.addEventListener("blur", () => {
    if (elements.detailsInput.value.trim()) {
      deriveFieldsFromShortInfo(elements.detailsInput.value, { silent: true });
    }
  });
  // Autosave on any field change
  [elements.titleInput, elements.topicInput, elements.typeInput, elements.statusInput,
   elements.assigneeInput, elements.childInput, elements.dueInput, elements.amountInput].forEach((el) => {
    el?.addEventListener("change", scheduleAutosave);
  });
  // Cancel button - close without saving
  elements.cardCancelButton?.addEventListener("click", () => elements.cardDialog?.close());
  elements.dialogCompleteButton?.addEventListener("click", () => quickCompleteCardFromDialog());
  elements.dialogDoButton?.addEventListener("click", () => quickRespondCardFromDialog("do"));
  elements.dialogPleaseButton?.addEventListener("click", () => quickRespondCardFromDialog("will"));
  elements.dialogCannotButton?.addEventListener("click", () => quickRespondCardFromDialog("cannot"));
  elements.closeDialogButton?.addEventListener("click", () => {
    if (elements.cardId.value || elements.detailsInput?.value.trim()) {
      saveCardSilent();
    }
    elements.cardDialog?.close();
    window.broadcastCardPresence?.(null);
  });
  elements.cardDialog?.addEventListener("cancel", (e) => {
    e.preventDefault();
    if (elements.cardId.value || elements.detailsInput?.value.trim()) {
      saveCardSilent();
    }
    elements.cardDialog?.close();
    window.broadcastCardPresence?.(null);
  });
  elements.cardDialog?.addEventListener("close", () => {
    window.broadcastCardPresence?.(null);
    const indicator = document.querySelector("#presenceIndicator");
    if (indicator) indicator.hidden = true;
  });
  elements.messageForm?.addEventListener("submit", saveCardMessage);
  elements.cardMessageMicButton?.addEventListener("click", () => startDictationForField(elements.cardMessageInput, {
    button: elements.cardMessageMicButton,
    success: "Message dictated",
    fallback: "Voice dictation is not available here. Type the message instead.",
  }));
  elements.closeMessageButton.addEventListener("click", () => elements.messageDialog.close());
  elements.cancelMessageButton.addEventListener("click", () => elements.messageDialog.close());
  elements.reminderForm.addEventListener("submit", saveReminder);
  elements.reminderPresetInput.addEventListener("change", updateReminderTimeFromPreset);
  elements.closeReminderButton.addEventListener("click", () => elements.reminderDialog.close());
  elements.clearReminderButton.addEventListener("click", clearReminder);
}

// Invite token stored for use after auth completes
let pendingInviteToken = null;

async function handleAuthCallback() {
  if (!supabaseClient) {
    showAuthScreen();
    showAuthError("Authentication could not load. Check your connection and refresh.");
    return;
  }

  // SEG-11.3: Capture mediator referral code from ?ref=MED-xxx before we lose the URL
  try {
    const refParams = new URLSearchParams(window.location.search);
    const refCode = refParams.get("ref");
    if (refCode && /^MED-[A-Za-z0-9]+$/.test(refCode)) {
      localStorage.setItem("dodo_mediator_ref", refCode);
      // Clean the ref param from URL without reloading
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("ref");
      window.history.replaceState({}, "", cleanUrl.toString());
    }
  } catch { /* ignore */ }

  // Detect /invite/:token in the URL path
  const inviteMatch = window.location.pathname.match(/^\/invite\/([^/?#]+)/);
  if (inviteMatch) {
    pendingInviteToken = inviteMatch[1];
    window.history.replaceState({}, "", "/");
    await showInviteScreen(pendingInviteToken);
    return;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
      window.history.replaceState({}, "", window.location.pathname);
      if (error) {
        showAuthScreen();
        showAuthError(error.message);
        return;
      }
    }

    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
      showAuthScreen();
      showAuthError(error.message);
      return;
    }
    if (session) {
      showApp(session);
    } else {
      showAuthScreen();
    }
  } catch (error) {
    showAuthScreen();
    showAuthError(error?.message || "Authentication could not connect. Try again.");
    return;
  }

  supabaseClient.auth.onAuthStateChange((event, nextSession) => {
    if (nextSession) {
      if (pendingInviteToken) {
        finishInviteAcceptance(nextSession);
      } else {
        // EMAIL_CONFIRMED fires when the user clicks the link in their inbox.
        // showApp re-evaluates the verification gate and opens the app.
        showApp(nextSession);
      }
    } else {
      // USER_UPDATED can fire with null session during email confirmation flow -
      // don't sign the user out in that case.
      if (event !== "USER_UPDATED") {
        showAuthScreen();
      }
    }
  });
}

async function showInviteScreen(token) {
  // Look up invite to personalise the screen
  if (window.lookupInviteToken) {
    const info = await window.lookupInviteToken(token);
    if (!info) {
      showAuthScreen();
      showAuthError("This invite link is invalid or has expired.");
      return;
    }
    if (info.expired) {
      showAuthScreen();
      showAuthError("This invite has already been accepted.");
      return;
    }
    if (elements.inviteHero) {
      const children = info.childrenNames || [];
      const forChildren = children.length > 0
        ? ` to coordinate for ${children.slice(0, -1).join(", ")}${children.length > 1 ? " and " : ""}${children[children.length - 1]}`
        : "";
      elements.inviteHero.querySelector("h1").textContent =
        `${info.parentAName} invited you${forChildren}.`;
    }
  }

  document.body.classList.add("auth-locked");
  if (elements.inviteScreen) elements.inviteScreen.hidden = false;
  if (elements.authScreen) elements.authScreen.hidden = true;

  // Wire up auth-state listener to complete acceptance after sign-in
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session && pendingInviteToken) {
      finishInviteAcceptance(session);
    }
  });
}

async function finishInviteAcceptance(session) {
  const token = pendingInviteToken;
  pendingInviteToken = null;
  if (!token || !window.acceptInviteToken) {
    showApp(session);
    return;
  }
  const displayName = session.user?.user_metadata?.full_name || session.user?.email?.split("@")[0] || "Parent B";
  const result = await window.acceptInviteToken(token, session.user.id, displayName);
  if (!result?.ok) {
    showToast(result?.reason === "already_accepted" ? "Invite already accepted" : "Could not connect - try again");
  } else {
    showToast((window.t || ((k) => k))("toast.joined"));
  }
  if (elements.inviteScreen) elements.inviteScreen.hidden = true;
  showApp(session);
}

function chooseInviteProvider(provider) {
  if (provider === "Google") {
    if (!supabaseClient) return;
    supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/",
        scopes: "openid profile email",
      },
    }).catch(() => showInviteError("Google sign in could not start. Try again."));
    return;
  }
  showInviteError(`${provider} sign in is not available yet. Use Google or email.`);
}

async function acceptInviteWithPassword(email, password) {
  if (!supabaseClient || !email || !password) return;
  clearInviteError();
  // Try sign in first, then sign up if not found
  const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (signInData?.session) return; // onAuthStateChange handles the rest
  if (signInError && signInError.message?.toLowerCase().includes("invalid")) {
    // Account may not exist yet - sign up
    const { error: signUpError } = await supabaseClient.auth.signUp({ email, password });
    if (signUpError) { showInviteError(signUpError.message); return; }
    showInviteError("Check your email to confirm your account, then sign in here.");
    return;
  }
  if (signInError) showInviteError(signInError.message);
}

function showInviteError(message) {
  if (!elements.inviteError) return;
  elements.inviteError.textContent = message || "";
  elements.inviteError.hidden = !message;
}

function clearInviteError() { showInviteError(""); }

// ─── SEG-13: Read-only guest preview (no account) ─────────────────────────────

async function showGuestPreview() {
  const token = pendingInviteToken;
  if (!token || !elements.guestPreviewScreen) return;
  const tFn = window.t || ((k) => k);

  if (elements.invitePreviewBtn) elements.invitePreviewBtn.disabled = true;

  let data = null;
  try {
    const res = await fetch(`/api/guest-view?token=${encodeURIComponent(token)}`);
    if (res.ok) data = await res.json();
  } catch { /* handled below */ }

  if (elements.invitePreviewBtn) elements.invitePreviewBtn.disabled = false;

  if (!data) {
    showInviteError(tFn("guest.error"));
    return;
  }

  // Hero: prefer children names (child-centric framing), fall back to inviter name
  const heroH1 = elements.guestHero?.querySelector("h1");
  if (heroH1) {
    const kids = (data.children || []).filter(Boolean);
    heroH1.textContent = kids.length > 0
      ? tFn("guest.hero_title_kids", { kids: kids.join(", ") })
      : tFn("guest.hero_title", { name: data.inviterName || "Do-Do" });
  }

  renderGuestCards(data.cards || []);

  if (elements.inviteScreen) elements.inviteScreen.hidden = true;
  elements.guestPreviewScreen.hidden = false;
}

function renderGuestCards(cards) {
  const list = elements.guestCardList;
  if (!list) return;
  const tFn = window.t || ((k) => k);
  list.innerHTML = "";

  if (cards.length === 0) {
    const empty = document.createElement("p");
    empty.className = "guest-empty";
    empty.textContent = tFn("guest.empty");
    list.appendChild(empty);
    return;
  }

  cards.forEach((card) => {
    const row = document.createElement("div");
    row.className = "guest-card-row";

    const title = document.createElement("strong");
    title.textContent = card.title || "";

    const meta = document.createElement("span");
    const parts = [];
    if (card.child) parts.push(card.child);
    if (card.dueAt) {
      try {
        parts.push(`${tFn("guest.due")}: ${new Date(card.dueAt).toLocaleDateString()}`);
      } catch { /* skip bad dates */ }
    }
    if (card.amount != null && card.amount !== "") parts.push(String(card.amount));
    meta.textContent = parts.join(" · ");

    const status = document.createElement("em");
    status.className = `guest-card-status guest-status-${card.status || "todo"}`;
    status.textContent = tFn(`status.${card.status || "todo"}`);

    row.appendChild(title);
    if (parts.length) row.appendChild(meta);
    row.appendChild(status);
    list.appendChild(row);
  });
}

function exitGuestPreview() {
  if (elements.guestPreviewScreen) elements.guestPreviewScreen.hidden = true;
  if (elements.inviteScreen) elements.inviteScreen.hidden = false;
}

async function chooseAuthProvider(provider) {
  if (provider === "Google") {
    await signInWithGoogle();
    return;
  }
  if (provider === "Apple") {
    await signInWithApple();
    return;
  }
  showAuthError(`${provider} sign in is not available yet. Use Google or email.`);
}

async function signInWithApple() {
  if (!supabaseClient) {
    showAuthError("Authentication could not load. Check your connection and refresh.");
    return;
  }
  clearAuthError();
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: window.location.origin + "/",
      },
    });
    if (error) showAuthError(error.message);
  } catch (error) {
    showAuthError(error?.message || "Apple sign in could not start. Try again.");
  }
}

async function signInWithGoogle() {
  if (!supabaseClient) {
    showAuthError("Authentication could not load. Check your connection and refresh.");
    return;
  }
  clearAuthError();
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/",
        // calendar.readonly: read work calendar for busy blocks (Level 1)
        // calendar: full access to create/manage the Do-Do Family calendar (Level 2)
        scopes: "openid profile email https://www.googleapis.com/auth/calendar",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) showAuthError(error.message);
  } catch (error) {
    showAuthError(error?.message || "Google sign in could not start. Try again.");
  }
}

async function signInWithPassword(email, password) {
  if (!supabaseClient || !validateAuthCredentials(email, password)) return;
  clearAuthError();
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      showAuthError(error.message);
      return;
    }
    showApp(data.session);
  } catch (error) {
    showAuthError(error?.message || "Sign in could not connect. Try again.");
  }
}

async function signUp(email, password) {
  if (!supabaseClient || !validateAuthCredentials(email, password)) return;
  // SEG-20.1: GDPR/RODO - require explicit consent before account creation
  const consentBox = document.getElementById("authConsentCheckbox");
  if (consentBox && !consentBox.checked) {
    showAuthError((window.t || ((k, fb) => fb || k))("auth.consent_required", "Please agree to the Terms and Privacy Policy to create an account."));
    return;
  }
  clearAuthError();
  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      showAuthError(error.message);
      return;
    }
    if (data.session) {
      showApp(data.session);
      return;
    }
    showAuthError("Account created. Check your email to finish signing in.");
  } catch (error) {
    showAuthError(error?.message || "Account creation could not connect. Try again.");
  }
}

async function signOut() {
  if (supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
    } catch {
      // The local UI still returns to sign in if the network is unavailable.
    }
  }
  currentAuthSession = null;
  showAuthScreen();
  showToast((window.t || ((k) => k))("toast.signed_out"));
}

function _isEmailVerified(session) {
  // Google/Apple OAuth users are always considered verified.
  // Email/password users must have confirmed their email.
  const user = session?.user;
  if (!user) return false;
  const provider = user.app_metadata?.provider;
  if (provider && provider !== "email") return true;
  // email_confirmed_at is set by Supabase when the user clicks the link
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

function showVerifyEmailScreen(session) {
  currentAuthSession = session;
  document.body.classList.add("auth-locked");
  if (elements.authScreen) elements.authScreen.hidden = true;
  if (elements.verifyEmailScreen) elements.verifyEmailScreen.hidden = false;
  if (elements.verifyEmailHint) {
    const email = session?.user?.email;
    elements.verifyEmailHint.textContent = email
      ? `We sent a confirmation link to ${email}. Click it to finish signing in.`
      : "We sent a confirmation link to your email address. Click it to finish signing in.";
  }
  if (elements.verifyError) elements.verifyError.hidden = true;
}

// ─── Verify screen button wiring (called once on DOMContentLoaded) ────────────
function initVerifyEmailScreen() {
  elements.verifyResendButton?.addEventListener("click", async () => {
    if (!supabaseClient || !currentAuthSession?.user?.email) return;
    elements.verifyResendButton.disabled = true;
    elements.verifyResendButton.textContent = "Sending...";
    try {
      const { error } = await supabaseClient.auth.resend({
        type: "signup",
        email: currentAuthSession.user.email,
      });
      if (error) {
        if (elements.verifyError) {
          elements.verifyError.textContent = error.message;
          elements.verifyError.hidden = false;
        }
      } else {
        elements.verifyResendButton.textContent = "Email sent";
        setTimeout(() => {
          if (elements.verifyResendButton) {
            elements.verifyResendButton.textContent = "Resend email";
            elements.verifyResendButton.disabled = false;
          }
        }, 5000);
      }
    } catch (err) {
      if (elements.verifyError) {
        elements.verifyError.textContent = err.message || "Could not resend. Try again.";
        elements.verifyError.hidden = false;
      }
      elements.verifyResendButton.textContent = "Resend email";
      elements.verifyResendButton.disabled = false;
    }
  });

  elements.verifySignOutButton?.addEventListener("click", async () => {
    if (elements.verifyEmailScreen) elements.verifyEmailScreen.hidden = true;
    if (supabaseClient) await supabaseClient.auth.signOut().catch(() => {});
    currentAuthSession = null;
    showAuthScreen();
  });
}

function showApp(session) {
  if (!session && !currentAuthSession) {
    showAuthScreen();
    return;
  }
  currentAuthSession = session || currentAuthSession;

  // ─── 1.3 Email verification gate ─────────────────────────────────────────
  // Block access to the family board until the email address is confirmed.
  // OAuth users (Google/Apple) are implicitly verified.
  if (!_isEmailVerified(currentAuthSession)) {
    showVerifyEmailScreen(currentAuthSession);
    return;
  }

  clearAuthError();
  document.body.classList.remove("auth-locked");
  if (elements.verifyEmailScreen) elements.verifyEmailScreen.hidden = true;
  initializeOnboarding();

  // Restore last visited module (PWA restart loses the URL hash)
  setTimeout(() => {
    const validModules = ["board", "calendar", "shopping", "expenses", "settings"];
    const fromHash = location.hash.replace("#", "").toLowerCase();
    const fromStorage = localStorage.getItem("do-do-last-module");
    const target = validModules.includes(fromHash) ? fromHash : fromStorage;
    if (target && validModules.includes(target)) window.switchModule?.(target);
  }, 0);
  // Load real data from Supabase in the background
  if (window.initSupabaseData) {
    window.initSupabaseData(currentAuthSession).then(() => {
      // SEG-11.3: apply mediator referral code if one was captured from URL
      window.applyMediatorReferral?.().catch(() => {});
    }).catch(() => {});
  }
  // Initialize notifications - silent re-subscribe only; permission prompt deferred to first card save
  initNotifications();
  // Load Google Calendar events if provider token is available
  if (window.initGoogleCalendar) {
    window.initGoogleCalendar(currentAuthSession).catch(() => {});
  }
  // Load Apple Calendar busy slots if credentials are stored
  if (window.initAppleCalendar) {
    window.initAppleCalendar().catch(() => {});
  }
}

function showAuthScreen() {
  currentAuthSession = null;
  document.body.classList.add("auth-locked");
  document.body.classList.remove("onboarding-locked");
  elements.authProviderList?.classList.remove("hidden");
  elements.authConfirm?.classList.add("hidden");
  if (elements.verifyEmailScreen) elements.verifyEmailScreen.hidden = true;
}

function resetAuthChoice() {
  showAuthScreen();
  clearAuthError();
}

function getAuthState() {
  return currentAuthSession ? { signedIn: true, session: currentAuthSession } : null;
}

function validateAuthCredentials(email, password) {
  if (!email || !password) {
    showAuthError("Enter your email and password.");
    return false;
  }
  return true;
}

function showAuthError(message) {
  if (elements.authError) elements.authError.textContent = message || "";
}

function clearAuthError() {
  showAuthError("");
}

function initializeOnboarding() {
  const authState = getAuthState();
  const completed = Boolean(getOnboardingState()?.completedAt);
  const shouldShow = Boolean(authState?.signedIn && !completed);
  document.body.classList.toggle("onboarding-locked", shouldShow);
  if (completed) applyOnboardingState(getOnboardingState());
}

function completeOnboarding(event) {
  event.preventDefault();
  const familyId = getFamilyWorkspaceId() === "demo-family" ? `family-${makeId()}` : getFamilyWorkspaceId();
  const setup = {
    familyId,
    parents: {
      primary: elements.onboardingParentA?.value.trim() || "Parent A",
      coparent: elements.onboardingParentB?.value.trim() || "Co-parent",
      invite: elements.onboardingInvite?.value.trim() || "",
    },
    children: elements.onboardingChildName?.value.trim()
      ? [{ name: elements.onboardingChildName.value.trim() }]
      : [],
    pets: elements.onboardingPetName?.value.trim()
      ? [
        {
          name: elements.onboardingPetName.value.trim(),
        },
        ]
      : [],
    calendar: {
      familySync: Boolean(elements.onboardingFamilyCalendar?.checked),
      familyProvider: elements.onboardingFamilyCalendarProvider?.value || "google",
      workSync: Boolean(elements.onboardingWorkCalendar?.checked),
      workProvider: elements.onboardingWorkCalendarProvider?.value || "google",
      workVisibility: "busy-only",
      automateReminders: Boolean(elements.onboardingAutomateReminders?.checked),
      reminderPreset: elements.onboardingReminderPreset?.value || "60",
      reminderDelivery: "calendar-and-app",
      importCalendar: Boolean(elements.onboardingImportCalendar?.checked),
    },
    completedAt: new Date().toISOString(),
  };
  storage.setItem(activeFamilyStorageKey, familyId);
  storage.setItem(onboardingStorageKey, JSON.stringify(setup));
  updateAutomationSettings({
    automateReminders: setup.calendar.automateReminders,
    syncFamilyCalendar: setup.calendar.familySync,
    familyCalendarProvider: setup.calendar.familyProvider,
    syncWorkCalendar: setup.calendar.workSync,
    workCalendarProvider: setup.calendar.workProvider,
    workCalendarVisibility: "busy-only",
    workCalendarConnections: setup.calendar.workSync ? [setup.calendar.workProvider] : [],
    syncGoogleCalendar: setup.calendar.familySync && setup.calendar.familyProvider === "google",
    defaultReminderPreset: setup.calendar.reminderPreset,
    reminderDelivery: setup.calendar.reminderDelivery || "calendar-and-app",
  });
  applyOnboardingState(setup);
  persist();
  document.body.classList.remove("onboarding-locked");
  // If user opted in to calendar import, nudge them to finish setup in Settings
  if (setup.calendar?.importCalendar) {
    setTimeout(() => {
      showToast("Go to Settings > Calendar connections to pick which calendar to import.");
    }, 1200);
  }
  // Save family, profile, children, and pair to Supabase
  if (window.saveOnboardingToSupabase && window.getCurrentUserId?.()) {
    window.saveOnboardingToSupabase(setup, window.getCurrentUserId()).then((result) => {
      if (!result?.inviteLink) return;
      if (result.emailSent) {
        showToast(`Invite sent to ${setup.parents?.invite}`);
      } else if (setup.parents?.invite) {
        // Email couldn't be sent - show the link so user can share manually
        showInviteLinkFallback(result.inviteLink, setup.parents.invite);
      } else {
        // No email provided - show the link for manual sharing
        showInviteLinkFallback(result.inviteLink, null);
      }
    }).catch(() => {});
  }
  showToast("Board setup complete");
}

function getOnboardingState() {
  try {
    return JSON.parse(storage.getItem(onboardingStorageKey) || "null");
  } catch {
    return null;
  }
}

function applyOnboardingState(setup) {
  if (!setup) return;
  const primary = setup.parents?.primary || "Parent A";
  const coparent = setup.parents?.coparent || "Parent B";
  const child = setup.children?.[0]?.name || "Ava";
  const pet = setup.pets?.[0]?.name || "Milo";
  document.querySelectorAll(".parent-a-mini, .avatar-a").forEach((node) => {
    node.textContent = primary.charAt(0).toUpperCase();
  });
  document.querySelectorAll(".parent-b-mini, .avatar-b").forEach((node) => {
    node.textContent = coparent.charAt(0).toUpperCase();
  });
  state.cards = state.cards.map((card) => ({
    ...card,
    child: card.child === "Milo" ? pet : card.child === "Leo" ? child : card.child,
  }));
}

function bindMobileVoiceButton() {
  const button = elements.mobileNewCardButton;
  if (!button) return;

  button.addEventListener("click", () => {
    if (mobileVoice.suppressClick) {
      mobileVoice.suppressClick = false;
      return;
    }
    openCardDialog();
  });

  button.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearMobileVoiceTimer();
    mobileVoice.timer = window.setTimeout(() => {
      mobileVoice.suppressClick = true;
      startMobileVoiceCapture();
    }, 420);
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    button.addEventListener(eventName, () => {
      if (mobileVoice.active) {
        stopMobileVoiceCapture();
        return;
      }
      clearMobileVoiceTimer();
    });
  });
}

function clearMobileVoiceTimer() {
  if (!mobileVoice.timer) return;
  window.clearTimeout(mobileVoice.timer);
  mobileVoice.timer = null;
}

function switchTopic(topic) {
  state.topic = topic;
  state.tagFilter = "";
  state.actionFilter = "";
  state.personFilter = "";
  elements.topics.forEach((item) => item.classList.toggle("active", item.dataset.topic === topic));
  render();
}

function applyTagFilter(value, activeTopic = "All") {
  const tag = String(value || "").trim();
  if (!tag) return;
  state.topic = "All";
  state.tagFilter = tag;
  state.actionFilter = "";
  state.personFilter = "";
  state.search = `#${compactTag(tag)}`.toLowerCase();
  state.view = "list";
  elements.searchInput.value = `#${compactTag(tag)}`;
  elements.topics.forEach((item) => item.classList.toggle("active", item.dataset.topic === activeTopic));
  document.querySelectorAll(".segmented-button").forEach((item) => item.classList.toggle("active", item.dataset.view === "list"));
  elements.cardDialog?.close();
  showToast(`Latest Dos for #${compactTag(tag)}`);
  render();
}

function setMobileActive(moduleName) {
  elements.mobileModuleButtons.forEach((item) => item.classList.toggle("active", item.dataset.mobileModule === moduleName));
}

window.setMobileActive = setMobileActive;

// Handle Supabase Presence updates - show who else is viewing the current card
window.onPresenceSync = function(presenceState) {
  const indicator = document.querySelector("#presenceIndicator");
  if (!indicator || !elements.cardDialog?.open) return;
  const currentCardId = elements.cardId?.value;
  if (!currentCardId) return;

  const myId = window.getCurrentUserId?.();
  const others = Object.values(presenceState)
    .flat()
    .filter((p) => p.viewing_card === currentCardId && p.user_id !== myId)
    .map((p) => p.display_name || "Co-parent");

  if (others.length) {
    indicator.textContent = `${others[0]} is also viewing this`;
    indicator.hidden = false;
  } else {
    indicator.hidden = true;
  }
};

function render() {
  const cards = filteredCards();
  renderCounts();
  renderSummary();
  renderDailySummary();
  renderInlineCaptureHost();
  renderAttention();
  renderBoard(cards);
  renderList(cards);
  renderBoardCalendar();
  // Allow kanban cards to be dragged into the calendar time grid
  requestAnimationFrame(() => _bindKanbanToBoardCal());

  elements.boardView.classList.toggle("hidden", state.view !== "board");
  elements.listView.classList.toggle("hidden", state.view !== "list");
}

function renderSummary() {
  const expenses = state.cards.reduce((sum, card) => sum + parseAmount(card.amount), 0);
  const messages = state.cards.filter((card) => !card.acknowledged).length;
  const reminders = state.cards.filter((card) => card.reminder).length;
  const waiting = state.cards.filter((card) => card.status === "Waiting").length;
  const todo = state.cards.filter((card) => card.status === "To Do").length;
  document.querySelector("#topCosts").textContent = expenses ? `${LOCALE_CONFIG.symbol} ${Math.round(expenses)}` : `${LOCALE_CONFIG.symbol} 0`;
  document.querySelector("#topMessages").textContent = String(messages);
  document.querySelector("#topReminders").textContent = String(reminders);
  document.querySelector("#topNeeds").textContent = String(messages);
  document.querySelector("#topWaiting").textContent = String(waiting);
  document.querySelector("#topTodo").textContent = String(todo);
}

function renderDailySummary() {
  const todayCards = state.cards.filter((card) => isToday(card.due));
  const urgent = state.cards.filter((card) => ["Important", "Waiting"].includes(card.status) && !card.acknowledged);
  const dueToday = todayCards.filter((card) => card.status !== "Done");
  const nextCards = getNextCards();
  const nextCard = [...dueToday, ...urgent].sort(sortCardsByDue)[0] || nextCards[0];
  const waitingCount = state.cards.filter((card) => card.status === "Waiting").length;
  const todoCount = state.cards.filter((card) => card.status === "To Do").length;
  const summaryParts = [
    `${urgent.length} need${urgent.length === 1 ? "s" : ""} response`,
    `${waitingCount} waiting`,
    `${todoCount} to do`,
  ];

  elements.dailySummaryMeta.textContent = summaryParts.join(" · ");
  elements.dailySummaryText.textContent = nextCard
    ? nextCard.title
    : "No urgent items today. The board is clear.";
  elements.dailySummary.querySelector(".daily-summary-list")?.remove();
  elements.dailySummary.querySelector(".daily-summary-main").insertAdjacentHTML("beforeend", `
    <div class="daily-summary-list" aria-label="Next cards">
      ${nextCards.length ? nextCards.map(renderNextCardRow).join("") : `<button type="button" disabled><span>No next Dos</span></button>`}
    </div>
  `);
  elements.dailySummary.querySelectorAll(".daily-summary-list [data-card-id]").forEach((button) => {
    button.addEventListener("click", () => openCardDialog(button.dataset.cardId));
  });

  // Fetch AI summary in background and update text
  fetchAiDailySummary();
}

async function fetchAiDailySummary() {
  if (!state.cards.length) return;
  try {
    const setup = getOnboardingState() || {};
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
      body: JSON.stringify({
        action: "summary",
        cards: state.cards.slice(0, 20),
        parentName: setup.parents?.primary || null,
        coparentName: setup.parents?.coparent || null,
        childNames: (setup.children || []).map((c) => c.name).filter(Boolean),
      }),
    });
    if (!res.ok) return;
    const { summary } = await res.json();
    if (summary && elements.dailySummaryText) {
      elements.dailySummaryText.textContent = summary;
    }
  } catch {}
}

function parseAmount(value) {
  const match = String(value || "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function getNextCards() {
  return state.cards
    .filter((card) => card.status !== "Done")
    .sort(sortCardsByDue)
    .slice(0, 5);
}

function sortCardsByDue(a, b) {
  const dueA = a.due ? new Date(a.due).getTime() : Number.MAX_SAFE_INTEGER;
  const dueB = b.due ? new Date(b.due).getTime() : Number.MAX_SAFE_INTEGER;
  return dueA - dueB || (b.createdAt || 0) - (a.createdAt || 0);
}

function renderNextCardRow(card) {
  return `
    <button type="button" data-card-id="${card.id}" class="daily-summary-row">
      <span class="card-date-tag daily-row-date">${formatDate(card.due)}</span>
      <strong>${escapeHtml(card.title)}</strong>
      <span class="${card.acknowledged ? "daily-row-state acknowledged" : "needs-response-tag daily-row-state"}">${card.acknowledged ? "Acknowledged" : "Needs response"}</span>
      ${renderCompactPeopleIcons(card)}
    </button>
  `;
}

function renderCounts() {
  const allCount = document.querySelector("#count-All");
  if (allCount) allCount.textContent = state.cards.length;
  topics.forEach((topic) => {
    const count = document.querySelector(`#count-${topic}`);
    if (count) count.textContent = state.cards.filter((card) => card.topic === topic).length;
  });
}

function renderAttention() {
  const attentionCards = state.cards
    .filter((card) => ["Important", "Waiting"].includes(card.status) && !card.acknowledged)
    .sort((a, b) => new Date(a.due || 0) - new Date(b.due || 0))
    .slice(0, 3);

  elements.attentionStrip.innerHTML = attentionCards.length
    ? attentionCards.map(renderCard).join("")
    : "";
  elements.attentionStrip.classList.toggle("hidden", !attentionCards.length);

  bindCardInteractions(elements.attentionStrip);
}

function isCardArchived(card) {
  if (!card.due) return false;
  if (card.status === "Done") return false;
  return new Date(card.due) < new Date(Date.now() - 1000 * 60 * 60 * 24); // past midnight yesterday
}

function renderBoard(cards) {
  if (!cards.length) {
    const setup = getOnboardingState();
    const name = setup?.parents?.primary || "there";
    elements.boardView.innerHTML = `
      <div style="grid-column:1/-1;display:grid;place-items:center;padding:48px 24px;text-align:center;">
        <p style="margin:0 0 6px;color:var(--muted);font-size:13px;font-weight:800;">WELCOME, ${name.toUpperCase()}</p>
        <p style="margin:0 0 20px;color:var(--ink);font-size:18px;font-weight:900;max-width:22ch;line-height:1.3;">Your board is ready. Add your first Do to get started.</p>
        <button class="primary-button" type="button" id="emptyStateNewCard" style="min-height:48px;padding:0 28px;border-radius:999px;font-size:15px;">
          + New Do
        </button>
      </div>
    `;
    elements.boardView.querySelector("#emptyStateNewCard")?.addEventListener("click", () => openCardDialog());
    return;
  }

  // Assign each card to exactly one column (or archive) using priority logic
  const columnMap = {};
  getKanbanColumns().forEach(({ id }) => { columnMap[id] = []; });
  const archiveCards = [];
  cards.forEach((card) => {
    const colId = assignCardToColumn(card);
    if (colId === "archive") {
      archiveCards.push(card);
    } else if (columnMap[colId]) {
      columnMap[colId].push(card);
    }
  });

  const columnsHtml = getKanbanColumns().map(({ id, label }) => {
    const columnCards = columnMap[id] || [];
    return `
      <section class="column" data-column="${id}">
        <div class="column-header">${label}<span>${columnCards.length}</span></div>
        <div class="column-body">
          ${columnCards.length
            ? columnCards.map(renderCard).join("")
            : `<p class="column-empty">&nbsp;</p>`}
        </div>
      </section>
    `;
  }).join("");

  const archivedHtml = archiveCards.length ? `
    <div class="archive-section" style="grid-column:1/-1;" id="archiveSection">
      <button class="archive-toggle" type="button" id="archiveToggle" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v4H3zM5 8v12h14V8"/><path d="M10 12h4"/></svg>
        ${(window.t || ((k) => k))("board.col.archive") || "Archive"}
        <span>${archiveCards.length}</span>
        <svg class="archive-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="archive-grid hidden" id="archiveGrid">
        ${archiveCards.map(renderCard).join("")}
      </div>
    </div>
  ` : "";

  elements.boardView.innerHTML = columnsHtml + archivedHtml;

  elements.boardView.querySelector("#archiveToggle")?.addEventListener("click", () => {
    const grid = elements.boardView.querySelector("#archiveGrid");
    const btn = elements.boardView.querySelector("#archiveToggle");
    const isOpen = grid.classList.toggle("hidden") === false;
    btn.setAttribute("aria-expanded", String(!grid.classList.contains("hidden")));
    elements.boardView.querySelector(".archive-chevron")?.style.setProperty("transform", isOpen ? "rotate(180deg)" : "");
  });

  bindCardInteractions(elements.boardView);
}

function renderInlineCaptureHost() {
  if (!elements.inlineCaptureHost) return;
  elements.inlineCaptureHost.innerHTML = renderInlineCardCapture();
  bindCardInteractions(elements.inlineCaptureHost);
}

function renderInlineCardCapture() {
  return `
    <form class="inline-card-capture" data-inline-card-capture aria-label="Create Do-Do from a short message">
      <span class="inline-capture-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" fill="currentColor"/>
          <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" fill="currentColor"/>
          <path d="M5 3l.6 1.4L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.6L5 3Z" fill="currentColor"/>
        </svg>
      </span>
      <textarea class="inline-capture-input" data-inline-card-input rows="1" maxlength="420" placeholder="Write or say anything"></textarea>
      <button class="inline-mic-button" type="button" data-inline-card-mic aria-label="Dictate" title="Dictate">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 14a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" stroke="currentColor" stroke-width="2"/>
          <path d="M19 10a7 7 0 0 1-14 0M12 17v4M8 21h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="inline-create-button" type="submit" aria-label="Create Do" title="Create Do">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>
    </form>
  `;
}

function renderCard(card) {
  return renderUnifiedCard(card);
}

function _cardOwnerClass(card) {
  const family = getFamilyPeople();
  const assignee = card.assignee;
  if (!assignee) return "";
  if (assignee === "Both parents") return "card-owner-both";
  if (assignee === "Parent B" || assignee === family?.coparent?.name) return "card-owner-co";
  return "card-owner-mine";
}

function renderUnifiedCard(card, options = {}) {
  const _t = window.t || ((k, fb) => fb || k);
  const actionLabel = card.type === "Expense" ? _t("card.paid", "Paid") : _t("card.done", "Done");
  const isDone = card.status === "Done";
  const showActions = options.showActions !== false;
  const attributes = options.attributes || `data-card-id="${card.id}" role="button" tabindex="0"`;
  const ownerClass = _cardOwnerClass(card);
  const needsResponseClass = (!isDone && !card.acknowledged) ? "card-needs-response" : "";
  const className = ["card", "unified-card", options.className || "", isDone ? "done-card" : "", ownerClass, needsResponseClass].filter(Boolean).join(" ");

  const dateStr = formatDate(card.due);
  const statusLabel = isDone ? _t("card.done", "Done")
    : card.status === "Waiting" ? _t("card.waiting", "Waiting")
    : card.status === "Important" ? _t("card.urgent", "Urgent")
    : !card.acknowledged ? _t("card.needs_response", "Needs response")
    : "";

  return `
    <article class="${className}" ${attributes}>
      <div class="card-state-row">
        <span class="card-date-tag">${dateStr}</span>
        ${card.type === "Vaccine" ? `<span class="card-type-badge card-type-vaccine">💉 ${_t("card.vaccine_badge", "Vaccine")}</span>` : ""}
        ${statusLabel ? `<span class="card-status-label${isDone ? " card-status-done" : ""}">${statusLabel}</span>` : ""}
        ${card.amount ? `<span class="card-money-tag">${escapeHtml(card.amount)}</span>` : ""}
      </div>

      <div class="card-people-row">${renderPeopleIcons(card)}</div>

      <h3 class="card-title">${escapeHtml(card.title)}</h3>

      ${card.details ? `<p class="card-details">${escapeHtml(card.details)}</p>` : ""}

      ${card.googleCalendar?.synced ? `
        <div class="card-sync">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4M17 3v4M4 11h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>
          <span>${card.googleCalendar.provider === "outlook" ? "Outlook" : "Google Calendar"}</span>
        </div>
      ` : ""}
      ${card.calendarImport ? `
        <div class="card-sync card-cal-import" title="${card.calendarImport.syncMode === "two-way" ? "Two-way sync" : "Imported from calendar"}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/></svg>
          <span>${escapeHtml(card.calendarImport.calendarName || "Calendar")}</span>
        </div>
      ` : ""}

      ${showActions ? `
        <div class="quick-actions">
          <button class="quick-complete" type="button" data-quick-complete="${card.id}" ${isDone ? "disabled" : ""}>
            ${isDone ? _t("card.completed", "Completed") : actionLabel}
          </button>
          <button class="quick-response" type="button" data-quick-response="${card.id}" data-response="do" ${isDone ? "disabled" : ""}>${_t("card.action.do", "I'll do it")}</button>
          <button class="quick-response" type="button" data-quick-response="${card.id}" data-response="will" ${isDone ? "disabled" : ""}>${_t("card.action.will", "Please do it")}</button>
          <button class="quick-response" type="button" data-quick-response="${card.id}" data-response="cannot" ${isDone ? "disabled" : ""}>${_t("card.action.cannot", "Can't")}</button>
        </div>
        <div class="card-footer-actions">
          <button class="card-footer-btn" type="button" data-remind-card="${card.id}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
            ${_t("card.action.reminder", "Reminder")}
          </button>
          <button class="card-footer-btn" type="button" data-message-card="${card.id}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></svg>
            ${_t("card.action.message", "Message")}
          </button>
        </div>
      ` : ""}
    </article>
  `;
}

window.renderUnifiedCard = renderUnifiedCard;
window.bindUnifiedCardInteractions = bindCardInteractions;

function renderList(cards) {
  elements.listView.innerHTML = cards.map((card) => renderUnifiedCard(card, { className: "list-card" })).join("")
    || `<div class="card unified-card list-card"><strong>No matching Dos</strong></div>`;

  bindCardInteractions(elements.listView);
}

function bindCardInteractions(container) {
  container.querySelectorAll("[data-inline-card-capture]").forEach((form) => {
    const input = form.querySelector("[data-inline-card-input]");
    const micButton = form.querySelector("[data-inline-card-mic]");

    form.addEventListener("click", (event) => event.stopPropagation());

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopPropagation();
      createCardFromInlineCapture(input);
    });

    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      createCardFromInlineCapture(input);
    });

    micButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      startDictationForField(input, {
        button: micButton,
        success: "Voice added",
        fallback: "Voice recording is not available here. Type the Do-Do instead.",
      });
    });
  });

  container.querySelectorAll("[data-card-id]").forEach((card) => {
    card.addEventListener("click", () => openCardDialog(card.dataset.cardId));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCardDialog(card.dataset.cardId);
      }
    });
  });

  container.querySelectorAll("[data-quick-complete]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      quickCompleteCard(button.dataset.quickComplete);
    });
  });

  container.querySelectorAll("[data-quick-response]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      quickRespondCard(button.dataset.quickResponse, button.dataset.response);
    });
  });

  container.querySelectorAll("[data-message-card]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openMessageDialog(button.dataset.messageCard);
    });
  });

  container.querySelectorAll("[data-remind-card]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openReminderDialog(button.dataset.remindCard);
    });
  });
}

function createCardFromInlineCapture(input) {
  const text = input?.value.trim() || "";
  if (!text) {
    input?.focus();
    showToast("Add a short message first");
    return;
  }

  deriveFieldsFromShortInfo(text, { silent: true });
  const due = elements.dueInput.value ? new Date(elements.dueInput.value).toISOString() : "";
  const shouldAutoReminder = due && shouldCreateAppReminder();
  const reminder = shouldAutoReminder
    ? {
        preset: state.automationSettings.defaultReminderPreset,
        time: reminderIsoFromDue(due, state.automationSettings.defaultReminderPreset),
        automated: true,
      }
    : null;
  const calendarSync = due && state.automationSettings.syncFamilyCalendar
    ? {
        synced: true,
        provider: state.automationSettings.familyCalendarProvider,
        reminderPreset: state.automationSettings.defaultReminderPreset,
        updatedAt: new Date().toISOString(),
      }
    : null;

  const card = {
    id: makeId(),
    title: elements.titleInput.value.trim() || makeTitleFromText(text),
    topic: elements.topicInput.value,
    type: elements.typeInput.value,
    status: elements.statusInput.value,
    assignee: elements.assigneeInput.value || null,
    child: elements.childInput.value || null,
    due,
    amount: elements.amountInput.value.trim(),
    details: text,
    comments: [],
    acknowledged: false,
    reminder,
    recurrence: null, // inline capture doesn't set recurrence
    googleCalendar: calendarSync,
    createdAt: Date.now(),
  };

  // Enforce free-tier card limit
  if (!isPaidUser() && freeCardCount() >= FREE_CARD_LIMIT) {
    showUpgradePrompt(`You have reached the ${FREE_CARD_LIMIT}-Do limit on the free plan. Upgrade for unlimited Dos.`);
    return;
  }

  state.cards.unshift(card);
  persist();
  input.value = "";
  showToast(buildCreateToast(card));
  render();
  // SEG-11.2: milestone toast
  window.checkCardMilestoneToast?.(state.cards.length);
}

function openCardDialog(id = "", focusSection = "info", prefill = {}) {
  const card = state.cards.find((item) => item.id === id);
  // Reset mini-cal view so it snaps to selected/today month on open
  const _mcEl = document.getElementById("miniCalPicker");
  if (_mcEl) { delete _mcEl.dataset.viewYear; delete _mcEl.dataset.viewMonth; }
  elements.cardForm.reset();
  if (elements.voiceStatus) elements.voiceStatus.textContent = "Record what has to be done";
  elements.cardId.value = card?.id || "";
  const _dt = window.t || ((k) => k);
  elements.dialogTitle.textContent = card ? card.title : _dt("board.new_do");
  elements.dialogMode.textContent = card ? _dt("card.info_thread") : _dt("board.new_do");
  elements.llmCardChat?.classList.add("hidden"); // never shown - direct form always used
  elements.commentPanel?.classList.toggle("hidden", !card);
  // Always show reminder panel - manual reminder is useful even when GCal is connected
  elements.cardReminderPanel?.classList.remove("hidden");
  elements.activityPanel?.classList.toggle("hidden", !card);
  elements.editCardMenuButton?.classList.toggle("hidden", !card);
  elements.dialogCardMeta?.classList.toggle("hidden", !card);
  elements.dialogQuickActions?.classList.toggle("hidden", !card);
  // Delete button only shown for existing cards
  elements.deleteButton?.classList.toggle("hidden", !card);

  // View-only hint for existing cards
  const viewHint = document.querySelector("#dialogViewHint");
  if (viewHint) {
    viewHint.hidden = !card;
    const hintEditBtn = document.querySelector("#dialogViewHintEdit");
    if (hintEditBtn) {
      hintEditBtn.onclick = () => setCardDialogEditMode(true);
    }
  }

  if (card) {
    elements.titleInput.value = card.title;
    elements.topicInput.value = card.topic;
    elements.typeInput.value = card.type;
    elements.statusInput.value = card.status;
    setSelectValue(elements.assigneeInput, card.assignee);
    setSelectValue(elements.childInput, card.child);
    elements.dueInput.value = card.due ? card.due.slice(0, 16) : "";
    _syncCardDueRow();
    if (elements.lockAssigneeInput) elements.lockAssigneeInput.checked = card.lockAssignee || false;
    // Recurrence
    const recInput = document.querySelector("#recurrenceInput");
    const recDaysRow = document.querySelector("#recurrenceDaysRow");
    if (recInput) {
      recInput.value = card.recurrence?.freq || "none";
      const freq = card.recurrence?.freq;
      const showDays = ["weekly", "biweekly"].includes(freq);
      recDaysRow?.classList.toggle("hidden", !showDays);
      if (showDays) {
        const days = card.recurrence?.days || [];
        recDaysRow?.querySelectorAll(".recurrence-day").forEach((cb) => {
          cb.checked = days.includes(cb.value);
        });
      }
      // Restore custom dates
      const customPicker = document.querySelector("#customDatesPicker");
      const calEl = document.getElementById("customDatesCalendar");
      if (customPicker && calEl) {
        const isCustom = freq === "custom-dates";
        customPicker.classList.toggle("hidden", !isCustom);
        calEl.dataset.selectedDates = (card.recurrence?.customDates || []).join(",");
        delete calEl.dataset.viewYear;
        delete calEl.dataset.viewMonth;
        if (isCustom) renderCustomDatesCal();
      }
    }
    elements.amountInput.value = card.amount || "";
    elements.detailsInput.value = card.details;
    // Check if the card text mentions a specific reminder - use that over the stored preset
    const textReminder = inferReminderFromText((card.title + " " + card.details).toLowerCase());
    const resolvedPreset = textReminder?.preset || card.reminder?.preset || state.automationSettings.defaultReminderPreset;
    elements.cardReminderPresetInput.value = resolvedPreset;
    if (textReminder?.isoTime) {
      elements.cardReminderTimeInput.value = toDateTimeInputValue(new Date(textReminder.isoTime));
    } else if (card.due) {
      elements.cardReminderTimeInput.value = buildReminderTime(card, resolvedPreset);
    } else {
      elements.cardReminderTimeInput.value = card.reminder?.time
        ? toDateTimeInputValue(new Date(card.reminder.time)) : "";
    }
    renderDialogMeta(card);
    renderDialogConflictBanner(card);
    updateDialogQuickActions(card);
    renderComments(card);
    renderActivity(card);
    renderDerivedTags();
    updatePaymentPanel(card);
    updateReceiptPanel(card);
    updateLedgerPanel(card);
  } else {
    elements.topicInput.value = prefill.topic || (state.topic === "All" ? "Schedule" : state.topic);
    elements.typeInput.value = prefill.type || "Task";
    elements.statusInput.value = "To Do";
    setSelectValue(elements.assigneeInput, "");
    setSelectValue(elements.childInput, "");
    elements.amountInput.value = "";
    // Pre-fill due date from calendar selection or passed-in prefill
    elements.dueInput.value = prefill.due ? prefill.due.slice(0, 16) : "";
    _syncCardDueRow();
    if (elements.lockAssigneeInput) elements.lockAssigneeInput.checked = false;
    elements.detailsInput.value = prefill.details || "";
    elements.cardReminderPresetInput.value = state.automationSettings.defaultReminderPreset || "60";
    elements.cardReminderTimeInput.value = "";
    if (elements.llmCardPromptInput) elements.llmCardPromptInput.value = "";
    renderLlmInterpretation("");
    renderDerivedTags();
    updatePaymentPanel(null);
    updateReceiptPanel(null);
    updateLedgerPanel(null);
  }

  updateReminderCustomVisibility();
  _bindRecurrenceDaysToggle();
  const canEdit = !card || state.automationSettings.everyoneCanEdit;
  setCardDialogEditMode(canEdit);
  elements.cardDialog.showModal();
  focusCardDialogSection(focusSection);
  // Broadcast presence so co-parent sees we're viewing this card
  window.broadcastCardPresence?.(id || null);
}

function renderDialogPeople(card) {
  elements.dialogCardPeople.outerHTML = renderPeopleIcons(card, "dialogCardPeople");
  elements.dialogCardPeople = document.querySelector("#dialogCardPeople");
}

// ─── SEG-06: Payment panel ────────────────────────────────────────────────────

function updatePaymentPanel(card) {
  const panel = document.querySelector("#cardPaymentPanel");
  const content = document.querySelector("#paymentPanelContent");
  if (!panel || !content) return;

  const isExpense = card && (card.type === "Expense" || card.topic === "Expenses");
  const hasAmount = isExpense && card.amount;
  panel.hidden = !hasAmount;
  if (!hasAmount) return;

  const payStatus = card.payment_status || "none";
  const rawAmt = parseFloat(String(card.amount).replace(/[^0-9.-]/g, "")) || 0;
  const currencyMatch = String(card.amount).match(/[A-Za-z]{2,3}/);
  const currency = currencyMatch ? currencyMatch[0].toUpperCase() : LOCALE_CONFIG.currency;

  if (payStatus === "paid") {
    const paidAt = card.payment_paid_at
      ? new Date(card.payment_paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : "";
    const paidAmt = card.payment_amount != null
      ? `${currency} ${parseFloat(card.payment_amount).toFixed(2)}`
      : "";
    content.innerHTML = `<div class="payment-status-chip payment-chip-paid">&#10003; Paid${paidAmt ? " " + paidAmt : ""}${paidAt ? " &middot; " + paidAt : ""}</div>`;
    return;
  }

  if (payStatus === "pending") {
    const pAmt = card.payment_amount != null
      ? `${currency} ${parseFloat(card.payment_amount).toFixed(2)}`
      : "";
    const payUrl = card.payment_intent_id ? `/pay/${card.payment_intent_id}` : null;
    content.innerHTML = `
      <div class="payment-status-chip payment-chip-pending">${pAmt ? pAmt + " " : ""}${(window.t || ((k) => k))("expense.awaiting")}</div>
      ${payUrl ? `<a class="ghost-button" href="${payUrl}" target="_blank" rel="noopener" style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;font-size:13px">${(window.t || ((k) => k))("expense.open_link")}</a>` : ""}
    `;
    return;
  }

  // No payment requested yet - show request form
  const _pt = window.t || ((k) => k);
  const defaultAmount = (rawAmt / 2).toFixed(2);
  content.innerHTML = `
    <div class="payment-request-form">
      <div class="payment-amount-row">
        <span class="payment-currency-label">${currency}</span>
        <input type="number" id="paymentAmountInput" class="payment-amount-input" value="${defaultAmount}" min="0.50" step="0.01" placeholder="0.00">
      </div>
      <select id="paymentSplitSelect" class="payment-split-select">
        <option value="50">${_pt("pay.split_5050")}</option>
        <option value="100">${_pt("pay.split_100t")}</option>
        <option value="60">${_pt("pay.split_60")}</option>
        <option value="40">${_pt("pay.split_40")}</option>
        <option value="0">${_pt("pay.split_me")}</option>
      </select>
      <button class="primary-button payment-request-btn" type="button" id="sendPaymentRequestButton">${_pt("expense.send_request")}</button>
    </div>
  `;

  const splitSel = document.querySelector("#paymentSplitSelect");
  const amtInput = document.querySelector("#paymentAmountInput");
  splitSel?.addEventListener("change", () => {
    const pct = parseInt(splitSel.value) / 100;
    if (amtInput) amtInput.value = (rawAmt * pct).toFixed(2);
  });

  document.querySelector("#sendPaymentRequestButton")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const amt = parseFloat(amtInput?.value || defaultAmount);
    if (!amt || amt < 0.5) { showToast("Enter a valid amount (min 0.50)."); return; }
    btn.disabled = true;
    btn.textContent = (window.t || ((k) => k))("pay.sending");
    await requestExpensePayment(card.id, amt, currency, card.title);
    btn.disabled = false;
  });
}

async function requestExpensePayment(cardId, amount, currency, description) {
  try {
    const res = await fetch("/api/stripe-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
      body: JSON.stringify({
        action: "expense",
        cardId,
        amount: amount.toFixed(2),
        currency: (currency || LOCALE_CONFIG.currency).toLowerCase(),
        description: description || "",
        requestedByName: getMyName(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");

    // Update card in local state
    const card = state.cards.find((c) => c.id === cardId);
    if (card) {
      card.payment_status = "pending";
      card.payment_amount = amount;
      card.payment_intent_id = data.intentId;
      persist();
      if (window.saveCardToSupabase) window.saveCardToSupabase(card).catch(() => {});
      updatePaymentPanel(card);
    }

    // SEG-16: log payment_requested event
    window.appendExpenseLedger?.({
      event_type: "payment_requested",
      card_id: cardId,
      amount,
      currency,
      stripe_intent_id: data.intentId || null,
    }).catch(() => {});

    showToast(data.emailSent ? (window.t?.("toast.pay_sent") ?? "Payment request sent by email.") : (window.t?.("toast.pay_created") ?? "Payment link created."));
  } catch (err) {
    showToast("Could not send payment request: " + err.message);
    const btn = document.querySelector("#sendPaymentRequestButton");
    if (btn) { btn.disabled = false; btn.textContent = "Send payment request"; }
  }
}

// ─── SEG-06: Receipt upload ───────────────────────────────────────────────────

function updateReceiptPanel(card) {
  const panel = document.querySelector("#cardReceiptPanel");
  const preview = document.querySelector("#receiptPreview");
  if (!panel) return;

  const isExpense = card && (card.type === "Expense" || card.topic === "Expenses");
  panel.hidden = !isExpense;
  if (!isExpense || !preview) return;

  if (card.receipt_url) {
    _renderReceiptPreview(card.receipt_url, preview);
  } else {
    preview.innerHTML = "";
  }
}

function _renderReceiptPreview(url, container) {
  if (!url || !container) return;
  const isImage = /\.(jpe?g|png|gif|webp|heic)$/i.test(url.split("?")[0]);
  container.innerHTML = isImage
    ? `<a href="${url}" target="_blank" rel="noopener" class="receipt-preview-link"><img src="${url}" alt="Receipt" class="receipt-thumbnail"></a>`
    : `<a href="${url}" target="_blank" rel="noopener" class="receipt-preview-link receipt-file-link">View receipt</a>`;
}

async function uploadReceipt(file, cardId) {
  if (!window.supabaseClient) { showToast("Not connected to storage."); return; }
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return;

  const uploadBtn = document.querySelector("#receiptUploadButton");
  if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.textContent = "Uploading..."; }

  try {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const familyId = typeof getFamilyWorkspaceId === "function" ? getFamilyWorkspaceId() : "family";
    const path = `${familyId}/${cardId}/receipt.${ext}`;

    const { data, error } = await window.supabaseClient.storage
      .from("receipts")
      .upload(path, file, { upsert: true });

    if (error) throw new Error(error.message);

    const { data: urlData } = window.supabaseClient.storage.from("receipts").getPublicUrl(path);
    const url = urlData?.publicUrl || data?.path || path;

    card.receipt_url = url;
    persist();
    if (window.saveCardToSupabase) window.saveCardToSupabase(card).catch(() => {});

    // SEG-16: log receipt_uploaded event
    window.appendExpenseLedger?.({
      event_type: "receipt_uploaded",
      card_id: cardId,
      note: url,
    }).catch(() => {});

    const preview = document.querySelector("#receiptPreview");
    _renderReceiptPreview(url, preview);
    showToast(window.t?.("toast.receipt_up") ?? "Receipt uploaded.");
  } catch (err) {
    showToast("Upload failed: " + err.message);
  } finally {
    if (uploadBtn) { uploadBtn.disabled = false; uploadBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Attach receipt`; }
  }
}

// ─── SEG-16: Payment history panel ───────────────────────────────────────────

const LEDGER_EVENT_ICONS = {
  created:            "📝",
  amount_set:         "✏️",
  payment_requested:  "📨",
  payment_sent:       "💳",
  payment_confirmed:  "✅",
  marked_paid_manual: "✅",
  receipt_uploaded:   "🧾",
};

function updateLedgerPanel(card) {
  const panel = document.querySelector("#cardLedgerPanel");
  const content = document.querySelector("#ledgerContent");
  const toggleBtn = document.querySelector("#ledgerToggleBtn");
  if (!panel) return;

  const isExpense = card && (card.type === "Expense" || card.topic === "Expenses");
  panel.hidden = !isExpense;
  if (!isExpense) return;

  // Toggle open/close
  toggleBtn?.addEventListener("click", async () => {
    const isOpen = content.hidden;
    content.hidden = !isOpen;
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
    toggleBtn.querySelector(".ledger-chevron")?.style.setProperty("transform", isOpen ? "rotate(180deg)" : "");

    if (isOpen && window.loadExpenseLedger) {
      content.innerHTML = `<p style="font-size:12px;color:var(--muted);padding:8px 0;">Loading...</p>`;
      const events = await window.loadExpenseLedger(card.id);
      content.innerHTML = renderLedgerEvents(events);
    }
  }, { once: true });

  // Reset content on each new card open
  content.hidden = true;
  toggleBtn?.setAttribute("aria-expanded", "false");
  toggleBtn?.querySelector(".ledger-chevron")?.style.setProperty("transform", "");
  content.innerHTML = "";
}

function renderLedgerEvents(events) {
  if (!events || !events.length) {
    return `<p style="font-size:12px;color:var(--muted);padding:8px 0;">No history yet.</p>`;
  }
  return events.map((ev) => {
    const icon = LEDGER_EVENT_ICONS[ev.event_type] || "•";
    const label = (window.t?.(`expense.ledger_${ev.event_type}`) || ev.event_type.replace(/_/g, " "));
    const amtStr = ev.amount != null ? ` ${ev.currency || ""} ${parseFloat(ev.amount).toFixed(2)}` : "";
    const actor = ev.actor_name ? ` - ${ev.actor_name}` : "";
    const date = new Date(ev.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return `
      <div class="ledger-event">
        <span class="ledger-event-icon">${icon}</span>
        <span class="ledger-event-body">
          <strong>${label}${amtStr}</strong>${actor}
          <time class="ledger-event-time">${date}</time>
        </span>
      </div>
    `;
  }).join("");
}

function renderDialogMeta(card) {
  const meta = elements.dialogCardMeta;
  if (!meta || !card) return;

  const createdDate = card.createdAt
    ? new Date(card.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const gcalLinked = card.googleCalendar?.synced && card.googleCalendar?.htmlLink;
  const reminderPreset = card.googleCalendar?.reminderPreset || card.reminder?.preset;
  const reminderLabel = reminderPreset ? presetLabel(reminderPreset) : null;

  const lastEditedDate = card.lastEditedAt
    ? new Date(card.lastEditedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      + " " + new Date(card.lastEditedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;
  const showEdited = lastEditedDate && (card.lastEditedAt !== card.createdAt);

  meta.innerHTML = `
    <div class="dialog-meta-row">
      ${card.author ? `<span class="dialog-meta-item"><span class="dialog-meta-label">Added by</span>${escapeHtml(card.author)}</span>` : ""}
      ${createdDate ? `<span class="dialog-meta-item"><span class="dialog-meta-label">Added on</span>${createdDate}</span>` : ""}
      ${showEdited ? `<span class="dialog-meta-item"><span class="dialog-meta-label">Edited by</span>${escapeHtml(card.lastEditedBy || card.author || "")}</span>` : ""}
      ${showEdited ? `<span class="dialog-meta-item"><span class="dialog-meta-label">Edited on</span>${lastEditedDate}</span>` : ""}
      ${gcalLinked
        ? `<a class="dialog-meta-item dialog-meta-cal" href="${card.googleCalendar.htmlLink}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4M4 9h16M5 5h14v16H5z"/></svg>
            ${reminderLabel ? `Alert ${reminderLabel}` : "In calendar"}
           </a>`
        : (reminderLabel ? `<span class="dialog-meta-item"><span class="dialog-meta-label">Reminder</span>${reminderLabel}</span>` : "")}
    </div>
    <div id="dialogCardPeople" class="card-people"></div>
  `;
  // Re-render people icons inside the new meta HTML
  const peopleEl = meta.querySelector("#dialogCardPeople");
  if (peopleEl) {
    peopleEl.outerHTML = renderPeopleIcons(card, "dialogCardPeople");
    elements.dialogCardPeople = document.querySelector("#dialogCardPeople");
  }
}

function renderDialogConflictBanner(card) {
  // Remove any existing banner first
  document.querySelector("#dialogConflictBanner")?.remove();
  if (!card || typeof window.getConflictsForCard !== "function") return;
  const allConflicts = typeof window.detectConflicts === "function" ? window.detectConflicts(state.cards) : [];
  const cardConflicts = window.getConflictsForCard(card.id, allConflicts);
  if (!cardConflicts.length) return;

  const banner = document.createElement("div");
  banner.id = "dialogConflictBanner";
  banner.className = "conflict-banner dialog-conflict-banner";
  banner.innerHTML = cardConflicts.map((c) => {
    const otherTitle = c.a === card.id ? c.bTitle : c.aTitle;
    const otherTime = c.a === card.id ? c.bTime : c.aTime;
    const timeStr = otherTime
      ? new Date(otherTime).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : "";
    return `<div class="dialog-conflict-item">
      <span class="conflict-icon">&#9888;</span>
      <span>Conflicts with <strong>${escapeHtml(otherTitle)}</strong>${timeStr ? ` at ${timeStr}` : ""} - ${escapeHtml(c.reason)}</span>
    </div>`;
  }).join("");

  // Insert above the comment panel
  const commentPanel = document.querySelector("#commentPanel");
  if (commentPanel) {
    commentPanel.parentNode.insertBefore(banner, commentPanel);
  } else {
    elements.cardDialog.querySelector("form")?.appendChild(banner);
  }
}

function presetLabel(preset) {
  const map = { "15": "15 min before", "60": "1 hr before", "120": "2 hrs before", "1440": "1 day before", "10080": "1 week before", "at-due": "at event time" };
  return map[preset] || preset;
}

function updateDialogQuickActions(card) {
  const isDone = card.status === "Done";
  const _qt = window.t || ((k) => k);
  elements.dialogCompleteButton.textContent = isDone ? _qt("card.completed_btn") : card.type === "Expense" ? _qt("card.paid_btn") : _qt("card.done_btn");
  [
    elements.dialogCompleteButton,
    elements.dialogDoButton,
    elements.dialogPleaseButton,
    elements.dialogCannotButton,
  ].forEach((button) => {
    button.disabled = isDone;
  });
}

function setCardDialogEditMode(isEditing) {
  state.cardDialogEditMode = isEditing;
  const isExistingCard = Boolean(elements.cardId.value);
  const editableFields = [
    elements.titleInput,
    elements.topicInput,
    elements.typeInput,
    elements.statusInput,
    elements.assigneeInput,
    elements.childInput,
    elements.dueInput,
    elements.amountInput,
    elements.detailsInput,
    elements.voiceTranscriptInput,
  ];

  editableFields.forEach((field) => {
    if (field) field.disabled = !isEditing;
  });

  if (elements.voiceButton) elements.voiceButton.disabled = !isEditing;
  if (elements.autofillButton) elements.autofillButton.disabled = !isEditing;
  // LLM mode removed - always use direct form
  elements.cardForm.classList.remove("llm-new-card-mode");
  elements.llmCardChat?.classList.add("hidden");
  // Voice panel: hidden in view mode; accessible via toggle in edit mode
  const voicePanel = document.querySelector("#voicePanel");
  const voiceToggle = document.querySelector("#detailsVoiceToggle");
  const detailsHeader = document.querySelector("#detailsSectionHeader");
  if (voicePanel && !isEditing) voicePanel.classList.remove("open");
  if (detailsHeader) detailsHeader.style.display = isEditing ? "flex" : "none";
  if (voiceToggle && !voiceToggle._bound) {
    voiceToggle._bound = true;
    voiceToggle.addEventListener("click", () => {
      const panel = document.querySelector("#voicePanel");
      const isOpen = panel?.classList.toggle("open");
      voiceToggle.classList.toggle("active", isOpen);
      voiceToggle.title = isOpen ? "Hide voice input" : "Voice input";
    });
  }
  // Delete button visibility managed by openCardDialog (only for existing cards)
  elements.ackButton?.classList.toggle("hidden", true);
  elements.editCardMenuButton?.classList.toggle("hidden", true);
  // Hide the view-only hint when editing starts
  const viewHint = document.querySelector("#dialogViewHint");
  if (viewHint && isEditing) viewHint.hidden = true;
  elements.dialogMode.textContent = isEditing
    ? (isExistingCard ? "Editing card" : "New Do")
    : "Information, thread, reminder, and activity";
}

function focusCardDialogSection(section) {
  const target = section === "messages"
    ? elements.commentPanel
    : section === "reminder"
      ? elements.cardReminderPanel
      : null;
  if (!target) return;
  window.setTimeout(() => target.scrollIntoView({ block: "start", behavior: "smooth" }), 80);
}

function syncLlmCardPrompt(options = {}) {
  const text = elements.llmCardPromptInput?.value.trim() || "";
  elements.voiceTranscriptInput.value = text;
  elements.detailsInput.value = text;
  // Always run local inference immediately for instant feedback
  const derived = deriveFieldsFromShortInfo(text, { silent: true });
  renderLlmInterpretation(text);
  // If user clicked Interpret, also call the real AI
  if (options.announce && text.length > 8) {
    callAiInterpret(text);
  } else if (options.announce) {
    showToast("Add a little more detail");
  }
  return derived;
}

async function callAiInterpret(text) {
  if (!text?.trim()) return;
  // AI interpret is a paid feature - show upgrade prompt for free users
  if (!isPaidUser()) {
    showUpgradePrompt("AI field extraction is available on the paid plan.");
    return;
  }
  const interpretBtn = elements.llmInterpretButton;
  if (interpretBtn) {
    interpretBtn.textContent = "Thinking...";
    interpretBtn.disabled = true;
  }

  try {
    const setup = getOnboardingState();
    const body = {
      text,
      parentAName: setup?.parents?.primary || null,
      parentBName: setup?.parents?.coparent || null,
      childNames: (setup?.children || []).map((c) => c.name).filter(Boolean),
    };

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
      body: JSON.stringify({ action: "interpret", ...body }),
    });

    if (!res.ok) throw new Error(`${res.status}`);
    const fields = await res.json();

    // Apply AI-returned fields to the form
    if (fields.title) elements.titleInput.value = fields.title;
    if (fields.topic) elements.topicInput.value = fields.topic;
    if (fields.type) elements.typeInput.value = fields.type;
    if (fields.status) elements.statusInput.value = fields.status;
    if (fields.due) elements.dueInput.value = toDateTimeInputValue(new Date(fields.due));
    if (fields.amount) elements.amountInput.value = fields.amount;
    if (fields.assignee !== undefined) setSelectValue(elements.assigneeInput, fields.assignee);
    if (fields.child !== undefined) setSelectValue(elements.childInput, fields.child);
    if (fields.details) elements.detailsInput.value = fields.details;

    // Apply AI-extracted reminder
    if (fields.reminderMinutes != null && elements.cardReminderPresetInput) {
      setSelectValue(elements.cardReminderPresetInput, String(fields.reminderMinutes));
      const dueVal = elements.dueInput.value;
      if (dueVal) {
        elements.cardReminderTimeInput.value = buildReminderTime(
          { due: new Date(dueVal).toISOString() }, String(fields.reminderMinutes)
        );
      }
      updateReminderCustomVisibility();
    }
    if (fields.reminderAbsolute && elements.cardReminderPresetInput) {
      elements.cardReminderPresetInput.value = "custom";
      elements.cardReminderTimeInput.value = toDateTimeInputValue(new Date(fields.reminderAbsolute));
      updateReminderCustomVisibility();
    }

    // Apply AI-extracted recurrence
    if (fields.recurrence) {
      const recInput = document.querySelector("#recurrenceInput");
      const recDaysRow = document.querySelector("#recurrenceDaysRow");
      if (recInput) {
        recInput.value = fields.recurrence.freq?.toLowerCase() || "none";
        const showDays = ["weekly", "biweekly"].includes(recInput.value);
        recDaysRow?.classList.toggle("hidden", !showDays);
        if (showDays && fields.recurrence.days?.length) {
          recDaysRow?.querySelectorAll(".recurrence-day").forEach((cb) => {
            cb.checked = fields.recurrence.days.includes(cb.value);
          });
        }
      }
    }

    renderDerivedTags();
    renderLlmInterpretation(fields.title || text);
    showToast("Do filled in by AI");
  } catch (err) {
    console.warn("AI interpret failed, using local inference:", err.message);
    showToast("Do preview updated");
  } finally {
    if (interpretBtn) {
      interpretBtn.textContent = "Interpret";
      interpretBtn.disabled = false;
    }
  }
}

function renderLlmInterpretation(text) {
  if (!elements.llmInterpretation) return;
  if (!text.trim()) {
    elements.llmInterpretation.classList.add("hidden");
    elements.llmInterpretation.innerHTML = "";
    return;
  }
  elements.llmInterpretation.classList.remove("hidden");
  const previewTags = [
    elements.titleInput.value,
    elements.topicInput.value,
    elements.typeInput.value,
    elements.statusInput.value,
    elements.assigneeInput.value,
    elements.childInput.value,
    elements.dueInput.value ? formatDate(new Date(elements.dueInput.value).toISOString()) : "",
    elements.amountInput.value,
  ].filter(Boolean);

  elements.llmInterpretation.innerHTML = `
    <strong>${escapeHtml(elements.titleInput.value || "New Do")}</strong>
    <span>${escapeHtml(elements.detailsInput.value || text)}</span>
    <div class="derived-tags llm-preview-tags">
      ${previewTags.map((tag) => renderTagButton(tag, "derived-tag", true)).join("")}
    </div>
  `;
}

function startVoiceCapture() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const chatFlowActive = !elements.llmCardChat?.classList.contains("hidden");
  if (!Recognition) {
    (chatFlowActive ? elements.llmCardPromptInput : elements.voiceTranscriptInput).focus();
    showToast(chatFlowActive
      ? "Voice recording is not available here. Type the Do message."
      : "Voice recording is not available here. Type or paste the request, then tap Autofill fields.");
    return;
  }

  const recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  elements.voiceButton?.classList.add("recording");
  elements.llmVoiceButton?.classList.add("recording");
  if (elements.voiceStatus) elements.voiceStatus.textContent = "Listening...";

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    if (chatFlowActive) {
      elements.llmCardPromptInput.value = transcript;
      syncLlmCardPrompt({ announce: true });
    } else {
      // Put transcript directly into details field and auto-autofill
      if (elements.detailsInput) elements.detailsInput.value = transcript;
      if (elements.voiceTranscriptInput) elements.voiceTranscriptInput.value = transcript;
      autofillFromVoice(transcript);
    }
  });

  recognition.addEventListener("end", () => {
    elements.voiceButton?.classList.remove("recording");
    elements.llmVoiceButton?.classList.remove("recording");
    if (elements.voiceStatus) elements.voiceStatus.textContent = "Record what has to be done";
  });

  recognition.addEventListener("error", () => {
    elements.voiceButton?.classList.remove("recording");
    elements.llmVoiceButton?.classList.remove("recording");
    if (elements.voiceStatus) elements.voiceStatus.textContent = "Record what has to be done";
    (chatFlowActive ? elements.llmCardPromptInput : elements.voiceTranscriptInput).focus();
    showToast("Could not access voice recording. Type the request instead.");
  });

  try {
    recognition.start();
  } catch {
    elements.voiceButton?.classList.remove("recording");
    elements.detailsInput?.focus();
    showToast("Could not start voice recording. Type the request instead.");
  }
}

function startDictationForField(field, options = {}) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!field) return;
  if (!Recognition) {
    field.focus();
    showToast(options.fallback || "Voice dictation is not available here. Type instead.");
    return;
  }

  const recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  options.button?.classList.add("recording");

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    field.value = field.value ? `${field.value.trim()} ${transcript}` : transcript;
    field.focus();
    showToast(options.success || "Dictation added");
  });

  recognition.addEventListener("end", () => {
    options.button?.classList.remove("recording");
  });

  recognition.addEventListener("error", () => {
    options.button?.classList.remove("recording");
    field.focus();
    showToast(options.fallback || "Could not access voice dictation. Type instead.");
  });

  try {
    recognition.start();
  } catch {
    options.button?.classList.remove("recording");
    field.focus();
    showToast(options.fallback || "Could not start voice dictation. Type instead.");
  }
}

function startMobileVoiceCapture() {
  clearMobileVoiceTimer();
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  openCardDialog();

  if (!Recognition) {
    elements.voiceTranscriptInput.focus();
    showToast("Voice recording is not available here. Type or paste the request, then tap Autofill fields.");
    return;
  }

  const recognition = new Recognition();
  mobileVoice.recognition = recognition;
  mobileVoice.active = true;
  elements.mobileNewCardButton.classList.add("recording");
  elements.mobileNewCardButton.setAttribute("aria-label", "Listening. Release to stop.");
  elements.voiceButton?.classList.add("recording");
  if (elements.voiceStatus) elements.voiceStatus.textContent = "Listening from bottom mic...";
  elements.voiceTranscriptInput.value = "";

  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    elements.voiceTranscriptInput.value = transcript;
    autofillFromVoice(transcript);
    showToast("Voice card drafted");
  });

  recognition.addEventListener("end", resetMobileVoiceCapture);
  recognition.addEventListener("error", () => {
    resetMobileVoiceCapture();
    elements.voiceTranscriptInput.focus();
    showToast("Could not access voice recording. Type the request and tap Autofill fields.");
  });

  try {
    recognition.start();
  } catch {
    resetMobileVoiceCapture();
    elements.voiceTranscriptInput.focus();
    showToast("Could not start voice recording. Type the request and tap Autofill fields.");
  }
}

function stopMobileVoiceCapture() {
  clearMobileVoiceTimer();
  if (!mobileVoice.recognition) {
    resetMobileVoiceCapture();
    return;
  }
  try {
    mobileVoice.recognition.stop();
  } catch {
    resetMobileVoiceCapture();
  }
}

function resetMobileVoiceCapture() {
  mobileVoice.active = false;
  mobileVoice.recognition = null;
  elements.mobileNewCardButton?.classList.remove("recording");
  elements.mobileNewCardButton?.setAttribute("aria-label", "Create new Do. Hold to dictate.");
  elements.voiceButton?.classList.remove("recording");
  if (elements.voiceStatus) elements.voiceStatus.textContent = "Record what has to be done";
}

function autofillFromVoice(rawText) {
  const text = rawText.trim();
  if (!text) {
    showToast("Add a voice transcript first");
    return;
  }

  elements.detailsInput.value = text;
  deriveFieldsFromShortInfo(text);
}

function deriveFieldsFromShortInfo(rawText, options = {}) {
  const text = rawText.trim();
  if (!text) {
    renderDerivedTags();
    return false;
  }

  const lower = text.toLowerCase();
  elements.titleInput.value = makeTitleFromText(text);
  elements.topicInput.value = inferTopic(lower);
  elements.typeInput.value = inferType(lower);
  elements.statusInput.value = inferStatus(lower);
  // Only set assignee if a name is explicitly mentioned - no default fallback
  const explicitAssignee = inferAssigneeFromMention(lower);
  if (explicitAssignee) setSelectValue(elements.assigneeInput, explicitAssignee);
  setSelectValue(elements.childInput, inferChild(lower));
  elements.amountInput.value = inferAmount(text);
  const dueValue = inferDueDate(lower);
  elements.dueInput.value = dueValue || "";

  // Auto-set reminder from text if mentioned
  const inferredReminder = inferReminderFromText(lower);
  if (inferredReminder && elements.cardReminderPresetInput) {
    setSelectValue(elements.cardReminderPresetInput, inferredReminder.preset);
    if (inferredReminder.isoTime) {
      elements.cardReminderTimeInput.value = toDateTimeInputValue(new Date(inferredReminder.isoTime));
    } else if (dueValue && inferredReminder.preset !== "custom") {
      elements.cardReminderTimeInput.value = buildReminderTime({ due: new Date(dueValue).toISOString() }, inferredReminder.preset);
    }
    updateReminderCustomVisibility();
  }

  // Auto-set recurrence from text
  const inferredRecurrence = inferRecurrence(lower);
  if (inferredRecurrence) {
    const recInput = document.querySelector("#recurrenceInput");
    const daysRow = document.querySelector("#recurrenceDaysRow");
    if (recInput) {
      recInput.value = inferredRecurrence;
      const showDays = ["weekly", "biweekly"].includes(inferredRecurrence);
      daysRow?.classList.toggle("hidden", !showDays);
    }
  }

  renderDerivedTags();
  if (!options.silent) showToast("Do tags derived from info");

  // Schedule AI interpretation - fires after typing pauses, overrides regex results
  if (!options.noAI && !options.silent && text.length > 8) {
    clearTimeout(_interpretTimer);
    _interpretTimer = setTimeout(() => callAiInterpret(text), 800);
  }

  return true;
}

let _interpretTimer = null;

function renderDerivedTags() {
  if (!elements.derivedTags) return;
  const card = state.cards.find((item) => item.id === elements.cardId.value);
  const commentsCount = card?.comments?.length || 0;
  const tagValues = [
    elements.topicInput.value,
    elements.typeInput.value,
    elements.childInput.value,
    elements.assigneeInput.value,
    elements.amountInput.value || "",
    commentsCount ? `${commentsCount} message${commentsCount === 1 ? "" : "s"}` : "",
  ].map(compactTag).filter(Boolean);

  elements.derivedTags.innerHTML = tagValues
    .map((value) => renderTagButton(value, "derived-tag", true))
    .join("");

  renderMiniCal();
}

function renderMiniCal() {
  const el = document.getElementById("miniCalPicker");
  if (!el) return;

  const dueVal = elements.dueInput?.value; // "YYYY-MM-DDTHH:MM"
  const selected = dueVal ? new Date(dueVal) : null;
  const today = new Date();

  // Use stored view state or default to selected/today month
  let viewYear = el.dataset.viewYear ? parseInt(el.dataset.viewYear) : (selected || today).getFullYear();
  let viewMonth = el.dataset.viewMonth !== undefined ? parseInt(el.dataset.viewMonth) : (selected || today).getMonth();

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Mo","Tu","We","Th","Fr","Sa","Su"];

  const firstDay = new Date(viewYear, viewMonth, 1);
  // Convert Sun=0 to Mon=0 system
  let startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  let cells = "";
  let dayNum = 1;
  for (let row = 0; row < 6; row++) {
    cells += "<tr>";
    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      if (cellIndex < startDow || dayNum > daysInMonth) {
        cells += "<td></td>";
      } else {
        const d = new Date(viewYear, viewMonth, dayNum);
        const isToday = d.toDateString() === today.toDateString();
        const isSelected = selected && d.toDateString() === selected.toDateString();
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        let cls = "mc-day";
        if (isToday) cls += " mc-today";
        if (isSelected) cls += " mc-selected";
        cells += `<td><button class="${cls}" type="button" data-date="${dateStr}">${dayNum}</button></td>`;
        dayNum++;
      }
    }
    cells += "</tr>";
    if (dayNum > daysInMonth) break;
  }

  // Current time portion for the time input
  const currentTime = dueVal ? dueVal.slice(11, 16) : "12:00";

  el.innerHTML = `
    <div class="mc-header">
      <button class="mc-nav" type="button" id="miniCalPrev">&#8249;</button>
      <span class="mc-month-label">${monthNames[viewMonth]} ${viewYear}</span>
      <button class="mc-nav" type="button" id="miniCalNext">&#8250;</button>
    </div>
    <table class="mc-grid">
      <thead><tr>${dayNames.map((d) => `<th>${d}</th>`).join("")}</tr></thead>
      <tbody>${cells}</tbody>
    </table>
    <div class="mc-time-row">
      <span class="mc-time-label">Time</span>
      <input class="mc-time-input" type="time" id="miniCalTime" value="${currentTime}" step="900">
    </div>
    ${dueVal ? `<button class="mc-clear" type="button" id="miniCalClear">&#215; Clear date</button>` : ""}
    ${(() => {
      const cs = window.getCustodySchedule?.();
      if (!cs?.enabled) return "";
      const locked = elements.lockAssigneeInput?.checked || false;
      return `<label class="mc-lock-assignee-row">
        <input type="checkbox" id="mcLockAssigneeVis"${locked ? " checked" : ""}>
        <span>Don't assign scheduled parent</span>
      </label>`;
    })()}
  `;
  el.dataset.viewYear = viewYear;
  el.dataset.viewMonth = viewMonth;

  // Sync visible lock-assignee checkbox <-> hidden input
  el.querySelector("#mcLockAssigneeVis")?.addEventListener("change", (e) => {
    if (elements.lockAssigneeInput) elements.lockAssigneeInput.checked = e.target.checked;
  });

  el.querySelector("#miniCalPrev")?.addEventListener("click", () => {
    let m = parseInt(el.dataset.viewMonth) - 1;
    let y = parseInt(el.dataset.viewYear);
    if (m < 0) { m = 11; y--; }
    el.dataset.viewMonth = m;
    el.dataset.viewYear = y;
    renderMiniCal();
  });

  el.querySelector("#miniCalNext")?.addEventListener("click", () => {
    let m = parseInt(el.dataset.viewMonth) + 1;
    let y = parseInt(el.dataset.viewYear);
    if (m > 11) { m = 0; y++; }
    el.dataset.viewMonth = m;
    el.dataset.viewYear = y;
    renderMiniCal();
  });

  el.querySelectorAll(".mc-day").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dateStr = btn.dataset.date;
      // Preserve existing time if set, else use noon
      let timeStr = "12:00";
      if (elements.dueInput?.value) {
        const parts = elements.dueInput.value.split("T");
        if (parts[1]) timeStr = parts[1].slice(0, 5);
      }
      if (elements.dueInput) elements.dueInput.value = `${dateStr}T${timeStr}`;
      _syncCardDueRow();
      renderDerivedTags();
      maybeAutoAssignParent(dateStr);
    });
  });

  // Time input inside mini-cal - sync to dueInput and to the visible row
  el.querySelector("#miniCalTime")?.addEventListener("change", (e) => {
    const timeVal = e.target.value; // "HH:MM"
    if (!timeVal) return;
    if (elements.dueInput?.value) {
      const datePart = elements.dueInput.value.slice(0, 10);
      elements.dueInput.value = `${datePart}T${timeVal}`;
    } else {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
      if (elements.dueInput) elements.dueInput.value = `${todayStr}T${timeVal}`;
    }
    _syncCardDueRow();
    renderDerivedTags();
  });

  el.querySelector("#miniCalClear")?.addEventListener("click", () => {
    if (elements.dueInput) elements.dueInput.value = "";
    if (elements.cardDateInput) elements.cardDateInput.value = "";
    if (elements.cardTimeInput) elements.cardTimeInput.value = "";
    renderDerivedTags();
  });
}

// Sync the visible date + time row in the card dialog to/from dueInput
function _syncCardDueRow() {
  const dueVal = elements.dueInput?.value; // "YYYY-MM-DDTHH:MM" or ""
  if (elements.cardDateInput) elements.cardDateInput.value = dueVal ? dueVal.slice(0, 10) : "";
  if (elements.cardTimeInput) elements.cardTimeInput.value = dueVal ? dueVal.slice(11, 16) : "";
}

// Bind the card due row inputs (called once after elements are ready)
function _bindCardDueRow() {
  if (!elements.cardDateInput) return;

  elements.cardDateInput.addEventListener("change", () => {
    const dateVal = elements.cardDateInput.value; // "YYYY-MM-DD"
    const timeVal = elements.cardTimeInput?.value || "12:00";
    if (elements.dueInput) elements.dueInput.value = dateVal ? `${dateVal}T${timeVal}` : "";
    maybeAutoAssignParent(dateVal);
    renderDerivedTags(); // also calls renderMiniCal
  });

  elements.cardTimeInput?.addEventListener("change", () => {
    const timeVal = elements.cardTimeInput.value;
    if (!timeVal) return;
    const datePart = elements.dueInput?.value?.slice(0, 10) || (() => {
      const t = new Date();
      return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
    })();
    if (elements.dueInput) elements.dueInput.value = `${datePart}T${timeVal}`;
    renderDerivedTags();
  });

  elements.cardDueClear?.addEventListener("click", () => {
    if (elements.dueInput) elements.dueInput.value = "";
    if (elements.cardDateInput) elements.cardDateInput.value = "";
    if (elements.cardTimeInput) elements.cardTimeInput.value = "";
    renderDerivedTags();
  });
}

function renderTagButton(value, className, showHash = false) {
  const label = showHash ? `#${compactTag(value)}` : value;
  return `<button class="${className}" type="button" data-tag-filter="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function compactTag(value) {
  return String(value)
    .replace(/^CHF\s?0(?:[.,]00)?$/i, "")
    .replace(/\s+/g, "")
    .replace("Bothparents", "BothParents")
    .replace("InfoOnly", "Info")
    .replace("ToDo", "Todo");
}

function formatDueTag(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en", { month: "short" });
  const time = `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  return `${day}${month}${time}`;
}

function makeTitleFromText(text) {
  let raw = text
    .replace(/^(please|can you|could you|remind me to|we need to)\s+/i, "")
    .split(/[.!?]/)[0]
    .trim();

  // Strip metadata tokens so they don't pollute the title
  // Date: "10 june", "10 czerwca", "10.06", numeric dates
  raw = raw.replace(/\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|stycze[nń]|lut[ey]|marzec|kwiecie[nń]|maj|czerwiec|lipiec|sierpie[nń]|wrzesie[nń]|pa[zź]dziernik|listopad|grudzie[nń])\b/gi, "");
  raw = raw.replace(/\b\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?\b/g, "");
  // Time: "o 17:30", "at 13:00", "13:0", "do 19:30" / "to 19:30"
  raw = raw.replace(/\b(?:o\s+godzinie|o\s+|at\s+)\d{1,2}:\d{1,2}(?:\s*(?:am|pm))?\b/gi, "");
  raw = raw.replace(/\b(?:do|to|until)\s+\d{1,2}:\d{1,2}\b/gi, "");
  raw = raw.replace(/\b\d{1,2}:\d{1,2}(?:\s*(?:am|pm))?\b/g, "");
  // Recurrence phrases
  raw = raw.replace(/\b(?:recurring\s+)?(?:every|each|co)\s+(?:week|day|month|two weeks?|tydzien|tydzie[nń]|dzie[nń]|miesi[aą]c)\b/gi, "");
  raw = raw.replace(/\b(?:co\s+)?(?:poniedzia[lł]ek|wtorek|[sś]rod[ęa]|czwartek|pi[aą]tek|sobot[ęa]|niedziel[ęa]|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "");
  raw = raw.replace(/\b(?:weekly|daily|monthly|biweekly|recurring\s+ever[y]?)\b/gi, "");
  // Reminder phrases
  raw = raw.replace(/\b(?:reminder?|remind\s+me|alert|notify)\s+\d+\s*(?:h(?:r|ours?)?|min(?:utes?)?)\s*(?:before|earlier)?\b/gi, "");
  raw = raw.replace(/\b\d+\s*h(?:r|ours?)?\s*(?:before|reminder|alert)\b/gi, "");

  // Clean up leftover whitespace/punctuation
  raw = raw.replace(/\s{2,}/g, " ").replace(/^[\s,\-]+|[\s,\-]+$/g, "").trim().slice(0, 72) || "New Do";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function inferTopic(lower) {
  if (/(school|teacher|class|form|camp|homework|trip)/.test(lower)) return "School";
  if (/(doctor|dentist|medical|medicine|allergy|pharmacy|appointment)/.test(lower)) return "Medical";
  if (/(pay|paid|expense|invoice|receipt|chf|usd|eur|reimburse|cost)/.test(lower)) return "Expenses";
  if (/(message|tell|ask|reply|send)/.test(lower)) return "General";
  if (/(pickup|drop off|calendar|schedule|meeting|event|tomorrow|today|friday|monday|tuesday|wednesday|thursday|saturday|sunday)/.test(lower)) return "Schedule";
  return "General";
}

function inferType(lower) {
  if (/(pay|paid|expense|invoice|receipt|chf|usd|eur|reimburse|cost)/.test(lower)) return "Expense";
  if (/(meeting|appointment|event|practice|pickup|drop off)/.test(lower)) return "Event";
  if (/(message|tell|reply|send|fyi|note|info|remember|remind)/.test(lower)) return "Info";
  if (/(can you|could you|please)/.test(lower)) return "Request";
  return "Task";
}

function inferStatus(lower) {
  if (/(urgent|important|asap|today|remind)/.test(lower)) return "Important";
  if (/(can you|could you|please|waiting|respond|response|approve|confirm)/.test(lower)) return "Waiting";
  return "To Do";
}

function inferAssignee(lower) {
  const family = getFamilyPeople();
  // Check caregivers first (most specific names)
  for (const cg of (family.caregivers || [])) {
    if (textMentionsName(lower, cg.name)) return cg.name;
  }
  if (family.coparent.aliases.some((name) => textMentionsName(lower, name))) return "Parent B";
  if (family.primary.aliases.some((name) => textMentionsName(lower, name))) return "Parent A";
  if (lower.includes("parent b") || lower.includes("other parent")) return "Parent B";
  if (/(both|together|parents|parent-teacher|parent teacher)/.test(lower)) return "Both parents";
  if (lower.includes("child")) return "Child";
  return "Parent A";
}

// Like inferAssignee but returns null if no explicit name mention - no "Parent A" default
function inferAssigneeFromMention(lower) {
  const family = getFamilyPeople();
  // Check caregivers first
  for (const cg of (family.caregivers || [])) {
    if (textMentionsName(lower, cg.name)) return cg.name;
  }
  if (family.coparent.aliases.some((name) => textMentionsName(lower, name))) return "Parent B";
  if (family.primary.aliases.some((name) => textMentionsName(lower, name))) return "Parent A";
  if (lower.includes("parent b") || lower.includes("other parent")) return "Parent B";
  if (lower.includes("parent a") || lower.includes("my task") || lower.includes("i will") || lower.includes("i'll")) return "Parent A";
  if (/(both|together|parents|parent-teacher|parent teacher)/.test(lower)) return "Both parents";
  return null; // no explicit mention - don't auto-assign
}

function inferChild(lower) {
  const family = getFamilyPeople();
  const mentioned = [...family.children, ...family.pets]
    .map((person) => person.name)
    .filter((name) => textMentionsName(lower, name));
  if (mentioned.length) return [...new Set(mentioned)].join(" + ");
  if (lower.includes("ava") && lower.includes("leo")) return "Ava + Leo";
  if (lower.includes("leo")) return "Leo";
  return family.children[0]?.name || "Ava";
}

// Infer recurrence from natural language text.
// Returns "weekly" | "daily" | "biweekly" | "monthly" | null
function inferRecurrence(lower) {
  // Polish "co sroda/środa" (every Wednesday) etc. - "co [weekday]" implies weekly
  if (/\bco\s+(?:poniedzia[lł]ek|wtorek|[sś]rod[ęa]|czwartek|pi[aą]tek|sobot[ęa]|niedziel[ęa])\b/.test(lower)) return "weekly";
  // English "every [weekday]"
  if (/\bevery\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower)) return "weekly";
  // "recurring ever" is a common voice recognition artifact for "recurring every (week)"
  if (/\b(?:recurring\s+ever\b|every\s+week|each\s+week|weekly|co\s+tydzie[nń]|ka[zż]d[yą]\s+tydzie[nń])\b/.test(lower)) return "weekly";
  if (/\b(?:every\s+two\s+weeks?|bi.?weekly|every\s+other\s+week|co\s+dwa\s+tygodnie)\b/.test(lower)) return "biweekly";
  if (/\b(?:every\s+day|each\s+day|daily|codziennie)\b/.test(lower)) return "daily";
  if (/\b(?:every\s+month|each\s+month|monthly|co\s+miesi[aą]c)\b/.test(lower)) return "monthly";
  return null;
}

// Returns the current user's real name (from onboarding or auth), never "Parent A"
function getMyName() {
  const setup = getOnboardingState() || {};
  return setup.parents?.primary
    || currentAuthSession?.user?.user_metadata?.full_name
    || currentAuthSession?.user?.email?.split("@")[0]
    || "Parent A";
}

function getFamilyPeople() {
  const setup = getOnboardingState() || {};
  const primaryName = setup.parents?.primary || "Parent A";
  const coparentName = setup.parents?.coparent || "Parent B";
  const children = normalizePeopleList(setup.children, ["Ava", "Leo"]);
  const pets = normalizePeopleList(setup.pets, ["Milo"]);
  const caregivers = normalizePeopleList(setup.caregivers, []);
  return {
    primary: { role: "Parent A", name: primaryName, aliases: ["Parent A", "primary parent", primaryName] },
    coparent: { role: "Parent B", name: coparentName, aliases: ["Parent B", "co-parent", "coparent", "other parent", coparentName] },
    caregivers, // [{ name: "Babcia" }, { name: "Opiekunka" }, ...]
    children,
    pets,
  };
}

function normalizePeopleList(items, fallbackNames = []) {
  const names = Array.isArray(items)
    ? items.map((item) => (typeof item === "string" ? item : item?.name)).filter(Boolean)
    : [];
  return (names.length ? names : fallbackNames).map((name) => ({ name }));
}

function textMentionsName(lowerText, name) {
  const lowerName = String(name || "").trim().toLowerCase();
  if (!lowerName) return false;
  const escaped = lowerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lowerText);
}

function inferAmount(text) {
  const match = text.match(/(?:CHF|PLN|USD|EUR|£|\$|€)\s?\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s?(?:CHF|PLN|USD|EUR)/i);
  return match ? match[0].replace(/\s+/g, " ") : "";
}

function inferDueDate(lower) {
  const date = new Date();

  // Month name lookup - English and Polish (nominative + genitive forms)
  const monthNames = [
    ["january","jan","styczen","stycznia","stycznia"],
    ["february","feb","luty","lutego"],
    ["march","mar","marzec","marca"],
    ["april","apr","kwiecien","kwietnia"],
    ["may","maj","maja"],
    ["june","jun","czerwiec","czerwca"],
    ["july","jul","lipiec","lipca"],
    ["august","aug","sierpien","sierpnia"],
    ["september","sep","sept","wrzesien","wrzesnia"],
    ["october","oct","pazdziernik","pazdziernika"],
    ["november","nov","listopad","listopada"],
    ["december","dec","grudzien","grudnia"],
  ];

  // Try "DD monthName" or "monthName DD" pattern (e.g. "10 june", "june 10")
  let namedDateFound = false;
  for (let m = 0; m < monthNames.length; m++) {
    for (const name of monthNames[m]) {
      const reDayFirst = new RegExp(`\\b(\\d{1,2})\\s+${name}(?:\\s+(\\d{2,4}))?\\b`);
      const reMonthFirst = new RegExp(`\\b${name}\\s+(\\d{1,2})(?:\\s+(\\d{2,4}))?\\b`);
      const matchDayFirst = lower.match(reDayFirst);
      const matchMonthFirst = lower.match(reMonthFirst);
      const match = matchDayFirst || matchMonthFirst;
      if (match) {
        const day = Number(matchDayFirst ? match[1] : match[1]);
        const yearStr = matchDayFirst ? match[2] : match[2];
        const year = yearStr
          ? Number(yearStr.length === 2 ? `20${yearStr}` : yearStr)
          : date.getFullYear();
        date.setFullYear(year, m, day);
        namedDateFound = true;
        break;
      }
    }
    if (namedDateFound) break;
  }

  // Numeric date format: DD.MM, DD/MM, DD-MM (only if no named date found)
  const explicitDate = !namedDateFound && lower.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]) - 1;
    const year = explicitDate[3]
      ? Number(explicitDate[3].length === 2 ? `20${explicitDate[3]}` : explicitDate[3])
      : date.getFullYear();
    date.setFullYear(year, month, day);
  }

  // Polish keywords: dzisiaj/dziś=today, jutro=tomorrow, pojutrze=day after tomorrow, następny tydzień=next week
  const isToday = lower.includes("today") || /dzisia[jj]|dzi[sś]/.test(lower);
  const isTomorrow = lower.includes("tomorrow") || lower.includes("jutro");
  const isDayAfter = lower.includes("pojutrze");
  const isNextWeek = lower.includes("next week") || /nast[eę]pn/.test(lower);

  if (isTomorrow) date.setDate(date.getDate() + 1);
  if (isDayAfter) date.setDate(date.getDate() + 2);
  if (isNextWeek) date.setDate(date.getDate() + 7);

  // Polish day names including unaccented voice-recognition variants and "co sroda" style
  // Order: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
  const plDays = [
    ["niedziela", "niedziel"],
    ["poniedziałek", "poniedzialk"],
    ["wtorek"],
    ["środa", "sroda", "środ", "srod"],
    ["czwartek"],
    ["piątek", "piatek", "piątk"],
    ["sobota", "sobot"],
  ];
  const enDays = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

  const hasPlDay = plDays.some((variants) => variants.some((v) => lower.includes(v)));

  if (!namedDateFound && !explicitDate && !isToday && !isTomorrow && !isDayAfter && !isNextWeek
    && !enDays.some((d) => lower.includes(d))
    && !hasPlDay) return "";

  // English day-of-week
  const targetDayEn = enDays.findIndex((d) => lower.includes(d));
  // Polish day-of-week
  const targetDayPl = plDays.findIndex((variants) => variants.some((v) => lower.includes(v)));
  const targetDay = targetDayEn >= 0 ? targetDayEn : targetDayPl;
  if (targetDay >= 0) {
    const current = date.getDay();
    const diff = (targetDay - current + 7) % 7 || 7;
    date.setDate(date.getDate() + diff);
  }

  const timeMatch = extractPrimaryTime(lower);
  let hours = 9;
  let minutes = 0;
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2] || 0);
    if (timeMatch[3] === "pm" && hours < 12) hours += 12;
    if (timeMatch[3] === "am" && hours === 12) hours = 0;
  }
  date.setHours(hours, minutes, 0, 0);
  return toDateTimeInputValue(date);
}

function extractPrimaryTime(lower) {
  const actionTime = lower.match(/\b(?:pickup|pick up|drop off|dismissal|meeting|appointment|event|practice)\b.{0,50}?\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\b/);
  if (actionTime) return actionTime;

  // "at 12" (English) or "o 12" / "o godzinie 12" (Polish)
  const atTime = lower.match(/\b(?:at|o godzinie|o)\s+(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\b/);
  if (atTime) return atTime;

  // Match HH:MM or HH:M (e.g. "13:0" = 13:00) - require 1-2 digit minutes
  const explicitTimes = lower.matchAll(/\b(\d{1,2}):(\d{1,2})\s?(am|pm)?\b/g);
  for (const match of explicitTimes) {
    const prefix = lower.slice(Math.max(0, match.index - 14), match.index);
    if (/(before|by|until|instead of)\s*$/.test(prefix)) continue;
    return match;
  }

  return null;
}

// Infer reminder from natural language text.
// Returns { preset, isoTime } or null if nothing found.
function inferReminderFromText(text) {
  const lower = text.toLowerCase();

  // "remind me in 2 hours" / "alert 30 minutes before"
  const minutesBefore = lower.match(/\b(?:remind(?:er)?|alert|notify)\s+(?:me\s+)?(\d+)\s*(?:hour|hr)s?\s*before\b/);
  if (minutesBefore) {
    const mins = Number(minutesBefore[1]) * 60;
    return { preset: String(mins), isoTime: null };
  }
  const minBefore = lower.match(/\b(?:remind(?:er)?|alert|notify)\s+(?:me\s+)?(\d+)\s*min(?:ute)?s?\s*before\b/);
  if (minBefore) return { preset: String(minBefore[1]), isoTime: null };

  // "reminder 2h before" / "2h reminder"
  const shortHr = lower.match(/\b(\d+)\s*h(?:r|ours?)?\s*(?:before|reminder|alert)\b|\b(?:reminder|alert)\s*(\d+)\s*h\b/);
  if (shortHr) {
    const hrs = Number(shortHr[1] || shortHr[2]);
    return { preset: String(hrs * 60), isoTime: null };
  }

  // "remind me at 3pm" / "reminder at 09:00"
  const atTime = lower.match(/\b(?:remind(?:er)?|alert|notify)\s+(?:me\s+)?at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (atTime) {
    let h = Number(atTime[1]);
    const m = Number(atTime[2] || 0);
    if (atTime[3] === "pm" && h < 12) h += 12;
    if (atTime[3] === "am" && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return { preset: "custom", isoTime: d.toISOString() };
  }

  // "remind me 1 day before" / "1 week before"
  if (/\b(?:remind|alert|reminder).{0,20}1\s*day\s*before\b/.test(lower)) return { preset: "1440", isoTime: null };
  if (/\b(?:remind|alert|reminder).{0,20}1\s*week\s*before\b/.test(lower)) return { preset: "10080", isoTime: null };

  // just "reminder" or "remind me" with no time qualifier -> use 1 day before
  if (/\b(?:remind me|reminder)\b/.test(lower)) return { preset: "1440", isoTime: null };

  return null;
}

function setSelectValue(select, value) {
  if (!select) return;
  const stringValue = String(value || "");
  if (stringValue && ![...select.options].some((option) => option.value === stringValue)) {
    select.add(new Option(stringValue, stringValue));
  }
  select.value = stringValue;
}

const SYSTEM_COMMENT_TEXTS = new Set([
  "Acknowledged", "Please do it", "Can't do this", "I'll do it",
  "Marked done", "Marked paid", "Done", "Paid",
]);

function isSystemComment(comment) {
  if (comment.system === true) return true;
  if (SYSTEM_COMMENT_TEXTS.has(comment.text?.trim())) return true;
  if (/^Reminder set for /i.test(comment.text)) return true;
  if (/^Recurring reminder/i.test(comment.text)) return true;
  return false;
}

function renderComments(card) {
  const family = getFamilyPeople();
  const myName = family.primary.name || "Parent A";
  const visibleComments = (card.comments || []).filter((c) => !isSystemComment(c));
  elements.commentList.innerHTML = visibleComments.length
    ? visibleComments.map((comment) => {
        const isMine = comment.author === myName || comment.author === "Parent A";
        const authorDisplay = displayPersonName(comment.author);
        return `
          <div class="chat-bubble ${isMine ? "chat-mine" : "chat-theirs"}">
            <div class="chat-meta">${escapeHtml(authorDisplay)} · ${escapeHtml(comment.time)}</div>
            <div class="chat-text">${escapeHtml(comment.text)}</div>
          </div>
        `;
      }).join("")
    : `<div class="chat-empty">No messages yet</div>`;
}

function renderActivity(card) {
  const items = [
    {
      label: "Created",
      detail: card.createdAt ? formatDate(card.createdAt) : "Recently",
    },
    ...card.comments.slice(-4).map((comment) => ({
      label: comment.author,
      detail: `${comment.text} · ${comment.time}`,
    })),
  ];

  if (card.reminder) {
    items.push({
      label: "Reminder",
      detail: formatReminder(card.reminder),
    });
  }

  elements.activityList.innerHTML = items.map((item) => `
    <div class="activity-row">
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.detail)}</span>
    </div>
  `).join("");
}

function addCardDialogMessage() {
  const id = elements.cardId.value;
  const text = elements.commentInput.value.trim();
  if (!id || !text) return;
  const mentionedParent = detectParentMention(text);
  state.cards = state.cards.map((item) => {
    if (item.id !== id) return item;
    const updates = {
      acknowledged: false,
      comments: [...item.comments, { author: getMyName(), text, time: "Just now", tags: extractMessageTags(text, item) }],
    };
    // Tag the mentioned parent as assignee if not already set
    if (mentionedParent && !item.assignee) updates.assignee = mentionedParent;
    return applyMessageUpdatesToCard(item, text, updates);
  });
  persist();
  const card = state.cards.find((item) => item.id === id);
  elements.commentInput.value = "";
  if (card) {
    renderComments(card);
    renderActivity(card);
    renderDialogMeta(card); // refresh people icons if assignee changed
    if (mentionedParent) setSelectValue(elements.assigneeInput, card.assignee);
  }
  showToast("Message added to card");
  render();
}

function updateReminderCustomVisibility() {
  const isCustom = elements.cardReminderPresetInput?.value === "custom";
  if (elements.cardReminderCustomLabel) {
    elements.cardReminderCustomLabel.hidden = !isCustom;
  }
}

function updateCardDialogReminderTime() {
  const preset = elements.cardReminderPresetInput?.value;
  if (preset === "custom") return; // user sets their own time
  const card = state.cards.find((item) => item.id === elements.cardId.value);
  // For new cards with a due date, compute from dueInput
  const dueSource = card?.due || (elements.dueInput?.value ? new Date(elements.dueInput.value).toISOString() : null);
  if (!dueSource) return;
  const tempCard = { due: dueSource };
  elements.cardReminderTimeInput.value = buildReminderTime(tempCard, preset);
}

let _autosaveTimer = null;
function scheduleAutosave() {
  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(() => {
    if (!elements.cardDialog?.open) return;
    if (!elements.titleInput?.value.trim() && !elements.detailsInput?.value.trim()) return;
    saveCardSilent();
  }, 1500);
}

function saveCardDialogReminder() {
  const id = elements.cardId.value;
  const reminderDate = new Date(elements.cardReminderTimeInput.value);
  if (!id || Number.isNaN(reminderDate.getTime())) return;
  const reminder = {
    preset: elements.cardReminderPresetInput.value,
    time: reminderDate.toISOString(),
  };
  const reminderText = `Reminder set for ${formatDate(reminder.time)}`;
  state.cards = state.cards.map((item) => (
    item.id === id
      ? {
          ...item,
          reminder,
          comments: [...item.comments, { author: getMyName(), text: reminderText, time: "Just now", system: true }],
        }
      : item
  ));
  persist();
  const card = state.cards.find((item) => item.id === id);
  if (card) {
    renderComments(card);
    renderActivity(card);
  }
  showToast(reminderText);
  render();
}

function clearCardDialogReminder() {
  const id = elements.cardId.value;
  if (!id) return;
  state.cards = state.cards.map((item) => (
    item.id === id
      ? {
          ...item,
          reminder: null,
          comments: [...item.comments, { author: getMyName(), text: "Reminder cleared", time: "Just now" }],
        }
      : item
  ));
  persist();
  const card = state.cards.find((item) => item.id === id);
  if (card) {
    elements.cardReminderPresetInput.value = state.automationSettings.defaultReminderPreset;
    elements.cardReminderTimeInput.value = buildReminderTime(card, state.automationSettings.defaultReminderPreset);
    renderComments(card);
    renderActivity(card);
  }
  showToast("Reminder cleared");
  render();
}

function saveCardSilent() {
  // Auto-save without requiring a title - derive from details if needed
  if (!elements.titleInput?.value.trim()) {
    deriveFieldsFromShortInfo(elements.detailsInput?.value || "", { silent: true });
  }
  if (!elements.titleInput?.value.trim()) return; // nothing to save
  const syntheticEvent = { preventDefault: () => {} };
  saveCard._silent = true;
  saveCard(syntheticEvent);
  saveCard._silent = false;
}

async function saveCard(event) {
  event.preventDefault();
  if (!elements.cardId.value && elements.llmCardPromptInput?.value.trim()) {
    syncLlmCardPrompt({ announce: false });
  }
  if (!elements.titleInput.value.trim()) {
    deriveFieldsFromShortInfo(elements.detailsInput.value || elements.voiceTranscriptInput.value, { silent: true });
  }
  if (!elements.titleInput.value.trim()) {
    showToast("Add a short message first");
    elements.detailsInput.focus();
    return;
  }
  // Auto-capitalize title first letter
  if (elements.titleInput?.value) {
    elements.titleInput.value = elements.titleInput.value.charAt(0).toUpperCase() + elements.titleInput.value.slice(1);
  }
  const id = elements.cardId.value || makeId();
  // Write id back immediately so repeated autosaves and the manual Save all target the same card
  if (!elements.cardId.value) elements.cardId.value = id;
  const existing = state.cards.find((card) => card.id === id);
  const newComment = elements.commentInput?.value.trim() || "";
  const comments = existing ? [...existing.comments] : [];

  if (newComment) {
    comments.push({ author: getMyName(), text: newComment, time: "Just now" });
  }

  const due = elements.dueInput.value ? new Date(elements.dueInput.value).toISOString() : "";

  // Use reminder preset from the card dialog panel if set, otherwise fall back to global default
  const dialogPreset = elements.cardReminderPresetInput?.value;
  const dialogReminderTime = elements.cardReminderTimeInput?.value;
  const effectivePreset = dialogPreset || state.automationSettings.defaultReminderPreset;
  const effectiveReminderTime = dialogPreset === "custom" && dialogReminderTime
    ? new Date(dialogReminderTime).toISOString()
    : due ? reminderIsoFromDue(due, effectivePreset) : null;

  const shouldAutoReminder = due && shouldCreateAppReminder();
  const autoReminder = shouldAutoReminder && effectiveReminderTime
    ? {
        preset: effectivePreset,
        time: effectiveReminderTime,
        automated: !dialogPreset || dialogPreset === state.automationSettings.defaultReminderPreset,
      }
    : null;
  const googleCalendar = due && state.automationSettings.syncFamilyCalendar && shouldUseCalendarDelivery()
    ? {
        synced: true,
        provider: state.automationSettings.familyCalendarProvider,
        reminderPreset: effectivePreset,
        updatedAt: new Date().toISOString(),
      }
    : existing?.googleCalendar || null;

  // Author: use onboarding name → Google display name → email prefix
  const setup = getOnboardingState() || {};
  const authorName = setup.parents?.primary
    || currentAuthSession?.user?.user_metadata?.full_name
    || currentAuthSession?.user?.email?.split("@")[0]
    || "Parent A";

  // Decide reminder: when delivery is "app-only" or "calendar-and-app", keep app reminder.
  // When delivery is "calendar-only" and GCal is connected, GCal alert handles it.
  const gcalConnected = Boolean(window.getGoogleCalendarConnected?.() || state.automationSettings.syncFamilyCalendar);
  const reminder = (gcalConnected && !shouldCreateAppReminder())
    ? null  // calendar-only: GCal event alert handles delivery
    : (existing?.reminder || autoReminder);

  // Read recurrence from the picker
  const recurrenceFreq = document.querySelector("#recurrenceInput")?.value || "none";
  const recurrenceDays = recurrenceFreq === "weekly" || recurrenceFreq === "biweekly"
    ? Array.from(document.querySelectorAll(".recurrence-day:checked")).map((cb) => cb.value)
    : [];
  const customDates = recurrenceFreq === "custom-dates"
    ? (document.getElementById("customDatesCalendar")?.dataset.selectedDates || "").split(",").filter(Boolean).sort()
    : [];
  const recurrence = recurrenceFreq !== "none"
    ? { freq: recurrenceFreq, days: recurrenceDays, ...(customDates.length ? { customDates } : {}) }
    : null;

  // Auto-assign the scheduled parent for the due date unless the user opted out
  const lockAssignee = elements.lockAssigneeInput?.checked || false;
  if (!lockAssignee && due) {
    const schedParent = getCustodyParentForDate(due.slice(0, 10));
    if (schedParent) setSelectValue(elements.assigneeInput, schedParent);
  }

  const card = {
    id,
    title: elements.titleInput.value.trim(),
    topic: elements.topicInput.value,
    type: elements.typeInput.value,
    status: elements.statusInput.value,
    assignee: elements.assigneeInput.value || null,
    child: elements.childInput.value || null,
    due,
    amount: elements.amountInput.value.trim(),
    details: elements.detailsInput.value.trim(),
    comments,
    acknowledged: existing?.acknowledged || false,
    reminder,
    googleCalendar,
    recurrence,
    lockAssignee,
    author: existing?.author || authorName,
    createdAt: existing?.createdAt || Date.now(),
    lastEditedAt: Date.now(),
    lastEditedBy: authorName,
  };

  // If editing any field of an existing recurring card, ask scope
  if (existing && existing.recurrence && existing.recurrence.freq && existing.recurrence.freq !== "none") {
    const scope = await _askRecurrenceEditScope();
    if (scope === "cancel") return;
    card._recurrenceEditScope = scope;
    if (scope === "this") {
      // Detach this instance from the recurring series - becomes a one-off
      card.recurrence = null;
    }
  }

  if (existing) {
    state.cards = state.cards.map((item) => (item.id === id ? card : item));
  } else {
    // Enforce free-tier card limit
    if (!isPaidUser() && freeCardCount() >= FREE_CARD_LIMIT) {
      elements.cardDialog.close();
      showUpgradePrompt(`You have reached the ${FREE_CARD_LIMIT}-Do limit on the free plan. Upgrade for unlimited Dos.`);
      return;
    }
    state.cards.unshift(card);
  }

  persist();
  if (!saveCard._silent) elements.cardDialog.close();
  showToast(existing ? "Do updated" : buildCreateToast(card));
  render();
  // Re-render calendar if it's the active module (so new Dos with due dates appear immediately)
  if (!featureModule.classList.contains("hidden") && typeof window.syncCalendarEventsFromCards === "function") {
    window.syncCalendarEventsFromCards();
    const data = window._lastFeatureData;
    if (data && typeof window.renderCalendarFeature === "function") window.renderCalendarFeature(data);
  }
  // First card save is the ideal moment to ask for push permission -
  // user just demonstrated intent so the prompt feels relevant, not intrusive.
  if (!existing) requestNotificationPermission();
  // Sync to Supabase, then push to calendars if card has a date
  const syncCard = async () => {
    let savedCard = { ...card };
    if (card.due && window.pushCardToFamilyCalendar) {
      const reminderMinutes = presetToMinutes(card.googleCalendar?.reminderPreset || state.automationSettings.defaultReminderPreset);
      const gcal = await window.pushCardToFamilyCalendar(card, reminderMinutes).catch(() => null);
      if (gcal) {
        savedCard = { ...card, googleCalendar: gcal };
        state.cards = state.cards.map((c) => (c.id === card.id ? savedCard : c));
        persist();
      }
    }
    // Also push to Apple Calendar if connected
    if (card.due && window.pushCardToAppleCalendar) {
      window.pushCardToAppleCalendar(savedCard).catch(() => {});
    }
    // Two-way sync: push edits back to the source import calendar
    if (savedCard.calendarImport?.syncMode === "two-way" && window.updateImportedCalendarEvent) {
      window.updateImportedCalendarEvent(savedCard).catch(() => {});
    }
    if (window.saveCardToSupabase) {
      try {
        await window.saveCardToSupabase(savedCard);
      } catch {
        // Offline or Supabase unavailable - queue for background sync
        _queueOfflineCard(savedCard);
      }
    }

    // SEG-16: log ledger event for expense cards
    const isExpenseCard = savedCard.type === "Expense" || savedCard.topic === "Expenses";
    if (isExpenseCard && window.appendExpenseLedger) {
      const amt = savedCard.amount ? Number(String(savedCard.amount).replace(/[^\d.,-]/g, "").replace(",", ".")) || null : null;
      const cur = String(savedCard.amount || "").match(/[A-Za-z]{2,3}/)?.[0]?.toUpperCase() || null;
      const eventType = !existing ? "created" : (savedCard.amount !== existing?.amount ? "amount_set" : null);
      if (eventType) {
        window.appendExpenseLedger({ event_type: eventType, card_id: savedCard.id, amount: amt, currency: cur }).catch(() => {});
      }
    }
  };
  syncCard();

  // Wire recurrence-days visibility toggle
  _bindRecurrenceDaysToggle();
}

// ─── Bind recurrence days row show/hide ───────────────────────────────────────

function _bindRecurrenceDaysToggle() {
  const recInput = document.querySelector("#recurrenceInput");
  const daysRow = document.querySelector("#recurrenceDaysRow");
  const customPicker = document.querySelector("#customDatesPicker");
  if (!recInput) return;
  const update = () => {
    const v = recInput.value;
    daysRow?.classList.toggle("hidden", !["weekly", "biweekly"].includes(v));
    customPicker?.classList.toggle("hidden", v !== "custom-dates");
    if (v === "custom-dates") renderCustomDatesCal();
  };
  recInput.onchange = update;
  update(); // apply on open
}

// State for custom-dates picker - held in the element's dataset
function renderCustomDatesCal() {
  const calEl = document.getElementById("customDatesCalendar");
  const listEl = document.getElementById("customDatesList");
  if (!calEl || !listEl) return;

  // Load selected dates from dataset (comma-separated YYYY-MM-DD)
  const selected = new Set((calEl.dataset.selectedDates || "").split(",").filter(Boolean));
  const today = new Date();
  let viewYear = calEl.dataset.viewYear ? parseInt(calEl.dataset.viewYear) : today.getFullYear();
  let viewMonth = calEl.dataset.viewMonth !== undefined ? parseInt(calEl.dataset.viewMonth) : today.getMonth();

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Mo","Tu","We","Th","Fr","Sa","Su"];
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  let cells = "";
  let dayNum = 1;
  for (let row = 0; row < 6; row++) {
    cells += "<tr>";
    for (let col = 0; col < 7; col++) {
      const ci = row * 7 + col;
      if (ci < startDow || dayNum > daysInMonth) { cells += "<td></td>"; }
      else {
        const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
        const isToday = new Date(viewYear, viewMonth, dayNum).toDateString() === today.toDateString();
        const isPicked = selected.has(dateStr);
        let cls = "mc-day";
        if (isToday) cls += " mc-today";
        if (isPicked) cls += " mc-selected";
        cells += `<td><button class="${cls}" type="button" data-pick="${dateStr}">${dayNum}</button></td>`;
        dayNum++;
      }
    }
    cells += "</tr>";
    if (dayNum > daysInMonth) break;
  }

  calEl.innerHTML = `
    <div class="mc-header">
      <button class="mc-nav" type="button" id="cdcPrev">&#8249;</button>
      <span class="mc-month-label">${monthNames[viewMonth]} ${viewYear}</span>
      <button class="mc-nav" type="button" id="cdcNext">&#8250;</button>
    </div>
    <table class="mc-grid">
      <thead><tr>${dayNames.map((d)=>`<th>${d}</th>`).join("")}</tr></thead>
      <tbody>${cells}</tbody>
    </table>
  `;
  calEl.dataset.viewYear = viewYear;
  calEl.dataset.viewMonth = viewMonth;

  // Render selected dates as chips
  const sorted = [...selected].sort();
  listEl.innerHTML = sorted.length
    ? sorted.map((d) => `<span class="custom-date-chip">${d}<button type="button" data-remove="${d}" aria-label="Remove">&#215;</button></span>`).join("")
    : `<span class="custom-dates-hint">${window.t?.("recurrence.pick_hint") ?? "Tap dates to add them"}</span>`;

  calEl.querySelector("#cdcPrev")?.addEventListener("click", () => {
    let m = parseInt(calEl.dataset.viewMonth) - 1, y = parseInt(calEl.dataset.viewYear);
    if (m < 0) { m = 11; y--; }
    calEl.dataset.viewMonth = m; calEl.dataset.viewYear = y;
    renderCustomDatesCal();
  });
  calEl.querySelector("#cdcNext")?.addEventListener("click", () => {
    let m = parseInt(calEl.dataset.viewMonth) + 1, y = parseInt(calEl.dataset.viewYear);
    if (m > 11) { m = 0; y++; }
    calEl.dataset.viewMonth = m; calEl.dataset.viewYear = y;
    renderCustomDatesCal();
  });
  calEl.querySelectorAll("[data-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = btn.dataset.pick;
      if (selected.has(d)) selected.delete(d); else selected.add(d);
      calEl.dataset.selectedDates = [...selected].join(",");
      renderCustomDatesCal();
    });
  });
  listEl.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selected.delete(btn.dataset.remove);
      calEl.dataset.selectedDates = [...selected].join(",");
      renderCustomDatesCal();
    });
  });
}

// ─── Recurrence scope dialog (this event / all future) ───────────────────────

function _askRecurrenceEditScope() {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "recurrence-scope-dialog";
    dialog.innerHTML = `
      <p>This is a recurring event. Which events do you want to update?</p>
      <div class="recurrence-scope-actions">
        <button class="secondary-button" data-scope="this">This event only</button>
        <button class="secondary-button" data-scope="all">All future events</button>
        <button class="ghost-button" data-scope="cancel">Cancel</button>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();
    dialog.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-scope]");
      if (!btn) return;
      dialog.close();
      dialog.remove();
      resolve(btn.dataset.scope);
    });
  });
}

function acknowledgeCurrentCard() {
  const id = elements.cardId.value;
  if (!id) return;
  state.cards = state.cards.map((card) =>
    card.id === id ? { ...card, acknowledged: true } : card
  );
  persist();
  elements.cardDialog.close();
  showToast("Marked as seen");
  render();
  if (window.updateCardInSupabase) window.updateCardInSupabase(id, { acknowledged: true }).catch(() => {});
}

function deleteCurrentCard() {
  const id = elements.cardId.value;
  if (!id) return;
  const card = state.cards.find((c) => c.id === id);
  state.cards = state.cards.filter((c) => c.id !== id);
  persist();
  elements.cardDialog.close();
  showToast("Do deleted");
  render();
  // Soft-delete in Supabase
  if (window.deleteCardFromSupabase) window.deleteCardFromSupabase(id).catch(() => {});
  // Remove from Google Calendar if synced
  if (card?.googleCalendar?.eventId && window.deleteCardFromFamilyCalendar) {
    window.deleteCardFromFamilyCalendar(card).catch(() => {});
  }
  // Remove from Apple Calendar if synced
  if (card?.appleCalendar?.eventId && window.deleteCardFromAppleCalendar) {
    window.deleteCardFromAppleCalendar(card).catch(() => {});
  }
}

function acknowledgeCurrentCard() {
  const id = elements.cardId.value;
  state.cards = state.cards.map((card) => (
    card.id === id
      ? {
          ...card,
          acknowledged: true,
          status: card.status === "Important" || card.status === "Waiting" ? "Done" : card.status,
          comments: [...card.comments, { author: getMyName(), text: "Acknowledged", time: "Just now", system: true }],
        }
      : card
  ));
  persist();
  elements.cardDialog.close();
  showToast("Acknowledged with timestamp");
  render();
  const ackCard = state.cards.find((c) => c.id === elements.cardId.value);
  if (ackCard && window.saveCardToSupabase) window.saveCardToSupabase(ackCard).catch(() => {});
}

function quickCompleteCard(id) {
  const card = state.cards.find((item) => item.id === id);
  if (!card || card.status === "Done") return;
  const _mt = window.t || ((k) => k);
  const label = card.type === "Expense" ? _mt("toast.marked_paid") : _mt("toast.marked_done");
  state.cards = state.cards.map((item) => (
    item.id === id
      ? {
          ...item,
          status: "Done",
          acknowledged: true,
          comments: [...item.comments, { author: getMyName(), text: label, time: "Just now", system: true }],
        }
      : item
  ));
  persist();
  showToast(label);
  render();
  const updated = state.cards.find((c) => c.id === id);
  if (updated && window.saveCardToSupabase) window.saveCardToSupabase(updated).catch(() => {});
}

function quickCompleteCardFromDialog() {
  const id = elements.cardId.value;
  if (!id) return;
  quickCompleteCard(id);
  syncOpenCardDialog(id);
}

function quickRespondCard(id, response) {
  const card = state.cards.find((item) => item.id === id);
  if (!card || card.status === "Done") return;
  const setup = getOnboardingState() || {};
  const myName = setup.parents?.primary || "Parent A";

  // "Can't" — warn if someone was already assigned, then clear assignee and flag for response
  if (response === "cannot") {
    if (card.assignee) {
      const confirmed = window.confirm(
        `${card.assignee} is currently assigned to this. Remove them and mark as needs response?`
      );
      if (!confirmed) return;
    }
    const text = "Can't do this";
    const newComments = [...card.comments, { author: myName, text, time: "Just now", system: true }];
    state.cards = state.cards.map((item) =>
      item.id === id
        ? { ...item, status: "Disputed", assignee: null, acknowledged: false, comments: newComments }
        : item
    );
    persist();
    showToast(window.t?.("card.action.cannot") ?? "Can't");
    render();
    const updated = state.cards.find((c) => c.id === id);
    if (updated && window.saveCardToSupabase) window.saveCardToSupabase(updated).catch(() => {});
    return;
  }

  const text = response === "will" ? "Please do it" : null;
  const nextStatus = response === "do" ? "To Do" : "Waiting";
  // "do" = I'll do it: silently set assignee + status, no chat message
  // "will" = send a message to the thread
  const newComments = text
    ? [...card.comments, { author: myName, text, time: "Just now", system: true }]
    : card.comments;
  state.cards = state.cards.map((item) => (
    item.id === id
      ? {
          ...item,
          status: nextStatus,
          assignee: response === "do" ? myName : item.assignee,
          acknowledged: true,
          comments: newComments,
        }
      : item
  ));
  persist();
  const toastMsg = response === "do"
    ? (window.t?.("action.ill_do_it") ?? "I'll do it")
    : (text || "Done");
  showToast(toastMsg);
  render();
  const updated = state.cards.find((c) => c.id === id);
  if (updated && window.saveCardToSupabase) window.saveCardToSupabase(updated).catch(() => {});
}

function quickRespondCardFromDialog(response) {
  const id = elements.cardId.value;
  if (!id) return;
  quickRespondCard(id, response);
  syncOpenCardDialog(id);
}

function syncOpenCardDialog(id) {
  const card = state.cards.find((item) => item.id === id);
  if (!card) return;
  elements.dialogTitle.textContent = card.title;
  setSelectValue(elements.statusInput, card.status);
  setSelectValue(elements.assigneeInput, card.assignee);
  setSelectValue(elements.childInput, card.child);
  renderDialogMeta(card);
  updateDialogQuickActions(card);
  renderComments(card);
  renderActivity(card);
}

function openMessageDialog(id) {
  const card = state.cards.find((item) => item.id === id);
  if (!card) return;
  elements.messageForm.reset();
  elements.messageCardId.value = id;
  elements.messageTitle.textContent = card.title;
  const contextTags = [card.topic, card.type, card.child, card.assignee, card.amount].filter(Boolean);
  elements.messageCardContext.innerHTML = `
    <div class="message-context-top">
      <div class="card-meta card-tags message-context-tags" aria-label="Message card tags">
        ${contextTags.map((tag) => renderTagButton(tag, "meta-chip card-tag")).join("")}
      </div>
      ${renderPeopleIcons(card)}
    </div>
    <strong>${escapeHtml(card.title)}</strong>
    <p>${escapeHtml(card.details)}</p>
  `;
  elements.cardMessageInput.value = card.comments.length ? "" : buildInitialMessage(card);
  elements.messageDialog.showModal();
  window.setTimeout(() => elements.cardMessageInput.focus(), 0);
}

function buildInitialMessage(card) {
  const due = card.due ? ` Due ${formatDate(card.due)}.` : "";
  const assignee = card.assignee ? ` Assigned to ${card.assignee}.` : "";
  return `${card.title}.${due}${assignee}`;
}

function saveCardMessage(event) {
  event.preventDefault();
  const id = elements.messageCardId.value;
  const text = elements.cardMessageInput.value.trim();
  if (!id || !text) return;
  state.cards = state.cards.map((item) => (
    item.id === id
      ? applyMessageUpdatesToCard(item, text, {
          acknowledged: false,
          comments: [...item.comments, { author: getMyName(), text, time: "Just now", tags: extractMessageTags(text, item) }],
        })
      : item
  ));
  persist();
  elements.messageDialog.close();
  showToast("Message added to card");
  render();
}

function openReminderDialog(id) {
  const card = state.cards.find((item) => item.id === id);
  if (!card) return;
  elements.reminderForm.reset();
  elements.reminderCardId.value = id;
  elements.reminderTitle.textContent = "Reminder";
  elements.reminderPresetInput.value = card.reminder?.preset || state.automationSettings.defaultReminderPreset;
  elements.reminderTimeInput.value = card.reminder?.time
    ? toDateTimeInputValue(new Date(card.reminder.time))
    : buildReminderTime(card, elements.reminderPresetInput.value);

  // Recurring fields
  const rec = card.reminder?.recurrence || null;
  const recurToggle = document.getElementById("reminderRecurringToggle");
  const recurOptions = document.getElementById("reminderRecurringOptions");
  const recurFreq = document.getElementById("reminderRecurFreq");
  const recurDaysRow = document.getElementById("reminderRecurDaysRow");

  if (recurToggle) {
    recurToggle.checked = !!rec;
    if (recurOptions) recurOptions.style.display = rec ? "" : "none";
    if (rec && recurFreq) recurFreq.value = rec.freq || "weekly";
    const showDays = rec && ["weekly", "biweekly"].includes(rec.freq);
    if (recurDaysRow) recurDaysRow.style.display = showDays ? "" : "none";
    if (rec?.days?.length && recurDaysRow) {
      recurDaysRow.querySelectorAll(".reminder-recur-day").forEach((cb) => {
        cb.checked = rec.days.includes(cb.value);
      });
    }

    recurToggle.onchange = () => {
      if (recurOptions) recurOptions.style.display = recurToggle.checked ? "" : "none";
    };
    if (recurFreq) {
      recurFreq.onchange = () => {
        const showD = ["weekly", "biweekly"].includes(recurFreq.value);
        if (recurDaysRow) recurDaysRow.style.display = showD ? "" : "none";
      };
    }
  }

  elements.reminderDialog.showModal();
}

function updateReminderTimeFromPreset() {
  const card = state.cards.find((item) => item.id === elements.reminderCardId.value);
  if (!card || elements.reminderPresetInput.value === "custom") return;
  elements.reminderTimeInput.value = buildReminderTime(card, elements.reminderPresetInput.value);
}

function buildReminderTime(card, preset) {
  const base = card.due ? new Date(card.due) : new Date(Date.now() + 60 * 60 * 1000);
  const reminderDate = reminderDateFromBase(base, preset);
  return toDateTimeInputValue(reminderDate);
}

function presetToMinutes(preset) {
  if (!preset || preset === "at-due" || preset === "custom") return 0;
  const n = Number(preset);
  return Number.isFinite(n) ? n : 60;
}

function reminderIsoFromDue(due, preset) {
  return reminderDateFromBase(new Date(due), preset).toISOString();
}

function reminderDateFromBase(base, preset) {
  const reminderDate = new Date(base);
  if (preset !== "at-due" && preset !== "custom") {
    reminderDate.setMinutes(reminderDate.getMinutes() - Number(preset));
  }
  return reminderDate;
}

function saveReminder(event) {
  event.preventDefault();
  const id = elements.reminderCardId.value;
  const reminderDate = new Date(elements.reminderTimeInput.value);
  if (!id || Number.isNaN(reminderDate.getTime())) return;

  // Read recurring fields
  const recurToggle = document.getElementById("reminderRecurringToggle");
  const recurFreq = document.getElementById("reminderRecurFreq");
  const isRecurring = recurToggle?.checked || false;
  let recurrence = null;
  if (isRecurring && recurFreq) {
    const freq = recurFreq.value;
    const days = ["weekly", "biweekly"].includes(freq)
      ? Array.from(document.querySelectorAll(".reminder-recur-day:checked")).map((cb) => cb.value)
      : [];
    recurrence = { freq, days };
  }

  const reminder = {
    preset: elements.reminderPresetInput.value,
    time: reminderDate.toISOString(),
    ...(recurrence ? { recurrence } : {}),
  };
  const reminderText = recurrence
    ? `Recurring reminder (${recurrence.freq}) set from ${formatDate(reminder.time)}`
    : `Reminder set for ${formatDate(reminder.time)}`;
  state.cards = state.cards.map((item) => (
    item.id === id
      ? {
          ...item,
          reminder,
          comments: [...item.comments, { author: getMyName(), text: reminderText, time: "Just now", system: true }],
        }
      : item
  ));
  persist();
  elements.reminderDialog.close();
  showToast(reminderText);
  render();
}

function clearReminder() {
  const id = elements.reminderCardId.value;
  if (!id) return;
  state.cards = state.cards.map((item) => (
    item.id === id
      ? {
          ...item,
          reminder: null,
          comments: [...item.comments, { author: getMyName(), text: "Reminder cleared", time: "Just now" }],
        }
      : item
  ));
  persist();
  elements.reminderDialog.close();
  showToast("Reminder cleared");
  render();
}

function exportCards() {
  const rows = filteredCards().map((card) => ({
    title: card.title,
    topic: card.topic,
    type: card.type,
    status: card.status,
    assignee: card.assignee,
    child: card.child,
    due: formatDate(card.due),
    amount: card.amount,
    acknowledged: card.acknowledged ? "yes" : "no",
    details: card.details,
  }));
  const csv = [
    Object.keys(rows[0] || { title: "", topic: "", type: "", status: "" }).join(","),
    ...rows.map((row) => Object.values(row).map(csvEscape).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "do-do-mvp-export.csv";
  link.click();
  URL.revokeObjectURL(url);
  storage.setItem("kinship-exports", String(Number(storage.getItem("kinship-exports") || 0) + 1));
  showToast("Current Dos exported");
  render();
}

function filteredCards() {
  const filtered = state.cards.filter((card) => {
    const topicMatch = state.topic === "All" || card.topic === state.topic;
    const comments = Array.isArray(card.comments) ? card.comments : [];
    const text = [card.title, card.topic, card.type, card.status, card.assignee, card.child, card.details, card.amount, ...comments.map((comment) => comment.text)].join(" ").toLowerCase();
    const tagMatch = !state.tagFilter || getCardTagValues(card).some((value) => compactTag(value).toLowerCase() === compactTag(state.tagFilter).toLowerCase());
    const actionMatch = !state.actionFilter
      || (state.actionFilter === "next" && (["Waiting", "To Do"].includes(card.status) || !card.acknowledged))
      || (state.actionFilter === "needs" && !card.acknowledged)
      || (state.actionFilter === "waiting" && card.status === "Waiting")
      || (state.actionFilter === "todo" && card.status === "To Do");
    const personMatch = !state.personFilter || peopleForCard(card).people.some((person) => person.toLowerCase() === state.personFilter.toLowerCase());
    const searchTerm = state.tagFilter || state.actionFilter || state.personFilter ? "" : state.search;
    return topicMatch && tagMatch && actionMatch && personMatch && (!searchTerm || text.includes(searchTerm));
  });
  return state.tagFilter || state.actionFilter || state.personFilter
    ? filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    : filtered;
}

function applyActionFilter(filter, label) {
  state.topic = "All";
  state.tagFilter = "";
  state.actionFilter = filter;
  state.personFilter = "";
  state.search = "";
  state.view = "list";
  elements.searchInput.value = label;
  elements.topics.forEach((item) => item.classList.toggle("active", item.dataset.topic === "All"));
  document.querySelectorAll(".segmented-button").forEach((item) => item.classList.toggle("active", item.dataset.view === "list"));
  window.switchModule?.("board");
  showToast(`Showing ${label.toLowerCase()} Dos`);
  render();
}

function showNextActions() {
  applyActionFilter("next", "Next");
}

function applyPersonFilter(person) {
  const name = String(person || "").trim();
  if (!name) return;
  state.topic = "All";
  state.tagFilter = "";
  state.actionFilter = "";
  state.personFilter = name;
  state.search = name.toLowerCase();
  state.view = "list";
  elements.searchInput.value = name;
  elements.topics.forEach((item) => item.classList.toggle("active", item.dataset.topic === "All"));
  document.querySelectorAll(".segmented-button").forEach((item) => item.classList.toggle("active", item.dataset.view === "list"));
  window.switchModule?.("board");
  showToast(`Dos for ${name}`);
  render();
}

function getCardTagValues(card) {
  const commentsCount = card.comments?.length || 0;
  return [
    card.topic,
    card.type,
    card.child,
    card.assignee,
    card.amount,
    commentsCount ? `${commentsCount} message${commentsCount === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
}

function extractMessageTags(text, card = {}) {
  const safeText = String(text || "");
  const lower = safeText.toLowerCase();
  const dueValue = inferDueDate(lower);
  const values = [
    card.topic,
    inferTopic(lower),
    inferType(lower),
    inferChild(lower),
    inferAssignee(lower),
    inferAmount(safeText),
    dueValue ? formatDueTag(dueValue) : "",
  ];
  return [...new Set(values.map(compactTag).filter(Boolean))].slice(0, 5);
}

function applyMessageUpdatesToCard(card, text, baseUpdates = {}) {
  const lower = String(text || "").toLowerCase();
  const due = inferMessageDueUpdate(card.due, lower);
  const amount = inferMessageAmountUpdate(card.amount, text, lower);
  const updates = {
    ...baseUpdates,
    ...(due ? { due } : {}),
    ...(amount ? { amount } : {}),
  };

  if (due && shouldCreateAppReminder()) {
    updates.reminder = {
      preset: state.automationSettings.defaultReminderPreset,
      time: reminderIsoFromDue(due, state.automationSettings.defaultReminderPreset),
      automated: true,
    };
  }

  if (due && card.googleCalendar?.synced) {
    updates.googleCalendar = {
      ...card.googleCalendar,
      provider: state.automationSettings.familyCalendarProvider,
      reminderPreset: state.automationSettings.defaultReminderPreset,
      updatedAt: new Date().toISOString(),
    };
  }

  return { ...card, ...updates };
}

function inferMessageDueUpdate(currentDue, lower) {
  if (!currentDue) return inferDueDate(lower) || "";
  const date = new Date(currentDue);
  if (Number.isNaN(date.getTime())) return inferDueDate(lower) || "";

  const weekday = inferReplacementWeekday(lower);
  if (weekday !== null) {
    const diff = weekday - date.getDay();
    date.setDate(date.getDate() + diff);
    if (date.getTime() < Date.now()) date.setDate(date.getDate() + 7);
  }

  const explicitDate = lower.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
  if (explicitDate) {
    const year = explicitDate[3]
      ? Number(explicitDate[3].length === 2 ? `20${explicitDate[3]}` : explicitDate[3])
      : date.getFullYear();
    date.setFullYear(year, Number(explicitDate[2]) - 1, Number(explicitDate[1]));
  }

  const time = inferReplacementTime(lower);
  if (time) date.setHours(time.hours, time.minutes, 0, 0);

  if (weekday !== null || explicitDate || time) return date.toISOString();
  return "";
}

function inferReplacementWeekday(lower) {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const replacement = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b\s+(?:instead of|not)\s+\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (replacement) return days.indexOf(replacement[1]);

  const movedTo = lower.match(/\b(?:move|moved|change|changed|reschedule|rescheduled|switch|switched)\b.{0,36}?\bto\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  return movedTo ? days.indexOf(movedTo[1]) : null;
}

function inferReplacementTime(lower) {
  const replacement = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\s+(?:instead of|not)\s+\d{1,2}(?::\d{2})?\s?(?:am|pm)?\b/);
  if (replacement) return normalizeParsedTime(replacement);

  const movedTo = lower.match(/\b(?:move|moved|change|changed|reschedule|rescheduled|switch|switched)\b.{0,36}?\bto\s+(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\b/);
  if (movedTo) return normalizeParsedTime(movedTo);

  const atTime = lower.match(/\b(?:at|is)\s+(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\b/);
  return atTime ? normalizeParsedTime(atTime) : null;
}

function normalizeParsedTime(match) {
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const period = match[3];
  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

function inferMessageAmountUpdate(currentAmount, text, lower) {
  const amount = inferAmount(text) || inferConversationalAmountUpdate(currentAmount, lower);
  if (!amount) return "";
  if (!currentAmount) return amount;
  if (/(instead of|not|change|changed|update|updated|cost|costs|expense|amount|price|paid|pay)/.test(lower)) return amount;
  return "";
}

function inferConversationalAmountUpdate(currentAmount, lower) {
  if (!/(cost|costs|expense|amount|price|paid|pay)/.test(lower)) return "";
  const match = lower.match(/\b(?:cost|costs|expense|amount|price|paid|pay)\b.{0,18}?\b(\d+(?:[.,]\d{1,2})?)\b/);
  if (!match) return "";
  const currency = String(currentAmount || "").match(/CHF|PLN|USD|EUR|£|\$|€/i)?.[0] || LOCALE_CONFIG.currency;
  return `${currency} ${match[1]}`;
}

function addMessageToCard(id, text, author = "Parent A") {
  const card = state.cards.find((item) => item.id === id);
  if (!card || !String(text || "").trim()) return null;
  const message = String(text).trim();
  let updatedCard = null;
  state.cards = state.cards.map((item) => {
    if (item.id !== id) return item;
    updatedCard = applyMessageUpdatesToCard(item, message, {
      acknowledged: false,
      comments: [...item.comments, { author, text: message, time: "Just now", tags: extractMessageTags(message, item) }],
    });
    return updatedCard;
  });
  persist();
  render();
  return updatedCard;
}

function renderMessageTags(tags, className = "message-auto-tags") {
  const values = (Array.isArray(tags) ? tags : []).map(compactTag).filter(Boolean);
  if (!values.length) return "";
  return `<div class="${className}">${values.map((tag) => renderTagButton(tag, "derived-tag", true)).join("")}</div>`;
}

function loadCards() {
  // Never show seed cards to real users - only load what they have saved.
  // New users (no real familyId yet) start with an empty board.
  // Supabase will replace this with their real cards once the session loads.
  const familyId = getFamilyWorkspaceId();
  if (familyId === "demo-family") return [];

  const schemaKey = `${cardsStorageKey()}:schema`;
  if (storage.getItem(schemaKey) !== cardSchemaVersion) {
    // Schema changed - update schema key but KEEP local cards so they are visible
    // until Supabase loads. Supabase will replace them when auth completes.
    storage.setItem(schemaKey, cardSchemaVersion);
    // Do NOT clear cards here - falling through will load and normalize them
  }

  const stored = storage.getItem(cardsStorageKey());
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    const cards = Array.isArray(parsed) ? parsed : [];
    const normalized = cards.map(normalizeCard);
    storage.setItem(cardsStorageKey(), JSON.stringify(normalized));
    return normalized;
  } catch {
    storage.removeItem(cardsStorageKey());
    return [];
  }
}

function getFamilyWorkspaceId() {
  return storage.getItem(activeFamilyStorageKey) || getOnboardingState()?.familyId || "demo-family";
}

function cardsStorageKey() {
  return `do-do-family-cards:${getFamilyWorkspaceId()}`;
}

function normalizeCard(card) {
  const fallback = seedCards.find((item) => item.id === card?.id) || seedCards[0];
  const status = ["Important", "Waiting", "To Do", "Done", "Disputed", "Info Only"].includes(card?.status)
    ? card.status
    : fallback.status;
  const topic = topics.includes(card?.topic) ? card.topic : fallback.topic;
  const title = /^(?:New calendar card|Schedule item)\b/i.test(card?.title || "")
    ? "New Do"
    : (card?.title || fallback.title || "Coordination card");

  const normalized = {
    id: card?.id || makeId(),
    title,
    topic,
    type: card?.type || fallback.type || "Task",
    status,
    assignee: card?.assignee || fallback.assignee || "Parent A",
    child: normalizeChild(card?.child || fallback.child || "Ava"),
    due: card?.due || "",
    amount: card?.amount || "",
    details: card?.details || fallback.details || "",
    comments: Array.isArray(card?.comments) ? card.comments : [],
    acknowledged: Boolean(card?.acknowledged),
    reminder: card?.reminder || null,
    googleCalendar: card?.googleCalendar || null,
    createdAt: card?.createdAt || Date.now(),
  };
  return normalizeKnownCardTiming(normalized);
}

function normalizeKnownCardTiming(card) {
  const text = `${card.title} ${card.details}`.toLowerCase();
  if (!/swap friday pickup|pickup at 15:10|take pickup at 15:10|dismissal.*15:10/.test(text)) {
    return card;
  }

  const due = withTimeOnExistingDate(card.due, 15, 10);
  const automation = loadAutomationSettings();
  const preset = automation.defaultReminderPreset || defaultAutomationSettings.defaultReminderPreset;
  return {
    ...card,
    due,
    details: card.details.includes("before 13:00")
      ? card.details
      : `${card.details} Please confirm before 13:00.`,
    reminder: shouldCreateAppReminder(automation)
      ? {
          preset,
          time: reminderIsoFromDue(due, preset),
          automated: true,
        }
      : (card.reminder?.automated ? null : card.reminder),
  };
}

function withTimeOnExistingDate(value, hours, minutes) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return daysFromNow(0, hours, minutes);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function persist() {
  storage.setItem(cardsStorageKey(), JSON.stringify(state.cards));
}

// ─── Offline background sync queue ───────────────────────────────────────────

const SYNC_QUEUE_KEY = "do-do-sync-queue-v1";

function _queueOfflineCard(card) {
  try {
    const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]");
    // Replace existing entry for same id or add new
    const updated = queue.filter((c) => c.id !== card.id);
    updated.push(card);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updated));
    // Register background sync if supported
    navigator.serviceWorker?.ready.then((reg) => {
      reg.sync?.register("sync-cards").catch(() => {});
    });
    showToast("Saved locally - will sync when back online");
  } catch {
    // localStorage full or unavailable - silent fail
  }
}

async function _flushSyncQueue() {
  if (!window.saveCardToSupabase) return;
  try {
    const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]");
    if (!queue.length) return;
    const synced = [];
    for (const card of queue) {
      try {
        await window.saveCardToSupabase(card);
        synced.push(card.id);
      } catch {
        break; // Still offline - stop trying
      }
    }
    if (synced.length) {
      const remaining = queue.filter((c) => !synced.includes(c.id));
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
      if (remaining.length === 0) showToast("All offline Dos synced");
    }
  } catch {
    // Queue parse error - clear it
    localStorage.removeItem(SYNC_QUEUE_KEY);
  }
}

// Flush queue when coming back online
window.addEventListener("online", () => _flushSyncQueue());

// Flush queue when service worker sends the background sync signal
navigator.serviceWorker?.addEventListener("message", (event) => {
  if (event.data?.type === "flush-sync-queue") _flushSyncQueue();
});

function loadAutomationSettings() {
  const stored = storage.getItem(automationSettingsStorageKey);
  if (!stored) return { ...defaultAutomationSettings };
  try {
    return { ...defaultAutomationSettings, ...JSON.parse(stored) };
  } catch {
    return { ...defaultAutomationSettings };
  }
}

function persistAutomationSettings() {
  storage.setItem(automationSettingsStorageKey, JSON.stringify(state.automationSettings));
}

function getAutomationSettings() {
  return { ...state.automationSettings };
}

function shouldCreateAppReminder(settings = state.automationSettings) {
  // "app-only" and "calendar-and-app" both create in-app reminders; "calendar-only" does not
  return Boolean(settings.automateReminders) && settings.reminderDelivery !== "calendar-only";
}

function shouldUseCalendarDelivery(settings = state.automationSettings) {
  // "app-only" skips calendar alerts; "calendar-only" and "calendar-and-app" use them
  return settings.reminderDelivery !== "app-only";
}

function updateAutomationSettings(nextSettings) {
  state.automationSettings = {
    ...state.automationSettings,
    ...nextSettings,
  };
  persistAutomationSettings();
  if ("automateReminders" in nextSettings || "reminderDelivery" in nextSettings || "syncFamilyCalendar" in nextSettings || nextSettings.defaultReminderPreset) {
    applyAutomationSettingsToCards();
  }
  render();
}

function applyAutomationSettingsToCards() {
  state.cards = state.cards.map((card) => {
    if (!card.due) return card;
    const reminder = shouldCreateAppReminder()
      ? (!card.reminder || card.reminder.automated
        ? {
            preset: state.automationSettings.defaultReminderPreset,
            time: reminderIsoFromDue(card.due, state.automationSettings.defaultReminderPreset),
            automated: true,
          }
        : card.reminder)
      : (card.reminder?.automated ? null : card.reminder);
    const googleCalendar = state.automationSettings.syncFamilyCalendar && shouldUseCalendarDelivery()
      ? {
          synced: true,
          provider: state.automationSettings.familyCalendarProvider,
          reminderPreset: state.automationSettings.defaultReminderPreset,
          updatedAt: card.googleCalendar?.updatedAt || new Date().toISOString(),
        }
      : null;
    return { ...card, reminder, googleCalendar };
  });
  persist();
}

function buildCreateToast(card) {
  const parts = ["Do created"];
  if (card.reminder?.automated) parts.push("reminder automated");
  if (card.googleCalendar?.synced) parts.push("calendar ready");
  return parts.join(" · ");
}

window.getAutomationSettings = getAutomationSettings;
window.updateAutomationSettings = updateAutomationSettings;
window.getThemePreference = getThemePreference;
window.updateThemePreference = updateThemePreference;
window.signOut = signOut;
window.quickCompleteCard = quickCompleteCard;
window.quickRespondCard = quickRespondCard;
window.openCardDialog = openCardDialog;
window.getCards = () => state.cards;
// Patch a card's due date from features.js (week-grid drag-drop)
window.patchCardDue = (cardId, newDue) => {
  const idx = state.cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return;
  state.cards[idx] = { ...state.cards[idx], due: newDue };
  if (window.saveCardToSupabase) window.saveCardToSupabase(state.cards[idx]).catch(() => {});
  syncCalendarEventsFromCards?.();
  renderBoard?.();
};
window.startDictationForField = startDictationForField;
window.extractMessageTags = extractMessageTags;
window.renderMessageTags = renderMessageTags;
window.addMessageToCard = addMessageToCard;
window.inferMessageDueUpdate = inferMessageDueUpdate;
window.inferMessageAmountUpdate = inferMessageAmountUpdate;

function trackVisit() {
  const today = new Date().toISOString().slice(0, 10);
  const lastVisit = storage.getItem("kinship-last-visit");
  if (lastVisit !== today) {
    storage.setItem("kinship-last-visit", today);
    storage.setItem("kinship-visits", String(Number(storage.getItem("kinship-visits") || 0) + 1));
  }
}

function createStorage() {
  const memory = new Map();
  try {
    const probe = "__kinship_storage_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return {
      getItem: (key) => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
    };
  }
}

function daysFromNow(days, hours, minutes) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function makeId() {
  return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function renderPeopleIcons(card, id = "") {
  const { adults, children, label } = peopleForCard(card);
  const idAttribute = id ? ` id="${id}"` : "";

  return `
    <div class="card-people"${idAttribute} aria-label="${escapeHtml(label)}">
      ${adults.map((adult) => renderPersonAvatar(adult, `parent-mini ${personClass(adult)}`, personInitial(adult))).join("")}
      ${adults.length && children.length ? `<span class="mini-join" aria-hidden="true">+</span>` : ""}
      ${children.map((child) => renderPersonAvatar(child, isPetName(child) ? "pet-mini" : "child-mini", child.slice(0, 1))).join("")}
    </div>
  `;
}

function renderCompactPeopleIcons(card) {
  const { adults, children, label } = peopleForCard(card);
  return `
    <span class="daily-row-people card-people" aria-label="${escapeHtml(label)}">
      ${adults.map((adult) => renderPersonAvatar(adult, `parent-mini ${personClass(adult)}`, personInitial(adult))).join("")}
      ${adults.length && children.length ? `<span class="mini-join" aria-hidden="true">+</span>` : ""}
      ${children.map((child) => renderPersonAvatar(child, isPetName(child) ? "pet-mini" : "child-mini", child.slice(0, 1))).join("")}
    </span>
  `;
}

function renderPersonAvatar(name, className, initial) {
  const displayName = displayPersonName(name);
  const safeName = escapeHtml(name);
  const safeDisplayName = escapeHtml(displayName);
  return `
    <span
      class="mini-avatar ${className}"
      title="${safeDisplayName}"
      aria-label="${safeDisplayName}"
      role="button"
      tabindex="0"
      data-person-filter="${safeName}"
      data-person-name="${safeDisplayName}"
    >${escapeHtml(initial)}</span>
  `;
}

function displayPersonName(name) {
  const family = getFamilyPeople();
  if (name === "Parent A") return family.primary.name;
  if (name === "Parent B") return family.coparent.name;
  return name;
}

function isPetName(name) {
  return getFamilyPeople().pets.some((pet) => pet.name.toLowerCase() === String(name || "").toLowerCase());
}

function peopleForCard(card) {
  const assignee = card.assignee;

  // Show only the person explicitly assigned to do the task - no text scanning
  const adults = !assignee ? []
    : assignee === "Both parents" ? ["Parent A", "Parent B"]
    : assignee === "Child" ? []
    : [assignee];

  const children = card.child ? splitPeople(card.child) : [];
  const people = [...adults, ...children];
  const label = people.map(displayPersonName).join(" and ");
  return { adults, children, people, label };
}

// Detect parent mention in text and return role string or null
function detectParentMention(text) {
  const lower = text.toLowerCase();
  const family = getFamilyPeople();
  const myName = getMyName().toLowerCase();
  if (/\bfor me\b|\bi('ll| will| can)\b/.test(lower) || lower.includes(myName)) return "Parent A";
  if (family.coparent.aliases.some((a) => lower.includes(a.toLowerCase()))) return "Parent B";
  if (family.primary.aliases.some((a) => lower.includes(a.toLowerCase()))) return "Parent A";
  return null;
}

function splitPeople(value) {
  return String(value || "")
    .split(/\s*(?:,|&|\+|and)\s*/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeChild(value) {
  const children = splitPeople(value);
  if (!children.length) return "Ava";
  return children.join(" + ");
}

function personInitial(value) {
  if (value === "Child") return "C";
  const family = getFamilyPeople();
  const name = displayPersonName(value); // resolve real name
  if (value === "Parent B" || name === family.coparent.name) return name.slice(0, 1).toUpperCase();
  return name.slice(0, 1).toUpperCase();
}

function personClass(value) {
  const family = getFamilyPeople();
  if (value === "Parent B" || value === family.coparent.name) return "parent-b-mini";
  if (value === "Child") return "child-assignee-mini";
  if ((family.caregivers || []).some((cg) => cg.name === value)) return "caregiver-mini";
  return "parent-a-mini";
}

function formatDate(value) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function formatReminder(reminder) {
  return `Reminder ${formatDate(reminder.time)}`;
}

function toDateTimeInputValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 3800);
}

function showInviteLinkFallback(inviteLink, toEmail) {
  // Show a persistent banner with a copy button when email delivery isn't available
  const existing = document.querySelector("#inviteLinkBanner");
  if (existing) existing.remove();

  const notice = toEmail
    ? `Email to ${toEmail} couldn't be delivered. Share this link manually:`
    : "Share this link with your co-parent:";

  const banner = document.createElement("div");
  banner.id = "inviteLinkBanner";
  banner.style.cssText = `
    position: fixed; bottom: calc(80px + env(safe-area-inset-bottom)); left: 50%;
    transform: translateX(-50%); width: min(480px, calc(100vw - 32px));
    background: var(--paper); border: 1px solid var(--line);
    border-radius: 18px; padding: 16px; box-shadow: 0 18px 46px rgba(17,24,39,0.12);
    z-index: 9998; display: grid; gap: 10px;
  `;
  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <p style="margin:0;font-size:13px;color:var(--muted);line-height:1.4;">${notice}</p>
      <button id="inviteLinkBannerClose" style="flex:0 0 auto;border:0;background:transparent;color:var(--muted);font-size:18px;cursor:pointer;padding:0;line-height:1;" aria-label="Close">&times;</button>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input readonly value="${inviteLink}" style="flex:1;min-width:0;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12px;background:var(--soft);color:var(--ink);" />
      <button id="inviteLinkCopy" style="flex:0 0 auto;min-height:36px;padding:0 14px;border:0;border-radius:999px;background:var(--accent);color:var(--ink);font-weight:900;font-size:12px;cursor:pointer;">Copy</button>
    </div>
  `;

  document.body.appendChild(banner);

  banner.querySelector("#inviteLinkCopy").addEventListener("click", () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      banner.querySelector("#inviteLinkCopy").textContent = "Copied!";
      window.setTimeout(() => banner.remove(), 2000);
    }).catch(() => {
      banner.querySelector("input").select();
    });
  });

  banner.querySelector("#inviteLinkBannerClose").addEventListener("click", () => banner.remove());

  // Store the link so Settings can re-surface it
  try { sessionStorage.setItem("do-do-pending-invite-link", inviteLink); } catch {}
}

function registerServiceWorker() {
  const canRegister = "serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol);
  if (!canRegister) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    showToast("Offline mode unavailable in this browser context");
  });
}

// ─── Notifications / Web Push ─────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (!window.VAPID_PUBLIC_KEY) return false;
  if (!currentAuthSession?.user?.id) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY),
    });
    const p256dh = btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh"))));
    const auth = btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth"))));
    await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh,
        auth,
      }),
    });
    return true;
  } catch (e) {
    console.warn("Push subscribe failed:", e);
    return false;
  }
}

async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push-subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch (e) {
    console.warn("Push unsubscribe failed:", e);
  }
}

function requestNotificationPermission() {
  // Show contextual prompt once if not yet asked and not already granted/denied
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  if (localStorage.getItem("notif-asked")) return;

  const prompt = document.getElementById("notif-prompt");
  if (!prompt) return;

  // Small delay so the card-saved toast clears before the prompt appears
  setTimeout(() => {
    prompt.classList.remove("hidden");

    document.getElementById("notif-prompt-allow")?.addEventListener("click", async () => {
      prompt.classList.add("hidden");
      localStorage.setItem("notif-asked", "1");
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await subscribeToPush();
      }
    }, { once: true });

    document.getElementById("notif-prompt-dismiss")?.addEventListener("click", () => {
      prompt.classList.add("hidden");
      localStorage.setItem("notif-asked", "dismissed");
    }, { once: true });
  }, 1200);
}

function stopReminderChecker() { /* no-op - handled server-side via cron */ }

// ─── SEG-09: Cookie consent banner ───────────────────────────────────────────
function initCookieBanner() {
  if (localStorage.getItem("cookie-consent-v1")) return;
  const banner = document.getElementById("cookieBanner");
  if (!banner) return;
  // Show after a short delay so it doesn't clash with auth/onboarding screens
  setTimeout(() => {
    banner.hidden = false;
    document.getElementById("cookieBannerOk")?.addEventListener("click", () => {
      banner.hidden = true;
      localStorage.setItem("cookie-consent-v1", "1");
    }, { once: true });
  }, 1500);
}

// Call on first load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCookieBanner);
} else {
  initCookieBanner();
}

// ─── Version badge ─────────────────────────────────────────────────────────────

function getAppVersion() {
  return { version: APP_VERSION, date: APP_VERSION_DATE };
}

function initVersionBadge() {
  const numEl = document.getElementById("versionNumber");
  const dateEl = document.getElementById("versionDate");
  if (numEl) numEl.textContent = APP_VERSION;
  if (dateEl) dateEl.textContent = APP_VERSION_DATE;
}

// Expose for settings panel and external use
window.getAppVersion = getAppVersion;
window.renderBoardCalendar = renderBoardCalendar;

function initNotifications() {
  // If permission was already granted (returning user), re-subscribe silently
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    subscribeToPush().catch(() => {});
  }
}

// ─── Custody auto-assign ──────────────────────────────────────────────────────
// Returns the parent name ("Parent A" / "Parent B" etc.) who has custody on
// a given date string "YYYY-MM-DD", or null if schedule is off / day is split.
function getCustodyParentForDate(dateStr) {
  if (!dateStr) return null;
  const getCustodyOwner = window.getCustodyOwner;
  if (typeof getCustodyOwner !== "function") return null;
  const date = new Date(dateStr + "T12:00:00");
  const owner = getCustodyOwner(date);
  if (!owner || owner === "split") return null;
  const setup = getOnboardingState() || {};
  if (owner === "mine") return setup.parents?.primary || "Parent A";
  if (owner === "co")   return setup.parents?.coparent || "Parent B";
  return null;
}

// Call this after a due date changes in the card dialog.
// Sets assigneeInput to the scheduled parent unless locked.
function maybeAutoAssignParent(dateStr) {
  if (elements.lockAssigneeInput?.checked) return; // user opted out
  const parent = getCustodyParentForDate(dateStr);
  if (!parent) return;
  setSelectValue(elements.assigneeInput, parent);
  renderDerivedTags();
}

// ─── Board week calendar ───────────────────────────────────────────────────────
// Teams-style week view below the kanban columns. Cards with due dates appear
// in their day column and can be dragged between days to reschedule.

function _boardCalGetWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0) ? -6 : 1 - day; // shift to Mon
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Recurrence expansion ────────────────────────────────────────────────────
// Returns virtual card instances for every visible day that matches the card's
// recurrence rule. Each instance has the same data as the original but with
// `due` set to that day (same time as original), plus _recInstance:true and
// _recSourceId pointing back to the original card.
function _expandRecurringCard(card, visibleDays) {
  const rec = card.recurrence;
  if (!rec || !rec.freq || rec.freq === "none") return [];

  const origDue   = new Date(card.due);
  const origH     = origDue.getHours();
  const origM     = origDue.getMinutes();
  const origS     = origDue.getSeconds();
  const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const instances = [];

  for (const day of visibleDays) {
    let matches = false;

    if (rec.freq === "daily") {
      matches = true;

    } else if (rec.freq === "weekly") {
      // Fall back to the original card's day-of-week if no days array was saved
      const recDays = rec.days?.length ? rec.days : [DOW_NAMES[origDue.getDay()]];
      matches = recDays.includes(DOW_NAMES[day.getDay()]);

    } else if (rec.freq === "biweekly") {
      const recDays = rec.days?.length ? rec.days : [DOW_NAMES[origDue.getDay()]];
      if (recDays.includes(DOW_NAMES[day.getDay()])) {
        // Count weeks from original due - only even multiples match
        const msPerWeek = 7 * 24 * 3600 * 1000;
        const weekDiff  = Math.round((day.getTime() - origDue.getTime()) / msPerWeek);
        matches = weekDiff % 2 === 0;
      }

    } else if (rec.freq === "monthly") {
      matches = day.getDate() === origDue.getDate();

    } else if (rec.freq === "custom-dates") {
      const dayKey = day.toISOString().slice(0, 10);
      matches = (rec.customDates || []).some((d) => String(d).slice(0, 10) === dayKey);
    }

    if (matches) {
      const newDue = new Date(day);
      newDue.setHours(origH, origM, origS, 0);
      instances.push({
        ...card,
        due: newDue.toISOString().slice(0, 19),
        _recInstance: true,
        _recSourceId: card.id,
      });
    }
  }

  return instances;
}

function _boardCalDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function _boardCalCardDay(card) {
  if (!card.due) return null;
  return card.due.slice(0, 10);
}

// ─── Time-grid helpers ────────────────────────────────────────────────────────

// Returns absolute top-px position of a card in the time grid column
function _bcalCardTopPx(card) {
  const startH = getCalStartHour();
  const endH   = getCalEndHour();
  if (!card.due) return (8 - startH) * BCAL_SLOT_H; // default 8 AM
  const d = new Date(card.due);
  const h = d.getHours();
  const m = d.getMinutes();
  const clampH = Math.max(startH, Math.min(endH - 1, h));
  return Math.round((clampH - startH + m / 60) * BCAL_SLOT_H);
}

// Convert a Y offset (relative to top of day column body) to {h, m} - snaps to 1-hour
function _bcalYToTime(relY) {
  const startH = getCalStartHour();
  const endH   = getCalEndHour();
  const totalPx = (endH - startH) * BCAL_SLOT_H;
  const clampedY = Math.max(0, Math.min(totalPx - 1, relY));
  const h = startH + Math.floor(clampedY / BCAL_SLOT_H);
  return { h: Math.min(h, endH - 1), m: 0 };
}

// Update a card's due + recalculate reminders to match the new time
function _adjustCardDueAndReminders(card, newDueStr) {
  // newDueStr = "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS"
  const newDueFull = newDueStr.length <= 16 ? newDueStr + ":00" : newDueStr;
  let updated = { ...card, due: newDueFull };
  if (card.reminder?.preset && card.reminder.preset !== "custom") {
    // Recalculate from preset (most accurate)
    updated.reminder = { ...card.reminder, time: reminderIsoFromDue(newDueFull, card.reminder.preset) };
  } else if (card.reminder?.time && card.due) {
    // Shift reminder by the same delta as the due-date change
    const delta = new Date(newDueFull).getTime() - new Date(card.due).getTime();
    if (delta !== 0) {
      updated.reminder = {
        ...card.reminder,
        time: new Date(new Date(card.reminder.time).getTime() + delta).toISOString(),
      };
    }
  }
  return updated;
}

function renderBoardCalendar(cards) {
  // Always use all cards (not board-filter subset) - fixes "I'll do it" disappearing-card bug
  const allCards = state.cards.filter((c) => c.due);
  window._lastCards = allCards;

  const containers = [
    document.getElementById("boardCalGrid"),
    document.getElementById("calPageBcalGrid"),
  ].filter(Boolean);
  if (!containers.length) return;

  const colCount = _boardCal.mode === "3day" ? 3 : _boardCal.mode === "2day" ? 2 : 7;
  const ws = _boardCal.weekStart;

  const days = Array.from({ length: colCount }, (_, i) => {
    const d = new Date(ws);
    d.setDate(ws.getDate() + i);
    return d;
  });

  // Title
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const firstDay = days[0];
  const lastDay  = days[days.length - 1];
  const titleText = firstDay.getMonth() === lastDay.getMonth()
    ? `${monthNames[firstDay.getMonth()]} ${firstDay.getFullYear()}`
    : `${monthNames[firstDay.getMonth()]} - ${monthNames[lastDay.getMonth()]} ${lastDay.getFullYear()}`;

  const todayKey = _boardCalDayKey(new Date());

  // Map day key -> sorted cards (non-recurring placed directly; recurring expanded)
  const cardsByDay = {};
  days.forEach((d) => { cardsByDay[_boardCalDayKey(d)] = []; });
  allCards.forEach((card) => {
    if (card.recurrence && card.recurrence.freq && card.recurrence.freq !== "none") {
      // Expand into one virtual instance per matching visible day
      _expandRecurringCard(card, days).forEach((inst) => {
        const k = _boardCalCardDay(inst);
        if (k && cardsByDay[k] !== undefined) cardsByDay[k].push(inst);
      });
    } else {
      const k = _boardCalCardDay(card);
      if (k && cardsByDay[k] !== undefined) cardsByDay[k].push(card);
    }
  });
  // Sort by time within each day
  Object.keys(cardsByDay).forEach((k) => {
    cardsByDay[k].sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  });

  const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const startH   = getCalStartHour();
  const endH     = getCalEndHour();
  const totalH   = (endH - startH) * BCAL_SLOT_H;

  // Now-line position
  const now = new Date();
  const nowTopPx = (now.getHours() >= startH && now.getHours() < endH)
    ? Math.round((now.getHours() - startH + now.getMinutes() / 60) * BCAL_SLOT_H)
    : -1;

  // Time gutter labels (one per hour)
  const gutterHTML = Array.from({ length: endH - startH }, (_, i) => {
    const h = startH + i;
    const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
    return `<div class="bcal-tg-label" style="top:${i * BCAL_SLOT_H}px">${label}</div>`;
  }).join("");

  // Day columns
  const _custodyOverrides = window.getCustodySchedule?.()?.overrides || {};
  const dayCols = days.map((d) => {
    const k = _boardCalDayKey(d);
    const isToday = k === todayKey;
    const daycards = cardsByDay[k] || [];
    const custodyClass = window.getCustodyClass ? window.getCustodyClass(d) : "";

    // Detect split-day handover time and direction for this column
    const _ov = _custodyOverrides[k];
    const _splitTime = (_ov && _ov.type === "split" && _ov.time) ? _ov.time : null;
    const _splitDir = _splitTime ? (_ov.morning === "co" ? "custody-split-co-first" : "custody-split-mine-first") : "";
    let splitBandEl = "";
    let handoverMarkerEl = "";
    if (_splitTime) {
      const [_sh, _sm] = _splitTime.split(":").map(Number);
      if (_sh >= startH && _sh < endH) {
        const _splitTop = Math.round((_sh - startH + (_sm || 0) / 60) * BCAL_SLOT_H);
        const _mineColor = "var(--custody-mine-color,#65d6c6)";
        const _coColor   = "var(--custody-co-color,#76808a)";
        const [_gradFirst, _gradSecond] = _ov.morning === "co" ? [_coColor, _mineColor] : [_mineColor, _coColor];
        splitBandEl = `<div class="bcal-split-band" style="top:${_splitTop}px;height:${BCAL_SLOT_H}px;background:linear-gradient(to bottom,color-mix(in srgb,${_gradFirst} 20%,transparent),color-mix(in srgb,${_gradSecond} 20%,transparent));border-top-color:color-mix(in srgb,${_gradFirst} 60%,transparent);border-bottom-color:color-mix(in srgb,${_gradSecond} 60%,transparent)"></div>`;
        const _handoverLabel = (window.t?.("cal.handover")) || "Handover";
        const _reminderLabel = (window.t?.("card.action.reminder")) || "Reminder";
        const _messageLabel  = (window.t?.("card.action.message"))  || "Message";
        handoverMarkerEl = `<div class="bcal-handover-marker bcal-do-card" data-open-przekazanie="1" role="button" tabindex="0" style="top:${_splitTop}px">
          <article class="card unified-card bcal-handover-card">
            <div class="card-state-row">
              <span class="card-handover-badge">↔</span>
              <span class="card-date-tag">${_splitTime}</span>
            </div>
            <h3 class="card-title">${_handoverLabel}</h3>
            <div class="card-footer-actions">
              <button class="card-footer-btn" type="button" data-handover-remind="1">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
                ${_reminderLabel}
              </button>
              <button class="card-footer-btn" type="button" data-handover-message="1">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></svg>
                ${_messageLabel}
              </button>
            </div>
          </article>
        </div>`;
      }
    }

    // Hour lines (major every hour, minor at half-hour)
    const hourLines = Array.from({ length: endH - startH }, (_, i) => `
      <div class="bcal-hour-line" style="top:${i * BCAL_SLOT_H}px"></div>
      <div class="bcal-half-line" style="top:${i * BCAL_SLOT_H + BCAL_SLOT_H / 2}px"></div>
    `).join("");

    // Cards positioned absolutely at their time
    const cardEls = daycards.map((card) => {
      const topPx   = _bcalCardTopPx(card);
      // For recurring instances, always point data-bcal-card to the source card so
      // clicking and dragging edit the original (not a virtual copy).
      const editId  = card._recSourceId || card.id;
      // renderUnifiedCard uses card.id for data-card-id internally; pass the source card
      // for instances so the rendered chip shows the right content and opens correctly.
      const srcCard = card._recInstance
        ? (state.cards.find((c) => c.id === card._recSourceId) || card)
        : card;
      const inner = renderUnifiedCard(srcCard, { showActions: true, className: "bcal-do-card" });
      const recBadge = card._recInstance
        ? `<span class="bcal-rec-badge" title="Recurring">↻</span>`
        : "";
      return `<div class="bcal-card-wrap${card._recInstance ? " bcal-rec-instance" : ""}" draggable="true" data-bcal-card="${editId}" style="top:${topPx}px">
        <div class="bcal-drag-handle" title="Drag to reschedule">⠿</div>
        ${recBadge}${inner}
      </div>`;
    }).join("");

    return `<div class="bcal-day-col${isToday ? " bcal-today-col" : ""}${custodyClass ? " "+custodyClass : ""}${_splitDir ? " "+_splitDir : ""}" data-bcal-day="${k}" data-bcal-drop="${k}">
      ${hourLines}
      ${splitBandEl}
      ${handoverMarkerEl}
      ${cardEls}
    </div>`;
  }).join("");

  const gridHTML = `
    <div class="bcal-tg-outer">
      <div class="bcal-header-row">
        <div class="bcal-tg-head"></div>
        ${days.map((d) => {
          const k = _boardCalDayKey(d);
          const isToday = k === todayKey;
          const custodyClass = window.getCustodyClass ? window.getCustodyClass(d) : "";
          const headOv = _custodyOverrides[k];
          const headSplitDir = (headOv && headOv.type === "split") ? (headOv.morning === "co" ? "custody-split-co-first" : "custody-split-mine-first") : "";
          return `<div class="bcal-col-head${isToday ? " bcal-today" : ""}${custodyClass ? " "+custodyClass : ""}${headSplitDir ? " "+headSplitDir : ""}">
            <span class="bcal-dow">${DOW[d.getDay()]}</span>
            <strong class="bcal-num">${d.getDate()}</strong>
          </div>`;
        }).join("")}
      </div>
      <div class="bcal-scroll">
        <div class="bcal-tg-body" style="height:${totalH}px">${gutterHTML}</div>
        <div class="bcal-days" style="height:${totalH}px">
          ${dayCols}
          ${nowTopPx >= 0 ? `<div class="bcal-now-line" style="top:${nowTopPx}px"></div>` : ""}
        </div>
      </div>
    </div>
  `;

  containers.forEach((grid) => {
    grid.innerHTML = gridHTML;
    _bindBoardCalDragDrop(grid);
    window.bindUnifiedCardInteractions?.(grid);
    // Handover card click -> open Przekazanie dialog (skip if clicking a footer button)
    grid.querySelectorAll("[data-open-przekazanie]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-handover-remind],[data-handover-message]")) {
          e.stopPropagation();
          window.openPrzekazanieDialog?.();
          return;
        }
        e.stopPropagation();
        window.openPrzekazanieDialog?.();
      });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.openPrzekazanieDialog?.(); } });
    });
    // Scroll to show current time (or start of day if outside range)
    requestAnimationFrame(() => {
      const scrollEl = grid.querySelector(".bcal-scroll");
      if (scrollEl) scrollEl.scrollTop = Math.max(0, (nowTopPx > 0 ? nowTopPx : 0) - 160);
    });
  });

  // Update titles
  ["boardCalTitle", "calPageBcalTitle"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = titleText;
  });

  // Update toggle active states
  ["boardCalToggleWeek","calPageBcalToggleWeek"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("active", _boardCal.mode === "week");
  });
  ["boardCalToggle3Day","calPageBcalToggle3Day"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("active", _boardCal.mode === "3day");
  });

  // Bind nav + toggle buttons
  _bindBoardCalNav("boardCalPrev", "boardCalNext", "boardCalToggleWeek", "boardCalToggle3Day");
  _bindBoardCalNav("calPageBcalPrev", "calPageBcalNext", "calPageBcalToggleWeek", "calPageBcalToggle3Day");
}

function _bindBoardCalNav(prevId, nextId, toggleWeekId, toggle3DayId) {
  const prev  = document.getElementById(prevId);
  const next  = document.getElementById(nextId);
  const tWeek = document.getElementById(toggleWeekId);
  const t3Day = document.getElementById(toggle3DayId);

  const _shift = () => _boardCal.mode === "3day" ? 3 : _boardCal.mode === "2day" ? 2 : 7;

  if (prev) {
    prev.onclick = () => {
      _boardCal.weekStart = new Date(_boardCal.weekStart);
      _boardCal.weekStart.setDate(_boardCal.weekStart.getDate() - _shift());
      renderBoardCalendar();
    };
  }
  if (next) {
    next.onclick = () => {
      _boardCal.weekStart = new Date(_boardCal.weekStart);
      _boardCal.weekStart.setDate(_boardCal.weekStart.getDate() + _shift());
      renderBoardCalendar();
    };
  }
  if (tWeek) {
    tWeek.onclick = () => {
      _boardCal.mode = "week";
      _boardCal.weekStart = _boardCalGetWeekStart(_boardCal.weekStart);
      renderBoardCalendar();
    };
  }
  if (t3Day) {
    t3Day.onclick = () => {
      if (_boardCal.mode !== "3day") {
        _boardCal.mode = "3day";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        _boardCal.weekStart = today;
      }
      renderBoardCalendar();
    };
  }
}

function _bindBoardCalDragDrop(container) {
  let dragCardId   = null; // id of a calendar card being dragged
  let dragKanbanId = null; // id of a kanban card being dragged in from the board

  // ---- calendar card drag ----
  container.querySelectorAll("[data-bcal-card]").forEach((el) => {
    el.addEventListener("dragstart", (e) => {
      dragCardId   = el.dataset.bcalCard;
      dragKanbanId = null;
      e.dataTransfer.setData("text/bcal-card", dragCardId);
      e.dataTransfer.effectAllowed = "move";
      el.classList.add("bcal-dragging");
    });
    el.addEventListener("dragend", () => {
      dragCardId = null;
      container.querySelectorAll(".bcal-dragging").forEach((x) => x.classList.remove("bcal-dragging"));
      container.querySelectorAll(".bcal-drop-over").forEach((x) => x.classList.remove("bcal-drop-over"));
    });
    el.querySelector(".bcal-drag-handle")?.addEventListener("click", () => {
      window.openCardDialog?.(el.dataset.bcalCard);
    });
  });

  // ---- day-column drop targets ----
  container.querySelectorAll("[data-bcal-drop]").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      const hasBcal   = e.dataTransfer.types.includes("text/bcal-card");
      const hasKanban = e.dataTransfer.types.includes("text/kanban-card");
      if (!hasBcal && !hasKanban) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      container.querySelectorAll(".bcal-drop-over").forEach((x) => x.classList.remove("bcal-drop-over"));
      col.classList.add("bcal-drop-over");
    });
    col.addEventListener("dragleave", (e) => {
      if (!col.contains(e.relatedTarget)) col.classList.remove("bcal-drop-over");
    });
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("bcal-drop-over");

      const newDay      = col.dataset.bcalDrop; // "YYYY-MM-DD"
      const bcalCardId  = e.dataTransfer.getData("text/bcal-card");
      const kanbanCardId = e.dataTransfer.getData("text/kanban-card");
      const cardId      = bcalCardId || kanbanCardId;
      if (!cardId || !newDay) return;

      const card = state.cards.find((c) => c.id === cardId);
      if (!card) return;

      // Calculate new time from drop Y position (1-hour snap)
      // For kanban drops: preserve existing time if any, else snap to drop position
      let newHour, newMin;
      const colRect = col.getBoundingClientRect();
      // getBoundingClientRect() is already viewport-relative; no scroll adjustment needed
      const relY    = e.clientY - colRect.top;
      const snapped = _bcalYToTime(relY);
      newHour = snapped.h;
      newMin  = 0;

      // For kanban cards with no existing due: use drop position time
      // For calendar card moves: always use drop position time
      const newDue = `${newDay}T${String(newHour).padStart(2,"0")}:${String(newMin).padStart(2,"0")}:00`;

      // No-op if same datetime
      if (card.due && newDue === card.due.slice(0, 19)) return;

      // Build updated card with adjusted reminders
      const updated = _adjustCardDueAndReminders(card, newDue);

      // Update assignee to custody parent unless locked
      if (!card.lockAssignee) {
        const schedParent = getCustodyParentForDate(newDay);
        if (schedParent) updated.assignee = schedParent;
      }

      const idx = state.cards.findIndex((c) => c.id === cardId);
      if (idx < 0) return;
      state.cards[idx] = updated;

      // Persist + sync external calendars
      persist();
      if (window.saveCardToSupabase) window.saveCardToSupabase(updated).catch(() => {});
      window.syncCalendarEventsFromCards?.();

      // Re-render calendar; kanban card stays on the board (no board re-render needed)
      renderBoardCalendar();
    });
  });
}

// Make kanban board cards draggable into the calendar
function _bindKanbanToBoardCal() {
  // Exclude calendar cards (.bcal-do-card) - they already have their own bcal drag
  document.querySelectorAll(".board-card:not(.bcal-do-card), [data-card-id]:not(.bcal-do-card)").forEach((el) => {
    const cardId = el.dataset.cardId || el.dataset.id;
    if (!cardId) return;
    if (el.dataset.kanbanBound) return; // avoid double-binding
    el.dataset.kanbanBound = "1";
    el.setAttribute("draggable", "true");
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/kanban-card", cardId);
      e.dataTransfer.effectAllowed = "copy";
      el.classList.add("bcal-kanban-dragging");
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("bcal-kanban-dragging");
    });
  });
}
