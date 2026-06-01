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
  "Disputed": "waiting",
  "Info Only": "todo",
  "Paid": "paid",
};
const STATUS_FROM_DB = {
  "important": "Important",
  "waiting": "Waiting",
  "todo": "To Do",
  "done": "Done",
  "paid": "Done",
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
  };
}

// ─── State ────────────────────────────────────────────────────────────────────

let currentPairId = null;
let currentUserId = null;
let realtimeChannel = null;
let supabaseDataReady = false;

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
      await loadCardsFromSupabase();
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
    .subscribe();
}

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
      // Link pair to profile
      await window.supabaseClient
        .from("profiles")
        .update({ pair_id: pairData.id })
        .eq("id", userId);

      currentPairId = pairData.id;

      // Return the invite link so the app can show it
      return {
        familyId,
        pairId: pairData.id,
        inviteToken: pairData.invite_token,
        inviteLink: pairData.invite_token
          ? `${window.location.origin}/invite.html?token=${pairData.invite_token}`
          : null,
      };
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
let familyCalendarId = null;
let workBusySlots = [];      // Level 1: busy blocks from work calendar
let familyCalEvents = [];    // Level 2: events from Do-Do Family calendar

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initGoogleCalendar(session) {
  // provider_token is the Google OAuth access token.
  // It is ONLY present in the session immediately after OAuth sign-in.
  // On subsequent page loads it may be null - users need to sign in again
  // for calendar sync to work (or we refresh via provider_refresh_token).
  const token = session?.provider_token;
  if (!token) {
    // Try to restore family calendar events from last session
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

  // Run both levels in parallel
  await Promise.allSettled([
    _fetchWorkBusy(token),
    _initFamilyCalendar(token),
  ]);
}

// ─── Level 1: Work calendar busy blocks ───────────────────────────────────────

async function _fetchWorkBusy(token) {
  try {
    const now = new Date();
    const fourWeeksOut = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);

    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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
      private: true, // no details shown
    }));

    _emitCalendarUpdate();
  } catch (err) {
    console.warn("Work calendar busy fetch failed:", err.message);
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
  if (!token || !calId) return;
  try {
    const now = new Date();
    const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`);
    url.searchParams.set("timeMin", now.toISOString());
    url.searchParams.set("timeMax", sixtyDaysOut.toISOString());
    url.searchParams.set("maxResults", "100");
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
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

async function pushCardToFamilyCalendar(card) {
  if (!googleAccessToken || !familyCalendarId || !card.due) return null;

  try {
    const start = new Date(card.due);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour default

    const eventBody = {
      summary: card.title,
      description: [
        card.details,
        card.child ? `Child: ${card.child}` : "",
        card.amount ? `Amount: ${card.amount}` : "",
        `\n— Created in Do-Do app`,
      ].filter(Boolean).join("\n"),
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      extendedProperties: {
        private: { doDoCardId: card.id },
      },
    };

    const existingEventId = card.googleCalendar?.eventId;

    let res;
    if (existingEventId) {
      // Update existing event
      res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(familyCalendarId)}/events/${existingEventId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        }
      );
    } else {
      // Create new event
      res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(familyCalendarId)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        }
      );
    }

    if (!res.ok) return null;
    const created = await res.json();

    // Return the event ID so it can be stored on the card
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

// ─── Level 2: Delete a calendar event when card is deleted ────────────────────

async function deleteCardFromFamilyCalendar(card) {
  const eventId = card?.googleCalendar?.eventId;
  if (!googleAccessToken || !familyCalendarId || !eventId) return;

  try {
    await fetch(
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
  // Level 1: work busy slots (grey, no details)
  // Level 2: family calendar events (full details)
  return [...workBusySlots, ...familyCalEvents];
}

function _emitCalendarUpdate() {
  window.dispatchEvent(new CustomEvent("googleCalendarLoaded", {
    detail: { workBusy: workBusySlots, familyEvents: familyCalEvents },
  }));
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
window.getCurrentPairId = () => currentPairId;
window.getCurrentUserId = () => currentUserId;
