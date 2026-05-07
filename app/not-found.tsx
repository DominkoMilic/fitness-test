import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "linear-gradient(160deg,#1b3255 0%,#0e1e36 100%)" }}
    >
      <div className="text-6xl mb-4">🤷‍♂️</div>
      <h1 className="text-white text-3xl font-extrabold mb-3">404</h1>
      <p className="text-white text-lg font-bold mb-2">
        Ups, ova stranica je pobjegla s treninga.
      </p>
      <p className="text-white/70 text-sm max-w-sm mb-8">
        Link je vjerojatno kriv ili je stranica promijenila adresu. Bez brige,
        aplikacija radi — samo ova ruta ne postoji.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/dashboard"
          className="w-full py-3 rounded-xl text-white text-sm font-bold bg-linear-to-br from-orange to-orange-dark"
        >
          Vrati me na Danas
        </Link>
        <Link
          href="/search"
          className="w-full py-3 rounded-xl text-white text-sm font-bold border border-white/20 bg-white/10"
        >
          Dodaj namirnicu
        </Link>
      </div>

      <div className="mt-8 text-white/50 text-xs">
        Ako i dalje ne radi, reci adminu da popravi link 🙂
      </div>
    </div>
  );
}
