import mongoose from 'mongoose';

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
  verdict: String,
  fullData: mongoose.Schema.Types.Mixed // Stocke toute la réponse API
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: "Nouvelle conversation"
  },
  modelUsed: {
    type: String,
    enum: ['chatgpt', 'gemini', 'mistral', 'llama'],
    default: 'chatgpt'
  },
  messages: [messageSchema],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour requêtes rapides
conversationSchema.index({ userId: 1, lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;