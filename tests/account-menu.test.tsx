import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { AccountMenu } from "../app/(protected)/_components/AccountMenu";
import { getAccountFirstName } from "../lib/navigation/account-identity";

describe("account menu identity", () => {
  it.each([
    ["  Mariana   Silva  ", "Mariana"],
    ["\u00c1lvaro\u00a0Souza", "\u00c1lvaro"],
    ["Ana-Maria Oliveira", "Ana-Maria"],
    ["AlexandrianaMaximilianaConstantina Silva", "AlexandrianaMaximilianaConstantina"],
    ["Li", "Li"],
  ])("preserves the entire first registered name from %s", (name, firstName) => {
    expect(getAccountFirstName(name)).toBe(firstName);
    const markup = renderToStaticMarkup(
      <AccountMenu identity="qa.account@example.invalid" displayName={name} role="Corretor">
        <a href="/conta/seguranca">Seguranca</a>
      </AccountMenu>,
    );
    expect(markup).toContain(`data-session-identity-trigger-label="true">${firstName}</span>`);
    expect(markup).toContain(`aria-label="Conta de ${firstName} (qa.account@example.invalid)"`);
    expect(markup).toContain('title="qa.account@example.invalid"');
    expect(markup).toContain('data-session-identity-label="true">qa.account@example.invalid');
    expect(markup).toContain('href="/conta/seguranca"');
    expect(markup).toContain('aria-controls="protected-account-menu"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('hidden=""');
    expect(markup).toContain("Corretor");
  });

  it.each([undefined, null, "", " \t\n ", 42, {}, "email.alias@example.invalid"])(
    "does not invent a name from the account email when the name is %s",
    (displayName) => {
      expect(getAccountFirstName(displayName)).toBeNull();
      const markup = renderToStaticMarkup(
        <AccountMenu
          identity="email.alias@example.invalid"
          displayName={displayName}
          role="Corretor"
        >
          <button type="submit">Sair</button>
        </AccountMenu>,
      );
      expect(markup).toContain('data-session-identity-trigger-label="true">Conta</span>');
      expect(markup).toContain('aria-label="Conta de email.alias@example.invalid"');
      expect(markup).toContain('data-session-identity-label="true">email.alias@example.invalid');
      expect(markup).toContain('<button type="submit">Sair</button>');
    },
  );
});
