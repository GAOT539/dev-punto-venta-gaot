# Sistema Punto de Venta

Aplicación de punto de venta e inventario construida con Next.js App Router, TypeScript, Tailwind CSS, MySQL 8 y arquitectura hexagonal.

## Requisitos

- Windows 11
- Docker Desktop con Compose habilitado
- Node.js 22+ para desarrollo local
- PowerShell 5.1 o superior

## Instalación en Windows

Desde PowerShell, en la carpeta del proyecto:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\instalar.ps1
```

El instalador solicita elevación automáticamente, configura `punto.caja.local`, crea la regla del Firewall TCP `4040`, levanta MySQL y Next.js, y crea el acceso directo del escritorio.

- Desde la PC: `http://punto.caja.local:4040`
- Desde otro dispositivo de la misma red: `http://IP_DE_LA_PC:4040`

La red de Windows debe estar marcada como privada para que la regla del Firewall permita el acceso local.

## Desarrollo

Para desarrollo completo con MySQL y hot reload:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

La aplicación queda disponible en `http://localhost:4040`.

Para ejecutar Next.js fuera de Docker, copia `.env.example` a `.env.local`, ajusta `DB_HOST` y `DB_PORT`, e inicia:

```powershell
npm install
npm run dev
```

## Producción local

```powershell
docker compose up -d --build
```

El servicio web espera el healthcheck de MySQL antes de arrancar. El build de Next.js usa `output: 'standalone'` y el Dockerfile copia únicamente el runtime necesario.

## Base de datos

MySQL ejecuta `database/schema.sql` únicamente cuando se crea el volumen por primera vez. Para reinicializar datos en desarrollo:

```powershell
docker compose down -v
docker compose up -d --build
```

Las credenciales locales por defecto están parametrizadas en `docker-compose.yml`; usa un archivo `.env` para personalizarlas.

## API inicial

- `GET /api/products?code=SKU-...`: busca una variante por SKU o código de barras.
- `POST /api/products`: crea producto y variante.
- `GET /api/inventory/alerts`: devuelve productos bajo el stock mínimo.
- `GET /api/cash`: consulta la caja abierta.
- `POST /api/cash`: abre, cierra o registra un movimiento manual según `action`.
- `POST /api/sales`: registra una venta y descuenta stock dentro de una transacción.
- `GET /api/receivables`: lista cuentas por cobrar; `POST` registra créditos o abonos según `action`.
- `GET /api/payables/due?days=7`: lista facturas de proveedores próximas a vencer.

El POS permite buscar por SKU, código de barras o parte del nombre. Una venta con método `credito` requiere `clienteCredito`; las ventas de contado no crean cuentas de clientes.

## Validaciones

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
docker compose config
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
```
