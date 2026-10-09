// Emergency password reset when the email link can't be used (for example Google isn't connected yet).
// Run on the server:   node server/tools/reset-password.js "a new long passphrase"
// It sets the dashboard password directly in the data folder and signs everyone out. Restart not required.
'use strict';
const crypto = require('crypto');
const store = require('../lib/store');
const pw = process.argv[2];
if (!pw || pw.length < 12) { console.error('Usage: node server/tools/reset-password.js "new password of 12+ characters"'); process.exit(1); }
const auth = store.load('auth', { hash: '', epoch: 0, resets: [] });
const salt = crypto.randomBytes(16);
auth.hash = 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(pw, salt, 64).toString('hex');
auth.epoch = (auth.epoch || 0) + 1; auth.resets = [];
store.flush('auth'); console.log('Dashboard password updated. If the server is running, restart it so it reloads the data.');
