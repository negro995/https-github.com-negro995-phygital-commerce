# Phygital Commerce

A full-stack **Web3 + AI hybrid commerce platform** for physical retailers and digital stores.

- **Storefront** (Next.js + Tailwind, mobile-first) for physical and digital products, with an **AI shopping concierge**.
- **Store manager dashboard**: inventory, in-store (POS) sales, **QR digital passports**, and a Digital Twin mint queue.
- **Digital Twins**: every purchase — online or by scanning an in-store QR passport — mints a **soulbound ERC-1155** token to the customer's wallet. Wallets are created automatically on checkout (Privy social login + embedded wallets), so customers never handle seed phrases.
- **Automatic loyalty**: the number of twins a wallet holds (read on-chain) sets the loyalty tier, which unlocks token-gated perks and a discount that is **applied server-side at checkout**.
- **Hybrid payments**: Stripe, Mercado Pago, USDC (any 6-decimal ERC-20 on an EVM chain) and a mock provider for local development.

---

## Architecture

```
apps/
  web/          Next.js 16 storefront + /admin dashboard (React 19, Tailwind 4, Privy)
  api/          Hono REST API: checkout, payments, webhooks, mint worker, passports, AI, admin
packages/
  shared/       Domain types, Zod schemas, loyalty tiers and pricing (used by web + api)
  db/           Prisma schema, migrations and seed (PostgreSQL)
  web3/         viem clients: TwinMinter (idempotent minting), loyalty reads, USDC transfer verification
  contracts/    Hardhat project: PhygitalTwin.sol (soulbound ERC-1155) + MockUSDC
```

### How a purchase flows

1. **Checkout** (`POST /api/checkout`) — the API re-prices the cart from the database, reads the buyer's loyalty tier, applies the discount, provisions a wallet if the buyer has none, creates the order and a payment session (Stripe Checkout, Mercado Pago preference, USDC instructions, or mock).
2. **Payment confirmation** — Stripe/Mercado Pago webhooks (signature-verified and de-duplicated), on-chain USDC verification (`POST /api/orders/:id/crypto-confirm`: checks token, recipient, amount, confirmations, and that the tx hash isn't reused), or mock confirm.
3. **Mint queue** — paying an order creates one durable `NftMint` job per twin-enabled unit. A background worker submits `mintTwin(to, tokenId, mintRef)`; `mintRef` is unique on-chain so retries can never double-mint. Transient RPC failures retry with exponential backoff; jobs wait (instead of failing) while Web3 is not configured. Managers can retry failed jobs from `/admin/mints`.
4. **Loyalty** — `GET /api/me` reads `twinCount(wallet)` on-chain and falls back to confirmed mints in the database if the RPC is unavailable.

**In-store**: a manager records a POS sale (`/admin/pos`). Known customers (email) get twins minted straight away; walk-in customers receive printed **QR passports**. Scanning one opens `/p/<code>`, which proves authenticity and lets the customer claim the Digital Twin (each passport can only be claimed once). Passports can also be batch-generated for stock at `/admin/passports`.

**AI concierge** (`POST /api/ai/concierge`) builds a context from the active, in-stock catalog plus the customer's tier, online orders, in-store purchases and QR check-ins, and asks OpenAI or Anthropic for structured recommendations. Product IDs the model invents are discarded. If no AI key is set or the provider fails, a deterministic recommender answers instead (flagged as `degraded` in the response and the UI).

### Loyalty tiers (`packages/shared/src/loyalty.ts`)

| Tier     | Twins held | Auto discount |
| -------- | ---------- | ------------- |
| Explorer | 0          | 0%            |
| Insider  | 1+         | 5%            |
| VIP      | 5+         | 10%           |
| Legend   | 15+        | 15%           |

---

## Local setup (step by step)

### 1. Prerequisites

- **Node.js 24** (see `.nvmrc`; Node >= 20.9 works). With nvm: `nvm install && nvm use`
- **Docker** (for PostgreSQL)

```bash
npm install
```

### 2. Database

```bash
cp packages/db/.env.example packages/db/.env   # DATABASE_URL for Prisma CLI
npm run db:up                                   # PostgreSQL 16 on localhost:5432
npm run db:migrate                              # apply migrations
npm run db:seed                                 # flagship store, 8 sample products, admin@phygital.dev
```

### 3. Local blockchain + contracts

In a separate terminal:

```bash
npm run chain:node            # Hardhat node on http://127.0.0.1:8545 (chain id 31337)
```

Then deploy:

```bash
cp packages/contracts/.env.example packages/contracts/.env
npm run chain:deploy:local
```

The script prints the values to paste into `apps/api/.env`:

```
PhygitalTwin: 0x5FbDB2315678afecb367f032d93F642f64180aa3
MockUSDC:     0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### 4. API

```bash
cp apps/api/.env.example apps/api/.env
```

Set at least `TWIN_CONTRACT_ADDRESS` (and `USDC_TOKEN_ADDRESS` + `MERCHANT_WALLET_ADDRESS` to test crypto checkout) from the deploy output. Every other value has a working local default. Then:

```bash
npm run dev:api               # http://localhost:4000  (GET /health shows what is configured)
```

### 5. Web

```bash
cp apps/web/.env.example apps/web/.env.local
npm run dev:web               # http://localhost:3000
```

Sign in with any email (demo mode). Use **`admin@phygital.dev`** to see the **Manager** dashboard.

---

## Environment variables

All API variables are validated at startup (`apps/api/src/config.ts`); the API refuses to boot with an invalid combination (for example `AUTH_MODE=dev` in production). Features whose variables are missing are disabled gracefully and reported by `GET /health` and `GET /api/config`.

### Core (`apps/api/.env`)

| Variable         | Example                                                  | Notes                                                   |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`   | `postgresql://phygital:phygital@localhost:5432/phygital` | Same value as `packages/db/.env`                        |
| `PORT`           | `4000`                                                   |                                                         |
| `WEB_URL`        | `http://localhost:3000`                                  | Used for payment redirects and QR passport URLs         |
| `API_PUBLIC_URL` | `https://api.yourstore.com`                              | Public URL used for payment webhooks                    |
| `CORS_ORIGINS`   | `https://yourstore.com`                                  | Comma-separated; defaults to `WEB_URL`                  |
| `ADMIN_EMAILS`   | `owner@yourstore.com,manager@yourstore.com`              | Emails promoted to `ADMIN` on sign-in                   |

### Auth & wallets (Privy)

Local development uses `AUTH_MODE=dev`, where the API trusts an `x-demo-email` header and generates throwaway wallet addresses. **Never use it in production** (the API blocks it when `NODE_ENV=production`).

To enable social login with embedded wallets:

1. Create an app at <https://dashboard.privy.io>. Enable email, Google and Apple login methods and **Ethereum embedded wallets**.
2. Add `http://localhost:3000` (and your production domain) to the allowed origins.
3. Copy the **App ID** and **App secret** (Settings → Basics):

```env
# apps/api/.env
AUTH_MODE=privy
PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret

# apps/web/.env.local
NEXT_PUBLIC_PRIVY_APP_ID=your-app-id
```

The web app creates an embedded wallet on first login; customers who check out without logging in get a Privy wallet pre-generated for their email by the API.

### Web3 RPC & minting

| Variable                  | Example                               | Notes                                                                                                     |
| ------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `CHAIN_ID`                | `31337` / `84532` (Base Sepolia) / `8453` (Base) | Must match the chain the contract is deployed to                                              |
| `RPC_URL`                 | `https://base-sepolia.g.alchemy.com/v2/<key>`    | Any EVM JSON-RPC (Alchemy, Infura, QuickNode, public RPC)                                     |
| `TWIN_CONTRACT_ADDRESS`   | `0x…`                                 | Printed by the deploy script                                                                              |
| `MINTER_PRIVATE_KEY`      | `0x…`                                 | Backend hot wallet with `MINTER_ROLE`. Fund it with gas. The example value is Hardhat account #0 — **local only** |
| `MINT_CONFIRMATIONS`      | `1`                                   | Blocks to wait before a mint is `CONFIRMED`                                                               |
| `MINT_MAX_ATTEMPTS`       | `8`                                   | After this many failures a job is `FAILED` and needs a manual retry                                       |
| `MINT_WORKER_INTERVAL_MS` | `10000`                               | Mint worker polling interval                                                                              |

Deploying to a testnet (`packages/contracts/.env`):

```env
DEPLOYER_PRIVATE_KEY=0x...            # gets DEFAULT_ADMIN_ROLE (keep it in cold storage in production)
MINTER_ADDRESS=0x...                  # address of MINTER_PRIVATE_KEY above; gets MINTER_ROLE
TWIN_METADATA_URI=https://api.yourstore.com/api/twins/{id}.json
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

```bash
npm run deploy:baseSepolia --workspace @phygital/contracts
# or: npm run deploy:polygonAmoy --workspace @phygital/contracts
```

### Payments

Prices are stored in integer cents (USD). Totals are always recomputed on the server.

**Mock (local only)**

```env
ENABLE_MOCK_PAYMENTS=true
```

**Stripe**

1. Get a secret key at <https://dashboard.stripe.com/test/apikeys> → `STRIPE_SECRET_KEY=sk_test_...`
2. Forward webhooks locally with the Stripe CLI and copy the signing secret it prints:

   ```bash
   stripe listen --forward-to localhost:4000/webhooks/stripe
   ```

   → `STRIPE_WEBHOOK_SECRET=whsec_...`
3. In production add a webhook endpoint `https://<API_PUBLIC_URL>/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`.

**Mercado Pago**

1. Create an application at <https://www.mercadopago.com/developers/panel/app> and copy the **Access token** → `MERCADOPAGO_ACCESS_TOKEN=APP_USR-...` (use test credentials while developing).
2. Under **Webhooks**, set the URL to `https://<API_PUBLIC_URL>/webhooks/mercadopago`, subscribe to **Payments**, and copy the **secret signature** → `MERCADOPAGO_WEBHOOK_SECRET=...`. (Mercado Pago must reach your API; use a tunnel such as `ngrok http 4000` locally and set `API_PUBLIC_URL` to the tunnel URL.)
3. `MERCADOPAGO_CURRENCY` (e.g. `ARS`, `BRL`, `MXN`) and `MERCADOPAGO_FX_RATE` convert the USD catalog prices into the charged currency.

**Crypto (USDC)**

```env
USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e   # USDC on Base Sepolia; use MockUSDC locally
MERCHANT_WALLET_ADDRESS=0x...                                    # receives payments
CRYPTO_MIN_CONFIRMATIONS=1
```

Customers pay from a browser wallet (MetaMask, Coinbase Wallet, …) or paste the hash of a transfer they sent elsewhere. To test locally, import a Hardhat account into your wallet, add the `localhost:8545` network (chain id 31337), and mint yourself MockUSDC:

```bash
cd packages/contracts
npx hardhat console --network localhost
> const usdc = await ethers.getContractAt("MockUSDC", "<USDC_TOKEN_ADDRESS>")
> await usdc.mint("<your address>", 1_000_000_000n)   // 1,000 USDC
```

### AI concierge

The provider is picked from whichever key is set (or forced with `AI_PROVIDER=openai|anthropic`). With no key the deterministic recommender is used.

```env
OPENAI_API_KEY=sk-...                 # https://platform.openai.com/api-keys
OPENAI_MODEL=gpt-4o-mini

ANTHROPIC_API_KEY=sk-ant-...          # https://console.anthropic.com/settings/keys
ANTHROPIC_MODEL=claude-sonnet-4-5
```

### Web (`apps/web/.env.local`)

| Variable                   | Example                 | Notes                                                    |
| -------------------------- | ----------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`      | `http://localhost:4000` | Base URL of `apps/api`                                    |
| `NEXT_PUBLIC_PRIVY_APP_ID` | *(empty)*               | Set to enable Privy; leave empty for demo sign-in         |

---

## Error handling & Web3 fallbacks

- **API errors** use one JSON shape: `{ "error": { "code": "OUT_OF_STOCK", "message": "…", "details": … } }`. The web client maps network failures to a friendly offline message and every page has loading, empty, error and retry states.
- **Chain down / not configured** — orders still succeed; mint jobs stay `PENDING` and are processed automatically when the chain comes back. Loyalty falls back to database records and the UI says so.
- **Mint failures** — classified as retryable (RPC/nonce/gas issues → exponential backoff) or permanent (e.g. missing role → `FAILED`, visible in `/admin/mints` with the error and a Retry button). Already-used `mintRef`s are treated as success.
- **Stuck or reverted transactions** are re-submitted with the same `mintRef`.
- **Payments** — provider failures mark the order `PAYMENT_FAILED`; webhooks are idempotent; a crypto tx hash can pay only one order; transfers with too few confirmations return `202 pending` and the UI keeps polling.
- **AI** — malformed model output or provider errors fall back to the deterministic recommender.

## Tests

```bash
npm test             # all workspaces
npm run lint
npm run typecheck
npm run build
```

| Suite                                 | What it covers                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/contracts` (Hardhat)        | Minting, role checks, `mintRef` idempotency, soulbound transfers/approvals, `twinCount`, ERC-5192     |
| `packages/shared` (Vitest)            | Loyalty tiers, pricing and discount maths, schemas                                                     |
| `packages/web3` (Vitest, mocked viem) | Minter error classification, already-minted handling, USDC transfer verification                       |
| `apps/api` (Vitest, mocked DB/chain)  | Mint worker retries/backoff, checkout & payment idempotency, Stripe/MP signatures, AI fallback, routes |
| `apps/web` (Vitest + Testing Library) | Cart, API client errors, product/loyalty/mint components, concierge and crypto-payment flows           |

## Production checklist

- `NODE_ENV=production`, `AUTH_MODE=privy`, `ENABLE_MOCK_PAYMENTS=false`.
- Keep `DEPLOYER_PRIVATE_KEY` (contract admin) offline; the API only needs a low-balance `MINTER_PRIVATE_KEY`. Store secrets in your platform's secret manager, never in git.
- Set `STRIPE_WEBHOOK_SECRET` (the Stripe webhook is disabled without it) and `MERCADOPAGO_WEBHOOK_SECRET` (Mercado Pago signatures are only verified when it is set; payments are always re-fetched from the Mercado Pago API).
- Use `npm run migrate:deploy --workspace @phygital/db` for migrations.
- Run a single API instance for the mint worker (it shares one minter nonce), or move the worker to its own process.
