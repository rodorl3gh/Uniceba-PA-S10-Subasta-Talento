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

- **Presupuesto inicial:** $20 por jugador.
- **Subasta en tiempo real:** al abrir el anfitrión una ronda arranca un reloj de
  **20 segundos** que **se reinicia cada vez que alguien puja**. Gana la puja más alta
  cuando el reloj llega a cero.
- **Pujas ascendentes:** cada puja debe superar la anterior; puedes pujar **varias veces**
  y el único límite es tu dinero. El anfitrión puede **Terminar subasta** antes de tiempo.
- **Atributos a la vista, media oculta:** durante la subasta se ven **barras de color**
  (verde = alto, amarillo = medio, rojo = bajo) por atributo; la **media exacta** solo se
  revela al ganador mediante una carta estilo FIFA.
- **Plantilla:** 5 personas con esta composición obligatoria:
  - mínimo **1 CEO** / Dirección General
  - mínimo **1 Administrador** / Jefatura
  - mínimo **2 Colaboradores** / Obreros
- Si **nadie puja**, el candidato **se descarta** (a la basura). Solo se regala a un
  jugador **sin dinero** (en quiebra) que aún necesite completar su plantilla, en orden
  de quiebra.
- **Bots:** el anfitrión puede agregar hasta **5 bots** que compiten solos y siguen las
  mismas reglas (pujan, se quedan sin dinero y reciben asignaciones por quiebra).
- **Mínimo para iniciar:** 2 jugadores (reales o bots). **Máximo:** 15 en total.
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
2. (Opcional) Agrega hasta **5 bots** para completar la partida.
3. Los alumnos escanean el QR, ven las **instrucciones**, escriben su **nombre** y entran.
4. Con **2 o más** jugadores/bots, pulsa **Iniciar juego**.
5. En cada ronda se abre el colaborador y arranca el reloj de 20s; los alumnos pujan desde
   su celular. El reloj se **reinicia con cada puja**. El anfitrión puede **Terminar subasta**
   para cerrarla antes, y luego **Siguiente colaborador**.
6. Al completar todas las plantillas aparece el **podio y la tabla final**.

> Para usarlo en red local: los celulares deben estar en el **mismo WiFi** que la
> computadora y esta debe permitir conexiones entrantes en el puerto (firewall de Windows).

---

## Pruebas

```bash
# Simulación del motor: partidas de 2 a 10 jugadores (con y sin bots) y validación de reglas
npm test

# Prueba end-to-end con navegador (Playwright). Por defecto 3 jugadores + 2 bots.
node tests/e2e.js

# Personalizar jugadores y bots simulados
set JUGADORES=8 && set BOTS=5 && node tests/e2e.js

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
