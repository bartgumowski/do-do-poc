// i18n.js - Do-Do translation engine
// Loaded before app.js and features.js so window.t() is available everywhere.
//
// Usage:
//   window.t('nav.board')           -> "Board" / "Tablica" / "Board"
//   window.t('shopping.items_left', { n: 3 }) -> "3 left" / "3 pozostało"
//   window.setLanguage('pl')        -> switches language + re-renders UI
//   window.getCurrentLang()         -> 'en' | 'de' | 'pl'

(function () {
  // ─── Dictionaries ─────────────────────────────────────────────────────────────

  const DICT = {

    // ── English ────────────────────────────────────────────────────────────────
    en: {
      // Navigation
      "nav.board":    "Board",
      "nav.calendar": "Calendar",
      "nav.messages": "Messages",
      "nav.shopping": "Shopping",
      "nav.expenses": "Expenses",
      "nav.settings": "Settings",

      // Board
      "board.col.decide": "To decide",
      "board.col.mine":   "Mine",
      "board.col.done":   "Done",
      "board.archived":   "Archived",
      "board.empty_title":"Nothing on the board yet",
      "board.empty_cta":  "New Do",
      "board.new_do":     "New Do",

      // Card status labels (used for board column assignment and display)
      "status.todo":     "To Do",
      "status.waiting":  "Waiting",
      "status.important":"Important",
      "status.disputed": "Disputed",
      "status.done":     "Done",
      "status.info":     "Info Only",
      "status.request":  "Request",

      // Card dialog
      "card.new":              "New Do",
      "card.info_thread":      "Information and thread",
      "card.save":             "Save",
      "card.cancel":           "Cancel",
      "card.delete":           "Delete",
      "card.done_btn":         "Done",
      "card.paid_btn":         "Paid",
      "card.completed_btn":    "Completed",
      "card.edit":             "Edit",
      "card.got_it":           "Got it",
      "card.details_ph":       "What needs to be done? Speak or type naturally - date, people and reminder fill in automatically.",
      "card.message_ph":       "Write a message...",
      "card.reminder_heading": "Reminder",
      "card.payment_heading":  "Payment",
      "card.receipt_heading":  "Receipt",
      "card.attach_receipt":   "Attach receipt",
      "card.added_by":         "Added by",
      "card.added_on":         "Added on",
      "card.edited_by":        "Edited by",
      "card.edited_on":        "Edited on",
      "card.in_calendar":      "In calendar",
      "card.alert":            "Alert",
      "card.view_hint":        "Read only - tap Edit to make changes",

      // Quick actions
      "action.ill_do_it":    "I'll do it",
      "action.please_do_it": "Please do it",
      "action.cant":         "Can't",

      // Reminder preset options
      "reminder.at_due":  "At due time",
      "reminder.min15":   "15 minutes before",
      "reminder.hr1":     "1 hour before",
      "reminder.hr2":     "2 hours before",
      "reminder.day1":    "1 day before",
      "reminder.custom":  "Custom time",
      "reminder.clear":   "Clear",
      "reminder.save":    "Save",

      "card.recurrence_heading": "Repeat",
      "recurrence.none":     "Does not repeat",
      "recurrence.daily":    "Daily",
      "recurrence.weekly":   "Weekly",
      "recurrence.biweekly": "Every 2 weeks",
      "recurrence.monthly":  "Monthly",
      "recurrence.c223":     "2-2-3 custody",
      "recurrence.wowo":         "Week-on / week-off",
      "recurrence.custom_dates": "Custom dates...",
      "recurrence.pick_hint":    "Tap dates to add them",
      "day.mo": "Mo", "day.tu": "Tu", "day.we": "We",
      "day.th": "Th", "day.fr": "Fr", "day.sa": "Sa", "day.su": "Su",

      // Card types
      "type.task":    "Task",
      "type.event":   "Event",
      "type.expense": "Expense",
      "type.info":    "Info",
      "type.request": "Request",
      "type.vaccine": "Vaccine",

      // Topics
      "topic.schedule": "Schedule",
      "topic.school":   "School",
      "topic.medical":  "Medical",
      "topic.expenses": "Expenses",
      "topic.general":  "General",

      // Shopping
      "shopping.groceries":    "Groceries",
      "shopping.other":        "Other",
      "shopping.items_left":   "{{n}} left",
      "shopping.add_ph":       "Add or dictate an item",
      "shopping.marked_bought":"Marked as bought",
      "shopping.returned":     "Returned to list",
      "shopping.removed":      "Removed",
      "shopping.clear_bought": "Clear bought ({{n}})",
      "shopping.no_items":     "No shopping items yet.",
      "shopping.dictate":      "Dictate item",
      "shopping.add_list":     "Add new list",
      "shopping.new_list_prompt": "Add new list",

      // Expenses
      "expense.total":          "Expense total",
      "expense.desc":           "Every expense is a normal Do with its discussion, people, date, and status attached.",
      "expense.all":            "All expenses",
      "expense.open":           "Open",
      "expense.paid":           "Paid",
      "expense.balance":        "Balance",
      "expense.settled":        "Settled up",
      "expense.they_owe":       "They owe you {{sym}} {{amt}}",
      "expense.you_owe":        "You owe {{sym}} {{amt}}",
      "expense.add":            "Add expense",
      "expense.request_pay":    "Request payment",
      "expense.send_request":   "Send payment request",
      "expense.awaiting":       "requested – awaiting payment",
      "expense.open_link":      "Open payment link",
      "expense.mark_paid":      "Mark paid",
      "expense.approve":        "Approve",
      "expense.dispute":        "Dispute",
      "expense.request_amount":              "Request amount",
      "expense.no_expenses":                 "No expense Dos yet.",
      "expense.export_pdf":                  "Export PDF",
      "expense.export_csv":                  "Export CSV",
      "expense.payment_history":             "Payment history",
      "expense.ledger_created":              "Expense created",
      "expense.ledger_amount_set":           "Amount updated",
      "expense.ledger_payment_requested":    "Payment requested",
      "expense.ledger_payment_sent":         "Payment sent",
      "expense.ledger_payment_confirmed":    "Payment confirmed",
      "expense.ledger_marked_paid_manual":   "Marked as paid",
      "expense.ledger_receipt_uploaded":     "Receipt uploaded",

      // Payment split options
      "pay.split_5050": "50/50 split",
      "pay.split_100t": "100% them",
      "pay.split_60":   "60% them / 40% me",
      "pay.split_40":   "40% them / 60% me",
      "pay.split_me":   "I'll cover it",
      "pay.sending":    "Sending...",

      // Messages
      "msg.family_messages": "Family messages",
      "msg.loading":         "Loading messages...",
      "msg.send":            "Send",
      "msg.placeholder":     "Message #{{topic}}",

      // Settings
      "settings.your_profile":    "Your profile",
      "settings.display_name":    "Your display name",
      "settings.coparent_name":   "Co-parent name (local)",
      "settings.children":        "Children",
      "settings.add_child":       "+ Add child",
      "settings.pets":            "Pets",
      "settings.add_pet":         "+ Add pet",
      "settings.no_children":     "No children added yet.",
      "settings.no_pets":         "No pets added yet.",
      "settings.coparent":        "Co-parent",
      "settings.account":         "Account",
      "settings.sign_out":        "Sign out",
      "settings.download_data":   "Download my data",
      "settings.privacy":         "Privacy & Terms",
      "settings.delete_account":  "Delete account",
      "settings.subscription":    "Subscription",
      "settings.notifications":   "Notifications",
      "settings.appearance":      "Appearance",
      "settings.language":        "Language",
      "settings.language_label":  "App language",
      "settings.language_hint":   "Choose English, Deutsch or Polski.",
      "settings.theme":           "Theme",
      "settings.theme_hint":      "Follow your device setting or choose a fixed appearance.",
      "settings.theme_system":    "Use system setting",
      "settings.theme_light":     "Light",
      "settings.theme_dark":      "Dark",
      "settings.gcal":            "Google Calendar",
      "settings.gcal_hint":       "Sign out and back in to reconnect calendar sync",
      "settings.automation":      "Automation",
      "settings.version":         "Version",
      "settings.connected":       "Connected - on the same board",
      "settings.not_joined":      "Not joined yet",
      "settings.pending_invite":  "Invite link",
      "settings.resend":          "Re-send email",
      "settings.copy_link":       "Copy link",
      "settings.copied":          "Copied!",

      // Auth
      "auth.sign_in":   "Sign in",
      "auth.sign_up":   "Create account",
      "auth.email":     "Email",
      "auth.password":  "Password",
      "auth.or":        "or",

      // Guest preview (SEG-13)
      "invite.preview_btn":   "Just looking? Preview without an account",
      "invite.preview_note":  "Nothing is shared back until you decide to join.",
      "guest.badge":          "Read-only preview",
      "guest.banner":         "You are viewing a read-only preview. No account was created and nothing is shared back.",
      "guest.hero_title":     "{{name}}'s shared board",
      "guest.hero_title_kids":"Shared board for {{kids}}",
      "guest.hero_sub":       "This is the shared board - both parents always see the same thing.",
      "guest.join_cta":       "Join the board",
      "guest.back":           "Back",
      "guest.privacy_line":   "Data is stored on EU servers under GDPR.",
      "guest.privacy_link":   "How we protect your data",
      "guest.empty":          "The board is still empty - nothing has been added yet.",
      "guest.error":          "Could not load the preview. The link may have expired.",
      "guest.due":            "Due",

      // Toasts
      "toast.joined":         "Joined the family board",
      "toast.signed_out":     "Signed out",
      "toast.marked_done":    "Marked done",
      "toast.marked_paid":    "Marked paid",
      "toast.marked_bought":  "Marked as bought",
      "toast.returned":       "Returned to list",
      "toast.removed":        "Removed",
      "toast.updated":        "Updated",
      "toast.sent":           "Sent",
      "toast.pay_sent":       "Payment request sent by email.",
      "toast.pay_created":    "Payment link created.",
      "toast.receipt_up":     "Receipt uploaded.",
      "toast.exported":       "Data exported - check your downloads.",
      "toast.name_updated":   "Name updated to {{name}}",
      "toast.lang_changed":   "Language updated",
      "toast.added":          "Added",

      // Module topbar titles
      "module.title.expenses":  "Shared expenses",
      "module.title.settings":  "Automation and family",
      "module.title.calendar":  "Shared schedule",
      "module.title.messages":  "Family messages",
      "module.title.shopping":  "Shopping list",

      // Automation settings panel
      "auto.remind_toggle":            "Automate all reminders",
      "auto.remind_toggle_hint":       "Cards with a date get a reminder automatically.",
      "auto.family_cal":               "Sync family calendar",
      "auto.family_cal_hint":          "Dated Dos sync to the selected shared calendar.",
      "auto.family_cal_provider":      "Shared calendar provider",
      "auto.family_cal_provider_hint": "Use Google Calendar or Outlook as the family's main calendar.",
      "auto.global_reminder":          "Global reminder time",
      "auto.global_reminder_hint":     "Used for new cards and automatic calendar reminders.",
      "auto.delivery":                 "Reminder delivery",
      "auto.delivery_hint":            "Choose how reminders reach you: inside Do-Do, via your family calendar, or both.",
      "auto.cal_connections":          "Calendar connections",
      "auto.family_cal_label":         "Family calendar",
      "auto.family_cal_ready":         "Ready to sync dated Dos to {{provider}} Calendar.",
      "auto.family_cal_connect_hint":  "Choose Google or Outlook and connect the family's main calendar.",
      "auto.privacy":                  "Family privacy boundary",
      "auto.privacy_hint":             "Every family is a separate workspace. No other family can access its Dos, messages, or calendar.",
      "auto.work_cal":                 "Private work availability",
      "auto.work_cal_hint":            "Optional. Import busy blocks only. Titles, attendees, and notes stay private.",
      "auto.work_provider":            "Work calendar provider",
      "auto.work_provider_hint":       "Connect Google or Microsoft Outlook for private conflict visibility.",
      "auto.work_connect":             "Connect work calendars",
      "auto.work_connect_hint":        "You can connect either or both. Imported items remain busy-only blocks.",
      "auto.work_shared":              "Shared from work calendar",
      "auto.work_shared_hint":         "Only occupied time ranges become visible inside the family calendar.",
      "auto.isolated":                 "Isolated",
      "auto.busy_only":                "Busy only",
      "auto.delivery_app_only":        "App only",
      "auto.delivery_cal_only":        "Family calendar only",
      "auto.delivery_cal_app":         "Calendar + Do-Do",
      "auto.connect_btn":              "Connect",
      "auto.on":                       "On",

      // Custody settings panel
      "custody.heading":      "Parenting schedule",
      "custody.desc":         "Colour-code calendar days to show who has the kids.",
      "custody.show":         "Show custody calendar",
      "custody.show_hint":    "Highlight which days belong to each parent.",
      "custody.type":         "Schedule type",
      "custody.type_hint":    "Choose your custody arrangement.",
      "custody.7_7":          "Alternating weeks (7-7)",
      "custody.2_2_3":        "2-2-3 rotation",
      "custody.5_2":          "Weekdays mine / weekends co-parent",
      "custody.starts":       "My schedule starts",
      "custody.starts_hint":  "First day of your current custody period.",
      "custody.my_color":     "My days colour",
      "custody.co_color":     "Co-parent days colour",

      // Share panel
      "share.heading":        "Share Do-Do",
      "share.desc":           "Know someone juggling shared responsibilities? Send them the link.",
      "share.whatsapp":       "Share via WhatsApp",
      "share.email_btn":      "Share via email",

      // Coparent invite panel
      "invite.heading":       "Invite your co-parent",
      "invite.paid_desc":     "Shared board and collaboration require the Family plan.",
      "invite.upgrade":       "Upgrade",
      "invite.no_email":      "Add your co-parent's email in onboarding to send an invite.",
      "invite.sending":       "Sending...",

      // Misc
      "settings.checking":    "Checking connection...",
      "settings.loading":     "Loading...",

      // Stats bar
      "stats.needs":          "Needs response",
      "stats.waiting":        "Waiting",
      "stats.todo":           "To do",
      "stats.expenses":       "Expenses",
      "stats.messages":       "Messages",
      "stats.reminders":      "Reminders",

      // Card status labels
      "card.done":            "Done",
      "card.completed":       "Completed",
      "card.waiting":         "Waiting",
      "card.urgent":          "Urgent",
      "card.needs_response":  "Needs response",
      "card.paid":            "Paid",
      "card.vaccine_badge":   "Vaccine",

      // Card action buttons
      "card.action.do":       "I'll do it",
      "card.action.will":     "Please do it",
      "card.action.cannot":   "Can't",
      "card.action.reminder": "Reminder",
      "card.action.message":  "Message",

      // Apple Calendar section
      "apple.heading":        "Apple Calendar (iCloud)",
      "apple.connected":      "Connected",
      "apple.not_connected":  "Not connected",
      "apple.note":           "iPhone users: connect iCloud Calendar to see your busy blocks and sync Do-Do events. Requires an app-specific password from appleid.apple.com - Security - App-Specific Passwords.",
      "apple.connected_as":   "Connected as",
      "apple.disconnect":     "Disconnect",
      "apple.email_label":    "iCloud email",
      "apple.pass_label":     "App-specific password",
      "apple.connect_btn":    "Connect iCloud Calendar",

      // Co-parent calendar section
      "copcal.heading":       "Co-parent calendar",
      "copcal.note":          "Your co-parent connects their own calendar from their device in their Do-Do settings. Once connected, their busy blocks show on your shared calendar in a different color - without exposing any event details.",
      "copcal.your_cal":      "Your calendar",
      "copcal.connected_busy":"Connected - busy blocks shared",
      "copcal.not_connected": "Not connected",
      "copcal.active":        "Active",
      "copcal.set_up_above":  "Set up above",
      "copcal.coparent_cal":  "Co-parent's calendar",
      "copcal.visible_once":  "Visible once they connect from their device.",
      "copcal.checking":      "Checking...",

      // Subscription section
      "sub.free":             "Free plan",
      "sub.trial":            "Family - free trial",
      "sub.active":           "Family",
      "sub.past_due":         "Family - payment past due",
      "sub.canceled":         "Canceled",
      "sub.renews":           "Renews",
      "sub.manage":           "Manage",
      "sub.opening":          "Opening...",
      "sub.dos_used":         "Dos used",
      "sub.upgrade_note":     "Upgrade for unlimited Dos, calendar sync, AI, and co-parent collaboration.",
      "sub.upgrade_btn":      "Upgrade to Family",

      // Vaccine section
      "vaccine.heading":      "Vaccine schedule",
      "vaccine.add":          "+ Add vaccine",
      "vaccine.empty":        "No vaccine cards yet. Add one to track due dates and reminders.",
      "vaccine.open":         "Open",
      // Calendar
      "cal.view.month":       "Month",
      "cal.view.week":        "Week",
      "cal.view.day":         "Day",
      "cal.parenting_schedule": "Parenting schedule",
      "cal.set_up_schedule":  "Set up parenting schedule",
      "cal.selected_day":     "Selected day",
      "add_do":               "Add Do",
      "cal.add_do":           "Add Do",
      "cal.no_dos":           "No Dos on this day.",
      "cal.my_days":          "My days",
      "cal.co_days":          "Co-parent days",
      "cal.no_schedule":      "No schedule set",
      "cal.overridden":       "overridden",
      "cal.handover":         "Handover",
      "cal.mine":             "Mine",
      "cal.split":            "Split",
      "cal.reset":            "Reset",
      "cal.item":             "item",
      "cal.item_s":           "s",
      "cal.clear":            "Clear",
      "cal.no_events":        "No events on this day.",
      "cal.all_day":          "All day",
      "cal.toast_do_added":   "Do added to selected day",
    },

    // ── Deutsch ────────────────────────────────────────────────────────────────
    de: {
      "nav.board":    "Board",
      "nav.calendar": "Kalender",
      "nav.messages": "Nachrichten",
      "nav.shopping": "Einkauf",
      "nav.expenses": "Ausgaben",
      "nav.settings": "Einstellungen",

      "board.col.decide": "Zu entscheiden",
      "board.col.mine":   "Meine",
      "board.col.done":   "Erledigt",
      "board.archived":   "Archiviert",
      "board.empty_title":"Noch nichts auf dem Board",
      "board.empty_cta":  "Neue Aufgabe",
      "board.new_do":     "Neue Aufgabe",

      "status.todo":      "Zu tun",
      "status.waiting":   "Wartend",
      "status.important": "Wichtig",
      "status.disputed":  "Strittig",
      "status.done":      "Erledigt",
      "status.info":      "Nur Info",
      "status.request":   "Anfrage",

      "card.new":              "Neue Aufgabe",
      "card.info_thread":      "Information und Kommentare",
      "card.save":             "Speichern",
      "card.cancel":           "Abbrechen",
      "card.delete":           "Löschen",
      "card.done_btn":         "Erledigt",
      "card.paid_btn":         "Bezahlt",
      "card.completed_btn":    "Abgeschlossen",
      "card.edit":             "Bearbeiten",
      "card.got_it":           "Verstanden",
      "card.details_ph":       "Was muss erledigt werden? Datum, Personen und Erinnerungen werden automatisch erkannt.",
      "card.message_ph":       "Nachricht schreiben…",
      "card.reminder_heading": "Erinnerung",
      "card.payment_heading":  "Zahlung",
      "card.receipt_heading":  "Beleg",
      "card.attach_receipt":   "Beleg anhängen",
      "card.added_by":         "Hinzugefügt von",
      "card.added_on":         "Hinzugefügt am",
      "card.edited_by":        "Bearbeitet von",
      "card.edited_on":        "Bearbeitet am",
      "card.in_calendar":      "Im Kalender",
      "card.alert":            "Erinnerung",
      "card.view_hint":        "Nur Ansicht – zum Bearbeiten tippen",

      "action.ill_do_it":    "Ich mache das",
      "action.please_do_it": "Bitte erledige das",
      "action.cant":         "Kann nicht",

      "reminder.at_due":  "Zum Fälligkeitstermin",
      "reminder.min15":   "15 Minuten vorher",
      "reminder.hr1":     "1 Stunde vorher",
      "reminder.hr2":     "2 Stunden vorher",
      "reminder.day1":    "1 Tag vorher",
      "reminder.custom":  "Benutzerdefiniert",
      "reminder.clear":   "Löschen",
      "reminder.save":    "Speichern",

      "type.task":    "Aufgabe",
      "type.event":   "Termin",
      "type.expense": "Ausgabe",
      "type.info":    "Info",
      "type.request": "Anfrage",
      "type.vaccine": "Impfung",

      "topic.schedule": "Termine",
      "topic.school":   "Schule",
      "topic.medical":  "Gesundheit",
      "topic.expenses": "Ausgaben",
      "topic.general":  "Allgemein",

      "shopping.groceries":    "Lebensmittel",
      "shopping.other":        "Sonstiges",
      "shopping.items_left":   "{{n}} übrig",
      "shopping.add_ph":       "Artikel hinzufügen oder diktieren",
      "shopping.marked_bought":"Als gekauft markiert",
      "shopping.returned":     "Zurück zur Liste",
      "shopping.removed":      "Entfernt",
      "shopping.clear_bought": "Gekaufte löschen ({{n}})",
      "shopping.no_items":     "Noch keine Einkaufsartikel.",
      "shopping.dictate":      "Artikel diktieren",
      "shopping.add_list":     "Neue Liste hinzufügen",
      "shopping.new_list_prompt": "Neue Liste hinzufügen",

      "expense.total":          "Ausgaben gesamt",
      "expense.desc":           "Jede Ausgabe ist ein normaler Eintrag mit Kommentaren, Personen, Datum und Status.",
      "expense.all":            "Alle Ausgaben",
      "expense.open":           "Offen",
      "expense.paid":           "Bezahlt",
      "expense.balance":        "Saldo",
      "expense.settled":        "Ausgeglichen",
      "expense.they_owe":       "Du bekommst {{sym}} {{amt}}",
      "expense.you_owe":        "Du schuldest {{sym}} {{amt}}",
      "expense.add":            "Ausgabe hinzufügen",
      "expense.request_pay":    "Zahlung anfordern",
      "expense.send_request":   "Zahlungsanfrage senden",
      "expense.awaiting":       "angefordert – ausstehend",
      "expense.open_link":      "Zahlungslink öffnen",
      "expense.mark_paid":      "Als bezahlt markieren",
      "expense.approve":        "Genehmigen",
      "expense.dispute":        "Anfechten",
      "expense.request_amount":              "Betrag anfordern",
      "expense.no_expenses":                 "Noch keine Ausgaben.",
      "expense.export_pdf":                  "PDF exportieren",
      "expense.export_csv":                  "CSV exportieren",
      "expense.payment_history":             "Zahlungshistorie",
      "expense.ledger_created":              "Ausgabe erstellt",
      "expense.ledger_amount_set":           "Betrag aktualisiert",
      "expense.ledger_payment_requested":    "Zahlung angefordert",
      "expense.ledger_payment_sent":         "Zahlung gesendet",
      "expense.ledger_payment_confirmed":    "Zahlung bestatigt",
      "expense.ledger_marked_paid_manual":   "Als bezahlt markiert",
      "expense.ledger_receipt_uploaded":     "Beleg hochgeladen",

      "pay.split_5050": "50/50 teilen",
      "pay.split_100t": "100 % die andere Person",
      "pay.split_60":   "60 % sie / 40 % ich",
      "pay.split_40":   "40 % sie / 60 % ich",
      "pay.split_me":   "Ich übernehme",
      "pay.sending":    "Wird gesendet…",

      "msg.family_messages": "Familiennachrichten",
      "msg.loading":         "Nachrichten werden geladen…",
      "msg.send":            "Senden",
      "msg.placeholder":     "Nachricht #{{topic}}",

      "settings.your_profile":    "Dein Profil",
      "settings.display_name":    "Anzeigename",
      "settings.coparent_name":   "Name des Elternteils (lokal)",
      "settings.children":        "Kinder",
      "settings.add_child":       "+ Kind hinzufügen",
      "settings.pets":            "Haustiere",
      "settings.add_pet":         "+ Haustier hinzufügen",
      "settings.no_children":     "Noch keine Kinder hinzugefügt.",
      "settings.no_pets":         "Noch keine Haustiere.",
      "settings.coparent":        "Elternteil",
      "settings.account":         "Konto",
      "settings.sign_out":        "Abmelden",
      "settings.download_data":   "Meine Daten herunterladen",
      "settings.privacy":         "Datenschutz & Nutzungsbedingungen",
      "settings.delete_account":  "Konto löschen",
      "settings.subscription":    "Abonnement",
      "settings.notifications":   "Benachrichtigungen",
      "settings.appearance":      "Darstellung",
      "settings.language":        "Sprache",
      "settings.language_label":  "App-Sprache",
      "settings.language_hint":   "Wähle Englisch, Deutsch oder Polnisch.",
      "settings.theme":           "Design",
      "settings.theme_hint":      "Geräteeinstellung übernehmen oder feste Darstellung wählen.",
      "settings.theme_system":    "Geräteeinstellung",
      "settings.theme_light":     "Hell",
      "settings.theme_dark":      "Dunkel",
      "settings.gcal":            "Google Kalender",
      "settings.gcal_hint":       "Ab- und neu anmelden, um die Kalender-Synchronisierung wiederherzustellen",
      "settings.automation":      "Automatisierung",
      "settings.version":         "Version",
      "settings.connected":       "Verbunden – auf dem gleichen Board",
      "settings.not_joined":      "Noch nicht beigetreten",
      "settings.pending_invite":  "Einladungslink",
      "settings.resend":          "E-Mail erneut senden",
      "settings.copy_link":       "Link kopieren",
      "settings.copied":          "Kopiert!",

      "auth.sign_in":  "Anmelden",
      "auth.sign_up":  "Konto erstellen",
      "auth.email":    "E-Mail",
      "auth.password": "Passwort",
      "auth.or":       "oder",

      // Guest preview (SEG-13)
      "invite.preview_btn":   "Nur schauen? Vorschau ohne Konto",
      "invite.preview_note":  "Es wird nichts geteilt, bis du dich entscheidest beizutreten.",
      "guest.badge":          "Nur-Lese-Vorschau",
      "guest.banner":         "Du siehst eine Nur-Lese-Vorschau. Es wurde kein Konto erstellt und nichts wird geteilt.",
      "guest.hero_title":     "Gemeinsames Board von {{name}}",
      "guest.hero_title_kids":"Gemeinsames Board für {{kids}}",
      "guest.hero_sub":       "Das ist das gemeinsame Board - beide Eltern sehen immer dasselbe.",
      "guest.join_cta":       "Dem Board beitreten",
      "guest.back":           "Zurück",
      "guest.privacy_line":   "Daten werden auf EU-Servern gemäss DSGVO gespeichert.",
      "guest.privacy_link":   "So schützen wir deine Daten",
      "guest.empty":          "Das Board ist noch leer - es wurde noch nichts hinzugefügt.",
      "guest.error":          "Vorschau konnte nicht geladen werden. Der Link ist möglicherweise abgelaufen.",
      "guest.due":            "Fällig",

      "toast.joined":        "Familien-Board beigetreten",
      "toast.signed_out":    "Abgemeldet",
      "toast.marked_done":   "Als erledigt markiert",
      "toast.marked_paid":   "Als bezahlt markiert",
      "toast.marked_bought": "Als gekauft markiert",
      "toast.returned":      "Zurück zur Liste",
      "toast.removed":       "Entfernt",
      "toast.updated":       "Aktualisiert",
      "toast.sent":          "Gesendet",
      "toast.pay_sent":      "Zahlungsanfrage per E-Mail gesendet.",
      "toast.pay_created":   "Zahlungslink erstellt.",
      "toast.receipt_up":    "Beleg hochgeladen.",
      "toast.exported":      "Daten exportiert.",
      "toast.name_updated":  "Name geändert: {{name}}",
      "toast.lang_changed":  "Sprache geändert",
      "toast.added":         "Hinzugefügt",

      // Module topbar titles
      "module.title.expenses":  "Gemeinsame Ausgaben",
      "module.title.settings":  "Automatisierung und Familie",
      "module.title.calendar":  "Gemeinsamer Kalender",
      "module.title.messages":  "Familiennachrichten",
      "module.title.shopping":  "Einkaufsliste",

      // Automation settings panel
      "auto.remind_toggle":            "Alle Erinnerungen automatisieren",
      "auto.remind_toggle_hint":       "Aufgaben mit Datum erhalten automatisch eine Erinnerung.",
      "auto.family_cal":               "Familienkalender synchronisieren",
      "auto.family_cal_hint":          "Aufgaben mit Datum werden mit dem gemeinsamen Kalender synchronisiert.",
      "auto.family_cal_provider":      "Kalenderanbieter",
      "auto.family_cal_provider_hint": "Google Kalender oder Outlook als Hauptkalender der Familie verwenden.",
      "auto.global_reminder":          "Globale Erinnerungszeit",
      "auto.global_reminder_hint":     "Wird für neue Aufgaben und automatische Erinnerungen verwendet.",
      "auto.delivery":                 "Erinnerungskanal",
      "auto.delivery_hint":            "Erinnerungen nur im Kalender oder auch in Do-Do anzeigen.",
      "auto.cal_connections":          "Kalenderverbindungen",
      "auto.family_cal_label":         "Familienkalender",
      "auto.family_cal_ready":         "Bereit zur Synchronisierung mit {{provider}}.",
      "auto.family_cal_connect_hint":  "Wähle Google oder Outlook und verbinde den Familienkalender.",
      "auto.privacy":                  "Familien-Datentrennung",
      "auto.privacy_hint":             "Jede Familie ist ein separater Arbeitsbereich. Kein Zugriff für andere Familien.",
      "auto.work_cal":                 "Private Arbeitsverfügbarkeit",
      "auto.work_cal_hint":            "Optional. Nur Beschäftigt-Blöcke importieren. Titel und Notizen bleiben privat.",
      "auto.work_provider":            "Arbeitskalender-Anbieter",
      "auto.work_provider_hint":       "Google oder Microsoft Outlook für private Terminkonflikte verbinden.",
      "auto.work_connect":             "Arbeitskalender verbinden",
      "auto.work_connect_hint":        "Beide Anbieter sind möglich. Importierte Einträge bleiben Beschäftigt-Blöcke.",
      "auto.work_shared":              "Aus Arbeitskalender geteilt",
      "auto.work_shared_hint":         "Nur belegte Zeiträume werden im Familienkalender sichtbar.",
      "auto.isolated":                 "Isoliert",
      "auto.busy_only":                "Nur Beschäftigt",
      "auto.delivery_app_only":        "Nur App",
      "auto.delivery_cal_only":        "Nur Familienkalender",
      "auto.delivery_cal_app":         "Kalender + Do-Do",
      "auto.connect_btn":              "Verbinden",
      "auto.on":                       "An",

      // Custody settings panel
      "custody.heading":      "Betreuungsplan",
      "custody.desc":         "Kalendertage farblich markieren, um zu zeigen, wer die Kinder hat.",
      "custody.show":         "Betreuungskalender anzeigen",
      "custody.show_hint":    "Tage jedes Elternteils farblich hervorheben.",
      "custody.type":         "Plantyp",
      "custody.type_hint":    "Wähle die Betreuungsregelung.",
      "custody.7_7":          "Wöchentlicher Wechsel (7-7)",
      "custody.2_2_3":        "2-2-3-Rotation",
      "custody.5_2":          "Wochentage bei mir / Wochenenden beim anderen Elternteil",
      "custody.starts":       "Mein Betreuungsabschnitt beginnt",
      "custody.starts_hint":  "Erster Tag des aktuellen Betreuungszeitraums.",
      "custody.my_color":     "Meine Tage - Farbe",
      "custody.co_color":     "Tage des anderen Elternteils - Farbe",

      // Share panel
      "share.heading":        "Do-Do teilen",
      "share.desc":           "Kennst du jemanden mit geteilter Verantwortung? Schick ihm den Link.",
      "share.whatsapp":       "Via WhatsApp teilen",
      "share.email_btn":      "Via E-Mail teilen",

      // Coparent invite panel
      "invite.heading":       "Elternteil einladen",
      "invite.paid_desc":     "Gemeinsames Board und Zusammenarbeit erfordern den Familienplan.",
      "invite.upgrade":       "Upgrade",
      "invite.no_email":      "Gib im Onboarding die E-Mail des Elternteils ein, um eine Einladung zu senden.",
      "invite.sending":       "Wird gesendet…",

      // Misc
      "settings.checking":    "Verbindung wird geprüft…",
      "settings.loading":     "Lädt…",

      // Stats bar
      "stats.needs":          "Ausstehend",
      "stats.waiting":        "Wartet",
      "stats.todo":           "Zu tun",
      "stats.expenses":       "Ausgaben",
      "stats.messages":       "Nachrichten",
      "stats.reminders":      "Erinnerungen",

      // Card status labels
      "card.done":            "Erledigt",
      "card.completed":       "Abgeschlossen",
      "card.waiting":         "Wartet",
      "card.urgent":          "Dringend",
      "card.needs_response":  "Antwort nötig",
      "card.paid":            "Bezahlt",
      "card.vaccine_badge":   "Impfung",

      // Card action buttons
      "card.action.do":       "Ich mach's",
      "card.action.will":     "Bitte mach es",
      "card.action.cannot":   "Kann nicht",
      "card.action.reminder": "Erinnerung",
      "card.action.message":  "Nachricht",

      // Apple Calendar
      "apple.heading":        "Apple Kalender (iCloud)",
      "apple.connected":      "Verbunden",
      "apple.not_connected":  "Nicht verbunden",
      "apple.note":           "iPhone-Nutzer: iCloud-Kalender verbinden, um verfügbare Zeiten zu sehen. Erfordert ein App-spezifisches Passwort von appleid.apple.com - Sicherheit - App-spezifische Passwörter.",
      "apple.connected_as":   "Verbunden als",
      "apple.disconnect":     "Trennen",
      "apple.email_label":    "iCloud-E-Mail",
      "apple.pass_label":     "App-spezifisches Passwort",
      "apple.connect_btn":    "iCloud-Kalender verbinden",

      // Co-parent calendar
      "copcal.heading":       "Kalender des anderen Elternteils",
      "copcal.note":          "Das andere Elternteil verbindet seinen eigenen Kalender in seinen Do-Do-Einstellungen. Einmal verbunden, werden seine freien Zeiten in Ihrem gemeinsamen Kalender in einer anderen Farbe angezeigt.",
      "copcal.your_cal":      "Dein Kalender",
      "copcal.connected_busy":"Verbunden - freie Zeiten geteilt",
      "copcal.not_connected": "Nicht verbunden",
      "copcal.active":        "Aktiv",
      "copcal.set_up_above":  "Oben einrichten",
      "copcal.coparent_cal":  "Kalender des anderen Elternteils",
      "copcal.visible_once":  "Sichtbar, sobald sie sich von ihrem Gerät verbinden.",
      "copcal.checking":      "Prüfen…",

      // Subscription
      "sub.free":             "Kostenlos",
      "sub.trial":            "Family - Testzeitraum",
      "sub.active":           "Family",
      "sub.past_due":         "Family - Zahlung überfällig",
      "sub.canceled":         "Gekündigt",
      "sub.renews":           "Verlängert sich am",
      "sub.manage":           "Verwalten",
      "sub.opening":          "Wird geöffnet…",
      "sub.dos_used":         "Dos verwendet",
      "sub.upgrade_note":     "Upgrade für unbegrenzte Dos, Kalendersync, KI und Co-Elternteil-Zusammenarbeit.",
      "sub.upgrade_btn":      "Auf Family upgraden",

      // Vaccine
      "vaccine.heading":      "Impfplan",
      "vaccine.add":          "+ Impfung hinzufügen",
      "vaccine.empty":        "Noch keine Impfkarten. Füge eine hinzu, um Termine zu verfolgen.",
      "vaccine.open":         "Öffnen",
      // Kalender
      "cal.view.month":       "Monat",
      "cal.view.week":        "Woche",
      "cal.view.day":         "Tag",
      "cal.parenting_schedule": "Betreuungsplan",
      "cal.set_up_schedule":  "Betreuungsplan einrichten",
      "cal.selected_day":     "Ausgewählter Tag",
      "cal.add_do":           "Do hinzufügen",
      "cal.no_dos":           "Keine Dos an diesem Tag.",
      "cal.my_days":          "Meine Tage",
      "cal.co_days":          "Tage des Co-Elternteils",
      "cal.no_schedule":      "Kein Plan festgelegt",
      "cal.overridden":       "geändert",
      "cal.handover":         "Übergabe",
      "cal.mine":             "Meine",
      "cal.split":            "Geteilt",
      "cal.reset":            "Zurücksetzen",
      "cal.item":             "Eintrag",
      "cal.item_s":           "",
      "cal.clear":            "Frei",
      "cal.no_events":        "Keine Ereignisse an diesem Tag.",
      "cal.all_day":          "Ganztägig",
      "cal.toast_do_added":   "Do zum ausgewählten Tag hinzugefügt",
    },

    // ── Polski ─────────────────────────────────────────────────────────────────
    pl: {
      "nav.board":    "Tablica",
      "nav.calendar": "Kalendarz",
      "nav.messages": "Wiadomości",
      "nav.shopping": "Zakupy",
      "nav.expenses": "Koszty",
      "nav.settings": "Ustawienia",

      "board.col.decide": "Do decyzji",
      "board.col.mine":   "Moje",
      "board.col.done":   "Gotowe",
      "board.archived":   "Archiwum",
      "board.empty_title":"Brak zadań na tablicy",
      "board.empty_cta":  "Dodaj Do",
      "board.new_do":     "Dodaj Do",

      "status.todo":      "Do zrobienia",
      "status.waiting":   "Oczekuje",
      "status.important": "Ważne",
      "status.disputed":  "Sporne",
      "status.done":      "Gotowe",
      "status.info":      "Tylko info",
      "status.request":   "Prośba",

      "card.new":              "Dodaj Do",
      "card.info_thread":      "Informacje i wątek",
      "card.save":             "Zapisz",
      "card.cancel":           "Anuluj",
      "card.delete":           "Usuń",
      "card.done_btn":         "Gotowe",
      "card.paid_btn":         "Opłacono",
      "card.completed_btn":    "Ukończono",
      "card.edit":             "Edytuj",
      "card.got_it":           "Rozumiem",
      "card.details_ph":       "Co trzeba zrobić? Data, osoby i przypomnienia wykryją się automatycznie.",
      "card.message_ph":       "Napisz wiadomość…",
      "card.reminder_heading": "Przypomnienie",
      "card.payment_heading":  "Płatność",
      "card.receipt_heading":  "Paragon",
      "card.attach_receipt":   "Dodaj paragon",
      "card.added_by":         "Dodane przez",
      "card.added_on":         "Dodane",
      "card.edited_by":        "Edytowane przez",
      "card.edited_on":        "Edytowane",
      "card.in_calendar":      "W kalendarzu",
      "card.alert":            "Alert",
      "card.view_hint":        "Tylko odczyt – dotknij, aby edytować",

      "action.ill_do_it":    "Zajmę się tym",
      "action.please_do_it": "Proszę, zrób to",
      "action.cant":         "Nie mogę",

      "reminder.at_due":  "W terminie",
      "reminder.min15":   "15 minut przed",
      "reminder.hr1":     "1 godzinę przed",
      "reminder.hr2":     "2 godziny przed",
      "reminder.day1":    "1 dzień przed",
      "reminder.custom":  "Własny czas",
      "reminder.clear":   "Wyczyść",
      "reminder.save":    "Zapisz",

      "card.recurrence_heading": "Powtarzanie",
      "recurrence.none":     "Nie powtarza się",
      "recurrence.daily":    "Codziennie",
      "recurrence.weekly":   "Co tydzień",
      "recurrence.biweekly": "Co 2 tygodnie",
      "recurrence.monthly":  "Co miesiąc",
      "recurrence.c223":     "2-2-3 (opieka naprzemienna)",
      "recurrence.wowo":         "Tydzień z / tydzień bez",
      "recurrence.custom_dates": "Własne daty...",
      "recurrence.pick_hint":    "Kliknij daty, aby je dodać",
      "day.mo": "Pon", "day.tu": "Wt", "day.we": "Sr",
      "day.th": "Czw", "day.fr": "Pt", "day.sa": "Sob", "day.su": "Nd",

      "type.task":    "Zadanie",
      "type.event":   "Wydarzenie",
      "type.expense": "Wydatek",
      "type.info":    "Info",
      "type.request": "Prośba",
      "type.vaccine": "Szczepienie",

      "topic.schedule": "Plan",
      "topic.school":   "Szkoła",
      "topic.medical":  "Zdrowie",
      "topic.expenses": "Wydatki",
      "topic.general":  "Ogólne",

      "shopping.groceries":    "Artykuły spożywcze",
      "shopping.other":        "Inne",
      "shopping.items_left":   "{{n}} pozostało",
      "shopping.add_ph":       "Dodaj lub podyktuj produkt",
      "shopping.marked_bought":"Oznaczono jako kupione",
      "shopping.returned":     "Powrócono na listę",
      "shopping.removed":      "Usunięto",
      "shopping.clear_bought": "Usuń kupione ({{n}})",
      "shopping.no_items":     "Brak produktów na liście.",
      "shopping.dictate":      "Podyktuj produkt",
      "shopping.add_list":     "Dodaj nową listę",
      "shopping.new_list_prompt": "Dodaj nową listę",

      "expense.total":          "Suma wydatków",
      "expense.desc":           "Każdy wydatek to normalne zadanie z komentarzami, osobami, datą i statusem.",
      "expense.all":            "Wszystkie wydatki",
      "expense.open":           "Otwarte",
      "expense.paid":           "Opłacone",
      "expense.balance":        "Saldo",
      "expense.settled":        "Rozliczone",
      "expense.they_owe":       "Należy ci się {{sym}} {{amt}}",
      "expense.you_owe":        "Jesteś winien/winna {{sym}} {{amt}}",
      "expense.add":            "Dodaj wydatek",
      "expense.request_pay":    "Poproś o zwrot",
      "expense.send_request":   "Wyślij prośbę o płatność",
      "expense.awaiting":       "oczekuje na płatność",
      "expense.open_link":      "Otwórz link do płatności",
      "expense.mark_paid":      "Oznacz jako opłacone",
      "expense.approve":        "Zatwierdź",
      "expense.dispute":        "Zakwestionuj",
      "expense.request_amount":              "Kwota do zwrotu",
      "expense.no_expenses":                 "Brak wydatków.",
      "expense.export_pdf":                  "Eksportuj PDF",
      "expense.export_csv":                  "Eksportuj CSV",
      "expense.payment_history":             "Historia platnosci",
      "expense.ledger_created":              "Wydatek utworzony",
      "expense.ledger_amount_set":           "Kwota zaktualizowana",
      "expense.ledger_payment_requested":    "Platnosc zażądana",
      "expense.ledger_payment_sent":         "Platnosc wyslana",
      "expense.ledger_payment_confirmed":    "Platnosc potwierdzona",
      "expense.ledger_marked_paid_manual":   "Oznaczono jako oplacone",
      "expense.ledger_receipt_uploaded":     "Paragon przeslany",

      "pay.split_5050": "Po równo (50/50)",
      "pay.split_100t": "100 % oni",
      "pay.split_60":   "60 % oni / 40 % ja",
      "pay.split_40":   "40 % oni / 60 % ja",
      "pay.split_me":   "Ja płacę",
      "pay.sending":    "Wysyłanie…",

      "msg.family_messages": "Wiadomości rodzinne",
      "msg.loading":         "Ładowanie wiadomości…",
      "msg.send":            "Wyślij",
      "msg.placeholder":     "Wiadomość #{{topic}}",

      "settings.your_profile":    "Twój profil",
      "settings.display_name":    "Twoja nazwa",
      "settings.coparent_name":   "Nazwa współrodzica (lokalna)",
      "settings.children":        "Dzieci",
      "settings.add_child":       "+ Dodaj dziecko",
      "settings.pets":            "Zwierzęta",
      "settings.add_pet":         "+ Dodaj zwierzę",
      "settings.no_children":     "Nie dodano jeszcze dzieci.",
      "settings.no_pets":         "Nie dodano jeszcze zwierząt.",
      "settings.coparent":        "Współrodzic",
      "settings.account":         "Konto",
      "settings.sign_out":        "Wyloguj",
      "settings.download_data":   "Pobierz moje dane",
      "settings.privacy":         "Prywatność i regulamin",
      "settings.delete_account":  "Usuń konto",
      "settings.subscription":    "Subskrypcja",
      "settings.notifications":   "Powiadomienia",
      "settings.appearance":      "Wygląd",
      "settings.language":        "Język",
      "settings.language_label":  "Język aplikacji",
      "settings.language_hint":   "Wybierz angielski, niemiecki lub polski.",
      "settings.theme":           "Motyw",
      "settings.theme_hint":      "Dostosuj do ustawień urządzenia lub wybierz stały wygląd.",
      "settings.theme_system":    "Ustawienia urządzenia",
      "settings.theme_light":     "Jasny",
      "settings.theme_dark":      "Ciemny",
      "settings.gcal":            "Google Kalendarz",
      "settings.gcal_hint":       "Wyloguj i zaloguj ponownie, aby przywrócić synchronizację kalendarza",
      "settings.automation":      "Automatyzacja",
      "settings.version":         "Wersja",
      "settings.connected":       "Połączono – na tej samej tablicy",
      "settings.not_joined":      "Jeszcze nie dołączył(a)",
      "settings.pending_invite":  "Link zaproszenia",
      "settings.resend":          "Wyślij ponownie",
      "settings.copy_link":       "Kopiuj link",
      "settings.copied":          "Skopiowano!",

      "auth.sign_in":  "Zaloguj się",
      "auth.sign_up":  "Utwórz konto",
      "auth.email":    "E-mail",
      "auth.password": "Hasło",
      "auth.or":       "lub",

      // Guest preview (SEG-13)
      "invite.preview_btn":   "Chcesz najpierw zobaczyć? Podgląd bez konta",
      "invite.preview_note":  "Nic nie jest udostępniane, dopóki nie zdecydujesz się dołączyć.",
      "guest.badge":          "Podgląd tylko do odczytu",
      "guest.banner":         "Oglądasz podgląd tylko do odczytu. Żadne konto nie zostało utworzone i nic nie jest udostępniane.",
      "guest.hero_title":     "Wspólna tablica: {{name}}",
      "guest.hero_title_kids":"Wspólna tablica dla: {{kids}}",
      "guest.hero_sub":       "To jest wspólna tablica - oboje rodzice zawsze widzą to samo.",
      "guest.join_cta":       "Dołącz do tablicy",
      "guest.back":           "Wstecz",
      "guest.privacy_line":   "Dane są przechowywane na serwerach w UE zgodnie z RODO.",
      "guest.privacy_link":   "Jak chronimy Twoje dane",
      "guest.empty":          "Tablica jest jeszcze pusta - nic nie zostało dodane.",
      "guest.error":          "Nie udało się wczytać podglądu. Link mógł wygasnąć.",
      "guest.due":            "Termin",

      "toast.joined":        "Dołączono do tablicy rodzinnej",
      "toast.signed_out":    "Wylogowano",
      "toast.marked_done":   "Oznaczono jako gotowe",
      "toast.marked_paid":   "Oznaczono jako opłacone",
      "toast.marked_bought": "Oznaczono jako kupione",
      "toast.returned":      "Powrócono na listę",
      "toast.removed":       "Usunięto",
      "toast.updated":       "Zaktualizowano",
      "toast.sent":          "Wysłano",
      "toast.pay_sent":      "Prośba o płatność wysłana e-mailem.",
      "toast.pay_created":   "Link do płatności utworzony.",
      "toast.receipt_up":    "Paragon przesłany.",
      "toast.exported":      "Dane wyeksportowane.",
      "toast.name_updated":  "Nazwa zmieniona: {{name}}",
      "toast.lang_changed":  "Język zmieniony",
      "toast.added":         "Dodano",

      // Module topbar titles
      "module.title.expenses":  "Wspólne koszty",
      "module.title.settings":  "Automatyzacja i rodzina",
      "module.title.calendar":  "Wspólny kalendarz",
      "module.title.messages":  "Wiadomości rodzinne",
      "module.title.shopping":  "Lista zakupów",

      // Automation settings panel
      "auto.remind_toggle":            "Automatyczne przypomnienia",
      "auto.remind_toggle_hint":       "Zadania z datą automatycznie otrzymują przypomnienie.",
      "auto.family_cal":               "Synchronizuj kalendarz rodzinny",
      "auto.family_cal_hint":          "Zadania z datą synchronizują się z wybranym wspólnym kalendarzem.",
      "auto.family_cal_provider":      "Dostawca kalendarza",
      "auto.family_cal_provider_hint": "Użyj Google Calendar lub Outlook jako główny kalendarz rodziny.",
      "auto.global_reminder":          "Domyślny czas przypomnienia",
      "auto.global_reminder_hint":     "Używany dla nowych zadań i automatycznych przypomnień.",
      "auto.delivery":                 "Kanał przypomnień",
      "auto.delivery_hint":            "Wybierz, czy przypomnienia mają być tylko w kalendarzu, czy też w Do-Do.",
      "auto.cal_connections":          "Połączenia kalendarzy",
      "auto.family_cal_label":         "Kalendarz rodzinny",
      "auto.family_cal_ready":         "Gotowy do synchronizacji z {{provider}} Calendar.",
      "auto.family_cal_connect_hint":  "Wybierz Google lub Outlook i połącz główny kalendarz rodziny.",
      "auto.privacy":                  "Izolacja danych rodziny",
      "auto.privacy_hint":             "Każda rodzina to osobna przestrzeń robocza. Inne rodziny nie mają dostępu do zadań, wiadomości ani kalendarza.",
      "auto.work_cal":                 "Prywatna dostępność z pracy",
      "auto.work_cal_hint":            "Opcjonalnie. Importuj tylko bloki zajętości. Tytuły i notatki pozostają prywatne.",
      "auto.work_provider":            "Dostawca kalendarza pracy",
      "auto.work_provider_hint":       "Połącz Google lub Microsoft Outlook dla prywatnej widoczności konfliktów.",
      "auto.work_connect":             "Połącz kalendarze pracy",
      "auto.work_connect_hint":        "Możesz połączyć oba lub jeden. Zaimportowane elementy pozostają blokami zajętości.",
      "auto.work_shared":              "Udostępnione z kalendarza pracy",
      "auto.work_shared_hint":         "Tylko zajęte przedziały czasowe stają się widoczne w kalendarzu rodzinnym.",
      "auto.isolated":                 "Izolowane",
      "auto.busy_only":                "Tylko zajętość",
      "auto.delivery_app_only":        "Tylko aplikacja",
      "auto.delivery_cal_only":        "Tylko kalendarz rodzinny",
      "auto.delivery_cal_app":         "Kalendarz + Do-Do",
      "auto.connect_btn":              "Połącz",
      "auto.on":                       "Włączone",

      // Custody settings panel
      "custody.heading":      "Harmonogram opieki",
      "custody.desc":         "Oznacz kolorami dni kalendarza, żeby pokazać, kto ma dzieci.",
      "custody.show":         "Pokaż kalendarz opieki",
      "custody.show_hint":    "Zaznacz dni każdego rodzica kolorem.",
      "custody.type":         "Typ harmonogramu",
      "custody.type_hint":    "Wybierz swój układ opieki nad dziećmi.",
      "custody.7_7":          "Naprzemienne tygodnie (7-7)",
      "custody.2_2_3":        "Rotacja 2-2-3",
      "custody.5_2":          "Dni robocze moje / weekendy u współrodzica",
      "custody.starts":       "Mój harmonogram zaczyna się",
      "custody.starts_hint":  "Pierwszy dzień bieżącego okresu opieki.",
      "custody.my_color":     "Kolor moich dni",
      "custody.co_color":     "Kolor dni współrodzica",

      // Share panel
      "share.heading":        "Udostępnij Do-Do",
      "share.desc":           "Znasz kogoś, kto ma wspólne obowiązki? Wyślij mu link.",
      "share.whatsapp":       "Udostępnij przez WhatsApp",
      "share.email_btn":      "Udostępnij przez e-mail",

      // Coparent invite panel
      "invite.heading":       "Zaproś współrodzica",
      "invite.paid_desc":     "Wspólna tablica i współpraca wymagają planu Rodzinnego.",
      "invite.upgrade":       "Kup plan",
      "invite.no_email":      "Dodaj e-mail współrodzica podczas konfiguracji, aby wysłać zaproszenie.",
      "invite.sending":       "Wysyłanie…",

      // Misc
      "settings.checking":    "Sprawdzanie połączenia…",
      "settings.loading":     "Ładowanie…",

      // Stats bar
      "stats.needs":          "Do odpowiedzi",
      "stats.waiting":        "Czeka",
      "stats.todo":           "Do zrobienia",
      "stats.expenses":       "Koszty",
      "stats.messages":       "Wiadomości",
      "stats.reminders":      "Przypomnienia",

      // Card status labels
      "card.done":            "Gotowe",
      "card.completed":       "Wykonano",
      "card.waiting":         "Czeka",
      "card.urgent":          "Pilne",
      "card.needs_response":  "Do odpowiedzi",
      "card.paid":            "Zapłacono",
      "card.vaccine_badge":   "Szczepienie",

      // Card action buttons
      "card.action.do":       "Ja to zrobię",
      "card.action.will":     "Proszę zrób to",
      "card.action.cannot":   "Nie mogę",
      "card.action.reminder": "Przypomnienie",
      "card.action.message":  "Wiadomość",

      // Apple Calendar
      "apple.heading":        "Apple Kalendarz (iCloud)",
      "apple.connected":      "Połączono",
      "apple.not_connected":  "Nie połączono",
      "apple.note":           "Użytkownicy iPhone: połącz iCloud Kalendarz, aby widzieć swoje wolne bloki. Wymaga hasła aplikacji z appleid.apple.com - Bezpieczeństwo - Hasła aplikacji.",
      "apple.connected_as":   "Połączono jako",
      "apple.disconnect":     "Rozłącz",
      "apple.email_label":    "E-mail iCloud",
      "apple.pass_label":     "Hasło aplikacji",
      "apple.connect_btn":    "Połącz iCloud Kalendarz",

      // Co-parent calendar
      "copcal.heading":       "Kalendarz współrodzica",
      "copcal.note":          "Współrodzic łączy swój własny kalendarz w swoich ustawieniach Do-Do. Po połączeniu ich zajęte bloki są widoczne w waszym wspólnym kalendarzu w innym kolorze - bez ujawniania szczegółów wydarzeń.",
      "copcal.your_cal":      "Twój kalendarz",
      "copcal.connected_busy":"Połączono - zajęte bloki udostępnione",
      "copcal.not_connected": "Nie połączono",
      "copcal.active":        "Aktywny",
      "copcal.set_up_above":  "Skonfiguruj powyżej",
      "copcal.coparent_cal":  "Kalendarz współrodzica",
      "copcal.visible_once":  "Widoczny po połączeniu z ich urządzenia.",
      "copcal.checking":      "Sprawdzanie…",

      // Subscription
      "sub.free":             "Plan bezpłatny",
      "sub.trial":            "Family - okres próbny",
      "sub.active":           "Family",
      "sub.past_due":         "Family - płatność zaległa",
      "sub.canceled":         "Anulowano",
      "sub.renews":           "Odnawia się",
      "sub.manage":           "Zarządzaj",
      "sub.opening":          "Otwieranie…",
      "sub.dos_used":         "Dos użyte",
      "sub.upgrade_note":     "Przejdź na wyższy plan dla nieograniczonych Dos, synchronizacji kalendarza, AI i współpracy ze współrodzicem.",
      "sub.upgrade_btn":      "Przejdź na Family",

      // Vaccine
      "vaccine.heading":      "Harmonogram szczepień",
      "vaccine.add":          "+ Dodaj szczepienie",
      "vaccine.empty":        "Brak kart szczepień. Dodaj jedną, aby śledzić terminy i przypomnienia.",
      "vaccine.open":         "Otwórz",
      // Kalendarz
      "cal.view.month":       "Miesiąc",
      "cal.view.week":        "Tydzień",
      "cal.view.day":         "Dzień",
      "cal.parenting_schedule": "Harmonogram opieki",
      "cal.set_up_schedule":  "Ustaw harmonogram opieki",
      "cal.selected_day":     "Wybrany dzień",
      "cal.add_do":           "Dodaj Do",
      "cal.no_dos":           "Brak Do na ten dzień.",
      "cal.my_days":          "Moje dni",
      "cal.co_days":          "Dni drugiego rodzica",
      "cal.no_schedule":      "Brak harmonogramu",
      "cal.overridden":       "zmieniony",
      "cal.handover":         "Przekazanie",
      "cal.mine":             "Moje",
      "cal.split":            "Podzielony",
      "cal.reset":            "Resetuj",
      "cal.item":             "pozycja",
      "cal.item_s":           "",
      "cal.clear":            "Wolne",
      "cal.no_events":        "Brak wydarzeń na ten dzień.",
      "cal.all_day":          "Cały dzień",
      "cal.toast_do_added":   "Do dodane do wybranego dnia",
    },
  };

  // ─── Runtime ──────────────────────────────────────────────────────────────────

  const SUPPORTED = ["en", "de", "pl"];

  // Detect language: saved pref → browser lang → default en
  const _saved    = (() => { try { return localStorage.getItem("do-do-lang"); } catch { return null; } })();
  const _detected = (navigator.language || "").toLowerCase().split(/[-_]/)[0];
  let _lang = SUPPORTED.includes(_saved) ? _saved
            : SUPPORTED.includes(_detected) ? _detected
            : "en";

  // Set html lang attribute immediately (before any JS runs)
  document.documentElement.lang = _lang;

  /**
   * Translate a key with optional interpolation params.
   * Falls back: currentLang -> English -> key itself.
   *
   * @param {string} key  e.g. 'nav.board'
   * @param {object} [params]  e.g. { n: 3 }
   */
  function t(key, params) {
    const dict = DICT[_lang] || {};
    let str = dict[key] ?? (DICT.en[key] ?? key);
    if (params) {
      str = str.replace(/\{\{(\w+)\}\}/g, (_, k) =>
        params[k] !== undefined ? String(params[k]) : `{{${k}}}`
      );
    }
    return str;
  }

  /** Update all [data-i18n] elements in the document. */
  function _updateDomElements() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key  = el.dataset.i18n;
      const attr = el.dataset.i18nAttr; // e.g. "placeholder"
      const val  = t(key);
      if (attr) {
        el.setAttribute(attr, val);
      } else {
        // Preserve child elements (SVG icons etc.) - only update text nodes
        const nodes = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
        if (nodes.length > 0) {
          nodes[nodes.length - 1].textContent = val;
        } else {
          el.textContent = val;
        }
      }
    });
    document.documentElement.lang = _lang;
  }

  /** Re-render the currently active module. */
  function _rerenderModule() {
    const hash   = location.hash.replace("#", "").toLowerCase();
    const module = ["board", "calendar", "messages", "shopping", "expenses", "settings"].includes(hash)
      ? hash : "board";
    if (typeof window.switchModule === "function") {
      window.switchModule(module);
    }
  }

  /**
   * Switch the app language.
   * @param {'en'|'de'|'pl'} lang
   */
  function setLanguage(lang) {
    if (!SUPPORTED.includes(lang)) return;
    _lang = lang;
    try { localStorage.setItem("do-do-lang", lang); } catch {}
    _updateDomElements();
    _rerenderModule();
    // Update tab bar labels immediately (they're data-i18n spans)
    // _updateDomElements() already covers them
  }

  /** @returns {'en'|'de'|'pl'} */
  function getCurrentLang() { return _lang; }

  /** @returns {string[]} List of supported language codes */
  function getSupportedLangs() { return SUPPORTED.slice(); }

  // ─── Expose globals ───────────────────────────────────────────────────────────
  window.t              = t;
  window.setLanguage    = setLanguage;
  window.getCurrentLang = getCurrentLang;
  window.getSupportedLangs = getSupportedLangs;

  // Apply to static DOM once ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _updateDomElements);
  } else {
    _updateDomElements();
  }
})();
