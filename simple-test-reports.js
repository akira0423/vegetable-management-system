// シンプルなReports APIテスト
async function testAPI() {
  const testData = {
    company_id: 'a1111111-1111-1111-1111-111111111111',
    work_type: 'テスト作業',
    work_date: '2024-01-01',
    description: 'API テスト用の作業報告'
  };

  try {
    const response = await fetch('http://localhost:3000/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log('Status:', response.status);
    console.log('Headers:', [...response.headers.entries()]);
    
    const result = await response.text();
    console.log('Response:', result);

    // JSONとしてパース試行
    try {
      const jsonResult = JSON.parse(result);
      console.log('Parsed JSON:', jsonResult);
    } catch (e) {
      console.log('Not valid JSON:', e.message);
    }

  } catch (error) {
    console.error('Fetch error:', error);
  }
}

console.log('Testing Reports API with fetch...');
testAPI();