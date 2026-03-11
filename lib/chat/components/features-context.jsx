'use client';

import { createContext, useContext } from 'react';

const FeaturesContext = createContext({});

export function FeaturesProvider({ features, children }) {
  return <FeaturesContext value={features}>{children}</FeaturesContext>;
}

export function useFeatures() {
  return useContext(FeaturesContext);
}
