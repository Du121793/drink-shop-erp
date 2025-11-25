import { useState, useEffect } from 'react';
import './App.css';

function App() {
  // 定義狀態 (State)
  const [menu, setMenu] = useState([]);       // 儲存菜單列表
  const [loading, setLoading] = useState(true);  // 載入狀態
  const [error, setError] = useState(null);   // 錯誤訊息

  // useEffect Hook: 組件掛載後執行一次
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        // 1. 發送請求到後端 (Port 4000)
        // 注意：這裡的路徑 /api/products 需要跟你組員確認是否正確
        const response = await fetch('http://localhost:4000/api/products');

        if (!response.ok) {
          throw new Error(`HTTP 錯誤! status: ${response.status}`);
        }

        // 2. 解析 JSON 資料
        const data = await response.json();
        setMenu(data);
        setLoading(false);

      } catch (err) {
        console.error("Fetch Error:", err);
        setError(err.message);
        setLoading(false);
        
        // 開發用：如果連不到後端，使用假資料顯示介面
        setMenu([
          { id: 1, name: "測試珍珠奶茶 (離線)", price: 50 },
          { id: 2, name: "測試紅茶 (離線)", price: 30 }
        ]);
      }
    };

    fetchMenu();
  }, []);

  // 處理點餐按鈕事件
  const handleOrder = (item) => {
    console.log("加入訂單:", item.name);
    alert(`已選擇: ${item.name}`);
    // 之後這裡要加入 POST 請求送出訂單
  };

  return (
    <div style={{ padding: '20px', maxWidth: '480px', margin: '0 auto' }}>
      <h1>🧋 飲料點餐系統</h1>

      {/* 狀態顯示區域 */}
      {loading && <p>資料載入中...</p>}
      
      {error && (
        <div style={{ color: 'red', border: '1px solid red', padding: '10px', marginBottom: '10px' }}>
          <strong>連線錯誤 (顯示測試資料):</strong><br/>
          {error}<br/>
          <small>請確認後端是否開啟，以及 API 路徑是否正確</small>
        </div>
      )}

      {/* 菜單列表區域 */}
      <div className="menu-list">
        {menu.map((item) => (
          <div key={item.id} style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: '0 0 5px 0' }}>{item.name}</h3>
              <span>${item.price}</span>
            </div>
            <button 
              onClick={() => handleOrder(item)}
              style={{
                padding: '8px 15px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              加入
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;