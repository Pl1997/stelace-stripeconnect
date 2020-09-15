const createService = require('../services/stripeconnect')

let stripeconnect
let deps = {}

function init (server, { middlewares, helpers } = {}) {
  const {
    checkPermissions,
    restifyAuthorizationParser
  } = middlewares
  const {
    wrapAction,
    getRequestContext
  } = helpers

  server.post({
    name: 'stripeconnect.pluginRequest',
    path: '/integrations/stripeconnect/request'
  }, checkPermissions([
    'integrations:read_write:stripeconnect',
    'integrations:read_write:all' // does not currently exist
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const { args, method } = req.body
    ctx = Object.assign({}, ctx, { args, method })

    return stripeconnect.sendRequest(ctx)
  }))

  server.post({
    name: 'stripeconnect.webhooks',
    path: '/integrations/stripeconnect/webhooks/:publicPlatformId',
    manualAuth: true
  }, restifyAuthorizationParser, wrapAction(async (req, res) => {
    const { publicPlatformId } = req.params
    const stripeconnectSignature = req.headers['stripeconnect-signature']

    return stripeconnect.webhook({
      _requestId: req._requestId,
      publicPlatformId,
      stripeconnectSignature,
      rawBody: req.rawBody,
      deps
    })
  }))
}

function start (startParams) {
  deps = Object.assign({}, startParams)

  const {
    communication: { getRequester }
  } = deps

  const configRequester = getRequester({
    name: 'Stripeconnect service > Config Requester',
    key: 'config'
  })

  Object.assign(deps, {
    configRequester,
  })

  stripeconnect = createService(deps)
}

function stop () {
  const {
    configRequester,
  } = deps

  configRequester.close()

  deps = null
}

module.exports = {
  init,
  start,
  stop
}
