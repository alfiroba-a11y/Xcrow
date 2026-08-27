const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/supportController');

router.use(protect);

router.post('/', ctrl.createTicket);
router.get('/', ctrl.listMyTickets);
router.post('/:id/reply', ctrl.replyToTicket);

module.exports = router;
