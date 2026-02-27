import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Stack,
  Button,
} from "@mui/material";
import { TEXT } from "./schema";

function DeleteDialog({ open, usage, loading, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{TEXT.deleteRule}</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ mb: 2 }}>{TEXT.deleteConfirm}</Typography>
        {usage.length > 0 ? (
          <Stack spacing={1}>
            {usage.map((item) => (
              <Typography key={item.bom_id} variant="body2">
                - {item.material_name}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">{TEXT.noUsage}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{TEXT.cancel}</Button>
        <Button
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
        >
          {TEXT.confirmDelete}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DeleteDialog;
