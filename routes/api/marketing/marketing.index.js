const express = require('express')
const router = express.Router()
const { check, validationResult } = require('express-validator')
require('dotenv').config()

const {
  SendError,
  mapValidationErrorArray,
} = require('../../utilities/utilities')

// middlewares
const auth = require('../../../middleware/auth')
const mc = require('../../../mailchimp/mailchimp')

// route GET api/store
// @desc GET A LOGGED IN USERS STORE
// @access private
router.post(
  '/pre-launch-sign-up',
  [
    check('first_name', ' First name is required').not().isEmpty(),
    check('email', ' Email is required').not().isEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new Error(mapValidationErrorArray(errors))
      }
      const { email, first_name } = req.body

      const response = await mc.post('/lists/f07d8681a2/members', {
        email_address: email,
        merge_fields: {
          FNAME: first_name,
        },
        status: 'subscribed',
      })
      res.status(200).send('success')
    } catch (error) {
      SendError(res, error)
    }
  }
)

module.exports = router
