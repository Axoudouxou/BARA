export const VERIFICATION_KINDS = {
  identityFront: "identity_front",
  identityBack: "identity_back",
  selfie: "selfie",
  qualification: "qualification",
} as const;

export const IDENTITY_KINDS = ["identity_front", "identity", "cni", "passport"];
export const QUALIFICATION_KINDS = ["qualification", "diploma", "diplome", "certificat"];

export const KIND_LABEL: Record<string, string> = {
  identity_front: "Pièce d'identité (recto)",
  identity_back: "Pièce d'identité (verso)",
  identity: "Pièce d'identité",
  cni: "Carte nationale d'identité",
  passport: "Passeport",
  selfie: "Selfie de vérification",
  qualification: "Diplôme ou justificatif",
  diploma: "Diplôme",
  diplome: "Diplôme",
  certificat: "Certificat",
  cv: "CV",
  other: "Autre document",
};

export type DossierStatus = "none" | "review" | "approved" | "rejected";

export function dossierStatus(input: {
  verification_status?: string | null;
  verification_submitted_at?: string | null;
}): DossierStatus {
  const status = input.verification_status ?? "pending";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return input.verification_submitted_at ? "review" : "none";
}

export const DOSSIER_LABEL: Record<DossierStatus, string> = {
  none: "Vérification non commencée",
  review: "Dossier en cours d'examen",
  approved: "Profil vérifié",
  rejected: "Dossier refusé",
};
