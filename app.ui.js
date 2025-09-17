/*
 * app.ui.js
 *
 * Este módulo combina la inicialización de referencias al DOM y las
 * operaciones de repintado de la interfaz. Agrupa la lógica de
 * App.Dom y App.Paint en un único archivo para simplificar la
 * estructura del proyecto. Al cargarse, define los espacios de
 * nombres App.Dom y App.Paint en el objeto global App.
 */

;(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  // Ensure the UI namespace exists on the App object so that functions
  // can be attached to it without throwing errors. Without this,
  // assignments like `App.UI.setConfigDisabled = ...` would throw
  // "Cannot set properties of undefined" if `App.UI` were undefined.
  App.UI = App.UI || {};

  /* ------------------------------------------------------------------
   *  Módulo DOM (App.Dom)
   *
   *  Se encarga de inicializar y almacenar referencias a elementos del
   *  DOM utilizados por la aplicación. También crea nodos ausentes y
   *  define variables CSS para la paleta de colores definida en el
   *  estado global. Cuando termina la inicialización emite un
   *  evento 'domReady' a través del bus de eventos definido en
   *  App.State.
   */
  App.Dom = App.Dom || {};

  // Objeto para almacenar todas las referencias al DOM
  const refs = {};

  /**
   * Inicializa las referencias al DOM. Debe llamarse tras cargar el
   * documento. Prepara elementos faltantes (como el contador de
   * preguntas) y define variables CSS para la paleta de movimientos.
   */
  function initRefs() {
    // Tabla y celdas de la cuadrícula
    refs.gridCells = Array.from(document.querySelectorAll('#range-table td[data-label]'));
    // Botones de héroe y villano
    refs.heroButtons = Array.from(document.querySelectorAll('.pos-left .control-btn[data-hero]'));
    refs.villainButtons = Array.from(document.querySelectorAll('.pos-right .control-btn[data-villain]'));
    // Botones de IP/OOP
    refs.relativeButtons = Array.from(document.querySelectorAll('.pos-center .control-btn[data-relative]'));
    // Botones de movimientos (OR, VS3BET, VS5BET)
    refs.moveButtons = Array.from(document.querySelectorAll('.move-section .control-btn[data-filter]'));
    // Botones de acciones (FOLD, CALL, etc.)
    refs.actionButtons = Array.from(document.querySelectorAll('.action-section .control-btn[data-action]'));
    // Botones de filtros (rango de valores y suites)
    refs.filterButtons = Array.from(document.querySelectorAll('.filter-section .control-btn[data-filter]'));
    // Toggles y otros elementos
    refs.fullRangeToggle = document.getElementById('full-range-toggle');
    refs.showCellsToggle = document.getElementById('toggle-show-cells');
    // Botones de barra de Quiz
    refs.quizConfig = document.getElementById('quiz-config');
    refs.quizBegin = document.getElementById('quiz-begin');
    refs.quizStop = document.getElementById('quiz-stop');
    refs.quizReset = document.getElementById('quiz-reset');
    refs.quizResetFails = document.getElementById('quiz-reset-fails');
    // Elementos de contadores y pregunta
    refs.comboTotalEl = document.getElementById('combo-total');
    refs.comboAllEl = document.getElementById('combo-all');
    refs.comboSEl = document.getElementById('combo-s');
    refs.comboOEl = document.getElementById('combo-o');
    refs.quizCounter = document.getElementById('quiz-counter');
    refs.quizQuestion = document.getElementById('quiz-question');
    refs.comboCounter = document.getElementById('combo-counter');
    // Contenedor central (quiz-toggle) para mostrar pregunta/contadores
    const quizToggle = document.getElementById('quiz-toggle');
    refs.quizToggle = quizToggle;
    // Crear quiz-counter si no existe
    if (!refs.quizCounter && quizToggle) {
      const qc = document.createElement('div');
      qc.id = 'quiz-counter';
      qc.className = 'quiz-counter';
      if (refs.quizQuestion && refs.quizQuestion.parentNode === quizToggle) {
        quizToggle.insertBefore(qc, refs.quizQuestion);
      } else {
        quizToggle.appendChild(qc);
      }
      refs.quizCounter = qc;
    }
    // Contenedor de acciones
    refs.actionSection = document.querySelector('.action-section');
    // Definir variables CSS para la paleta de colores
    const palette = App.State && App.State.state && App.State.state.palette;
    if (palette) {
      Object.keys(palette).forEach(move => {
        const varName = `--move-${move.toLowerCase()}`;
        document.documentElement.style.setProperty(varName, palette[move]);
      });
    }
    // Ajustar icono del ojo en el toggle de mostrar celdas
    if (refs.showCellsToggle) {
      const SVG_OJO_ACTIVO =
        '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      refs.showCellsToggle.innerHTML = SVG_OJO_ACTIVO;
    }
    // Hacer accesible desde App
    App.Dom.refs = refs;
    // Notificar que las referencias están listas
    if (App.State && App.State.emit) App.State.emit('domReady');
  }

  // Exponer función
  App.Dom.initRefs = initRefs;

  /* ------------------------------------------------------------------
   *  Módulo Paint (App.Paint)
   *
   *  Contiene funciones para repintar la cuadrícula y actualizar
   *  contadores y pinceles. No gestiona lógica de reglas, sólo
   *  calcula y aplica estilos basándose en el estado global.
   */
  App.Paint = App.Paint || {};

  /**
   * Pinta los botones de control según las posiciones activas,
   * deshabilitadas u off. Utiliza las mismas reglas que
   * advanced.js para hero, villain y relative.
   * @param {HTMLElement[]} btnList
   * @param {Object} opts
   */
  function paintButtons(btnList, { activePos = null, disabledSet = new Set(), offSet = new Set() }) {
    btnList.forEach(btn => {
      const pos = btn.dataset.hero || btn.dataset.villain || btn.dataset.relative;
      btn.classList.remove('active', 'off', 'disabled');
      btn.disabled = false;
      if (pos === activePos) {
        btn.classList.add('active');
      } else if (disabledSet.has(pos)) {
        btn.classList.add('disabled');
        btn.disabled = true;
      } else if (offSet.has(pos)) {
        btn.classList.add('off');
      } else {
        btn.classList.add('disabled');
        btn.disabled = true;
      }
    });
  }

  /**
   * Repinta la cuadrícula de manos. En modo VISUALIZER utiliza el
   * mapeo de rangos y filtros para colorear las celdas; en modo
   * QUIZ utiliza las pinturas del usuario. También actualiza los
   * contadores tras el repintado.
   */
  function refreshGrid() {
    const s = App.State.state;
    const r = App.Dom.refs;
    if (!r || !r.gridCells) return;
    if (s.mode === 'VISUALIZER') {
      let mapping = {};
      if (s.hero && s.spot) {
        mapping = App.Ranges.computeRangeMapping(s.hero, s.spot, s.relative);
      }
      const combos = Object.keys(mapping);
      const filtered = new Set(App.Ranges.applyFilters(combos));
      r.gridCells.forEach(td => {
        const combo = td.dataset.label;
        const move = mapping[combo];
        let shouldHighlight = false;
        if (move && filtered.has(combo)) {
          const moveUpper = move.toUpperCase();
          if (s.actions.size === 0 || s.actions.has(moveUpper)) {
            shouldHighlight = true;
          }
        }
        if (shouldHighlight) {
          const color = s.palette[move] || '#555';
          td.style.background = color;
          if (move && move.toUpperCase() === 'ALLIN') {
            td.style.color = '#ff1744';
          } else {
            td.style.color = '#000';
          }
          td.style.textShadow = '';
          td.textContent = combo;
        } else {
          if (s.showCells) {
            td.style.background = 'var(--color-bg)';
            td.style.color = 'transparent';
            td.style.textShadow = '';
            td.textContent = combo;
          } else {
            td.style.background = 'var(--color-bg)';
            td.style.color = 'var(--color-green)';
            td.style.textShadow = '0 1px 0 rgba(255,255,255,.25)';
            td.textContent = combo;
          }
        }
      });
    } else {
      // Modo QUIZ: pintar según userPaint
      r.gridCells.forEach(td => {
        const combo = td.dataset.label;
        const paint = s.userPaint[combo];
        if (paint) {
          const move = Object.keys(paint)[0];
          const color = s.palette[move] || '#555';
          td.style.background = color;
          if (move && move.toUpperCase() === 'ALLIN') {
            td.style.color = '#ff1744';
          } else {
            td.style.color = '#000';
          }
          td.style.textShadow = '';
          td.textContent = combo;
        } else {
          if (s.showCells) {
            td.style.background = 'var(--color-bg)';
            td.style.color = 'transparent';
            td.style.textShadow = '';
            td.textContent = combo;
          } else {
            td.style.background = 'var(--color-bg)';
            td.style.color = 'var(--color-green)';
            td.style.textShadow = '0 1px 0 rgba(255,255,255,.25)';
            td.textContent = combo;
          }
        }
      });
    }
    updateComboCounters();
  }

  /**
   * Calcula y actualiza los contadores de combinaciones. En VISUALIZER se
   * basan en el rango resaltado; en QUIZ se basan en la pintura.
   */
  function updateComboCounters() {
    const s = App.State.state;
    const r = App.Dom.refs;
    let total = 0;
    let suited = 0;
    let offsuit = 0;
    if (s.mode === 'VISUALIZER') {
      if (s.hero && s.spot) {
        let mapping = App.Ranges.computeRangeMapping(s.hero, s.spot, s.relative);
        let combos = Object.keys(mapping);
        combos = App.Ranges.applyFilters(combos);
        combos.forEach(combo => {
          const move = mapping[combo];
          if (!move) return;
          const moveUpper = move.toUpperCase();
          if (s.actions.size > 0 && !s.actions.has(moveUpper)) return;
          if (combo.length === 2) {
            total += 6;
            offsuit++;
          } else if (combo.endsWith('s')) {
            total += 4;
            suited++;
          } else if (combo.endsWith('o')) {
            total += 12;
            offsuit++;
          }
        });
      }
    } else {
      Object.keys(s.userPaint).forEach(combo => {
        const isPair = combo.length === 2;
        const isSuited = combo.endsWith('s');
        const isOff = combo.endsWith('o');
        if (isPair) {
          total += 6;
          offsuit++;
        } else if (isSuited) {
          total += 4;
          suited++;
        } else if (isOff) {
          total += 12;
          offsuit++;
        }
      });
    }
    if (r.comboTotalEl) r.comboTotalEl.textContent = String(total).padStart(4, '0');
    const all = suited + offsuit;
    if (r.comboAllEl) r.comboAllEl.textContent = String(all).padStart(3, '0');
    if (r.comboSEl) r.comboSEl.textContent = String(suited).padStart(2, '0');
    if (r.comboOEl) r.comboOEl.textContent = String(offsuit).padStart(2, '0');
  }

  /**
   * Actualiza el progreso de Full Range durante el quiz. Muestra el
   * número de combinaciones acertadas y extras. Si se completan
   * todos los objetivos sin extras se finaliza el quiz.
   */
  function updateFullRangeProgress() {
    const s = App.State.state;
    const r = App.Dom.refs;
    if (!s.fullRange.enabled || s.quiz.state !== 'active') return;
    const targets = s.fullRange.targets;
    let ok = 0;
    let extras = 0;
    Object.keys(s.userPaint).forEach(c => {
      if (targets.includes(c)) ok++;
      else extras++;
    });
    s.fullRange.ok = ok;
    s.fullRange.extras = extras;
    const total = s.fullRange.total;
    if (r.quizCounter) r.quizCounter.textContent = `${String(ok).padStart(3, '0')}/${String(total).padStart(3, '0')} (${extras})`;
    // Si completamos todos los combos objetivo y no hay extras, avanzar a la siguiente pregunta
    // en el pool de Full Range en lugar de terminar el quiz inmediatamente. Llamar a finishQuiz
    // sólo si no queda ninguna consigna más. La lógica de avance y finalización se delega
    // a nextQuestion(), que invocará finishQuiz cuando corresponda.
    if (ok === total && extras === 0) {
      if (App.Quiz) {
        // Avanzar a la siguiente pregunta si existe, o finalizar si estamos al final del pool
        if (typeof App.Quiz.nextQuestion === 'function') {
          App.Quiz.nextQuestion();
        } else if (typeof App.Quiz.finishQuiz === 'function') {
          App.Quiz.finishQuiz();
        }
      }
    }
  }

  /**
   * Muestra la pregunta en el toggle central, ocultando los contadores de
   * combos. Se utiliza al iniciar una nueva pregunta.
   */
  function resetQuizToggleToQuestion() {
    const r = App.Dom.refs;
    if (!r || !r.quizToggle) return;
    r.quizToggle.classList.remove('show-counters');
    if (r.comboCounter && r.quizQuestion) {
      r.comboCounter.style.display = 'none';
      r.quizQuestion.style.display = 'block';
    }
  }

  /**
   * Muestra los contadores de combos en el toggle central, ocultando la
   * pregunta. Se usa durante las fases donde no hay enunciado.
   */
  function resetQuizToggleToCounters() {
    const r = App.Dom.refs;
    if (!r || !r.quizToggle) return;
    r.quizToggle.classList.add('show-counters');
    if (r.comboCounter && r.quizQuestion) {
      r.comboCounter.style.display = 'flex';
      r.quizQuestion.style.display = 'none';
    }
  }

  /**
   * Resalta el pincel activo en los botones de acción durante el
   * quiz. Quita el resaltado cuando no se está en modo activo.
   */
  function refreshBrushSelection() {
    const s = App.State.state;
    const r = App.Dom.refs;
    r.actionButtons.forEach(btn => {
      const act = (btn.dataset.action || '').toUpperCase();
      if (s.quiz.state === 'active') {
        if (s.brush && s.brush.toUpperCase() === act) {
          btn.classList.add('brush-active');
        } else {
          btn.classList.remove('brush-active');
        }
      } else {
        btn.classList.remove('brush-active');
      }
    });
  }

  /**
   * Enable or disable all configuration controls (hero, villain, relative,
   * move and filter buttons) while leaving action buttons enabled. This
   * helper is used during quiz mode to prevent configuration changes
   * mid-session. When disabled, buttons are dimmed via opacity.
   *
   * @param {boolean} disabled If true, configuration controls are disabled.
   */
  App.UI.setConfigDisabled = function(disabled) {
    try {
      // Grab references to pre-collected button lists if available
      const refs = App.Dom && App.Dom.refs;
      if (!refs) return;
      const controls = [];
      if (refs.heroButtons) controls.push(...refs.heroButtons);
      if (refs.villainButtons) controls.push(...refs.villainButtons);
      if (refs.relativeButtons) controls.push(...refs.relativeButtons);
      if (refs.moveButtons) controls.push(...refs.moveButtons);
      if (refs.filterButtons) controls.push(...refs.filterButtons);
      controls.forEach(btn => {
        btn.disabled = !!disabled;
        if (disabled) {
          btn.classList.add('is-disabled');
          btn.style.pointerEvents = 'none';
          btn.style.opacity = '0.5';
        } else {
          btn.classList.remove('is-disabled');
          btn.style.pointerEvents = '';
          btn.style.opacity = '';
        }
      });
    } catch (e) {
      if (global.console && console.warn) console.warn('setConfigDisabled failed:', e);
    }
  };

  // Exponer funciones de Paint
  App.Paint.paintButtons = paintButtons;
  App.Paint.refreshGrid = refreshGrid;
  App.Paint.updateComboCounters = updateComboCounters;
  App.Paint.updateFullRangeProgress = updateFullRangeProgress;
  App.Paint.resetQuizToggleToQuestion = resetQuizToggleToQuestion;
  App.Paint.resetQuizToggleToCounters = resetQuizToggleToCounters;
  App.Paint.refreshBrushSelection = refreshBrushSelection;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));