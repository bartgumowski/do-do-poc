// supabase-data.js
// Handles all Supabase persistence for cards, children, and onboarding.
// The app uses optimistic updates: state changes immediately in memory,
// then syncs to Supabase in the background.

// ─── Field mapping helpers ───────────────────────────────────────────────────

const TOPIC_TO_DB = {
  "Schedule": "schedule",
  "School": "school",
  "Medical": "medical",
  "Expenses": "finance",
  "General": "home",
  "Other": "other",
};
const TOPIC_FROM_DB = Object.fromEntries(Object.entries(TOPIC_TO_DB).map(([a, b]) => [b, a]));

const TYPE_TO_DB = {
  "Task": "task",
  "Event": "event",
  "Expense": "expense",
  "Request": "request",
  "Info Only": "info",
  "Message": "message",
};
const TYPE_FROM_DB = Object.fromEntries(Object.entries(TYPE_TO_DB).map(([a, b]) => [b, a]));

const STATUS_TO_DB = {
  "Important": "important",
  "Waiting": "waiting",
  "To Do": "todo",
  "Done": "done",
  "Disputed": "disputed",
  "Info Only": "todo",
  "Paid": "paid",
};
const STATUS_FROM_DB = {
  "important": "Important",
  "waiting": "Waiting",
  "todo": "To Do",
  "done": "Done",
  "paid": "Paid",
  "disputed": "Disputed",
  "cancelled": "Done",
};

const ASSIGNEE_TO_DB = {
  "Parent A": "parent_a",
  "Parent B": "parent_b",
  "Both": "both",
  "Child": "child",
  "": "unassigned",
};
const ASSIGNEE_FROM_DB = {
  "parent_a": "Parent A",
  "parent_b": "Parent B",
  "both": "Both",
  "child": "Child",
  "unassigned": "",
};

// ─── Convert app card ↔ DB row ────────────────────────────────────────────────

function cardToDbRow(card, pairId, userId) {
  return {
    id: card.id,
    pair_id: pairId,
    created_by: userId,
    updated_by: userId,
    title: card.title || "Untitled",
    body: card.details || null,
    topic: TOPIC_TO_DB[card.topic] || "schedule",
    card_type: TYPE_TO_DB[card.type] || "task",
    status: STATUS_TO_DB[card.status] || "todo",
    assigned_to: ASSIGNEE_TO_DB[card.assignee] ?? "unassigned",
    child_label: card.child || null,
    due_at: card.due || null,
    amount: card.amount ? parseFloat(card.amount.replace(/[^0-9.-]/g, "")) || null : null,
    payment_intent_id: card.payment_intent_id || null,
    payment_status: card.payment_status || "none",
    payment_amount: card.payment_amount != null ? parseFloat(card.payment_amount) || null : null,
    payment_paid_at: card.payment_paid_at || null,
    receipt_url: card.receipt_url || null,
    metadata: {
      comments: card.comments || [],
      reminder: card.reminder || null,
      googleCalendar: card.googleCalendar || null,
      acknowledged: card.acknowledged || false,
      createdAt: card.createdAt || Date.now(),
    },
  };
}

function dbRowToCard(row) {
  const meta = row.metadata || {};
  return {
    id: row.id,
    title: row.title,
    topic: TOPIC_FROM_DB[row.topic] || "Schedule",
    type: TYPE_FROM_DB[row.card_type] || "Task",
    status: STATUS_FROM_DB[row.status] || "To Do",
    assignee: ASSIGNEE_FROM_DB[row.assigned_to] || "",
    child: row.child_label || "",
    due: row.due_at || "",
    amount: row.amount != null ? String(row.amount) : "",
    details: row.body || "",
    comments: meta.comments || [],
    reminder: meta.reminder || null,
    googleCalendar: meta.googleCalendar || null,
    acknowledged: meta.acknowledged || false,
    createdAt: meta.createdAt || new Date(row.created_at).getTime(),
    payment_intent_id: row.payment_intent_id || null,
    payment_status: row.payment_status || "none",
    payment_amount: row.payment_amount != null ? row.payment_amount : null,
    payment_paid_at: row.payment_paid_at || null,
    receipt_url: row.receipt_url || null,
  };
}

// ─── State ────────────────────────────────────────────────────────────────────

let currentPairId = null;
let currentUserId = null;
let realtimeChannel = null;
let supabaseDataReady = false;
let _subscriptionStatus = "free";
let _subscriptionPeriodEnd = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initSupabaseData(session) {
  if (!window.supabaseClient) return;
  currentUserId = session?.user?.id;
  if (!currentUserId) return;

  try {
    // Get this user's pair ID
    const { data: pairId } = await window.supabaseClient.rpc("current_pair_id");
    currentPairId = pairId || null;

    if (!currentPairId) {
      // User has no pair yet - check if they have a profile
      const { data: profile } = await window.supabaseClient
        .from("profiles")
        .select("pair_id, family_id")
        .eq("id", currentUserId)
        .maybeSingle();
      currentPairId = profile?.pair_id || null;
    }

    if (currentPairId) {
      await Promise.all([
        loadCardsFromSupabase(),
        loadSubscriptionStatus(),
      ]);
      subscribeToCardChanges();
    } else {
      // Logged in but no pair yet - show empty board, not mock cards
      if (typeof state !== "undefined") {
        state.cards = [];
        if (typeof render === "function") render();
      }
    }

    supabaseDataReady = true;
  } catch (err) {
    console.warn("Supabase data init failed, using local storage:", err.message);
  }
}

// ─── Load cards ───────────────────────────────────────────────────────────────

async function loadCardsFromSupabase() {
  if (!currentPairId || !window.supabaseClient) return;

  const { data, error } = await window.supabaseClient
    .from("unified_cards")
    .select("*")
    .eq("pair_id", currentPairId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Could not load cards from Supabase:", error.message);
    return;
  }

  if (data && data.length > 0) {
    // Replace state with real data
    if (typeof state !== "undefined") {
      state.cards = data.map(dbRowToCard);
      if (typeof render === "function") render();
    }
  }
}

// ─── Subscription status ──────────────────────────────────────────────────────

async function loadSubscriptionStatus() {
  if (!currentPairId || !window.supabaseClient) return;

  try {
    const { data, error } = await window.supabaseClient
      .from("pairs")
      .select("subscription_status, subscription_period_end")
      .eq("id", currentPairId)
      .maybeSingle();

    if (error) {
      console.warn("Could not load subscription status:", error.message);
      return;
    }

    _subscriptionStatus = data?.subscription_status || "free";
    _subscriptionPeriodEnd = data?.subscription_period_end || null;

    // Notify app so it can update gating immediately
    window.dispatchEvent(new CustomEvent("subscriptionLoaded", {
      detail: { status: _subscriptionStatus, periodEnd: _subscriptionPeriodEnd },
    }));
  } catch (err) {
    console.warn("loadSubscriptionStatus failed:", err.message);
  }
}

function getSubscriptionStatus() {
  return { status: _subscriptionStatus, periodEnd: _subscriptionPeriodEnd };
}

// ─── Save card ────────────────────────────────────────────────────────────────

async function saveCardToSupabase(card) {
  if (!currentPairId || !currentUserId || !window.supabaseClient) return;

  const row = cardToDbRow(card, currentPairId, currentUserId);

  const { error } = await window.supabaseClient
    .from("unified_cards")
    .upsert(row, { onConflict: "id" });

  if (error) {
    console.warn("Card save failed:", error.message);
  }
}

// ─── Delete card (soft) ───────────────────────────────────────────────────────

async function deleteCardFromSupabase(id) {
  if (!currentPairId || !window.supabaseClient) return;

  const { error } = await window.supabaseClient
    .from("unified_cards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("pair_id", currentPairId);

  if (error) {
    console.warn("Card delete failed:", error.message);
  }
}

// ─── Real-time subscription ───────────────────────────────────────────────────

function subscribeToCardChanges() {
  if (!currentPairId || !window.supabaseClient || realtimeChannel) return;

  realtimeChannel = window.supabaseClient
    .channel(`cards:${currentPairId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "unified_cards",
        filter: `pair_id=eq.${currentPairId}`,
      },
      (payload) => {
        if (typeof state === "undefined") return;

        if (payload.eventType === "DELETE" || payload.new?.deleted_at) {
          state.cards = state.cards.filter((c) => c.id !== (payload.old?.id || payload.new?.id));
        } else if (payload.eventType === "INSERT") {
          const newCard = dbRowToCard(payload.new);
          if (!state.cards.find((c) => c.id === newCard.id)) {
            state.cards.unshift(newCard);
          }
        } else if (payload.eventType === "UPDATE") {
          const updated = dbRowToCard(payload.new);
          state.cards = state.cards.map((c) => (c.id === updated.id ? updated : c));
        }

        if (typeof render === "function") render();
      }
    )
    // Presence: track which card each user is currently viewing
    .on("presence", { event: "sync" }, () => {
      const presenceState = realtimeChannel.presenceState();
      if (typeof window.onPresenceSync === "function") window.onPresenceSync(presenceState);
    })
    .subscribe();
}

// Broadcast that the current user is viewing a card (or no card)
function broadcastCardPresence(cardId) {
  if (!realtimeChannel || !currentUserId) return;
  const setup = (() => { try { return JSON.parse(localStorage.getItem("ido-you-do-onboarding-v1") || "null"); } catch { return null; } })();
  const displayName = setup?.parents?.primary || "Parent A";
  realtimeChannel.track({ user_id: currentUserId, display_name: displayName, viewing_card: cardId || null });
}

window.broadcastCardPresence = broadcastCardPresence;

// ─── Save onboarding to Supabase ──────────────────────────────────────────────

async function saveOnboardingToSupabase(setup, userId) {
  if (!userId || !window.supabaseClient) return;

  try {
    // 1. Create family (generate UUID client-side to avoid RLS SELECT issue)
    const familyId = setup.familyId || crypto.randomUUID();

    const { error: familyError } = await window.supabaseClient
      .from("families")
      .insert({ id: familyId });

    if (familyError && !familyError.message.includes("duplicate")) {
      console.warn("Family creation failed:", familyError.message);
    }

    // 2. Upsert profile
    const firstName = (setup.parents?.primary || "Parent A").trim().split(/\s+/)[0];
    const { error: profileError } = await window.supabaseClient
      .from("profiles")
      .upsert({
        id: userId,
        first_name: firstName,
        display_name: setup.parents?.primary || "Parent A",
        role: "parent_a",
        family_id: familyId,
      });

    if (profileError) {
      console.warn("Profile save failed:", profileError.message);
    }

    // 3. Save children
    if (setup.children?.length) {
      await saveChildrenToSupabase(familyId, setup.children);
    }

    // 4. Create a pair (pending, ready for co-parent invite)
    const { data: pairData } = await window.supabaseClient
      .from("pairs")
      .insert({
        parent_a: userId,
        family_id: familyId,
        invite_email: setup.parents?.invite || null,
        invite_sent_at: setup.parents?.invite ? new Date().toISOString() : null,
      })
      .select("id, invite_token")
      .single();

    if (pairData?.id) {
      await window.supabaseClient
        .from("profiles")
        .update({ pair_id: pairData.id })
        .eq("id", userId);

      currentPairId = pairData.id;

      const inviteLink = pairData.invite_token
        ? `${window.location.origin}/invite/${pairData.invite_token}`
        : null;

      // Send invite email if co-parent email was provided
      const inviteEmail = setup.parents?.invite;
      let emailSent = false;
      if (inviteEmail && inviteLink) {
        try {
          const emailRes = await fetch("/api/invite-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toEmail: inviteEmail,
              fromName: setup.parents?.primary || null,
              inviteLink,
            }),
          });
          const emailData = emailRes.ok ? await emailRes.json() : {};
          emailSent = emailData.sent === true;
        } catch {
          emailSent = false;
        }
      }

      return { familyId, pairId: pairData.id, inviteToken: pairData.invite_token, inviteLink, emailSent };
    }

    return { familyId };
  } catch (err) {
    console.warn("Onboarding save to Supabase failed:", err.message);
    return null;
  }
}

// ─── Save children ────────────────────────────────────────────────────────────

async function saveChildrenToSupabase(familyId, children) {
  if (!familyId || !children?.length || !window.supabaseClient) return;

  const rows = children
    .filter((c) => c.name?.trim())
    .map((c) => ({
      family_id: familyId,
      name: c.name.trim(),
    }));

  if (!rows.length) return;

  const { error } = await window.supabaseClient
    .from("children")
    .insert(rows);

  if (error) {
    console.warn("Children save failed:", error.message);
  }
}

// ─── Load children ────────────────────────────────────────────────────────────

async function loadChildrenFromSupabase(familyId) {
  if (!familyId || !window.supabaseClient) return [];

  const { data, error } = await window.supabaseClient
    .from("children")
    .select("id, name")
    .eq("family_id", familyId);

  if (error) {
    console.warn("Children load failed:", error.message);
    return [];
  }

  return data || [];
}

// ─── Google Calendar ──────────────────────────────────────────────────────────
//
// Level 1 - Work calendar (read-only, privacy-safe):
//   Reads the parent's primary Google calendar using the freeBusy API.
//   Only fetches busy time slots - no event titles or details are exposed.
//   Shown in the family calendar as grey "Busy" blocks so the co-parent
//   knows when that window is unavailable.
//
// Level 2 - Family calendar (2-way sync):
//   Finds or creates a "Do-Do Family" calendar in the user's Google account.
//   Cards with a due date are pushed as events to this calendar.
//   Events added directly in Google Calendar are read back into the app.
//   Each parent maintains their own copy - they both see all cards via
//   Supabase real-time, and each syncs their personal Google calendar.

const FAMILY_CALENDAR_NAME = "Do-Do Family";
const CAL_STORAGE_KEY = "do-do-gcal-id-v1";

let googleAccessToken = null;
let googleTokenExpiresAt = 0;  // unix ms - 0 means unknown/expired
let familyCalendarId = null;
let workBusySlots = [];       // Level 1: busy blocks from current user's work calendar
let coParentBusySlots = [];   // Level 1b: co-parent's busy blocks (from their Supabase profile)
let appleCalBusySlots = [];   // CalDAV busy blocks (iCloud Calendar)
let familyCalEvents = [];     // Level 2: events from Do-Do Family calendar

// ─── Persist refresh token on sign-in ────────────────────────────────────────
// Called from initGoogleCalendar whenever a fresh provider_refresh_token is
// present in the session (i.e. immediately after OAuth sign-in).

async function _storeRefreshToken(userId, refreshToken) {
  if (!userId || !refreshToken || !window.supabaseClient) return;
  await window.supabaseClient
    .from("profiles")
    .update({ provider_refresh_token: refreshToken })
    .eq("id", userId);
}

// ─── Retrieve a valid Google access token ────────────────────────────────────
// If the session already has a fresh provider_token, use it.
// Otherwise call the /api/refresh-token serverless function to get a new one.

// ─── Token health event ───────────────────────────────────────────────────────
// Dispatched on window so Settings UI can reflect the real connection state.
// detail.status: "connected" | "no_token" | "token_revoked" | "error"
function _emitGCalTokenStatus(status, detail = {}) {
  window.dispatchEvent(new CustomEvent("googleCalTokenStatus", { detail: { status, ...detail } }));
}

async function _getGoogleAccessToken(session) {
  // Prefer the token baked into the session (only present right after OAuth)
  if (session?.provider_token) {
    // Tokens from a fresh OAuth flow are valid ~1 hour
    googleTokenExpiresAt = Date.now() + 55 * 60 * 1000;
    _emitGCalTokenStatus("connected");
    return session.provider_token;
  }

  // No in-session token - call the server-side refresh endpoint
  if (!currentUserId) return null;
  try {
    const { data: { session: liveSession } } = await window.supabaseClient.auth.getSession();
    const jwt = liveSession?.access_token;
    if (!jwt) return null;

    const res = await fetch("/api/refresh-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn("Token refresh failed:", body.error || res.status);
      const status = body.error === "token_revoked" ? "token_revoked"
        : body.error === "no_refresh_token" ? "no_token"
        : "error";
      _emitGCalTokenStatus(status, { message: body.message });
      return null;
    }

    const { access_token, expires_in } = await res.json();
    if (access_token) {
      googleTokenExpiresAt = Date.now() + ((expires_in || 3599) - 60) * 1000;
      _emitGCalTokenStatus("connected");
      return access_token;
    }
    _emitGCalTokenStatus("error");
    return null;
  } catch (err) {
    console.warn("Token refresh request failed:", err.message);
    _emitGCalTokenStatus("error", { message: err.message });
    return null;
  }
}

// ─── Ensure the in-memory googleAccessToken is fresh ─────────────────────────
// Called before every GCal API call. Refreshes proactively if within 5 minutes
// of expiry, and retries once on a 401 response.

async function _ensureFreshGoogleToken() {
  const buffer = 5 * 60 * 1000; // refresh 5 min before expiry
  if (googleAccessToken && googleTokenExpiresAt > Date.now() + buffer) {
    return googleAccessToken;
  }
  // Token missing or about to expire - get a fresh one
  const liveSession = (await window.supabaseClient?.auth?.getSession())?.data?.session ?? {};
  const freshToken = await _getGoogleAccessToken(liveSession);
  if (freshToken) googleAccessToken = freshToken;
  return googleAccessToken;
}

// ─── Retry a GCal fetch once on 401 (stale token race condition) ─────────────

async function _gcalFetch(url, options) {
  let res = await fetch(url, options);
  if (res.status === 401) {
    // Force refresh
    googleTokenExpiresAt = 0;
    const freshToken = await _ensureFreshGoogleToken();
    if (!freshToken) return res; // give up
    const newOpts = { ...options, headers: { ...options.headers, Authorization: `Bearer ${freshToken}` } };
    res = await fetch(url, newOpts);
  }
  return res;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initGoogleCalendar(session) {
  // Store refresh token whenever it's present (fresh OAuth sign-in)
  if (session?.provider_refresh_token && session?.user?.id) {
    await _storeRefreshToken(session.user.id, session.provider_refresh_token);
  }

  // Get a valid access token - either from session or via refresh
  const token = await _getGoogleAccessToken(session);

  if (!token) {
    // No token available - restore cached calendar events from last session
    const cached = localStorage.getItem("do-do-gcal-events-v1");
    if (cached) {
      try {
        familyCalEvents = JSON.parse(cached);
        _emitCalendarUpdate();
      } catch {}
    }
    return;
  }

  googleAccessToken = token;
  familyCalendarId = localStorage.getItem(CAL_STORAGE_KEY) || null;

  // Run all three in parallel: own busy, family calendar, and co-parent busy
  await Promise.allSettled([
    _fetchWorkBusy(token),
    _initFamilyCalendar(token),
    _loadCoParentBusySlots(),
  ]);
}

// ─── Level 1: Work calendar busy blocks ───────────────────────────────────────

async function _fetchWorkBusy(token) {
  // Ensure token is fresh before calling Google
  const freshToken = await _ensureFreshGoogleToken() || token;
  try {
    const now = new Date();
    const fourWeeksOut = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);

    // Determine the person label for this user's busy blocks
    const setup = (() => { try { return JSON.parse(localStorage.getItem("ido-you-do-onboarding-v1") || "null"); } catch { return null; } })();
    const myRole = setup?.role || "parent_a";
    const myName = setup?.parents?.primary || (myRole === "parent_a" ? "Parent A" : "Parent B");

    const res = await _gcalFetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${freshToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: now.toISOString(),
        timeMax: fourWeeksOut.toISOString(),
        items: [{ id: "primary" }],
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const busy = data.calendars?.primary?.busy || [];

    workBusySlots = busy.map((slot) => ({
      id: `busy-${slot.start}`,
      title: "Busy",
      start: slot.start,
      end: slot.end,
      allDay: false,
      source: "work",
      person: myName,
      role: myRole,
      private: true,
    }));

    // Persist our own busy slots to Supabase so the co-parent can see them
    _saveMyBusySlotsToSupabase(workBusySlots).catch(() => {});

    _emitCalendarUpdate();
  } catch (err) {
    console.warn("Work calendar busy fetch failed:", err.message);
  }
}

// ─── Save this user's busy slots to their Supabase profile ────────────────────

async function _saveMyBusySlotsToSupabase(slots) {
  if (!currentUserId || !window.supabaseClient) return;
  // The work_busy_slots column may not exist yet - errors are silently ignored.
  // If the column is missing the upsert will fail; the feature degrades gracefully.
  await window.supabaseClient
    .from("profiles")
    .update({ work_busy_slots: JSON.stringify(slots) })
    .eq("id", currentUserId)
    .then(({ error }) => {
      if (error && !error.message?.includes("column")) {
        console.warn("Could not persist busy slots:", error.message);
      }
    });
}

// ─── Load the co-parent's busy slots from their Supabase profile ───────────────
// RLS allows reading profiles for family members (see supabase-rls-audit.sql).

async function _loadCoParentBusySlots() {
  if (!currentUserId || !window.supabaseClient) return;
  try {
    // Get both profiles in this family; the other one is the co-parent
    const { data: profiles, error } = await window.supabaseClient
      .from("profiles")
      .select("id, role, display_name, work_busy_slots")
      .neq("id", currentUserId);

    if (error || !profiles?.length) return;

    const merged = [];
    for (const profile of profiles) {
      if (!profile.work_busy_slots) continue;
      let slots;
      try { slots = JSON.parse(profile.work_busy_slots); } catch { continue; }
      if (!Array.isArray(slots)) continue;
      const role = profile.role || "parent_b";
      const name = profile.display_name || (role === "parent_a" ? "Parent A" : "Parent B");
      // Re-stamp with co-parent identity (source data may use a different name)
      merged.push(...slots.map((s) => ({ ...s, person: name, role, source: "coparent-work" })));
    }

    if (merged.length) {
      coParentBusySlots = merged;
      _emitCalendarUpdate();
    }
  } catch (err) {
    console.warn("Co-parent busy slots load failed:", err.message);
  }
}

// ─── Level 2: Family calendar (find or create) ────────────────────────────────

async function _initFamilyCalendar(token) {
  try {
    // Find "Do-Do Family" in user's calendar list
    const listRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) return;

    const listData = await listRes.json();
    const existing = (listData.items || []).find(
      (cal) => cal.summary === FAMILY_CALENDAR_NAME
    );

    if (existing) {
      familyCalendarId = existing.id;
    } else {
      // Create it
      const createRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: FAMILY_CALENDAR_NAME,
            description: "Shared family coordination calendar - managed by Do-Do app",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }
      );
      if (!createRes.ok) return;
      const created = await createRes.json();
      familyCalendarId = created.id;
    }

    localStorage.setItem(CAL_STORAGE_KEY, familyCalendarId);
    await _fetchFamilyCalendarEvents(token, familyCalendarId);
  } catch (err) {
    console.warn("Family calendar init failed:", err.message);
  }
}

// ─── Level 2: Read events from family calendar ────────────────────────────────

async function _fetchFamilyCalendarEvents(token, calId) {
  if (!calId) return;
  const freshToken = await _ensureFreshGoogleToken() || token;
  try {
    const now = new Date();
    const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`);
    url.searchParams.set("timeMin", now.toISOString());
    url.searchParams.set("timeMax", sixtyDaysOut.toISOString());
    url.searchParams.set("maxResults", "100");
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");

    const res = await _gcalFetch(url.toString(), {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    familyCalEvents = (data.items || [])
      .filter((item) => item.status !== "cancelled")
      .map((item) => ({
        id: item.id,
        title: item.summary || "Family event",
        start: item.start?.dateTime || item.start?.date,
        end: item.end?.dateTime || item.end?.date,
        allDay: Boolean(item.start?.date && !item.start?.dateTime),
        source: "family",
        htmlLink: item.htmlLink,
        description: item.description || "",
        // If this event was created from a card, the card ID is in extendedProperties
        cardId: item.extendedProperties?.private?.doDoCardId || null,
      }));

    // Cache for next load
    localStorage.setItem("do-do-gcal-events-v1", JSON.stringify(familyCalEvents));
    _emitCalendarUpdate();
  } catch (err) {
    console.warn("Family calendar events fetch failed:", err.message);
  }
}

// ─── Level 2: Push a card as a Google Calendar event ──────────────────────────

async function pushCardToFamilyCalendar(card, reminderMinutes) {
  if (!familyCalendarId || !card.due) return null;

  // Ensure token is fresh before writing
  const token = await _ensureFreshGoogleToken();
  if (!token) return null;

  try {
    const start = new Date(card.due);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour default

    // Build reminders block
    const mins = typeof reminderMinutes === "number" && reminderMinutes >= 0 ? reminderMinutes : null;
    const remindersBlock = mins !== null
      ? { useDefault: false, overrides: [{ method: "popup", minutes: mins }] }
      : { useDefault: true };

    const eventBody = {
      summary: card.title,
      description: [
        card.details,
        card.child ? `Child: ${card.child}` : "",
        card.amount ? `Amount: ${card.amount}` : "",
        card.recurrence?.freq && card.recurrence.freq !== "none" ? `Recurring: ${_recurrenceLabel(card.recurrence)}` : "",
        `\n- Created in Do-Do app`,
      ].filter(Boolean).join("\n"),
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      reminders: remindersBlock,
      extendedProperties: {
        private: {
          doDoCardId: card.id,
          recurrenceFreq: card.recurrence?.freq || "none",
        },
      },
    };

    // Add RRULE if this is a recurring card
    const rrule = card.recurrence ? _buildRRule(card.recurrence) : null;
    if (rrule) eventBody.recurrence = [rrule];

    const existingEventId = card.googleCalendar?.eventId;
    const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(familyCalendarId)}/events`;

    let res;
    if (existingEventId) {
      res = await _gcalFetch(`${calUrl}/${existingEventId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
    } else {
      res = await _gcalFetch(calUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
    }

    if (!res.ok) return null;
    const created = await res.json();

    return {
      eventId: created.id,
      calendarId: familyCalendarId,
      htmlLink: created.htmlLink,
      synced: true,
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("Push to family calendar failed:", err.message);
    return null;
  }
}

// ─── RRULE builder for recurring events ──────────────────────────────────────

function _buildRRule(rec) {
  if (!rec || !rec.freq || rec.freq === "none") return null;
  switch (rec.freq) {
    case "daily":
      return "RRULE:FREQ=DAILY";
    case "weekly": {
      const byday = (rec.days || []).map((d) => d.slice(0, 2).toUpperCase()).join(",");
      return byday ? `RRULE:FREQ=WEEKLY;BYDAY=${byday}` : "RRULE:FREQ=WEEKLY";
    }
    case "biweekly": {
      const byday2 = (rec.days || []).map((d) => d.slice(0, 2).toUpperCase()).join(",");
      return byday2 ? `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${byday2}` : "RRULE:FREQ=WEEKLY;INTERVAL=2";
    }
    case "monthly":
      return "RRULE:FREQ=MONTHLY";
    case "custom-223":
      // 2-2-3 custody pattern: approximated as alternating days; documented as manual
      return "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;INTERVAL=1";
    case "custom-wowo":
      return "RRULE:FREQ=WEEKLY;INTERVAL=2";
    default:
      return null;
  }
}

function _recurrenceLabel(rec) {
  const labels = {
    daily: "Daily", weekly: "Weekly", biweekly: "Every two weeks",
    monthly: "Monthly", "custom-223": "2-2-3 pattern", "custom-wowo": "Week-on/week-off",
  };
  return labels[rec?.freq] || rec?.freq || "Recurring";
}

// ─── Level 2: Delete a calendar event when card is deleted ────────────────────

async function deleteCardFromFamilyCalendar(card) {
  const eventId = card?.googleCalendar?.eventId;
  if (!familyCalendarId || !eventId) return;
  const token = await _ensureFreshGoogleToken();
  if (!token) return;

  try {
    await _gcalFetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(familyCalendarId)}/events/${eventId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      }
    );
  } catch (err) {
    console.warn("Delete from family calendar failed:", err.message);
  }
}

// ─── Merge events for the calendar view ───────────────────────────────────────

function getGoogleCalendarEvents() {
  // Level 1: own work busy + co-parent work busy + Apple CalDAV busy
  // Level 2: family calendar events (full details)
  return [...workBusySlots, ...coParentBusySlots, ...appleCalBusySlots, ...familyCalEvents];
}

// ─── Apple Calendar / CalDAV integration ──────────────────────────────────────
// Credentials are stored in localStorage (POC) and sent to the /api/apple-calendar
// proxy which makes the server-side CalDAV calls (CORS prevents direct browser access).

const APPLE_CAL_KEY = "do-do-apple-cal-v1";

async function initAppleCalendar() {
  const creds = _getAppleCalCredentials();
  if (!creds) return; // not connected
  try {
    const res = await fetch("/api/apple-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...creds, action: "fetchBusy" }),
    });
    if (!res.ok) return;
    const { slots } = await res.json();
    if (!Array.isArray(slots)) return;

    const setup = (() => { try { return JSON.parse(localStorage.getItem("ido-you-do-onboarding-v1") || "null"); } catch { return null; } })();
    const myRole = setup?.role || "parent_a";
    const myName = setup?.parents?.primary || (myRole === "parent_a" ? "Parent A" : "Parent B");

    appleCalBusySlots = slots.map((slot, i) => ({
      id: `apple-busy-${i}-${slot.start}`,
      title: "Busy",
      start: slot.start,
      end: slot.end,
      allDay: false,
      source: "apple-work",
      person: myName,
      role: myRole,
      private: true,
    }));
    _emitCalendarUpdate();
  } catch (err) {
    console.warn("Apple Calendar busy fetch failed:", err.message);
  }
}

async function pushCardToAppleCalendar(card) {
  const creds = _getAppleCalCredentials();
  if (!creds || !card.due) return null;
  try {
    const res = await fetch("/api/apple-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...creds,
        action: "createEvent",
        event: {
          uid: card.id,
          summary: card.title,
          description: [card.details, card.child ? `Child: ${card.child}` : ""].filter(Boolean).join("\n"),
          dtstart: new Date(card.due).toISOString(),
          dtend: new Date(new Date(card.due).getTime() + 60 * 60 * 1000).toISOString(),
          rrule: card.recurrence ? _buildRRule(card.recurrence) : null,
        },
      }),
    });
    if (!res.ok) return null;
    const { uid, htmlLink } = await res.json();
    return { uid, htmlLink, synced: true, provider: "apple", syncedAt: new Date().toISOString() };
  } catch (err) {
    console.warn("Push to Apple Calendar failed:", err.message);
    return null;
  }
}

async function deleteCardFromAppleCalendar(card) {
  const uid = card?.appleCalendar?.eventId;
  if (!uid) return;
  const creds = _getAppleCalCredentials();
  if (!creds) return;
  try {
    await fetch("/api/apple-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, appPassword: creds.appPassword, action: "deleteEvent", event: { uid } }),
    });
  } catch (err) {
    console.warn("Delete from Apple Calendar failed:", err.message);
  }
}

function saveAppleCalCredentials(email, appPassword) {
  localStorage.setItem(APPLE_CAL_KEY, JSON.stringify({ email, appPassword }));
}

function clearAppleCalCredentials() {
  localStorage.removeItem(APPLE_CAL_KEY);
  appleCalBusySlots = [];
  _emitCalendarUpdate();
}

function getAppleCalConnectionStatus() {
  const creds = _getAppleCalCredentials();
  return creds ? { connected: true, email: creds.email } : { connected: false };
}

function _getAppleCalCredentials() {
  try {
    const raw = localStorage.getItem(APPLE_CAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function _emitCalendarUpdate() {
  window.dispatchEvent(new CustomEvent("googleCalendarLoaded", {
    detail: { workBusy: workBusySlots, familyEvents: familyCalEvents },
  }));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

const MSG_TOPIC_TO_DB = {
  "Schedule": "schedule",
  "School": "school",
  "Medical": "medical",
  "Expenses": "finance",
  "General": "home",
  "Other": "other",
};

let messageChannels = {};    // topic → realtime channel
let userProfile = null;      // cached {id, first_name, display_name, role}

async function loadUserProfile() {
  if (userProfile || !currentUserId || !window.supabaseClient) return userProfile;
  const { data } = await window.supabaseClient
    .from("profiles")
    .select("id, first_name, display_name, role")
    .eq("id", currentUserId)
    .maybeSingle();
  userProfile = data || null;
  return userProfile;
}

async function loadMessages(appTopic) {
  if (!currentPairId || !window.supabaseClient) return [];
  const dbTopic = MSG_TOPIC_TO_DB[appTopic] || "schedule";

  const { data, error } = await window.supabaseClient
    .from("messages_v2")
    .select("id, body, sender_id, created_at, card_id")
    .eq("pair_id", currentPairId)
    .eq("topic", dbTopic)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) { console.warn("loadMessages failed:", error.message); return []; }
  return data || [];
}

async function sendMessage(appTopic, body, cardId = null) {
  if (!currentPairId || !currentUserId || !window.supabaseClient) return null;
  const dbTopic = MSG_TOPIC_TO_DB[appTopic] || "schedule";

  const { data, error } = await window.supabaseClient
    .from("messages_v2")
    .insert({
      pair_id: currentPairId,
      topic: dbTopic,
      body,
      sender_id: currentUserId,
      card_id: cardId || null,
    })
    .select("id, body, sender_id, created_at, card_id")
    .single();

  if (error) { console.warn("sendMessage failed:", error.message); return null; }
  return data;
}

async function getUnreadCounts() {
  if (!currentPairId || !window.supabaseClient) return {};
  // Count messages in last 7 days per topic as a proxy for unread
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await window.supabaseClient
    .from("messages_v2")
    .select("topic")
    .eq("pair_id", currentPairId)
    .is("deleted_at", null)
    .neq("sender_id", currentUserId)
    .gte("created_at", since);

  const counts = {};
  (data || []).forEach(({ topic }) => {
    const appTopic = Object.entries(MSG_TOPIC_TO_DB).find(([, v]) => v === topic)?.[0];
    if (appTopic) counts[appTopic] = (counts[appTopic] || 0) + 1;
  });
  return counts;
}

function subscribeToMessages(appTopic, onNewMessage) {
  if (!currentPairId || !window.supabaseClient) return;
  const dbTopic = MSG_TOPIC_TO_DB[appTopic] || "schedule";

  // Unsubscribe existing channel for this topic
  if (messageChannels[appTopic]) {
    messageChannels[appTopic].unsubscribe();
  }

  messageChannels[appTopic] = window.supabaseClient
    .channel(`messages:${currentPairId}:${dbTopic}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages_v2",
      filter: `pair_id=eq.${currentPairId}`,
    }, (payload) => {
      if (payload.new?.topic === dbTopic) onNewMessage(payload.new);
    })
    .subscribe();
}

function unsubscribeMessages() {
  Object.values(messageChannels).forEach((ch) => ch.unsubscribe?.());
  messageChannels = {};
}

// ─── Shopping list ────────────────────────────────────────────────────────────

async function loadShoppingItems() {
  const familyId = await _getFamilyId();
  if (!familyId || !window.supabaseClient) return null;

  const { data, error } = await window.supabaseClient
    .from("shopping_items")
    .select("id, list, name, checked, checked_by, created_at, profiles:checked_by(display_name)")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });

  if (error) { console.warn("loadShoppingItems failed:", error.message); return null; }

  // Group into groceries / other - use label to match renderShoppingGroup expectations
  const result = { groceries: [], other: [] };
  (data || []).forEach((item) => {
    const group = item.list === "other" ? "other" : "groceries";
    result[group].push({
      id: item.id,
      label: item.name,   // features.js uses .label
      bought: item.checked,
      boughtBy: item.profiles?.display_name || null,
    });
  });
  return result;
}

let _shoppingChannel = null;

function subscribeToShopping(onUpdate) {
  if (_shoppingChannel) return; // already subscribed
  _getFamilyId().then((familyId) => {
    if (!familyId || !window.supabaseClient) return;
    _shoppingChannel = window.supabaseClient
      .channel(`shopping:${familyId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "shopping_items",
        filter: `family_id=eq.${familyId}`,
      }, () => onUpdate())
      .subscribe();
  });
}

function unsubscribeShopping() {
  if (_shoppingChannel) {
    _shoppingChannel.unsubscribe();
    _shoppingChannel = null;
  }
}

async function addShoppingItem(listKey, name) {
  const familyId = await _getFamilyId();
  if (!familyId || !currentUserId || !window.supabaseClient) return null;

  const { data, error } = await window.supabaseClient
    .from("shopping_items")
    .insert({ family_id: familyId, created_by: currentUserId, list: listKey, name })
    .select("id, list, name, checked")
    .single();

  if (error) { console.warn("addShoppingItem failed:", error.message); return null; }
  // Normalise to match loadShoppingItems shape (label not name)
  return data ? { ...data, label: data.name } : null;
}

async function toggleShoppingItem(id, checked) {
  if (!window.supabaseClient) return;
  await window.supabaseClient
    .from("shopping_items")
    .update({ checked, checked_by: checked ? currentUserId : null, checked_at: checked ? new Date().toISOString() : null })
    .eq("id", id);
}

async function deleteShoppingItem(id) {
  if (!window.supabaseClient) return;
  await window.supabaseClient.from("shopping_items").delete().eq("id", id);
}

async function _getFamilyId() {
  if (!currentUserId || !window.supabaseClient) return null;
  const setup = (() => { try { return JSON.parse(localStorage.getItem("ido-you-do-onboarding-v1") || "null"); } catch { return null; } })();
  if (setup?.familyId) return setup.familyId;
  const { data } = await window.supabaseClient
    .from("profiles").select("family_id").eq("id", currentUserId).maybeSingle();
  return data?.family_id || null;
}

// ─── Expose globals ───────────────────────────────────────────────────────────

window.initSupabaseData = initSupabaseData;
window.saveCardToSupabase = saveCardToSupabase;
window.deleteCardFromSupabase = deleteCardFromSupabase;
window.saveOnboardingToSupabase = saveOnboardingToSupabase;
window.saveChildrenToSupabase = saveChildrenToSupabase;
window.loadChildrenFromSupabase = loadChildrenFromSupabase;
window.initGoogleCalendar = initGoogleCalendar;
window.getGoogleCalendarEvents = getGoogleCalendarEvents;
window.pushCardToFamilyCalendar = pushCardToFamilyCalendar;
window.deleteCardFromFamilyCalendar = deleteCardFromFamilyCalendar;
window.initAppleCalendar = initAppleCalendar;
window.pushCardToAppleCalendar = pushCardToAppleCalendar;
window.deleteCardFromAppleCalendar = deleteCardFromAppleCalendar;
window.saveAppleCalCredentials = saveAppleCalCredentials;
window.clearAppleCalCredentials = clearAppleCalCredentials;
window.getAppleCalConnectionStatus = getAppleCalConnectionStatus;
window.getCurrentPairId = () => currentPairId;
window.getCurrentUserId = () => currentUserId;
window.loadMessages = loadMessages;
window.loadShoppingItems = loadShoppingItems;
window.addShoppingItem = addShoppingItem;
window.toggleShoppingItem = toggleShoppingItem;
window.deleteShoppingItem = deleteShoppingItem;
window.subscribeToShopping = subscribeToShopping;
window.unsubscribeShopping = unsubscribeShopping;
window.sendMessage = sendMessage;
window.subscribeToMessages = subscribeToMessages;
window.unsubscribeMessages = unsubscribeMessages;
window.getUnreadCounts = getUnreadCounts;
window.loadUserProfile = loadUserProfile;
window.acceptInviteToken = acceptInviteToken;
window.lookupInviteToken = lookupInviteToken;
window.updateProfile = updateProfile;
window.loadSubscriptionStatus = loadSubscriptionStatus;
window.getSubscriptionStatus = getSubscriptionStatus;

// ─── Invite acceptance ────────────────────────────────────────────────────────

async function lookupInviteToken(token) {
  if (!token || !window.supabaseClient) return null;
  const { data, error } = await window.supabaseClient
    .from("pairs")
    .select("id, family_id, invite_token, parent_a, invite_email, accepted_at, profiles!pairs_parent_a_fkey(display_name)")
    .eq("invite_token", token)
    .single();
  if (error || !data) return null;
  if (data.accepted_at) return { expired: true };

  // Fetch children for this family
  let childrenNames = [];
  if (data.family_id) {
    const { data: children } = await window.supabaseClient
      .from("children")
      .select("name")
      .eq("family_id", data.family_id)
      .order("created_at", { ascending: true });
    childrenNames = (children || []).map((c) => c.name).filter(Boolean);
  }

  return {
    pairId: data.id,
    familyId: data.family_id,
    inviteToken: data.invite_token,
    parentAName: data.profiles?.display_name || "Your co-parent",
    inviteEmail: data.invite_email,
    childrenNames,
  };
}

async function updateProfile(displayName) {
  if (!currentUserId || !window.supabaseClient) return false;
  const firstName = (displayName || "").trim().split(/\s+/)[0] || displayName;
  const { error } = await window.supabaseClient
    .from("profiles")
    .update({ display_name: displayName.trim(), first_name: firstName })
    .eq("id", currentUserId);
  if (error) { console.warn("updateProfile failed:", error.message); return false; }
  return true;
}

async function acceptInviteToken(token, userId, displayName) {
  if (!token || !userId || !window.supabaseClient) return { ok: false, reason: "missing_args" };

  try {
    // Look up pair
    const { data: pair, error: pairErr } = await window.supabaseClient
      .from("pairs")
      .select("id, family_id, accepted_at")
      .eq("invite_token", token)
      .single();

    if (pairErr || !pair) return { ok: false, reason: "invalid_token" };
    if (pair.accepted_at) return { ok: false, reason: "already_accepted" };

    // Mark pair as accepted with parent_b
    const { error: updateErr } = await window.supabaseClient
      .from("pairs")
      .update({ parent_b: userId, accepted_at: new Date().toISOString() })
      .eq("id", pair.id);

    if (updateErr) return { ok: false, reason: updateErr.message };

    // Upsert profile for parent_b
    const firstName = (displayName || "Parent B").trim().split(/\s+/)[0];
    await window.supabaseClient
      .from("profiles")
      .upsert({
        id: userId,
        first_name: firstName,
        display_name: displayName || "Parent B",
        role: "parent_b",
        family_id: pair.family_id,
        pair_id: pair.id,
      });

    currentPairId = pair.id;
    currentFamilyId = pair.family_id;
    currentUserId = userId;

    return { ok: true, familyId: pair.family_id, pairId: pair.id };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
