/* ===================================================== */
/* ============= FONCTIONS DE TOKENIZATION ============= */
/* ===================================================== */

// Stopwords français à ignorer
const STOPWORDS = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "ou", "mais",
  "est", "sont", "dans", "avec", "pour", "sur", "par", "plus", "moins",
  "que", "qui", "quoi", "dont", "où", "au", "aux", "ce", "ces", "cet",
  "cette", "mon", "ton", "son", "notre", "votre", "leur", "mes", "tes",
  "ses", "nos", "vos", "leurs", "a", "ont", "été", "sera", "était",
  "il", "elle", "ils", "elles", "nous", "vous", "lui", "leur", "eux",
  "avec", "sans", "chez", "pour", "dans", "par", "sur", "sous", "vers",
  "très", "bien", "mal", "peu", "beaucoup", "trop", "assez", "tout",
  "tous", "toute", "toutes", "peut", "peuvent", "faire", "fait"
]);

function tokenize(s) {
  if (!s) return [];
  return (s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")  // Remplacer la ponctuation par des espaces
    .split(/\s+/)
    .filter(w => w.length > 0);
}

function tokenizeAdvanced(s) {
  if (!s) return [];
  return (s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w)); // Ignore stopwords et mots courts
}

/* ===================================================== */
/* ============= SIMILARITÉ COSINUS ==================== */
/* ===================================================== */

function cosineSim(aTokens, bTokens) {
  if (!aTokens || !bTokens || aTokens.length === 0 || bTokens.length === 0) {
    return 0;
  }
  
  const freq = (toks) => toks.reduce((m, w) => (m[w] = (m[w] || 0) + 1, m), {});
  const A = freq(aTokens);
  const B = freq(bTokens);
  const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
  
  let dot = 0, n1 = 0, n2 = 0;
  for (const k of keys) {
    const x = A[k] || 0;
    const y = B[k] || 0;
    dot += x * y;
    n1 += x * x;
    n2 += y * y;
  }
  
  if (n1 === 0 || n2 === 0) return 0;
  return dot / (Math.sqrt(n1) * Math.sqrt(n2));
}

/* ===================================================== */
/* ============= SIMILARITÉ DE JACCARD ================= */
/* ===================================================== */

function jaccardSim(text1, text2) {
  const tokens1 = new Set(tokenizeAdvanced(text1));
  const tokens2 = new Set(tokenizeAdvanced(text2));
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

/* ===================================================== */
/* ============= EXTRACTION D'INFORMATIONS ============= */
/* ===================================================== */

function extractKeyInfo(text) {
  const info = {
    dates: text.match(/\b(19|20)\d{2}\b/g) || [],
    nombres: text.match(/\b\d+\b/g) || [],
    lieux: text.match(/\b(Argentine|France|Espagne|États-Unis|Barcelone|Paris|Miami|Rosario|Madrid|Londres|Italie|Allemagne|Brésil)\b/g) || [],
    personnes: text.match(/\b([A-Z][a-zéèêëàâîïôûùç]+(?:\s+[A-Z][a-zéèêëàâîïôûùç]+)*)\b/g) || [],
    concepts: text.match(/\b(football|sport|ballon|titre|champion|mondial|coupe|ligue|club|équipe|joueur|entraîneur|match|but|victoire)\b/gi) || []
  };
  
  // Filtrer les personnes pour enlever les mots trop courts ou communs
  info.personnes = info.personnes.filter(p => 
    p.length > 3 && 
    !STOPWORDS.has(p.toLowerCase()) &&
    !['Les', 'Une', 'Dans', 'Pour', 'Avec'].includes(p)
  );
  
  return info;
}

/* ===================================================== */
/* ============= ANALYSE DE LA RÉPONSE ================= */
/* ===================================================== */

export function analyzeResponse(question, answer) {
  // Si réponse vide ou erreur
  if (!answer || answer.trim().length === 0) {
    return {
      score: 0,
      overlapRatio: 0,
      answerWordCount: 0,
      lengthFactor: 0,
      details: {
        pertinence: 0,
        couverture: 0,
        structure: 0
      }
    };
  }

  // Tokenisation
  const q = tokenizeAdvanced(question);
  const a = tokenizeAdvanced(answer);

  // 1. PERTINENCE - Mots-clés de la question dans la réponse
  const qSet = new Set(q);
  const aSet = new Set(a);
  
  const motsClesTrouves = [...qSet].filter(w => aSet.has(w)).length;
  const totalMotsCles = qSet.size || 1;
  const pertinence = motsClesTrouves / totalMotsCles;

  // 2. COUVERTURE - La réponse couvre-t-elle le sujet ?
  const couverture = Math.min(aSet.size / 20, 1); // Max 20 mots uniques différents

  // 3. STRUCTURE - Qualité de la réponse
  const wordCount = tokenize(answer).length;
  const phrases = answer.split(/[.!?]+/).filter(p => p.trim().length > 0);
  const nbPhrases = phrases.length;
  
  let structure = 0.3; // Score de base
  
  if (nbPhrases >= 3) structure = 1.0;
  else if (nbPhrases >= 2) structure = 0.8;
  else if (nbPhrases >= 1) structure = 0.6;
  
  // Bonus pour la ponctuation
  if (answer.includes('.')) structure += 0.1;
  if (answer.includes(',')) structure += 0.1;
  if (answer.includes(':')) structure += 0.1;

  // 4. PRÉSENCE D'INFORMATIONS CLÉS
  const keyInfo = extractKeyInfo(answer);
  const hasDates = keyInfo.dates.length > 0;
  const hasLieux = keyInfo.lieux.length > 0;
  const hasPersonnes = keyInfo.personnes.length > 0;
  
  let infoBonus = 0;
  if (hasDates) infoBonus += 0.15;
  if (hasLieux) infoBonus += 0.1;
  if (hasPersonnes) infoBonus += 0.15;

  // Score pondéré
  const rawScore = (
    pertinence * 0.5 +      // Pertinence: 50%
    couverture * 0.2 +      // Couverture: 20%
    structure * 0.3         // Structure: 30%
  ) * 100;

  // Ajouter le bonus d'informations
  const finalScore = Math.min(100, rawScore * (1 + infoBonus));
  
  // Facteur de longueur (pour compatibilité)
  const lengthFactor = Math.min(wordCount / 30, 1);

  return { 
    score: Math.round(finalScore),
    overlapRatio: Math.round(pertinence * 100),
    answerWordCount: wordCount,
    lengthFactor: Math.round(lengthFactor * 100),
    details: {
      pertinence: Math.round(pertinence * 100),
      couverture: Math.round(couverture * 100),
      structure: Math.round(structure * 100),
      infoBonus: Math.round(infoBonus * 100)
    }
  };
}

/* ===================================================== */
/* ============= CROSSCHECK AMÉLIORÉ =================== */
/* ===================================================== */

export function crossCheck(answers) {
  if (!answers || answers.length < 2) {
    return { 
      agreementScore: 0, 
      verdict: "single-model",
      details: {}
    };
  }

  const a1 = answers[0]?.answer || "";
  const a2 = answers[1]?.answer || "";
  
  if (!a1 || !a2) {
    return { agreementScore: 0, verdict: "single-model" };
  }

  // 1. SIMILARITÉ COSINUS
  const tokens1 = tokenizeAdvanced(a1);
  const tokens2 = tokenizeAdvanced(a2);
  const cosine = cosineSim(tokens1, tokens2);

  // 2. SIMILARITÉ JACCARD
  const jaccard = jaccardSim(a1, a2);

  // 3. COMPARAISON DES INFORMATIONS CLÉS
  const info1 = extractKeyInfo(a1);
  const info2 = extractKeyInfo(a2);

  let infoScore = 0;
  let infoTotal = 0;

  // Comparer les dates
  if (info1.dates.length > 0 || info2.dates.length > 0) {
    const datesCommunes = info1.dates.filter(d => info2.dates.includes(d)).length;
    const maxDates = Math.max(info1.dates.length, info2.dates.length);
    infoScore += (datesCommunes / maxDates) * 100;
    infoTotal++;
  }

  // Comparer les lieux
  if (info1.lieux.length > 0 || info2.lieux.length > 0) {
    const lieuxCommuns = info1.lieux.filter(l => info2.lieux.includes(l)).length;
    const maxLieux = Math.max(info1.lieux.length, info2.lieux.length);
    infoScore += (lieuxCommuns / maxLieux) * 100;
    infoTotal++;
  }

  // Comparer les personnes
  if (info1.personnes.length > 0 || info2.personnes.length > 0) {
    const personnesCommunes = info1.personnes.filter(p => 
      info2.personnes.some(p2 => p2.toLowerCase() === p.toLowerCase())
    ).length;
    const maxPersonnes = Math.max(info1.personnes.length, info2.personnes.length);
    infoScore += (personnesCommunes / maxPersonnes) * 100;
    infoTotal++;
  }

  const keyInfoScore = infoTotal > 0 ? infoScore / infoTotal : 100;

  // 4. VÉRIFICATION DES SUJETS PRINCIPAUX
  const sujetsPrincipaux = [
    "messi", "ronaldo", "neymar", "mbappé", "football", "sport",
    "barcelone", "real", "psg", "argentine", "france", "brésil"
  ];
  
  let sujetBonus = 0;
  sujetsPrincipaux.forEach(sujet => {
    if (a1.toLowerCase().includes(sujet) && a2.toLowerCase().includes(sujet)) {
      sujetBonus += 5;
    }
  });

  // Score combiné avec pondération intelligente
  const combinedScore = (
    cosine * 100 * 0.3 +    // Cosinus: 30%
    jaccard * 100 * 0.3 +   // Jaccard: 30%
    keyInfoScore * 0.4      // Infos clés: 40%
  );

  // Ajouter le bonus
  let finalScore = combinedScore + sujetBonus;

  // Bonus pour les réponses longues et détaillées
  if (tokens1.length > 50 && tokens2.length > 50) {
    finalScore += 5;
  }

  // Plafonner
  finalScore = Math.min(100, Math.max(0, finalScore));
  const agreementScore = Math.round(finalScore);

  // Déterminer le verdict avec des seuils plus précis
  let verdict;
  if (agreementScore >= 80) {
    verdict = "fiable";
  } else if (agreementScore >= 60) {
    verdict = "à vérifier";
  } else if (agreementScore >= 40) {
    verdict = "douteux";
  } else {
    verdict = "contradictoire";
  }

  return { 
    agreementScore, 
    verdict,
    details: {
      cosine: Math.round(cosine * 100),
      jaccard: Math.round(jaccard * 100),
      keyInfoScore: Math.round(keyInfoScore),
      sujetBonus
    }
  };
}

/* ===================================================== */
/* ============= FONCTIONS D'EXPORT ==================== */
/* ===================================================== */

export default {
  analyzeResponse,
  crossCheck,
  tokenize,
  tokenizeAdvanced,
  cosineSim,
  jaccardSim,
  extractKeyInfo
};