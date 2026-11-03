# Reverzný návrh z rozmerov skenu

Predvolene sa otvorí režim **Z nameraného kusu**. **Modul sa nezadáva; je výsledkom identifikácie.** Začnite známym počtom zubov a nameranými priemermi. Pole pre vopred známy modul je skryté v rozšírených nastaveniach a bežne zostáva prázdne. Režim **Návrh z parametrov** je priamy návrh so známym modulom; výber kandidáta ho otvorí s vypočítanými hodnotami. Prepínanie režimov zachová rozpracované merania.

Funkcia funguje aj na statickom hostingu, lokálne v prehliadači. Neimportuje STL ani mračno bodov: vstupy sú už namerané rozmery v mm.

## Postup

1. Vyberte samostatné koleso alebo súkolesie so známou nominálnou osovou vzdialenosťou.
2. Zadajte známy počet zubov (8–120); pri páre oba počty a osovú vzdialenosť. Je potrebný aspoň jeden priemer.
3. Rozlišujte vonkajší/hlavový priemer `da`, pätný priemer `df` a základný priemer `db`. Základná kružnica nie je viditeľná pätná kružnica; `db` má zmysel ako spoľahlivý výsledok fitu evolventy.
4. Zadajte toleranciu každého priemeru ± v mm podľa kvality merania, registrácie skenu a opotrebenia. Ide o jeden spoločný absolútny limit, nie smerodajnú odchýlku. Nemerané polia nechajte prázdne.
5. Známy modul a uhol môžete zadať priamo. Inak sa prehľadáva zobrazený zoznam preferovaných modulov (0,2–10 mm) a uhly 14,5°, 20°, 25°, 30°. Zoznam nie je úplným katalógom ozubenia. Palcové ozubenie vyžaduje vlastný prepočítaný modul `m=25,4/DP` v podporovanom rozsahu.
6. Nulovú korekciu predpokladajte iba s podkladom. Pri neznámej korekcii sa hľadá interval `−0,5 ≤ x ≤ 0,8`.
7. Porovnajte kandidátov a odchýlky. Aj jediný kandidát je podmienený modelom a prehľadávaným zoznamom. Neznamená jedinečné určenie pôvodnej súčiastky.
8. Preneste vybraného kandidáta do existujúceho návrhu a skontrolujte geometriu. Prenos zruší predchádzajúci súhlas s aproximovaným STEP. Neschválená geometria naďalej blokuje STEP.

Pri prenose samostatného kolesa sa vytvorí **hypotetické** druhé koleso so 48 zubmi a `x2=−x1`. Tým sa zachová nulové skrátenie hlavy a rekonštruované priemery prvého kolesa. Skutočný protikus tým nie je určený. Ak opačná korekcia prekročí rozsah existujúceho modelu, prenos nie je povolený. Pre skutočný pár použite merania oboch kolies a osovej vzdialenosti.

Nezmerané otvory sa pri prenose nastavia na nulu, šírka na 16 mm. Materiál a zaťaženie sa nastavia na predvolené hodnoty aplikácie. PDF po prenose opisuje aktuálny návrh; neobsahuje protokol pôvodných meraní a rezíduí.

## Výpočtový model

Rovnaké predpoklady ako pri priamom návrhu: vonkajšie čelné evolventné ozubenie, `ha*=1`, `hf*=1,25`, bez vôle, opotrebenia, trochoidnej päty a samostatnej výrobnej úpravy hlavy.

Pre samostatné koleso predpokladáme nulové skrátenie hlavy `k=0`:

```
da = m(z+2+2x)
df = m(z−2,5+2x)
db = mz cos α
m = (da−df)/4,5
```

Posledný vzťah neplatí všeobecne pri skrátenej hlave, inom základnom hrebeni alebo opotrebovaní. Samotné `z` a `da` dávajú rodinu riešení `x=(da/m−z−2)/2`. `da` a `df` samy neurčujú uhol záberu. Meranie cez zuby/valčeky môže pomôcť, ale v tejto verzii nemá vstup ani výpočtový model.

Pri páre sa pre každý modul a uhol odvodí súčet korekcií a skrátenie hlavy z pevnej nominálnej vzdialenosti `a`:

```
a0 = m(z1+z2)/2
αw = acos(a0 cos α / a)
inv α = tan α − α             (uhly v radiánoch)
xsum = (inv αw − inv α)(z1+z2)/(2 tan α)
k = xsum − (a−a0)/m
x2 = xsum − x1
dai = m(zi+2+2xi−2k)
dfi = m(zi−2,5+2xi)
```

Osová vzdialenosť sa považuje za presnú nominálnu hodnotu pre daný výpočet. Jej neistota sa automaticky nepropaguje; pre preskúmanie citlivosti zopakujte výpočet pre kraje nameraného rozsahu. Výpočet nezahŕňa montážnu vôľu, ktorá môže narušiť tento predpoklad. Nie je to úplné hľadanie vo všetkých neistotách páru.

Každé meranie dáva lineárnu podmienku `|offset+slope*x1−measured| ≤ tolerance`. Pre dané `m`, `α`, `a` sa presne pretínajú intervaly korekcie a jej medze. Z prieniku sa vyberie ohraničené riešenie najmenších štvorcov; tabuľka ukazuje aj celý prípustný interval. Základné priemery filtrujú modul/uhol nezávisle od korekcie. RMS je odmocnina priemeru štvorcov odchýlok zadaných priemerov, nie pravdepodobnosť kandidáta. Rovnaké meranie zadané v dvoch poliach nie je nezávislý dôkaz.

Rozmerovo prípustný kandidát môže byť podrezaný alebo sa nemusí dať reprezentovať existujúcim modelom. Kontroly priameho návrhu sa vykonajú pri prenose; samotná identifikácia necertifikuje výrobu ani pôvodný normový systém. Pri nulovom počte kandidátov nezvyšujte toleranciu len na dosiahnutie výsledku: skontrolujte meranie, druh ozubenia, jednotky, nástroj a predpoklady.
