const express = require('express')
const router = express.Router()
const nodemailer = require('nodemailer')
const multer = require('multer')
const sharp = require('sharp')
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const {
  SendError,
  capitalizeFirstLetter,
  mapValidationErrorArray,
  getDocumentValues,
  removeDocumentValues,
  getUserStoreAndRole,
  ArrayIsEmpty,
  createUrlFromString,
  createImageName,
  resizeProfilePhoto,
} = require('../../utilities/utilities')
const { STORE_STATUS, STORE_ROLES } = require('../../../constants/store')

// models
const User = require('../../../models/User')
const Store = require('../../../models/Store')

// middlewares
const auth = require('../../../middleware/auth')
const { check, validationResult } = require('express-validator')
const {
  mldS3Client,
  s3PutCommand,
  bucketName,
} = require('../../../aws/s3Client')
const { STORE_IMAGES } = require('../../../constants/images')

// route POST api/store/setup/step-1/:id
// @desc edit step 1 store setup
// @access private
router.post(
  '/step-1/new',
  auth,
  [
    check('company_name', ' Company name is required').not().isEmpty(),
    check('company_address', ' Company address is required').exists(),
    check(
      'company_address.address_line_1',
      'Company address line 1 is required '
    )
      .not()
      .isEmpty(),
    check('company_address.postcode', ' Company postcode is required')
      .not()
      .isEmpty(),
    check('company_address.city', ' Company city is required').not().isEmpty(),
    check('company_address.country', ' Company country is required')
      .not()
      .isEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new Error(mapValidationErrorArray(errors))
      }

      const { user, store, role } = await getUserStoreAndRole(req.user.id)

      if (!user) throw new Error('User not found')

      if (store || role) throw new Error('User already has an associated store')

      if (!store && !role) {
        // no existing store, create a new store
        const { company_name, company_number, company_address } = req.body
        const { address_line_1, address_line_2, postcode, city, country } =
          company_address

        const newStore = new Store({
          company_info: {
            company_name: company_name,
            company_number: company_number || '',
            company_address: {
              address_line_1,
              address_line_2,
              postcode,
              city,
              country,
            },
          },
          registration_step: 1,
          store_status: STORE_STATUS.PENDING_APPLICATION,
          super_admin_id: req.user.id,
        })
        await newStore.save()
        user.store = {
          store_id: newStore.id,
          role: STORE_ROLES.super_admin,
        }
        await user.save()

        const storeResponse = removeDocumentValues(
          ['store_status', 'super_admin_id'],
          newStore
        )
        const userResponse = removeDocumentValues(['_id'], user)
        res.json({
          user: userResponse,
          store_status: newStore.store_status,
          store: storeResponse,
        })
      }
    } catch (error) {
      SendError(res, error)
      console.log(error)
    }
  }
)

// route POST api/store/setup/step-1/:id
// @desc edit step 1 store setup
// @access private
router.post(
  '/step-1/update',
  auth,
  [
    check('company_name', ' Company name is required').not().isEmpty(),
    check('company_address', ' Company address is required').exists(),
    check(
      'company_address.address_line_1',
      'Company address line 1 is required '
    )
      .not()
      .isEmpty(),
    check('company_address.postcode', ' Company postcode is required')
      .not()
      .isEmpty(),
    check('company_address.city', ' Company city is required').not().isEmpty(),
    check('company_address.country', ' Company country is required')
      .not()
      .isEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new Error(mapValidationErrorArray(errors))
      }

      // res.json('success')

      const user = await User.findById(req.user.id)
      const userStoreId = user?.store?.store_id

      if (!userStoreId) throw new Error('User has no store to update')

      const { company_name, company_number, company_address } = req.body
      const { address_line_1, address_line_2, postcode, city, country } =
        company_address

      const existingStore = Store.findById(userStoreId)

      if (!existingStore && !userStoreId) {
        // no existing store, create a new store
      }

      if (userStoreId && existingStore) {
        if (userStoreId !== existingStore.id) {
          throw new Error('Not authorized to edit this store')
        }
        if (existingStore) {
          // update existing store
        }
      }
    } catch (error) {
      SendError(res, error)
      console.log(error)
    }
  }
)

// route POST api/store/setup/step-1/:id
// @desc edit step 1 store setup
// @access private
router.post(
  '/step-2',
  auth,
  upload.fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'cover_photo', maxCount: 1 },
  ]),
  [
    check('store_name', ' Store Name is required').not().isEmpty(),
    check('store_url', ' Store URL is required').not().isEmpty(),
    check('bio', ' Bio is required').not().isEmpty(),
    check('email', ' Email is required').not().isEmpty(),
    check('contact_number', ' Contact number is required').not().isEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new Error(mapValidationErrorArray(errors))
      }

      const { store, user, role } = await getUserStoreAndRole(req.user.id)
      if (!user) throw new Error('User doesnt exist')
      if (!store) throw new Error('User has no store to update')
      if (role === STORE_ROLES.user) {
        throw new Error('Not authorized to edit this store')
      }
      if (!req.files || !req.files.profile_image || !req.files.cover_photo)
        throw new Error('Missing images')
      const { profile_image, cover_photo } = req.files
      const { store_name, store_url, bio, email, contact_number } = req.body
      // update existing store
      console.dir({
        store_name,
        store_url,
        bio,
        email,
        contact_number,
      })

      const promises = [profile_image[0], cover_photo[0]].map(
        (img, index) =>
          new Promise(async (resolve, reject) => {
            try {
              const item =
                index === 0
                  ? STORE_IMAGES.profile_image
                  : STORE_IMAGES.cover_photo
              let buffer = img.buffer
              if (item === STORE_IMAGES.profile_image) {
                buffer = await resizeProfilePhoto(buffer)
              }
              const pc = s3PutCommand({
                Bucket: bucketName,
                Key: createImageName(store, item, img),
                Body: buffer,
                ContentType: img.mimetype,
              })
              const res = await mldS3Client.send(pc)
              resolve(res)
            } catch (error) {
              console.error(error)
            }
          })
      )

      const imagesRes = await Promise.all(promises)

      console.dir(imagesRes)

      res.status(200).json('success')
    } catch (error) {
      SendError(res, error)
      console.log(error)
    }
  }
)

// route POST api/store/setup/check-store-name
// @desc checks if the store name is available
// @access private
router.post(
  '/check-store-name',
  auth,
  [check('store_name', ' Store Name is required').not().isEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new Error(mapValidationErrorArray(errors))
      }

      const reg = new RegExp(`^${req.body.store_name}$`, 'i')

      const store = await Store.find({
        store_name: reg,
      })

      const doesntExist = ArrayIsEmpty(store)
      if (doesntExist) {
        res.status(200).json('Name is available')
      }

      if (!doesntExist) throw new Error('Store name already exists')
    } catch (error) {
      SendError(res, error)
      console.log(error)
    }
  }
)
// route POST api/store/setup/check-store-url
// @desc checks if the store url is available
// @access private
router.post(
  '/check-store-url',
  auth,
  [check('store_url', ' Store URL is required').not().isEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new Error(mapValidationErrorArray(errors))
      }

      const url = createUrlFromString(req.body.store_url)

      const store = await Store.find({
        store_url: url,
      })

      const doesntExist = ArrayIsEmpty(store)
      if (doesntExist) {
        res.status(200).json('URL is available')
      }

      if (!doesntExist) throw new Error('URL already exists')
    } catch (error) {
      SendError(res, error)
      console.log(error)
    }
  }
)

module.exports = router
