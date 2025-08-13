// 正しい日付範囲でのGantt API テスト
const http = require('http');

function testGanttAPIWithCorrectDates() {
  // タスクの日付は 2025-08-15 ～ 2025-08-20 なので、それを含む範囲を指定
  const path = '/api/gantt?company_id=a1111111-1111-1111-1111-111111111111&start_date=2025-08-01&end_date=2025-08-31';
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  console.log(`Testing with date range: 2025-08-01 to 2025-08-31`);
  console.log(`Request path: ${path}`);

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);

    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      try {
        const parsed = JSON.parse(responseData);
        console.log('\n📊 Task count:', parsed.data?.tasks?.length || 0);
        console.log('🥬 Vegetable count:', parsed.data?.vegetables?.length || 0);
        
        if (parsed.data?.tasks?.length > 0) {
          console.log('\n📝 First task:');
          console.log(JSON.stringify(parsed.data.tasks[0], null, 2));
        }
        
        if (parsed.data?.vegetables?.length > 0) {
          console.log('\n🥬 First vegetable:');
          console.log(JSON.stringify(parsed.data.vegetables[0], null, 2));
        }
      } catch (e) {
        console.log('JSON parse error:', e.message);
        console.log('Response:', responseData);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.end();
}

testGanttAPIWithCorrectDates();