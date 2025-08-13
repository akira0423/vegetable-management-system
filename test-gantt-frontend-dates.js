// Test with the same date range that the frontend uses
const http = require('http');

function testGanttAPIWithFrontendDates() {
  // Frontend uses 1year period: 6 months before to 6 months after current date (Aug 2025)
  // This should be 2025-02-01 to 2026-02-28 based on the frontend logic
  const path = '/api/gantt?company_id=a1111111-1111-1111-1111-111111111111&start_date=2025-02-01&end_date=2026-02-28';
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  console.log(`Testing with frontend date range: 2025-02-01 to 2026-02-28`);
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
          console.log('\n📝 Tasks found:');
          parsed.data.tasks.forEach((task, index) => {
            console.log(`${index + 1}. ${task.name} (${task.start} to ${task.end})`);
          });
        }
        
        if (parsed.data?.vegetables?.length > 0) {
          console.log('\n🥬 Vegetables found:');
          parsed.data.vegetables.slice(0, 3).forEach((veg, index) => {
            console.log(`${index + 1}. ${veg.name} (${veg.variety || 'No variety'})`);
          });
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

  req.setTimeout(10000, () => {
    console.error('Request timed out');
    req.destroy();
  });

  req.end();
}

testGanttAPIWithFrontendDates();