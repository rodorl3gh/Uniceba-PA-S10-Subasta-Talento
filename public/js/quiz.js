/* Cuestionario de repaso - Sesion 10 */
const $ = (id) => document.getElementById(id);

let preguntas = [];
let indice = 0;
let respuestas = {};
let nombre = '';

$('btnComenzar').addEventListener('click', comenzar);
$('btnSiguiente').addEventListener('click', siguiente);

async function comenzar() {
  nombre = $('quizNombre').value.trim();
  if (!nombre) { $('quizError').textContent = 'Escribe tu nombre para empezar.'; return; }
  $('quizError').textContent = '';
  $('quizChipNombre').textContent = nombre;
  try {
    const r = await fetch('/api/quiz');
    const data = await r.json();
    preguntas = data.preguntas;
    indice = 0;
    respuestas = {};
    $('vistaQuizIntro').classList.add('oculto');
    $('vistaQuizPregunta').classList.remove('oculto');
    renderPregunta();
  } catch (e) {
    $('quizError').textContent = 'No se pudo cargar el cuestionario. Revisa tu conexión.';
  }
}

function renderPregunta() {
  const q = preguntas[indice];
  $('quizProgreso').textContent = `Pregunta ${indice + 1} de ${preguntas.length}`;
  $('quizBarraFill').style.width = `${(indice / preguntas.length) * 100}%`;
  $('quizPregunta').textContent = q.pregunta;
  $('quizOpciones').innerHTML = q.opciones.map((op, i) =>
    `<button class="opcion" data-i="${i}">${String.fromCharCode(65 + i)}. ${op}</button>`
  ).join('');
  $('quizOpciones').querySelectorAll('.opcion').forEach((b) => {
    b.onclick = () => {
      $('quizOpciones').querySelectorAll('.opcion').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      respuestas[q.id] = Number(b.dataset.i);
      $('btnSiguiente').disabled = false;
    };
  });
  $('btnSiguiente').disabled = true;
  $('btnSiguiente').textContent = indice === preguntas.length - 1 ? 'Terminar y calificar' : 'Siguiente';
}

function siguiente() {
  if (respuestas[preguntas[indice].id] === undefined) return;
  if (indice < preguntas.length - 1) { indice += 1; renderPregunta(); }
  else finalizar();
}

async function finalizar() {
  $('quizBarraFill').style.width = '100%';
  try {
    const r = await fetch('/api/quiz/calificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, respuestas })
    });
    const data = await r.json();
    mostrarResultado(data);
  } catch (e) {
    alert('No se pudo calificar. Intenta de nuevo.');
  }
}

function mostrarResultado(data) {
  const cal = data.calificacion;
  const emoji = cal >= 9 ? '🏆' : cal >= 7 ? '🎉' : cal >= 6 ? '👍' : '📚';
  const color = cal >= 7 ? 'var(--correct)' : cal >= 6 ? '#d9a300' : 'var(--incorrect)';
  const revision = data.detalle.map((d) => {
    const correctaTxt = d.opciones[d.correcta];
    const elegidaTxt = d.elegida >= 0 ? d.opciones[d.elegida] : 'Sin responder';
    return `<div class="rev ${d.acierto ? 'ok' : 'mal'}">
      <div class="rev-tit">${d.acierto ? '✅' : '❌'} ${d.pregunta}</div>
      <div class="rev-lin">Tu respuesta: <b>${elegidaTxt}</b></div>
      ${d.acierto ? '' : `<div class="rev-lin">Correcta: <b>${correctaTxt}</b></div>`}
      <div class="rev-exp">${d.explicacion}</div>
    </div>`;
  }).join('');

  $('vistaQuizPregunta').classList.add('oculto');
  $('vistaQuizResultado').classList.remove('oculto');
  $('quizResultado').innerHTML = `
    <div style="text-align:center">
      <div style="font-size:52px">${emoji}</div>
      <h2 style="color:var(--uniceba-blue);font-size:22px">${nombre}, tu resultado</h2>
      <div class="quiz-score" style="color:${color}">${cal} / 10</div>
      <p style="color:var(--text-light)">${data.correctas} de ${data.total} respuestas correctas</p>
      <p style="font-size:13px;color:#999;margin-top:6px">📸 Toma una captura de esta pantalla para entregar tu evidencia.</p>
    </div>
    <div class="rev-lista">${revision}</div>
    <button class="btn btn-primary btn-block" style="margin-top:18px" onclick="location.reload()">Intentar de nuevo</button>`;
}
