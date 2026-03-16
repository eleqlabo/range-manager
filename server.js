// ローカル開発用エントリーポイント
// Vercel デプロイ時はこのファイルは使用されない（main.js が使われる）
require('dotenv').config();
const app = require('./main');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RangeManager Cloud running on http://localhost:${PORT}`);
});
