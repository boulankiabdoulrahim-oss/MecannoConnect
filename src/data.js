// Emojis par service et visuel de carte (style "annonces colorées")
export const SE = {
  Vidange: "🛢️",
  Freins: "🛑",
  Moteur: "⚙️",
  Électricité: "🔋",
  Pneus: "🛞",
  Diagnostic: "🔍",
  Carrosserie: "🚘",
  "Climatisation automobile": "❄️",
  "Boîte de vitesses": "⚙️",
  "Chaîne et transmission": "⛓️",
  Carburateur: "⛽",
  "Suspension moto": "🛠️",
};
export const vis = (r) => (r.v.length > 1 ? "🔧" : r.v[0] === "Moto" ? "🏍️" : "🚗");
export const tone = (r) => "t" + (((r.id - 1) % 4) + 1); // t1 vert, t2 rouge, t3 ambre, t4 acier
