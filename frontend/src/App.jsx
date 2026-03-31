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

/* ---------- COMPOSANT MESSAGE ---------- */
function Message({ role, content, score, verdict, showDetails, onToggleDetails }) {
  const isUser = role === "user";
  
  return (
    <div className={`chat-message ${isUser ? "user" : "assistant"}`}>
      <div className="message-avatar">
        {isUser ? "👤" : "🤖"}
      </div>
      <div className="message-content">
        <div className="message-text">{content}</div>
        {!isUser && score !== undefined && (
  <div className="message-footer">
    <div className="score-bar-container">
      <div className="score-bar-label">
        <span>Fiabilité</span>
        <span className="score-percentage">{score}%</span>
      </div>
      <div className="score-bar">
        <div 
          className="score-bar-fill" 
          style={{ 
            width: `${score}%`,
            background: `linear-gradient(90deg, 
              ${score < 40 ? '#ef4444' : score < 70 ? '#f59e0b' : '#22c55e'}, 
              ${score < 40 ? '#dc2626' : score < 70 ? '#d97706' : '#16a34a'})`
          }}
        />
      </div>
    </div>
    <button 
      className="message-details-btn"
      onClick={onToggleDetails}
    >
      {showDetails ? "Masquer" : "Voir"} détails
    </button>
  </div>
)}
      </div>
    </div>
  );
}

/* ---------- COMPOSANT DÉTAILS ---------- */
function DetailsPanel({ result, onClose }) {
  return (
    <div className="details-modal">
      <div className="details-modal-header">
        <h3>📊 Analyse détaillée</h3>
        <button onClick={onClose} className="details-modal-close">✕</button>
      </div>
      
      <div className="score-widget">
        <div className="score-header">
          <h2 className="score-title">Score de fiabilité</h2>
          <span className={`verdict-badge-large ${badgeClass(result.verdict)}`}>
            {getVerdictIcon(result.verdict)} {result.verdict} ({result.finalScore}%)
          </span>
        </div>
        
        {result.agreementScore != null && (
          <div className="agreement-item">
            <span className="agreement-label">Accord entre IA</span>
            <span className="agreement-value-large">{result.agreementScore}%</span>
            <div className="progress-bar-small">
              <div className="progress-fill" style={{ width: `${result.agreementScore}%` }} />
            </div>
          </div>
        )}
      </div>
      
      <div className="all-responses">
        <h4>Toutes les réponses des IA</h4>
        
        {result.openai && (
          <div className="response-card">
            <div className="response-card-header">🧠 ChatGPT</div>
            <div className="response-card-body">{clean(result.openai.answer)}</div>
          </div>
        )}
        
        {result.gemini && (
          <div className="response-card">
            <div className="response-card-header">🌐 Gemini</div>
            <div className="response-card-body">{clean(result.gemini.answer)}</div>
          </div>
        )}
        
        {result.mistral && (
          <div className="response-card">
            <div className="response-card-header">🐋 Mistral</div>
            <div className="response-card-body">{clean(result.mistral.answer)}</div>
          </div>
        )}
        
        {result.llama && (
          <div className="response-card">
            <div className="response-card-header">🦙 Llama 3</div>
            <div className="response-card-body">{clean(result.llama.answer)}</div>
          </div>
        )}
      </div>
      
      {result.gptEvaluation && (
        <div className="gpt-evaluation-card">
          <div className="gpt-header">
            <span className="gpt-icon">🤖</span>
            <h3>Analyse approfondie</h3>
          </div>
          <p className="gpt-explanation">{result.gptEvaluation.explication}</p>
        </div>
      )}
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
    const hash = user.email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
    return colors[hash % colors.length];
  };
  
  if (user) {
    return (
      <div className="user-menu">
        <div className="user-info">
          <div className="user-avatar" style={{ backgroundColor: getAvatarColor() }}>
            {getInitials()}
          </div>
          <div className="user-details">
            <div className="user-name">{user.firstName} {user.lastName}</div>
            <div className="user-email">{user.email}</div>
          </div>
        </div>
        <button onClick={logout} className="logout-btn">
          🚪 Déconnexion
        </button>
      </div>
    );
  }
  
  return (
    <button onClick={onClick} className="login-btn">
      🔑 Connexion
    </button>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("analysis");
  const [history, setHistory] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [selectedModel, setSelectedModel] = useState('chatgpt');
  const [showDetailsFor, setShowDetailsFor] = useState(null);
  const [savedConversations, setSavedConversations] = useState({});
  const [currentConvId, setCurrentConvId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const { user, isAuthenticated } = useAuth();
  const { darkMode, toggleTheme } = useTheme();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // Sauvegarder la conversation actuelle dans localStorage
  const saveCurrentConversation = () => {
    if (messages.length > 0 && currentConvId) {
      const title = messages[0]?.content?.substring(0, 30) || "Nouvelle conversation";
      setSavedConversations(prev => ({
        ...prev,
        [currentConvId]: {
          model: selectedModel,
          messages: messages,
          title: title,
          date: new Date().toLocaleString()
        }
      }));
    }
  };

  // Changer de modèle avec nouvelle conversation
  const handleModelChange = (modelId) => {
    if (modelId === selectedModel) return;
    
    saveCurrentConversation();
    
    const newId = Date.now().toString();
    setCurrentConvId(newId);
    setMessages([]);
    setShowDetailsFor(null);
    setSelectedModel(modelId);
  };

  // Charger une conversation sauvegardée
  const loadConversation = (convId, conv) => {
    saveCurrentConversation();
    setCurrentConvId(convId);
    setMessages(conv.messages);
    setSelectedModel(conv.model);
  };

  // Nouvelle conversation manuelle
  const newConversation = () => {
    saveCurrentConversation();
    const newId = Date.now().toString();
    setCurrentConvId(newId);
    setMessages([]);
    setShowDetailsFor(null);
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    
    if (!currentConvId) {
      const newId = Date.now().toString();
      setCurrentConvId(newId);
    }
    
    const userMessage = input.trim();
    setInput("");
    setError("");
    
    const userMsgObj = { role: "user", content: userMessage };
    setMessages(prev => [...prev, userMsgObj]);
    setLoading(true);
    
    try {
      const config = isAuthenticated 
        ? { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}
        : {};
      
      const { data } = await api.post("/api/verify", { 
        question: userMessage
      }, config);
      
      console.log("Réponse API:", data);
      
      if (data.openai?.answer && data.gemini?.answer && !data.gemini.answer?.startsWith("[Erreur")) {
        try {
          const judgeResponse = await api.post('/api/judge/evaluate', {
            question: userMessage,
            answerA: data.openai.answer,
            answerB: data.gemini.answer
          }, config);
          
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
      
      let assistantContent = "";
      if (selectedModel === 'chatgpt' && data.openai?.answer) {
        assistantContent = data.openai.answer;
      } else if (selectedModel === 'gemini' && data.gemini?.answer) {
        assistantContent = data.gemini.answer;
      } else if (selectedModel === 'mistral' && data.mistral?.answer) {
        assistantContent = data.mistral.answer;
      } else if (selectedModel === 'llama' && data.llama?.answer) {
        assistantContent = data.llama.answer;
      } else {
        assistantContent = data.openai?.answer || data.gemini?.answer || "Désolé, une erreur est survenue.";
      }
      
      const assistantMsgObj = { 
        role: "assistant", 
        content: assistantContent,
        score: data.finalScore,
        verdict: data.verdict,
        fullData: data
      };
      
      const updatedMessages = [...messages, userMsgObj, assistantMsgObj];
      setMessages(updatedMessages);
      
      // 🔥 SAUVEGARDER TOUTE LA CONVERSATION DANS L'HISTORIQUE
      if (isAuthenticated) {
        try {
          // Récupérer les conversations existantes ou créer une nouvelle
          const existingConv = savedConversations[currentConvId];
          
          await api.post('/api/history', {
            // Sauvegarde une "conversation" complète
            conversationId: currentConvId,
            title: updatedMessages[0]?.content?.substring(0, 50) || "Nouvelle conversation",
            modelUsed: selectedModel,
            messages: updatedMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
              score: msg.score,
              verdict: msg.verdict
            })),
            finalScore: data.finalScore,
            verdict: data.verdict,
            agreementScore: data.agreementScore,
            openaiAnswer: data.openai?.answer,
            geminiAnswer: data.gemini?.answer,
            mistralAnswer: data.mistral?.answer,
            llamaAnswer: data.llama?.answer
          }, config);
          
          fetchHistory();
        } catch (historyError) {
          console.error("Erreur sauvegarde conversation:", historyError);
        }
      }
      
      // Sauvegarde locale
      saveCurrentConversation();
      
    } catch (err) {
      console.error("Erreur API:", err);
      setError(err?.response?.data?.error || err?.message || "Erreur inconnue");
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Désolé, une erreur est survenue. Veuillez réessayer.",
        score: 0,
        verdict: "douteux"
      }]);
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
        setSavedConversations({});
        setCurrentConvId(null);
        setMessages([]);
      } catch (error) {
        console.error("Erreur suppression:", error);
      }
    } else {
      setSavedConversations({});
      setCurrentConvId(null);
      setMessages([]);
    }
  };

  const models = [
    { id: 'chatgpt', name: 'ChatGPT', icon: '🧠' },
    { id: 'gemini', name: 'Gemini', icon: '🌐' },
    { id: 'mistral', name: 'Mistral', icon: '🐋' },
    { id: 'llama', name: 'Llama 3', icon: '🦙' }
  ];

  const recentConversations = Object.entries(savedConversations).slice(-5).reverse();

  return (
    <div className={`dashboard model-${selectedModel}`}>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">💬</span>
            <span className="logo-text">Multi-IA Chat</span>
          </div>
          <div className="sidebar-badge">v3.0</div>
        </div>

        <div className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-label">Chat</span>
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
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Configuration</span>
          </button>
        </div>

        {/* Conversations récentes */}
        {recentConversations.length > 0 && (
          <div className="conversations-list">
            <div className="conversations-header">
              <span>📁 Conversations récentes</span>
              <button onClick={newConversation} className="new-conv-btn">+ Nouvelle</button>
            </div>
            {recentConversations.map(([id, conv]) => (
              <div 
                key={id} 
                className={`conversation-item ${currentConvId === id ? 'active' : ''}`}
                onClick={() => loadConversation(id, conv)}
              >
                <span className="conv-icon">💬</span>
                <div className="conv-info">
                  <span className="conv-title">{conv.title}</span>
                  <span className="conv-model">{conv.model}</span>
                  <span className="conv-date">{conv.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-footer">
          <UserButton onClick={() => setShowLogin(true)} />
          <div className="status-indicator">
            <span className="status-dot online" />
            <span className="status-text">API Connectée</span>
          </div>
          <div className="sidebar-info">
            <span>4 modèles IA</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        <div className="toolbar">
          <div className="window-controls">
            <span className="window-dot red" />
            <span className="window-dot yellow" />
            <span className="window-dot green" />
          </div>
          <div className="toolbar-title">
            💬 Assistant Multi-IA
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

        <div className="chat-container" ref={chatContainerRef}>
          {activeTab === 'analysis' && (
            <>
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="chat-welcome">
                    <div className="welcome-icon">💬</div>
                    <h2>Assistant Multi-IA</h2>
                    <p>Choisissez un modèle et posez votre question</p>
                    <div className="welcome-models">
                      {models.map(m => (
                        <span key={m.id} className="welcome-model">{m.icon} {m.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {messages.map((msg, idx) => (
                  <Message
                    key={idx}
                    role={msg.role}
                    content={msg.content}
                    score={msg.score}
                    verdict={msg.verdict}
                    showDetails={showDetailsFor === idx}
                    onToggleDetails={() => setShowDetailsFor(showDetailsFor === idx ? null : idx)}
                  />
                ))}
                
                {loading && (
                  <div className="chat-message assistant">
                    <div className="message-avatar">🤖</div>
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
              
              <div className="chat-input-area">
                <div className="model-selector-bar">
                  {models.map(model => (
                    <button
                      key={model.id}
                      className={`model-chip ${selectedModel === model.id ? 'active' : ''}`}
                      onClick={() => handleModelChange(model.id)}
                    >
                      {model.icon} {model.name}
                    </button>
                  ))}
                </div>
                
                <form onSubmit={sendMessage} className="chat-form">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Écrivez votre message... (${selectedModel})`}
                    disabled={loading}
                    className="chat-input"
                  />
                  <button type="submit" disabled={loading} className="chat-send-btn">
                    {loading ? "⏳" : "➤"}
                  </button>
                </form>
                
                {error && <div className="chat-error">{error}</div>}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="history-panel">
              {history.length > 0 ? (
                <>
                  <div className="history-header">
                    <h3>📋 Historique des conversations</h3>
                    <button className="clear-history-btn" onClick={clearHistory}>
                      🗑️ Effacer
                    </button>
                  </div>
                  <div className="history-list">
                    {history.map((item) => (
                      <div key={item._id} className="history-item" onClick={() => {
                        // Charger une conversation depuis l'historique
                        if (item.messages) {
                          const convId = item.conversationId || Date.now().toString();
                          setCurrentConvId(convId);
                          setMessages(item.messages);
                          setSelectedModel(item.modelUsed || selectedModel);
                          setActiveTab('analysis');
                        }
                      }}>
                        <div className="history-item-header">
                          <span className="history-question">💬 {item.title || item.question?.substring(0, 40)}</span>
                          <span className={`history-verdict ${badgeClass(item.verdict)}`}>
                            {item.finalScore}%
                          </span>
                        </div>
                        <div className="history-item-footer">
                          <span className="history-time">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                          <span className="history-verdict-text">{item.modelUsed || item.verdict}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">📋</span>
                  <h3>Aucun historique</h3>
                  <p>Vos conversations apparaîtront ici</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-panel">
              <div className="settings-group">
                <h4>Configuration des modèles</h4>
                <div className="setting-item">
                  <span className="setting-label">🧠 ChatGPT</span>
                  <span className="setting-value success">✓ Configuré</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">🌐 Gemini</span>
                  <span className="setting-value success">✓ Configuré</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">🐋 Mistral</span>
                  <span className="setting-value success">✓ Configuré</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">🦙 Llama 3</span>
                  <span className="setting-value success">✓ Configuré</span>
                </div>
              </div>
              
              <div className="settings-group">
                <h4>Préférences</h4>
                <div className="setting-item">
                  <span className="setting-label">Mode sombre</span>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked onChange={toggleTheme} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
              
              <div className="settings-group">
                <h4>Informations</h4>
                <div className="setting-item">
                  <span className="setting-label">Version</span>
                  <span className="setting-value">3.0.0</span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Modèles </span>
                  <span className="setting-value"> ChatGPT, Gemini, Mistral, Llama 3</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal détails */}
      {showDetailsFor !== null && messages[showDetailsFor]?.fullData && (
        <div className="modal-overlay" onClick={() => setShowDetailsFor(null)}>
          <div className="modal-content details-modal-container" onClick={e => e.stopPropagation()}>
            <DetailsPanel 
              result={messages[showDetailsFor].fullData} 
              onClose={() => setShowDetailsFor(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}