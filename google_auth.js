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

let tokenClient, gapiInited = false, gisInited = false;

console.log('Scopes: ', SCOPES);

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
function gapiLoaded() {
  console.log('gapi loaded');
  gapi.load('client', async () => {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
  });
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
  console.log('gis loaded');
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    prompt: '',
    callback: undefined, // will be defined later
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
    btn.innerText = 'Login with Google';
    btn.removeAttribute('disabled');
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) throw (resp);
    document.getElementById('signout_button').style.display = 'unset';
    document.getElementById('authorize_button').style.display = 'none';
    resolveGoogleLoginPromise();
  };

  tokenClient.requestAccessToken();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
    document.getElementById('content').innerText = '';
    document.getElementById('authorize_button').style.display = 'unset';
    document.getElementById('signout_button').style.display = 'none';
  }
}