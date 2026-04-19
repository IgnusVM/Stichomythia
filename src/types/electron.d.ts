declare global {
  interface DesktopSource {
    id: string;
    name: string;
    thumbnail: string;
  }

  interface ElectronAPI {
    getDesktopSources: () => Promise<DesktopSource[]>;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
