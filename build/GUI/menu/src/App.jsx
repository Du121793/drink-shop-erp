import { useState, useEffect } from 'react';
import './App.css';

function App() {
  // 定義狀態
  const [menu, setMenu] = useState([]);      // 菜單列表
  const [loading, setLoading] = useState(true); // 載入中
  const [error, setError] = useState(null);  // 錯誤訊息

  // 一進畫面就執行
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        // ---------------------------------------------------------
        // 1. 根據你的 menu.js，路徑應該是 /menu
        // ---------------------------------------------------------
        const response = await fetch('/menu');

        if (!response.ok) {
          throw new Error(`HTTP 錯誤! status: ${response.status}`);
        }

        const data = await response.json();
        
        // ---------------------------------------------------------
        // 2. 後端回傳的是 { menus: [...] }，所以要用 data.menus
        // ---------------------------------------------------------
        console.log("後端回傳的完整資料:", data); 

        if (data.menus && Array.isArray(data.menus)) {
          setMenu(data.menus);
        } else {
          console.error("格式不如預期:", data);
          // 如果後端回傳格式跟預期不同，試著直接存 data 看看
          if(Array.isArray(data)) setMenu(data);
          else throw new Error("無法找到菜單陣列");
        }
        
        setLoading(false);

      } catch (err) {
        console.error("抓取失敗:", err);
        setError(err.message);
        setLoading(false);
        
        // 失敗時顯示假資料
        setMenu([
          { id: 1, name: "測試珍珠奶茶 (離線)", price: 50 },
          { id: 2, name: "測試紅茶 (離線)", price: 30 }
        ]);
      }
    };

    fetchMenu();
  }, []);

  // 處理點餐按鈕
  const handleOrder = (item) => {
    console.log("點擊了:", item);
    alert(`已選擇: ${item.name} ($${item.price})`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>🧋 飲料點餐系統</h1>

      {/* 載入中 */}
      {loading && <p style={{ textAlign: 'center' }}>菜單載入中...</p>}
      
      {/* 錯誤訊息 */}
      {error && (
        <div style={{ 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          padding: '10px', 
          borderRadius: '5px',
          marginBottom: '15px',
          fontSize: '14px'
        }}>
          <strong>連線錯誤 (顯示離線資料):</strong><br/>
          {error}
        </div>
      )}

      {/* 菜單列表 */}
      <div className="menu-list">
        {menu.map((item) => (
          <div key={item.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '10px',
            padding: '15px',
            marginBottom: '12px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                {item.name}
              </span>
              <span style={{ color: '#666', marginTop: '4px' }}>
                ${item.price}
              </span>
            </div>

            <button 
              onClick={() => handleOrder(item)}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: 'bold'
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