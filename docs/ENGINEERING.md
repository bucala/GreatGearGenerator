# Výpočtový model a jeho hranice

Všetky dĺžky sú v mm, sily v N, napätia v MPa. Moment vstupuje v N·m a vo
výpočte sa násobí 1000. Úhly sa interne počítajú v radiánoch. Podporujeme iba
vonkajšie čelné súkolesie s priamymi zubami, rovnakým modulom a uhlom záberu.
Základný hrebeň: ha*=1, hf*=1,25, c*=0,25, nulová nominálna bočná vôľa.

## Geometria a korekcie

Pre m, z, α a korekciu x:

- d = mz, db = d cos α.
- inv α = tan α − α.
- inv αw = inv α + 2(x₁+x₂) tan α / (z₁+z₂).
- a₀ = m(z₁+z₂)/2, a = a₀ cos α / cos αw.
- y = (a−a₀)/m, k = x₁+x₂−y (spoločné skrátenie hláv).
- da = m(z+2+2x−2k), df = m(z−2,5+2x).

Inverzia inv používa bisekciu. Neexistujúci kladný pracovný uhol, neplatné
kružnice, špicaté zuby, prekrývajúce sa päty a priveľké otvory sa odmietnu.
Minimálna radiálna hrúbka pod pätou pri otvore je 0,2m (konštrukčné obmedzenie,
nie pevnostne odvodená hodnota).

Evolventa základnej kružnice s polomerom rb:

```text
x(t) = rb (cos t + t sin t)
y(t) = rb (sin t − t cos t)
r(t) = rb sqrt(1+t²)
θ(t) = t − atan(t)
```

Polovičný uhol zuba na základnej kružnici je
βb = (π/2+2x tan α)/z + inv α. Boky sú natočené na ±(βb−θ(t)).
Evolventa sa začína na max(rb, rf) a končí na ra. Ak rf < rb, nasleduje radiálny
úsek medzi pätou a základnou kružnicou. Je to návrhový prechod, nie výrobná
trochoida. Model nesimuluje podrezanie pri výrobe.

### Voliteľné kruhové zaoblenie päty

Vstup `root_fillet` je 0 (bez zaoblenia, predvolené) alebo 1 (navrhované kruhové prechody).
Východiskový návrh je R=0,3m, nie normové odporúčanie nástroja. Polomer sa podľa
priestoru automaticky zmenší tak, aby sa susedné prechody neprekrývali a zostalo
aspoň 35 % pôvodného intervalu evolventy. Ak to nie je možné, model sa odmietne.

Kružnica zaoblenia je zvonka dotyčnicová k pätnej kružnici, preto jej stred C
spĺňa |C|=rf+R. Ak dotyk ešte leží na radiálnom predĺžení boku, jeho polomer je
rt=sqrt(rf²+2rfR). Ak rt>rb, prechod sa dotýka evolventy pri parametri
`t=(sqrt((rf+R)²−rb²)−R)/rb`. Stred leží na vonkajšej normále boku vo vzdialenosti
R. Pravá strana je zrkadlenie ľavej. Kruhové úseky sú v STEP a SVG skutočné oblúky;
náhľad 3D ich vzorkuje. Výsledný R pre každé koleso uvádza rozhranie aj PDF.

Zaoblenie päty pridáva materiál v päte, nemení rozstupový, hlavový, základný ani pätný
priemer. Nie je to simulácia výroby, generovaná trochoida, úprava hlavy ani
zaoblenie hrán po šírke. Návrh nástroja, kvalita výroby a účinok R na koncentráciu
napätia/únavu nie sú overené. Predbežný Lewisov odhad zostáva nominálny.

### Hlava zuba a hrany po šírke

`tip_fillet=1` pridáva konvexné kruhové prechody hlavy. Východiskový R je 0,1m,
obmedzený zostávajúcou korunou a intervalom aktívnej evolventy. Stred kružnice
leží dovnútra na normále boku a spĺňa |C|=ra−R. Dotyk s evolventou má parameter
`t=(R+sqrt((ra−R)²−rb²))/rb`. Zachová sa hlavový priemer na korune, ale skráti
sa aktívny bok a skutočná oblúková hrúbka koruny. Súčiniteľ záberu preto používa
nový koniec aktívnej evolventy; kontakt na kruhovom prechode sa nezapočítava.

`face_fillet=1` vyžaduje oba rovinné prechody, aby CAD obrys zostal súvislý.
Rozhranie ich pri zapnutí tejto voľby zapne; vypnutie päty alebo hlavy vypne aj
hrany po šírke. Podporované je najviac 60 zubov na koleso. Návrhový polomer je
`min(0,05m; 0,1b; R_päty/2; R_hlavy/2)`. OpenCascade zaobľuje obvodové hrany oboch
čiel vrátane otvorov. Neplatné teleso alebo zlyhanie CAD sa hlási ako chyba,
nikdy sa potichu nenahradí ostrým modelom.

3D náhľad tejto voľby je tessellácia toho istého CAD telesa ako STEP; nejde len
o vizuálne vyhladenie. Výpočet beží vo worker vlákne s limitom 300 sekúnd a možno
ho zrušiť zmenou geometrie. STEP z úspešného náhľadu sa uchová ako jedna dočasná
kópia pre rovnaké geometrické parametre. Ďalší export tak nemusí opakovať fillet.
Odhad napätí používa konzervatívnu strednú šírku `b_eff=b−2 max(R_hrán)`;
nenahrádza tým priestorové rozdelenie zaťaženia ani pevnostnú analýzu.

### Kótovaný detail zuba a medzery

V režime priameho návrhu je pre každé koleso samostatný zväčšený detail aj export SVG.
Referenčné kružnice majú krátke značky A (hlavová), B (rozstupová), C (základná)
a D (pätná). Hodnoty a vzory čiar sú v oddelenej legende; geometria je orezaná
na vlastnú kresliacu oblasť, aby čiary nevstupovali do textu legendy. Rovnaké
oddelenie zostáva aj v exportovanom SVG.
`d / Dr` označuje rozstupový priemer; `df / Df` pätný, `da` hlavový, `db` základný.
Kóty vznikajú priamo z aktuálneho výpočtu, nie meraním vzorkovaného náhľadu:

- `p=πm`, `s=m(π/2+2x tan α)`, `e=p−s` sú **oblúkové** dĺžky na referenčnej
  rozstupovej kružnici, nie tetivy.
- `ha=(da−d)/2`, `hf=(d−df)/2`, `h=ha+hf`; skrátenie hlavy k je zahrnuté v da.
- Náčrt zobrazuje aj m, z, α, x, šírku b, otvor a skutočne použitý R.
- Tabuľka obsahuje aj základný rozstup `pb=p cos α`, hrúbku zuba `sa` a medzeru `ea`
  na hlavovej kružnici a voľný oblúk medzi prechodmi na pätnej kružnici `ef`.
- Geometria oblúkov je vektorová; evolventa v SVG je lomená čiara z 96 intervalov
  na bok. Analytické kóty tým nie sú zmenené. SVG nie je exaktný výrobný profil
  ani automaticky výkres v tlačovej mierke 1:1. Rozhranie zobrazuje hodnoty zaokrúhlené
  na štyri desatinné miesta v mm, čo nepredstavuje výrobnú toleranciu.

## Predbežné kontroly

- Riziko podrezania pri hrebeňovom nástroji: z < 2(1−x)/sin² α.
  Ide o hranicu pre ideálny plnoprofilový hrebeň, nie o simuláciu konkrétneho nástroja.
- qᵢ = sqrt(raᵢ²−rbᵢ²), L = a sin αw.
- εα = (q₁+q₂−L)/(πm cos α); trvalý záber vyžaduje εα ≥ 1.
- Pre aktívnu evolventu sa kontroluje q₁ ≤ L−s₂ a q₂ ≤ L−s₁,
  kde sᵢ = sqrt(max(rbᵢ,rfᵢ)²−rbᵢ²) bez zaoblenia; pri zaoblení sᵢ=rbᵢ·tᵢ
  od jeho dotyku s aktívnym bokom. Kontrola nezahŕňa kontakt s generovanou
  trochoidou, tolerancie, vôľu ani deformácie.
- Hrúbka na hlave da·(βb−θ(ta)) má byť aspoň 0,25m. Je to návrhové odporúčanie,
  nie vyhlásenie zhody s normou.

## Zaťaženie

Pracovné polomery rw₁ = a z₁/(z₁+z₂), rw₂ = a−rw₁.
Ft = 1000 T₁/rw₁, Fn = Ft/cos αw.

Hertzov odhad líniového kontaktu v pracovnom rozstupovom bode:
ρᵢ = rwᵢ sin αw; R′ = ρ₁ρ₂/(ρ₁+ρ₂);
E′ = E/[2(1−ν²)] pre rovnaký materiál;
σH = sqrt(Fn E′/(π b R′)). Celé zaťaženie nesie jeden pár zubov.

Lewisov statický odhad ohybu:
Y = 0,484−2,87/z; σF = Ft/(b m Y).
Tento odhad sprístupňujeme iba pre nekorigované plnoprofilové 20° ozubenie.
Pre korekcie alebo iný uhol vrátime `null`, nie extrapolovaný výsledok.

Tieto hodnoty neobsahujú dynamiku, rozdelenie zaťaženia po šírke, únavu,
koncentrácie napätia, mazanie, teplotu, kvalitu ozubenia, materiálovú pevnosť ani
bezpečnostné súčinitele. Nedávajú výsledok „pevnostne vyhovuje“.

## Exaktnosť CAD

Analytická rovnica a jej numerické vyhodnotenie nie sú exaktnou reprezentáciou
evolventy v STEP. CadQuery `parametricCurve` aproximuje krivku spline geometriou.
Táto implementácia preto **neplní** pôvodnú požiadavku exaktného STEP bez spline.
Predvolený export je zamietnutý, alternatívny návrhový export vyžaduje explicitné
zapnutie aproximácie.

Alternatíva používa `Edge.makeSpline` cez 65 bodov na bok, presné kružnicové
oblúky hláv/pät a radiálne alebo voliteľné dotyčnicové kruhové prechody. Parameter `tol=1e-8` je tolerancia
interpolačného algoritmu, **nie certifikovaná maximálna odchýlka od evolventy**.
Neuvádzame neoverenú výrobnú presnosť. Exportuje sa jedno STEP s dvomi telesami,
šírkou a otvormi. Koleso 2 je fázované o π−π/z₂ a posunuté o a.

## Prehliadačový runtime na Surge

Frontend používa tie isté rovnice a hranice vstupov v `frontend/src/geometry.ts`.
Desať referenčných prípadov generovaných Python jadrom kontroluje skalárne hodnoty,
geometrické kontroly a vzorky oboch profilov. PDF vytvára jsPDF.
STEP generuje samostatný worker s Replicad/OpenCascade.js: B-spline aproximácia
65 analytických bodov na bok (`tolerance=1e-7` pre aproximátor), kružnicové oblúky,
radiálna alebo kruhovo zaoblená päta, otvory a dve telesá v pracovnej osovej vzdialenosti. Tolerancia
aproximátora nie je certifikovaný globálny limit odchýlky evolventy. Exaktný STEP
zostáva nepodporovaný. Pri každom exporte sa overí objem oboch telies; CI navyše
spätne načíta stiahnutý súbor desktopovým OpenCascade jadrom a overí platnosť.

## Referencie

- [KHK: Calculation of Gear Dimensions](https://khkgears.net/new/gear_knowledge/gear_technical_reference/calculation_gear_dimensions.html)
- [SDP-SI: Elements of Metric Gear Technology, section 4](https://www.sdp-si.com/resources/elements-of-metric-gear-technology/page3.php)
  (tabuľka korigovaného súkolesia: m=3, z=12/24, x=0,6/0,36,
  αw≈26,0886°, a≈56,4999 mm; automatický regresný test).
- [KHK: Gear Profile Shift](https://khkgears.net/new/gear_knowledge/abcs_of_gears-b/gear_profile_shift.html)
- [CadQuery: Workplane.parametricCurve](https://cadquery.readthedocs.io/en/latest/classreference.html#cadquery.Workplane.parametricCurve)
- [CadQuery: Edge.makeSpline](https://cadquery.readthedocs.io/en/latest/classreference.html#cadquery.Edge.makeSpline)
- Lewisov vzťah a Hertzova teória sú elementárne odhady; ISO 6336 / DIN 3990
  sa uvádzajú iba ako **neimplementované** metódy plného pevnostného overenia.
