# Regulamentul de joc RonDuel

**Ultima actualizare: [DATA] (propunere: 1 decembrie 2026)**
**Versiunea: 1.0**

Pe scurt: o rundă pe zi, aceeași pentru toți, de circa un minut. Răspunsurile corecte primesc puncte, iar cele rapide primesc bonus. Totul se măsoară pe serverul nostru. Joci cu prietenii în ligi și în dueluri. Nu se joacă pe bani și nu se câștigă bani.

Acest regulament completează [Termenii și condițiile](https://ronduel.eu/ro/termeni). Dacă cele două texte se contrazic, se aplică Termenii și condițiile.

Operatorul RonDuel este Pixel-WebAPP SRL, CUI 54870881, Nr. Reg. Com. J2026038031009, sediul în [STRADA, NR.], Mangalia, jud. Constanța, email contact@pixel-webapp.ro.

---

## 1. Ce este RonDuel și ce nu este

1.1. RonDuel este un joc zilnic de cultură generală și logică, jucat cu prietenii. Rezultatul depinde de cunoștințele, raționamentul și viteza ta.

1.2. **Nu este un joc de noroc și nu are premii.** Nu plătești nicio miză ca să participi. Nu există premii în bani, în obiecte, în vouchere sau în alte foloase. Punctele, seriile, trofeele și clasamentele nu au valoare bănească, nu pot fi schimbate pe bani și nu pot fi transferate (art. 7 din Termeni).

1.3. **Jocul de bază este gratuit.** Poți juca runda zilnică, poți crea și intra în ligi și poți juca dueluri fără să plătești nimic, în limitele de la art. 7.4. Abonamentul RonDuel Pro este opțional și plătit (art. 12).

## 2. Runda zilnică

2.1. **O rundă pe zi, aceeași pentru toți.** Pentru fiecare dată calendaristică există o singură rundă. Toți cei care au aceeași dată calendaristică primesc aceleași întrebări, în aceeași ordine și cu variantele în aceeași ordine. Runda are un număr (de exemplu #142), care crește cu 1 în fiecare zi de la lansare.

2.2. **Când apare runda nouă.** Runda nouă apare la **miezul nopții, ora locală a ta**, adică la 00:00 în fusul orar al dispozitivului tău (modelul Wordle). Joci întotdeauna runda corespunzătoare datei tale locale. Data o calculează serverul nostru, pe baza orei serverului și a fusului orar transmis de dispozitiv. Nu folosim data afișată de telefonul tău.

2.3. **Schimbarea fusului orar.** Fusul orar salvat în contul tău se poate schimba **cel mult o dată la 24 de ore**. Fiecare schimbare este înregistrată, ca nimeni să nu poată „sări” într-o zi viitoare pentru a vedea runda din timp.

2.4. **Ce conține runda.** De regulă, runda are **6 întrebări**:
- 2 întrebări cu variante (o singură variantă corectă din 4);
- 1 întrebare de ordonare (aranjezi 4 elemente în ordinea cerută);
- 1 întrebare „intrusul” (alegi varianta care nu se potrivește);
- 2 întrebări de logică sau calcul (cu 4 variante).

Compoziția unei runde poate varia. Numărul de întrebări și timpul fiecăreia îl vezi în aplicație înainte să începi.

2.5. **Timp pe întrebare:**
- întrebări cu variante și „intrusul”: **10 secunde**;
- ordonare și logică/calcul: **15 secunde**.

O rundă obișnuită durează cam 60 de secunde, cel mult 75.

2.6. **Limba întrebărilor.** Dacă o întrebare nu are încă o traducere verificată în română, o primești în engleză, marcată cu eticheta „EN”.

## 3. O singură încercare pe zi

3.1. Poți juca runda zilnică **o singură dată pe zi**, cu un singur cont.

3.2. **Când începe încercarea.** Înainte de start vezi ecranul „Gata?” și o numărătoare 3-2-1. **Încercarea începe în momentul în care serverul îți trimite prima întrebare.** Din acel moment runda contează și nu mai poate fi reluată.

3.3. **Dacă ieși din joc.** Dacă închizi pagina, pierzi conexiunea sau apeși „înapoi”, încercarea nu se resetează. Când revii, continui cu următoarea întrebare la care n-ai răspuns. Întrebarea de la care ai plecat contează ca **expirată (0 puncte)**, pentru că timpul ei a curs pe server.

3.4. **Dacă nu mai revii în aceeași zi.** [DE CONFIRMAT: specificația nu spune ce se întâmplă cu o rundă începută și neterminată până la miezul nopții. Propunere: la sfârșitul zilei tale locale runda se închide automat. Întrebările fără răspuns primesc 0 puncte, iar scorul obținut până atunci intră în clasamente și ține seria activă.]

## 4. Cum se calculează punctele

4.1. **Răspuns corect: 100 de puncte + bonus de viteză.**
**Răspuns greșit sau timp expirat: 0 puncte.**

4.2. **Formula bonusului de viteză:**

> bonus = round( 100 × max(0, (limită − timp) / limită) )

unde:
- **limită** = timpul întrebării (10 sau 15 secunde);
- **timp** = timpul măsurat **pe serverul nostru**, de la momentul în care ți-a fost trimisă întrebarea până la momentul în care a ajuns răspunsul tău, **minus 250 de milisecunde** pentru întârzierile de rețea. Timpul nu poate fi mai mic de 0;
- **round** = rotunjire la cel mai apropiat număr întreg.

Bonusul e cu atât mai mare cu cât răspunzi mai repede. Un răspuns corect primește între 100 și 200 de puncte.

4.3. **Exemple** (întrebare de 10 secunde, răspuns corect):
- răspuns ajuns pe server după 2,25 s: timp = 2 s, bonus = round(100 × 8/10) = 80, total **180**;
- răspuns ajuns după 7,75 s: timp = 7,5 s, bonus = round(100 × 2,5/10) = 25, total **125**;
- răspuns ajuns după expirarea timpului: **0 puncte**. [DE CONFIRMAT: specificația nu spune dacă toleranța de 250 ms se aplică și la expirare. Dacă se aplică, un răspuns ajuns între 10 s și 10,25 s încă primește puncte. Propunere: toleranța se aplică doar la calculul bonusului, iar limita de expirare rămâne 10 s, măsurată pe server.]

4.4. **Scor maxim: 1.200 de puncte pe zi** (6 întrebări × 200).

4.5. **Întrebările de ordonare** se punctează „tot sau nimic”: primești puncte doar dacă toate cele 4 elemente sunt în ordinea corectă.

4.6. **Cronometrul de pe ecran este doar informativ.** Pentru puncte contează exclusiv timpul măsurat de server. Răspunsul corect îl vezi doar după ce ai răspuns sau după ce a expirat timpul. La final poți revedea toate răspunsurile, cu explicații.

4.7. **Timp extins (setare de accesibilitate).** Din setări poți activa „Timp relaxat”, care îți dă cu **50% mai mult timp** la fiecare întrebare. Rundele jucate așa contează în clasamente, dar sunt marcate cu o mică pictogramă. [DE CONFIRMAT: dacă bonusul se calculează după limita mărită, aceeași viteză de răspuns aduce mai multe puncte decât fără setare (de exemplu, un răspuns în 5 s primește bonus 67 în loc de 50). Propunere: limita mărită se aplică doar pentru expirarea timpului, iar bonusul de viteză se calculează după limita standard, ca setarea să ofere mai mult timp fără să dea puncte în plus.]

## 5. Egalități

5.1. **Clasamentul zilei.** La scor egal, câștigă cine are **timpul total mai mic** (suma timpilor măsurați de server). Dacă și timpul e egal, câștigă cine a **terminat runda mai devreme**.

5.2. **Clasamentul săptămânii și trofeul.** La scor săptămânal egal, câștigă cine are **mai puține secunde în total** în săptămâna respectivă. [DE CONFIRMAT: specificația nu spune ce se întâmplă dacă și timpul total e egal. Propunere: trofeul se acordă tuturor jucătorilor la egalitate.]

5.3. **Dueluri.** Vezi art. 8.4.

## 6. Clasamente

6.1. Fiecare ligă are trei clasamente:
- **Azi**: scorurile din runda zilei;
- **Săptămâna aceasta**: suma scorurilor zilnice din săptămâna ligii; zilele în care nu ai jucat contează cu 0;
- **General**: scorul total, numărul de runde jucate, trofeele săptămânale câștigate și cea mai lungă serie.

6.2. **Fără spoilere.** Până nu termini runda zilei, nu vezi scorurile de azi ale celorlalți. Vezi doar cine a jucat. Clasamentul „Azi” se actualizează în timp real.

6.3. **Ziua și săptămâna ligii.** Ziua și săptămâna unei ligi se calculează după **fusul orar al ligii**. Acesta e stabilit la creare, după dispozitivul celui care a creat liga, și poate fi schimbat de proprietar. **Săptămâna ligii începe luni la 00:00 și se termină duminică la 23:59:59**, ora ligii.

6.4. [DE CONFIRMAT: membrii unei ligi pot fi în fusuri orare diferite. Runda o joci după data ta locală, dar ziua ligii se calculează după fusul ei. Propunere: scorul tău intră în ziua ligii care are aceeași dată ca runda jucată de tine. Trebuie stabilit și ce se întâmplă cu săptămâna în curs când proprietarul schimbă fusul orar al ligii. Propunere: schimbarea se aplică de la săptămâna următoare.]

6.5. Doar runda zilnică intră în clasamente. Rundele din arhivă și rundele suplimentare **nu contează** (art. 12.3).

## 7. Ligi

7.1. **Crearea unei ligi.** După prima rundă, dacă nu ești într-o ligă, poți distribui rezultatul în grupul tău de chat. Linkul distribuit creează automat o ligă. Liga primește un nume amuzant generat automat, pe care îl poți schimba, și un cod de invitație de 6 caractere.

7.2. **Intrarea în ligă.** Oricine deschide linkul de invitație vede numele ligii, membrii și clasamentul de azi, apoi poate intra cu un singur buton. Tot ce trebuie să aleagă este un nickname, care trebuie să fie unic în acea ligă. Dacă nickname-ul e ocupat, îți propunem o variantă.

7.3. **Intrarea în timpul săptămânii.** Poți intra într-o ligă oricând. Zilele de dinainte de intrare contează cu 0 în clasamentul săptămânii.

7.4. **Limite pentru contul gratuit.** În prezent, un cont gratuit poate:
- crea cel mult **3 ligi**, fiecare cu cel mult **25 de membri**;
- fi membru în cel mult **10 ligi**;
- avea cel mult **3 dueluri active** în același timp.

Limitele în vigoare sunt afișate în aplicație și pot fi modificate (art. 6.4 din Termeni). Dacă o ligă gratuită are deja 25 de membri, următorul jucător nu mai poate intra, iar aplicația îi spune de ce.

7.5. **Proprietarul ligii** (unul singur pe ligă) poate:
- schimba numele ligii și fusul ei orar;
- schimba nickname-ul unui membru sau elimina un membru;
- transfera proprietatea altui membru.

Proprietarul trebuie să respecte regulile de conduită (art. 8 din Termeni). Orice membru poate raporta un nickname sau un nume de ligă (art. 9 din Termeni).

7.6. **Ieșirea din ligă.** Poți ieși oricând dintr-o ligă. [DE CONFIRMAT: ce se întâmplă cu scorurile din clasamentul săptămânii și cel general după ieșire. Mai trebuie stabilit ce se întâmplă cu liga când proprietarul își șterge contul sau iese. Propunere: scorurile rămân afișate anonimizat, iar proprietatea trece automat la membrul cel mai vechi.]

7.7. **Ștergerea contului.** Dacă un membru își șterge contul, scorurile lui rămân în clasamente sub numele „Fost jucător” (art. 5.6 din Termeni).

## 8. Dueluri 1 la 1

8.1. **Ce este un duel.** Un duel e o mini-rundă separată, de **5 întrebări**, jucată de doi jucători, nu neapărat în același timp. Întrebările de duel vin dintr-o bază separată. Nu sunt niciodată din runda zilei sau din rundele următoarelor 7 zile.

8.2. **Cine poate juca.** Poți provoca un membru al ligii tale sau poți trimite oricui un link de duel deschis.

8.3. **Punctaj.** Duelul se punctează la fel ca runda zilnică (art. 4): 100 de puncte + bonus de viteză pentru fiecare răspuns corect, măsurat pe server. Scorul maxim într-un duel este 1.000 de puncte. [DE CONFIRMAT: specificația spune doar că duelurile au același model anti-trișare; propunerea este ca formula de punctaj să fie identică.]

8.4. **Cine câștigă.** Câștigă scorul mai mare. La scor egal, câștigă cine are **timpul total mai mic**. [DE CONFIRMAT: dacă și timpul e egal. Propunere: duelul se încheie la egalitate.]

8.5. **Termene și expirare:**
- fiecare jucător are **24 de ore** să-și joace partea;
- dacă adversarul nu începe duelul în 24 de ore de la creare, duelul **expiră** și nu are câștigător;
- dacă cel care a lansat provocarea și-a terminat partea, iar adversarul nu joacă în 24 de ore de atunci, câștigă cel care a lansat provocarea, **prin neprezentarea adversarului**. Rezultatul e marcat ca atare.

[DE CONFIRMAT: specificația nu acoperă două situații. Prima: adversarul începe duelul, dar nu-l termină. Propunere: întrebările fără răspuns primesc 0 și duelul se închide la expirare. A doua: la un link deschis, cine devine adversar. Propunere: primul care începe duelul.]

8.6. **Unde apar rezultatele.** Rezultatul apare pe pagina duelului și în fluxul ligii. Pentru fiecare pereche de jucători ținem un bilanț de victorii și înfrângeri. **Duelurile nu adaugă puncte în clasamentele ligii.**

## 9. Serii (streak)

9.1. Seria crește cu 1 pentru fiecare zi locală consecutivă în care **ai terminat** runda zilei. Dacă sari o zi, seria revine la 0. Păstrăm și cea mai lungă serie a ta.

9.2. **Scutul de serie (doar Pro).** Abonații Pro au automat un scut pe săptămână (săptămână ISO, de luni până duminică). Scutul acoperă o zi ratată, iar seria nu se pierde. Scutul nu se acumulează de la o săptămână la alta. [DE CONFIRMAT: dacă săptămâna scutului se calculează după fusul orar al jucătorului, cum propunem.]

## 10. Corectitudine și trișat

10.1. **Ce înseamnă trișat.** Este interzis:
- să folosești scripturi, boți, extensii sau alte unelte automate care răspund în locul tău;
- să folosești mai multe conturi ca să joci aceeași rundă de mai multe ori, ca să vezi întrebările înainte sau ca să umfli o ligă;
- să manipulezi fusul orar, ceasul sau cererile către server, ca să obții runda din timp sau mai mult timp;
- să încerci să afli răspunsurile înainte de a răspunde, interceptând sau modificând datele aplicației;
- să publici întrebările sau răspunsurile zilei înainte ca ziua să se termine, cu scopul de a avantaja pe cineva. [DE CONFIRMAT: dacă această regulă se adoptă.]

10.2. **Cum detectăm.** Toate punctele și timpii se calculează pe server. Răspunsurile nu ajung în aplicație înainte să răspunzi. Marcăm pentru verificare de către un om, fără să blocăm automat:
- rundele în care **cel puțin 3 răspunsuri** au venit în mai puțin de **0,4 secunde**;
- situațiile în care mai multe conturi de pe același dispozitiv sau de la aceeași adresă IP joacă în aceeași ligă în aceeași zi.

O rundă marcată contează în continuare până la verificare.

10.3. **Sancțiuni**, proporționale cu gravitatea faptei:
- **anularea scorului** unei runde sau al unui duel; clasamentele afectate se recalculează;
- restrângerea temporară a unor funcții;
- **suspendarea sau închiderea contului**, în cazuri grave sau repetate.

[DE CONFIRMAT: dacă un trofeu săptămânal deja acordat se poate retrage și reacorda după anularea unui scor. Propunere: da, în cel mult 7 zile de la închiderea săptămânii.]

10.4. **Explicație și contestare.** Pentru orice sancțiune primești o explicație și o poți contesta, după procedura din **art. 9 și art. 13 din Termenii și condițiile** (https://ronduel.eu/ro/termeni).

## 11. Erori la întrebări și probleme tehnice

11.1. **Întrebare greșită.** Verificăm întrebările înainte de publicare. Dacă găsești totuși o întrebare cu răspuns greșit, ambiguă sau cu mai multe răspunsuri corecte, scrie-ne la contact@pixel-webapp.ro sau folosește opțiunea de raportare din aplicație, dacă există.

11.2. **Ce facem cu punctele.** [DE CONFIRMAT: specificația nu prevede o regulă. Propunere: dacă stabilim că o întrebare a fost greșită, o considerăm corectă pentru toți cei care au răspuns la ea în timp, oricare ar fi varianta aleasă. Ei primesc 100 de puncte plus bonusul de viteză calculat normal. Cine a lăsat timpul să expire primește tot 0. Recalculăm scorurile și clasamentele afectate și anunțăm corecția în aplicație. Nu corectăm săptămânile închise de mai mult de 7 zile.]

11.3. **Probleme tehnice ale tale.** Problemele de conexiune, dispozitiv sau browser nu dau dreptul la o nouă încercare. Se aplică art. 3.3.

11.4. **Probleme tehnice ale noastre.** [DE CONFIRMAT: specificația nu prevede o regulă. Propunere: dacă din jurnalele serverului reiese că o eroare a noastră (de exemplu o pană de server) a afectat rundele, putem anula întrebările afectate pentru toți jucătorii (0 puncte pentru toți la acea întrebare), putem anula runda pentru toți sau putem permite reluarea ei. Anunțăm decizia în aplicație. Pentru zilele afectate seria nu se pierde.]

11.5. Dacă nu ești de acord cu o decizie luată conform acestui articol, ne poți scrie la contact@pixel-webapp.ro (art. 16 din Termeni).

## 12. Ce primești cu RonDuel Pro

12.1. Pro este un abonament plătit, opțional. Condițiile lui sunt în [Termenii Pro](https://ronduel.eu/ro/termeni-pro). Pro include:
- ligi de până la **200 de membri**, ligi private cu aprobarea cererilor de intrare și emoji sau culoare proprie pentru ligă;
- **dueluri nelimitate**;
- **arhiva** rundelor trecute;
- **runde suplimentare** (pachete de exersare pe teme);
- **statistici avansate** (precizie pe teme, evoluția vitezei, bilanțuri directe);
- **teme** vizuale;
- **scutul de serie** săptămânal (art. 9.2).

12.2. **Pro nu îți dă puncte în plus.** Abonamentul nu schimbă formula de punctaj, timpul pe întrebare sau întrebările din runda zilnică. Abonații Pro joacă runda zilnică în aceleași condiții ca toți ceilalți.

12.3. **Rundele din arhivă și rundele suplimentare** se joacă doar pentru distracție și exersare. **Nu contează** în clasamentele ligilor, la trofee sau la serie. [DE CONFIRMAT: specificația spune explicit acest lucru doar pentru arhivă; propunem aceeași regulă pentru rundele suplimentare.]

12.4. Scutul de serie poate influența seria afișată, inclusiv „cea mai lungă serie” din clasamentul general. Duelurile nelimitate pot influența bilanțul de dueluri. Nu influențează punctajul din clasamentele zilnice, săptămânale sau generale.

## 13. Modificarea regulamentului

13.1. Putem modifica acest regulament, de exemplu ca să corectăm o regulă neclară sau ca să adăugăm un tip nou de întrebare. Modificările importante le anunțăm în aplicație cu cel puțin **7 zile** înainte. Ele se aplică de la începutul săptămânii de joc următoare, ca să nu schimbăm regulile în mijlocul unei săptămâni. [DE CONFIRMAT: termenul de 7 zile; Termenii prevăd 30 de zile pentru modificarea Termenilor.]

13.2. Data ultimei actualizări e scrisă la începutul și la sfârșitul paginii.

## 14. Contact

Întrebări despre reguli: contact@pixel-webapp.ro.

---
*Ultima actualizare: [DATA] (propunere: 1 decembrie 2026)*
