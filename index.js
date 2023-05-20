const CLIENT_ID = '57261959261-qbph0j4o183o13dl4hco5ko97flla8oh.apps.googleusercontent.com',
      API_KEY = 'AIzaSyBXewH_F63y74f4mGlRfQgazOqM4H7LR08',
      DISCOVERY_DOC = 'https://classroom.googleapis.com/$discovery/rest';

const SCOPES = [
  'auth/classroom.courses.readonly',
  'auth/classroom.student-submissions.me.readonly',
  'auth/classroom.coursework.students',
  'auth/classroom.courses.readonly',
  'auth/classroom.course-work.readonly',
  'auth/classroom.announcements.readonly'
].reduce((acc, scope) => `${acc}https://www.googleapis.com/${scope} `, '');

console.log('Scopes: ', SCOPES);

let tokenClient, gapiInited = false, gisInited = false;
document.getElementById('signout_button').style.display = 'none';

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
  maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // will be defined later
  });
  gisInited = true;
  maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    const btn = document.getElementById('authorize_button');
    btn.innerText = 'Log in with Google account';
    btn.removeAttribute('disabled');
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      throw (resp);
    }
    document.getElementById('signout_button').style.display = 'inline-block';
    document.getElementById('authorize_button').innerText = 'Refresh';
    await listCourses();
  };

  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
    document.getElementById('content').innerText = '';
    document.getElementById('authorize_button').innerText = 'Log in with Google account';
    document.getElementById('signout_button').style.display = 'none';
  }
}

function addZeroPadding(num) {
  return num.toString().padStart(2, '0');
}

async function listCourses() {
  const detailsDiv = document.getElementById('details'),
        progress = document.createElement('h3'),
        coursesResponse = await gapi.client.classroom.courses.list(),
        courses = coursesResponse.result.courses.filter(c => c.courseState != 'ARCHIVED'); // ignore archived courses to save API quota

  detailsDiv.appendChild(progress);
  progress.innerText = 'Loading... Please wait';

  let hwcount = 0;
  const courses_and_hw = await Promise.all(courses.map(async course => {
    const courseWork = await gapi.client.classroom.courses.courseWork.list({ courseId: course.id }).then(r => JSON.parse(r.body).courseWork);
    let hwArray;

    if (courseWork) {
      hwArray = await Promise.all(courseWork.map(async hw => {
        // get submission states of each homework
        const submission = await gapi.client.classroom.courses.courseWork.studentSubmissions.list({courseWorkId: hw.id, courseId: hw.courseId}).then(r => JSON.parse(r.body).studentSubmissions);
        hw.submission = submission[0];
        return hw;
      }));
    } else {
      hwArray = undefined;
    }

    progress.innerText = `Loading... Please wait (${++hwcount})`;
    return {courseObj: course, hwArray: hwArray};
  }));

  detailsDiv.removeChild(progress);

  courses_and_hw.forEach(course => {
    const entry = document.createElement('details');
    entry.innerHTML += `<summary>${course.courseObj.name}</summary>`;

    if (!course.hwArray) {
      entry.innerHTML += '<p>呢個課程暫時未有任何功課</p>';
      return;
    }

    for (hw of course.hwArray) {
      const hwEntry = document.createElement('details'),
            hwInfo = document.createElement('hwInfo');

      hwEntry.className = 'hwEntry'
      hwInfo.className = 'hwInfo'

      console.log('Parsing homework: ', hw);

      hwEntry.innerHTML += `<summary>${hw.title}</summary>`;

      let stateText;
      if (hw.submission.state == 'TURNED_IN' && hw.submission.late) {
        stateText = "<p class='hwStatus' style='color: var(--gray)'>已完成（遲交）</p>";
      } else if (hw.submission.state == 'TURNED_IN') {
        stateText = "<p class='hwStatus' style='color: var(--green);'>已完成</p>";
      } else if (hw.submission.late) {
        stateText = "<p class='hwStatus' style='color: var(--red);'>欠交</p>";
      } else {
        stateText = "<p class='hwStatus' style='color: var(--green);'>已指派</p>";
      }

      hwInfo.innerHTML += `
        <a style='transform: scale(0.8)' href='${hw.alternateLink}'>See details on Google Classroom</a>
        ${stateText}
        <p>詳情: </p><pre class='hwDesc'><code>${hw.description || '（冇打）'}</code></pre>
        <p>喺 ${new Date(Date.parse(hw.creationTime)).toLocaleString()} 佈置</p>
      `;

      if (hw.materials) {
        hwInfo.innerHTML += `<p>有 ${hw.materials.length} 個附件</p>`;
      }

      if (hw.dueDate) {
        hwInfo.innerHTML += '<p>Deadline 喺 ' +
        `${hw.dueDate.year} 年 ` +
        `${hw.dueDate.month} 月 ` +
        `${hw.dueDate.day} 號 ` +
        `${addZeroPadding(hw.dueTime.hours || 0)} 點 ` +
        `${addZeroPadding(hw.dueTime.minutes || 0)} 分</p>`;
      }

      hwEntry.appendChild(hwInfo);
      hwEntry.innerHTML += '<hr />';
      entry.appendChild(hwEntry);
    }

    detailsDiv.appendChild(entry);
    detailsDiv.innerHTML += '<hr />';
  });
}