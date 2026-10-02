# Publicar Lazo en internet (guía en español)

Arquitectura de producción recomendada para arrancar en Argentina:

| Pieza                 | Servicio                       | Por qué                                                       |
| --------------------- | ------------------------------ | ------------------------------------------------------------- |
| Web (`apps/web`)      | **Vercel**                     | Hosting nativo de Next.js, HTTPS y dominio propio             |
| API (`apps/api`)      | **Railway** (usa el `Dockerfile`) | Proceso Node siempre encendido (el worker de minteo corre adentro) |
| Base de datos         | **Railway PostgreSQL**         | Mismo proyecto que la API, sin configuración extra            |
| Blockchain            | **Base Sepolia** (testnet) → luego **Base** | Gas muy barato; USDC oficial de Circle                |
| Login + wallets       | **Privy**                      | Login con email/Google/Apple y wallet embebida automática     |
| Pagos fiat            | **Mercado Pago** (ARS)         | Medio de pago principal en Argentina                          |
| Pagos cripto          | **USDC en Base**               |                                                               |
| IA                    | **OpenAI** o **Anthropic**     | Opcional: sin clave funciona el recomendador básico           |

> En producción la API **no arranca** con `AUTH_MODE=dev`; Privy es obligatorio.

---

## 1. Cuentas que hay que crear

1. **Vercel** — <https://vercel.com/signup> (entrar con GitHub).
2. **Railway** — <https://railway.com> (entrar con GitHub).
3. **Privy** — <https://dashboard.privy.io>: crear una app, habilitar *Email*, *Google*, *Apple* y *Embedded wallets → Ethereum*. Copiar **App ID** y **App secret**.
4. **Mercado Pago Developers** — <https://www.mercadopago.com.ar/developers/panel/app>: crear una aplicación (Checkout Pro) y copiar el **Access Token** (primero las credenciales de prueba).
5. **Wallets** (por ejemplo con MetaMask o Coinbase Wallet), tres direcciones distintas:
   - *Deployer*: despliega el contrato y queda como administrador. Guardala offline.
   - *Minter*: la usa la API para mintear los Digital Twins (necesita un poco de ETH para gas).
   - *Comercio*: recibe los pagos en USDC.
6. ETH de prueba para Base Sepolia (faucet de Coinbase Developer Platform u otro faucet de Base Sepolia) en las wallets *deployer* y *minter*. USDC de prueba: <https://faucet.circle.com>.
7. (Opcional) **OpenAI** <https://platform.openai.com/api-keys> o **Anthropic** <https://console.anthropic.com/settings/keys>.

---

## 2. Desplegar el contrato en Base Sepolia

En tu máquina, dentro del repo:

```bash
npm install
cp packages/contracts/.env.example packages/contracts/.env
```

Editar `packages/contracts/.env`:

```env
DEPLOYER_PRIVATE_KEY=0x...        # clave privada de la wallet deployer
MINTER_ADDRESS=0x...              # dirección (pública) de la wallet minter
TWIN_METADATA_URI=https://<tu-api>.up.railway.app/api/twins/{id}.json
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

```bash
npm run deploy:baseSepolia --workspace @phygital/contracts
```

Anotar la dirección `PhygitalTwin: 0x...` que imprime el script (también queda en `packages/contracts/deployments/baseSepolia.json`).

---

## 3. API + base de datos en Railway

1. **New Project → Deploy from GitHub repo** → elegir este repositorio. Railway detecta `railway.json` y construye con el `Dockerfile`.
2. En el mismo proyecto: **New → Database → PostgreSQL**.
3. En el servicio de la API → **Variables**:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
WEB_URL=https://<tu-web>.vercel.app
API_PUBLIC_URL=https://<tu-api>.up.railway.app
CORS_ORIGINS=https://<tu-web>.vercel.app
ADMIN_EMAILS=tu-email@ejemplo.com

AUTH_MODE=privy
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...

CHAIN_ID=84532
RPC_URL=https://sepolia.base.org          # mejor un RPC dedicado (Alchemy, QuickNode, Infura)
MINTER_PRIVATE_KEY=0x...                  # clave privada de la wallet minter
TWIN_CONTRACT_ADDRESS=0x...               # del paso 2

ENABLE_MOCK_PAYMENTS=false
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...            # ver paso 5
MERCADOPAGO_CURRENCY=ARS
MERCADOPAGO_FX_RATE=1200                  # pesos por dólar (los precios del catálogo están en USD)
MERCADOPAGO_PREFILL_PAYER=false           # solo con credenciales de prueba: el vendedor de prueba solo acepta compradores de prueba

USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e   # USDC de Circle en Base Sepolia
MERCHANT_WALLET_ADDRESS=0x...             # wallet del comercio

OPENAI_API_KEY=...                        # opcional
```

4. **Settings → Networking → Generate Domain** para obtener la URL pública. Al arrancar, el contenedor aplica las migraciones automáticamente. Verificar en `https://<tu-api>.up.railway.app/health`.
5. Cargar los datos iniciales (tienda, productos de ejemplo y tu usuario administrador) **una sola vez**, desde tu máquina, usando la URL pública de Postgres (Railway → Postgres → *Connect*):

```bash
DATABASE_URL="postgresql://...railway..." SEED_ADMIN_EMAIL=tu-email@ejemplo.com npm run db:seed
```

---

## 4. Web en Vercel

1. **Add New → Project** → importar este repositorio.
2. **Root Directory**: `apps/web` (framework: Next.js).
3. **Environment Variables**:

```env
NEXT_PUBLIC_API_URL=https://<tu-api>.up.railway.app
NEXT_PUBLIC_PRIVY_APP_ID=...              # el mismo App ID de Privy
```

4. **Deploy**. Después agregar el dominio de Vercel (y tu dominio propio) en Privy → *Allowed origins*, y actualizar `WEB_URL` / `CORS_ORIGINS` en Railway si cambia.

---

## 5. Webhook de Mercado Pago

En el panel de tu aplicación → **Webhooks**:

- URL: `https://<tu-api>.up.railway.app/api/webhooks/mercadopago`
- Evento: **Pagos**
- Copiar la **clave secreta** y ponerla en `MERCADOPAGO_WEBHOOK_SECRET` en Railway.

---

## 6. Checklist final

- [ ] `/health` muestra `"database":"ok"`, `"minting":true` y los métodos de pago esperados.
- [ ] Login con Privy crea el usuario y su wallet.
- [ ] Compra de prueba con Mercado Pago (credenciales de prueba) → orden pagada → Digital Twin minteado.
- [ ] Panel `/admin` accesible con el email de `ADMIN_EMAILS`.
- [ ] Al pasar a producción real: credenciales productivas de Mercado Pago, `CHAIN_ID=8453` (Base mainnet), USDC de Base mainnet y un contrato nuevo desplegado en Base.
