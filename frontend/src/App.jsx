import { useState } from "react";
import { api } from "./api";
import "./App.css";

/* ---------- BADGE STYLE ---------- */
function badgeClass(verdict) {
  if (verdict === "fiable") return "badge gradient-green";
  if (verdict === "à vérifier") return "badge gradient-orange";
  if (verdict === "douteux") return "badge gradient-red";
  if (verdict === "contradictoire") return "badge gradient-red";
  return "badge gradient-gray";
}

/* ---------- ICÔNES ---------- */
function getVerdictIcon(verdict) {
  if (verdict === "fiable") return "✅";
  if (verdict === "à vérifier") return "⚠️";
  if (verdict === "douteux") return "❌";
  if (verdict === "contradictoire") return "🔥";
  return "ℹ️";
}

/* ---------- CLEAN MARKDOWN ---------- */
function clean(text) {
  if (!text) return "";
  // Enlever les marqueurs d'erreur
  if (text.startsWith("[Erreur")) return text;
  
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/* ---------- TRONQUER TEXTE LONG ---------- */
function truncate(text, maxLength = 300) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("analysis");

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
      console.log("Réponse API:", data); // Pour debug
      setResult(data);
    } catch (err) {
      console.error("Erreur API:", err);
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
    <div className="dashboard">
      {/* Barre latérale gauche */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🔍</span>
            <span className="logo-text">Multi-IA</span>
          </div>
          <div className="sidebar-badge">v2.0</div>
        </div>

        <div className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Analyse</span>
            {result && activeTab !== 'analysis' && <span className="nav-dot" />}
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-label">Historique</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Configuration</span>
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="status-indicator">
            <span className="status-dot online" />
            <span className="status-text">API Connectée</span>
          </div>
          <div className="sidebar-info">
            <span>OpenAI • Gemini</span>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="main-content">
        {/* Barre d'outils */}
        <div className="toolbar">
          <div className="window-controls">
            <span className="window-dot red" />
            <span className="window-dot yellow" />
            <span className="window-dot green" />
          </div>
          <div className="toolbar-title">
            {activeTab === 'analysis' && '🧠 Analyse Multi-IA'}
            {activeTab === 'history' && '📋 Historique des analyses'}
            {activeTab === 'settings' && '⚙️ Paramètres'}
          </div>
          <div className="toolbar-time">
            {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Fenêtre de contenu */}
        <div className="content-window">
          {activeTab === 'analysis' && (
            <div className="analysis-panel">
              {/* Zone de saisie */}
              <div className="input-panel">
                <form onSubmit={onSubmit} className="analysis-form">
                  <div className="input-group">
                    <label className="input-label">
                      <span className="label-icon">💭</span>
                      Posez votre question
                    </label>
                    <textarea
                      placeholder="Ex: Qui est Cristiano Ronaldo ?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      rows={3}
                      className={question.trim() ? "filled" : ""}
                    />
                    <div className="input-footer">
                      <span className="char-count">
                        {question.length} / 500
                      </span>
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="submit-btn"
                      >
                        {loading ? (
                          <>
                            <span className="spinner-small" />
                            Analyse...
                          </>
                        ) : (
                          <>
                            Analyser →
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {result && (
                <div className="results-panel">
                  {/* === SCORE FINAL GLOBAL === */}
                  <div className="score-widget">
                    <div className="score-header">
                      <h2 className="score-title">Score de fiabilité</h2>
                      <span className={`verdict-badge-large ${badgeClass(result.verdict)}`}>
                        {getVerdictIcon(result.verdict)} {result.verdict}
                      </span>
                    </div>

                    <div className="score-main">
                      {/* Cercle de progression */}
                      <div className="score-circle-large">
                        <svg viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="45" className="circle-bg" />
                          <circle 
                            cx="50" cy="50" r="45" 
                            className="circle-progress"
                            style={{
                              strokeDasharray: `${2 * Math.PI * 45}`,
                              strokeDashoffset: `${2 * Math.PI * 45 * (1 - (result.finalScore || 0) / 100)}`,
                            }}
                          />
                        </svg>
                        <span className="score-value">{result.finalScore || 0}%</span>
                      </div>

                      {/* Informations sur l'accord */}
                      <div className="score-details">
                        {result.agreementScore != null ? (
                          <>
                            <div className="agreement-item">
                              <span className="agreement-label">Accord entre IA</span>
                              <span className="agreement-value-large">{result.agreementScore}%</span>
                              <div className="progress-bar-small">
                                <div 
                                  className="progress-fill"
                                  style={{ width: `${result.agreementScore}%` }}
                                />
                              </div>
                            </div>
                            
                            <div className="score-note">
                              <span className="note-icon">ℹ️</span>
                              <span className="note-text">
                                Score final = moyenne du score OpenAI et de l'accord
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="single-model-note">
                            Mode mono-IA (Gemini non disponible)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* === ALERTES CONTEXTUELLES BASÉES SUR LE SCORE FINAL === */}
                  {result.finalScore < 40 && (
                    <div className="alert-card alert-red">
                      <span className="alert-icon-large">🚨</span>
                      <div className="alert-content">
                        <strong>Divergence critique détectée</strong>
                        <p>
                          Score de fiabilité faible ({result.finalScore}%). 
                          {result.agreementScore 
                            ? ` Accord entre IA: ${result.agreementScore}%. ` 
                            : " "}
                          Une vérification manuelle est recommandée.
                        </p>
                      </div>
                    </div>
                  )}

                  {result.finalScore >= 40 && result.finalScore < 65 && (
                    <div className="alert-card alert-orange">
                      <span className="alert-icon-large">⚠️</span>
                      <div className="alert-content">
                        <strong>Vérification recommandée</strong>
                        <p>
                          Score de fiabilité moyen ({result.finalScore}%). 
                          {result.agreementScore 
                            ? ` Accord entre IA: ${result.agreementScore}%. ` 
                            : " "}
                          La réponse est plausible mais nécessite une confirmation.
                        </p>
                      </div>
                    </div>
                  )}

                  {result.finalScore >= 65 && (
                    <div className="alert-card alert-green">
                      <span className="alert-icon-large">✅</span>
                      <div className="alert-content">
                        <strong>Résultat fiable</strong>
                        <p>
                          Score de fiabilité élevé ({result.finalScore}%). 
                          {result.agreementScore 
                            ? ` Accord entre IA: ${result.agreementScore}%. ` 
                            : " "}
                          La réponse est probablement correcte.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* === CARTES DES IA === */}
                  <div className="ia-grid">
                    {/* OpenAI */}
                    <div className="ia-card openai">
                      <div className="ia-card-header">
                        <div className="ia-title">
                          <span className="ia-icon">🧠</span>
                          <h3>OpenAI</h3>
                        </div>
                        <div className="ia-score-badge">
                          Score: {result.openai?.analysis?.score ?? "—"}%
                        </div>
                      </div>
                      <div className="ia-card-body">
                        <p className="ia-response">
                          {result.openai?.answer
                            ? truncate(clean(result.openai.answer), 400)
                            : "—"}
                        </p>
                      </div>
                      {result.openai?.analysis?.details && (
                        <div className="ia-card-footer">
                          <span className="detail-item">
                            📊 Pertinence: {result.openai.analysis.details.pertinence || 0}%
                          </span>
                          <span className="detail-item">
                            📏 Longueur: {result.openai.analysis.wordCount || 0} mots
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Gemini */}
                    <div className="ia-card gemini">
                      <div className="ia-card-header">
                        <div className="ia-title">
                          <span className="ia-icon">🌐</span>
                          <h3>Gemini</h3>
                        </div>
                        {result.gemini && !result.gemini.answer?.startsWith("[Erreur") ? (
                          <div className="ia-badge success">✓ Réponse reçue</div>
                        ) : (
                          <div className="ia-badge warning">⚠️ Non disponible</div>
                        )}
                      </div>
                      <div className="ia-card-body">
                        <p className="ia-response">
                          {result.gemini?.answer
                            ? truncate(clean(result.gemini.answer), 400)
                            : "Gemini non disponible (clé API manquante ou quota dépassé)"}
                        </p>
                      </div>
                      {result.gemini?.answer?.startsWith("[Erreur") && (
                        <div className="ia-card-footer warning">
                          <span>⚠️ Erreur Gemini: veuillez vérifier votre clé API</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* === TEMPS DE RÉPONSE === */}
                  {result.responseTime && (
                    <div className="response-time">
                      ⏱️ Analyse terminée en {result.responseTime}ms
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="history-panel">
              <div className="empty-state">
                <span className="empty-icon">📋</span>
                <h3>Aucun historique</h3>
                <p>Les analyses apparaîtront ici</p>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-panel">
              <div className="settings-group">
                <h4>Configuration des API</h4>
                <div className="setting-item">
                  <span className="setting-label">OpenAI</span>
                  <span className="setting-value success">✓ Configuré</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Gemini</span>
                  <span className="setting-value warning">Clé manquante</span>
                </div>
              </div>
              
              <div className="settings-group">
                <h4>Informations</h4>
                <div className="setting-item">
                  <span className="setting-label">Version</span>
                  <span className="setting-value">2.0.0</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Modèles</span>
                  <span className="setting-value">GPT-4o-mini / Gemini-Pro</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}