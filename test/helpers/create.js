const tmp = require('tmp-promise')
const dht = require('@hyperswarm/dht')
const HyperspaceClient = require('../../client')
const HyperspaceServer = require('../../server')

const BASE_PORT = 4101
const BOOTSTRAP_PORT = 3106
const BOOTSTRAP_URL = `localhost:${BOOTSTRAP_PORT}`

async function createOne (opts = {}) {
  const tmpDir = opts.dir || await tmp.dir({ unsafeCleanup: true })
  const server = new HyperspaceServer({ storage: tmpDir.path, host: opts.host, network: { bootstrap: opts.bootstrap || false } })
  await server.ready()

  const client = new HyperspaceClient({ host: opts.host })
  await client.ready()

  const cleanup = () => Promise.all([
    tmpDir.cleanup(),
    server.close(),
    client.close()
  ])

  return { server, client, cleanup, dir: tmpDir }
}

async function createMany (numDaemons, opts) {
  const cleanups = []
  const clients = []
  const servers = []
  const dirs = []

  const bootstrapOpt = [BOOTSTRAP_URL]
  const bootstrapper = dht({
    bootstrap: false
  })
  bootstrapper.listen(BOOTSTRAP_PORT)
  await new Promise(resolve => {
    return bootstrapper.once('listening', resolve)
  })

  for (let i = 0; i < numDaemons; i++) {
    const { server, client, cleanup, dir } = await createOne({ bootstrap: bootstrapOpt, host: 'hyperspace-' + i })
    cleanups.push(cleanup)
    servers.push(server)
    clients.push(client)
    dirs.push(dir)
  }

  return { clients, servers, cleanup, dirs, bootstrapOpt }

  async function cleanup (opts) {
    for (const cleanupInstance of cleanups) {
      await cleanupInstance(opts)
    }
    await bootstrapper.destroy()
  }
}

module.exports = {
  createOne,
  createMany
}
