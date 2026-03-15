import { useState } from "react";
import { api } from "./api";
import "./App.css";

/* ---------- BADGE STYLE ---------- */
function badgeClass(verdict) {
  if (verdict === "fiable") return "badge gradient-green";
  if (verdict === "à vérifier") return "badge gradient-orange";
  if (verdict === "douteux") return "badge gradient-red";
  return "badge gradient-gray";
}

/* ---------- ICÔNES ---------- */
function getVerdictIcon(verdict) {
  if (verdict === "fiable") return "✅";
  if (verdict === "à vérifier") return "⚠️";
  if (verdict === "douteux") return "❌";
  return "ℹ️";
}

/* ---------- CLEAN MARKDOWN ---------- */
function clean(text) {
  return (text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("analysis"); // analysis, history, settings

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
      setActiveTab("analysis"); // Reste sur l'onglet analyse après soumission
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
    <div className="dashboard">
      {/* Barre latérale gauche - Fenêtre de navigation */}
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
        {/* Barre d'outils supérieure */}
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
                      placeholder="Ex: Est-ce que la terre est ronde ?"
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
                            Analyser
                            <svg className="btn-icon" viewBox="0 0 24 24">
                              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none"/>
                            </svg>
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
                  {/* Score principal */}
                  <div className="score-widget">
                    <div className="score-main">
                      <div className="score-circle-large">
                        <svg viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="45" className="circle-bg" />
                          <circle 
                            cx="50" cy="50" r="45" 
                            className="circle-progress"
                            style={{
                              strokeDasharray: `${2 * Math.PI * 45}`,
                              strokeDashoffset: `${2 * Math.PI * 45 * (1 - result.finalScore / 100)}`,
                            }}
                          />
                        </svg>
                        <span className="score-value">{result.finalScore}%</span>
                      </div>
                      <div className="score-info">
                        <span className={`verdict-badge ${badgeClass(result.verdict)}`}>
                          {getVerdictIcon(result.verdict)} {result.verdict}
                        </span>
                        {result.agreementScore != null && (
                          <div className="agreement-info">
                            <span className="agreement-label">Accord entre IA</span>
                            <span className="agreement-value">{result.agreementScore}%</span>
                            <div className="agreement-bar">
                              <div 
                                className="agreement-fill"
                                style={{ width: `${result.agreementScore}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Alertes contextuelles */}
                  {result.verdict === "douteux" && (
                    <div className="alert-card alert-red">
                      <span className="alert-icon-large">🚨</span>
                      <div className="alert-content">
                        <strong>Divergence critique détectée</strong>
                        <p>Les IA ne sont pas d'accord. Une vérification manuelle est recommandée.</p>
                      </div>
                    </div>
                  )}

                  {result.verdict === "à vérifier" && (
                    <div className="alert-card alert-orange">
                      <span className="alert-icon-large">⚠️</span>
                      <div className="alert-content">
                        <strong>Vérification recommandée</strong>
                        <p>La réponse est plausible mais nécessite une confirmation.</p>
                      </div>
                    </div>
                  )}

                  {result.verdict === "fiable" && (
                    <div className="alert-card alert-green">
                      <span className="alert-icon-large">✅</span>
                      <div className="alert-content">
                        <strong>Résultat fiable</strong>
                        <p>Les deux IA sont en accord sur cette réponse.</p>
                      </div>
                    </div>
                  )}

                  {/* Cartes des IA */}
                  <div className="ia-grid">
                    {/* OpenAI */}
                    <div className="ia-card openai">
                      <div className="ia-card-header">
                        <div className="ia-title">
                          <span className="ia-icon">🧠</span>
                          <h3>OpenAI</h3>
                        </div>
                        <div className="ia-score">
                          Score: {result.openai?.analysis?.score ?? "—"}%
                        </div>
                      </div>
                      <div className="ia-card-body">
                        <p className="ia-response">
                          {result.openai?.answer
                            ? clean(result.openai.answer)
                            : "—"}
                        </p>
                      </div>
                      {!result.openai && (
                        <div className="ia-card-footer warning">
                          <span>⚠️ Configuration OpenAI manquante</span>
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
                        {result.gemini && (
                          <div className="ia-badge success">✓ Active</div>
                        )}
                      </div>
                      <div className="ia-card-body">
                        <p className="ia-response">
                          {result.gemini?.answer
                            ? clean(result.gemini.answer)
                            : "Gemini non disponible (clé API manquante ou quota dépassé)"}
                        </p>
                      </div>
                      {!result.gemini && (
                        <div className="ia-card-footer warning">
                          <span>⚠️ Ajoutez GEMINI_API_KEY dans .env</span>
                        </div>
                      )}
                    </div>
                  </div>
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
                  <span className="setting-value">✓ Configuré</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Gemini</span>
                  <span className="setting-value warning">Clé manquante</span>
                </div>
              </div>
              
              <div className="settings-group">
                <h4>Préférences</h4>
                <div className="setting-item">
                  <span className="setting-label">Mode sombre</span>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}