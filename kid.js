const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const KID_TOKEN = params.get("token") || "";
const SESSION_KEY = "kid-session-v1:" + KID_TOKEN;
let activeSession = null;

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const tom = new Date(); tom.setDate(today.getDate() + 1);
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tom.toDateString()) return "Tomorrow";
  const diff = Math.round((d - today) / 86400000);
  if (diff > 0 && diff < 7) return days[d.getDay()];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

// ── PIN ──────────────────────────────────────────────────────────────────────
let pin = "", busy = false;

function updateDots() {
  for (let i = 0; i < 4; i++) $("d" + i).classList.toggle("filled", i < pin.length);
}

$("pinKeypad").addEventListener("click", (e) => {
  const key = e.target.closest(".pin-key");
  if (!key || busy) return;
  if (key.id === "pinDel") { pin = pin.slice(0, -1); updateDots(); return; }
  const d = key.dataset.d;
  if (d === undefined) return;
  if (pin.length >= 4) return;
  pin += d;
  updateDots();
  $("pinErr").textContent = "";
  if (pin.length === 4) submitPin();
});

async function submitPin() {
  busy = true;
  try {
    const r = await fetch("/api/guest-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "kid-auth", token: KID_TOKEN, pin }),
    });
    const data = await r.json();
    if (data.ok) {
      activeSession = data.session;
      try { localStorage.setItem(SESSION_KEY, data.session); } catch {}
      loadDashboard(data.session);
    } else if (data.error === "wrong_pin") {
      $("pinErr").textContent = data.attemptsLeft > 0
        ? `Wrong PIN - ${data.attemptsLeft} tr${data.attemptsLeft === 1 ? "y" : "ies"} left`
        : "Too many tries. Wait 10 minutes.";
      pin = ""; updateDots();
    } else if (data.error === "locked") {
      $("pinErr").textContent = "Too many wrong tries. Wait 10 minutes.";
      pin = ""; updateDots();
    } else {
      $("pinErr").textContent = "Something went wrong. Try again.";
      pin = ""; updateDots();
    }
  } catch {
    $("pinErr").textContent = "Connection error. Check your internet.";
    pin = ""; updateDots();
  }
  busy = false;
}

// ── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard(session) {
  showScreen("dashScreen");
  $("dashContent").innerHTML = `<div class="loading">Loading...</div>`;
  try {
    const r = await fetch(
      `/api/guest-view?type=kid&token=${encodeURIComponent(KID_TOKEN)}&session=${encodeURIComponent(session)}`
    );
    if (r.status === 401) {
      try { localStorage.removeItem(SESSION_KEY); } catch {}
      activeSession = null;
      pin = ""; updateDots();
      showScreen("pinScreen");
      $("pinErr").textContent = "Session expired. Enter your PIN again.";
      return;
    }
    const data = await r.json();
    renderDashboard(data);
  } catch {
    $("dashContent").innerHTML = `<div class="loading">Could not load. Check your internet.</div>`;
  }
}

function renderDashboard(data) {
  const name = data.childName || "";
  const today = new Date();
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const upcoming = (data.cards || []).filter((c) => c.dueAt && c.status !== "done");
  const undated  = (data.cards || []).filter((c) => !c.dueAt && c.status !== "done");

  const cardHtml = (c) => {
    const svg = c.type === "event"
      ? `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
    return `<div class="kid-card">
      <div class="kid-card-icon">${svg}</div>
      <div class="kid-card-body">
        <div class="kid-card-title">${esc(c.title)}</div>
        ${c.dueAt ? `<div class="kid-card-due">${fmtDate(c.dueAt)}</div>` : ""}
      </div>
      ${c.createdByKid ? `<span class="kid-card-mine">Mine</span>` : ""}
    </div>`;
  };

  $("dashContent").innerHTML = `
    <div class="dash-header">
      <div class="dash-avatar">${esc(name.charAt(0).toUpperCase())}</div>
      <div>
        <div class="dash-name">Hi ${esc(name)}!</div>
        <div class="dash-date">${dayNames[today.getDay()]}, ${today.getDate()} ${monthNames[today.getMonth()]}</div>
      </div>
    </div>
    ${data.note ? `<div class="dash-note"><div class="dash-note-label">Note from parents</div><div class="dash-note-text">${esc(data.note)}</div></div>` : ""}
    <div class="dash-section">
      <div class="dash-section-title">Coming up</div>
      ${upcoming.length ? upcoming.map(cardHtml).join("") : `<div class="empty-note">Nothing due this week!</div>`}
    </div>
    ${undated.length ? `<div class="dash-section"><div class="dash-section-title">To do</div>${undated.map(cardHtml).join("")}</div>` : ""}
  `;
}

// ── New card form ────────────────────────────────────────────────────────────
$("newCardFab").addEventListener("click", () => {
  $("cardDue").min = new Date().toISOString().split("T")[0];
  showScreen("formScreen");
  setTimeout(() => $("cardTitle").focus(), 60);
});

$("formBack").addEventListener("click", () => showScreen("dashScreen"));

$("newCardForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("cardSubmit");
  btn.disabled = true;
  btn.textContent = "Sending...";
  try {
    const r = await fetch("/api/guest-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "kid-card",
        token: KID_TOKEN,
        session: activeSession,
        title: $("cardTitle").value.trim(),
        due: $("cardDue").value || null,
        details: $("cardDetails").value.trim() || null,
      }),
    });
    const data = await r.json();
    if (data.ok) {
      $("newCardForm").reset();
      showScreen("dashScreen");
      toast("Sent to your parents!");
      loadDashboard(activeSession);
    } else {
      toast("Could not send. Try again.");
    }
  } catch {
    toast("Connection error. Try again.");
  }
  btn.disabled = false;
  btn.textContent = "Send to parents";
});

// ── Startup ──────────────────────────────────────────────────────────────────
if (!KID_TOKEN) {
  showScreen("pinScreen");
  $("pinErr").textContent = "Invalid link. Ask a parent for the correct one.";
} else {
  let saved = null;
  try { saved = localStorage.getItem(SESSION_KEY); } catch {}
  if (saved) {
    activeSession = saved;
    loadDashboard(saved);
  } else {
    showScreen("pinScreen");
  }
}
