import { PrismaClient, ProductType } from "@prisma/client";

const prisma = new PrismaClient();

const products: Array<{
  slug: string;
  name: string;
  description: string;
  type: ProductType;
  category: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
}> = [
  {
    slug: "heritage-leather-jacket",
    name: "Campera de cuero Heritage",
    description: "Campera de cuero plena flor terminada a mano. Incluye pasaporte digital QR y un Gemelo Digital intransferible.",
    type: ProductType.PHYSICAL,
    category: "indumentaria",
    priceCents: 24900,
    stock: 25,
    imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80",
  },
  {
    slug: "artisan-coffee-beans",
    name: "Café de especialidad en grano 1 kg",
    description: "Café de origen único, tostado en el local todas las mañanas.",
    type: ProductType.PHYSICAL,
    category: "almacén",
    priceCents: 2800,
    stock: 120,
    imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&q=80",
  },
  {
    slug: "limited-sneakers-genesis",
    name: "Zapatillas Genesis edición limitada",
    description: "Serie numerada de 500 pares. Autenticidad verificable en blockchain.",
    type: ProductType.PHYSICAL,
    category: "calzado",
    priceCents: 18900,
    stock: 40,
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
  },
  {
    slug: "ceramic-mug-set",
    name: "Set de tazas de cerámica",
    description: "Dos tazas de cerámica hechas a mano en nuestro taller.",
    type: ProductType.PHYSICAL,
    category: "hogar",
    priceCents: 3900,
    stock: 60,
    imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80",
  },
  {
    slug: "barista-masterclass",
    name: "Masterclass de barista (online)",
    description: "Curso en video + preguntas en vivo. El acceso se habilita con tu Gemelo Digital.",
    type: ProductType.DIGITAL,
    category: "cursos",
    priceCents: 4900,
    stock: 10000,
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
  },
  {
    slug: "styling-session-voucher",
    name: "Sesión de asesoramiento de imagen",
    description: "Voucher digital canjeable en cualquiera de nuestros locales.",
    type: ProductType.DIGITAL,
    category: "servicios",
    priceCents: 6500,
    stock: 200,
    imageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
  },
  {
    slug: "digital-lookbook-2026",
    name: "Lookbook 2026 (coleccionable digital)",
    description: "Lookbook digital exclusivo con contenido detrás de escena.",
    type: ProductType.DIGITAL,
    category: "coleccionables",
    priceCents: 1500,
    stock: 10000,
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
  },
  {
    slug: "canvas-tote-bag",
    name: "Bolso tote de lona",
    description: "Tote de lona orgánica gruesa con manijas de cuero.",
    type: ProductType.PHYSICAL,
    category: "accesorios",
    priceCents: 4500,
    stock: 80,
    imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80",
  },
];

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@phygital.dev").toLowerCase();
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: { email: adminEmail, name: "Administrador", role: "ADMIN" },
  });

  const store =
    (await prisma.store.findFirst({ where: { name: { in: ["Local principal", "Flagship Store"] } } })) ??
    (await prisma.store.create({ data: { name: "Local principal", address: "Av. Corrientes 1234", city: "Buenos Aires" } }));

  for (const p of products) {
    await prisma.product.upsert({ where: { slug: p.slug }, update: p, create: p });
  }

  console.log(`Seed listo: admin ${adminEmail}, local ${store.name} y ${products.length} productos.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
