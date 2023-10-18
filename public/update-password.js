/* The real token will be injected */
var CSRF_TOKEN = '';
/* The real backend URL will be injected */
var BACKEND_URL = '';

// #region types
/**
 * @typedef {{ code: string, email: string }} UpdatePasswordQueryParams
 */

/**
 * @typedef {{ params?: UpdatePasswordQueryParams, error?: HTMLDivElement }} ParseQueryParamsResult
 */

/**
 * @typedef {{ visitor: string | null }} UpdatePasswordContextParams
 */
// #endregion

// #region setup
function onDocumentReady() {
  fixContainerStyles();

  var queryParams = parseQueryParams();
  if (queryParams.error !== undefined) {
    var errorContainer = document.getElementById('errorContainer');
    errorContainer.textContent = '';
    errorContainer.appendChild(queryParams.error);
    return;
  }
  var contextParams = parseContextParams();

  attachToUpdatePasswordForm(queryParams.params, contextParams);
}

/**
 * @returns {ParseQueryParamsResult}
 */
function parseQueryParams() {
  var queryParams = new URLSearchParams(window.location.search);

  var code = queryParams.get('code');
  var email = queryParams.get('email');

  if (code === null || email === null) {
    return { error: createErrorDiv('Invalid request: missing parameters') };
  }

  return {
    params: {
      code,
      email,
    },
  };
}

/**
 * @returns {UpdatePasswordContextParams}
 */
function parseContextParams() {
  var storedVisitorRaw = localStorage.getItem('visitor');
  if (storedVisitorRaw === null) {
    return { visitor: null };
  }

  var parsedVisitor;
  try {
    parsedVisitor = JSON.parse(storedVisitorRaw);
  } catch (e) {
    return { visitor: null };
  }

  if (typeof parsedVisitor === 'object' && typeof parsedVisitor.uid === 'string') {
    return { visitor: parsedVisitor.uid };
  }

  return { visitor: null };
}

function fixContainerStyles() {
  /** @type HTMLDivElement */
  var form = document.getElementById('form');
  document.addEventListener('resize', handleWindowSize);
  handleWindowSize();

  function handleWindowSize() {
    var height = window.innerHeight;
    form.style.minHeight = `${Math.min(height, 720)}px`;
  }
}
// #endregion

// #region helpers
function createErrorDiv(message) {
  var result = document.createElement('div');
  result.classList.add('error');
  result.textContent = message;
  return result;
}
// #endregion

// #region Update Password
/**
 *
 * @param {UpdatePasswordQueryParams} params
 * @param {UpdatePasswordContextParams} context
 */
function attachToUpdatePasswordForm(params, context) {
  /** @type {HTMLFormElement} */
  var form = document.getElementById('form');
  /** @type {HTMLDivElement} */
  var errorContainer = document.getElementById('errorContainer');
  /** @type {HTMLInputElement} */
  var emailInput = document.getElementById('email');
  /** @type {HTMLInputElement} */
  var passwordInput = document.getElementById('password');
  /** @type {HTMLInputElement} */
  var showPassword = document.getElementById('showPassword');
  /** @type {HTMLButtonElement} */
  var submitButton = document.getElementById('submitButton');

  errorContainer.textContent = '';
  emailInput.value = params.email;
  passwordInput.setAttribute('type', 'password');
  showPassword.removeAttribute('checked');
  showPassword.addEventListener('change', () => {
    if (showPassword.checked) {
      passwordInput.setAttribute('type', 'text');
    } else {
      passwordInput.setAttribute('type', 'password');
    }
  });
  form.addEventListener('submit', realSubmitHandler);
  passwordInput.removeAttribute('disabled');
  submitButton.removeAttribute('disabled');

  /** @param {Event} ev */
  async function realSubmitHandler(ev) {
    ev.preventDefault();

    submitButton.setAttribute('disabled', 'disabled');
    passwordInput.setAttribute('disabled', 'disabled');
    form.removeEventListener('submit', realSubmitHandler);

    try {
      await handleUpdatePasswordSubmit(params, context, passwordInput.value);
    } catch (e) {
      if (e instanceof HTMLDivElement) {
        errorContainer.appendChild(e);
      } else {
        console.log('catching:', e);
        errorContainer.appendChild(
          createErrorDiv(
            'There was an error processing your request. Contact hi@oseh.com for support'
          )
        );
      }
    }
  }
}

/**
 * @param {UpdatePasswordQueryParams} params
 * @param {UpdatePasswordContextParams} context
 * @param {string} password
 */
async function handleUpdatePasswordSubmit(params, context, password) {
  var headers = {
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (context.visitor !== null) {
    headers.Visitor = context.visitor;
  }

  var response = await fetch(BACKEND_URL + '/api/1/oauth/siwo/update_password', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: params.code,
      password,
      csrf: CSRF_TOKEN,
    }),
  });

  if (response.ok) {
    swapToSuccessView();
    attachToSuccessView();
    return;
  }

  if (response.status === 403) {
    throw createErrorDiv(
      'The code is invalid or expired. If the problem persists, contact hi@oseh.com for support.'
    );
  }

  if (response.status === 409) {
    throw createErrorDiv('There was an error with your account. Contact hi@oseh.com for support.');
  }

  var result = await response.json();
  if (typeof result === 'object' && typeof result.message === 'string') {
    throw createErrorDiv(result.message);
  }

  throw new Error('unknown response:', response.status);
}
// #endregion

// #region Success
function swapToSuccessView() {
  /** @type {HTMLDivElement} */
  var contents = document.getElementById('contents');

  for (var i = 0; i < contents.children.length; i++) {
    var child = contents.children[i];

    if (
      child.className.indexOf('form-group') >= 0 ||
      child.getAttribute('id') === 'errorContainer'
    ) {
      child.remove();
      i--;
    }
  }

  /** @type {HTMLDivElement} */
  var title = document.getElementById('title');
  title.textContent = 'Password Updated';

  /** @type {HTMLDivElement} */
  var description = document.getElementById('description');
  description.textContent = 'You can now return to the app to sign in with your new password';

  /** @type {HTMLButtonElement} */
  var submitButton = document.getElementById('submitButton');
  submitButton.insertAdjacentElement(
    'afterend',
    (() => {
      var anchor = document.createElement('a');
      anchor.classList.add('button');
      anchor.href = '/';
      anchor.textContent = 'Return to App';
      return anchor;
    })()
  );
  submitButton.remove();
}

function attachToSuccessView() {}
// #endregion

// #region footer
if (document.readyState === 'complete') {
  onDocumentReady();
} else {
  document.addEventListener('DOMContentLoaded', onDocumentReady, false);
}
// #endregion
