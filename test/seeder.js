import test from 'brittle'
import RAM from 'random-access-memory'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import createTestnet from '@hyperswarm/testnet'
import { tmpdir } from 'os'

import Seeder from '../lib/seeder.js'

test('initialization - zero config', async (t) => {
  const primaryKey = Buffer.alloc(32)

  const seeder = new Seeder()
  // Override corestore to test consistent primaryKey
  seeder.corestore = new Corestore(RAM, { primaryKey })
  await seeder.ready()

  t.is(seeder.corestore.primaryKey.toString('hex'), '0000000000000000000000000000000000000000000000000000000000000000')
  t.is(seeder.db.feed.key.toString('hex'), 'c05f9b226b9c5b812d4c8715d2140bd4efda170b5b97b4944ea98d3b45f579ad')
  t.is(seeder.swarm.keyPair.publicKey.toString('hex'), '3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29')

  await seeder.close()
})

test('can replicate over a seeders topic', async (t) => {
  const testnet = await createTestnet(3, t.teardown)

  const storage = tmpdir() + '/' + Math.random().toString(16).slice(2)

  let seeder = new Seeder({ bootstrap: testnet.bootstrap, storage })
  await seeder.ready()

  // Mock hypercore
  const core = seeder.corestore.get({ name: 'foo' })
  await core.append(['foo', 'bar'])
  await core.close()

  // Close everything and reopen to prove peristence
  await seeder.close()
  seeder = new Seeder({ bootstrap: testnet.bootstrap, storage })
  await seeder.ready()

  // Open 10 unrequested hypercores that shouldn't be replicated
  for (let i = 0; i <= 10; i++) {
    const core = seeder.corestore.get({ name: 'foo' + i })
    await core.append(['foo'])
  }

  // Client side
  const swarm = new Hyperswarm(testnet)

  const discoveryKeys = new Set()
  const corestore = new Corestore(RAM, { _ondiscoverykey: discoveryKeys.add.bind(discoveryKeys) })

  swarm.on('connection', (conn) => {
    corestore.replicate(conn)
  })

  swarm.join(seeder.topic, { server: false, client: true })
  const done = corestore.findingPeers()
  swarm.flush().then(done, done)

  const readable = corestore.get({ key: core.key })
  await readable.update()

  t.is(readable.length, 2)
  t.is(readable.length, core.length)

  t.is(discoveryKeys.size, 0, "shouldn't recieve any unrequested replication")

  await seeder.close()
  await swarm.destroy()
})
