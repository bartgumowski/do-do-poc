// Vercel serverless function - /api/apple-calendar
//
// Server-side proxy for Apple Calendar via CalDAV.
// Browsers cannot reach caldav.icloud.com directly (CORS), so all CalDAV
// requests are routed through this function.
//
// The user provides their iCloud email and an app-specific password
// (generated at appleid.apple.com -> Security -> App-Specific Passwords).
// We never store these credentials - they are passed per-request from the client
// where they live in localStorage (acceptable for a POC; production would use
// Supabase Vault or a server-side encrypted store).
//
// Supported actions:
//   fetchBusy   - REPORT against the primary calendar, returns busy time slots
//   createEvent - PUT a new VEVENT
//   updateEvent - PUT an updated VEVENT (same UID)
//   deleteEvent - DELETE a VEVENT by UID

const CALDAV_BASE = "https://caldav.icloud.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, appPassword, action, event } = req.body || {};

  if (!email || !appPassword) {
    return res.status(400).json({ error: "Missing iCloud email or app-specific password" });
  }
  if (!action) {
    return res.status(400).json({ error: "Missing action" });
  }

  const authHeader = "Basic " + Buffer.from(`${email}:${appPassword}`).toString("base64");

  try {
    // ─── Step 1: Discover the user's principal URL ──────────────────────────
    const principalUrl = await _discoverPrincipal(authHeader, email);
    if (!principalUrl) {
      return res.status(401).json({ error: "Could not authenticate with iCloud Calendar. Check your email and app-specific password." });
    }

    // ─── Step 2: Discover the calendar home set URL ─────────────────────────
    const calendarHomeUrl = await _discoverCalendarHome(authHeader, principalUrl);
    if (!calendarHomeUrl) {
      return res.status(500).json({ error: "Could not find iCloud calendar home" });
    }

    // ─── Step 3: Find the default calendar URL ──────────────────────────────
    const defaultCalUrl = await _findDefaultCalendar(authHeader, calendarHomeUrl);
    if (!defaultCalUrl) {
      return res.status(500).json({ error: "Could not find default iCloud calendar" });
    }

    // ─── Dispatch action ────────────────────────────────────────────────────
    if (action === "fetchBusy") {
      const slots = await _fetchBusy(authHeader, defaultCalUrl);
      return res.status(200).json({ slots });
    }

    if (action === "createEvent" || action === "updateEvent") {
      if (!event?.uid) return res.status(400).json({ error: "Missing event.uid" });
      const icsContent = _buildIcs(event);
      const eventUrl = `${defaultCalUrl}${event.uid}.ics`;
      const putRes = await fetch(eventUrl, {
        method: "PUT",
        headers: {
          Authorization: authHeader,
          "Content-Type": "text/calendar; charset=utf-8",
        },
        body: icsContent,
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        return res.status(putRes.status).json({ error: `CalDAV PUT failed: ${putRes.status}`, detail: text });
      }
      return res.status(200).json({ uid: event.uid, htmlLink: null });
    }

    if (action === "deleteEvent") {
      if (!event?.uid) return res.status(400).json({ error: "Missing event.uid" });
      const eventUrl = `${defaultCalUrl}${event.uid}.ics`;
      await fetch(eventUrl, { method: "DELETE", headers: { Authorization: authHeader } });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error("apple-calendar error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── CalDAV discovery helpers ─────────────────────────────────────────────────

async function _discoverPrincipal(authHeader, email) {
  // iCloud CalDAV discovery: first find the correct shard server
  const discoveryUrl = `${CALDAV_BASE}/.well-known/caldav`;
  const res = await fetch(discoveryUrl, {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/xml",
      Depth: "0",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal /></d:prop>
</d:propfind>`,
    redirect: "follow",
  });

  if (res.status === 401) return null;
  const xml = await res.text();
  const match = xml.match(/<d:href>([^<]+principal[^<]*)<\/d:href>/i)
    || xml.match(/<href>([^<]+principal[^<]*)<\/href>/i);
  if (!match) return null;
  const path = match[1];
  return path.startsWith("http") ? path : `${new URL(res.url).origin}${path}`;
}

async function _discoverCalendarHome(authHeader, principalUrl) {
  const res = await fetch(principalUrl, {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/xml",
      Depth: "0",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set /></d:prop>
</d:propfind>`,
  });

  const xml = await res.text();
  const match = xml.match(/<c:href>([^<]+)<\/c:href>/i)
    || xml.match(/calendar-home[^>]*>.*?<[^>]*href>([^<]+)/is);
  if (!match) return null;
  const path = match[1];
  return path.startsWith("http") ? path : `${new URL(principalUrl).origin}${path}`;
}

async function _findDefaultCalendar(authHeader, calendarHomeUrl) {
  const res = await fetch(calendarHomeUrl, {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/xml",
      Depth: "1",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <c:supported-calendar-component-set />
  </d:prop>
</d:propfind>`,
  });

  const xml = await res.text();
  // Find first VEVENT-capable calendar
  const sections = xml.split("<d:response>").slice(1);
  for (const section of sections) {
    if (section.includes("VEVENT")) {
      const hrefMatch = section.match(/<d:href>([^<]+)<\/d:href>/i);
      if (hrefMatch) {
        const path = hrefMatch[1];
        const origin = new URL(calendarHomeUrl).origin;
        return path.startsWith("http") ? path : `${origin}${path}`;
      }
    }
  }
  return null;
}

// ─── Fetch busy slots via REPORT ──────────────────────────────────────────────

async function _fetchBusy(authHeader, calendarUrl) {
  const now = new Date();
  const fourWeeksOut = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);

  const timeMin = _toCalDAVDate(now);
  const timeMax = _toCalDAVDate(fourWeeksOut);

  const res = await fetch(calendarUrl, {
    method: "REPORT",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/xml",
      Depth: "1",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${timeMin}" end="${timeMax}" />
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
  });

  if (!res.ok) return [];
  const xml = await res.text();
  return _parseVCalendarBusy(xml);
}

// ─── Parse VCALENDAR text from REPORT response ────────────────────────────────

function _parseVCalendarBusy(xml) {
  const slots = [];
  // Extract all calendar-data blocks
  const calDataMatches = xml.matchAll(/<c:calendar-data[^>]*>([\s\S]*?)<\/c:calendar-data>/gi);
  for (const [, calData] of calDataMatches) {
    // Decode HTML entities
    const decoded = calData.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const events = decoded.split("BEGIN:VEVENT").slice(1);
    for (const block of events) {
      const dtstart = _parseIcsDate(block.match(/DTSTART[^:\n]*:(.*)/)?.[1]?.trim());
      const dtend = _parseIcsDate(block.match(/DTEND[^:\n]*:(.*)/)?.[1]?.trim());
      if (dtstart && dtend) {
        slots.push({ start: dtstart.toISOString(), end: dtend.toISOString() });
      }
    }
  }
  return slots;
}

function _parseIcsDate(str) {
  if (!str) return null;
  // Handle formats: 20231025T140000Z, 20231025T140000, 20231025
  if (str.length === 8) {
    return new Date(`${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`);
  }
  const iso = str.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/,
    "$1-$2-$3T$4:$5:$6$7"
  );
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function _toCalDAVDate(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// ─── Build ICS content for a new/updated event ───────────────────────────────

function _buildIcs(event) {
  const now = _toCalDAVDate(new Date());
  const dtstart = _toCalDAVDate(new Date(event.dtstart));
  const dtend = _toCalDAVDate(new Date(event.dtend));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Do-Do App//EN",
    "BEGIN:VEVENT",
    `UID:${event.uid}@do-do-app`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${(event.summary || "").replace(/\n/g, "\\n")}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}` : null,
    event.rrule ? event.rrule : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}
