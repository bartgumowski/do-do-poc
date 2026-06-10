# Do-Do.app - Strategia Go-to-Market: Polska
*Przygotowano 2026-06-09, v2 - uzgodniono z Dokumentem Inwestorskim (czerwiec 2026). Wszystkie kwoty w PLN, chyba że zaznaczono inaczej.*

---

## 1. Podsumowanie wykonawcze

Polska jest prawdopodobnie najlepszym pierwszym rynkiem w Europie dla aplikacji do koordynacji rodzicielskiej - i ten rynek jest obecnie niczyj. Ok. 61 000 rozwodów w 2025 r. (wzrost ok. 5% r/r), ok. 51 000 małoletnich dzieci dotkniętych rozwodem rocznie, a orzeczenia o wspólnej władzy rodzicielskiej wzrosły z 29% (2000) do ok. 77% (2024). Dodając rozstania par niesformalizowanych (brak statystyk sądowych, realistycznie 1,5-2x liczba rozwodów), roczny napływ nowych gospodarstw "dwudomowych" to 100-150 tys. par. Łączna pula istniejących gospodarstw to kilkaset tysięcy.

Globalni gracze (OurFamilyWizard, TalkingParents, AppClose) są anglojęzyczni, wycenieni po amerykańsku i hostowani w USA - a AppClose i TalkingParents usunęli darmowe plany w 2026 r., zostawiając użytkowników szukających alternatywy. Lokalna i zlokalizowana konkurencja istnieje, ale jest cząstkowa: Splitday (izraelski, po polsku, tracker dla jednego rodzica bez synchronizacji dwustronnej), 2domy.pl (webowy kalendarz opieki), Domownik (organizer dla mieszkających razem). Nikt nie oferuje platformy dwustronnej z asystentem AI znającym kontekst rodziny. Do-Do z polskim interfejsem, rozliczeniem w PLN, ceną za rodzinę i danymi w UE wygrywa językiem, kompletnością i zaufaniem RODO, zanim wyda pierwszą złotówkę na reklamę.

Kluczowy wniosek GTM: **tego produktu się nie odkrywa - ten produkt się przepisuje.** Nikt nie przegląda App Store w poszukiwaniu narzędzi do koordynacji rodzicielskiej w dobry dzień. Ludzie sięgają po nie, gdy mediator, adwokat albo zatwierdzony plan wychowawczy im to wskaże, albo gdy ktoś z grupy wsparcia poleci. Dlatego najwyższy ROI na każdym poziomie budżetu daje kanał B2B2C "przepisujących" (mediatorzy, prawnicy rodzinni, NGO), a płatna akwizycja dochodzi dopiero przy wyższych budżetach.

**Jak to łączy się z Viral Invite Loop z produktu (Dokument Inwestorski, sekcja 4):** te dwa mechanizmy się uzupełniają, nie konkurują. Przepisujący i treści POZYSKUJĄ Rodzica A w momencie wyzwalającym; pętla zaproszeń z magic linkiem AKTYWUJE parę, rekrutując Rodzica B przy zerowym koszcie. Pętla to mechanizm aktywacji, nie silnik akwizycji - każda rodzina zaprasza dokładnie jedną osobę (byłego partnera), więc K-factor jest strukturalnie poniżej 1 i pętla nie zastąpi górnej części lejka. Mierzyć osobno: CAC przepisujących/treści na *rodzinę*, a potem wskaźnik akceptacji zaproszeń jako mnożnik aktywacji.

---

## 2. Wielkość rynku

| Warstwa | Szacunek | Podstawa |
|---|---|---|
| TAM (gospodarstwa dwudomowe w PL, łącznie) | 600-900 tys. par | rozwody z dziećmi skumulowane przez ~10 lat + rozstania par niesformalizowanych |
| SAM (aktywni na smartfonach, poziom konfliktu wymagający narzędzia, gotowość do płacenia) | 150-250 tys. par | przewaga miast (rozwody 3x częstsze w miastach), sprawy z opieką wspólną |
| SOM rok 1 | 2 000-5 000 płacących par | realistyczne przy kanale przepisujących |
| Roczny napływ | 100-150 tys. par | ~61 tys. rozwodów (57% z dziećmi) + rozstania niesformalizowane |

Weryfikacja przychodu: 3 000 płacących par x 169 PLN/rok = ok. 507 tys. PLN ARR. 10 000 par = ok. 1,7 mln PLN ARR. Sama Polska może doprowadzić firmę do metryk rundy seed.

**Kontekst gotowości do płacenia:** polscy rodzice już płacą ok. 35 PLN/mies. za Librus (komunikacja ze szkołą, 75% szkół) - bezpośredni dowód płacenia za cyfrowe narzędzia związane z dzieckiem. Kotwiczyć komunikację do tego i do czasu prawnika ("miesiąc Do-Do kosztuje mniej niż 5 minut pracy Twojego adwokata"; adwokaci: 300-800 zł/h; mediatorzy: 200-500 zł/h) - nigdy do "kolejnej subskrypcji". Decyzja o modelu cenowym (za rodzinę vs za rodzica) omówiona w sekcji 8.

---

## 3. Pozycjonowanie

**Parasol marki vs klin startowy - kluczowa decyzja.** Długoterminowa tożsamość Do-Do to narzędzie dla WSZYSTKICH rodziców żonglujących pracą i grafikami dzieci ("rodzinny zarząd w jednym miejscu"). Ale klinem startowym są gospodarstwa po rozstaniu, bo ten segment ma ostry ból, moment przymusu (mediacja, plan wychowawczy), profesjonalistów polecających narzędzia i strukturalny powód, by płacić. Start "na szeroko" oznacza konkurowanie z darmowymi narzędziami (Google Calendar, Cozi, FamilyWall, WhatsApp), gdzie pilność i gotowość do płacenia są słabe. Zatem: marka i produkt pozostają rodzinnie neutralne (zero rozwodowego kodowania na stronie i w aplikacji), akwizycja celuje w klin, a "każda rodzina to firma logistyczna" staje się kampanią ekspansji w Fazie 2, gdy będą już recenzje i polecenia. Neutralne ujęcie poszerza też sam klin: rozstani rodzice bez ślubu i pary "living apart together" pasują do "rodziców żonglujących grafikami", a są niewidoczni w statystykach rozwodowych.

**Dlaczego NIE "wszyscy rodzice" na starcie (zapis decyzji):**

1. **Brak pilności, brak momentu przymusu.** Pełne rodziny czują ból umiarkowany; nic nie zmusza ich do adopcji płatnego narzędzia w tym tygodniu. Rozstani rodzice dostają plan wychowawczy, który muszą wykonywać od poniedziałku.
2. **Darmowa i wystarczająco dobra konkurencja.** Google Calendar, Cozi, FamilyWall i grupy WhatsApp rozwiązują 80% problemu pełnej rodziny za zero złotych. Konkurowanie tam to wojna funkcji z darmowym.
3. **Brak kanału przepisujących.** Nikt zawodowo nie poleca narzędzi do grafików szczęśliwym rodzinom. Mediatorzy, prawnicy i NGO aktywnie polecają narzędzia rozstającym się - najtańszy dostępny kanał akwizycji istnieje tylko dla klina.
4. **Gotowość do płacenia.** 19 PLN/mies. to drobiazg na tle rozwodu za 10 000 zł, ale trudna sprzedaż na tle darmowego kalendarza. Ekonomia konwersji domyka się tylko w klinie.
5. **Rozmycie przekazu.** Marketing "dla każdego" nie konwertuje nikogo; budżet na każdym poziomie jest za mały, by budować szeroką markę konsumencką w Polsce.
6. **Wariant "szeroko od początku" kosztuje więcej.** Uczciwa wersja tego planu: znacznie większy darmowy plan, CAC przez ASO i szerokich influencerów oraz 3-5x dłuższa droga do przychodu. Odrzucone na start; do rozważenia tylko przy znaczącym finansowaniu.

To decyzja o kolejności, nie o tożsamości - marka pozostaje dla wszystkich rodziców, a Faza 2 (poniżej) realizuje ekspansję.

**Kategoria startowa (tylko komunikacja akwizycyjna):** "Aplikacja dla rodziców po rozstaniu" - celowo szerzej niż rozwód (obejmuje rodziców bez ślubu, ignorowanych przez statystyki sądowe i marketing konkurencji).

**Główna obietnica:** *Mniej rozmów, mniej konfliktów, wszystko w jednym miejscu.*

**Cztery filary przekazu, dopasowane do person:**

1. **Wyczerpany koordynator** (zwykle rodzic pierwszoplanowy, 30-45 lat, miasto): "Przestań być sekretarzem rodziny. Grafik, wydatki, szkoła, lekarze - jedna tablica, oboje rodziców ją widzi."
2. **Rodzic walczący o kontakt** (często ojcowie, ruch opieki naprzemiennej): "Dokumentuj wszystko. Czysty, datowany rejestr próśb, ustaleń i wydatków." Ta grupa jest zorganizowana (Dzielny Tata i organizacje sojusznicze), głośna i niedoceniona przez rynek.
3. **Profesjonalista przepisujący** (mediator, adwokat, psycholog): "Daj klientom narzędzie, dzięki któremu plan wychowawczy naprawdę działa po wyjściu z Twojego gabinetu - i które ogranicza kryzysowe telefony o 21:00."
4. **Asystent AI z kontekstem rodziny** (wyróżnik przekrojowy, z Dokumentu Inwestorskiego, sekcja 6): "Asystent, który naprawdę zna Twoją rodzinę - alergię Tomka, środy u taty, numer dentysty, nierozliczone buty. ChatGPT nie wie nic z tego; Do-Do uczy się tego w tygodnie." Kontekst to fosa, AI to interfejs. W marketingu: treści demo-first (15-sekundowe klipy komend głosowych typu "Zapłaciłam 380 zł za buty Tomka" → wydatek zapisany, podzielony, partner powiadomiony) - to udostępnialna, medialna powierzchnia produktu.

**Wyróżniki zaufania vs aplikacje z USA:** polski język, ceny w PLN przez Stripe, dane w UE/RODO, cena dopasowana do siły nabywczej (169 PLN/rok vs 2houses ok. 700 PLN/rok w przeliczeniu za parę).

**Uwaga o nazwie:** "Do-Do" jest przyjazne i neutralne - dobrze. Unikać brandingu kodowanego rozwodem; wielu użytkowników jest przed wyrokiem albo bez ślubu. Neutralność ma też znaczenie dla drugiego rodzica, który musi przyjąć zaproszenie, żeby produkt w ogóle działał (moment aktywacji, który decyduje o wszystkim - patrz sekcja 7).

**Faza 2 - ekspansja na wszystkich rodziców (miesiąc 9-18, warunek: >=2 000 płacących par i ocena >=4,5 w sklepach):** przeniesienie kampanii na "dwoje pracujących rodziców, jeden kalendarz". Kanały przesuwają się na szerokie media parentingowe, platformy benefitowe (otwarte już w Poziomie 2) i integracje okołoszkolne. Funkcje co-parentingowe (podział wydatków, neutralny rejestr) pozostają wyróżnikiem premium, którego nie ma żaden konkurent typu "kalendarz rodzinny".

---

## 4. Krajobraz konkurencyjny

*(Korekta v2: pierwsza wersja twierdziła, że nie istnieje polskojęzyczny konkurent. Audyt konkurencji z Dokumentu Inwestorskiego jest słuszny - jest ich trzech, każdy cząstkowy.)*

| Aplikacja | Cena | Polski UI | Sync dwustronny | Agent AI | Słabość w PL |
|---|---|---|---|---|---|
| OurFamilyWizard | ~200 USD/rok za rodzica | Nie | Tak | Tylko ToneMeter | Cena, język, USA-centryczność |
| TalkingParents | 77-360 USD/rok (free plan usunięty 2026) | Nie | Tak | Nie | Brak kalendarza/list, język |
| AppClose | ~216 USD/rok (free plan usunięty 2026) | Nie | Tak | Nie | Szok cenowy dla byłych darmowych użytkowników |
| Splitday | ~24,99 USD/rok | **Tak** | **Nie** (solo tracker) | Nie | Z założenia dla jednego rodzica; izraelska firma z danymi dzieci poza UE |
| 2domy.pl | Darmowy | **Tak** | Częściowo | Nie | Tylko webowy kalendarz opieki, nic więcej |
| Domownik | ~15 PLN/mies. | **Tak** | n/d | Nie | Dla mieszkających razem, nie dla dwóch domów |
| **Do-Do** | **cena w PLN za rodzinę** | **Tak** | **Tak** | **Tak, z kontekstem rodziny** | Nowa, nieznana marka |

**Implikacje dla kanałów:**

- **Prawdziwym konkurentem pozostaje darmowa "sklejka"** - Messenger + Google Calendar + Splitwise. Kontrować wspólnym kontekstem, niezmienialnym rejestrem i wygodą jednego miejsca - nie listą funkcji.
- **Splitday to najpoważniejsze nazwane zagrożenie** (po polsku, tani, z finansowaniem). Kontry: (a) pozycjonowanie - "Splitday rozwiązuje problem jednego rodzica; Do-Do daje obojgu jedną wspólną rzeczywistość"; (b) RODO/suwerenność danych - dane dzieci u firmy spoza UE to uzasadniony klin zaufania, używać go; (c) ich offline'owa, jednoosobowa architektura oznacza, że skopiowanie synchronizacji dwustronnej to przebudowa na 12-18 miesięcy - okno na wygranie kategorii. Użytkownicy Splitday chcący wciągnąć drugiego rodzica to ciepłe leady: celować w "splitday alternatywa" w SEO.
- **2domy.pl to kanał akwizycji, nie zagrożenie:** jego użytkownicy już zidentyfikowali się jako szukający kalendarza opieki. SEO na "2domy.pl alternatywa" + treści porównawcze = najtańszy ruch o wysokiej intencji.
- **Usunięcie darmowych planów AppClose/TalkingParents (2026)** stworzyło moment przesiedlonych użytkowników. Treści "switcher" z ograniczeniem czasowym i ścieżka importu to tanie wygrane w tym roku.
- **Librus (35 PLN/mies., 75% polskich szkół) nie jest konkurentem, tylko dowodem gotowości do płacenia** - kotwiczyć całą komunikację cenową: "kosztuje tyle co Librus."

---

## 5. Scenariusze GTM wg poziomu inwestycji

### Poziom 0 - Bootstrap (< 5 000 PLN łącznie, tylko czas założyciela)

Cel: 500 aktywowanych par, 50-100 płacących, w 6 miesięcy. Udowodnić, że kanał przepisujących działa.

1. **Zagranie "najpierw mediatorzy" (najwyższa dźwignia przy zerowym budżecie).** Rocznie odbywa się ok. 35-42 tys. sądowych mediacji rodzinnych, a listy mediatorów są publiczne przy każdym sądzie okręgowym. Ręcznie wybrać 100 mediatorów rodzinnych w Warszawie, Krakowie, Wrocławiu, Poznaniu, Gdańsku. Oferta: darmowe dożywotnie konto "Mediator", ich klienci dostają 3 miesiące gratis przez osobisty kod, a Do-Do eksportuje podsumowanie grafiku/wydatków do załączenia do porozumienia. Koszt: e-mail + 15-minutowe demo. Nawet 10 aktywnych mediatorów polecających ~50 parom rocznie = 500 ciepłych par/rok.
2. **Polska Mediatorka i podobne blogi.** Blog, który recenzował aplikacje co-parentingowe i nie znalazł polskiej opcji, to gotowy cel PR. Zaproponować ekskluzywną pierwszą recenzję / wywiad. To samo dla blogów i podcastów parentingowych (Mamopracuj, społeczności samodzielnych rodziców).
3. **Zasiew w społecznościach.** Fundacja Sama Mama (portale sama-mama.pl, misja-ja.pl), Stowarzyszenie Dzielny Tata i sojusznicze organizacje ojcowskie, grupy facebookowe rodziców po rozwodzie. Nie spamować - zaproponować NGO układ partnerski: członkowie dostają 6 miesięcy gratis, NGO dostaje imienne "przy wsparciu". Obie strony podziału płci muszą być objęte (Sama Mama I Dzielny Tata) - produkt działa tylko, gdy dołączą oboje rodzice.
4. **Treści SEO po polsku.** 15-20 artykułów filarowych: "plan wychowawczy wzór", "opieka naprzemienna jak zorganizować", "podział kosztów dziecka po rozwodzie", "aplikacja dla rodziców po rozwodzie", plus strony przechwytujące konkurencję: "splitday alternatywa", "2domy.pl alternatywa", "appclose po polsku" (AppClose i TalkingParents usunęli darmowe plany w 2026 - przesiedleni użytkownicy szukają teraz). Frazy okołorozwodowe mają intencję komercyjną i słabą polskojęzyczną konkurencję poza blogami kancelarii. Każdy artykuł kończy się szablonem do pobrania (plan wychowawczy, tabela wydatków) za adres e-mail.
5. **Koń trojański: szablony.** Opublikować najlepszy darmowy szablon "porozumienia rodzicielskiego / planu wychowawczego" (Word+PDF) w Polsce. Prawnicy i mediatorzy będą go podawać dalej; szablon wskazuje Do-Do jako narzędzie do jego realizacji.

Wydatki: domena/hosting już pokryte; 2-3 tys. PLN na tłumacza/korektora i projekt szablonów; 1-2 tys. PLN bufora.

### Poziom 1 - Seed-lite (50 000 PLN, 6-9 miesięcy)

Wszystko z Poziomu 0, plus:

1. **Partnership manager na część etatu (20-25 tys. PLN).** Osoba juniorska (albo dorabiający mediator), która wdroży 300+ mediatorów i 100+ kancelarii rodzinnych. To sprzedaż, nie marketing - kanał wymaga telefonów follow-up, nie newsletterów.
2. **Program mikroinfluencerów (10 tys. PLN).** 10-15 polskich twórców w niszy "życie po rozwodzie" / samodzielne rodzicielstwo na Instagramie i TikToku, 500-1 000 PLN za autentyczny content z historią. Unikać dużych influencerów parentingowych - za szeroko, zły moment.
3. **Płatny search tylko na frazy o wysokiej intencji (8-10 tys. PLN).** Google Ads na "aplikacja dla rozwiedzionych rodziców", "opieka naprzemienna aplikacja", "plan wychowawczy". Pominąć prospecting w Meta na tym poziomie - grupę definiuje wydarzenie życiowe, nie zainteresowania, więc targetowanie Meta jest nieefektywne. Meta tylko do retargetingu odwiedzających stronę.
4. **Cykl webinarów (2-3 tys. PLN).** Comiesięczny darmowy webinar dla mediatorów/psychologów: "Technologia w pracy z rodzicami po rozstaniu" - pozycjonuje Do-Do jako edukatora kategorii. Nagrywać, ciąć na klipy, publikować.
5. **Działania PR (5 tys. PLN albo własnymi siłami).** Historia pisze się sama: "77% orzeczeń rozwodowych w Polsce przyznaje wspólną opiekę - a rodzice nie mają polskiego narzędzia, by nią zarządzać. Lukę wypełnia szwajcarsko-polska aplikacja." Pitch do Wysokich Obcasów, Gazeta.pl, Spider's Web, Mamadu, dzienników biznesowych (wątek cen wg siły nabywczej).

Cel: 5 000 aktywowanych par, 500-800 płacących do 9. miesiąca. CAC przez przepisujących poniżej 40 PLN/parę; mieszany poniżej 80 PLN.

### Poziom 2 - Z finansowaniem (250 000 PLN, 12 miesięcy)

Wszystko powyżej, plus:

1. **Head of Partnerships na pełen etat + performance marketer na część etatu (120 tys. PLN).**
2. **Kanał benefitów pracowniczych (20 tys. PLN na integrację/sprzedaż).** Wpisać Do-Do na platformy kafeteryjne (Worksmile, Nais, MyBenefit, Motivizer). Pitch do HR: rozwód to top-3 zabójca produktywności; benefit za 19 PLN/mies. to najtańsze uzupełnienie EAP na rynku. Jeden średni pracodawca = setki potencjalnych użytkowników przy zerowym CAC. Niekonwencjonalne - i nikt tam nie konkuruje.
3. **Pakiety legal-tech (10 tys. PLN).** Partnerstwa z serwisami rozwodów online i marketplace'ami prawników - Do-Do w pakiecie porozwodowym, podział przychodu. Do tego white-label "powered by Do-Do" jako portale klienckie dla 5-10 największych kancelarii rodzinnych.
4. **Legitymizacja okołosądowa (głównie praca, 10 tys. PLN na wydarzenia).** Sponsoring/wystąpienia na kongresach mediatorów (Międzynarodowy Tydzień Mediacji w październiku to ogólnopolskie, wspierane przez ministerstwo wydarzenie - idealny moment na kampanię). Pozyskać pisemną opinię uznanego psychologa rodzinnego lub stowarzyszeń mediatorów. Cel: sędziowie i kuratorzy słyszą nazwę. W USA to nakazy sądowe zbudowały OurFamilyWizard; polskim odpowiednikiem jest ugoda mediacyjna polecająca narzędzie koordynacji z nazwy.
5. **Performance marketing w skali (60 tys. PLN).** Rozszerzony Google Search, pre-roll na YouTube przy treściach rozwodowych/parentingowych, retargeting Meta + lookalike z płacących użytkowników. Twardy sufit CAC: 150 PLN za płacącą parę (LTV przy medianie życia 18 mies. to ok. 250-340 PLN).
6. **Eksperyment z kampanią wizerunkową (30 tys. PLN).** Jeden emocjonalny materiał wideo ("Dwa domy, jedno dzieciństwo") do dystrybucji organicznej + płatnej. Testować przed skalowaniem.

Cel: 25 000+ aktywowanych par, 3 000-5 000 płacących do 12. miesiąca (run rate 0,5-0,85 mln PLN ARR).

---

## 6. Podejścia niekonwencjonalne

1. **Certyfikat "przepisywane, nie pobierane".** Darmowy 2-godzinny kurs online + certyfikat: "Certyfikowany specjalista koordynacji rodzicielskiej Do-Do" dla mediatorów i psychologów. Ludzie wpisują certyfikaty na LinkedIn; każdy certyfikat to chodzący kanał poleceń. Koszt: bliski zera.
2. **Problem drugiego rodzica jako growth hack.** Najtrudniejszy moment: rodzic A zaprasza wrogiego rodzica B. Zaproszenie maksymalnie niskotarciowe i pozwalające zachować twarz: neutralny SMS/e-mail "X dodał(a) grafik szkolny i wrześniowe wydatki dla [dziecko]. Zobacz - bez zakładania konta." Najpierw dostęp tylko do odczytu, konto później. To praca produktowa, która jest jednocześnie najważniejszym aktywem marketingowym, bo w każdej aktywowanej parze jeden użytkownik został *zrekrutowany przez sam produkt*.
3. **Kalkulator alimentów jako lead magnet.** Darmowy, naprawdę dobry "kalkulator kosztów utrzymania dziecka" (zgodny z tym, jak polskie sądy szacują alimenty). Wysoki wolumen wyszukiwań, zero dobrych narzędzi, naturalny pomost do śledzenia wydatków. Prawnicy będą linkować - darmowe backlinki i autorytet.
4. **Biblioteka klauzul do ugód mediacyjnych.** Darmowe klauzule do skopiowania dla mediatorów: "Rodzice zobowiązują się prowadzić wspólny kalendarz i ewidencję wydatków w aplikacji do koordynacji rodzicielskiej." Gdy użycie narzędzia jest wpisane w ugodę, churn spada do zera - ugoda jest quasi-wiążąca.
5. **Most do szkoły.** Polskie szkoły używają e-dzienników Librus/Vulcan, a rozstani rodzice ciągle kłócą się o to, kto widział które ogłoszenie. Nawet ręczna funkcja "przekaż e-maile ze szkoły na tablicę Do-Do" to klin; przyszła integracja to fosa. Żaden konkurent tego nie zrobi - nie są z Polski.
6. **Koalicja medialna "Rozwód bez wojny".** Współzałożyć miękką inicjatywę PR z 2-3 NGO i stowarzyszeniem mediatorów, promującą rozstania o niskim konflikcie. Do-Do jako partner technologiczny-założyciel. Earned media + efekt aureoli + dostęp do wydarzeń Tygodnia Mediacji.
7. **Plan roczny jako "ubezpieczenie".** Plan roczny sprzedawany jako "Spokój na rok szkolny", w sierpniu-wrześniu, gdy logistyka opieki osiąga szczyt. Pozwy rozwodowe i potrzeba aplikacji rosną po wakacjach i po świętach - każdy zryw kampanii planować na początek września i połowę stycznia.

---

## 7. Playbook partnerstw (kolejność priorytetów)

| Typ partnera | Liczba w PL | Oferta dla nich | Co zyskuje Do-Do | Wysiłek |
|---|---|---|---|---|
| Mediatorzy rodzinni | tysiące (listy przy sądach okręgowych) | Darmowe konto pro, kody dla klientów, eksport do ugody | Polecenia w idealnym momencie | Niski |
| Kancelarie rodzinne | setki aktywnych w rozwodach | Pakiety voucherów, portal white-label | Polecenia o wysokiej intencji | Średni |
| NGO (Sama Mama, Dzielny Tata itd.) | dziesiątki | Darmowe członkostwa, wspólne treści | Zaufanie społeczności, obie płcie | Niski |
| Psychologowie/terapeuci rodzinni | tysiące | Kurs z certyfikatem, kody dla klientów | Polecenia, retencja | Średni |
| Platformy benefitowe (Worksmile, Nais, MyBenefit) | 4-5 głównych | Gotowy benefit wellbeing | Dystrybucja B2B2C przy zerowym CAC | Średni |
| Rozwody online / legal-tech | kilka | Pakiet + podział przychodu | Strumień świeżych rozstań | Średni |
| Stowarzyszenia mediatorów + Tydzień Mediacji | 1 ogólnopolskie wydarzenie/rok (paźdz.) | Sponsoring, edukacja | Legitymizacja, zasięg okołosądowy | Wysoki |

Reguła kciuka: każdy przepisujący jest wart 20-50 par klientów rocznie, przy niemal zerowym koszcie krańcowym. 300 aktywnych przepisujących to faktyczne przywództwo rynkowe w Polsce.

---

## 8. Ceny i monetyzacja

**Otwarta decyzja - dwa modele na stole** (pełne wyliczenia w Review-Dokument-Inwestorski.md, sekcja 4). Aplikacja obecnie pobiera 19 PLN/mies.; Dokument Inwestorski proponuje 27/47 PLN za rodzica. Oba modele policzone na tym samym lejku (60 000 zarejestrowanych rodzin w M24, baza kosztowa z dokumentu):

| | Model A: za rodzica (27/47 PLN) | Model B: za rodzinę (35 PLN / 299 PLN/rok) |
|---|---|---|
| Para na Standard płaci | 54 PLN/mies. | 35 PLN/mies. |
| Spójność kotwic | psuje porównania z Librusem (35) i Netfliksem (43) | = dokładnie Librus, 19% taniej niż Netflix |
| Wpływ na pętlę zaproszeń | Rodzic B trafia na paywall w dniu 30-60 - tarcie w momencie lock-inu | zaproszony rodzic nigdy nie płaci - pętla nienaruszona |
| Założona konwersja | 20% rodzin, 40% z dwoma płacącymi | 28% rodzin (jeden decydent) |
| MRR w M24 (brutto) | ~420 tys. PLN | ~520-590 tys. PLN |
| Break-even (koszty 118 tys./mies.) | ~M13-15 | ~M12-14 |

Model A wygrywa tylko, jeśli >55% płacących rodzin skończy z obojgiem płacących rodziców - mało prawdopodobne, skoro cena za rodzica to najczęściej wymieniana słabość OurFamilyWizard. **Rekomendacja: Model B**, z Premium za rodzinę 59 PLN/mies. / 499 PLN/rok. Cena staje się pozycjonowaniem: "jedna cena, oboje rodziców - bo produkt działa tylko, gdy oboje są w środku."

Pozostałe zasady monetyzacji:

- Nie dawać rabatów publicznie; rabatować przez partnerów (3-6 miesięcy gratis przez kody przepisujących), żeby cena katalogowa pozostała kotwicą.
- Plan darmowy: na tyle hojny, żeby *zaproszony* rodzic nigdy nie trafił na paywall. Monetyzować rodzica-koordynatora (limity agenta AI, eksporty, przypomnienia, synchronizacja kalendarza, raporty wydatków do sądu).
- Rozliczać przez Stripe w webie (jak dziś) i mówić to inwestorom - brak prowizji 15-30% sklepów z aplikacjami; jawnie określić traktowanie VAT (35 PLN brutto = 28,50 netto).
- SKU B2B potwierdzone w Dokumencie Inwestorskim: panel Kancelaria za 299 PLN/mies. - sprzedawać przez ten sam kanał partnerski, który buduje ten GTM; dodać poziom "Panel mediatora" za 49-99 PLN/mies., gdy aktywnych będzie 50+ mediatorów.

## 9. KPI i pierwsze 90 dni

Metryka północnej gwiazdy: **aktywowane pary** (oboje rodziców dołączyło + utworzona 1 karta), nie pobrania.

Tygodnie 1-2: audyt polskiej lokalizacji, przegląd tarcia w przepływie zaproszenia, landing dla przepisujących (do-do.app/dla-mediatorow), szablon planu wychowawczego online.
Tygodnie 3-6: 100 e-maili do mediatorów + 20 rozmów; pitch do Polskiej Mediatorki i 3 blogów; rozmowy partnerskie z Sama Mama + Dzielny Tata; pierwsze 5 artykułów SEO.
Tygodnie 7-12: pierwszy webinar; MVP kalkulatora alimentów; fala pitchy PR; cotygodniowy pomiar aktywacji z kodów przepisujących. Bramka decyzyjna w dniu 90: jeśli >=10 przepisujących dało >=100 aktywowanych par, kanał działa - każdy nowy budżet kierować najpierw tam.

Strażnicy lejka: akceptacja zaproszeń >50% (jeśli niżej - naprawiać zaproszenie, nie marketing), retencja par w 4. tygodniu >40%, konwersja free-to-paid >10% w 3. miesiącu.

## 10. Ryzyka

- **Porażka dwustronnej aktywacji** - drugi rodzic odmawia. Mitygacja: zaproszenie read-only bez konta (magic link z gotowym profilem rodziny, wg Dokumentu Inwestorskiego, sekcja 4.1), neutralny ton, rama przepisującego ("mediator poprosił, żebyśmy tego używali"), cena za rodzinę, więc Rodzic B nigdy nie płaci.
- **Darmowy jeździec (sklejka: Messenger + GCal + Splitwise).** Mitygacja: wspólny kontekst, niezmienialny rejestr, RODO, eksporty przyjazne sądom, rekomendacja przepisujących.
- **Ryzyko odpowiedzi Splitday** - są po polsku i z finansowaniem. Mitygacja: najpierw wygrać kanał przepisujących (oni nie mają ruchu B2B), wykorzystać lukę architektury synchronizacji dwustronnej w oknie 12-18 miesięcy, naciskać przewagę danych dzieci w UE.
- **Sezonowość** - martwe miesiące letnie. Mitygacja: wydatki zgrane ze szczytami wrzesień/styczeń.
- **Zaufanie do danych wrażliwych.** Wcześnie opublikować stronę prywatności prostym polskim językiem; RODO + hosting w UE to broń - używać jej głośno.
- **Pułapka pozycjonowania w wojnie płci.** Grupy praw ojców to silny kanał, ale polaryzujący; każde partnerstwo ojcowskie równoważyć matczynym, a głos marki trzymać ściśle dziecko-centryczny.

---

*Źródła: statystyki GUS/MS via twpr.pl, interia.pl, ssgk.stat.gov.pl; statystyki mediacji gov.pl/web/sprawiedliwosc i ubiconcordia.pl; ceny konkurencji ourfamilywizard.com, talkingparents.com, wealthysinglemommy.com; dowód luki na polskim rynku polskamediatorka.com; społeczności fundacja.sama-mama.pl, materiały o Dzielnym Tacie.*
