import React from 'react';

// 為了讓 App.css 的樣式能套用，我們在這裡引入
import '../App.css';

const Cart = ({ cart, onRemoveFromCart, onPlaceOrder, orderStatus }) => {

  // 計算總金額
  const totalPrice = cart.reduce((sum, item) => sum + (item.singleItemPrice * item.quantity), 0);

  return (
    <div className="cart-container">
      <h2 className="cart-title">購物車</h2>
      
      {orderStatus.loading && <p>訂單傳送中...</p>}
      {orderStatus.error && <p className="cart-error">錯誤: {orderStatus.error}</p>}
      {orderStatus.success && <p className="cart-success">下單成功! 訂單 UUID: {orderStatus.success}</p>}

      {cart.length === 0 ? (
        <p className="cart-empty-text">你的購物車是空的。</p>
      ) : (
        <>
          <ul className="cart-item-list">
            {cart.map((item) => (
              <li key={item.cartItemId} className="cart-item">
                <div className="cart-item-info">
                  <span className="cart-item-name">{item.product.name} ({item.quantity}份)</span>
                  <div className="cart-item-options">
                    {Object.values(item.choices_display).flat().join(' | ')}
                  </div>
                </div>
                <div className="cart-item-actions">
                  <span className="cart-item-price">${(item.singleItemPrice * item.quantity).toFixed(2)}</span>
                  <button onClick={() => onRemoveFromCart(item.cartItemId)} className="remove-item-btn">
                    &times;
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-summary">
            <span className="total-price-label">總計:</span>
            <span className="total-price-value">${totalPrice.toFixed(2)}</span>
          </div>
          <button 
            onClick={onPlaceOrder} 
            className="place-order-btn"
            disabled={orderStatus.loading}
          >
            送出訂單
          </button>
        </>
      )}
    </div>
  );
};

export default Cart;
