import { create } from 'zustand';

interface BrandingState {
  logoUrl: string | null;
  companyName: string;
  loaded: boolean;
  setBranding: (logoUrl: string | null, companyName: string) => void;
  setLoaded: (loaded: boolean) => void;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  logoUrl: null,
  companyName: 'HelpDesk',
  loaded: false,
  setBranding: (logoUrl, companyName) => set({ logoUrl, companyName }),
  setLoaded: (loaded) => set({ loaded }),
}));
