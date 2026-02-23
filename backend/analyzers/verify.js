function tokenize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function cosineSim(aTokens, bTokens) {
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
  return dot / (Math.sqrt(n1) * Math.sqrt(n2) || 1);
}

export function analyzeResponse(question, answer) {
  const q = tokenize(question).filter(w => w.length > 2);
  const a = tokenize(answer).filter(w => w.length > 2);

  const qSet = new Set(q);
  const aSet = new Set(a);
  const inter = [...qSet].filter(w => aSet.has(w)).length;
  const uni = new Set([...qSet, ...aSet]).size || 1;
  const overlapRatio = inter / uni;

  const wc = tokenize(answer).length;
  const lengthFactor = Math.min(wc / 12, 1);

  const raw = (overlapRatio * 0.85 + lengthFactor * 0.15) * 100;
  const score = Math.round(Math.max(0, Math.min(100, raw)));

  return { score, overlapRatio, answerWordCount: wc, lengthFactor };
}

export function crossCheck(answers) {
  const [a1, a2] = answers;
  const sim = cosineSim(tokenize(a1.answer), tokenize(a2.answer));
  const agreementScore = Math.round(sim * 100);

  const verdict =
    agreementScore >= 75 ? "fiable" :
    agreementScore >= 45 ? "à vérifier" :
    "douteux";

  return { agreementScore, verdict };
}