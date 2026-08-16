import React from "react";
import { Outlet } from "react-router-dom";

export default function PortalLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Outlet />
    </div>
  );
}