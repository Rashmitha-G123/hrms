const BASE_URL = 'https://hrms-api.genmindz.in/api';
async function run() {
  console.log("Fetching Captcha...");
  try {
    const capRes = await fetch(`${BASE_URL}/auth/captcha`, { headers: { 'X-Tenant-Id': 'company' } });
    const captchaData = await capRes.json();
    console.log("Logging in as Superadmin...");
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'company'
      },
      body: JSON.stringify({
        email: 'superadmin@company.com',
        password: 'SecurePassword123',
        captcha: 'XYZW',
        captchaToken: captchaData.captchaToken
      })
    });
    const loginData = await loginRes.json();
    if (loginData && loginData.token) {
      const token = loginData.token;
      console.log("Fetching profile...");
      const profileRes = await fetch(`${BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Id': 'company'
        }
      });
      const profileData = await profileRes.json();
      console.log("Profile keys under user:", Object.keys(profileData.user || {}));
      if (profileData.user) {
        console.log("employeePersonal keys:", Object.keys(profileData.user.employeePersonal || {}));
        console.log("employmentDetails keys:", Object.keys(profileData.user.employmentDetails || {}));
        console.log("All Profile Data keys:", Object.keys(profileData));
        console.log("Raw Profile user:", JSON.stringify(profileData.user, null, 2));
      }
    } else {
      console.log("Failed to login:", loginData);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run();
