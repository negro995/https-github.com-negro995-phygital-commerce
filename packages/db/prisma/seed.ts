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
    name: "Heritage Leather Jacket",
    description: "Hand-finished full-grain leather jacket. Ships with a QR digital passport and a soulbound Digital Twin.",
    type: ProductType.PHYSICAL,
    category: "apparel",
    priceCents: 24900,
    stock: 25,
    imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80",
  },
  {
    slug: "artisan-coffee-beans",
    name: "Artisan Coffee Beans 1kg",
    description: "Single-origin beans roasted in-store every morning.",
    type: ProductType.PHYSICAL,
    category: "food",
    priceCents: 2800,
    stock: 120,
    imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&q=80",
  },
  {
    slug: "limited-sneakers-genesis",
    name: "Genesis Limited Sneakers",
    description: "Numbered run of 500 pairs. Authenticity verifiable on-chain.",
    type: ProductType.PHYSICAL,
    category: "footwear",
    priceCents: 18900,
    stock: 40,
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
  },
  {
    slug: "ceramic-mug-set",
    name: "Ceramic Mug Set",
    description: "Set of two hand-thrown ceramic mugs from our local workshop.",
    type: ProductType.PHYSICAL,
    category: "home",
    priceCents: 3900,
    stock: 60,
    imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80",
  },
  {
    slug: "barista-masterclass",
    name: "Barista Masterclass (Online)",
    description: "Video course + live Q&A. Access is token-gated by your Digital Twin.",
    type: ProductType.DIGITAL,
    category: "courses",
    priceCents: 4900,
    stock: 10000,
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
  },
  {
    slug: "styling-session-voucher",
    name: "Personal Styling Session",
    description: "Digital voucher redeemable in any of our stores.",
    type: ProductType.DIGITAL,
    category: "services",
    priceCents: 6500,
    stock: 200,
    imageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
  },
  {
    slug: "digital-lookbook-2026",
    name: "Lookbook 2026 (Digital Collectible)",
    description: "Exclusive digital lookbook with behind-the-scenes content.",
    type: ProductType.DIGITAL,
    category: "collectibles",
    priceCents: 1500,
    stock: 10000,
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
  },
  {
    slug: "canvas-tote-bag",
    name: "Canvas Tote Bag",
    description: "Heavy organic canvas tote with leather straps.",
    type: ProductType.PHYSICAL,
    category: "accessories",
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
    create: { email: adminEmail, name: "Store Manager", role: "ADMIN" },
  });

  const store =
    (await prisma.store.findFirst({ where: { name: "Flagship Store" } })) ??
    (await prisma.store.create({ data: { name: "Flagship Store", address: "123 Main St", city: "Buenos Aires" } }));

  for (const p of products) {
    await prisma.product.upsert({ where: { slug: p.slug }, update: p, create: p });
  }

  console.log(`Seeded admin ${adminEmail}, store ${store.name} and ${products.length} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
