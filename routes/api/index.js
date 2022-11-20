const express = require('express')
const router = express.Router()

router.get('/', (req, res) => res.send('squib API Running'))

// define routes

router.use('/auth', require('./auth'))
router.use('/marketing', require('./marketing/marketing.index'))
router.use('/store', require('./store'))

module.exports = router
