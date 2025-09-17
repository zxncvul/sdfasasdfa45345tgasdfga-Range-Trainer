/*
 * app.state.js
 *
 * Este módulo define el estado global de la aplicación y varios
 * helpers que no dependen del DOM. Contiene la estructura de
 * datos que sirve como fuente de verdad para el visualizador de
 * rangos y el modo Quiz. También exporta un pequeño bus de
 * eventos así como funciones de reseteo del estado de pintura.
 */

;(function (global) {
  'use strict';

  // Crear el namespace global si no existe
  const App = global.App = global.App || {};

  /**
   * Orden fijo de asientos preflop. Se utiliza para comparar
   * posiciones y deducir posiciones relativas (IP/OOP).
   */
  const POS_ORDER = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];

  /**
   * Orden canónico de héroes para construir quizzes de "Full Range".  Este
   * array se utiliza para iterar las posiciones de héroe en un orden
   * determinista independiente del orden de inserción en los conjuntos
   * state.heroes. Mantener este orden estático evita que el pool de
   * preguntas de Full Range repita la misma posición varias veces debido
   * a barajados o reordenamientos accidentales.
   */
  const HERO_ORDER = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];

  /**
   * Deduces la relación relativa (IP/OOP) en base al orden de las
   * posiciones. Devuelve 'IP' si el héroe actúa después del rival
   * (índice mayor) o 'OOP' si actúa antes (índice menor). Devuelve
   * null si no se pueden comparar o si son iguales.
   * @param {string|null} hero
   * @param {string|null} villain
   * @returns {string|null}
   */
  function autoguessRel(hero, villain) {
    if (!hero || !villain) return null;
    const hIdx = POS_ORDER.indexOf(hero);
    const vIdx = POS_ORDER.indexOf(villain);
    if (hIdx < 0 || vIdx < 0) return null;
    if (hIdx > vIdx) return 'IP';
    if (hIdx < vIdx) return 'OOP';
    return null;
  }

  /**
   * Estado global de la aplicación. Este objeto contiene toda la
   * información necesaria para renderizar el grid, gestionar las
   * selecciones del usuario, mantener la pintura en modo Quiz y
   * calcular objetivos para Full Range. El estado distingue entre
   * selección única (modo VISUALIZER) y selección múltiple (modo
   * QUIZ/config) para las posiciones, spots y posiciones relativas.
   */
  const state = {
    mode: 'VISUALIZER',
    hero: null,
    villain: null,
    heroes: new Set(),
    villains: new Set(),
    spot: null,
    spots: new Set(),
    relative: null,
    relatives: new Set(),
    actions: new Set(),
    filters: {
      ranks: new Set(),
      suited: false,
      offsuited: false,
      pair: false
    },
    palette: {
      FOLD: '#444444',
      LIMP: '#444444',
      OVERLIMP: '#444444',
      CALL: '#3daee9',
      BET: '#ffb300',
      OR: '#28a745',
      ROL: '#00c853',
      '3BET': '#ff7043',
      SQUEEZE: '#d500f9',
      '4BET': '#f50057',
      '5BETPLUS': '#c62828',
      ALLIN: '#000000'
    },
    brush: null,
    userPaint: {},
    showCells: false,
    fullRange: {
      enabled: false,
      targets: [],
      ok: 0,
      total: 0,
      extras: 0
    },
    quiz: {
      state: 'idle',
      pool: [],
      idx: 0,
      done: 0,
      fails: [],
      correctSet: new Set(),
      targetCombos: []
    },
    undoStack: [],
    hasClickedOr: false,
    allQuestions: [],
    failPool: new Set(),
    failPoolTotal: new Set(),
    secondRun: false,
    questionFailed: false,
    total: 0
    ,
    /**
     * Arrays para almacenar las preguntas según su origen.  Se cargan en
     * app.quiz.js a través de loadQuestions() y permiten separar las
     * preguntas de OR (questions_tags.json) de las preguntas de VS3BET
     * (questions_vs3bet.json). Nunca se deben mezclar ambas colecciones
     * para un mismo quiz.
     */
    questionsTags: [],
    questionsVs3bet: []
  };

  /**
   * Pequeño bus de eventos para desacoplar módulos. Permite
   * suscribirse y emitir eventos arbitrarios. Se utiliza internamente
   * para notificar cambios de estado entre módulos.
   */
  const listeners = {};
  function on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
  }
  function off(event, handler) {
    const list = listeners[event];
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx >= 0) list.splice(idx, 1);
  }
  function emit(event, ...args) {
    const list = listeners[event];
    if (!list) return;
    list.forEach(fn => {
      try {
        fn(...args);
      } catch (ex) {
        console.error('EventBus handler error', ex);
      }
    });
  }

  /**
   * Limpia el mapa de celdas pintadas por el usuario y la pila de
   * undo. Se invoca al entrar/salir del quiz o al reiniciar. Tras
   * limpiar se actualizan el grid y los contadores a través del
   * event-bus.
   */
  function resetUserPaint() {
    state.userPaint = {};
    state.undoStack = [];
    emit('userPaintReset');
  }

  /**
   * Resetea completamente el estado a su configuración inicial. Se
   * utiliza para restaurar la aplicación tras finalizar o detener un
   * quiz. No reinicia la paleta ni los conjuntos cargados desde
   * preguntas. El reset de pintura se delega en resetUserPaint().
   */
  function hardReset() {
    state.mode = 'VISUALIZER';
    state.hero = null;
    state.villain = null;
    state.heroes.clear();
    state.villains.clear();
    state.spot = null;
    state.spots.clear();
    state.relative = null;
    state.relatives.clear();
    state.actions.clear();
    state.filters.ranks.clear();
    state.filters.suited = false;
    state.filters.offsuited = false;
    state.filters.pair = false;
    state.brush = null;
    state.showCells = false;
    state.fullRange.enabled = false;
    state.fullRange.targets = [];
    state.fullRange.ok = 0;
    state.fullRange.total = 0;
    state.fullRange.extras = 0;
    state.quiz.state = 'idle';
    state.quiz.pool = [];
    state.quiz.idx = 0;
    state.quiz.done = 0;
    state.quiz.fails = [];
    state.quiz.correctSet.clear();
    state.quiz.targetCombos = [];
    state.undoStack = [];
    state.hasClickedOr = false;
    state.failPool.clear();
    state.failPoolTotal.clear();
    state.secondRun = false;
    state.questionFailed = false;
    state.total = 0;
    resetUserPaint();
    emit('hardReset');
  }

  // Exponer helpers y estado en el namespace App.State
  App.State = {
    POS_ORDER,
    HERO_ORDER,
    autoguessRel,
    state,
    on,
    off,
    emit,
    resetUserPaint,
    hardReset
  };

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));