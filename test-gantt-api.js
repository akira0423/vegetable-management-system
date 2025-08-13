// Gantt API のテスト
const http = require('http');

function testGanttAPI() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/gantt?company_id=a1111111-1111-1111-1111-111111111111&start_date=2025-02-01&end_date=2026-02-28',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
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
      try {
        const parsed = JSON.parse(responseData);
        console.log('\n📊 Task count:', parsed.data?.tasks?.length || 0);
        if (parsed.data?.tasks?.length > 0) {
          console.log('📝 First task:', JSON.stringify(parsed.data.tasks[0], null, 2));
        }
      } catch (e) {
        console.log('JSON parse error:', e.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.end();
}

console.log('Testing Gantt API...');
testGanttAPI();