export type DocGroup = { title: string; items: string[] };

function salaried(employment: string) {
  return employment.toLowerCase().includes("salar");
}

function incomeGroup(employment: string): DocGroup {
  if (salaried(employment)) {
    return {
      title: "Income",
      items: ["Last 6 months salary account statement", "Last 3 salary slips", "Form 16 or the latest ITR"],
    };
  }
  return {
    title: "Income",
    items: [
      "Last 12 months current account statement",
      "Last 2 years ITR with computation",
      "GST returns for the last year, if the business is registered",
    ],
  };
}

const KYC: DocGroup = {
  title: "KYC",
  items: [
    "PAN card",
    "Aadhaar card",
    "One photograph",
    "Rent agreement or electricity bill if the Aadhaar address is not the current address",
  ],
};

export function documentPack(product: string, employment: string): DocGroup[] {
  const name = product.toLowerCase().trim();
  const income = incomeGroup(employment);

  if (name.includes("credit card")) {
    return [
      { title: "KYC", items: ["PAN card", "Aadhaar card"] },
      salaried(employment)
        ? { title: "Income", items: ["Last 3 salary slips", "Last 3 months salary account statement"] }
        : { title: "Income", items: ["Latest ITR", "Last 6 months bank statement"] },
    ];
  }

  if (name.includes("insurance")) {
    return [
      { title: "KYC", items: ["PAN card", "Aadhaar card", "Age proof"] },
      { title: "Policy", items: ["Existing policy copy, if they already hold one"] },
    ];
  }

  const groups = [KYC, income];

  if (name.includes("home")) {
    groups.push({
      title: "Property",
      items: [
        "Sale agreement or builder allotment letter",
        "Latest property tax receipt or the property electricity bill",
        "Proof of own contribution in the bank",
      ],
    });
  } else if (name.includes("lap")) {
    groups.push({
      title: "Property",
      items: [
        "Ownership papers of the property to be mortgaged",
        "Latest property tax receipt",
      ],
    });
  } else if (name.includes("auto") || name.includes("vehicle")) {
    groups.push({
      title: "Vehicle",
      items: ["Dealer quotation with the on-road price"],
    });
  } else if (name === "cc" || name === "od" || name.includes("business") || name.includes("msme")) {
    groups.push({
      title: "Business",
      items: [
        "GST certificate or Udyam registration",
        "Existing loan sanction letters, if any loan is running",
      ],
    });
  }

  return groups;
}

export function documentMessage(name: string, product: string, groups: DocGroup[]) {
  const lines = [`Hi ${name || "there"}, please send these together for your ${product} file:`];
  let number = 1;
  for (const group of groups) {
    lines.push("", group.title);
    for (const item of group.items) {
      lines.push(`${number}. ${item}`);
      number += 1;
    }
  }
  lines.push("", "Do not type the account number or IFSC. Those are read from the statement.");
  return lines.join("\n");
}
