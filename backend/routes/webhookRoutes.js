const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/webhookController');

router.post('/paystack', ctrl.paystackWebhook);

module.exports = router;
