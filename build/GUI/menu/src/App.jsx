import { useState, useEffect } from 'react';
import './App.css';

function App() {
  // ==========================================
  // 1. 狀態管理 (State Management)
  // ==========================================
  
  // 菜單列表相關
  const [menu, setMenu] = useState([]);           
  const [loading, setLoading] = useState(true);   
  const [error, setError] = useState(null);       

  // 彈出視窗 (Modal) 與點餐邏輯相關
  const [selectedProduct, setSelectedProduct] = useState(null); // 目前選中的飲料
  const [productOptions, setProductOptions] = useState([]);     // 該飲料的客製化選項
  const [userChoices, setUserChoices] = useState({});           // 使用者已選項目 { "糖度": "微糖" }
  const [modalLoading, setModalLoading] = useState(false);      // 選項載入中狀態

  // ==========================================
  // 2. 初始化與 API 呼叫
  // ==========================================

  // 初始化：取得完整菜單
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        // 透過 vite.config.js 的 Proxy 轉發請求到後端
        const response = await fetch('/menu');
        
        if (!response.ok) throw new Error("連線失敗");
        
        const data = await response.json();
        // 後端回傳結構為 { menus: [...] }
        setMenu(data.menus || []);
        setLoading(false);
      } catch (err) {
        console.error("Fetch Menu Error:", err);
        setError("無法載入菜單，請確認後端伺服器是否開啟");
        setLoading(false);
      }
    };
    fetchMenu();
  }, []);

  // 點擊飲料：開啟 Modal 並取得該飲料的選項
  const handleProductClick = async (product) => {
    setSelectedProduct(product);
    setModalLoading(true);
    setUserChoices({});      // 重置選擇
    setProductOptions([]);   // 重置選項列表

    try {
      // API: GET /menu/:id
      const response = await fetch(`/menu/${product.id}`);
      const data = await response.json();
      
      // 根據 API 回傳結構 { options: [...] } 更新狀態
      if (data.options) {
        setProductOptions(data.options);
      }
    } catch (err) {
      console.error("抓取選項失敗:", err);
      alert("無法取得選項資料，請稍後再試");
    } finally {
      setModalLoading(false);
    }
  };

  // ==========================================
  // 3. 使用者互動邏輯
  // ==========================================

  // 選擇某個選項 (例如：點擊「微糖」)
  const handleOptionSelect = (optionName, detailName) => {
    setUserChoices(prev => ({
      ...prev,
      [optionName]: detailName // 更新該類別的選擇
    }));
  };

  // 送出訂單
  const handleSubmitOrder = () => {
    // 檢查資料完整性 (這裡未來可加入必填檢查)
    const orderData = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.product_name || selectedProduct.name,
      price: selectedProduct.price,
      options: userChoices
    };
    
    // TODO: 未來需串接 POST /order API
    console.log("準備送出的訂單:", orderData);
    alert(`已加入購物車：\n${orderData.product_name}\n${JSON.stringify(orderData.options)}`);
    
    handleCloseModal();
  };

  // 關閉 Modal
  const handleCloseModal = () => {
    setSelectedProduct(null);
    setUserChoices({});
  };

  // ==========================================
  // 4. 畫面渲染 (Render)
  // ==========================================
  return (
    <div className="mobile-container">
      {/* 頂部標題 */}
      <div className="header">🧋 飲料點餐系統</div>

      {/* 飲料列表內容區 */}
      <div className="content">
        {loading && <p style={{textAlign: 'center', color: '#666'}}>載入菜單中...</p>}
        {error && <p style={{color: 'red', textAlign: 'center'}}>{error}</p>}

        {menu.map((item) => (
          <div key={item.id} className="product-card" onClick={() => handleProductClick(item)}>
            <div className="product-info">
              {/* 相容性處理：優先顯示 product_name */}
              <h3>{item.product_name || item.name || "未命名飲料"}</h3>
              <div className="product-price">${item.price}</div>
            </div>
            <button className="add-btn">選購</button>
          </div>
        ))}
      </div>

      {/* 商品詳情 Modal */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          {/* stopPropagation 防止點擊內容區時關閉視窗 */}
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            
            <div className="modal-header">
              <h2>{selectedProduct.product_name || selectedProduct.name}</h2>
              <button className="close-btn" onClick={handleCloseModal}>&times;</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <p style={{ fontSize: '1.5rem', color: '#d35400', fontWeight: 'bold', margin: '0 0 20px 0' }}>
                ${selectedProduct.price}
              </p>

              {modalLoading ? (
                <p>載入選項中...</p>
              ) : (
                <>
                  {/* 選項列表渲染 */}
                  {productOptions.length > 0 ? (
                    productOptions.map((opt) => (
                      <div key={opt.optionId} className="option-group">
                        <span className="option-title">{opt.optionName}</span>
                        <div className="option-choices">
                          {opt.details && opt.details.map((detail, idx) => {
                            
                            // 資料欄位對應 (Mapping)
                            const detailName = detail.optionDetailName || "選項";
                            const extraPrice = Number(detail.extraPrice || 0);
                            
                            // 判斷是否被選中
                            const isSelected = userChoices[opt.optionName] === detailName;

                            return (
                              <div 
                                key={idx}
                                className={`choice-chip ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleOptionSelect(opt.optionName, detailName)}
                              >
                                {detailName}
                                {extraPrice > 0 && ` (+$${extraPrice})`}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{color: '#999', textAlign: 'center', marginTop: '20px'}}>
                      此商品無須選擇客製化項目
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="submit-btn" onClick={handleSubmitOrder}>
                確認加入購物車
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App;