// guide.js - In-app guide system (Pendo-like)
// Loaded after i18n.js, before app.js.
//
// Usage:
//   window.GuideEngine.show('welcome')      - launch a guide
//   window.GuideEngine.reset('welcome')     - mark not done and re-launch
//   window.GuideEngine.isDone('welcome')    - returns true/false
//   window.GuideEngine.dismiss()            - skip remaining steps

(function () {
  "use strict";

  // ─── Storage ────────────────────────────────────────────────────────────────

  const STORAGE_PREFIX = "do-do-guide-done-";

  function markDone(guideId) {
    try { localStorage.setItem(STORAGE_PREFIX + guideId, "1"); } catch (_) {}
  }

  function markNotDone(guideId) {
    try { localStorage.removeItem(STORAGE_PREFIX + guideId); } catch (_) {}
  }

  function isDone(guideId) {
    try { return localStorage.getItem(STORAGE_PREFIX + guideId) === "1"; } catch (_) { return false; }
  }

  // ─── Guide definitions ──────────────────────────────────────────────────────
  // Each step:
  //   target   - CSS selector to spotlight. null = centred modal (no spotlight).
  //   navigate - module to switch to before showing this step (optional).
  //              The engine calls window.switchModule(navigate) then waits for
  //              the DOM to settle before positioning the spotlight.
  //   titleKey - i18n key for tooltip title
  //   bodyKey  - i18n key for tooltip body
  //   position - preferred tooltip position: top | bottom | left | right | center

  const GUIDES = {

    // Welcome: all steps on the board - just highlight nav items
    welcome: [
      { target: null,
        titleKey: "guide.welcome.1.title", bodyKey: "guide.welcome.1.body", position: "center" },
      { target: ".module-link[data-module='board']",
        titleKey: "guide.welcome.2.title", bodyKey: "guide.welcome.2.body", position: "bottom" },
      { target: ".module-link[data-module='calendar']",
        titleKey: "guide.welcome.3.title", bodyKey: "guide.welcome.3.body", position: "bottom" },
      { target: ".module-link[data-module='shopping']",
        titleKey: "guide.welcome.4.title", bodyKey: "guide.welcome.4.body", position: "bottom" },
    ],

    // Setup parents: steps 2-3 are in Settings
    "setup-parents": [
      { target: null,
        titleKey: "guide.parents.1.title", bodyKey: "guide.parents.1.body", position: "center" },
      { target: "#caregiversPanel",        navigate: "settings",
        titleKey: "guide.parents.2.title", bodyKey: "guide.parents.2.body", position: "top" },
      { target: "#invitePanelContent",     navigate: "settings",
        titleKey: "guide.parents.3.title", bodyKey: "guide.parents.3.body", position: "top" },
    ],

    // Setup children: step 2 is in Settings
    "setup-children": [
      { target: null,
        titleKey: "guide.children.1.title", bodyKey: "guide.children.1.body", position: "center" },
      { target: "#addChildBtn",             navigate: "settings",
        titleKey: "guide.children.2.title", bodyKey: "guide.children.2.body", position: "bottom" },
      { target: null,
        titleKey: "guide.children.3.title", bodyKey: "guide.children.3.body", position: "center" },
    ],

    // Schedule: steps 2+ are in Calendar
    "setup-schedule": [
      { target: ".module-link[data-module='calendar']",
        titleKey: "guide.schedule.1.title", bodyKey: "guide.schedule.1.body", position: "bottom" },
      { target: "#calPageBcalSection",      navigate: "calendar",
        titleKey: "guide.schedule.2.title", bodyKey: "guide.schedule.2.body", position: "top" },
      { target: ".module-link[data-module='przekazanie']",
        titleKey: "guide.schedule.3.title", bodyKey: "guide.schedule.3.body", position: "bottom" },
      { target: null,
        titleKey: "guide.schedule.4.title", bodyKey: "guide.schedule.4.body", position: "center" },
    ],

    // Vacation: step 2 needs the calendar mini picker visible
    "setup-vacation": [
      { target: null,
        titleKey: "guide.vacation.1.title", bodyKey: "guide.vacation.1.body", position: "center" },
      { target: ".mini-cal-picker",          navigate: "calendar",
        titleKey: "guide.vacation.2.title", bodyKey: "guide.vacation.2.body", position: "top" },
      { target: null,
        titleKey: "guide.vacation.3.title", bodyKey: "guide.vacation.3.body", position: "center" },
    ],

    // Calendar connect: step 2 is the calendar settings panel in Settings
    "calendar-connect": [
      { target: null,
        titleKey: "guide.calcon.1.title", bodyKey: "guide.calcon.1.body", position: "center" },
      { target: "#calendarSettingsPanel",  navigate: "settings",
        titleKey: "guide.calcon.2.title", bodyKey: "guide.calcon.2.body", position: "top" },
      { target: null,
        titleKey: "guide.calcon.3.title", bodyKey: "guide.calcon.3.body", position: "center" },
    ],

    // Shopping: step 2 needs to be on Shopping to see the add button
    shopping: [
      { target: ".module-link[data-module='shopping']",
        titleKey: "guide.shopping.1.title", bodyKey: "guide.shopping.1.body", position: "bottom" },
      { target: ".shopping-add",             navigate: "shopping",
        titleKey: "guide.shopping.2.title", bodyKey: "guide.shopping.2.body", position: "top" },
      { target: null,
        titleKey: "guide.shopping.3.title", bodyKey: "guide.shopping.3.body", position: "center" },
    ],
  };

  // ─── State ──────────────────────────────────────────────────────────────────

  let _activeGuideId = null;
  let _activeSteps   = [];
  let _currentStep   = 0;
  let _overlay       = null;
  let _tooltip       = null;
  let _spotEl        = null;

  // ─── DOM helpers ────────────────────────────────────────────────────────────

  function _ensureDOM() {
    if (_overlay && _tooltip) return;
    _overlay = document.getElementById("guide-overlay");
    _tooltip = document.getElementById("guide-tooltip");
    _spotEl  = document.getElementById("guide-spotlight");
  }

  function _t(key) {
    return (window.t && window.t(key)) || key;
  }

  // ─── Spotlight positioning ───────────────────────────────────────────────────

  const SPOT_PAD = 8; // px padding around target element

  function _positionSpotlight(target) {
    if (!_spotEl) return;
    if (!target) {
      _spotEl.style.display = "none";
      return;
    }
    const el = (typeof target === "string") ? document.querySelector(target) : target;
    if (!el) {
      _spotEl.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    _spotEl.style.display = "block";
    _spotEl.style.top    = (r.top  - SPOT_PAD + window.scrollY) + "px";
    _spotEl.style.left   = (r.left - SPOT_PAD + window.scrollX) + "px";
    _spotEl.style.width  = (r.width  + SPOT_PAD * 2) + "px";
    _spotEl.style.height = (r.height + SPOT_PAD * 2) + "px";
  }

  // ─── Tooltip positioning ─────────────────────────────────────────────────────

  function _positionTooltip(targetSel, preferredPos) {
    if (!_tooltip) return;

    const isMobile = window.innerWidth < 640;

    // Mobile: always anchor to bottom of screen
    if (isMobile) {
      _tooltip.className = "guide-tooltip guide-tooltip-mobile";
      _tooltip.style.cssText = "";
      return;
    }

    if (!targetSel) {
      _tooltip.className = "guide-tooltip guide-tooltip-center";
      _tooltip.style.cssText = "";
      return;
    }

    const el = document.querySelector(targetSel);
    if (!el) {
      _tooltip.className = "guide-tooltip guide-tooltip-center";
      _tooltip.style.cssText = "";
      return;
    }

    const r   = el.getBoundingClientRect();
    const tw  = 320;
    const th  = 160;
    const vw  = window.innerWidth;
    const pos = preferredPos || "bottom";

    _tooltip.className = "guide-tooltip guide-tooltip-" + pos;

    if (pos === "bottom") {
      let left = r.left + r.width / 2 - tw / 2;
      left = Math.max(12, Math.min(left, vw - tw - 12));
      _tooltip.style.cssText = `top:${r.bottom + SPOT_PAD + 8}px;left:${left}px;`;
    } else if (pos === "top") {
      let left = r.left + r.width / 2 - tw / 2;
      left = Math.max(12, Math.min(left, vw - tw - 12));
      const top = Math.max(12, r.top - th - SPOT_PAD - 8);
      _tooltip.style.cssText = `top:${top}px;left:${left}px;`;
    } else if (pos === "right") {
      _tooltip.style.cssText = `top:${r.top}px;left:${r.right + SPOT_PAD + 8}px;`;
    } else if (pos === "left") {
      _tooltip.style.cssText = `top:${r.top}px;left:${r.left - tw - SPOT_PAD - 8}px;`;
    } else {
      _tooltip.className = "guide-tooltip guide-tooltip-center";
      _tooltip.style.cssText = "";
    }
  }

  // ─── Render a step ────────────────────────────────────────────────────────────
  // If step.navigate is set, switch to that module first and wait for render
  // before positioning the spotlight.

  function _renderStep() {
    _ensureDOM();
    if (!_overlay || !_tooltip) return;

    const step = _activeSteps[_currentStep];

    // If this step needs a different module, navigate there first then re-render
    if (step.navigate && window.switchModule) {
      // Show overlay immediately so there is no blank gap
      _overlay.hidden = false;
      if (_spotEl) _spotEl.style.display = "none";
      if (_tooltip) _tooltip.hidden = true;

      window.switchModule(step.navigate);

      // Wait for the module's DOM to render (two ticks: switchModule + React/render)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          _renderStepDOM(step);
        });
      });
      return;
    }

    _renderStepDOM(step);
  }

  function _renderStepDOM(step) {
    _ensureDOM();
    const total = _activeSteps.length;
    const num   = _currentStep + 1;

    const dots = Array.from({ length: total }, (_, i) =>
      `<span class="guide-dot${i <= _currentStep ? " guide-dot-done" : ""}"></span>`
    ).join("");

    const isLast = _currentStep === total - 1;

    _tooltip.innerHTML = `
      <div class="guide-header">
        <div class="guide-dots">${dots}</div>
        <button class="guide-skip" id="guideSkipBtn" aria-label="${_t("guide.skip")}">${_t("guide.skip")}</button>
      </div>
      <h3 class="guide-title">${_t(step.titleKey)}</h3>
      <p  class="guide-body">${_t(step.bodyKey)}</p>
      <div class="guide-footer">
        <span class="guide-step-count">${_t("guide.step_of").replace("{n}", num).replace("{total}", total)}</span>
        <button class="guide-next primary-button" id="guideNextBtn">
          ${isLast ? _t("guide.done") : _t("guide.next")}
        </button>
      </div>
    `;

    _tooltip.hidden = false;
    _overlay.hidden = false;

    _positionSpotlight(step.target);
    _positionTooltip(step.target, step.position);

    // Scroll target into view if needed
    if (step.target) {
      const el = document.querySelector(step.target);
      el?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }

    document.getElementById("guideNextBtn")?.addEventListener("click", next);
    document.getElementById("guideSkipBtn")?.addEventListener("click", dismiss);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  function show(guideId) {
    const steps = GUIDES[guideId];
    if (!steps || isDone(guideId)) return;
    _activeGuideId = guideId;
    _activeSteps   = steps;
    _currentStep   = 0;
    _renderStep();
  }

  function next() {
    if (!_activeGuideId) return;
    _currentStep++;
    if (_currentStep >= _activeSteps.length) {
      _finish();
    } else {
      _renderStep();
    }
  }

  function dismiss() {
    _finish();
  }

  function reset(guideId) {
    markNotDone(guideId);
    show(guideId);
  }

  function _finish() {
    const id = _activeGuideId;
    _ensureDOM();
    if (_overlay) _overlay.hidden = true;
    if (_tooltip) { _tooltip.hidden = true; _tooltip.innerHTML = ""; }
    if (_spotEl)  _spotEl.style.display = "none";
    _activeGuideId = null;
    _activeSteps   = [];
    _currentStep   = 0;
    if (id) markDone(id);

    // Chain: welcome -> setup-parents automatically
    if (id === "welcome") {
      setTimeout(() => show("setup-parents"), 400);
    }
  }

  // Reposition on resize
  window.addEventListener("resize", function () {
    if (!_activeGuideId || _activeSteps.length === 0) return;
    const step = _activeSteps[_currentStep];
    _positionSpotlight(step.target);
    _positionTooltip(step.target, step.position);
  });

  // ─── Export ──────────────────────────────────────────────────────────────────

  window.GuideEngine = { show, next, dismiss, reset, isDone };

})();
