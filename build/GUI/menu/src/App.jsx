import { useState, useEffect } from "react";
import Cart from "./components/Cart"; // 引入 Cart 元件
import "./App.css";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const buildUrl = (path) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
};

function App() {
  // ==========================================
  // 1. 狀態管理 (State Management)
  // ==========================================

  // 菜單列表相關
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 彈出視窗 (Modal) 與點餐邏輯相關
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productOptions, setProductOptions] = useState([]);
  const [userChoices, setUserChoices] = useState({}); // { optionId: [detailId] } or { optionId: detailId }
    const [modalLoading, setModalLoading] = useState(false);      
    const [itemQuantity, setItemQuantity] = useState(1); // 新增：單品數量
  // 購物車與下單相關
  const [cart, setCart] = useState([]); // 購物車狀態
  const [orderStatus, setOrderStatus] = useState({
    loading: false,
    error: null,
    success: null,
  });

  // ==========================================
  // 2. 初始化與 API 呼叫
  // ==========================================

  // 初始化：取得完整菜單
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await fetch(buildUrl("/menu"));
        if (!response.ok) throw new Error("連線失敗");
        const data = await response.json();
        setMenu(data.menus || []);
      } catch (err) {
        console.error("Fetch Menu Error:", err);
        setError("無法載入菜單，請確認後端伺服器是否開啟");
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, []);

  // 點擊飲料：開啟 Modal 並取得該飲料的選項
  const handleProductClick = async (product) => {
    setSelectedProduct(product);
    setModalLoading(true);
    setItemQuantity(1); // 重置數量

    try {
      const response = await fetch(buildUrl(`/menu/${product.id}`));
      const data = await response.json();

      if (data.options) {
        setProductOptions(data.options);
        const defaultChoices = {};
        data.options.forEach((opt) => {
          const isMultiSelect =
            opt.optionName !== "糖度" && opt.optionName !== "冰量";
          if (!isMultiSelect && opt.details && opt.details.length > 0) {
            defaultChoices[opt.optionId] = opt.details[0].optionDetailId;
          } else {
            defaultChoices[opt.optionId] = [];
          }
        });
        setUserChoices(defaultChoices);
      } else {
        setProductOptions([]);
        setUserChoices({});
      }
    } catch (err) {
      console.error("抓取選項失敗:", err);
      alert("無法取得選項資料，請稍後再試");
      setProductOptions([]);
      setUserChoices({});
    } finally {
      setModalLoading(false);
    }
  };

  // ==========================================
  // 3. 使用者互動邏輯
  // ==========================================

  // 選擇某個選項
  const handleOptionSelect = (optionId, optionName, detailId) => {
    const isMultiSelect = optionName !== "糖度" && optionName !== "冰量";

    setUserChoices((prev) => {
      const newChoices = { ...prev };
      if (isMultiSelect) {
        const currentSelection = newChoices[optionId] || [];
        if (currentSelection.includes(detailId)) {
          newChoices[optionId] = currentSelection.filter(
            (id) => id !== detailId
          );
        } else {
          newChoices[optionId] = [...currentSelection, detailId];
        }
      } else {
        newChoices[optionId] = detailId;
      }
      return newChoices;
    });
  };

  // 增加數量
  const handleIncreaseQuantity = () => {
    setItemQuantity(prev => prev + 1);
  };

  // 減少數量
  const handleDecreaseQuantity = () => {
    setItemQuantity(prev => Math.max(1, prev - 1)); // 數量不能少於 1
  };

  // 關閉 Modal
  const handleCloseModal = () => {
    setSelectedProduct(null);
    setUserChoices({});
    setItemQuantity(1); // 關閉時重置數量
  };

  // ==========================================
  // 4. 購物車與訂單邏輯
  // ==========================================

  // 加入購物車
  const handleAddToCart = () => {
    try {
        // 1. 蒐集所有選擇的 optionDetailId
        const allSelectedDetailIds = [].concat(...Object.values(userChoices)).filter(id => id != null);

        // 2. 建立選項名稱的顯示文字
        const choices_display = {};
        if (productOptions && Array.isArray(productOptions)) {
            for (const option of productOptions) {
                const selection = userChoices[option.optionId];
                if ((Array.isArray(selection) && selection.length > 0) || (!Array.isArray(selection) && selection != null)) {
                    choices_display[option.optionName] = option.details
                        .filter((d) => Array.isArray(selection) ? selection.includes(d.optionDetailId) : selection === d.optionDetailId)
                        .map((d) => d.optionDetailName);
                }
            }
        }

        // 3. 計算單品價格
        let singleItemPrice = Number(selectedProduct.price || 0);
        if (productOptions && Array.isArray(productOptions)) {
            productOptions.forEach((opt) => {
                opt.details.forEach((detail) => {
                    if (allSelectedDetailIds.includes(detail.optionDetailId)) {
                        singleItemPrice += Number(detail.extraPrice || 0);
                    }
                });
            });
        }

        // 4. 建立購物車品項
        const cartItem = {
            cartItemId: Date.now() + Math.random(),
            product: { id: selectedProduct.id, name: selectedProduct.name },
            selectedOptions: allSelectedDetailIds,
            choices_display,
            quantity: itemQuantity,
            singleItemPrice: parseFloat(singleItemPrice.toFixed(2)), // 修正：四捨五入到小數點後兩位
        };
        
        setCart((prev) => {
            return [...prev, cartItem];
        });

        handleCloseModal();
    } catch (e) {
        console.error("An error occurred in handleAddToCart:", e);
        alert("加入購物車時發生錯誤，請查看控制台以獲取詳細資訊。");
    }
  };

  // 從購物車移除
  const handleRemoveFromCart = (cartItemId) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  // 送出訂單
  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      alert("購物車是空的！");
      return;
    }

    setOrderStatus({ loading: true, error: null, success: null });

    // 轉換為 API 需要的格式
    const orderPayload = cart.map((item) => ({
      menuId: item.product.id,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions,
    }));

    try {
      const response = await fetch(buildUrl("/order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.msg || `訂單提交失敗 (狀態碼: ${response.status})`
        );
      }

      setOrderStatus({
        loading: false,
        error: null,
        success: data.requestUUID,
      });
      setCart([]); // 清空購物車
    } catch (err) {
      setOrderStatus({ loading: false, error: err.message, success: null });
      console.error("Place Order Error:", err);
    }
  };

  // ==========================================
  // 5. 畫面渲染 (Render)
  // ==========================================
  return (
    <div className="mobile-container">
      <div className="header">🧋 飲料點餐系統</div>

      {/* 購物車區塊 */}
      <Cart
        cart={cart}
        onRemoveFromCart={handleRemoveFromCart}
        onPlaceOrder={handlePlaceOrder}
        orderStatus={orderStatus}
      />

      {/* 飲料列表內容區 */}
      <div className="content">
        {loading && (
          <p style={{ textAlign: "center", color: "#666" }}>載入菜單中...</p>
        )}
        {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

        {menu.map((item) => (
          <div 
            key={item.id} 
            className={`product-card ${!item.isAvailable ? 'unavailable' : ''}`}
            onClick={() => item.isAvailable && handleProductClick(item)}
          >
            {!item.isAvailable && <div className="out-of-stock-badge">缺貨</div>}
            <div className="product-info">
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedProduct.product_name || selectedProduct.name}</h2>
              <button className="close-btn" onClick={handleCloseModal}>
                &times;
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              <p
                style={{
                  fontSize: "1.5rem",
                  color: "#d35400",
                  fontWeight: "bold",
                  margin: "0 0 20px 0",
                }}
              >
                ${selectedProduct.price}
              </p>

              {modalLoading ? (
                <p>載入選項中...</p>
              ) : (
                <>
                  {productOptions.length > 0 ? (
                    productOptions.map((opt) => (
                      <div key={opt.optionId} className="option-group">
                        <span className="option-title">{opt.optionName}</span>
                        <div className="option-choices">
                          {opt.details &&
                            opt.details.map((detail) => {
                              const isMultiSelect =
                                opt.optionName !== "糖度" &&
                                opt.optionName !== "冰量";
                              const currentSelection =
                                userChoices[opt.optionId];

                              const isSelected = isMultiSelect
                                ? Array.isArray(currentSelection) &&
                                  currentSelection.includes(
                                    detail.optionDetailId
                                  )
                                : currentSelection === detail.optionDetailId;

                              return (
                                <div 
                                key={detail.optionDetailId}
                                className={`choice-chip ${isSelected ? 'selected' : ''} ${!detail.isAvailable ? 'unavailable' : ''}`}
                                onClick={() => detail.isAvailable && handleOptionSelect(opt.optionId, opt.optionName, detail.optionDetailId)}
                              >
                                {detail.optionDetailName}
                                {Number(detail.extraPrice) > 0 && ` (+$${Number(detail.extraPrice)})`}
                              </div>
                              );
                            })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p
                      style={{
                        color: "#999",
                        textAlign: "center",
                        marginTop: "20px",
                      }}
                    >
                      此商品無須選擇客製化項目
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
                <div className="quantity-selector">
                    <button onClick={handleDecreaseQuantity} className="quantity-btn">-</button>
                    <span className="quantity-display">{itemQuantity}</span>
                    <button onClick={handleIncreaseQuantity} className="quantity-btn">+</button>
                </div>
              <button className="submit-btn" onClick={handleAddToCart}>
                加入購物車
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
