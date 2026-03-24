import { useState, useEffect, useRef } from "react";
import { api } from "./api";
import "./App.css";
import { useAuth } from './context/AuthContext';
import LoginModal from './components/LoginModal';
import { useTheme } from './context/ThemeContext';

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

/* ---------- COMPOSANT STATS ---------- */
function StatsCard({ icon, label, value, color }) {
  return (
    <div className="stats-card" style={{ '--stats-color': color }}>
      <span className="stats-icon" style={{ background: `${color}20`, color }}>{icon}</span>
      <div className="stats-info">
        <span className="stats-label">{label}</span>
        <span className="stats-value" style={{ color }}>{value}</span>
      </div>
    </div>
  );
}

/* ---------- COMPOSANT BOUTON UTILISATEUR ---------- */
function UserButton({ onClick }) {
  const { user, logout } = useAuth();
  
  const getInitials = () => {
    if (!user) return '';
    const first = user.firstName?.charAt(0).toUpperCase() || '';
    const last = user.lastName?.charAt(0).toUpperCase() || '';
    return `${first}${last}`;
  };

  const getAvatarColor = () => {
    if (!user?.email) return '#3b82f6';
    
    const hash = user.email.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    const colors = [
      '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'
    ];
    
    return colors[hash % colors.length];
  };
  
  if (user) {
    return (
      <div className="user-menu">
        <div className="user-info">
          <div 
            className="user-avatar" 
            style={{ backgroundColor: getAvatarColor() }}
          >
            {getInitials()}
          </div>
          <div className="user-details">
            <div className="user-name">
              {user.firstName} {user.lastName}
            </div>
            <div className="user-email">{user.email}</div>
          </div>
        </div>
        <button onClick={logout} className="logout-btn">
          <span>🚪</span>
          Déconnexion
        </button>
      </div>
    );
  }
  
  return (
    <button onClick={onClick} className="login-btn">
      <span>🔑</span>
      Connexion
    </button>
  );
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("analysis");
  const [history, setHistory] = useState([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedModel, setSelectedModel] = useState('chatgpt');
  const [stats] = useState({
    totalQueries: 0,
    avgScore: 0,
    reliabilityRate: 0
  });
  
  const { user, isAuthenticated } = useAuth();
  const resultsRef = useRef(null);
  const contentWindowRef = useRef(null);
  const { darkMode, toggleTheme } = useTheme();

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await api.get('/api/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(data);
    } catch (error) {
      console.error("Erreur chargement historique:", error);
    }
  };

  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  useEffect(() => {
    const handleScroll = () => {
      if (contentWindowRef.current) {
        setShowScrollTop(contentWindowRef.current.scrollTop > 300);
      }
    };
    
    const currentRef = contentWindowRef.current;
    if (currentRef) {
      currentRef.addEventListener("scroll", handleScroll);
      return () => currentRef.removeEventListener("scroll", handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    if (contentWindowRef.current) {
      contentWindowRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setShowDetails(false);

    if (!question.trim() || question.trim().length < 5) {
      setError("La question doit contenir au moins 5 caractères.");
      return;
    }

    setLoading(true);
    try {
      const config = isAuthenticated 
        ? { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}
        : {};
      
      const { data } = await api.post("/api/verify", { 
        question,
        model: selectedModel 
      }, config);
      
      console.log("Réponse API:", data);
      
      if (data.openai?.answer && data.gemini?.answer && !data.gemini.answer?.startsWith("[Erreur")) {
        try {
          console.log("🔍 Appel au juge GPT...");
          const judgeResponse = await api.post('/api/judge/evaluate', {
            question,
            answerA: data.openai.answer,
            answerB: data.gemini.answer
          }, config);
          
          console.log("✅ Évaluation GPT reçue:", judgeResponse.data);
          
          if (judgeResponse.data) {
            data.gptEvaluation = judgeResponse.data;
            
            const algoFinalScore = data.finalScore;
            const algoAgreement = data.agreementScore;
            
            data.finalScore = Math.round((algoFinalScore + judgeResponse.data.fiabilite) / 2);
            data.agreementScore = Math.round((algoAgreement + judgeResponse.data.accord) / 2);
            data.verdict = judgeResponse.data.verdict;
          }
        } catch (judgeError) {
          console.error("❌ Erreur juge GPT:", judgeError);
        }
      }
      
      setResult(data);
      
      if (isAuthenticated) {
        try {
          await api.post('/api/history', {
            question: data.question,
            finalScore: data.finalScore,
            verdict: data.verdict,
            agreementScore: data.agreementScore,
            openaiAnswer: data.openai?.answer,
            openaiScore: data.openai?.analysis?.score,
            geminiAnswer: data.gemini?.answer,
            geminiAvailable: !!data.gemini,
            responseTime: data.responseTime
          }, config);
          
          fetchHistory();
        } catch (historyError) {
          console.error("Erreur sauvegarde historique:", historyError);
        }
      } else {
        const newHistoryItem = {
          id: Date.now(),
          question,
          finalScore: data.finalScore,
          verdict: data.verdict,
          timestamp: new Date().toLocaleString()
        };
        setHistory(prev => [newHistoryItem, ...prev].slice(0, 10));
      }
      
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

  const clearHistory = async () => {
    if (isAuthenticated) {
      try {
        const token = localStorage.getItem('token');
        await api.delete('/api/history', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistory([]);
      } catch (error) {
        console.error("Erreur suppression historique:", error);
      }
    } else {
      setHistory([]);
    }
  };

  return (
    <div className="dashboard">
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      {showScrollTop && (
        <button className="scroll-top-btn" onClick={scrollToTop}>
          ↑
        </button>
      )}

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
            {history.length > 0 && <span className="nav-badge">{history.length}</span>}
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <span className="nav-icon">📈</span>
            <span className="nav-label">Statistiques</span>
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
          <UserButton onClick={() => setShowLogin(true)} />
          <div className="status-indicator">
            <span className="status-dot online" />
            <span className="status-text">API Connectée</span>
          </div>
          <div className="sidebar-info">
            <span>OpenAI • Gemini</span>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="toolbar">
          <div className="window-controls">
            <span className="window-dot red" />
            <span className="window-dot yellow" />
            <span className="window-dot green" />
          </div>
          <div className="toolbar-title">
            {activeTab === 'analysis' && '🧠 Analyse Multi-IA'}
            {activeTab === 'history' && '📋 Historique des analyses'}
            {activeTab === 'stats' && '📈 Statistiques'}
            {activeTab === 'settings' && '⚙️ Paramètres'}
          </div>
          
          <button 
            onClick={toggleTheme}
            className="theme-toggle"
            title={darkMode ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          
          <div className="toolbar-time">
            {new Date().toLocaleTimeString()}
          </div>
        </div>

        <div className="content-window" ref={contentWindowRef}>
          {activeTab === 'analysis' && (
            <div className="analysis-panel">
              <div className="input-panel">
                <form onSubmit={onSubmit} className="analysis-form">
                  <div className="input-group">
                    <label className="input-label">
                      <span className="label-icon">💭</span>
                      Posez votre question
                    </label>
                    
                    {/* SÉLECTEUR DE MODÈLE */}
                    <div className="model-selector">
                      <span className="model-selector-label">Choisir le modèle :</span>
                      <div className="model-options">
                        <label className={`model-option ${selectedModel === 'chatgpt' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="model"
                            value="chatgpt"
                            checked={selectedModel === 'chatgpt'}
                            onChange={() => setSelectedModel('chatgpt')}
                          />
                          <span className="model-icon">🧠</span>
                          <span className="model-name">ChatGPT</span>
                        </label>
                        
                        <label className={`model-option ${selectedModel === 'gemini' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="model"
                            value="gemini"
                            checked={selectedModel === 'gemini'}
                            onChange={() => setSelectedModel('gemini')}
                          />
                          <span className="model-icon">🌐</span>
                          <span className="model-name">Gemini</span>
                        </label>
                      </div>
                    </div>

                    <div className="textarea-wrapper">
                      <textarea
                        placeholder="Ex: Qui est Cristiano Ronaldo ?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        rows={3}
                        className={question.trim() ? "filled" : ""}
                      />
                      <div className="textarea-glow" />
                    </div>
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
                            Analyse en cours...
                          </>
                        ) : (
                          "Analyser"
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                <div className="suggestions">
                  <span className="suggestions-label">Suggestions:</span>
                  <button 
                    className="suggestion-chip"
                    onClick={() => setQuestion("Qui est Lionel Messi ?")}
                  >
                    ⚽ Qui est Messi ?
                  </button>
                  <button 
                    className="suggestion-chip"
                    onClick={() => setQuestion("Quelle est la capitale de la France ?")}
                  >
                    🏛️ Capitale de la France
                  </button>
                  <button 
                    className="suggestion-chip"
                    onClick={() => setQuestion("Théorie de la relativité")}
                  >
                    🔬 Théorie de la relativité
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-message animate-shake">
                  <span className="error-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {result && (
                <div className="results-panel" ref={resultsRef}>
                  {/* RÉSULTAT SIMPLIFIÉ - Affiche UNIQUEMENT la réponse du modèle choisi */}
                  <div className="result-simple">
                    <div className="result-verdict">
                      <span className={`verdict-badge-large ${badgeClass(result.verdict)}`}>
                        {getVerdictIcon(result.verdict)} {result.verdict}
                      </span>
                      <span className="result-score">{result.finalScore}%</span>
                    </div>
                    
                    <div className="result-answer">
                      <p>
                        {selectedModel === 'chatgpt' 
                          ? truncate(clean(result.openai?.answer), 400)
                          : truncate(clean(result.gemini?.answer), 400)
                        }
                      </p>
                    </div>
                    
                    <button 
                      className="details-toggle-btn"
                      onClick={() => setShowDetails(!showDetails)}
                    >
                      {showDetails ? 'Masquer détails' : 'Voir détails'}
                    </button>
                  </div>

                  {/* DÉTAILS - Affiche les DEUX réponses + accord + évaluation GPT */}
                  {showDetails && (
                    <div className="details-panel">
                      <h3>📊 Analyse détaillée</h3>
                      
                      {/* Score détaillé */}
                      <div className="score-widget">
                        <div className="score-header">
                          <h2 className="score-title">Score de fiabilité</h2>
                          <span className={`verdict-badge-large ${badgeClass(result.verdict)}`}>
                            {getVerdictIcon(result.verdict)} {result.verdict}
                          </span>
                        </div>

                        <div className="score-main">
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
                                Mode mono-IA (impossible de calculer l'accord)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Évaluation GPT */}
                      {result.gptEvaluation && (
                        <div className="gpt-evaluation-card">
                          <div className="gpt-header">
                            <span className="gpt-icon">🤖</span>
                            <h3>Analyse approfondie</h3>
                          </div>
                          <p className="gpt-explanation">{result.gptEvaluation.explication}</p>
                          {result.gptEvaluation.points_communs && result.gptEvaluation.points_communs.length > 0 && (
                            <div className="gpt-points">
                              <strong>Points communs :</strong>
                              <ul>
                                {result.gptEvaluation.points_communs.map((point, i) => (
                                  <li key={i}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.gptEvaluation.divergences && result.gptEvaluation.divergences.length > 0 && (
                            <div className="gpt-divergences">
                              <strong>Divergences :</strong>
                              <ul>
                                {result.gptEvaluation.divergences.map((div, i) => (
                                  <li key={i}>{div}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Alertes contextuelles */}
                      {result.finalScore < 40 && (
                        <div className="alert-card alert-red animate-slideIn">
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
                        <div className="alert-card alert-orange animate-slideIn">
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
                        <div className="alert-card alert-green animate-slideIn">
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

                      {/* Cartes IA - Les DEUX réponses */}
                      <div className="ia-grid">
                        <div className="ia-card openai animate-scaleIn">
                          <div className="ia-card-header">
                            <div className="ia-title">
                              <span className="ia-icon">🧠</span>
                              <h3>OpenAI</h3>
                            </div>
                            <div className="ia-badge success">
                              <span className="badge-dot" /> Réponse reçue
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
                              <div className="footer-stats">
                                <span className="detail-item" title="Pertinence">
                                  <span>📊</span> {result.openai.analysis.details.pertinence || 0}%
                                </span>
                                <span className="detail-item" title="Longueur">
                                  <span>📏</span> {result.openai.analysis.wordCount || 0} mots
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="ia-card gemini animate-scaleIn">
                          <div className="ia-card-header">
                            <div className="ia-title">
                              <span className="ia-icon">🌐</span>
                              <h3>Gemini</h3>
                            </div>
                            {result.gemini && !result.gemini.answer?.startsWith("[Erreur") ? (
                              <div className="ia-badge success">
                                <span className="badge-dot" /> Réponse reçue
                              </div>
                            ) : (
                              <div className="ia-badge warning">
                                <span className="badge-dot warning" /> Non disponible
                              </div>
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
                              <span>⚠️ Erreur Gemini: vérifiez votre clé API</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="response-meta">
                        {result.responseTime && (
                          <span className="response-time">
                            ⏱️ {result.responseTime}ms
                          </span>
                        )}
                        <span className="response-id">
                          🆔 {Math.random().toString(36).substring(2, 8).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="history-panel">
              {history.length > 0 ? (
                <>
                  <div className="history-header">
                    <h3>Historique des analyses</h3>
                    <button className="clear-history-btn" onClick={clearHistory}>
                      🗑️ Effacer
                    </button>
                  </div>
                  <div className="history-list">
                    {history.map((item) => (
                      <div key={item.id || item._id} className="history-item">
                        <div className="history-item-header">
                          <span className="history-question">"{item.question}"</span>
                          <span className={`history-verdict ${badgeClass(item.verdict)}`}>
                            {item.finalScore}%
                          </span>
                        </div>
                        <div className="history-item-footer">
                          <span className="history-time">
                            {item.timestamp || new Date(item.createdAt).toLocaleString()}
                          </span>
                          <span className="history-verdict-text">{item.verdict}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">📋</span>
                  <h3>Aucun historique</h3>
                  <p>
                    {isAuthenticated 
                      ? "Vos analyses apparaîtront ici"
                      : "Connectez-vous pour sauvegarder votre historique"}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="stats-panel">
              <h3>Statistiques d'utilisation</h3>
              
              <div className="stats-grid">
                <StatsCard 
                  icon="🔢"
                  label="Requêtes totales"
                  value={history.length}
                  color="#3b82f6"
                />
                <StatsCard 
                  icon="📊"
                  label="Score moyen"
                  value={history.length > 0 
                    ? Math.round(history.reduce((acc, item) => acc + item.finalScore, 0) / history.length) + '%'
                    : '—'}
                  color="#8b5cf6"
                />
                <StatsCard 
                  icon="✅"
                  label="Taux de fiabilité"
                  value={history.length > 0
                    ? Math.round((history.filter(item => item.finalScore >= 65).length / history.length) * 100) + '%'
                    : '—'}
                  color="#22c55e"
                />
                <StatsCard 
                  icon="⚠️"
                  label="À vérifier"
                  value={history.filter(item => item.finalScore >= 40 && item.finalScore < 65).length}
                  color="#f59e0b"  
                />
              </div>

              <div className="stats-chart-placeholder">
                <div className="chart-message">
                  📈 Graphique d'évolution des scores (à venir)
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-panel">
              <div className="settings-group">
                <h4>Configuration des API</h4>
                <div className="setting-item">
                  <span className="setting-label">OpenAI</span>
                  <span className="setting-value success">
                    <span className="status-badge success" /> Configuré
                  </span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Gemini</span>
                  <span className="setting-value success">
                  <span className="status-badge success" /> Configuré
                  </span>
                </div>
              </div>
              
              <div className="settings-group">
                <h4>Préférences d'affichage</h4>
                <div className="setting-item">
                  <span className="setting-label">Mode sombre</span>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Animations</span>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider" />
                  </label>
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
                <div className="setting-item">
                  <span className="setting-label">Dernière mise à jour</span>
                  <span className="setting-value">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}