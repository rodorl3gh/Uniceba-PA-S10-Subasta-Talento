/* Utilidades compartidas entre anfitrion y jugador */
const ROLES = {
  ceo: 'CEO / Dirección General',
  admin: 'Administrador / Jefatura',
  colaborador: 'Colaborador / Obrero'
};

const ROLES_CORTO = { ceo: 'CEO', admin: 'Administrador', colaborador: 'Colaborador' };

function tierAtributo(v) {
  if (v >= 75) return 'verde';
  if (v >= 55) return 'amarillo';
  return 'rojo';
}

// Barras de color por atributo (sin mostrar el numero).
function barrasAtributos(atributos) {
  return Object.entries(atributos).map(([nombre, valor]) => `
    <div class="attr">
      <span class="attr-nom">${nombre}</span>
      <div class="attr-barra"><div class="attr-fill ${tierAtributo(valor)}" style="width:${valor}%"></div></div>
    </div>`).join('');
}

const INSTRUCCIONES = [
  'Cada jugador recibe <b>$20</b> para armar un equipo de <b>5 personas</b>.',
  'La subasta es <b>en tiempo real</b>: el reloj de <b>20 segundos se reinicia</b> cada vez que alguien puja.',
  'Puedes pujar <b>varias veces</b>; el límite es el dinero que te queda. Gana la puja más alta cuando el tiempo llega a cero.',
  'Las <b>barras de colores</b> muestran qué tan bueno es el candidato (verde = alto, amarillo = medio, rojo = bajo). La <b>media exacta se revela solo cuando lo ganas</b>.',
  'Tu equipo debe tener mínimo <b>1 CEO</b>, <b>1 administrador</b> y <b>2 colaboradores</b>.',
  'Si <b>nadie puja</b>, el candidato se descarta. Solo se regala a un jugador <b>sin dinero</b> que aún necesite completar su plantilla.',
  'Gana quien logre el <b>mejor puntaje</b> de equipo: media + bonificaciones − conflictos.'
];

function instruccionesHTML() {
  return `<ol class="lista-instr">${INSTRUCCIONES.map((t) => `<li>${t}</li>`).join('')}</ol>`;
}
