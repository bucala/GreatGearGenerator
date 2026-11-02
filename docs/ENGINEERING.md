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

## Predbežné kontroly

- Riziko podrezania pri hrebeňovom nástroji: z < 2(1−x)/sin² α.
  Ide o hranicu pre ideálny plnoprofilový hrebeň, nie o simuláciu konkrétneho nástroja.
- qᵢ = sqrt(raᵢ²−rbᵢ²), L = a sin αw.
- εα = (q₁+q₂−L)/(πm cos α); trvalý záber vyžaduje εα ≥ 1.
- Pre aktívnu evolventu sa kontroluje q₁ ≤ L−s₂ a q₂ ≤ L−s₁,
  kde sᵢ = sqrt(max(rbᵢ,rfᵢ)²−rbᵢ²). Kontrola nezahŕňa kontakt s generovanou
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
oblúky hláv/pät a radiálne prechody. Parameter `tol=1e-8` je tolerancia
interpolačného algoritmu, **nie certifikovaná maximálna odchýlka od evolventy**.
Neuvádzame neoverenú výrobnú presnosť. Exportuje sa jedno STEP s dvomi telesami,
šírkou a otvormi. Koleso 2 je fázované o π−π/z₂ a posunuté o a.

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
