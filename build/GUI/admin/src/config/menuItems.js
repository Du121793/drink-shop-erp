import React from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import PeopleIcon from "@mui/icons-material/People";
import InventoryIcon from "@mui/icons-material/Inventory";
import FastfoodIcon from "@mui/icons-material/Fastfood";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import CategoryIcon from "@mui/icons-material/Category";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu";
import BusinessIcon from "@mui/icons-material/Business";
import ShieldIcon from "@mui/icons-material/Shield";

export const menuItems = [
  {
    key: "dashboard",
    text: "儀表板",
    path: "/",
    icon: DashboardIcon,
    permissions: ["dashboard:view"],
  },
  {
    key: "menu",
    text: "菜單管理",
    icon: RestaurantMenuIcon,
    permissions: ["menu:manage"],
    children: [
      {
        text: "品項管理",
        path: "/menu/items",
        icon: FastfoodIcon,
        permissions: ["menu:manage"],
      },
      {
        text: "客製選項管理",
        path: "/menu/options",
        icon: SettingsSuggestIcon,
        permissions: ["menu:manage"],
      },
      {
        text: "配方管理 (BOM)",
        path: "/menu/boms",
        icon: CategoryIcon,
        permissions: ["menu:manage"],
      },
    ],
  },
  {
    key: "inventory",
    text: "庫存管理",
    icon: InventoryIcon,
    permissions: ["inventory:view", "restock:view", "purchase:view", "supplier:view"],
    children: [
      {
        text: "補貨",
        path: "/inventory/restock",
        icon: LocalShippingIcon,
        permissions: ["restock:apply"],
      },
      {
        text: "補貨建議清單",
        path: "/inventory/suggestions",
        icon: LightbulbIcon,
        permissions: ["restock:view"],
      },
      {
        text: "庫存規則",
        path: "/inventory/restock-rules",
        icon: SettingsSuggestIcon,
        permissions: ["restock:rules"],
      },
      {
        text: "叫貨紀錄",
        path: "/inventory/orders",
        icon: HistoryEduIcon,
        permissions: ["purchase:view"],
      },
      {
        text: "供應商管理",
        path: "/inventory/suppliers",
        icon: BusinessIcon,
        permissions: ["supplier:view"],
      },
      {
        text: "供應商信譽設定",
        path: "/inventory/supplier-reputation",
        icon: ShieldIcon,
        permissions: ["supplier:reputation"],
      },
    ],
  },
  {
    key: "permissions",
    text: "權限設定",
    icon: PeopleIcon,
    permissions: ["permissions:profile"],
    children: [
      {
        text: "個人資訊",
        path: "/permissions/profile",
        icon: PeopleIcon,
        permissions: ["permissions:profile"],
      },
      {
        text: "權限管理",
        path: "/permissions/manage",
        icon: PeopleIcon,
        permissions: ["permissions:manage"],
      },
    ],
  },
];
