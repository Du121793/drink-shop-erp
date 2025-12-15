import React from 'react';
import Inventory from './Inventory';

// 庫存清單確認頁：專注檢視庫存，不顯示補貨操作
function InventoryCheck() {
  return (
    <Inventory
      title="庫存清單確認"
      showRestockButton={false}
    />
  );
}

export default InventoryCheck;
