const { chromium } = require('playwright');

const PORT = 8000;

let browser;
let page;
let status = {
  loggedIn: false,
}

// Init api server
let express = require('express');
let app = express();
app.use(express.json());


// API: login
app.post('/login', async (req, res) => {
  // Abort if already logged in
  if (status.loggedIn) {
    return res.status(400).send(JSON.stringify({
      success: false,
      reason: 'Already logged in',
    }));
  }

  // Abort if no username or password
  let { username, password } = req.body;
  if (!username || !password) {
    res.status(400).send(JSON.stringify({
      success: false,
      reason: 'username and password are required'
    }));
    return;
  }

  // Execute login then return result
  await login(username, password);
  if (status.loggedIn) {
    res.send(JSON.stringify({
      success: true
    }));
  } else {
    res.status(401).send(JSON.stringify({
      success: false,
      reason: 'Invalid username or password'
    }));
  }
});

app.get('/myLesson', async (req, res) => {
  let data = await myLesson();

  let result = [];
  for (let i = 0; i < data.length; i++) {

    let row = data[i];
    if (row.length != 5) {
      continue;
    }

    let lesson = {
      dateTime: row[0],
      location: row[1],
      course: row[2],
      teacher: row[3],
      status: row[4],
    };

    result.push(lesson);
  }

  return res.send(JSON.stringify(result));
})

// Start api server
app.listen(PORT, () => {
  console.log(`Api server listening on port ${PORT}`)
});



// Init browser and page
(async () => {
  browser = await chromium.launch({
    headless: false,
  });
  page = await browser.newPage();
})();

// Login 
let login = (async (username, password) => {
  await page.goto('https://reservations-sheer.jp/user/');
  await page.fill('#uloginid', username);
  await page.fill('#uloginpw', password);
  await page.click('#LoginMainContR > input');

  let logoutBtn = await page.$('#menu06 > a');
  if (logoutBtn) {
    status.loggedIn = true;
  } else {
    status.loggedIn = false;
  }
});

let myLesson = (async () => {
  let result = [];

  await page.goto('https://reservations-sheer.jp/user/reservelog.php');
  let table = await page.$$('tr');

  for (const row of table) {
    let data = [];

    let tds = await row.$$('td');
    for (const td of tds) {
      data.push(await td.innerText());
    }
    result.push(data);
  }

  return result;
});


