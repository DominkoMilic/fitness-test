// EDIT HERE — single source of truth for the Croatian privacy policy.
// Replace TODO_* placeholders with the operator's real data before going live.
// `lastUpdated` is rendered as Croatian month + year, e.g. "svibanj 2026.".

export const PRIVACY_OPERATOR = {
  // Naziv tvrtke / obrta / fizičke osobe koja je voditelj obrade.
  companyName: "Bird Of Prey d.o.o.",
  // OIB voditelja obrade.
  oib: "17978132687",
  // Adresa sjedišta.
  address: "Šibenik (Grad Šibenik), Put Gvozdenova 253",
  // Kontakt e-mail za privatnost / GDPR upite.
  contactEmail: "birdofpreydoo@gmail.com",
  // (Opcionalno) Kontakt telefon.
  contactPhone: "+385 95 527 5554",
} as const;

export const PRIVACY_LAST_UPDATED = new Date("2026-05-07");

export type PrivacySection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: "uvod",
    title: "1. Uvod",
    paragraphs: [
      `Ova Pravila privatnosti opisuju kako ${PRIVACY_OPERATOR.companyName} (u nastavku: „mi“, „nas“) prikuplja, koristi i štiti vaše osobne podatke kada koristite aplikaciju Krešimir Fit Tracker (u nastavku: „Aplikacija“).`,
      "Pravila su usklađena s Općom uredbom o zaštiti podataka (EU) 2016/679 (GDPR) i Zakonom o provedbi Opće uredbe o zaštiti podataka (NN 42/2018).",
    ],
  },
  {
    id: "voditelj-obrade",
    title: "2. Voditelj obrade osobnih podataka",
    paragraphs: [
      `Voditelj obrade je ${PRIVACY_OPERATOR.companyName}, OIB: ${PRIVACY_OPERATOR.oib}, sjedište: ${PRIVACY_OPERATOR.address}.`,
      `Za sva pitanja vezana uz obradu osobnih podataka možete nas kontaktirati na e-mail: ${PRIVACY_OPERATOR.contactEmail}${`, telefon: ${PRIVACY_OPERATOR.contactPhone}`}.`,
    ],
  },
  {
    id: "podaci",
    title: "3. Koje podatke prikupljamo",
    paragraphs: [
      "Prikupljamo isključivo podatke koji su nužni za rad Aplikacije i pružanje usluge praćenja prehrane i unosa kalorija:",
    ],
    bullets: [
      "Pristupni kod (interna oznaka korisnika koju vam dodjeljujemo).",
      "Ime ili nadimak vezan uz pristupni kod.",
      "Datum isteka koda i osobni dnevni cilj kalorija.",
      "Unose hrane (namirnica, količina, obrok, datum) koje sami upisujete.",
      "Spremljene omiljene obroke i povijest pretraživanja namirnica.",
      "Tehničke podatke nužne za rad Aplikacije (npr. lokalna pohrana u pregledniku, vrijeme zadnje akcije).",
    ],
  },
  {
    id: "svrha",
    title: "4. Svrha i pravna osnova obrade",
    paragraphs: [
      "Vaše podatke obrađujemo u sljedeće svrhe i temeljem sljedećih pravnih osnova:",
    ],
    bullets: [
      "Pružanje usluge fitness aplikacije i praćenja prehrane (čl. 6. st. 1. t. b GDPR-a — izvršavanje ugovora odnosno predugovornih radnji).",
      "Statistička obrada anonimiziranih podataka radi unaprjeđenja usluge i preporuka u Aplikaciji (čl. 6. st. 1. t. f GDPR-a — legitimni interes).",
      "Ispunjavanje zakonskih obveza voditelja obrade (čl. 6. st. 1. t. c GDPR-a).",
    ],
  },
  {
    id: "ne-dijelimo",
    title: "5. Ne dijelimo podatke s trećim stranama u marketinške svrhe",
    paragraphs: [
      "Vaše osobne podatke ne prodajemo, ne iznajmljujemo niti ih dijelimo s trećim stranama u svrhu oglašavanja.",
      "Podatke koristimo isključivo za rad Aplikacije i poboljšanje korisničkog iskustva (npr. brže dohvaćanje često pretraživanih namirnica, prikaz omiljenih obroka i sl.).",
    ],
  },
  {
    id: "izvrsitelji",
    title: "6. Izvršitelji obrade (pružatelji infrastrukture)",
    paragraphs: [
      "Za pohranu i isporuku Aplikacije koristimo sljedeće izvršitelje obrade:",
    ],
    bullets: [
      "Supabase (Supabase, Inc.) — baza podataka i autentikacija. Podaci se pohranjuju u podatkovnom centru unutar EU/EEA-e.",
      "Vercel (Vercel Inc.) — hosting i isporuka web aplikacije putem CDN-a.",
    ],
  },
  {
    id: "rok-cuvanja",
    title: "7. Rok čuvanja podataka",
    paragraphs: [
      "Vaše podatke čuvamo dok je vaš pristupni kod aktivan, odnosno do isteka koda navedenog u sustavu.",
      "Nakon isteka koda ili zahtjeva za brisanje, podatke brišemo u razumnom roku, najkasnije unutar 30 dana, osim u slučaju zakonske obveze duljeg čuvanja.",
    ],
  },
  {
    id: "prava",
    title: "8. Vaša prava",
    paragraphs: ["U skladu s GDPR-om imate sljedeća prava:"],
    bullets: [
      "Pravo na pristup vlastitim podacima.",
      "Pravo na ispravak netočnih ili nepotpunih podataka.",
      "Pravo na brisanje („pravo na zaborav“).",
      "Pravo na ograničenje obrade.",
      "Pravo na prenosivost podataka.",
      "Pravo na prigovor na obradu temeljem legitimnog interesa.",
      "Pravo na pritužbu nadzornom tijelu — Agenciji za zaštitu osobnih podataka (AZOP), Selska cesta 136, 10000 Zagreb.",
    ],
  },
  {
    id: "kontakt-prava",
    title: "9. Ostvarivanje prava",
    paragraphs: [
      `Za ostvarivanje bilo kojeg od navedenih prava obratite nam se na e-mail ${PRIVACY_OPERATOR.contactEmail}.`,
      "Na vaš zahtjev odgovorit ćemo bez odgode, najkasnije u roku od 30 dana.",
    ],
  },
  {
    id: "kolacici",
    title: "10. Kolačići (cookies) i lokalna pohrana",
    paragraphs: [
      "Aplikacija koristi isključivo nužne (tehničke) kolačiće i lokalnu pohranu u vašem pregledniku potrebne za rad Aplikacije, primjerice za pamćenje pristupnog koda, brzo dohvaćanje namirnica i postavki.",
      "Ne koristimo marketinške, analitičke niti kolačiće trećih strana. Kako su kolačići isključivo nužni, oni ne zahtijevaju izričitu privolu prema GDPR-u i ePrivacy direktivi, ali vas o njihovom korištenju i dalje transparentno obavještavamo putem informativne obavijesti pri prvom posjetu.",
    ],
  },
  {
    id: "sigurnost",
    title: "11. Sigurnost podataka",
    paragraphs: [
      "Podatke štitimo primjerenim tehničkim i organizacijskim mjerama, uključujući enkripciju u prijenosu (HTTPS/TLS), kontrolu pristupa na razini baze (Supabase RLS) te ograničen broj osoba s administratorskim pristupom.",
    ],
  },
  {
    id: "izmjene",
    title: "12. Izmjene Pravila privatnosti",
    paragraphs: [
      "Pravila se mogu povremeno mijenjati radi usklađivanja s pravnim propisima ili promjenama u Aplikaciji. Aktualna verzija uvijek je dostupna unutar Aplikacije s naznačenim datumom posljednje izmjene.",
    ],
  },
];
