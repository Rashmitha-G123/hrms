const BASE_URL = 'https://hrms-api.genmindz.in/api';

async function probe(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Tenant-Id': 'company'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await res.json();
    console.log(`[PROBE] ${method} ${endpoint} -> Status ${res.status}:`, JSON.stringify(data));
    return { status: res.status, data };
  } catch (err) {
    console.log(`[PROBE ERROR] ${method} ${endpoint} ->`, err.message);
    return { status: 500, err };
  }
}

async function run() {
  console.log('Registering Superadmin...');
  const reg = await probe('/auth/register-superadmin', 'POST', {
    name: 'Super Admin',
    email: 'superadmin@company.com',
    password: 'SecurePassword123'
  });

  let token = null;
  if (reg.status === 200 || reg.status === 201 || reg.status === 400) {
    console.log('Logging in as Superadmin...');
    const capRes = await fetch(`${BASE_URL}/auth/captcha`, { headers: { 'X-Tenant-Id': 'company' } });
    const captchaData = await capRes.json();
    console.log('Captcha:', captchaData);
    
    const loginRes = await probe('/auth/login', 'POST', {
      email: 'superadmin@company.com',
      password: 'SecurePassword123',
      captcha: 'XYZW',
      captchaToken: captchaData.captchaToken
    });
    if (loginRes.data && loginRes.data.token) {
      token = loginRes.data.token;
      console.log('Login successful! Token acquired.');
    }
  }

  if (!token) {
    console.log('Could not login, testing unauthorized requests...');
  }

  // Probe profile and employees
  const paths = [
    '/auth/profile',
    '/hr/employees'
  ];

  for (const p of paths) {
    await probe(p, 'GET', null, token);
  }
}

run();
