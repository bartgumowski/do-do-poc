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
      "expense.request_amount": "Request amount",
      "expense.no_expenses":    "No expense Dos yet.",

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
      "expense.request_amount": "Betrag anfordern",
      "expense.no_expenses":    "Noch keine Ausgaben.",

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
    },

    // ── Polski ─────────────────────────────────────────────────────────────────
    pl: {
      "nav.board":    "Tablica",
      "nav.calendar": "Kalendarz",
      "nav.messages": "Wiadomości",
      "nav.shopping": "Zakupy",
      "nav.expenses": "Wydatki",
      "nav.settings": "Ustawienia",

      "board.col.decide": "Do decyzji",
      "board.col.mine":   "Moje",
      "board.col.done":   "Gotowe",
      "board.archived":   "Archiwum",
      "board.empty_title":"Brak zadań na tablicy",
      "board.empty_cta":  "Nowe zadanie",
      "board.new_do":     "Nowe zadanie",

      "status.todo":      "Do zrobienia",
      "status.waiting":   "Oczekuje",
      "status.important": "Ważne",
      "status.disputed":  "Sporne",
      "status.done":      "Gotowe",
      "status.info":      "Tylko info",
      "status.request":   "Prośba",

      "card.new":              "Nowe zadanie",
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
      "expense.request_amount": "Kwota do zwrotu",
      "expense.no_expenses":    "Brak wydatków.",

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
