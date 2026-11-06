import type { ActionType, AlarmState } from "./types"

export const ACTION_LABELS: Record<ActionType, string> = {
  mission_success: "Mise — úspěch",
  mission_fail:    "Mise — neúspěch",
  lesson:          "Hodina",
  shidosei:        "Shidōsei",
  informant:       "Bonzování",
  monster:         "Monstrum",
  simulation:      "Simulace / soutěž",
  qr_quest:        "QR quest",
  peer_gift:       "Dar spolužákovi",
  correction:      "Korekce",
}

export const ACTION_DEFAULT_PTS: Record<ActionType, number> = {
  mission_success: 20, mission_fail: -5, lesson: 5, shidosei: 15,
  informant: 10, monster: 20, simulation: 10, qr_quest: 15, peer_gift: 5, correction: 0,
}

export const ALARM_COLORS: Record<AlarmState["type"], string> = {
  evacuation: "#c0392b", battle: "#d4813a", assembly: "#c8a917", custom: "#7d1520",
}

// Organizátoři pro podpis „Hotovo / Schváleno“ u textů v Přípravě.
// Kdo tu chybí, vybere „Jiné jméno“ a napíše se sám.
export const ORGANIZERS: string[] = ["Tomáš"]
