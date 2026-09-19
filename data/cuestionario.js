/**
 * Banco de 20 preguntas de opcion multiple para el cuestionario de la Sesion 10.
 * Cada intento toma 10 preguntas al azar. Las respuestas correctas nunca se
 * envian al navegador: la calificacion ocurre en el servidor.
 */
const PREGUNTAS = [
  {
    id: 1,
    pregunta: '¿Qué caracteriza a la estructura formal de una organización?',
    opciones: [
      'Surge de amistades y liderazgos espontáneos',
      'Es la estructura oficial, planeada y documentada por la empresa',
      'No aparece en el organigrama',
      'Cambia rápidamente según las relaciones personales'
    ],
    correcta: 1,
    explicacion: 'La estructura formal es la oficial: define departamentos, jerarquías y líneas de autoridad, y se documenta en el organigrama y los manuales.'
  },
  {
    id: 2,
    pregunta: '¿Cuál es una característica de la estructura informal?',
    opciones: [
      'La define la dirección mediante decisiones formales',
      'Aparece siempre en el organigrama',
      'Surge de relaciones espontáneas como amistades, afinidades y liderazgos naturales',
      'Asigna funciones y responsabilidades de forma explícita'
    ],
    correcta: 2,
    explicacion: 'La estructura informal nace de las relaciones espontáneas; no está en el organigrama, pero existe siempre.'
  },
  {
    id: 3,
    pregunta: '¿En qué documentos se respalda la estructura formal?',
    opciones: [
      'En los rumores y la comunicación informal',
      'En el organigrama y los manuales de organización',
      'En las redes sociales de los empleados',
      'En los contratos de los clientes'
    ],
    correcta: 1,
    explicacion: 'El organigrama y los manuales de organización documentan la estructura formal.'
  },
  {
    id: 4,
    pregunta: '¿Cuál es un riesgo típico de la estructura informal?',
    opciones: [
      'Acelerar la comunicación entre áreas',
      'Resolver problemas con rapidez',
      'Los rumores, los grupos de poder y la resistencia al cambio',
      'Dar legitimidad a las decisiones'
    ],
    correcta: 2,
    explicacion: 'La estructura informal puede acelerar procesos, pero también genera rumores, grupos de poder y resistencia al cambio.'
  },
  {
    id: 5,
    pregunta: '¿Qué es un puesto de trabajo?',
    opciones: [
      'El conjunto de actividades, deberes y responsabilidades de una persona',
      'El organigrama completo de la empresa',
      'Un grupo de personas con metas individuales',
      'El sueldo que recibe un empleado'
    ],
    correcta: 0,
    explicacion: 'El puesto es la unidad básica para repartir el trabajo: agrupa actividades, deberes y responsabilidades.'
  },
  {
    id: 6,
    pregunta: '¿Para qué sirve el análisis, la descripción y el perfil de un puesto?',
    opciones: [
      'Solo para despedir personal',
      'Para reclutar, capacitar, evaluar y remunerar adecuadamente',
      'Únicamente para calcular impuestos',
      'Para definir la estructura informal'
    ],
    correcta: 1,
    explicacion: 'La descripción y el perfil del puesto sirven para reclutar, capacitar, evaluar y remunerar.'
  },
  {
    id: 7,
    pregunta: '¿Qué enfoque de diseño de puestos consiste en sumar más tareas del mismo nivel?',
    opciones: [
      'Enriquecimiento del puesto',
      'Rotación de puestos',
      'Ampliación del puesto',
      'Equipos autónomos'
    ],
    correcta: 2,
    explicacion: 'La ampliación del puesto agrega más tareas del mismo nivel para reducir la monotonía.'
  },
  {
    id: 8,
    pregunta: '¿Qué enfoque otorga más responsabilidad y autonomía a la persona?',
    opciones: [
      'Ampliación del puesto',
      'Enriquecimiento del puesto',
      'Especialización extrema',
      'Supervisión directa'
    ],
    correcta: 1,
    explicacion: 'El enriquecimiento del puesto añade responsabilidad y autonomía, no solo más tareas.'
  },
  {
    id: 9,
    pregunta: '¿Qué busca la rotación de puestos?',
    opciones: [
      'Que el empleado haga siempre la misma tarea',
      'Ampliar la visión y las habilidades del trabajador',
      'Reducir el salario del empleado',
      'Eliminar la estructura informal'
    ],
    correcta: 1,
    explicacion: 'La rotación amplía la visión y las habilidades al pasar por distintos puestos.'
  },
  {
    id: 10,
    pregunta: 'Según el modelo de Hackman y Oldham, ¿cuál de las siguientes NO es una característica central del puesto?',
    opciones: [
      'Variedad de habilidades',
      'Identidad de la tarea',
      'Salario competitivo garantizado',
      'Autonomía'
    ],
    correcta: 2,
    explicacion: 'Las cinco características son: variedad de habilidades, identidad de la tarea, significado, autonomía y retroalimentación.'
  },
  {
    id: 11,
    pregunta: 'En el modelo de Hackman y Oldham, ¿qué significa la autonomía?',
    opciones: [
      'Que el jefe decide cada paso del trabajo',
      'Que la persona puede decidir cómo y cuándo realizar su trabajo',
      'Que el trabajo no influye en nadie',
      'Que siempre se trabaja en equipo'
    ],
    correcta: 1,
    explicacion: 'La autonomía es la libertad para decidir cómo y cuándo hacer el trabajo.'
  },
  {
    id: 12,
    pregunta: '¿Qué característica del puesto permite saber qué tan bien se está haciendo el trabajo?',
    opciones: [
      'Variedad de habilidades',
      'Significado de la tarea',
      'Retroalimentación',
      'Identidad de la tarea'
    ],
    correcta: 2,
    explicacion: 'La retroalimentación informa a la persona sobre la calidad de su desempeño.'
  },
  {
    id: 13,
    pregunta: '¿Cuál es un resultado esperado de un puesto bien diseñado?',
    opciones: [
      'Mayor rotación de personal',
      'Más monotonía y desmotivación',
      'Motivación, satisfacción, calidad y menor rotación',
      'Más conflictos entre áreas'
    ],
    correcta: 2,
    explicacion: 'Un buen diseño del puesto produce motivación, satisfacción, calidad y menor rotación.'
  },
  {
    id: 14,
    pregunta: '¿Cuál es la diferencia principal entre un grupo y un equipo de trabajo?',
    opciones: [
      'El grupo siempre es más grande',
      'El equipo tiene propósito común, interdependencia y responsabilidad compartida',
      'No existe ninguna diferencia',
      'El grupo siempre es multicultural'
    ],
    correcta: 1,
    explicacion: 'El equipo comparte propósito, interdependencia y responsabilidad; el grupo trabaja con metas y cuentas individuales.'
  },
  {
    id: 15,
    pregunta: '¿Qué significa que un equipo genere sinergia?',
    opciones: [
      'Que el conjunto vale más que la suma de las partes',
      'Que cada quien trabaja por su cuenta',
      'Que el líder decide todo',
      'Que se reduce el número de integrantes'
    ],
    correcta: 0,
    explicacion: 'La sinergia implica que el resultado del equipo supera la suma de los esfuerzos individuales.'
  },
  {
    id: 16,
    pregunta: '¿Cuál es el orden correcto de las etapas de Tuckman?',
    opciones: [
      'Desempeño, conflicto, formación, normalización, disolución',
      'Formación, conflicto, normalización, desempeño, disolución',
      'Normalización, formación, desempeño, conflicto, disolución',
      'Formación, normalización, conflicto, disolución, desempeño'
    ],
    correcta: 1,
    explicacion: 'Tuckman propone: formación, conflicto, normalización, desempeño y disolución.'
  },
  {
    id: 17,
    pregunta: '¿Cómo se clasifican los roles de Belbin?',
    opciones: [
      'De acción, de pensamiento y sociales',
      'De jefe, de subordinado y de cliente',
      'Formales, informales y mixtos',
      'Técnicos, administrativos y directivos'
    ],
    correcta: 0,
    explicacion: 'Belbin agrupa los roles de equipo en roles de acción, de pensamiento y sociales.'
  },
  {
    id: 18,
    pregunta: '¿Qué método de toma de decisiones busca el acuerdo total de todos los integrantes?',
    opciones: [
      'Mayoría',
      'Autoridad',
      'Unanimidad',
      'Consulta'
    ],
    correcta: 2,
    explicacion: 'La unanimidad busca que todos estén de acuerdo; el consenso busca una decisión aceptable para todos sin exigir acuerdo total.'
  },
  {
    id: 19,
    pregunta: 'Cuando el líder decide por su cuenta y los demás acatan, ¿qué método de decisión se aplica?',
    opciones: [
      'Consenso',
      'Autoridad',
      'Unanimidad',
      'Mayoría'
    ],
    correcta: 1,
    explicacion: 'En el método por autoridad, el líder toma la decisión sin consultar al grupo.'
  },
  {
    id: 20,
    pregunta: 'En el entorno internacional, ¿qué competencias se exigen cada vez más a puestos y equipos?',
    opciones: [
      'Rigidez y trabajo individual',
      'Competencia intercultural y flexibilidad',
      'Evitar la comunicación abierta',
      'Evitar los equipos virtuales y multiculturales'
    ],
    correcta: 1,
    explicacion: 'La competencia intercultural y la flexibilidad son clave en equipos virtuales y multiculturales.'
  }
];

module.exports = { PREGUNTAS };
