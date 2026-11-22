-- Language and currency settings (docs/superpowers/specs/2026-11-22-language-and-currency-design.md).
--
-- profiles.language: the app's language, English (UK) by default or
-- Traditional Chinese (Taiwan). profiles.currency (0001, 'GBP' by default) is
-- now limited to the currencies the app can show: GBP and TWD. Amounts are
-- never converted: the currency only changes how amounts are written.
-- Both are written by the owner through the existing profiles update grant
-- and policy (0002).

alter table public.profiles
  add column language text not null default 'en-GB'
    constraint profiles_language_check check (language in ('en-GB', 'zh-TW')),
  add constraint profiles_currency_check check (currency in ('GBP', 'TWD'));
