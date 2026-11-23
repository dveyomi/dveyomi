# Language and currency at the start of onboarding

**Why:** a person who reads Chinese (the owner's girlfriend, re-onboarding after deleting her account)
should not have to get through setup in English before finding the language setting in Settings.

**What:** a welcome screen before setup step 1 (mockup approved 2026-11-23):

- Heading "Welcome" / "歡迎", then "First, choose your language and currency."
- ① Language, labelled in both languages ("Language · 語言" / "語言 · Language"), options in their own script.
- ② Currency (£ / NT$), with a note that amounts are entered and shown in it and never converted.
- "You can change these later in Settings." and a **Start setting up** / 開始設定 button.
- Choosing a language or currency saves it to the account at once (the same `saveLanguage` /
  `saveCurrency` actions Settings uses), so the screen re-renders in it straight away.
- **Start setting up** saves both current values again (covers a device whose cookie differs from a
  fresh profile, so the app doesn't flip back to English after setup) and opens step 1.
- Not counted as a step: setup stays "Step 1 of 4", no progress bar on the welcome screen. The back
  arrow on step 1 returns to it. Typed answers are kept.

**Approaches considered:** inside step 1 (first mockup), and a separate welcome screen (chosen by the
owner: language first, then currency, then setup begins). Leaving it to Settings is the problem being fixed.

**Not included:** the sign-in page stays in English. No currency confirm dialog here: nothing is entered yet.

**Builder's calls:** a failed save shows the Settings error message on the welcome screen and does not
block starting (the choice can be changed later in Settings).
