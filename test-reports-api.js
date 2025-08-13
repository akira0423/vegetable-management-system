// Reports API のテスト
const http = require('http');

function testReportsAPI() {
  const data = JSON.stringify({
    company_id: 'a1111111-1111-1111-1111-111111111111',
    work_type: 'テスト作業',
    work_date: '2024-01-01',
    description: 'API テスト用の作業報告'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/reports',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('Response:', responseData);
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.write(data);
  req.end();
}

console.log('Testing Reports API...');
testReportsAPI();