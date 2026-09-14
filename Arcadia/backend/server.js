const express = require('express');
const cors = require('cors');
const { port } = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use(errorHandler);

app.listen(port, () => console.log(`Auth server running on http://localhost:${port}`));
