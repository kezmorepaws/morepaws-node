const mc = require('@mailchimp/mailchimp_marketing')
require('dotenv').config()

mc.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX,
})

module.exports = mc
