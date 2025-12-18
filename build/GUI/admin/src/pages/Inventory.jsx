import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  LinearProgress,
  TableSortLabel,
  IconButton,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
// import AddIcon from '@mui/icons-material/Add'; // 頂部 BOM 相關按鈕移除
// import EditIcon from '@mui/icons-material/Edit'; // BOM 編輯按鈕移除
import { getAllStock, getBoms, createBom, updateBom } from '../api/inventory';
import StockHistoryDialog from '../components/StockHistoryDialog';
import RestockDialog from '../components/RestockDialog';
// import BomEditDialog from '../components/BomEditDialog'; // 移除 BomEditDialog 導入

const headCells = [
  { id: 'bom_name', numeric: false, disablePadding: false, label: '原料名稱', align: 'left' },
  { id: 'total_stock', numeric: true, disablePadding: false, label: '庫存量', align: 'center' },
  { id: 'max_stock_qty', numeric: true, disablePadding: false, label: '最大庫存量', align: 'center' },
  { id: 'stock_level', numeric: true, disablePadding: false, label: '庫存水平', align: 'center' },
  { id: 'actions', numeric: false, disablePadding: false, label: '操作', align: 'center' },
];

function EnhancedTableHead(props) {
  const { order, orderBy, onRequestSort } = props;
  const createSortHandler = (property) => (event) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={headCell.align}
            sortDirection={orderBy === headCell.id ? order : false}
            sx={{
              whiteSpace: 'normal',
              overflow: 'visible',
              minWidth: headCell.id === 'bom_name' ? 120 : 'auto',
            }}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : 'asc'}
              onClick={createSortHandler(headCell.id)}
              disabled={headCell.id === 'actions'}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <Box component="span" sx={visuallyHidden}>
                  {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                </Box>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) { return -1; }
  if (b[orderBy] > a[orderBy]) { return 1; }
  return 0;
}

function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

function Inventory({ title = '庫存管理與補貨建議', showRestockButton = true, filterFn = null }) {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('bom_name');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // 手機版改為卡片視圖
  
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState({ id: null, name: null, shelfLifeDays: null });

  const [isRestockOpen, setRestockOpen] = useState(false);
  const [restockItem, setRestockItem] = useState({ id: null, name: null, shelfLifeDays: null });

  // 移除 BOM 編輯對話框的狀態
  // const [isBomEditOpen, setBomEditOpen] = useState(false);
  // const [editingBom, setEditingBom] = useState(null);

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRes, bomsRes] = await Promise.all([getAllStock(), getBoms()]);
      const bomsMap = new Map(bomsRes.data.boms.map(bom => [bom.bom_id, bom]));
      
      const combinedStock = stockRes.data.stock.map(item => {
        const bom = bomsMap.get(item.bom_id);
        const max_stock = bom ? bom.max_stock_qty : 0;
        const stock_level = max_stock > 0 ? (item.total_stock / max_stock) * 100 : 0;
        return {
          ...item,
          bom_name: bom ? bom.material_name : item.bom_name,
          max_stock_qty: max_stock,
          stock_level: stock_level,
          shelf_life_days: bom?.shelf_life_days
        };
      });

      setStock(combinedStock);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getHealthColor = (level) => {
    if (level < 20) return 'error';
    if (level < 50) return 'warning';
    return 'success';
  }
  
  const filteredStock = React.useMemo(() => {
    if (typeof filterFn === 'function') {
      return stock.filter(filterFn);
    }
    return stock;
  }, [stock, filterFn]);

  const visibleRows = React.useMemo(
    () => stableSort(filteredStock, getComparator(order, orderBy)),
    [order, orderBy, filteredStock],
  );

  const handleHistoryClick = (item) => {
    setSelectedItem({ id: item.bom_id, name: item.bom_name, shelfLifeDays: item.shelf_life_days });
    setHistoryOpen(true);
  };

  const handleHistoryClose = () => {
    setHistoryOpen(false);
    setSelectedItem({ id: null, name: null, shelfLifeDays: null });
  };

  const handleRestockClick = (item) => {
    setRestockItem({ id: item.bom_id, name: item.bom_name, shelfLifeDays: item.shelf_life_days });
    setRestockOpen(true);
  };

  const handleRestockClose = () => {
    setRestockOpen(false);
    setRestockItem({ id: null, name: null, shelfLifeDays: null });
  };

  const handleRestockSuccess = () => {
    fetchData(); // 補貨成功後刷新庫存列表
    handleRestockClose();
  };

  // 移除 BOM 編輯相關函式
  // const handleBomEditClick = (bom = null) => {
  //   setEditingBom(bom);
  //   setBomEditOpen(true);
  // };

  // const handleBomEditClose = () => {
  //   setEditingBom(null);
  //   setBomEditOpen(false);
  // };

  // const handleSaveBom = async (payload) => {
  //   try {
  //     if (editingBom) {
  //       await updateBom(editingBom.bom_id, payload);
  //     } else {
  //       await createBom(payload);
  //     }
  //     fetchData(); // 刷新列表
  //   } catch (error) {
  //     console.error('儲存 BOM 失敗:', error);
  //   } finally {
  //     handleBomEditClose();
  //   }
  // };


  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>{title}</Typography>
        {/* 移除頂部 BOM 新增按鈕 */}
        {/* <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleBomEditClick()}>新增原料</Button> */}
      </Box>

      {loading ? (
        <p>讀取中...</p>
      ) : isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          {visibleRows.map((item) => (
            <Paper
              key={item.bom_id}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: item.stock_level < 20 ? 'rgba(255,0,0,0.03)' : 'background.paper',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{item.bom_name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  上限：{item.max_stock_qty || 'N/A'}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>庫存：{item.total_stock}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ width: '100%', mr: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(item.stock_level, 100)}
                    color={getHealthColor(item.stock_level)}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 44 }}>
                  {`${Math.round(item.stock_level)}%`}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  size="small"
                  onClick={() => handleHistoryClick(item)}
                >
                  查看紀錄
                </Button>
                {showRestockButton && (
                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    onClick={() => handleRestockClick(item)}
                  >
                    補貨
                  </Button>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 750 }}>
            <EnhancedTableHead
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
            />
            <TableBody>
              {visibleRows.map((item) => (
                <TableRow
                  key={item.bom_id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 }, backgroundColor: item.stock_level < 20 ? 'rgba(255, 0, 0, 0.05)' : 'transparent' }}
                  hover
                >
                  <TableCell component="th" scope="row">{item.bom_name}</TableCell>
                  <TableCell align="center">{item.total_stock}</TableCell>
                  <TableCell align="center">{item.max_stock_qty || 'N/A'}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box sx={{ width: '80%', mr: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(item.stock_level, 100)}
                          color={getHealthColor(item.stock_level)}
                        />
                      </Box>
                      <Box sx={{ minWidth: 35 }}>
                        <Typography variant="body2" color="text.secondary">{`${Math.round(item.stock_level)}%`}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => handleHistoryClick(item)}
                      sx={{ mr: showRestockButton ? 1 : 0 }}
                    >
                      查看紀錄
                    </Button>
                    {showRestockButton && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleRestockClick(item)}
                      >
                        補貨
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <StockHistoryDialog
        open={isHistoryOpen}
        onClose={handleHistoryClose}
        bomId={selectedItem.id}
        bomName={selectedItem.name}
        onRecordUpdated={fetchData}
      />
      <RestockDialog
        open={isRestockOpen}
        onClose={handleRestockClose}
        bomId={restockItem.id}
        bomName={restockItem.name}
        shelfLifeDays={restockItem.shelfLifeDays}
        onRestockSuccess={handleRestockSuccess}
      />
      {/* 移除 BOM 編輯對話框 */}
      {/* {isBomEditOpen && (
        <BomEditDialog
          open={isBomEditOpen}
          onClose={handleBomEditClose}
          onSave={handleSaveBom}
          bom={editingBom}
        />
      )} */}
    </>
  );
}

export default Inventory;
