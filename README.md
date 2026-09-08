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

```bash
npm run deploy:web
```

Skrypt robi trzy rzeczy: `expo export --platform web` do katalogu `dist`,
kopiuje `scripts/vercel-static.json` jako `dist/vercel.json` (czyste adresy,
przekierowanie tras dynamicznych na `index.html`, nagłówek `X-Robots-Tag:
noindex` i cache na `_expo/`), po czym wysyła `dist` na Vercela.

Pierwsze uruchomienie prosi o zalogowanie do Vercela (`vercel login`). Przed
deployem warto puścić `npm run check`, bo ani `expo export`, ani Vercel nie
sprawdzają typów.

Czego link **nie** załatwia:

- Osoba, która sama się zarejestruje, nie ma wpisu w `memberships`, więc Edge
  Functions odpowiedzą jej `403 User has no tenant membership`. Testerzy muszą
  dostać konto przypisane do tenanta.
- `site_url` i lista dozwolonych przekierowań w Supabase Auth muszą zawierać
  adres deploya, inaczej link potwierdzający z maila odsyła na `localhost`.
