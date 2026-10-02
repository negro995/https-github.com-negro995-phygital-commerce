import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-5xl">✦</p>
      <h1 className="mt-4 text-xl font-bold">Página no encontrada</h1>
      <Link href="/" className="mt-6 inline-block font-semibold text-brand-700 hover:underline">
        Volver a la tienda
      </Link>
    </div>
  );
}
