# 🌾 Gårdsalg

En lille, lækker webapp til telefonen, der viser hvor du kan købe **friske
afgrøder, æg, jordbær, honning og andre gårdlækkerier** i nærheden af
sommerhuset på **Syrenvej 4, 3210 Vejby** (Nordsjælland).

Tænk: kort + liste over vejboder, stalddørssalg og gårdbutikker, sorteret efter
hvor tæt de er – med "kør mig dertil", åbningstider, og hvad de sælger.

![Gårdsalg](icons/icon.svg)

## ✨ Funktioner

- 🗺️ **Kort** med alle steder + dit sommerhus (OpenStreetMap, ingen API-nøgle).
- 📍 **Afstand** fra sommerhuset – eller tryk *Min position* for afstande fra hvor du står lige nu.
- 🥕 **Filtrér** på varegrupper (æg, frugt & bær, grønt, honning, mejeri, kød, is, vin …).
- 🔎 **Søg** på navn eller vare ("jordbær", "æg", "naturvin" …).
- 🕒 **Åben nu**-status (selvbetjening/døgnåben, faste tider eller sæson).
- 🧭 **Kør mig dertil** åbner ruten i Google Maps. Ring/skriv direkte fra appen.
- 📲 **PWA** – kan lægges på hjemmeskærmen og virker offline (data caches).

## 🚀 Kør lokalt

Det er en ren statisk side – ingen build. Start en lille webserver (så
`fetch()` af JSON virker; at åbne `index.html` direkte fra `file://` gør ikke):

```bash
python3 -m http.server 8000
# åbn http://localhost:8000 på computer eller telefon (samme net)
```

## 🌍 Deploy (GitHub Pages)

1. Push til GitHub.
2. **Settings → Pages → Build from branch** → vælg branch + mappen `/ (root)`.
3. Åbn den udstillede URL på telefonen og vælg *Føj til hjemmeskærm*.

Alt er relative stier, så det virker også fra en undermappe.

## 📂 Struktur

```
index.html              App-skal
css/styles.css          Styling (mobile-first, varm "mark"-palet)
js/app.js               Al logik (filtre, kort, afstand, detalje-ark)
data/config.json        App-titel, sommerhusets position, kategorier
data/places.json        ⭐ ALLE salgssteder – det er her data bor
data/README.md          ⭐ Sådan tilføjer du nye steder (læs denne!)
manifest.webmanifest    PWA-manifest
sw.js                   Service worker (offline-cache)
icons/icon.svg          App-ikon
```

## ➕ Tilføj et nyt sted

Næsten alt vedligehold = at redigere **`data/places.json`**.
Den fulde guide (skema, skabelon, koordinater, åbningstider) ligger i
**[`data/README.md`](data/README.md)**.

Kort fortalt: kopiér en eksisterende blok, ret felterne, find `lat`/`lng` til
adressen, vælg `categories` fra `config.json`, og validér med
`python3 -m json.tool data/places.json`.

## 📍 Om data

Førsteversionen er bygget ud fra steder Jacob selv har fundet (screenshots fra
apps som *Gårdsalg/frit-fjerkrae*, Google Maps og @visitnordsjaelland) plus
websøgning efter manglende adresser/åbningstider.

> **Koordinat-note:** Sommerhusets position og de adresse-match, der kan
> bekræftes sikkert, er slået op i DAWA. `lat`/`lng` ligger i `data/config.json`
> og `data/places.json`; *Kør mig dertil* bruger stadig adresse-teksten, så
> navigationen forbliver robust.

Kortdata © OpenStreetMap-bidragydere.
