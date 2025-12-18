import React from 'react';
import Inventory from './Inventory';

// 補貨頁面：沿用庫存列表，展示所有已設定最大庫存量的原料
function Restock() {
  // 僅排除未設定最大庫存量的品項，確保庫存達到或超過 100% 時仍會顯示
  const filterFn = (item) => item.max_stock_qty > 0;

  return (
    <Inventory
      title="補貨"
      showRestockButton
      filterFn={filterFn}
    />
  );
}

export default Restock;
