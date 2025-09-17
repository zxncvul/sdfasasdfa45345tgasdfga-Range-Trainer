
window.rangos = {
    "DAVID DIAZ": {
      BASICOS: {
        OR: {
          UTG: {
            parejas: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66"],
            suited: [
              "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
              "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "J9s", "K9s", "Q9s"
            ],
            offsuit: ["AKo", "AQo", "AJo", "ATo", "KQo", "KJo", "QJo"]
          },
          MP: {
            parejas: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55"],
            suited: [
              "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
              "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s",
              "QJs", "QTs", "Q9s",
              "JTs", "J9s",
              "T9s"
            ],
            offsuit: ["AKo", "AQo", "AJo", "ATo", "KQo", "KJo", "QJo", "KTo", "QJo"]
          },
          CO: {
            parejas: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44"],
            suited: [
              "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
              "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s",
              "QJs", "QTs", "Q9s", "Q8s",
              "JTs", "J9s", "J8s",
              "T9s", "T8s",
              "98s", "97s",
              "87s", "76s", "65s", "54s"
            ],
            offsuit: [
              "AKo", "AQo", "AJo", "ATo", "A9o",
              "KQo", "KJo", "KTo",
              "QJo", "QTo",
              "JTo"
            ]
          },
          BTN: {
            parejas: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22"],
            suited: [
              "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
              "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
              "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s",
              "JTs", "J9s", "J8s", "J7s",
              "T9s", "T8s", "T7s",
              "98s", "97s",
              "87s", "86s",
              "76s", "65s", "54s"
            ],
            offsuit: [
              "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o",
              "KQo", "KJo", "KTo", "K9o",
              "QJo", "QTo", "Q9o",
              "JTo", "J9o",
              "T9o"
            ]
          },
          SB: {
            parejas: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22"],
            suited: [
              "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
              "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
              "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "Q2s",
              "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "J4s",
              "T9s", "T8s", "T7s", "T6s", "T5s",
              "98s", "97s", "96s", "95s",
              "87s", "86s", "85s",
              "76s", "75s", "74s",
              "65s", "64s",
              "54s"
            ],
            offsuit: [
              "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o",  
              "KQo", "KJo", "KTo", "K9o",
              "QJo", "QTo", "Q9o",
              "JTo", "J9o",
              "T9o", "T8o",
              "98o"
            ]
          }
        },
        VS3BET: {
          OOP: {
            UTG: {
              FOLD:    { parejas: ["66"], suited: ["A9s","A8s","A7s","A6s","A2s","KJs","KTs","K9s","QTs","Q9s","J9s","T9s"], offsuit: ["AQo","AJo","ATo","KQo","KJo","QJo"] },
              CALL:    { parejas: ["QQ","JJ","TT","99","88","77"], suited: ["AQs","AJs","ATs","KQs","QJs","JTs"], offsuit: ["AKo"] },
              "4BET": { parejas: ["AA","KK"], suited: ["AKs","A5s","A4s","A3s"], offsuit: [] }
            },
            MP: {
              FOLD: { parejas: ["55"], suited: ["A8s","A7s","KJs","KTs","K9s","K8s","K7s","K6s","QTs","Q9s","J9s","T9s"], offsuit: ["AJo","ATo","KQo","KJo","KTo","QJo"] },
              CALL: { parejas: ["JJ","TT","99","88","77","66"], suited: ["AQs","AJs","ATs","A9s","KQs","QJs","JTs"], offsuit: ["AQo"] },
              "4BET": { parejas: ["AA","KK","QQ"], suited: ["AKs","A6s","A5s","A4s","A3s","A2s"], offsuit: ["AKo"] }
            },
            CO: {
              FOLD:    { parejas: ["44"], suited: ["K9s","K8s","K7s","K6s","K5s","K4s","Q9s","Q8s","J9s","J8s","T8s","97s","54s"], offsuit: ["KJo","QJo","ATo","KTo","QTo","JTo","A9o"] },
              CALL:    { parejas: ["JJ","TT","99","88","77","66","55"], suited: ["AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","KQs","KJs","KTs","QJs","QTs","JTs","J9s","T9s","98s","87s","76s","65s"], offsuit: ["AQo"] },
              "4BET": { parejas: ["AA","KK","QQ"], suited: ["AKs","A2s"], offsuit: ["AKo","AJo"] }
            },
            SB: {
              FOLD: { parejas: [], suited: ["K7s","K6s","K5s","K4s","K3s","K2s","Q8s","Q7s","Q6s","Q5s","Q4s","Q3s","Q2s","J8s","J7s","J6s","J5s","J4s","T7s","T6s","T5s","96s","95s","85s","74s"], offsuit: ["KTo","K9o","QTo","Q9o","JTo","J9o","T9o","T8o","98o","A8o","A7o","A6o","A5o","A4o","A3o","A2o"] },
              CALL: { parejas: ["99","88","77","66","55","44","33","22"], suited: ["AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","KQs","KJs","KTs","K9s","K8s","QJs","QTs","Q9s","JTs","J9s","T9s","T8s","98s","97s","87s","86s","76s","75s","65s","64s","54s"], offsuit: ["AQo","AJo","KQo","KJo","QJo"] },
              "4BET": { parejas: ["AA","KK","QQ","JJ","TT"], suited: ["AKs","AQs","A3s","A2s"], offsuit: ["AKo","ATo","A9o"] }
            }
          },
          IP: {
            UTG: {
              FOLD:    { parejas: [], suited: ["A9s","A8s","A7s","A6s","KTs","K9s","QTs","Q9s","JTs","J9s","T9s"], offsuit: ["AQo","AJo","ATo","KQo","KJo","QJo"] },
              CALL:    { parejas: ["KK","QQ","JJ","TT","99","88","77","66"], suited: ["AKs","AQs","AJs","ATs","KQs","KJs","QJs"], offsuit: ["AKo"] },
              "4BET": { parejas: ["AA"], suited: ["A5s","A4s","A3s","A2s"], offsuit: [] }
            },
            MP: {
              FOLD:    { parejas: [], suited: ["A9s","A8s","A7s","K9s","K8s","K7s","K6s","Q9s","J9s","T9s"], offsuit: ["ATo","AJo","KQo","KJo","KTo","QJo"] },
              CALL:    { parejas: ["QQ","JJ","TT","99","88","77","66","55"], suited: ["AQs","AJs","ATs","KQs","KJs","KTs","QJs","QTs","JTs"], offsuit: ["AQo"] },
              "4BET": { parejas: ["AA","KK"], suited: ["AKs","A6s","A5s","A4s","A3s","A2s"], offsuit: ["AKo"] }
            },
            CO: {
              FOLD:    { parejas: [], suited: ["A8s","A7s","K9s","K8s","K7s","K6s","K5s","K4s","Q9s","Q8s","J9s","J8s","T8s","98s","97s","87s","54s"], offsuit: ["ATo","A9o","KJo","KTo","QJo","QTo","JTo"] },
              CALL:    { parejas: ["JJ","TT","99","88","77","66","55","44"], suited: ["AQs","AJs","ATs","KQs","KJs","KTs","QJs","QTs","JTs","T9s","76s","65s"], offsuit: ["AQo","KQo"] },
              "4BET": { parejas: ["AA","KK","QQ"], suited: ["AKs","A9s","A6s","A5s","A4s","A3s","A2s"], offsuit: ["AKo","AJo"] }
            },
            BTN: {
              FOLD:    { parejas: [], suited: ["A8s","A7s","K7s","K6s","K5s","K4s","K3s","K2s","Q8s","Q7s","Q6s","Q5s","J7s","T7s"], offsuit: ["A8o","A7o","A6o","A5o","A4o","A3o","A2o","KTo","K9o","QJo","QTo","Q9o","JTo","J9o","T9o"] },
              CALL:    { parejas: ["JJ","TT","99","88","77","66","55","44","33","22"], suited: ["AQs","AJs","ATs","KQs","KJs","KTs","K9s","K8s","QJs","QTs","Q9s","JTs","J9s","J8s","T9s","T8s","98s","97s","87s","86s","76s","65s","54s"], offsuit: ["AQo","AJo","KQo","KJo"] },
              "4BET": { parejas: ["AA","KK","QQ"], suited: ["AKs","A9s","A6s","A5s","A4s","A3s","A2s"], offsuit: ["AKo","ATo","A9o"] }
            }
          }
        }
      }
    }
  };