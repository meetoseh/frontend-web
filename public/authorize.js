/* The real token will be injected */
var CSRF_TOKEN = '';
/* The real backend URL will be injected */
var BACKEND_URL = '';

// #region types
/**
 * @typedef {{ clientId: string, scope: string, redirectUri: string, responseType: string, state: string, initialEmail: string | null, requireCode: boolean }} AuthorizeQueryParams
 */

/**
 * @typedef {{ visitor: string | null }} AuthorizeContextParams
 */

/**
 * @typedef {{ params?: AuthorizeQueryParams, error?: HTMLDivElement }} ParseQueryParamsResult
 */

/**
 * @typedef {{ category: 'bad-password' | 'ratelimit' | 'success', ratelimitTimeSeconds?: number }} LoginResult
 */
// #endregion

// #region setup
function onDocumentReady() {
  fixContainerStyles();

  var queryParams = parseQueryParams();
  if (queryParams.error !== undefined) {
    var errorContainer = document.getElementById('signInErrorContainer');
    errorContainer.appendChild(queryParams.error);
    return;
  }
  var contextParams = parseContextParams();

  if (queryParams.params.initialEmail === 'test-register@example.com') {
    swapToRegisterForm();
    attachToRegisterForm(queryParams.params, contextParams, queryParams.params.initialEmail);
    return;
  }

  if (queryParams.params.initialEmail === 'test-login@example.com') {
    swapToLoginForm('John');
    attachToLoginForm(queryParams.params, contextParams, queryParams.params.initialEmail, 'John');
    return;
  }

  if (queryParams.params.initialEmail === 'test-reset-password@example.com') {
    swapToResetPasswordForm();
    attachToResetPasswordForm(queryParams.params, contextParams, queryParams.params.initialEmail);
    return;
  }

  if (queryParams.params.initialEmail === 'test-verify@example.com') {
    swapToRequestVerificationForm();
    attachToRequestVerificationForm(
      queryParams.params,
      contextParams,
      queryParams.params.initialEmail
    );
    return;
  }

  if (!queryParams.params.requireCode) {
    attachToCheckForm(queryParams.params, contextParams);
  } else {
    swapToCheckWithCodeForm();
    attachToCheckWithCodeForm(queryParams.params, contextParams);
  }
}

/**
 * @returns {ParseQueryParamsResult}
 */
function parseQueryParams() {
  var queryParams = new URLSearchParams(window.location.search);

  var clientId = queryParams.get('client_id');
  var scope = queryParams.get('scope');
  var redirectUri = queryParams.get('redirect_uri');
  var responseType = queryParams.get('response_type');
  var state = queryParams.get('state');
  var initialEmail = queryParams.get('email');
  var requireCode = queryParams.get('require_code') === '1';

  if (
    clientId === null ||
    scope === null ||
    redirectUri === null ||
    responseType === null ||
    state === null
  ) {
    return { error: createErrorDiv('Invalid request: missing parameters') };
  }

  if (responseType !== 'code') {
    return { error: createErrorDiv('Invalid request: invalid response_type') };
  }

  if (scope !== 'openid') {
    return { error: createErrorDiv('Invalid request: invalid scope') };
  }

  if (!redirectUri.startsWith('https://')) {
    // will be more carefully verified on the server
    return { error: createErrorDiv('Invalid request: invalid redirect_uri') };
  }

  try {
    new URL(redirectUri);
  } catch (e) {
    return { error: createErrorDiv('Invalid request: invalid redirect_uri') };
  }

  if (requireCode && initialEmail === null) {
    return { error: createErrorDiv('Invalid request: require_code without email') };
  }

  return {
    params: {
      clientId,
      scope,
      redirectUri,
      responseType,
      state,
      initialEmail,
      requireCode,
    },
  };
}

/**
 * @returns {AuthorizeContextParams}
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
  var signInForm = document.getElementById('signInForm');
  document.addEventListener('resize', handleWindowSize);
  handleWindowSize();

  function handleWindowSize() {
    var height = window.innerHeight;
    signInForm.style.minHeight = `${Math.min(height, 720)}px`;
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

/** @returns {SVGElement} */
function createBrandmarkIcon() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '76px');
  svg.setAttribute('height', '72px');
  svg.appendChild(
    (() => {
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', '#3F484A');
      circle.setAttribute('stroke-linecap', 'round');
      circle.setAttribute('stroke-miterlimit', '10');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('cx', '28.032');
      circle.setAttribute('cy', '44.017');
      circle.setAttribute('r', '25.532');
      return circle;
    })()
  );
  svg.appendChild(
    (() => {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#3F484A');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-miterlimit', '10');
      path.setAttribute('stroke-width', '2');
      path.setAttribute(
        'd',
        'M 27.634 44.817 C 21.927 37.74 20.274 28.219 23.26 19.631 C 26.27 11.153 33.759 4.789 42.544 2.987 C 62.073 -0.974 78.569 17.689 72.236 36.584 C 69.604 44.432 63.379 50.549 55.484 53.042 C 54.442 53.373 53.38 53.639 52.304 53.837'
      );
      return path;
    })()
  );
  return svg;
}

/** @returns {SVGElement} */
function createEmailIcon() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '72px');
  svg.setAttribute('height', '72px');
  svg.appendChild(
    (() => {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute(
        'd',
        'M7 14.875C5.8264 14.875 4.875 15.8264 4.875 17V57.5C4.875 58.6736 5.82639 59.625 7 59.625H65C66.1736 59.625 67.125 58.6736 67.125 57.5V17C67.125 15.8264 66.1736 14.875 65 14.875H7Z'
      );
      path.setAttribute('stroke', '#3F484A');
      path.setAttribute('stroke-width', '2.25');
      path.setAttribute('fill', 'none');
      return path;
    })()
  );
  svg.appendChild(
    (() => {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute(
        'd',
        'M8.5708 14.875C6.63278 14.875 5.70627 17.2569 7.13489 18.5665L34.5641 43.7099C35.3765 44.4546 36.6235 44.4546 37.4359 43.7099L64.8651 18.5665C66.2937 17.2569 65.3672 14.875 63.4292 14.875H8.5708Z'
      );
      path.setAttribute('stroke', '#3F484A');
      path.setAttribute('stroke-width', '2.25');
      path.setAttribute('fill', 'none');
      return path;
    })()
  );
  return svg;
}
// #endregion

// #region Check Identity
/**
 * Attaches to the no code check identity form which is already rendered
 *
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 */
function attachToCheckForm(params, context) {
  var form = document.getElementById('signInForm');
  var errorContainer = document.getElementById('signInErrorContainer');
  var emailInput = document.getElementById('email');
  var submitButton = document.getElementById('signInSubmitButton');
  form.addEventListener('submit', realSubmitHandler);

  errorContainer.textContent = '';
  emailInput.removeAttribute('disabled');
  submitButton.removeAttribute('disabled');

  if (params.initialEmail !== null) {
    emailInput.value = params.initialEmail;
  }

  async function realSubmitHandler(event) {
    event.preventDefault();

    emailInput.setAttribute('disabled', 'disabled');
    submitButton.setAttribute('disabled', 'disabled');
    form.removeEventListener('submit', realSubmitHandler);

    try {
      await handleCheckSubmit(params, context, emailInput.value);
    } catch (e) {
      errorContainer.textContent = '';
      errorContainer.appendChild(
        (() => {
          if (e instanceof HTMLDivElement) {
            return e;
          }

          return createErrorDiv('An error occurred while processing the request');
        })()
      );

      var newLoc = new URL(window.location.href);
      newLoc.searchParams.set('email', emailInput.value);

      var newAnchor = document.createElement('a');
      newAnchor.classList.add('button');
      newAnchor.href = newLoc.toString();
      newAnchor.textContent = 'Try Another Email';

      submitButton.insertAdjacentElement('afterend', newAnchor);
      submitButton.remove();

      form.addEventListener('submit', (e) => {
        e.preventDefault();
      });
    }
  }
}

/**
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} email
 */
async function handleCheckSubmit(params, context, email) {
  if (email === 'test-error@example.com') {
    throw new Error('Test error');
  }

  var headers = {
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (context.visitor !== null) {
    headers['Visitor'] = context.visitor;
  }

  var response = await fetch(BACKEND_URL + '/api/1/oauth/siwo/check', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({
      email,
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      csrf: CSRF_TOKEN,
    }),
  });

  var result = undefined;
  if (response.status === 200) {
    /** @type {{ exists: boolean, name?: string | null }} */
    result = await response.json();
    if (result.exists) {
      var name = result.name === undefined ? null : result.name;
      swapToLoginForm(name);
      attachToLoginForm(params, context, email, name);
    } else {
      swapToRegisterForm();
      attachToRegisterForm(params, context, email);
    }
    return;
  }

  if (response.status === 403) {
    var newUrl = new URL(window.location.href);
    newUrl.searchParams.set('email', email);
    newUrl.searchParams.set('require_code', '1');
    window.location.href = newUrl.toString();
    return;
  }

  try {
    result = await response.json();
  } catch (e) {}
  if (typeof result === 'object' && typeof result.message === 'string') {
    throw createErrorDiv(result.message);
  }

  throw createErrorDiv(
    'There is an issue with your account. Please contact hi@oseh.com for support.'
  );
}
// #endregion

// #region Check with Code
function swapToCheckWithCodeForm() {
  var form = document.getElementById('signInForm');
  form.textContent = '';
  form.className = 'form form-check-with-code';

  form.appendChild(
    (() => {
      var contents = document.createElement('div');
      contents.classList.add('contents');
      contents.appendChild(
        (() => {
          var icon = document.createElement('div');
          icon.classList.add('icon');
          icon.appendChild(createEmailIcon());
          return icon;
        })()
      );
      contents.appendChild(
        (() => {
          var title = document.createElement('div');
          title.classList.add('title');
          title.textContent = 'Please verify your email address';
          return title;
        })()
      );
      contents.appendChild(
        (() => {
          var description = document.createElement('div');
          description.classList.add('description');
          description.textContent = 'We emailed you a verification code. Please check your inbox.';
          return description;
        })()
      );
      contents.appendChild(
        (() => {
          var formGroup = document.createElement('div');
          formGroup.classList.add('form-group', 'form-group-code');
          formGroup.appendChild(
            (() => {
              var label = document.createElement('label');
              label.setAttribute('for', 'code');
              return label;
            })()
          );
          formGroup.appendChild(
            (() => {
              var input = document.createElement('input');
              input.setAttribute('type', 'text');
              input.setAttribute('required', '');
              input.setAttribute('id', 'code');
              input.setAttribute('placeholder', '0000000');
              input.setAttribute('disabled', 'disabled');
              input.setAttribute('autocomplete', 'one-time-code');
              return input;
            })()
          );
          return formGroup;
        })()
      );
      contents.appendChild(
        (() => {
          var errorContainer = document.createElement('div');
          errorContainer.setAttribute('id', 'signInErrorContainer');
          return errorContainer;
        })()
      );
      return contents;
    })()
  );
  form.appendChild(
    (() => {
      var buttonGroup = document.createElement('div');
      buttonGroup.classList.add('button-group');
      buttonGroup.appendChild(
        (() => {
          var button = document.createElement('button');
          button.setAttribute('id', 'signInSubmitButton');
          button.setAttribute('type', 'submit');
          button.classList.add('button');
          button.textContent = 'Continue';
          button.setAttribute('disabled', 'disabled');
          return button;
        })()
      );
      return buttonGroup;
    })()
  );
}

/**
 * Attaches to the code check identity form which is already rendered
 *
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 */
function attachToCheckWithCodeForm(params, context) {
  var form = document.getElementById('signInForm');
  var input = document.getElementById('code');
  var button = document.getElementById('signInSubmitButton');
  var errorContainer = document.getElementById('signInErrorContainer');

  form.addEventListener('submit', realSubmitHandler);
  acknowledgeElevation().catch(() => {
    errorContainer.textContent = '';
    errorContainer.appendChild(
      createErrorDiv(
        'There was an error sending the verification email. Contact support at hi@oseh.com'
      )
    );
  });

  async function realSubmitHandler(event) {
    event.preventDefault();

    input.setAttribute('disabled', 'disabled');
    button.setAttribute('disabled', 'disabled');

    try {
      await handleCheckWithCodeSubmit(params, context, input.value);
    } catch (e) {
      if (e instanceof HTMLDivElement) {
        errorContainer.appendChild(e);
      } else {
        errorContainer.appendChild(
          createErrorDiv(
            'There was an issue processing your request. Please contact hi@oseh.com for support'
          )
        );
      }

      var newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('require_code');
      var retryAnchor = document.createElement('a');
      retryAnchor.classList.add('button');
      retryAnchor.href = newUrl.toString();
      retryAnchor.textContent = 'Try Again';
      button.insertAdjacentElement('afterend', retryAnchor);
      button.remove();
    }
  }

  async function acknowledgeElevation() {
    var response = await fetch(BACKEND_URL + '/api/1/oauth/siwo/acknowledge', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.status >= 200 && response.status < 300) {
      input.removeAttribute('disabled');
      button.removeAttribute('disabled');
      return;
    }

    throw new Error('Failed to acknowledge elevation');
  }
}

/**
 *
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} code
 */
async function handleCheckWithCodeSubmit(params, context, code) {
  var response = await fetch(BACKEND_URL + '/api/1/oauth/siwo/check', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      email: params.initialEmail,
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      csrf: CSRF_TOKEN,
      security_check_code: code.toUpperCase(),
    }),
  });

  var result;
  if (response.status === 200) {
    /** @type {{ exists: boolean, name?: string | null }} */
    result = await response.json();
    if (result.exists) {
      var name = result.name === undefined ? null : result.name;
      swapToLoginForm(name);
      attachToLoginForm(params, context, params.initialEmail, name);
    } else {
      swapToRegisterForm();
      attachToRegisterForm(params, context, params.initialEmail);
    }
    return;
  }

  try {
    result = await response.json();
  } catch (e) {}
  if (typeof result === 'object' && typeof result.message === 'string') {
    throw createErrorDiv(result.message);
  }

  throw createErrorDiv(
    'There is an issue with your account. Please contact hi@oseh.com for support.'
  );
}
// #endregion

// #region Login
/** @param {string | null} name */
function swapToLoginForm(name) {
  var usingName =
    name !== null &&
    name !== undefined &&
    name !== 'Anonymous' &&
    name !== '' &&
    name !== 'there' &&
    name !== 'There';

  var form = document.getElementById('signInForm');
  form.textContent = '';
  form.className = 'form form-login';
  form.appendChild(
    (() => {
      var contents = document.createElement('div');
      contents.classList.add('contents');
      contents.appendChild(
        (() => {
          var icon = document.createElement('div');
          icon.classList.add('icon');
          icon.appendChild(createBrandmarkIcon());
          return icon;
        })()
      );
      contents.appendChild(
        (() => {
          var title = document.createElement('div');
          title.classList.add('title');
          if (usingName) {
            title.textContent = 'Welcome back, ' + name.toString() + '.';
          } else {
            title.textContent = 'Enter your password';
          }
          return title;
        })()
      );
      if (usingName) {
        contents.appendChild(
          (() => {
            var description = document.createElement('div');
            description.classList.add('description');
            description.textContent = 'Please enter your password to sign in.';
            return description;
          })()
        );
      }
      contents.appendChild(
        (() => {
          var formGroup = document.createElement('div');
          formGroup.classList.add('form-group', 'form-group-disabled-email');
          formGroup.appendChild(
            (() => {
              var label = document.createElement('label');
              label.setAttribute('for', 'email');
              return label;
            })()
          );
          formGroup.appendChild(
            (() => {
              var email = document.createElement('input');
              email.setAttribute('type', 'email');
              email.setAttribute('required', '');
              email.setAttribute('id', 'email');
              email.setAttribute('autocomplete', 'email');
              email.setAttribute('disabled', '');
              return email;
            })()
          );
          return formGroup;
        })()
      );
      contents.appendChild(
        (() => {
          var formGroup = document.createElement('div');
          formGroup.classList.add('form-group', 'form-group-password');
          formGroup.appendChild(
            (() => {
              var label = document.createElement('label');
              label.setAttribute('for', 'password');
              return label;
            })()
          );
          formGroup.appendChild(
            (() => {
              var input = document.createElement('input');
              input.setAttribute('type', 'password');
              input.setAttribute('required', '');
              input.setAttribute('id', 'password');
              input.setAttribute('autocomplete', 'current-password');
              input.setAttribute('placeholder', 'Password');
              return input;
            })()
          );
          formGroup.appendChild(
            (() => {
              var checkboxGroup = document.createElement('div');
              checkboxGroup.classList.add('checkbox-group');
              checkboxGroup.appendChild(
                (() => {
                  var checkbox = document.createElement('input');
                  checkbox.setAttribute('type', 'checkbox');
                  checkbox.setAttribute('id', 'show-password');
                  return checkbox;
                })()
              );
              checkboxGroup.appendChild(
                (() => {
                  var label = document.createElement('label');
                  label.setAttribute('for', 'show-password');
                  label.textContent = 'Show Password';
                  return label;
                })()
              );
              return checkboxGroup;
            })()
          );
          return formGroup;
        })()
      );
      contents.appendChild(
        (() => {
          var errorContainer = document.createElement('div');
          errorContainer.setAttribute('id', 'signInErrorContainer');
          return errorContainer;
        })()
      );
      return contents;
    })()
  );
  form.appendChild(
    (() => {
      var buttonGroup = document.createElement('div');
      buttonGroup.classList.add('button-group');
      buttonGroup.appendChild(
        (() => {
          var button = document.createElement('button');
          button.setAttribute('id', 'signInSubmitButton');
          button.setAttribute('type', 'submit');
          button.classList.add('button');
          button.textContent = 'Continue';
          button.setAttribute('disabled', 'disabled');
          return button;
        })()
      );
      buttonGroup.appendChild(
        (() => {
          var button = document.createElement('button');
          button.setAttribute('id', 'signInForgotPasswordButton');
          button.setAttribute('type', 'button');
          button.classList.add('button', 'link-button');
          button.textContent = 'Forgot Password';
          return button;
        })()
      );
      return buttonGroup;
    })()
  );
}

/**
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} email
 * @param {string | null} name
 */
function attachToLoginForm(params, context, email, name) {
  /** @type HTMLFormElement */
  var form = document.getElementById('signInForm');
  /** @type HTMLButtonElement */
  var submitButton = document.getElementById('signInSubmitButton');
  /** @type HTMLButtonElement */
  var resetPasswordButton = document.getElementById('signInForgotPasswordButton');
  /** @type HTMLDivElement */
  var errorContainer = document.getElementById('signInErrorContainer');

  /** @type HTMLInputElement */
  var emailInput = document.getElementById('email');
  emailInput.value = email;

  /** @type HTMLInputElement */
  var passwordInput = document.getElementById('password');
  /** @type HTMLInputElement */
  var showPasswordInput = document.getElementById('show-password');

  showPasswordInput.removeAttribute('checked');
  passwordInput.setAttribute('type', 'password');
  showPasswordInput.addEventListener('change', () => {
    var nowChecked = showPasswordInput.checked;
    if (nowChecked) {
      passwordInput.setAttribute('type', 'text');
    } else {
      passwordInput.setAttribute('type', 'password');
    }
  });

  // we have to fight password managers changing disabled inputs
  emailInput.addEventListener('change', (ev) => {
    try {
      ev.preventDefault();
    } catch (e) {}
    emailInput.value = email;
  });
  var recheckEmailInput = () => {
    if (emailInput.value !== email) {
      emailInput.value = email;
    }
  };
  var interval = setInterval(recheckEmailInput, 1000);

  resetPasswordButton.addEventListener('click', (ev) => {
    ev.preventDefault();
    clearInterval(interval);
    swapToResetPasswordForm();
    attachToResetPasswordForm(params, context, email);
  });
  form.addEventListener('submit', realSubmitHandler);
  passwordInput.removeAttribute('disabled');
  showPasswordInput.removeAttribute('disabled');
  submitButton.removeAttribute('disabled');

  async function realSubmitHandler(ev) {
    ev.preventDefault();

    clearInterval(interval);
    form.removeEventListener('submit', realSubmitHandler);
    passwordInput.setAttribute('disabled', '');
    submitButton.setAttribute('disabled', '');

    try {
      var result = await handleLoginSubmit(params, context, email, passwordInput.value);
      if (result.category === 'bad-password') {
        interval = setInterval(recheckEmailInput, 1000);
        errorContainer.textContent = '';
        errorContainer.appendChild(createErrorDiv('That password is incorrect for this account'));
        form.addEventListener('submit', realSubmitHandler);
        passwordInput.removeAttribute('disabled');
        submitButton.removeAttribute('disabled');
      } else if (result.category === 'ratelimit') {
        interval = setInterval(recheckEmailInput, 1000);
        errorContainer.textContent = '';
        var errorDiv = createErrorDiv(
          'Please wait ' +
            result.ratelimitTimeSeconds.toLocaleString() +
            ' more seconds before trying again'
        );
        errorContainer.appendChild(errorDiv);

        var ratelimitStartedAt = Date.now();
        var updateTime = () => {
          var now = Date.now();
          var timeElapsedSeconds = (now - ratelimitStartedAt) / 1000;

          if (timeElapsedSeconds >= result.ratelimitTimeSeconds) {
            errorContainer.textContent = '';
            form.addEventListener('submit', realSubmitHandler);
            passwordInput.removeAttribute('disabled');
            submitButton.removeAttribute('disabled');
          } else {
            errorDiv.textContent =
              'Please wait ' +
              Math.ceil(result.ratelimitTimeSeconds - timeElapsedSeconds).toLocaleString() +
              ' more seconds before trying again';
            setTimeout(updateTime, 1000);
          }
        };
        setTimeout(updateTime, 1000);
      } else if (result.category !== 'success') {
        throw new Error('Unknown result category: ' + result.category);
      }
    } catch (e) {
      errorContainer.textContent = '';

      if (e instanceof HTMLDivElement) {
        errorContainer.appendChild(e);
      } else {
        errorContainer.appendChild(
          createErrorDiv(
            'There was an error processing your request. Please contact hi@oseh.com for support.'
          )
        );
      }
    }
  }
}

/**
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} email
 * @param {string} password
 * @returns {Promise<LoginResult>}
 */
async function handleLoginSubmit(params, context, email, password) {
  var response = await fetch(BACKEND_URL + '/api/1/oauth/siwo/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ password }),
  });

  if (response.status === 409) {
    return { category: 'bad-password' };
  }

  var result = await response.json();
  if (response.status === 429) {
    return {
      category: 'ratelimit',
      ratelimitTimeSeconds:
        typeof result.seconds_remaining === 'number' ? result.seconds_remaining : 60,
    };
  }

  if (!response.ok) {
    if (typeof result === 'object' && typeof result.message === 'string') {
      throw createErrorDiv(result.message);
    }
    throw createErrorDiv(
      'There was an issue with this request. Please contact hi@oseh.com for support'
    );
  }

  /** @type {boolean} */
  var emailVerified = result.email_verified;

  if (emailVerified) {
    swapToCompleteScreen();
    attachToCompleteScreen(params, context, email);
  } else {
    swapToRequestVerificationForm();
    attachToRequestVerificationForm(params, context, email);
  }
  return { category: 'success' };
}
// #endregion

// #region Register
function swapToRegisterForm() {
  var form = document.getElementById('signInForm');
  form.className = 'form form-register';
  form.textContent = '';
  form.appendChild(
    (() => {
      var contents = document.createElement('div');
      contents.classList.add('contents');
      contents.appendChild(
        (() => {
          var icon = document.createElement('div');
          icon.classList.add('icon');
          icon.appendChild(createBrandmarkIcon());
          return icon;
        })()
      );
      contents.appendChild(
        (() => {
          var title = document.createElement('div');
          title.classList.add('title');
          title.textContent = 'Create Account';
          return title;
        })()
      );
      contents.appendChild(
        (() => {
          var description = document.createElement('div');
          description.classList.add('description');
          description.textContent = 'Create a strong password with at least 8 letters or numbers';
          return description;
        })()
      );
      contents.appendChild(
        (() => {
          var formGroup = document.createElement('div');
          formGroup.classList.add('form-group', 'form-group-disabled-email');
          formGroup.appendChild(
            (() => {
              var label = document.createElement('label');
              label.setAttribute('for', 'email');
              return label;
            })()
          );
          formGroup.appendChild(
            (() => {
              var email = document.createElement('input');
              email.setAttribute('type', 'email');
              email.setAttribute('required', '');
              email.setAttribute('id', 'email');
              email.setAttribute('autocomplete', 'email');
              email.setAttribute('disabled', '');
              return email;
            })()
          );
          return formGroup;
        })()
      );
      contents.appendChild(
        (() => {
          var formGroup = document.createElement('div');
          formGroup.classList.add('form-group', 'form-group-password');
          formGroup.appendChild(
            (() => {
              var label = document.createElement('label');
              label.setAttribute('for', 'password');
              return label;
            })()
          );
          formGroup.appendChild(
            (() => {
              var input = document.createElement('input');
              input.setAttribute('type', 'password');
              input.setAttribute('required', '');
              input.setAttribute('id', 'password');
              input.setAttribute('autocomplete', 'new-password');
              input.setAttribute('placeholder', 'Password');
              return input;
            })()
          );
          formGroup.appendChild(
            (() => {
              var checkboxGroup = document.createElement('div');
              checkboxGroup.classList.add('checkbox-group');
              checkboxGroup.appendChild(
                (() => {
                  var checkbox = document.createElement('input');
                  checkbox.setAttribute('type', 'checkbox');
                  checkbox.setAttribute('id', 'show-password');
                  return checkbox;
                })()
              );
              checkboxGroup.appendChild(
                (() => {
                  var label = document.createElement('label');
                  label.setAttribute('for', 'show-password');
                  label.textContent = 'Show Password';
                  return label;
                })()
              );
              return checkboxGroup;
            })()
          );
          return formGroup;
        })()
      );
      contents.appendChild(
        (() => {
          var errorContainer = document.createElement('div');
          errorContainer.setAttribute('id', 'signInErrorContainer');
          return errorContainer;
        })()
      );
      return contents;
    })()
  );
  form.appendChild(
    (() => {
      var buttonGroup = document.createElement('div');
      buttonGroup.classList.add('button-group');
      buttonGroup.appendChild(
        (() => {
          var button = document.createElement('button');
          button.setAttribute('id', 'signInSubmitButton');
          button.setAttribute('type', 'submit');
          button.classList.add('button');
          button.textContent = 'Continue';
          button.setAttribute('disabled', 'disabled');
          return button;
        })()
      );
      return buttonGroup;
    })()
  );
}

/**
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} email
 */
function attachToRegisterForm(params, context, email) {
  /** @type HTMLFormElement */
  var form = document.getElementById('signInForm');
  var submitButton = document.getElementById('signInSubmitButton');

  /** @type HTMLInputElement */
  var emailInput = document.getElementById('email');
  emailInput.value = email;

  var errorContainer = document.getElementById('signInErrorContainer');

  /** @type HTMLInputElement */
  var passwordInput = document.getElementById('password');
  /** @type HTMLInputElement */
  var showPasswordInput = document.getElementById('show-password');

  showPasswordInput.removeAttribute('checked');
  passwordInput.setAttribute('type', 'password');
  showPasswordInput.addEventListener('change', () => {
    var nowChecked = showPasswordInput.checked;
    if (nowChecked) {
      passwordInput.setAttribute('type', 'text');
    } else {
      passwordInput.setAttribute('type', 'password');
    }
  });

  // we have to fight password managers changing disabled inputs
  emailInput.addEventListener('change', (ev) => {
    try {
      ev.preventDefault();
    } catch (e) {}
    emailInput.value = email;
  });
  var interval = setInterval(() => {
    if (emailInput.value !== email) {
      emailInput.value = email;
    }
  }, 1000);

  form.addEventListener('submit', realSubmitHandler);
  submitButton.removeAttribute('disabled');

  async function realSubmitHandler(e) {
    e.preventDefault();

    clearInterval(interval);
    passwordInput.setAttribute('disabled', 'disabled');
    submitButton.setAttribute('disabled', 'disabled');
    form.removeEventListener('submit', realSubmitHandler);

    try {
      await handleRegisterSubmit(params, context, emailInput.value, passwordInput.value);
    } catch (e) {
      if (e instanceof HTMLDivElement) {
        errorContainer.appendChild(e);
      } else {
        errorContainer.appendChild(
          createErrorDiv(
            'There was an issue processing your request. Please contact hi@oseh.com for support.'
          )
        );
      }

      var newLoc = new URL(window.location.href);
      newLoc.searchParams.set('email', emailInput.value);
      newLoc.searchParams.delete('require_code');

      var anchor = document.createElement('a');
      anchor.href = newLoc.toString();
      anchor.classList.add('button');
      anchor.textContent = 'Go Back';
      submitButton.insertAdjacentElement('afterend', anchor);
      submitButton.remove();
    }
  }
}

/**
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} email
 * @param {string} password
 */
async function handleRegisterSubmit(params, context, email, password) {
  var response = await fetch(BACKEND_URL + '/api/1/oauth/siwo/create_identity', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      password,
    }),
  });

  var result = undefined;
  if (response.ok) {
    /** @type {{ email_verified: boolean }} */
    result = await response.json();

    if (result.email_verified) {
      swapToCompleteScreen();
      attachToCompleteScreen(params, context, email);
    } else {
      swapToRequestVerificationForm();
      attachToRequestVerificationForm(params, context, email);
    }
    return;
  }

  try {
    result = await response.json();
  } catch (e) {}
  if (typeof result === 'object' && typeof result.message === 'string') {
    return createErrorDiv(result.message);
  }

  throw createErrorDiv(
    'There is an issue with your account. Please contact hi@oseh.com for support'
  );
}
// #endregion

// #region Reset Password
function swapToResetPasswordForm() {
  var form = document.getElementById('signInForm');
  form.textContent = '';
  form.className = 'form form-reset-password';
  form.appendChild(
    (() => {
      var contents = document.createElement('div');
      contents.classList.add('contents');
      contents.appendChild(
        (() => {
          var icon = document.createElement('div');
          icon.classList.add('icon');
          icon.appendChild(createBrandmarkIcon());
          return icon;
        })()
      );
      contents.appendChild(
        (() => {
          var title = document.createElement('div');
          title.classList.add('title');
          title.textContent = 'Reset Your Password';
          return title;
        })()
      );
      contents.appendChild(
        (() => {
          var description = document.createElement('div');
          description.classList.add('description');
          description.setAttribute('id', 'description');
          description.textContent =
            'Press the button below to send yourself an email. You will need to click the link in your inbox to complete the process.';
          return description;
        })()
      );
      contents.appendChild(
        (() => {
          var errorContainer = document.createElement('div');
          errorContainer.setAttribute('id', 'signInErrorContainer');
          return errorContainer;
        })()
      );
      return contents;
    })()
  );
  form.appendChild(
    (() => {
      var buttonGroup = document.createElement('div');
      buttonGroup.classList.add('button-group');
      buttonGroup.appendChild(
        (() => {
          var button = document.createElement('button');
          button.setAttribute('id', 'signInSubmitButton');
          button.setAttribute('type', 'submit');
          button.classList.add('button');
          button.textContent = 'Send Email';
          button.setAttribute('disabled', 'disabled');
          return button;
        })()
      );
      return buttonGroup;
    })()
  );
}

/**
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} email
 */
function attachToResetPasswordForm(params, context, email) {
  /** @type {HTMLFormElement} */
  var form = document.getElementById('signInForm');
  /** @type {HTMLButtonElement} */
  var submitButton = document.getElementById('signInSubmitButton');
  /** @type {HTMLDivElement} */
  var errorContainer = document.getElementById('signInErrorContainer');
  /** @type {HTMLDivElement} */
  var description = document.getElementById('description');

  form.addEventListener('submit', realSubmitHandler);
  submitButton.removeAttribute('disabled');

  async function realSubmitHandler(ev) {
    ev.preventDefault();

    submitButton.setAttribute('disabled', '');

    try {
      await handleResetPasswordSubmit(params, context, email);
      description.textContent =
        'We just emailed you a link to reset your password.  Please click the link in your email.';
      submitButton.textContent = 'Email Sent';
    } catch (e) {
      if (e instanceof HTMLDivElement) {
        errorContainer.appendChild(e);
      } else {
        errorContainer.appendChild(
          createErrorDiv(
            'There was an error processing your request. Please contact hi@oseh.com for support.'
          )
        );
      }
    }
  }
}

/**
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} email
 */
async function handleResetPasswordSubmit(params, context, email) {
  if (email === 'test-reset-password@example.com') {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return;
  }

  var response = await fetch(BACKEND_URL + '/api/1/oauth/siwo/reset_password', {
    method: 'POST',
    credentials: 'include',
  });

  if (response.ok) {
    return;
  }

  var result = await response.json();
  if (typeof result === 'object' && typeof result.message === 'string') {
    throw createErrorDiv(result.message);
  }

  throw createErrorDiv(
    'There was an issue with your account. Please contact hi@oseh.com for support'
  );
}
// #endregion

// #region Request Verification
function swapToRequestVerificationForm() {
  var form = document.getElementById('signInForm');
  form.textContent = '';
  form.className = 'form form-verify';

  form.appendChild(
    (() => {
      var contents = document.createElement('div');
      contents.classList.add('contents');
      contents.appendChild(
        (() => {
          var icon = document.createElement('div');
          icon.classList.add('icon');
          icon.appendChild(createEmailIcon());
          return icon;
        })()
      );
      contents.appendChild(
        (() => {
          var title = document.createElement('div');
          title.classList.add('title');
          title.textContent = 'Please verify your email address';
          return title;
        })()
      );
      contents.appendChild(
        (() => {
          var description = document.createElement('div');
          description.classList.add('description');
          description.textContent = 'We emailed you a verification code. Please check your inbox.';
          return description;
        })()
      );
      contents.appendChild(
        (() => {
          var formGroup = document.createElement('div');
          formGroup.classList.add('form-group', 'form-group-code');
          formGroup.appendChild(
            (() => {
              var label = document.createElement('label');
              label.setAttribute('for', 'code');
              return label;
            })()
          );
          formGroup.appendChild(
            (() => {
              var input = document.createElement('input');
              input.setAttribute('type', 'text');
              input.setAttribute('required', '');
              input.setAttribute('id', 'code');
              input.setAttribute('placeholder', '0000000');
              input.setAttribute('disabled', 'disabled');
              input.setAttribute('autocomplete', 'one-time-code');
              return input;
            })()
          );
          return formGroup;
        })()
      );
      contents.appendChild(
        (() => {
          var errorContainer = document.createElement('div');
          errorContainer.setAttribute('id', 'signInErrorContainer');
          return errorContainer;
        })()
      );
      return contents;
    })()
  );
  form.appendChild(
    (() => {
      var buttonGroup = document.createElement('div');
      buttonGroup.classList.add('button-group');
      buttonGroup.appendChild(
        (() => {
          var button = document.createElement('button');
          button.setAttribute('id', 'signInSubmitButton');
          button.setAttribute('type', 'submit');
          button.classList.add('button');
          button.textContent = 'Continue';
          button.setAttribute('disabled', 'disabled');
          return button;
        })()
      );
      buttonGroup.appendChild(
        (() => {
          var button = document.createElement('button');
          button.setAttribute('id', 'signInSkipButton');
          button.setAttribute('type', 'button');
          button.classList.add('button', 'link-button');
          button.textContent = 'Skip For Now';
          button.setAttribute('disabled', 'disabled');
          return button;
        })()
      );
      return buttonGroup;
    })()
  );
}

/**
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} email
 */
function attachToRequestVerificationForm(params, context, email) {
  /** @type {HTMLFormElement} */
  var form = document.getElementById('signInForm');
  /** @type {HTMLInputElement} */
  var input = document.getElementById('code');
  /** @type {HTMLButtonElement} */
  var submitButton = document.getElementById('signInSubmitButton');
  /** @type {HTMLButtonElement} */
  var skipButton = document.getElementById('signInSkipButton');
  /** @type {HTMLDivElement} */
  var errorContainer = document.getElementById('signInErrorContainer');

  requestVerification();

  async function requestVerificationInner() {
    var response = await fetch(BACKEND_URL + '/api/1/oauth/siwo/request_verification', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw response;
    }
  }

  async function requestVerification() {
    try {
      await requestVerificationInner();

      form.addEventListener('submit', realSubmitHandler);
      skipButton.addEventListener('click', handleSkipForNow);
      input.removeAttribute('disabled');
      submitButton.removeAttribute('disabled');
      skipButton.removeAttribute('disabled');
    } catch (e) {
      console.error('catching error requesting verification:', e);
      swapToCompleteScreen();
      attachToCompleteScreen(params, context, email);
    }
  }

  /** @param {Event} ev */
  async function realSubmitHandler(ev) {
    ev.preventDefault();

    input.setAttribute('disabled', 'disabled');
    submitButton.setAttribute('disabled', 'disabled');
    skipButton.setAttribute('disabled', 'disabled');
    form.removeEventListener('submit', realSubmitHandler);

    try {
      await handleCompleteVerification(params, context, email, input.value);
    } catch (e) {
      errorContainer.textContent = '';
      if (e instanceof HTMLDivElement) {
        errorContainer.appendChild(e);
      } else if (e instanceof Error && e.message === 'code') {
        errorContainer.appendChild(
          createErrorDiv(
            'The code you entered was incorrect. Click "Skip For Now" to continue without verifying your email.'
          )
        );
        input.removeAttribute('disabled');
        submitButton.removeAttribute('disabled');
        form.addEventListener('submit', realSubmitHandler);
      } else if (e instanceof Error && e.message === 'ratelimit') {
        errorContainer.appendChild(
          createErrorDiv(
            'You have tried too many codes recently. Click "Skip For Now" to continue without verifying your email.'
          )
        );
      } else {
        errorContainer.appendChild(
          createErrorDiv(
            'There was an error processing your request. Please contact hi@oseh.com for support or click "Skip For Now" to continue without verifying your email.'
          )
        );
      }

      skipButton.removeAttribute('disabled');
    }
  }

  /** @param {Event} ev */
  function handleSkipForNow(ev) {
    ev.preventDefault();
    swapToCompleteScreen();
    attachToCompleteScreen(params, context, email);
  }
}

/**
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} email
 * @param {string} code
 */
async function handleCompleteVerification(params, context, email, code) {
  var response = await fetch(BACKEND_URL + '/api/1/oauth/siwo/complete_verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    credentials: 'include',
    body: JSON.stringify({
      code: code.toUpperCase(),
    }),
  });

  if (response.ok) {
    swapToCompleteScreen();
    attachToCompleteScreen(params, context, email);
    return;
  }

  if (response.status === 400) {
    throw new Error('code');
  }

  if (response.status === 429) {
    throw new Error('ratelimit');
  }

  var result = await response.json();
  if (typeof result === 'object' && typeof result.message === 'string') {
    throw createErrorDiv(result.message);
  }

  throw createErrorDiv(
    'There was an issue with your account. Please contact hi@oseh.com for support.'
  );
}
// #endregion

// #region Complete
function swapToCompleteScreen() {
  var form = document.getElementById('signInForm');
  form.textContent = '';
  form.className = 'form form-complete';
  form.appendChild(
    (() => {
      var contents = document.createElement('div');
      contents.classList.add('contents');
      contents.appendChild(
        (() => {
          var icon = document.createElement('div');
          icon.classList.add('icon');
          icon.appendChild(createBrandmarkIcon());
          return icon;
        })()
      );
      contents.appendChild(
        (() => {
          var title = document.createElement('div');
          title.classList.add('title');
          title.textContent = 'Finishing up';
          return title;
        })()
      );
      contents.appendChild(
        (() => {
          var description = document.createElement('div');
          description.classList.add('description');
          description.setAttribute('id', 'description');
          description.textContent = 'You should be redirected momentarily.';
          return description;
        })()
      );
      contents.appendChild(
        (() => {
          var errorContainer = document.createElement('div');
          errorContainer.setAttribute('id', 'signInErrorContainer');
          return errorContainer;
        })()
      );
      return contents;
    })()
  );
  form.appendChild(
    (() => {
      var buttonGroup = document.createElement('div');
      buttonGroup.classList.add('button-group');
      buttonGroup.appendChild(
        (() => {
          var button = document.createElement('a');
          button.setAttribute('id', 'signInSubmitButton');
          button.setAttribute('href', '/');
          button.classList.add('button');
          button.textContent = 'Return to Oseh';
          button.setAttribute('disabled', 'disabled');
          return button;
        })()
      );
      return buttonGroup;
    })()
  );
}

/**
 * @param {AuthorizeQueryParams} params
 * @param {AuthorizeContextParams} context
 * @param {string} email
 */
function attachToCompleteScreen(params, context, email) {
  /** @type {HTMLDivElement} */
  var errorContainer = document.getElementById('signInErrorContainer');
  /** @type {HTMLDivElement} */
  var description = document.getElementById('description');
  /** @type {HTMLButtonElement} */
  var button = document.getElementById('signInSubmitButton');

  /** @returns {Promise<void>} */
  async function exchangeForCode() {
    var response = await fetch(BACKEND_URL + '/api/1/oauth/siwo/exchange_for_code', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.status === 409) {
      description.textContent = 'Return to the app to login.';
      button.removeAttribute('disabled');
      return;
    }

    var result = await response.json();

    if (!response.ok) {
      if (typeof result === 'object' && typeof result.message === 'string') {
        throw createErrorDiv(result.message);
      }

      throw response;
    }

    /** @type {string} */
    var code = result.code;
    var redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', params.state);
    redirectUrl.searchParams.set('scope', params.scope);
    window.location.href = redirectUrl.toString();
  }

  exchangeForCode().catch((e) => {
    console.error('exchangeForCode - catching error: ', e);
    if (e instanceof HTMLDivElement) {
      errorContainer.appendChild(e);
    } else {
      errorContainer.appendChild(
        createErrorDiv(
          'There was an error finalizing your request. Please contact hi@oseh.com for support.'
        )
      );
    }
    button.removeAttribute('disabled');
  });
}
// #endregion

// #region footer
if (document.readyState === 'complete') {
  onDocumentReady();
} else {
  document.addEventListener('DOMContentLoaded', onDocumentReady, false);
}
// #endregion
