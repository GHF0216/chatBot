// Microsoft Teams SDK type declarations
interface MicrosoftTeamsSDK {
  initialize(): void;
  ready(): void;
  authentication: {
    getAuthToken(
      options: { scopes: string[] },
      callback: (error: string | null, token: string) => void
    ): void;
  };
}

declare global {
  interface Window {
    microsoftTeams?: MicrosoftTeamsSDK;
  }
}

export {};
