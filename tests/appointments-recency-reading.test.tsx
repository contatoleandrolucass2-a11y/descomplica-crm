import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AppointmentsDashboard } from "@/app/(protected)/app/etapas/_components/AppointmentsDashboard";
import { appointmentModel } from "./fixtures/appointments-summary";

it("places the last appointment under its responsible owner, separately from the manager", () => {
  const model = appointmentModel(1);
  const appointment = model.analysis.appointments[0]!;
  appointment.createdAt = "2026-10-30T15:00:00Z";
  appointment.channel = 1;
  appointment.registeredBroker = true;
  model.analysis.facts[1]![1] = "2026-10-30";
  const html = renderToStaticMarkup(
    <AppointmentsDashboard analysis={model.analysis} brokerRoster={model.brokerRoster} />,
  );
  const panel = html.match(
    /<section[^>]*aria-label="Último agendamento: até 7 dias"[\s\S]*?<\/section>/u,
  )?.[0];
  expect(panel).toBeDefined();
  expect(panel).toMatch(
    /<div[^>]*><strong[^>]*>Corretor A<\/strong><small>Último: 30\/10\/2026<\/small><\/div>/u,
  );
  expect(panel).toMatch(/title="Gerente A"><span>Gerente A<\/span><\/span>/u);
  expect(panel).not.toMatch(/title="Gerente A">[\s\S]*?<small>/u);
});
