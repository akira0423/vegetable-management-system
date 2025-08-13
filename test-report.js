// テスト用の作業レポート送信スクリプト
const testReportData = {
  vegetable_id: 'd1111111-1111-1111-1111-111111111111',
  work_date: '2024-08-10',
  work_type: 'watering',
  work_notes: 'テスト用の水やり作業',
  work_duration: 30,
  worker_count: 1,
  weather: 'sunny',
  temperature_morning: 22,
  temperature_afternoon: 28,
  humidity: 65,
  // created_by: 'e1111111-1111-1111-1111-111111111111' // 外部キー制約でエラー
};

async function testPostReport() {
  try {
    console.log('Sending test report data:', JSON.stringify(testReportData, null, 2));
    
    const response = await fetch('http://localhost:3000/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testReportData)
    });

    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      console.error('Request failed:', result);
    } else {
      console.log('Request successful!');
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

testPostReport();