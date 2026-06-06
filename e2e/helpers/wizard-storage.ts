import type { Page } from "@playwright/test";
import { WIZARD_PERSIST_STORAGE_KEY } from "../../src/lib/wizard-draft";

export type WizardPersistedState = {
  step: number;
  data: Record<string, unknown>;
  generatedImages: string[];
  selectedImageIndex: number;
};

export async function seedWizardStorage(
  page: Page,
  state: WizardPersistedState
) {
  await page.addInitScript(
    ({ key, payload }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          state: payload,
          version: 0,
        })
      );
    },
    { key: WIZARD_PERSIST_STORAGE_KEY, payload: state }
  );
}

export const MOCK_PORTRAIT_URL =
  "https://placehold.co/768x1024/jpg?text=Aura+Portrait";
