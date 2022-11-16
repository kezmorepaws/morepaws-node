const express = require('express')
const router = express.Router()
const { check, validationResult } = require('express-validator')
// const mailchimp = require('@mailchimp/mailchimp_marketing')
require('dotenv').config()

// mailchimp.setConfig({
//   apiKey: process.env.MAILCHIMP_API_KEY,
//   server: process.env.MAILCHIMP_SERVER_PREFIX,
// })

const Mailchimp = require('mailchimp-api-v3')
const mc = new Mailchimp(process.env.MAILCHIMP_API_KEY)

const {
  SendError,
  removeDocumentValues,
  getUserStoreAndRole,
  mapValidationErrorArray,
} = require('../../utilities/utilities')

// middlewares
const auth = require('../../../middleware/auth')

// route GET api/store
// @desc GET A LOGGED IN USERS STORE
// @access private
router.post(
  '/pre-launch-sign-up',
  [
    check('first_name', ' Full name is required').not().isEmpty(),
    check('email', ' Email is required').not().isEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new Error(mapValidationErrorArray(errors))
      }
      const { email, first_name } = req.body
      const event = {
        name: 'MorePaws Pre-Launch Giveaway',
      }

      const footerContactInfo = {
        company: 'MorePaws',
        address1: '12 Lynway Drive',
        address2: 'Withington',
        city: 'Manchester',
        postcode: 'M20 4TS',
        country: 'UK',
      }

      const campaignDefaults = {
        from_name: 'MorePaws',
        from_email: 'contact@morepaws.co.uk',
        subject: 'Pre-launch Giveaway',
        language: 'EN_US',
      }

      //   const response = await mailchimp.lists.createList({
      //     name: event.name,
      //     contact: footerContactInfo,
      //     permission_reminder: 'permission_reminder',
      //     email_type_option: true,
      //     campaign_defaults: campaignDefaults,

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
