import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  question: {
    type: String,
    required: true
  },
  finalScore: Number,
  verdict: String,
  agreementScore: Number,
  openaiAnswer: String,
  openaiScore: Number,
  geminiAnswer: String,
  geminiAvailable: Boolean,
  responseTime: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour requêtes rapides
historySchema.index({ userId: 1, createdAt: -1 });

const History = mongoose.model('History', historySchema);
export default History;