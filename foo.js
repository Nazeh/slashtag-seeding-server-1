import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import Hyperbee from 'hyperbee'

const primaryKey = Buffer.from('3dafa685f280608bb0e71fd0abeba2cb63b05d15a3cc4a977f8a392d90f64ea4', 'hex')
const corestore = new Corestore('./data/store/', { primaryKey })
const newDB = new Hyperbee(corestore.get({ name: "SLASHTAGS_SEEDER_DATABASE" }))

const swarm = new Hyperswarm({seed: primaryKey})
swarm.on("connection", (conn, peerInfo) => {
  console.log("got connection", peerInfo.publicKey)
  corestore.replicate(conn)
})
swarm.join(Buffer.from("3b9f8ccd062ca9fc0b7dd407b4cd287ca6e2d8b32f046d7958fa7bea4d78fd75", "hex"), {server: false, client: true})

const core = corestore.get({ key: Buffer.from('aff4107d2895f36ce845418b672ac1121508c50444c1e6eacf0f26b6c997cac7', 'hex') })

await core.get(0)

const db = new Hyperbee(core)

let count = 0
for await (const entry of db.createReadStream()) {
  count += 1
  console.log(entry, count)
  newDB.put(entry.key, entry.value)
}

