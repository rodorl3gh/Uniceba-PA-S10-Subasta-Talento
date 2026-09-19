# Subasta de Talento — UNICEBA

Juego de subasta en tiempo real para la **Sesión 10** de *Proceso Administrativo*
(UNICEBA · Licenciatura en Negocios Internacionales): **Estructuras Formales e
Informales y Diseño de Puestos y Equipos de Trabajo**.

Los alumnos entran desde su celular con un QR (estilo Kahoot), pujan **en secreto**
por puestos de trabajo y arman una plantilla de 5 personas. La **media** de cada
candidato (1–99, tipo FIFA) se revela **solo al ganador**. Al final gana quien
mejor equipo construyó.

---

## Reglas del juego

- **Presupuesto inicial:** $20 por jugador. Pujas enteras de **1, 2, 3, 4 o 5** (o *Pasar*).
- **Plantilla:** 5 personas con esta composición obligatoria:
  - mínimo **1 CEO** / Dirección General
  - mínimo **1 Administrador** / Jefatura
  - mínimo **2 Colaboradores** / Obreros
- **Puja sellada simultánea:** nadie ve los montos; en el panel se ve **quién ya pujó**.
- **Gana** la puja más alta. Si hay **empate**, hay una **segunda vuelta** solo entre los
  empatados; si vuelve a empatar, se rompe **al azar** para no frenar la partida.
- Si **nadie puja**, el candidato se asigna **gratis** a un jugador en **quiebra**
  (sin dinero), en orden de quiebra.
- Al final: **puntaje = media del equipo + bonus** (composición válida, CEO estrella,
  equipo sin conflictos) **− penalización** por cada carta con rasgo negativo.
- **Ganadores:** top 3 con podio en la pantalla del anfitrión.

---

## Requisitos

- Node.js 20 o superior.

## Instalación y uso local

```bash
npm install
npm start
```

Abre `http://localhost:3000` en la **computadora del docente** (pantalla/proyector):

1. Aparece un **código de sala** y un **QR**. Proyecta esa pantalla.
2. Los alumnos escanean el QR, escriben su **nombre** y entran.
3. Cuando estén conectados (mínimo 2, máximo 15), pulsa **Iniciar subasta**.
4. En cada ronda los alumnos pujan desde su celular. El anfitrión muestra quién pujó
   y a quién se le adjudicó cada puesto (sin revelar la media).
5. Al completar todas las plantillas aparece el **podio y la tabla final**.

> Para usarlo en red local: los celulares deben estar en el **mismo WiFi** que la
> computadora y esta debe permitir conexiones entrantes en el puerto (firewall de Windows).

---

## Pruebas

```bash
# Simulación del motor: 420 partidas con 2 a 15 jugadores y validación de reglas
npm test

# Prueba end-to-end con navegador (Playwright). Por defecto 3 jugadores.
node tests/e2e.js

# Cambiar la cantidad de jugadores simulados
set JUGADORES=15 && node tests/e2e.js
```

---

## Despliegue (Easy Panel)

El proyecto es un servicio Node persistente. En Easy Panel:

1. Crea una **App** desde el repositorio de GitHub (build con **Nixpacks**).
2. Puerto: el servicio expone `PORT` (por defecto 3000); Easy Panel lo inyecta.
3. Healthcheck: ruta `/health`.
4. La URL pública sirve el panel del anfitrión; el QR apunta solo a `/play`.

> Nota: el estado de cada partida vive en **memoria** del proceso. Basta para una
> clase. Si el servicio se reinicia a mitad de partida, la sala se pierde.

---

## Estructura

```
data/catalogo.js      Catálogo de puestos, atributos, media y economía
server/juego.js       Motor de salas, subasta, puntaje y reglas
server/index.js       Express + Socket.io + QR
public/index.html     Pantalla del anfitrión
public/play.html      Pantalla del jugador (celular)
public/css/estilos.css Estilo institucional UNICEBA
public/js/host.js     Lógica del anfitrión
public/js/jugador.js  Lógica del jugador
tests/simulate.js     Simulación del motor
tests/e2e.js          Prueba end-to-end (Playwright)
```

---

UNICEBA · Licenciatura en Negocios Internacionales · Proceso Administrativo · Ing. Rodolfo Ramírez
