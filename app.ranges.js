/*
 * app.ranges.js
 *
 * Este módulo contiene funciones para obtener mapeos de rangos a
 * movimientos y para filtrar listas de combinaciones según las
 * preferencias del usuario. También incluye una función de
 * resolución de preguntas a partir de sus etiquetas (tags).
 */

;(function (global) {
  'use strict';
  const App = global.App = global.App || {};
  App.Ranges = App.Ranges || {};

  /**
   * Obtiene un mapeo {combo: move} en función del héroe, el spot
   * seleccionado y la posición relativa. Si falta alguno de estos
   * parámetros se devuelve un objeto vacío. En VS5BET no se
   * ofrecen rangos, por lo que devuelve siempre un objeto vacío.
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
    // VS5BET todavía no está soportado en los datos
    return mapping;
  }

  /**
   * Aplica los filtros almacenados en App.State.state.filters sobre una lista
   * de combinaciones. Devuelve una lista filtrada según los rangos
   * seleccionados (ranks), si se exige suited, offsuit o parejas.
   * Si ningún filtro está activo se devuelve la lista sin modificar.
   * @param {string[]} combos Lista de etiquetas de mano
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
   * Calcula las combinaciones correspondientes a una pregunta a partir
   * de sus etiquetas. Esta función recorre window.rangos para extraer
   * las parejas, suited y offsuit, filtrando por acciones y otros
   * modificadores presentes en los tags. Se utiliza tanto en el modo
   * Quiz como en la construcción de Full Range.
   * @param {string[]} tags
   * @returns {string[]}
   */
  function resolveRango(tags) {
    // Helper local para comprobar conectores
    function isAdjacent(a, b) {
      // Considerar conectores incluyendo AK y broadways además de los conectores clásicos.
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
      // Si hay relativo
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
      // Filtrar por acción específica
      const actionTag = tags.find(t => ['FOLD','CALL','3BET','4BET','ALLIN','5BETPLUS','5BET+','ROL','SQUEEZE','OVERLIMP','LIMP','5BET'].includes(t));
      if (actionTag && node[actionTag]) {
        node = node[actionTag];
      }
    } else {
      node = root[move] && root[move][pos];
    }
    if (!node) return [];
    let combos = [].concat(node.parejas || [], node.suited || [], node.offsuit || []);
    // Suited/offsuited exclusividad inicial
    const wantSu  = tags.includes('SUITED');
    const wantOff = tags.includes('OFFSUITED');
    if (wantOff && !wantSu) {
      combos = [].concat(node.offsuit || [], node.parejas || []);
    } else if (wantSu && !wantOff) {
      combos = [].concat(node.suited || []);
    }
    // Filtrar por rangos amplios (AX, KX, etc.)
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
    // Filtro de conectores
    if (tags.includes('CONNECTORS')) {
      combos = combos.filter(c => c.length === 3 && isAdjacent(c[0], c[1]));
    }
    // Excluir conectores sólo cuando se especifica 'NO_CONNECTORS' y NO existen tags de rango (AX, KX, A, K, etc.)
    if (tags.includes('NO_CONNECTORS')) {
      const hasRankTag = tags.some(t => (/^[2-9TJQKA]X$/.test(t) || /^[2-9TJQKA]$/.test(t)));
      if (!hasRankTag) {
        combos = combos.filter(c => {
          if (c.length !== 3) return true;
          return !isAdjacent(c[0], c[1]);
        });
      }
    }
    // Excluir parejas sólo si NO_PAIR está presente y NO se pide OFFSUITED (las parejas se consideran offsuit)
    if (tags.includes('NO_PAIR') && !tags.includes('OFFSUITED')) {
      combos = combos.filter(c => c.length > 2);
    }
    // Reafirmar suited/offsuited tras filtros
    if (wantSu && !wantOff) {
      combos = combos.filter(c => c.length === 3 && /s$/i.test(c));
    } else if (wantOff && !wantSu) {
      combos = combos.filter(c => (c.length === 3 && /o$/i.test(c)) || c.length === 2);
    }
    return combos;
  }

  // Exportar las funciones en el namespace
  App.Ranges.computeRangeMapping = computeRangeMapping;
  App.Ranges.applyFilters = applyFilters;
  App.Ranges.resolveRango = resolveRango;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));