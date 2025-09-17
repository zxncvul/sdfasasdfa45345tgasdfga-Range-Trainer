/*
 * app.rules.js
 *
 * Este módulo implementa la lógica de habilitación, visibilidad y exclusión de
 * controles en función del estado de la aplicación. Incluye:
 *  - Reglas de selección de posiciones
 *  - IP/OOP
 *  - Acciones (F, C, OR, ROL, 3B, SQZ, 4B, 5B, ALL)
 *  - Filtros de rango
 *  - Gestión de clics en el grid durante el quiz
 *
 * Está diseñado para trabajar con App.State, App.Dom, App.Ranges, App.Paint y App.Quiz
 * sin dependencias externas ni bundlers. Incluye defensivos para evitar romper la UI si
 * algunas funciones no existen.
 *
 * Cambios clave solicitados:
 *  1) QUIZ/config: Ocultar (display none) todos los botones de acción por defecto
 *     y mostrar solo los realmente disponibles.
 *  2) QUIZ/active: Delegar la visibilidad/habilitación en updateQuestionActionButtons(),
 *     donde los no permitidos quedan ocultos.
 *  3) Normalización de etiquetas largas a los data-action reales de los botones:
 *     F, C, OR, ROL, 3B, SQZ, 4B, 5B, ALL.
 *  4) Blindaje al entrar en QUIZ/config para evitar parpadeos.
 *
 * Requisitos CSS:
 *  .action-unavailable  -> estilo de "no disponible" (p.ej. borde discontinuo verde)
 *  .action-hidden       -> display: none !important;
 */

;(function (global) {
  'use strict';

  const App = global.App = global.App || {};
  App.Rules = App.Rules || {};

  // ==========================================================================
  // Utilidades Defensivas
  // ==========================================================================

  function safeTry(fn, ...args) {
    try {
      if (typeof fn === 'function') return fn(...args);
    } catch (err) {
      if (global.console && console.warn) console.warn('[App.Rules] safeTry:', err);
    }
    return undefined;
  }

  function ensureRefs() {
    const Dom = App.Dom = App.Dom || {};
    Dom.refs = Dom.refs || {};

    const r = Dom.refs;

    // Colecta de referencias básicas si faltan
    if (!r.actionButtons) r.actionButtons = Array.from(document.querySelectorAll('[data-action]'));
    if (!r.filterButtons) r.filterButtons = Array.from(document.querySelectorAll('[data-filter-kind="rank"],[data-filter-kind="suit"],[data-filter-kind="alt"]'));
    if (!r.heroButtons)   r.heroButtons = Array.from(document.querySelectorAll('[data-hero]'));
    if (!r.villainButtons)r.villainButtons = Array.from(document.querySelectorAll('[data-villain]'));
    if (!r.relativeButtons) r.relativeButtons = Array.from(document.querySelectorAll('[data-relative]'));
    if (!r.moveButtons)   r.moveButtons = Array.from(document.querySelectorAll('[data-filter].move'));

    return r;
  }

  function getState() {
    const S = App.State || {};
    if (typeof S.get === 'function') {
      const g = S.get();
      if (g && typeof g === 'object') return g;
    }
    if (S.state && typeof S.state === 'object') return S.state;
    return S; // última opción
  }

  function collectFromAny(container) {
    if (!container) return [];
    if (Array.isArray(container)) return container.slice();
    if (container instanceof Set) return Array.from(container);
    if (typeof container === 'object') return Object.values(container);
    return [];
  }

  // ==========================================================================
  // Normalización de etiquetas de acciones -> data-action
  // ==========================================================================

  /**
   * Normaliza un movimiento a su nombre de acción (data-action) utilizado en
   * los botones de la interfaz. Se aceptan sinónimos cortos como 'F', 'C', '3B', etc.
   * Esta función siempre devuelve una acción larga (FOLD, CALL, OR, ROL, 3BET,
   * SQUEEZE, 4BET, 5BETPLUS, ALLIN) para asegurar que las comparaciones con
   * btn.dataset.action (que usa esos nombres) sean coherentes.
   * Si no se reconoce el movimiento, se devuelve m tal cual en mayúsculas.
   * @param {string} move
   * @returns {string|null}
   */
  function normalizeToButtonTag(move) {
    if (!move) return null;
    const m = String(move).trim().toUpperCase();
    // Permitir abreviaturas como 'F' y 'C' devolviendo FOLD y CALL
    if (m === 'F' || m === 'FOLD') return 'FOLD';
    if (m === 'C' || m === 'CALL') return 'CALL';
    // OR engloba BET, OR, y abreviaturas
    if (m === 'BET' || m === 'OR') return 'OR';
    if (m === 'ROL') return 'ROL';
    // 3BET engloba 3BET, 3B
    if (m === '3BET' || m === '3B') return '3BET';
    // SQZ -> SQUEEZE
    if (m === 'SQUEEZE' || m === 'SQZ') return 'SQUEEZE';
    // 4BET engloba 4BET, 4B
    if (m === '4BET' || m === '4B') return '4BET';
    // 5BETPLUS engloba 5BET+, 5BET, 5BETPLUS, 5B
    if (m === '5BETPLUS' || m === '5BET+' || m === '5BET' || m === '5B') return '5BETPLUS';
    // ALLIN engloba ALL, ALLIN
    if (m === 'ALLIN' || m === 'ALL') return 'ALLIN';
    // LIMP y OVERLIMP quedan como están, aunque no hay botón para ellos
    if (m === 'LIMP') return 'LIMP';
    if (m === 'OVERLIMP') return 'OVERLIMP';
    return m;
  }

  // ==========================================================================
  // Helpers para disponibilidad/permitidos
  // ==========================================================================

  function getAvailableMovesForVisualizer(state) {
    const L = App.Logic || {};
    let raw =
      safeTry(L.getAvailableMovesForVisualizer, state) ||
      safeTry(L.computeAvailableMoves, state) ||
      safeTry(L.computeRangeMapping, state);
    const set = new Set();
    collectFromAny(raw).forEach(mv => {
      const t = normalizeToButtonTag(mv);
      if (t) set.add(t);
    });
    return set;
  }

  function getAvailableMovesForQuizConfig(state) {
    const Q = App.Quiz || {};
    const L = App.Logic || {};
    let raw =
      safeTry(Q.getAvailableMovesForConfig, state) ||
      safeTry(L.getAvailableMovesForConfig, state) ||
      safeTry(L.computeAvailableMoves, state) ||
      safeTry(L.computeRangeMapping, state);
    const set = new Set();
    collectFromAny(raw).forEach(mv => {
      const t = normalizeToButtonTag(mv);
      if (t) set.add(t);
    });
    return set;
  }

  function getAllowedMovesForActiveQuestion(state) {
    const Q = App.Quiz || {};
    // Si la pregunta activa es de tipo FULLRANGE y define allowedMoves, devolverlas tal cual
    if (state && state.quiz && state.quiz.currentQuestion && state.quiz.currentQuestion.kind === 'FULLRANGE') {
      const q = state.quiz.currentQuestion;
      const moves = q && Array.isArray(q.allowedMoves) ? q.allowedMoves : [];
      const res = new Set();
      moves.forEach(mv => {
        if (typeof mv === 'string') res.add(mv.toUpperCase());
      });
      return res;
    }
    let raw = safeTry(Q.getAllowedMovesForCurrentQuestion, state);
    if (!raw) {
      const q = state.quiz && (state.quiz.current || state.quiz.currentQuestion || state.quiz.item);
      if (q) {
        raw = q.allowedMoves || q.allowed || q.map || q.mapping || q.answers || q.solution || q.correctMoves;
      }
    }
    const set = new Set();
    collectFromAny(raw).forEach(mv => {
      const t = normalizeToButtonTag(mv);
      if (t) set.add(t);
    });
    return set;
  }

  // ==========================================================================
  // Filtros de rango
  // ==========================================================================

  /**
   * Actualiza la disponibilidad de los filtros de rango en función
   * del modo y de las selecciones actuales de héroe, villano y
   * relativo. En el quiz se evalúan las selecciones múltiples.
   * NOTA: aquí NO se tocan botones de acción, solo filtros.
   */
  function applyFilterAvailability() {
    const s = getState();
    const refs = ensureRefs();
    if (!refs.filterButtons) return;

    // No se aplican filtros durante un quiz activo
    if (s.mode === 'QUIZ' && s.quiz && s.quiz.state === 'active') return;

    let enable = false;

    if (s.mode === 'VISUALIZER') {
      if (s.spot === 'OR') {
        enable = !!s.hero && !!s.spot;
      } else if (s.spot === 'VS3BET' || s.spot === 'VS5BET') {
        enable = !!s.relative || (!!s.hero && !!s.villain);
      }
    } else if (s.mode === 'QUIZ' && s.quiz && s.quiz.state === 'config') {
      if (!s.spots || s.spots.size === 0) {
        enable = false;
      } else {
        enable = true;
        s.spots.forEach(sp => {
          if (sp === 'OR') {
            if (!(s.heroes && s.heroes.size > 0)) enable = false;
          } else if (sp === 'VS3BET' || sp === 'VS5BET') {
            if (!(s.relatives && s.relatives.size > 0 || (s.heroes && s.heroes.size > 0 && s.villains && s.villains.size > 0))) {
              enable = false;
            }
          }
        });
      }
    }

    refs.filterButtons.forEach(btn => {
      if (enable) {
        btn.disabled = false;
        btn.classList.remove('disabled');
      } else {
        btn.disabled = true;
        btn.classList.add('disabled');
      }
    });
  }

  // ==========================================================================
  // Acciones: disponibilidad y visibilidad
  // ==========================================================================

  /**
   * Añade borde discontinuo verde a los botones de acción
   * deshabilitados. Esto se aplica tras actualizar los botones de
   * acción según el rango disponible.
   */
  function applyActionAvailability() {
    const refs = ensureRefs();
    if (!refs.actionButtons) return;
    refs.actionButtons.forEach(btn => {
      if (btn.disabled) {
        btn.classList.add('action-unavailable');
      } else {
        btn.classList.remove('action-unavailable');
      }
    });
  }

  /**
   * Actualiza los botones de acción en función del rango disponible.
   * VISUALIZER: habilita solo movimientos presentes en el mapping.
   * QUIZ/config: igual que Visualizer pero con selecciones múltiples y ocultando no disponibles.
   * QUIZ/active: bloquea todo y enciende/visibiliza solo lo permitido por la pregunta.
   */
  function updateActionButtons() {
    const s = getState();
    const r = ensureRefs();
    const buttons = r.actionButtons || [];
    if (!buttons.length) return;

    // Helper para pintar estado "no disponible"
    const paintUnavailable = () => {
      buttons.forEach(btn => {
        if (btn.disabled) btn.classList.add('action-unavailable');
        else btn.classList.remove('action-unavailable');
      });
    };

    // 1) MODO QUIZ: CONFIGURACIÓN → ocultar todos por defecto y mostrar solo reales
    if (s.mode === 'QUIZ' && s.quiz && s.quiz.state === 'config') {
      // Bloquea y OCULTA por defecto
      buttons.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled', 'action-unavailable');
        btn.classList.remove('active');
        btn.classList.add('action-hidden'); // ← OCULTAR
      });

      const avail = getAvailableMovesForQuizConfig(s);
      buttons.forEach(btn => {
        // Normalizar la etiqueta del botón para compararla con los movimientos disponibles.
        const rawAct = (btn.dataset.action || '').toUpperCase();
        const act = normalizeToButtonTag(rawAct);
        if (act && avail.has(act)) {
          btn.disabled = false;
          btn.classList.remove('disabled', 'action-unavailable');
          btn.classList.remove('action-hidden'); // ← MOSTRAR
        } else {
          btn.disabled = true;
          btn.classList.add('disabled', 'action-unavailable');
          btn.classList.add('action-hidden');    // ← OCULTAR
          btn.classList.remove('active');
          // Eliminar el movimiento almacenado en s.actions mediante su nombre normalizado
          if (act && s.actions && typeof s.actions.delete === 'function') s.actions.delete(act);
        }
      });

      paintUnavailable();
      return;
    }

    // 2) MODO QUIZ: ACTIVO → bloquear todo y delegar visibilidad/habilitación a updateQuestionActionButtons()
    if (s.mode === 'QUIZ' && s.quiz && s.quiz.state === 'active') {
      buttons.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled', 'action-unavailable');
        btn.classList.remove('active');
        // No ocultamos aquí para evitar parpadeos; lo hará updateQuestionActionButtons()
      });
      updateQuestionActionButtons();
      paintUnavailable();
      return;
    }

    // 3) VISUALIZER → derivar de rango disponible de selección única
    if (s.mode === 'VISUALIZER') {
      let mapping = {};
      if (s.hero && s.spot) mapping = safeTry(App.Ranges && App.Ranges.computeRangeMapping, s.hero, s.spot, s.relative) || {};
      const avail = new Set();
      Object.values(mapping).forEach(mv => {
        const t = normalizeToButtonTag(mv);
        if (t) avail.add(t);
      });

      buttons.forEach(btn => {
        const rawAct = (btn.dataset.action || '').toUpperCase();
        const act = normalizeToButtonTag(rawAct);
        if (avail.size === 0) {
          btn.disabled = true;
          btn.classList.add('disabled');
          btn.classList.remove('active');
          // En Visualizer, normalmente NO ocultamos; si quieres, habilita:
          // btn.classList.add('action-hidden');
        } else if (act && avail.has(act)) {
          btn.disabled = false;
          btn.classList.remove('disabled');
          btn.classList.remove('action-hidden');
        } else {
          btn.disabled = true;
          btn.classList.add('disabled');
          btn.classList.remove('active');
          if (act && s.actions && typeof s.actions.delete === 'function') s.actions.delete(act);
          // btn.classList.add('action-hidden'); // si deseas ocultar también en visualizer
        }
      });

      paintUnavailable();
    }
  }

  /**
   * En modo Quiz activo, habilita y muestra solo los movimientos permitidos por
   * la pregunta actual. Oculta los no permitidos.
   */
  function updateQuestionActionButtons() {
    const s = getState();
    const refs = ensureRefs();
    const buttons = refs.actionButtons || [];
    if (!(s.mode === 'QUIZ' && s.quiz && s.quiz.state === 'active')) return;
    if (!buttons.length) return;

    const allowedMoves = getAllowedMovesForActiveQuestion(s);

    buttons.forEach(btn => {
      // Normalizar la etiqueta del botón para compararla con los movimientos permitidos.
      const rawAct = (btn.dataset.action || '').toUpperCase();
      const act = normalizeToButtonTag(rawAct);
      const allow = act && allowedMoves.has(act);
      if (allow) {
        btn.disabled = false;
        btn.classList.remove('disabled', 'action-unavailable');
        btn.classList.remove('action-hidden'); // ← MOSTRAR si permitido
      } else {
        btn.disabled = true;
        btn.classList.add('disabled', 'action-unavailable');
        btn.classList.add('action-hidden');    // ← OCULTAR si no permitido
        if (act && s.actions && typeof s.actions.has === 'function' && s.actions.has(act)) {
          s.actions.delete(act);
          btn.classList.remove('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });

    // Ajuste del pincel si quedó inválido
    // Ajustar el pincel actual si deja de ser válido. Tanto el pincel como
    // allowedMoves contienen nombres normalizados; por ejemplo "3BET" en lugar
    // de "3B". Comprueba contra allowedMoves directamente.
    if (s.brush && !allowedMoves.has(String(s.brush).toUpperCase())) {
      const first = Array.from(allowedMoves)[0] || null;
      s.brush = first;
      safeTry(App.Paint && App.Paint.refreshBrushSelection);
    }
  }

  // ==========================================================================
  // Blindaje al entrar en QUIZ/config (evitar parpadeos)
  // ==========================================================================

  function enterQuizConfig() {
    safeTry(App.Paint && App.Paint.resetQuizToggleToCounters);
    const r = ensureRefs();
    if (r && r.actionButtons) {
      r.actionButtons.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled', 'action-unavailable', 'action-hidden');
        btn.classList.remove('active');
      });
    }
    updateActionButtons();
  }

  // ==========================================================================
  // Botones de movimiento (OR, VS3BET, VS5BET)
  // ==========================================================================

  function updateMoveButtons() {
    const s = getState();
    const refs = ensureRefs();
    if (!refs.moveButtons) return;

    const orBtn  = refs.moveButtons.find(b => (b.dataset.filter || '').toUpperCase() === 'OR');
    const vs3Btn = refs.moveButtons.find(b => (b.dataset.filter || '').toUpperCase() === 'VS3BET');
    const vs5Btn = refs.moveButtons.find(b => (b.dataset.filter || '').toUpperCase() === 'VS5BET');

    if (s.mode === 'VISUALIZER') {
      if (orBtn) {
        if (!s.hero) {
          orBtn.disabled = true; orBtn.classList.add('disabled');
        } else {
          orBtn.disabled = false; orBtn.classList.remove('disabled');
        }
      }
      const canVs = !!s.hero && s.hasClickedOr;
      if (vs3Btn) {
        if (!canVs) {
          vs3Btn.disabled = true; vs3Btn.classList.add('disabled');
          if (s.spot === 'VS3BET') {
            s.spot = null;
            vs3Btn.classList.remove('active');
            s.relative = null;
            if (refs.relativeButtons) refs.relativeButtons.forEach(b => { b.disabled = true; b.classList.add('disabled'); b.classList.remove('active'); });
          }
        } else {
          vs3Btn.disabled = false; vs3Btn.classList.remove('disabled');
        }
      }
      if (vs5Btn) {
        vs5Btn.disabled = true; vs5Btn.classList.add('disabled');
        if (s.spot === 'VS5BET') {
          s.spot = null;
          vs5Btn.classList.remove('active');
          s.relative = null;
          if (refs.relativeButtons) refs.relativeButtons.forEach(b => { b.disabled = true; b.classList.add('disabled'); b.classList.remove('active'); });
        }
      }
      if ((s.spot === 'VS3BET' || s.spot === 'VS5BET') && orBtn) orBtn.classList.add('active');

      applyFilterAvailability();
      return;
    }

    if (s.mode === 'QUIZ' && s.quiz && s.quiz.state === 'config') {
      if (orBtn) {
        if (!s.heroes || s.heroes.size === 0) {
          orBtn.disabled = true; orBtn.classList.add('disabled');
          if (s.spots && s.spots.has('OR')) { s.spots.delete('OR'); orBtn.classList.remove('active'); }
        } else {
          orBtn.disabled = false; orBtn.classList.remove('disabled');
        }
      }

      // En modo Quiz (config), para poder seleccionar VS3BET/VS5BET basta con tener
      // al menos un héroe seleccionado. No se exige haber hecho clic en OR (hasClickedOr),
      // a diferencia del modo Visualizer. Esto permite practicar VS3BET directamente.
      const canVsQuiz = s.heroes && s.heroes.size > 0;
      if (vs3Btn) {
        if (!canVsQuiz) {
          vs3Btn.disabled = true; vs3Btn.classList.add('disabled');
          if (s.spots && s.spots.has('VS3BET')) { s.spots.delete('VS3BET'); vs3Btn.classList.remove('active'); }
        } else {
          vs3Btn.disabled = false; vs3Btn.classList.remove('disabled');
        }
      }
      if (vs5Btn) {
        vs5Btn.disabled = true; vs5Btn.classList.add('disabled');
        if (s.spots && s.spots.has('VS5BET')) { s.spots.delete('VS5BET'); vs5Btn.classList.remove('active'); }
      }
    }
  }

  // ==========================================================================
  // Botones de héroe / villano / relativo
  // ==========================================================================

  function updateHeroVillainButtons() {
    const s = getState();
    const refs = ensureRefs();
    if (!refs.heroButtons) return;

    if (s.mode === 'VISUALIZER') {
      const hero = s.hero;
      const villain = s.villain;
      const spot = s.spot;
      const relative = s.relative;

      let heroDisabled = new Set();
      let heroOff = new Set();
      let villainDisabled = new Set();
      let villainOff = new Set();

      if (!spot) {
        heroOff = new Set(App.State.POS_ORDER || []);
        villainDisabled = new Set(App.State.POS_ORDER || []);
      } else if (spot === 'OR') {
        heroOff = new Set(App.State.POS_ORDER || []);
        villainDisabled = new Set(App.State.POS_ORDER || []);
      } else {
        if (!hero) {
          heroOff = new Set(App.State.POS_ORDER || []);
          villainDisabled = new Set(App.State.POS_ORDER || []);
        } else {
          const hIdx = (App.State.POS_ORDER || []).indexOf(hero);
          if (relative) {
            if (relative === 'IP') {
              (App.State.POS_ORDER || []).forEach((pos, idx) => {
                if (idx < hIdx && pos !== hero) villainOff.add(pos);
                else villainDisabled.add(pos);
              });
            } else if (relative === 'OOP') {
              (App.State.POS_ORDER || []).forEach((pos, idx) => {
                if (idx > hIdx && pos !== hero) villainOff.add(pos);
                else villainDisabled.add(pos);
              });
            }
          } else {
            (App.State.POS_ORDER || []).forEach(pos => { if (pos !== hero) villainOff.add(pos); });
            villainDisabled.add(hero);
          }

          if (villain) {
            const vIdx = (App.State.POS_ORDER || []).indexOf(villain);
            let relVal = relative;
            if (!relVal) {
              relVal = safeTry(App.State && App.State.autoguessRel, hero, villain);
              s.relative = relVal;
            }
            if (relVal === 'IP') {
              (App.State.POS_ORDER || []).forEach((pos, idx) => {
                if (idx > vIdx && pos !== villain) heroOff.add(pos);
                else heroDisabled.add(pos);
              });
            } else if (relVal === 'OOP') {
              (App.State.POS_ORDER || []).forEach((pos, idx) => {
                if (idx < vIdx && pos !== villain) heroOff.add(pos);
                else heroDisabled.add(pos);
              });
            }
            if (hero && heroDisabled.has(hero)) s.hero = null;
            if (villain && villainDisabled.has(villain)) s.villain = null;
          } else {
            (App.State.POS_ORDER || []).forEach(pos => heroOff.add(pos));
          }
        }
      }

      safeTry(App.Paint && App.Paint.paintButtons, refs.heroButtons, { activePos: s.hero, disabledSet: heroDisabled, offSet: heroOff });
      safeTry(App.Paint && App.Paint.paintButtons, refs.villainButtons, { activePos: s.villain, disabledSet: villainDisabled, offSet: villainOff });

      let relDisabled = new Set();
      let relOff = new Set();

      if (!spot || spot === 'OR' || !hero) {
        relDisabled.add('IP'); relDisabled.add('OOP');
      } else {
        if (villain) {
          const relVal = s.relative || safeTry(App.State && App.State.autoguessRel, hero, villain);
          s.relative = relVal;
          ['IP','OOP'].forEach(r => { if (r !== relVal) relOff.add(r); });
        } else {
          const hIdx2 = (App.State.POS_ORDER || []).indexOf(hero);
          let ipPossible = false, oopPossible = false;
          (App.State.POS_ORDER || []).forEach((pos, idx) => {
            if (pos === hero) return;
            if (!villainDisabled.has(pos)) {
              if (idx < hIdx2) ipPossible = true;
              if (idx > hIdx2) oopPossible = true;
            }
          });
          if (ipPossible) relOff.add('IP'); else relDisabled.add('IP');
          if (oopPossible) relOff.add('OOP'); else relDisabled.add('OOP');
        }
      }

      if (s.relative && relDisabled.has(s.relative)) s.relative = null;

      safeTry(App.Paint && App.Paint.paintButtons, refs.relativeButtons, { activePos: s.relative, disabledSet: relDisabled, offSet: relOff });

      applyFilterAvailability();
      updateMoveButtons();
      updateActionButtons();
      applyActionAvailability();
      // Tras actualizar botones en visualizador, repintar la cuadrícula y contadores
      // Esto asegura que el rango mostrado y los contadores de combinaciones se
      // recalculen inmediatamente al seleccionar héroe, villano o relativo.
      safeTry(App.Paint && App.Paint.refreshGrid);
      safeTry(App.Paint && App.Paint.updateComboCounters);
      return;
    }

    // QUIZ/config: gating múltiple
    if (s.mode === 'QUIZ' && s.quiz && s.quiz.state === 'config') {
      const heroDisabled = new Set();
      const villainDisabled = new Set();

      const shouldDisableVillain = pos => {
        if (!s.heroes || s.heroes.size === 0) return true;
        if (s.heroes.has(pos)) return true;
        const posIdx = (App.State.POS_ORDER || []).indexOf(pos);
        for (const h of s.heroes) {
          const hIdx = (App.State.POS_ORDER || []).indexOf(h);
          if (posIdx <= hIdx) return true;
        }
        return false;
      };

      const shouldDisableHero = pos => {
        if (!s.villains || s.villains.size === 0) return false;
        if (s.villains.has(pos)) return true;
        const posIdx = (App.State.POS_ORDER || []).indexOf(pos);
        for (const v of s.villains) {
          const vIdx = (App.State.POS_ORDER || []).indexOf(v);
          if (posIdx >= vIdx) return true;
        }
        return false;
      };

      (App.State.POS_ORDER || []).forEach(pos => {
        if (shouldDisableHero(pos)) heroDisabled.add(pos);
        if (shouldDisableVillain(pos)) villainDisabled.add(pos);
      });

      const heroOff = new Set();
      const villainOff = new Set();
      (App.State.POS_ORDER || []).forEach(pos => {
        if (!heroDisabled.has(pos)) heroOff.add(pos);
        if (!villainDisabled.has(pos)) villainOff.add(pos);
      });

      safeTry(App.Paint && App.Paint.paintButtons, refs.heroButtons, { activePos: null, disabledSet: heroDisabled, offSet: heroOff });
      refs.heroButtons.forEach(btn => {
        const pos = btn.dataset.hero;
        if (s.heroes && s.heroes.has(pos)) { btn.classList.add('active'); btn.disabled = false; btn.classList.remove('disabled'); }
      });

      safeTry(App.Paint && App.Paint.paintButtons, refs.villainButtons, { activePos: null, disabledSet: villainDisabled, offSet: villainOff });
      refs.villainButtons.forEach(btn => {
        const pos = btn.dataset.villain;
        if (s.villains && s.villains.has(pos)) { btn.classList.add('active'); btn.disabled = false; btn.classList.remove('disabled'); }
      });

      const needsRel = (s.spots && (s.spots.has('VS3BET') || s.spots.has('VS5BET'))) || false;
      const relDisabled2 = new Set();
      const relOff2 = new Set();
      ['IP','OOP'].forEach(r => {
        if (needsRel) {
          if (s.relatives && s.relatives.has(r)) {
            // se marcará como active debajo
          } else {
            relOff2.add(r);
          }
        } else {
          relDisabled2.add(r);
        }
      });
      safeTry(App.Paint && App.Paint.paintButtons, refs.relativeButtons, { activePos: null, disabledSet: relDisabled2, offSet: relOff2 });
      refs.relativeButtons.forEach(btn => {
        const rel = btn.dataset.relative;
        if (s.relatives && s.relatives.has(rel)) { btn.classList.add('active'); btn.disabled = false; btn.classList.remove('disabled'); }
      });

      applyFilterAvailability();
      updateMoveButtons();
      updateActionButtons();
      applyActionAvailability();
      return;
    }
  }

  // ==========================================================================
  // Grid: manejo de clic en Quiz activo
  // ==========================================================================

  /**
   * Maneja el clic sobre una celda durante el modo Quiz activo. Se valida
   * el movimiento y la combinación, gestionando pintura, deshacer y avance
   * de preguntas. Para Full Range se limita a pintar las combinaciones objetivo.
   *
   * @param {HTMLTableCellElement} td
   */
  function handleQuizCellClick(td) {
    const s = getState();
    // Solo procede si estamos en modo QUIZ activo y hay un pincel definido
    if (!(s.mode === 'QUIZ' && s.quiz && s.quiz.state === 'active')) return;
    if (!s.brush) return;

    const combo = td.dataset.label;
    ensureRefs();

    // FULL RANGE: solo permite pintar combos objetivo con la acción correcta
    if (s.fullRange && s.fullRange.enabled) {
      // Si el combo no está entre los objetivos, muestra feedback y aborta
      if (!s.fullRange.targets || !s.fullRange.targets.includes(combo)) {
        td.style.transition = 'background-color 0.2s';
        td.style.backgroundColor = '#640404';
        setTimeout(() => safeTry(App.Paint && App.Paint.refreshGrid), 300);
        return;
      }
      // Valida que el pincel coincide con el movimiento esperado para el combo
      const expected = (s.quiz && s.quiz.expectedMoveByCombo && s.quiz.expectedMoveByCombo[combo]) || null;
      if (expected && String(expected).toUpperCase() !== String(s.brush).toUpperCase()) {
        td.style.transition = 'background-color 0.2s';
        td.style.backgroundColor = '#640404';
        setTimeout(() => safeTry(App.Paint && App.Paint.refreshGrid), 300);
        return;
      }
      // Pinta o deshace en modo Full Range
      s.undoStack = s.undoStack || [];
      s.userPaint = s.userPaint || {};
      s.undoStack.push(JSON.parse(JSON.stringify(s.userPaint)));
      const existing = s.userPaint[combo];
      if (existing && existing[s.brush] === 100) {
        delete s.userPaint[combo];
      } else {
        s.userPaint[combo] = {};
        s.userPaint[combo][s.brush] = 100;
      }
      safeTry(App.Paint && App.Paint.refreshGrid);
      safeTry(App.Paint && App.Paint.updateComboCounters);
      safeTry(App.Paint && App.Paint.updateFullRangeProgress);
      applyFilterAvailability();
      return;
    }

    // En preguntas normales, si hay acción obligatoria y no coincide, pinta error y sale
    const required = s.quiz.currentAction || null;
    if (required && String(s.brush).toUpperCase() !== String(required).toUpperCase()) {
      td.style.transition = 'background-color 0.2s';
      td.style.backgroundColor = '#640404';
      setTimeout(() => safeTry(App.Paint && App.Paint.refreshGrid), 300);
      return;
    }

    // Valida combos objetivo si existen (no Full Range)
    const targets = s.quiz.targetCombos || [];
    if (targets.length > 0 && !targets.includes(combo)) {
      td.style.transition = 'background-color 0.2s';
      td.style.backgroundColor = '#640404';
      setTimeout(() => safeTry(App.Paint && App.Paint.refreshGrid), 300);
      return;
    }

    // Pinta / deshace en preguntas normales
    s.undoStack = s.undoStack || [];
    s.userPaint = s.userPaint || {};
    s.quiz.correctSet = s.quiz.correctSet || new Set();
    s.undoStack.push(JSON.parse(JSON.stringify(s.userPaint)));

    const existing2 = s.userPaint[combo];
    if (existing2 && existing2[s.brush] === 100) {
      delete s.userPaint[combo];
      if (s.quiz.correctSet) s.quiz.correctSet.delete(combo);
    } else {
      s.userPaint[combo] = {};
      s.userPaint[combo][s.brush] = 100;
      if (s.quiz.correctSet) s.quiz.correctSet.add(combo);
    }

    safeTry(App.Paint && App.Paint.refreshGrid);
    safeTry(App.Paint && App.Paint.updateComboCounters);

    // Avanza de pregunta si se han marcado todos los objetivos
    if (targets && s.quiz.correctSet && s.quiz.correctSet.size === targets.length) {
      safeTry(App.Quiz && App.Quiz.nextQuestion);
    }
  }

  // ==========================================================================
  // API pública
  // ==========================================================================

  App.Rules.normalizeToButtonTag = normalizeToButtonTag;
  App.Rules.applyFilterAvailability = applyFilterAvailability;
  App.Rules.applyActionAvailability = applyActionAvailability;
  App.Rules.updateActionButtons = updateActionButtons;
  App.Rules.updateQuestionActionButtons = updateQuestionActionButtons;
  App.Rules.updateMoveButtons = updateMoveButtons;
  App.Rules.updateHeroVillainButtons = updateHeroVillainButtons;
  App.Rules.handleQuizCellClick = handleQuizCellClick;
  App.Rules.enterQuizConfig = enterQuizConfig;

  // Hook opcional
  App.Rules.init = function init() {
    ensureRefs();
    updateActionButtons();
  };

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));