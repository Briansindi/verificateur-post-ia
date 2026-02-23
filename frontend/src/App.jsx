import { useState } from "react";
import { api } from "./api";
import "./App.css";

/* ---------- BADGE STYLE ---------- */
function badgeClass(verdict) {
  if (verdict === "fiable") return "badge green";
  if (verdict === "à vérifier") return "badge orange";
  if (verdict === "douteux") return "badge red";
  return "badge gray";
}

/* ---------- CLEAN MARKDOWN ---------- */
function clean(text) {
  return (text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1") // remove **bold**
    .replace(/`([^`]+)`/g, "$1")     // remove `code`
    .replace(/\n{2,}/g, "\n")       // collapse extra line breaks
    .trim();
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!question.trim() || question.trim().length < 5) {
      setError("La question doit contenir au moins 5 caractères.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/api/verify", { question });
      setResult(data);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
        err?.message ||
        "Erreur inconnue"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>🔍 Vérificateur Multi-IA</h1>
      <p className="subtitle">
        Score final + accord entre OpenAI et Gemini + réponses par IA.
      </p>

      <form onSubmit={onSubmit} className="form">
        <textarea
          placeholder="Pose ta question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Analyse..." : "Analyser"}
        </button>
      </form>

      {error && <div className="error">⚠️ {error}</div>}

      {result && (
        <>
          {/* -------- SCORE FINAL -------- */}
          <div className="scoreBox">
            <div className="scoreLine">
              <h2>Score final : {result.finalScore}%</h2>

              {result.agreementScore != null ? (
                <span className={badgeClass(result.verdict)}>
                  Accord : {result.agreementScore}% — {result.verdict}
                </span>
              ) : (
                <span className="badge gray">
                  Mode : single-model
                </span>
              )}
            </div>

            {/* -------- ALERTES -------- */}
            {result.verdict === "douteux" && (
              <div className="alert red">
                🚨 Les IA divergent : recoupe avec une source fiable.
              </div>
            )}

            {result.verdict === "à vérifier" && (
              <div className="alert orange">
                🟠 Réponse plausible mais à confirmer.
              </div>
            )}

            {result.verdict === "fiable" && (
              <div className="alert green">
                🟢 Bon accord entre IA : réponse plutôt fiable.
              </div>
            )}
          </div>

          {/* -------- CARTES IA -------- */}
          <div className="cards">
            {/* OpenAI */}
            <div className="card">
              <h3>🧠 OpenAI</h3>
              <p className="answer">
                {result.openai?.answer
                  ? clean(result.openai.answer)
                  : "—"}
              </p>
              <p className="meta">
                Score local : {result.openai?.analysis?.score ?? "—"}%
              </p>
            </div>

            {/* Gemini */}
            <div className="card">
              <h3>🌐 Gemini</h3>
              <p className="answer">
                {result.gemini?.answer
                  ? clean(result.gemini.answer)
                  : "Gemini non disponible (quota ou clé manquante)."}
              </p>
              <p className="meta">
                {result.gemini
                  ? "Réponse Gemini reçue"
                  : "Ajoute GEMINI_API_KEY dans backend/.env ou vérifie le quota Google."}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}