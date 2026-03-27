import mongoose from 'mongoose';

// Schéma pour un message individuel
const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  score: Number,
  verdict: String
}, { _id: false });

// Schéma principal d'historique
const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Identifiant unique pour une conversation (plusieurs messages)
  conversationId: {
    type: String,
    default: function() { return Date.now().toString(); },
    index: true
  },
  // Titre de la conversation (premier message)
  title: {
    type: String,
    default: "Nouvelle conversation"
  },
  // Modèle utilisé pour cette conversation
  modelUsed: {
    type: String,
    enum: ['chatgpt', 'gemini', 'mistral', 'llama'],
    default: 'chatgpt'
  },
  // TOUS les messages de la conversation
  messages: [messageSchema],
  
  // Garde les anciens champs pour compatibilité (mais optionnels)
  question: String,
  finalScore: Number,
  verdict: String,
  agreementScore: Number,
  openaiAnswer: String,
  openaiScore: Number,
  geminiAnswer: String,
  geminiAvailable: Boolean,
  mistralAnswer: String,
  llamaAnswer: String,
  responseTime: Number,
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour requêtes rapides
historySchema.index({ userId: 1, createdAt: -1 });
historySchema.index({ userId: 1, conversationId: 1 });
historySchema.index({ userId: 1, modelUsed: 1 });

const History = mongoose.model('History', historySchema);
export default History;