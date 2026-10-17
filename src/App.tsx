/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { BrandingProvider } from './contexts/BrandingContext';
import MainApp from './components/MainApp';

export default function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <MainApp />
      </BrandingProvider>
    </AuthProvider>
  );
}
