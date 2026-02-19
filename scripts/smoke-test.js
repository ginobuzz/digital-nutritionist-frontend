#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || process.env.DN_SMOKE_API_BASE_URL || 'http://localhost:8000').replace(
  /\/+$/,
  ''
);

const REQUIRE_CHAT = (process.env.DN_SMOKE_REQUIRE_CHAT || '1') !== '0';
const KEEP_DATA = (process.env.DN_SMOKE_KEEP_DATA || '0') === '1';

const DEFAULT_TIMEOUT_MS = Number(process.env.DN_SMOKE_TIMEOUT_MS || 20_000);
const CHAT_TIMEOUT_MS = Number(process.env.DN_SMOKE_CHAT_TIMEOUT_MS || 90_000);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const pad2 = (n) => String(n).padStart(2, '0');

const localIsoDate = (d = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
};

const addDaysLocal = (d, days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), d.getSeconds());

const withTimeout = async (promiseFactory, timeoutMs, label) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await promiseFactory(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
};

const requestJson = async (path, { method = 'GET', token, body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  const url = `${API_BASE_URL}${path}`;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await withTimeout(
    (signal) =>
      fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      }),
    timeoutMs,
    `${method} ${path}`
  );

  const text = await res.text().catch(() => '');
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { res, status: res.status, ok: res.ok, json, text };
};

const expectOk = async (label, response) => {
  if (response.ok) return;
  const detail = response?.json?.detail || response?.text || `${response.status}`;
  throw new Error(`${label} failed (${response.status}): ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
};

const run = async () => {
  const startedAt = Date.now();
  const cleanup = [];

  const step = (name) => console.log(`\n=== ${name} ===`);
  const info = (msg) => console.log(msg);

  step('Backend health');
  await expectOk('GET /health', await requestJson('/health'));
  const configRes = await requestJson('/health/config');
  await expectOk('GET /health/config', configRes);
  const openaiConfigured = Boolean(configRes.json?.openai_api_key_configured);
  info(`API: ${API_BASE_URL}`);
  info(`OpenAI configured: ${openaiConfigured ? 'yes' : 'no'}`);

  const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const email = `smoke.${runId}@example.com`;
  const password = `SmokePass!${runId}`;

  const today = new Date();
  const todayIso = localIsoDate(today);
  const tomorrowIso = localIsoDate(addDaysLocal(today, 1));

  step('Signup');
  const signupPayload = {
    email,
    password,
    first_name: 'Smoke',
    last_name: `Test${runId.slice(-4)}`,
    age: 30,
    gender: 'male',
    activity_level: 'moderately_active',
    height_in: 70,
    starting_weight_lb: 180,
    goal_weight_lb: 170,
    goal_weight_date: localIsoDate(addDaysLocal(today, 90)),
    daily_calorie_budget: 2000,
  };

  const signupRes = await requestJson('/auth/signup', { method: 'POST', body: signupPayload });
  await expectOk('POST /auth/signup', signupRes);
  const signupToken = signupRes.json?.access_token;
  const userId = signupRes.json?.user?.id;
  assert(typeof signupToken === 'string' && signupToken.length > 10, 'Signup did not return access_token');
  assert(typeof userId === 'string' && userId.length > 5, 'Signup did not return user.id');
  info(`Created user: ${email} (${userId})`);

  step('Login');
  const loginRes = await requestJson('/auth/login', { method: 'POST', body: { email, password } });
  await expectOk('POST /auth/login', loginRes);
  let token = loginRes.json?.access_token;
  assert(typeof token === 'string' && token.length > 10, 'Login did not return access_token');
  assert(loginRes.json?.user?.id === userId, 'Login user.id mismatch');

  const authed = (path, options) => requestJson(path, { ...options, token });

  step('Profile setup (get + update)');
  const meRes = await authed(`/users/${userId}`);
  await expectOk('GET /users/{id}', meRes);
  assert(meRes.json?.email === email, 'User email mismatch after signup/login');

  const updatedBudget = 2100;
  const updateRes = await authed(`/users/${userId}`, {
    method: 'PUT',
    body: { daily_calorie_budget: updatedBudget, activity_level: 'lightly_active' },
  });
  await expectOk('PUT /users/{id}', updateRes);
  assert(updateRes.json?.daily_calorie_budget === updatedBudget, 'Profile update did not persist daily_calorie_budget');

  step('Meal log (create/edit/delete)');
  const mealCreateRes = await authed('/meal-logs/', {
    method: 'POST',
    body: {
      user_id: userId,
      date: todayIso,
      meal_type: 'breakfast',
      user_description: 'Smoke test meal log: oatmeal + berries',
      estimated_calories: 350,
      protein_g: 18,
      carbs_g: 55,
      fat_g: 9,
    },
  });
  await expectOk('POST /meal-logs/', mealCreateRes);
  const mealLogId = mealCreateRes.json?.id;
  assert(typeof mealLogId === 'string' && mealLogId.length > 5, 'Meal log create did not return id');
  cleanup.push(() => requestJson(`/meal-logs/${mealLogId}`, { method: 'DELETE', token }).catch(() => undefined));

  const mealUpdateRes = await authed(`/meal-logs/${mealLogId}`, {
    method: 'PUT',
    body: { user_description: 'Smoke test meal log: oatmeal + berries (updated)', estimated_calories: 375 },
  });
  await expectOk('PUT /meal-logs/{id}', mealUpdateRes);

  const mealDeleteRes = await authed(`/meal-logs/${mealLogId}`, { method: 'DELETE' });
  assert(mealDeleteRes.status === 204, `Expected 204 from DELETE /meal-logs/{id}, got ${mealDeleteRes.status}`);
  cleanup.pop(); // already deleted

  const mealGetAfterDelete = await authed(`/meal-logs/${mealLogId}`);
  assert(mealGetAfterDelete.status === 404, `Expected 404 after deleting meal log, got ${mealGetAfterDelete.status}`);

  step('Planned meal (create/edit/delete)');
  const plannedTime = new Date(addDaysLocal(today, 1));
  plannedTime.setHours(19, 0, 0, 0);
  const plannedCreateRes = await authed('/planned-meals/', {
    method: 'POST',
    body: {
      user_id: userId,
      date: tomorrowIso,
      name: 'Smoke test planned dinner',
      calories: 650,
      meal_type: 'dinner',
      time: plannedTime.toISOString(),
      description: 'Salmon + rice + veggies',
    },
  });
  await expectOk('POST /planned-meals/', plannedCreateRes);
  const plannedMealId = plannedCreateRes.json?.id;
  assert(typeof plannedMealId === 'string' && plannedMealId.length > 5, 'Planned meal create did not return id');
  cleanup.push(() => requestJson(`/planned-meals/${plannedMealId}`, { method: 'DELETE', token }).catch(() => undefined));

  const plannedUpdateRes = await authed(`/planned-meals/${plannedMealId}`, { method: 'PUT', body: { calories: 700 } });
  await expectOk('PUT /planned-meals/{id}', plannedUpdateRes);
  assert(plannedUpdateRes.json?.calories === 700, 'Planned meal update did not persist calories');

  const plannedDeleteRes = await authed(`/planned-meals/${plannedMealId}`, { method: 'DELETE' });
  assert(plannedDeleteRes.status === 204, `Expected 204 from DELETE /planned-meals/{id}, got ${plannedDeleteRes.status}`);
  cleanup.pop();

  step('Activity log (create/edit/delete)');
  const activityTime = new Date(today);
  activityTime.setMinutes(activityTime.getMinutes() + 15);
  const activityCreateRes = await authed('/activity-logs/', {
    method: 'POST',
    body: {
      user_id: userId,
      date: todayIso,
      name: 'Smoke test jog',
      calories_burned: 220,
      duration: 25,
      type: 'cardio',
      time: activityTime.toISOString(),
    },
  });
  await expectOk('POST /activity-logs/', activityCreateRes);
  const activityId = activityCreateRes.json?.id;
  assert(typeof activityId === 'string' && activityId.length > 5, 'Activity create did not return id');
  cleanup.push(() => requestJson(`/activity-logs/${activityId}`, { method: 'DELETE', token }).catch(() => undefined));

  const activityUpdateRes = await authed(`/activity-logs/${activityId}`, { method: 'PUT', body: { calories_burned: 250 } });
  await expectOk('PUT /activity-logs/{id}', activityUpdateRes);
  assert(activityUpdateRes.json?.calories_burned === 250, 'Activity update did not persist calories_burned');

  const activityDeleteRes = await authed(`/activity-logs/${activityId}`, { method: 'DELETE' });
  assert(activityDeleteRes.status === 204, `Expected 204 from DELETE /activity-logs/{id}, got ${activityDeleteRes.status}`);
  cleanup.pop();

  step('Weight log (create/edit/delete)');
  const weightCreateRes = await authed('/weight-logs/', {
    method: 'POST',
    body: { user_id: userId, date: todayIso, weight: 180.2, notes: 'Smoke test weigh-in' },
  });
  await expectOk('POST /weight-logs/', weightCreateRes);
  const weightLogId = weightCreateRes.json?.id;
  assert(typeof weightLogId === 'string' && weightLogId.length > 5, 'Weight log create did not return id');
  cleanup.push(() => requestJson(`/weight-logs/${weightLogId}`, { method: 'DELETE', token }).catch(() => undefined));

  const weightUpdateRes = await authed(`/weight-logs/${weightLogId}`, { method: 'PUT', body: { weight: 179.8 } });
  await expectOk('PUT /weight-logs/{id}', weightUpdateRes);
  assert(Number(weightUpdateRes.json?.weight) === 179.8, 'Weight update did not persist weight');

  const weightDeleteRes = await authed(`/weight-logs/${weightLogId}`, { method: 'DELETE' });
  assert(weightDeleteRes.status === 204, `Expected 204 from DELETE /weight-logs/{id}, got ${weightDeleteRes.status}`);
  cleanup.pop();

  step('Chat logging');
  if (!openaiConfigured) {
    if (REQUIRE_CHAT) throw new Error('Chat is required but OPENAI_API_KEY is not configured (per /health/config).');
    info('Skipping chat: OPENAI_API_KEY not configured.');
  } else {
    const chatRes = await requestJson('/chat', {
      method: 'POST',
      token,
      timeoutMs: CHAT_TIMEOUT_MS,
      body: {
        user_id: userId,
        client_local_date: todayIso,
        client_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        message:
          "I ate lunch today: turkey sandwich on whole wheat + an apple. Please log it as lunch. Estimated calories: 600. Protein: 35g, carbs: 70g, fat: 18g.",
      },
    });
    await expectOk('POST /chat', chatRes);
    assert(typeof chatRes.json?.reply === 'string' && chatRes.json.reply.trim(), 'Chat reply was empty');

    const createdFromChat = Array.isArray(chatRes.json?.created_meal_logs) ? chatRes.json.created_meal_logs : [];
    assert(createdFromChat.length >= 1, 'Chat did not create any meal logs (created_meal_logs was empty)');

    for (const log of createdFromChat) {
      const id = log?.id;
      if (typeof id === 'string' && id) {
        const delRes = await authed(`/meal-logs/${id}`, { method: 'DELETE' });
        assert(delRes.status === 204, `Expected 204 deleting chat-created meal log ${id}, got ${delRes.status}`);
      }
    }
  }

  step('Logout + login again');
  const noAuthRes = await requestJson(`/users/${userId}`, { token: null });
  assert(noAuthRes.status === 401, `Expected 401 without auth token, got ${noAuthRes.status}`);

  const reloginRes = await requestJson('/auth/login', { method: 'POST', body: { email, password } });
  await expectOk('POST /auth/login (again)', reloginRes);
  const token2 = reloginRes.json?.access_token;
  assert(typeof token2 === 'string' && token2.length > 10, 'Re-login did not return access_token');
  token = token2;

  const afterReloginRes = await requestJson(`/users/${userId}`, { token });
  await expectOk('GET /users/{id} after re-login', afterReloginRes);

  step('Cleanup');
  if (KEEP_DATA) {
    info('DN_SMOKE_KEEP_DATA=1; skipping cleanup.');
  } else {
    // Best-effort cleanup: ensure any remaining resources are removed, then delete the user.
    for (const fn of cleanup.reverse()) {
      // eslint-disable-next-line no-await-in-loop
      await fn();
    }
    const deleteUserRes = await requestJson(`/users/${userId}`, { method: 'DELETE', token });
    assert(deleteUserRes.status === 204, `Expected 204 from DELETE /users/{id}, got ${deleteUserRes.status}`);
  }

  const durationSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n✅ Smoke test passed in ~${durationSec}s`);
};

run().catch((err) => {
  console.error('\n❌ Smoke test failed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});

