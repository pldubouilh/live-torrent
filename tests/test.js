const puppeteer = require('puppeteer')
const test = require('tape')

const url = 'http://127.0.0.1:8008/fake-video.html'

const sleep = t => new Promise(resolve => setTimeout(resolve, t))

async function testp2p (t) {
  t.plan(1)

  // Spawn first chrome
  const browser1 = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page1 = await browser1.newPage()
  await page1.goto(url)
  await sleep(6000)

  // Spawn second chrome
  const browser2 = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page2 = await browser2.newPage()

  let p2p = false
  page2.on('console', msg => {
    console.log(msg.text())
    p2p = msg.text().includes('P2P Download') || msg.text().includes('P2P Upload') ? true : p2p
  })

  await page2.goto(url)
  await sleep(30000)

  // Cleanup
  await browser1.close()
  await browser2.close()

  console.log(' ')
  t.true(p2p, 'browsers exchanged content between each-others 👏')
  t.end()
}

const doTest = async () => {
  test('Test p2p between 2 browsers\n', testp2p)
}

doTest()
