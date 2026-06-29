# 📥 Sådan tilføjer du et nyt salgssted

> **Til kommende agenter (og mennesker):** Hele appen drives af `data/places.json`.
> Du behøver **ikke** røre HTML/CSS/JS for at tilføje, rette eller fjerne et sted –
> bare rediger JSON-filen. Hold dig til skemaet herunder, så virker kort, filtre,
> afstande og detaljevisning automatisk.

Brugeren (Jacob) sender typisk et **screenshot, et link eller en adresse** på et
nyt gårdsalg/vejbod i Nordsjælland nær sommerhuset (**Syrenvej 4, 3210 Vejby**).
Din opgave er at omsætte det til en ny post i `places.json`.

---

## 1. Arbejdsgang

1. **Saml oplysninger.** Læs screenshottet / linket. Find som minimum **navn** og
   **adresse**. Søg gerne resten frem (telefon, hvad de sælger, åbningstider) via
   web­søgning hvis det mangler.
2. **Find koordinater** (`lat`/`lng`) til adressen – se afsnit 3.
3. **Vælg kategorier** fra den faste liste i `config.json` (afsnit 4).
4. **Tilføj en ny `{}`-blok** i `places.json`. Brug skabelonen i afsnit 2.
5. **Validér JSON'en** (ingen efterstillede kommaer, gyldig syntaks):
   `python3 -m json.tool data/places.json > /dev/null` — fejler kommandoen, er JSON'en ugyldig.
6. Sæt `"verified"` til dagens dato (`ÅÅÅÅ-MM-DD`) og skriv hvor data kom fra i `"source"`.

---

## 2. Skabelon (kopiér og udfyld)

```json
{
  "id": "kort-unikt-id",
  "name": "Stedets navn",
  "tagline": "Kort, fængende undertekst (3–6 ord)",
  "description": "1–3 sætninger. Brug gerne stedets egne ord fra skilt/hjemmeside.",
  "address": "Vejnavn 00, 0000 By",
  "lat": 56.0000,
  "lng": 12.0000,
  "categories": ["aeg", "groent"],
  "products": ["Æg", "Kartofler", "Honning"],
  "hours": {
    "alwaysOpen": true,
    "note": "Selvbetjening – døgnåben.",
    "season": "",
    "weekly": null
  },
  "selfService": true,
  "payment": ["mobilepay", "kontant"],
  "phone": "12345678",
  "email": "",
  "website": "",
  "instagram": "",
  "contactPerson": "",
  "source": "Hvor data kom fra (screenshot/hjemmeside)",
  "verified": "2026-06-29",
  "featured": false
}
```

## 3. Felter forklaret

| Felt | Krav | Forklaring |
|------|------|-----------|
| `id` | ✅ | Unikt, små bogstaver, bindestreger. Bruges internt. |
| `name` | ✅ | Vises som overskrift. |
| `tagline` | ✅ | Kort undertekst på kort + detalje. |
| `description` | – | Den længere tekst i detaljevisningen. |
| `address` | ✅ | Fuld adresse. Bruges også til **"Kør mig dertil"** (Google Maps), så den skal være korrekt. |
| `lat`, `lng` | ✅ | Koordinater til kortet (WGS84, decimalgrader). Se afsnit 3-koordinater. |
| `categories` | ✅ | Liste af kategori-`id`'er fra `config.json` (afsnit 4). Første kategori bestemmer kort-emoji/avatar. |
| `products` | – | Liste af konkrete varer (vises som chips). |
| `hours` | ✅ | Se afsnit 5. |
| `selfService` | – | `true` for vejbod/selvbetjening (giver badge "Selvbetjening"). |
| `payment` | – | Tilladte værdier: `"kort"`, `"mobilepay"`, `"kontant"`. |
| `phone`, `phone2` | – | Tlf. (8 cifre, mellemrum er ok). `phone2` til ekstra nummer. |
| `email`, `website`, `instagram` | – | `website` må gerne være en Instagram/Facebook-URL. |
| `contactPerson` | – | Navn på personen bag. |
| `source`, `verified` | – | Sporbarhed: hvor og hvornår data blev bekræftet. |
| `featured` | – | `true` løfter stedet til toppen og giver det fuld bredde. Brug sparsomt. |

### Koordinater (`lat`/`lng`)

Markøren på kortet og afstands­sorteringen bruger `lat`/`lng`. **"Kør mig dertil"**
bruger derimod `address`-teksten, så navigationen er præcis, selvom koordinaterne
er en anelse upræcise.

Sådan finder du koordinater:

- **Bedst (præcist):** Danmarks officielle adresse-API (DAWA). Når netværk er åbent:
  ```
  https://api.dataforsyningen.dk/adgangsadresser?vejnavn=Syrenvej&husnr=4&postnr=3210&struktur=mini
  ```
  Brug `x` (= `lng`) og `y` (= `lat`) fra svaret.
- **Alternativt:** Slå adressen op på Google Maps / OpenStreetMap, højreklik → kopiér
  koordinater. Rækkefølgen er altid `lat, lng` (Nordsjælland ligger ca. `lat ≈ 56`, `lng ≈ 12`).
- **Bemærk:** I dette miljø var udgående opslag til Nominatim/DAWA spærret af proxy-politik
  (403). Eksisterende koordinater er derfor *estimerede* ud fra adressen. Når du har
  netadgang, må du gerne efterjustere dem med DAWA for fuld præcision.

## 4. Gyldige kategorier

Hentes fra `config.json`. Pr. nu:

`aeg` 🥚 · `frugt-baer` 🍓 · `groent` 🥕 · `kartofler` 🥔 · `honning` 🍯 ·
`mejeri` 🧀 · `koed` 🥩 · `blomster` 💐 · `drikkevarer` 🍷 · `is` 🍦 ·
`syltetoej` 🫙 · `planter` 🌱

Mangler der en kategori? Tilføj den i `config.json` under `"categories"` med
`id`, `label`, `emoji` og en `color` (hex). Så dukker den automatisk op som filter-chip.

## 5. Åbningstider (`hours`)

Vælg den model der passer:

- **Døgnåben / selvbetjening:**
  ```json
  "hours": { "alwaysOpen": true, "note": "Selvbetjening – døgnåben.", "season": "", "weekly": null }
  ```
- **Faste ugentlige tider** (giver live "Åben nu / Lukket"-badge):
  ```json
  "hours": {
    "alwaysOpen": false,
    "note": "Man–søn kl. 06–21",
    "season": "",
    "weekly": {
      "mon": ["06:00","21:00"], "tue": ["06:00","21:00"], "wed": ["06:00","21:00"],
      "thu": ["06:00","21:00"], "fri": ["06:00","21:00"], "sat": ["06:00","21:00"],
      "sun": ["06:00","21:00"]
    }
  }
  ```
  (Udelad en dag for at markere den som lukket.)
- **Sæsonåbent** (vises som en lille sæson-badge):
  ```json
  "hours": { "alwaysOpen": false, "note": "Hver weekend fra medio maj…", "season": "Maj – august", "weekly": null }
  ```
- **Ring i forvejen:**
  ```json
  "hours": { "alwaysOpen": false, "note": "Ring gerne i forvejen.", "season": "", "weekly": null }
  ```

---

Det var det! Gem filen, og stedet er live på kortet og i listen. 🌾
