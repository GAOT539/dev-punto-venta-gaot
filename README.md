# DPVG-CAJA 🛒

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql)](https://www.mysql.com/)

**DPVG-CAJA (dev-punto-venta-gaot)** es un Sistema de Punto de Venta (POS) local, de alta velocidad y arquitectura *offline-first*, diseñado específicamente para comercios en entornos Windows. Construido para garantizar robustez financiera, manejo estricto de inventario y cero conflictos de dependencias, operando sin autenticación de usuarios ("Sin Usuario") para agilizar el flujo de cobro.

---

## ✨ Módulos y Características

- 🎯 **Punto de Venta (POS):** Optimizado para uso intensivo. Integra búsqueda inteligente, lectura por escáner de códigos de barras/SKU, y calculadora integrada de vueltos/cobros.
- 🗄️ **Caja Registradora:** Control estricto con apertura/cierre de turnos (arqueos ciegos o declarados), e ingresos/retiros manuales blindados.
- 📦 **Inventario Avanzado:** Seguimiento de stock en tiempo real, alertas automáticas de *stock mínimo*, y control de Costo vs. Precio de Venta Público (PVP).
- 🧾 **Cuentas por Pagar:** Gestión integral de Proveedores y facturas de mercadería, incluyendo el registro de abonos y saldos pendientes.
- 💳 **Cuentas por Cobrar (Créditos):** *(Nota: Módulo de CRM y créditos a clientes temporalmente desactivado por reglas de negocio).*

---

## 🏗️ Arquitectura y Stack Tecnológico

El proyecto está diseñado bajo los principios de **Arquitectura Hexagonal (Puertos y Adaptadores)**. Esta separación de responsabilidades aísla la **Lógica de Negocio (Dominio)** de los detalles de infraestructura (Base de Datos o Framework UI), garantizando que las transacciones y cálculos contables permanezcan inmutables ante cambios de base de datos o frameworks.

- **Frontend & Backend (API):** [Next.js (App Router)](https://nextjs.org/) ejecutándose en modo `standalone` para mínima sobrecarga en producción.
- **Estilos y UI:** [Tailwind CSS](https://tailwindcss.com/) nativo, responsivo (*Mobile-First*) y sin dependencias UI externas pesadas.
- **Precisión Financiera:** Los cálculos monetarios se procesan con `decimal.js` (estándar IEEE 754) para erradicar errores de coma flotante nativos de JS.
- **Base de Datos & Transaccionalidad:** MySQL 8 integrado vía `mysql2/promise`. Incluye bloqueos preventivos (`FOR UPDATE`) para eliminar *race conditions* en alto tráfico.
- **Infraestructura y Contenerización:** Orquestación absoluta con Docker y Docker Compose para máxima portabilidad (Cero conflictos en entornos locales Windows).

---

## 🚀 Guía de Instalación (Usuario Final)

### Requisitos Previos
1. **Windows 10/11**.
2. **Docker Desktop** instalado y en ejecución (con WSL2 integrado).

### Pasos de Instalación
Hemos preparado un script de automatización completo para desplegar el sistema con un solo clic.

1. Abre la carpeta raíz del proyecto.
2. Haz **clic derecho** sobre el archivo `instalar.ps1` y selecciona **"Ejecutar con PowerShell"**.
3. *Se solicitarán permisos de Administrador*. Esto es normal y necesario porque el script realizará lo siguiente de forma automática:
   - Configurar una ruta de DNS local modificando tu archivo `hosts` (`punto.caja.local`).
   - Crear una regla segura en el Firewall de Windows (Puerto `4040`).
   - Descargar, construir e inicializar los contenedores de Docker en segundo plano.
   - Crear un **Acceso Directo** en tu Escritorio para acceder al sistema con 1 solo clic.

Al finalizar, el sistema estará disponible en tu navegador en:  
🔗 **[http://punto.caja.local:4040](http://punto.caja.local:4040)**

---

## 🛠️ Guía de Desarrollo (Para Developers)

### Requisitos Previos
- Node.js (v20 o superior).
- Docker Desktop.

### Levantar el Entorno (Modo Local / Hot-Reload)
Para modificar el código y ver cambios en tiempo real, no uses el Docker de producción. Ejecuta la base de datos de desarrollo mediante:

```bash
# 1. Levanta exclusivamente la Base de Datos
docker compose -f docker-compose.dev.yml up -d

# 2. Instala dependencias del proyecto Next.js
npm install

# 3. Arranca el servidor de desarrollo
npm run dev
```

### Scripts y Comandos Disponibles
- `npm run dev`: Inicia servidor local (http://localhost:3000).
- `npm run build`: Compila y genera el *standalone* para producción.
- `npm run lint`: Ejecuta el validador estático ESLint (estricto).
- `npm run typecheck`: Valida integridad de tipos en TypeScript.

### Estructura de Directorios (Hexagonal)
- `src/core/domain`: Entidades puras y Modelos Zod (Product, Sale, Caja).
- `src/core/application`: Casos de uso (Lógica pura, sin Next.js ni MySQL).
- `src/core/infrastructure`: Repositorios (MysqlSaleRepository), Endpoints de API y utilidades HTTP.

---

## 🧹 Desinstalación Completa

Si necesitas eliminar por completo el sistema y todos sus datos (Ventas, Inventario, Usuarios):

1. Abre tu terminal (PowerShell o CMD) en la carpeta del proyecto.
2. Ejecuta el siguiente comando para destruir contenedores, redes y volúmenes:
   ```bash
   docker compose down -v
   ```
3. *(Opcional)* Edita como Administrador el archivo `C:\Windows\System32\drivers\etc\hosts` y borra la línea: `127.0.0.1 punto.caja.local`.
4. Elimina el acceso directo del escritorio.
