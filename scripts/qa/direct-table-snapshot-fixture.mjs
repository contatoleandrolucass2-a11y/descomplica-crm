export const directTableQaInventoryCount = 3301;

export function buildSyntheticDirectTableQaSnapshot() {
  const plants = ["Tipo 1Q", "Tipo 2Q", "Tipo 2Q com vaga"];
  const items = Array.from({ length: directTableQaInventoryCount }, (_, index) => {
    const sequence = index + 1;
    const paddedSequence = String(sequence).padStart(4, "0");
    const projectNumber = (index % 6) + 1;
    const project = `Empreendimento QA ${String(projectNumber).padStart(2, "0")}`;
    const businessUnit = index % 2 === 0 ? "Direcional" : "Riva";
    const finalPrice = 250_000 + (index % 120) * 1_000;

    return {
      id: `qa-stock-${paddedSequence}`,
      businessUnit,
      project,
      product: `Apartamento QA-${paddedSequence} - ${project}`,
      identifier: `QA-${paddedSequence}`,
      plant: plants[index % plants.length],
      classification: "RESIDENCIAL_QA",
      description: "Unidade sintética para QA visual isolada",
      finalWithKit: finalPrice,
      unitBonus: 0,
      tableSlack: 0,
      cashBackSlack: 0,
      finalPrice,
      launchPrice: finalPrice,
      appraisal: finalPrice,
      minimumSignal: 1_000,
      privateArea: 35 + (index % 20) * 0.5,
      constructionStatus: "Em obras",
      rooms: index % 3 === 0 ? 1 : 2,
      unitType: "Apartamento",
      building: String((index % 8) + 1),
      floor: (index % 20) + 1,
      finalUnit: (index % 8) + 1,
      parkingSpaces: index % 3 === 2 ? 1 : 0,
      postalCode: "00000-000",
      neighborhood: "Bairro QA",
      district: "Distrito QA",
      street: "Rua Sintética",
      streetNumber: String(sequence),
      city: "Cidade QA",
      state: "SP",
      region: "Região QA",
      progress: 0.5,
      completionDate: `20${29 + (index % 3)}-12-31`,
    };
  });

  return JSON.stringify({
    source: "ESTOQUE SPC.xlsx",
    qaFixture: {
      synthetic: true,
      contract: "direct-table-visual-v1",
    },
    count: directTableQaInventoryCount,
    items,
  });
}
