const today = new Date();
const shoppingStorageKey = "do-do-shopping-lists-v1";
const shoppingCustomListsKey = "do-do-shopping-custom-lists-v1";

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
      enabled: false,
      type: "7-7",
      referenceDate: new Date().toISOString().slice(0, 10),
      myColor: "#65d6c6",
      coColor: "#76808a",
      overrides: {},   // { "YYYY-MM-DD": "mine" | "co" | { type:"split", time:"HH:MM", morning:"mine"|"co" } }
    };
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return { enabled: false, type: "7-7", referenceDate: new Date().toISOString().slice(0, 10), myColor: "#65d6c6", coColor: "#76808a", overrides: {} };
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
  return null;
}

function getCustodyClass(date) {
  const owner = getCustodyOwner(date);
  if (owner === "mine") return "custody-mine";
  if (owner === "co") return "custody-co";
  if (owner === "split") return "custody-split";
  return "";
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
    { id: "grocery-milk", label: "Milk", bought: false },
    { id: "grocery-fruit", label: "Ava's lunchbox fruit", bought: false },
    { id: "grocery-tabs", label: "Dishwasher tabs", bought: true, boughtBy: "Parent A" },
  ],
  other: [
    { id: "other-socks", label: "Leo's football socks", bought: false },
    { id: "other-medicine", label: "Allergy medicine refill", bought: false },
  ],
};
const calendarState = {
  view: "month",
  cursor: new Date(today.getFullYear(), today.getMonth(), 1),
  selected: toCalendarKey(today),
  events: buildCalendarEvents(today),
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
    title: "Shared and private family record vault",
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
    title: "Shared family shopping list",
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
    title: "Transparent family plan",
    summary: "This models a simple billing page with flat family pricing, free trial, annual discount, waiver path, and data portability.",
    actions: ["Start trial", "Apply waiver", "Export before cancel"],
    stats: [
      ["Trial", "30 days"],
      ["Members", "Unlimited family"],
      ["Annual discount", "20%"],
      ["Export window", "60 days"],
    ],
    sections: [
      {
        title: "Plan rules",
        items: [
          ["Family plan", "One price covers both parents, children, and approved helpers."],
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
const VALID_MODULES = ["board", "calendar", "messages", "shopping", "expenses", "settings"];

const _origSwitchModule = switchModule;
window.switchModule = function(moduleName) {
  _origSwitchModule(moduleName);
  const hash = "#" + moduleName;
  if (location.hash !== hash) history.pushState(null, "", hash);
  localStorage.setItem("do-do-last-module", moduleName);
};

function routeFromHash() {
  const module = location.hash.replace("#", "").toLowerCase();
  if (VALID_MODULES.includes(module)) {
    _origSwitchModule(module);
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

  featureModule.innerHTML = `
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

// ─── Custody schedule dialog (card-dialog style) ─────────────────────────────

function openCustodyScheduleDialog() {
  const dialog = document.getElementById("custodyScheduleDialog");
  if (!dialog) return;
  const cs = getCustodySchedule();

  const swatchRow = (target, label) => `
    <div class="custody-dialog-swatch-row">
      <span class="custody-dialog-swatch-label">${label}</span>
      <div class="custody-color-swatches" data-custody-target="${target}">
        ${CUSTODY_COLORS.map(c => `<button type="button" class="custody-swatch${cs[target] === c.value ? " active" : ""}" data-custody-color="${c.value}" style="background:${c.value};" title="${c.label}" aria-label="${c.label}"></button>`).join("")}
      </div>
    </div>`;

  document.getElementById("custodyDialogBody").innerHTML = `
    <div class="custody-dialog-fields">
      <label class="clean-field custody-dialog-field">
        <span>Show custody calendar</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="cdEnabled" ${cs.enabled ? "checked" : ""} />
          <em style="font-size:12px;color:var(--muted);">Colour-code days to show who has the kids</em>
        </div>
      </label>

      <label class="clean-field custody-dialog-field">
        <span>Schedule type</span>
        <select id="cdType">
          <option value="7-7" ${cs.type === "7-7" ? "selected" : ""}>Alternating weeks (7-7)</option>
          <option value="2-2-3" ${cs.type === "2-2-3" ? "selected" : ""}>2-2-3 rotation</option>
          <option value="5-2" ${cs.type === "5-2" ? "selected" : ""}>Weekdays mine / weekends co-parent</option>
        </select>
      </label>

      <label class="clean-field custody-dialog-field" id="cdRefRow" ${cs.type === "5-2" ? 'style="display:none"' : ""}>
        <span>My schedule starts</span>
        <input type="date" id="cdReferenceDate" value="${cs.referenceDate || new Date().toISOString().slice(0,10)}" />
      </label>

      <div class="custody-dialog-field">
        ${swatchRow("myColor", "My days colour")}
        ${swatchRow("coColor", "Co-parent days colour")}
      </div>

      <div class="custody-dialog-preview">
        <span class="custody-legend-item"><span class="custody-legend-dot" id="cdPreviewMine" style="background:${cs.myColor};border-radius:4px;width:32px;height:16px;display:inline-block;"></span> My days</span>
        <span class="custody-legend-item"><span class="custody-legend-dot" id="cdPreviewCo" style="background:${cs.coColor};border-radius:4px;width:32px;height:16px;display:inline-block;"></span> Co-parent's days</span>
      </div>
    </div>
  `;

  // Swatch interactions
  dialog.querySelectorAll(".custody-color-swatches").forEach((group) => {
    group.querySelectorAll(".custody-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll(".custody-swatch").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const target = group.dataset.custodyTarget;
        const previewId = target === "myColor" ? "cdPreviewMine" : "cdPreviewCo";
        const preview = dialog.querySelector(`#${previewId}`);
        if (preview) preview.style.background = btn.dataset.custodyColor;
      });
    });
  });

  // Type change hides/shows reference date
  dialog.querySelector("#cdType")?.addEventListener("change", (e) => {
    const row = dialog.querySelector("#cdRefRow");
    if (row) row.style.display = e.target.value === "5-2" ? "none" : "";
  });

  // Save
  dialog.querySelector("#custodyDialogSaveBtn")?.addEventListener("click", () => {
    const activeSwatch = (target) => dialog.querySelector(`.custody-color-swatches[data-custody-target="${target}"] .custody-swatch.active`)?.dataset.custodyColor;
    const schedule = {
      ...getCustodySchedule(),
      enabled: dialog.querySelector("#cdEnabled")?.checked || false,
      type: dialog.querySelector("#cdType")?.value || "7-7",
      referenceDate: dialog.querySelector("#cdReferenceDate")?.value || new Date().toISOString().slice(0,10),
      myColor: activeSwatch("myColor") || cs.myColor,
      coColor: activeSwatch("coColor") || cs.coColor,
    };
    saveCustodySchedule(schedule);
    dialog.close();
    showFeatureToast("Parenting schedule saved");
    // Refresh calendar if visible
    if (featureModule && !featureModule.classList.contains("hidden")) {
      const data = window._lastFeatureData;
      if (data) renderCalendarFeature(data);
    }
  });

  dialog.querySelector("#custodyDialogCancelBtn")?.addEventListener("click", () => dialog.close());
  dialog.querySelector("#closeCustodyDialogBtn")?.addEventListener("click", () => dialog.close());

  dialog.showModal();
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
  const startMs = new Date(vac.startDate + "T00:00:00").getTime();
  const dMs = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const weekIndex = Math.floor((dMs - startMs) / (7 * 86400000));
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

window.openCustodyScheduleDialog = openCustodyScheduleDialog;

function bindCustodySettings() {
  const save = () => {
    const schedule = {
      enabled: featureModule.querySelector("#custodyEnabledToggle")?.checked || false,
      type: featureModule.querySelector("#custodyType")?.value || "7-7",
      referenceDate: featureModule.querySelector("#custodyReferenceDate")?.value || new Date().toISOString().slice(0, 10),
      myColor: getCustodySchedule().myColor,
      coColor: getCustodySchedule().coColor,
    };
    saveCustodySchedule(schedule);
    showFeatureToast("Parenting schedule saved");
  };

  // Toggle, type, date changes - auto-save
  featureModule.querySelector("#custodyEnabledToggle")?.addEventListener("change", save);
  featureModule.querySelector("#custodyType")?.addEventListener("change", (e) => {
    const refRow = featureModule.querySelector("#custodyRefDateRow");
    if (refRow) refRow.style.display = e.target.value === "5-2" ? "none" : "";
    save();
  });
  featureModule.querySelector("#custodyReferenceDate")?.addEventListener("change", save);

  // Color swatches
  featureModule.querySelectorAll(".custody-color-swatches").forEach((group) => {
    group.querySelectorAll(".custody-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = group.dataset.custodyTarget; // "myColor" or "coColor"
        const color = btn.dataset.custodyColor;
        // Update active state visually
        group.querySelectorAll(".custody-swatch").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        // Save with the new color
        const current = getCustodySchedule();
        current[target] = color;
        current.enabled = featureModule.querySelector("#custodyEnabledToggle")?.checked || false;
        current.type = featureModule.querySelector("#custodyType")?.value || current.type;
        current.referenceDate = featureModule.querySelector("#custodyReferenceDate")?.value || current.referenceDate;
        saveCustodySchedule(current);
        showFeatureToast("Colour updated");
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
  autoRemindersToggle?.addEventListener("change", save);
  familyCalendarToggle?.addEventListener("change", (e) => {
    if (e.target.checked && !window.isPaidUser?.()) {
      e.target.checked = false; // revert
      window.showUpgradePrompt?.("Calendar sync is available on the Family plan.");
      return;
    }
    save();
  });
  familyCalendarProvider?.addEventListener("change", save);
  workCalendarToggle?.addEventListener("change", save);
  workCalendarProvider?.addEventListener("change", save);
  globalReminderPreset?.addEventListener("change", save);
  reminderDelivery?.addEventListener("change", save);
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

  // Google Calendar token health indicator
  // Updates the badge in the Family calendar row based on token refresh result
  const _updateGCalBadge = (status) => {
    const badge = featureModule.querySelector("#gcalTokenStatusBadge");
    if (!badge) return;
    const automation = window.getAutomationSettings?.() || {};
    if (!automation.syncFamilyCalendar) return; // only show status when sync is enabled
    const map = {
      connected:      { text: "Connected", cls: "status-connected" },
      no_token:       { text: "Reconnect needed", cls: "status-pending" },
      token_revoked:  { text: "Re-authorise Google", cls: "status-error" },
      error:          { text: "Sync error", cls: "status-error" },
    };
    const ui = map[status] || { text: "On", cls: "" };
    badge.textContent = ui.text;
    badge.className = ui.cls;
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
    window.setCurrencyPreference?.(currencySelect.value);
    showFeatureToast(`Currency set to ${currencySelect.value}`);
    // Reload so LOCALE_CONFIG re-initializes with the new value
    setTimeout(() => location.reload(), 800);
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

function _renderShoppingBoard(lists) {
  const board = featureModule.querySelector("#shoppingBoard") || featureModule;
  const customLists = loadCustomShoppingLists();
  board.innerHTML = `
    ${renderShoppingGroup("groceries", window.t ? window.t("shopping.groceries") : "Groceries", lists.groceries)}
    ${renderShoppingGroup("other", window.t ? window.t("shopping.other") : "Other", lists.other)}
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
      if (wrap) wrap.classList.toggle("bought", input.checked);

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

  // Remove custom list
  board.querySelectorAll("[data-shopping-remove-list]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const listKey = btn.dataset.shoppingRemoveList;
      if (!confirm("Remove this list and all its items?")) return;
      const cls = loadCustomShoppingLists();
      saveCustomShoppingLists(cls.filter((l) => l.key !== listKey));
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
        // Supabase item (UUID)
        await window.deleteShoppingItem?.(id);
        const refreshed = await window.loadShoppingItems?.();
        if (refreshed) _renderShoppingBoard(refreshed);
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
      const groupName = listKey === "groceries" ? (window.t?.("shopping.groceries") ?? "Groceries") : (window.t?.("shopping.other") ?? "Other");
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
        if (wrap) wrap.classList.toggle("bought", input.checked);

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
  const isCustom = key.startsWith("custom-");
  return `
    <section class="feature-panel shopping-group">
      <div class="shopping-group-header">
        <h3>${title}</h3>
        <div class="shopping-group-header-actions">
          ${boughtCount > 0 ? `<button class="shopping-clear-btn" type="button" data-shopping-clear="${key}" title="${clearLabel}">${clearLabel}</button>` : ""}
          <span>${leftLabel}</span>
          ${isCustom ? `<button class="shopping-remove-list-btn ghost-button" type="button" data-shopping-remove-list="${key}" title="Remove list" style="font-size:11px;padding:2px 8px;color:var(--muted);">Remove list</button>` : ""}
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

function renderExpensesFeature() {
  const allCards = (typeof state !== "undefined" ? state.cards : [])
    .filter((card) => card.type === "Expense" || card.topic === "Expenses")
    .sort((a, b) => new Date(a.due || 0) - new Date(b.due || 0));

  // Month filter
  const now = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("default", { month: "long", year: "numeric" }) });
  }
  // Read selected month from dataset (persisted on featureModule)
  const selectedMonth = featureModule.dataset.expenseMonth || months[0].value;
  const [selYear, selMon] = selectedMonth.split("-").map(Number);

  const expenseCards = allCards.filter((card) => {
    const d = card.due ? new Date(card.due) : null;
    if (!d) return true; // no due date - show in current month
    return d.getFullYear() === selYear && d.getMonth() + 1 === selMon;
  });

  const total = expenseCards.reduce((sum, card) => sum + expenseAmount(card.amount), 0);
  const openCards = expenseCards.filter((card) => card.status !== "Done" && card.payment_status !== "paid");
  const paidCards = expenseCards.filter((card) => card.status === "Done" || card.payment_status === "paid");

  const myName = typeof getMyName === "function" ? getMyName() : "";
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";

  const balance = computeBalance(expenseCards, myName);
  const balanceAbs = Math.abs(balance);
  const _sym = (window.LOCALE_CONFIG || LOCALE_CONFIG)?.symbol || "CHF";
  const balanceLabel = balance > 0.01
    ? `<span class="balance-positive">${window.t?.("expense.they_owe", { sym: _sym, amt: formatExpenseCurrency(balanceAbs) }) ?? `They owe you ${_sym} ${formatExpenseCurrency(balanceAbs)}`}</span>`
    : balance < -0.01
    ? `<span class="balance-negative">${window.t?.("expense.you_owe", { sym: _sym, amt: formatExpenseCurrency(balanceAbs) }) ?? `You owe ${_sym} ${formatExpenseCurrency(balanceAbs)}`}</span>`
    : `<span class="balance-zero">${window.t?.("expense.settled") ?? "Settled up"}</span>`;

  // Per-parent paid breakdown
  function paidByParent(name) {
    return paidCards.reduce((sum, card) => {
      const isPrimary = card.author === name || card.assignee === name;
      const amt = expenseAmount(card.amount);
      return sum + (isPrimary ? amt : 0);
    }, 0);
  }
  const myPaid = paidByParent(myName);
  const coPaid = paidCards.reduce((sum, card) => sum + expenseAmount(card.amount), 0) - myPaid;

  const _t = window.t || ((k) => k);
  featureModule.innerHTML = `
    <section class="finance-hero">
      <div>
        <span>${_t("expense.total")}</span>
        <strong>${_sym} ${formatExpenseCurrency(total)}</strong>
        <p>${_t("expense.desc")}</p>
      </div>
      <div class="expense-hero-actions">
        <button class="primary-button" type="button" id="addExpenseButton">${_t("expense.add")}</button>
        <button class="secondary-button" type="button" id="exportExpensesButton">Export CSV</button>
      </div>
    </section>

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

  featureModule.querySelector("#addExpenseButton")?.addEventListener("click", () => openCardDialog());

  featureModule.querySelector("#expenseMonthSelect")?.addEventListener("change", (e) => {
    featureModule.dataset.expenseMonth = e.target.value;
    renderExpensesFeature();
  });

  featureModule.querySelector("#exportExpensesButton")?.addEventListener("click", () => {
    exportExpensesCSV(expenseCards, selectedMonth, _sym);
  });

  // Expense quick-action and request-payment buttons
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

function handleExpenseAction(cardId, action) {
  if (!cardId || !action) return;
  if (action === "request-payment") {
    // Open the card dialog focused on the payment panel
    if (typeof window.openCardDialog === "function") window.openCardDialog(cardId, "payment");
    return;
  }
  if (action === "paid" && typeof window.quickCompleteCard === "function") {
    window.quickCompleteCard(cardId);
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

async function renderMessagesFeature() {
  // Build sidebar with real unread counts
  const counts = await window.getUnreadCounts?.() || {};
  const topics = ["Schedule", "School", "Medical", "Expenses", "General"];

  featureModule.innerHTML = `
    <section class="slack-shell">
      <aside class="slack-sidebar" aria-label="Message topics">
        ${topics.map((t) => `
          <button class="slack-channel${t === activeMessageTopic ? " active" : ""}" type="button" data-message-tag="${t}">
            <span>${t}</span>
            ${counts[t] ? `<strong>${counts[t]}</strong>` : ""}
          </button>
        `).join("")}
      </aside>

      <section class="chat-panel" aria-label="Selected message thread">
        <header class="chat-header">
          <div>
            <span>${activeMessageTopic}</span>
            <strong>${window.t?.("msg.family_messages") ?? "Family messages"}</strong>
          </div>
        </header>

        <div class="message-list" id="messageList">
          <p class="chat-loading" style="padding:16px;color:var(--muted);font-size:13px;text-align:center;">${window.t?.("msg.loading") ?? "Loading messages..."}</p>
        </div>

        <form class="message-composer" id="messageComposer">
          <button class="composer-icon" type="button" aria-label="Attach card">+</button>
          <input id="messageInput" placeholder="${window.t?.("msg.placeholder", { topic: activeMessageTopic.toLowerCase() }) ?? `Message #${activeMessageTopic.toLowerCase()}`}" autocomplete="off" />
          <button class="composer-icon composer-mic" type="button" id="messageMicButton" aria-label="Dictate message">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
            </svg>
          </button>
          <button class="composer-send" type="submit">${window.t?.("msg.send") ?? "Send"}</button>
        </form>
      </section>
    </section>
  `;

  // Load and render real messages
  await loadAndRenderMessages(activeMessageTopic);

  // Topic switching
  featureModule.querySelectorAll(".slack-channel").forEach((button) => {
    button.addEventListener("click", async () => {
      featureModule.querySelectorAll(".slack-channel").forEach((item) => item.classList.toggle("active", item === button));
      activeMessageTopic = button.dataset.messageTag;
      featureModule.querySelector(".chat-header div span").textContent = activeMessageTopic;
      featureModule.querySelector("#messageInput").placeholder = window.t?.("msg.placeholder", { topic: activeMessageTopic.toLowerCase() }) ?? `Message #${activeMessageTopic.toLowerCase()}`;
      await loadAndRenderMessages(activeMessageTopic);
      window.applyCardTagFilter?.(activeMessageTopic);
    });
  });

  // Send message
  const composer = featureModule.querySelector("#messageComposer");
  const input = featureModule.querySelector("#messageInput");
  const mic = featureModule.querySelector("#messageMicButton");

  mic?.addEventListener("click", () => window.startDictationForField?.(input, {
    button: mic,
    success: "Message dictated",
    fallback: "Type your message instead.",
  }));

  composer.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    const userId = window.getCurrentUserId?.();

    // Optimistic render
    appendMessageToList({ body: text, sender_id: userId, created_at: new Date().toISOString() });

    // Save to Supabase
    const saved = await window.sendMessage?.(activeMessageTopic, text);
    if (!saved) showFeatureToast("Message could not be sent");
  });

  // Real-time subscription
  window.unsubscribeMessages?.();
  window.subscribeToMessages?.(activeMessageTopic, (msg) => {
    // Only append if not our own (we already did optimistic)
    if (msg.sender_id !== window.getCurrentUserId?.()) {
      appendMessageToList(msg);
    }
  });

  window.bindUnifiedCardInteractions?.(featureModule);
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
          const owner = getCustodyOwner(d);
          const dotColor = owner === "mine" ? custody.myColor : owner === "co" ? custody.coColor : "transparent";
          const evts = eventsForDate(k);
          const isSelected = k === calendarState.selected;
          return `<button class="custody-week-ov-day${isSelected ? " selected" : ""}" type="button" data-calendar-day="${k}" title="${weekdayLabel(d)} ${d.getDate()}">
            <span class="custody-week-ov-bar" style="background:${dotColor};opacity:${owner ? "1" : "0"};"></span>
            <span class="custody-week-ov-label">${weekdayLabel(d)}</span>
            <strong class="custody-week-ov-num">${d.getDate()}</strong>
            ${evts.length ? `<em class="custody-week-ov-count">${evts.length}</em>` : ""}
          </button>`;
        }).join("")}
      </div>
      ${weekHasOverrides ? `
        <div class="custody-propagate-row">
          <button class="ghost-button" type="button" id="propagateWeekBtn" style="font-size:12px;color:var(--muted);padding:4px 10px;">
            Apply this week's schedule to all weeks
          </button>
        </div>` : ""}`;
  })() : "";

  featureModule.innerHTML = `
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
      <div class="calendar-toolbar-row">
        <button class="custody-schedule-btn" type="button" id="openCustodyDialogBtn" aria-label="Edit parenting schedule">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" width="14" height="14"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>
          ${custody.enabled ? (window.t?.("cal.parenting_schedule") ?? "Parenting schedule") : (window.t?.("cal.set_up_schedule") ?? "Set up parenting schedule")}
        </button>
        ${custody.enabled ? `<button class="custody-schedule-btn custody-vacations-btn" type="button" id="openVacationsBtn" aria-label="Manage vacations">✈ Vacations${loadVacations().length ? ` <span class="vac-count-badge">${loadVacations().length}</span>` : ""}</button>` : ""}
      </div>
      <div class="calendar-body">
        ${renderCalendarBody()}
      </div>
    </div>

    <section class="calendar-agenda">
      <div class="agenda-heading">
        <div>
          <span>${window.t?.("cal.selected_day") ?? "Selected day"}</span>
          <strong>${formatAgendaDate(selectedDate)}</strong>
        </div>
        <button class="secondary-button feature-action" data-action="Add Do">${window.t?.("cal.add_do") ?? "Add Do"}</button>
      </div>
      ${weekOverview}
      ${custodyStrip}
      <div class="agenda-list">
        ${selectedEvents.length
          ? selectedEvents.map(renderAgendaCard).join("")
          : `<article class="agenda-empty">${window.t?.("cal.no_dos") ?? "No Dos on this day."}</article>`}
      </div>
    </section>
  `;

  featureModule.querySelectorAll(".feature-action").forEach((button) => {
    button.addEventListener("click", () => {
      addCalendarEvent();
      showFeatureToast(window.t?.("cal.toast_do_added") ?? "Do added to selected day");
    });
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

  // Open custody schedule dialog
  featureModule.querySelector("#openCustodyDialogBtn")?.addEventListener("click", () => openCustodyScheduleDialog());

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

  // Open vacations dialog (toolbar button + "Manage" link inside vacation banner)
  featureModule.querySelectorAll("#openVacationsBtn").forEach((btn) => {
    btn.addEventListener("click", () => openVacationsDialog());
  });

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
        setCustodyDayOverride(cr.requestedDate, cr.requestedOwner);
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

  window.bindUnifiedCardInteractions?.(featureModule);
}

function renderCalendarBody() {
  if (calendarState.view === "day") return renderDayView();
  if (calendarState.view === "week") return renderWeekView();
  return renderMonthView();
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
  return `
    <div class="week-strip">
      ${Array.from({ length: 7 }, (_, index) => {
        const date = addDays(start, index);
        const key = toCalendarKey(date);
        const events = eventsForDate(key);
        const weekDayConflicts = getConflictsForDate(key, _getActiveConflicts());
        const conflictTag = weekDayConflicts.length ? ` <span class="week-conflict-dot">⚠</span>` : "";
        const custodyWeekClass = getCustodyClass(date);
        return `
          <button class="week-day ${key === calendarState.selected ? "selected" : ""}${weekDayConflicts.length ? " has-conflict" : ""}${custodyWeekClass ? " " + custodyWeekClass : ""}" type="button" data-calendar-day="${key}">
            <span>${weekdayLabel(date)}</span>
            <strong>${date.getDate()}${conflictTag}</strong>
            <em>${events.length ? `${events.length} ${window.t?.("cal.item") ?? "item"}${events.length === 1 ? "" : (window.t?.("cal.item_s") ?? "s")}` : (window.t?.("cal.clear") ?? "Clear")}</em>
          </button>
        `;
      }).join("")}
    </div>
    ${renderDaySchedule(calendarState.selected)}
  `;
}

function renderDayView() {
  return `
    <div class="day-heading">
      <span>${weekdayLabel(parseCalendarKey(calendarState.selected))}</span>
      <strong>${formatAgendaDate(parseCalendarKey(calendarState.selected))}</strong>
    </div>
    ${renderDaySchedule(calendarState.selected)}
  `;
}

function renderDaySchedule(key) {
  const events = eventsForDate(key);
  const conflicts = getConflictsForDate(key, _getActiveConflicts());

  if (!events.length) {
    return `<div class="day-schedule"><article class="agenda-empty">No events on this day.</article></div>`;
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
  const newOwnerLabel = cr.requestedOwner === "mine" ? "Your day" : `${coparentName}'s day`;
  const statusColors = { pending: "#f59e0b", approved: "#22c55e", declined: "#ef4444" };
  const statusColor = statusColors[cr.status] || "#999";
  const statusLabel = cr.status === "pending" ? "Pending" : cr.status === "approved" ? "Approved" : "Declined";
  return `
    <article class="change-request-card" data-cr-id="${escapeHtml(cr.id)}">
      <div class="change-request-header">
        <span class="change-request-label">↔ Change request</span>
        <span class="change-request-status" style="color:${statusColor};">${statusLabel}</span>
      </div>
      <div class="change-request-body">
        <strong>Propose: ${escapeHtml(newOwnerLabel)}</strong>
        ${cr.reason ? `<span class="change-request-reason">${escapeHtml(cr.reason)}</span>` : ""}
      </div>
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

function renderAgendaCard(item) {
  if (item.kind === "change-request") return renderChangeRequestAgendaItem(item.changeRequest);
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

function openVacationsDialog() {
  document.getElementById("vacationsDialog")?.remove();
  const custody = getCustodySchedule();
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";
  const vacations = loadVacations();

  const dialog = document.createElement("dialog");
  dialog.id = "vacationsDialog";
  dialog.className = "custody-schedule-dialog";
  dialog.innerHTML = `
    <div class="custody-dialog-body" style="max-width:440px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:16px;">✈ Vacation schedules</h3>
        <button class="ghost-button" type="button" id="closeVacationsDialog" style="font-size:20px;line-height:1;padding:4px 10px;">✕</button>
      </div>
      <p style="font-size:12px;color:var(--muted);margin:0 0 14px;">Vacation periods override the normal custody schedule without destroying it. After the vacation, the regular schedule resumes automatically.</p>
      <div id="vacationsList" style="margin-bottom:16px;">
        ${vacations.length === 0 ? `<p style="font-size:13px;color:var(--muted);text-align:center;padding:12px 0;">No vacations added yet.</p>` : vacations.map((v) => {
          const ownerLabel = v.owner === "mine" ? "Your days" : v.owner === "co" ? `${escapeHtml(coparentName)}'s days` : `Alternating weeks (starts with ${v.alternatingStart === "mine" ? "you" : escapeHtml(coparentName)})`;
          return `<div class="vacation-list-item">
            <div class="vacation-list-info">
              <strong>${escapeHtml(v.name || "Vacation")}</strong>
              <span>${v.startDate} - ${v.endDate}</span>
              <span class="vacation-list-owner">${ownerLabel}</span>
            </div>
            <button class="custody-chip custody-chip-reset" type="button" data-vac-delete="${v.id}" style="font-size:11px;padding:3px 10px;flex-shrink:0;">Remove</button>
          </div>`;
        }).join("")}
      </div>
      <details class="vacation-add-details">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--accent);padding:8px 0;">+ Add vacation period</summary>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">
          <label class="clean-field">
            <span>Name</span>
            <input type="text" id="vacName" placeholder='e.g. "Summer 2026"' />
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <label class="clean-field">
              <span>Start date</span>
              <input type="date" id="vacStart" />
            </label>
            <label class="clean-field">
              <span>End date</span>
              <input type="date" id="vacEnd" />
            </label>
          </div>
          <label class="clean-field">
            <span>Who has the kids?</span>
            <select id="vacOwner">
              <option value="mine">Your days (whole period)</option>
              <option value="co">${escapeHtml(coparentName)}'s days (whole period)</option>
              <option value="alternating">Alternating weeks</option>
            </select>
          </label>
          <label class="clean-field" id="vacAlternatingRow" style="display:none;">
            <span>First week starts with</span>
            <select id="vacAlternatingStart">
              <option value="mine">You</option>
              <option value="co">${escapeHtml(coparentName)}</option>
            </select>
          </label>
          <button class="primary-button" type="button" id="saveVacationBtn">Add vacation</button>
        </div>
      </details>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.querySelector("#closeVacationsDialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  dialog.querySelector("#vacOwner").addEventListener("change", (e) => {
    dialog.querySelector("#vacAlternatingRow").style.display = e.target.value === "alternating" ? "block" : "none";
  });

  dialog.querySelectorAll("[data-vac-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      saveVacations(loadVacations().filter((v) => v.id !== btn.dataset.vacDelete));
      dialog.close();
      openVacationsDialog();
      // data is available from outer renderCalendarFeature scope
      if (typeof renderCalendarFeature === "function" && typeof data !== "undefined") renderCalendarFeature(data);
    });
  });

  dialog.querySelector("#saveVacationBtn").addEventListener("click", () => {
    const name = (dialog.querySelector("#vacName").value.trim()) || "Vacation";
    const startDate = dialog.querySelector("#vacStart").value;
    const endDate = dialog.querySelector("#vacEnd").value;
    const owner = dialog.querySelector("#vacOwner").value;
    const alternatingStart = dialog.querySelector("#vacAlternatingStart").value;
    if (!startDate || !endDate) { showFeatureToast("Please enter start and end dates"); return; }
    if (endDate < startDate) { showFeatureToast("End date must be after start date"); return; }
    saveVacations([...loadVacations(), { id: "vac-" + Date.now(), name, startDate, endDate, owner, alternatingStart }]);
    dialog.close();
    if (typeof renderCalendarFeature === "function" && typeof data !== "undefined") renderCalendarFeature(data);
    showFeatureToast("Vacation added");
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
    <div class="custody-dialog-body" style="max-width:380px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:16px;">↔ Request schedule change</h3>
        <button class="ghost-button" type="button" id="closeCrDialog" style="font-size:20px;line-height:1;padding:4px 10px;">✕</button>
      </div>
      <label class="clean-field" style="margin-bottom:10px;">
        <span>Date</span>
        <input type="date" id="crDate" value="${selectedDateKey}" />
      </label>
      <label class="clean-field" style="margin-bottom:10px;">
        <span>Propose new owner</span>
        <select id="crRequestedOwner">
          <option value="mine"${currentOwner !== "mine" ? " selected" : ""}>You take this day</option>
          <option value="co"${currentOwner === "mine" ? " selected" : ""}>${escapeHtml(coparentName)} takes this day</option>
        </select>
      </label>
      <label class="clean-field" style="margin-bottom:16px;">
        <span>Reason (optional)</span>
        <input type="text" id="crReason" placeholder="e.g. Doctor appointment, work travel..." />
      </label>
      <button class="primary-button" type="button" id="saveCrBtn" style="width:100%;">Save request</button>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.querySelector("#closeCrDialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  dialog.querySelector("#saveCrBtn").addEventListener("click", () => {
    const requestedDate = dialog.querySelector("#crDate").value;
    const requestedOwner = dialog.querySelector("#crRequestedOwner").value;
    const reason = dialog.querySelector("#crReason").value.trim();
    if (!requestedDate) { showFeatureToast("Please select a date"); return; }
    const cr = { id: "cr-" + Date.now(), createdAt: new Date().toISOString(), requestedDate, currentOwner: currentOwner || "", requestedOwner, reason, status: "pending" };
    saveChangeRequests([...loadChangeRequests(), cr]);
    dialog.close();
    if (typeof calendarState !== "undefined") calendarState.selected = requestedDate;
    if (typeof renderCalendarFeature === "function" && typeof data !== "undefined") renderCalendarFeature(data);
    showFeatureToast("Change request saved");
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

function eventsForDate(key) {
  const regular = calendarState.events.filter((item) => item.date === key).sort((a, b) => a.time.localeCompare(b.time));
  const crItems = loadChangeRequests()
    .filter((cr) => cr.requestedDate === key)
    .map((cr) => ({ kind: "change-request", date: key, time: "All day", cardId: cr.id, changeRequest: cr }));
  return [...crItems, ...regular];
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
  const gcalEvents = (window.getGoogleCalendarEvents?.() || []).map((item) => {
    const date = new Date(item.start);
    const isBusy = item.source === "work" || item.source === "personal"
      || item.source === "coparent-work" || item.source === "apple-work";
    return {
      cardId: item.id,
      date: toCalendarKey(date),
      time: item.allDay ? (window.t?.("cal.all_day") ?? "All day") : date.toLocaleTimeString(_getDateLocale(), { hour: "2-digit", minute: "2-digit", hour12: false }),
      title: isBusy ? "Busy" : item.title,
      detail: isBusy ? "Private calendar - details hidden" : (item.description || "Family calendar"),
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

function startOfWeek(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
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
    const leadTimes = [
      ["15", "15 minutes before"],
      ["60", "1 hour before"],
      ["120", "2 hours before"],
      ["1440", "1 day before"],
      ["10080", "1 week before"],
      ["at-due", "At due time"],
    ];
    return `
      ${part === "all" || part === "custody" ? (() => {
        const cs = getCustodySchedule();
        const swatchRow = (target, currentColor, label) => `
          <div class="settings-select-row">
            <span>
              <strong>${label}</strong>
            </span>
            <div class="custody-color-swatches" data-custody-target="${target}">
              ${CUSTODY_COLORS.map(c => `<button type="button" class="custody-swatch${cs[target] === c.value ? " active" : ""}" data-custody-color="${c.value}" style="background:${c.value};" title="${c.label}" aria-label="${c.label}"></button>`).join("")}
            </div>
          </div>`;
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
            <label class="settings-select-row">
              <span>
                <strong>${_ct("custody.type")}</strong>
                <em>${_ct("custody.type_hint")}</em>
              </span>
              <select id="custodyType">
                <option value="7-7" ${cs.type === "7-7" ? "selected" : ""}>${_ct("custody.7_7")}</option>
                <option value="2-2-3" ${cs.type === "2-2-3" ? "selected" : ""}>${_ct("custody.2_2_3")}</option>
                <option value="5-2" ${cs.type === "5-2" ? "selected" : ""}>${_ct("custody.5_2")}</option>
              </select>
            </label>
            <label class="settings-select-row" id="custodyRefDateRow" ${cs.type === "5-2" ? 'style="display:none"' : ""}>
              <span>
                <strong>${_ct("custody.starts")}</strong>
                <em>${_ct("custody.starts_hint")}</em>
              </span>
              <input type="date" id="custodyReferenceDate" value="${cs.referenceDate || new Date().toISOString().slice(0,10)}" style="max-width:160px;" />
            </label>
            ${swatchRow("myColor", cs.myColor, _ct("custody.my_color"))}
            ${swatchRow("coColor", cs.coColor, _ct("custody.co_color"))}
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
              <option value="calendar-only" ${automation.reminderDelivery === "calendar-only" ? "selected" : ""}>${_at("auto.delivery_cal_only")}</option>
              <option value="calendar-and-app" ${automation.reminderDelivery !== "calendar-only" ? "selected" : ""}>${_at("auto.delivery_cal_app")}</option>
            </select>
          </label>
        </div>
      </section>
      <section class="feature-panel google-calendar-connection">
        <div class="feature-panel-header">
          <h3>${_at("auto.cal_connections")}</h3>
          <button class="secondary-button feature-action" data-action="Connect family calendar">${_at("auto.connect_btn")}</button>
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
  // Pull live vaccine cards from state
  const allCards = typeof window.getCards === "function" ? window.getCards() : [];
  const vaccineCards = allCards
    .filter((c) => c.type === "Vaccine" && c.status !== "Done" && !c.deleted_at)
    .sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);

  const rows = vaccineCards.length
    ? vaccineCards.map((c) => {
        const dueStr = c.due
          ? new Date(c.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
          : "No date";
        return `
          <div class="budget-row vaccine-row" data-vaccine-card="${c.id}" role="button" tabindex="0" style="cursor:pointer;">
            <span>
              <strong>${escapeHtml(c.title)}</strong>
              <em>Due ${dueStr}${c.details ? " · " + escapeHtml(c.details.substring(0, 40)) : ""}</em>
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
        <button class="secondary-button" type="button" id="addVaccineBtn">${_vt("vaccine.add", "+ Add vaccine")}</button>
      </div>
      <div class="budget-list" id="vaccineCardList">
        ${rows}
      </div>
    </section>
  `;
}

function bindVaccinePanel() {
  const section = document.getElementById("vaccinePanelSection");
  if (!section) return;

  // Add vaccine - open card dialog with Vaccine type + Medical topic prefilled
  section.querySelector("#addVaccineBtn")?.addEventListener("click", () => {
    if (typeof openCardDialog === "function") {
      openCardDialog("", "info", { type: "Vaccine", topic: "Medical" });
    }
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
  featureModule.innerHTML = `
    <div class="feature-layout settings-layout">
      ${renderSpecialPanel("settings", "automation")}

      <section class="feature-panel">
        <h3>${_st("settings.your_profile")}</h3>
        <div class="feature-items">
          <article class="feature-item feature-item-editable">
            <div class="feature-item-main">
              <strong>${escapeHtml(myName || _st("settings.your_profile"))}</strong>
              <span style="color:var(--muted);font-size:12px;">${_st("settings.display_name")}</span>
            </div>
            <button class="icon-button icon-button-sm" id="editMyNameBtn" aria-label="Edit your name">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M11.5 2.5a1.5 1.5 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5Z"/>
              </svg>
            </button>
          </article>
          ${coparentName ? `
          <article class="feature-item feature-item-editable">
            <div class="feature-item-main">
              <strong>${escapeHtml(coparentName)}</strong>
              <span style="color:var(--muted);font-size:12px;">${_st("settings.coparent_name")}</span>
            </div>
            <button class="icon-button icon-button-sm" id="editCoparentNameBtn" aria-label="Edit co-parent name">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M11.5 2.5a1.5 1.5 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5Z"/>
              </svg>
            </button>
          </article>` : ""}
        </div>
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

      <section class="feature-panel" id="invitePanel">
        <h3>${_st("settings.coparent")}</h3>
        <div class="feature-items" id="invitePanelContent">
          <p class="feature-empty" style="font-size:13px;color:var(--muted);">${_st("settings.checking")}</p>
        </div>
      </section>

      <section class="feature-panel" id="subscriptionPanel">
        <h3>${_st("settings.subscription")}</h3>
        <div class="feature-items" id="subscriptionPanelContent">
          <p class="feature-empty" style="font-size:13px;color:var(--muted);">${_st("settings.loading")}</p>
        </div>
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
          <button class="secondary-button" id="downloadMyDataButton">${_st("settings.download_data")}</button>
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

  // Edit my name
  featureModule.querySelector("#editMyNameBtn")?.addEventListener("click", () => promptEditMyName());
  featureModule.querySelector("#editCoparentNameBtn")?.addEventListener("click", () => promptEditCoparentName());

  // Add child/pet
  featureModule.querySelector("#addChildBtn")?.addEventListener("click", () => promptAddChild());
  featureModule.querySelector("#addPetBtn")?.addEventListener("click", () => promptAddPet());

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
      const session = (await window.supabaseClient?.auth?.getSession())?.data?.session;
      const token = session?.access_token;
      if (!token) { showFeatureToast("Sign in required"); return; }

      const res = await fetch("/api/export-data", {
        headers: { "Authorization": `Bearer ${token}` },
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

  // Co-parent invite panel
  renderInvitePanel();

  // Notification preferences panel
  renderNotifPrefsPanel();

  // Vaccine panel interactions
  bindVaccinePanel();

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
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

async function renderSubscriptionPanel() {
  const panel = featureModule.querySelector("#subscriptionPanelContent");
  if (!panel) return;

  const _st = window.t || ((k, fb) => fb || k);
  const { status, periodEnd } = window.getSubscriptionStatus?.() || { status: "free", periodEnd: null };
  const paid = ["active", "trialing"].includes(status);

  const statusLabel = {
    free:     _st("sub.free",     "Free plan"),
    trialing: _st("sub.trial",    "Family - free trial"),
    active:   _st("sub.active",   "Family"),
    past_due: _st("sub.past_due", "Family - payment past due"),
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
        <button class="primary-button" id="upgradeSubBtn">${_st("sub.upgrade_btn", "Upgrade to Family")} - ${LOCALE_CONFIG.monthlyPrice}/mo</button>
      </article>
    `;
    panel.querySelector("#upgradeSubBtn")?.addEventListener("click", () => {
      window.showUpgradePrompt?.("Upgrade to Do-Do Family for unlimited Dos and all features.");
    });
  }
}

async function renderInvitePanel() {
  const panel = featureModule.querySelector("#invitePanelContent");
  if (!panel) return;

  // Co-parent invite is a paid feature (free plan = single user only)
  if (!window.isPaidUser?.()) {
    const _it = window.t || ((k) => k);
    panel.innerHTML = `
      <article class="feature-item">
        <div>
          <strong style="display:block;margin-bottom:4px;">${_it("invite.heading")}</strong>
          <span style="color:var(--muted);font-size:13px;">${_it("invite.paid_desc")}</span>
        </div>
        <button class="secondary-button" id="inviteUpgradeBtn" style="white-space:nowrap;">${_it("invite.upgrade")}</button>
      </article>
    `;
    panel.querySelector("#inviteUpgradeBtn")?.addEventListener("click", () => {
      window.showUpgradePrompt?.("Co-parent collaboration is available on the Family plan.");
    });
    return;
  }

  const hasPair = Boolean(window.getCurrentPairId?.());
  const setup = window.getOnboardingState?.() || {};
  const coparentName = setup.parents?.coparent || "Co-parent";
  const inviteEmail = setup.parents?.invite || "";

  if (hasPair) {
    // Check if parent B has actually joined (pair has parent_b set)
    const pairStatus = await window.supabaseClient
      ?.from("pairs")
      .select("parent_b, accepted_at")
      .eq("id", window.getCurrentPairId())
      .maybeSingle()
      .then(({ data }) => data)
      .catch(() => null);

    if (pairStatus?.parent_b) {
      panel.innerHTML = `
        <article class="feature-item">
          <strong>${escapeHtml(coparentName)}</strong>
          <span style="color:#0ea58f;">Connected - on the same board</span>
        </article>
      `;
      return;
    }
  }

  // Co-parent hasn't joined yet - show invite options
  // Try sessionStorage first; fall back to fetching invite_token from the pair record
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

  const _ipt = window.t || ((k) => k);
  panel.innerHTML = `
    <article class="feature-item">
      <strong>${escapeHtml(coparentName || _ipt("settings.coparent"))}</strong>
      <span>${_ipt("settings.not_joined")}${inviteEmail ? ` - ${escapeHtml(inviteEmail)}` : ""}</span>
    </article>
    ${pendingLink ? `
    <div style="display:grid;gap:8px;">
      <label style="display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:800;">
        ${_ipt("settings.pending_invite")}
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="settingsInviteInput" readonly value="${escapeHtml(pendingLink)}"
            style="flex:1;min-width:0;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12px;background:var(--soft);color:var(--ink);" />
          <button id="settingsInviteCopy" class="secondary-button" style="white-space:nowrap;min-height:36px;padding:0 12px;font-size:12px;">${_ipt("settings.copy_link")}</button>
        </div>
      </label>
      ${inviteEmail ? `<button id="settingsResendEmail" class="secondary-button" style="justify-self:start;min-height:36px;padding:0 14px;font-size:12px;">${_ipt("settings.resend")}</button>` : ""}
    </div>
    ` : inviteEmail ? `
    <button id="settingsResendEmail" class="secondary-button" style="justify-self:start;min-height:36px;padding:0 14px;font-size:12px;">${_ipt("settings.resend")}</button>
    ` : `
    <p style="margin:0;font-size:13px;color:var(--muted);">${_ipt("invite.no_email")}</p>
    `}
  `;

  panel.querySelector("#settingsInviteCopy")?.addEventListener("click", () => {
    navigator.clipboard.writeText(pendingLink).then(() => {
      panel.querySelector("#settingsInviteCopy").textContent = _ipt("settings.copied");
    }).catch(() => panel.querySelector("#settingsInviteInput")?.select());
  });

  panel.querySelector("#settingsResendEmail")?.addEventListener("click", async () => {
    const btn = panel.querySelector("#settingsResendEmail");
    btn.disabled = true;
    btn.textContent = window.t?.("invite.sending") ?? "Sending...";
    try {
      const link = pendingLink || `${window.location.origin}/invite/unknown`;
      const res = await fetch("/api/invite-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await window.getAuthHeader()) },
        body: JSON.stringify({
          toEmail: inviteEmail,
          fromName: setup.parents?.primary || null,
          inviteLink: link,
        }),
      });
      const data = res.ok ? await res.json() : {};
      if (data.sent) {
        btn.textContent = "Sent!";
        showFeatureToast(`Invite re-sent to ${inviteEmail}`);
      } else {
        btn.textContent = "Re-send email";
        btn.disabled = false;
        showFeatureToast("Email not configured - share the link manually");
      }
    } catch {
      btn.textContent = "Re-send email";
      btn.disabled = false;
      showFeatureToast("Could not send - share the link manually");
    }
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
      <div style="width:100%;">
        <strong style="display:block;margin-bottom:8px;">Quiet hours</strong>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <label style="font-size:13px;color:var(--muted);">From
            <input type="time" id="notifQuietFrom" value="${prefs.quiet_from || "22:00"}" style="margin-left:6px;font-size:13px;border:1px solid var(--border);border-radius:8px;padding:4px 8px;background:var(--input-bg,var(--card-bg));color:var(--text);">
          </label>
          <label style="font-size:13px;color:var(--muted);">To
            <input type="time" id="notifQuietTo" value="${prefs.quiet_to || "07:00"}" style="margin-left:6px;font-size:13px;border:1px solid var(--border);border-radius:8px;padding:4px 8px;background:var(--input-bg,var(--card-bg));color:var(--text);">
          </label>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:6px 0 0;">No reminders sent during quiet hours.</p>
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
    const quietFrom = document.getElementById("notifQuietFrom")?.value || "22:00";
    const quietTo = document.getElementById("notifQuietTo")?.value || "07:00";
    const newPrefs = { email: emailOn, push: pushOn, quiet_from: quietFrom, quiet_to: quietTo };

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
      await window.supabaseClient
        .from("profiles")
        .update({ notification_prefs: newPrefs })
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
