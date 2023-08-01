/* The real token will be injected */
var CSRF_TOKEN = '';
/* The real backend URL will be injected */
var BACKEND_URL = '';

function onDocumentReady() {
  var queryParams = new URLSearchParams(window.location.search);
  var form = document.getElementById('signInForm');
  var errorContainer = document.getElementById('signInErrorContainer');
  var emailInput = document.getElementById('email');
  var passwordInput = document.getElementById('password');
  var submitButton = document.getElementById('signInSubmitButton');

  var clientId = queryParams.get('client_id');
  var scope = queryParams.get('scope');
  var redirectUri = queryParams.get('redirect_uri');
  var responseType = queryParams.get('response_type');
  var state = queryParams.get('state');
  var initialEmail = queryParams.get('email');

  if (
    clientId === null ||
    scope === null ||
    redirectUri === null ||
    responseType === null ||
    state === null
  ) {
    errorContainer.textContent = '';
    errorContainer.appendChild(
      (() => {
        var result = document.createElement('div');
        result.classList.add('error');
        result.textContent = 'Invalid request: missing parameters';
        return result;
      })()
    );
    return;
  }

  if (responseType !== 'code') {
    errorContainer.textContent = '';
    errorContainer.appendChild(createErrorDiv('Invalid request: invalid response_type'));
    return;
  }

  if (scope !== 'openid') {
    errorContainer.textContent = '';
    errorContainer.appendChild(createErrorDiv('Invalid request: invalid scope'));
    return;
  }

  if (!redirectUri.startsWith('https://')) {
    // will be more carefully verified on the server
    errorContainer.textContent = '';
    errorContainer.appendChild(createErrorDiv('Invalid request: invalid redirect_uri'));
    return;
  }

  try {
    new URL(redirectUri);
  } catch (e) {
    errorContainer.textContent = '';
    errorContainer.appendChild(createErrorDiv('Invalid request: invalid redirect_uri'));
    return;
  }

  if (initialEmail !== null) {
    emailInput.value = initialEmail;
  }

  form.addEventListener('submit', realSubmitHandler);

  errorContainer.textContent = '';
  emailInput.removeAttribute('disabled');
  passwordInput.removeAttribute('disabled');
  submitButton.removeAttribute('disabled');

  function realSubmitHandler(event) {
    event.preventDefault();

    emailInput.setAttribute('disabled', 'disabled');
    passwordInput.setAttribute('disabled', 'disabled');
    submitButton.setAttribute('disabled', 'disabled');

    handleSubmit(
      emailInput.value,
      passwordInput.value,
      clientId,
      scope,
      redirectUri,
      responseType,
      state
    )
      .catch((e) => {
        errorContainer.textContent = '';
        errorContainer.appendChild(
          (() => {
            if (e instanceof HTMLDivElement) {
              return e;
            }

            console.log('catching:', e);
            return createErrorDiv('An error occurred while processing the request');
          })()
        );
      })
      .finally(() => {
        form.removeEventListener('submit', realSubmitHandler);

        submitButton.textContent = 'Try Again';
        form.addEventListener('submit', (e) => {
          e.preventDefault();

          var newLoc = new URL(window.location.href);
          newLoc.searchParams.set('email', emailInput.value);
          window.location.href = newLoc.toString();
        });

        emailInput.removeAttribute('disabled');
        passwordInput.removeAttribute('disabled');
        submitButton.removeAttribute('disabled');
      });
  }
}

async function handleSubmit(email, password, clientId, scope, redirectUri, responseType, state) {
  var response;
  try {
    response = await fetch(BACKEND_URL + '/api/1/oauth/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        email: email,
        password: password,
        client_id: clientId,
        redirect_uri: redirectUri,
        csrf: CSRF_TOKEN,
      }),
    });
  } catch (e) {
    throw createErrorDiv('Failed to connect to the server: check your internet connection');
  }

  if (
    response.status === 400 ||
    response.status === 401 ||
    response.status === 403 ||
    response.status === 429
  ) {
    var data;
    try {
      data = await response.json();
    } catch (e) {
      throw createErrorDiv('Failed to parse the server response: check your internet connection');
    }

    throw createErrorDiv(data.message === undefined ? 'Unknown error' : data.message);
  }

  if (!response.ok) {
    throw createErrorDiv('The server responded with an unexpected status code: try again later');
  }

  var successData;
  try {
    successData = await response.json();
  } catch (e) {
    throw createErrorDiv('Failed to parse the server response: check your internet connection');
  }

  var code = successData.code;

  var url = new URL(redirectUri);
  url.searchParams.append('code', code);
  url.searchParams.append('state', state);
  window.location.href = url.toString();
}

function createErrorDiv(message) {
  var result = document.createElement('div');
  result.classList.add('error');
  result.textContent = message;
  return result;
}

if (document.readyState === 'complete') {
  onDocumentReady();
} else {
  document.addEventListener('DOMContentLoaded', onDocumentReady, false);
}
