const today = new Date();
const shoppingStorageKey = "do-do-shopping-lists-v1";
const shoppingCustomListsKey = "do-do-shopping-custom-lists-v1";
const shoppingListMetaKey = "do-do-shopping-list-meta-v1";

// Meta stores name overrides and hidden state for default lists: { groceries: { name: "...", hidden: true }, other: { ... } }
function loadShoppingListMeta() {
  try {
    const raw = window.appStorage?.getItem(shoppingListMetaKey);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveShoppingListMeta(meta) {
  window.appStorage?.setItem(shoppingListMetaKey, JSON.stringify(meta));
}

function loadCustomShoppingLists() {
  try {
    const raw = window.appStorage?.getItem(shoppingCustomListsKey);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomShoppingLists(lists) {
  window.appStorage?.setItem(shoppingCustomListsKey, JSON.stringify(lists));
}

function addCustomShoppingList(name) {
  const lists = loadCustomShoppingLists();
  const key = "custom-" + Date.now();
  lists.push({ key, name, items: [] });
  saveCustomShoppingLists(lists);
  return key;
}

// ─── Custody / parenting schedule ────────────────────────────────────────────

const CUSTODY_COLORS = [
  { value: "#65d6c6", label: "Teal" },
  { value: "#60a5fa", label: "Blue" },
  { value: "#a78bfa", label: "Purple" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef6461", label: "Coral" },
  { value: "#4ade80", label: "Green" },
];

function getCustodySchedule() {
  try {
    const raw = localStorage.getItem("custody-schedule-v1");
    const defaults = {
      enabled: true,
      type: "7-7",
      referenceDate: new Date().toISOString().slice(0, 10),
      myColor: "#65d6c6",
      coColor: "#76808a",
      overrides: {},   // { "YYYY-MM-DD": "mine" | "co" | { type:"split", time:"HH:MM", morning:"mine"|"co" } }
    };
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return { enabled: true, type: "7-7", referenceDate: new Date().toISOString().slice(0, 10), myColor: "#65d6c6", coColor: "#76808a", overrides: {} };
  }
}

function saveCustodySchedule(schedule) {
  localStorage.setItem("custody-schedule-v1", JSON.stringify(schedule));
  applyCustodyColors(schedule);
}

function applyCustodyColors(schedule) {
  schedule = schedule || getCustodySchedule();
  if (!schedule.enabled) return;
  // Convert hex to rgba for subtle tints
  const toRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };
  document.documentElement.style.setProperty("--custody-mine-bg", toRgba(schedule.myColor, 0.18));
  document.documentElement.style.setProperty("--custody-mine-color", schedule.myColor);
  document.documentElement.style.setProperty("--custody-co-bg", toRgba(schedule.coColor, 0.18));
  document.documentElement.style.setProperty("--custody-co-color", schedule.coColor);
}

// Returns "mine", "co", or "" for a given Date object (checks overrides first)
function getCustodyOwner(date) {
  // Check vacation schedule first - takes precedence without destroying the base schedule
  const vac = getActiveVacation(date);
  if (vac) return getVacationOwnerForDate(vac, date);

  const schedule = getCustodySchedule();
  if (!schedule.enabled) return null;

  // Check day-level override first
  const key = toCalendarKey(date);
  const ov = (schedule.overrides || {})[key];
  if (ov === "mine") return "mine";
  if (ov === "co") return "co";
  if (ov && ov.type === "split") return "split";

  if (!schedule.referenceDate) return null;
  const ref = new Date(schedule.referenceDate + "T00:00:00");
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysDiff = Math.round((d - ref) / 86400000);

  if (schedule.type === "7-7") {
    const periodIndex = Math.floor(daysDiff / 7);
    return ((periodIndex % 2) + 2) % 2 === 0 ? "mine" : "co";
  }
  if (schedule.type === "2-2-3") {
    const pos = ((daysDiff % 14) + 14) % 14;
    if (pos <= 1) return "mine";
    if (pos <= 3) return "co";
    if (pos <= 6) return "mine";
    if (pos <= 8) return "co";
    if (pos <= 10) return "mine";
    return "co";
  }
  if (schedule.type === "5-2") {
    const dow = d.getDay();
    return (dow === 0 || dow === 6) ? "co" : "mine";
  }
  // manual: only overrides apply, no auto-pattern
  return null;
}

function getCustodyClass(date) {
  const owner = getCustodyOwner(date);
  if (owner === "mine") return "custody-mine";
  if (owner === "co") return "custody-co";
  if (owner === "split") return "custody-split";
  return "";
}

// Returns extra direction class for split days: which parent has child first (left side of gradient)
function getCustodySplitDir(dateOrKey) {
  const key = typeof dateOrKey === "string" ? dateOrKey : toCalendarKey(dateOrKey);
  const ov = (getCustodySchedule().overrides || {})[key];
  if (!ov || ov.type !== "split") return "";
  return ov.morning === "co" ? "custody-split-co-first" : "custody-split-mine-first";
}

// Set a day-level override and re-render calendar
function setCustodyDayOverride(dateKey, value) {
  const schedule = getCustodySchedule();
  if (!schedule.overrides) schedule.overrides = {};
  if (value === "auto") {
    delete schedule.overrides[dateKey];
  } else {
    schedule.overrides[dateKey] = value;
  }
  saveCustodySchedule(schedule);
}

// Apply colors on page load
(function() {
  const s = getCustodySchedule();
  if (s.enabled) applyCustodyColors(s);
})();

// Cache for AI conflict suggestions keyed by "cardAId|cardBId"
const _conflictSuggestionCache = {};

async function _fetchConflictSuggestion(idA, idB) {
  const key = `${idA}|${idB}`;
  if (_conflictSuggestionCache[key] !== undefined) return; // already fetched or in flight
  _conflictSuggestionCache[key] = null; // mark as in-flight to prevent duplicate calls
  try {
    const cardA = typeof state !== "undefined" ? state.cards.find((c) => c.id === idA) : null;
    const cardB = typeof state !== "undefined" ? state.cards.find((c) => c.id === idB) : null;
    if (!cardA || !cardB) return;
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await window.getAuthHeader()) },
      body: JSON.stringify({ action: "suggest-resolution", cardA, cardB }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.suggestion) {
      _conflictSuggestionCache[key] = data.suggestion;
      // Update the suggestion span in the DOM without full re-render
      const el = document.getElementById(`conflict-suggestion-${idA}-${idB}`);
      if (el) el.textContent = data.suggestion;
    }
  } catch {
    // Silently fail - conflict banner still works without AI suggestion
  }
}
const defaultShoppingLists = {
  groceries: [
    { id: "grocery-shoes", label: "Sports shoes (size 34)", bought: false },
    { id: "grocery-pencils", label: "School pencils and ruler", bought: false },
    { id: "grocery-medicine", label: "Allergy medicine refill", bought: false },
  ],
  other: [
    { id: "other-socks", label: "Football socks", bought: false },
    { id: "other-book", label: "Reading book for school", bought: false },
  ],
};
const calendarState = {
  view: "month",
  cursor: new Date(today.getFullYear(), today.getMonth(), 1),
  selected: toCalendarKey(today),
  events: buildCalendarEvents(today),
  rightPanel: "agenda", // "agenda" | "schedule" | "changes" | "vacations"
};

// ---- Inline panel states (persist across renderCalendarFeature re-renders) ----
let _panelSchedState = null;
function _getSchedPanelState() {
  if (!_panelSchedState) {
    const cs = getCustodySchedule();
    _panelSchedState = {
      viewYear: new Date().getFullYear(),
      viewMonth: new Date().getMonth(),
      selectedDays: new Set(),
      working: { ...cs, overrides: { ...(cs.overrides || {}) } },
      changedDays: {},
    };
  }
  return _panelSchedState;
}
function _resetSchedPanelState() { _panelSchedState = null; }

const _panelVacState = {
  editingId: null,
  rangeStart: null,
  rangeEnd: null,
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  weekStart: parseInt(localStorage.getItem("do-do-week-start") || "1"),
  _editLoaded: false,
};

const featureData = {
  calendar: {
    eyebrow: "Calendar and scheduling",
    title: "Shared schedule with conflict visibility",
    summary: "Bidirectional sync is represented as a connection state, with rich event previews, reminders, recurring custody patterns, and inline conflicts.",
    actions: ["Create custody event", "Show conflict", "Send RSVP preview"],
    stats: [
      ["Google sync", "Connected"],
      ["Apple sync", "Pending"],
      ["Conflicts", "2"],
      ["Reminders", "5 max"],
    ],
    sections: [
      {
        title: "Upcoming schedule",
        items: [
          ["Parent-teacher meeting", "School · May 20, 16:00 · both parents invited"],
          ["Custody exchange", "Schedule · 2-2-3 pattern · location attached"],
          ["Allergy follow-up", "Medical · reminder stack: 1 week, 3 days, 1 day, 2 hours"],
        ],
      },
      {
        title: "Inline conflicts",
        items: [
          ["Soccer practice overlaps dentist appointment", "Both events shown directly in the alert with owners and locations."],
          ["Pickup swap request still waiting", "Parent B has not acknowledged the new pickup time."],
        ],
      },
    ],
  },
  messages: {
    eyebrow: "Messages",
    title: "Topic threads",
    summary: "Threaded communication around schedule, school, medical, expenses, and general coordination.",
    actions: ["New message", "Pin thread"],
    stats: [
      ["Unread", "4"],
      ["Pinned", "2"],
      ["Needs reply", "3"],
      ["Topics", "5"],
    ],
    sections: [
      {
        title: "Recent threads",
        items: [
          ["Schedule", "Pickup swap request needs a reply before 13:00."],
          ["School", "Parent-teacher meeting details and attendance confirmation."],
          ["Expenses", "Dentist invoice reimbursement acknowledged."],
          ["Medical", "Allergy medication dosage update marked as info only."],
        ],
      },
      {
        title: "Message tools",
        items: [
          ["Acknowledgements", "Use quick replies to close low-stakes messages without a full response."],
          ["Context forwarding", "Forwarded messages keep the original card and thread context."],
          ["Search", "Filter by topic, sender, date, attachment, and keyword."],
        ],
      },
    ],
  },
  notifications: {
    eyebrow: "Notifications",
    title: "Rich alerts that carry the actual content",
    summary: "Notification behavior is shown as preview cards with direct actions, grouped threads, quiet hours, and SMS escalation.",
    actions: ["Preview push", "Approve from notification", "Escalate unread"],
    stats: [
      ["Unread", "6"],
      ["Badge", "On"],
      ["Quiet hours", "21:00-07:00"],
      ["SMS fallback", "3h"],
    ],
    sections: [
      {
        title: "Actionable previews",
        items: [
          ["Schedule request", "Friday pickup changed to 15:10. Buttons: Acknowledge, Request change."],
          ["Expense approval", "School shoes CHF 72.40. Buttons: Approve, Dispute."],
          ["Safety override", "SOS alerts bypass quiet hours and trigger SMS fallback."],
        ],
      },
    ],
  },
  performance: {
    eyebrow: "Performance and access",
    title: "Instant reopen with persistent session",
    summary: "This screen models the non-negotiable experience requirements: last view memory, offline read access, biometric reopen, background sync, and no splash-screen delay.",
    actions: ["Simulate cold open", "Go offline", "Restore last view"],
    stats: [
      ["Open target", "<1s"],
      ["Session", "Persistent"],
      ["Offline cache", "Ready"],
      ["Last sync", "Just now"],
    ],
    sections: [
      {
        title: "Open-state checks",
        items: [
          ["Last active view", "Returns to the same topic, scroll position, and selected card."],
          ["Biometric unlock", "First tap uses Face ID or device biometric; no daily password loop."],
          ["Background sync", "Main view has current cards before the user opens the app."],
          ["Offline read mode", "Messages, cards, calendar, and files remain readable without network."],
        ],
      },
      {
        title: "Never show",
        items: [
          ["Splash screen", "Avoids animation-heavy startup when the user has urgent coordination work."],
          ["Blank calendar", "Skeleton states appear during fetches instead of a frozen white screen."],
          ["Forced logout", "The app logs out only when explicitly requested."],
        ],
      },
    ],
  },
  controls: {
    eyebrow: "Parental controls",
    title: "Child screen-time controls with agency",
    summary: "This models the parent and child-side workflow: granular budgets, always-allowed apps, extension requests, rewards, and uninstall protection.",
    actions: ["Approve 30 min", "Lock device", "Add app exception"],
    stats: [
      ["Today used", "1h 45m"],
      ["Budget left", "45m"],
      ["Allowed apps", "7"],
      ["Pending requests", "1"],
    ],
    sections: [
      {
        title: "Profiles",
        items: [
          ["School day", "08:20-14:40 lockdown with Classroom, camera, calculator, and calls allowed."],
          ["Weekend", "Two-hour entertainment budget with 15-minute granularity."],
          ["Holiday", "Separate schedule so school rules do not leak into breaks."],
        ],
      },
      {
        title: "Child request",
        items: [
          ["Minecraft extension", "Child asks for 30 minutes. Parent can approve from notification."],
          ["Chore reward", "Empty dishwasher unlocks 20 minutes after parent marks done."],
        ],
      },
    ],
  },
  safety: {
    eyebrow: "Content monitoring and safety",
    title: "Context-rich safety alerts",
    summary: "Alerts include surrounding context, severity, custom keywords, false-positive learning, and a child SOS pathway.",
    actions: ["Mark not concern", "Open thread context", "Trigger SOS demo"],
    stats: [
      ["Urgent", "1"],
      ["Watch", "3"],
      ["Keywords", "14"],
      ["Wellbeing", "Stable"],
    ],
    sections: [
      {
        title: "Alert queue",
        items: [
          ["Urgent self-harm phrase", "Shows five messages before and after the flagged content."],
          ["New app install", "Lists app name, category, age rating, and install time."],
          ["Location SOS", "Bypasses quiet hours and sends location plus call prompt."],
        ],
      },
    ],
  },
  files: {
    eyebrow: "Documents and records",
    title: "Shared and private record vault",
    summary: "This includes previews, export, version history, private sharing, and a mock authentication code for legal-record testing.",
    actions: ["Preview PDF", "Create export", "Share with attorney"],
    stats: [
      ["Shared files", "12"],
      ["Private files", "4"],
      ["Exports", "2"],
      ["Retention", "30 days"],
    ],
    sections: [
      {
        title: "Vault",
        items: [
          ["Insurance card", "Shared · preview available · version 3"],
          ["School medical form", "Shared · signed copy · export-ready"],
          ["Attorney packet", "Private · expiring link · read-only access"],
        ],
      },
    ],
  },
  payments: {
    eyebrow: "Payments and expenses",
    title: "Reimbursement workflow with records",
    summary: "Expenses are tied to custody periods and move through submit, approve, dispute, and paid states with receipts.",
    actions: ["Submit expense", "Approve payment", "Dispute with comment"],
    stats: [
      ["Pending", "CHF 158.90"],
      ["Approved", "CHF 86.50"],
      ["Settlement", "Next day"],
      ["Receipts", "8"],
    ],
    sections: [
      {
        title: "Expense queue",
        items: [
          ["School shoes", "CHF 72.40 · clothing · waiting for approval"],
          ["Dentist invoice", "CHF 86.50 · medical · approved"],
          ["Camp deposit", "CHF 120.00 · school · disputed with comment"],
        ],
      },
    ],
  },
  shopping: {
    eyebrow: "Shopping list",
    title: "Shared shopping list",
    summary: "A later workflow for turning cards into buyable household items, with owners, children, stores, and expense handoff.",
    actions: ["Add item", "Assign buyer", "Convert to expense"],
    stats: [
      ["Open items", "7"],
      ["Needed today", "3"],
      ["Assigned", "5"],
      ["Estimated", "CHF 64"],
    ],
    sections: [
      {
        title: "Needed soon",
        items: [
          ["Ava: allergy-safe snacks", "Groceries · needed for school trip · Parent B"],
          ["Leo: football socks", "Sports · before Saturday practice · Parent A"],
          ["Shared: dishwasher tabs", "Household · either parent can pick up"],
        ],
      },
      {
        title: "Later behavior",
        items: [
          ["From card", "A task can create a shopping item without retyping."],
          ["Receipt handoff", "Bought items can become an expense with receipt photo."],
          ["Store grouping", "Items can be grouped by pharmacy, grocery, school, or sports shop."],
        ],
      },
    ],
  },
  przekazanie: {
    eyebrow: "Przekazanie",
    title: "Przekazanie dziecka",
    summary: "Checklist rzeczy, notatka zdrowotna i przypomnienia przy zmianie opieki.",
    actions: [],
    stats: [],
    sections: [],
  },
  expenses: {
    eyebrow: "Expenses",
    title: "Shared expenses",
    summary: "Expense Dos stay in the same family workflow as schedule changes and messages.",
    actions: ["Add expense"],
    stats: [
      ["Total", "From cards"],
      ["Open", "From cards"],
      ["Paid", "From cards"],
    ],
    sections: [],
  },
  settings: {
    eyebrow: "Settings",
    title: "Automation, family members, and pets",
    summary: "Global defaults for card reminders and calendar handoff, plus later settings for children, pets, custody details, and pet vaccine schedules.",
    actions: ["Add child", "Add pet", "Add vaccine"],
    stats: [
      ["Children", "2"],
      ["Pets", "1"],
      ["Auto reminders", "On"],
      ["Google Calendar", "Optional"],
    ],
    sections: [
      {
        title: "Children",
        items: [
          ["Ava", "Age 9 · school calendar · allergy notes attached"],
          ["Leo", "Age 7 · football schedule · pickup permissions"],
        ],
      },
      {
        title: "Pets",
        items: [
          ["Milo", "Dog · vet: Zurich Animal Clinic · insurance ID saved"],
          ["Pet care ownership", "Food, walks, vet records, and vaccine reminders can become cards."],
        ],
      },
    ],
  },
  roles: {
    eyebrow: "Roles and permissions",
    title: "Granular access for the whole family system",
    summary: "Role controls are modeled across parents, children, caregivers, attorneys, and mediators with an audit trail.",
    actions: ["Invite attorney", "Change child role", "View audit log"],
    stats: [
      ["Roles", "7"],
      ["Audit events", "18"],
      ["External viewers", "2"],
      ["Child tier", "Under 13"],
    ],
    sections: [
      {
        title: "Permission matrix",
        items: [
          ["Primary Parent", "Admin for cards, calendar, controls, files, billing."],
          ["Co-Parent", "Comment and edit shared areas, no private vault access."],
          ["Attorney", "Read-only shared record, no direct messaging."],
          ["Child", "Age-appropriate calendar, chores, and screen-time balance."],
        ],
      },
    ],
  },
  pricing: {
    eyebrow: "Pricing and billing",
    title: "Transparent pricing",
    summary: "This models a simple billing page with flat pricing, free trial, annual discount, waiver path, and data portability.",
    actions: ["Start trial", "Apply waiver", "Export before cancel"],
    stats: [
      ["Trial", "30 days"],
      ["Members", "Both parents"],
      ["Annual discount", "20%"],
      ["Export window", "60 days"],
    ],
    sections: [
      {
        title: "Plan rules",
        items: [
          ["Standard plan", "One price covers both parents, children, and approved helpers."],
          ["Court-mandated waiver", "Accessible from billing, no hidden support ticket."],
          ["Cancellation", "Immediate effect with export window before deletion."],
        ],
      },
    ],
  },
  support: {
    eyebrow: "Customer support",
    title: "Support thread inside the product",
    summary: "The support prototype keeps issues in an in-app thread, tracks status, and exposes known incidents.",
    actions: ["Open support case", "Mark bug known", "Recover account"],
    stats: [
      ["First response", "<4h"],
      ["Open cases", "2"],
      ["Known issues", "1"],
      ["Recovery", "Self-serve"],
    ],
    sections: [
      {
        title: "Support queue",
        items: [
          ["Calendar sync delay", "Known issue · fix ETA posted · users notified."],
          ["Locked out after phone change", "Identity verification flow available without waiting for agent."],
          ["Export question", "Support thread includes status, owner, and next step."],
        ],
      },
    ],
  },
  integrations: {
    eyebrow: "External integrations",
    title: "Connection center",
    summary: "The integration screen prioritizes P0 and P1 connections while keeping unbuilt integrations visibly out of the critical path.",
    actions: ["Connect Google", "Connect Stripe", "Send SMS test"],
    stats: [
      ["P0 connected", "2/3"],
      ["P1 queued", "7"],
      ["Failed syncs", "0"],
      ["Last sync", "Just now"],
    ],
    sections: [
      {
        title: "Priority integrations",
        items: [
          ["Google Calendar", "P0 · connected · bidirectional sync mocked"],
          ["Apple Calendar", "P0 · pending CalDAV auth"],
          ["Stripe", "P0 · sandbox ready"],
          ["Twilio", "P1 · SMS fallback configured"],
          ["Google Classroom", "P1 · assignment import planned"],
        ],
      },
    ],
  },
};

const moduleLinks = document.querySelectorAll("[data-module]");
const cardsModule = document.querySelector("#cardsModule");
const featureModule = document.querySelector("#featureModule");
const topbarEyebrow = document.querySelector(".topbar .eyebrow");
const topbarTitle = document.querySelector(".topbar h1");
const topbarActions = document.querySelector(".topbar-actions");

document.body.dataset.featuresReady = "true";

moduleLinks.forEach((button) => {
  button.addEventListener("click", () => {
    window.switchModule(button.dataset.module);
    document.body.classList.remove("show-mobile-menu");
  });
});

function switchModule(moduleName) {
  moduleLinks.forEach((button) => button.classList.toggle("active", button.dataset.module === moduleName));
  window.setMobileActive?.(moduleName);

  const topbar = document.querySelector(".topbar");

  if (moduleName === "board") {
    cardsModule.classList.remove("hidden");
    cardsModule.classList.remove("cards-content-hidden");
    featureModule.classList.add("hidden");
    topbarEyebrow.textContent = "";
    topbarTitle.textContent = "";
    if (topbar) topbar.style.display = "none"; // no title needed on board
    topbarActions?.classList.remove("hidden");
    return;
  }

  const data = featureData[moduleName];
  cardsModule.classList.remove("hidden");
  cardsModule.classList.add("cards-content-hidden");
  featureModule.classList.remove("hidden");
  topbarEyebrow.textContent = window.t?.("nav." + moduleName) ?? data.eyebrow;
  topbarTitle.textContent = window.t?.("module.title." + moduleName) ?? data.title;
  if (topbar) topbar.style.display = ""; // restore for modules that need a title
  topbarActions?.classList.add("hidden");
  renderFeature(moduleName, data);
}

window.switchModule = switchModule;

// --- Hash-based routing ---
const VALID_MODULES = ["board", "calendar", "shopping", "expenses", "przekazanie", "settings"];

const _origSwitchModule = switchModule;
window.switchModule = function(moduleName) {
  _origSwitchModule(moduleName);
  const hash = "#" + moduleName;
  if (location.hash !== hash) history.pushState(null, "", hash);
  localStorage.setItem("do-do-last-module", moduleName);
  try { sessionStorage.setItem("do-do-current-module", moduleName); } catch (_) {}

  // SEG-21: fire contextual guides on first visit to each module
  // Guard: skip if a guide is already running (prevents guide-internal navigation from resetting the guide)
  if (window.GuideEngine && !window.GuideEngine.isActive()) {
    const G = window.GuideEngine;
    if (moduleName === "calendar" && !G.isDone("setup-schedule"))                                    setTimeout(() => G.show("setup-schedule"),   400);
    if (moduleName === "shopping" && !G.isDone("shopping"))                                          setTimeout(() => G.show("shopping"),         400);
    if (moduleName === "settings" && G.isDone("setup-children") && !G.isDone("calendar-connect"))    setTimeout(() => G.show("calendar-connect"), 400);
  }
};

function routeFromHash() {
  const module = location.hash.replace("#", "").toLowerCase();
  if (VALID_MODULES.includes(module)) {
    _origSwitchModule(module);
    try { sessionStorage.setItem("do-do-current-module", module); } catch (_) {}
  }
}

window.addEventListener("popstate", routeFromHash);

// Apply hash on first load once the app is ready
document.addEventListener("DOMContentLoaded", () => {
  if (location.hash) routeFromHash();
});

function renderFeature(moduleName, data) {
  if (moduleName === "calendar") {
    renderCalendarFeature(data);
    return;
  }

  if (moduleName === "messages") {
    renderMessagesFeature();
    return;
  }

  if (moduleName === "expenses") {
    renderExpensesFeature();
    return;
  }

  if (moduleName === "shopping") {
    renderShoppingFeature();
    return;
  }

  if (moduleName === "settings") {
    renderSettingsFeature();
    return;
  }

  if (moduleName === "przekazanie") {
    renderPrzekazanieFeature();
    return;
  }

  const _pContainer = container || featureModule;
  _pContainer.innerHTML = `
    <div class="feature-actions module-actions">
      ${data.actions.map((action) => `<button class="secondary-button feature-action" data-action="${action}">${action}</button>`).join("")}
    </div>
    <div class="feature-stat-grid">
      ${data.stats.map(([label, value]) => `
        <div class="feature-stat">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `).join("")}
    </div>
    <div class="feature-layout">
      ${data.sections.map((section) => `
        <section class="feature-panel">
          <h3>${section.title}</h3>
          <div class="feature-items">
            ${section.items.map(([title, detail]) => `
              <article class="feature-item">
                <strong>${title}</strong>
                <span>${detail}</span>
              </article>
            `).join("")}
          </div>
        </section>
      `).join("")}
      ${renderSpecialPanel(moduleName)}
    </div>
  `;

  featureModule.querySelectorAll(".feature-action").forEach((button) => {
    const action = button.dataset.action;
    if (action === "Add child") {
      button.addEventListener("click", () => promptAddChild());
    } else if (action === "Add pet") {
      button.addEventListener("click", () => promptAddPet());
    } else if (action === "Connect Shared Calendar") {
      button.addEventListener("click", () => window.requestGoogleCalendarAccess?.());
    } else {
      button.addEventListener("click", () => {
        window.appStorage?.setItem(`kinship-${moduleName}-${action}`, "clicked");
        showFeatureToast(`${action} simulated`);
      });
    }
  });

  featureModule.querySelectorAll("[data-toggle-integration]").forEach((button) => {
    button.addEventListener("click", () => {
      const isConnected = button.dataset.connected === "true";
      button.dataset.connected = String(!isConnected);
      button.textContent = isConnected ? "Connect" : "Connected";
      button.classList.toggle("connected", !isConnected);
      showFeatureToast(isConnected ? "Integration disconnected" : "Integration connected");
    });
  });
}

// ─── Divorced mode helpers ────────────────────────────────────────────────────

function isDivorced() {
  return localStorage.getItem("do-do-divorced-v1") === "true";
}
function setDivorced(val) {
  localStorage.setItem("do-do-divorced-v1", String(Boolean(val)));
}

// ─── Parenting schedule dialog - full month editor ────────────────────────────

function openCustodyScheduleDialog() {
  document.getElementById("scheduleEditorDialog")?.remove();
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";
  const myName = setup.parents?.primary || "Parent A";
  const divorced = isDivorced();
  const cs = getCustodySchedule();

  const dlgState = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    selectedDays: new Set(),
    working: { ...cs, overrides: { ...(cs.overrides || {}) } },
    changedDays: {}, // tracks per-day changes for divorced approval
  };

  const dialog = document.createElement("dialog");
  dialog.id = "scheduleEditorDialog";
  dialog.className = "card-dialog custody-schedule-dialog sched-editor-dialog";
  document.body.appendChild(dialog);

  const _loc0 = _getDateLocale();
  const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(_loc0, { month: "long" }));

  function getWorkingOwner(dateStr) {
    const ov = (dlgState.working.overrides || {})[dateStr];
    if (ov === "mine") return "mine";
    if (ov === "co") return "co";
    if (ov && ov.type === "split") return "split";
    const d = parseCalendarKey(dateStr);
    if (!dlgState.working.referenceDate) return null;
    const ref = new Date(dlgState.working.referenceDate + "T00:00:00");
    const diff = Math.round((d - ref) / 86400000);
    const t = dlgState.working.type || "7-7";
    if (t === "7-7") return ((Math.floor(diff / 7) % 2) + 2) % 2 === 0 ? "mine" : "co";
    if (t === "2-2-3") { const p = ((diff % 14) + 14) % 14; return p <= 1 ? "mine" : p <= 3 ? "co" : "mine"; }
    if (t === "5-2") { const dow = d.getDay(); return (dow === 0 || dow === 6) ? "co" : "mine"; }
    return null;
  }

  function buildMonthCalHTML() {
    const { viewYear, viewMonth, selectedDays } = dlgState;
    const ws = parseInt(localStorage.getItem("do-do-week-start") || "1");
    const _loc1 = _getDateLocale();
    const headers = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2000, 0, 2 + (i + ws) % 7);
      return d.toLocaleDateString(_loc1, { weekday: "narrow" });
    });
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDow = (firstDay.getDay() - ws + 7) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayStr = toCalendarKey(new Date());
    let rows = "";
    let dayNum = 1;
    for (let r = 0; r < 6; r++) {
      rows += "<tr>";
      for (let c = 0; c < 7; c++) {
        const ci = r * 7 + c;
        if (ci < startDow || dayNum > daysInMonth) { rows += "<td></td>"; continue; }
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
        const owner = getWorkingOwner(dateStr);
        const ov = (dlgState.working.overrides || {})[dateStr];
        const isSplit = ov && ov.type === "split";
        const splitCoFirst = isSplit && ov.morning === "co";
        let cls = "sched-day-btn";
        if (owner === "mine") cls += " sched-mine";
        else if (owner === "co") cls += " sched-co";
        else if (owner === "split") cls += " sched-split" + (splitCoFirst ? " sched-split-co-first" : "");
        if (selectedDays.has(dateStr)) cls += " sched-selected";
        if (dateStr === todayStr) cls += " sched-today";
        if (ov) cls += " sched-override";
        if (divorced && dateStr in dlgState.changedDays) cls += " sched-pending";
        rows += `<td><button class="${cls}" type="button" data-sched-date="${dateStr}">${dayNum}${isSplit ? '<span class="sched-split-dot">&#8596;</span>' : ""}</button></td>`;
        dayNum++;
      }
      rows += "</tr>";
      if (dayNum > daysInMonth) break;
    }
    const selCount = selectedDays.size;
    const selHint = selCount > 0 ? `<span class="sched-sel-count">${selCount} day${selCount > 1 ? "s" : ""} selected${selCount > 1 ? " - tap chip to set all" : ""}</span>` : "";
    return `
      <div class="sched-month-cal">
        <div class="mc-header">
          <button class="mc-nav" type="button" id="schedCalPrev">&#8249;</button>
          <span class="mc-month-label">${MONTH_NAMES[viewMonth]} ${viewYear}</span>
          <button class="mc-nav" type="button" id="schedCalNext">&#8250;</button>
        </div>
        <table class="sched-cal-table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${selHint}
      </div>`;
  }

  function buildDayPanel() {
    const { selectedDays } = dlgState;
    if (selectedDays.size === 0) return `<p class="sched-day-hint">Tap a day to set who has the children. Tap multiple days to assign them all at once.</p>`;

    let dayLabel, showSplit = false, splitTime = "12:00", splitMorning = "mine";
    if (selectedDays.size === 1) {
      const dateStr = [...selectedDays][0];
      const d = parseCalendarKey(dateStr);
      dayLabel = d.toLocaleDateString(_getDateLocale(), { weekday: "long", day: "numeric", month: "short" });
      const ov = (dlgState.working.overrides || {})[dateStr];
      showSplit = ov && ov.type === "split";
      if (showSplit) { splitTime = ov.time || "12:00"; splitMorning = ov.morning || "mine"; }
    } else {
      dayLabel = `${selectedDays.size} days selected`;
    }

    // Determine shared owner (active chip) only if all selected days agree
    const owners = [...selectedDays].map(ds => getWorkingOwner(ds));
    const allSame = owners.every(o => o === owners[0]);
    const sharedOwner = allSame ? owners[0] : null;

    return `
      <div class="sched-day-panel">
        <div class="sched-day-label">
          ${dayLabel}
          ${selectedDays.size > 1 ? `<button class="sched-clear-sel" type="button" id="clearSelBtn">Clear selection</button>` : ""}
        </div>
        <div class="sched-day-chips">
          <button class="custody-chip${sharedOwner === "mine" ? " active" : ""}" type="button" data-set-owner="mine">${myName}</button>
          <button class="custody-chip${sharedOwner === "co" ? " active" : ""}" type="button" data-set-owner="co">${coparentName}</button>
          <button class="custody-chip${sharedOwner === "split" ? " active" : ""}" type="button" data-set-owner="split">Split &#8596;</button>
          <button class="custody-chip custody-chip-secondary" type="button" data-set-owner="auto">Auto</button>
        </div>
        ${showSplit ? `
          <div class="sched-handover-panel">
            <label class="sched-handover-field"><span>Handover time</span><input type="time" id="splitTimeInput" value="${splitTime}" /></label>
            <label class="sched-handover-field"><span>Morning with</span>
              <select id="splitMorningSelect">
                <option value="mine"${splitMorning === "mine" ? " selected" : ""}>${myName}</option>
                <option value="co"${splitMorning === "co" ? " selected" : ""}>${coparentName}</option>
              </select>
            </label>
          </div>` : ""}
      </div>`;
  }

  function buildSwatchRow(target, label) {
    return `
      <div class="custody-dialog-swatch-row">
        <span class="custody-dialog-swatch-label">${label}</span>
        <div class="custody-color-swatches" data-custody-target="${target}">
          ${CUSTODY_COLORS.map(c => `<button type="button" class="custody-swatch${dlgState.working[target] === c.value ? " active" : ""}" data-custody-color="${c.value}" style="background:${c.value};" title="${c.label}" aria-label="${c.label}"></button>`).join("")}
        </div>
      </div>`;
  }

  function buildPendingSection() {
    const entries = Object.entries(dlgState.changedDays);
    if (!entries.length) return "";
    const items = entries.map(([dateStr, ch]) => {
      const label = ch.owner === "mine" ? myName : ch.owner === "co" ? coparentName : ch.owner === "split" ? "Split day" : "Auto";
      return `<li>${dateStr}: <strong>${label}</strong></li>`;
    }).join("");
    return `
      <div class="sched-pending-section">
        <strong>Proposed changes (${entries.length})</strong>
        <ul class="sched-pending-list">${items}</ul>
        <button class="custody-chip custody-chip-reset" type="button" id="clearPendingBtn" style="margin-top:6px;font-size:11px;">Clear all</button>
      </div>`;
  }

  function setDayOwner(dateStr, owner) {
    const origOv = getCustodySchedule().overrides?.[dateStr];
    if (owner === "auto") delete dlgState.working.overrides[dateStr];
    else dlgState.working.overrides[dateStr] = owner;
    dlgState.changedDays[dateStr] = { owner, prevOverride: origOv || null };
  }

  function flushSplitInputs() {
    const timeEl = dialog.querySelector("#splitTimeInput");
    const morningEl = dialog.querySelector("#splitMorningSelect");
    if (dlgState.selectedDays.size === 1 && timeEl) {
      const dateStr = [...dlgState.selectedDays][0];
      const ov = dlgState.working.overrides[dateStr];
      if (ov && ov.type === "split") {
        dlgState.working.overrides[dateStr] = { ...ov, time: timeEl.value, morning: morningEl?.value || ov.morning };
        dlgState.changedDays[dateStr] = { owner: "split", prevOverride: getCustodySchedule().overrides?.[dateStr] || null };
      }
    }
  }

  function render() {
    const _t = window.t || ((k, fb) => fb || k);
    const hasPending = divorced && Object.keys(dlgState.changedDays).length > 0;
    dialog.innerHTML = `
      <div class="dialog-content sched-editor-content">
        <div class="dialog-header">
          <div><p class="eyebrow">${_t("nav.calendar", "Calendar")}</p><h2>${_t("custody.heading", "Parenting schedule")}</h2></div>
          <button class="icon-button" type="button" id="closeSchedBtn" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="custody-dialog-body sched-dialog-body">
          <div class="custody-dialog-fields" style="margin-bottom:10px;">
            <label class="clean-field custody-dialog-field">
              <span>${_t("sched.pattern", "Schedule pattern")}</span>
              <select id="schedType">
                <option value="7-7"${dlgState.working.type === "7-7" ? " selected" : ""}>${_t("custody.7_7", "Alternating weeks (7-7)")}</option>
                <option value="2-2-3"${dlgState.working.type === "2-2-3" ? " selected" : ""}>${_t("custody.2_2_3", "2-2-3 rotation")}</option>
                <option value="5-2"${dlgState.working.type === "5-2" ? " selected" : ""}>${_t("custody.5_2", "Weekdays / weekends split")}</option>
                <option value="manual"${dlgState.working.type === "manual" ? " selected" : ""}>${_t("sched.manual", "Manual (set each day)")}</option>
              </select>
            </label>
            <label class="clean-field custody-dialog-field" id="schedRefRow"${(dlgState.working.type === "5-2" || dlgState.working.type === "manual") ? ' style="display:none"' : ""}>
              <span>${_t("sched.my_starts", "My schedule starts")}</span>
              <input type="date" id="schedRefDate" value="${dlgState.working.referenceDate || toCalendarKey(new Date())}" />
            </label>
            ${buildSwatchRow("myColor", _t("sched.my_days_hint", "My days colour (your view only)"))}
            ${buildSwatchRow("coColor", _t("sched.co_days_hint", "Co-parent days colour (your view only)"))}
          </div>
          ${buildMonthCalHTML()}
          <div id="schedDayPanel">${buildDayPanel()}</div>
          ${divorced ? `<div class="sched-divorced-notice">${_t("sched.divorced_notice", "Separated/divorced mode - schedule changes are sent to {{name}} for approval and stored for court records.").replace("{{name}}", coparentName)}</div>` : ""}
          ${divorced ? buildPendingSection() : ""}
          <div class="sched-propagate-section">
            <span class="sched-propagate-label">${_t("sched.propagate", "Propagate (applies after save):")}</span>
            <div class="sched-propagate-chips">
              <button class="custody-chip" type="button" data-propagate="this-week-all">${_t("sched.this_week_all", "This week - all weeks")}</button>
              <button class="custody-chip" type="button" data-propagate="3">${_t("sched.3mo", "Next 3 months")}</button>
              <button class="custody-chip" type="button" data-propagate="6">${_t("sched.6mo", "Next 6 months")}</button>
              <button class="custody-chip" type="button" data-propagate="12">${_t("sched.full_year", "Full year")}</button>
            </div>
          </div>
          <div style="margin-top:10px;">
            <button class="ghost-button sched-clear-schedule-btn" type="button" id="clearScheduleBtn">${_t("sched.clear", "Clear entire schedule")}${divorced ? " " + _t("sched.requires_approval", "(requires approval)") : ""}</button>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="ghost-button" type="button" id="cancelSchedBtn">${_t("card.cancel", "Cancel")}</button>
          <button class="primary-button" type="button" id="saveSchedBtn">${hasPending ? _t("sched.request_changes", "Request changes") : _t("sched.save", "Save schedule")}</button>
        </div>
      </div>`;
    bindEvents();
  }

  function bindEvents() {
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.querySelector("#closeSchedBtn").addEventListener("click", close);
    dialog.querySelector("#cancelSchedBtn").addEventListener("click", close);
    dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });

    dialog.querySelector("#schedCalPrev").addEventListener("click", () => {
      flushSplitInputs();
      dlgState.selectedDays.clear();
      dlgState.viewMonth--;
      if (dlgState.viewMonth < 0) { dlgState.viewMonth = 11; dlgState.viewYear--; }
      render();
    });
    dialog.querySelector("#schedCalNext").addEventListener("click", () => {
      flushSplitInputs();
      dlgState.selectedDays.clear();
      dlgState.viewMonth++;
      if (dlgState.viewMonth > 11) { dlgState.viewMonth = 0; dlgState.viewYear++; }
      render();
    });

    dialog.querySelectorAll("[data-sched-date]").forEach(btn => {
      btn.addEventListener("click", () => {
        flushSplitInputs();
        const dateStr = btn.dataset.schedDate;
        if (dlgState.selectedDays.has(dateStr)) {
          dlgState.selectedDays.delete(dateStr);
        } else {
          dlgState.selectedDays.add(dateStr);
        }
        render();
      });
    });

    dialog.querySelectorAll("[data-set-owner]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (dlgState.selectedDays.size === 0) return;
        const owner = btn.dataset.setOwner;
        dlgState.selectedDays.forEach(dateStr => {
          if (owner === "split") {
            const prev = dlgState.working.overrides[dateStr];
            dlgState.working.overrides[dateStr] = { type: "split", time: (prev && prev.time) || "12:00", morning: (prev && prev.morning) || "mine" };
            dlgState.changedDays[dateStr] = { owner: "split", prevOverride: getCustodySchedule().overrides?.[dateStr] || null };
          } else {
            setDayOwner(dateStr, owner);
          }
        });
        render();
      });
    });

    dialog.querySelector("#clearSelBtn")?.addEventListener("click", () => {
      flushSplitInputs();
      dlgState.selectedDays.clear();
      render();
    });

    dialog.querySelector("#splitMorningSelect")?.addEventListener("change", (e) => {
      if (dlgState.selectedDays.size !== 1) return;
      const dateStr = [...dlgState.selectedDays][0];
      const ov = dlgState.working.overrides[dateStr] || { type: "split", time: "12:00" };
      dlgState.working.overrides[dateStr] = { ...ov, morning: e.target.value };
    });

    dialog.querySelector("#schedType")?.addEventListener("change", (e) => {
      dlgState.working.type = e.target.value;
      const refRow = dialog.querySelector("#schedRefRow");
      if (refRow) refRow.style.display = (e.target.value === "5-2" || e.target.value === "manual") ? "none" : "";
      render();
    });

    dialog.querySelector("#schedRefDate")?.addEventListener("change", (e) => { dlgState.working.referenceDate = e.target.value; });
    dialog.querySelector("#schedEnabled")?.addEventListener("change", (e) => { dlgState.working.enabled = e.target.checked; });

    dialog.querySelectorAll(".custody-color-swatches").forEach(group => {
      group.querySelectorAll(".custody-swatch").forEach(btn => {
        btn.addEventListener("click", () => {
          group.querySelectorAll(".custody-swatch").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          dlgState.working[group.dataset.custodyTarget] = btn.dataset.custodyColor;
        });
      });
    });

    dialog.querySelectorAll("[data-propagate]").forEach(btn => {
      btn.addEventListener("click", () => {
        flushSplitInputs();
        // Save current schedule first, then propagate
        const enabled = dialog.querySelector("#schedEnabled")?.checked ?? dlgState.working.enabled;
        const type = dialog.querySelector("#schedType")?.value || dlgState.working.type;
        const referenceDate = dialog.querySelector("#schedRefDate")?.value || dlgState.working.referenceDate;
        const activeColor = (t) => dialog.querySelector(`.custody-color-swatches[data-custody-target="${t}"] .custody-swatch.active`)?.dataset.custodyColor;
        const baseSchedule = { ...dlgState.working, enabled, type, referenceDate,
          myColor: activeColor("myColor") || dlgState.working.myColor,
          coColor: activeColor("coColor") || dlgState.working.coColor,
        };
        saveCustodySchedule(baseSchedule);
        dlgState.working = { ...baseSchedule, overrides: { ...(baseSchedule.overrides || {}) } };

        const action = btn.dataset.propagate;
        if (action === "this-week-all") {
          const ws = parseInt(localStorage.getItem("do-do-week-start") || "1");
          const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date(), ws), i));
          propagateWeekSchedule(weekDays, dlgState.working);
          dlgState.working = { ...dlgState.working, overrides: { ...(getCustodySchedule().overrides || {}) } };
          showFeatureToast("Saved and applied this week's pattern to all weeks");
        } else {
          propagateMonthSchedule(dlgState.viewYear, dlgState.viewMonth, parseInt(action), dlgState.working);
          dlgState.working = { ...dlgState.working, overrides: { ...(getCustodySchedule().overrides || {}) } };
          showFeatureToast(`Saved and applied to next ${action} months`);
        }
        render();
      });
    });

    dialog.querySelector("#clearScheduleBtn")?.addEventListener("click", () => {
      if (!confirm("Clear the entire parenting schedule? This removes all custom day overrides.")) return;
      if (isDivorced()) {
        // Create a change request to clear all overrides
        const existing = loadChangeRequests();
        existing.push({
          id: "cr-sched-clear-" + Date.now(),
          createdAt: new Date().toISOString(),
          type: "schedule-clear",
          requestedDate: toCalendarKey(new Date()),
          requestedOwner: null,
          requestedOverride: null,
          prevOverride: null,
          reason: "Clear entire schedule",
          status: "pending",
        });
        saveChangeRequests(existing);
        showFeatureToast("Clear schedule request sent - awaiting approval");
        dialog.close(); dialog.remove();
      } else {
        dlgState.working.overrides = {};
        dlgState.changedDays = {};
        showFeatureToast("Schedule cleared");
        render();
      }
    });

    dialog.querySelector("#clearPendingBtn")?.addEventListener("click", () => {
      dlgState.changedDays = {};
      dlgState.working.overrides = { ...(getCustodySchedule().overrides || {}) };
      render();
    });

    dialog.querySelector("#saveSchedBtn").addEventListener("click", () => {
      flushSplitInputs();
      const enabled = dialog.querySelector("#schedEnabled")?.checked ?? dlgState.working.enabled;
      const type = dialog.querySelector("#schedType")?.value || dlgState.working.type;
      const referenceDate = dialog.querySelector("#schedRefDate")?.value || dlgState.working.referenceDate;
      const activeColor = (t) => dialog.querySelector(`.custody-color-swatches[data-custody-target="${t}"] .custody-swatch.active`)?.dataset.custodyColor;

      if (divorced && Object.keys(dlgState.changedDays).length > 0) {
        createScheduleChangeRequests(dlgState.changedDays, dlgState.working.overrides);
        dialog.close(); dialog.remove();
        showFeatureToast("Schedule change request sent - awaiting approval");
        if (typeof renderCalendarFeature === "function" && typeof data !== "undefined") renderCalendarFeature(data);
        return;
      }

      const schedule = { ...dlgState.working, enabled, type, referenceDate,
        myColor: activeColor("myColor") || dlgState.working.myColor,
        coColor: activeColor("coColor") || dlgState.working.coColor,
      };
      saveCustodySchedule(schedule);
      dialog.close(); dialog.remove();
      showFeatureToast("Parenting schedule saved");
      if (featureModule && !featureModule.classList.contains("hidden")) {
        const d = window._lastFeatureData;
        if (d) renderCalendarFeature(d);
      }
    });
  }

  dialog.showModal();
  render();
}

// ---- Vacation schedule (overlays normal custody without destroying it) ----

const vacationsStorageKey = "do-do-vacations-v1";

function loadVacations() {
  try { const raw = window.appStorage?.getItem(vacationsStorageKey); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveVacations(vacs) {
  window.appStorage?.setItem(vacationsStorageKey, JSON.stringify(vacs));
}
function getActiveVacation(date) {
  const key = toCalendarKey(date);
  return loadVacations().find((v) => key >= v.startDate && key <= v.endDate) || null;
}
function getVacationOwnerForDate(vac, date) {
  if (vac.owner === "mine" || vac.owner === "co") return vac.owner;
  // Alternating weeks - snap to week boundaries using the stored weekStart preference
  const weekStartDay = parseInt(localStorage.getItem("do-do-week-start") || "1");
  const vacStart = new Date(vac.startDate + "T00:00:00");
  const weekAnchor = startOfWeek(vacStart, weekStartDay);
  const dayDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekIndex = Math.floor((dayDate - weekAnchor) / (7 * 86400000));
  const first = vac.alternatingStart || "mine";
  return weekIndex % 2 === 0 ? first : (first === "mine" ? "co" : "mine");
}

// ---- Change requests ----

const changeRequestsStorageKey = "do-do-change-requests-v1";

function loadChangeRequests() {
  try { const raw = window.appStorage?.getItem(changeRequestsStorageKey); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveChangeRequests(crs) {
  window.appStorage?.setItem(changeRequestsStorageKey, JSON.stringify(crs));
}

// Send an immediate push notification to the co-parent (non-blocking).
async function _notifyPartner(title, body) {
  try {
    const session = (await window.supabaseClient?.auth?.getSession())?.data?.session;
    if (!session?.access_token) return;
    await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "notify-partner", title, body, url: "/#calendar" }),
    });
  } catch { /* non-blocking */ }
}

// Save a unified_card to Supabase representing a schedule change request (non-blocking).
// Returns the card ID so callers can link local CRs to it.
async function _saveScheduleRequestCard({ cardId, title, detailsTag, payload }) {
  if (!window.saveCardToSupabase) return null;
  try {
    const card = {
      id: cardId,
      title,
      type: "Request",
      topic: "Schedule",
      status: "To Do",
      assignee: "",
      child: "",
      due: "",
      details: detailsTag + JSON.stringify(payload),
      comments: [],
      createdAt: Date.now(),
    };
    await window.saveCardToSupabase(card);
    return cardId;
  } catch (e) {
    console.warn("_saveScheduleRequestCard failed:", e);
    return null;
  }
}

// Propagate the current week's per-day overrides to all other weeks in a ~6-year window.
// Maps each day-of-week (0=Sun..6=Sat) to its override from the reference week, then
// applies those overrides to every matching weekday across -156..+156 weeks.
function propagateWeekSchedule(referenceWeekDays, schedule) {
  // Build a map: dayOfWeek (0-6) -> override value (or null to clear)
  const pattern = {};
  referenceWeekDays.forEach((d) => {
    const dow = d.getDay(); // 0=Sun
    const key = toCalendarKey(d);
    const ov = (schedule.overrides || {})[key] || null;
    pattern[dow] = ov;
  });

  const today = new Date();
  const newOverrides = { ...(schedule.overrides || {}) };

  // Apply across 312 weeks (-156 to +156, ~6 years total) so it auto-covers future years
  for (let w = -156; w <= 156; w++) {
    referenceWeekDays.forEach((refDay) => {
      const target = addDays(refDay, w * 7);
      const k = toCalendarKey(target);
      const ov = pattern[refDay.getDay()];
      if (ov) {
        newOverrides[k] = ov;
      } else {
        delete newOverrides[k];
      }
    });
  }

  const updated = { ...schedule, overrides: newOverrides };
  saveCustodySchedule(updated);
}

// Propagate the current month's per-day overrides to the next N months
function propagateMonthSchedule(sourceYear, sourceMonth, numMonths, schedule) {
  const newOverrides = { ...(schedule.overrides || {}) };
  const daysInSource = new Date(sourceYear, sourceMonth + 1, 0).getDate();
  for (let m = 1; m <= numMonths; m++) {
    let ty = sourceYear, tm = sourceMonth + m;
    while (tm > 11) { tm -= 12; ty++; }
    const daysInTarget = new Date(ty, tm + 1, 0).getDate();
    for (let day = 1; day <= Math.min(daysInSource, daysInTarget); day++) {
      const sk = `${sourceYear}-${String(sourceMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const tk = `${ty}-${String(tm + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const ov = (schedule.overrides || {})[sk];
      if (ov) newOverrides[tk] = ov; else delete newOverrides[tk];
    }
  }
  schedule.overrides = newOverrides;
  saveCustodySchedule({ ...schedule });
}

// Create change-request records for a BATCH of day changes (divorced mode).
// ONE local CR per day for the schedule editor's pending-indicator logic,
// but only ONE Supabase card for the whole batch so the co-parent sees a single item.
async function createScheduleChangeRequests(changedDays, workingOverrides) {
  const existing = loadChangeRequests();
  const now = new Date().toISOString();
  const batchCardId = "scr-batch-" + Date.now();
  const dayEntries = Object.entries(changedDays);
  const newCrs = dayEntries.map(([dateStr, change]) => ({
    id: "cr-sched-" + Date.now() + "-" + dateStr.replace(/-/g, ""),
    createdAt: now,
    type: "schedule",
    requestedDate: dateStr,
    requestedOwner: change.owner,
    requestedOverride: workingOverrides[dateStr] || null,
    prevOverride: change.prevOverride || null,
    reason: "",
    status: "pending",
    supabaseCardId: batchCardId,  // link back to the Supabase card
  }));
  saveChangeRequests([...existing, ...newCrs]);

  // ONE Supabase card for the whole batch - co-parent sees this via Realtime
  const earliestDate = dayEntries.map(([d]) => d).sort()[0];
  await _saveScheduleRequestCard({
    cardId: batchCardId,
    title: `Zmiana harmonogramu (${dayEntries.length} ${dayEntries.length === 1 ? "dzien" : "dni"})`,
    detailsTag: "__SCR_BATCH__",
    payload: {
      crIds: newCrs.map((c) => c.id),
      days: Object.fromEntries(
        dayEntries.map(([dateStr, change]) => [
          dateStr,
          {
            owner: change.owner,
            override: workingOverrides[dateStr] || null,
            prev: change.prevOverride || null,
          },
        ])
      ),
    },
  });
  _notifyPartner(
    "Do-Do: wniosek o zmiane harmonogramu",
    `${dayEntries.length} ${dayEntries.length === 1 ? "dzien" : "dni"} do zatwierdzenia`
  );
}

// Create a vacation change-request record (divorced mode).
// ONE local CR + ONE Supabase card per vacation action.
async function createVacationChangeRequest(vacAction, vacData) {
  const existing = loadChangeRequests();
  const cardId = "scr-vac-" + Date.now();
  const cr = {
    id: "cr-vac-" + Date.now(),
    createdAt: new Date().toISOString(),
    type: "vacation",
    vacAction,   // "add" | "update" | "delete"
    vacData,     // full vacation object
    requestedDate: vacData.startDate,
    reason: "",
    status: "pending",
    supabaseCardId: cardId,
  };
  saveChangeRequests([...existing, cr]);

  const actionLabel = vacAction === "add" ? "nowe wakacje" : vacAction === "update" ? "zmiana wakacji" : "usuniecie wakacji";
  await _saveScheduleRequestCard({
    cardId,
    title: `Wniosek urlopowy: ${vacData.startDate || ""} - ${vacData.endDate || ""}`,
    detailsTag: "__SCR_VAC__",
    payload: { crId: cr.id, vacAction, vacData },
  });
  _notifyPartner("Do-Do: wniosek urlopowy", `Propozycja: ${actionLabel} (${vacData.startDate || ""} - ${vacData.endDate || ""})`);
}

// Create a holiday change-request record (divorced mode).
// ONE local CR + ONE Supabase card per holiday action.
async function createHolidayChangeRequest(holAction, holData) {
  const existing = loadChangeRequests();
  const cardId = "scr-hol-" + Date.now();
  const cr = {
    id: "cr-hol-" + Date.now(),
    createdAt: new Date().toISOString(),
    type: "holiday",
    holAction,   // "add" | "update" | "delete"
    holData,     // full holiday object
    requestedDate: holData.startDate,
    reason: "",
    status: "pending",
    supabaseCardId: cardId,
  };
  saveChangeRequests([...existing, cr]);

  const actionLabel = holAction === "add" ? "nowe swieto" : holAction === "update" ? "zmiana swieta" : "usuniecie swieta";
  await _saveScheduleRequestCard({
    cardId,
    title: `Wniosek: ${holData.name || "Swieto"} (${holData.startDate || ""} - ${holData.endDate || ""})`,
    detailsTag: "__SCR_HOL__",
    payload: { crId: cr.id, holAction, holData },
  });
  _notifyPartner("Do-Do: wniosek swiateczny", `Propozycja: ${actionLabel} - ${holData.name || ""} (${holData.startDate || ""} - ${holData.endDate || ""})`);
}

// Initial schedule setup wizard - a focused 2-step dialog separate from the day-editing dialog.
// In divorced mode also sends a __SCR_SETUP__ card so co-parent sees the proposed pattern.
function openScheduleSetupDialog() {
  document.getElementById("scheduleSetupDialog")?.remove();
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";
  const divorced = isDivorced();
  const cs = getCustodySchedule();

  const dialog = document.createElement("dialog");
  dialog.id = "scheduleSetupDialog";
  dialog.className = "card-dialog custody-schedule-dialog sched-editor-dialog";
  document.body.appendChild(dialog);

  let step = 1;
  let setupData = {
    type: cs.type || "7-7",
    referenceDate: cs.referenceDate || toCalendarKey(new Date()),
    myColor: cs.myColor || "blue",
    coColor: cs.coColor || "orange",
  };

  function render() {
    const COLORS = ["blue","green","purple","orange","red","teal","pink","gray"];
    const swatchRow = (key, label) => `
      <label class="clean-field custody-dialog-field">
        <span>${label}</span>
        <div class="custody-color-swatches" data-custody-target="${key}">
          ${COLORS.map((c) => `<button class="custody-swatch${setupData[key] === c ? " active" : ""}" type="button" data-custody-color="${c}" style="background:var(--custody-${c})">&nbsp;</button>`).join("")}
        </div>
      </label>`;

    const _t = window.t || ((k, fb) => fb || k);
    if (step === 1) {
      dialog.innerHTML = `
        <div class="dialog-content sched-editor-content">
          <div class="dialog-header">
            <div><p class="eyebrow">${_t("nav.calendar", "Calendar")}</p><h2>${_t("cal.set_up_schedule", "Set up parenting schedule")}</h2></div>
            <button class="icon-button" type="button" id="closeSetupBtn" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="custody-dialog-body sched-dialog-body">
            <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">${_t("sched.choose_how", "Choose how custody is shared. You can always fine-tune individual days afterward.")}</p>
            <div class="custody-dialog-fields">
              <label class="clean-field custody-dialog-field">
                <span>${_t("sched.pattern", "Schedule pattern")}</span>
                <select id="setupType">
                  <option value="7-7"${setupData.type === "7-7" ? " selected" : ""}>${_t("custody.7_7", "Alternating weeks (7-7)")}</option>
                  <option value="2-2-3"${setupData.type === "2-2-3" ? " selected" : ""}>${_t("custody.2_2_3", "2-2-3 rotation")}</option>
                  <option value="5-2"${setupData.type === "5-2" ? " selected" : ""}>${_t("custody.5_2", "Weekdays / weekends split")}</option>
                  <option value="manual"${setupData.type === "manual" ? " selected" : ""}>${_t("sched.manual", "Manual (set each day)")}</option>
                </select>
              </label>
              <label class="clean-field custody-dialog-field" id="setupRefRow"${(setupData.type === "5-2" || setupData.type === "manual") ? ' style="display:none"' : ""}>
                <span>${_t("sched.my_first_week", "My first week starts on")}</span>
                <input type="date" id="setupRefDate" value="${setupData.referenceDate}" />
              </label>
              ${swatchRow("myColor", _t("sched.your_days", "Your days colour"))}
              ${swatchRow("coColor", `${escapeHtml(coparentName)} - ${_t("sched.co_days", "Co-parent days colour")}`)}
            </div>
            ${divorced ? `<div class="sched-divorced-notice" style="margin-top:12px;">${_t("sched.divorced_setup", "Separated/divorced mode - this setup will be sent to {{name}} for review and stored for records.").replace("{{name}}", escapeHtml(coparentName))}</div>` : ""}
          </div>
          <div class="dialog-actions">
            <button class="ghost-button" type="button" id="cancelSetupBtn">${_t("card.cancel", "Cancel")}</button>
            <button class="primary-button" type="button" id="setupNextBtn">${_t("sched.next_step", "Next: confirm →")}</button>
          </div>
        </div>`;
    } else {
      // Step 2: summary + confirm
      const typeLabel = {
        "7-7": _t("custody.7_7", "Alternating weeks (7-7)"),
        "2-2-3": _t("custody.2_2_3", "2-2-3 rotation"),
        "5-2": _t("custody.5_2", "Weekdays / weekends split"),
        manual: _t("sched.manual", "Manual"),
      }[setupData.type] || setupData.type;
      dialog.innerHTML = `
        <div class="dialog-content sched-editor-content">
          <div class="dialog-header">
            <div><p class="eyebrow">${_t("sched.step2", "Step 2 of 2")}</p><h2>${_t("sched.confirm_heading", "Confirm schedule")}</h2></div>
            <button class="icon-button" type="button" id="closeSetupBtn" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="custody-dialog-body sched-dialog-body">
            <div class="sched-summary-block" style="background:var(--surface-raised);border-radius:10px;padding:14px;margin-bottom:16px;">
              <div style="margin-bottom:8px;font-size:14px;"><strong>${_t("sched.pattern_label", "Pattern:")}</strong> ${typeLabel}</div>
              ${setupData.type !== "5-2" && setupData.type !== "manual" ? `<div style="margin-bottom:8px;font-size:14px;"><strong>${_t("sched.starts_label", "Starts:")}</strong> ${setupData.referenceDate}</div>` : ""}
              <div style="font-size:14px;"><strong>${_t("sched.colours_label", "Colours:")}</strong>
                <span style="background:var(--custody-${setupData.myColor});display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:middle;margin:0 4px;"></span>You &nbsp;/&nbsp;
                <span style="background:var(--custody-${setupData.coColor});display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:middle;margin:0 4px;"></span>${escapeHtml(coparentName)}
              </div>
            </div>
            ${divorced ? `<div class="sched-divorced-notice">${_t("sched.divorced_confirm", "This will be saved as a schedule-setup request visible to {{name}}.").replace("{{name}}", escapeHtml(coparentName))}</div>` : ""}
          </div>
          <div class="dialog-actions">
            <button class="ghost-button" type="button" id="setupBackBtn">&larr; ${_t("card.cancel", "Back")}</button>
            <button class="primary-button" type="button" id="setupSaveBtn">${divorced ? _t("sched.send_for_review", "Send for review") : _t("sched.save", "Save schedule")}</button>
          </div>
        </div>`;
    }
    bindSetupEvents();
  }

  function bindSetupEvents() {
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.querySelector("#closeSetupBtn").addEventListener("click", close);
    dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });

    if (step === 1) {
      dialog.querySelector("#cancelSetupBtn").addEventListener("click", close);
      dialog.querySelector("#setupType").addEventListener("change", (e) => {
        setupData.type = e.target.value;
        const refRow = dialog.querySelector("#setupRefRow");
        if (refRow) refRow.style.display = (e.target.value === "5-2" || e.target.value === "manual") ? "none" : "";
      });
      dialog.querySelector("#setupRefDate")?.addEventListener("change", (e) => { setupData.referenceDate = e.target.value; });
      dialog.querySelectorAll(".custody-color-swatches").forEach((group) => {
        group.querySelectorAll(".custody-swatch").forEach((btn) => {
          btn.addEventListener("click", () => {
            group.querySelectorAll(".custody-swatch").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            setupData[group.dataset.custodyTarget] = btn.dataset.custodyColor;
          });
        });
      });
      dialog.querySelector("#setupNextBtn").addEventListener("click", () => {
        setupData.type = dialog.querySelector("#setupType").value;
        setupData.referenceDate = dialog.querySelector("#setupRefDate")?.value || setupData.referenceDate;
        step = 2;
        render();
      });
    } else {
      dialog.querySelector("#setupBackBtn").addEventListener("click", () => { step = 1; render(); });
      dialog.querySelector("#setupSaveBtn").addEventListener("click", async () => {
        const current = getCustodySchedule();
        const schedule = { ...current, enabled: true, type: setupData.type, referenceDate: setupData.referenceDate, myColor: setupData.myColor, coColor: setupData.coColor };
        saveCustodySchedule(schedule);

        if (divorced) {
          const cardId = "scr-setup-" + Date.now();
          await _saveScheduleRequestCard({
            cardId,
            title: `Konfiguracja harmonogramu: ${setupData.type}`,
            detailsTag: "__SCR_SETUP__",
            payload: { type: setupData.type, referenceDate: setupData.referenceDate },
          });
          _notifyPartner("Do-Do: nowy harmonogram opieki", `Wzorzec: ${setupData.type}, start: ${setupData.referenceDate}`);
          showFeatureToast("Schedule setup sent for review");
        } else {
          showFeatureToast("Parenting schedule saved");
        }

        dialog.close(); dialog.remove();
        if (featureModule && !featureModule.classList.contains("hidden")) {
          const d = window._lastFeatureData;
          if (d) renderCalendarFeature(d);
        }
      });
    }
  }

  dialog.showModal();
  render();
}

window.openCustodyScheduleDialog = openCustodyScheduleDialog;
window.openScheduleSetupDialog = openScheduleSetupDialog;
window.renderCalendarFeature = renderCalendarFeature;
window.syncCalendarEventsFromCards = syncCalendarEventsFromCards;

function bindCustodySettings() {
  // Enabled toggle - auto-save immediately
  featureModule.querySelector("#custodyEnabledToggle")?.addEventListener("change", (e) => {
    const current = getCustodySchedule();
    saveCustodySchedule({ ...current, enabled: e.target.checked });
    showFeatureToast(e.target.checked ? "Custody calendar enabled" : "Custody calendar disabled");
  });

  // Divorced toggle
  featureModule.querySelector("#divorcedToggle")?.addEventListener("change", (e) => {
    setDivorced(e.target.checked);
    showFeatureToast(e.target.checked ? "Divorced mode enabled" : "Divorced mode disabled");
  });

  // Open schedule editor from settings
  featureModule.querySelector("#openSchedEditorFromSettings")?.addEventListener("click", () => openCustodyScheduleDialog());
  featureModule.querySelector("#openVacationsFromSettings")?.addEventListener("click", () => openVacationsDialog());

  // Inline color swatches in the caregivers panel - immediate save on click
  featureModule.querySelectorAll(".cg-swatches").forEach(group => {
    group.querySelectorAll(".cg-swatch").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = group.dataset.cgColorTarget; // "myColor" or "coColor"
        const color  = btn.dataset.custodyColor;
        // Update active state in this swatch row
        group.querySelectorAll(".cg-swatch").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        // Save immediately - this also calls applyCustodyColors() to update CSS vars + avatars
        const current = getCustodySchedule();
        saveCustodySchedule({ ...current, [target]: color });
        showFeatureToast(target === "myColor" ? "Your colour updated" : "Co-parent colour updated");
      });
    });
  });

}

function bindAutomationSettings() {
  const themePreference = featureModule.querySelector("#themePreference");
  const autoRemindersToggle = featureModule.querySelector("#autoRemindersToggle");
  const familyCalendarToggle = featureModule.querySelector("#familyCalendarToggle");
  const familyCalendarProvider = featureModule.querySelector("#familyCalendarProvider");
  const workCalendarToggle = featureModule.querySelector("#workCalendarToggle");
  const workCalendarProvider = featureModule.querySelector("#workCalendarProvider");
  const globalReminderPreset = featureModule.querySelector("#globalReminderPreset");
  const reminderDelivery = featureModule.querySelector("#reminderDelivery");
  const save = () => {
    window.updateAutomationSettings?.({
      automateReminders: Boolean(autoRemindersToggle?.checked),
      syncFamilyCalendar: Boolean(familyCalendarToggle?.checked),
      familyCalendarProvider: familyCalendarProvider?.value || "google",
      syncWorkCalendar: Boolean(workCalendarToggle?.checked),
      workCalendarProvider: workCalendarProvider?.value || "google",
      workCalendarVisibility: "busy-only",
      syncGoogleCalendar: Boolean(familyCalendarToggle?.checked) && familyCalendarProvider?.value === "google",
      defaultReminderPreset: globalReminderPreset?.value || "60",
      reminderDelivery: reminderDelivery?.value || "calendar-and-app",
    });
    showFeatureToast("Automation settings updated");
    window.switchModule("settings");
  };
  // Daily tips toggle
  featureModule.querySelector("#dailyTipsToggle")?.addEventListener("change", (e) => {
    localStorage.setItem("do-do-tips-enabled", e.target.checked ? "true" : "false");
    if (typeof window.renderDailyTip === "function") window.renderDailyTip();
  });

  autoRemindersToggle?.addEventListener("change", save);
  familyCalendarToggle?.addEventListener("change", async (e) => {
    if (e.target.checked && !window.isPaidUser?.()) {
      e.target.checked = false; // revert
      window.showUpgradePrompt?.("Calendar sync is available on the paid plan.");
      return;
    }
    save();
    // When enabling Google Calendar sync, verify the user has granted
    // calendar access. If not (e.g. they signed up after we moved to
    // incremental auth), trigger the calendar permission popup now.
    if (e.target.checked && (familyCalendarProvider?.value || "google") === "google") {
      await _ensureGoogleCalendarAccess();
    }
  });
  familyCalendarProvider?.addEventListener("change", save);
  workCalendarToggle?.addEventListener("change", async (e) => {
    save();
    // Same check for work calendar when Google is the provider
    if (e.target.checked && (workCalendarProvider?.value || "google") === "google") {
      await _ensureGoogleCalendarAccess();
    }
  });
  workCalendarProvider?.addEventListener("change", save);
  globalReminderPreset?.addEventListener("change", save);
  reminderDelivery?.addEventListener("change", save);

  // ── Cisza nocna (quiet hours) ───────────────────────────────────────────────
  const quietHoursToggle = featureModule.querySelector("#quietHoursToggle");
  const quietHoursTimesBlock = featureModule.querySelector("#quietHoursTimesBlock");
  const quietHoursFrom = featureModule.querySelector("#quietHoursFrom");
  const quietHoursTo = featureModule.querySelector("#quietHoursTo");

  function _showQuietTimes(show) {
    if (quietHoursTimesBlock) quietHoursTimesBlock.style.display = show ? "flex" : "none";
  }

  async function _saveQuietHours() {
    const session = typeof getAuthState === "function" ? getAuthState() : null;
    const userId = session?.session?.user?.id;
    if (!userId || !window.supabaseClient) return;
    const enabled = quietHoursToggle?.checked ?? false;
    const from = quietHoursFrom?.value || "22:00";
    const to = quietHoursTo?.value || "07:00";
    // Merge with existing prefs so we don't overwrite email/push settings
    const { data: existing } = await window.supabaseClient
      .from("profiles").select("notification_prefs").eq("id", userId).single().catch(() => ({ data: null }));
    const base = existing?.notification_prefs || {};
    await window.supabaseClient.from("profiles").update({
      notification_prefs: { ...base, quiet_enabled: enabled, quiet_from: from, quiet_to: to }
    }).eq("id", userId);
    if (typeof showToast === "function") showToast(enabled ? `Cisza nocna: ${from} - ${to}` : "Cisza nocna wylaczona");
  }

  // Load saved quiet hours from Supabase and populate controls
  (async () => {
    const session = typeof getAuthState === "function" ? getAuthState() : null;
    const userId = session?.session?.user?.id;
    if (!userId || !window.supabaseClient) return;
    try {
      const { data } = await window.supabaseClient
        .from("profiles").select("notification_prefs").eq("id", userId).single();
      const prefs = data?.notification_prefs || {};
      const enabled = prefs.quiet_enabled !== false && (prefs.quiet_enabled === true || Boolean(prefs.quiet_from));
      if (quietHoursToggle) quietHoursToggle.checked = enabled;
      if (quietHoursFrom && prefs.quiet_from) {
        const h = prefs.quiet_from.split(":")[0].padStart(2,"0");
        quietHoursFrom.value = `${h}:00`;
      }
      if (quietHoursTo && prefs.quiet_to) {
        const h = prefs.quiet_to.split(":")[0].padStart(2,"0");
        quietHoursTo.value = `${h}:00`;
      }
      _showQuietTimes(enabled);
    } catch {}
  })();

  quietHoursToggle?.addEventListener("change", () => {
    _showQuietTimes(quietHoursToggle.checked);
    _saveQuietHours();
  });
  quietHoursFrom?.addEventListener("change", _saveQuietHours);
  quietHoursTo?.addEventListener("change", _saveQuietHours);
  // ── end cisza nocna ─────────────────────────────────────────────────────────

  featureModule.querySelectorAll("[data-connect-work-provider]").forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.connectWorkProvider;
      const automation = window.getAutomationSettings?.() || {};
      const connected = Array.isArray(automation.workCalendarConnections) ? automation.workCalendarConnections : [];
      const nextConnections = connected.includes(provider)
        ? connected.filter((item) => item !== provider)
        : [...connected, provider];
      window.updateAutomationSettings?.({
        workCalendarConnections: nextConnections,
        syncWorkCalendar: nextConnections.length > 0,
        workCalendarProvider: provider,
        workCalendarVisibility: "busy-only",
      });
      showFeatureToast(`${provider === "outlook" ? "Microsoft Outlook" : "Google"} work calendar ${connected.includes(provider) ? "disconnected" : "connected"}`);
      window.switchModule("settings");
    });
  });

  // Checks if the user has granted calendar access. If not, triggers the
  // Google Calendar permission popup (incremental OAuth authorization).
  async function _ensureGoogleCalendarAccess() {
    const header = await window.getAuthHeader?.().catch(() => null);
    if (!header) return;
    try {
      const res = await fetch("/api/refresh-token", { method: "POST", headers: header });
      if (res.status === 404 || res.status === 401) {
        // No calendar access or token revoked - request it now
        window.requestGoogleCalendarAccess?.();
      }
      // 200 = already connected, 500 = server error - don't block the user
    } catch {
      // Network error - don't block
    }
  }

  // Google Calendar token health indicator
  // Updates the badge in the Family calendar row based on token refresh result
  const _updateGCalBadge = (status) => {
    const badge = featureModule.querySelector("#gcalTokenStatusBadge");
    if (!badge) return;
    const automation = window.getAutomationSettings?.() || {};
    if (!automation.syncFamilyCalendar) return; // only show status when sync is enabled
    const map = {
      connected:      { text: "Connected", cls: "status-connected" },
      no_token:       { text: "Connect Google Calendar", cls: "status-pending" },
      token_revoked:  { text: "Connect Google Calendar", cls: "status-error" },
      error:          { text: "Sync error", cls: "status-error" },
    };
    const ui = map[status] || { text: "On", cls: "" };
    badge.textContent = ui.text;
    badge.className = ui.cls;
    // Make the badge clickable when reconnect is needed
    const needsReconnect = ["no_token", "token_revoked"].includes(status);
    badge.style.cursor = needsReconnect ? "pointer" : "";
    badge.title = needsReconnect ? "Click to reconnect Google Calendar" : "";
    badge.onclick = needsReconnect ? () => window.requestGoogleCalendarAccess?.() : null;
  };
  window.addEventListener("googleCalTokenStatus", (e) => _updateGCalBadge(e.detail?.status));

  // Apple Calendar connect
  featureModule.querySelector("#connectAppleCalButton")?.addEventListener("click", async () => {
    const email = featureModule.querySelector("#appleCalEmail")?.value.trim();
    const password = featureModule.querySelector("#appleCalPassword")?.value.trim();
    if (!email || !password) {
      showFeatureToast("Enter your iCloud email and app-specific password");
      return;
    }
    const btn = featureModule.querySelector("#connectAppleCalButton");
    if (btn) { btn.disabled = true; btn.textContent = "Connecting..."; }
    try {
      const res = await fetch("/api/apple-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await window.getAuthHeader()) },
        body: JSON.stringify({ email, appPassword: password, action: "fetchBusy" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showFeatureToast(body.error || "Could not connect. Check your credentials.");
        if (btn) { btn.disabled = false; btn.textContent = "Connect iCloud Calendar"; }
        return;
      }
      window.saveAppleCalCredentials?.(email, password);
      window.initAppleCalendar?.();
      showFeatureToast("Apple Calendar connected");
      window.switchModule("settings");
    } catch (err) {
      showFeatureToast("Connection failed. Try again.");
      if (btn) { btn.disabled = false; btn.textContent = "Connect iCloud Calendar"; }
    }
  });

  // Apple Calendar disconnect
  featureModule.querySelector("#disconnectAppleCalButton")?.addEventListener("click", () => {
    window.clearAppleCalCredentials?.();
    showFeatureToast("Apple Calendar disconnected");
    window.switchModule("settings");
  });

  // ─── Calendar Import wiring ───────────────────────────────────────────────────
  const importCalSelect   = featureModule.querySelector("#importCalendarSelect");
  const refreshCalListBtn = featureModule.querySelector("#refreshCalendarListBtn");
  const importDaysInput   = featureModule.querySelector("#importCalDaysAhead");
  const importSyncMode    = featureModule.querySelector("#importCalSyncMode");
  const importNowBtn      = featureModule.querySelector("#runCalendarImportBtn");
  const importStatusMsg   = featureModule.querySelector("#importCalStatusMsg");

  async function _loadCalendarList() {
    if (!importCalSelect) return;
    if (!window.listUserCalendars) {
      importCalSelect.innerHTML = '<option value="">Sign in with Google first</option>';
      return;
    }
    importCalSelect.innerHTML = '<option value="">Loading...</option>';
    importCalSelect.disabled = true;
    const cals = await window.listUserCalendars().catch(() => []);
    importCalSelect.disabled = false;
    if (!cals.length) {
      importCalSelect.innerHTML = '<option value="">No calendars found - check Google sign-in</option>';
      return;
    }
    const currentId = window.getAutomationSettings?.().importCalendarId || "";
    importCalSelect.innerHTML = '<option value="">-- pick a calendar --</option>' +
      cals.map((c) => {
        const selected = c.id === currentId ? " selected" : "";
        const label = c.name + (c.primary ? " (primary)" : "");
        return `<option value="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}"${selected}>${escapeHtml(label)}</option>`;
      }).join("");
  }

  // Load calendar list on settings open
  _loadCalendarList();
  refreshCalListBtn?.addEventListener("click", _loadCalendarList);

  importNowBtn?.addEventListener("click", async () => {
    const calId   = importCalSelect?.value?.trim();
    const calName = importCalSelect?.options[importCalSelect.selectedIndex]?.dataset?.name || calId;
    const days    = parseInt(importDaysInput?.value || "30", 10) || 30;
    const mode    = importSyncMode?.value || "import-only";

    if (!calId) {
      showFeatureToast("Pick a calendar first.");
      return;
    }

    // Save settings before importing
    window.updateAutomationSettings?.({
      importCalendarId:       calId,
      importCalendarName:     calName,
      importCalendarDaysAhead: days,
      importCalendarSyncMode: mode,
    });

    const btn = importNowBtn;
    btn.textContent = "Importing...";
    btn.disabled = true;
    if (importStatusMsg) importStatusMsg.innerHTML = "<em>Importing...</em>";

    try {
      const result = await window.importCalendarAsCards(calId, calName, days, mode);
      const msg = result.created
        ? `Imported ${result.created} new card${result.created !== 1 ? "s" : ""}${result.updated ? `, updated ${result.updated}` : ""} from ${escapeHtml(calName)}.`
        : result.updated
          ? `Updated ${result.updated} card${result.updated !== 1 ? "s" : ""}.`
          : `No new events found in the next ${days} days.`;
      showFeatureToast(msg);
      if (importStatusMsg) importStatusMsg.innerHTML = `<em>Last sync: <strong>${escapeHtml(calName)}</strong> - ${result.total} event${result.total !== 1 ? "s" : ""} checked</em>`;
      window.render?.();
    } catch (err) {
      showFeatureToast("Import failed. Check your Google connection.");
      if (importStatusMsg) importStatusMsg.innerHTML = "<em>Import failed - try again.</em>";
    } finally {
      btn.textContent = "Import now";
      btn.disabled = false;
    }
  });

  // Co-parent calendar status - async update
  const coParentStatusEl = featureModule.querySelector("#coParentCalStatus");
  if (coParentStatusEl) {
    // Check if any co-parent busy slots are currently loaded
    const gcalEvents = window.getGoogleCalendarEvents?.() || [];
    const hasCoParentSlots = gcalEvents.some((e) => e.source === "coparent-work");
    coParentStatusEl.textContent = hasCoParentSlots ? "Connected" : "Not connected yet";
    coParentStatusEl.className = hasCoParentSlots ? "status-connected" : "status-pending";
  }

  themePreference?.addEventListener("change", () => {
    window.updateThemePreference?.(themePreference.value);
    showFeatureToast(window.t?.("toast.updated") ?? "Updated");
  });

  // Language selector
  const langSelect = featureModule.querySelector("#languagePreference");
  langSelect?.addEventListener("change", () => {
    const newLang = langSelect.value;
    window.setLanguage?.(newLang);
    showFeatureToast(window.t?.("toast.lang_changed") ?? "Language updated");
  });

  // Currency selector (independent of language)
  const currencySelect = featureModule.querySelector("#currencyPreference");
  currencySelect?.addEventListener("change", () => {
    const newKey = currencySelect.value;
    window.setCurrencyPreference?.(newKey);
    // Update LOCALE_CONFIG in-place so the rest of the app picks it up immediately
    const configs = { CHF: window.LOCALE_CONFIGS?.chf, EUR: window.LOCALE_CONFIGS?.eur, PLN: window.LOCALE_CONFIGS?.pl };
    const newConfig = configs[newKey];
    if (newConfig && window.LOCALE_CONFIG) {
      Object.assign(window.LOCALE_CONFIG, newConfig);
    }
    showFeatureToast(`Currency set to ${newKey}`);
    // Re-render settings in place - no page reload needed
    renderSettingsFeature();
  });

  // Siri / Shortcuts integration
  // Tapping "Install Shortcut" fetches the user's token silently, then downloads
  // a personalised .shortcut file from /api/siri-shortcut with the token pre-embedded.
  // iOS opens the file directly in Shortcuts - zero manual configuration needed.

  const siriSetupBtn = featureModule.querySelector("#siriSetupButton");
  const siriBadge = featureModule.querySelector("#siriBadge");
  const siriStatusLabel = featureModule.querySelector("#siriStatusLabel");
  const siriHelpText = featureModule.querySelector("#siriHelpText");

  siriSetupBtn?.addEventListener("click", async () => {
    siriSetupBtn.disabled = true;
    siriSetupBtn.textContent = "Loading...";
    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) {
        showFeatureToast("Sign in first");
        siriSetupBtn.disabled = false;
        siriSetupBtn.textContent = "Install Shortcut";
        return;
      }
      // Get the user's personal token
      const tokenRes = await fetch("/api/siri-token", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!tokenRes.ok) throw new Error("Token fetch failed");
      const { token } = await tokenRes.json();

      // Trigger download of the personalised .shortcut file
      // iOS Safari will offer to open it directly in Shortcuts
      window.location.href = `/api/siri-shortcut?token=${encodeURIComponent(token)}`;

      if (siriBadge) { siriBadge.textContent = "Installed"; siriBadge.className = "feature-badge badge-connected"; }
      if (siriStatusLabel) siriStatusLabel.textContent = "Shortcut installed - say \"Hey Siri, Add to Do-Do\"";
      if (siriHelpText) siriHelpText.style.display = "";
      siriSetupBtn.textContent = "Reinstall";
      siriSetupBtn.disabled = false;
    } catch (err) {
      showFeatureToast("Could not set up Siri - try again");
      siriSetupBtn.disabled = false;
      siriSetupBtn.textContent = "Install Shortcut";
    }
  });
}

function loadShoppingLists() {
  try {
    const stored = window.appStorage?.getItem(shoppingStorageKey);
    if (!stored) return structuredClone(defaultShoppingLists);
    const parsed = JSON.parse(stored);
    return {
      groceries: Array.isArray(parsed.groceries) ? parsed.groceries : structuredClone(defaultShoppingLists.groceries),
      other: Array.isArray(parsed.other) ? parsed.other : structuredClone(defaultShoppingLists.other),
    };
  } catch {
    return structuredClone(defaultShoppingLists);
  }
}

function saveShoppingLists(lists) {
  window.appStorage?.setItem(shoppingStorageKey, JSON.stringify(lists));
}

async function renderShoppingFeature() {
  featureModule.innerHTML = `<div class="shopping-board" id="shoppingBoard"><p style="padding:16px;color:var(--muted);font-size:13px;">Loading...</p></div>`;

  // Try Supabase first, fall back to localStorage
  let lists = await window.loadShoppingItems?.() || null;
  if (!lists) lists = loadShoppingLists();

  _renderShoppingBoard(lists);

  // Subscribe to real-time changes so co-parent updates appear instantly
  window.unsubscribeShopping?.();
  window.subscribeToShopping?.(async () => {
    const refreshed = await window.loadShoppingItems?.();
    if (refreshed) _renderShoppingBoard(refreshed);
  });
}

function _getChildListLabel() {
  const setup = window.getOnboardingState?.() || {};
  const children = setup.children || [];
  if (children.length > 0) {
    const firstName = children[0].name || children[0];
    return `${firstName}'s Needs`;
  }
  return window.t?.("shopping.child_needs") ?? "Child's Needs";
}

function _renderShoppingBoard(lists) {
  const board = featureModule.querySelector("#shoppingBoard") || featureModule;
  const customLists = loadCustomShoppingLists();
  const meta = loadShoppingListMeta();
  const childListLabel = meta.groceries?.name || _getChildListLabel();
  const otherLabel = meta.other?.name || (window.t ? window.t("shopping.other") : "Other");
  board.innerHTML = `
    ${meta.groceries?.hidden ? "" : renderShoppingGroup("groceries", childListLabel, lists.groceries)}
    ${meta.other?.hidden ? "" : renderShoppingGroup("other", otherLabel, lists.other)}
    ${customLists.map((cl) => renderShoppingGroup(cl.key, cl.name, cl.items)).join("")}
    <div class="shopping-add-list-row">
      <button class="ghost-button" type="button" id="addAnotherListBtn">${window.t?.("shopping.add_list") ?? "Add new list"}</button>
    </div>
  `;

  board.querySelectorAll("[data-shopping-check]").forEach((input) => {
    const id = input.dataset.shoppingCheck;
    if (typeof id === "string" && id.startsWith("custom-")) return; // handled separately below
    input.addEventListener("change", async () => {
      // Immediate visual feedback - don't wait for async re-render
      const wrap = input.closest(".shopping-row-wrap");
      if (wrap) {
        wrap.classList.toggle("bought", input.checked);
        if (!input.checked) wrap.querySelector(".shopping-buyer-avatar")?.remove();
      }

      const listKey = input.dataset.shoppingList;
      const myName = typeof getMyName === "function" ? getMyName() : "";
      if (typeof id === "string" && id.startsWith(listKey + "-")) {
        // localStorage item
        const nextLists = loadShoppingLists();
        const list = nextLists[listKey] || [];
        const item = list.find((e) => e.id === id);
        if (item) {
          item.bought = input.checked;
          item.boughtBy = input.checked ? myName : null;
          saveShoppingLists(nextLists);
        }
        _renderShoppingBoard(nextLists);
      } else {
        // Supabase item
        await window.toggleShoppingItem?.(id, input.checked);
      }
      showFeatureToast(input.checked ? (window.t?.("toast.marked_bought") ?? "Marked as bought") : (window.t?.("toast.returned") ?? "Returned to list"));
    });
  });

  // Rename list
  board.querySelectorAll("[data-shopping-rename-list]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const listKey = btn.dataset.shoppingRenameList;
      const currentName = btn.closest(".shopping-group")?.querySelector("h3")?.textContent?.trim() || "";
      const newName = prompt("Rename list:", currentName);
      if (!newName || !newName.trim() || newName.trim() === currentName) return;
      if (listKey.startsWith("custom-")) {
        const cls = loadCustomShoppingLists();
        const cl = cls.find((l) => l.key === listKey);
        if (cl) { cl.name = newName.trim(); saveCustomShoppingLists(cls); }
      } else {
        const meta = loadShoppingListMeta();
        meta[listKey] = { ...(meta[listKey] || {}), name: newName.trim() };
        saveShoppingListMeta(meta);
      }
      window.loadShoppingItems?.().then((refreshed) => _renderShoppingBoard(refreshed || loadShoppingLists()));
    });
  });

  // Remove / delete list
  board.querySelectorAll("[data-shopping-remove-list]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const listKey = btn.dataset.shoppingRemoveList;
      const listName = btn.closest(".shopping-group")?.querySelector("h3")?.textContent?.trim() || "this list";
      if (!confirm(`Delete "${listName}" and all its items?`)) return;
      if (listKey.startsWith("custom-")) {
        const cls = loadCustomShoppingLists();
        saveCustomShoppingLists(cls.filter((l) => l.key !== listKey));
      } else {
        // For default lists, hide them (keeps Supabase data intact)
        const meta = loadShoppingListMeta();
        meta[listKey] = { ...(meta[listKey] || {}), hidden: true };
        saveShoppingListMeta(meta);
      }
      window.loadShoppingItems?.().then((refreshed) => _renderShoppingBoard(refreshed || loadShoppingLists()));
    });
  });

  // Delete individual item (groceries / other - not custom lists)
  board.querySelectorAll("[data-shopping-delete]").forEach((btn) => {
    const id = btn.dataset.shoppingDelete;
    if (typeof id === "string" && id.startsWith("custom-")) return; // handled separately below
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const isLocalStorage = typeof id === "string" && /^(groceries|other)-/.test(id);
      if (isLocalStorage) {
        const listKey = id.split("-")[0];
        const nextLists = loadShoppingLists();
        nextLists[listKey] = (nextLists[listKey] || []).filter((item) => item.id !== id);
        saveShoppingLists(nextLists);
        _renderShoppingBoard(nextLists);
      } else {
        // Supabase item (UUID) - also scrub from localStorage cache so re-render works even if Supabase refresh is slow
        await window.deleteShoppingItem?.(id);
        const nextLists = loadShoppingLists();
        ["groceries", "other"].forEach((k) => { nextLists[k] = (nextLists[k] || []).filter((item) => item.id !== id); });
        saveShoppingLists(nextLists);
        const refreshed = await window.loadShoppingItems?.();
        _renderShoppingBoard(refreshed || nextLists);
      }
      showFeatureToast(window.t?.("toast.removed") ?? "Removed");
    });
  });

  // Clear all bought items in a group
  board.querySelectorAll("[data-shopping-clear]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const listKey = btn.dataset.shoppingClear;

      // Custom list: clear bought items from custom storage only
      if (listKey.startsWith("custom-")) {
        const cls = loadCustomShoppingLists();
        const cl = cls.find((l) => l.key === listKey);
        if (cl) { const n = (cl.items || []).filter((i) => i.bought).length; cl.items = (cl.items || []).filter((i) => !i.bought); saveCustomShoppingLists(cls); showFeatureToast(`Cleared ${n} bought item${n !== 1 ? "s" : ""}`); }
        const refreshed = await window.loadShoppingItems?.();
        _renderShoppingBoard(refreshed || loadShoppingLists());
        return;
      }

      // Get current lists to find bought Supabase items
      const refreshed = await window.loadShoppingItems?.();
      const current = refreshed || loadShoppingLists();
      const boughtItems = (current[listKey] || []).filter((item) => item.bought);

      // Delete all bought items
      await Promise.all(
        boughtItems.map((item) => {
          if (String(item.id).includes("-")) {
            // localStorage item - will be handled below
            return Promise.resolve();
          }
          return window.deleteShoppingItem?.(item.id) || Promise.resolve();
        })
      );

      // Also clear from localStorage
      const nextLists = loadShoppingLists();
      nextLists[listKey] = (nextLists[listKey] || []).filter((item) => !item.bought);
      saveShoppingLists(nextLists);

      const final = await window.loadShoppingItems?.();
      _renderShoppingBoard(final || nextLists);
      showFeatureToast(`Cleared ${boughtItems.length} bought item${boughtItems.length !== 1 ? "s" : ""}`);
    });
  });

  // Mark all items as bought in a group
  board.querySelectorAll("[data-shopping-mark-all]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const listKey = btn.dataset.shoppingMarkAll;
      if (listKey.startsWith("custom-")) {
        const cls = loadCustomShoppingLists();
        const cl = cls.find((l) => l.key === listKey);
        if (cl) { cl.items = (cl.items || []).map((i) => ({ ...i, bought: true })); saveCustomShoppingLists(cls); }
        const refreshed = await window.loadShoppingItems?.();
        _renderShoppingBoard(refreshed || loadShoppingLists());
      } else {
        const refreshed = await window.loadShoppingItems?.();
        const current = refreshed || loadShoppingLists();
        const unboughtItems = (current[listKey] || []).filter((item) => !item.bought);
        await Promise.all(unboughtItems.map((item) => {
          if (String(item.id).includes("-") && !String(item.id).match(/^[0-9a-f]{8}-/)) {
            // localStorage item
            return Promise.resolve();
          }
          return window.toggleShoppingItem?.(item.id, true) || Promise.resolve();
        }));
        // Also update localStorage
        const nextLists = loadShoppingLists();
        (nextLists[listKey] || []).forEach((item) => { item.bought = true; });
        saveShoppingLists(nextLists);
        const final = await window.loadShoppingItems?.();
        _renderShoppingBoard(final || nextLists);
      }
      showFeatureToast(window.t?.("shopping.marked_all") ?? "All marked");
    });
  });

  // Unmark all checked items in a group
  board.querySelectorAll("[data-shopping-unmark]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const listKey = btn.dataset.shoppingUnmark;
      if (listKey.startsWith("custom-")) {
        const cls = loadCustomShoppingLists();
        const cl = cls.find((l) => l.key === listKey);
        if (cl) { cl.items = (cl.items || []).map((i) => ({ ...i, bought: false })); saveCustomShoppingLists(cls); }
        const refreshed = await window.loadShoppingItems?.();
        _renderShoppingBoard(refreshed || loadShoppingLists());
      } else {
        const refreshed = await window.loadShoppingItems?.();
        const current = refreshed || loadShoppingLists();
        const boughtItems = (current[listKey] || []).filter((item) => item.bought);
        await Promise.all(boughtItems.map((item) => {
          if (String(item.id).includes("-") && !String(item.id).match(/^[0-9a-f]{8}-/)) {
            return Promise.resolve();
          }
          return window.toggleShoppingItem?.(item.id, false) || Promise.resolve();
        }));
        // Also update localStorage
        const nextLists = loadShoppingLists();
        (nextLists[listKey] || []).forEach((item) => { item.bought = false; });
        saveShoppingLists(nextLists);
        const final = await window.loadShoppingItems?.();
        _renderShoppingBoard(final || nextLists);
      }
      showFeatureToast(window.t?.("shopping.unmarked_all") ?? "All unmarked");
    });
  });

  board.querySelectorAll("[data-shopping-add-form]").forEach((form) => {
    const input = form.querySelector("[data-shopping-input]");
    const mic = form.querySelector("[data-shopping-mic]");
    mic?.addEventListener("click", () => window.startDictationForField?.(input, {
      button: mic,
      success: "Item dictated",
      fallback: "Type the item instead.",
    }));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const label = input.value.trim();
      if (!label) { input.focus(); return; }
      const listKey = form.dataset.shoppingAddForm;
      input.value = "";

      // After re-render, refocus the input for this list so user can keep typing
      const refocusInput = () => {
        const newInput = board.querySelector(`[data-shopping-add-form="${listKey}"] [data-shopping-input]`);
        newInput?.focus();
      };

      // Custom list (localStorage only)
      if (listKey.startsWith("custom-")) {
        const cls = loadCustomShoppingLists();
        const cl = cls.find((l) => l.key === listKey);
        if (cl) {
          cl.items = cl.items || [];
          cl.items.push({ id: `${listKey}-${Date.now()}`, label, bought: false });
          saveCustomShoppingLists(cls);
        }
        const refreshed = await window.loadShoppingItems?.();
        _renderShoppingBoard(refreshed || loadShoppingLists());
        refocusInput();
        return;
      }

      // Try Supabase, fall back to localStorage
      const saved = await window.addShoppingItem?.(listKey, label);
      if (saved) {
        const refreshed = await window.loadShoppingItems?.();
        if (refreshed) { _renderShoppingBoard(refreshed); refocusInput(); return; }
      }
      // localStorage fallback
      const nextLists = loadShoppingLists();
      const list = nextLists[listKey] || [];
      list.push({ id: `${listKey}-${Date.now()}`, label, bought: false });
      nextLists[listKey] = list;
      saveShoppingLists(nextLists);
      _renderShoppingBoard(nextLists);
      refocusInput();
      const groupName = listKey === "groceries" ? _getChildListLabel() : (window.t?.("shopping.other") ?? "Other");
      showFeatureToast(`${window.t?.("toast.added") ?? "Added"} – ${groupName}`);
    });

    // Multi-line paste: split clipboard text into individual items
    input.addEventListener("paste", async (e) => {
      const text = (e.clipboardData || window.clipboardData).getData("text");
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length <= 1) return; // single line - let normal paste handle it
      e.preventDefault();
      const listKey = form.dataset.shoppingAddForm;
      if (listKey.startsWith("custom-")) {
        const cls = loadCustomShoppingLists();
        const cl = cls.find((l) => l.key === listKey);
        if (cl) {
          cl.items = cl.items || [];
          lines.forEach((label) => cl.items.push({ id: `${listKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`, label, bought: false }));
          saveCustomShoppingLists(cls);
        }
        const refreshed = await window.loadShoppingItems?.();
        _renderShoppingBoard(refreshed || loadShoppingLists());
      } else {
        if (window.addShoppingItem) {
          for (const label of lines) await window.addShoppingItem(listKey, label);
          const refreshed = await window.loadShoppingItems?.();
          if (refreshed) { _renderShoppingBoard(refreshed); }
        } else {
          const nextLists = loadShoppingLists();
          const list = nextLists[listKey] || [];
          lines.forEach((label) => list.push({ id: `${listKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`, label, bought: false }));
          nextLists[listKey] = list;
          saveShoppingLists(nextLists);
          _renderShoppingBoard(nextLists);
        }
      }
      showFeatureToast(`${lines.length} ${window.t?.("toast.items_added") ?? "items added"}`);
    });
  });

  // Delete for custom-list items
  board.querySelectorAll("[data-shopping-delete]").forEach((btn) => {
    const id = btn.dataset.shoppingDelete;
    if (typeof id === "string" && id.startsWith("custom-")) {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const listKey = id.split("-").slice(0, 2).join("-"); // "custom-TIMESTAMP"
        const cls = loadCustomShoppingLists();
        const cl = cls.find((l) => l.key === listKey);
        if (cl) { cl.items = (cl.items || []).filter((item) => item.id !== id); saveCustomShoppingLists(cls); }
        const refreshed = await window.loadShoppingItems?.();
        _renderShoppingBoard(refreshed || loadShoppingLists());
        showFeatureToast(window.t?.("toast.removed") ?? "Removed");
      });
    }
  });

  // Toggle for custom-list items
  board.querySelectorAll("[data-shopping-check]").forEach((input) => {
    const id = input.dataset.shoppingCheck;
    if (typeof id === "string" && id.startsWith("custom-")) {
      input.addEventListener("change", async () => {
        // Immediate visual feedback
        const wrap = input.closest(".shopping-row-wrap");
        if (wrap) {
          wrap.classList.toggle("bought", input.checked);
          if (!input.checked) wrap.querySelector(".shopping-buyer-avatar")?.remove();
        }

        const listKey = id.split("-").slice(0, 2).join("-");
        const myName = typeof getMyName === "function" ? getMyName() : "";
        const cls = loadCustomShoppingLists();
        const cl = cls.find((l) => l.key === listKey);
        if (cl) {
          const item = (cl.items || []).find((it) => it.id === id);
          if (item) { item.bought = input.checked; item.boughtBy = input.checked ? myName : null; }
          saveCustomShoppingLists(cls);
        }
        const refreshed = await window.loadShoppingItems?.();
        _renderShoppingBoard(refreshed || loadShoppingLists());
      });
    }
  });

  // "Add another list" button
  board.querySelector("#addAnotherListBtn")?.addEventListener("click", () => {
    const name = prompt(window.t?.("shopping.new_list_prompt") ?? "Add new list");
    if (!name || !name.trim()) return;
    addCustomShoppingList(name.trim());
    window.loadShoppingItems?.().then((refreshed) => _renderShoppingBoard(refreshed || loadShoppingLists()));
  });
}

function renderShoppingGroup(key, title, items) {
  const remaining = items.filter((item) => !item.bought).length;
  const boughtCount = items.length - remaining;
  const dictateLabel = window.t ? window.t("shopping.dictate") : "Dictate item";
  const addPlaceholder = window.t ? window.t("shopping.add_ph") : "Add or dictate an item";
  const clearLabel = window.t ? window.t("shopping.clear_bought", { n: boughtCount }) : `Clear bought (${boughtCount})`;
  const leftLabel = window.t ? window.t("shopping.items_left", { n: remaining }) : `${remaining} left`;
  const markAllLabel = window.t ? window.t("shopping.mark_all") : "Mark all";
  const unmarkLabel = window.t ? window.t("shopping.unmark_marked") : "Unmark marked";
  const totalCount = items.length;
  const renameSvg = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" width="13" height="13"><path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5Z"/></svg>`;
  const trashSvg = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" width="13" height="13"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"/></svg>`;
  return `
    <section class="feature-panel shopping-group">
      <div class="shopping-group-header">
        <h3>${title}</h3>
        <div class="shopping-group-header-actions">
          ${boughtCount > 0 ? `<button class="shopping-clear-btn" type="button" data-shopping-clear="${key}" title="${clearLabel}">${clearLabel}</button>` : ""}
          ${totalCount > 0 && remaining > 0 ? `<button class="shopping-bulk-btn" type="button" data-shopping-mark-all="${key}">${markAllLabel}</button>` : ""}
          ${boughtCount > 0 ? `<button class="shopping-bulk-btn" type="button" data-shopping-unmark="${key}">${unmarkLabel}</button>` : ""}
          <span>${leftLabel}</span>
          <button class="shopping-icon-btn" type="button" data-shopping-rename-list="${key}" title="Rename list" aria-label="Rename list">${renameSvg}</button>
          <button class="shopping-icon-btn shopping-icon-btn--danger" type="button" data-shopping-remove-list="${key}" title="Delete list" aria-label="Delete list">${trashSvg}</button>
        </div>
      </div>
      <form class="shopping-capture" data-shopping-add-form="${key}">
        <div class="shopping-input-wrap">
          <button class="shopping-mic" type="button" data-shopping-mic aria-label="${dictateLabel}" title="${dictateLabel}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
            </svg>
          </button>
          <input data-shopping-input placeholder="${addPlaceholder}" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" />
          <button class="shopping-add" type="submit" aria-label="Add ${title}">+</button>
        </div>
      </form>
      <div class="shopping-list">
        ${items.map((item) => `
          <div class="shopping-row-wrap ${item.bought ? "bought" : ""}">
            <label class="shopping-row">
              <input type="checkbox" data-shopping-list="${key}" data-shopping-check="${item.id}" ${item.bought ? "checked" : ""} />
              <strong>${escapeFeatureHtml(item.label)}</strong>
              ${item.boughtBy ? renderShoppingBuyer(item.boughtBy) : ""}
            </label>
            <button class="shopping-delete-btn" type="button" data-shopping-delete="${item.id}" aria-label="Remove ${escapeFeatureHtml(item.label)}">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" width="14" height="14">
                <path d="M12 4 4 12M4 4l8 8"/>
              </svg>
            </button>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderShoppingBuyer(name) {
  const safeName = escapeFeatureHtml(name);
  return `
    <span class="mini-avatar parent-a-mini shopping-buyer-avatar" title="${safeName}" aria-label="Bought by ${safeName}" data-person-name="${safeName}">
      ${safeName.slice(0, 1)}
    </span>
  `;
}

function escapeFeatureHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Expenses Feature ─────────────────────────────────────────────────────────
// "Add Expense" opens the standard Do card dialog pre-filled as an Expense.
// Split options (50/50, Mine only, Custom) live in the payment panel side column.

function _openNewExpenseCard() {
  window.openCardDialog?.("", "info", { topic: "Expenses", type: "Expense" });
}

function renderExpensesFeature() {
  const allCards = (typeof state !== "undefined" ? state.cards : [])
    .filter((card) => card.type === "Expense" || card.topic === "Expenses")
    .sort((a, b) => new Date(a.due || 0) - new Date(b.due || 0));

  const _t = window.t || ((k) => k);
  const _sym = (window.LOCALE_CONFIG || LOCALE_CONFIG)?.symbol || "CHF";
  const activeTab = featureModule.dataset.expenseTab || "monthly";

  // ── Shared data ──────────────────────────────────────────────────────────
  const myName = typeof getMyName === "function" ? getMyName() : "";
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";

  // ── Tab: Recurring ───────────────────────────────────────────────────────
  if (activeTab === "recurring") {
    const recurringCards = allCards.filter((c) => c.recurrence?.freq && c.recurrence.freq !== "none");
    const freqLabel = (freq) => ({
      daily:    _t("recurrence.daily")    || "Daily",
      weekly:   _t("recurrence.weekly")   || "Weekly",
      biweekly: _t("recurrence.biweekly") || "Every 2 weeks",
      monthly:  _t("recurrence.monthly")  || "Monthly",
      yearly:   _t("recurrence.yearly")   || "Yearly",
    })[freq] || freq;

    // Group by frequency
    const groups = {};
    recurringCards.forEach((c) => {
      const f = c.recurrence.freq;
      if (!groups[f]) groups[f] = [];
      groups[f].push(c);
    });
    const freqOrder = ["daily", "weekly", "biweekly", "monthly", "yearly"];
    const sortedFreqs = Object.keys(groups).sort((a, b) => {
      const ai = freqOrder.indexOf(a), bi = freqOrder.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });

    const freqToMonthly = { daily: 30, weekly: 4, biweekly: 2, monthly: 1, yearly: 1/12 };
    const monthlyTotal = recurringCards.reduce((s, c) => {
      const mult = freqToMonthly[c.recurrence.freq] ?? 1;
      return s + expenseAmount(c.amount) * mult;
    }, 0);
    const weeklyTotal = 0; // folded into monthlyTotal above

    featureModule.innerHTML = `
      <section class="finance-hero">
        <div>
          <span>${_t("expense.total")}</span>
          <strong>${_sym} ${formatExpenseCurrency(monthlyTotal)}</strong>
          <p style="font-size:12px;color:var(--muted)">Est. monthly commitment</p>
        </div>
        <div class="expense-hero-actions">
          <button class="primary-button" type="button" id="addExpenseButton">${_t("expense.add")}</button>
        </div>
      </section>

      <div class="expense-tab-bar">
        <button class="cal-panel-tab" data-expense-tab="monthly">Monthly</button>
        <button class="cal-panel-tab active" data-expense-tab="recurring">&#x21BB; Recurring</button>
      </div>

      <section class="upcoming-expenses">
        ${recurringCards.length === 0
          ? `<article class="agenda-empty">${_t("expense.no_recurring") || "No recurring expenses yet. Add one using the recurrence option in the card."}</article>`
          : sortedFreqs.map((freq) => `
              <div class="recurring-freq-group">
                <div class="recurring-freq-heading">
                  <span class="recurring-freq-badge">${freqLabel(freq)}</span>
                  <span class="recurring-freq-total">${_sym} ${formatExpenseCurrency(groups[freq].reduce((s, c) => s + expenseAmount(c.amount), 0))}</span>
                </div>
                <div class="upcoming-expense-list">
                  ${groups[freq].map((card) => renderRecurringExpenseCard(card, myName)).join("")}
                </div>
              </div>
            `).join("")
        }
      </section>
    `;

    featureModule.querySelector("#addExpenseButton")?.addEventListener("click", () => _openNewExpenseCard());
    featureModule.querySelectorAll("[data-expense-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        featureModule.dataset.expenseTab = btn.dataset.expenseTab;
        renderExpensesFeature();
      });
    });
    featureModule.querySelectorAll("[data-expense-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleExpenseAction(btn.dataset.cardId, btn.dataset.expenseAction);
      });
    });
    window.bindUnifiedCardInteractions?.(featureModule);
    return;
  }

  // ── Tab: Monthly (default) ───────────────────────────────────────────────
  const now = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("default", { month: "long", year: "numeric" }) });
  }
  const selectedMonth = featureModule.dataset.expenseMonth || months[0].value;
  const [selYear, selMon] = selectedMonth.split("-").map(Number);

  const expenseCards = allCards.filter((card) => {
    const d = card.due ? new Date(card.due) : null;
    if (!d) return true;
    return d.getFullYear() === selYear && d.getMonth() + 1 === selMon;
  });

  const total = expenseCards.reduce((sum, card) => sum + expenseAmount(card.amount), 0);
  const openCards = expenseCards.filter((card) => card.status !== "Done" && card.payment_status !== "paid");
  const paidCards = expenseCards.filter((card) => card.status === "Done" || card.payment_status === "paid");

  const balance = computeBalance(expenseCards, myName);
  const balanceAbs = Math.abs(balance);
  const balanceLabel = balance > 0.01
    ? `<span class="balance-positive">${window.t?.("expense.they_owe", { sym: _sym, amt: formatExpenseCurrency(balanceAbs) }) ?? `They owe you ${_sym} ${formatExpenseCurrency(balanceAbs)}`}</span>`
    : balance < -0.01
    ? `<span class="balance-negative">${window.t?.("expense.you_owe", { sym: _sym, amt: formatExpenseCurrency(balanceAbs) }) ?? `You owe ${_sym} ${formatExpenseCurrency(balanceAbs)}`}</span>`
    : `<span class="balance-zero">${window.t?.("expense.settled") ?? "Settled up"}</span>`;

  function paidByParent(name) {
    return paidCards.reduce((sum, card) => {
      const isPrimary = card.author === name || card.assignee === name;
      return sum + (isPrimary ? expenseAmount(card.amount) : 0);
    }, 0);
  }
  const myPaid = paidByParent(myName);
  const coPaid = paidCards.reduce((sum, card) => sum + expenseAmount(card.amount), 0) - myPaid;

  const settlementSection = balanceAbs > 0.01 ? (() => {
    const theyOwe = balance > 0.01;
    const amtStr = `${_sym} ${formatExpenseCurrency(balanceAbs)}`;
    const whoOwesLabel = theyOwe
      ? (_t("settle.they_owe_label") || "{{name}} owes").replace("{{name}}", escapeHtml(coparentName))
      : (_t("settle.you_owe_label") || "You owe");
    const whoOwesClass = theyOwe ? "balance-positive" : "balance-negative";
    const btnLabel = theyOwe
      ? (_t("settle.send_btn") || "Send transfer request {{amt}}").replace("{{amt}}", amtStr)
      : (_t("settle.transfer_btn") || "Transfer {{amt}} to {{name}}").replace("{{amt}}", amtStr).replace("{{name}}", escapeHtml(coparentName));
    return `
      <div class="settlement-banner">
        <div class="settlement-banner-top">
          <div>
            <span class="settlement-label">${_t("settle.to_settle") || "To settle"}</span>
            <strong class="settlement-amount">${amtStr}</strong>
          </div>
          <div><span class="settlement-who-owes ${whoOwesClass}">${whoOwesLabel}</span></div>
        </div>
        <button class="settlement-request-btn" type="button" id="sendSettlementBtn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          ${escapeHtml(btnLabel)}
        </button>
      </div>`;
  })() : "";

  featureModule.innerHTML = `
    <section class="finance-hero">
      <div>
        <span>${_t("expense.total")}</span>
        <strong>${_sym} ${formatExpenseCurrency(total)}</strong>
        <p>${_t("expense.desc")}</p>
      </div>
      <div class="expense-hero-actions">
        <button class="primary-button" type="button" id="addExpenseButton">${_t("expense.add")}</button>
        <button class="secondary-button" type="button" id="exportExpensesPdfButton">${_t("expense.export_pdf") || "Export PDF"}</button>
        <button class="ghost-button" type="button" id="exportExpensesButton">${_t("expense.export_csv") || "Export CSV"}</button>
      </div>
    </section>
    ${settlementSection}

    <div class="expense-tab-bar">
      <button class="cal-panel-tab active" data-expense-tab="monthly">Monthly</button>
      <button class="cal-panel-tab" data-expense-tab="recurring">&#x21BB; Recurring</button>
    </div>

    <div class="expense-month-filter">
      <label style="font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px;">
        <span>Month:</span>
        <select id="expenseMonthSelect" style="font-size:13px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface-input);color:var(--ink);">
          ${months.map((m) => `<option value="${m.value}" ${m.value === selectedMonth ? "selected" : ""}>${m.label}</option>`).join("")}
        </select>
      </label>
    </div>

    <section class="expense-summary-panel">
      <div class="expense-summary-row">
        <span>${_t("expense.all")}</span>
        <strong>${expenseCards.length}</strong>
      </div>
      <div class="expense-summary-row">
        <span>${_t("expense.open")}</span>
        <strong>${openCards.length} · ${_sym} ${formatExpenseCurrency(openCards.reduce((sum, card) => sum + expenseAmount(card.amount), 0))}</strong>
      </div>
      <div class="expense-summary-row">
        <span>${_t("expense.paid")}</span>
        <strong>${paidCards.length} · ${_sym} ${formatExpenseCurrency(paidCards.reduce((sum, card) => sum + expenseAmount(card.amount), 0))}</strong>
      </div>
      <div class="expense-summary-row">
        <span style="font-size:12px;color:var(--muted);">${escapeHtml(myName || "You")} paid</span>
        <strong style="font-size:13px;">${_sym} ${formatExpenseCurrency(myPaid)}</strong>
      </div>
      <div class="expense-summary-row">
        <span style="font-size:12px;color:var(--muted);">${escapeHtml(coparentName)} paid</span>
        <strong style="font-size:13px;">${_sym} ${formatExpenseCurrency(coPaid)}</strong>
      </div>
      <div class="expense-summary-row expense-summary-balance">
        <span>${_t("expense.balance")}</span>
        <strong>${balanceLabel}</strong>
      </div>
    </section>

    <section class="upcoming-expenses">
      <div class="agenda-heading">
        <div>
          <span>${_t("nav.expenses")}</span>
          <strong>${months.find((m) => m.value === selectedMonth)?.label ?? _t("nav.expenses")}</strong>
        </div>
      </div>
      <div class="upcoming-expense-list">
        ${expenseCards.length
          ? expenseCards.map((card) => renderExpenseCard(card)).join("")
          : `<article class="agenda-empty">${_t("expense.no_expenses")}</article>`}
      </div>
    </section>
  `;

  featureModule.querySelector("#addExpenseButton")?.addEventListener("click", () => _openNewExpenseCard());

  featureModule.querySelectorAll("[data-expense-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      featureModule.dataset.expenseTab = btn.dataset.expenseTab;
      renderExpensesFeature();
    });
  });

  featureModule.querySelector("#sendSettlementBtn")?.addEventListener("click", () => {
    openSettlementModal({ expenseCards, balance, balanceAbs, coparentName, myName, _sym, selectedMonth });
  });

  featureModule.querySelector("#expenseMonthSelect")?.addEventListener("change", (e) => {
    featureModule.dataset.expenseMonth = e.target.value;
    renderExpensesFeature();
  });

  featureModule.querySelector("#exportExpensesButton")?.addEventListener("click", () => {
    exportExpensesCSV(expenseCards, selectedMonth, _sym);
  });

  featureModule.querySelector("#exportExpensesPdfButton")?.addEventListener("click", () => {
    exportExpensesPdf(selectedMonth, _sym);
  });

  featureModule.querySelectorAll("[data-expense-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const { cardId, expenseAction } = btn.dataset;
      handleExpenseAction(cardId, expenseAction);
    });
  });

  window.bindUnifiedCardInteractions?.(featureModule);
}

function exportExpensesCSV(cards, monthLabel, sym) {
  const headers = ["Title", "Details", "Amount", "Status", "Author", "Assignee", "Due", "Paid"];
  const rows = cards.map((card) => [
    card.title || "",
    card.details || "",
    card.amount || "",
    card.payment_status || card.status || "",
    card.author || "",
    card.assignee || "",
    card.due ? new Date(card.due).toLocaleDateString() : "",
    card.payment_status === "paid" || card.status === "Done" ? "yes" : "no",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses-${monthLabel}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showFeatureToast(`Exported ${cards.length} expenses`);
}

// SEG-16: Client-side PDF export using jsPDF
async function exportExpensesPdf(monthLabel, sym) {
  const btn = featureModule.querySelector("#exportExpensesPdfButton");
  if (btn) { btn.disabled = true; btn.textContent = "Generating..."; }

  try {
    // Fetch expense data with ledger from API
    const authHeader = await (typeof getAuthHeader === "function" ? getAuthHeader() : {});
    const params = new URLSearchParams({ action: "expenses" });
    const res = await fetch(`/api/export-data?${params}`, {
      headers: { ...authHeader },
    });
    if (!res.ok) throw new Error("Export failed: " + res.status);
    const data = await res.json();

    // Load jsPDF on demand
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageW = 210;
    const margin = 16;
    const contentW = pageW - margin * 2;
    let y = margin;

    const fmt = (v) => new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
    const parseAmt = (v) => Number(String(v || "").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;

    // ── Header ──
    doc.setFontSize(18).setFont(undefined, "bold");
    doc.text("Do-Do - Expense Record", margin, y); y += 8;
    doc.setFontSize(10).setFont(undefined, "normal").setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, margin, y);
    doc.text("do-do.app", pageW - margin, y, { align: "right" }); y += 5;
    doc.setTextColor(0);
    doc.setDrawColor(200).line(margin, y, pageW - margin, y); y += 6;

    // ── Summary table ──
    doc.setFontSize(12).setFont(undefined, "bold");
    doc.text("Summary", margin, y); y += 6;
    doc.setFontSize(10).setFont(undefined, "normal");

    const summaryRows = [
      ["Total expenses", String(data.summary.total_expenses)],
      [`Total amount (${sym})`, fmt(data.summary.total_amount)],
      [`Paid (${sym})`, fmt(data.summary.paid_total)],
      [`Outstanding (${sym})`, fmt(data.summary.open_total)],
    ];
    summaryRows.forEach(([label, value]) => {
      doc.text(label, margin, y);
      doc.text(value, pageW - margin, y, { align: "right" });
      y += 5.5;
    });
    y += 3;
    doc.setDrawColor(220).line(margin, y, pageW - margin, y); y += 6;

    // ── Per-expense detail ──
    const EVENT_LABELS = {
      created: "Expense created",
      amount_set: "Amount updated",
      payment_requested: "Payment requested",
      payment_sent: "Payment sent",
      payment_confirmed: "Payment confirmed (Stripe)",
      marked_paid_manual: "Marked as paid manually",
      receipt_uploaded: "Receipt uploaded",
    };

    (data.expenses || []).forEach((card) => {
      if (y > 265) { doc.addPage(); y = margin; }

      doc.setFontSize(11).setFont(undefined, "bold");
      doc.text(card.title || "Expense", margin, y); y += 5;

      doc.setFontSize(9).setFont(undefined, "normal").setTextColor(80);
      const amtStr = card.amount ? `${sym} ${fmt(parseAmt(card.amount))}` : "-";
      const status = card.payment_status === "paid" ? "Paid" : card.payment_status === "pending" ? "Pending" : "Open";
      doc.text(`Amount: ${amtStr}   Status: ${status}   Created: ${new Date(card.created_at).toLocaleDateString("en-GB")}`, margin, y);
      setTextColor(doc, 0); y += 5;

      // Ledger trail
      if (card.ledger && card.ledger.length) {
        doc.setFontSize(8).setTextColor(60);
        card.ledger.forEach((ev) => {
          if (y > 275) { doc.addPage(); y = margin; }
          const label = EVENT_LABELS[ev.event_type] || ev.event_type;
          const evAmt = ev.amount != null ? ` ${ev.currency || sym} ${fmt(ev.amount)}` : "";
          const actor = ev.actor_name ? ` - ${ev.actor_name}` : "";
          const date = new Date(ev.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
          doc.text(`  • ${label}${evAmt}${actor} · ${date}`, margin + 2, y); y += 4.5;
        });
      } else {
        doc.setFontSize(8).setTextColor(150);
        doc.text("  No ledger events recorded", margin + 2, y); y += 4.5;
      }

      doc.setTextColor(0);
      y += 3;
      doc.setDrawColor(230).line(margin, y, pageW - margin, y); y += 4;
    });

    // ── SHA-256 integrity note + footer ──
    if (y > 260) { doc.addPage(); y = margin; }
    y += 4;
    doc.setFontSize(8).setTextColor(120).setFont(undefined, "italic");
    const hash = await computeSha256(JSON.stringify(data.expenses));
    doc.text(`Integrity: SHA-256 ${hash}`, margin, y); y += 5;
    doc.text("This record was generated from a tamper-evident ledger. Events cannot be deleted or edited.", margin, y, { maxWidth: contentW }); y += 5;
    doc.text("Do-Do cannot independently verify the accuracy of information entered by users.", margin, y, { maxWidth: contentW });

    doc.setTextColor(0).setFont(undefined, "normal");

    const filename = `do-do-expenses-${monthLabel || new Date().toISOString().slice(0, 7)}.pdf`;
    doc.save(filename);
    showFeatureToast(`Expense PDF exported (${data.expenses.length} records)`);
  } catch (err) {
    showFeatureToast("PDF export failed: " + err.message);
    console.error("exportExpensesPdf:", err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = window.t?.("expense.export_pdf") || "Export PDF"; }
  }
}

function setTextColor(doc, v) { doc.setTextColor(v); }

async function computeSha256(str) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16) + "...";
  } catch {
    return "(hash unavailable)";
  }
}

// Returns running balance: positive = co-parent owes me, negative = I owe them.
function computeBalance(cards, myName) {
  let balance = 0;
  cards.forEach((card) => {
    const amt = expenseAmount(card.amount);
    if (!amt) return;
    if (card.payment_status === "paid") return; // already settled
    const share = card.payment_amount != null ? parseFloat(card.payment_amount) : amt / 2;
    const iMine = myName && (card.author === myName || card.assignee === myName);
    balance += iMine ? share : -share;
  });
  return balance;
}

function renderExpenseCard(card) {
  const payStatus = card.payment_status || "none";
  const isPaid = payStatus === "paid" || card.status === "Done";
  const isPending = payStatus === "pending";
  const isDisputed = card.status === "Disputed";
  const amount = card.amount ? `<span class="expense-amount">${card.amount}</span>` : "";

  const _et = window.t || ((k) => k);
  // Payment status chip
  let payChip = "";
  if (isPaid) {
    payChip = `<span class="payment-chip payment-chip-paid">${_et("expense.paid")}</span>`;
  } else if (isPending) {
    payChip = `<span class="payment-chip payment-chip-pending">${_et("expense.awaiting")}</span>`;
  }

  // Receipt indicator
  const receiptChip = card.receipt_url
    ? `<a class="payment-chip payment-chip-receipt" href="${card.receipt_url}" target="_blank" rel="noopener" title="View receipt" onclick="event.stopPropagation()">Receipt</a>`
    : "";

  // Actions row
  let actions = "";
  if (!isPaid) {
    const canRequest = !isPending && card.amount && !isDisputed;
    actions = `
      <div class="expense-card-actions">
        ${!isPending && !isDisputed ? `<button class="expense-action-btn approve" data-expense-action="approve" data-card-id="${card.id}">${_et("expense.approve")}</button>` : ""}
        ${!isPending && !isDisputed ? `<button class="expense-action-btn dispute" data-expense-action="dispute" data-card-id="${card.id}">${_et("expense.dispute")}</button>` : ""}
        ${isPending
          ? `<span class="expense-action-pending">${_et("expense.awaiting")}</span>`
          : canRequest
            ? `<button class="expense-action-btn request-payment" data-expense-action="request-payment" data-card-id="${card.id}">${_et("expense.request_pay")}</button>`
            : `<button class="expense-action-btn paid" data-expense-action="paid" data-card-id="${card.id}">${_et("expense.mark_paid")}</button>`
        }
      </div>
    `;
  }

  return `
    <article class="expense-preview-card" data-card-id="${card.id}">
      <div class="expense-card-top">
        <div>
          <strong class="expense-card-title">${escapeHtml(card.title || "Expense")}</strong>
          ${card.details ? `<span class="expense-card-detail">${escapeHtml(card.details)}</span>` : ""}
        </div>
        <div class="expense-card-meta">
          ${amount}
          ${payChip}
          ${receiptChip}
        </div>
      </div>
      ${actions}
    </article>
  `;
}

// Recurring tab card - same as expense card but with freq badge + edit button for creator
function renderRecurringExpenseCard(card, myName) {
  const _t = window.t || ((k) => k);
  const amount = card.amount ? `<span class="expense-amount">${card.amount}</span>` : "";
  const isCreator = myName && card.author === myName;

  const freqLabel = {
    daily:    _t("recurrence.daily")    || "Daily",
    weekly:   _t("recurrence.weekly")   || "Weekly",
    biweekly: _t("recurrence.biweekly") || "Every 2 weeks",
    monthly:  _t("recurrence.monthly")  || "Monthly",
    yearly:   _t("recurrence.yearly")   || "Yearly",
  }[card.recurrence?.freq] || card.recurrence?.freq || "";

  return `
    <article class="expense-preview-card recurring-expense-card" data-card-id="${card.id}">
      <div class="expense-card-top">
        <div>
          <strong class="expense-card-title">${escapeHtml(card.title || "Expense")}</strong>
          ${card.details ? `<span class="expense-card-detail">${escapeHtml(card.details)}</span>` : ""}
          ${freqLabel ? `<span class="recurring-inline-badge">&#x21BB; ${escapeHtml(freqLabel)}</span>` : ""}
        </div>
        <div class="expense-card-meta" style="align-items:flex-start;gap:6px">
          ${amount}
          ${isCreator ? `<button class="expense-action-btn" style="font-size:11px;padding:3px 10px" data-expense-action="edit" data-card-id="${card.id}">${_t("card.edit") || "Edit"}</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function handleExpenseAction(cardId, action) {
  if (!cardId || !action) return;
  if (action === "edit") {
    if (typeof window.openCardDialog === "function") window.openCardDialog(cardId, "info");
    return;
  }
  if (action === "request-payment") {
    // Open the card dialog focused on the payment panel
    if (typeof window.openCardDialog === "function") window.openCardDialog(cardId, "payment");
    return;
  }
  if (action === "paid" && typeof window.quickCompleteCard === "function") {
    window.quickCompleteCard(cardId);
    // SEG-16: log manual mark-paid event
    window.appendExpenseLedger?.({ event_type: "marked_paid_manual", card_id: cardId }).catch(() => {});
    return;
  }
  if (action === "dispute" && typeof window.quickRespondCard === "function") {
    window.quickRespondCard(cardId, "cannot");
    return;
  }
  if (action === "approve" && typeof window.quickRespondCard === "function") {
    window.quickRespondCard(cardId, "will");
    return;
  }
  // Fallback: open card dialog
  if (typeof window.openCardDialog === "function") window.openCardDialog(cardId);
}

// ─── Settlement modal ─────────────────────────────────────────────────────────

async function openSettlementModal({ expenseCards, balance, balanceAbs, coparentName, myName, _sym, selectedMonth }) {
  document.getElementById("settlementDialog")?.remove();

  const _t = window.t || ((k) => k);
  const theyOwe = balance > 0.01;
  const amtStr = `${_sym} ${formatExpenseCurrency(balanceAbs)}`;

  // Unsettled cards that make up the balance
  const unsettled = expenseCards.filter((c) => c.status !== "Done" && c.payment_status !== "paid" && expenseAmount(c.amount) > 0);
  const totalUnsettled = unsettled.reduce((s, c) => s + expenseAmount(c.amount), 0);

  // Per-expense breakdown rows
  const breakdownRows = unsettled.map((c) => {
    const amt = expenseAmount(c.amount);
    const share = c.payment_amount != null ? parseFloat(c.payment_amount) : amt / 2;
    const paidBy = c.author || c.assignee || "";
    const dateStr = c.due ? new Date(c.due).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" }) : "";
    const paidByLabel = paidBy
      ? (_t("settle.paid_by") || "paid by: {{name}}").replace("{{name}}", escapeHtml(paidBy))
      : (_t("settle.shared") || "shared");
    const halfLabel = (_t("settle.half") || "half: {{sym}} {{amt}}").replace("{{sym}}", _sym).replace("{{amt}}", formatExpenseCurrency(share));
    return `
      <div class="sdlg-row">
        <div class="sdlg-row-left">
          <span class="sdlg-row-title">${escapeHtml(c.title || "Expense")}</span>
          <span class="sdlg-row-meta">${dateStr ? dateStr + " · " : ""}${paidByLabel}</span>
        </div>
        <div class="sdlg-row-right">
          <span class="sdlg-row-total">${_sym} ${formatExpenseCurrency(amt)}</span>
          <span class="sdlg-row-share">${halfLabel}</span>
        </div>
      </div>`;
  }).join("");

  const storedPhone = localStorage.getItem("dodo-blik-phone") || "";

  function buildMessage(phone) {
    const blikLine = phone
      ? (_t("settle.blik_line") || "\nBLIK (transfer to number): {{phone}}").replace("{{phone}}", phone)
      : "";
    const lines = unsettled.map((c) => {
      const share = c.payment_amount != null ? parseFloat(c.payment_amount) : expenseAmount(c.amount) / 2;
      return `  - ${c.title || "Expense"}: ${_sym} ${formatExpenseCurrency(share)}`;
    }).join("\n");
    const tpl = theyOwe
      ? (_t("settle.msg_intro_req") || "Hi {{name}},\n\nPlease transfer {{amt}} for shared expenses ({{month}}).\n\nBreakdown:\n{{lines}}\n\nTotal to transfer: {{amt}}{{blik}}\n\nThanks!")
      : (_t("settle.msg_intro_pay") || "Hi {{name}},\n\nSending {{amt}} for shared expenses ({{month}}).\n\nBreakdown:\n{{lines}}\n\nTotal: {{amt}}{{blik}}");
    return tpl
      .replace(/\{\{name\}\}/g, coparentName)
      .replace(/\{\{amt\}\}/g, amtStr)
      .replace("{{month}}", selectedMonth)
      .replace("{{lines}}", lines)
      .replace("{{blik}}", blikLine);
  }

  const balanceLabelPos = (_t("settle.balance_label_pos") || "{{name}} owes").replace("{{name}}", escapeHtml(coparentName));
  const balanceLabelNeg = _t("settle.balance_label_neg") || "You owe";
  const balanceLabel = theyOwe ? balanceLabelPos : balanceLabelNeg;
  const unsettledTotalLabel = (_t("settle.unsettled_total") || "Total unsettled: {{sym}} {{amt}}").replace("{{sym}}", _sym).replace("{{amt}}", formatExpenseCurrency(totalUnsettled));
  const directionKey = theyOwe ? (_t("settle.total_receive") || "receive") : (_t("settle.total_transfer") || "transfer");
  const totalRowLabel = (_t("settle.total_row") || "Total to {{direction}}").replace("{{direction}}", directionKey);
  const sendActionLabel = (_t("settle.send_action") || "Send request for {{amt}}").replace("{{amt}}", amtStr);
  const cancelLabel = _t("cancel") || "Cancel";

  const dialog = document.createElement("dialog");
  dialog.id = "settlementDialog";
  dialog.className = "card-dialog settlement-dialog";
  dialog.innerHTML = `
    <div class="dialog-content sdlg-content">
      <div class="dialog-header">
        <div>
          <p class="eyebrow">${(_t("settle.dialog_eyebrow") || "Finances - {{month}}").replace("{{month}}", escapeHtml(selectedMonth))}</p>
          <h2>${_t("settle.dialog_title") || "Expense settlement"}</h2>
        </div>
        <div class="dialog-header-actions">
          <button class="icon-button" id="sdlgClose" aria-label="Close" title="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <div class="sdlg-balance-strip sdlg-balance-${theyOwe ? "positive" : "negative"}">
        <div>
          <span class="sdlg-balance-label">${balanceLabel}</span>
          <strong class="sdlg-balance-amount">${amtStr}</strong>
        </div>
        <div class="sdlg-balance-breakdown">
          <span>${unsettledTotalLabel}</span>
          <span>${unsettled.length}</span>
        </div>
      </div>

      <div>
        <p class="sdlg-section-label">${_t("settle.breakdown_title") || "Detailed breakdown"}</p>
        <div class="sdlg-rows">
          ${breakdownRows || `<p class="sdlg-empty">${_t("settle.no_items") || "No unsettled expenses"}</p>`}
        </div>
        <div class="sdlg-total-row">
          <span>${totalRowLabel}</span>
          <strong>${amtStr}</strong>
        </div>
      </div>

      <div>
        <label class="sdlg-section-label" for="sdlgBlikPhone">${_t("settle.blik_label") || "BLIK phone number (optional)"}</label>
        <div class="sdlg-blik-row">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          <input id="sdlgBlikPhone" type="tel" class="sdlg-phone-input" placeholder="${_t("settle.blik_placeholder") || "+48 600 000 000"}" value="${escapeHtml(storedPhone)}" />
        </div>
        <p class="sdlg-field-hint">${_t("settle.blik_hint") || "Added to the message. Saved on this device."}</p>
      </div>

      <div>
        <p class="sdlg-section-label">${(_t("settle.message_label") || "Message to {{name}}").replace("{{name}}", escapeHtml(coparentName))}</p>
        <textarea id="sdlgMessage" class="sdlg-message" rows="6">${escapeHtml(buildMessage(storedPhone))}</textarea>
        <p class="sdlg-field-hint">${_t("settle.message_hint") || "Sent to the Expenses thread in Conversations."}</p>
      </div>

      <div class="dialog-actions">
        <button class="ghost-button" id="sdlgCancel">${cancelLabel}</button>
        <button class="primary-button sdlg-send-btn" type="button" id="sdlgSend">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span id="sdlgSendLabel">${sendActionLabel}</span>
        </button>
      </div>
      <p class="sdlg-legal-note">${_t("settle.legal_note") || "Requests are timestamped in the immutable settlement log."}</p>
    </div>`;

  document.body.appendChild(dialog);
  dialog.showModal();

  const close = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector("#sdlgClose").addEventListener("click", close);
  dialog.querySelector("#sdlgCancel").addEventListener("click", close);
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });

  dialog.querySelector("#sdlgBlikPhone").addEventListener("input", (e) => {
    const phone = e.target.value.trim();
    localStorage.setItem("dodo-blik-phone", phone);
    dialog.querySelector("#sdlgMessage").value = buildMessage(phone);
  });

  dialog.querySelector("#sdlgSend").addEventListener("click", async () => {
    const btn = dialog.querySelector("#sdlgSend");
    const labelEl = dialog.querySelector("#sdlgSendLabel");
    const msg = dialog.querySelector("#sdlgMessage").value.trim();
    if (!msg) return;

    btn.disabled = true;
    labelEl.textContent = _t("settle.sending") || "Sending...";

    try {
      if (typeof window.sendMessage === "function") {
        await window.sendMessage("Expenses", msg);
      }
      if (typeof window.appendExpenseLedger === "function") {
        for (const c of unsettled) {
          await window.appendExpenseLedger({
            event_type: "settlement_requested",
            card_id: c.id,
            amount: expenseAmount(c.amount),
            currency: _sym,
            note: `Settlement request ${amtStr} - ${selectedMonth}`,
          }).catch(() => {});
        }
      }
      labelEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${_t("settle.sent") || "Sent!"}`;
      btn.style.background = "var(--accent-green, #15803d)";
      setTimeout(() => close(), 1600);
    } catch (err) {
      console.error("Settlement send error:", err);
      btn.disabled = false;
      labelEl.textContent = _t("settle.error") || "Error - try again";
      btn.style.background = "#dc2626";
    }
  });
}

function expenseAmount(value) {
  return Number(String(value || "").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
}

function formatExpenseCurrency(value) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("de-CH").format(value);
}

let activeMessageTopic = "Schedule";

// Known system/auto-generated comment texts to exclude from the messages page
const SYSTEM_MESSAGE_TEXTS = new Set([
  "Acknowledged", "Please do it", "Can’t do this", "I’ll do it",
  "Marked done", "Marked paid", "Done", "Paid",
  // i18n variants
  "Ich mache das", "Zajmę się tym",
]);

function isSystemComment(comment) {
  if (comment.system === true) return true;
  if (SYSTEM_MESSAGE_TEXTS.has(comment.text?.trim())) return true;
  if (/^Reminder set for /i.test(comment.text)) return true;
  if (/^Recurring reminder/i.test(comment.text)) return true;
  return false;
}

function renderMessagesFeature() {
  const allCards = (typeof state !== "undefined" ? state.cards : []);

  // Cards that have at least one real (non-system) message, sorted latest first
  const cardsWithMessages = allCards
    .map((card) => {
      const realComments = (card.comments || []).filter((c) => !isSystemComment(c));
      return { card, realComments };
    })
    .filter(({ realComments }) => realComments.length > 0)
    .sort((a, b) => {
      const latestA = a.realComments[a.realComments.length - 1];
      const latestB = b.realComments[b.realComments.length - 1];
      const timeA = latestA.createdAt || latestA.time || "";
      const timeB = latestB.createdAt || latestB.time || "";
      if (timeA === "Just now") return -1;
      if (timeB === "Just now") return 1;
      if (timeA && timeB) return new Date(timeB) - new Date(timeA);
      return 0;
    });

  const setup = window.getOnboardingState?.() || {};
  const myName = setup.parents?.primary || "Parent A";

  featureModule.innerHTML = `
    <div class="messages-feed">
      ${cardsWithMessages.length === 0 ? `
        <div class="messages-empty">
          <p>No card messages yet. Open a card and type a message to start a thread.</p>
        </div>
      ` : cardsWithMessages.map(({ card, realComments }) => {
        const last = realComments[realComments.length - 1];
        const count = realComments.length;
        const authorDisplay = window.displayPersonName?.(last.author) || last.author;
        const contextTags = [card.topic, card.type, card.child].filter(Boolean);
        const esc = (s) => window.escapeHtml?.(s) || s || "";
        return `
          <article class="messages-feed-card" data-open-card="${card.id}" role="button" tabindex="0">
            <div class="messages-feed-card-header">
              <strong class="messages-feed-title">${esc(card.title)}</strong>
              ${contextTags.length ? `<div class="messages-feed-tags">${contextTags.map((t) => `<span class="meta-chip card-tag">${esc(t)}</span>`).join("")}</div>` : ""}
            </div>
            <div class="messages-feed-last">
              <span class="messages-feed-author">${esc(authorDisplay)}:</span>
              <span class="messages-feed-body">${esc(last.text)}</span>
            </div>
            <div class="messages-feed-meta">
              <span class="messages-feed-time">${esc(last.time)}</span>
              <span class="messages-feed-count">${count} message${count === 1 ? "" : "s"}</span>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;

  featureModule.querySelectorAll("[data-open-card]").forEach((el) => {
    const open = () => window.openCardDialog?.(el.dataset.openCard, "messages");
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(); });
  });
}

async function loadAndRenderMessages(topic) {
  const list = featureModule.querySelector("#messageList");
  if (!list) return;

  const hasPair = Boolean(window.getCurrentPairId?.());
  if (!hasPair) {
    list.innerHTML = `<p style="padding:24px 16px;color:var(--muted);font-size:13px;text-align:center;">Connect with your co-parent first to start messaging.</p>`;
    return;
  }

  const messages = await window.loadMessages?.(topic) || [];

  if (!messages.length) {
    list.innerHTML = `<p style="padding:24px 16px;color:var(--muted);font-size:13px;text-align:center;">No messages yet in #${topic.toLowerCase()}. Send the first one.</p>`;
    return;
  }

  const userId = window.getCurrentUserId?.();
  list.innerHTML = messages.map((msg) => renderRealMessage(msg, userId)).join("");
  list.scrollTop = list.scrollHeight;
}

function appendMessageToList(msg) {
  const list = featureModule.querySelector("#messageList");
  if (!list) return;
  // Remove empty state if present
  const empty = list.querySelector("p");
  if (empty) empty.remove();
  const userId = window.getCurrentUserId?.();
  list.insertAdjacentHTML("beforeend", renderRealMessage(msg, userId));
  list.scrollTop = list.scrollHeight;
}

function renderRealMessage(msg, currentUserId) {
  const own = msg.sender_id === currentUserId;
  const setup = window.getOnboardingState?.() || {};
  const name = own
    ? (setup.parents?.primary || "You")
    : (setup.parents?.coparent || "Co-parent");
  const initial = name.charAt(0).toUpperCase();
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return `
    <article class="message-card ${own ? "own-message" : ""}">
      <div class="message-avatar ${own ? "parent-a-mini" : "parent-b-mini"}">${initial}</div>
      <div>
        <div class="message-meta"><strong>${escapeHtml(name)}</strong><span>${time}</span></div>
        <p>${escapeHtml(msg.body)}</p>
        <div class="message-reactions">
          <button type="button">OK</button>
          <button type="button">Noted</button>
        </div>
      </div>
    </article>
  `;
}

function renderMessage(initial, name, text, time, own, tags = []) {
  return `
    <article class="message-card ${own ? "own-message" : ""}">
      <div class="message-avatar ${own ? "parent-a-mini" : "parent-b-mini"}">${initial}</div>
      <div>
        <div class="message-meta"><strong>${name}</strong><span>${time}</span></div>
        <p>${text}</p>
        ${window.renderMessageTags?.(tags, "message-auto-tags") || ""}
        <div class="message-reactions">
          <button type="button">OK</button>
          <button type="button">Noted</button>
          <button type="button">Reply</button>
        </div>
      </div>
    </article>
  `;
}

// ── Inline panel render helpers ──────────────────────────────────────────────

function _renderSchedulePanelHTML() {
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";
  const myName = setup.parents?.primary || "Parent A";
  const divorced = isDivorced();
  const sp = _getSchedPanelState();
  const _loc2 = _getDateLocale();
  const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(_loc2, { month: "long" }));
  const CUSTODY_COLORS_LOCAL = [
    { value: "#6366f1", label: "Indigo" }, { value: "#22c55e", label: "Green" },
    { value: "#f59e0b", label: "Amber" }, { value: "#ef4444", label: "Red" },
    { value: "#3b82f6", label: "Blue" }, { value: "#ec4899", label: "Pink" },
    { value: "#14b8a6", label: "Teal" }, { value: "#a855f7", label: "Purple" },
  ];

  function _spGetOwner(dateStr) {
    const ov = (sp.working.overrides || {})[dateStr];
    if (ov === "mine" || ov === "co") return ov;
    if (ov && ov.type === "split") return "split";
    if (!sp.working.referenceDate || !sp.working.enabled) return null;
    const d = parseCalendarKey(dateStr);
    const ref = new Date(sp.working.referenceDate + "T00:00:00");
    const diff = Math.round((d - ref) / 86400000);
    const t = sp.working.type || "7-7";
    if (t === "7-7") return ((Math.floor(diff / 7) % 2) + 2) % 2 === 0 ? "mine" : "co";
    if (t === "2-2-3") { const p = ((diff % 14) + 14) % 14; return p <= 1 ? "mine" : p <= 3 ? "co" : "mine"; }
    if (t === "5-2") { const dow = d.getDay(); return (dow === 0 || dow === 6) ? "co" : "mine"; }
    return null;
  }

  // Month calendar
  const ws = parseInt(localStorage.getItem("do-do-week-start") || "1");
  const _loc3 = _getDateLocale();
  const headers = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2000, 0, 2 + (i + ws) % 7);
    return d.toLocaleDateString(_loc3, { weekday: "narrow" });
  });
  const firstDay = new Date(sp.viewYear, sp.viewMonth, 1);
  const startDow = (firstDay.getDay() - ws + 7) % 7;
  const daysInMonth = new Date(sp.viewYear, sp.viewMonth + 1, 0).getDate();
  const todayStr = toCalendarKey(new Date());
  let rows = "";
  let dayNum = 1;
  for (let r = 0; r < 6; r++) {
    rows += "<tr>";
    for (let c = 0; c < 7; c++) {
      const ci = r * 7 + c;
      if (ci < startDow || dayNum > daysInMonth) { rows += "<td></td>"; continue; }
      const dateStr = `${sp.viewYear}-${String(sp.viewMonth + 1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
      const owner = _spGetOwner(dateStr);
      const ov = (sp.working.overrides || {})[dateStr];
      const isSplit = ov && ov.type === "split";
      let cls = "sched-day-btn";
      if (owner === "mine") cls += " sched-mine";
      else if (owner === "co") cls += " sched-co";
      else if (owner === "split") cls += " sched-split";
      if (sp.selectedDays.has(dateStr)) cls += " sched-selected";
      if (dateStr === todayStr) cls += " sched-today";
      if (ov) cls += " sched-override";
      if (divorced && dateStr in sp.changedDays) cls += " sched-pending";
      rows += `<td><button class="${cls}" type="button" data-sp-date="${dateStr}">${dayNum}${isSplit ? '<span class="sched-split-dot">&#8596;</span>' : ""}</button></td>`;
      dayNum++;
    }
    rows += "</tr>";
    if (dayNum > daysInMonth) break;
  }
  const selCount = sp.selectedDays.size;
  const selHint = selCount > 0 ? `<span class="sched-sel-count">${selCount} day${selCount > 1 ? "s" : ""} selected</span>` : "";

  // Day chip panel
  let dayPanelHtml = `<p class="sched-day-hint">Tap a day to set who has the children.</p>`;
  if (sp.selectedDays.size > 0) {
    let dayLabel = "";
    let showSplit = false, splitTime = "12:00", splitMorning = "mine";
    if (sp.selectedDays.size === 1) {
      const ds = [...sp.selectedDays][0];
      const d = parseCalendarKey(ds);
      dayLabel = d.toLocaleDateString(_getDateLocale(), { weekday: "long", day: "numeric", month: "short" });
      const ov2 = (sp.working.overrides || {})[ds];
      showSplit = ov2 && ov2.type === "split";
      if (showSplit) { splitTime = ov2.time || "12:00"; splitMorning = ov2.morning || "mine"; }
    } else {
      dayLabel = `${sp.selectedDays.size} days selected`;
    }
    const owners2 = [...sp.selectedDays].map(ds => _spGetOwner(ds));
    const allSame = owners2.every(o => o === owners2[0]);
    const sharedOwner = allSame ? owners2[0] : null;
    dayPanelHtml = `
      <div class="sched-day-panel">
        <div class="sched-day-label">
          ${dayLabel}
          ${sp.selectedDays.size > 1 ? `<button class="sched-clear-sel" type="button" id="spClearSelBtn">Clear</button>` : ""}
        </div>
        <div class="sched-day-chips">
          <button class="custody-chip${sharedOwner === "mine" ? " active" : ""}" type="button" data-sp-owner="mine">${myName}</button>
          <button class="custody-chip${sharedOwner === "co" ? " active" : ""}" type="button" data-sp-owner="co">${coparentName}</button>
          <button class="custody-chip${sharedOwner === "split" ? " active" : ""}" type="button" data-sp-owner="split">Split &#8596;</button>
          <button class="custody-chip custody-chip-secondary" type="button" data-sp-owner="auto">Auto</button>
        </div>
        ${showSplit ? `
          <div class="sched-handover-panel">
            <label class="sched-handover-field"><span>Handover time</span><input type="time" id="spSplitTime" value="${splitTime}" /></label>
            <label class="sched-handover-field"><span>Morning with</span>
              <select id="spSplitMorning">
                <option value="mine"${splitMorning === "mine" ? " selected" : ""}>${myName}</option>
                <option value="co"${splitMorning === "co" ? " selected" : ""}>${coparentName}</option>
              </select>
            </label>
          </div>` : ""}
      </div>`;
  }

  // Color swatches helper
  function swatchRow(target, label) {
    const COLORS_REF = typeof CUSTODY_COLORS !== "undefined" ? CUSTODY_COLORS : CUSTODY_COLORS_LOCAL;
    return `<div class="custody-dialog-swatch-row">
      <span class="custody-dialog-swatch-label">${label}</span>
      <div class="custody-color-swatches" data-sp-color-target="${target}">
        ${COLORS_REF.map(c => `<button type="button" class="custody-swatch${sp.working[target] === c.value ? " active" : ""}" data-sp-color="${c.value}" style="background:${c.value};" title="${c.label}" aria-label="${c.label}"></button>`).join("")}
      </div>
    </div>`;
  }

  // Pending changes summary (divorced mode)
  const pendingEntries = Object.entries(sp.changedDays);
  const pendingHtml = (divorced && pendingEntries.length) ? `
    <div class="sched-pending-section">
      <strong>Proposed changes (${pendingEntries.length})</strong>
      <ul class="sched-pending-list">${pendingEntries.map(([ds, ch]) => {
        const lbl = ch.owner === "mine" ? myName : ch.owner === "co" ? coparentName : ch.owner === "split" ? "Split" : "Auto";
        return `<li>${ds}: <strong>${lbl}</strong></li>`;
      }).join("")}</ul>
      <button class="custody-chip custody-chip-reset" type="button" id="spClearPendingBtn" style="margin-top:6px;font-size:11px;">Clear all</button>
    </div>` : "";

  const _tsp = window.t || ((k, fb) => fb || k);
  const hasPending = divorced && pendingEntries.length > 0;
  const saveLabel = hasPending ? _tsp("sched.request_changes", "Request changes") : _tsp("sched.save", "Save schedule");
  const showRefRow = sp.working.type !== "5-2" && sp.working.type !== "manual";

  return `
    <div class="cal-inline-panel-schedule">
      <div class="custody-dialog-fields" style="margin-bottom:10px;">
        <label class="clean-field custody-dialog-field">
          <span>${_tsp("sched.pattern", "Schedule pattern")}</span>
          <select id="spType">
            <option value="7-7"${sp.working.type === "7-7" ? " selected" : ""}>${_tsp("custody.7_7", "Alternating weeks (7-7)")}</option>
            <option value="2-2-3"${sp.working.type === "2-2-3" ? " selected" : ""}>${_tsp("custody.2_2_3", "2-2-3 rotation")}</option>
            <option value="5-2"${sp.working.type === "5-2" ? " selected" : ""}>${_tsp("custody.5_2", "Weekdays / weekends split")}</option>
            <option value="manual"${sp.working.type === "manual" ? " selected" : ""}>${_tsp("sched.manual", "Manual (set each day)")}</option>
          </select>
        </label>
        <label class="clean-field custody-dialog-field" id="spRefRow"${showRefRow ? "" : ' style="display:none"'}>
          <span>${_tsp("sched.my_starts", "My schedule starts")}</span>
          <input type="date" id="spRefDate" value="${sp.working.referenceDate || toCalendarKey(new Date())}" />
        </label>
        ${swatchRow("myColor", _tsp("sched.my_days", "My days colour"))}
        ${swatchRow("coColor", _tsp("sched.co_days", "Co-parent days colour"))}
      </div>
      <div class="sched-month-cal">
        <div class="mc-header">
          <button class="mc-nav" type="button" id="spCalPrev">&#8249;</button>
          <span class="mc-month-label">${MONTH_NAMES[sp.viewMonth]} ${sp.viewYear}</span>
          <button class="mc-nav" type="button" id="spCalNext">&#8250;</button>
        </div>
        <table class="sched-cal-table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${selHint}
      </div>
      <div id="spDayPanel">${dayPanelHtml}</div>
      ${divorced ? `<div class="sched-divorced-notice">${_tsp("sched.divorced_notice", "Separated/divorced mode - schedule changes are sent to {{name}} for approval and stored for court records.").replace("{{name}}", escapeHtml(coparentName))}</div>` : ""}
      ${pendingHtml}
      <div class="sched-propagate-section">
        <span class="sched-propagate-label">${_tsp("sched.propagate_short", "Propagate:")}</span>
        <div class="sched-propagate-chips">
          <button class="custody-chip" type="button" data-sp-propagate="this-week-all">${_tsp("sched.this_week_all", "This week - all weeks")}</button>
          <button class="custody-chip" type="button" data-sp-propagate="3">${_tsp("sched.3mo_short", "3 months")}</button>
          <button class="custody-chip" type="button" data-sp-propagate="6">${_tsp("sched.6mo_short", "6 months")}</button>
          <button class="custody-chip" type="button" data-sp-propagate="12">${_tsp("sched.full_year", "Full year")}</button>
        </div>
      </div>
      <div class="sched-panel-actions">
        <button class="ghost-button sched-clear-schedule-btn" type="button" id="spClearSchedBtn">${_tsp("sched.clear", "Clear entire schedule")}${divorced ? " " + _tsp("sched.requires_approval", "(requires approval)") : ""}</button>
        <button class="primary-button" type="button" id="spSaveBtn">${saveLabel}</button>
      </div>
    </div>`;
}

function _renderChangesPanelHTML() {
  const allLocalCRs = loadChangeRequests();
  const localLinkedCardIds = new Set(allLocalCRs.map(c => c.supabaseCardId).filter(Boolean));
  const allScrCards = (typeof state !== "undefined" ? state.cards : [])
    .filter(card => card.details?.startsWith("__SCR_") && !localLinkedCardIds.has(card.id));

  const pendingCRs = allLocalCRs.filter(c => c.status === "pending");
  const resolvedCRs = allLocalCRs.filter(c => c.status !== "pending");
  const total = allLocalCRs.length + allScrCards.length;

  if (total === 0) {
    return `
      <div class="cal-inline-panel-changes">
        <p class="agenda-empty" style="margin-top:16px;">No change requests yet.</p>
        <button class="custody-schedule-btn" type="button" id="changesNewRequestBtn" style="margin-top:12px;">&#8596; New change request</button>
      </div>`;
  }

  const pendingSection = (pendingCRs.length || allScrCards.length) ? `
    <div class="changes-section-label">Pending (${pendingCRs.length + allScrCards.length})</div>
    ${pendingCRs.map(cr => renderChangeRequestAgendaItem(cr)).join("")}
    ${allScrCards.map(card => renderScrCardAgendaItem(card)).join("")}` : "";

  const resolvedSection = resolvedCRs.length ? `
    <div class="changes-section-label" style="margin-top:16px;">Resolved (${resolvedCRs.length})</div>
    ${resolvedCRs.map(cr => renderChangeRequestAgendaItem(cr)).join("")}` : "";

  return `
    <div class="cal-inline-panel-changes">
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
        <button class="custody-schedule-btn" type="button" id="changesNewRequestBtn">&#8596; New request</button>
      </div>
      ${pendingSection}
      ${resolvedSection}
    </div>`;
}

function _renderVacationsPanelHTML() {
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";
  const _locWd = _getDateLocale();
  const weekDayNames = Array.from({ length: 7 }, (_, i) => new Date(2000, 0, 2 + i).toLocaleDateString(_locWd, { weekday: "long" }));
  const vp = _panelVacState;
  const vacations = loadVacations();

  // Pre-fill when entering edit mode
  if (vp.editingId && !vp._editLoaded) {
    const editing = vacations.find(v => v.id === vp.editingId);
    if (editing) {
      vp.rangeStart = editing.startDate;
      vp.rangeEnd = editing.endDate;
      vp.viewYear = parseInt(editing.startDate.slice(0, 4));
      vp.viewMonth = parseInt(editing.startDate.slice(5, 7)) - 1;
      vp._editLoaded = true;
    }
  }
  if (!vp.editingId) vp._editLoaded = false;

  const editing = vp.editingId ? vacations.find(v => v.id === vp.editingId) : null;
  const editOwner = editing?.owner || "mine";
  const editAltStart = editing?.alternatingStart || "mine";

  const vacListHtml = vacations.length === 0
    ? `<p class="vac-empty-msg">No vacation periods yet.</p>`
    : vacations.map(v => {
        const ownerLabel = v.owner === "mine" ? "Your days"
          : v.owner === "co" ? `${escapeHtml(coparentName)}'s days`
          : `Alternating (starts: ${v.alternatingStart === "mine" ? "you" : escapeHtml(coparentName)})`;
        const isEdit = vp.editingId === v.id;
        return `<div class="vacation-list-item${isEdit ? " vac-editing" : ""}">
          <div class="vacation-list-info">
            <strong>${escapeHtml(v.name || "Vacation")}</strong>
            <span>${v.startDate} - ${v.endDate}</span>
            <span class="vacation-list-owner">${ownerLabel}</span>
          </div>
          <div class="vac-item-actions">
            <button class="vac-edit-btn${isEdit ? " active" : ""}" type="button" data-vp-edit="${v.id}" title="Edit">&#9998;</button>
            <button class="custody-chip custody-chip-reset" type="button" data-vp-delete="${v.id}">Remove</button>
          </div>
        </div>`;
      }).join("");

  const rangeCalHtml = _buildVacRangeCalHTML({ ...vp, weekStart: vp.weekStart }, vacations)
    .replace(/id="vacCalPrev"/g, 'id="vpCalPrev"')
    .replace(/id="vacCalNext"/g, 'id="vpCalNext"')
    .replace(/data-vac-date=/g, 'data-vp-date=')
    .replace(/id="vacRangeClear"/g, 'id="vpRangeClear"');

  const rangeInputs = `
    <div class="vac-date-inputs-row">
      <label class="clean-field">
        <span>Start date</span>
        <input type="date" id="vpStartDateInput" value="${vp.rangeStart || ""}" />
      </label>
      <label class="clean-field">
        <span>End date</span>
        <input type="date" id="vpEndDateInput" value="${vp.rangeEnd || ""}" />
      </label>
      ${vp.rangeStart ? `<button class="vac-range-clear-btn" type="button" id="vpRangeClear" style="align-self:flex-end;margin-bottom:6px;" title="Clear dates">&#10005;</button>` : ""}
    </div>
    <p class="vac-date-hint">Leave end date empty for a single exchange day.</p>`;

  const saveLabel = isDivorced() ? (vp.editingId ? "Request update" : "Request vacation") : (vp.editingId ? "Update vacation" : "Add vacation");

  return `
    <div class="cal-inline-panel-vacations">
      ${isDivorced() ? `<div class="sched-divorced-notice" style="margin-bottom:10px;">Separated/divorced mode - vacation changes sent to ${escapeHtml(coparentName)} for approval.</div>` : ""}
      <div id="vpVacationsList">${vacListHtml}</div>
      <div class="vac-form-section">
        <div class="vac-form-heading">${vp.editingId ? "Edit vacation" : "Add vacation"}</div>
        ${rangeCalHtml}
        ${rangeInputs}
        <label class="clean-field" style="margin-top:10px;">
          <span>Name</span>
          <input type="text" id="vpVacName" placeholder='e.g. "Summer 2026"' value="${escapeHtml(editing?.name || "")}" />
        </label>
        <label class="clean-field">
          <span>Who has the kids?</span>
          <select id="vpVacOwner">
            <option value="mine"${editOwner === "mine" ? " selected" : ""}>Your days (whole period)</option>
            <option value="co"${editOwner === "co" ? " selected" : ""}>${escapeHtml(coparentName)}'s days</option>
            <option value="alternating"${editOwner === "alternating" ? " selected" : ""}>Alternating weeks</option>
          </select>
        </label>
        <div id="vpAlternatingRows" class="${editOwner === "alternating" ? "" : "hidden"}">
          <label class="clean-field">
            <span>First week with</span>
            <select id="vpAlternatingStart">
              <option value="mine"${editAltStart === "mine" ? " selected" : ""}>You</option>
              <option value="co"${editAltStart === "co" ? " selected" : ""}>${escapeHtml(coparentName)}</option>
            </select>
          </label>
          <label class="clean-field">
            <span>Week starts on</span>
            <select id="vpWeekStartDay">
              ${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}"${vp.weekStart === d ? " selected" : ""}>${weekDayNames[d]}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="vac-form-btns">
          <button class="primary-button" type="button" id="vpSaveVacBtn">${saveLabel}</button>
          ${vp.editingId ? `<button class="custody-chip custody-chip-reset" type="button" id="vpCancelVacEdit">Cancel</button>` : ""}
        </div>
      </div>
    </div>`;
}

function renderCalendarFeature(data) {
  window._lastFeatureData = data; // store for custody dialog refresh
  syncCalendarEventsFromCards();
  const selectedDate = parseCalendarKey(calendarState.selected);
  const selectedEvents = eventsForDate(calendarState.selected);
  const custody = getCustodySchedule();
  const selectedOwner = custody.enabled ? getCustodyOwner(selectedDate) : null;
  const hasOverride = custody.enabled && !!(custody.overrides || {})[calendarState.selected];
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";

  // Custody status strip for agenda panel
  const custodyStrip = custody.enabled ? (() => {
    const ov = (custody.overrides || {})[calendarState.selected];
    const isSplit = ov && ov.type === "split";
    const ownerLabel = selectedOwner === "mine" ? "Your day"
      : selectedOwner === "co" ? `${coparentName}'s day`
      : selectedOwner === "split" ? "Split day"
      : "";
    const dotColor = selectedOwner === "mine" ? custody.myColor
      : selectedOwner === "co" ? custody.coColor : "#76808a";

    return `
      <div class="custody-day-strip">
        <div class="custody-day-who">
          <span class="custody-day-dot-sm" style="background:${dotColor};"></span>
          <strong>${ownerLabel || (window.t?.("cal.no_schedule") ?? "No schedule set")}</strong>
          ${hasOverride ? `<span class="custody-override-badge">${window.t?.("cal.overridden") ?? "overridden"}</span>` : ""}
          ${isSplit ? `<span class="custody-split-time">${window.t?.("cal.handover") ?? "Handover"} ${ov.time}</span>` : ""}
        </div>
        <div class="custody-day-actions">
          <button class="custody-chip ${selectedOwner === "mine" ? "active" : ""}" type="button" data-custody-override="mine">${window.t?.("cal.mine") ?? "Mine"}</button>
          <button class="custody-chip ${selectedOwner === "co" ? "active" : ""}" type="button" data-custody-override="co">${coparentName}</button>
          <button class="custody-chip" type="button" data-custody-override="split">Split</button>
          ${hasOverride ? `<button class="custody-chip custody-chip-reset" type="button" data-custody-override="auto">Reset</button>` : ""}
          <button class="custody-chip custody-chip-secondary" type="button" id="requestChangeBtn" title="Request a custody day change">↔ Change</button>
        </div>
        ${getActiveVacation(selectedDate) ? `<div class="custody-vacation-banner"><span>✈ Vacation period</span><button class="ghost-button" type="button" id="openVacationsBtn" style="font-size:12px;padding:2px 8px;">Manage</button></div>` : ""}
      </div>`;
  })() : "";

  // Week overview strip (desktop) - shows whole selected week at a glance
  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekHasOverrides = weekDays.some((d) => !!(custody.overrides || {})[toCalendarKey(d)]);

  const weekOverview = custody.enabled ? (() => {
    return `
      <div class="custody-week-overview" aria-label="Week custody overview">
        ${weekDays.map((d) => {
          const k = toCalendarKey(d);
          const evts = eventsForDate(k);
          const isSelected = k === calendarState.selected;
          const custClass = getCustodyClass(d);
          return `<button class="custody-week-ov-day${isSelected ? " selected" : ""}${custClass ? " " + custClass : ""}" type="button" data-calendar-day="${k}" title="${weekdayLabel(d)} ${d.getDate()}">
            <span class="custody-week-ov-label">${weekdayLabel(d)}</span>
            <strong class="custody-week-ov-num">${d.getDate()}</strong>
            ${evts.length ? `<em class="custody-week-ov-count">${evts.length}</em>` : ""}
          </button>`;
        }).join("")}
      </div>
      <div class="custody-propagate-row">
        <button class="ghost-button" type="button" id="propagateWeekBtn" style="font-size:12px;color:var(--muted);padding:4px 10px;">
          Apply this week's schedule to all weeks
        </button>
      </div>`;
  })() : "";

  featureModule.innerHTML = `
    <div class="calendar-layout">
    <div class="calendar-shell">
      <div class="calendar-topline">
        <button class="round-nav" type="button" data-calendar-nav="-1" aria-label="Previous ${calendarState.view === "month" ? "month" : "week"}">‹</button>
        <div>
          <span class="calendar-kicker">${window.t?.(`cal.view.${calendarState.view}`) ?? capitalize(calendarState.view)}</span>
          <strong>${formatMonthYear(calendarState.cursor)}</strong>
        </div>
        <button class="round-nav" type="button" data-calendar-nav="1" aria-label="Next ${calendarState.view === "month" ? "month" : "week"}">›</button>
      </div>
      <div class="calendar-view-switcher" aria-label="Calendar views">
        ${["month", "week", "day"].map((view) => `
          <button class="${calendarState.view === view ? "active" : ""}" type="button" data-calendar-view="${view}">${window.t?.(`cal.view.${view}`) ?? capitalize(view)}</button>
        `).join("")}
      </div>
      <div class="calendar-body">
        ${renderCalendarBody()}
      </div>
      ${(() => {
        const aut = window.getAutomationSettings?.() || {};
        const wcc = Array.isArray(aut.workCalendarConnections) ? aut.workCalendarConnections : [];
        const familyOk = Boolean(aut.syncFamilyCalendar);
        const workGoogleOk = wcc.includes("google");
        const workMsOk = wcc.includes("outlook");
        // Friendly labels - shown as-is regardless of language
        const calIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;
        const gearIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`;
        return `
        <div class="cal-sync-strip">
          <button class="custody-schedule-btn cal-sync-item${familyOk ? " cal-sync-connected" : ""}" type="button" data-sync-goto="family">
            ${calIcon} Wspólny kalendarz${familyOk ? " ✓" : ""}
          </button>
          <button class="custody-schedule-btn cal-sync-item${workGoogleOk ? " cal-sync-connected" : ""}" type="button" data-sync-goto="work-google">
            ${calIcon} Google Work${workGoogleOk ? " ✓" : ""}
          </button>
          <button class="custody-schedule-btn cal-sync-item${workMsOk ? " cal-sync-connected" : ""}" type="button" data-sync-goto="work-ms">
            ${calIcon} Microsoft${workMsOk ? " ✓" : ""}
          </button>
          <button class="custody-schedule-btn cal-sync-gear-btn" type="button" data-sync-goto="settings" title="Ustawienia synchronizacji i przypomnień">
            ${gearIcon} Synchronizacja
          </button>
        </div>`;
      })()}
    </div>

    <section class="calendar-agenda">
      <div class="agenda-heading">
        <div>
          <strong>${formatAgendaDate(selectedDate)}</strong>
        </div>
        ${calendarState.rightPanel === "agenda" ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${(() => {
            const _spt = localStorage.getItem("do-do-show-personal-titles") === "true";
            return `<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);cursor:pointer;white-space:nowrap;" title="Show titles from your personal calendar">
              <input type="checkbox" id="showPersonalTitlesToggle" ${_spt ? "checked" : ""} style="margin:0;cursor:pointer;" />
              <span>Moje tytu&#322;y</span>
            </label>`;
          })()}
          <button class="toolbar-new-card feature-action" style="display:inline-flex;" data-action="Add Do">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
            ${window.t?.("board.new_do") ?? "New Do"}
          </button>
        </div>` : ""}
      </div>

      <!-- Panel tab bar (replaces "Selected day" label) -->
      ${(() => {
        const allCRCount = loadChangeRequests().length + (typeof state !== "undefined" ? state.cards : []).filter(c => c.details?.startsWith("__SCR_")).length;
        const vacCount = loadVacations().length;
        const rp = calendarState.rightPanel;
        return `<div class="cal-panel-tabs">
          <button class="cal-panel-tab${rp === "agenda" ? " active" : ""}" type="button" data-cal-panel="agenda">Agenda</button>
          <button class="cal-panel-tab${rp === "schedule" ? " active" : ""}" type="button" data-cal-panel="schedule">Schedule</button>
          <button class="cal-panel-tab${rp === "changes" ? " active" : ""}" type="button" data-cal-panel="changes">
            Changes${allCRCount ? `<span class="tab-badge">${allCRCount}</span>` : ""}
          </button>
          <button class="cal-panel-tab${rp === "vacations" ? " active" : ""}" type="button" data-cal-panel="vacations">
            Vacations${vacCount ? `<span class="tab-badge">${vacCount}</span>` : ""}
          </button>
        </div>`;
      })()}

      <!-- Panel content -->
      <div class="cal-panel-content">
        ${calendarState.rightPanel === "agenda" ? `
          ${weekOverview}
          ${custodyStrip}
          <div class="agenda-list">
            ${selectedEvents.length
              ? selectedEvents.map(renderAgendaCard).join("")
              : `<article class="agenda-empty">${window.t?.("cal.no_dos") ?? "No Dos on this day."}</article>`}
          </div>
        ` : ""}
        ${calendarState.rightPanel === "schedule" ? _renderSchedulePanelHTML() : ""}
        ${calendarState.rightPanel === "changes" ? _renderChangesPanelHTML() : ""}
        ${calendarState.rightPanel === "vacations" ? _renderVacationsPanelHTML() : ""}
      </div>
    </section>
    </div>

    <!-- Teams-style calendar below the main calendar content -->
    <section class="board-cal-section cal-page-variant" id="calPageBcalSection" aria-label="Teams calendar">
      <div class="board-cal-nav">
        <button class="round-nav bcal-edge-btn" type="button" id="calPageBcalPrev" aria-label="Previous">&#8249;</button>
        <div class="board-cal-nav-center">
          <span class="board-cal-nav-title" id="calPageBcalTitle"></span>
          <div class="bcal-toggle">
            <button class="bcal-toggle-btn active" type="button" id="calPageBcalToggleWeek">Week</button>
            <button class="bcal-toggle-btn" type="button" id="calPageBcalToggle3Day">3 Days</button>
          </div>
        </div>
        <button class="round-nav bcal-edge-btn" type="button" id="calPageBcalNext" aria-label="Next">&#8250;</button>
      </div>
      <div class="board-cal-grid-wrap" id="calPageBcalGrid"></div>
    </section>
  `;

  // Render the shared Teams calendar into the calendar page slot
  if (typeof renderBoardCalendar === "function") {
    renderBoardCalendar(window._lastCards || []);
  }

  featureModule.querySelectorAll(".feature-action").forEach((button) => {
    button.addEventListener("click", () => {
      addCalendarEvent();
      showFeatureToast(window.t?.("cal.toast_do_added") ?? "Do added to selected day");
    });
  });

  // Bind week-grid drag-drop (desktop only, noop on mobile)
  if (calendarState.view === "week") {
    const calBody = featureModule.querySelector(".calendar-body");
    if (calBody) _bindWeekGridDragDrop(calBody);
  }

  // Personal calendar title toggle
  featureModule.querySelector("#showPersonalTitlesToggle")?.addEventListener("change", (e) => {
    localStorage.setItem("do-do-show-personal-titles", e.target.checked ? "true" : "false");
    renderCalendarFeature(data);
  });

  featureModule.querySelectorAll("[data-calendar-day]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarState.selected = button.dataset.calendarDay;
      calendarState.cursor = new Date(parseCalendarKey(calendarState.selected).getFullYear(), parseCalendarKey(calendarState.selected).getMonth(), 1);
      renderCalendarFeature(data);
    });
  });

  featureModule.querySelectorAll("[data-calendar-view]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarState.view = button.dataset.calendarView;
      renderCalendarFeature(data);
    });
  });

  featureModule.querySelectorAll("[data-calendar-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      moveCalendar(Number(button.dataset.calendarNav));
      renderCalendarFeature(data);
    });
  });

  featureModule.querySelectorAll("[data-calendar-card]").forEach((button) => {
    button.addEventListener("click", () => openCardDialog(button.dataset.calendarCard));
  });

  // Conflict action buttons - "open cards" opens the first conflicting card
  featureModule.querySelectorAll(".conflict-action").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const resolution = button.dataset.resolution;
      const cardA = button.dataset.conflictA;
      if (resolution === "open" && cardA) {
        window.openCardDialog?.(cardA);
      } else if (resolution === "swap") {
        // Swap: open both cards so user can manually adjust
        window.openCardDialog?.(cardA);
        showFeatureToast("Open both cards and adjust their due times to resolve the conflict");
      }
    });
  });

  // Agenda card clicks - route to card dialog
  featureModule.querySelectorAll(".agenda-card[data-card-id]").forEach((card) => {
    card.addEventListener("click", () => window.openCardDialog?.(card.dataset.cardId));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.openCardDialog?.(card.dataset.cardId); }
    });
  });

  // Open custody schedule dialog - setup wizard when not yet configured, edit dialog when active
  featureModule.querySelector("#openCustodyDialogBtn")?.addEventListener("click", () => {
    const cs = getCustodySchedule();
    if (!cs.enabled) {
      openScheduleSetupDialog();
    } else {
      openCustodyScheduleDialog();
    }
  });

  // Custody day override chips
  featureModule.querySelectorAll("[data-custody-override]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const override = btn.dataset.custodyOverride;
      const dayKey = calendarState.selected;
      if (override === "split") {
        // Show inline time picker in the strip
        const strip = featureModule.querySelector(".custody-day-actions");
        if (strip && !strip.querySelector(".custody-split-picker")) {
          const picker = document.createElement("div");
          picker.className = "custody-split-picker";
          picker.innerHTML = `
            <label style="font-size:12px;color:var(--muted);">Handover time</label>
            <input type="time" value="15:00" id="custodySplitTime" style="font-size:13px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface-input);color:var(--ink);" />
            <button class="custody-chip" type="button" id="custodySplitConfirm">Confirm</button>
          `;
          strip.appendChild(picker);
          picker.querySelector("#custodySplitConfirm")?.addEventListener("click", () => {
            const time = picker.querySelector("#custodySplitTime")?.value || "15:00";
            setCustodyDayOverride(dayKey, { type: "split", time, morning: "mine" });
            renderCalendarFeature(data);
          });
        }
        return;
      }
      setCustodyDayOverride(dayKey, override);
      renderCalendarFeature(data);
    });
  });

  // Week overview day clicks
  featureModule.querySelectorAll(".custody-week-ov-day[data-calendar-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      calendarState.selected = btn.dataset.calendarDay;
      renderCalendarFeature(data);
    });
  });

  // Propagate this week's schedule to all other weeks
  featureModule.querySelector("#propagateWeekBtn")?.addEventListener("click", () => {
    if (!confirm("Apply this week's day-by-day schedule to all other weeks? This will overwrite existing week overrides.")) return;
    propagateWeekSchedule(weekDays, custody);
    renderCalendarFeature(data);
    showFeatureToast("Schedule applied to all weeks");
  });

  // Sync strip buttons - go to settings calendar section
  featureModule.querySelectorAll("[data-sync-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.switchModule("settings");
      // After settings renders, scroll to calendar connections panel
      setTimeout(() => {
        const target = document.querySelector(".google-calendar-connection");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    });
  });

  // "Manage" vacation link inside vacation banner - switch to Vacations tab (handled below with panel handlers)

  // Request custody day change
  featureModule.querySelector("#requestChangeBtn")?.addEventListener("click", () => {
    const owner = getCustodyOwner(selectedDate);
    openChangeRequestDialog(calendarState.selected, owner);
  });

  // Change request approve / decline / delete
  featureModule.querySelectorAll("[data-cr-approve]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.crApprove;
      const crs = loadChangeRequests();
      const cr = crs.find((c) => c.id === id);
      if (cr) {
        cr.status = "approved";
        cr.resolvedAt = new Date().toISOString();
        saveChangeRequests(crs);
        if (cr.type === "vacation") {
          const vacs = loadVacations();
          if (cr.vacAction === "add") saveVacations([...vacs, cr.vacData]);
          else if (cr.vacAction === "update") saveVacations(vacs.map(v => v.id === cr.vacData.id ? cr.vacData : v));
          else if (cr.vacAction === "delete") saveVacations(vacs.filter(v => v.id !== cr.vacData.id));
        } else if (cr.type === "schedule-clear") {
          const sched = getCustodySchedule();
          saveCustodySchedule({ ...sched, overrides: {} });
        } else if (cr.type === "schedule") {
          setCustodyDayOverride(cr.requestedDate, cr.requestedOverride || cr.requestedOwner);
        } else {
          setCustodyDayOverride(cr.requestedDate, cr.requestedOwner);
        }
      }
      renderCalendarFeature(data);
      showFeatureToast("Change approved and applied to schedule");
    });
  });

  featureModule.querySelectorAll("[data-cr-decline]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.crDecline;
      const crs = loadChangeRequests();
      const cr = crs.find((c) => c.id === id);
      if (cr) { cr.status = "declined"; cr.resolvedAt = new Date().toISOString(); saveChangeRequests(crs); }
      renderCalendarFeature(data);
      showFeatureToast("Change request declined");
    });
  });

  featureModule.querySelectorAll("[data-cr-delete]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      saveChangeRequests(loadChangeRequests().filter((c) => c.id !== btn.dataset.crDelete));
      renderCalendarFeature(data);
    });
  });

  // Supabase SCR card approve (co-parent approves, applies change, updates card in Supabase, notifies requester)
  featureModule.querySelectorAll("[data-scr-approve]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const cardId = btn.dataset.scrApprove;
      const card = (typeof state !== "undefined" ? state.cards : []).find((c) => c.id === cardId);
      if (!card) return;
      try {
        if (card.details?.startsWith("__SCR_BATCH__")) {
          const { days } = JSON.parse(card.details.slice("__SCR_BATCH__".length));
          for (const [dateStr, { override, owner }] of Object.entries(days || {})) {
            setCustodyDayOverride(dateStr, override || owner);
          }
        } else if (card.details?.startsWith("__SCR_VAC__")) {
          const { vacAction, vacData } = JSON.parse(card.details.slice("__SCR_VAC__".length));
          const vacs = loadVacations();
          if (vacAction === "add") saveVacations([...vacs, vacData]);
          else if (vacAction === "update") saveVacations(vacs.map((v) => (v.id === vacData.id ? vacData : v)));
          else if (vacAction === "delete") saveVacations(vacs.filter((v) => v.id !== vacData.id));
        } else if (card.details?.startsWith("__SCR_DAY__")) {
          const { requestedDate, requestedOverride, requestedOwner } = JSON.parse(card.details.slice("__SCR_DAY__".length));
          setCustodyDayOverride(requestedDate, requestedOverride || requestedOwner);
        }
      } catch { /* parse error - still update status */ }
      if (window.saveCardToSupabase) await window.saveCardToSupabase({ ...card, status: "Done" });
      _notifyPartner("Do-Do: wniosek zatwierdzony", card.title);
      renderCalendarFeature(data);
      showFeatureToast("Zmiana zatwierdzona i zastosowana");
    });
  });

  // Supabase SCR card decline
  featureModule.querySelectorAll("[data-scr-decline]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const cardId = btn.dataset.scrDecline;
      const card = (typeof state !== "undefined" ? state.cards : []).find((c) => c.id === cardId);
      if (!card) return;
      if (window.saveCardToSupabase) await window.saveCardToSupabase({ ...card, status: "Disputed" });
      _notifyPartner("Do-Do: wniosek odrzucony", card.title);
      renderCalendarFeature(data);
      showFeatureToast("Wniosek odrzucony");
    });
  });

  // ── Tab switching ─────────────────────────────────────────────────────────
  featureModule.querySelectorAll("[data-cal-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      calendarState.rightPanel = btn.dataset.calPanel;
      // Reset schedule panel working state when switching to schedule tab so it picks up latest saved schedule
      if (btn.dataset.calPanel === "schedule") _resetSchedPanelState();
      renderCalendarFeature(data);
    });
  });

  // ── Schedule panel ────────────────────────────────────────────────────────
  const sp = _getSchedPanelState();

  featureModule.querySelector("#spCalPrev")?.addEventListener("click", () => {
    _flushSpSplitInputs();
    sp.selectedDays.clear();
    sp.viewMonth--;
    if (sp.viewMonth < 0) { sp.viewMonth = 11; sp.viewYear--; }
    renderCalendarFeature(data);
  });

  featureModule.querySelector("#spCalNext")?.addEventListener("click", () => {
    _flushSpSplitInputs();
    sp.selectedDays.clear();
    sp.viewMonth++;
    if (sp.viewMonth > 11) { sp.viewMonth = 0; sp.viewYear++; }
    renderCalendarFeature(data);
  });

  featureModule.querySelectorAll("[data-sp-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      _flushSpSplitInputs();
      const ds = btn.dataset.spDate;
      if (sp.selectedDays.has(ds)) sp.selectedDays.delete(ds);
      else sp.selectedDays.add(ds);
      renderCalendarFeature(data);
    });
  });

  featureModule.querySelectorAll("[data-sp-owner]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (sp.selectedDays.size === 0) return;
      const owner = btn.dataset.spOwner;
      sp.selectedDays.forEach((ds) => {
        if (owner === "split") {
          const prev = sp.working.overrides[ds];
          sp.working.overrides[ds] = { type: "split", time: prev?.time || "12:00", morning: prev?.morning || "mine" };
          sp.changedDays[ds] = { owner: "split", prevOverride: getCustodySchedule().overrides?.[ds] || null };
        } else if (owner === "auto") {
          delete sp.working.overrides[ds];
          sp.changedDays[ds] = { owner: "auto", prevOverride: getCustodySchedule().overrides?.[ds] || null };
        } else {
          sp.working.overrides[ds] = owner;
          sp.changedDays[ds] = { owner, prevOverride: getCustodySchedule().overrides?.[ds] || null };
        }
      });
      renderCalendarFeature(data);
    });
  });

  featureModule.querySelector("#spClearSelBtn")?.addEventListener("click", () => {
    _flushSpSplitInputs();
    sp.selectedDays.clear();
    renderCalendarFeature(data);
  });

  featureModule.querySelector("#spEnabled")?.addEventListener("change", (e) => {
    sp.working.enabled = e.target.checked;
  });

  featureModule.querySelector("#spType")?.addEventListener("change", (e) => {
    sp.working.type = e.target.value;
    const refRow = featureModule.querySelector("#spRefRow");
    if (refRow) refRow.style.display = (e.target.value === "5-2" || e.target.value === "manual") ? "none" : "";
    renderCalendarFeature(data);
  });

  featureModule.querySelector("#spRefDate")?.addEventListener("change", (e) => {
    sp.working.referenceDate = e.target.value;
  });

  featureModule.querySelectorAll(".custody-color-swatches[data-sp-color-target]").forEach((group) => {
    group.querySelectorAll("[data-sp-color]").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll("[data-sp-color]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        sp.working[group.dataset.spColorTarget] = btn.dataset.spColor;
      });
    });
  });

  featureModule.querySelectorAll("[data-sp-propagate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      _flushSpSplitInputs();
      _applySpFieldsToWorking();
      saveCustodySchedule(sp.working);
      const action = btn.dataset.spPropagate;
      if (action === "this-week-all") {
        const ws = parseInt(localStorage.getItem("do-do-week-start") || "1");
        const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date(), ws), i));
        propagateWeekSchedule(weekDays, sp.working);
        sp.working = { ...sp.working, overrides: { ...(getCustodySchedule().overrides || {}) } };
        showFeatureToast("Applied this week's pattern to all weeks");
      } else {
        propagateMonthSchedule(sp.viewYear, sp.viewMonth, parseInt(action), sp.working);
        sp.working = { ...sp.working, overrides: { ...(getCustodySchedule().overrides || {}) } };
        showFeatureToast(`Applied to next ${action} months`);
      }
      renderCalendarFeature(data);
    });
  });

  featureModule.querySelector("#spClearPendingBtn")?.addEventListener("click", () => {
    sp.changedDays = {};
    sp.working.overrides = { ...(getCustodySchedule().overrides || {}) };
    renderCalendarFeature(data);
  });

  featureModule.querySelector("#spClearSchedBtn")?.addEventListener("click", () => {
    if (!confirm("Clear the entire parenting schedule? This removes all custom day overrides.")) return;
    if (isDivorced()) {
      const existing = loadChangeRequests();
      existing.push({
        id: "cr-sched-clear-" + Date.now(), createdAt: new Date().toISOString(),
        type: "schedule-clear", requestedDate: toCalendarKey(new Date()),
        requestedOwner: null, requestedOverride: null, prevOverride: null,
        reason: "Clear entire schedule", status: "pending",
      });
      saveChangeRequests(existing);
      showFeatureToast("Clear schedule request sent - awaiting approval");
    } else {
      sp.working.overrides = {};
      sp.changedDays = {};
      showFeatureToast("Schedule cleared");
    }
    renderCalendarFeature(data);
  });

  featureModule.querySelector("#spSaveBtn")?.addEventListener("click", () => {
    _flushSpSplitInputs();
    _applySpFieldsToWorking();
    if (isDivorced() && Object.keys(sp.changedDays).length > 0) {
      createScheduleChangeRequests(sp.changedDays, sp.working.overrides);
      sp.changedDays = {};
      showFeatureToast("Schedule change request sent - awaiting approval");
      calendarState.rightPanel = "changes";
    } else {
      saveCustodySchedule(sp.working);
      _resetSchedPanelState();
      showFeatureToast("Parenting schedule saved");
    }
    renderCalendarFeature(data);
  });

  // ── Vacations panel ───────────────────────────────────────────────────────
  const vp = _panelVacState;

  featureModule.querySelector("#vpCalPrev")?.addEventListener("click", () => {
    vp.viewMonth--;
    if (vp.viewMonth < 0) { vp.viewMonth = 11; vp.viewYear--; }
    renderCalendarFeature(data);
  });

  featureModule.querySelector("#vpCalNext")?.addEventListener("click", () => {
    vp.viewMonth++;
    if (vp.viewMonth > 11) { vp.viewMonth = 0; vp.viewYear++; }
    renderCalendarFeature(data);
  });

  featureModule.querySelectorAll("[data-vp-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = btn.dataset.vpDate;
      if (!vp.rangeStart || (vp.rangeStart && vp.rangeEnd)) {
        vp.rangeStart = d; vp.rangeEnd = null;
      } else if (d < vp.rangeStart) {
        vp.rangeEnd = vp.rangeStart; vp.rangeStart = d;
      } else if (d === vp.rangeStart) {
        vp.rangeStart = null;
      } else {
        vp.rangeEnd = d;
      }
      renderCalendarFeature(data);
    });
  });

  featureModule.querySelector("#vpRangeClear")?.addEventListener("click", () => {
    vp.rangeStart = null; vp.rangeEnd = null;
    renderCalendarFeature(data);
  });

  featureModule.querySelector("#vpStartDateInput")?.addEventListener("change", (e) => {
    const val = e.target.value;
    vp.rangeStart = val || null;
    if (val) { vp.viewYear = parseInt(val.slice(0, 4)); vp.viewMonth = parseInt(val.slice(5, 7)) - 1; }
    if (vp.rangeEnd && vp.rangeStart && vp.rangeEnd < vp.rangeStart) vp.rangeEnd = null;
    renderCalendarFeature(data);
  });

  featureModule.querySelector("#vpEndDateInput")?.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val && vp.rangeStart && val < vp.rangeStart) {
      vp.rangeEnd = vp.rangeStart; vp.rangeStart = val;
      vp.viewYear = parseInt(val.slice(0, 4)); vp.viewMonth = parseInt(val.slice(5, 7)) - 1;
    } else {
      vp.rangeEnd = val || null;
    }
    renderCalendarFeature(data);
  });

  featureModule.querySelector("#vpVacOwner")?.addEventListener("change", (e) => {
    featureModule.querySelector("#vpAlternatingRows")?.classList.toggle("hidden", e.target.value !== "alternating");
  });

  featureModule.querySelector("#vpWeekStartDay")?.addEventListener("change", (e) => {
    vp.weekStart = parseInt(e.target.value);
    localStorage.setItem("do-do-week-start", e.target.value);
  });

  featureModule.querySelectorAll("[data-vp-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      vp.editingId = vp.editingId === btn.dataset.vpEdit ? null : btn.dataset.vpEdit;
      vp._editLoaded = false;
      if (!vp.editingId) { vp.rangeStart = null; vp.rangeEnd = null; }
      renderCalendarFeature(data);
    });
  });

  featureModule.querySelectorAll("[data-vp-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      saveVacations(loadVacations().filter((v) => v.id !== btn.dataset.vpDelete));
      if (vp.editingId === btn.dataset.vpDelete) {
        vp.editingId = null; vp.rangeStart = null; vp.rangeEnd = null; vp._editLoaded = false;
      }
      renderCalendarFeature(data);
    });
  });

  featureModule.querySelector("#vpCancelVacEdit")?.addEventListener("click", () => {
    vp.editingId = null; vp.rangeStart = null; vp.rangeEnd = null; vp._editLoaded = false;
    renderCalendarFeature(data);
  });

  featureModule.querySelector("#vpSaveVacBtn")?.addEventListener("click", () => {
    if (!vp.rangeStart) { showFeatureToast("Select a start date"); return; }
    const effectiveEnd = vp.rangeEnd || vp.rangeStart;
    const name = (featureModule.querySelector("#vpVacName")?.value.trim()) || "Vacation";
    const owner = featureModule.querySelector("#vpVacOwner")?.value || "mine";
    const alternatingStart = featureModule.querySelector("#vpAlternatingStart")?.value || "mine";
    const existingVacs = loadVacations();
    if (isDivorced()) {
      const vacData = vp.editingId
        ? { ...(existingVacs.find(v => v.id === vp.editingId) || {}), name, startDate: vp.rangeStart, endDate: effectiveEnd, owner, alternatingStart }
        : { id: "vac-" + Date.now(), name, startDate: vp.rangeStart, endDate: effectiveEnd, owner, alternatingStart };
      createVacationChangeRequest(vp.editingId ? "update" : "add", vacData);
      vp.editingId = null; vp.rangeStart = null; vp.rangeEnd = null; vp._editLoaded = false;
      showFeatureToast("Vacation request sent - awaiting approval");
      calendarState.rightPanel = "changes";
    } else {
      if (vp.editingId) {
        saveVacations(existingVacs.map(v => v.id === vp.editingId ? { ...v, name, startDate: vp.rangeStart, endDate: effectiveEnd, owner, alternatingStart } : v));
        showFeatureToast("Vacation updated");
      } else {
        saveVacations([...existingVacs, { id: "vac-" + Date.now(), name, startDate: vp.rangeStart, endDate: effectiveEnd, owner, alternatingStart }]);
        showFeatureToast("Vacation added");
      }
      vp.editingId = null; vp.rangeStart = null; vp.rangeEnd = null; vp._editLoaded = false;
    }
    renderCalendarFeature(data);
  });

  // ── Changes panel - New request button ────────────────────────────────────
  featureModule.querySelector("#changesNewRequestBtn")?.addEventListener("click", () => {
    openChangeRequestDialog(calendarState.selected, getCustodyOwner(selectedDate));
  });

  // ── "Manage" link in vacation banner (agenda tab) - switch to vacations tab ─
  featureModule.querySelectorAll("#openVacationsBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      calendarState.rightPanel = "vacations";
      renderCalendarFeature(data);
    });
  });

  window.bindUnifiedCardInteractions?.(featureModule);
}

// Helper: flush split time/morning inputs to schedule panel state
function _flushSpSplitInputs() {
  const sp = _getSchedPanelState();
  if (sp.selectedDays.size !== 1) return;
  const ds = [...sp.selectedDays][0];
  const ov = sp.working.overrides[ds];
  if (!ov || ov.type !== "split") return;
  const timeEl = document.getElementById("spSplitTime");
  const morningEl = document.getElementById("spSplitMorning");
  if (timeEl) sp.working.overrides[ds] = { ...ov, time: timeEl.value, morning: morningEl?.value || ov.morning };
}

// Helper: apply form field values to schedule panel working state
function _applySpFieldsToWorking() {
  const sp = _getSchedPanelState();
  const enabledEl = document.getElementById("spEnabled");
  const typeEl = document.getElementById("spType");
  const refEl = document.getElementById("spRefDate");
  if (enabledEl) sp.working.enabled = enabledEl.checked;
  if (typeEl) sp.working.type = typeEl.value;
  if (refEl) sp.working.referenceDate = refEl.value;
  // Color swatches
  document.querySelectorAll(".custody-color-swatches[data-sp-color-target]").forEach((group) => {
    const active = group.querySelector("[data-sp-color].active");
    if (active) sp.working[group.dataset.spColorTarget] = active.dataset.spColor;
  });
}

function renderCalendarBody() {
  if (calendarState.view === "day") return renderDayView();
  // Week view: show 7-day header strip only - the Teams calendar below handles scheduling
  if (calendarState.view === "week") return renderWeekStrip();
  return renderMonthView();
}

function renderWeekStrip() {
  const selected = parseCalendarKey(calendarState.selected);
  const start = startOfWeek(selected);
  const today = toCalendarKey(new Date());
  const custody = getCustodySchedule();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return `
    <div class="week-strip-view">
      ${days.map((date) => {
        const key = toCalendarKey(date);
        const isToday = key === today;
        const isSelected = key === calendarState.selected;
        const custClass = custody.enabled ? getCustodyClass(date) : "";
        const events = eventsForDate(key);
        return `<button class="week-strip-day${isToday ? " week-strip-today" : ""}${isSelected ? " week-strip-selected" : ""}${custClass ? " " + custClass : ""}" type="button" data-calendar-day="${key}">
          <span class="week-strip-dow">${weekdayLabel(date)}</span>
          <strong class="week-strip-num">${date.getDate()}</strong>
          ${events.length ? `<span class="week-strip-count">${events.length}</span>` : ""}
        </button>`;
      }).join("")}
    </div>
  `;
}

function renderMonthView() {
  const custody = getCustodySchedule();
  const custodyLegend = custody.enabled ? `
    <div class="custody-legend">
      <span class="custody-legend-item">
        <span class="custody-legend-dot" style="background:${custody.myColor};"></span>
        ${window.t?.("cal.my_days") ?? "My days"}
      </span>
      <span class="custody-legend-item">
        <span class="custody-legend-dot" style="background:${custody.coColor};"></span>
        ${window.t?.("cal.co_days") ?? "Co-parent days"}
      </span>
    </div>` : "";
  return `
    ${custodyLegend}
    <div class="calendar-weekdays">
      ${["M", "T", "W", "T", "F", "S", "S"].map((day) => `<span>${day}</span>`).join("")}
    </div>
    <div class="calendar-grid">
      ${renderCalendarDays()}
    </div>
  `;
}

function renderCalendarDays() {
  const year = calendarState.cursor.getFullYear();
  const month = calendarState.cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const blankCount = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: blankCount }, () => `<span class="calendar-day blank" aria-hidden="true"></span>`);
  const activeConflicts = _getActiveConflicts();
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = new Date(year, month, day);
    const key = toCalendarKey(date);
    const events = eventsForDate(key);
    const dayConflicts = getConflictsForDate(key, activeConflicts);
    const activeVac = getActiveVacation(date);
    const classes = ["calendar-day",
      key === calendarState.selected ? "selected" : "",
      events.length ? "has-marker" : "",
      dayConflicts.length ? "has-conflict" : "",
      getCustodyClass(date),
      activeVac ? "vacation-period" : "",
    ].filter(Boolean).join(" ");
    const dots = events.slice(0, 3).map((item) => `<i class="${item.kind}${item.recurring ? " recurring" : ""}"></i>`).join("");
    const conflictDot = dayConflicts.length ? `<i class="conflict-dot" title="${dayConflicts.length} conflict${dayConflicts.length > 1 ? "s" : ""}">⚠</i>` : "";
    const vacDot = activeVac ? `<i class="vacation-dot" title="${escapeHtml(activeVac.name || "Vacation")}">✈</i>` : "";
    return `<button class="${classes}" type="button" data-calendar-day="${key}"><strong>${day}</strong><span>${dots}${conflictDot}${vacDot}</span></button>`;
  });
  return [...blanks, ...days].join("");
}

function renderWeekView() {
  const selected = parseCalendarKey(calendarState.selected);
  const start = startOfWeek(selected);
  const today = toCalendarKey(new Date());
  const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 - 22:00

  // Build day columns
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const key = toCalendarKey(date);
    const events = eventsForDate(key).filter((e) => e.kind !== "change-request");
    const custody = getCustodyClass(date);
    const splitDir = getCustodySplitDir(key);
    const isToday = key === today;
    const vacDot = getActiveVacation(date) ? `<span class="wg-vac-dot" title="Vacation">✈</span>` : "";
    return { date, key, events, custody, splitDir, isToday, vacDot };
  });

  // Header row
  const headerCells = days.map(({ date, key, custody, splitDir, isToday, vacDot }) =>
    `<div class="wg-col-head${isToday ? " wg-today" : ""}${custody ? " " + custody : ""}${splitDir ? " " + splitDir : ""}" data-calendar-day="${key}">
      <span class="wg-col-dow">${weekdayLabel(date)}</span>
      <strong class="wg-col-num">${date.getDate()}</strong>
      ${vacDot}
    </div>`
  ).join("");

  // All-day row
  const allDayCells = days.map(({ key, events }) => {
    const allDay = events.filter((e) => !e.time || e.time === "All day");
    return `<div class="wg-allday-cell" data-drop-day="${key}" data-drop-hour="allday">
      ${allDay.map((e) => _renderWeekGridCard(e, key)).join("")}
    </div>`;
  }).join("");

  // Time slot rows
  const slotRows = HOURS.map((h) => {
    const label = `${String(h).padStart(2, "0")}:00`;
    const cells = days.map(({ key, events }) => {
      const slotEvents = events.filter((e) => {
        const t = e.time && e.time !== "All day" ? e.time : null;
        if (!t) return false;
        const [eh] = t.split(":").map(Number);
        return eh === h;
      });
      return `<div class="wg-slot-cell${slotEvents.length ? " wg-has-event" : ""}" data-drop-day="${key}" data-drop-hour="${h}">
        ${slotEvents.map((e) => _renderWeekGridCard(e, key)).join("")}
      </div>`;
    }).join("");
    return `<div class="wg-row">
      <div class="wg-time-label">${label}</div>
      ${cells}
    </div>`;
  }).join("");

  // Mobile fallback: classic week strip (hidden on desktop via CSS)
  const mobileStrip = `
    <div class="week-strip week-strip-mobile-only">
      ${days.map(({ date, key, events, custody, splitDir, isToday }) => {
        const conflicts = getConflictsForDate(key, _getActiveConflicts());
        const conflictTag = conflicts.length ? ` <span class="week-conflict-dot">⚠</span>` : "";
        return `<button class="week-day${key === calendarState.selected ? " selected" : ""}${conflicts.length ? " has-conflict" : ""}${custody ? " " + custody : ""}${splitDir ? " " + splitDir : ""}" type="button" data-calendar-day="${key}">
          <span>${weekdayLabel(date)}</span>
          <strong>${date.getDate()}${conflictTag}</strong>
          <em>${events.length ? `${events.length} item${events.length === 1 ? "" : "s"}` : "Clear"}</em>
        </button>`;
      }).join("")}
    </div>
    ${renderDaySchedule(calendarState.selected)}
  `;

  return `
    <div class="week-grid-view">
      <div class="wg-header">
        <div class="wg-time-label"></div>
        ${headerCells}
      </div>
      <div class="wg-allday-row">
        <div class="wg-time-label wg-allday-label">All day</div>
        ${allDayCells}
      </div>
      <div class="wg-body">
        ${slotRows}
      </div>
    </div>
    ${mobileStrip}
  `;
}

function _renderWeekGridCard(event, dayKey) {
  const card = (window.getCards?.() || []).find((c) => c.id === event.cardId);
  if (!card) return "";
  const statusClass = card.status === "Done" ? "wg-card-done" : "";
  const assignee = card.assignee || "";
  const initial = assignee ? assignee.charAt(0).toUpperCase() : "";
  return `<div class="wg-card ${statusClass}" draggable="true"
    data-card-id="${card.id}"
    data-card-time="${event.time || "allday"}"
    title="${escapeHtml(card.title)}"
  >
    <span class="wg-card-title">${escapeHtml(card.title)}</span>
    ${event.time && event.time !== "All day" ? `<span class="wg-card-time">${event.time}</span>` : ""}
    ${initial ? `<span class="wg-card-avatar">${initial}</span>` : ""}
  </div>`;
}

// Called once after renderCalendarBody() to wire up drag-drop on the week grid
function _bindWeekGridDragDrop(container) {
  let dragCardId = null;
  let dragOrigTime = null;

  container.querySelectorAll(".wg-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      dragCardId = card.dataset.cardId;
      dragOrigTime = card.dataset.cardTime;
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("wg-dragging");
    });
    card.addEventListener("dragend", () => {
      dragCardId = null;
      container.querySelectorAll(".wg-dragging").forEach((el) => el.classList.remove("wg-dragging"));
      container.querySelectorAll(".wg-drop-target").forEach((el) => el.classList.remove("wg-drop-target"));
    });
    // Click to open card
    card.addEventListener("click", () => window.openCardDialog?.(card.dataset.cardId));
  });

  container.querySelectorAll("[data-drop-day]").forEach((cell) => {
    cell.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      container.querySelectorAll(".wg-drop-target").forEach((el) => el.classList.remove("wg-drop-target"));
      cell.classList.add("wg-drop-target");
    });
    cell.addEventListener("dragleave", () => cell.classList.remove("wg-drop-target"));
    cell.addEventListener("drop", (e) => {
      e.preventDefault();
      cell.classList.remove("wg-drop-target");
      if (!dragCardId) return;
      const newDay = cell.dataset.dropDay;   // "YYYY-MM-DD"
      const newHour = cell.dataset.dropHour; // "6".."22" or "allday"
      const allCards = window.getCards?.() || [];
      const card = allCards.find((c) => c.id === dragCardId);
      if (!card) return;

      // Build new due string
      let newDue;
      if (newHour === "allday" || !card.due) {
        newDue = newDay + "T00:00";
      } else {
        const origTime = card.due?.slice(11, 16) || "00:00";
        const hStr = String(newHour).padStart(2, "0");
        newDue = `${newDay}T${hStr}:00`;
      }
      if (newDue === card.due?.slice(0, 16)) return; // no change
      window.patchCardDue?.(dragCardId, newDue);
      // Re-render the week view
      const calBody = document.querySelector(".calendar-body");
      if (calBody) {
        calBody.innerHTML = renderCalendarBody();
        _bindWeekGridDragDrop(calBody);
      }
    });
  });
}

function renderDayView() {
  const d = parseCalendarKey(calendarState.selected);
  const custodyClass = getCustodyClass(d);
  const splitDir = getCustodySplitDir(calendarState.selected);
  return `
    <div class="day-heading${custodyClass ? " " + custodyClass : ""}${splitDir ? " " + splitDir : ""}">
      <span>${weekdayLabel(d)}</span>
      <strong>${formatAgendaDate(d)}</strong>
    </div>
    ${renderDaySchedule(calendarState.selected)}
  `;
}

function renderDaySchedule(key) {
  const events = eventsForDate(key);
  const conflicts = getConflictsForDate(key, _getActiveConflicts());

  if (!events.length) {
    return `<div class="day-schedule"><article class="agenda-empty">${window.t?.("cal.no_events") ?? "No events on this day."}</article></div>`;
  }
  // Group by time, sorted
  const byTime = {};
  events.forEach((item) => {
    const t = item.time === "All day" ? "00:00" : item.time;
    (byTime[t] = byTime[t] || []).push(item);
  });
  const sortedTimes = Object.keys(byTime).sort();

  const conflictBanner = conflicts.length
    ? `<div class="conflict-banner">
        <span class="conflict-icon">⚠</span>
        <div>
          ${conflicts.map((c) => {
            const suggestionId = `conflict-suggestion-${c.a}-${c.b}`;
            const cached = _conflictSuggestionCache[`${c.a}|${c.b}`];
            // Fetch suggestion in background if not cached
            if (!cached) _fetchConflictSuggestion(c.a, c.b);
            return `
              <strong>${escapeHtml(c.aTitle)}</strong> overlaps with
              <strong>${escapeHtml(c.bTitle)}</strong>
              <span class="conflict-reason">${escapeHtml(c.reason)}</span>
              <span class="conflict-ai-suggestion" id="${suggestionId}">${cached ? escapeHtml(cached) : ""}</span>
              <div class="conflict-suggestions">
                <button class="ghost-button conflict-action" data-conflict-a="${c.a}" data-conflict-b="${c.b}" data-resolution="swap">Swap times</button>
                <button class="ghost-button conflict-action" data-conflict-a="${c.a}" data-conflict-b="${c.b}" data-resolution="open">Open cards</button>
              </div>
            `;
          }).join("")}
        </div>
       </div>`
    : "";

  return `
    <div class="day-schedule">
      ${conflictBanner}
      ${sortedTimes.map((slot) => `
        <div class="day-slot">
          <span>${slot === "00:00" ? "All day" : slot}</span>
          <div>${byTime[slot].map(renderAgendaCard).join("")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderChangeRequestAgendaItem(cr) {
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";
  const myName = setup.parents?.primary || "Parent A";
  const statusColors = { pending: "#f59e0b", approved: "#22c55e", declined: "#ef4444" };
  const statusColor = statusColors[cr.status] || "#999";
  const statusLabel = cr.status === "pending" ? "Pending" : cr.status === "approved" ? "Approved" : "Declined";

  let bodyHtml = "";
  if (cr.type === "vacation") {
    const vd = cr.vacData || {};
    const ownerLabel = vd.owner === "mine" ? myName : vd.owner === "co" ? coparentName : "Alternating";
    const actionLabel = cr.vacAction === "add" ? "Add vacation" : cr.vacAction === "update" ? "Update vacation" : "Remove vacation";
    bodyHtml = `
      <strong>${actionLabel}: ${escapeHtml(vd.name || "Vacation")}</strong>
      <span class="change-request-reason">${escapeHtml(vd.startDate || "")} - ${escapeHtml(vd.endDate || "")} | ${escapeHtml(ownerLabel)}</span>`;
  } else {
    const ov = cr.requestedOverride;
    const isSplit = ov && ov.type === "split";
    const ownerLabel = cr.requestedOwner === "mine" ? myName
      : cr.requestedOwner === "co" ? coparentName
      : (cr.requestedOwner === "split" || isSplit) ? "Split day"
      : "Auto";
    bodyHtml = `
      <strong>Propose: ${escapeHtml(ownerLabel)}</strong>
      ${isSplit ? `<span class="change-request-reason">Handover at ${escapeHtml(ov.time || "12:00")} | Morning: ${ov.morning === "mine" ? myName : coparentName}</span>` : ""}
      ${cr.reason ? `<span class="change-request-reason">${escapeHtml(cr.reason)}</span>` : ""}`;
  }

  return `
    <article class="change-request-card" data-cr-id="${escapeHtml(cr.id)}">
      <div class="change-request-header">
        <span class="change-request-label">&#8596; ${cr.type === "vacation" ? "Vacation request" : "Schedule change"}</span>
        <span class="change-request-status" style="color:${statusColor};">${statusLabel}</span>
      </div>
      <div class="change-request-body">${bodyHtml}</div>
      ${cr.status === "pending" ? `
        <div class="change-request-actions">
          <button class="custody-chip active" type="button" data-cr-approve="${escapeHtml(cr.id)}">Approve</button>
          <button class="custody-chip custody-chip-reset" type="button" data-cr-decline="${escapeHtml(cr.id)}">Decline</button>
          <button class="custody-chip" type="button" data-cr-delete="${escapeHtml(cr.id)}" style="opacity:0.55;margin-left:auto;">Remove</button>
        </div>
      ` : `
        <div class="change-request-actions">
          <button class="custody-chip" type="button" data-cr-delete="${escapeHtml(cr.id)}" style="opacity:0.55;">Remove</button>
        </div>
      `}
    </article>
  `;
}

// Render a Supabase SCR card in the day agenda (shown to the co-parent via Realtime)
function renderScrCardAgendaItem(card) {
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";
  const myName = setup.parents?.primary || "Parent A";
  const statusColors = { "To Do": "#f59e0b", Done: "#22c55e", Disputed: "#ef4444" };
  const statusLabel = card.status === "To Do" ? "Oczekuje" : card.status === "Done" ? "Zatwierdzone" : card.status === "Disputed" ? "Odrzucone" : card.status;
  const statusColor = statusColors[card.status] || "#999";

  let bodyHtml = `<strong>${escapeHtml(card.title)}</strong>`;
  try {
    if (card.details?.startsWith("__SCR_BATCH__")) {
      const { days } = JSON.parse(card.details.slice("__SCR_BATCH__".length));
      const dayKeys = Object.keys(days || {}).sort();
      bodyHtml = `<strong>Zmiana harmonogramu</strong><span class="change-request-reason">${dayKeys.join(", ")}</span>`;
    } else if (card.details?.startsWith("__SCR_VAC__")) {
      const { vacAction, vacData } = JSON.parse(card.details.slice("__SCR_VAC__".length));
      const actionLabel = vacAction === "add" ? "Nowe wakacje" : vacAction === "update" ? "Zmiana wakacji" : "Usuniecie wakacji";
      bodyHtml = `<strong>${actionLabel}: ${escapeHtml(vacData?.name || "Wakacje")}</strong><span class="change-request-reason">${escapeHtml(vacData?.startDate || "")} - ${escapeHtml(vacData?.endDate || "")}</span>`;
    } else if (card.details?.startsWith("__SCR_DAY__")) {
      const { requestedDate, requestedOwner, reason } = JSON.parse(card.details.slice("__SCR_DAY__".length));
      const ownerLabel = requestedOwner === "mine" ? myName : requestedOwner === "co" ? coparentName : "Zmiana";
      bodyHtml = `<strong>Wniosek o zmiane: ${escapeHtml(requestedDate)}</strong><span class="change-request-reason">Propozycja: ${escapeHtml(ownerLabel)}${reason ? " | " + escapeHtml(reason) : ""}</span>`;
    }
  } catch { /* use default bodyHtml */ }

  return `
    <article class="change-request-card" data-scr-card-id="${escapeHtml(card.id)}">
      <div class="change-request-header">
        <span class="change-request-label">&#8596; Wniosek harmonogramu</span>
        <span class="change-request-status" style="color:${statusColor};">${statusLabel}</span>
      </div>
      <div class="change-request-body">${bodyHtml}</div>
      ${card.status === "To Do" ? `
        <div class="change-request-actions">
          <button class="custody-chip active" type="button" data-scr-approve="${escapeHtml(card.id)}">Zatwierdz</button>
          <button class="custody-chip custody-chip-reset" type="button" data-scr-decline="${escapeHtml(card.id)}">Odrzuc</button>
        </div>
      ` : ""}
    </article>
  `;
}

function renderAgendaCard(item) {
  if (item.kind === "change-request") return renderChangeRequestAgendaItem(item.changeRequest);
  if (item.kind === "scr-card") return renderScrCardAgendaItem(item.scrCard);
  if (item.privateBlock || item.kind === "busy") {
    const personClass = item.person
      ? (item.person === "Parent B" ? "busy-parent-b" : "busy-parent-a")
      : "";
    const label = item.person || "Busy";
    return `
      <article class="calendar-busy-card ${personClass}">
        <strong>${label}</strong>
        <span>${item.time} · Private calendar</span>
      </article>
    `;
  }
  // For recurring occurrences, look up the parent card
  const lookupId = item.recurringParentId || item.cardId;
  const sourceCard = typeof state !== "undefined" ? state.cards.find((card) => card.id === lookupId) : null;
  if (!sourceCard) return "";

  const conflicts = _getActiveConflicts();
  const hasConflict = getConflictsForCard(sourceCard.id, conflicts).length > 0;
  const recurringIcon = item.recurring ? `<span class="recurring-icon" title="Recurring">&#x21BB;</span>` : "";
  const conflictBadge = hasConflict ? `<span class="conflict-dot-small" title="Scheduling conflict">⚠</span>` : "";

  // Render as a compact clickable row (use parent card id so dialog opens correctly)
  return `
    <article class="agenda-card${hasConflict ? " has-conflict" : ""}" data-card-id="${sourceCard.id}" role="button" tabindex="0">
      <div class="agenda-card-time">${item.time}${recurringIcon}</div>
      <div class="agenda-card-body">
        <strong>${escapeHtml(sourceCard.title)}${conflictBadge}</strong>
        ${sourceCard.details ? `<span>${escapeHtml(sourceCard.details.slice(0, 60))}${sourceCard.details.length > 60 ? "..." : ""}</span>` : ""}
      </div>
      <div class="agenda-card-status ${item.kind}">${sourceCard.status}</div>
    </article>
  `;
}

function renderUniversalFeatureCard(card, className = "", showActions = true) {
  if (typeof window.renderUnifiedCard === "function") {
    return window.renderUnifiedCard(card, { className, showActions });
  }
  return `
    <article class="card ${className}" data-card-id="${card.id}">
      <div class="card-state-row"><span>${formatDate(card.due)}</span><span>${escapeHtml(card.status)}</span></div>
      <div class="card-top"><h3 class="card-title">${escapeHtml(card.title)}</h3></div>
      <p class="card-details">${escapeHtml(card.details)}</p>
    </article>
  `;
}

function linkedMessageCard() {
  return (typeof state !== "undefined" && state.cards.find((card) => card.title === "Swap Friday pickup")) || {
    id: "linked-swap-friday",
    title: "Swap Friday pickup",
    topic: "Schedule",
    type: "Request",
    status: "Important",
    assignee: "Parent B",
    child: "Ava",
    due: new Date().toISOString(),
    amount: `${LOCALE_CONFIG.currency} 0.00`,
    details: "Friday dismissal moved to 15:10. Confirm before 13:00 so after-school care can be updated.",
    comments: [{ author: "Parent A", text: "Need confirmation before 13:00.", time: "09:12" }],
    acknowledged: false,
  };
}

function featureDateFromLabel(label) {
  const date = new Date();
  if (label === "Tomorrow") date.setDate(date.getDate() + 1);
  if (/Fri/.test(label)) date.setDate(date.getDate() + 3);
  if (/Mar/.test(label)) date.setMonth(2, 1);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

function addCalendarEvent() {
  const selected = parseCalendarKey(calendarState.selected);
  selected.setHours(17, 0, 0, 0);
  // Open the unified New Do dialog with the selected calendar date pre-filled
  window.openCardDialog("", "info", {
    due: selected.toISOString(),
    topic: "Schedule",
    type: "Event",
  });
}

function openVacationsDialog(editId = null) {
  document.getElementById("vacationsDialog")?.remove();
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";
  const _locWd = _getDateLocale();
  const weekDayNames = Array.from({ length: 7 }, (_, i) => new Date(2000, 0, 2 + i).toLocaleDateString(_locWd, { weekday: "long" }));

  const vState = {
    editingId: editId,
    rangeStart: null,
    rangeEnd: null,
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    weekStart: parseInt(localStorage.getItem("do-do-week-start") || "1"),
    _editLoaded: false,
    formMode: "vacation",  // "vacation" | "holiday"
  };

  // Preset holiday templates for quick selection
  const HOLIDAY_PRESETS = [
    { label: "Easter (Ostern)", name: "Easter", daysFromRef: null },
    { label: "Winter break (Winterferien)", name: "Winter break" },
    { label: "Christmas (Weihnachten)", name: "Christmas" },
    { label: "Easter break (Osterferien)", name: "Easter break" },
    { label: "Summer break (Sommerferien)", name: "Summer break" },
    { label: "Autumn break (Herbstferien)", name: "Autumn break" },
    { label: "Spring break (Frühlingsferien)", name: "Spring break" },
    { label: "Other holiday...", name: "" },
  ];

  const dialog = document.createElement("dialog");
  dialog.id = "vacationsDialog";
  dialog.className = "custody-schedule-dialog";
  document.body.appendChild(dialog);

  function refreshVacDialog() {
    const vacations = loadVacations();
    const editing = vState.editingId ? vacations.find((v) => v.id === vState.editingId) : null;

    // Pre-fill range when entering edit mode for the first time
    if (editing && !vState._editLoaded) {
      vState.rangeStart = editing.startDate;
      vState.rangeEnd = editing.endDate;
      vState.viewYear = parseInt(editing.startDate.slice(0, 4));
      vState.viewMonth = parseInt(editing.startDate.slice(5, 7)) - 1;
      vState._editLoaded = true;
    }
    if (!vState.editingId) vState._editLoaded = false;

    const editOwner = editing?.owner || "mine";
    const editAltStart = editing?.alternatingStart || "mine";

    // vacation list
    const vacListHtml = vacations.length === 0
      ? `<p class="vac-empty-msg">No vacation periods yet.</p>`
      : vacations.map((v) => {
          const ownerLabel = v.owner === "mine" ? "Your days"
            : v.owner === "co" ? `${escapeHtml(coparentName)}'s days`
            : `Alternating (starts: ${v.alternatingStart === "mine" ? "you" : escapeHtml(coparentName)})`;
          const isEditing = vState.editingId === v.id;
          const typeIcon = v.vacType === "holiday" ? "🎄" : "✈";
          return `<div class="vacation-list-item${isEditing ? " vac-editing" : ""}">
            <div class="vacation-list-info">
              <strong>${typeIcon} ${escapeHtml(v.name || (v.vacType === "holiday" ? "Holiday" : "Vacation"))}</strong>
              <span>${v.startDate} — ${v.endDate}</span>
              <span class="vacation-list-owner">${ownerLabel}</span>
            </div>
            <div class="vac-item-actions">
              <button class="vac-edit-btn${isEditing ? " active" : ""}" type="button" data-vac-edit="${v.id}" title="Edit">✎</button>
              <button class="custody-chip custody-chip-reset" type="button" data-vac-delete="${v.id}">Remove</button>
            </div>
          </div>`;
        }).join("");

    // range calendar
    const rangeCalHtml = _buildVacRangeCalHTML(vState, vacations);

    // range summary row
    const rangeDisplay = `
      <div class="vac-range-display">
        <span class="vac-range-label">From</span>
        <span class="vac-range-val${vState.rangeStart ? "" : " placeholder"}">${vState.rangeStart || "tap a date"}</span>
        <span class="vac-range-arrow">→</span>
        <span class="vac-range-label">To</span>
        <span class="vac-range-val${vState.rangeEnd ? "" : " placeholder"}">${vState.rangeEnd || (vState.rangeStart ? "tap end date" : "—")}</span>
        ${vState.rangeStart ? `<button class="vac-range-clear-btn" type="button" id="vacRangeClear">✕</button>` : ""}
      </div>`;

    dialog.innerHTML = `
      <div class="custody-dialog-body vac-dialog-body">
        <div class="vac-dialog-header">
          <h3>✈ Vacations &amp; Holidays</h3>
          <button class="ghost-button" type="button" id="closeVacationsDialog" style="font-size:20px;line-height:1;padding:4px 10px;">✕</button>
        </div>
        <p class="vac-dialog-desc">Vacation and holiday periods override custody without erasing the regular schedule. It resumes automatically after the period ends.</p>
        ${isDivorced() ? `<div class="sched-divorced-notice">Separated/divorced mode - changes are sent to ${escapeHtml(coparentName)} for approval.</div>` : ""}

        <div id="vacationsList">${vacListHtml}</div>

        <div class="vac-mode-tabs" style="display:flex;gap:8px;margin-bottom:12px;">
          <button class="custody-chip${vState.formMode === "vacation" ? " active" : ""}" type="button" id="vacTabVacation">+ Add vacation</button>
          <button class="custody-chip${vState.formMode === "holiday" ? " active" : ""}" type="button" id="vacTabHoliday">+ Add holiday</button>
        </div>

        <div class="vac-form-section">
          <div class="vac-form-heading">${vState.editingId ? (vState.formMode === "holiday" ? "Edit holiday" : "Edit vacation") : (vState.formMode === "holiday" ? "Add holiday" : "Add vacation")}</div>
          ${vState.formMode === "holiday" ? `
          <label class="clean-field" style="margin-bottom:10px;">
            <span>Holiday type</span>
            <select id="vacHolidayPreset">
              ${HOLIDAY_PRESETS.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.label)}</option>`).join("")}
            </select>
          </label>` : ""}
          ${rangeCalHtml}
          ${rangeDisplay}
          <label class="clean-field" style="margin-top:10px;">
            <span>Name</span>
            <input type="text" id="vacName" placeholder='e.g. "Summer 2026"' value="${escapeHtml(editing?.name || "")}" />
          </label>
          <label class="clean-field">
            <span>Who has the kids?</span>
            <select id="vacOwner">
              <option value="mine"${editOwner === "mine" ? " selected" : ""}>Your days (whole period)</option>
              <option value="co"${editOwner === "co" ? " selected" : ""}>${escapeHtml(coparentName)}'s days (whole period)</option>
              <option value="alternating"${editOwner === "alternating" ? " selected" : ""}>Alternating weeks</option>
            </select>
          </label>
          <div id="vacAlternatingRows" class="${editOwner === "alternating" ? "" : "hidden"}">
            <label class="clean-field">
              <span>First week with</span>
              <select id="vacAlternatingStart">
                <option value="mine"${editAltStart === "mine" ? " selected" : ""}>You</option>
                <option value="co"${editAltStart === "co" ? " selected" : ""}>${escapeHtml(coparentName)}</option>
              </select>
            </label>
            <label class="clean-field">
              <span>Week starts on</span>
              <select id="vacWeekStartDay">
                ${[1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}"${vState.weekStart === d ? " selected" : ""}>${weekDayNames[d]}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="vac-form-btns">
            <button class="primary-button" type="button" id="saveVacationBtn">${
              isDivorced()
                ? (vState.editingId ? "Request update" : (vState.formMode === "holiday" ? "Request holiday" : "Request vacation"))
                : (vState.editingId ? (vState.formMode === "holiday" ? "Update holiday" : "Update vacation") : (vState.formMode === "holiday" ? "Add holiday" : "Add vacation"))
            }</button>
            ${vState.editingId ? `<button class="custody-chip custody-chip-reset" type="button" id="cancelVacEdit">Cancel edit</button>` : ""}
          </div>
        </div>
      </div>
    `;

    // ---- bind events ----
    dialog.querySelector("#closeVacationsDialog").addEventListener("click", () => dialog.close());

    // Tab switching: vacation / holiday
    dialog.querySelector("#vacTabVacation")?.addEventListener("click", () => {
      vState.formMode = "vacation";
      vState.editingId = null; vState.rangeStart = null; vState.rangeEnd = null; vState._editLoaded = false;
      refreshVacDialog();
    });
    dialog.querySelector("#vacTabHoliday")?.addEventListener("click", () => {
      vState.formMode = "holiday";
      vState.editingId = null; vState.rangeStart = null; vState.rangeEnd = null; vState._editLoaded = false;
      refreshVacDialog();
    });

    // Pre-fill name when holiday preset changes
    dialog.querySelector("#vacHolidayPreset")?.addEventListener("change", (e) => {
      const nameField = dialog.querySelector("#vacName");
      if (nameField && e.target.value) nameField.value = e.target.value;
    });
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

    dialog.querySelector("#vacCalPrev")?.addEventListener("click", () => {
      vState.viewMonth--;
      if (vState.viewMonth < 0) { vState.viewMonth = 11; vState.viewYear--; }
      refreshVacDialog();
    });
    dialog.querySelector("#vacCalNext")?.addEventListener("click", () => {
      vState.viewMonth++;
      if (vState.viewMonth > 11) { vState.viewMonth = 0; vState.viewYear++; }
      refreshVacDialog();
    });

    dialog.querySelectorAll("[data-vac-date]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.vacDate;
        if (!vState.rangeStart || (vState.rangeStart && vState.rangeEnd)) {
          vState.rangeStart = d; vState.rangeEnd = null;
        } else if (d < vState.rangeStart) {
          vState.rangeEnd = vState.rangeStart; vState.rangeStart = d;
        } else if (d === vState.rangeStart) {
          vState.rangeStart = null;
        } else {
          vState.rangeEnd = d;
        }
        refreshVacDialog();
      });
    });

    dialog.querySelector("#vacRangeClear")?.addEventListener("click", () => {
      vState.rangeStart = null; vState.rangeEnd = null; refreshVacDialog();
    });

    dialog.querySelector("#vacOwner")?.addEventListener("change", (e) => {
      dialog.querySelector("#vacAlternatingRows")?.classList.toggle("hidden", e.target.value !== "alternating");
    });

    dialog.querySelector("#vacWeekStartDay")?.addEventListener("change", (e) => {
      vState.weekStart = parseInt(e.target.value);
      localStorage.setItem("do-do-week-start", e.target.value);
    });

    dialog.querySelectorAll("[data-vac-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        vState.editingId = vState.editingId === btn.dataset.vacEdit ? null : btn.dataset.vacEdit;
        vState._editLoaded = false;
        if (!vState.editingId) { vState.rangeStart = null; vState.rangeEnd = null; }
        refreshVacDialog();
      });
    });

    dialog.querySelectorAll("[data-vac-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        saveVacations(loadVacations().filter((v) => v.id !== btn.dataset.vacDelete));
        if (vState.editingId === btn.dataset.vacDelete) {
          vState.editingId = null; vState.rangeStart = null; vState.rangeEnd = null; vState._editLoaded = false;
        }
        refreshVacDialog();
        if (typeof renderCalendarFeature === "function" && typeof data !== "undefined") renderCalendarFeature(data);
      });
    });

    dialog.querySelector("#cancelVacEdit")?.addEventListener("click", () => {
      vState.editingId = null; vState.rangeStart = null; vState.rangeEnd = null; vState._editLoaded = false;
      refreshVacDialog();
    });

    dialog.querySelector("#saveVacationBtn")?.addEventListener("click", () => {
      if (!vState.rangeStart || !vState.rangeEnd) { showFeatureToast("Select a date range on the calendar"); return; }
      const rawName = dialog.querySelector("#vacName")?.value.trim();
      const name = rawName || (vState.formMode === "holiday" ? "Holiday" : "Vacation");
      const owner = dialog.querySelector("#vacOwner")?.value || "mine";
      const alternatingStart = dialog.querySelector("#vacAlternatingStart")?.value || "mine";
      const existingVacs = loadVacations();
      const isHoliday = vState.formMode === "holiday";

      if (isDivorced()) {
        // Divorced mode: create a change request instead of saving directly
        const vacData = vState.editingId
          ? { ...(existingVacs.find(v => v.id === vState.editingId) || {}), name, startDate: vState.rangeStart, endDate: vState.rangeEnd, owner, alternatingStart, vacType: isHoliday ? "holiday" : "vacation" }
          : { id: (isHoliday ? "hol-" : "vac-") + Date.now(), name, startDate: vState.rangeStart, endDate: vState.rangeEnd, owner, alternatingStart, vacType: isHoliday ? "holiday" : "vacation" };
        if (isHoliday) {
          createHolidayChangeRequest(vState.editingId ? "update" : "add", vacData);
          showFeatureToast("Holiday request sent - awaiting approval");
        } else {
          createVacationChangeRequest(vState.editingId ? "update" : "add", vacData);
          showFeatureToast("Vacation request sent - awaiting approval");
        }
        vState.editingId = null; vState.rangeStart = null; vState.rangeEnd = null; vState._editLoaded = false;
        refreshVacDialog();
        if (typeof renderCalendarFeature === "function" && typeof data !== "undefined") renderCalendarFeature(data);
        return;
      }

      // Non-divorced: save directly
      const newEntry = { id: (isHoliday ? "hol-" : "vac-") + Date.now(), name, startDate: vState.rangeStart, endDate: vState.rangeEnd, owner, alternatingStart, vacType: isHoliday ? "holiday" : "vacation" };
      if (vState.editingId) {
        saveVacations(existingVacs.map((v) => v.id === vState.editingId
          ? { ...v, name, startDate: vState.rangeStart, endDate: vState.rangeEnd, owner, alternatingStart, vacType: isHoliday ? "holiday" : "vacation" }
          : v));
        showFeatureToast(isHoliday ? "Holiday updated" : "Vacation updated");
      } else {
        saveVacations([...existingVacs, newEntry]);
        showFeatureToast(isHoliday ? "Holiday added" : "Vacation added");
      }
      vState.editingId = null; vState.rangeStart = null; vState.rangeEnd = null; vState._editLoaded = false;
      refreshVacDialog();
      if (typeof renderCalendarFeature === "function" && typeof data !== "undefined") renderCalendarFeature(data);
    });
  }

  dialog.showModal();
  refreshVacDialog();
}

function _buildVacRangeCalHTML(vState, vacations) {
  const { viewYear, viewMonth, rangeStart, rangeEnd, editingId } = vState;
  const _loc = _getDateLocale();
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(_loc, { month: "long" })
  );
  const weekStart = parseInt(localStorage.getItem("do-do-week-start") || "1");
  const headerLetters = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2000, 0, 2 + (i + weekStart) % 7); // Jan 2 2000 is Sunday
    return d.toLocaleDateString(_loc, { weekday: "narrow" });
  });

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = (firstDay.getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = toCalendarKey(new Date());

  // Get custody schedule for coloring days
  const cs = getCustodySchedule();
  function _vacGetOwner(dateStr) {
    const ov = (cs.overrides || {})[dateStr];
    if (ov === "mine" || ov === "co") return ov;
    if (ov && ov.type === "split") return "split";
    if (!cs.referenceDate || !cs.enabled) return null;
    const d = parseCalendarKey(dateStr);
    const ref = new Date(cs.referenceDate + "T00:00:00");
    const diff = Math.round((d - ref) / 86400000);
    const t = cs.type || "7-7";
    if (t === "7-7") return ((Math.floor(diff / 7) % 2) + 2) % 2 === 0 ? "mine" : "co";
    if (t === "2-2-3") { const p = ((diff % 14) + 14) % 14; return p <= 1 ? "mine" : p <= 3 ? "co" : "mine"; }
    if (t === "5-2") { const dow = d.getDay(); return (dow === 0 || dow === 6) ? "co" : "mine"; }
    return null;
  }

  let cells = "";
  let dayNum = 1;
  for (let row = 0; row < 6; row++) {
    cells += "<tr>";
    for (let col = 0; col < 7; col++) {
      const ci = row * 7 + col;
      if (ci < startDow || dayNum > daysInMonth) { cells += "<td></td>"; }
      else {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        const isStart = dateStr === rangeStart;
        const isEnd = dateStr === rangeEnd;
        const inRange = rangeStart && rangeEnd && dateStr > rangeStart && dateStr < rangeEnd;
        const existingVac = vacations.find((v) => v.id !== editingId && dateStr >= v.startDate && dateStr <= v.endDate);
        const owner = _vacGetOwner(dateStr);
        let cls = "sched-day-btn";
        if (owner === "mine") cls += " sched-mine";
        else if (owner === "co") cls += " sched-co";
        else if (owner === "split") cls += " sched-split";
        if (dateStr === todayStr) cls += " sched-today";
        if (isStart) cls += " sched-selected vac-range-start";
        else if (isEnd) cls += " sched-selected vac-range-end";
        else if (inRange) cls += " vac-range-in";
        if (existingVac) cls += " vac-existing-day";
        cells += `<td${inRange ? ' class="vac-range-in-cell"' : ""}><button class="${cls}" type="button" data-vac-date="${dateStr}">${dayNum}</button></td>`;
        dayNum++;
      }
    }
    cells += "</tr>";
    if (dayNum > daysInMonth) break;
  }

  const rangeHint = rangeStart && !rangeEnd ? `<span class="sched-sel-count">Tap end date, or save as a single day</span>` : rangeStart && rangeEnd ? `<span class="sched-sel-count">${rangeStart} to ${rangeEnd}</span>` : `<span class="sched-sel-count">Tap start date or type below</span>`;

  return `
    <div class="sched-month-cal">
      <div class="mc-header">
        <button class="mc-nav" type="button" id="vacCalPrev">&#8249;</button>
        <span class="mc-month-label">${monthNames[viewMonth]} ${viewYear}</span>
        <button class="mc-nav" type="button" id="vacCalNext">&#8250;</button>
      </div>
      <table class="sched-cal-table">
        <thead><tr>${headerLetters.map((d) => `<th>${d}</th>`).join("")}</tr></thead>
        <tbody>${cells}</tbody>
      </table>
      ${rangeHint}
    </div>`;
}

const _crCalState = {
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  selectedDate: null,
};

function _buildCrSingleDateCalHTML(state) {
  const { viewYear, viewMonth, selectedDate } = state;
  const _loc = _getDateLocale();
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(_loc, { month: "long" })
  );
  const weekStart = parseInt(localStorage.getItem("do-do-week-start") || "1");
  const headerLetters = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2000, 0, 2 + (i + weekStart) % 7);
    return d.toLocaleDateString(_loc, { weekday: "narrow" });
  });
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = (firstDay.getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = toCalendarKey(new Date());
  // Custody coloring - same logic as vacation calendar
  const cs = getCustodySchedule();
  function _crGetOwner(dateStr) {
    const ov = (cs.overrides || {})[dateStr];
    if (ov === "mine" || ov === "co") return ov;
    if (ov && ov.type === "split") return "split";
    if (!cs.referenceDate || !cs.enabled) return null;
    const d = parseCalendarKey(dateStr);
    const ref = new Date(cs.referenceDate + "T00:00:00");
    const diff = Math.round((d - ref) / 86400000);
    const t = cs.type || "7-7";
    if (t === "7-7") return ((Math.floor(diff / 7) % 2) + 2) % 2 === 0 ? "mine" : "co";
    if (t === "2-2-3") { const p = ((diff % 14) + 14) % 14; return p <= 1 ? "mine" : p <= 3 ? "co" : "mine"; }
    if (t === "5-2") { const dow = d.getDay(); return (dow === 0 || dow === 6) ? "co" : "mine"; }
    return null;
  }
  let cells = ""; let dayNum = 1;
  for (let row = 0; row < 6; row++) {
    cells += "<tr>";
    for (let col = 0; col < 7; col++) {
      const ci = row * 7 + col;
      if (ci < startDow || dayNum > daysInMonth) { cells += "<td></td>"; }
      else {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        const isSelected = dateStr === selectedDate;
        const owner = _crGetOwner(dateStr);
        let cls = "sched-day-btn";
        if (owner === "mine") cls += " sched-mine";
        else if (owner === "co") cls += " sched-co";
        else if (owner === "split") cls += " sched-split";
        if (dateStr === todayStr) cls += " sched-today";
        if (isSelected) cls += " sched-selected vac-range-start";
        cells += `<td><button class="${cls}" type="button" data-cr-date="${dateStr}">${dayNum}</button></td>`;
        dayNum++;
      }
    }
    cells += "</tr>";
    if (dayNum > daysInMonth) break;
  }
  return `
    <div class="sched-month-cal cr-single-cal">
      <div class="mc-header">
        <button class="mc-nav" type="button" id="crCalPrev">&#8249;</button>
        <span class="mc-month-label">${monthNames[viewMonth]} ${viewYear}</span>
        <button class="mc-nav" type="button" id="crCalNext">&#8250;</button>
      </div>
      <table class="sched-cal-table">
        <thead><tr>${headerLetters.map(d => `<th>${d}</th>`).join("")}</tr></thead>
        <tbody>${cells}</tbody>
      </table>
    </div>`;
}

function _updateCrCal(dialog) {
  const wrapper = dialog.querySelector("#crCalWrapper");
  if (!wrapper) return;
  wrapper.innerHTML = _buildCrSingleDateCalHTML(_crCalState);
  wrapper.querySelector("#crCalPrev")?.addEventListener("click", () => {
    _crCalState.viewMonth--; if (_crCalState.viewMonth < 0) { _crCalState.viewMonth = 11; _crCalState.viewYear--; }
    _updateCrCal(dialog);
  });
  wrapper.querySelector("#crCalNext")?.addEventListener("click", () => {
    _crCalState.viewMonth++; if (_crCalState.viewMonth > 11) { _crCalState.viewMonth = 0; _crCalState.viewYear++; }
    _updateCrCal(dialog);
  });
  wrapper.querySelectorAll("[data-cr-date]").forEach(btn => {
    btn.addEventListener("click", () => {
      _crCalState.selectedDate = btn.dataset.crDate;
      const dateInput = dialog.querySelector("#crDate");
      if (dateInput) dateInput.value = btn.dataset.crDate;
      _updateCrCal(dialog);
    });
  });
}

function openChangeRequestDialog(selectedDateKey, currentOwner) {
  document.getElementById("changeRequestDialog")?.remove();
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";

  const dialog = document.createElement("dialog");
  dialog.id = "changeRequestDialog";
  dialog.className = "custody-schedule-dialog";
  dialog.innerHTML = `
    <div class="custody-dialog-body" style="max-width:400px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <h3 style="margin:0;font-size:16px;">Request Change</h3>
        <button class="ghost-button" type="button" id="closeCrDialog" style="font-size:20px;line-height:1;padding:4px 10px;">✕</button>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin:0 0 10px;">${escapeHtml(coparentName)} will receive this request and must approve it.</p>
      <div id="crCalWrapper" style="margin-bottom:10px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <label class="clean-field">
          <span>Date</span>
          <input type="date" id="crDate" value="${selectedDateKey}" />
        </label>
        <label class="clean-field">
          <span>Exchange time</span>
          <input type="time" id="crExchangeTime" value="" />
        </label>
      </div>
      <label class="clean-field" style="margin-bottom:10px;">
        <span>What are you changing?</span>
        <select id="crChangeType">
          <option value="day">Whole day - change who has the child</option>
          <option value="hours">Hours only - change pickup/dropoff time</option>
        </select>
      </label>
      <div id="crDayOwnerRow">
        <label class="clean-field" style="margin-bottom:10px;">
          <span>Proposed day owner</span>
          <select id="crRequestedOwner">
            <option value="mine"${currentOwner !== "mine" ? " selected" : ""}>You take this day</option>
            <option value="co"${currentOwner === "mine" ? " selected" : ""}>${escapeHtml(coparentName)} takes this day</option>
          </select>
        </label>
      </div>
      <div id="crHoursRow" style="display:none;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <label class="clean-field">
            <span>Pickup time</span>
            <input type="time" id="crPickupTime" value="15:00" />
          </label>
          <label class="clean-field">
            <span>Dropoff time</span>
            <input type="time" id="crDropoffTime" value="18:00" />
          </label>
        </div>
      </div>
      <label class="clean-field" style="margin-bottom:16px;">
        <span>Reason (optional)</span>
        <input type="text" id="crReason" placeholder="e.g. Doctor appointment, work travel..." />
      </label>
      <button class="primary-button" type="button" id="saveCrBtn" style="width:100%;">Send request to ${escapeHtml(coparentName)}</button>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  // Init calendar state for this dialog opening
  _crCalState.selectedDate = selectedDateKey || null;
  if (selectedDateKey) {
    _crCalState.viewYear = parseInt(selectedDateKey.slice(0, 4));
    _crCalState.viewMonth = parseInt(selectedDateKey.slice(5, 7)) - 1;
  } else {
    _crCalState.viewYear = new Date().getFullYear();
    _crCalState.viewMonth = new Date().getMonth();
  }
  _updateCrCal(dialog);

  // Wire date input -> update calendar
  dialog.querySelector("#crDate")?.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val) {
      _crCalState.selectedDate = val;
      _crCalState.viewYear = parseInt(val.slice(0, 4));
      _crCalState.viewMonth = parseInt(val.slice(5, 7)) - 1;
      _updateCrCal(dialog);
    }
  });

  dialog.querySelector("#closeCrDialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  // Toggle day-owner vs hours rows
  dialog.querySelector("#crChangeType")?.addEventListener("change", (e) => {
    const isHours = e.target.value === "hours";
    dialog.querySelector("#crDayOwnerRow").style.display = isHours ? "none" : "";
    dialog.querySelector("#crHoursRow").style.display = isHours ? "" : "none";
  });

  dialog.querySelector("#saveCrBtn").addEventListener("click", async () => {
    const requestedDate = dialog.querySelector("#crDate").value || _crCalState.selectedDate;
    const changeType = dialog.querySelector("#crChangeType").value;
    const requestedOwner = changeType === "day" ? dialog.querySelector("#crRequestedOwner").value : null;
    const pickupTime = changeType === "hours" ? dialog.querySelector("#crPickupTime").value : null;
    const dropoffTime = changeType === "hours" ? dialog.querySelector("#crDropoffTime").value : null;
    const exchangeTime = dialog.querySelector("#crExchangeTime")?.value || null;
    const reason = dialog.querySelector("#crReason").value.trim();
    if (!requestedDate) { showFeatureToast("Please select a date on the calendar or type it in"); return; }
    const cardId = "scr-day-" + Date.now();
    const cr = {
      id: "cr-" + Date.now(),
      createdAt: new Date().toISOString(),
      type: "schedule",
      changeType,   // "day" | "hours"
      requestedDate,
      currentOwner: currentOwner || "",
      requestedOwner,
      pickupTime,
      dropoffTime,
      exchangeTime,
      reason,
      status: "pending",
      supabaseCardId: cardId,
    };
    saveChangeRequests([...loadChangeRequests(), cr]);
    dialog.close();
    if (typeof calendarState !== "undefined") calendarState.selected = requestedDate;
    if (typeof renderCalendarFeature === "function" && typeof data !== "undefined") renderCalendarFeature(data);
    showFeatureToast("Request sent - awaiting approval from " + coparentName);
    // Supabase card so co-parent sees it via Realtime
    const titleSuffix = changeType === "hours"
      ? `hours: ${pickupTime || "?"} - ${dropoffTime || "?"}`
      : `owner: ${requestedOwner === "mine" ? (window.getOnboardingState?.()?.parents?.primary || "ja") : coparentName}`;
    await _saveScheduleRequestCard({
      cardId,
      title: `Request Change: ${requestedDate} (${titleSuffix})`,
      detailsTag: "__SCR_DAY__",
      payload: { crId: cr.id, requestedDate, changeType, currentOwner: currentOwner || "", requestedOwner, pickupTime, dropoffTime, reason },
    });
    _notifyPartner("Do-Do: Request Change", `${requestedDate} - ${titleSuffix}`);
  });
}

function reminderIsoFromDate(date, preset) {
  const reminderDate = new Date(date);
  if (preset !== "at-due" && preset !== "custom") {
    reminderDate.setMinutes(reminderDate.getMinutes() - Number(preset));
  }
  return reminderDate.toISOString();
}

function moveCalendar(direction) {
  if (calendarState.view === "month") {
    calendarState.cursor = new Date(calendarState.cursor.getFullYear(), calendarState.cursor.getMonth() + direction, 1);
    calendarState.selected = toCalendarKey(new Date(calendarState.cursor.getFullYear(), calendarState.cursor.getMonth(), 1));
    return;
  }
  const selected = addDays(parseCalendarKey(calendarState.selected), direction * (calendarState.view === "week" ? 7 : 1));
  calendarState.selected = toCalendarKey(selected);
  calendarState.cursor = new Date(selected.getFullYear(), selected.getMonth(), 1);
}

// Returns the relevant date key for a Supabase SCR card (used to show it on the right day)
function _scrCardDate(card) {
  try {
    if (card.details?.startsWith("__SCR_BATCH__")) {
      const { days } = JSON.parse(card.details.slice("__SCR_BATCH__".length));
      return Object.keys(days || {}).sort()[0] || "";
    }
    if (card.details?.startsWith("__SCR_VAC__")) {
      const { vacData } = JSON.parse(card.details.slice("__SCR_VAC__".length));
      return vacData?.startDate || "";
    }
    if (card.details?.startsWith("__SCR_DAY__")) {
      const { requestedDate } = JSON.parse(card.details.slice("__SCR_DAY__".length));
      return requestedDate || "";
    }
  } catch { return ""; }
  return "";
}

function eventsForDate(key) {
  const regular = calendarState.events.filter((item) => item.date === key).sort((a, b) => a.time.localeCompare(b.time));
  // Local change requests (visible to the requester on their own device)
  const crItems = loadChangeRequests()
    .filter((cr) => cr.requestedDate === key)
    .map((cr) => ({ kind: "change-request", date: key, time: "All day", cardId: cr.id, changeRequest: cr }));
  // Supabase SCR cards (visible to the co-parent via Realtime, de-duped against local CRs)
  const localLinkedCardIds = new Set(loadChangeRequests().map((c) => c.supabaseCardId).filter(Boolean));
  const scrItems = (typeof state !== "undefined" ? state.cards : [])
    .filter((card) => card.details?.startsWith("__SCR_") && _scrCardDate(card) === key && !localLinkedCardIds.has(card.id))
    .map((card) => ({ kind: "scr-card", date: key, time: "All day", cardId: card.id, scrCard: card }));
  return [...crItems, ...scrItems, ...regular];
}

function syncCalendarEventsFromCards() {
  calendarState.events = buildCalendarEvents(today);
}

function buildCalendarEvents(baseDate) {
  if (typeof state === "undefined") return [];

  // Expand cards - including recurring event occurrences
  const familyEvents = [];
  for (const card of state.cards) {
    if (!card.due) continue;
    const baseOccurrence = _cardToCalEvent(card, new Date(card.due));
    familyEvents.push(baseOccurrence);

    // Expand recurring events up to 90 days out
    if (card.recurrence?.freq && card.recurrence.freq !== "none") {
      const occurrences = _expandRecurringCard(card, baseDate);
      familyEvents.push(...occurrences);
    }
  }

  // Merge Google Calendar events (own + co-parent + Apple CalDAV)
  // Work calendars are ALWAYS shown as busy - titles never imported.
  // Personal calendar: default busy; user can toggle "Show my titles" in the calendar view.
  const _showPersonalTitles = localStorage.getItem("do-do-show-personal-titles") === "true";
  const gcalEvents = (window.getGoogleCalendarEvents?.() || []).map((item) => {
    const date = new Date(item.start);
    // Work + co-parent work + Apple work = always busy, no exceptions
    const isWorkBusy = item.source === "work" || item.source === "coparent-work" || item.source === "apple-work";
    // Personal = busy by default; respect user toggle for own events only
    const isPersonalBusy = item.source === "personal" && !_showPersonalTitles;
    const isBusy = isWorkBusy || isPersonalBusy;
    return {
      cardId: item.id,
      date: toCalendarKey(date),
      time: item.allDay ? (window.t?.("cal.all_day") ?? "All day") : date.toLocaleTimeString(_getDateLocale(), { hour: "2-digit", minute: "2-digit", hour12: false }),
      title: isBusy ? "Busy" : item.title,
      detail: isBusy ? "Private calendar - details hidden" : (item.description || "Shared calendar"),
      kind: isBusy ? "busy" : "event",
      badge: isBusy ? "Busy" : (item.source === "family" ? "GCal" : "Calendar"),
      person: item.person || null,
      googleLink: item.htmlLink || null,
      privateBlock: isBusy,
    };
  });
  familyEvents.push(...gcalEvents);
  return [...familyEvents, ...buildPrivateWorkBlocks(baseDate)];
}

function _cardToCalEvent(card, date) {
  return {
    cardId: card.id,
    date: toCalendarKey(date),
    time: date.toLocaleTimeString(_getDateLocale(), { hour: "2-digit", minute: "2-digit", hour12: false }),
    title: card.title,
    detail: buildCalendarCardDetail(card),
    kind: calendarKindForCard(card),
    badge: card.type === "Expense" ? "Expense" : card.type,
    recurring: Boolean(card.recurrence?.freq && card.recurrence.freq !== "none"),
    child: card.child || null,
    assignee: card.assignee || null,
    due: date.toISOString(),
  };
}

function _expandRecurringCard(card, baseDate) {
  const results = [];
  const baseStart = new Date(card.due);
  const horizonEnd = new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000);
  const rec = card.recurrence;

  // Generate occurrences from the day after the base date up to horizon
  let cursor = new Date(baseStart);

  for (let i = 0; i < 200; i++) { // safety cap
    cursor = _nextOccurrence(cursor, rec);
    if (!cursor || cursor > horizonEnd) break;
    const occ = _cardToCalEvent(card, cursor);
    occ.cardId = `${card.id}-rec-${i}`; // unique per occurrence
    occ.recurringParentId = card.id;
    results.push(occ);
    cursor = new Date(cursor); // clone
  }
  return results;
}

function _nextOccurrence(from, rec) {
  if (!rec?.freq || rec.freq === "none") return null;
  const next = new Date(from);
  switch (rec.freq) {
    case "daily":
      next.setDate(next.getDate() + 1);
      return next;
    case "weekly":
    case "biweekly": {
      const interval = rec.freq === "biweekly" ? 14 : 7;
      if (!rec.days?.length) {
        next.setDate(next.getDate() + interval);
        return next;
      }
      // Find the next matching weekday
      const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
      const targetDays = rec.days.map((d) => dayMap[d]).filter((n) => n !== undefined).sort((a, b) => a - b);
      for (let d = 1; d <= interval + 7; d++) {
        const candidate = new Date(from);
        candidate.setDate(from.getDate() + d);
        if (targetDays.includes(candidate.getDay())) return candidate;
      }
      return null;
    }
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      return next;
    case "custom-wowo":
      next.setDate(next.getDate() + 14);
      return next;
    case "custom-223":
      // 2-2-3 rotates in a 7-day cycle
      next.setDate(next.getDate() + 7);
      return next;
    default:
      return null;
  }
}

function buildPrivateWorkBlocks(baseDate) {
  const automation = window.getAutomationSettings?.() || {};
  if (!automation.syncWorkCalendar) return [];
  const parentName = automation.workCalendarPerson || "Parent A";
  return [
    [1, "09:00"], [1, "15:00"], [2, "10:00"], [3, "08:00"], [4, "15:00"],
  ].map(([offset, time], index) => {
    const date = addDays(baseDate, offset);
    return {
      cardId: `private-work-block-${index}`,
      date: toCalendarKey(date),
      time,
      title: "Busy",
      detail: "Private work calendar · details hidden",
      kind: "busy",
      badge: "Busy",
      privateBlock: true,
      person: parentName,
    };
  });
}

function buildCalendarCardDetail(card) {
  return [card.topic, card.amount, card.assignee, card.child].filter(Boolean).join(" · ");
}

function calendarKindForCard(card) {
  if (card.type === "Expense" || card.topic === "Expenses") return "payment";
  if (card.type === "Request" || card.status === "Waiting" || card.status === "Important") return "request";
  return "event";
}

// ─── Conflict detection ───────────────────────────────────────────────────────

function detectConflicts(cards) {
  // Only check cards with due dates that are not Done/Paid
  const active = cards.filter((c) => c.due && c.status !== "Done" && c.status !== "Paid");
  const conflicts = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const aStart = new Date(a.due);
      const bStart = new Date(b.due);
      const aEnd = new Date(aStart.getTime() + 60 * 60 * 1000); // assume 1 h
      const bEnd = new Date(bStart.getTime() + 60 * 60 * 1000);
      // Overlap check: ±30 min tolerance (ranges intersect if aStart < bEnd && bStart < aEnd)
      const gap30 = 30 * 60 * 1000;
      const overlaps = aStart < new Date(bEnd.getTime() + gap30)
        && bStart < new Date(aEnd.getTime() + gap30);
      if (!overlaps) continue;
      const sharedChild = a.child && b.child && a.child === b.child;
      const sameParent = a.assignee && b.assignee && a.assignee === b.assignee;
      const bothParents = (a.assignee === "Both parents" || b.assignee === "Both parents");
      if (sharedChild || sameParent || bothParents) {
        conflicts.push({
          a: a.id,
          b: b.id,
          aTitle: a.title,
          bTitle: b.title,
          aTime: a.due,
          bTime: b.due,
          reason: sharedChild ? `Both involve ${a.child}` : `Same person assigned`,
          date: toCalendarKey(aStart),
        });
      }
    }
  }
  return conflicts;
}

function getConflictsForDate(key, allConflicts) {
  return allConflicts.filter((c) => c.date === key);
}

function getConflictsForCard(cardId, allConflicts) {
  return allConflicts.filter((c) => c.a === cardId || c.b === cardId);
}

// Expose conflict helpers for card dialog banner (app.js)
window.detectConflicts = detectConflicts;
window.getConflictsForCard = getConflictsForCard;

// ─── Cached conflicts for the current render ──────────────────────────────────

function _getActiveConflicts() {
  if (typeof state === "undefined") return [];
  return detectConflicts(state.cards);
}

function toCalendarKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseCalendarKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date, weekStartDay) {
  const wsd = weekStartDay ?? parseInt(localStorage.getItem("do-do-week-start") || "1");
  return addDays(date, -((date.getDay() - wsd + 7) % 7));
}

function _getDateLocale() {
  const lang = window.getCurrentLang?.() || localStorage.getItem("do-do-lang") || (navigator.language || "en").split("-")[0];
  return lang === "pl" ? "pl-PL" : lang === "de" ? "de-DE" : "en-US";
}

function formatMonthYear(date) {
  return date.toLocaleDateString(_getDateLocale(), { month: "long", year: "numeric" });
}

function formatAgendaDate(date) {
  return date.toLocaleDateString(_getDateLocale(), { month: "short", day: "numeric" });
}

function weekdayLabel(date) {
  return date.toLocaleDateString(_getDateLocale(), { weekday: "short" });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderSpecialPanel(moduleName, part = "all") {
  if (moduleName === "controls") {
    return `
      <section class="feature-panel">
        <h3>Always-allowed apps</h3>
        <div class="toggle-list">
          ${["Phone", "Camera", "Calculator", "Google Classroom", "Maps"].map((item) => renderToggle(item, true)).join("")}
          ${["YouTube", "Roblox"].map((item) => renderToggle(item, false)).join("")}
        </div>
      </section>
    `;
  }

  if (moduleName === "roles") {
    return `
      <section class="feature-panel">
        <h3>Audit trail</h3>
        <div class="timeline">
          <div><strong>Today 10:24</strong><span>Parent A changed Leo's school-day profile.</span></div>
          <div><strong>Yesterday 18:03</strong><span>Parent B invited attorney as read-only viewer.</span></div>
          <div><strong>May 15 08:40</strong><span>Ava's birthday advanced child UI tier automatically.</span></div>
        </div>
      </section>
    `;
  }

  if (moduleName === "integrations") {
    return `
      <section class="feature-panel">
        <h3>Connection toggles</h3>
        <div class="integration-list">
          ${["Google Calendar", "Apple Calendar", "Stripe", "Twilio", "Google Classroom", "DocuSign"].map((name, index) => `
            <div class="integration-row">
              <div>
                <strong>${name}</strong>
                <span>${index < 3 ? "Launch critical" : "Later workflow"}</span>
              </div>
              <button class="secondary-button ${index === 0 ? "connected" : ""}" data-toggle-integration="${name}" data-connected="${index === 0 ? "true" : "false"}">${index === 0 ? "Connected" : "Connect"}</button>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  if (moduleName === "settings") {
    const themePreference = window.getThemePreference?.() || "system";
    const appleCalStatus = window.getAppleCalConnectionStatus?.() || { connected: false };
    const automation = window.getAutomationSettings?.() || {
      automateReminders: false,
      syncFamilyCalendar: false,
      familyCalendarProvider: "google",
      syncWorkCalendar: false,
      workCalendarProvider: "google",
      workCalendarConnections: [],
      defaultReminderPreset: "60",
      reminderDelivery: "calendar-and-app",
    };
    const workCalendarConnections = Array.isArray(automation.workCalendarConnections) ? automation.workCalendarConnections : [];
    const _lt = window.t || ((k, fb) => fb || k);
    const leadTimes = [
      ["15",    _lt("auto.15min",  "15 minutes before")],
      ["60",    _lt("auto.1hour",  "1 hour before")],
      ["120",   _lt("auto.2hours", "2 hours before")],
      ["1440",  _lt("auto.1day",   "1 day before")],
      ["10080", _lt("auto.1week",  "1 week before")],
      ["at-due",_lt("auto.at_due", "At due time")],
    ];
    return `
      ${part === "all" || part === "custody" ? (() => {
        const cs = getCustodySchedule();
        const _ct = window.t || ((k) => k);
        return `
        <section class="feature-panel custody-settings">
          <h3>${_ct("custody.heading")}</h3>
          <p class="feature-note" style="margin:0 0 12px;font-size:13px;color:var(--muted);">${_ct("custody.desc")}</p>
          <div class="settings-control-list">
            <label class="settings-toggle-row">
              <span>
                <strong>${_ct("custody.show")}</strong>
                <em>${_ct("custody.show_hint")}</em>
              </span>
              <input type="checkbox" id="custodyEnabledToggle" ${cs.enabled ? "checked" : ""} />
            </label>
            <label class="settings-toggle-row">
              <span>
                <strong>Separated / divorced</strong>
                <em>Schedule changes require co-parent approval and are logged for records.</em>
              </span>
              <input type="checkbox" id="divorcedToggle" ${isDivorced() ? "checked" : ""} />
            </label>
            <div class="settings-select-row sched-settings-buttons">
              <span><strong>Vacation schedules</strong><em>Add periods with a different custody split.</em></span>
              <button class="ghost-button sched-settings-open-btn" type="button" id="openVacationsFromSettings">Manage vacations</button>
            </div>
            <div id="legalExportSection" style="display:block;border-top:1px solid var(--border-color,#eee);margin-top:8px;padding-top:12px;">
              <div class="settings-select-row sched-settings-buttons">
                <span>
                  <strong data-i18n="settings.legal_record">${window.t?.("settings.legal_record") ?? "Legal record"}</strong>
                  <em data-i18n="settings.legal_record_hint">${window.t?.("settings.legal_record_hint") ?? "Court-ready PDF with timestamped expenses, events and messages."}</em>
                </span>
                <button class="ghost-button sched-settings-open-btn" type="button" id="downloadLegalRecordButton" data-i18n="settings.download_legal_pdf">${window.t?.("settings.download_legal_pdf") ?? "Download PDF"}</button>
              </div>
              <div class="settings-select-row sched-settings-buttons">
                <span>
                  <strong data-i18n="settings.download_data_title">${window.t?.("settings.download_data_title") ?? "Export my data"}</strong>
                  <em data-i18n="settings.download_data_hint">${window.t?.("settings.download_data_hint") ?? "Full JSON export of your data (GDPR / RODO)."}</em>
                </span>
                <button class="ghost-button sched-settings-open-btn" type="button" id="downloadMyDataButton" data-i18n="settings.download_data">${window.t?.("settings.download_data") ?? "Download"}</button>
              </div>
            </div>
          </div>
        </section>`;
      })() : ""}

      ${part === "all" || part === "appearance" ? `
      <section class="feature-panel appearance-settings">
        <h3>${window.t?.("settings.appearance") ?? "Appearance"}</h3>
        <div class="settings-control-list">
          <label class="settings-select-row">
            <span>
              <strong>${window.t?.("settings.theme") ?? "Theme"}</strong>
              <em>${window.t?.("settings.theme_hint") ?? "Follow your device setting or choose a fixed appearance."}</em>
            </span>
            <select id="themePreference">
              <option value="system" ${themePreference === "system" ? "selected" : ""}>${window.t?.("settings.theme_system") ?? "Use system setting"}</option>
              <option value="light" ${themePreference === "light" ? "selected" : ""}>${window.t?.("settings.theme_light") ?? "Light"}</option>
              <option value="dark" ${themePreference === "dark" ? "selected" : ""}>${window.t?.("settings.theme_dark") ?? "Dark"}</option>
            </select>
          </label>
          <label class="settings-select-row">
            <span>
              <strong>${window.t?.("settings.language_label") ?? "App language"}</strong>
              <em>${window.t?.("settings.language_hint") ?? "Choose English, Deutsch or Polski."}</em>
            </span>
            <select id="languagePreference">
              <option value="en" ${window.getCurrentLang?.() === "en" ? "selected" : ""}>English</option>
              <option value="de" ${window.getCurrentLang?.() === "de" ? "selected" : ""}>Deutsch</option>
              <option value="pl" ${window.getCurrentLang?.() === "pl" ? "selected" : ""}>Polski</option>
            </select>
          </label>
          <label class="settings-select-row">
            <span>
              <strong>${window.t?.("settings.currency_label") ?? "Currency"}</strong>
              <em>${window.t?.("settings.currency_hint") ?? "Used for expenses. Independent of language."}</em>
            </span>
            <select id="currencyPreference">
              <option value="CHF" ${(window.getCurrencyPreference?.() || window.LOCALE_CONFIG?.currency || "CHF") === "CHF" ? "selected" : ""}>CHF - Swiss Franc</option>
              <option value="EUR" ${(window.getCurrencyPreference?.() || window.LOCALE_CONFIG?.currency) === "EUR" ? "selected" : ""}>EUR - Euro</option>
              <option value="PLN" ${(window.getCurrencyPreference?.() || window.LOCALE_CONFIG?.currency) === "PLN" ? "selected" : ""}>PLN - Polish Zloty</option>
            </select>
          </label>
        </div>
      </section>
      ` : ""}
      ${part === "all" || part === "automation" ? (() => {
        const _at = window.t || ((k) => k);
        const providerName = automation.familyCalendarProvider === "outlook" ? "Outlook" : "Google";
        return `
      <section class="feature-panel automation-settings">
        <h3>${_at("settings.automation")}</h3>
        <div class="settings-control-list">
          <label class="settings-toggle-row">
            <span>
              <strong>${_at("tip.settings.label")}</strong>
              <em>${_at("tip.settings.desc")}</em>
            </span>
            <input type="checkbox" id="dailyTipsToggle" ${localStorage.getItem("do-do-tips-enabled") !== "false" ? "checked" : ""} />
          </label>
          <label class="settings-toggle-row">
            <span>
              <strong>${_at("auto.remind_toggle")}</strong>
              <em>${_at("auto.remind_toggle_hint")}</em>
            </span>
            <input type="checkbox" id="autoRemindersToggle" ${automation.automateReminders ? "checked" : ""} />
          </label>
          <label class="settings-toggle-row">
            <span>
              <strong>${_at("auto.family_cal")}</strong>
              <em>${_at("auto.family_cal_hint")}</em>
            </span>
            <input type="checkbox" id="familyCalendarToggle" ${automation.syncFamilyCalendar ? "checked" : ""} />
          </label>
          <label class="settings-select-row">
            <span>
              <strong>${_at("auto.family_cal_provider")}</strong>
              <em>${_at("auto.family_cal_provider_hint")}</em>
            </span>
            <select id="familyCalendarProvider">
              <option value="google" ${automation.familyCalendarProvider === "google" ? "selected" : ""}>Google Calendar</option>
              <option value="outlook" ${automation.familyCalendarProvider === "outlook" ? "selected" : ""}>Outlook Calendar</option>
            </select>
          </label>
          <label class="settings-select-row">
            <span>
              <strong>${_at("auto.global_reminder")}</strong>
              <em>${_at("auto.global_reminder_hint")}</em>
            </span>
            <select id="globalReminderPreset">
              ${leadTimes.map(([value, label]) => `<option value="${value}" ${automation.defaultReminderPreset === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
          <label class="settings-select-row">
            <span>
              <strong>${_at("auto.delivery")}</strong>
              <em>${_at("auto.delivery_hint")}</em>
            </span>
            <select id="reminderDelivery">
              <option value="app-only" ${automation.reminderDelivery === "app-only" ? "selected" : ""}>${_at("auto.delivery_app_only")}</option>
              <option value="calendar-only" ${automation.reminderDelivery === "calendar-only" ? "selected" : ""}>${_at("auto.delivery_cal_only")}</option>
              <option value="calendar-and-app" ${automation.reminderDelivery === "calendar-and-app" || !["app-only","calendar-only"].includes(automation.reminderDelivery) ? "selected" : ""}>${_at("auto.delivery_cal_app")}</option>
            </select>
          </label>
          <label class="settings-toggle-row" id="quietHoursToggleRow">
            <span>
              <strong>${_at("auto.quiet_hours", "Quiet hours")}</strong>
              <em>${_at("auto.quiet_hours_hint", "No notifications or reminders during night hours.")}</em>
            </span>
            <input type="checkbox" id="quietHoursToggle" />
          </label>
          <div id="quietHoursTimesBlock" style="display:none;flex-direction:column;gap:4px;">
            <label class="settings-select-row">
              <span style="padding-left:16px;">
                <strong>${_at("auto.quiet_from", "From")}</strong>
                <em>${_at("auto.quiet_from_hint", "Start of quiet hours.")}</em>
              </span>
              <select id="quietHoursFrom">
                ${Array.from({length:24},(_,h)=>`<option value="${String(h).padStart(2,"0")}:00">${String(h).padStart(2,"0")}:00</option>`).join("")}
              </select>
            </label>
            <label class="settings-select-row">
              <span style="padding-left:16px;">
                <strong>${_at("auto.quiet_to", "Until")}</strong>
                <em>${_at("auto.quiet_to_hint", "End of quiet hours.")}</em>
              </span>
              <select id="quietHoursTo">
                ${Array.from({length:24},(_,h)=>`<option value="${String(h).padStart(2,"0")}:00">${String(h).padStart(2,"0")}:00</option>`).join("")}
              </select>
            </label>
          </div>
        </div>
      </section>
      <section class="feature-panel google-calendar-connection">
        <div class="feature-panel-header">
          <h3>${_at("auto.cal_connections")}</h3>
          <button class="secondary-button feature-action" data-action="Connect Shared Calendar">${_at("auto.connect_btn")}</button>
        </div>
        <div class="settings-connection-list">
          <div class="settings-connection-row">
            <span>
              <strong>${_at("auto.family_cal_label")}</strong>
              <em>${automation.syncFamilyCalendar ? _at("auto.family_cal_ready", { provider: providerName }) : _at("auto.family_cal_connect_hint")}</em>
            </span>
            <b id="gcalTokenStatusBadge">${automation.syncFamilyCalendar ? _at("auto.on") : _at("auto.connect_btn")}</b>
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>${_at("auto.privacy")}</strong>
              <em>${_at("auto.privacy_hint")}</em>
            </span>
            <b>${_at("auto.isolated")}</b>
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>${_at("auto.work_cal")}</strong>
              <em>${_at("auto.work_cal_hint")}</em>
            </span>
            <input type="checkbox" id="workCalendarToggle" ${automation.syncWorkCalendar ? "checked" : ""} />
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>${_at("auto.work_provider")}</strong>
              <em>${_at("auto.work_provider_hint")}</em>
            </span>
            <select id="workCalendarProvider">
              <option value="google" ${automation.workCalendarProvider === "google" ? "selected" : ""}>Google Calendar</option>
              <option value="outlook" ${automation.workCalendarProvider === "outlook" ? "selected" : ""}>Microsoft</option>
            </select>
          </div>
          <div class="settings-connection-row work-calendar-connect-row">
            <span>
              <strong>${_at("auto.work_connect")}</strong>
              <em>${_at("auto.work_connect_hint")}</em>
            </span>
            <div class="calendar-connect-actions">
              <button class="secondary-button ${workCalendarConnections.includes("google") ? "connected" : ""}" type="button" data-connect-work-provider="google">${workCalendarConnections.includes("google") ? "Google connected" : _at("auto.connect_btn") + " Google"}</button>
              <button class="secondary-button ${workCalendarConnections.includes("outlook") ? "connected" : ""}" type="button" data-connect-work-provider="outlook">${workCalendarConnections.includes("outlook") ? "Outlook connected" : _at("auto.connect_btn") + " Microsoft"}</button>
            </div>
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>${_at("auto.work_shared")}</strong>
              <em>${_at("auto.work_shared_hint")}</em>
            </span>
            <b>${_at("auto.busy_only")}</b>
          </div>
        </div>
      </section>

      <section class="feature-panel apple-calendar-section">
        ${(() => { const _ac = window.t || ((k, fb) => fb || k); return `
        <div class="feature-panel-header">
          <h3>${_ac("apple.heading", "Apple Calendar (iCloud)")}</h3>
          <span class="feature-badge ${appleCalStatus.connected ? "badge-connected" : "badge-pending"}">${appleCalStatus.connected ? _ac("apple.connected", "Connected") : _ac("apple.not_connected", "Not connected")}</span>
        </div>
        <p class="feature-note">${_ac("apple.note", "iPhone users: connect iCloud Calendar to see your busy blocks and sync Do-Do events. Requires an app-specific password from appleid.apple.com - Security - App-Specific Passwords.")} <a href="https://appleid.apple.com" target="_blank" rel="noopener">appleid.apple.com</a></p>
        ${appleCalStatus.connected
          ? `<div class="settings-connection-row">
               <span><strong>${_ac("apple.connected_as", "Connected as")}</strong><em>${appleCalStatus.email}</em></span>
               <button class="ghost-button" id="disconnectAppleCalButton">${_ac("apple.disconnect", "Disconnect")}</button>
             </div>`
          : `<div class="apple-cal-form">
               <label class="clean-field">
                 ${_ac("apple.email_label", "iCloud email")}
                 <input type="email" id="appleCalEmail" placeholder="you@icloud.com" autocomplete="off" />
               </label>
               <label class="clean-field">
                 ${_ac("apple.pass_label", "App-specific password")}
                 <input type="password" id="appleCalPassword" placeholder="xxxx-xxxx-xxxx-xxxx" autocomplete="new-password" />
               </label>
               <div class="section-actions">
                 <button class="secondary-button" id="connectAppleCalButton">${_ac("apple.connect_btn", "Connect iCloud Calendar")}</button>
               </div>
             </div>`
        }
        `; })()}
      </section>

      <section class="feature-panel calendar-import-settings">
        <div class="feature-panel-header">
          <h3>${_at("auto.import_heading", "Import from Google Calendar")}</h3>
          <span class="feature-badge ${automation.importCalendarId ? "badge-connected" : "badge-pending"}">${automation.importCalendarId ? _at("auto.import_active", "Active") : _at("auto.import_setup", "Set up")}</span>
        </div>
        <p class="feature-note">${_at("auto.import_note", "Pull events from any Google Calendar into your Do-Do board as cards. Updates automatically on each app load.")}</p>
        <div class="settings-control-list">
          <div class="settings-connection-row">
            <span>
              <strong>${_at("auto.import_calendar", "Calendar to import")}</strong>
              <em>${_at("auto.import_calendar_hint", "Pick which of your Google Calendars to import events from.")}</em>
            </span>
            <div class="import-cal-selector">
              <select id="importCalendarSelect">
                <option value="">${automation.importCalendarId ? _at("auto.import_loading", "Loading...") : _at("auto.import_pick", "-- pick a calendar --")}</option>
                ${automation.importCalendarId ? `<option value="${escapeHtml(automation.importCalendarId)}" selected>${escapeHtml(automation.importCalendarName || automation.importCalendarId)}</option>` : ""}
              </select>
              <button class="ghost-button" type="button" id="refreshCalendarListBtn" title="Refresh list">&#8635;</button>
            </div>
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>${_at("auto.import_range", "Import range")}</strong>
              <em>${_at("auto.import_range_hint", "How many days ahead to import events.")}</em>
            </span>
            <div class="import-range-selector">
              <input type="number" id="importCalDaysAhead" min="7" max="365" value="${automation.importCalendarDaysAhead || 30}" style="width:4.5rem;text-align:center;" />
              <span>${_at("auto.import_days", "days")}</span>
            </div>
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>${_at("auto.import_sync_mode", "Sync mode")}</strong>
              <em>${_at("auto.import_sync_hint", "Import only: pull events as read-only cards. Two-way: editing a card also updates the calendar event.")}</em>
            </span>
            <select id="importCalSyncMode">
              <option value="import-only" ${automation.importCalendarSyncMode !== "two-way" ? "selected" : ""}>${_at("auto.import_only", "Import only")}</option>
              <option value="two-way" ${automation.importCalendarSyncMode === "two-way" ? "selected" : ""}>${_at("auto.import_two_way", "Two-way sync")}</option>
            </select>
          </div>
          <div class="settings-connection-row import-cal-action-row">
            <span id="importCalStatusMsg">
              ${automation.importCalendarId ? `<em>${_at("auto.import_last_source", "Last source:")} <strong>${escapeHtml(automation.importCalendarName || automation.importCalendarId)}</strong></em>` : `<em>${_at("auto.import_none", "No calendar linked yet.")}</em>`}
            </span>
            <button class="secondary-button" type="button" id="runCalendarImportBtn">${_at("auto.import_now", "Import now")}</button>
          </div>
        </div>
      </section>

      <section class="feature-panel coparent-calendar-section">
        ${(() => { const _cc = window.t || ((k, fb) => fb || k); const _synced = automation.syncFamilyCalendar || automation.syncWorkCalendar; return `
        <div class="feature-panel-header">
          <h3>${_cc("copcal.heading", "Co-parent calendar")}</h3>
        </div>
        <p class="feature-note">${_cc("copcal.note", "Your co-parent connects their own calendar from their device in their Do-Do settings. Once connected, their busy blocks show on your shared calendar in a different color.")}</p>
        <div class="settings-connection-list">
          <div class="settings-connection-row">
            <span>
              <strong>${_cc("copcal.your_cal", "Your calendar")}</strong>
              <em>${_synced ? _cc("copcal.connected_busy", "Connected - busy blocks shared") : _cc("copcal.not_connected", "Not connected")}</em>
            </span>
            <b class="${_synced ? "status-connected" : "status-pending"}">${_synced ? _cc("copcal.active", "Active") : _cc("copcal.set_up_above", "Set up above")}</b>
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>${_cc("copcal.coparent_cal", "Co-parent's calendar")}</strong>
              <em>${_cc("copcal.visible_once", "Visible once they connect from their device.")}</em>
            </span>
            <b class="status-pending" id="coParentCalStatus">${_cc("copcal.checking", "Checking...")}</b>
          </div>
        </div>
        `; })()}
      </section>`;
      })() : ""}
      ${/* SEG-14: Siri parked - /api/siri-* endpoints are not deployed (Vercel
            Hobby 12-function limit). Re-enable with SEG-12 iOS wrapper. */ ""}
      ${false && (part === "all" || part === "siri") ? `
      <section class="feature-panel siri-integration-section">
        <div class="feature-panel-header">
          <h3>Siri &amp; Voice Shortcuts</h3>
          <span class="feature-badge badge-pending" id="siriBadge">Set up</span>
        </div>
        <p class="feature-note">Say <em>"Hey Siri, Add to Do-Do"</em> to create a card hands-free.</p>
        <div class="settings-control-list">
          <div class="settings-connection-row">
            <span>
              <strong>Set up Siri</strong>
              <em id="siriStatusLabel">Tap to install your personal shortcut - no configuration needed.</em>
            </span>
            <button class="primary-button" id="siriSetupButton" type="button">Install Shortcut</button>
          </div>
        </div>
        <p class="feature-note" id="siriHelpText" style="display:none;margin-top:8px;">
          <strong>One-time:</strong> if iOS asks about untrusted shortcuts, go to iPhone Settings &rarr; Shortcuts &rarr; Allow Untrusted Shortcuts, then come back and tap Install again.
        </p>
      </section>
      ` : ""}

      ${part === "all" || part === "vaccine" ? renderVaccinePanel() : ""}
    `;
  }

  return `
    <section class="feature-panel">
      <h3>Prototype note</h3>
      <p class="feature-note">This screen captures the workflow and user-facing information architecture. Production requires platform APIs, backend services, compliance review, and real audit/security controls.</p>
    </section>
  `;
}

function renderVaccinePanel() {
  const _vt = window.t || ((k, fb) => fb || k);
  const allCards = typeof window.getCards === "function" ? window.getCards() : [];
  const vaccineCards = allCards
    .filter((c) => c.type === "Vaccine" && c.status !== "Done" && !c.deleted_at)
    .sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);

  // Build the list of people (kids + pets) for filter chips + add buttons
  const family = typeof getFamilyPeople === "function" ? getFamilyPeople() : { children: [], pets: [] };
  const kids = family.children.map((c) => c.name).filter(Boolean);
  const pets = family.pets.map((p) => p.name).filter(Boolean);
  const allPeople = [
    ...kids.map((n) => ({ name: n, emoji: "👶", type: "child" })),
    ...pets.map((n) => ({ name: n, emoji: "🐾", type: "pet" })),
  ];

  // Person filter chips (shown only when there are people)
  const filterChips = allPeople.length > 1
    ? `<div class="vaccine-filter-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
        <button class="vaccine-chip vaccine-chip-active" data-vaccine-filter="" style="padding:4px 10px;border-radius:20px;font-size:12px;border:1px solid var(--line);background:var(--surface-raised);cursor:pointer;">All</button>
        ${allPeople.map((p) => `<button class="vaccine-chip" data-vaccine-filter="${escapeHtml(p.name)}" style="padding:4px 10px;border-radius:20px;font-size:12px;border:1px solid var(--line);background:var(--surface-page);cursor:pointer;">${p.emoji} ${escapeHtml(p.name)}</button>`).join("")}
      </div>`
    : "";

  // Add buttons: one per person if people exist, else generic
  const addButtons = allPeople.length
    ? allPeople.map((p) => `<button class="secondary-button" type="button" data-add-vaccine-for="${escapeHtml(p.name)}" style="font-size:12px;padding:4px 10px;min-height:28px;">${p.emoji} ${escapeHtml(p.name)}</button>`).join("")
    : `<button class="secondary-button" type="button" id="addVaccineBtn">${_vt("vaccine.add", "+ Add vaccine")}</button>`;

  const addSection = allPeople.length
    ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;color:var(--muted);white-space:nowrap;">+ Add for:</span>
        ${addButtons}
      </div>`
    : addButtons;

  const rows = vaccineCards.length
    ? vaccineCards.map((c) => {
        const dueStr = c.due
          ? new Date(c.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
          : "No date";
        // Show who this vaccine is for
        const forName = c.child || "";
        const forPerson = allPeople.find((p) => p.name === forName);
        const forTag = forName
          ? `<span style="font-size:11px;color:var(--muted);background:var(--surface-raised);padding:1px 7px;border-radius:10px;margin-left:4px;">${forPerson ? forPerson.emoji + " " : ""}${escapeHtml(forName)}</span>`
          : "";
        return `
          <div class="budget-row vaccine-row" data-vaccine-card="${c.id}" data-vaccine-for="${escapeHtml(forName)}" role="button" tabindex="0" style="cursor:pointer;">
            <span style="display:flex;flex-direction:column;gap:2px;">
              <span style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                <strong>${escapeHtml(c.title)}</strong>${forTag}
              </span>
              <em style="font-size:12px;color:var(--muted);">Due ${dueStr}${c.details ? " · " + escapeHtml(c.details.substring(0, 40)) : ""}</em>
            </span>
            <button class="secondary-button" type="button" data-open-vaccine="${c.id}" style="flex-shrink:0;">${_vt("vaccine.open", "Open")}</button>
          </div>
        `;
      }).join("")
    : `<p class="feature-empty">${_vt("vaccine.empty", "No vaccine cards yet. Add one to track due dates and reminders.")}</p>`;

  return `
    <section class="feature-panel" id="vaccinePanelSection">
      <div class="feature-panel-header">
        <h3>${_vt("vaccine.heading", "Vaccine schedule")}</h3>
      </div>
      ${filterChips}
      <div class="budget-list" id="vaccineCardList">
        ${rows}
      </div>
      <div style="margin-top:10px;">
        ${addSection}
      </div>
    </section>
  `;
}

function bindVaccinePanel() {
  const section = document.getElementById("vaccinePanelSection");
  if (!section) return;

  // Generic add (no people configured)
  section.querySelector("#addVaccineBtn")?.addEventListener("click", () => {
    if (typeof openCardDialog === "function") {
      openCardDialog("", "info", { type: "Vaccine", topic: "Medical" });
    }
  });

  // Add vaccine for a specific person (child or pet)
  section.querySelectorAll("[data-add-vaccine-for]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const forName = btn.dataset.addVaccineFor;
      if (typeof openCardDialog === "function") {
        openCardDialog("", "info", { type: "Vaccine", topic: "Medical", child: forName });
      }
    });
  });

  // Filter chips
  section.querySelectorAll(".vaccine-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      section.querySelectorAll(".vaccine-chip").forEach((c) => {
        c.classList.remove("vaccine-chip-active");
        c.style.background = "var(--surface-page)";
      });
      chip.classList.add("vaccine-chip-active");
      chip.style.background = "var(--surface-raised)";
      const filterName = chip.dataset.vaccineFilter;
      section.querySelectorAll("[data-vaccine-card]").forEach((row) => {
        if (!filterName || row.dataset.vaccineFor === filterName) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    });
  });

  // Open existing vaccine card
  section.querySelectorAll("[data-open-vaccine]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.openVaccine;
      if (typeof openCardDialog === "function") openCardDialog(id);
    });
  });

  // Click row to open card
  section.querySelectorAll("[data-vaccine-card]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const id = row.dataset.vaccineCard;
      if (typeof openCardDialog === "function") openCardDialog(id);
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const id = row.dataset.vaccineCard;
        if (typeof openCardDialog === "function") openCardDialog(id);
      }
    });
  });
}

function renderToggle(label, checked) {
  return `
    <label class="toggle-row">
      <span>${label}</span>
      <input type="checkbox" ${checked ? "checked" : ""} />
    </label>
  `;
}

function showFeatureToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

// ─── Settings feature (real data) ────────────────────────────────────────────

function renderSettingsFeature() {
  const setup = window.getOnboardingState?.() || {};
  const children = setup.children || [];
  const pets = setup.pets || [];
  const myName = typeof getMyName === "function" ? getMyName() : (setup.parents?.primary || "");
  const coparentName = setup.parents?.coparent || "";

  const renderMemberRow = (name, index, type) => `
    <article class="feature-item feature-item-editable">
      <div class="feature-item-main">
        <strong>${escapeHtml(name)}</strong>
      </div>
      <div class="feature-item-actions">
        <button class="icon-button icon-button-sm" data-edit-${type}="${index}" aria-label="Edit ${name}">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M11.5 2.5a1.5 1.5 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5Z"/>
          </svg>
        </button>
        <button class="icon-button icon-button-sm icon-button-danger" data-delete-${type}="${index}" aria-label="Delete ${name}">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4"/>
          </svg>
        </button>
      </div>
    </article>
  `;

  const _st = window.t || ((k) => k);

  const renderCaregiverRow = (cg, index) => {
    const name = cg.name || cg;
    const email = cg.email || "";
    return `
      <article class="feature-item feature-item-editable">
        <div class="feature-item-main">
          <strong>${escapeHtml(name)}</strong>
          ${email ? `<span style="color:var(--muted);font-size:12px;">${escapeHtml(email)}</span>` : ""}
        </div>
        <div class="feature-item-actions">
          <button class="icon-button icon-button-sm" data-edit-caregiver="${index}" aria-label="Edit ${escapeHtml(name)}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M11.5 2.5a1.5 1.5 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5Z"/>
            </svg>
          </button>
          <button class="icon-button icon-button-sm icon-button-danger" data-delete-caregiver="${index}" aria-label="Delete ${escapeHtml(name)}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4"/>
            </svg>
          </button>
        </div>
      </article>
    `;
  };

  const caregivers = setup.caregivers || [];
  featureModule.innerHTML = `
    <div class="feature-layout settings-layout">
      ${renderSpecialPanel("settings", "automation")}

      <section class="feature-panel" id="caregiversPanel">
        <div class="feature-panel-header">
          <h3>Caregivers</h3>
          <button class="secondary-button" id="addCaregiverBtn">${_st("settings.add_caregiver")}</button>
        </div>

        <!-- Parents -->
        <div class="cg-people-list">
          ${(() => {
            const cs = getCustodySchedule();
            const myInitial = (myName || "A").charAt(0).toUpperCase();
            const coInitial = (coparentName || "B").charAt(0).toUpperCase();
            const swatchRow = (target, currentColor) =>
              `<div class="cg-swatches" data-cg-color-target="${target}">
                ${CUSTODY_COLORS.map(c => `<button type="button" class="custody-swatch cg-swatch${currentColor === c.value ? " active" : ""}" data-custody-color="${c.value}" style="background:${c.value};" title="${c.label}" aria-label="${c.label}"></button>`).join("")}
              </div>`;
            return `
              <div class="cg-person-row">
                <div class="mini-avatar parent-a-mini" aria-hidden="true">${myInitial}</div>
                <div class="cg-person-info">
                  <div class="cg-person-name-row">
                    <strong>${escapeHtml(myName || "Parent A")}</strong>
                    <span class="cg-role-tag">You</span>
                    <button class="icon-button icon-button-sm" id="editMyNameBtn" aria-label="Edit your name">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M11.5 2.5a1.5 1.5 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5Z"/></svg>
                    </button>
                  </div>
                  ${swatchRow("myColor", cs.myColor)}
                </div>
              </div>
              <div class="cg-person-row">
                <div class="mini-avatar parent-b-mini" aria-hidden="true">${coInitial}</div>
                <div class="cg-person-info">
                  <div id="invitePanelContent">
                    <p class="feature-empty" style="font-size:13px;color:var(--muted);">${_st("settings.checking")}</p>
                  </div>
                  ${swatchRow("coColor", cs.coColor)}
                </div>
              </div>
            `;
          })()}
        </div>

        <!-- Schedule button -->
        <div class="cg-schedule-row">
          <div class="cg-schedule-info">
            <strong>Parenting schedule</strong>
            <em>Set custody pattern and day-by-day overrides</em>
          </div>
          <button class="ghost-button sched-settings-open-btn" type="button" id="openSchedEditorFromSettings">Edit schedule</button>
        </div>

        <!-- Additional caregivers -->
        <div class="cg-extra-header" style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;">Additional</span>
          <button class="secondary-button" id="addCaregiverBtn2" style="font-size:12px;padding:4px 10px;min-height:28px;">${_st("settings.add_caregiver")}</button>
        </div>
        <div class="feature-items" id="caregiversList">
          ${caregivers.length
            ? caregivers.map((c, i) => renderCaregiverRow(c, i)).join("")
            : `<p class="feature-empty" style="font-size:13px;color:var(--muted);">${_st("settings.no_caregivers")}</p>`}
        </div>
        <div id="addCaregiverForm" style="display:none;padding:12px 0 4px;"></div>
      </section>

      <section class="feature-panel">
        <div class="feature-panel-header">
          <h3>${_st("settings.children")}</h3>
          <button class="secondary-button" id="addChildBtn">${_st("settings.add_child")}</button>
        </div>
        <div class="feature-items" id="childrenList">
          ${children.length
            ? children.map((c, i) => renderMemberRow(c.name || c, i, "child")).join("")
            : `<p class="feature-empty">${_st("settings.no_children")}</p>`}
        </div>
      </section>

      <!-- Kid Access panel -->
      <section class="feature-panel" id="kidAccessPanel">
        <div class="feature-panel-header">
          <h3>Kid Access</h3>
        </div>
        <p class="feature-note" style="font-size:13px;color:var(--muted);margin:0 0 14px;">
          Give each child a private link + 4-digit PIN so they can see their schedule and send you a "I need" card.
        </p>
        <div id="kidAccessList">
          ${children.length
            ? children.map((c, i) => {
                const childName = c.name || c;
                return `
                  <article class="feature-item" style="flex-direction:column;gap:8px;align-items:stretch;" id="kidAccessItem-${i}">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <strong style="flex:1;">${escapeHtml(childName)}</strong>
                      <button class="secondary-button" data-kid-setup="${i}" style="font-size:12px;padding:4px 10px;min-height:28px;">Set up</button>
                    </div>
                    <div class="kid-access-status" id="kidStatus-${i}" style="font-size:12px;color:var(--muted);">Checking...</div>
                  </article>`;
              }).join("")
            : `<p class="feature-empty" style="font-size:13px;color:var(--muted);">Add children above first, then set up their Kid Access here.</p>`}
        </div>
      </section>

      <section class="feature-panel">
        <div class="feature-panel-header">
          <h3>${_st("settings.pets")}</h3>
          <button class="secondary-button" id="addPetBtn">${_st("settings.add_pet")}</button>
        </div>
        <div class="feature-items" id="petsList">
          ${pets.length
            ? pets.map((p, i) => renderMemberRow(p.name || p, i, "pet")).join("")
            : `<p class="feature-empty">${_st("settings.no_pets")}</p>`}
        </div>
      </section>

      ${renderSpecialPanel("settings", "vaccine")}

      ${renderSpecialPanel("settings", "custody")}

      <section class="feature-panel" id="calendarSettingsPanel">
        <h3>Calendar hours</h3>
        <p class="feature-note" style="font-size:13px;color:var(--muted);margin:0 0 12px;">
          Choose which hours are shown in the calendar view.
        </p>
        <div class="feature-items">
          <article class="feature-item" style="flex-direction:column;gap:10px;align-items:stretch;">
            <label style="display:flex;align-items:center;gap:10px;font-size:13px;">
              <span style="min-width:80px;color:var(--muted);">Start hour</span>
              <select id="calStartHourSelect" style="flex:1;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-page);color:var(--ink);font-size:13px;">
                ${Array.from({length: 13}, (_, i) => {
                  const h = i + 4; // 4 AM to 16
                  const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
                  return `<option value="${h}">${label}</option>`;
                }).join("")}
              </select>
            </label>
            <label style="display:flex;align-items:center;gap:10px;font-size:13px;">
              <span style="min-width:80px;color:var(--muted);">End hour</span>
              <select id="calEndHourSelect" style="flex:1;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-page);color:var(--ink);font-size:13px;">
                ${Array.from({length: 10}, (_, i) => {
                  const h = i + 16; // 16 (4 PM) to 25 -> cap at 24
                  const hc = Math.min(h, 24);
                  const label = hc === 24 ? "Midnight" : hc < 12 ? `${hc} AM` : hc === 12 ? "12 PM" : `${hc - 12} PM`;
                  return `<option value="${hc}">${label}</option>`;
                }).join("")}
              </select>
            </label>
            <button class="secondary-button" id="calSettingsSaveBtn" style="align-self:flex-end;">Save</button>
          </article>
        </div>
      </section>

      <section class="feature-panel" id="subscriptionPanel">
        <h3>${_st("settings.subscription")}</h3>
        <div class="feature-items" id="subscriptionPanelContent">
          <p class="feature-empty" style="font-size:13px;color:var(--muted);">${_st("settings.loading")}</p>
        </div>
      </section>

      <section class="feature-panel" id="promoCodePanel">
        <h3>Access code</h3>
        ${window.isPromoActive?.() ? `
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface-alt);border-radius:8px;border:1px solid var(--line);">
            <span style="color:#22c55e;font-size:16px;">&#10003;</span>
            <span style="font-size:13px;font-weight:600;color:var(--ink);">Active</span>
          </div>
        ` : `
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" id="promoCodeInput" placeholder="Enter code"
              style="flex:1;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface-page);color:var(--ink);font-size:13px;"
              autocomplete="off" spellcheck="false">
            <button class="secondary-button" id="promoCodeApplyBtn">Apply</button>
          </div>
          <p id="promoCodeError" style="font-size:12px;color:#ef4444;margin:6px 0 0;display:none;">Invalid code.</p>
        `}
      </section>

      <section class="feature-panel share-panel">
        <div class="feature-panel-header">
          <h3>${_st("share.heading")}</h3>
        </div>
        <p class="feature-note">${_st("share.desc")}</p>
        <div class="share-actions">
          <button class="secondary-button" id="shareWhatsAppButton">${_st("share.whatsapp")}</button>
          <button class="secondary-button" id="shareEmailButton">${_st("share.email_btn")}</button>
          <button class="ghost-button" id="shareCopyButton">${_st("settings.copy_link")}</button>
        </div>
      </section>

      <!-- SEG-11.2: Shared history view - shown after 30 days -->
      <section class="feature-panel" id="sharedHistoryPanel" style="display:none;">
        <h3>Your shared record</h3>
        <div id="sharedHistoryContent">
          <p class="feature-empty" style="font-size:13px;color:var(--muted);">Loading...</p>
        </div>
      </section>


      <!-- SEG-11.3: Mediator referral -->
      <section class="feature-panel" id="mediatorPanel">
        <h3>Share with a mediator</h3>
        <p class="feature-note" style="font-size:13px;color:var(--muted);margin:0 0 12px;">
          Give this link to your mediator. They can bookmark it to track how families you refer are doing - no login required.
        </p>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="text" id="mediatorLinkInput" readonly
            style="flex:1;min-width:180px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface-alt);color:var(--ink);font-size:13px;"
            value="Generating...">
          <button class="secondary-button" id="copyMediatorLinkBtn">Copy link</button>
        </div>
        <p id="mediatorLinkNote" style="font-size:12px;color:var(--muted);margin-top:8px;display:none;">
          Link copied to clipboard
        </p>
      </section>

      <!-- SEG-11.4: Schedule cascade -->
      <section class="feature-panel" id="scheduleCascadePanel">
        <div class="feature-panel-header">
          <h3>${_at("tmpl.heading", "Custody week templates")}</h3>
          <button class="secondary-button" id="addScheduleTemplateBtn">+ ${_at("tmpl.add", "New template")}</button>
        </div>
        <p class="feature-note" style="font-size:13px;color:var(--muted);margin:6px 0 12px;">
          ${_at("tmpl.desc", "Named recurring custody weeks. Moving one template updates all linked cards and calendar events in one action.")}
        </p>
        <div id="scheduleTemplatesList">
          <p class="feature-empty" style="font-size:13px;color:var(--muted);">${_at("tmpl.empty", "Loading templates...")}</p>
        </div>
      </section>

      <section class="feature-panel">
        <h3>${_st("settings.account")}</h3>
        <div class="feature-items">
          <article class="feature-item">
            <strong>${_st("settings.gcal")}</strong>
            <span>${_st("settings.gcal_hint")}</span>
          </article>
        </div>
        <div class="account-action-row" style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
          <button class="secondary-button" id="signOutButton" style="color:#ef4444;border-color:#ef4444;">${_st("settings.sign_out")}</button>
          <a class="secondary-button" href="/legal.html" target="_blank" rel="noopener" style="text-decoration:none;">${_st("settings.privacy")}</a>
        </div>
        <div style="margin-top:12px;">
          <button class="ghost-button" id="deleteAccountButton" style="color:var(--muted);font-size:12px;padding:4px 0;">${_st("settings.delete_account")}</button>
        </div>
      </section>


      <section class="feature-panel" id="notifPrefsPanel">
        <h3>${_st("settings.notifications")}</h3>
        <div class="feature-items" id="notifPrefsContent">
          <p class="feature-empty" style="font-size:13px;color:var(--muted);">${_st("settings.loading")}</p>
        </div>
      </section>

      ${renderSpecialPanel("settings", "appearance")}

      <!-- SEG-21: Guides -->
      <section class="feature-panel" id="helpToursPanel">
        <div class="feature-panel-header">
          <h3>${_st("guide.settings.title")}</h3>
          <a href="https://help.do-do.app" target="_blank" rel="noopener" class="ghost-button" style="font-size:12px;padding:4px 10px;">${_st("guide.settings.docs")}</a>
        </div>
        <p class="feature-note" style="margin-bottom:8px;">${_st("guide.settings.subtitle")}</p>
        <div class="guide-tours-list">
          ${[
            ["welcome",          "guide.tour.welcome",           "guide.tour.welcome.desc"],
            ["setup-parents",    "guide.tour.setup-parents",     "guide.tour.setup-parents.desc"],
            ["setup-children",   "guide.tour.setup-children",    "guide.tour.setup-children.desc"],
            ["setup-schedule",   "guide.tour.setup-schedule",    "guide.tour.setup-schedule.desc"],
            ["setup-vacation",   "guide.tour.setup-vacation",    "guide.tour.setup-vacation.desc"],
            ["calendar-connect", "guide.tour.calendar-connect",  "guide.tour.calendar-connect.desc"],
            ["shopping",         "guide.tour.shopping",          "guide.tour.shopping.desc"],
          ].map(([id, nameKey, descKey]) => `
            <div class="guide-tour-row">
              <div class="guide-tour-info">
                <span class="guide-tour-name">${_st(nameKey)}</span>
                <span class="guide-tour-desc">${_st(descKey)}</span>
              </div>
              <button class="secondary-button" style="font-size:12px;padding:4px 12px;min-height:28px;white-space:nowrap;" data-guide-id="${id}">${_st("guide.settings.run_again")}</button>
            </div>
          `).join("")}
        </div>
      </section>

      <div class="settings-version-panel">
        <div class="settings-version-badge">
          <span class="settings-version-name">Do-Do</span>
          <span class="settings-version-number">v${window.getAppVersion?.()?.version || "—"}</span>
        </div>
        <span class="settings-version-date">${window.getAppVersion?.()?.date || ""}</span>
      </div>
    </div>
  `;

  // Bind automation settings panel
  bindAutomationSettings();
  // Bind custody schedule settings
  bindCustodySettings();

  // Calendar hours - populate selects with current values
  (function() {
    const startSel = featureModule.querySelector("#calStartHourSelect");
    const endSel   = featureModule.querySelector("#calEndHourSelect");
    if (startSel && typeof window.getCalStartHour === "function") {
      startSel.value = String(window.getCalStartHour());
    }
    if (endSel && typeof window.getCalEndHour === "function") {
      endSel.value = String(window.getCalEndHour());
    }
    featureModule.querySelector("#calSettingsSaveBtn")?.addEventListener("click", () => {
      const s = parseInt(startSel?.value ?? "6");
      const e = parseInt(endSel?.value ?? "22");
      if (e <= s) {
        alert("End hour must be after start hour.");
        return;
      }
      window.saveCalSettings?.(s, e);
      window.renderBoardCalendar?.();
      const btn = featureModule.querySelector("#calSettingsSaveBtn");
      if (btn) { btn.textContent = "Saved!"; setTimeout(() => { btn.textContent = "Save"; }, 1500); }
    });
  })();

  // Edit my name
  featureModule.querySelector("#editMyNameBtn")?.addEventListener("click", () => promptEditMyName());

  // SEG-21: fire setup-children guide on first Settings visit (only if no guide is already running)
  if (window.GuideEngine && !window.GuideEngine.isDone("setup-children") && !window.GuideEngine.isActive()) {
    setTimeout(() => window.GuideEngine.show("setup-children"), 600);
  }

  // Add child/pet/caregiver
  featureModule.querySelector("#addChildBtn")?.addEventListener("click", () => promptAddChild());
  featureModule.querySelector("#addPetBtn")?.addEventListener("click", () => promptAddPet());
  featureModule.querySelector("#addCaregiverBtn")?.addEventListener("click", () => showAddCaregiverForm());
  featureModule.querySelector("#addCaregiverBtn2")?.addEventListener("click", () => showAddCaregiverForm());

  // SEG-21: bind Guides "Run again" buttons
  featureModule.querySelectorAll("#helpToursPanel [data-guide-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.guideId;
      if (window.GuideEngine) window.GuideEngine.reset(id);
    });
  });

  // Share Do-Do
  const SHARE_URL = "https://do-do.app";
  const SHARE_TEXT = "I use Do-Do to stay organised with shared tasks and calendars - works great. Try it:";
  featureModule.querySelector("#shareWhatsAppButton")?.addEventListener("click", () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + " " + SHARE_URL)}`, "_blank", "noopener");
  });
  featureModule.querySelector("#shareEmailButton")?.addEventListener("click", () => {
    window.location.href = `mailto:?subject=Try Do-Do&body=${encodeURIComponent(SHARE_TEXT + "\n\n" + SHARE_URL)}`;
  });
  featureModule.querySelector("#shareCopyButton")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      showFeatureToast("Link copied to clipboard");
    } catch {
      showFeatureToast(SHARE_URL);
    }
  });

  // Sign out
  featureModule.querySelector("#signOutButton")?.addEventListener("click", () => {
    if (typeof signOut === "function") signOut();
  });

  // Download my data (GDPR export)
  featureModule.querySelector("#downloadMyDataButton")?.addEventListener("click", async () => {
    const btn = featureModule.querySelector("#downloadMyDataButton");
    btn.disabled = true;
    btn.textContent = "Preparing...";
    try {
      const authHeader = await window.getAuthHeader?.() || {};
      if (!authHeader.Authorization) { showFeatureToast("Sign in required"); return; }

      const res = await fetch("/api/export-data", {
        headers: authHeader,
      });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
        || `do-do-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showFeatureToast("Data exported - check your downloads.");
    } catch (err) {
      showFeatureToast("Export failed: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Download my data";
    }
  });

  // Delete account (GDPR - two-step confirmation)
  featureModule.querySelector("#deleteAccountButton")?.addEventListener("click", async () => {
    const first = window.confirm(
      "Delete your account?\n\nThis permanently removes your profile and messages. " +
      "Family cards you created will be anonymised. Your co-parent's data is preserved.\n\n" +
      "This cannot be undone."
    );
    if (!first) return;

    const second = window.confirm(
      "Are you absolutely sure? Type OK in the next prompt to confirm."
    );
    if (!second) return;

    const confirmation = window.prompt('Type "DELETE" to permanently delete your account:');
    if (confirmation?.trim().toUpperCase() !== "DELETE") {
      showFeatureToast("Account deletion cancelled.");
      return;
    }

    const btn = featureModule.querySelector("#deleteAccountButton");
    btn.disabled = true;
    btn.textContent = "Deleting...";

    try {
      const session = (await window.supabaseClient?.auth?.getSession())?.data?.session;
      const token = session?.access_token;
      if (!token) throw new Error("Sign in required");

      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Deletion failed");

      // Sign out locally
      await window.supabaseClient?.auth?.signOut();
      window.location.reload();
    } catch (err) {
      showFeatureToast("Deletion failed: " + err.message);
      btn.disabled = false;
      btn.textContent = "Delete account";
    }
  });

  // Subscription panel
  renderSubscriptionPanel();

  // Promo code panel
  featureModule.querySelector("#promoCodeApplyBtn")?.addEventListener("click", () => {
    const input = featureModule.querySelector("#promoCodeInput");
    const errorEl = featureModule.querySelector("#promoCodeError");
    const code = input?.value?.trim() || "";
    if (window.activatePromoCode?.(code)) {
      // Re-render the panel to show the active state
      const panel = featureModule.querySelector("#promoCodePanel");
      if (panel) {
        panel.querySelector("div[style]")?.remove();
        input?.closest("div")?.remove();
        if (errorEl) errorEl.remove();
        panel.insertAdjacentHTML("beforeend", `
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface-alt);border-radius:8px;border:1px solid var(--line);">
            <span style="color:#22c55e;font-size:16px;">&#10003;</span>
            <span style="font-size:13px;font-weight:600;color:var(--ink);">Active</span>
          </div>
        `);
      }
      // Refresh subscription panel so it reflects paid status
      renderSubscriptionPanel();
      showFeatureToast("Access code applied.");
    } else {
      if (errorEl) errorEl.style.display = "block";
      if (input) { input.value = ""; input.focus(); }
    }
  });

  // Allow pressing Enter in the promo code input
  featureModule.querySelector("#promoCodeInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") featureModule.querySelector("#promoCodeApplyBtn")?.click();
  });

  // Co-parent invite panel
  renderInvitePanel();

  // Notification preferences panel
  renderNotifPrefsPanel();

  // Vaccine panel interactions
  bindVaccinePanel();

  // ── SEG-11.1: Legal export PDF ────────────────────────────────────────────
  featureModule.querySelector("#downloadLegalRecordButton")?.addEventListener("click", async () => {
    const btn = featureModule.querySelector("#downloadLegalRecordButton");
    btn.disabled = true;
    btn.textContent = "Preparing record...";
    try {
      const authHeader = await window.getAuthHeader?.() || {};
      if (!authHeader.Authorization) { showFeatureToast("Sign in required"); return; }

      const res = await fetch("/api/export-data?action=legal-export", {
        headers: authHeader,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      await generateLegalPdf(data);
    } catch (err) {
      showFeatureToast("Export failed: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Download legal record (PDF)";
    }
  });

  // ── SEG-11.2: Shared history panel ───────────────────────────────────────
  renderSharedHistoryPanel();

  // ── SEG-11.3: Mediator referral link ─────────────────────────────────────
  (async () => {
    const input = featureModule.querySelector("#mediatorLinkInput");
    const copyBtn = featureModule.querySelector("#copyMediatorLinkBtn");
    const note = featureModule.querySelector("#mediatorLinkNote");
    if (!input) return;
    const code = window.getMediatorCode?.();
    const link = code ? `${window.location.origin}/mediator/${code}` : null;
    if (link) {
      input.value = link;
    } else {
      input.value = "Sign in to generate your link";
    }
    copyBtn?.addEventListener("click", async () => {
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link);
        if (note) { note.style.display = ""; setTimeout(() => { note.style.display = "none"; }, 2500); }
      } catch {
        showFeatureToast(link);
      }
    });
  })();

  // ── SEG-11.4: Schedule templates ─────────────────────────────────────────
  renderScheduleTemplates();
  featureModule.querySelector("#addScheduleTemplateBtn")?.addEventListener("click", () => {
    openScheduleTemplateDialog(null);
  });

  // Edit/delete children
  featureModule.querySelectorAll("[data-edit-child]").forEach((btn) => {
    const i = Number(btn.dataset.editChild);
    btn.addEventListener("click", () => promptEditChild(i));
  });
  featureModule.querySelectorAll("[data-delete-child]").forEach((btn) => {
    const i = Number(btn.dataset.deleteChild);
    btn.addEventListener("click", () => confirmDeleteChild(i));
  });

  // Edit/delete pets
  featureModule.querySelectorAll("[data-edit-pet]").forEach((btn) => {
    const i = Number(btn.dataset.editPet);
    btn.addEventListener("click", () => promptEditPet(i));
  });
  featureModule.querySelectorAll("[data-delete-pet]").forEach((btn) => {
    const i = Number(btn.dataset.deletePet);
    btn.addEventListener("click", () => confirmDeletePet(i));
  });

  // Edit/delete caregivers
  featureModule.querySelectorAll("[data-edit-caregiver]").forEach((btn) => {
    const i = Number(btn.dataset.editCaregiver);
    btn.addEventListener("click", () => promptEditCaregiver(i));
  });
  featureModule.querySelectorAll("[data-delete-caregiver]").forEach((btn) => {
    const i = Number(btn.dataset.deleteCaregiver);
    btn.addEventListener("click", () => confirmDeleteCaregiver(i));
  });

  // ─── Kid Access ────────────────────────────────────────────────────────────
  initKidAccessPanel();
}

// ─── Kid Access Settings ──────────────────────────────────────────────────────

async function initKidAccessPanel() {
  const setup = window.getOnboardingState?.() || {};
  const children = setup.children || [];
  if (!children.length) return;

  // Load existing kid access config from Supabase for each child
  for (let i = 0; i < children.length; i++) {
    const childName = children[i].name || children[i];
    await refreshKidAccessStatus(i, childName);
  }

  // Wire "Set up" buttons
  featureModule.querySelectorAll("[data-kid-setup]").forEach((btn) => {
    const i = Number(btn.dataset.kidSetup);
    const childName = (children[i]?.name || children[i]);
    btn.addEventListener("click", () => openKidAccessDialog(i, childName));
  });
}

async function refreshKidAccessStatus(index, childName) {
  const statusEl = featureModule?.querySelector(`#kidStatus-${index}`);
  if (!statusEl) return;

  try {
    const kidData = await window.loadKidAccess?.(childName);
    if (kidData?.kid_token) {
      const link = `${window.location.origin}/kid?token=${kidData.kid_token}`;
      statusEl.innerHTML = `
        <span style="color:#22c55e;font-weight:600;">&#10003; Active</span>
        <span style="margin:0 6px;color:var(--line)">|</span>
        <button class="ghost-button" style="font-size:12px;padding:2px 6px;min-height:24px;" data-kid-copy-link="${index}" data-kid-link="${escapeHtml(link)}">Copy link</button>
        <button class="ghost-button" style="font-size:12px;padding:2px 6px;min-height:24px;color:#ef4444;" data-kid-reset="${index}">Reset PIN</button>
      `;
      // Wire copy
      statusEl.querySelector(`[data-kid-copy-link]`)?.addEventListener("click", async (e) => {
        const url = e.currentTarget.dataset.kidLink;
        try { await navigator.clipboard.writeText(url); showFeatureToast("Kid link copied!"); }
        catch { showFeatureToast(url); }
      });
      // Wire reset
      statusEl.querySelector(`[data-kid-reset]`)?.addEventListener("click", () => openKidAccessDialog(index, childName, true));
    } else {
      statusEl.innerHTML = `<span style="color:var(--muted);">Not set up yet</span>`;
    }
  } catch {
    statusEl.innerHTML = `<span style="color:var(--muted);">Could not load</span>`;
  }
}

function openKidAccessDialog(index, childName, isReset = false) {
  const dialog = document.createElement("dialog");
  dialog.className = "card-dialog";
  dialog.style.cssText = "max-width:380px;width:90%;padding:0;border:none;border-radius:20px;overflow:hidden;";
  dialog.innerHTML = `
    <div class="dialog-header" style="padding:18px 20px 12px;border-bottom:1px solid var(--line);">
      <h2 style="font-size:17px;font-weight:800;margin:0;">${isReset ? "Reset PIN" : "Set up Kid Access"} - ${escapeHtml(childName)}</h2>
    </div>
    <div style="padding:20px;">
      ${!isReset ? `<p style="font-size:13px;color:var(--muted);margin:0 0 16px;">This creates a link for ${escapeHtml(childName)} to view their schedule and send you "I need" cards. They use a 4-digit PIN to get in.</p>` : ""}
      <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">4-Digit PIN for ${escapeHtml(childName)}</label>
      <input id="kidPinInput" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="e.g. 1234"
        style="width:100%;padding:12px 14px;background:var(--surface-input);border:1.5px solid var(--line);border-radius:8px;font-size:18px;font-family:inherit;color:var(--ink);outline:none;letter-spacing:6px;text-align:center;"
        autocomplete="off" />
      <p id="kidPinHint" style="font-size:12px;color:var(--muted);margin:6px 0 0;">Use something the child can remember. You can change this anytime.</p>

      <label style="display:block;margin:16px 0 6px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">Note for ${escapeHtml(childName)} (optional)</label>
      <textarea id="kidNoteInput" placeholder="e.g. Bring your PE kit on Tuesday" maxlength="500"
        style="width:100%;padding:10px 12px;background:var(--surface-input);border:1.5px solid var(--line);border-radius:8px;font-size:13px;font-family:inherit;color:var(--ink);outline:none;min-height:72px;resize:vertical;"></textarea>
      <p id="kidDialogError" style="font-size:12px;color:#ef4444;margin:8px 0 0;display:none;"></p>
    </div>
    <div style="padding:0 20px 20px;display:flex;gap:10px;">
      <button id="kidDialogCancel" class="ghost-button" style="flex:1;">Cancel</button>
      <button id="kidDialogSave" class="secondary-button" style="flex:2;font-weight:700;">Save &amp; get link</button>
    </div>
  `;

  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.querySelector("#kidDialogCancel").addEventListener("click", () => { dialog.close(); dialog.remove(); });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) { dialog.close(); dialog.remove(); } });

  const saveBtn = dialog.querySelector("#kidDialogSave");
  const pinInput = dialog.querySelector("#kidPinInput");
  const noteInput = dialog.querySelector("#kidNoteInput");
  const errEl = dialog.querySelector("#kidDialogError");

  // Pre-fill existing note
  window.loadKidAccess?.(childName).then((d) => {
    if (d?.kid_note) noteInput.value = d.kid_note;
  }).catch(() => {});

  saveBtn.addEventListener("click", async () => {
    const pin = pinInput.value.trim();
    if (!/^\d{4}$/.test(pin)) {
      errEl.textContent = "Please enter exactly 4 digits.";
      errEl.style.display = "";
      pinInput.focus();
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    errEl.style.display = "none";

    try {
      const result = await window.saveKidAccess?.(childName, pin, noteInput.value.trim() || null);
      if (!result?.ok) throw new Error("save failed");

      dialog.close(); dialog.remove();
      showFeatureToast("Kid access set up! Link copied to clipboard.");

      // Copy link to clipboard automatically
      const link = `${window.location.origin}/kid?token=${result.token}`;
      try { await navigator.clipboard.writeText(link); } catch {}

      // Refresh status in panel
      await refreshKidAccessStatus(index, childName);
    } catch {
      errEl.textContent = "Something went wrong. Try again.";
      errEl.style.display = "";
      saveBtn.disabled = false;
      saveBtn.textContent = "Save & get link";
    }
  });

  pinInput.focus();
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

// ─── SEG-11.1: Legal PDF generation (client-side via jsPDF) ──────────────────

async function generateLegalPdf(data) {
  // Dynamically load jsPDF from CDN on first use
  if (!window.jspdf?.jsPDF) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load PDF library"));
      document.head.appendChild(s);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const marginL = 18;
  const marginR = 18;
  const contentW = pageW - marginL - marginR;
  let y = 20;
  const lineH = 6;

  const addLine = (text, opts = {}) => {
    const size = opts.size || 10;
    const bold = opts.bold || false;
    const color = opts.color || [17, 24, 39];
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...color);
    if (y > 270) { doc.addPage(); y = 20; addFooter(); }
    const lines = doc.splitTextToSize(text, contentW);
    doc.text(lines, marginL, y);
    y += lines.length * (size * 0.35) + (opts.after || 2);
  };

  const addFooter = () => {
    const pg = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Exported from Do-Do (do-do.app) on ${new Date(data.generated_at).toISOString().replace("T", " ").slice(0, 19)} UTC  |  Pair ID: ${data.pair?.id?.slice(0, 8) || "—"}  |  Page ${pg}`,
      marginL, 290
    );
  };

  const hr = () => {
    doc.setDrawColor(229, 231, 235);
    doc.line(marginL, y, pageW - marginR, y);
    y += 4;
  };

  // Cover page
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, pageW, 8, "F");
  y = 28;
  addLine("Do-Do", { size: 26, bold: true, color: [17, 24, 39], after: 3 });
  addLine("Legal Record Export", { size: 16, color: [107, 114, 128], after: 10 });
  hr();
  addLine(`Parents: ${data.pair?.parent_a || "Parent A"} & ${data.pair?.parent_b || "Parent B"}`, { size: 11, bold: true, after: 3 });
  if (data.pair?.pair_start) addLine(`Coordinating since: ${new Date(data.pair.pair_start).toLocaleDateString()}`, { size: 10, color: [107, 114, 128], after: 2 });
  addLine(`Export generated: ${new Date(data.generated_at).toLocaleString()}`, { size: 10, color: [107, 114, 128], after: 2 });
  addLine(`Records: ${(data.cards || []).length} cards, ${(data.messages || []).length} messages`, { size: 10, color: [107, 114, 128], after: 8 });
  hr();
  addLine(data.tamper_note || "", { size: 9, color: [107, 114, 128], after: 4 });
  addFooter();

  // Section 1: Cards
  doc.addPage(); y = 20; addFooter();
  addLine("Section 1 - Expense & Event Cards", { size: 14, bold: true, after: 6 });
  hr();

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : "-";
  const fmtAmt = (a) => a != null ? String(a) : "-";

  for (const card of (data.cards || [])) {
    if (y > 255) { doc.addPage(); y = 20; addFooter(); }
    addLine(`[${card.type?.toUpperCase() || "CARD"}] ${card.title || "Untitled"}`, { size: 10, bold: true, after: 1 });
    addLine(`  Date: ${fmtDate(card.due || card.created_at)}  |  Status: ${card.status || "-"}  |  Amount: ${fmtAmt(card.amount)}`, { size: 9, color: [107, 114, 128], after: 1 });
    if (card.details) addLine(`  Details: ${card.details}`, { size: 9, color: [55, 65, 81], after: 1 });
    if (card.receipt_url) addLine(`  Receipt: ${card.receipt_url}`, { size: 8, color: [107, 114, 128], after: 1 });
    const editCount = (card.edit_history || []).length;
    addLine(`  Created: ${fmtDate(card.created_at)}  |  Last updated: ${fmtDate(card.updated_at)}  |  Edit entries: ${editCount}`, { size: 8, color: [156, 163, 175], after: 3 });
    hr();
  }

  // Section 2: Messages
  doc.addPage(); y = 20; addFooter();
  addLine("Section 2 - Messages", { size: 14, bold: true, after: 6 });
  hr();
  for (const msg of (data.messages || [])) {
    if (y > 260) { doc.addPage(); y = 20; addFooter(); }
    addLine(`${msg.sender || "Parent"} - ${fmtDate(msg.sent_at)}`, { size: 9, bold: true, after: 1 });
    addLine(`  ${msg.body || ""}`, { size: 9, after: 3 });
    hr();
  }

  // Section 3: Audit note
  doc.addPage(); y = 20; addFooter();
  addLine("Section 3 - Tamper-Evidence Note", { size: 14, bold: true, after: 6 });
  hr();
  addLine(
    "All records in this export are server-timestamped at the moment of creation. " +
    "Neither party can retroactively edit records created by the other party. " +
    "Every edit is logged with a timestamp and user identifier in the edit_history field. " +
    "This export was generated on demand and cannot be modified after generation.",
    { size: 10, after: 6 }
  );

  const filename = `do-do-legal-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

// ─── SEG-11.2: Shared history panel ──────────────────────────────────────────

async function renderSharedHistoryPanel() {
  const panel = featureModule.querySelector("#sharedHistoryPanel");
  const content = featureModule.querySelector("#sharedHistoryContent");
  if (!panel || !content) return;

  try {
    const authHeader = await window.getAuthHeader?.() || {};
    if (!authHeader.Authorization) return;

    const res = await fetch("/api/export-data?action=history-stats", {
      headers: authHeader,
    });
    if (!res.ok) return;
    const stats = await res.json();

    if (!stats.daysSinceFirst || stats.daysSinceFirst < 30) return; // gate: 30 days minimum

    panel.style.display = "";
    const since = stats.firstCardDate
      ? new Date(stats.firstCardDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
      : null;

    content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
        <div style="background:var(--surface-alt);border:1px solid var(--line);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--accent);line-height:1;">${stats.totalCards}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.04em;">Shared items</div>
        </div>
        <div style="background:var(--surface-alt);border:1px solid var(--line);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--accent);line-height:1;">${stats.totalExpenses}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.04em;">Expenses</div>
        </div>
        <div style="background:var(--surface-alt);border:1px solid var(--line);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--accent);line-height:1;">${stats.receiptCount}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.04em;">Receipts stored</div>
        </div>
      </div>
      ${since ? `<p style="font-size:13px;color:var(--muted);margin-bottom:8px;">You've been coordinating since <strong style="color:var(--ink);">${since}</strong> - ${stats.daysSinceFirst} days of shared history.</p>` : ""}
      <p style="font-size:12px;color:var(--muted);">This record is stored securely and cannot be altered by either party.</p>
    `;
  } catch { /* non-fatal */ }
}

// ─── SEG-11.2: Milestone toast ────────────────────────────────────────────────

function checkCardMilestoneToast(totalCards) {
  const milestones = [10, 50, 100];
  const reached = milestones.filter((m) => totalCards === m);
  if (!reached.length) return;
  const n = reached[0];
  const setup = window.getOnboardingState?.() || {};
  const partner = setup.parents?.coparent || "your co-parent";
  showFeatureToast(`You and ${partner} have created ${n} shared items together.`);
}

window.checkCardMilestoneToast = checkCardMilestoneToast;

// ─── SEG-11.4: Schedule templates UI ─────────────────────────────────────────

async function renderScheduleTemplates() {
  const _trt = window.t || ((k, fb) => fb || k);
  const list = featureModule.querySelector("#scheduleTemplatesList");
  if (!list) return;

  const schedules = await window.loadSchedules?.() || [];

  if (!schedules.length) {
    list.innerHTML = `<p class="feature-empty" style="font-size:13px;color:var(--muted);">${_trt("tmpl.empty", "No templates yet. Create one to group custody week cards together.")}</p>`;
    return;
  }

  list.innerHTML = schedules.map((s) => `
    <article class="feature-item feature-item-editable" style="margin-bottom:8px;">
      <div class="feature-item-main">
        ${s.color ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${escapeHtml(s.color)};margin-right:6px;vertical-align:middle;"></span>` : ""}
        <strong>${escapeHtml(s.name)}</strong>
        <span style="font-size:12px;color:var(--muted);margin-left:6px;">${_trt("tmpl.every_weeks", "Every {{n}} weeks").replace("{{n}}", s.repeat_every_weeks || 2)}</span>
      </div>
      <div class="feature-item-actions">
        <button class="secondary-button" style="font-size:12px;padding:4px 10px;" data-cascade-btn="${escapeHtml(s.id)}" data-cascade-name="${escapeHtml(s.name)}">${_trt("tmpl.move_week", "Move week")}</button>
        <button class="icon-button icon-button-sm" data-edit-schedule="${escapeHtml(s.id)}" aria-label="Edit ${escapeHtml(s.name)}">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M11.5 2.5a1.5 1.5 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5Z"/></svg>
        </button>
        <button class="icon-button icon-button-sm icon-button-danger" data-delete-schedule="${escapeHtml(s.id)}" aria-label="Delete ${escapeHtml(s.name)}">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4"/></svg>
        </button>
      </div>
    </article>
  `).join("");

  // Bind cascade buttons
  list.querySelectorAll("[data-cascade-btn]").forEach((btn) => {
    btn.addEventListener("click", () => openCascadeDialog(btn.dataset.cascadeBtn, btn.dataset.cascadeName));
  });
  // Bind edit buttons
  list.querySelectorAll("[data-edit-schedule]").forEach((btn) => {
    btn.addEventListener("click", () => openScheduleTemplateDialog(btn.dataset.editSchedule));
  });
  // Bind delete buttons
  list.querySelectorAll("[data-delete-schedule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Delete template "${btn.dataset.deleteSchedule}"? Linked cards will not be deleted but will be unlinked.`)) return;
      await window.deleteSchedule?.(btn.dataset.deleteSchedule);
      renderScheduleTemplates();
    });
  });
}

function openScheduleTemplateDialog(scheduleId) {
  const _tsd = window.t || ((k, fb) => fb || k);
  document.getElementById("scheduleTemplateDialog")?.remove();
  const COLORS = ["#7c3aed","#2563eb","#16a34a","#dc2626","#d97706","#0891b2","#db2777","#4b5563"];

  // Fetch existing schedule if editing
  const edit = scheduleId ? null : null; // loaded async below

  const dialog = document.createElement("dialog");
  dialog.id = "scheduleTemplateDialog";
  dialog.className = "card-dialog";
  dialog.innerHTML = `
    <div class="dialog-header">
      <h2 class="dialog-title">${scheduleId ? _tsd("tmpl.edit", "Edit") : _tsd("tmpl.new", "New")} ${_tsd("tmpl.new_edit", "custody week template")}</h2>
      <button class="icon-button" id="closeSched" aria-label="Close">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>
      </button>
    </div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
      <label style="font-size:13px;font-weight:600;">${_tsd("tmpl.name", "Template name")}
        <input type="text" id="schedNameInput" placeholder="${_tsd("tmpl.name_placeholder", "e.g. Week A - Bart's week")}" maxlength="60"
          style="display:block;width:100%;margin-top:4px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;background:var(--surface-page);color:var(--ink);">
      </label>
      <label style="font-size:13px;font-weight:600;">${_tsd("tmpl.repeats", "Repeats every")}
        <select id="schedRepeatSelect" style="display:block;width:100%;margin-top:4px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;background:var(--surface-page);color:var(--ink);">
          <option value="1">${_tsd("tmpl.1week", "1 week")}</option>
          <option value="2" selected>${_tsd("tmpl.2weeks", "2 weeks")}</option>
          <option value="3">${_tsd("tmpl.3weeks", "3 weeks")}</option>
          <option value="4">${_tsd("tmpl.4weeks", "4 weeks")}</option>
        </select>
      </label>
      <label style="font-size:13px;font-weight:600;">${_tsd("tmpl.first_week", "First week starts on")}
        <input type="date" id="schedAnchorInput"
          style="display:block;width:100%;margin-top:4px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;background:var(--surface-page);color:var(--ink);"
          value="${new Date().toISOString().slice(0, 10)}">
      </label>
      <div>
        <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${_tsd("tmpl.color", "Color")}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;" id="schedColorRow">
          ${COLORS.map((c) => `<button type="button" data-color="${c}" style="width:24px;height:24px;border-radius:50%;background:${c};border:2px solid transparent;cursor:pointer;" aria-label="${c}"></button>`).join("")}
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px;">
        <button class="primary-button" id="saveSchedBtn" style="flex:1;">${_tsd("tmpl.save", "Save template")}</button>
        <button class="secondary-button" id="cancelSchedBtn">${_tsd("common.cancel", "Cancel")}</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  let selectedColor = COLORS[0];
  dialog.querySelectorAll("[data-color]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedColor = btn.dataset.color;
      dialog.querySelectorAll("[data-color]").forEach((b) => b.style.borderColor = "transparent");
      btn.style.borderColor = "#111";
    });
  });
  // Select first color by default
  dialog.querySelector(`[data-color="${selectedColor}"]`).style.borderColor = "#111";

  dialog.querySelector("#closeSched").addEventListener("click", () => dialog.close());
  dialog.querySelector("#cancelSchedBtn").addEventListener("click", () => dialog.close());

  dialog.querySelector("#saveSchedBtn").addEventListener("click", async () => {
    const name = dialog.querySelector("#schedNameInput").value.trim();
    if (!name) { showFeatureToast(_tsd("tmpl.enter_name", "Enter a template name")); return; }
    const repeatEveryWeeks = Number(dialog.querySelector("#schedRepeatSelect").value) || 2;
    const anchorDate = dialog.querySelector("#schedAnchorInput").value;
    if (!anchorDate) { showFeatureToast(_tsd("tmpl.pick_date", "Pick a start date")); return; }

    const btn = dialog.querySelector("#saveSchedBtn");
    btn.disabled = true; btn.textContent = _tsd("tmpl.saving", "Saving...");

    const saved = await window.saveSchedule?.({
      id: scheduleId || undefined,
      name,
      color: selectedColor,
      repeatEveryWeeks,
      anchorDate,
    });

    dialog.close();
    if (saved) {
      showFeatureToast(_tsd("tmpl.save", "Template saved"));
      renderScheduleTemplates();
    } else {
      showFeatureToast("Save failed - check Supabase DB migration for schedules table");
    }
  });
}

function openCascadeDialog(scheduleId, scheduleName) {
  document.getElementById("cascadeDialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "cascadeDialog";
  dialog.className = "card-dialog";

  const today = new Date();
  // Find the Monday of this week
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const mondayStr = monday.toISOString().slice(0, 10);

  dialog.innerHTML = `
    <div class="dialog-header">
      <h2 class="dialog-title">Move "${escapeHtml(scheduleName)}" week</h2>
      <button class="icon-button" id="closeCascade" aria-label="Close">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>
      </button>
    </div>
    <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
      <label style="font-size:13px;font-weight:600;">Week to move (Monday)
        <input type="date" id="cascadeWeekInput" value="${mondayStr}"
          style="display:block;width:100%;margin-top:4px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;background:var(--surface-page);color:var(--ink);">
      </label>
      <label style="font-size:13px;font-weight:600;">Shift by
        <select id="cascadeDeltaSelect" style="display:block;width:100%;margin-top:4px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;background:var(--surface-page);color:var(--ink);">
          <option value="-14">-2 weeks</option>
          <option value="-7">-1 week</option>
          <option value="7" selected>+1 week</option>
          <option value="14">+2 weeks</option>
        </select>
      </label>
      <div>
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Apply to</div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px;cursor:pointer;">
          <input type="radio" name="cascadeMode" value="this" checked> Just this week
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
          <input type="radio" name="cascadeMode" value="all"> This week and all future occurrences
        </label>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px;">
        <button class="primary-button" id="runCascadeBtn" style="flex:1;">Move all cards</button>
        <button class="secondary-button" id="cancelCascadeBtn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.querySelector("#closeCascade").addEventListener("click", () => dialog.close());
  dialog.querySelector("#cancelCascadeBtn").addEventListener("click", () => dialog.close());

  dialog.querySelector("#runCascadeBtn").addEventListener("click", async () => {
    const weekStart = dialog.querySelector("#cascadeWeekInput").value;
    const deltaDays = Number(dialog.querySelector("#cascadeDeltaSelect").value) || 7;
    const mode = dialog.querySelector("input[name='cascadeMode']:checked")?.value || "this";

    if (!weekStart) { showFeatureToast("Pick a week"); return; }

    const btn = dialog.querySelector("#runCascadeBtn");
    btn.disabled = true; btn.textContent = "Moving...";

    const result = await window.cascadeSchedule?.({ scheduleId, weekStart, deltaDays, mode });
    dialog.close();
    const moved = result?.moved || 0;
    showFeatureToast(moved > 0
      ? `Moved ${moved} card${moved === 1 ? "" : "s"} by ${deltaDays > 0 ? "+" : ""}${deltaDays} days`
      : "No cards found in that week for this template"
    );
  });
}

async function renderSubscriptionPanel() {
  const panel = featureModule.querySelector("#subscriptionPanelContent");
  if (!panel) return;

  const _st = window.t || ((k, fb) => fb || k);
  const { status, periodEnd } = window.getSubscriptionStatus?.() || { status: "free", periodEnd: null };
  const paid = ["active", "trialing"].includes(status);

  const statusLabel = {
    free:     _st("sub.free",     "Free plan"),
    trialing: _st("sub.trial",    "Standard - free trial"),
    active:   _st("sub.active",   "Standard"),
    past_due: _st("sub.past_due", "Standard - payment past due"),
    canceled: _st("sub.canceled", "Canceled"),
  }[status] || _st("sub.free", "Free plan");

  const renewalHtml = periodEnd
    ? `<span style="color:var(--muted);font-size:12px;">${_st("sub.renews", "Renews")} ${new Date(periodEnd).toLocaleDateString()}</span>`
    : "";

  if (paid) {
    panel.innerHTML = `
      <article class="feature-item">
        <div>
          <strong>${statusLabel}</strong>
          ${renewalHtml}
        </div>
        <button class="secondary-button" id="manageSubBtn" style="white-space:nowrap;">${_st("sub.manage", "Manage")}</button>
      </article>
    `;
    panel.querySelector("#manageSubBtn")?.addEventListener("click", async () => {
      const btn = panel.querySelector("#manageSubBtn");
      if (btn) { btn.disabled = true; btn.textContent = _st("sub.opening", "Opening..."); }
      try {
        const res = await fetch("/api/stripe-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await window.getAuthHeader()) },
          body: JSON.stringify({ action: "portal" }),
        });
        const data = await res.json();
        if (data.url) { location.href = data.url; }
        else { showFeatureToast("Could not open billing portal: " + (data.error || "unknown error")); }
      } catch (err) {
        showFeatureToast("Portal error: " + err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = _st("sub.manage", "Manage"); }
      }
    });
  } else {
    // Free user - show upgrade CTA
    const used = typeof state !== "undefined" ? state.cards.filter((c) => c.status !== "Done").length : 0;
    const limit = typeof FREE_CARD_LIMIT !== "undefined" ? FREE_CARD_LIMIT : 10;
    panel.innerHTML = `
      <article class="feature-item" style="flex-direction:column;align-items:flex-start;gap:8px;">
        <div>
          <strong>${_st("sub.free", "Free plan")}</strong>
          <span style="display:block;color:var(--muted);font-size:13px;">
            ${used}/${limit} ${_st("sub.dos_used", "Dos used")}
          </span>
        </div>
        <p style="font-size:13px;color:var(--muted);margin:0;">
          ${_st("sub.upgrade_note", "Upgrade for unlimited Dos, calendar sync, AI, and co-parent collaboration.")}
        </p>
        <button class="primary-button" id="upgradeSubBtn">${_st("sub.upgrade_btn", "Upgrade to Standard")} - ${LOCALE_CONFIG.monthlyPrice}/mo</button>
      </article>
    `;
    panel.querySelector("#upgradeSubBtn")?.addEventListener("click", () => {
      window.showUpgradePrompt?.("Upgrade to Standard for unlimited Dos and all features.");
    });
  }
}

async function renderInvitePanel() {
  const panel = featureModule.querySelector("#invitePanelContent");
  if (!panel) return;

  const hasPair = Boolean(window.getCurrentPairId?.());
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "";
  const inviteEmail = setup.parents?.invite || "";

  // Check if co-parent already joined
  let coparentJoined = false;
  if (hasPair) {
    const pairStatus = await window.supabaseClient
      ?.from("pairs")
      .select("parent_b, accepted_at")
      .eq("id", window.getCurrentPairId())
      .maybeSingle()
      .then(({ data }) => data)
      .catch(() => null);
    coparentJoined = Boolean(pairStatus?.parent_b);
  }

  // Get pending invite link
  let pendingLink = (() => { try { return sessionStorage.getItem("do-do-pending-invite-link"); } catch { return null; } })();
  if (!pendingLink && window.getCurrentPairId?.()) {
    try {
      const { data: pairRow } = await window.supabaseClient
        .from("pairs")
        .select("invite_token")
        .eq("id", window.getCurrentPairId())
        .maybeSingle();
      if (pairRow?.invite_token) {
        pendingLink = `${window.location.origin}/invite/${pairRow.invite_token}`;
      }
    } catch { /* silent */ }
  }

  if (coparentJoined) {
    // Co-parent connected - show name + status, allow name edit
    panel.innerHTML = `
      <article class="feature-item feature-item-editable">
        <div class="feature-item-main">
          <strong>${escapeHtml(coparentName || "Co-parent")}</strong>
          <span style="color:#0ea58f;font-size:12px;">Polaczony/a - wspolna tablica</span>
        </div>
        <button class="icon-button icon-button-sm" id="editCoparentNameBtn" aria-label="Edit co-parent name">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M11.5 2.5a1.5 1.5 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5Z"/>
          </svg>
        </button>
      </article>
    `;
    panel.querySelector("#editCoparentNameBtn")?.addEventListener("click", () => promptEditCoparentName());
    return;
  }

  // Co-parent not joined yet - unified name + email + invite form
  panel.innerHTML = `
    <div style="display:grid;gap:12px;">
      <div style="display:grid;gap:6px;">
        <label style="font-size:12px;font-weight:700;color:var(--muted);">Imie rodzica</label>
        <input id="coparentNameInput" type="text" placeholder="np. Tomek"
          value="${escapeHtml(coparentName)}"
          style="border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:14px;background:var(--soft);color:var(--ink);width:100%;box-sizing:border-box;" />
      </div>
      <div style="display:grid;gap:6px;">
        <label style="font-size:12px;font-weight:700;color:var(--muted);">Email (do zaproszenia)</label>
        <input id="coparentEmailInput" type="email" placeholder="rodzic@email.com"
          value="${escapeHtml(inviteEmail)}"
          style="border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:14px;background:var(--soft);color:var(--ink);width:100%;box-sizing:border-box;" />
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button id="settingsSaveAndInviteBtn" class="secondary-button" style="min-height:36px;padding:0 16px;">Zapisz i wyslij zaproszenie</button>
        ${pendingLink ? `<button id="settingsInviteCopy" class="ghost-button" style="min-height:36px;padding:0 12px;font-size:13px;">Kopiuj link</button>` : ""}
      </div>
      ${pendingLink ? `
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="settingsInviteInput" readonly value="${escapeHtml(pendingLink)}"
          style="flex:1;min-width:0;border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:11px;background:var(--soft);color:var(--muted);" />
      </div>` : ""}
      ${inviteEmail && !pendingLink ? `<p style="font-size:12px;color:var(--muted);margin:0;">Zaproszenie wyslane na ${escapeHtml(inviteEmail)}</p>` : ""}
    </div>
  `;

  panel.querySelector("#settingsSaveAndInviteBtn")?.addEventListener("click", async () => {
    const nameInput = panel.querySelector("#coparentNameInput");
    const emailInput = panel.querySelector("#coparentEmailInput");
    const name = nameInput?.value.trim();
    const email = emailInput?.value.trim();
    if (!name) { showFeatureToast("Podaj imie rodzica"); nameInput?.focus(); return; }

    const btn = panel.querySelector("#settingsSaveAndInviteBtn");
    btn.disabled = true;
    btn.textContent = "Zapisywanie...";

    // Save name locally
    const updatedSetup = { ...setup, parents: { ...(setup.parents || {}), coparent: name, invite: email || setup.parents?.invite || "" } };
    window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updatedSetup));

    // Update Supabase profile name if pair exists
    if (hasPair && window.supabaseClient && window.getCurrentPairId?.()) {
      await window.supabaseClient.from("pairs")
        .update({ invite_email: email || null })
        .eq("id", window.getCurrentPairId())
        .catch(() => {});
    }

    // Send invite email if email provided
    if (email && pendingLink) {
      try {
        const res = await fetch("/api/invite-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await window.getAuthHeader?.() || {}) },
          body: JSON.stringify({ toEmail: email, fromName: setup.parents?.primary || null, inviteLink: pendingLink }),
        });
        const data = res.ok ? await res.json() : {};
        if (data.sent) {
          showFeatureToast(`Zaproszenie wyslane do ${email}`);
        } else {
          showFeatureToast("Email nie wyslany - skopiuj link recznie");
        }
      } catch { showFeatureToast("Zapisano - wyslij link recznie"); }
    } else {
      showFeatureToast(email ? "Zapisano - link nie dostepny jeszcze" : "Imie zapisane");
    }

    window.switchModule("settings");
  });

  panel.querySelector("#settingsInviteCopy")?.addEventListener("click", () => {
    navigator.clipboard.writeText(pendingLink).then(() => {
      showFeatureToast("Link skopiowany");
    }).catch(() => panel.querySelector("#settingsInviteInput")?.select());
  });
}

// ─── Parent name editing ───────────────────────────────────────────────────────

async function promptEditMyName() {
  const setup = window.getOnboardingState?.() || {};
  const current = setup.parents?.primary || "";
  const name = window.prompt("Your display name:", current);
  if (!name?.trim() || name.trim() === current) return;
  const newName = name.trim();

  // Update localStorage
  const updated = { ...setup, parents: { ...(setup.parents || {}), primary: newName } };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));

  // Update Supabase profile
  const saved = await window.updateProfile?.(newName);
  showFeatureToast(window.t?.("toast.name_updated", { name: newName }) ?? `Name updated to ${newName}`);
  window.switchModule("settings");
}

function promptEditCoparentName() {
  const setup = window.getOnboardingState?.() || {};
  const current = setup.parents?.coparent || "";
  const name = window.prompt("Co-parent's name (shown locally):", current);
  if (!name?.trim() || name.trim() === current) return;
  const updated = { ...setup, parents: { ...(setup.parents || {}), coparent: name.trim() } };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
  showFeatureToast(`Co-parent name updated to ${name.trim()}`);
  window.switchModule("settings");
}

// ─── Children CRUD ─────────────────────────────────────────────────────────────

async function promptAddChild() {
  const name = window.prompt("Child's first name:");
  if (!name?.trim()) return;
  const setup = window.getOnboardingState?.() || {};
  const familyId = setup.familyId;
  if (!familyId) { showFeatureToast("Complete setup first"); return; }
  await window.saveChildrenToSupabase?.(familyId, [{ name: name.trim() }]);
  const updated = { ...setup, children: [...(setup.children || []), { name: name.trim() }] };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
  showFeatureToast(`${name.trim()} added`);
  window.switchModule("settings");
}

async function promptEditChild(index) {
  const setup = window.getOnboardingState?.() || {};
  const children = [...(setup.children || [])];
  const current = children[index]?.name || children[index] || "";
  const name = window.prompt("Edit name:", current);
  if (!name?.trim() || name.trim() === current) return;
  children[index] = { ...(typeof children[index] === "object" ? children[index] : {}), name: name.trim() };
  const updated = { ...setup, children };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
  // Sync all children to Supabase
  if (setup.familyId) {
    await window.saveChildrenToSupabase?.(setup.familyId, children).catch(() => {});
  }
  showFeatureToast(`Updated to ${name.trim()}`);
  window.switchModule("settings");
}

async function confirmDeleteChild(index) {
  const setup = window.getOnboardingState?.() || {};
  const children = [...(setup.children || [])];
  const name = children[index]?.name || children[index] || "this child";
  if (!window.confirm(`Remove ${name}?`)) return;
  children.splice(index, 1);
  const updated = { ...setup, children };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
  if (setup.familyId) {
    await window.saveChildrenToSupabase?.(setup.familyId, children).catch(() => {});
  }
  showFeatureToast(`${name} removed`);
  window.switchModule("settings");
}

// ─── Caregivers CRUD ──────────────────────────────────────────────────────────

function _cgt(key) {
  return (window.t || ((k) => k))(key);
}

function _saveCaregivers(caregivers) {
  const setup = window.getOnboardingState?.() || {};
  const updated = { ...setup, caregivers };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
  return updated;
}

function showAddCaregiverForm(editIndex = -1) {
  const panel = document.querySelector("#caregiversPanel");
  const formContainer = panel?.querySelector("#addCaregiverForm");
  if (!formContainer) return;

  const setup = window.getOnboardingState?.() || {};
  const existing = editIndex >= 0 ? (setup.caregivers || [])[editIndex] : null;
  const existingName  = existing?.name  || existing || "";
  const existingEmail = existing?.email || "";

  const isEdit = editIndex >= 0;

  formContainer.style.display = "block";
  formContainer.innerHTML = `
    <div style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:12px;">
      <div style="display:grid;gap:5px;">
        <label style="font-size:12px;font-weight:700;color:var(--muted);">${_cgt("settings.caregiver_name_label")}</label>
        <input id="cgNameInput" type="text" autocomplete="off"
          placeholder="${_cgt("settings.caregiver_name_ph")}"
          value="${escapeHtml(existingName)}"
          style="border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:14px;background:var(--soft);color:var(--ink);width:100%;box-sizing:border-box;" />
      </div>
      <div style="display:grid;gap:5px;">
        <label style="font-size:12px;font-weight:700;color:var(--muted);">${_cgt("settings.caregiver_email_label")}</label>
        <input id="cgEmailInput" type="email" autocomplete="off"
          placeholder="${_cgt("settings.caregiver_email_ph")}"
          value="${escapeHtml(existingEmail)}"
          style="border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:14px;background:var(--soft);color:var(--ink);width:100%;box-sizing:border-box;" />
        <span style="font-size:11px;color:var(--muted);">${_cgt("settings.caregiver_email_hint")}</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="cgSaveBtn" class="secondary-button" style="min-height:36px;padding:0 16px;">${_cgt("settings.save_caregiver")}</button>
        <button id="cgCancelBtn" class="ghost-button" style="min-height:36px;padding:0 12px;font-size:13px;">&#x2715;</button>
      </div>
    </div>
  `;

  const nameInput  = formContainer.querySelector("#cgNameInput");
  const emailInput = formContainer.querySelector("#cgEmailInput");
  const saveBtn    = formContainer.querySelector("#cgSaveBtn");
  const cancelBtn  = formContainer.querySelector("#cgCancelBtn");

  nameInput?.focus();

  cancelBtn?.addEventListener("click", () => {
    formContainer.style.display = "none";
    formContainer.innerHTML = "";
  });

  saveBtn?.addEventListener("click", async () => {
    const name  = nameInput?.value.trim();
    const email = emailInput?.value.trim();
    if (!name) { nameInput?.focus(); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = "...";

    const setup2 = window.getOnboardingState?.() || {};
    const caregivers = [...(setup2.caregivers || [])];
    const entry = { name, ...(email ? { email } : {}) };

    if (isEdit) {
      caregivers[editIndex] = { ...(typeof caregivers[editIndex] === "object" ? caregivers[editIndex] : {}), ...entry };
    } else {
      caregivers.push(entry);
    }

    _saveCaregivers(caregivers);

    // Send calendar link email if email provided and not an edit
    if (email && !isEdit) {
      try {
        const guestLink = await getOrCreateGuestLink();
        if (guestLink) {
          await fetch("/api/invite-email", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await window.getAuthHeader?.() || {}) },
            body: JSON.stringify({
              toEmail: email,
              fromName: setup2.parents?.primary || null,
              inviteLink: guestLink,
              role: "caregiver",
              caregiverName: name,
            }),
          });
        }
      } catch { /* silent - email is optional */ }
    }

    showFeatureToast(isEdit ? _cgt("settings.caregiver_updated") : _cgt("settings.caregiver_added"));
    formContainer.style.display = "none";
    formContainer.innerHTML = "";
    window.switchModule("settings");
  });
}

async function getOrCreateGuestLink() {
  try {
    let link = sessionStorage.getItem("do-do-pending-invite-link");
    if (!link && window.getCurrentPairId?.()) {
      const { data } = await window.supabaseClient
        .from("pairs")
        .select("invite_token")
        .eq("id", window.getCurrentPairId())
        .maybeSingle();
      if (data?.invite_token) {
        link = `${window.location.origin}/invite/${data.invite_token}`;
      }
    }
    return link || null;
  } catch { return null; }
}

function promptEditCaregiver(index) {
  showAddCaregiverForm(index);
}

function confirmDeleteCaregiver(index) {
  const setup = window.getOnboardingState?.() || {};
  const caregivers = [...(setup.caregivers || [])];
  const name = caregivers[index]?.name || caregivers[index] || "?";
  if (!window.confirm(`${_cgt("settings.caregiver_remove_confirm")} ${name}?`)) return;
  caregivers.splice(index, 1);
  _saveCaregivers(caregivers);
  showFeatureToast(_cgt("settings.caregiver_removed"));
  window.switchModule("settings");
}

// ─── Pets CRUD ─────────────────────────────────────────────────────────────────

function promptAddPet() {
  const name = window.prompt("Pet's name:");
  if (!name?.trim()) return;
  const setup = window.getOnboardingState?.() || {};
  const updated = { ...setup, pets: [...(setup.pets || []), { name: name.trim() }] };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
  showFeatureToast(`${name.trim()} added`);
  window.switchModule("settings");
}

function promptEditPet(index) {
  const setup = window.getOnboardingState?.() || {};
  const pets = [...(setup.pets || [])];
  const current = pets[index]?.name || pets[index] || "";
  const name = window.prompt("Edit name:", current);
  if (!name?.trim() || name.trim() === current) return;
  pets[index] = { ...(typeof pets[index] === "object" ? pets[index] : {}), name: name.trim() };
  const updated = { ...setup, pets };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
  showFeatureToast(`Updated to ${name.trim()}`);
  window.switchModule("settings");
}

function confirmDeletePet(index) {
  const setup = window.getOnboardingState?.() || {};
  const pets = [...(setup.pets || [])];
  const name = pets[index]?.name || pets[index] || "this pet";
  if (!window.confirm(`Remove ${name}?`)) return;
  pets.splice(index, 1);
  const updated = { ...setup, pets };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
  showFeatureToast(`${name} removed`);
  window.switchModule("settings");
}

// Refresh calendar when Google Calendar events load
window.addEventListener("googleCalendarLoaded", () => {
  syncCalendarEventsFromCards();
  if (typeof renderFeature === "function" && typeof featureData !== "undefined") {
    renderFeature("calendar", featureData.calendar);
  }
});

// ─── Notification preferences panel ───────────────────────────────────────────

async function renderNotifPrefsPanel() {
  const container = document.getElementById("notifPrefsContent");
  if (!container) return;

  const session = typeof getAuthState === "function" ? getAuthState() : null;
  const userId = session?.session?.user?.id;

  // Load current prefs from Supabase if available
  let prefs = { email: true, push: true, quiet_from: "22:00", quiet_to: "07:00" };
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Zurich";

  if (userId && window.supabaseClient) {
    try {
      const { data } = await window.supabaseClient
        .from("profiles")
        .select("notification_prefs, timezone")
        .eq("id", userId)
        .single();
      if (data?.notification_prefs) prefs = { ...prefs, ...data.notification_prefs };
      if (data?.timezone) timezone = data.timezone;
    } catch {}
  }

  const pushSupported = "PushManager" in window;
  const pushPermission = typeof Notification !== "undefined" ? Notification.permission : "denied";

  container.innerHTML = `
    <article class="feature-item" style="flex-direction:column;align-items:flex-start;gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <div>
          <strong>Email reminders</strong>
          <span>Send email when a reminder is due</span>
        </div>
        <label class="toggle-switch" style="margin-left:12px;">
          <input type="checkbox" id="notifPrefEmail" ${prefs.email !== false ? "checked" : ""}>
          <span class="toggle-knob"></span>
        </label>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <div>
          <strong>Push notifications</strong>
          <span>${pushSupported ? (pushPermission === "denied" ? "Blocked in browser settings" : "Push to this device") : "Not supported on this browser"}</span>
        </div>
        <label class="toggle-switch" style="margin-left:12px;">
          <input type="checkbox" id="notifPrefPush" ${prefs.push !== false ? "checked" : ""} ${!pushSupported || pushPermission === "denied" ? "disabled" : ""}>
          <span class="toggle-knob"></span>
        </label>
      </div>
      <div style="width:100%;display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);">
        <span style="font-size:13px;color:var(--muted);">Cisza nocna: ustawiana w sekcji Przypomnienia w ustawieniach.</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
        <button class="secondary-button" id="saveNotifPrefs" style="font-size:13px;">Save</button>
        <button class="ghost-button" id="testNotifBtn" style="font-size:13px;padding:8px 14px;background:transparent;border:1px solid var(--border);border-radius:999px;color:var(--text);cursor:pointer;" ${!pushSupported || pushPermission !== "granted" ? "disabled title='Enable push notifications first'" : ""}>Send test push</button>
      </div>
    </article>
  `;

  // Save prefs
  document.getElementById("saveNotifPrefs")?.addEventListener("click", async () => {
    const emailOn = document.getElementById("notifPrefEmail")?.checked ?? true;
    const pushOn = document.getElementById("notifPrefPush")?.checked ?? true;

    // Subscribe or unsubscribe from push based on toggle
    if (pushOn && pushPermission === "default") {
      const granted = await Notification.requestPermission();
      if (granted === "granted" && typeof subscribeToPush === "function") {
        await subscribeToPush();
      }
    } else if (!pushOn && typeof unsubscribeFromPush === "function") {
      await unsubscribeFromPush();
    }

    if (userId && window.supabaseClient) {
      // Merge with existing prefs to preserve quiet hours set in Reminders section
      const { data: existing } = await window.supabaseClient
        .from("profiles").select("notification_prefs").eq("id", userId).single().catch(() => ({ data: null }));
      const base = existing?.notification_prefs || {};
      await window.supabaseClient
        .from("profiles")
        .update({ notification_prefs: { ...base, email: emailOn, push: pushOn } })
        .eq("id", userId);
    }
    if (typeof showToast === "function") showToast("Notification preferences saved");
  });

  // Test push
  document.getElementById("testNotifBtn")?.addEventListener("click", async () => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("Do-Do test", {
        body: "Push notifications are working!",
        icon: "./assets/dodo-icon.png",
        badge: "./assets/dodo-icon.png",
        tag: "do-do-test",
      });
    } catch (e) {
      if (typeof showToast === "function") showToast("Could not send test notification");
    }
  });
}

// ─── Przekazanie (Child Handover) ─────────────────────────────────────────────

const PRZEKAZANIE_KEY = "do-do-przekazanie-v1";
const PRZEKAZ_PACK_KEY = "do-do-przekaz-pack-v1";

function loadPrzekazPackList() {
  try {
    const raw = window.appStorage?.getItem(PRZEKAZ_PACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function savePrzekazPackList(items) {
  try { window.appStorage?.setItem(PRZEKAZ_PACK_KEY, JSON.stringify(items)); } catch {}
}

function loadPrzekazanieData() {
  try {
    const raw = window.appStorage?.getItem(PRZEKAZANIE_KEY);
    if (!raw) return { selectedChildren: [], checklist: [], reminders: [], healthNote: "" };
    const parsed = JSON.parse(raw);
    return {
      selectedChildren: parsed.selectedChildren || [],
      checklist: parsed.checklist || [],
      reminders: parsed.reminders || [],
      healthNote: parsed.healthNote || "",
    };
  } catch {
    return { selectedChildren: [], checklist: [], reminders: [], healthNote: "" };
  }
}

function savePrzekazanieData(data) {
  try { window.appStorage?.setItem(PRZEKAZANIE_KEY, JSON.stringify(data)); } catch {}
}

function _przekazNextHandoverLabel() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}

function renderPrzekazanieFeature(container) {
  const setup = window.getOnboardingState?.() || {};
  const coparent = setup.parents?.coparent || "Co-rodzica";
  const allChildren = (setup.children || []).map((c) => c.name || c).filter(Boolean);
  const allPets = (setup.pets || []).map((p) => p.name || p).filter(Boolean);
  const allMembers = [
    ...allChildren.map((n) => ({ name: n, type: "child" })),
    ...allPets.map((n) => ({ name: n, type: "pet" })),
  ];
  const data = loadPrzekazanieData();

  // Default: select all children/pets if nothing stored yet
  if (data.selectedChildren.length === 0 && allMembers.length > 0) {
    data.selectedChildren = allMembers.map((m) => m.name);
    savePrzekazanieData(data);
  }

  const dateLabel = _przekazNextHandoverLabel();
  const _t = window.t || ((k, p) => p ? Object.entries(p).reduce((s,[a,b]) => s.replace(`{{${a}}}`, b), k) : k);
  const _pContainer = container || featureModule;
  const packItems = loadPrzekazPackList();
  const packTitle = _t("handover.pack_title");
  const packGroup = renderShoppingGroup("przekaz-pack", packTitle, packItems);

  _pContainer.innerHTML = `
    <div style="display:grid;gap:12px;">

      <section class="card-info-section">
        <div class="section-heading">${_t("handover.for_children")}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          ${allMembers.map(({ name, type }) => {
            const active = data.selectedChildren.includes(name);
            const prefix = type === "pet" ? "🐾 " : "";
            return `<button type="button" class="przekaz-child-chip${active ? " active" : ""}" data-child="${escapeFeatureHtml(name)}"
              style="padding:8px 18px;border-radius:999px;border:2px solid ${active ? "var(--accent,#6366f1)" : "var(--border)"};
              background:${active ? "rgba(99,102,241,.12)" : "transparent"};font-size:14px;font-weight:600;cursor:pointer;
              color:var(--text);transition:all .15s;">
              ${prefix}${escapeFeatureHtml(name)}
            </button>`;
          }).join("")}
          <button type="button" id="przekazAddChildBtn"
            style="padding:6px 14px;border-radius:999px;border:2px dashed var(--border);background:transparent;
            font-size:13px;color:var(--muted);cursor:pointer;white-space:nowrap;">
            ${_t("handover.add_child")}
          </button>
          <button type="button" id="przekazAddPetBtn"
            style="padding:6px 14px;border-radius:999px;border:2px dashed var(--border);background:transparent;
            font-size:13px;color:var(--muted);cursor:pointer;white-space:nowrap;">
            ${_t("handover.add_pet")}
          </button>
        </div>
      </section>

      ${packGroup}

      <section class="card-info-section">
        <div class="section-heading">${_t("handover.health_note")}</div>
        <textarea id="przekazHealthNote" rows="3"
          placeholder="${_t("handover.health_ph")}"
          style="width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:10px;padding:10px 12px;
          font-size:14px;font-family:inherit;background:transparent;color:var(--text);
          resize:vertical;min-height:76px;outline:none;">${escapeFeatureHtml(data.healthNote)}</textarea>
      </section>

      <section class="card-info-section" id="przekazReminderSection">
        <div class="section-heading">${_t("handover.reminders")}</div>
        <div id="przekazReminderList" style="display:flex;flex-wrap:wrap;gap:8px;${data.reminders.length ? "" : "display:none;"}">
          ${data.reminders.map((item) => _renderPrzekazReminderChip(item)).join("")}
        </div>
        <form id="przekazReminderForm" style="display:flex;gap:8px;align-items:center;">
          <label class="clean-field" style="flex:1;margin:0;">
            <input data-przekaz-input="reminders" placeholder="${_t("handover.reminder_ph")}"
              autocomplete="off" autocapitalize="sentences" enterkeyhint="done"
              style="width:100%;" />
          </label>
          <button class="secondary-button" type="submit" style="min-width:44px;height:44px;font-size:20px;padding:0;">+</button>
        </form>
      </section>

      <div class="dialog-actions" style="padding:0;">
        <button class="primary-button" id="przekazSendBtn" type="button"
          style="display:flex;align-items:center;justify-content:center;gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true">
            <path d="M22 2 11 13M22 2 15 22 11 13 2 9l20-7Z"/>
          </svg>
          ${_t("handover.send", { name: escapeFeatureHtml(coparent) })}
        </button>
      </div>

    </div>
  `;

  _bindPrzekazanieEvents(data, allMembers, coparent, _pContainer);
}

// Open the Przekazanie / Handover card as a modal dialog from anywhere (e.g. calendar handover marker)
window.openPrzekazanieDialog = function() {
  let dlg = document.getElementById("przekazanieDialog");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "przekazanieDialog";
    dlg.className = "card-dialog przekazanie-dialog";
    dlg.innerHTML = `
      <div class="dialog-content">
        <div class="dialog-header">
          <div>
            <p class="eyebrow" id="przekazanieDlgEyebrow" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 2px;"></p>
            <h2 id="przekazanieDlgTitle" style="margin:0;"></h2>
          </div>
          <div class="dialog-header-actions">
            <button class="icon-button" type="button" id="przekazanieDlgClose" aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div id="przekazanieDlgBody" style="overflow-y:auto;max-height:68vh;padding:0 4px 8px;"></div>
      </div>
    `;
    document.body.appendChild(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.querySelector("#przekazanieDlgClose").addEventListener("click", () => dlg.close());
  }

  const setup = window.getOnboardingState?.() || {};
  const coparent = setup.parents?.coparent || "Co-rodzic";
  const _t2 = window.t || ((k) => k);
  const handoverLabel = _t2("cal.handover") || "Handover";
  const dateLabel2 = _przekazNextHandoverLabel();
  dlg.querySelector("#przekazanieDlgTitle").textContent = `${handoverLabel}`;
  const eyebrow = dlg.querySelector("#przekazanieDlgEyebrow");
  if (eyebrow) eyebrow.textContent = `${_t2("handover.title", { name: coparent }) || coparent} · ${dateLabel2}`;

  renderPrzekazanieFeature(dlg.querySelector("#przekazanieDlgBody"));
  dlg.showModal();
};

function _renderPrzekazReminderChip(item) {
  return `<span class="card-reminder przekaz-reminder-chip" data-reminder-id="${escapeFeatureHtml(item.id)}"
    style="cursor:default;gap:6px;padding:7px 10px 7px 10px;">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" width="14" height="14">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    ${escapeFeatureHtml(item.label)}
    <button type="button" data-przekaz-delete="${escapeFeatureHtml(item.id)}" data-przekaz-list="reminders"
      aria-label="Remove"
      style="background:none;border:none;cursor:pointer;padding:0 0 0 2px;color:inherit;opacity:.55;font-size:13px;line-height:1;display:inline-flex;align-items:center;">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" width="12" height="12">
        <path d="M12 4 4 12M4 4l8 8"/>
      </svg>
    </button>
  </span>`;
}

function _renderPrzekazItem(item, listKey) {
  return `
    <div class="shopping-row-wrap${item.checked ? " bought" : ""}">
      <label class="shopping-row">
        <input type="checkbox" data-przekaz-check="${escapeFeatureHtml(item.id)}" data-przekaz-list="${listKey}" ${item.checked ? "checked" : ""} />
        <strong>${escapeFeatureHtml(item.label)}</strong>
      </label>
      <button class="shopping-delete-btn" type="button" data-przekaz-delete="${escapeFeatureHtml(item.id)}" data-przekaz-list="${listKey}" aria-label="Usun">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" width="14" height="14">
          <path d="M12 4 4 12M4 4l8 8"/>
        </svg>
      </button>
    </div>
  `;
}

function _bindSingleShoppingGroup(container, key, loadFn, saveFn) {
  const _rerender = () => {
    const items = loadFn();
    const sec = container.querySelector(`[data-shopping-add-form="${key}"]`)?.closest("section.shopping-group");
    if (!sec) return;
    const title = sec.querySelector("h3")?.textContent || "";
    sec.outerHTML = renderShoppingGroup(key, title, items);
    _bindSingleShoppingGroup(container, key, loadFn, saveFn);
  };

  // Add form submit
  const form = container.querySelector(`[data-shopping-add-form="${key}"]`);
  if (form && !form.dataset.sgBound) {
    form.dataset.sgBound = "1";
    const input = form.querySelector("[data-shopping-input]");
    const mic = form.querySelector("[data-shopping-mic]");
    mic?.addEventListener("click", () => window.startDictationForField?.(input, { button: mic, success: "Item dictated" }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const label = input?.value.trim();
      if (!label) return;
      const items = loadFn();
      items.push({ id: `${key}-${Date.now()}`, label, bought: false });
      saveFn(items);
      input.value = "";
      _rerender();
      container.querySelector(`[data-shopping-add-form="${key}"] [data-shopping-input]`)?.focus();
    });
    // Multi-line paste
    input?.addEventListener("paste", (e) => {
      const text = (e.clipboardData || window.clipboardData).getData("text");
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length <= 1) return;
      e.preventDefault();
      const items = loadFn();
      lines.forEach((label) => items.push({ id: `${key}-${Date.now()}-${Math.random().toString(36).slice(2)}`, label, bought: false }));
      saveFn(items);
      _rerender();
    });
  }

  // Checkboxes (mark bought)
  container.querySelectorAll(`[data-shopping-list="${key}"][data-shopping-check]:not([data-sgb])`).forEach((cb) => {
    cb.dataset.sgb = "1";
    cb.addEventListener("change", () => {
      const items = loadFn();
      const item = items.find((i) => i.id === cb.dataset.shoppingCheck);
      if (item) { item.bought = cb.checked; saveFn(items); }
      cb.closest(".shopping-row-wrap")?.classList.toggle("bought", cb.checked);
      _rerender();
    });
  });

  // Delete buttons
  container.querySelectorAll(`[data-shopping-delete]:not([data-sgd])`).forEach((btn) => {
    const id = btn.dataset.shoppingDelete;
    if (!id?.startsWith(key)) return;
    btn.dataset.sgd = "1";
    btn.addEventListener("click", () => {
      const items = loadFn().filter((i) => i.id !== id);
      saveFn(items);
      _rerender();
    });
  });

  // Mark all
  container.querySelector(`[data-shopping-mark-all="${key}"]`)?.addEventListener("click", () => {
    const items = loadFn();
    items.forEach((i) => { i.bought = true; });
    saveFn(items);
    _rerender();
  });

  // Unmark
  container.querySelector(`[data-shopping-unmark="${key}"]`)?.addEventListener("click", () => {
    const items = loadFn();
    items.forEach((i) => { i.bought = false; });
    saveFn(items);
    _rerender();
  });

  // Clear bought
  container.querySelector(`[data-shopping-clear="${key}"]`)?.addEventListener("click", () => {
    saveFn(loadFn().filter((i) => !i.bought));
    _rerender();
  });
}

function _bindPrzekazanieEvents(data, allMembers, coparent, mod) {
  mod = mod || featureModule;

  // Child/pet selector chips
  mod.querySelectorAll(".przekaz-child-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const child = btn.dataset.child;
      const idx = data.selectedChildren.indexOf(child);
      if (idx >= 0) data.selectedChildren.splice(idx, 1);
      else data.selectedChildren.push(child);
      savePrzekazanieData(data);
      const active = data.selectedChildren.includes(child);
      btn.classList.toggle("active", active);
      btn.style.borderColor = active ? "var(--accent,#6366f1)" : "var(--border)";
      btn.style.background = active ? "rgba(99,102,241,.12)" : "transparent";
    });
  });

  // Add child inline
  mod.querySelector("#przekazAddChildBtn")?.addEventListener("click", async () => {
    const name = window.prompt(window.t?.("handover.add_child_prompt") || "Child's first name:");
    if (!name?.trim()) return;
    const setup = window.getOnboardingState?.() || {};
    if (!setup.familyId) { showFeatureToast("Complete setup first"); return; }
    await window.saveChildrenToSupabase?.(setup.familyId, [{ name: name.trim() }]);
    const updated = { ...setup, children: [...(setup.children || []), { name: name.trim() }] };
    window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
    data.selectedChildren.push(name.trim());
    savePrzekazanieData(data);
    showFeatureToast(name.trim() + " added");
    renderPrzekazanieFeature(mod === featureModule ? null : mod);
  });

  // Add pet inline
  mod.querySelector("#przekazAddPetBtn")?.addEventListener("click", () => {
    const name = window.prompt(window.t?.("handover.add_pet_prompt") || "Pet's name:");
    if (!name?.trim()) return;
    const setup = window.getOnboardingState?.() || {};
    const updated = { ...setup, pets: [...(setup.pets || []), { name: name.trim() }] };
    window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
    data.selectedChildren.push(name.trim());
    savePrzekazanieData(data);
    showFeatureToast(name.trim() + " added");
    renderPrzekazanieFeature(mod === featureModule ? null : mod);
  });

  // Pack list (rzeczy) uses full shopping-group behaviour
  _bindSingleShoppingGroup(mod, "przekaz-pack", loadPrzekazPackList, savePrzekazPackList);

  // Add reminder as chip
  mod.querySelector("#przekazReminderForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = mod.querySelector("[data-przekaz-input='reminders']");
    const label = input?.value.trim();
    if (!label) return;
    const item = { id: "prz-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7), label, checked: false };
    data.reminders.push(item);
    savePrzekazanieData(data);
    const list = mod.querySelector("#przekazReminderList");
    if (list) {
      list.style.display = "flex";
      list.insertAdjacentHTML("beforeend", _renderPrzekazReminderChip(item));
      // bind delete on the new chip
      list.querySelector(`[data-reminder-id="${item.id}"] [data-przekaz-delete]`)?.addEventListener("click", () => {
        data.reminders = data.reminders.filter((i) => i.id !== item.id);
        savePrzekazanieData(data);
        list.querySelector(`[data-reminder-id="${item.id}"]`)?.remove();
        if (!data.reminders.length) list.style.display = "none";
      });
    }
    if (input) { input.value = ""; input.focus(); }
  });

  // Health note auto-save
  mod.querySelector("#przekazHealthNote")?.addEventListener("input", (e) => {
    data.healthNote = e.target.value;
    savePrzekazanieData(data);
  });

  // Bind checkbox + delete for existing items
  _bindPrzekazItemListeners(mod, data);

  // Send button
  mod.querySelector("#przekazSendBtn")?.addEventListener("click", () => _sendPrzekazanie(data, coparent));
}

function _bindPrzekazItemListeners(mod, data) {
  // Only bind once per element using data-pbound attribute
  mod.querySelectorAll("[data-przekaz-check]:not([data-pbound])").forEach((checkbox) => {
    checkbox.dataset.pbound = "1";
    checkbox.addEventListener("change", () => {
      const id = checkbox.dataset.przekazCheck;
      const listKey = checkbox.dataset.przekazList;
      const list = listKey === "rzeczy" ? data.checklist : data.reminders;
      const item = list.find((i) => i.id === id);
      if (item) {
        item.checked = checkbox.checked;
        savePrzekazanieData(data);
        checkbox.closest(".shopping-row-wrap")?.classList.toggle("bought", checkbox.checked);
        _updatePrzekazCounters(mod, data);
      }
    });
  });

  mod.querySelectorAll("[data-przekaz-delete]:not([data-pbound])").forEach((btn) => {
    btn.dataset.pbound = "1";
    btn.addEventListener("click", () => {
      const id = btn.dataset.przekazDelete;
      const listKey = btn.dataset.przekazList;
      if (listKey === "reminders") {
        data.reminders = data.reminders.filter((i) => i.id !== id);
        savePrzekazanieData(data);
        btn.closest(".przekaz-reminder-chip")?.remove();
        const list = mod.querySelector("#przekazReminderList");
        if (list && !data.reminders.length) list.style.display = "none";
      } else {
        data.checklist = data.checklist.filter((i) => i.id !== id);
        savePrzekazanieData(data);
        btn.closest(".shopping-row-wrap")?.remove();
      }
    });
  });
}

function _updatePrzekazCounters(mod, data) {
  const rc = mod.querySelector("#przekazRzeczyCounter");
  if (rc) rc.textContent = `${data.checklist.filter((i) => !i.checked).length} do spakowania`;
  const rem = mod.querySelector("#przekazRemCounter");
  if (rem) rem.textContent = `${data.reminders.filter((i) => !i.checked).length} otwarte`;
}

async function _sendPrzekazanie(data, coparent) {
  const btn = featureModule.querySelector("#przekazSendBtn");
  if (btn) btn.disabled = true;

  try {
    // Build summary message
    const childrenStr = data.selectedChildren.join(", ") || "dzieci";
    const unchecked = data.checklist.filter((i) => !i.checked).map((i) => i.label);
    const reminders = data.reminders.filter((i) => !i.checked).map((i) => i.label);
    const bodyLines = [];
    if (unchecked.length) bodyLines.push("Do spakowania: " + unchecked.join(", "));
    if (data.healthNote.trim()) bodyLines.push(data.healthNote.trim().slice(0, 100));
    if (reminders.length) bodyLines.push("Przypomnienia: " + reminders.join(", "));

    // Fire push notification if permission granted
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(`Przekazanie - ${childrenStr}`, {
          body: bodyLines.join("\n") || "Checklist gotowa.",
          icon: "./assets/dodo-icon.png",
          badge: "./assets/dodo-icon.png",
          tag: "do-do-przekazanie",
        });
      } catch {}
    }

    // Reset health note and re-save
    data.healthNote = "";
    savePrzekazanieData(data);

    showFeatureToast(`Przekazanie wyslane do ${coparent}!`);
    // Re-render with cleared health note, checklist stays (co-parent may want to see)
    setTimeout(() => renderPrzekazanieFeature(), 400);
  } catch (err) {
    console.error("przekazanie send error:", err);
    showFeatureToast("Blad - sprobuj ponownie.");
    if (btn) btn.disabled = false;
  }
}
