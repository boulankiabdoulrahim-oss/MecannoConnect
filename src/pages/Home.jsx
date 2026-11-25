import { SE, vis, tone } from "../data";
import { IcSearch, IcPin, IcArrow, IcCheck, Stars } from "../components/Common";
import { go } from "../router";

const UNIVERSES = {
  auto: {
    label: "Mecano Auto",
    vehicle: "Voiture",
    icon: "🚗",
    description: "Trouvez un garage ou un spécialiste automobile près de chez vous.",
    accent: "auto",
  },
  moto: {
    label: "Mecano Moto",
    vehicle: "Moto",
    icon: "🏍️",
    description: "Trouvez un mécanicien deux-roues et faites réparer votre moto.",
    accent: "moto",
  },
};

export default function Home({
  q,
  setQ,
  pick,
  shops,
  loading,
  error,
  services,
  universe,
  onSelectUniverse,
}) {
  if (!universe) {
    return (
      <main className="universe-home">
        <p className="eyebrow">MÉCANO CONNECT · PARAKOU</p>
        <h1>Bienvenue sur MécanoConnect</h1>
        <p className="universe-intro">
          Quel service recherchez-vous&nbsp;? Choisissez l’univers qui vous correspond.
        </p>
        <div className="universe-cards">
          {Object.entries(UNIVERSES).map(([key, item]) => (
            <button
              className={`universe-card ${item.accent}`}
              key={key}
              onClick={() => onSelectUniverse(key)}
              type="button"
            >
              <span className="universe-icon" aria-hidden="true">{item.icon}</span>
              <span className="universe-card-title">{item.label}</span>
              <span className="universe-card-description">{item.description}</span>
              <span className="universe-card-action">Découvrir <IcArrow size={18} /></span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  const currentUniverse = UNIVERSES[universe];
  const steps =
    universe === "auto"
      ? [
          ["Cherchez", "Choisissez une spécialité automobile et votre quartier."],
          ["Comparez", "Consultez les compétences, les avis et les horaires des garages."],
          ["Demandez un devis", "Décrivez la panne de votre voiture et recevez une réponse."],
        ]
      : [
          ["Cherchez", "Choisissez une spécialité moto et votre quartier."],
          ["Comparez", "Consultez les compétences, les avis et les horaires des mécaniciens."],
          ["Demandez un devis", "Décrivez la panne de votre deux-roues et recevez une réponse."],
        ];
  const search = (e) => {
    e.preventDefault();
    go("resultats");
  };
  const chip = (s) => {
    setQ({ ...q, service: s });
    go("resultats");
  };

  return (
    <div>
      <section className="hero">
        <div className="hero-l">
          <p className="eyebrow">{currentUniverse.label}</p>
          <h1>
            Une panne&nbsp;?<br />
            Trouvez votre spécialiste.<br />
            <span className="y">Près de chez vous !</span>
          </h1>
          <p className="lead">{currentUniverse.description} Comparez les compétences, contactez un professionnel ou demandez un devis.</p>
          <div className="mt16"><span className="universe-current">{currentUniverse.icon} Espace {currentUniverse.vehicle}</span></div>
          <form className="sb" onSubmit={search} role="search">
            <IcSearch className="mu" />
            <input
              aria-label="Quartier"
              placeholder="Quartier, par exemple Banikanni"
              value={q.lieu}
              onChange={(e) => setQ({ ...q, lieu: e.target.value })}
            />
            <span className="loc"><IcPin size={15} /> Parakou</span>
            <button className="btn p">Chercher <IcArrow size={16} /></button>
          </form>
        </div>
        <div className="stage" aria-hidden="true">
          <span className="glow"></span>
          <span className="em e1">{universe === "auto" ? "🛞" : "⛓️"}</span>
          <span className="em e2">{universe === "auto" ? "🔋" : "🪖"}</span>
          <span className="em e3">{currentUniverse.icon}</span>
          <span className="em e4">{universe === "auto" ? "🛠️" : "🔧"}</span>
          <span className="em e5">{universe === "auto" ? "⚙️" : "🛞"}</span>
          <span className="em e6">🔧</span>
        </div>
      </section>

      <div className="chips" id="services">
        {services.map((service) => (
          <button key={service.id} className={"chip" + (q.service === service.slug ? " on" : "")} onClick={() => chip(service.slug)}>
            <span aria-hidden="true">{SE[service.name] || "🔧"}</span> {service.name}
          </button>
        ))}
        <button className="chip" onClick={() => chip("")}>Tous</button>
      </div>

      <div className="sec">
        <h2>Spécialistes {currentUniverse.vehicle.toLowerCase()} près de vous</h2>
        <a className="more" href="#resultats">Voir tout <IcArrow size={14} /></a>
      </div>
      {error && <p className="form-error" role="alert">Impossible de charger les ateliers : {error}</p>}
      {loading ? (
        <p className="card mu">Chargement des ateliers…</p>
      ) : shops.length === 0 ? (
        <div className="card mu">
          Aucun professionnel {currentUniverse.vehicle.toLowerCase()} n’est encore publié dans votre ville.
        </div>
      ) : (
      <div className="cg">
        {shops.slice(0, 4).map((r) => (
          <a key={r.id} href="#fiche" className={"pc " + tone(r)} onClick={(e) => { e.preventDefault(); pick(r.id); }}>
            <div className="vis">
              {r.isVerified && <span className="vb"><IcCheck size={12} /> Professionnel vérifié</span>}
              <span className="em-l">{vis(r)}</span>
            </div>
            <div className="inf">
              <b>{r.n}</b>
              <span className="mu"><IcPin size={13} /> {r.q} · {r.city}</span>
              <span className="mu"><Stars r={r} /></span>
            </div>
          </a>
        ))}
      </div>
      )}

      <div className="sec" id="comment">
        <h2>Comment ça marche</h2>
      </div>
      <div className="g3">
        {steps.map(([a, b], i) => (
          <div className="card step" key={a}>
            <span className="num">{i + 1}</span>
            <b>{a}</b>
            <p className="mu">{b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
