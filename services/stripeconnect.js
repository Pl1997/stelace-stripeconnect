const Stripeconnect = require('stripe')
const debug = require('debug')('stelace:integrations:stripeconnect')
const _ = require('lodash')
const { parsePublicPlatformId } = require('stelace-util-keys')

module.exports = function createService (deps) {
  const {
    createError,
    communication: { stelaceApiRequest },

    configRequester,
  } = deps

  return {
    sendRequest,
    webhook
  }

  async function sendRequest (req) {
    const { env, method, args = [{}] } = req

    const privateConfig = await configRequester.communicate(req)({
      type: '_getConfig',
      access: 'private'
    })

    const { secretApiKey } = _.get(privateConfig, 'stelace.integrations.stripeconnect', {})
    if (!secretApiKey) throw createError(403, 'Stripeconnect secret API key not configured')

    const stripeconnect = Stripeconnect(secretApiKey)

    if (typeof _.get(stripeconnect, method) !== 'function') {
      throw createError(400, 'Stripeconnect method not found', { public: { method } })
    }

    try {
      // awaiting to handle error in catch block
      return await _.invoke(stripeconnect, method, ...args) // promise
    } catch (err) {
      const errorMessage = 'Stripeconnect error'
      const errObject = { expose: true }

      const reveal = !(process.env.NODE_ENV === 'production' && env === 'live')
      const errDetails = {
        stripeconnectMethod: method,
        stripeconnectError: err
      }
      if (reveal) _.set(errObject, 'public', errDetails)

      throw createError(err.http_status_code, errorMessage, errObject)
    }
  }

  async function webhook ({ _requestId, stripeconnectSignature, rawBody, publicPlatformId }) {
    debug('Stripeconnect integration: webhook event %O', rawBody)

    const { hasValidFormat, platformId, env } = parsePublicPlatformId(publicPlatformId)
    if (!hasValidFormat) throw createError(403)

    if (_.isEmpty(rawBody)) throw createError(400, 'Event object body expected')

    const req = {
      _requestId,
      platformId,
      env
    }

    const privateConfig = await configRequester.communicate(req)({
      type: '_getConfig',
      access: 'private'
    })

    const { secretApiKey, webhookSecret } = _.get(privateConfig, 'stelace.integrations.stripeconnect', {})
    if (!secretApiKey) throw createError(403, 'Stripeconnect API key not configured')
    if (!webhookSecret) throw createError(403, 'Stripeconnect Webhook secret not configured')

    const stripeconnect = Stripeconnect(secretApiKey)

    let event

    // Verify Stripeconnect webhook signature
    // https://stripeconnect.com/docs/webhooks/signatures
    try {
      event = stripeconnect.webhooks.constructEvent(rawBody, stripeconnectSignature, webhookSecret)
    } catch (err) {
      throw createError(403)
    }

    // prefix prevents overlapping with other event types
    const type = `stripeconnect_${event.type}`
    const params = {
      type,
      orderBy: 'createdDate',
      order: 'desc',
      page: 1
    }

    const { results: sameEvents } = await stelaceApiRequest('/events', {
      platformId,
      env,
      payload: {
        objectId: event.id,
        nbResultsPerPage: 1,
        ...params
      }
    })

    // Stripeconnect webhooks may send same events multiple times
    // https://stripeconnect.com/docs/webhooks/best-practices#duplicate-events
    if (sameEvents.length) {
      debug('Stripeconnect integration: idempotency check with event id: %O', sameEvents)
    }

    await stelaceApiRequest('/events', {
      platformId,
      env,
      method: 'POST',
      payload: {
        // https://stripeconnect.com/docs/api/events/types
        // No Stripeconnect event name currently has two underscores '__', which would cause an error
        type,
        objectId: event.id, // just a convention to easily retrieve events, objectId being indexed
        emitterId: 'stripeconnect',
        metadata: event
      }
    })

    return { success: true }
  }
}
