const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/setupController');

router.get('/create-admin', ctrl.createAdmin);

module.exports = router;
