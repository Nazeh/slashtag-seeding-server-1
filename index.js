import App from './lib/app.js'
import Seeder from './lib/seeder.js'
import logger from './lib/logger.js'

// getting started
const seeder = new Seeder({
  logger
})

// Create the HTTP server app
const app = new App(seeder)
await app.start()
