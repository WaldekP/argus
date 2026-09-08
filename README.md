# Argus

Aplikacja mobilna zbudowana na [Expo](https://expo.dev) (React Native, expo-router, TypeScript).

## Uruchomienie

1. Zainstaluj zależności

   ```bash
   npm install
   ```

2. Wystartuj aplikację

   ```bash
   npx expo start
   ```

Aplikację można otworzyć w:

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [emulatorze Androida](https://docs.expo.dev/workflow/android-studio-emulator/)
- [symulatorze iOS](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go)

## Struktura

Routing oparty o pliki ([file-based routing](https://docs.expo.dev/router/introduction)) — ekrany znajdują się w katalogu **src/app**.

## Wersja webowa do testów

Aplikacja ma web jako pełnoprawny target, więc testerzy dostają zwykły link
w przeglądarce, bez instalowania czegokolwiek. Hosting: Vercel, deploy z gotowego
buildu (nie z repozytorium), bo dzięki temu klucze `EXPO_PUBLIC_*` biorą się
z lokalnego `.env` i nie trzeba ich duplikować w panelu Vercela.

Stały adres pilotażu: **https://argus-pilotaz.vercel.app**

```bash
npm run deploy:web
```

Skrypt robi cztery rzeczy: `expo export --platform web` do katalogu `dist`,
dokłada `dist/vercel.json` i dowiązanie do projektu (`scripts/prepare-web-deploy.mjs`),
wysyła `dist` na Vercela i przepina stały adres na nowe wdrożenie
(`scripts/deploy-web.mjs`). Oba dokładane pliki muszą powstawać po eksporcie,
bo `expo export` kasuje cały katalog `dist` razem z `dist/.vercel/`.

Pierwsze uruchomienie prosi o zalogowanie do Vercela (`vercel login`). Przed
deployem warto puścić `npm run check`, bo ani `expo export`, ani Vercel nie
sprawdzają typów.

Czego link **nie** załatwia:

- Osoba, która sama się zarejestruje, nie ma wpisu w `memberships`, więc Edge
  Functions odpowiedzą jej `403 User has no tenant membership`. Testerzy muszą
  dostać konto przypisane do tenanta.
- `site_url` i lista dozwolonych przekierowań w Supabase Auth wskazują na
  `https://argus-pilotaz.vercel.app`. Zmieniając adres deploya, zaktualizuj obie
  wartości, inaczej link potwierdzający z maila odeśle testera w pustkę.
