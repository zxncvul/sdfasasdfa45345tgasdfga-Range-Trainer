/*
 * app.quiz.js
 *
 * Este módulo implementa el flujo completo del modo Quiz. Permite
 * entrar en configuración, construir el conjunto de preguntas a partir de
 * las selecciones del usuario, iniciar y detener un quiz, avanzar
 * preguntas, gestionar segundas vueltas y tandas de fallos, así como
 * actualizar la barra de control. También registra todos los
 * manejadores de eventos sobre los elementos de la interfaz.
 */

;(function (global) {
  'use strict';
  const App = global.App = global.App || {};
  App.Quiz = App.Quiz || {};

  /**
   * Baraja un array in‑place usando Fisher–Yates. Devuelve el mismo
   * array reordenado al azar.
   * @param {Array} arr
   * @returns {Array}
   */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Comprueba si una combinación es de par (dos cartas del mismo valor).
   * En la notación de rangos se representan con dos caracteres (AA, KK…).
   * @param {string} combo
   * @returns {boolean}
   */
  function isPairCombo(combo) {
    return typeof combo === 'string' && combo.length === 2;
  }

  /**
   * Comprueba si una combinación es suited. Se considera suited si tiene
   * exactamente tres caracteres y termina en 's'. Las parejas no son suited.
   * @param {string} combo
   * @returns {boolean}
   */
  function isSuitedCombo(combo) {
    return typeof combo === 'string' && combo.length === 3 && /s$/i.test(combo);
  }

  /**
   * Comprueba si una combinación es offsuit. Se considera offsuit si tiene
   * tres caracteres y termina en 'o' o si es una pareja (dos caracteres).
   * Esto permite que las parejas pasen el filtro de offsuit, tal como se
   * requiere en la aplicación.
   * @param {string} combo
   * @returns {boolean}
   */
  function isOffsuitCombo(combo) {
    if (typeof combo !== 'string') return false;
    if (combo.length === 2) return true; // parejas cuentan como offsuited
    return combo.length === 3 && /o$/i.test(combo);
  }

  /**
   * Convierte un carácter de rango a un índice numérico para poder
   * comprobar conectores. Los ases se tratan como 14, reyes 13, etc.
   * @param {string} r
   * @returns {number}
   */
  function rankValue(r) {
    const order = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
                    '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    return order[r] || 0;
  }

  /**
   * Determina si una combinación es un conector (las dos cartas son adyacentes).
   * No se consideran conectores los pares ni la combinación AK. El orden
   * de las letras en el string no importa (AKo o KAo no son conectores).
   * @param {string} combo
   * @returns {boolean}
   */
  /**
   * Determina si una combinación es un conector. En la definición de la
   * aplicación, sólo se consideran conectores aquellos pares de rangos
   * adyacentes en la zona media del mazo (T9, 98, 87, 76, 65, 54, 43, 32),
   * tanto en orden directo como inverso. No se consideran conectores los
   * pares ni la combinación AK. Los conectores de broadway (KQ, QJ, JT) se consideran válidos.
   * @param {string} combo
   * @returns {boolean}
   */
  function isConnectorCombo(combo) {
    // Determina si una combinación es un conector. Incluye AK/KA y broadways además de los conectores numéricos.
    if (typeof combo !== 'string' || combo.length < 2) return false;
    const a = combo[0].toUpperCase();
    const b = combo[1].toUpperCase();
    // Excluir pares
    if (a === b) return false;
    const pair = a + b;
    // Conjunto de conectores válidos incluyendo AK y todos los adyacentes (broadways y numéricos)
    const connectors = new Set([
      'AK','KA',
      'KQ','QK','QJ','JQ','JT','TJ',
      'T9','9T','98','89','87','78','76','67','65','56','54','45','43','34','32','23'
    ]);
    return connectors.has(pair);
  }

  /**
   * Comprueba si una combinación encaja en una clase de rango dada.
   * Los tags como 'KX' significan cualquier mano que contenga una K.
   * Los tags simples como 'K' significan lo mismo. Si la etiqueta no
   * corresponde a este formato devuelve false.
   * @param {string} combo
   * @param {string} tag
   * @returns {boolean}
   */
  function matchesRankClassCombo(combo, tag) {
    if (typeof combo !== 'string' || typeof tag !== 'string') return false;
    const t = tag.toUpperCase();
    // Aceptar AX, KX, QX, etc.
    if (/^[2-9TJQKA]X$/.test(t)) {
      const r = t[0];
      return combo.includes(r);
    }
    // Aceptar A, K, Q, etc. simples
    if (/^[2-9TJQKA]$/.test(t)) {
      return combo.includes(t);
    }
    return false;
  }

  /**
   * Normaliza un movimiento a la forma utilizada en el estado y en las
   * preguntas. Por ejemplo 'BET' y 'OR' se normalizan a 'OR', '5BET+'
   * a '5BETPLUS'. Si el movimiento no se reconoce se devuelve null.
   * @param {string} mv
   * @returns {string|null}
   */
  function normalizeMove(mv) {
    if (!mv) return null;
    const m = String(mv).trim().toUpperCase();
    if (m === 'FOLD') return 'FOLD';
    if (m === 'CALL') return 'CALL';
    // Agrupar sinónimos de OR (bet, raise, open, etc.)
    if (m === 'BET' || m === 'OR' || m === 'RAISE' || m === 'OPEN') return 'OR';
    // Sinónimos de ROL: ROL, ISORAISE
    if (m === 'ROL' || m === 'ISORAISE') return 'ROL';
    // 3BET abreviado
    if (m === '3BET' || m === '3B') return '3BET';
    // Squeeze abreviado
    if (m === 'SQUEEZE' || m === 'SQZ' || m === 'SQ') return 'SQUEEZE';
    // 4BET abreviado
    if (m === '4BET' || m === '4B') return '4BET';
    // 5BETPLUS y sus alias
    if (m === '5BETPLUS' || m === '5BET+' || m === '5BET' || m === '5B' || m === '5B+' || m === '5BPLUS') return '5BETPLUS';
    // ALL IN
    if (m === 'ALLIN' || m === 'ALL') return 'ALLIN';
    // Limp y overl limp
    if (m === 'LIMP') return 'LIMP';
    if (m === 'OVERLIMP') return 'OVERLIMP';
    return null;
  }

  /**
   * Obtiene la lista de combinaciones válidas para una pregunta, cruzando
   * los tags de la pregunta con los rangos definidos en rangos.js, el
   * héroe, spot y relativo indicados y los filtros activos. También se
   * comprueba que las combinaciones correspondan a la acción correcta
   * (si se especifica).
   *
   * @param {string[]} qTags Etiquetas de la pregunta (mayúsculas)
   * @param {string|null} hero Posición del héroe (UTG, MP…)
   * @param {string|null} spot Spot (OR o VS3BET)
   * @param {string|null} relative Relativo (IP u OOP) o null
   * @param {Object} filters Filtros activos del estado (ranks: Set, suited, offsuited, pair)
   * @param {string|null} action Acción normalizada de la pregunta (FOLD, CALL, OR…)
   * @returns {string[]} Lista de combos válidos
   */
  function getValidCombosForQuestion(qTags, hero, spot, relative, filters, action) {
    const combos = [];
    if (!hero || !spot) return combos;
    // Obtener mapeo de rangos
    let mapping = {};
    try {
      mapping = App.Ranges.computeRangeMapping(hero, spot, relative);
    } catch (err) {
      mapping = {};
    }
    if (!mapping || typeof mapping !== 'object') return combos;
    // Determinar restricciones de los tags de la pregunta
    const tags = Array.isArray(qTags) ? qTags.map(t => String(t).toUpperCase()) : [];
    const wantSuited   = tags.includes('SUITED');
    const wantOffsuit = tags.includes('OFFSUITED');
    const wantPair    = tags.includes('PAIR');
    // Evitar parejas sólo cuando NO_PAIR está presente y NO se pide OFFSUITED (las parejas cuentan como offsuited)
    const avoidPair   = tags.includes('NO_PAIR') && !tags.includes('OFFSUITED');
    const wantConn    = tags.includes('CONNECTORS');
    // Determinar tags de rango (AX, KX o letras sueltas)
    const rankTags    = tags.filter(t => (/^[2-9TJQKA]X$/.test(t) || /^[2-9TJQKA]$/.test(t)));
    // Excluir conectores sólo cuando se especifica NO_CONNECTORS y no hay tags de rango
    const avoidConn   = tags.includes('NO_CONNECTORS') && rankTags.length === 0;
    // Iterar sobre todas las combinaciones del mapeo
    for (const c of Object.keys(mapping)) {
      // Primera capa: restricciones de etiquetas del dataset
      if (wantSuited && !isSuitedCombo(c)) continue;
      if (wantOffsuit && !isOffsuitCombo(c)) continue;
      if (wantPair && !isPairCombo(c)) continue;
      if (avoidPair && isPairCombo(c)) continue;
      const isConn = isConnectorCombo(c);
      if (wantConn && !isConn) continue;
      if (avoidConn && isConn) continue;
      if (rankTags.length > 0) {
        let ok = false;
        for (const rt of rankTags) {
          if (matchesRankClassCombo(c, rt)) { ok = true; break; }
        }
        if (!ok) continue;
      }
      // Segunda capa: filtros de UI
      if (filters) {
        const { ranks, suited, offsuited, pair } = filters;
        if (ranks && ranks.size > 0) {
          let okRank = false;
          for (const r of ranks) {
            const R = String(r).toUpperCase();
            if (c.includes(R)) { okRank = true; break; }
          }
          if (!okRank) continue;
        }
        if (suited && !isSuitedCombo(c)) continue;
        if (offsuited && !isOffsuitCombo(c)) continue;
        if (pair && !isPairCombo(c)) continue;
      }
      // Tercera capa: acción correcta
      if (action) {
        const mv = mapping[c];
        const norm = normalizeMove(mv);
        if (!norm || norm !== action) continue;
      }
      combos.push(c);
    }
    return combos;
  }

  /**
   * Calcula los movimientos disponibles en la configuración actual del quiz.
   *
   * Durante la fase de configuración del quiz (modo 'QUIZ' con estado 'config'),
   * los botones de acción deben reflejar únicamente las opciones reales que
   * existen para las posiciones de héroe, spots y relativos seleccionados.
   * Esta función examina todas las combinaciones de héroes, spots y relativos
   * seleccionados y acumula los movimientos presentes en los rangos
   * correspondientes mediante App.Ranges.computeRangeMapping(). El listado se
   * normaliza a los identificadores de botón (F, C, OR, ROL, 3B, SQZ, 4B,
   * 5B, ALL) de forma consistente con updateActionButtons().
   *
   * Si no hay héroes o spots seleccionados se devuelve un Set vacío.
   *
   * @param {Object} state Estado global App.State.state
   * @returns {Set<string>} Conjunto de movimientos permitidos (normalizados)
   */
  function getAvailableMovesForConfig(state) {
    const avail = new Set();
    if (!state) return avail;
    // Obtener lista de héroes seleccionados en config (o hero singular)
    const heroList = state.heroes && state.heroes.size > 0
      ? Array.from(state.heroes)
      : (state.hero ? [state.hero] : []);
    // Obtener lista de spots seleccionados en config (o spot singular)
    const spotList = state.spots && state.spots.size > 0
      ? Array.from(state.spots)
      : (state.spot ? [state.spot] : []);
    // Obtener lista de relativos seleccionados (o relativo singular). Si no hay relativos,
    // deducirlos a partir de villanos utilizando autoguessRel para cada combinación de
    // héroe y villano. Esto permite seleccionar VS3BET + villanos sin marcar IP/OOP.
    let relList;
    if (state.relatives && state.relatives.size > 0) {
      relList = Array.from(state.relatives);
    } else if (state.relative) {
      relList = [state.relative];
    } else {
      // Deducción automática: obtener lista de villanos seleccionados
      const vilList = (state.villains && state.villains.size > 0)
        ? Array.from(state.villains)
        : (state.villain ? [state.villain] : []);
      const guessed = new Set();
      heroList.forEach(h => {
        vilList.forEach(v => {
          const rel = (global.App && global.App.State && typeof global.App.State.autoguessRel === 'function')
            ? global.App.State.autoguessRel(String(h).toUpperCase(), String(v).toUpperCase())
            : null;
          if (rel) guessed.add(rel);
        });
      });
      relList = guessed.size > 0 ? Array.from(guessed) : [];
    }
    if (heroList.length === 0 || spotList.length === 0) return avail;
    // Utiliza normalizeMove() para traducir los movimientos del mapeo a los nombres de acción
    function toActionName(mv) {
      return normalizeMove(mv);
    }
    heroList.forEach(hero => {
      spotList.forEach(spot => {
        const sp = String(spot || '').toUpperCase();
        if (sp === 'OR') {
          // En OR sólo hay una acción
          avail.add('OR');
        } else if (sp === 'VS3BET') {
          // Para VS3BET, combinar relativos; si no hay relativos seleccionados, usar ambos
          const rels = relList.length > 0 ? relList : ['OOP', 'IP'];
          rels.forEach(rel => {
            const mapping = (global.App && global.App.Ranges && global.App.Ranges.computeRangeMapping)
              ? global.App.Ranges.computeRangeMapping(hero, 'VS3BET', rel)
              : {};
            if (mapping && typeof mapping === 'object') {
              Object.values(mapping).forEach(mv => {
                const act = toActionName(mv);
                if (act) avail.add(act);
              });
            }
          });
        }
      });
    });
    return avail;
  }

  /**
   * Calcula los movimientos permitidos para la pregunta actual del quiz.
   *
   * Durante la ejecución del quiz (estado 'active'), cada pregunta tiene
   * asociada una posición de héroe, un spot (OR o VS3BET) y, en su caso,
   * una posición relativa. Para determinar qué botones de acción deben
   * habilitarse, se recalcula el mapeo de rangos para los tags de la
   * pregunta mediante App.Ranges.computeRangeMapping() y se extraen todas
   * las acciones únicas presentes. De este modo los jugadores sólo pueden
   * elegir entre movimientos realmente disponibles para la situación descrita.
   *
   * @param {Object} state Estado global App.State.state
   * @returns {Set<string>} Conjunto de movimientos permitidos (normalizados)
   */
  function getAllowedMovesForCurrentQuestion(state) {
    const allowed = new Set();
    if (!state || !state.quiz || !state.quiz.currentQuestion) return allowed;
    const q = state.quiz.currentQuestion;

// Freebet: si la pregunta es de tipo FULLRANGE y define allowedMoves, devolverlas directamente
if (q && q.kind === 'FULLRANGE' && Array.isArray(q.allowedMoves)) {
  const tmp = new Set();
  q.allowedMoves.forEach(mv => {
    if (typeof mv === 'string') tmp.add(mv.toUpperCase());
  });
  return tmp;
}
    const tags = Array.isArray(q.tags) ? q.tags.map(t => String(t).toUpperCase()) : [];
    // Determinar spot: prioridad VS3BET > VS5BET > OR/BET
    let spot;
    if (tags.includes('VS3BET')) spot = 'VS3BET';
    else if (tags.includes('VS5BET')) spot = 'VS5BET';
    else spot = 'OR';
    // Hallar héroe
    const hero = tags.find(t => ['UTG','MP','CO','BTN','SB','BB'].includes(t));
    if (!hero || !spot) return allowed;
    // Normalización de acciones a nombres de acción
    function toActionName(mv) {
      return normalizeMove(mv);
    }
    if (spot === 'OR') {
      // Preguntas de OR siempre tienen como única acción OR
      allowed.add('OR');
    } else if (spot === 'VS3BET' || spot === 'VS5BET') {
      // Para VS3BET y VS5BET, si la etiqueta no especifica IP/OOP, combinar ambos relativos
      const relative = tags.find(t => ['IP','OOP'].includes(t));
      const rels = relative ? [relative] : ['OOP', 'IP'];
      rels.forEach(rel => {
        const mapping = (global.App && global.App.Ranges && global.App.Ranges.computeRangeMapping)
          ? global.App.Ranges.computeRangeMapping(hero, spot, rel)
          : {};
        if (mapping && typeof mapping === 'object') {
          Object.values(mapping).forEach(mv => {
            const act = toActionName(mv);
            if (act) allowed.add(act);
          });
        }
      });
    }
    return allowed;
  }

  /**
   * Actualiza las clases y estados de los botones de filtro (números, suited/off/pair y Full Range)
   * según las selecciones actuales. Este método implementa la convención de colores global:
   * - Activo (seleccionado) → clase .active (texto verde)
   * - Habilitado no seleccionado → clase .off (texto rojo)
   * - Deshabilitado → clase .disabled (texto verde oscuro)
   * Cuando Full Range está seleccionado, todos los demás filtros se desactivan y muestran
   * color rojo. Cuando Full Range está desactivado, si no hay ningún rango o suit marcado,
   * se consideran todos activos por defecto.
   */
  function updateFilterButtonClasses() {
    const s = App.State.state;
    const refs = App.Dom.refs;
    if (!refs || !refs.filterButtons) return;
    // Encontrar los botones correspondientes
    const fullBtn = refs.filterButtons.find(b => (b.dataset.filter || '').toUpperCase() === 'FULLRANGE');
    const rankBtns = refs.filterButtons.filter(b => /^[2-9TJQKA]$/.test((b.dataset.filter || '').toUpperCase()));
    const suitedBtn = refs.filterButtons.find(b => (b.dataset.filter || '').toUpperCase() === 'SUITED');
    const offBtn = refs.filterButtons.find(b => (b.dataset.filter || '').toUpperCase() === 'OFFSUITED');
    const pairBtn = refs.filterButtons.find(b => (b.dataset.filter || '').toUpperCase() === 'PAIR');
    // Reset helper
    const resetBtnClasses = (btn) => {
      btn.classList.remove('active', 'off', 'disabled');
      btn.disabled = false;
    };
    // Determinar disponibilidad de Full Range
    let enableFullRange = false;
    // En el visualizador el botón de Full Range permanece siempre deshabilitado.
    // Esto respeta el requisito de que Full Range solo funcione en modo Quiz.
    if (s.mode === 'VISUALIZER') {
      enableFullRange = false;
    } else if (s.mode === 'QUIZ' && s.quiz.state === 'config') {
      // En modo Quiz/config, sólo habilitar el botón si hay al menos una
      // posición de héroe seleccionada y al menos un spot seleccionado.
      const heroList = s.heroes && s.heroes.size > 0 ? Array.from(s.heroes)
                       : (s.hero ? [s.hero] : []);
      const spotList = s.spots && s.spots.size > 0 ? Array.from(s.spots)
                       : (s.spot ? [s.spot] : []);
      enableFullRange = heroList.length > 0 && spotList.length > 0;
    }
    if (s.fullRange.enabled) {
      // FullRange activo
      if (fullBtn) {
        resetBtnClasses(fullBtn);
        fullBtn.classList.add('active');
      }
      // Otros filtros desactivados y en rojo
      [...rankBtns, suitedBtn, offBtn, pairBtn].forEach(btn => {
        if (!btn) return;
        resetBtnClasses(btn);
        btn.classList.add('off');
        btn.disabled = true;
      });
    } else {
      // FullRange no activo
      if (fullBtn) {
        resetBtnClasses(fullBtn);
        if (enableFullRange) {
          fullBtn.classList.add('off');
        } else {
          fullBtn.classList.add('disabled');
          fullBtn.disabled = true;
        }
      }
      // Ranks: respetar el estado disabled configurado en applyFilterAvailability().
      const rankSet = s.filters.ranks;
      const noRanks = rankSet.size === 0;
      rankBtns.forEach(btn => {
        const wasDisabled = btn.disabled;
        resetBtnClasses(btn);
        // Si estaba deshabilitado previamente (no hay héroe/spot), mantenerlo deshabilitado
        if (wasDisabled) {
          btn.disabled = true;
          btn.classList.add('disabled');
          return;
        }
        const f = (btn.dataset.filter || '').toUpperCase();
        if (noRanks || rankSet.has(f)) {
          btn.classList.add('active');
        } else {
          btn.classList.add('off');
        }
      });
      // Suits
      const anySuit = s.filters.suited || s.filters.offsuited || s.filters.pair;
      // Suited
      if (suitedBtn) {
        const wasDisabled = suitedBtn.disabled;
        resetBtnClasses(suitedBtn);
        if (wasDisabled) {
          suitedBtn.disabled = true;
          suitedBtn.classList.add('disabled');
        } else {
          if (!anySuit || s.filters.suited) {
            suitedBtn.classList.add('active');
          } else {
            suitedBtn.classList.add('off');
          }
        }
      }
      // Offsuited
      if (offBtn) {
        const wasDisabled = offBtn.disabled;
        resetBtnClasses(offBtn);
        if (wasDisabled) {
          offBtn.disabled = true;
          offBtn.classList.add('disabled');
        } else {
          if (!anySuit || s.filters.offsuited) {
            offBtn.classList.add('active');
          } else {
            offBtn.classList.add('off');
          }
        }
      }
      // Pair
      if (pairBtn) {
        const wasDisabled = pairBtn.disabled;
        resetBtnClasses(pairBtn);
        if (wasDisabled) {
          pairBtn.disabled = true;
          pairBtn.classList.add('disabled');
        } else {
          if (!anySuit || s.filters.pair) {
            pairBtn.classList.add('active');
          } else {
            pairBtn.classList.add('off');
          }
        }
      }
    }
  }

  /**
   * Limpia los filtros activos antes de iniciar o reiniciar el quiz.
   * Durante la configuración se permite usar el teclado numérico y los
   * filtros de suits para acotar el conjunto de preguntas, pero una vez
   * comenzada la tanda deben mostrarse todas las columnas del teclado para
   * evitar que queden ocultas por selecciones previas.
   */
  function resetRuntimeFilters() {
    const s = App.State.state;
    if (!s || !s.filters) return;
    try {
      if (s.filters.ranks && typeof s.filters.ranks.clear === 'function') {
        s.filters.ranks.clear();
      }
      s.filters.suited = false;
      s.filters.offsuited = false;
      s.filters.pair = false;
      if (App.Rules && typeof App.Rules.applyFilterAvailability === 'function') {
        App.Rules.applyFilterAvailability();
      }
      updateFilterButtonClasses();
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('resetRuntimeFilters failed:', err);
      }
    }
  }

  /**
   * Calcula y actualiza el contador de preguntas disponibles en el panel superior
   * durante la configuración del quiz. Considera si Full Range está activado y
   * utiliza el dataset para contar preguntas filtradas. El texto resultante
   * se muestra como "NNN Qs".
   */
  async function updateQuestionCounter() {
    const s = App.State.state;
    const refs = App.Dom.refs;
    if (!refs || !refs.quizCounter) return;
    if (s.mode !== 'QUIZ' || s.quiz.state !== 'config') {
      refs.quizCounter.textContent = '';
      return;
    }
    let total = 0;
    const heroList = s.heroes.size > 0 ? Array.from(s.heroes) : (s.hero ? [s.hero] : []);
    const spotList = s.spots.size > 0 ? Array.from(s.spots) : (s.spot ? [s.spot] : []);
    const relList = s.relatives.size > 0 ? Array.from(s.relatives) : (s.relative ? [s.relative] : []);
    if (s.fullRange.enabled) {
      if (heroList.length > 0 && spotList.length > 0) {
        const rels = relList.length > 0 ? relList : [null];
        rels.forEach(rel => {
          heroList.forEach(hero => {
            spotList.forEach(spot => {
              if (spot.toUpperCase() === 'VS5BET') return;
              const mapping = App.Ranges.computeRangeMapping(hero, spot, rel);
              let combos = Object.keys(mapping);
              combos = App.Ranges.applyFilters(combos);
              const targets = combos.filter(c => {
                const move = mapping[c];
                const mv = move ? move.toUpperCase() : '';
                return s.actions.size === 0 || s.actions.has(mv);
              });
              if (targets.length > 0) total++;
            });
          });
        });
      }
    } else {
      await loadQuestions();
      let pool = [];
      if (s.fullRange && s.fullRange.enabled) {
        pool = buildFreebetPool();
      } else {
        pool = buildQuizPool();
      }
      total = pool.length;
    }
    refs.quizCounter.textContent = `${String(total).padStart(3, '0')} Qs`;
  }

  /**
   * Carga los ficheros de preguntas sólo una vez. Combina
   * questions.json y questions_vs3bet.json en un único array
   * almacenado en state.allQuestions.
   */
  async function loadQuestions() {
    const s = App.State.state;
    // Evitar recargar si ya se han cargado ambos datasets
    if (Array.isArray(s.questionsTags) && s.questionsTags.length > 0 && Array.isArray(s.questionsVs3bet) && s.questionsVs3bet.length > 0) {
      return;
    }
    // Intentar primero usar las variables globales generadas por questions-data.js.
    try {
      if (Array.isArray(window.__QUESTIONS__) && Array.isArray(window.__QUESTIONS_VS3BET__)) {
        s.questionsTags = window.__QUESTIONS__.slice();
        s.questionsVs3bet = window.__QUESTIONS_VS3BET__.slice();
        return;
      }
    } catch (e) {
      // Si falla (por ejemplo en tests), se continuará con fetch
    }
    // Fallback: cargar mediante fetch los ficheros JSON
    try {
      const resp1 = await fetch('questions_tags.json');
      const tags = await resp1.json();
      const resp2 = await fetch('questions_vs3bet.json');
      const vs = await resp2.json();
      s.questionsTags = Array.isArray(tags) ? tags : [];
      s.questionsVs3bet = Array.isArray(vs) ? vs : [];
    } catch (err) {
      console.error('Error al cargar las preguntas:', err);
      s.questionsTags = [];
      s.questionsVs3bet = [];
    }
  }

  /**
   * Construye el pool de preguntas a partir de las selecciones del
   * usuario. Filtra por héroes, spots, relativos, acciones y
   * filtros de rango (ranks, suited, offsuited, pair). Los tags
   * 'BET' se tratan como 'OR' y '5BET+' como '5BETPLUS'. Las
   * preguntas de VS5BET se ignoran por no existir datos. Devuelve
   * un array de preguntas aptas para el quiz.
   * @returns {Array}
   */
  function buildQuizPool() {
    const s = App.State.state;
    const pool = [];
    // Asegurar que los datasets estén cargados; si no, devolver vacío
    if (!Array.isArray(s.questionsTags) || !Array.isArray(s.questionsVs3bet)) {
      return pool;
    }
    // Preparar listas de selección. Si el conjunto está vacío se
    // usan las selecciones singulares.
    const heroList = s.heroes.size > 0 ? Array.from(s.heroes) : (s.hero ? [s.hero] : []);
    const spotList = s.spots.size > 0 ? Array.from(s.spots) : (s.spot ? [s.spot] : []);
    const relList  = s.relatives.size > 0 ? Array.from(s.relatives) : (s.relative ? [s.relative] : []);
    const actionSet = new Set(Array.from(s.actions).map(a => a.toUpperCase()));
    // Conjuntos de acciones prioritarias según el contexto. Se usa
    // para extraer la acción de la pregunta de modo coherente con
    // respuestas a 3bet frente a movimientos iniciales.
    const primaryActions = ['FOLD','LIMP','OVERLIMP','CALL','ROL','3BET','SQUEEZE','4BET','5BETPLUS','ALLIN','5BET+'];
    const secondaryActions = ['BET','OR'];
    // Seleccionar el dataset adecuado según las selecciones de spot. Si al menos
    // una selección de spot es VS3BET, utilizamos únicamente el dataset de
    // preguntas VS3BET. En caso contrario se utiliza exclusivamente el
    // dataset de preguntas de OR (questions_tags.json). Nunca mezclamos.
    let dataSource;
    if (spotList.length > 0) {
      let hasVs3 = false;
      for (const sp of spotList) {
        if (String(sp).toUpperCase() === 'VS3BET') {
          hasVs3 = true;
          break;
        }
      }
      dataSource = hasVs3 ? s.questionsVs3bet : s.questionsTags;
    } else if (s.spot) {
      const spUpper = String(s.spot).toUpperCase();
      dataSource = spUpper === 'VS3BET' ? s.questionsVs3bet : s.questionsTags;
    } else {
      // Si no hay spots seleccionados, no hay preguntas
      return pool;
    }
    // Recorrer cada pregunta y comprobar si tiene al menos una combinación
    // válida en alguno de los héroes, spots y relativos seleccionados. Se
    // excluyen las preguntas de VS5BET. Sólo se añaden preguntas con
    // combinaciones dentro de los rangos de rangos.js, respetando tags,
    // filtros y la acción correcta. Además se filtra por héroes, spots,
    // relativos y acciones antes de buscar combos para evitar trabajo
    // innecesario.
    preguntaLoop:
    for (const q of dataSource) {
      const tags = (q.tags || []).map(t => t.toUpperCase());
      // Omitir preguntas de VS5BET (sin datos de rangos)
      if (tags.includes('VS5BET')) continue;
      // Filtrar héroes: si hay héroes seleccionados, la pregunta debe
      // contener al menos uno de ellos entre sus tags
      if (heroList.length > 0) {
        let okHero = false;
        for (const h of heroList) {
          if (tags.includes(String(h).toUpperCase())) {
            okHero = true;
            break;
          }
        }
        if (!okHero) continue;
      }
      // Filtrar spots: la pregunta debe contener el spot elegido
      if (spotList.length > 0) {
        let okSpot = false;
        for (const sp of spotList) {
          const spUpper = String(sp).toUpperCase();
          if (spUpper === 'OR') {
            if (tags.includes('OR') || tags.includes('BET')) {
              okSpot = true;
              break;
            }
          } else if (spUpper === 'VS3BET') {
            if (tags.includes('VS3BET')) {
              okSpot = true;
              break;
            }
          }
        }
        if (!okSpot) continue;
      }
      // Filtrar relativos: si el usuario ha elegido relativos, la
      // pregunta debe tener alguno de ellos entre sus tags. Para
      // preguntas OR no hay relativo.
      if (relList.length > 0) {
        // Si la pregunta es de OR, ignorar el filtro de relativo
        if (tags.includes('VS3BET')) {
          let okRel = false;
          for (const r of relList) {
            if (tags.includes(String(r).toUpperCase())) {
              okRel = true;
              break;
            }
          }
          if (!okRel) continue;
        }
      }
      // Filtrar por acción: si el usuario seleccionó acciones en config
      let qAction = null;
      {
        // Buscar acción en tags por prioridad
        const act = tags.find(t => primaryActions.includes(t)) || tags.find(t => secondaryActions.includes(t));
        if (act) {
          let norm = String(act).toUpperCase();
          if (norm === 'BET') norm = 'OR';
          if (norm === '5BET+') norm = '5BETPLUS';
          qAction = norm;
        }
      }
      if (actionSet.size > 0) {
        if (!qAction || !actionSet.has(qAction)) {
          continue;
        }
      }
      // Ahora comprobar si existen combinaciones válidas para al menos
      // una combinación de héroe, spot y relativo seleccionados.
      // Preparar lista de posibles relativos en función de pregunta y selección.
      for (const hero of (heroList.length > 0 ? heroList : [tags.find(t => ['UTG','MP','CO','BTN','SB','BB'].includes(t))])) {
        if (!hero) continue;
        for (const spot of (spotList.length > 0 ? spotList : [tags.includes('VS3BET') ? 'VS3BET' : 'OR'])) {
          const spUpper = String(spot).toUpperCase();
          if (spUpper !== 'OR' && spUpper !== 'VS3BET') continue;
          // Determinar los relativos a probar. Para VS3BET los tags de la pregunta
          // pueden tener 'IP' u 'OOP'. Si no tienen relativo y el usuario no ha
          // seleccionado relativos, probar ambos.
          let relsToTry = [];
          if (spUpper === 'VS3BET') {
            if (relList.length > 0) {
              relsToTry = relList;
            } else {
              const tagRel = tags.find(t => t === 'IP' || t === 'OOP');
              if (tagRel) {
                relsToTry = [tagRel];
              } else {
                relsToTry = ['OOP','IP'];
              }
            }
          } else {
            relsToTry = [null];
          }
          for (const rel of relsToTry) {
            const combos = getValidCombosForQuestion(tags, String(hero).toUpperCase(), spUpper, rel ? String(rel).toUpperCase() : null, s.filters, qAction);
            if (combos && combos.length > 0) {
              pool.push(q);
              continue preguntaLoop;
            }
          }
        }
      }
    }
    return pool;
  }

  /**
   * Muestra la pregunta actual según el índice del pool. Calcula la
   * acción correcta de la pregunta, prepara el conjunto de
   * combinaciones objetivo y restablece la pintura. También
   * actualiza el contador de preguntas y los contadores de combos.
   */
  function showQuestion() {
    const s = App.State.state;
    const refs = App.Dom.refs;
    const pool = s.quiz.pool;
    const idx = s.quiz.idx;
    if (!pool || pool.length === 0 || idx >= pool.length) {
      finishQuiz();
      return;
    }
    const q = pool[idx];
    s.quiz.currentQuestion = q;

    // Antes de procesar la consigna, actualizar botones de acción permitidos según la
    // nueva pregunta y elegir un pincel válido. Esto garantiza que los botones
    // disponibles se muestren correctamente para consignas VS3BET/VS5BET sin relativo
    // y que el pincel siempre apunte a un movimiento permitido.
    try {
      if (App.Rules && typeof App.Rules.updateActionButtons === 'function') {
        App.Rules.updateActionButtons();
        if (App.Rules.applyActionAvailability) App.Rules.applyActionAvailability();
      }
      const allowedMoves = App.Quiz.getAllowedMovesForCurrentQuestion(App.State.state);
      if (allowedMoves && allowedMoves.size > 0) {
        const current = s.brush ? String(s.brush).toUpperCase() : null;
        let hasCurrent = false;
        allowedMoves.forEach(m => { if (m && m.toUpperCase() === current) hasCurrent = true; });
        if (!hasCurrent) {
          const first = Array.from(allowedMoves)[0];
          s.brush = first;
        }
        // Refrescar pincel visible si existe helper
        if (App.Paint && typeof App.Paint.refreshBrushSelection === 'function') {
          App.Paint.refreshBrushSelection();
        }
      }
    } catch (ex) {
      // Silenciar errores para no interrumpir el flujo
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Error refrescando botones/pincel en showQuestion()', ex);
      }
    }

// Modo Freebet / Full Range: configurar rango completo y acciones permitidas
if (q && q.kind === 'FULLRANGE') {
  // No hay acción única a imponer
  s.quiz.currentAction = null;
  // Preparar estado fullRange con los objetivos de la consigna
  s.fullRange.enabled = true;
  s.fullRange.targets = Array.isArray(q.targetCombos) ? q.targetCombos.slice() : [];
  s.fullRange.total = s.fullRange.targets.length;
  s.fullRange.ok = 0;
  s.fullRange.extras = 0;
  // Guardar mapping esperado de acción por combo
  s.quiz.expectedMoveByCombo = q.expectedMoveByCombo || {};
  // Copiar combos objetivo en quiz.targetCombos para compatibilidad
  s.quiz.targetCombos = Array.isArray(q.targetCombos) ? q.targetCombos.slice() : [];
  s.quiz.correctSet = new Set();
  s.quiz.fails = [];
  s.quiz.questionFailed = false;
  // Ajustar pincel: seleccionar el primero de los movimientos permitidos si el actual no es válido.
  // allowedMoves en consignas FULLRANGE contiene los nombres de acción tal y como aparecen en data-action (FOLD, CALL, OR, etc.).
  if (Array.isArray(q.allowedMoves) && q.allowedMoves.length > 0) {
    const allowedSet = new Set(q.allowedMoves.map(v => String(v).toUpperCase()));
    if (!s.brush || !allowedSet.has(String(s.brush).toUpperCase())) {
      s.brush = q.allowedMoves[0];
    }
  }
  // Mostrar enunciado
  if (refs.quizQuestion) refs.quizQuestion.textContent = String(q.label || '').replace(/\"/g, '"').replace(/^"|"$/g, '');
  // Actualizar contador de preguntas
  const total = s.quiz.total || pool.length;
  const done = s.quiz.done;
  if (refs.quizCounter) refs.quizCounter.textContent = `${String(done).padStart(3, '0')}/${String(total).padStart(3, '0')}`;
  // Limpiar pintura y refrescar interfaz
  App.State.resetUserPaint();
  App.Paint.refreshGrid();
  App.Paint.resetQuizToggleToQuestion();
  updateProgressIndicator();
  App.Paint.updateComboCounters();
  // Refrescar pincel visible
  if (App.Paint && typeof App.Paint.refreshBrushSelection === 'function') App.Paint.refreshBrushSelection();
  // Actualizar botones de acción permitidos
  if (App.Rules && typeof App.Rules.updateActionButtons === 'function') {
    App.Rules.updateActionButtons();
    if (App.Rules.applyActionAvailability) App.Rules.applyActionAvailability();
  }
  return;
}
    // Calcular acción correcta
    const possibleActions = ['FOLD','LIMP','OVERLIMP','CALL','BET','OR','ROL','3BET','SQUEEZE','4BET','5BETPLUS','ALLIN','5BET+'];
    let qAction = (q.tags || []).find(t => possibleActions.includes(t.toUpperCase()));
    let normalized = null;
    if (qAction) {
      normalized = qAction.toUpperCase();
      if (normalized === 'BET') normalized = 'OR';
      if (normalized === '5BET+') normalized = '5BETPLUS';
    }
    s.quiz.currentAction = normalized;
    // Actualizar botones de acción permitidos
    App.Rules.updateActionButtons();
    App.Rules.applyActionAvailability();
    // Calcular combinaciones objetivo cruzando con rangos reales y filtros
    const tags = (q.tags || []).map(t => t.toUpperCase());
    // Determinar héroe, spot y relativo de la propia pregunta
    const heroTag = tags.find(t => ['UTG','MP','CO','BTN','SB','BB'].includes(t)) || null;
    let spotTag;
    if (tags.includes('VS3BET')) spotTag = 'VS3BET';
    else if (tags.includes('VS5BET')) spotTag = 'VS5BET';
    else spotTag = 'OR';
    let relTag = tags.find(t => ['IP','OOP'].includes(t)) || null;
    // Para VS3BET sin relativo explícito, considerar ambos para los combos
    let allCombos = [];
    if (spotTag === 'VS3BET') {
      const rels = relTag ? [relTag] : ['OOP','IP'];
      for (const r of rels) {
        const cs = getValidCombosForQuestion(tags, heroTag, spotTag, r, s.filters, s.quiz.currentAction);
        allCombos = allCombos.concat(cs);
      }
    } else if (spotTag === 'OR') {
      const cs = getValidCombosForQuestion(tags, heroTag, spotTag, null, s.filters, s.quiz.currentAction);
      allCombos = allCombos.concat(cs);
    } else {
      allCombos = [];
    }
    // Eliminar duplicados
    s.quiz.targetCombos = Array.from(new Set(allCombos));
    s.quiz.correctSet = new Set();
    s.quiz.fails = [];
    s.quiz.questionFailed = false;
    // Mostrar enunciado
    if (refs.quizQuestion) refs.quizQuestion.textContent = String(q.label).replace(/\\"/g, '"').replace(/^"|"$/g, '');
    // Actualizar contador de preguntas
    const total = s.quiz.total || pool.length;
    const done = s.quiz.done;
    if (refs.quizCounter) refs.quizCounter.textContent = `${String(done).padStart(3, '0')}/${String(total).padStart(3, '0')}`;
    // Limpiar pintura
    App.State.resetUserPaint();
    // Renderizar grid y contadores
    App.Paint.refreshGrid();
    App.Paint.resetQuizToggleToQuestion();
    updateProgressIndicator();
    App.Paint.updateComboCounters();
  }

  /**
   * Avanza a la siguiente pregunta del pool. Incrementa el contador
   * de hechas y muestra la siguiente o finaliza si no hay más.
   */
  function nextQuestion() {
    const s = App.State.state;
    s.quiz.done++;
    s.quiz.idx++;
    if (!s.quiz.pool || s.quiz.idx >= s.quiz.pool.length) {
      finishQuiz();
    } else {
      showQuestion();
    }
  }

  /**
   * Actualiza el texto del botón de reset según si estamos en
   * estado fails-ready (2ª vuelta completada). En otros casos
   * muestra simplemente "RESET". No cambia estilos, eso lo hace
   * applyQuizBarState().
   */
  function updateProgressIndicator() {
    const s = App.State.state;
    const refs = App.Dom.refs;
    if (!refs || !refs.quizReset) return;
    if (s.quiz.state === 'fails-ready') {
      refs.quizReset.textContent = 'RESET FAILS';
      refs.quizReset.disabled = false;
      refs.quizReset.classList.remove('disabled');
    } else {
      refs.quizReset.textContent = 'RESET';
    }
  }

  /**
   * Finaliza la segunda vuelta del quiz. Coloca el estado en
   * 'fails-ready' y muestra los contadores. Oculta el enunciado y
   * prepara el botón "RESET FAILS".
   */
  function finishSecondRun() {
    const s = App.State.state;
    const refs = App.Dom.refs;
    s.quiz.state = 'fails-ready';
    // Limpiar enunciado y contador de preguntas
    if (refs.quizQuestion) refs.quizQuestion.textContent = '';
    if (refs.quizCounter) refs.quizCounter.textContent = '';
    // Cambiar vista al contador de combos
    App.Paint.resetQuizToggleToCounters();
    updateProgressIndicator();
    applyQuizBarState('finished');
  }

  /**
   * Comienza una nueva tanda sólo con las preguntas falladas en las
   * dos vueltas anteriores. Si no hay preguntas falladas se emite
   * un aviso y no se inicia nada.
   */
  function startFailRun() {
    const s = App.State.state;
    const refs = App.Dom.refs;
    if (!s.failPoolTotal || s.failPoolTotal.size === 0) {
      alert('No hay preguntas falladas.');
      return;
    }
    s.quiz.pool = Array.from(s.failPoolTotal);
    shuffle(s.quiz.pool);
    s.failPool = new Set();
    s.quiz.idx = 0;
    s.quiz.done = 0;
    s.quiz.total = s.quiz.pool.length;
    s.quiz.state = 'active';
    s.secondRun = false;
    s.questionFailed = false;
    // Limpiar pintura y pincel
    App.State.resetUserPaint();
    s.brush = null;
    resetRuntimeFilters();
    App.Rules.updateActionButtons();
    App.Rules.applyActionAvailability();
    App.Paint.resetQuizToggleToQuestion();
    updateProgressIndicator();
    applyQuizBarState('running');
    showQuestion();
  }

  /**
   * Inicia el quiz a partir del estado de configuración actual. Si
   * no hay preguntas disponibles se muestra un aviso. Reinicia
   * contadores y prepara la primera pregunta.
   */
  async function startQuiz() {
    const s = App.State.state;
    if (s.quiz.state !== 'config') return;
    await loadQuestions();
    let pool = [];
    // Si Full Range está habilitado en la configuración del quiz, usar pool de rangos completos
    if (s.fullRange && s.fullRange.enabled) {
      pool = buildFreebetPool();
    } else {
      pool = buildQuizPool();
    }
    if (!pool || pool.length === 0) {
      alert('No se han encontrado preguntas con la configuración actual.');
      return;
    }
    // Barajar únicamente cuando no estamos en modo Full Range. En el modo Full Range
    // el orden de las consignas sigue el orden de héroes y spots definido en buildFreebetPool().
    if (!(s.fullRange && s.fullRange.enabled)) {
      shuffle(pool);
    }
    s.quiz.pool = pool;
    s.quiz.idx = 0;
    s.quiz.done = 0;
    s.quiz.total = pool.length;
    s.quiz.state = 'active';
    s.quiz.currentQuestion = null;
    s.quiz.currentAction = null;
    s.quiz.targetCombos = [];
    s.quiz.correctSet = new Set();
    s.quiz.fails = [];
    s.failPool = new Set();
    s.failPoolTotal = new Set();
    s.secondRun = false;
    s.questionFailed = false;
    // Reiniciar pincel y pintura
    App.State.resetUserPaint();
    s.brush = null;
    // Limpiar filtros usados durante la configuración para restaurar el teclado numérico completo
    resetRuntimeFilters();
    // Actualizar interfaz
    App.Paint.resetQuizToggleToQuestion();
    updateProgressIndicator();
    applyQuizBarState('running');
    App.Rules.updateActionButtons();
    App.Rules.applyActionAvailability();
    // Disable configuration controls while the quiz is running. Guard against
    // undefined App.UI in case the UI module has not defined the helper.
    try {
      if (App && App.UI && typeof App.UI.setConfigDisabled === 'function') {
        App.UI.setConfigDisabled(true);
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Failed to disable config controls:', e);
      }
    }
    showQuestion();
    // Tras mostrar la primera pregunta, volver a actualizar los botones de acción
    // para que se habiliten según los movimientos permitidos de la consigna. Sin esta
    // actualización inmediata, los botones pueden permanecer deshabilitados hasta que
    // ocurra otro evento.
    try {
      if (App && App.Rules && typeof App.Rules.updateActionButtons === 'function') {
        App.Rules.updateActionButtons();
        if (App.Rules.applyActionAvailability) App.Rules.applyActionAvailability();
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Error refrescando botones de acción tras showQuestion()', e);
      }
    }
  }

  /**
   * Finaliza el quiz. Si es la primera vuelta y existen preguntas
   * falladas se inicia una segunda vuelta sólo con esas preguntas.
   * Si ya es segunda vuelta, se pasa a fails-ready. Si no hay
   * fallos se marca como finished.
   */
  function finishQuiz() {
    const s = App.State.state;
    // Registrar fallo de la pregunta actual si procede
    if (s.quiz.currentQuestion && s.quiz.targetCombos) {
      // Considerar como fallada si no se pintaron todas las combos
      if (s.quiz.correctSet && s.quiz.correctSet.size !== s.quiz.targetCombos.length) {
        s.failPool.add(s.quiz.currentQuestion);
        s.failPoolTotal.add(s.quiz.currentQuestion);
      }
    }
    if (!s.secondRun) {
      if (s.failPool && s.failPool.size > 0) {
        // Preparar segunda vuelta con fallos
        s.quiz.pool = Array.from(s.failPool);
        shuffle(s.quiz.pool);
        s.failPoolTotal = new Set([...s.failPoolTotal, ...s.failPool]);
        s.failPool = new Set();
        s.quiz.idx = 0;
        s.quiz.done = 0;
        s.quiz.total = s.quiz.pool.length;
        s.quiz.state = 'active';
        s.secondRun = true;
        s.questionFailed = false;
        // Limpiar pintura y pincel
        App.State.resetUserPaint();
        s.brush = null;
        App.Rules.updateActionButtons();
    App.Rules.applyActionAvailability();
        App.Paint.resetQuizToggleToQuestion();
        updateProgressIndicator();
        applyQuizBarState('running');
        showQuestion();
        return;
      }
      // No hay fallos en primera vuelta
      s.quiz.state = 'finished';
      App.Paint.resetQuizToggleToCounters();
      updateProgressIndicator();
      applyQuizBarState('finished');
      return;
    }
    // Segunda vuelta completada
    finishSecondRun();
  }

  /**
   * Resetea la tanda actual y vuelve a empezar desde la primera
   * pregunta. Se utiliza cuando el usuario pulsa RESET durante un
   * quiz activo o terminado. No altera el conjunto original de
   * preguntas ni los fallos acumulados.
   */
  function resetQuiz() {
    const s = App.State.state;
    // Sólo resetea si hay un pool activo
    if (!s.quiz.pool || s.quiz.pool.length === 0) return;
    shuffle(s.quiz.pool);
    s.quiz.idx = 0;
    s.quiz.done = 0;
    s.quiz.total = s.quiz.pool.length;
    s.quiz.state = 'active';
    s.quiz.currentQuestion = null;
    s.quiz.currentAction = null;
    s.quiz.targetCombos = [];
    s.quiz.correctSet = new Set();
    s.quiz.fails = [];
    s.secondRun = false;
    s.questionFailed = false;
    // Mantener failPoolTotal; limpiar failPool para esta tanda
    s.failPool = new Set();
    // Limpiar pintura y pincel
    App.State.resetUserPaint();
    s.brush = null;
    resetRuntimeFilters();
    // Actualizar interfaz
    App.Paint.resetQuizToggleToQuestion();
    updateProgressIndicator();
    applyQuizBarState('running');
    App.Rules.updateActionButtons();
    App.Rules.applyActionAvailability();
    showQuestion();
  }

  /**
   * Sale del modo Quiz y restaura el modo visualizador por
   * completo. Resetea el estado global mediante hardReset y
   * actualiza todos los controles y vistas.
   */
  function stopQuiz() {
    const s = App.State.state;
    // Hacer un reset completo
    App.State.hardReset();
    // Restaurar interfaz
    App.Paint.resetQuizToggleToCounters();
    App.Paint.refreshGrid();
    App.Paint.updateComboCounters();
    App.Rules.updateHeroVillainButtons();
    App.Rules.updateMoveButtons();
    App.Rules.updateActionButtons();
    App.Rules.applyFilterAvailability();
    App.Rules.applyActionAvailability();
    applyQuizBarState('idle');
    updateProgressIndicator();
    // Restablecer filtros y contador
    updateFilterButtonClasses();
    updateQuestionCounter();

    // Re-enable configuration controls once quiz has been stopped. Guard
    // against undefined App.UI in case the UI module has not defined the helper.
    try {
      if (App && App.UI && typeof App.UI.setConfigDisabled === 'function') {
        App.UI.setConfigDisabled(false);
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Failed to re-enable config controls:', e);
      }
    }
  }

  /**
   * Entra en el modo configuración del quiz. Establece el modo a
   * QUIZ/config, limpia selecciones individuales y prepara sets
   * vacíos para selecciones múltiples. No reinicia los filtros de
   * rango para permitir filtrar preguntas. Pone la barra de
   * control en modo configuración.
   */
  function enterQuizConfig() {
    const s = App.State.state;
    const wasConfig = s.mode === 'QUIZ' && s.quiz.state === 'config';
    if (wasConfig) {
      // Si ya estamos en configuración, salir al visualizador
      stopQuiz();
      return;
    }
    s.mode = 'QUIZ';
    s.quiz.state = 'config';
    // Limpiar selecciones singulares
    s.hero = null;
    s.villain = null;
    s.spot = null;
    s.relative = null;
    s.hasClickedOr = false;
    // Crear nuevos conjuntos vacíos o limpiar existentes
    s.heroes = s.heroes instanceof Set ? new Set() : new Set();
    s.villains = s.villains instanceof Set ? new Set() : new Set();
    s.spots = s.spots instanceof Set ? new Set() : new Set();
    s.relatives = s.relatives instanceof Set ? new Set() : new Set();
    // Vaciar acciones (se permiten múltiples acciones en config)
    s.actions.clear();
    // Desactivar Full Range
    s.fullRange.enabled = false;
    s.fullRange.targets = [];
    s.fullRange.ok = 0;
    s.fullRange.total = 0;
    s.fullRange.extras = 0;
    s.brush = null;
    // Preparar quiz
    s.quiz.pool = [];
    s.quiz.idx = 0;
    s.quiz.done = 0;
    s.quiz.total = 0;
    s.failPool = new Set();
    s.failPoolTotal = new Set();
    s.secondRun = false;
    s.questionFailed = false;
    s.quiz.currentQuestion = null;
    s.quiz.currentAction = null;
    s.quiz.targetCombos = [];
    s.quiz.correctSet = new Set();
    s.quiz.fails = [];
    // Reiniciar pintura
    App.State.resetUserPaint();
    // Cambiar vista del toggle central a contadores
    App.Paint.resetQuizToggleToCounters();
    // Actualizar interfaz de posiciones y botones
    App.Rules.updateHeroVillainButtons();
    App.Rules.updateMoveButtons();
    App.Rules.updateActionButtons();
    App.Rules.applyFilterAvailability();
    App.Rules.applyActionAvailability();
    App.Paint.refreshGrid();
    App.Paint.updateComboCounters();
    updateProgressIndicator();
    applyQuizBarState('config');
    // Inicializar clases de filtros y contador de preguntas
    updateFilterButtonClasses();
    updateQuestionCounter();
  }

  /**
   * Actualiza la barra de control de quiz según el estado de la
   * máquina. En cada estado se habilitan y colorean los botones
   * apropiados.
   * @param {string} machineState Una de 'idle','config','running','finished'
   */
  function applyQuizBarState(machineState) {
    const refs = App.Dom.refs;
    if (!refs) return;
    const yellow = 'var(--yellow-2)';
    const red = 'var(--red-2)';
    function setBtn(btn, enabled, color) {
      if (!btn) return;
      btn.disabled = !enabled;
      if (!enabled) {
        btn.classList.add('disabled');
      } else {
        btn.classList.remove('disabled');
      }
      btn.style.color = (enabled && color) ? color : '';
    }
    if (machineState === 'idle') {
      // En reposo, sólo el botón Quiz está disponible
      setBtn(refs.quizConfig, true, '');
      setBtn(refs.quizBegin, false, null);
      setBtn(refs.quizStop, false, null);
      setBtn(refs.quizReset, false, null);
      setBtn(refs.quizResetFails, false, null);
    } else if (machineState === 'config') {
      // En configuración, el botón Quiz debe quedar deshabilitado; Start y Stop habilitados
      setBtn(refs.quizConfig, false, null);
      setBtn(refs.quizBegin, true, yellow);
      setBtn(refs.quizStop, true, red);
      setBtn(refs.quizReset, false, null);
      setBtn(refs.quizResetFails, false, null);
    } else if (machineState === 'running') {
      setBtn(refs.quizConfig, false, null);
      setBtn(refs.quizBegin, false, null);
      setBtn(refs.quizStop, true, red);
      setBtn(refs.quizReset, true, yellow);
      setBtn(refs.quizResetFails, false, null);
    } else if (machineState === 'finished') {
      setBtn(refs.quizConfig, false, null);
      setBtn(refs.quizBegin, false, null);
      setBtn(refs.quizStop, true, red);
      setBtn(refs.quizReset, true, yellow);
      setBtn(refs.quizResetFails, true, yellow);
    }
  }

  /**
   * Alterna el modo de Full Range. Cuando se activa se
   * construyen los objetivos a partir del héroe, spot y relativo
   * actuales aplicando los filtros visuales. Cuando se desactiva
   * se limpian los objetivos y se reinicia la pintura. Sólo opera
   * en modo VISUALIZER.
   */
  function toggleFullRange() {
    const s = App.State.state;
    const refs = App.Dom.refs;
    // Si estamos configurando un quiz, el comportamiento de FullRange es diferente:
    if (s.mode === 'QUIZ' && s.quiz.state === 'config') {
      // Alternar el estado de FullRange sin calcular objetivos. Requiere al menos un héroe y un spot seleccionado
      const heroList = s.heroes.size > 0 ? Array.from(s.heroes) : (s.hero ? [s.hero] : []);
      const spotList = s.spots.size > 0 ? Array.from(s.spots) : (s.spot ? [s.spot] : []);
      if (heroList.length === 0 || spotList.length === 0) {
        alert('Selecciona héroe y spot antes de activar Full Range.');
        return;
      }
      if (s.fullRange.enabled) {
        // Desactivar
        s.fullRange.enabled = false;
      } else {
        // Activar: desactivar otros filtros
        s.fullRange.enabled = true;
        // Vaciar filtros individuales para que no influyan
        s.filters.ranks.clear();
        s.filters.suited = false;
        s.filters.offsuited = false;
        s.filters.pair = false;
      }
      // Actualizar clases y contador tras cambiar full range
      // También recalcular la disponibilidad de filtros para restaurar
      // el estado correcto tras desactivar Full Range. Sin esta llamada,
      // los botones permanecen bloqueados al salir de Full Range.
      App.Rules.applyFilterAvailability();
      updateFilterButtonClasses();
      updateQuestionCounter();
      return;
    }
    // Comportamiento en modo visualizador
    if (s.fullRange.enabled) {
      // Desactivar
      s.fullRange.enabled = false;
      s.fullRange.targets = [];
      s.fullRange.ok = 0;
      s.fullRange.total = 0;
      s.fullRange.extras = 0;
      App.State.resetUserPaint();
      App.Paint.updateFullRangeProgress();
      App.Paint.refreshGrid();
      return;
    }
    // Activar: requiere héroe y spot seleccionados
    if (!s.hero || !s.spot) {
      alert('Selecciona héroe y spot antes de activar Full Range.');
      return;
    }
    // Calcular combos para full range en modo visualizador
    let mapping = App.Ranges.computeRangeMapping(s.hero, s.spot, s.relative);
    let combos = Object.keys(mapping);
    combos = App.Ranges.applyFilters(combos);
    const targets = [];
    combos.forEach(c => {
      const move = mapping[c];
      if (!move) return;
      const moveUpper = move.toUpperCase();
      if (s.actions.size === 0 || s.actions.has(moveUpper)) {
        targets.push(c);
      }
    });
    s.fullRange.targets = targets;
    s.fullRange.total = targets.length;
    s.fullRange.ok = 0;
    s.fullRange.extras = 0;
    s.fullRange.enabled = true;
    App.State.resetUserPaint();
    App.Paint.updateFullRangeProgress();
    App.Paint.refreshGrid();
    // Recalcular disponibilidad de filtros en visualizador
    App.Rules.applyFilterAvailability();
  }

  /**
   * Registra los manejadores de eventos para todos los controles de
   * la interfaz. Debe llamarse una vez tras inicializar las
   * referencias al DOM.
   */
  function wireEvents() {
    const refs = App.Dom.refs;
    const s = App.State.state;
    if (!refs) return;
    // Héroe buttons
    refs.heroButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const pos = btn.dataset.hero;
        if (s.mode === 'VISUALIZER') {
          if (s.hero === pos) {
            s.hero = null;
            s.spot = null;
            s.relative = null;
            s.hasClickedOr = false;
          } else {
            s.hero = pos;
            if (s.villain === pos) s.villain = null;
            s.relative = null;
            s.spot = null;
            s.hasClickedOr = false;
          }
          if (App.Rules && typeof App.Rules.syncControlFlow === 'function') App.Rules.syncControlFlow();
          App.Rules.updateHeroVillainButtons();
          App.Rules.updateMoveButtons();
          App.Rules.updateActionButtons();
          App.Rules.applyFilterAvailability();
          App.Paint.refreshGrid();
          App.Paint.updateComboCounters();
          // Actualizar clases de filtros para disponibilidad de Full Range
          updateFilterButtonClasses();
        } else if (s.mode === 'QUIZ' && s.quiz.state === 'config') {
          if (s.heroes.has(pos)) s.heroes.delete(pos);
          else s.heroes.add(pos);
          if (App.Rules && typeof App.Rules.syncControlFlow === 'function') App.Rules.syncControlFlow();
          App.Rules.updateHeroVillainButtons();
          // Actualizar filtros y contador
          updateFilterButtonClasses();
          updateQuestionCounter();
        }
      });
    });
    // Villain buttons
    refs.villainButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const pos = btn.dataset.villain;
        if (s.mode === 'VISUALIZER') {
          if (s.villain === pos) {
            s.villain = null;
            s.relative = null;
          } else {
            s.villain = pos;
            if (s.hero === pos) s.hero = null;
            s.relative = null;
          }
          App.Rules.updateHeroVillainButtons();
          App.Rules.updateMoveButtons();
          App.Rules.updateActionButtons();
          App.Rules.applyFilterAvailability();
          App.Paint.refreshGrid();
          App.Paint.updateComboCounters();
          updateFilterButtonClasses();
        } else if (s.mode === 'QUIZ' && s.quiz.state === 'config') {
          if (s.villains.has(pos)) s.villains.delete(pos);
          else s.villains.add(pos);
          App.Rules.updateHeroVillainButtons();
          updateFilterButtonClasses();
          updateQuestionCounter();
        }
      });
    });
    // Relative buttons
    refs.relativeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
          if (btn.disabled) return;
          const rel = btn.dataset.relative;
          if (s.mode === 'VISUALIZER') {
            if (s.relative === rel) {
              s.relative = null;
            } else {
              s.relative = rel;
            }
            if (App.Rules && typeof App.Rules.syncControlFlow === 'function') App.Rules.syncControlFlow();
            App.Rules.updateHeroVillainButtons();
            App.Rules.updateMoveButtons();
            App.Rules.updateActionButtons();
            App.Paint.refreshGrid();
            App.Paint.updateComboCounters();
            updateFilterButtonClasses();
          } else if (s.mode === 'QUIZ' && s.quiz.state === 'config') {
            if (s.relatives.has(rel)) s.relatives.delete(rel);
            else s.relatives.add(rel);
            if (App.Rules && typeof App.Rules.syncControlFlow === 'function') App.Rules.syncControlFlow();
            App.Rules.updateHeroVillainButtons();
            updateFilterButtonClasses();
            updateQuestionCounter();
          }
      });
    });
    // Spot / move buttons
    refs.moveButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const move = (btn.dataset.filter || '').toUpperCase();
        if (s.mode === 'VISUALIZER') {
          if (move === 'OR') {
            const heroUp = s.hero ? String(s.hero).toUpperCase() : null;
            if (!heroUp || heroUp === 'BB') return;
            if (s.spot === 'OR') {
              s.spot = null;
              s.relative = null;
              s.hasClickedOr = false;
            } else if (s.spot === 'VS3BET') {
              s.spot = 'OR';
              s.relative = null;
              s.hasClickedOr = true;
            } else {
              s.spot = 'OR';
              s.relative = null;
              s.hasClickedOr = true;
            }
          } else if (move === 'VS3BET') {
            const heroUp = s.hero ? String(s.hero).toUpperCase() : null;
            if (!heroUp || heroUp === 'BB') return;
            if (!s.hasClickedOr) return;
            if (s.spot === 'VS3BET') {
              s.spot = 'OR';
              s.relative = null;
            } else {
              s.spot = 'VS3BET';
              s.hasClickedOr = true;
              // relative se seleccionará vía botones
            }
          } else if (move === 'VS5BET') {
            // Sin datos; ignorar
            return;
          }
          if (App.Rules && typeof App.Rules.syncControlFlow === 'function') App.Rules.syncControlFlow();
          App.Rules.updateHeroVillainButtons();
          App.Rules.updateMoveButtons();
          App.Rules.updateActionButtons();
          App.Rules.applyFilterAvailability();
          App.Paint.refreshGrid();
          App.Paint.updateComboCounters();
          // Actualizar disponibilidad de filtros (Full Range) tras cambiar spot
          updateFilterButtonClasses();
        } else if (s.mode === 'QUIZ' && s.quiz.state === 'config') {
          if (move === 'OR') {
            const heroList = (s.heroes && s.heroes.size > 0) ? Array.from(s.heroes) : [];
            const heroEligible = heroList.some(h => h && String(h).toUpperCase() !== 'BB');
            if (!heroEligible) return;
            if (s.spots.has('OR')) {
              s.spots.delete('OR');
              s.hasClickedOr = false;
              if (s.spots.has('VS3BET')) s.spots.delete('VS3BET');
              if (s.relatives && typeof s.relatives.clear === 'function') s.relatives.clear();
              s.relative = null;
            } else {
              s.spots.add('OR');
              s.hasClickedOr = true;
            }
          } else if (move === 'VS3BET') {
            if (!s.hasClickedOr) return;
            if (s.spots.has('VS3BET')) {
              s.spots.delete('VS3BET');
              if (s.relatives && typeof s.relatives.clear === 'function') s.relatives.clear();
              s.relative = null;
            } else {
              s.spots.add('VS3BET');
              s.hasClickedOr = true;
            }
          } else if (move === 'VS5BET') {
            // no hay datos, no permitir
            return;
          }
          if (App.Rules && typeof App.Rules.syncControlFlow === 'function') App.Rules.syncControlFlow();
          App.Rules.updateHeroVillainButtons();
          App.Rules.updateMoveButtons();
          App.Rules.updateActionButtons();
          App.Rules.applyFilterAvailability();
          updateFilterButtonClasses();
          updateQuestionCounter();
        }
      });
    });
    // Action buttons
    refs.actionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const rawAct = (btn.dataset.action || '').toUpperCase();
        // Normalizar la etiqueta para manejar abreviaturas como 3B, SQZ, etc.
        let act = rawAct;
        try {
          const normFn = (global.App && global.App.Rules && typeof global.App.Rules.normalizeToButtonTag === 'function')
            ? global.App.Rules.normalizeToButtonTag
            : null;
          act = normFn ? normFn(rawAct) : rawAct;
        } catch (e) {
          act = rawAct;
        }
        if (s.mode === 'VISUALIZER') {
          if (s.actions.has(act)) {
            s.actions.delete(act);
            btn.classList.remove('active');
          } else {
            s.actions.add(act);
            btn.classList.add('active');
          }
          App.Paint.refreshGrid();
          App.Paint.updateComboCounters();
        } else if (s.mode === 'QUIZ' && s.quiz.state === 'config') {
          if (s.actions.has(act)) {
            s.actions.delete(act);
            btn.classList.remove('active');
          } else {
            s.actions.add(act);
            btn.classList.add('active');
          }
          App.Rules.updateActionButtons();
          App.Rules.applyActionAvailability();
          updateFilterButtonClasses();
          updateQuestionCounter();
        } else if (s.mode === 'QUIZ' && s.quiz.state === 'active') {
          // Seleccionar pincel
          s.brush = act;
          App.Paint.refreshBrushSelection();
        }
      });
    });
    // Filter buttons (ranks and suited/off/pair/full range)
    refs.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const filter = (btn.dataset.filter || '').toUpperCase();
        if (filter === 'FULLRANGE') {
          toggleFullRange();
          // toggleFullRange ya actualiza filtros y contador cuando procede
          return;
        }
        // Si se pulsa un filtro distinto de FullRange y está activo el modo FullRange,
        // debemos salir de él y restablecer los filtros previos. Según las reglas,
        // desactivar FullRange hace que el filtro tocado sea el único activo y
        // reinicia los demás. Aquí se implementa dicha transición.
        if (s.fullRange && s.fullRange.enabled) {
          // Desactivar FullRange
          s.fullRange.enabled = false;
          // Resetear filtros de rango y suits
          s.filters.ranks.clear();
          s.filters.suited = false;
          s.filters.offsuited = false;
          s.filters.pair = false;
        }
        // Alternar filtros individuales. Primero valores (2..A)
        if (/^[2-9TJQKA]$/.test(filter)) {
          // Alternar pertenencia en el conjunto; multi‑selección permitida
          if (s.filters.ranks.has(filter)) {
            s.filters.ranks.delete(filter);
          } else {
            s.filters.ranks.add(filter);
          }
        } else if (filter === 'SUITED') {
          s.filters.suited = !s.filters.suited;
        } else if (filter === 'OFFSUITED') {
          s.filters.offsuited = !s.filters.offsuited;
        } else if (filter === 'PAIR') {
          s.filters.pair = !s.filters.pair;
        }
        // Tras cualquier cambio de filtros, recalcular la disponibilidad de
        // filtros, acciones y refrescar la cuadrícula y contadores. Es
        // importante que applyFilterAvailability se invoque antes de
        // updateFilterButtonClasses para que éste conozca el estado
        // disabled correcto en los botones.
        App.Rules.applyFilterAvailability();
        App.Rules.updateActionButtons();
        App.Rules.applyActionAvailability();
        App.Paint.refreshGrid();
        App.Paint.updateComboCounters();
        updateFilterButtonClasses();
        updateQuestionCounter();
      });
    });
    // Show cells toggle
    if (refs.showCellsToggle) {
      refs.showCellsToggle.addEventListener('click', () => {
        s.showCells = !s.showCells;
        // Cambiar icono del ojo según estado
        const SVG_OJO = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        const SVG_OJO_TACHADO = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.17-7.15"/><path d="M1 1l22 22"/><path d="M9.53 9.53a6 6 0 0 0 8.38 8.38"/><path d="M12 12c-1.657 0-3-1.343-3-3"/></svg>';
        if (s.showCells) {
          refs.showCellsToggle.innerHTML = SVG_OJO_TACHADO;
        } else {
          refs.showCellsToggle.innerHTML = SVG_OJO;
        }
        App.Paint.refreshGrid();
      });
    }
    // Full range toggle is handled by filter 'FULLRANGE'
    // Quiz bar buttons
    if (refs.quizConfig) {
      refs.quizConfig.addEventListener('click', () => {
        if (refs.quizConfig.disabled) return;
        enterQuizConfig();
      });
    }
    if (refs.quizBegin) {
      refs.quizBegin.addEventListener('click', () => {
        if (refs.quizBegin.disabled) return;
        startQuiz();
      });
    }
    if (refs.quizStop) {
      refs.quizStop.addEventListener('click', () => {
        if (refs.quizStop.disabled) return;
        stopQuiz();
      });
    }
    if (refs.quizReset) {
      refs.quizReset.addEventListener('click', () => {
        if (refs.quizReset.disabled) return;
        // Dependiendo del estado: si fails-ready -> startFailRun
        if (App.State.state.quiz.state === 'fails-ready') {
          startFailRun();
        } else {
          resetQuiz();
        }
      });
    }
    if (refs.quizResetFails) {
      refs.quizResetFails.addEventListener('click', () => {
        if (refs.quizResetFails.disabled) return;
        startFailRun();
      });
    }
    // Quiz toggle to show counters / question
    if (refs.quizToggle) {
      refs.quizToggle.addEventListener('click', () => {
        // Toggle only in quiz
        if (s.mode !== 'QUIZ' || s.quiz.state === 'config') return;
        if (refs.quizToggle.classList.contains('show-counters')) {
          App.Paint.resetQuizToggleToQuestion();
        } else {
          App.Paint.resetQuizToggleToCounters();
        }
      });
    }
    // Grid cell clicks: delegar a rules
    refs.gridCells.forEach(td => {
      td.addEventListener('click', () => {
        if (s.mode === 'QUIZ' && s.quiz.state === 'active') {
          App.Rules.handleQuizCellClick(td);
        }
      });
    });
  }

  /**
   * Inicializa el módulo Quiz una vez que el DOM está listo. Se
   * asegura de cargar referencias, establecer la barra de control en
   * estado inicial y registrar los eventos.
   */
  function init() {
    // Inicializar refs si no se ha hecho aún
    if (!App.Dom.refs) {
      App.Dom.initRefs();
    }
    applyQuizBarState('idle');
    updateProgressIndicator();
    wireEvents();
    // Inicializar clases de filtros y contador
    updateFilterButtonClasses();
    updateQuestionCounter();
    // Asegurar que botones de posiciones y movimientos reflejen el estado inicial
    if (App.Rules && App.Rules.updateHeroVillainButtons) {
      App.Rules.updateHeroVillainButtons();
      App.Rules.updateMoveButtons();
      App.Rules.updateActionButtons();
      App.Rules.applyFilterAvailability();
      App.Rules.applyActionAvailability();
    }
    // Asegurar que los contadores de combinaciones se muestren desde el inicio
    if (App.Paint && App.Paint.updateComboCounters) {
      App.Paint.updateComboCounters();
    }
  }

  // Exponer funciones públicas
  App.Quiz.loadQuestions = loadQuestions;
  App.Quiz.buildQuizPool = buildQuizPool;
  App.Quiz.showQuestion = showQuestion;
  App.Quiz.nextQuestion = nextQuestion;
  App.Quiz.startQuiz = startQuiz;
  App.Quiz.finishQuiz = finishQuiz;
  App.Quiz.stopQuiz = stopQuiz;
  App.Quiz.enterQuizConfig = enterQuizConfig;
  App.Quiz.resetQuiz = resetQuiz;
  App.Quiz.startFailRun = startFailRun;
  App.Quiz.updateProgressIndicator = updateProgressIndicator;
  App.Quiz.finishSecondRun = finishSecondRun;
  App.Quiz.applyQuizBarState = applyQuizBarState;
  App.Quiz.toggleFullRange = toggleFullRange;
  // Exponer funciones utilitarias para cálculo de acciones disponibles y permitidas
  // Esto permite que App.Rules.updateActionButtons y updateActionAvailability
  // recuperen la lista de acciones según la configuración o la pregunta actual.
  App.Quiz.getAvailableMovesForConfig = getAvailableMovesForConfig;
  App.Quiz.getAllowedMovesForCurrentQuestion = getAllowedMovesForCurrentQuestion;
  App.Quiz.wireEvents = wireEvents;
  App.Quiz.init = init;

  // Ejecutar init cuando el documento esté listo
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }



/**
 * Construye el pool de consignas para el modo Freebet (rango completo).
 * Genera una consigna por héroe y spot seleccionados. Para VS3BET se requiere relativo.
 * Cada consigna incluye las combinaciones objetivo, los movimientos permitidos y el mapping
 * de acción esperada por combinación. El texto de la pregunta se guarda en q.label.
 */
function buildFreebetPool() {
  const s = App.State.state;
  const pool = [];
  // Determinar héroes en un orden canónico definido por HERO_ORDER. Si no hay héroes múltiples
  // seleccionados (state.heroes), usar state.hero como único elemento. Esto evita que el orden
  // dependa del Set (que puede cambiar según el orden de inserción).
  let heroes = [];
  const order = (global.App && global.App.State && Array.isArray(global.App.State.HERO_ORDER))
    ? global.App.State.HERO_ORDER
    : ['UTG','MP','CO','BTN','SB','BB'];
  if (s.heroes && s.heroes.size > 0) {
    order.forEach(h => {
      if (s.heroes.has(h)) heroes.push(h);
    });
  } else if (s.hero) {
    heroes = [s.hero];
  }
  // Determinar spots seleccionados (OR, VS3BET, VS5BET...). Mantener el orden de inserción
  // porque el usuario suele seleccionar primero OR y luego VS3BET. Si no hay spots múltiples,
  // tomar state.spot como único.
  const spots = (() => {
    const raw = (s.spots && s.spots.size > 0) ? Array.from(s.spots) : (s.spot ? [s.spot] : []);
    const canonical = raw.map(sp => String(sp).toUpperCase());
    const order = ['OR', 'VS3BET', 'VS5BET'];
    canonical.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
    });
    return canonical;
  })();
  // Determinar relativos según prioridades: explicitados en s.relatives > s.relative > autoguess
  let relatives = [];
  if (s.relatives && s.relatives.size > 0) {
    relatives = Array.from(s.relatives);
  } else if (s.relative) {
    relatives = [s.relative];
  } else {
    // Deducción automática: si hay villanos seleccionados, deducir IP/OOP para cada pareja hero-villain
    const vilList = (s.villains && s.villains.size > 0)
      ? Array.from(s.villains)
      : (s.villain ? [s.villain] : []);
    const guessed = new Set();
    heroes.forEach(h => {
      vilList.forEach(v => {
        const rel = (global.App && global.App.State && typeof global.App.State.autoguessRel === 'function')
          ? global.App.State.autoguessRel(String(h).toUpperCase(), String(v).toUpperCase())
          : null;
        if (rel) guessed.add(rel);
      });
    });
    if (guessed.size > 0) {
      relatives = Array.from(guessed);
    }
  }
  // Conjunto para evitar duplicados. Clave semántica: hero|spot o hero|spot|rel
  const seen = new Set();
  // Detectar si el usuario ha seleccionado exclusivamente VS3BET (sin OR) en la configuración del quiz.
  // En ese caso no se debe generar una consigna de OR para los rangos completos.
  const onlyVs3 = (s.spots && s.spots.size === 1 && s.spots.has('VS3BET'));

  heroes.forEach(hero => {
    spots.forEach(spot => {
      const sp = String(spot).toUpperCase();
      // OR: sólo una consigna por héroe
      // Omitir consignas de OR cuando sólo se ha seleccionado VS3BET
      if (onlyVs3 && sp === 'OR') {
        return;
      }
      if (sp === 'OR') {
        const key = `${String(hero).toUpperCase()}|OR`;
        if (seen.has(key)) return;
        const mapping = (App.Ranges && App.Ranges.computeRangeMapping) ? App.Ranges.computeRangeMapping(hero, 'OR', null) : {};
        const combos = mapping ? Object.keys(mapping) : [];
        // Permitir sólo acción OR
        const allowedMoves = ['OR'];
        const expected = {};
        combos.forEach(c => { expected[c] = 'OR'; });
        pool.push({
          kind: 'FULLRANGE',
          hero: hero,
          spot: 'OR',
          relative: null,
          tags: [String(hero).toUpperCase(), 'OR'],
          targetCombos: combos.slice(),
          allowedMoves: allowedMoves.slice(),
          expectedMoveByCombo: expected,
          label: `Pinta el rango completo de OR para ${String(hero).toUpperCase()}.`
        });
        seen.add(key);
      } else if (sp === 'VS3BET') {
        // Si hay relativos definidos o deducidos, generar una consigna por relativo
        const rels = (relatives && relatives.length > 0) ? relatives.slice() : [];
        if (rels.length > 0) {
          rels.forEach(rel => {
            const key = `${String(hero).toUpperCase()}|VS3BET|${String(rel).toUpperCase()}`;
            if (seen.has(key)) return;
            const mapping = (App.Ranges && App.Ranges.computeRangeMapping)
              ? App.Ranges.computeRangeMapping(hero, 'VS3BET', rel)
              : {};
            if (!mapping || typeof mapping !== 'object') return;
            const combos = Object.keys(mapping);
            if (!combos || combos.length === 0) return;
            const allowed = new Set();
            const expected = {};
            combos.forEach(c => {
              const mv = normalizeMove(mapping[c]);
              if (mv) {
                allowed.add(mv);
                expected[c] = mv;
              }
            });
            if (allowed.size > 0 && combos.length > 0) {
              pool.push({
                kind: 'FULLRANGE',
                hero: hero,
                spot: 'VS3BET',
                relative: rel,
                tags: [String(hero).toUpperCase(), 'VS3BET', String(rel).toUpperCase()],
                targetCombos: combos.slice(),
                allowedMoves: Array.from(allowed),
                expectedMoveByCombo: expected,
                label: `Pinta el rango completo de VS3BET para ${String(hero).toUpperCase()} ${String(rel).toUpperCase()}.`
              });
              seen.add(key);
            }
          });
        } else {
          // Combinar IP y OOP en una sola consigna por héroe
          const key = `${String(hero).toUpperCase()}|VS3BET`;
          if (seen.has(key)) return;
          const mapIP = (App.Ranges && App.Ranges.computeRangeMapping)
            ? App.Ranges.computeRangeMapping(hero, 'VS3BET', 'IP')
            : {};
          const mapOOP = (App.Ranges && App.Ranges.computeRangeMapping)
            ? App.Ranges.computeRangeMapping(hero, 'VS3BET', 'OOP')
            : {};
          // Combinar movimientos por combinación, permitiendo múltiples acciones si difieren entre IP y OOP.
          const combinedMoves = {};
          if (mapIP && typeof mapIP === 'object') {
            Object.entries(mapIP).forEach(([c, mv]) => {
              const norm = normalizeMove(mv);
              if (!norm) return;
              if (!combinedMoves[c]) combinedMoves[c] = [];
              combinedMoves[c].push(norm);
            });
          }
          if (mapOOP && typeof mapOOP === 'object') {
            Object.entries(mapOOP).forEach(([c, mv]) => {
              const norm = normalizeMove(mv);
              if (!norm) return;
              if (!combinedMoves[c]) combinedMoves[c] = [];
              combinedMoves[c].push(norm);
            });
          }
          const combos = Object.keys(combinedMoves);
          if (!combos || combos.length === 0) return;
          const allowed = new Set();
          const expected = {};
          combos.forEach(c => {
            // obtener movimientos distintos para esta combinación
            let moves = combinedMoves[c].map(m => String(m).toUpperCase());
            moves = Array.from(new Set(moves));
            // Añadir todos los movimientos a allowed
            moves.forEach(mv => allowed.add(mv));
            // Si solo hay un movimiento, establecerlo como esperado; en otro caso, indicar null para permitir cualquiera
            if (moves.length === 1) {
              expected[c] = moves[0];
            } else {
              expected[c] = null;
            }
          });
          if (allowed.size > 0 && combos.length > 0) {
            pool.push({
              kind: 'FULLRANGE',
              hero: hero,
              spot: 'VS3BET',
              relative: null,
              tags: [String(hero).toUpperCase(), 'VS3BET', 'IP/OOP'],
              targetCombos: combos.slice(),
              allowedMoves: Array.from(allowed),
              expectedMoveByCombo: expected,
              label: `Pinta el rango completo de VS3BET para ${String(hero).toUpperCase()} IP/OOP.`
            });
            seen.add(key);
          }
        }
      } else if (sp === 'VS5BET') {
        // Para VS5BET se puede seguir una lógica similar: si no existe mapeo, no generar consigna
        const key = `${String(hero).toUpperCase()}|VS5BET`;
        if (seen.has(key)) return;
        const mapIP = (App.Ranges && App.Ranges.computeRangeMapping)
          ? App.Ranges.computeRangeMapping(hero, 'VS5BET', 'IP')
          : {};
        const mapOOP = (App.Ranges && App.Ranges.computeRangeMapping)
          ? App.Ranges.computeRangeMapping(hero, 'VS5BET', 'OOP')
          : {};
        // Combinar movimientos por combinación, permitiendo múltiples acciones si difieren entre IP y OOP.
        const combinedMoves = {};
        if (mapIP && typeof mapIP === 'object') {
          Object.entries(mapIP).forEach(([c, mv]) => {
            const norm = normalizeMove(mv);
            if (!norm) return;
            if (!combinedMoves[c]) combinedMoves[c] = [];
            combinedMoves[c].push(norm);
          });
        }
        if (mapOOP && typeof mapOOP === 'object') {
          Object.entries(mapOOP).forEach(([c, mv]) => {
            const norm = normalizeMove(mv);
            if (!norm) return;
            if (!combinedMoves[c]) combinedMoves[c] = [];
            combinedMoves[c].push(norm);
          });
        }
        const combos = Object.keys(combinedMoves);
        if (!combos || combos.length === 0) return;
        const allowed = new Set();
        const expected = {};
        combos.forEach(c => {
          let moves = combinedMoves[c].map(m => String(m).toUpperCase());
          moves = Array.from(new Set(moves));
          moves.forEach(mv => allowed.add(mv));
          if (moves.length === 1) {
            expected[c] = moves[0];
          } else {
            expected[c] = null;
          }
        });
        if (allowed.size > 0 && combos.length > 0) {
          pool.push({
            kind: 'FULLRANGE',
            hero: hero,
            spot: 'VS5BET',
            relative: null,
            tags: [String(hero).toUpperCase(), 'VS5BET'],
            targetCombos: combos.slice(),
            allowedMoves: Array.from(allowed),
            expectedMoveByCombo: expected,
            label: `Pinta el rango completo de VS5BET para ${String(hero).toUpperCase()}.`
          });
          seen.add(key);
        }
      }
    });
  });
  // *** No barajamos el pool en Full Range. El orden responde al orden de héroes y spots. ***
  return pool;
}

  // Exponer helper para tests: permite construir el pool de Full Range sin iniciar un quiz
  App.Quiz.buildFreebetPool = buildFreebetPool;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));