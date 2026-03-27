// Simple test script to test the login endpoint
import http from 'http';

const testLogin = () => {
  console.log('Testing Login Endpoint...\n');

  const credentials = {
    email: 'hr@pvschemicals.com',
    password: 'abc123xyz',
    authMethod: 'local'
  };

  const postData = JSON.stringify(credentials);

  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/v2/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('URL: http://localhost:4000/api/v2/auth/login');
  console.log('Body:', JSON.stringify(credentials, null, 2));
  console.log('\nSending request...\n');

  const req = http.request(options, (res) => {
    console.log('Status:', res.statusCode, res.statusMessage);
    console.log('Headers:', res.headers);
    console.log('\nResponse Body:');

    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log(JSON.stringify(json, null, 2));
      } catch {
        console.log(data);
      }

      if (res.statusCode === 200) {
        console.log('\n✅ Login test PASSED!');
      } else {
        console.log('\n❌ Login test FAILED!');
      }
    });
  });

  req.on('error', (error) => {
    console.error('\n❌ Error:', error.message);
    console.error('Make sure the server is running on http://localhost:4000');
  });

  req.write(postData);
  req.end();
};

testLogin();
