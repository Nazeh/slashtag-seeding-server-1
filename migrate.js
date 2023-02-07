import Corestore from 'corestore'
import Hyperbee from 'hyperbee'

const corestore = new Corestore("./data/store/")

const oldDB = new Hyperbee(corestore.get({ name: "Hyperbee DB Prod" }))
const newDB = new Hyperbee(corestore.get({ name: "SLASHTAGS_SEEDER_DATABASE" }))

await oldDB.ready()
await newDB.ready()

const oldKeys = new Set();

for await (let {key, value} of oldDB.createReadStream()) {
  oldKeys.add(key.toString())
  await newDB.put(key, value)
}

for (let key of [...oldKeys.values()]) {
  const val = await newDB.get(key) 
  console.log(Buffer.from(key), val)
  if (!val) throw new Error("missing key", key)
}
