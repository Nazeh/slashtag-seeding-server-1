import Fastify from 'fastify'
import logger from './logger.js'

const DEFAULT_PORT = 3000

export default class App {
  /**
     * @param {import('./seeder.js').default} seeder
     * @param {object} [opts]
     * @param {number} [opts.port]
     * @param {boolean} [opts.logger]
     */
  constructor (seeder, opts) {
    this.server = Fastify({ logger: opts?.logger })
    this.seeder = seeder

    this.port = opts?.port || DEFAULT_PORT
  }

  async start () {
    try {
      await this.seeder.ready()
      await this.defineRoutes()
      await this.server.listen({ port: this.port })
      logger.info(`HTTP server listening on port ${this.port}`)
    } catch (err) {
      this.server.log.error(err)
      process.exit(1)
    }
  }

  /**
     * POST /seeding/hypercore { publicKey: 'hex encoded key' }
     * Requests that the hypercore with key be seeded. Responds as soon as the request is lodged
     * but does not wait for seeding to begin.
     *
     * DELETE /seeding/hypercore/:key
     * Request that the key provided be removed from the seeding set. Eventually this seed will be
     * dropped and seeding stopped.
     *
     * GET /seeding/hypercore/:key
     * See if the key is being seeded (404 if not).
     * If it is, returns { key: 'theKey', length: [length of hypercore in blocks], lastUpdated: [ms timestamp] }
     */
  async defineRoutes () {
    this.server.route({
      method: 'POST',
      url: '/seeding/hypercore',
      schema: {
        body: {
          type: 'object',
          required: ['publicKey'],
          properties: {
            publicKey: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' }
            }
          }
        }
      },
      handler: async (request, reply) => {
        this.seeder.registerHypercore(Buffer.from(request.body.publicKey, 'hex'))
        return { status: 'ok' }
      }
    })

    this.server.route({
      method: 'DELETE',
      url: '/seeding/hypercore/:key',
      schema: {
        params: {
          type: 'object',
          required: ['key'],
          properties: {
            key: {
              type: 'string',
              pattern: '^[a-fA-F0-9]{64}$'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' }
            }
          }
        }
      },
      handler: async (request, reply) => {
        // Disable for now - wait for auth
        // this.seeder.removeHypercore(Buffer.from(request.params.key, 'hex'))
        return { status: 'ok' }
      }
    })

    // Find out about a hypercore. Are we seeding it and what length is it in our opinion.
    // 404 if the hypercore does not known/tracked by the seeding server
    this.server.route({
      method: 'GET',
      url: '/seeding/hypercore/:key',
      schema: {
        params: {
          type: 'object',
          required: ['key'],
          properties: {
            key: {
              type: 'string',
              pattern: '^[a-fA-F0-9]{64}$'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              key: { type: 'string' },
              length: { type: 'integer' },
              lastUpdated: { type: 'integer' }
            }
          }
        }
      },
      handler: async (request, reply) => {
        const key = Buffer.from(request.params.key, 'hex')
        const status = await this.seeder.getHypercoreStatus(key)
        if (status === null) {
          // not found
          const msg = {
            message: 'key is not known',
            error: 'Not Found',
            statusCode: 404
          }
          return reply
            .code(404)
            .type('application/json; charset=utf-8')
            .send(JSON.stringify(msg))
        }

        return {
          key: request.params.key,
          length: status.length,
          lastUpdated: status.lastUpdated
        }
      }
    })
  }
}
