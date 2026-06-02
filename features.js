const today = new Date();
const shoppingStorageKey = "do-do-shopping-lists-v1";
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
    switchModule(button.dataset.module);
    document.body.classList.remove("show-mobile-menu");
  });
});

function switchModule(moduleName) {
  moduleLinks.forEach((button) => button.classList.toggle("active", button.dataset.module === moduleName));
  window.setMobileActive?.(moduleName);

  if (moduleName === "board") {
    cardsModule.classList.remove("hidden");
    cardsModule.classList.remove("cards-content-hidden");
    featureModule.classList.add("hidden");
    topbarEyebrow.textContent = "";
    topbarTitle.textContent = "";
    document.querySelector(".topbar-title").style.display = "none";
    topbarActions?.classList.remove("hidden");
    return;
  }

  const data = featureData[moduleName];
  cardsModule.classList.remove("hidden");
  cardsModule.classList.add("cards-content-hidden");
  featureModule.classList.remove("hidden");
  topbarEyebrow.textContent = data.eyebrow;
  topbarTitle.textContent = data.title;
  document.querySelector(".topbar-title").style.display = "none";
  topbarActions?.classList.add("hidden");
  renderFeature(moduleName, data);
}

window.switchModule = switchModule;

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
    switchModule("settings");
  };
  autoRemindersToggle?.addEventListener("change", save);
  familyCalendarToggle?.addEventListener("change", save);
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
      switchModule("settings");
    });
  });
  themePreference?.addEventListener("change", () => {
    window.updateThemePreference?.(themePreference.value);
    showFeatureToast("Appearance updated");
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
}

function _renderShoppingBoard(lists) {
  const board = featureModule.querySelector("#shoppingBoard") || featureModule;
  board.innerHTML = `
    ${renderShoppingGroup("groceries", "Groceries", lists.groceries)}
    ${renderShoppingGroup("other", "Other", lists.other)}
  `;

  board.querySelectorAll("[data-shopping-check]").forEach((input) => {
    input.addEventListener("change", async () => {
      const id = input.dataset.shoppingCheck;
      const listKey = input.dataset.shoppingList;
      if (id.startsWith(listKey + "-")) {
        // localStorage item
        const nextLists = loadShoppingLists();
        const list = nextLists[listKey] || [];
        const item = list.find((e) => e.id === id);
        if (item) { item.bought = input.checked; saveShoppingLists(nextLists); }
      } else {
        // Supabase item
        await window.toggleShoppingItem?.(id, input.checked);
      }
      showFeatureToast(input.checked ? "Marked as bought" : "Returned to list");
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

      // Try Supabase, fall back to localStorage
      const saved = await window.addShoppingItem?.(listKey, label);
      if (saved) {
        const refreshed = await window.loadShoppingItems?.();
        if (refreshed) { _renderShoppingBoard(refreshed); return; }
      }
      // localStorage fallback
      const nextLists = loadShoppingLists();
      const list = nextLists[listKey] || [];
      list.push({ id: `${listKey}-${Date.now()}`, label, bought: false });
      nextLists[listKey] = list;
      saveShoppingLists(nextLists);
      _renderShoppingBoard(nextLists);
      showFeatureToast(`Added to ${listKey === "groceries" ? "Groceries" : "Other"}`);
    });
  });
}

function renderShoppingGroup(key, title, items) {
  const remaining = items.filter((item) => !item.bought).length;
  return `
    <section class="feature-panel shopping-group">
      <div class="shopping-group-header">
        <h3>${title}</h3>
        <span>${remaining} left</span>
      </div>
      <div class="shopping-list">
        ${items.map((item) => `
          <label class="shopping-row ${item.bought ? "bought" : ""}">
            <input type="checkbox" data-shopping-list="${key}" data-shopping-check="${item.id}" ${item.bought ? "checked" : ""} />
            <strong>${escapeFeatureHtml(item.label)}</strong>
            ${item.bought && item.boughtBy ? renderShoppingBuyer(item.boughtBy) : ""}
          </label>
        `).join("")}
      </div>
      <form class="shopping-capture" data-shopping-add-form="${key}">
        <input data-shopping-input placeholder="Add or dictate an item" autocomplete="off" />
        <button class="shopping-mic" type="button" data-shopping-mic aria-label="Dictate ${title} item" title="Dictate item">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
          </svg>
        </button>
        <button class="shopping-add" type="submit" aria-label="Add ${title} item">+</button>
      </form>
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
  const expenseCards = (typeof state !== "undefined" ? state.cards : [])
    .filter((card) => card.type === "Expense" || card.topic === "Expenses")
    .sort((a, b) => new Date(a.due || 0) - new Date(b.due || 0));
  const total = expenseCards.reduce((sum, card) => sum + expenseAmount(card.amount), 0);
  const openCards = expenseCards.filter((card) => card.status !== "Done");
  const paidCards = expenseCards.filter((card) => card.status === "Done");
  featureModule.innerHTML = `
    <section class="finance-hero">
      <div>
        <span>Expense total</span>
        <strong>CHF ${formatExpenseCurrency(total)}</strong>
        <p>Every expense is a normal Do with its discussion, people, date, and status attached.</p>
      </div>
      <button class="primary-button" type="button" id="addExpenseButton">Add expense</button>
    </section>

    <section class="expense-summary-panel">
      <div class="expense-summary-row">
        <span>All expenses</span>
        <strong>${expenseCards.length}</strong>
      </div>
      <div class="expense-summary-row">
        <span>Open</span>
        <strong>${openCards.length} · CHF ${formatExpenseCurrency(openCards.reduce((sum, card) => sum + expenseAmount(card.amount), 0))}</strong>
      </div>
      <div class="expense-summary-row">
        <span>Paid</span>
        <strong>${paidCards.length} · CHF ${formatExpenseCurrency(paidCards.reduce((sum, card) => sum + expenseAmount(card.amount), 0))}</strong>
      </div>
    </section>

    <section class="upcoming-expenses">
      <div class="agenda-heading">
        <div>
          <span>Cards</span>
          <strong>Expenses</strong>
        </div>
      </div>
      <div class="upcoming-expense-list">
        ${expenseCards.length
          ? expenseCards.map((card) => renderExpenseCard(card)).join("")
          : `<article class="agenda-empty">No expense Dos yet.</article>`}
      </div>
    </section>
  `;

  featureModule.querySelector("#addExpenseButton")?.addEventListener("click", () => openCardDialog());

  // Expense quick-action buttons
  featureModule.querySelectorAll("[data-expense-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const { cardId, expenseAction } = btn.dataset;
      handleExpenseAction(cardId, expenseAction);
    });
  });

  window.bindUnifiedCardInteractions?.(featureModule);
}

function renderExpenseCard(card) {
  const isDone = card.status === "Done" || card.status === "Paid";
  const isDisputed = card.status === "Disputed";
  const statusLabel = card.status === "Paid" ? "Paid" : card.status === "Disputed" ? "Disputed" : card.status;
  const amount = card.amount ? `<span class="expense-amount">${card.amount}</span>` : "";

  const actions = isDone ? "" : `
    <div class="expense-card-actions">
      ${!isDisputed ? `<button class="expense-action-btn approve" data-expense-action="approve" data-card-id="${card.id}">Approve</button>` : ""}
      ${!isDisputed ? `<button class="expense-action-btn dispute" data-expense-action="dispute" data-card-id="${card.id}">Dispute</button>` : ""}
      <button class="expense-action-btn paid" data-expense-action="paid" data-card-id="${card.id}">Mark paid</button>
    </div>
  `;

  return `
    <article class="expense-preview-card" data-card-id="${card.id}">
      <div class="expense-card-top">
        <div>
          <strong class="expense-card-title">${card.title || "Expense"}</strong>
          ${card.details ? `<span class="expense-card-detail">${card.details}</span>` : ""}
        </div>
        <div class="expense-card-meta">
          ${amount}
          <span class="expense-status-badge expense-status-${(statusLabel || "").toLowerCase().replace(/\s/g, "-")}">${statusLabel}</span>
        </div>
      </div>
      ${actions}
    </article>
  `;
}

function handleExpenseAction(cardId, action) {
  if (!cardId || !action) return;
  const nextStatus = action === "approve" ? "To Do" : action === "dispute" ? "Disputed" : "Paid";
  // Use app.js updateCardStatus if available, otherwise call quickCompleteCard / quickRespondCard
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
            <strong>Family messages</strong>
          </div>
        </header>

        <div class="message-list" id="messageList">
          <p class="chat-loading" style="padding:16px;color:var(--muted);font-size:13px;text-align:center;">Loading messages...</p>
        </div>

        <form class="message-composer" id="messageComposer">
          <button class="composer-icon" type="button" aria-label="Attach card">+</button>
          <input id="messageInput" placeholder="Message #${activeMessageTopic.toLowerCase()}" autocomplete="off" />
          <button class="composer-icon composer-mic" type="button" id="messageMicButton" aria-label="Dictate message">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
            </svg>
          </button>
          <button class="composer-send" type="submit">Send</button>
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
      featureModule.querySelector("#messageInput").placeholder = `Message #${activeMessageTopic.toLowerCase()}`;
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
        <div class="message-meta"><strong>${name}</strong><span>${time}</span></div>
        <p>${msg.body}</p>
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
  syncCalendarEventsFromCards();
  const selectedDate = parseCalendarKey(calendarState.selected);
  const selectedEvents = eventsForDate(calendarState.selected);
  featureModule.innerHTML = `
    <div class="calendar-shell">
      <div class="calendar-privacy-note">
        <strong>Private family calendar</strong>
        <span>Only family members can see Dos. Connected work calendars show blocked availability only.</span>
      </div>
      <div class="calendar-topline">
        <button class="round-nav" type="button" data-calendar-nav="-1" aria-label="Previous ${calendarState.view === "month" ? "month" : "week"}">‹</button>
        <div>
          <span class="calendar-kicker">${calendarState.view}</span>
          <strong>${formatMonthYear(calendarState.cursor)}</strong>
        </div>
        <button class="round-nav" type="button" data-calendar-nav="1" aria-label="Next ${calendarState.view === "month" ? "month" : "week"}">›</button>
      </div>
      <div class="calendar-view-switcher" aria-label="Calendar views">
        ${["month", "week", "day"].map((view) => `
          <button class="${calendarState.view === view ? "active" : ""}" type="button" data-calendar-view="${view}">${capitalize(view)}</button>
        `).join("")}
      </div>
      <div class="calendar-body">
        ${renderCalendarBody()}
      </div>
    </div>

    <section class="calendar-agenda">
      <div class="agenda-heading">
        <div>
          <span>Selected day</span>
          <strong>${formatAgendaDate(selectedDate)}</strong>
        </div>
        <button class="secondary-button feature-action" data-action="Add Do">Add Do</button>
      </div>
      <div class="agenda-list">
        ${selectedEvents.length
          ? selectedEvents.map(renderAgendaCard).join("")
          : `<article class="agenda-empty">No Dos on this day.</article>`}
      </div>
    </section>
  `;

  featureModule.querySelectorAll(".feature-action").forEach((button) => {
    button.addEventListener("click", () => {
      addCalendarEvent();
      showFeatureToast("Do added to selected day");
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

  window.bindUnifiedCardInteractions?.(featureModule);
}

function renderCalendarBody() {
  if (calendarState.view === "day") return renderDayView();
  if (calendarState.view === "week") return renderWeekView();
  return renderMonthView();
}

function renderMonthView() {
  return `
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
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = new Date(year, month, day);
    const key = toCalendarKey(date);
    const events = eventsForDate(key);
    const classes = ["calendar-day", key === calendarState.selected ? "selected" : "", events.length ? "has-marker" : ""].filter(Boolean).join(" ");
    const dots = events.slice(0, 3).map((item) => `<i class="${item.kind}"></i>`).join("");
    return `<button class="${classes}" type="button" data-calendar-day="${key}"><strong>${day}</strong><span>${dots}</span></button>`;
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
        return `
          <button class="week-day ${key === calendarState.selected ? "selected" : ""}" type="button" data-calendar-day="${key}">
            <span>${weekdayLabel(date)}</span>
            <strong>${date.getDate()}</strong>
            <em>${events.length ? `${events.length} item${events.length === 1 ? "" : "s"}` : "Clear"}</em>
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
  return `
    <div class="day-schedule">
      ${["08:00", "10:00", "12:00", "15:00", "17:00"].map((slot) => {
        const slotEvents = events.filter((item) => item.time.startsWith(slot.slice(0, 2)));
        return `
          <div class="day-slot">
            <span>${slot}</span>
            <div>
              ${slotEvents.length
                ? slotEvents.map(renderAgendaCard).join("")
                : `<em>Available</em>`}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderAgendaCard(item) {
  if (item.privateBlock) {
    return `
      <article class="calendar-busy-card">
        <span>${item.time}</span>
        <strong>Busy</strong>
        <em>Private work calendar · details hidden</em>
      </article>
    `;
  }
  const sourceCard = typeof state !== "undefined" ? state.cards.find((card) => card.id === item.cardId) : null;
  if (!sourceCard) return "";
  return renderUniversalFeatureCard(sourceCard, `calendar-card ${item.kind}`);
}

function renderUniversalFeatureCard(card, className = "", showActions = true) {
  if (typeof window.renderUnifiedCard === "function") {
    return window.renderUnifiedCard(card, { className, showActions });
  }
  return `
    <article class="card ${className}" data-card-id="${card.id}">
      <div class="card-state-row"><span>${formatDate(card.due)}</span><span>${card.status}</span></div>
      <div class="card-top"><h3 class="card-title">${card.title}</h3></div>
      <p class="card-details">${card.details}</p>
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
    amount: "CHF 0.00",
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
  const eventNumber = eventsForDate(calendarState.selected).length + 1;
  const selected = parseCalendarKey(calendarState.selected);
  selected.setHours(17, 0, 0, 0);
  const automation = window.getAutomationSettings?.() || {};
  const preset = automation.defaultReminderPreset || "60";
  const reminder = automation.automateReminders && automation.reminderDelivery !== "calendar-only"
    ? {
        preset,
        time: reminderIsoFromDate(selected, preset),
        automated: true,
      }
    : null;
  const googleCalendar = automation.syncFamilyCalendar
    ? {
        synced: true,
        provider: automation.familyCalendarProvider || "google",
        reminderPreset: preset,
        updatedAt: new Date().toISOString(),
      }
    : null;
  const card = {
    id: `calendar-${Date.now()}`,
    title: `New Do ${eventNumber}`,
    topic: "Schedule",
    type: "Event",
    status: "To Do",
    assignee: "Parent A",
    child: "Ava",
    due: selected.toISOString(),
    amount: "",
    details: "Created with a date from the calendar. Add the details, people, expense, reminder, or message thread.",
    comments: [{ author: "Parent A", text: "Created from calendar with a date", time: "Just now" }],
    acknowledged: false,
    reminder,
    googleCalendar,
    createdAt: Date.now(),
  };
  state.cards.unshift(card);
  persist();
  syncCalendarEventsFromCards();
  renderCalendarFeature(featureData.calendar);
  window.setTimeout(() => openCardDialog(card.id), 0);
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
  return calendarState.events.filter((item) => item.date === key).sort((a, b) => a.time.localeCompare(b.time));
}

function syncCalendarEventsFromCards() {
  calendarState.events = buildCalendarEvents(today);
}

function buildCalendarEvents(baseDate) {
  if (typeof state === "undefined") return [];
  const familyEvents = state.cards
    .filter((card) => card.due)
    .map((card) => {
      const date = new Date(card.due);
      return {
        cardId: card.id,
        date: toCalendarKey(date),
        time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        title: card.title,
        detail: buildCalendarCardDetail(card),
        kind: calendarKindForCard(card),
        badge: card.type === "Expense" ? "Expense" : card.type,
      };
    });

  // Merge Google Calendar events (both levels)
  const gcalEvents = (window.getGoogleCalendarEvents?.() || []).map((item) => {
    const date = new Date(item.start);
    const isWorkBusy = item.source === "work";
    return {
      cardId: item.id,
      date: toCalendarKey(date),
      time: item.allDay ? "All day" : date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      // Level 1 (work): show "Busy" only - no private details
      title: isWorkBusy ? "Busy" : item.title,
      detail: isWorkBusy ? "Work calendar · details private" : (item.description || "Do-Do Family calendar"),
      kind: isWorkBusy ? "busy" : "event",
      badge: isWorkBusy ? "Busy" : "GCal",
      googleLink: item.htmlLink || null,
      privateBlock: isWorkBusy,
    };
  });
  familyEvents.push(...gcalEvents);
  return [...familyEvents, ...buildPrivateWorkBlocks(baseDate)];
}

function buildPrivateWorkBlocks(baseDate) {
  const automation = window.getAutomationSettings?.() || {};
  if (!automation.syncWorkCalendar) return [];
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

function formatMonthYear(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatAgendaDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function weekdayLabel(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
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
      ["1440", "1 day before"],
      ["10080", "1 week before"],
      ["at-due", "At due time"],
    ];
    return `
      ${part === "all" || part === "automation" ? `
      <section class="feature-panel appearance-settings">
        <h3>Appearance</h3>
        <div class="settings-control-list">
          <label class="settings-select-row">
            <span>
              <strong>Theme</strong>
              <em>Follow your device setting or choose a fixed appearance.</em>
            </span>
            <select id="themePreference">
              <option value="system" ${themePreference === "system" ? "selected" : ""}>Use system setting</option>
              <option value="light" ${themePreference === "light" ? "selected" : ""}>Light</option>
              <option value="dark" ${themePreference === "dark" ? "selected" : ""}>Dark</option>
            </select>
          </label>
        </div>
      </section>
      ` : ""}
      ${part === "all" || part === "automation" ? `
      <section class="feature-panel automation-settings">
        <h3>Automation</h3>
        <div class="settings-control-list">
          <label class="settings-toggle-row">
            <span>
              <strong>Automate all reminders</strong>
              <em>Cards with a date get a reminder automatically.</em>
            </span>
            <input type="checkbox" id="autoRemindersToggle" ${automation.automateReminders ? "checked" : ""} />
          </label>
          <label class="settings-toggle-row">
            <span>
              <strong>Sync family calendar</strong>
              <em>Dated Dos sync to the selected shared calendar for this family workspace.</em>
            </span>
            <input type="checkbox" id="familyCalendarToggle" ${automation.syncFamilyCalendar ? "checked" : ""} />
          </label>
          <label class="settings-select-row">
            <span>
              <strong>Shared calendar provider</strong>
              <em>Use Google Calendar or Outlook as the family's main calendar sync.</em>
            </span>
            <select id="familyCalendarProvider">
              <option value="google" ${automation.familyCalendarProvider === "google" ? "selected" : ""}>Google Calendar</option>
              <option value="outlook" ${automation.familyCalendarProvider === "outlook" ? "selected" : ""}>Outlook Calendar</option>
            </select>
          </label>
          <label class="settings-select-row">
            <span>
              <strong>Global reminder time</strong>
              <em>Used for new cards and automatic calendar reminders.</em>
            </span>
            <select id="globalReminderPreset">
              ${leadTimes.map(([value, label]) => `<option value="${value}" ${automation.defaultReminderPreset === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
          <label class="settings-select-row">
            <span>
              <strong>Reminder delivery</strong>
              <em>Choose whether reminders stay in your calendar or also appear inside Do-Do.</em>
            </span>
            <select id="reminderDelivery">
              <option value="calendar-only" ${automation.reminderDelivery === "calendar-only" ? "selected" : ""}>Calendar only</option>
              <option value="calendar-and-app" ${automation.reminderDelivery !== "calendar-only" ? "selected" : ""}>Calendar + Do-Do</option>
            </select>
          </label>
        </div>
      </section>
      <section class="feature-panel google-calendar-connection">
        <div class="feature-panel-header">
          <h3>Calendar connections</h3>
          <button class="secondary-button feature-action" data-action="Connect family calendar">Connect</button>
        </div>
        <div class="settings-connection-list">
          <div class="settings-connection-row">
            <span>
              <strong>Family calendar</strong>
              <em>${automation.syncFamilyCalendar ? `Ready to sync dated Dos to ${automation.familyCalendarProvider === "outlook" ? "Outlook" : "Google"} Calendar.` : "Choose Google or Outlook and connect the family's main calendar."}</em>
            </span>
            <b>${automation.syncFamilyCalendar ? "On" : "Connect"}</b>
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>Family privacy boundary</strong>
              <em>Every family is a separate workspace. No other family can access its Dos, messages, or calendar.</em>
            </span>
            <b>Isolated</b>
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>Private work availability</strong>
              <em>Optional. Import busy blocks only. Titles, attendees, notes, and work-calendar details stay private.</em>
            </span>
            <input type="checkbox" id="workCalendarToggle" ${automation.syncWorkCalendar ? "checked" : ""} />
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>Work calendar provider</strong>
              <em>Connect Google or Microsoft Outlook for private conflict visibility.</em>
            </span>
            <select id="workCalendarProvider">
              <option value="google" ${automation.workCalendarProvider === "google" ? "selected" : ""}>Google Calendar</option>
              <option value="outlook" ${automation.workCalendarProvider === "outlook" ? "selected" : ""}>Microsoft</option>
            </select>
          </div>
          <div class="settings-connection-row work-calendar-connect-row">
            <span>
              <strong>Connect work calendars</strong>
              <em>You can connect either provider or both. Imported items remain busy-only blocks.</em>
            </span>
            <div class="calendar-connect-actions">
              <button class="secondary-button ${workCalendarConnections.includes("google") ? "connected" : ""}" type="button" data-connect-work-provider="google">${workCalendarConnections.includes("google") ? "Google connected" : "Connect Google"}</button>
              <button class="secondary-button ${workCalendarConnections.includes("outlook") ? "connected" : ""}" type="button" data-connect-work-provider="outlook">${workCalendarConnections.includes("outlook") ? "Outlook connected" : "Connect Microsoft"}</button>
            </div>
          </div>
          <div class="settings-connection-row">
            <span>
              <strong>Shared from work calendar</strong>
              <em>Only occupied time ranges become visible inside the family calendar.</em>
            </span>
            <b>Busy only</b>
          </div>
        </div>
      </section>
      ` : ""}
      ${part === "all" || part === "vaccine" ? `
      <section class="feature-panel settings-preview">
        <div class="feature-panel-header">
          <h3>Pet vaccine schedule</h3>
          <button class="secondary-button feature-action" data-action="Add vaccine">Add vaccine</button>
        </div>
        <div class="budget-list">
          ${[
            ["Milo rabies booster", "Due 12 Jun · annual"],
            ["Milo kennel cough", "Due 22 Sep · daycare required"],
            ["Milo deworming", "Due 1 Dec · recurring"],
          ].map(([name, detail]) => `
            <div class="budget-row">
              <span>
                <strong>${name}</strong>
                <em>${detail}</em>
              </span>
              <button class="secondary-button feature-action" data-action="${name}">Card</button>
            </div>
          `).join("")}
        </div>
      </section>
      ` : ""}
    `;
  }

  return `
    <section class="feature-panel">
      <h3>Prototype note</h3>
      <p class="feature-note">This screen captures the workflow and user-facing information architecture. Production requires platform APIs, backend services, compliance review, and real audit/security controls.</p>
    </section>
  `;
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

  const renderMemberRow = (name, index, type) => `
    <article class="feature-item feature-item-editable">
      <div class="feature-item-main">
        <strong>${escapeHtml(name)}</strong>
      </div>
      <div class="feature-item-actions">
        <button class="icon-button" data-edit-${type}="${index}" aria-label="Edit ${name}">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M11.5 2.5a1.5 1.5 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5Z"/>
          </svg>
        </button>
        <button class="icon-button icon-button-danger" data-delete-${type}="${index}" aria-label="Delete ${name}">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4"/>
          </svg>
        </button>
      </div>
    </article>
  `;

  featureModule.innerHTML = `
    <div class="feature-layout">
      ${renderSpecialPanel("settings", "automation")}

      <section class="feature-panel">
        <div class="feature-panel-header">
          <h3>Children</h3>
          <button class="secondary-button" id="addChildBtn">+ Add child</button>
        </div>
        <div class="feature-items" id="childrenList">
          ${children.length
            ? children.map((c, i) => renderMemberRow(c.name || c, i, "child")).join("")
            : `<p class="feature-empty">No children added yet.</p>`}
        </div>
      </section>

      <section class="feature-panel">
        <div class="feature-panel-header">
          <h3>Pets</h3>
          <button class="secondary-button" id="addPetBtn">+ Add pet</button>
        </div>
        <div class="feature-items" id="petsList">
          ${pets.length
            ? pets.map((p, i) => renderMemberRow(p.name || p, i, "pet")).join("")
            : `<p class="feature-empty">No pets added yet.</p>`}
        </div>
      </section>

      ${renderSpecialPanel("settings", "vaccine")}

      <section class="feature-panel" id="invitePanel">
        <h3>Co-parent</h3>
        <div class="feature-items" id="invitePanelContent">
          <p class="feature-empty" style="font-size:13px;color:var(--muted);">Checking connection...</p>
        </div>
      </section>

      <section class="feature-panel">
        <h3>Account</h3>
        <div class="feature-items">
          <article class="feature-item">
            <strong>Google Calendar</strong>
            <span>Sign out and back in to reconnect calendar sync</span>
          </article>
        </div>
        <div style="margin-top:16px;">
          <button class="secondary-button" id="signOutButton" style="color:#ef4444;border-color:#ef4444;">Sign out</button>
        </div>
      </section>
    </div>
  `;

  // Bind automation settings panel
  bindAutomationSettings();

  // Add child/pet
  featureModule.querySelector("#addChildBtn")?.addEventListener("click", () => promptAddChild());
  featureModule.querySelector("#addPetBtn")?.addEventListener("click", () => promptAddPet());

  // Sign out
  featureModule.querySelector("#signOutButton")?.addEventListener("click", () => {
    if (typeof signOut === "function") signOut();
  });

  // Co-parent invite panel
  renderInvitePanel();

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

async function renderInvitePanel() {
  const panel = featureModule.querySelector("#invitePanelContent");
  if (!panel) return;

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
  const pendingLink = (() => { try { return sessionStorage.getItem("do-do-pending-invite-link"); } catch { return null; } })();

  panel.innerHTML = `
    <article class="feature-item">
      <strong>${escapeHtml(coparentName || "Co-parent")}</strong>
      <span>Not joined yet${inviteEmail ? ` - invited as ${escapeHtml(inviteEmail)}` : ""}</span>
    </article>
    ${pendingLink ? `
    <div style="display:grid;gap:8px;">
      <label style="display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:800;">
        Invite link
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="settingsInviteInput" readonly value="${escapeHtml(pendingLink)}"
            style="flex:1;min-width:0;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12px;background:var(--soft);color:var(--ink);" />
          <button id="settingsInviteCopy" class="secondary-button" style="white-space:nowrap;min-height:36px;padding:0 12px;font-size:12px;">Copy link</button>
        </div>
      </label>
      ${inviteEmail ? `<button id="settingsResendEmail" class="secondary-button" style="justify-self:start;min-height:36px;padding:0 14px;font-size:12px;">Re-send email</button>` : ""}
    </div>
    ` : inviteEmail ? `
    <button id="settingsResendEmail" class="secondary-button" style="justify-self:start;min-height:36px;padding:0 14px;font-size:12px;">Re-send invite email</button>
    ` : `
    <p style="margin:0;font-size:13px;color:var(--muted);">Add your co-parent's email in onboarding to send an invite.</p>
    `}
  `;

  panel.querySelector("#settingsInviteCopy")?.addEventListener("click", () => {
    navigator.clipboard.writeText(pendingLink).then(() => {
      panel.querySelector("#settingsInviteCopy").textContent = "Copied!";
    }).catch(() => panel.querySelector("#settingsInviteInput")?.select());
  });

  panel.querySelector("#settingsResendEmail")?.addEventListener("click", async () => {
    const btn = panel.querySelector("#settingsResendEmail");
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
      const link = pendingLink || `${window.location.origin}/invite/unknown`;
      const res = await fetch("/api/invite-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  switchModule("settings");
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
  showFeatureToast(`Updated to ${name.trim()}`);
  switchModule("settings");
}

function confirmDeleteChild(index) {
  const setup = window.getOnboardingState?.() || {};
  const children = [...(setup.children || [])];
  const name = children[index]?.name || children[index] || "this child";
  if (!window.confirm(`Remove ${name}?`)) return;
  children.splice(index, 1);
  const updated = { ...setup, children };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
  showFeatureToast(`${name} removed`);
  switchModule("settings");
}

// ─── Pets CRUD ─────────────────────────────────────────────────────────────────

function promptAddPet() {
  const name = window.prompt("Pet's name:");
  if (!name?.trim()) return;
  const setup = window.getOnboardingState?.() || {};
  const updated = { ...setup, pets: [...(setup.pets || []), { name: name.trim() }] };
  window.appStorage?.setItem("ido-you-do-onboarding-v1", JSON.stringify(updated));
  showFeatureToast(`${name.trim()} added`);
  switchModule("settings");
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
  switchModule("settings");
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
  switchModule("settings");
}

// Refresh calendar when Google Calendar events load
window.addEventListener("googleCalendarLoaded", () => {
  syncCalendarEventsFromCards();
  if (typeof renderFeature === "function" && typeof featureData !== "undefined") {
    renderFeature("calendar", featureData.calendar);
  }
});
