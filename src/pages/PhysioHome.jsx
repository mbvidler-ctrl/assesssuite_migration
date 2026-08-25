import React from 'react';
import { Navigate } from 'react-router-dom';

export default function PhysioHome() {
  return <Navigate to="/Dashboard" replace />;
}
