import React from 'react';
import Inventory from './Inventory';

// 補貨頁：聚焦補貨操作，顯示低於滿庫的品項並保留補貨按鈕
function Restock() {
  // 篩選出有設定最大庫存且尚未滿庫的品項，避免滿庫品項干擾
  const filterFn = (item) => item.max_stock_qty > 0 && item.total_stock < item.max_stock_qty;

  return (
    <Inventory
      title="補貨"
      showRestockButton
      filterFn={filterFn}
    />
  );
}

export default Restock;
