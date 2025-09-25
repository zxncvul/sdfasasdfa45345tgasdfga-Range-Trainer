/*
 * app.logic.js
 *
 * Este módulo agrupa la lógica de rangos y reglas de habilitación
 * en un único archivo. Define App.Ranges para calcular mapeos de
 * rangos y filtrar combinaciones, así como App.Rules para
 * gestionar la disponibilidad de posiciones, spots, acciones y
 * filtros. También implementa el manejador de clics sobre celdas
 * durante el quiz.
 */

;(function (global) {
  'use strict';
  const App = global.App = global.App || {};

  /* ------------------------------------------------------------------
   *  Módulo Ranges (App.Ranges)
   *
   *  Calcula mapeos {combo: move} desde window.rangos y aplica
   *  filtros de mano. También resuelve las combinaciones de una
   *  pregunta a partir de sus tags.
   */
  App.Ranges = App.Ranges || {};

  /**
   * Construye un mapeo de combinaciones a movimientos para el
   * héroe, spot y relativo dados. En VS5BET no hay datos.
   * @param {string|null} hero
   * @param {string|null} spot
   * @param {string|null} relative
   * @returns {Object.<string,string>}
   */
  function computeRangeMapping(hero, spot, relative) {
    const mapping = {};
    const ranges = window.rangos && window.rangos['DAVID DIAZ'] && window.rangos['DAVID DIAZ'].BASICOS;
    if (!hero || !spot || !ranges) return mapping;
    if (spot === 'OR') {
      const orRange = ranges.OR && ranges.OR[hero];
      if (!orRange) return mapping;
      const all = [].concat(orRange.parejas || [], orRange.suited || [], orRange.offsuit || []);
      all.forEach(c => {
        mapping[c] = 'OR';
      });
      return mapping;
    }
    if (spot === 'VS3BET') {
      const vs = ranges.VS3BET;
      if (!vs || !relative) return mapping;
      const byRel = vs[relative];
      if (!byRel) return mapping;
      const posRange = byRel[hero];
      if (!posRange) return mapping;
      Object.keys(posRange).forEach(move => {
        const def = posRange[move];
        if (!def) return;
        [].concat(def.parejas || [], def.suited || [], def.offsuit || []).forEach(c => {
          mapping[c] = move;
        });
      });
      return mapping;
    }
    return mapping;
  }

  /**
   * Aplica los filtros almacenados en App.State.state.filters a una
   * lista de combinaciones. Mantiene sólo aquellas que cumplen
   * criterios de rangos, suited/off y pareja.
   * @param {string[]} combos
   * @returns {string[]}
   */
  function applyFilters(combos) {
    const s = App.State.state;
    let result = combos.slice();
    const { ranks, suited, offsuited, pair } = s.filters;
    if (ranks.size > 0) {
      result = result.filter(c => ranks.has(c[0]) || ranks.has(c[1]));
    }
    if (suited) {
      result = result.filter(c => c.length === 3 && c.endsWith('s'));
    }
    if (offsuited) {
      result = result.filter(c => (c.length === 3 && c.endsWith('o')) || c.length === 2);
    }
    if (pair) {
      result = result.filter(c => c.length === 2);
    }
    return result;
  }

  /**
   * Resuelve las combinaciones de una pregunta a partir de sus tags,
   * recorriendo window.rangos y aplicando filtros de acción,
   * connectors y suits. Devuelve una lista de strings de mano.
   * @param {string[]} tags
   * @returns {string[]}
   */
  function resolveRango(tags) {
    function isAdjacent(a, b) {
      // Consider both AK and all adjacent ranks (including broadway) as connectors.
      const pair = a + b;
      const connectors = new Set([
        'AK','KA',
        'KQ','QK','QJ','JQ','JT','TJ',
        'T9','9T','98','89','87','78','76','67','65','56','54','45','43','34','32','23'
      ]);
      return connectors.has(pair);
    }
    const root = window.rangos && window.rangos['DAVID DIAZ'] && window.rangos['DAVID DIAZ'].BASICOS;
    if (!root) return [];
    const move = tags.find(t => ['OR','VS3BET','VS5BET'].includes(t));
    const rel  = tags.find(t => ['OOP','IP'].includes(t));
    const pos  = tags.find(t => ['UTG','MP','CO','BTN','SB','BB'].includes(t));
    if (!move || !pos) return [];
    let node;
    if (move === 'VS3BET' || move === 'VS5BET') {
      if (rel && root[move] && root[move][rel] && root[move][rel][pos]) {
        node = root[move][rel][pos];
      } else {
        node = { parejas: [], suited: [], offsuit: [] };
        ['OOP','IP'].forEach(r => {
          const sub = root[move] && root[move][r] && root[move][r][pos];
          if (sub) {
            node.parejas = node.parejas.concat(sub.parejas || []);
            node.suited   = node.suited  .concat(sub.suited  || []);
            node.offsuit  = node.offsuit .concat(sub.offsuit || []);
          }
        });
      }
      const actionTag = tags.find(t => ['FOLD','CALL','3BET','4BET','ALLIN','5BETPLUS','5BET+','ROL','SQUEEZE','OVERLIMP','LIMP','5BET'].includes(t));
      if (actionTag && node[actionTag]) {
        node = node[actionTag];
      }
    } else {
      node = root[move] && root[move][pos];
    }
    if (!node) return [];
    let combos = [].concat(node.parejas || [], node.suited || [], node.offsuit || []);
    const wantSu  = tags.includes('SUITED');
    const wantOff = tags.includes('OFFSUITED');
    if (wantOff && !wantSu) {
      combos = [].concat(node.offsuit || [], node.parejas || []);
    } else if (wantSu && !wantOff) {
      combos = [].concat(node.suited || []);
    }
    const broad = tags.find(t => /^[2-9TJQKA]X$/.test(t));
    if (broad) {
      const r = broad[0];
      combos = combos.filter(c => c.includes(r));
    } else {
      const exact = tags.find(t => /^[2-9TJQKA]$/.test(t));
      if (exact) {
        combos = combos.filter(c => c.includes(exact));
      }
    }
    if (tags.includes('CONNECTORS')) {
      combos = combos.filter(c => c.length === 3 && isAdjacent(c[0], c[1]));
    }
    // Excluir conectores sólo cuando se especifica 'NO_CONNECTORS' y no hay tag de rango
    if (tags.includes('NO_CONNECTORS')) {
      const hasRankTag = tags.some(t => (/^[2-9TJQKA]X$/.test(t) || /^[2-9TJQKA]$/.test(t)));
      if (!hasRankTag) {
        combos = combos.filter(c => {
          if (c.length !== 3) return true;
          return !isAdjacent(c[0], c[1]);
        });
      }
    }
    // Excluir parejas sólo si NO_PAIR está presente y no se pide OFFSUITED (las parejas se consideran offsuit)
    if (tags.includes('NO_PAIR') && !tags.includes('OFFSUITED')) {
      combos = combos.filter(c => c.length > 2);
    }
    if (wantSu && !wantOff) {
      combos = combos.filter(c => c.length === 3 && /s$/i.test(c));
    } else if (wantOff && !wantSu) {
      combos = combos.filter(c => (c.length === 3 && /o$/i.test(c)) || c.length === 2);
    }
    return combos;
  }

  // Exportar funciones de Ranges
  App.Ranges.computeRangeMapping = computeRangeMapping;
  App.Ranges.applyFilters = applyFilters;
  App.Ranges.resolveRango = resolveRango;

  /* ------------------------------------------------------------------
   *  Módulo Rules (App.Rules)
   *
   *  Implementa reglas de habilitación y exclusión de controles en
   *  función del estado. También maneja el clic sobre celdas en el
   *  quiz.
   */
  App.Rules = App.Rules || {};

  /**
   * Obtiene una instantánea normalizada de las selecciones actuales
   * (héroes, spots y relativos) independientemente del modo.
   * Devuelve todos los valores en mayúsculas para facilitar
   * comparaciones posteriores.
   * @returns {{heroes:string[], spots:string[], heroEligible:boolean, heroSelected:boolean, orSelected:boolean, vs3Selected:boolean, mode:string, quizState:string|null}}
   */
  function computeSelectionSnapshot() {
    const s = App.State.state;
    const heroes = (s.heroes && s.heroes.size > 0)
      ? Array.from(s.heroes)
      : (s.hero ? [s.hero] : []);
    const spots = (s.spots && s.spots.size > 0)
      ? Array.from(s.spots)
      : (s.spot ? [s.spot] : []);
    const heroUp = heroes
      .map(h => (h ? String(h).toUpperCase() : null))
      .filter(Boolean);
    const spotUp = spots
      .map(sp => (sp ? String(sp).toUpperCase() : null))
      .filter(Boolean);
    const heroSelected = heroUp.length > 0;
    const heroEligible = heroUp.some(h => h !== 'BB');
    const orSelected = spotUp.includes('OR');
    const vs3Selected = spotUp.includes('VS3BET');
    const mode = s.mode;
    const quizState = s.quiz ? s.quiz.state : null;
    return { heroes: heroUp, spots: spotUp, heroEligible, heroSelected, orSelected, vs3Selected, mode, quizState };
  }

  /**
   * Determina si estamos en la pantalla de configuración del quiz.
   * @param {string} mode
   * @param {string|null} quizState
   * @returns {boolean}
   */
  function isQuizConfig(mode, quizState) {
    return mode === 'QUIZ' && quizState === 'config';
  }

  /**
   * Sincroniza el flujo OR → 3B → IP/OOP asegurando que estado y
   * selecciones se mantengan coherentes entre modo normal y modo quiz.
   * Devuelve una nueva instantánea tras aplicar los ajustes.
   * @returns {ReturnType<typeof computeSelectionSnapshot>}
   */
  function syncControlFlow() {
    const s = App.State.state;
    let snap = computeSelectionSnapshot();
    const inQuizConfig = isQuizConfig(snap.mode, snap.quizState);

    if (!snap.heroSelected || !snap.heroEligible) {
      // Sin héroe elegible: reiniciar flujo completo.
      s.hasClickedOr = false;
      if (snap.mode === 'VISUALIZER') {
        s.spot = null;
      } else if (inQuizConfig && s.spots && typeof s.spots.delete === 'function') {
        s.spots.delete('OR');
        s.spots.delete('VS3BET');
      }
      s.relative = null;
      if (inQuizConfig && s.relatives && typeof s.relatives.clear === 'function') {
        s.relatives.clear();
      }
      return computeSelectionSnapshot();
    }

    // Si no hay OR ni 3B seleccionados y no se ha pulsado OR todavía,
    // garantizar que 3B quede deseleccionado.
    if (!snap.orSelected && !snap.vs3Selected && !s.hasClickedOr) {
      if (snap.mode === 'VISUALIZER') {
        s.spot = null;
      } else if (inQuizConfig && s.spots && typeof s.spots.delete === 'function') {
        s.spots.delete('VS3BET');
      }
      s.relative = null;
      if (inQuizConfig && s.relatives && typeof s.relatives.clear === 'function') {
        s.relatives.clear();
      }
    }

    // Si 3B no está activo, vaciar relativos para evitar selecciones
    // fantasma que se repliquen al volver a activar 3B.
    if (!snap.vs3Selected) {
      s.relative = null;
      if (inQuizConfig && s.relatives && typeof s.relatives.clear === 'function') {
        s.relatives.clear();
      }
    }

    // Si actualmente hay OR o 3B seleccionados, marcar el paso como
    // completado. Esto mantiene habilitado 3B incluso cuando se alterna
    // entre OR y VS3BET.
    if (snap.orSelected || snap.vs3Selected) {
      s.hasClickedOr = true;
    } else if (!snap.heroEligible) {
      s.hasClickedOr = false;
    }

    return computeSelectionSnapshot();
  }

  /**
   * Habilita o deshabilita los botones de filtros de rango según
   * el contexto actual. No aplica filtros durante el quiz activo.
   */
  function applyFilterAvailability() {
    const s = App.State.state;
    const r = App.Dom.refs;
    if (!r || !r.filterButtons) return;
    if (s.mode === 'QUIZ' && s.quiz.state === 'active') return;
    let enable = false;
    if (s.mode === 'VISUALIZER') {
      if (s.spot === 'OR') {
        enable = !!s.hero && !!s.spot;
      } else if (s.spot === 'VS3BET' || s.spot === 'VS5BET') {
        enable = !!s.relative || (!!s.hero && !!s.villain);
      }
    } else if (s.mode === 'QUIZ' && s.quiz.state === 'config') {
      if (s.spots.size === 0) {
        enable = false;
      } else {
        enable = true;
        s.spots.forEach(sp => {
          if (sp === 'OR') {
            if (!(s.heroes.size > 0)) enable = false;
          } else if (sp === 'VS3BET' || sp === 'VS5BET') {
            if (!(s.relatives.size > 0 || (s.heroes.size > 0 && s.villains.size > 0))) enable = false;
          }
        });
      }
    }
    r.filterButtons.forEach(btn => {
      if (enable) {
        btn.disabled = false;
        btn.classList.remove('disabled');
      } else {
        btn.disabled = true;
        btn.classList.add('disabled');
      }
    });
  }

  /**
   * Ajusta la clase action-unavailable en los botones de acción
   * deshabilitados para mostrar borde discontinuo. Se llama tras
   * updateActionButtons().
   */
  function applyActionAvailability() {
    const r = App.Dom.refs;
    if (!r || !r.actionButtons) return;
    r.actionButtons.forEach(btn => {
      if (btn.disabled) {
        btn.classList.add('action-unavailable');
      } else {
        btn.classList.remove('action-unavailable');
      }
    });
  }

  /**
   * Auto‑selecciona la posición relativa (IP/OOP) para el spot VS3BET
   * según la disponibilidad de combinaciones. Se invoca desde
   * updateMoveButtons() tanto en modo Visualizer como en la fase de
   * configuración del Quiz. Evalúa los rangos de VS3BET para las
   * selecciones de héroe y spot actuales, aplica filtros activos y
   * determina para cada lado (OOP/IP) cuántas combinaciones hay.
   * 
   * Comportamiento:
   * - Si ambos lados tienen combinaciones → ambos botones se habilitan y
   *   se conserva la selección existente. Si no hay selección previa, se
   *   mantiene sin seleccionar (el usuario puede elegir).
   * - Si sólo un lado tiene combinaciones → se selecciona automáticamente
   *   ese lado y el otro se deshabilita.
   * - Si ninguno tiene combinaciones → se deshabilitan ambos lados y se
   *   limpia la selección.
   * - En la fase de configuración (Quiz/config) se opera sobre los sets
   *   s.relatives; en visualizador se opera sobre s.relative.
   */
  function autoSelectRelativeForVs3bet() {
    const s = App.State.state;
    const refs = App.Dom.refs;
    if (!refs || !refs.relativeButtons) return;
    // Determinar si estamos en un contexto VS3BET
    const inVisualizerVs3 = (s.mode === 'VISUALIZER' && s.spot && s.spot.toUpperCase() === 'VS3BET');
    const inQuizConfigVs3 = (s.mode === 'QUIZ' && s.quiz.state === 'config' && ((s.spots && s.spots.has('VS3BET')) || s.spot === 'VS3BET'));
    if (!inVisualizerVs3 && !inQuizConfigVs3) {
      // Si no estamos en VS3BET limpiar deshabilitaciones y salir
      refs.relativeButtons.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('disabled');
      });
      // Tras ajustar el relativo en visualizador, actualizar las acciones disponibles
      if (App.Rules && App.Rules.updateActionButtons) {
        App.Rules.updateActionButtons();
        if (App.Rules.applyActionAvailability) App.Rules.applyActionAvailability();
      }
      return;
      // Tras ajustar relativo en quiz config, actualizar las acciones disponibles
      if (App.Rules && App.Rules.updateActionButtons) {
        App.Rules.updateActionButtons();
        if (App.Rules.applyActionAvailability) App.Rules.applyActionAvailability();
      }
    }
    // Helper para contar combinaciones para un héroe y un relativo
    function countCombosFor(hero, rel) {
      if (!hero) return 0;
      const mapping = App.Ranges.computeRangeMapping(hero, 'VS3BET', rel);
      let combos = Object.keys(mapping);
      combos = App.Ranges.applyFilters(combos);
      // Filtrar por acciones seleccionadas: si hay acciones, sólo contar las que coincidan
      if (s.actions && s.actions.size > 0) {
        combos = combos.filter(c => {
          const mv = mapping[c];
          const m = mv ? mv.toUpperCase() : '';
          return s.actions.has(m);
        });
      }
      return combos.length;
    }
    // Visualizer: evaluar un único héroe
    if (inVisualizerVs3) {
      const hero = s.hero;
      if (!hero) return;
      const countOop = countCombosFor(hero, 'OOP');
      const countIp  = countCombosFor(hero, 'IP');
      // Calcular disponibilidad para cada lado
      const hasOop = countOop > 0;
      const hasIp  = countIp  > 0;
      // Si ambos tienen combos → habilitar ambos; conservar s.relative si está en uno válido
      if (hasOop && hasIp) {
        refs.relativeButtons.forEach(btn => {
          btn.disabled = false;
          btn.classList.remove('disabled');
        });
        // Si no hay selección previa o la selección no es válida, no forzamos
        if (s.relative && (s.relative === 'OOP' || s.relative === 'IP')) {
          // Conservar selección actual
        } else {
          // No seleccionar automáticamente
          s.relative = null;
        }
      } else if (hasOop || hasIp) {
        // Sólo un lado tiene combos → seleccionarlo y deshabilitar el otro
        const chosen = hasOop ? 'OOP' : 'IP';
        s.relative = chosen;
        refs.relativeButtons.forEach(btn => {
          const rel = (btn.dataset.relative || '').toUpperCase();
          if (rel === chosen) {
            btn.disabled = false;
            btn.classList.remove('disabled');
            btn.classList.add('active');
            btn.classList.remove('off');
          } else {
            btn.disabled = true;
            btn.classList.add('disabled');
            btn.classList.remove('active');
            btn.classList.remove('off');
          }
        });
      } else {
        // Ninguno tiene combos → deshabilitar ambos y limpiar selección
        s.relative = null;
        refs.relativeButtons.forEach(btn => {
          btn.disabled = true;
          btn.classList.add('disabled');
          btn.classList.remove('active');
          btn.classList.remove('off');
        });
      }
      return;
    }
    // Quiz/config: evaluar varios héroes (s.heroes) y sets de spots
    if (inQuizConfigVs3) {
      // Construir lista de héroes (multiselección) y acciones
      const heroList = s.heroes && s.heroes.size > 0 ? Array.from(s.heroes) : (s.hero ? [s.hero] : []);
      if (heroList.length === 0) return;
      let totalOop = 0;
      let totalIp  = 0;
      heroList.forEach(hero => {
        totalOop += countCombosFor(hero, 'OOP');
        totalIp  += countCombosFor(hero, 'IP');
      });
      const hasOop = totalOop > 0;
      const hasIp  = totalIp  > 0;
      if (hasOop && hasIp) {
        // Ambos disponibles → habilitar ambos y conservar selección múltiple
        refs.relativeButtons.forEach(btn => {
          btn.disabled = false;
          btn.classList.remove('disabled');
        });
        // Conservar selección actual; si ninguna selección previa, no modificar
        if (s.relatives && s.relatives.size > 0) {
          // Filtrar selecciones inválidas
          const newSet = new Set();
          s.relatives.forEach(r => {
            if (r === 'OOP' || r === 'IP') newSet.add(r);
          });
          s.relatives = newSet;
        }
      } else if (hasOop || hasIp) {
        // Sólo un lado tiene combos → autoseleccionar ese lado
        const chosen = hasOop ? 'OOP' : 'IP';
        s.relatives.clear();
        s.relatives.add(chosen);
        refs.relativeButtons.forEach(btn => {
          const rel = (btn.dataset.relative || '').toUpperCase();
          if (rel === chosen) {
            btn.disabled = false;
            btn.classList.remove('disabled');
            btn.classList.add('active');
            btn.classList.remove('off');
          } else {
            btn.disabled = true;
            btn.classList.add('disabled');
            btn.classList.remove('active');
            btn.classList.remove('off');
          }
        });
      } else {
        // Ninguno disponible → limpiar selección y deshabilitar botones
        s.relatives.clear();
        refs.relativeButtons.forEach(btn => {
          btn.disabled = true;
          btn.classList.add('disabled');
          btn.classList.remove('active');
          btn.classList.remove('off');
        });
      }
    }
  }

  /**
   * Actualiza los botones de acción según el rango disponible.
   * En VISUALIZER se basan en el rango; en QUIZ/config se
   * habilitan todas las acciones; en QUIZ/activo se habilitan las
   * permitidas por la pregunta.
   */
  function updateActionButtons() {
    const s = App.State.state;
    const r = App.Dom.refs;
    if (!r || !r.actionButtons) return;
    // Gestionar los botones de acción en modo Quiz.
    if (s.mode === 'QUIZ') {
      // En configuración del quiz (selección de posiciones y spots) replicamos
      // la semántica del visualizador: hasta que no se selecciona al menos
      // una posición de héroe y un spot válido, los botones de acción
      // permanecen deshabilitados. Cuando hay varias selecciones, se
      // construye la unión de movimientos disponibles para todas las
      // combinaciones de héroe/spot/relativo.
      if (s.quiz.state === 'config') {
        // Recoger listas de héroes y spots seleccionados. Se permite
        // selección múltiple a través de los sets, o individual mediante
        // las propiedades simples.
        const heroList = (s.heroes && s.heroes.size > 0)
          ? Array.from(s.heroes)
          : (s.hero ? [s.hero] : []);
        const spotList = (s.spots && s.spots.size > 0)
          ? Array.from(s.spots)
          : (s.spot ? [s.spot] : []);
        // Determinar los relativos posibles. Si hay relativos explícitos
        // seleccionados, usarlos. En caso contrario, si hay villanos
        // seleccionados o un villano individual, deducir el relativo
        // usando autoguessRel para cada pareja héroe/villano.
        const relCandidates = new Set();
        if (s.relatives && s.relatives.size > 0) {
          s.relatives.forEach(rel => {
            if (rel) relCandidates.add(rel);
          });
        } else if (s.relative) {
          relCandidates.add(s.relative);
        } else {
          // Si no hay relativos definidos pero sí villanos, deducirlos
          const vilList = (s.villains && s.villains.size > 0)
            ? Array.from(s.villains)
            : (s.villain ? [s.villain] : []);
          heroList.forEach(h => {
            vilList.forEach(v => {
              const deduced = App.State.autoguessRel(h, v);
              if (deduced) relCandidates.add(deduced);
            });
          });
        }
        // Calcular el conjunto de movimientos disponibles combinando
        // todas las selecciones. Si no hay héroes o spots, permanecerá vacío.
        const allowed = new Set();
        heroList.forEach(h => {
          spotList.forEach(sp => {
            const spotUp = (sp || '').toUpperCase();
            if (spotUp === 'OR') {
              allowed.add('OR');
            } else if (spotUp === 'VS3BET') {
              // Para VS3BET se necesitan relativos; si no hay, no se suman
              if (relCandidates.size > 0) {
                relCandidates.forEach(rel => {
                  const mapping = App.Ranges.computeRangeMapping(h, spotUp, rel);
                  Object.values(mapping).forEach(mv => {
                    if (mv) allowed.add(String(mv).toUpperCase());
                  });
                });
              }
            }
            // VS5BET no tiene datos, se omite
          });
        });
        // Actualizar cada botón según allowed. Si el conjunto está vacío
        // (no hay héroes, spots o relativos adecuados), deshabilitar todos.
        r.actionButtons.forEach(btn => {
          const act = (btn.dataset.action || '').toUpperCase();
          if (allowed.size === 0) {
            btn.disabled = true;
            btn.classList.add('disabled');
            btn.classList.remove('active');
            s.actions.delete(act);
          } else {
            if (allowed.has(act)) {
              btn.disabled = false;
              btn.classList.remove('disabled');
            } else {
              btn.disabled = true;
              btn.classList.add('disabled');
              btn.classList.remove('active');
              s.actions.delete(act);
            }
          }
        });
        applyActionAvailability();
        return;
      }
      // Gestionar el estado activo del Quiz. Cuando el quiz está en marcha se
      // recalculan los movimientos permitidos para la pregunta actual y se
      // habilitan únicamente esos botones. Si todavía no hay pregunta
      // establecida, todos permanecen deshabilitados. Esto evita que
      // updateQuestionActionButtons se invoque con s.quiz.currentQuestion
      // undefined y garantiza que los botones se actualicen de inmediato tras
      // cargar una nueva consigna.
      if (s.quiz.state === 'active') {
        // Obtener movimientos permitidos para la pregunta actual usando el
        // helper de Quiz. En caso de error, dejar el set vacío para que
        // todos los botones queden deshabilitados.
        let allowedMoves = new Set();
        try {
          if (App && App.Quiz && typeof App.Quiz.getAllowedMovesForCurrentQuestion === 'function') {
            allowedMoves = App.Quiz.getAllowedMovesForCurrentQuestion(s);
          }
        } catch (err) {
          if (typeof console !== 'undefined' && console.warn) console.warn('Error obteniendo movimientos permitidos en quiz activo', err);
          allowedMoves = new Set();
        }
        // Si no se obtuvieron movimientos permitidos desde Quiz, usar los definidos
        // en la consigna actual (propiedad allowedMoves de la pregunta), que se
        // establece en las consignas de Full Range. Esto evita que los botones
        // queden deshabilitados en freebet cuando getAllowedMovesForCurrentQuestion
        // devuelve un conjunto vacío.
        if ((!allowedMoves || allowedMoves.size === 0) && s.quiz && s.quiz.currentQuestion) {
          const q = s.quiz.currentQuestion;
          if (q && Array.isArray(q.allowedMoves) && q.allowedMoves.length > 0) {
            allowedMoves = new Set(q.allowedMoves.map(mv => String(mv).toUpperCase()));
          }
        }
        // Como última alternativa en consignas FULLRANGE, derivar los movimientos
        // permitidos de expectedMoveByCombo: unir todos los valores definidos.
        if ((!allowedMoves || allowedMoves.size === 0) && s.quiz && s.quiz.currentQuestion) {
          const q2 = s.quiz.currentQuestion;
          if (q2 && q2.expectedMoveByCombo && typeof q2.expectedMoveByCombo === 'object') {
            const set = new Set();
            Object.values(q2.expectedMoveByCombo).forEach(val => {
              if (val) set.add(String(val).toUpperCase());
            });
            if (set.size > 0) allowedMoves = set;
          }
        }
        // Normalizar movimientos permitidos a etiquetas de botón (data-action)
        const normalizeToButtonTag = mv => {
          const m = String(mv || '').trim().toUpperCase();
          if (m === 'FOLD' || m === 'F') return 'F';
          if (m === 'CALL' || m === 'C') return 'C';
          if (m === 'BET' || m === 'OR' || m === 'RAISE' || m === 'OPEN') return 'OR';
          if (m === 'ROL' || m === 'ISORAISE') return 'ROL';
          if (m === '3BET' || m === '3B') return '3B';
          if (m === 'SQUEEZE' || m === 'SQZ' || m === 'SQ') return 'SQZ';
          if (m === '4BET' || m === '4B') return '4B';
          if (m === '5BETPLUS' || m === '5BET+' || m === '5BET' || m === '5B' || m === '5B+' || m === '5BPLUS') return '5B';
          if (m === 'ALLIN' || m === 'ALL') return 'ALL';
          return null;
        };
        const allowedTags = new Set();
        if (allowedMoves && allowedMoves.size > 0) {
          allowedMoves.forEach(mv => {
            const tag = normalizeToButtonTag(mv);
            if (tag) allowedTags.add(tag.toUpperCase());
          });
        }
        // Si no se han determinado movimientos permitidos, deshabilitar todos los botones
        // y vaciar el conjunto de acciones activas.
        if (allowedTags.size === 0) {
          r.actionButtons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
            btn.classList.remove('active');
          });
          // Vaciar el set de acciones permitidas para reflejar que no hay ninguna opción
          if (s.actions && typeof s.actions.clear === 'function') {
            s.actions.clear();
          }
        } else {
          // Actualizar s.actions para que contenga exactamente los tags permitidos.
          if (s.actions && typeof s.actions.clear === 'function') {
            s.actions.clear();
            allowedTags.forEach(tag => {
              s.actions.add(tag.toUpperCase());
            });
          }
          // Recorre cada botón de acción y ajusta su disponibilidad según allowedTags
          r.actionButtons.forEach(btn => {
            const act = (btn.dataset.action || '').toUpperCase();
            if (allowedTags.has(act)) {
              btn.disabled = false;
              btn.classList.remove('disabled');
            } else {
              btn.disabled = true;
              btn.classList.add('disabled');
              btn.classList.remove('active');
            }
          });
        }
        // Aplicar la clase CSS de indisponibilidad según los estados de disabled
        applyActionAvailability();
        // Si la acción actualmente seleccionada (s.brush) deja de estar permitida,
        // seleccionar la primera acción permitida para evitar que quede un pincel inválido.
        if (s.brush && (allowedTags.size === 0 || !allowedTags.has(String(s.brush).toUpperCase()))) {
          const first = Array.from(allowedTags)[0] || null;
          s.brush = first;
          if (App.Paint && typeof App.Paint.refreshBrushSelection === 'function') {
            try { App.Paint.refreshBrushSelection(); } catch (err) {}
          }
        }
        return;
      }
      // En estados finished, fails-ready u otros, se habilitan todas
      // las acciones para permitir la interacción (ej. reset, fail run)
      if (s.quiz.state !== 'idle' && s.quiz.state !== 'config') {
        r.actionButtons.forEach(btn => {
          btn.disabled = false;
          btn.classList.remove('disabled');
        });
        applyActionAvailability();
        return;
      }
    }
    const avail = new Set();
    if (s.hero && s.spot) {
      if (s.spot === 'OR') {
        avail.add('OR');
      } else if (s.spot === 'VS3BET') {
        const mapping = App.Ranges.computeRangeMapping(s.hero, s.spot, s.relative);
        Object.values(mapping).forEach(mv => avail.add(mv.toUpperCase()));
      }
    }
    r.actionButtons.forEach(btn => {
      const act = (btn.dataset.action || '').toUpperCase();
      if (avail.size === 0) {
        btn.disabled = true;
        btn.classList.add('disabled');
        btn.classList.remove('active');
        s.actions.delete(act);
      } else {
        if (avail.has(act)) {
          btn.disabled = false;
          btn.classList.remove('disabled');
        } else {
          btn.disabled = true;
          btn.classList.add('disabled');
          btn.classList.remove('active');
          s.actions.delete(act);
        }
      }
    });
    applyActionAvailability();
  }

  /**
   * Habilita las acciones permitidas por la pregunta actual en el
   * quiz activo y desactiva el resto. También ajusta el pincel
   * seleccionado si deja de estar permitido.
   */
  function updateQuestionActionButtons() {
    const s = App.State.state;
    const r = App.Dom.refs;
    if (s.mode !== 'QUIZ' || s.quiz.state !== 'active') return;
    const q = s.quiz.currentQuestion;
    if (!q || !q.tags) return;
    const tags = q.tags.map(t => t.toUpperCase());
    const heroTag = tags.find(t => ['UTG','MP','CO','BTN','SB','BB'].includes(t));
    let spotTag = tags.find(t => ['OR','VS3BET','VS5BET'].includes(t));
    if (!spotTag && tags.includes('BET')) spotTag = 'OR';
    let relTag = tags.find(t => ['IP','OOP'].includes(t));
    let allowedMoves;
    if (!heroTag || !spotTag) {
      allowedMoves = new Set(Object.keys(s.palette));
    } else {
      if (!relTag && spotTag === 'VS3BET') {
        const movesSet = new Set();
        ['IP','OOP'].forEach(relVal => {
          const map = App.Ranges.computeRangeMapping(heroTag, spotTag, relVal);
          Object.values(map).forEach(mv => movesSet.add(mv.toUpperCase()));
        });
        allowedMoves = movesSet;
      } else {
        const map = App.Ranges.computeRangeMapping(heroTag, spotTag, relTag || null);
        const movesSet = new Set();
        Object.values(map).forEach(mv => movesSet.add(mv.toUpperCase()));
        allowedMoves = movesSet;
      }
    }
    if (!allowedMoves || allowedMoves.size === 0) {
      allowedMoves = new Set(Object.keys(s.palette));
    }
    // Normalizar movimientos permitidos a etiquetas de botón (F,C,OR,ROL,3B,SQZ,4B,5B,ALL)
    const normalizeToButtonTag = mv => {
      const m = String(mv || '').trim().toUpperCase();
      if (m === 'FOLD') return 'F';
      if (m === 'CALL') return 'C';
      if (m === 'BET' || m === 'OR') return 'OR';
      if (m === 'ROL') return 'ROL';
      if (m === '3BET') return '3B';
      if (m === 'SQUEEZE') return 'SQZ';
      if (m === '4BET') return '4B';
      if (m === '5BETPLUS' || m === '5BET+' || m === '5BET') return '5B';
      if (m === 'ALLIN') return 'ALL';
      return null;
    };
    const normalizedAllowed = new Set();
    allowedMoves.forEach(mv => {
      const tag = normalizeToButtonTag(mv);
      if (tag) normalizedAllowed.add(tag);
    });
    // Si no se derivó nada, permitir todas las acciones disponibles en la paleta
    if (normalizedAllowed.size === 0) {
      Object.keys(s.palette).forEach(tag => normalizedAllowed.add(tag.toUpperCase()));
    }
    r.actionButtons.forEach(btn => {
      const act = (btn.dataset.action || '').toUpperCase();
      if (normalizedAllowed.has(act)) {
        btn.disabled = false;
        btn.classList.remove('disabled');
      } else {
        btn.disabled = true;
        btn.classList.add('disabled');
        if (s.actions.has(act)) {
          s.actions.delete(act);
          btn.classList.remove('active');
        }
      }
    });
    // Ajustar el pincel si la acción actual deja de estar permitida
    if (s.brush && !normalizedAllowed.has(String(s.brush).toUpperCase())) {
      const first = Array.from(normalizedAllowed)[0] || null;
      s.brush = first;
    }
    App.Paint.refreshBrushSelection();
  }

  /**
   * Controla la disponibilidad de los botones de spot (OR/VS3BET/VS5BET)
   * según la selección de héroe y si ya se hizo clic en OR. En QUIZ
   * se evalúan selecciones múltiples.
   */
  function updateMoveButtons() {
    const s = App.State.state;
    const r = App.Dom.refs;
    if (!r || !r.moveButtons) return;
    const snapshot = syncControlFlow();
    const orBtn  = r.moveButtons.find(b => (b.dataset.filter || '').toUpperCase() === 'OR');
    const vs3Btn = r.moveButtons.find(b => (b.dataset.filter || '').toUpperCase() === 'VS3BET');
    const vs5Btn = r.moveButtons.find(b => (b.dataset.filter || '').toUpperCase() === 'VS5BET');
    const heroEligible = snapshot.heroEligible;
    const heroSelected = snapshot.heroSelected;
    const orSelected = snapshot.orSelected;
    const vs3Selected = snapshot.vs3Selected;
    const orUnlocked = heroEligible && s.hasClickedOr;
    const inQuizConfig = isQuizConfig(snapshot.mode, snapshot.quizState);

    if (snapshot.mode === 'VISUALIZER') {
      if (orBtn) {
        orBtn.classList.remove('active', 'off', 'disabled');
        if (!heroSelected || !heroEligible) {
          orBtn.disabled = true;
          orBtn.classList.add('disabled');
        } else {
          orBtn.disabled = false;
          if (orSelected || vs3Selected) {
            orBtn.classList.add('active');
          } else {
            orBtn.classList.add('off');
          }
        }
      }
      if (vs3Btn) {
        vs3Btn.classList.remove('active', 'off', 'disabled');
        if (!orUnlocked) {
          vs3Btn.disabled = true;
          vs3Btn.classList.add('disabled');
        } else {
          vs3Btn.disabled = false;
          if (vs3Selected) {
            vs3Btn.classList.add('active');
          } else {
            vs3Btn.classList.add('off');
          }
        }
      }
      if (vs5Btn) {
        vs5Btn.classList.remove('active', 'off', 'disabled');
        vs5Btn.disabled = true;
        vs5Btn.classList.add('disabled');
      }
      autoSelectRelativeForVs3bet();
      applyFilterAvailability();
      return;
    }

    if (inQuizConfig) {
      if (orBtn) {
        orBtn.classList.remove('active', 'off', 'disabled');
        if (!heroSelected || !heroEligible) {
          orBtn.disabled = true;
          orBtn.classList.add('disabled');
        } else {
          orBtn.disabled = false;
          if (orSelected || vs3Selected) {
            orBtn.classList.add('active');
          } else {
            orBtn.classList.add('off');
          }
        }
      }
      if (vs3Btn) {
        vs3Btn.classList.remove('active', 'off', 'disabled');
        if (!orUnlocked) {
          vs3Btn.disabled = true;
          vs3Btn.classList.add('disabled');
          if (s.spots && typeof s.spots.delete === 'function') {
            s.spots.delete('VS3BET');
          }
        } else {
          vs3Btn.disabled = false;
          if (vs3Selected) {
            vs3Btn.classList.add('active');
          } else {
            vs3Btn.classList.add('off');
          }
        }
      }
      if (vs5Btn) {
        vs5Btn.classList.remove('active', 'off', 'disabled');
        vs5Btn.disabled = true;
        vs5Btn.classList.add('disabled');
        if (s.spots && typeof s.spots.delete === 'function') {
          s.spots.delete('VS5BET');
        }
      }
      autoSelectRelativeForVs3bet();
    }
  }

  /**
   * Actualiza la disponibilidad de los botones de héroe y villano
   * evitando la selección simultánea de la misma posición. En
   * VISUALIZER aplica gating exclusivo; en QUIZ/config permite
   * selecciones múltiples con restricciones de orden.
   */
  function updateHeroVillainButtons() {
    const s = App.State.state;
    const r = App.Dom.refs;
    if (!r || !r.heroButtons) return;
    syncControlFlow();
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
        heroOff = new Set(App.State.POS_ORDER);
        villainDisabled = new Set(App.State.POS_ORDER);
      } else if (spot === 'OR') {
        heroOff = new Set(App.State.POS_ORDER);
        villainDisabled = new Set(App.State.POS_ORDER);
      } else {
        if (!hero) {
          heroOff = new Set(App.State.POS_ORDER);
          villainDisabled = new Set(App.State.POS_ORDER);
        } else {
          const hIdx = App.State.POS_ORDER.indexOf(hero);
          if (relative) {
            if (relative === 'IP') {
              App.State.POS_ORDER.forEach((pos, idx) => {
                if (idx < hIdx && pos !== hero) villainOff.add(pos);
                else villainDisabled.add(pos);
              });
            } else if (relative === 'OOP') {
              App.State.POS_ORDER.forEach((pos, idx) => {
                if (idx > hIdx && pos !== hero) villainOff.add(pos);
                else villainDisabled.add(pos);
              });
            }
          } else {
            App.State.POS_ORDER.forEach(pos => {
              if (pos !== hero) villainOff.add(pos);
            });
            villainDisabled.add(hero);
          }
          if (villain) {
            const vIdx = App.State.POS_ORDER.indexOf(villain);
            let relVal = relative;
            if (!relVal) {
              relVal = App.State.autoguessRel(hero, villain);
              s.relative = relVal;
            }
            if (relVal === 'IP') {
              App.State.POS_ORDER.forEach((pos, idx) => {
                if (idx > vIdx && pos !== villain) heroOff.add(pos);
                else heroDisabled.add(pos);
              });
            } else if (relVal === 'OOP') {
              App.State.POS_ORDER.forEach((pos, idx) => {
                if (idx < vIdx && pos !== villain) heroOff.add(pos);
                else heroDisabled.add(pos);
              });
            }
            if (hero && heroDisabled.has(hero)) {
              s.hero = null;
            }
            if (villain && villainDisabled.has(villain)) {
              s.villain = null;
            }
          } else {
            App.State.POS_ORDER.forEach(pos => heroOff.add(pos));
          }
        }
      }
      App.Paint.paintButtons(r.heroButtons, { activePos: s.hero, disabledSet: heroDisabled, offSet: heroOff });
      App.Paint.paintButtons(r.villainButtons, { activePos: s.villain, disabledSet: villainDisabled, offSet: villainOff });
      let relDisabled = new Set();
      let relOff = new Set();
      if (!spot || spot === 'OR' || !hero) {
        relDisabled.add('IP');
        relDisabled.add('OOP');
      } else {
        if (villain) {
          const relVal = s.relative || App.State.autoguessRel(hero, villain);
          s.relative = relVal;
          ['IP','OOP'].forEach(rn => {
            if (rn === relVal) {
              // active later
            } else {
              relOff.add(rn);
            }
          });
        } else {
          const hIdx2 = App.State.POS_ORDER.indexOf(hero);
          let ipPossible = false;
          let oopPossible = false;
          App.State.POS_ORDER.forEach((pos, idx) => {
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
      if (s.relative && relDisabled.has(s.relative)) {
        s.relative = null;
      }
      App.Paint.paintButtons(r.relativeButtons, { activePos: s.relative, disabledSet: relDisabled, offSet: relOff });
      applyFilterAvailability();
      updateMoveButtons();
      updateActionButtons();
      applyActionAvailability();
      return;
    }
    if (s.mode === 'QUIZ' && s.quiz.state === 'config') {
      const heroDisabled = new Set();
      const villainDisabled = new Set();
      const shouldDisableVillain = pos => {
        if (s.heroes.size === 0) return true;
        if (s.heroes.has(pos)) return true;
        const posIdx = App.State.POS_ORDER.indexOf(pos);
        for (const h of s.heroes) {
          const hIdx = App.State.POS_ORDER.indexOf(h);
          if (posIdx <= hIdx) return true;
        }
        return false;
      };
      const shouldDisableHero = pos => {
        if (s.villains.size === 0) return false;
        if (s.villains.has(pos)) return true;
        const posIdx = App.State.POS_ORDER.indexOf(pos);
        for (const v of s.villains) {
          const vIdx = App.State.POS_ORDER.indexOf(v);
          if (posIdx >= vIdx) return true;
        }
        return false;
      };
      App.State.POS_ORDER.forEach(pos => {
        if (shouldDisableHero(pos)) heroDisabled.add(pos);
        if (shouldDisableVillain(pos)) villainDisabled.add(pos);
      });
      const heroOff = new Set();
      const villainOff = new Set();
      App.State.POS_ORDER.forEach(pos => {
        if (!heroDisabled.has(pos)) heroOff.add(pos);
        if (!villainDisabled.has(pos)) villainOff.add(pos);
      });
      App.Paint.paintButtons(r.heroButtons, { activePos: null, disabledSet: heroDisabled, offSet: heroOff });
      r.heroButtons.forEach(btn => {
        const pos = btn.dataset.hero;
        if (s.heroes.has(pos)) {
          btn.classList.add('active');
          btn.disabled = false;
        }
      });
      App.Paint.paintButtons(r.villainButtons, { activePos: null, disabledSet: villainDisabled, offSet: villainOff });
      r.villainButtons.forEach(btn => {
        const pos = btn.dataset.villain;
        if (s.villains.has(pos)) {
          btn.classList.add('active');
          btn.disabled = false;
        }
      });
      const needsRel = s.spots.has('VS3BET') || s.spots.has('VS5BET');
      const relDisabled2 = new Set();
      const relOff2 = new Set();
      ['IP','OOP'].forEach(rn => {
        if (needsRel) {
          if (s.relatives.has(rn)) {
            // active later
          } else {
            relOff2.add(rn);
          }
        } else {
          relDisabled2.add(rn);
        }
      });
      App.Paint.paintButtons(r.relativeButtons, { activePos: null, disabledSet: relDisabled2, offSet: relOff2 });
      r.relativeButtons.forEach(btn => {
        const rel = btn.dataset.relative;
        if (s.relatives.has(rel)) {
          btn.classList.add('active');
          btn.disabled = false;
        }
      });
      applyFilterAvailability();
      updateMoveButtons();
      updateActionButtons();
      applyActionAvailability();
      return;
    }
  }

  /**
   * Maneja el clic sobre una celda en el quiz activo. Valida que
   * el pincel y la combinación sean correctos, gestiona pintura y
   * avanza la pregunta si se completó.
   * @param {HTMLTableCellElement} td
   */
  function handleQuizCellClick(td) {
    const s = App.State.state;
    if (s.mode !== 'QUIZ' || s.quiz.state !== 'active') return;
    if (!s.brush) return;
    const combo = td.dataset.label;
    const r = App.Dom.refs;
    if (s.fullRange.enabled) {
      if (!s.fullRange.targets.includes(combo)) {
        td.style.transition = 'background-color 0.2s';
        td.style.backgroundColor = '#640404';
        setTimeout(() => App.Paint.refreshGrid(), 300);
        return;
      }
      const brushTag = s.brush ? String(s.brush).toUpperCase() : null;
      if (!brushTag) return;
      const q = s.quiz.currentQuestion || {};
      const allowedSet = new Set();
      if (q && Array.isArray(q.allowedMoves)) {
        q.allowedMoves.forEach(mv => {
          if (mv) allowedSet.add(String(mv).toUpperCase());
        });
      }
      const expectedMap = s.quiz.expectedMoveByCombo || {};
      const expected = expectedMap ? expectedMap[combo] : undefined;
      let validBrush = false;
      if (typeof expected === 'string' && expected) {
        validBrush = brushTag === String(expected).toUpperCase();
      } else if (expected === null) {
        validBrush = allowedSet.size === 0 || allowedSet.has(brushTag);
      } else {
        validBrush = allowedSet.size === 0 || allowedSet.has(brushTag);
      }
      if (!validBrush) {
        td.style.transition = 'background-color 0.2s';
        td.style.backgroundColor = '#640404';
        setTimeout(() => App.Paint.refreshGrid(), 300);
        return;
      }
      s.undoStack.push(JSON.parse(JSON.stringify(s.userPaint)));
      const existing = s.userPaint[combo];
      const existingKey = existing ? Object.keys(existing)[0] : null;
      const existingTag = existingKey ? String(existingKey).toUpperCase() : null;
      if (existing && existingTag === brushTag && existing[existingKey] === 100) {
        delete s.userPaint[combo];
        if (s.quiz.correctSet) s.quiz.correctSet.delete(combo);
      } else {
        s.userPaint[combo] = {};
        s.userPaint[combo][brushTag] = 100;
        if (s.quiz.correctSet) s.quiz.correctSet.add(combo);
      }
      App.Paint.refreshGrid();
      App.Paint.updateComboCounters();
      App.Paint.updateFullRangeProgress();
      applyFilterAvailability();
      return;
    }
    const required = s.quiz.currentAction || null;
    if (required && s.brush.toUpperCase() !== required.toUpperCase()) {
      td.style.transition = 'background-color 0.2s';
      td.style.backgroundColor = '#640404';
      setTimeout(() => App.Paint.refreshGrid(), 300);
      return;
    }
    const targets = s.quiz.targetCombos || [];
    if (targets.length > 0 && !targets.includes(combo)) {
      td.style.transition = 'background-color 0.2s';
      td.style.backgroundColor = '#640404';
      setTimeout(() => App.Paint.refreshGrid(), 300);
      return;
    }
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
    App.Paint.refreshGrid();
    App.Paint.updateComboCounters();
    if (targets && s.quiz.correctSet && s.quiz.correctSet.size === targets.length) {
      if (App.Quiz && App.Quiz.nextQuestion) App.Quiz.nextQuestion();
    }
  }

  // Exportar reglas
  App.Rules.applyFilterAvailability = applyFilterAvailability;
  App.Rules.applyActionAvailability = applyActionAvailability;
  App.Rules.updateActionButtons = updateActionButtons;
  App.Rules.updateQuestionActionButtons = updateQuestionActionButtons;
  App.Rules.updateMoveButtons = updateMoveButtons;
  App.Rules.updateHeroVillainButtons = updateHeroVillainButtons;
  App.Rules.handleQuizCellClick = handleQuizCellClick;
  App.Rules.syncControlFlow = syncControlFlow;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));