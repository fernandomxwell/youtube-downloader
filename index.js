require('dotenv').config();

global.express = require('express');
global.fs = require('fs');
global.path = require('path');

const app = express();
const port = process.env.APP_PORT || 3000;

// Returns the current module's directory
global.dirname = __dirname;

// Initiate
require('./bootstrap')(app);

// Run the Application
app.listen(port, () => console.log(`Server is running on http://localhost:${port}!`));