const statusColumns = ["Important", "Waiting", "To Do", "Done"]; // kept for DB mapping
const kanbanColumns = [
  { id: "to-decide", label: "To decide", statuses: ["Important", "Waiting", "Disputed"] },
  { id: "mine",      label: "Mine",       statuses: ["To Do", "Info Only", "Request"]    },
  { id: "done",      label: "Done",       statuses: ["Done"]                              },
];
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
};
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
  amountInput: document.querySelector("#amountInput"),
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
render();

function bindEvents() {
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
  });
  elements.cardDialog?.addEventListener("cancel", (e) => {
    e.preventDefault();
    if (elements.cardId.value || elements.detailsInput?.value.trim()) {
      saveCardSilent();
    }
    elements.cardDialog?.close();
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

  supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
    if (nextSession) {
      if (pendingInviteToken) {
        finishInviteAcceptance(nextSession);
      } else {
        showApp(nextSession);
      }
    } else {
      showAuthScreen();
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
      elements.inviteHero.querySelector("h1").textContent = `${info.parentAName} invited you to their family board.`;
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
    showToast(result?.reason === "already_accepted" ? "Invite already accepted" : "Could not join family - try again");
  } else {
    showToast(`Joined the family board`);
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
  showToast("Signed out");
}

function showApp(session) {
  if (!session && !currentAuthSession) {
    showAuthScreen();
    return;
  }
  currentAuthSession = session || currentAuthSession;
  clearAuthError();
  document.body.classList.remove("auth-locked");
  initializeOnboarding();
  // Load real data from Supabase in the background
  if (window.initSupabaseData) {
    window.initSupabaseData(currentAuthSession).catch(() => {});
  }
  // Initialize notifications
  initNotifications();
  requestNotificationPermission();
  // Load Google Calendar events if provider token is available
  if (window.initGoogleCalendar) {
    window.initGoogleCalendar(currentAuthSession).catch(() => {});
  }
}

function showAuthScreen() {
  currentAuthSession = null;
  document.body.classList.add("auth-locked");
  document.body.classList.remove("onboarding-locked");
  elements.authProviderList?.classList.remove("hidden");
  elements.authConfirm?.classList.add("hidden");
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
  showToast("Family board setup complete");
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

function render() {
  const cards = filteredCards();
  renderCounts();
  renderSummary();
  renderDailySummary();
  renderInlineCaptureHost();
  renderAttention();
  renderBoard(cards);
  renderList(cards);

  elements.boardView.classList.toggle("hidden", state.view !== "board");
  elements.listView.classList.toggle("hidden", state.view !== "list");
}

function renderSummary() {
  const expenses = state.cards.reduce((sum, card) => sum + parseAmount(card.amount), 0);
  const messages = state.cards.filter((card) => !card.acknowledged).length;
  const reminders = state.cards.filter((card) => card.reminder).length;
  const waiting = state.cards.filter((card) => card.status === "Waiting").length;
  const todo = state.cards.filter((card) => card.status === "To Do").length;
  document.querySelector("#topCosts").textContent = expenses ? `CHF ${Math.round(expenses)}` : "CHF 0";
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
    const res = await fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
  const activeCards = cards.filter((card) => !isCardArchived(card));
  const archivedCards = cards.filter(isCardArchived);

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

  const columnsHtml = kanbanColumns.map(({ id, label, statuses }) => {
    const columnCards = activeCards.filter((card) => statuses.includes(card.status));
    return `
      <section class="column" data-column="${id}">
        <div class="column-header">${label}<span>${columnCards.length}</span></div>
        <div class="column-body">
          ${columnCards.length
            ? columnCards.map(renderCard).join("")
            : `<p class="column-empty">No Dos here</p>`}
        </div>
      </section>
    `;
  }).join("");

  const archivedHtml = archivedCards.length ? `
    <div class="archive-section" style="grid-column:1/-1;" id="archiveSection">
      <button class="archive-toggle" type="button" id="archiveToggle" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v4H3zM5 8v12h14V8"/><path d="M10 12h4"/></svg>
        Archived
        <span>${archivedCards.length}</span>
        <svg class="archive-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="archive-grid hidden" id="archiveGrid">
        ${archivedCards.map(renderCard).join("")}
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

function renderUnifiedCard(card, options = {}) {
  const actionLabel = card.type === "Expense" ? "Paid" : "Done";
  const isDone = card.status === "Done";
  const showActions = options.showActions !== false;
  const attributes = options.attributes || `data-card-id="${card.id}" role="button" tabindex="0"`;
  const className = ["card", "unified-card", options.className || "", isDone ? "done-card" : ""].filter(Boolean).join(" ");

  const dateStr = formatDate(card.due);
  const statusLabel = isDone ? "Done"
    : card.status === "Waiting" ? "Waiting"
    : card.status === "Important" ? "Urgent"
    : !card.acknowledged ? "Needs response"
    : "";

  return `
    <article class="${className}" ${attributes}>
      <div class="card-state-row">
        <span class="card-date-tag">${dateStr}</span>
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

      ${showActions ? `
        <div class="quick-actions">
          <button class="quick-complete" type="button" data-quick-complete="${card.id}" ${isDone ? "disabled" : ""}>
            ${isDone ? "Completed" : actionLabel}
          </button>
          <button class="quick-response" type="button" data-quick-response="${card.id}" data-response="do" ${isDone ? "disabled" : ""}>I'll do it</button>
          <button class="quick-response" type="button" data-quick-response="${card.id}" data-response="will" ${isDone ? "disabled" : ""}>Please do it</button>
          <button class="quick-response" type="button" data-quick-response="${card.id}" data-response="cannot" ${isDone ? "disabled" : ""}>Can't</button>
        </div>
        <div class="card-footer-actions">
          <button class="card-footer-btn" type="button" data-remind-card="${card.id}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
            Reminder
          </button>
          <button class="card-footer-btn" type="button" data-message-card="${card.id}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></svg>
            Message
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
    googleCalendar: calendarSync,
    createdAt: Date.now(),
  };

  state.cards.unshift(card);
  persist();
  input.value = "";
  showToast(buildCreateToast(card));
  render();
}

function openCardDialog(id = "", focusSection = "info", prefill = {}) {
  const card = state.cards.find((item) => item.id === id);
  elements.cardForm.reset();
  if (elements.voiceStatus) elements.voiceStatus.textContent = "Record what has to be done";
  elements.cardId.value = card?.id || "";
  elements.dialogTitle.textContent = card ? card.title : "New Do";
  elements.dialogMode.textContent = card ? "Information and thread" : "New Do";
  elements.llmCardChat?.classList.add("hidden"); // never shown - direct form always used
  elements.commentPanel?.classList.toggle("hidden", !card);
  // Show reminder panel for both new and existing cards (hide only when GCal connected)
  const gcalActive = Boolean(state.automationSettings?.syncFamilyCalendar);
  elements.cardReminderPanel?.classList.toggle("hidden", gcalActive);
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
    elements.amountInput.value = card.amount || "";
    elements.detailsInput.value = card.details;
    elements.cardReminderPresetInput.value = card.reminder?.preset || state.automationSettings.defaultReminderPreset;
    elements.cardReminderTimeInput.value = card.reminder?.time
      ? toDateTimeInputValue(new Date(card.reminder.time))
      : buildReminderTime(card, elements.cardReminderPresetInput.value);
    renderDialogMeta(card);
    updateDialogQuickActions(card);
    renderComments(card);
    renderActivity(card);
    renderDerivedTags();
  } else {
    elements.topicInput.value = prefill.topic || (state.topic === "All" ? "Schedule" : state.topic);
    elements.typeInput.value = prefill.type || "Task";
    elements.statusInput.value = "To Do";
    setSelectValue(elements.assigneeInput, "");
    setSelectValue(elements.childInput, "");
    elements.amountInput.value = "";
    // Pre-fill due date from calendar selection or passed-in prefill
    elements.dueInput.value = prefill.due ? prefill.due.slice(0, 16) : "";
    elements.detailsInput.value = prefill.details || "";
    elements.cardReminderPresetInput.value = state.automationSettings.defaultReminderPreset || "60";
    elements.cardReminderTimeInput.value = "";
    if (elements.llmCardPromptInput) elements.llmCardPromptInput.value = "";
    renderLlmInterpretation("");
    renderDerivedTags();
  }

  updateReminderCustomVisibility();
  const canEdit = !card || state.automationSettings.everyoneCanEdit;
  setCardDialogEditMode(canEdit);
  elements.cardDialog.showModal();
  focusCardDialogSection(focusSection);
}

function renderDialogPeople(card) {
  elements.dialogCardPeople.outerHTML = renderPeopleIcons(card, "dialogCardPeople");
  elements.dialogCardPeople = document.querySelector("#dialogCardPeople");
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

function presetLabel(preset) {
  const map = { "15": "15 min before", "60": "1 hr before", "120": "2 hrs before", "1440": "1 day before", "10080": "1 week before", "at-due": "at event time" };
  return map[preset] || preset;
}

function updateDialogQuickActions(card) {
  const isDone = card.status === "Done";
  elements.dialogCompleteButton.textContent = isDone ? "Completed" : card.type === "Expense" ? "Paid" : "Done";
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

    const res = await fetch("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  renderDerivedTags();
  if (!options.silent) showToast("Do tags derived from info");
  return true;
}

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
  const raw = text
    .replace(/^(please|can you|could you|remind me to|we need to)\s+/i, "")
    .split(/[.!?]/)[0]
    .trim()
    .slice(0, 72) || "New Do";
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
  return {
    primary: { role: "Parent A", name: primaryName, aliases: ["Parent A", "primary parent", primaryName] },
    coparent: { role: "Parent B", name: coparentName, aliases: ["Parent B", "co-parent", "coparent", "other parent", coparentName] },
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
  const match = text.match(/(?:CHF|USD|EUR|£|\$|€)\s?\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s?(?:CHF|USD|EUR)/i);
  return match ? match[0].replace(/\s+/g, " ") : "";
}

function inferDueDate(lower) {
  const date = new Date();
  const explicitDate = lower.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]) - 1;
    const year = explicitDate[3]
      ? Number(explicitDate[3].length === 2 ? `20${explicitDate[3]}` : explicitDate[3])
      : date.getFullYear();
    date.setFullYear(year, month, day);
  }
  if (lower.includes("tomorrow")) date.setDate(date.getDate() + 1);
  if (lower.includes("next week")) date.setDate(date.getDate() + 7);
  if (!explicitDate && !/(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.test(lower)) return "";

  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const targetDay = days.findIndex((day) => lower.includes(day));
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

  const atTime = lower.match(/\bat\s*(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\b/);
  if (atTime) return atTime;

  const explicitTimes = lower.matchAll(/\b(\d{1,2}):(\d{2})\s?(am|pm)?\b/g);
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

function renderComments(card) {
  const family = getFamilyPeople();
  const myName = family.primary.name || "Parent A";
  elements.commentList.innerHTML = card.comments.length
    ? card.comments.map((comment) => {
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
          comments: [...item.comments, { author: getMyName(), text: reminderText, time: "Just now" }],
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

function saveCard(event) {
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
  const googleCalendar = due && state.automationSettings.syncFamilyCalendar
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

  // Prefer GCal alert over app reminder when calendar is connected
  const gcalConnected = Boolean(window.getGoogleCalendarConnected?.() || state.automationSettings.syncFamilyCalendar);
  const reminder = gcalConnected
    ? null  // GCal event alert handles delivery
    : (existing?.reminder || autoReminder);

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
    author: existing?.author || authorName,
    createdAt: existing?.createdAt || Date.now(),
    lastEditedAt: Date.now(),
    lastEditedBy: authorName,
  };

  if (existing) {
    state.cards = state.cards.map((item) => (item.id === id ? card : item));
  } else {
    state.cards.unshift(card);
  }

  persist();
  if (!saveCard._silent) elements.cardDialog.close();
  showToast(existing ? "Do updated" : buildCreateToast(card));
  render();
  // Sync to Supabase, then push to Google Calendar if card has a date
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
    if (window.saveCardToSupabase) await window.saveCardToSupabase(savedCard).catch(() => {});
  };
  syncCard();
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
  state.cards = state.cards.filter((card) => card.id !== id);
  persist();
  elements.cardDialog.close();
  showToast("Do deleted");
  render();
  // Soft-delete in Supabase
  if (window.deleteCardFromSupabase) window.deleteCardFromSupabase(id).catch(() => {});
}

function acknowledgeCurrentCard() {
  const id = elements.cardId.value;
  state.cards = state.cards.map((card) => (
    card.id === id
      ? {
          ...card,
          acknowledged: true,
          status: card.status === "Important" || card.status === "Waiting" ? "Done" : card.status,
          comments: [...card.comments, { author: getMyName(), text: "Acknowledged", time: "Just now" }],
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
  const label = card.type === "Expense" ? "Marked paid" : "Marked done";
  state.cards = state.cards.map((item) => (
    item.id === id
      ? {
          ...item,
          status: "Done",
          acknowledged: true,
          comments: [...item.comments, { author: getMyName(), text: label, time: "Just now" }],
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
  const text = response === "do" ? "I'll do it" : response === "will" ? "Please do it" : "Can't do this";
  const nextStatus = response === "cannot" ? "Disputed" : response === "do" ? "To Do" : "Waiting";
  state.cards = state.cards.map((item) => (
    item.id === id
      ? {
          ...item,
          status: nextStatus,
          assignee: response === "do" ? myName : item.assignee,
          acknowledged: true,
          comments: [...item.comments, { author: myName, text, time: "Just now" }],
        }
      : item
  ));
  persist();
  showToast(text);
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
  const reminder = {
    preset: elements.reminderPresetInput.value,
    time: reminderDate.toISOString(),
  };
  const reminderText = `Reminder set for ${formatDate(reminder.time)}`;
  state.cards = state.cards.map((item) => (
    item.id === id
      ? {
          ...item,
          reminder,
          comments: [...item.comments, { author: getMyName(), text: reminderText, time: "Just now" }],
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
  const currency = String(currentAmount || "").match(/CHF|USD|EUR|£|\$|€/i)?.[0] || "CHF";
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
  return Boolean(settings.automateReminders) && settings.reminderDelivery !== "calendar-only";
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
    const googleCalendar = state.automationSettings.syncFamilyCalendar
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
  const family = getFamilyPeople();
  const assignee = card.assignee;

  // Base adults from explicit assignee field
  let adults = !assignee ? []
    : assignee === "Both parents" ? ["Parent A", "Parent B"]
    : assignee === "Child" ? []
    : [assignee];

  // Also scan title, details, and all comment text for parent name mentions
  const textToScan = [
    card.title || "",
    card.details || "",
    ...(card.comments || []).map((c) => c.text || ""),
  ].join(" ").toLowerCase();

  const mentionsPrimary = family.primary.aliases.some((a) => textToScan.includes(a.toLowerCase()))
    || /\bfor me\b|\bi('ll| will)\b/.test(textToScan);
  const mentionsCoparent = family.coparent.aliases.some((a) => textToScan.includes(a.toLowerCase()));

  if (mentionsPrimary && !adults.includes("Parent A")) adults = [...adults, "Parent A"];
  if (mentionsCoparent && !adults.includes("Parent B")) adults = [...adults, "Parent B"];

  // Deduplicate
  adults = [...new Set(adults)];

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

// ─── Notifications ────────────────────────────────────────────────────────────
// Reminders are delivered via Google Calendar alerts set at event creation.
// The "minutes before" value comes from defaultReminderPreset in automation settings.
// Browser Notification API polling is not used.

function requestNotificationPermission() { /* handled by calendar */ }
function stopReminderChecker() { /* no-op */ }
function initNotifications() { /* no-op - reminders via calendar alerts */ }
