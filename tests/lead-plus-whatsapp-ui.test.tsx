import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/crm/lead-plus/client/Auth", () => ({
  useAuth: () => ({ user: { id: "broker-1" }, view_as: { active: false } }),
}));
vi.mock("../lib/crm/lead-plus/client/api", () => ({
  api: vi.fn(),
  LeadApiError: class extends Error {},
}));

import WhatsAppCentral, {
  serviceWindowOpen,
  templateParameters,
  retryMessagePayload,
} from "../lib/crm/lead-plus/client/WhatsAppCentral";
import WhatsAppSettings from "../lib/crm/lead-plus/client/WhatsAppSettings";
import { canAccessRoute, visibleSubmenus } from "../lib/crm/lead-plus/client/navigation";

describe("LEAD+ central WhatsApp", () => {
  const now = Date.parse("2026-11-01T20:00:00Z");
  it("fecha a janela exatamente em 24 horas, sem usar mensagens da empresa", () => {
    expect(serviceWindowOpen("2026-10-31T20:00:00.001Z", now)).toBe(true);
    expect(serviceWindowOpen("2026-10-31T20:00:00Z", now)).toBe(false);
    expect(serviceWindowOpen("2026-10-31T19:59:59Z", now)).toBe(false);
    expect(serviceWindowOpen(undefined, now)).toBe(false);
    expect(serviceWindowOpen("inválida", now)).toBe(false);
    expect(serviceWindowOpen("2026-11-01T20:00:01Z", now)).toBe(false);
  });
  it("oferece variáveis numéricas contíguas somente para modelos aprovados suportados", () => {
    expect(
      templateParameters({
        name: "saudacao",
        language: "pt_BR",
        status: "APPROVED",
        components: [{ type: "BODY", text: "Olá {{1}}; {{2}}; {{1}}" }],
      }),
    ).toBe(2);
    expect(
      templateParameters({
        name: "saudacao",
        language: "pt_BR",
        status: "APPROVED",
        components: [{ type: "BODY", text: "Olá" }],
      }),
    ).toBe(0);
    expect(
      templateParameters({
        name: "saudacao",
        language: "pt_BR",
        status: "PENDING",
        components: [{ type: "BODY", text: "Olá" }],
      }),
    ).toBeNull();
    expect(
      templateParameters({
        name: "saudacao",
        language: "pt_BR",
        status: "REJECTED",
        components: [{ type: "BODY", text: "Olá" }],
      }),
    ).toBeNull();
    expect(
      templateParameters({
        name: "saudacao",
        language: "pt_BR",
        status: "APPROVED",
        components: [{ type: "BODY", text: "Olá {{2}}" }],
      }),
    ).toBeNull();
    expect(
      templateParameters({
        name: "saudacao",
        language: "pt_BR",
        status: "APPROVED",
        components: [{ type: "BODY", text: "Olá {{nome}}" }],
      }),
    ).toBeNull();
    expect(
      templateParameters({
        name: "saudacao",
        language: "pt_BR",
        status: "APPROVED",
        components: [
          { type: "HEADER", format: "IMAGE" },
          { type: "BODY", text: "Olá" },
        ],
      }),
    ).toBeNull();
    expect(
      templateParameters({
        name: "saudacao",
        language: "pt_BR",
        status: "APPROVED",
        components: [],
      }),
    ).toBeNull();
  });
  it("mantém chat, fila e informações, sem permitir responder antes da autorização", () => {
    const markup = renderToStaticMarkup(<WhatsAppCentral />);
    expect(markup).toContain("Central de Atendimento");
    expect(markup).toContain('aria-label="Lista de conversas"');
    expect(markup).toContain('aria-label="Chat do atendimento"');
    expect(markup).toContain('aria-label="Informações do lead"');
    expect(markup).toContain("Aguardando atendimento");
    expect(markup).not.toContain("Enviar mensagem");
    expect(markup).not.toContain("Assumir atendimento");
    expect(markup).not.toContain("QR Code");
    expect(markup).not.toContain("WhatsApp Web");
  });
  it("reutiliza a identidade somente para falha confirmada e bloqueia envio incerto ou limite esgotado", () => {
    const message = {
      id: "message-1",
      client_message_id: "original-attempt",
      direction: "outbound" as const,
      type: "text",
      content: { text: "Mensagem autorizada" },
      delivery_status: "failed",
      attempts: 1,
      created_at: "2026-11-01T20:00:00Z",
    };
    expect(retryMessagePayload(message)).toEqual({
      client_message_id: "original-attempt",
      type: "text",
      text: "Mensagem autorizada",
    });
    expect(retryMessagePayload({ ...message, delivery_status: "uncertain" })).toBeNull();
    expect(retryMessagePayload({ ...message, delivery_status: "unknown" })).toBeNull();
    expect(retryMessagePayload({ ...message, attempts: 3 })).toBeNull();
    expect(retryMessagePayload({ ...message, direction: "inbound" })).toBeNull();
    expect(
      retryMessagePayload({
        ...message,
        type: "template",
        content: { template: { name: "saudacao", language: "pt_BR", parameters: ["Cliente"] } },
      }),
    ).toEqual({
      client_message_id: "original-attempt",
      type: "template",
      template: { name: "saudacao", language: "pt_BR", parameters: ["Cliente"] },
    });
  });
  it("não apresenta credenciais nem conexão válida antes da consulta do servidor", () => {
    const markup = renderToStaticMarkup(<WhatsAppSettings />);
    expect(markup).toContain("Carregando configuração");
    expect(markup).not.toContain("Validado na Meta");
    expect(markup).not.toContain('type="password"');
    expect(markup).not.toContain("Salvar configuração segura");
  });
  it("protege menu e acesso direto com a mesma permissão e página autorizada", () => {
    const broker = (permission: string) => permission === "leads.view";
    expect(canAccessRoute("Central de Atendimento", broker, ["/app/leads/lista"])).toBe(true);
    expect(canAccessRoute("Central de Atendimento", broker, [])).toBe(false);
    expect(canAccessRoute("WhatsApp Business", broker, ["/app/leads/configuracoes"])).toBe(false);
    expect(visibleSubmenus("Configurações", broker, ["/app/leads/configuracoes"])).not.toContain(
      "WhatsApp Business",
    );
    const admin = (permission: string) =>
      ["leads.view", "crm.settings.manage"].includes(permission);
    expect(canAccessRoute("WhatsApp Business", admin, ["/app/leads/configuracoes"])).toBe(true);
  });
});
