const { chromium } = require('playwright');

const PORT = 8000;

let browser;
let context;

// Init api server
let express = require('express');
let app = express();
app.use(express.json());



// Utils
async function isLoggedIn(req, res) {
  if (!await LoggedIn()) {
    res.status(401).send(JSON.stringify({
      success: false,
      reason: 'Not logged in'
    }));
    return false;
  }
  return true;
}

let LoggedIn = (async () => {
  let page = await context.newPage();
  await page.goto('https://reservations-sheer.jp/user/');
  let logoutBtn = await page.$('#menu06 > a');
  let loginBtn = await page.$('#LoginMainContR > input');


  if (!logoutBtn && loginBtn) {
    await page.close();
    return false;
  }
  else if (logoutBtn) {
    await page.close();
    return true;
  }

});



// API: login
app.post('/login', async (req, res) => {
  // Abort if already logged in
  if (await LoggedIn()) {
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
  if (await LoggedIn()) {
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

// API: logout
app.get('/logout', async (req, res) => {
  if (!await isLoggedIn(req, res)) return;

  let result = await logout();
  return res.send(JSON.stringify(result));
});

// API: login status
app.get('/status', async (req, res) => {
  let result = await LoggedIn();
  return res.send(JSON.stringify({
    result: result
  }));
});

// API: reserved lessons
app.get('/myLesson', async (req, res) => {
  if (!await isLoggedIn(req, res)) return;

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

// API: get campus list
app.get('/campus', async (req, res) => {
  if (!await isLoggedIn(req, res)) return;

  let result = await campus();
  return res.send(JSON.stringify(result));
})

// API: get campus lesson
app.get('/campus/:campus', async (req, res) => {
  if (!await isLoggedIn(req, res)) return;

  let campus = req.params.campus;

  let result = await campusLesson(campus);
  return res.send(JSON.stringify(result));
})

// API: get course list
app.get('/:campus/:course/:courseType/:teacher', async (req, res) => {
  if (!await isLoggedIn(req, res)) return;

  let campus = req.params.campus;
  let course = req.params.course;
  let courseType = req.params.courseType;
  let teacher = req.params.teacher;

  let result = await courseList(campus, course, courseType, teacher);
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
    // slowMo: 1000
  });
  context = await browser.newContext();
})();

// Login 
let login = (async (username, password) => {
  let page = await context.newPage();
  await page.goto('https://reservations-sheer.jp/user/');
  await page.fill('#uloginid', username);
  await page.fill('#uloginpw', password);
  await page.click('#LoginMainContR > input');
  await page.close();
});

// Logout
let logout = (async () => {
  let page = await context.newPage();
  await page.goto('https://reservations-sheer.jp/user/');
  let logoutBtn = await page.$('#menu06 > a');
  let loginBtn = await page.$('#LoginMainContR > input');

  if (!logoutBtn && loginBtn) {
    await page.close();
    return {
      success: false,
      reason: 'Already logged out'
    };
  }
  else if (logoutBtn) {
    await page.click('#menu06 > a');
    await page.close();
    return {
      success: true,
      reason: 'Logged out'
    };
  }
})

// Reserved lessons
let myLesson = (async () => {
  let page = await context.newPage();
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

  await page.close();
  return result;
});

// Get campus list
let campus = (async () => {
  let page = await context.newPage();
  await page.goto('https://reservations-sheer.jp/user/reserve0.php');
  let list = await page.$('[name=st00]');
  let options = await list.$$('option');

  let result = [];
  for (const option of options) {
    let text = await option.innerText();
    text = text.replaceAll("\n", '');
    let value = await option.getAttribute('value');

    result.push({
      value: value,
      innerText: text,
    });
  }

  await page.close();
  return result;
})

// Get campus lesson
// @param campus: campus id
let campusLesson = (async (campus) => {
  let page = await context.newPage();
  await page.goto(`https://reservations-sheer.jp/user/reserve0.php?st00=${campus}`);

  /* Get by text

  await page.goto("https://reservations-sheer.jp/user/reserve0.php");
  await page.$eval(`option:has-text("${campus}")`, e => {
    e.setAttribute("selected", "");
  });

  await page.click('input[name=submit]');

  */

  let lessons = await page.$('[name="ls00[0]"]');
  let options = await lessons.$$('option');

  let result = {
    courseOptions: [],
    courseTypes: null,
    courseTeachers: null
  };
  for (const option of options) {
    let text = await option.innerText();
    let value = await option.getAttribute('value');
    result.courseOptions.push({
      value: value,
      innerText: text,
    });
  }

  let courseDetails = await page.$eval('body', () => { return _hs_options });
  courseDetails = courseDetails.ls00;
  result.courseTypes = courseDetails[0];
  result.courseTeachers = courseDetails[1];

  await page.close();
  return result;
})

// Get course list
let courseList = (async (campus, course, courseType, teacher) => {
  let page = await context.newPage();

  await page.goto(`https://reservations-sheer.jp/user/reserve0.php`);
  await page.selectOption('[name=st00]', campus);
  await page.selectOption('#ls000', course);
  await page.selectOption('#ls001', courseType);
  await page.selectOption('#ls002', teacher);
  await page.click('input[name=submit]');

  await page.waitForSelector('table');

  let table = await page.$$('tr');

  let result = [];

  for (const row of table) {

    let date = await row.$('th');
    date = await date.innerText();
    date = date.trim();

    // skip title row
    if (date == '') continue;

    let times = await row.$('td');
    times = await times.innerHTML();
    times = times.split('<br>');

    let timeList = [];

    // Remove empty string
    for (let i = 0; i < times.length; i++) {
      times[i] = times[i].trim();
    }
    times = times.filter(time => time != '');

    // parse html string
    for (let i = 0; i < times.length; i++) {
      times[i] = times[i].replaceAll('\\', '');

      let time = {
        time: null,
        status: null,
        link: null
      };

      // Get time
      let _time = times[i].match(/(\d*:\d\d.)/)[1];

      let _hour = _time.split(':')[0];
      let _minute = _time.split(':')[1].substr(0, 2);

      // if now is after day 20 and 12:00, return next month. or return this month
      let _date;
      if (new Date().getDate() >= 20 && new Date().getHours() >= 12) {
        _date = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      } else  {
        _date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      }

      let month = date.split('/')[0];
      let day = date.split('/')[1].substr(0, date.split('/')[1].indexOf('('));

      _date.setMonth(month - 1);
      _date.setDate(day);
      _date.setHours(_hour);
      _date.setMinutes(_minute);
      time.time = _date.toLocaleString();

      
      // get reserve link if exists
      if (times[i].indexOf('<a') != -1) {
        time.link = times[i].match(/href="(.*?)"/)[1];
        time.status = "予約する";
      } else {
        time.status = "満席";
      }

      timeList.push(time);
    }
    

    result.push({
      date: date,
      times: timeList,
    });
  }

  await page.close();
  return result;
})
