const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/escrowController');
const chatCtrl = require('../controllers/chatController');

// Public: lets someone see what escrow a link points to before they log in.
router.get('/preview/:token', ctrl.previewByToken);

router.use(protect);

router.post('/', ctrl.createEscrow);
router.get('/', ctrl.listMyEscrows);
router.post('/join/:token', ctrl.joinEscrow);
router.post('/third-party/join/:token', ctrl.joinThirdParty);

router.get('/:id', ctrl.getEscrow);
router.get('/:id/messages', chatCtrl.getMessages);
router.post('/:id/invite-third-party', ctrl.inviteThirdParty);
router.post('/:id/deliver', ctrl.markDelivered);
router.post('/:id/confirm', ctrl.confirmAndRelease);
router.post('/:id/cancel', ctrl.cancelEscrow);

module.exports = router;
