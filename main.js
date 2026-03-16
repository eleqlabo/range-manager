require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRouter      = require('./routers/auth');
const membersRouter   = require('./routers/members');
const reviewsRouter   = require('./routers/reviews');
const messagesRouter  = require('./routers/messages');
const campaignsRouter = require('./routers/campaigns');
const lessonsRouter   = require('./routers/lessons');
const baysRouter      = require('./routers/bays');
const birthdayRouter  = require('./routers/birthday');

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://range-manager-demo.vercel.app';

app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'RangeManager Cloud' }));

app.use('/auth',      authRouter);
app.use('/members',   membersRouter);
app.use('/reviews',   reviewsRouter);
app.use('/messages',  messagesRouter);
app.use('/campaigns', campaignsRouter);
app.use('/lessons',   lessonsRouter);
app.use('/bays',      baysRouter);
app.use('/birthday',  birthdayRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || '内部エラーが発生しました' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`RangeManager Cloud running on port ${PORT}`));
}

module.exports = app;
