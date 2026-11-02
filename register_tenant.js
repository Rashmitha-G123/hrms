const BASE_URL = 'https://workspace-api.genmindz.in/api';

async function register() {
  console.log('Sending registration request for tenant: company...');
  try {
    const res = await fetch(`${BASE_URL}/auth/register-superadmin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'company'
      },
      body: JSON.stringify({
        name: 'Super Admin',
        email: 'superadmin@company.com',
        password: 'SecurePassword123'
      })
    });
    const data = await res.json();
    console.log('Server Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Connection Error:', err.message);
  }
}

register();
